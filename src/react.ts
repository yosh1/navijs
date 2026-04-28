import * as React from "react";
import { createGuide, type Guide } from "./guide.js";
import type { CreateGuideOptions } from "./types.js";

export interface UseGuideOptions extends CreateGuideOptions {
  /**
   * Define steps on the guide. Called once when the guide instance is created.
   * The guide is recreated only when `id` changes, so this callback's identity
   * is stable across renders even if you redefine it inline.
   */
  define: (guide: Guide) => void;

  /**
   * Auto-start the guide once it's created and the user hasn't completed it.
   * Default: false.
   */
  autoStart?: boolean;
}

export interface UseGuideReturn {
  /** Underlying Guide. `null` until the effect has created it (SSR / first paint). */
  guide: Guide | null;
  start: (opts?: { from?: number | string }) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  skip: () => Promise<void>;
  close: () => void;
  reset: () => void;
  isActive: boolean;
  isCompleted: boolean;
  currentStep: number;
  totalSteps: number;
}

interface ReactiveState {
  isActive: boolean;
  isCompleted: boolean;
  currentStep: number;
  totalSteps: number;
}

const INITIAL: ReactiveState = {
  isActive: false,
  isCompleted: false,
  currentStep: 0,
  totalSteps: 0,
};

export function useGuide(options: UseGuideOptions): UseGuideReturn {
  const defineRef = React.useRef(options.define);
  defineRef.current = options.define;

  const [guide, setGuide] = React.useState<Guide | null>(null);
  const [state, setState] = React.useState<ReactiveState>(INITIAL);

  const { id, autoStart } = options;

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const g = createGuide(options);
    defineRef.current(g);

    setGuide(g);
    setState(g.getSnapshot());

    const offStart = g.on("start", (ctx) =>
      setState((s) => ({
        ...s,
        isActive: true,
        currentStep: ctx.currentIndex,
        totalSteps: ctx.totalSteps,
      })),
    );
    const offStep = g.on("stepChange", ({ to, step }) =>
      setState((s) => ({ ...s, currentStep: to, totalSteps: step.total })),
    );
    const offComplete = g.on("complete", () =>
      setState((s) => ({ ...s, isActive: false, isCompleted: true })),
    );
    const offClose = g.on("close", () =>
      setState((s) => ({ ...s, isActive: false })),
    );

    if (autoStart && !g.isCompleted()) {
      void g.start();
    }

    return () => {
      offStart();
      offStep();
      offComplete();
      offClose();
      g.close();
    };
    // We deliberately key the effect on `id` only — the guide is a long-lived
    // controller and rebuilding it on every render would lose progress and
    // tear down the renderer. Other options are read at construction time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Prefer React 18+ external store sync when available.
  const useSyncExternalStore = (React as any).useSyncExternalStore as
    | undefined
    | ((subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => ReactiveState) => ReactiveState);

  const syncedState = useSyncExternalStore && guide
    ? useSyncExternalStore(
      (onStoreChange) => {
        const offStart = guide.on("start", onStoreChange);
        const offStep = guide.on("stepChange", onStoreChange);
        const offComplete = guide.on("complete", onStoreChange);
        const offClose = guide.on("close", onStoreChange);
        const offNotFound = guide.on("targetNotFound", onStoreChange);
        return () => {
          offStart();
          offStep();
          offComplete();
          offClose();
          offNotFound();
        };
      },
      () => guide.getSnapshot(),
    )
    : state;

  const start = React.useCallback(
    (o?: { from?: number | string }) => guide?.start(o) ?? Promise.resolve(),
    [guide],
  );
  const next = React.useCallback(() => guide?.next() ?? Promise.resolve(), [guide]);
  const prev = React.useCallback(() => guide?.prev() ?? Promise.resolve(), [guide]);
  const skip = React.useCallback(() => guide?.skip() ?? Promise.resolve(), [guide]);
  const close = React.useCallback(() => guide?.close(), [guide]);
  const reset = React.useCallback(() => guide?.reset(), [guide]);

  return {
    guide,
    start,
    next,
    prev,
    skip,
    close,
    reset,
    isActive: syncedState.isActive,
    isCompleted: syncedState.isCompleted,
    currentStep: syncedState.currentStep,
    totalSteps: syncedState.totalSteps,
  };
}

export { locator } from "./locator/index.js";
export type { Guide } from "./guide.js";
export type { Locator } from "./locator/types.js";
export type {
  CreateGuideOptions,
  GuideContext,
  GuideEvents,
  GuideState,
  GuideStorage,
  NavijsTheme,
  Placement,
  RenderContext,
  ResolvedStep,
  Step,
  StepBody,
  StepContext,
  StepRender,
  StorageKind,
} from "./types.js";
