import { describeStrategy, runStrategy } from "./strategies.js";
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
}

class LocatorImpl implements Locator {
  private readonly state: ChainState;

  constructor(state?: Partial<ChainState>) {
    this.state = {
      strategies: state?.strategies ?? [],
      fallback: state?.fallback,
      timeoutMs: state?.timeoutMs ?? 5000,
      includeHidden: state?.includeHidden ?? false,
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
      return Promise.reject(new Error(this.notFoundMessage(0)));
    }

    return new Promise<HTMLElement>((resolve, reject) => {
      const target = (root as Document).defaultView ? (root as Document).body : (root as HTMLElement);
      if (!target) {
        reject(new Error(this.notFoundMessage(0)));
        return;
      }

      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
      };

      const tick = () => {
        if (settled) return;
        const el = this.resolve(root);
        if (el) {
          cleanup();
          resolve(el);
        }
      };

      const observer = new MutationObserver(tick);
      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(this.notFoundMessage(this.state.timeoutMs)));
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

  private evaluateChain(root: ParentNode): HTMLElement[] {
    const { strategies, includeHidden } = this.state;
    if (strategies.length === 0) return [];

    let candidates: HTMLElement[] | null = null;
    for (const strategy of strategies) {
      const matched = runStrategy(strategy, root);
      candidates = candidates === null
        ? matched
        : intersect(candidates, matched);
      if (candidates.length === 0) return [];
    }

    let pool = candidates ?? [];
    if (!includeHidden) pool = pool.filter(isVisible);
    return rank(pool);
  }

  private notFoundMessage(elapsed: number): string {
    return `[navijs] target not found${elapsed ? ` after ${elapsed}ms` : ""} — chain: ${this.describe()}`;
  }
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
