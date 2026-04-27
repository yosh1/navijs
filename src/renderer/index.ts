import type { NavijsTheme, ResolvedStep } from "../types.js";
import { computePlacement } from "./placement.js";
import { DEFAULT_THEME, ensureStyles } from "./styles.js";

export interface RendererOptions {
  rootElement?: HTMLElement;
  zIndex?: number;
  theme?: Partial<NavijsTheme>;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
}

interface ResolvedRendererOptions {
  rootElement: HTMLElement | null;
  zIndex: number;
  theme: NavijsTheme;
  closeOnEscape: boolean;
  closeOnOverlayClick: boolean;
}

export interface RendererCallbacks {
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onClose: () => void;
}

interface MountedState {
  step: ResolvedStep;
  target: HTMLElement;
  callbacks: RendererCallbacks;
  root: HTMLElement;
  overlay: HTMLDivElement;
  hole: SVGRectElement;
  tooltip: HTMLDivElement;
  liveRegion: HTMLDivElement;
  previousFocus: Element | null;
  scrollListeners: Array<() => void>;
  resizeObserver?: ResizeObserver;
  mutationObserver?: MutationObserver;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("inert"),
  );
}

const SVG_NS = "http://www.w3.org/2000/svg";

export class Renderer {
  private readonly opts: ResolvedRendererOptions;
  private state: MountedState | null = null;
  private boundOnKey?: (e: KeyboardEvent) => void;
  private boundReposition?: () => void;

  constructor(opts: RendererOptions = {}) {
    this.opts = {
      rootElement: opts.rootElement ?? null,
      zIndex: opts.zIndex ?? 9999,
      theme: { ...DEFAULT_THEME, ...(opts.theme ?? {}) },
      closeOnEscape: opts.closeOnEscape ?? true,
      closeOnOverlayClick: opts.closeOnOverlayClick ?? false,
    };
  }

  private resolveRoot(): HTMLElement {
    return this.opts.rootElement ?? document.body;
  }

