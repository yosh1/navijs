import { NavijsError } from "./errors.js";
import { EventEmitter } from "./events.js";
import { locator as makeLocator } from "./locator/index.js";
import type { Locator } from "./locator/types.js";
import { Renderer } from "./renderer/index.js";
import { emptyState, resolveStorage } from "./storage.js";
import type {
  CreateGuideOptions,
  GuideContext,
  GuideEvents,
  GuideState,
  GuideStorage,
  ResolvedStep,
  Step,
} from "./types.js";

export class Guide {
  readonly id: string;
  private readonly steps: Step[] = [];
  private readonly storage: GuideStorage;
  private readonly emitter = new EventEmitter();
  private readonly renderer: Renderer;
  private readonly opts: Required<Pick<CreateGuideOptions, "id">> & CreateGuideOptions;

  private state: GuideState;
  private active = false;
  private waitingForUrl = false;
  private urlCleanup?: () => void;

  constructor(opts: CreateGuideOptions) {
    if (!opts.id) throw new NavijsError("INVALID_OPTION", "createGuide requires an id");

    this.opts = opts;
    this.id = opts.id;
    this.storage = resolveStorage(opts.storage);
    this.state = this.storage.get(opts.id) ?? emptyState(opts.id);

    this.renderer = new Renderer({
      rootElement: opts.rootElement,
      zIndex: opts.zIndex ?? 9999,
      theme: opts.theme,
      closeOnEscape: opts.closeOnEscape ?? true,
      closeOnOverlayClick: opts.closeOnOverlayClick ?? false,
    });

    if (opts.events) {
      for (const [name, handler] of Object.entries(opts.events) as [keyof GuideEvents, GuideEvents[keyof GuideEvents]][]) {
        if (handler) this.on(name, handler);
      }
    }
  }

  // ---- public API ---------------------------------------------------------

  addStep(step: Step): this {
    if (!step.target) throw new NavijsError("INVALID_STEP", "step.target is required");
    if (step.body == null && step.render == null) {
      throw new NavijsError("INVALID_STEP", "step requires either `body` or `render`");
    }
    this.steps.push(step);
    return this;
  }

  on<E extends keyof GuideEvents>(event: E, handler: GuideEvents[E]): () => void {
    return this.emitter.on(event, handler);
  }
  off<E extends keyof GuideEvents>(event: E, handler: GuideEvents[E]): void {
    this.emitter.off(event, handler);
  }

  isCompleted(): boolean {
    return this.state.completed;
  }

  isActive(): boolean {
    return this.active;
  }

  getStepCount(): number {
    return this.steps.length;
  }

  getCurrentStep(): Step | null {
    return this.steps[this.state.currentStep] ?? null;
  }

  reset(): void {
    this.state = emptyState(this.id);
    this.storage.remove(this.id);
  }

  async start(opts: { from?: number | string } = {}): Promise<void> {
    if (this.steps.length === 0) {
      throw new NavijsError("NO_STEPS", "no steps were added before start()");
    }
    if (this.active) return;
    this.active = true;

    let startIndex = 0;
    if (opts.from != null) {
      startIndex = this.indexOf(opts.from);
    } else if (!this.state.completed && this.state.currentStep > 0) {
      startIndex = this.state.currentStep;
    }

    this.emitter.emit("start", this.context());
    await this.setIndex(startIndex, /* prevIndex */ -1);
  }

  async next(): Promise<void> {
    if (!this.active) return;
    const from = this.state.currentStep;
    const nextIndex = from + 1;
    if (nextIndex >= this.steps.length) {
      await this.complete();
      return;
    }
    await this.setIndex(nextIndex, from);
  }

  async prev(): Promise<void> {
    if (!this.active) return;
    const from = this.state.currentStep;
    const target = Math.max(0, from - 1);
    if (target === from) return;
    await this.setIndex(target, from);
  }

  async skip(): Promise<void> {
    // Skip behaves like next() but emits close (user opted out).
    if (!this.active) return;
    const from = this.state.currentStep;
    const nextIndex = from + 1;
    if (nextIndex >= this.steps.length) {
      this.close();
      return;
    }
    await this.setIndex(nextIndex, from);
  }

  close(): void {
    if (!this.active) return;
    this.active = false;
    this.persist();
    this.renderer.unmount();
    this.detachUrlWatch();
    this.emitter.emit("close", this.context());
  }

  // ---- internals ----------------------------------------------------------

  private context(): GuideContext {
    return {
      guideId: this.id,
      currentIndex: this.state.currentStep,
      totalSteps: this.steps.length,
    };
  }

