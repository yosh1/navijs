import { createQueryContext, describeStrategy, elementMatchesText, runStrategy } from "./strategies.js";
import type {
  ByRoleOptions,
  ByTextOptions,
  Locator,
  Strategy,
} from "./types.js";
import { depth, isInViewport, isVisible } from "./visibility.js";

interface ChainState {
  strategies: Strategy[];
  fallback?: LocatorImpl;
  timeoutMs: number;
  includeHidden: boolean;
  pierceShadow: boolean;
  optimize: boolean;
}

class LocatorImpl implements Locator {
  private readonly state: ChainState;

  constructor(state?: Partial<ChainState>) {
    this.state = {
      strategies: state?.strategies ?? [],
      fallback: state?.fallback,
      timeoutMs: state?.timeoutMs ?? 5000,
      includeHidden: state?.includeHidden ?? false,
      pierceShadow: state?.pierceShadow ?? true,
      optimize: state?.optimize ?? false,
    };
  }

  private extend(s: Strategy): LocatorImpl {
    return new LocatorImpl({ ...this.state, strategies: [...this.state.strategies, s] });
  }

  byText(text: string | RegExp, options: ByTextOptions = {}): Locator {
    return this.extend({ kind: "text", value: text, options });
  }
  byRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.extend({ kind: "role", value: role, options });
  }
  byAriaLabel(label: string | RegExp): Locator {
    return this.extend({ kind: "ariaLabel", value: label });
  }
  byTestId(id: string): Locator {
    return this.extend({ kind: "testId", value: id });
  }
  bySelector(css: string): Locator {
    return this.extend({ kind: "selector", value: css });
  }
  byXPath(xpath: string): Locator {
    return this.extend({ kind: "xpath", value: xpath });
  }
  fallback(other: Locator): Locator {
    return new LocatorImpl({ ...this.state, fallback: other as LocatorImpl });
  }
  timeout(ms: number): Locator {
    return new LocatorImpl({ ...this.state, timeoutMs: Math.max(0, ms) });
  }
  includeHidden(): Locator {
    return new LocatorImpl({ ...this.state, includeHidden: true });
  }
  skipShadow(): Locator {
    return new LocatorImpl({ ...this.state, pierceShadow: false });
  }

  optimize(): Locator {
    return new LocatorImpl({ ...this.state, optimize: true });
  }

  resolve(root?: ParentNode): HTMLElement | null {
    return this.resolveAll(root)[0] ?? null;
  }

  resolveAll(root: ParentNode = document): HTMLElement[] {
    const ranked = this.evaluateChain(root);
    if (ranked.length > 0) return ranked;
    if (this.state.fallback) return this.state.fallback.resolveAll(root);
    return [];
  }

  waitFor(root: ParentNode = document): Promise<HTMLElement> {
    const found = this.resolve(root);
    if (found) return Promise.resolve(found);
    if (this.state.timeoutMs === 0) {
      return Promise.reject(new Error(this.notFoundMessage(0, root)));
    }

    return new Promise<HTMLElement>((resolve, reject) => {
      const target = (root as Document).defaultView ? (root as Document).body : (root as HTMLElement);
      if (!target) {
        reject(new Error(this.notFoundMessage(0, root)));
        return;
      }

      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
      };

      let scheduled = false;
      const run = () => {
        scheduled = false;
        if (settled) return;
        const el = this.resolve(root);
        if (el) {
          cleanup();
          resolve(el);
        }
      };

      const tick = () => {
        if (settled) return;
        if (scheduled) return;
        scheduled = true;
        // Coalesce bursts of DOM mutations into a single resolve per frame.
        (typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : setTimeout)(run as any);
      };

      const observer = new MutationObserver(tick);
      const needsText = this.state.strategies.some((s) => s.kind === "text");
      observer.observe(target, {
        childList: true,
        subtree: true,
        // attributes+characterData can be extremely noisy; keep them as narrow as possible.
        attributes: true,
        attributeFilter: [
          "id",
          "class",
          "role",
          "aria-label",
          "aria-labelledby",
          "aria-describedby",
          "data-testid",
          "data-test-id",
          "name",
        ],
        characterData: needsText,
      });

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(this.notFoundMessage(this.state.timeoutMs, root)));
      }, this.state.timeoutMs);

      // try once after subscribe in case the element appeared between resolve() and observe()
      tick();
    });
  }

  describe(): string {
    const head = this.state.strategies.map(describeStrategy).join(" ∩ ") || "<empty>";
    const tail = this.state.fallback ? ` || fallback(${this.state.fallback.describe()})` : "";
    return head + tail;
  }

  diagnose(root: ParentNode = document): string | null {
    const strategies = this.state.optimize
      ? optimizeStrategies(this.state.strategies)
      : this.state.strategies;
    const diag = diagnose(root, strategies, this.state.pierceShadow);
    return diag;
  }

  private evaluateChain(root: ParentNode): HTMLElement[] {
    const { includeHidden, pierceShadow } = this.state;
    const strategies = this.state.optimize
      ? optimizeStrategies(this.state.strategies)
      : this.state.strategies;
    if (strategies.length === 0) return [];

    const ctx = createQueryContext(root, pierceShadow);

    let candidates: HTMLElement[] | null = null;
    for (const strategy of strategies) {
      if (candidates !== null && strategy.kind === "text") {
        const exact = strategy.options.exact ?? false;
        candidates = candidates.filter((el) => elementMatchesText(el, strategy.value, exact, pierceShadow));
      } else {
        const matched = runStrategy(strategy, root, pierceShadow, ctx);
        candidates = candidates === null
          ? matched
          : intersect(candidates, matched);
      }
      if (candidates.length === 0) return [];
    }

    let pool = candidates ?? [];
    if (!includeHidden) pool = pool.filter(isVisible);
    return rank(pool);
  }

  private notFoundMessage(elapsed: number, root?: ParentNode): string {
    const base = `[navijs] target not found${elapsed ? ` after ${elapsed}ms` : ""} — chain: ${this.describe()}`;
    if (!root) return base;
    const diag = diagnose(root, this.state.strategies, this.state.pierceShadow);
    if (!diag) return base;
    return `${base}\n${diag}`;
  }
}