  mount(target: HTMLElement, step: ResolvedStep, callbacks: RendererCallbacks): void {
    const previousFocus = this.state?.previousFocus ?? document.activeElement;
    this.unmount({ restoreFocus: false });
    ensureStyles(this.opts.theme, this.opts.zIndex);

    const root = document.createElement("div");
    root.className = "navijs-root";
    root.setAttribute("data-navijs", "");

    const { overlay, hole } = createOverlay(this.opts);
    root.appendChild(overlay);

    const tooltip = step.render
      ? wrapCustomRender(step, target, callbacks)
      : createTooltip(step, callbacks, this.opts.theme);
    root.appendChild(tooltip);

    const liveRegion = createLiveRegion();
    root.appendChild(liveRegion);

    this.resolveRoot().appendChild(root);

    if (this.opts.closeOnOverlayClick) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay || (e.target as Element).tagName === "svg" || (e.target as Element).tagName === "rect") {
          callbacks.onClose();
        }
      });
    }

    this.state = {
      step,
      target,
      callbacks,
      root,
      overlay,
      hole,
      tooltip,
      liveRegion,
      previousFocus,
      scrollListeners: [],
    };

    scrollIntoViewIfNeeded(target);
    this.position();
    this.attachListeners();

    // a11y wiring
    tooltip.setAttribute("role", "dialog");
    tooltip.setAttribute("aria-modal", "true");
    tooltip.tabIndex = -1;

    const titleEl = tooltip.querySelector<HTMLElement>(".navijs-title");
    const bodyEl = tooltip.querySelector<HTMLElement>(".navijs-body");
    if (titleEl) {
      const titleId = `navijs-title-${step.index}`;
      titleEl.id = titleId;
      tooltip.setAttribute("aria-labelledby", titleId);
    }
    if (bodyEl) {
      const bodyId = `navijs-body-${step.index}`;
      bodyEl.id = bodyId;
      tooltip.setAttribute("aria-describedby", bodyId);
    }

    // Announce the step to screen readers (next render frame so SR picks it up).
    const announcement = [step.title, typeof step.body === "string" ? step.body : ""]
      .filter(Boolean)
      .join(". ");
    if (announcement) {
      requestAnimationFrame(() => {
        liveRegion.textContent = `${step.index + 1} / ${step.total}: ${announcement}`;
      });
    }

    // Focus the primary action if available; otherwise the tooltip itself.
    queueMicrotask(() => {
      const primary = tooltip.querySelector<HTMLElement>(".navijs-btn-primary");
      (primary ?? tooltip).focus({ preventScroll: true });
    });
  }

  unmount(opts: { restoreFocus?: boolean } = { restoreFocus: true }): void {
    const s = this.state;
    if (!s) return;
    this.detachListeners();
    s.resizeObserver?.disconnect();
    s.mutationObserver?.disconnect();
    s.root.remove();

    if (opts.restoreFocus !== false && s.previousFocus instanceof HTMLElement) {
      // Avoid stealing focus mid-step-transition. Only restore on real close.
      try { s.previousFocus.focus({ preventScroll: true }); } catch { /* ignore */ }
    }

    this.state = null;
  }

  isMounted(): boolean {
    return this.state !== null;
  }

  private position(): void {
    const s = this.state;
    if (!s) return;
    const rect = s.target.getBoundingClientRect();
    const padding = this.opts.theme.spotlightPadding;

    s.hole.setAttribute("x", String(Math.max(0, rect.left - padding)));
    s.hole.setAttribute("y", String(Math.max(0, rect.top - padding)));
    s.hole.setAttribute("width", String(Math.max(0, rect.width + padding * 2)));
    s.hole.setAttribute("height", String(Math.max(0, rect.height + padding * 2)));

    // measure tooltip after it's in DOM
    const tipRect = s.tooltip.getBoundingClientRect();
    const placement = computePlacement(
      { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      { width: tipRect.width || 260, height: tipRect.height || 120 },
      s.step.placement ?? "auto",
      { width: window.innerWidth, height: window.innerHeight },
    );
    s.tooltip.style.top = `${placement.top}px`;
    s.tooltip.style.left = `${placement.left}px`;
    s.tooltip.dataset.placement = placement.placement;
  }

  private attachListeners(): void {
    const s = this.state;
    if (!s) return;

    this.boundReposition = () => this.position();
    window.addEventListener("scroll", this.boundReposition, true);
    window.addEventListener("resize", this.boundReposition);

    this.boundOnKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.opts.closeOnEscape) {
        s.callbacks.onClose();
        return;
      }
      if (e.key === "Tab") {
        const items = focusable(s.tooltip);
        if (items.length === 0) {
          e.preventDefault();
          s.tooltip.focus({ preventScroll: true });
          return;
        }
        const first = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        // Loop within the tooltip — never let focus leak into page chrome
        // while a modal tour is on screen.
        if (e.shiftKey) {
          if (active === first || active === s.tooltip) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", this.boundOnKey);

    if (typeof ResizeObserver !== "undefined") {
      s.resizeObserver = new ResizeObserver(() => this.position());
      s.resizeObserver.observe(s.target);
      s.resizeObserver.observe(s.tooltip);
    }
    if (typeof MutationObserver !== "undefined") {
      s.mutationObserver = new MutationObserver(() => this.position());
      s.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }
  }

  private detachListeners(): void {
    if (this.boundReposition) {
      window.removeEventListener("scroll", this.boundReposition, true);
      window.removeEventListener("resize", this.boundReposition);
    }
    if (this.boundOnKey) {
      window.removeEventListener("keydown", this.boundOnKey);
    }
    this.boundReposition = undefined;
    this.boundOnKey = undefined;
  }
}

function createOverlay(opts: ResolvedRendererOptions): { overlay: HTMLDivElement; hole: SVGRectElement } {
  const overlay = document.createElement("div");
  overlay.className = "navijs-overlay";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "none");

  const maskId = `navijs-mask-${Math.random().toString(36).slice(2, 8)}`;
  const defs = document.createElementNS(SVG_NS, "defs");
  const mask = document.createElementNS(SVG_NS, "mask");
  mask.setAttribute("id", maskId);

  const fullWhite = document.createElementNS(SVG_NS, "rect");
  fullWhite.setAttribute("x", "0");
  fullWhite.setAttribute("y", "0");
  fullWhite.setAttribute("width", "100%");
  fullWhite.setAttribute("height", "100%");
  fullWhite.setAttribute("fill", "white");

  const hole = document.createElementNS(SVG_NS, "rect");
  hole.setAttribute("fill", "black");
  hole.setAttribute("rx", "6");
  hole.setAttribute("ry", "6");

  mask.appendChild(fullWhite);
  mask.appendChild(hole);
  defs.appendChild(mask);
  svg.appendChild(defs);

  const dim = document.createElementNS(SVG_NS, "rect");
  dim.setAttribute("x", "0");
  dim.setAttribute("y", "0");
  dim.setAttribute("width", "100%");
  dim.setAttribute("height", "100%");
  dim.setAttribute("fill", opts.theme.overlay);
  dim.setAttribute("mask", `url(#${maskId})`);
  svg.appendChild(dim);

  overlay.appendChild(svg);
  return { overlay, hole };
}