  private async complete(): Promise<void> {
    this.active = false;
    this.state = { ...this.state, completed: true };
    this.persist();
    this.renderer.unmount();
    this.detachUrlWatch();
    this.emitter.emit("complete", this.context());
  }

  private async setIndex(to: number, from: number): Promise<void> {
    const step = this.steps[to];
    if (!step) {
      await this.complete();
      return;
    }

    if (step.canRender && !step.canRender()) {
      // skip this step; advance toward the end
      this.state = { ...this.state, currentStep: to };
      this.persist();
      if (to >= this.steps.length - 1) {
        await this.complete();
        return;
      }
      await this.setIndex(to + 1, from);
      return;
    }

    if (!this.urlMatches(step)) {
      this.state = { ...this.state, currentStep: to };
      this.persist();
      this.renderer.unmount();
      this.attachUrlWatch(); // wait for the user to navigate; resume on URL change
      return;
    }
    this.detachUrlWatch();

    const resolved: ResolvedStep = {
      ...step,
      index: to,
      total: this.steps.length,
    };

    if (step.beforeShow) {
      try { await step.beforeShow({ step: resolved, element: null, guideId: this.id }); }
      catch (err) { console.error("[navijs] beforeShow threw:", err); }
    }
    // close() may have fired during the await (e.g. React StrictMode cleanup);
    // bailing here avoids mounting a renderer the guide will never unmount.
    if (!this.active) return;

    const loc = toLocator(step.target);
    let element: HTMLElement | null = null;
    try {
      element = await loc.waitFor(document);
    } catch {
      element = null;
    }
    if (!this.active) return;

    if (!element) {
      this.emitter.emit("targetNotFound", { step: resolved, locator: loc });
      // pause — user can call next() / close() / start() again to retry
      this.renderer.unmount();
      return;
    }

    this.state = { ...this.state, currentStep: to, completed: false };
    this.persist();
    this.emitter.emit("stepChange", { from, to, step: resolved });

    this.renderer.mount(element, resolved, {
      onNext: () => { void this.next(); },
      onPrev: () => { void this.prev(); },
      onSkip: () => { void this.skip(); },
      onClose: () => { this.close(); },
    });

    if (step.afterShow) {
      try { step.afterShow({ step: resolved, element, guideId: this.id }); }
      catch (err) { console.error("[navijs] afterShow threw:", err); }
    }
  }

  private urlMatches(step: Step): boolean {
    if (!step.url) return true;
    if (typeof location === "undefined") return true;
    if (typeof step.url === "string") return location.pathname === step.url || location.href === step.url;
    if (step.url instanceof RegExp) return step.url.test(location.pathname) || step.url.test(location.href);
    return step.url(location);
  }

  private attachUrlWatch(): void {
    if (this.waitingForUrl) return;
    if (typeof window === "undefined") return;
    this.waitingForUrl = true;

    const onChange = () => {
      const step = this.steps[this.state.currentStep];
      if (!step) return;
      if (this.urlMatches(step)) {
        // re-enter the same index; setIndex handles renderer mount.
        this.detachUrlWatch();
        if (this.active) void this.setIndex(this.state.currentStep, -1);
      }
    };

    window.addEventListener("popstate", onChange);
    window.addEventListener("hashchange", onChange);

    // patch pushState/replaceState once so SPA navigations notify us.
    const history = window.history;
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = function (...args) {
      const r = origPush(...(args as Parameters<typeof history.pushState>));
      window.dispatchEvent(new Event("navijs:locationchange"));
      return r;
    };
    history.replaceState = function (...args) {
      const r = origReplace(...(args as Parameters<typeof history.replaceState>));
      window.dispatchEvent(new Event("navijs:locationchange"));
      return r;
    };
    window.addEventListener("navijs:locationchange", onChange);

    this.urlCleanup = () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("navijs:locationchange", onChange);
      history.pushState = origPush;
      history.replaceState = origReplace;
      this.waitingForUrl = false;
    };
  }

  private detachUrlWatch(): void {
    this.urlCleanup?.();
    this.urlCleanup = undefined;
    this.waitingForUrl = false;
  }

  private indexOf(ref: number | string): number {
    if (typeof ref === "number") return Math.max(0, Math.min(ref, this.steps.length - 1));
    const i = this.steps.findIndex((s) => s.id === ref);
    if (i < 0) throw new NavijsError("INVALID_OPTION", `step "${ref}" not found`);
    return i;
  }

  private persist(): void {
    this.storage.set(this.id, this.state);
  }
}

function toLocator(target: Step["target"]): Locator {
  if (typeof target === "string") return makeLocator().bySelector(target);
  return target;
}

export function createGuide(opts: CreateGuideOptions): Guide {
  return new Guide(opts);
}