function optimizeStrategies(strategies: Strategy[]): Strategy[] {
  // Heuristic: prefer strategies that tend to return a smaller candidate set
  // and/or are cheaper than full text walking.
  const weight = (s: Strategy): number => {
    switch (s.kind) {
      case "testId": return 0;
      case "selector": return 1;
      case "role": return 2;
      case "ariaLabel": return 3;
      case "xpath": return 4;
      case "text": return 5;
    }
  };

  // Stable sort to preserve user intent as much as possible.
  return strategies
    .map((s, i) => ({ s, i, w: weight(s) }))
    .sort((a, b) => (a.w - b.w) || (a.i - b.i))
    .map((x) => x.s);
}

function diagnose(root: ParentNode, strategies: Strategy[], pierceShadow: boolean): string | null {
  try {
    let candidates: HTMLElement[] | null = null;
    const lines: string[] = [];
    const ctx = createQueryContext(root, pierceShadow);
    for (const strategy of strategies) {
      const t0 = now();
      const matched = runStrategy(strategy, root, pierceShadow, ctx);
      const dt = now() - t0;
      const nextCandidates: HTMLElement[] = candidates === null
        ? matched
        : intersect(candidates, matched);
      lines.push(`  - ${describeStrategy(strategy)}: matched=${matched.length}, afterIntersect=${nextCandidates.length}, time=${dt.toFixed(1)}ms`);
      candidates = nextCandidates;
      if (candidates.length === 0) break;
    }
    return lines.length ? `[navijs] locator diagnostics:\n${lines.join("\n")}` : null;
  } catch {
    return null;
  }
}

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function intersect(a: HTMLElement[], b: HTMLElement[]): HTMLElement[] {
  if (a.length === 0 || b.length === 0) return [];
  const set = new Set(a);
  return b.filter((el) => set.has(el));
}

function rank(items: HTMLElement[]): HTMLElement[] {
  return [...items].sort((a, b) => {
    const va = isInViewport(a) ? 0 : 1;
    const vb = isInViewport(b) ? 0 : 1;
    if (va !== vb) return va - vb;
    const da = depth(a);
    const db = depth(b);
    if (da !== db) return da - db;
    // document order: a before b => -1
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

export function locator(): Locator {
  return new LocatorImpl();
}

export type { Locator } from "./types.js";