function createTooltip(
  step: ResolvedStep,
  cb: RendererCallbacks,
  _theme: NavijsTheme,
): HTMLDivElement {
  const tooltip = document.createElement("div");
  tooltip.className = "navijs-tooltip";

  if (step.title) {
    const h = document.createElement("h3");
    h.className = "navijs-title";
    h.textContent = step.title;
    tooltip.appendChild(h);
  }

  const body = document.createElement("div");
  body.className = "navijs-body";
  appendBody(body, step.body);
  tooltip.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "navijs-actions";

  if (step.showSkip !== false && step.index < step.total - 1) {
    const skip = button("navijs-btn navijs-btn-skip", "skip", () => cb.onSkip());
    skip.textContent = step.nextLabel ? "" : "Skip";
    actions.appendChild(skip);
  }

  const progress = document.createElement("span");
  progress.className = "navijs-progress";
  if (step.showProgress !== false) {
    progress.textContent = `${step.index + 1} / ${step.total}`;
  }
  actions.appendChild(progress);

  const buttons = document.createElement("div");
  buttons.className = "navijs-buttons";

  if (step.index > 0) {
    buttons.appendChild(button("navijs-btn", step.prevLabel ?? "Back", () => cb.onPrev()));
  }
  const isLast = step.index === step.total - 1;
  const nextLabel = isLast ? (step.doneLabel ?? "Done") : (step.nextLabel ?? "Next");
  buttons.appendChild(button("navijs-btn navijs-btn-primary", nextLabel, () => cb.onNext()));

  actions.appendChild(buttons);
  tooltip.appendChild(actions);
  return tooltip;
}

function createLiveRegion(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "navijs-live";
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  // Visually hidden but read by screen readers.
  el.style.cssText =
    "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;";
  return el;
}

function appendBody(host: HTMLElement, body: ResolvedStep["body"]): void {
  if (body == null) return;
  const value = typeof body === "function" ? body() : body;
  if (typeof value === "string") {
    host.textContent = value; // textContent: XSS-safe
  } else if (value instanceof HTMLElement) {
    host.appendChild(value);
  }
}

function wrapCustomRender(
  step: ResolvedStep,
  target: HTMLElement,
  cb: RendererCallbacks,
): HTMLDivElement {
  // Caller owns chrome; we just position it and keep the tooltip class for
  // placement math. Users who want to break out of placement entirely can
  // set position via CSS on their returned root.
  const wrapper = document.createElement("div");
  wrapper.className = "navijs-tooltip navijs-tooltip-custom";
  const rendered = step.render!({
    step,
    target,
    next: cb.onNext,
    prev: cb.onPrev,
    skip: cb.onSkip,
    close: cb.onClose,
  });
  wrapper.appendChild(rendered);
  return wrapper;
}

function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function scrollIntoViewIfNeeded(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const inView =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth;
  if (!inView) {
    el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }
}
