import {
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
  type ShallowRef,
} from "vue";
import { createGuide, type Guide } from "./guide.js";
import type { CreateGuideOptions } from "./types.js";

/**
 * Vue 3.3 ships this as `MaybeRefOrGetter`, but the peer range starts at 3.0,
 * so it's declared locally rather than imported.
 */
export type MaybeRefOrGetter<T> = T | Ref<T> | (() => T);

export interface UseGuideOptions extends Omit<CreateGuideOptions, "id"> {
  /**
   * Guide id. Accepts a plain string, a ref, or a getter — pass a reactive one
   * to swap tours without remounting the component.
   */
  id: MaybeRefOrGetter<string>;

  /**
   * Define steps on the guide. Called once when the guide instance is created.
   * The guide is recreated only when `id` changes, so redefining this callback
   * inline on every render is fine.
   */
  define: (guide: Guide) => void;

  /**
   * Auto-start the guide once it's created and the user hasn't completed it.
   * Default: false.
   */
  autoStart?: boolean;
}

export interface UseGuideReturn {
  /**
   * Underlying Guide. `null` on the server and until the guide is created.
   * `shallowRef` on purpose — the Guide is a controller, not reactive data, and
   * deep-tracking its internals would be both wasteful and wrong.
   */
  guide: ShallowRef<Guide | null>;
  start: (opts?: { from?: number | string }) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  skip: () => Promise<void>;
  close: () => void;
  reset: () => void;
  isActive: ComputedRef<boolean>;
  isCompleted: ComputedRef<boolean>;
  currentStep: ComputedRef<number>;
  totalSteps: ComputedRef<number>;
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

/**
 * Read a plain value, a ref, or a getter. Mirrors Vue 3.3's `toValue`, which we
 * can't import directly because the peer range starts at 3.0.
 */
function read<T>(source: MaybeRefOrGetter<T>): T {
  if (typeof source === "function") return (source as () => T)();
  if (source && typeof source === "object" && "value" in source) {
    return (source as Ref<T>).value;
  }
  return source as T;
}

/**
 * Create and own a Guide for the lifetime of the calling scope.
 *
 * The guide is created lazily (never during SSR) and torn down when the
 * component's effect scope is disposed. Passing a ref or getter as `id`
 * rebuilds the guide when the id changes, matching the React adapter's
 * `[id]`-keyed effect.
 */
export function useGuide(options: UseGuideOptions): UseGuideReturn {
  const guide = shallowRef<Guide | null>(null);
  const state = ref<ReactiveState>({ ...INITIAL });

  // Read `define` off the options object at build time rather than capturing it
  // as a dependency: the guide is long-lived and rebuilding it on every render
  // would lose progress and tear down the renderer.
  let teardown: (() => void) | null = null;

  const dispose = () => {
    teardown?.();
    teardown = null;
  };

  const build = (id: string) => {
    dispose();

    // No DOM on the server — stay null and let the client build it on mount.
    if (typeof window === "undefined") return;

    const g = createGuide({ ...options, id });
    options.define(g);

    guide.value = g;
    state.value = g.getSnapshot();

    // Mirror the full snapshot rather than patching fields, so the reactive
    // copy can never drift from the controller's actual state.
    const sync = () => {
      state.value = g.getSnapshot();
    };
    const offs = [
      g.on("start", sync),
      g.on("stepChange", sync),
      g.on("complete", sync),
      g.on("close", sync),
      g.on("targetNotFound", sync),
    ];

    if (options.autoStart && !g.isCompleted()) {
      void g.start();
    }

    teardown = () => {
      for (const off of offs) off();
      g.close();
      if (guide.value === g) {
        guide.value = null;
        state.value = { ...INITIAL };
      }
    };
  };

  watch(() => read(options.id), build, { immediate: true });

  // `getCurrentScope` guards against being called outside a component (e.g. in
  // a plain script or a test), where `onScopeDispose` would warn.
  if (getCurrentScope()) onScopeDispose(dispose);

  return {
    guide,
    start: (o?: { from?: number | string }) => guide.value?.start(o) ?? Promise.resolve(),
    next: () => guide.value?.next() ?? Promise.resolve(),
    prev: () => guide.value?.prev() ?? Promise.resolve(),
    skip: () => guide.value?.skip() ?? Promise.resolve(),
    close: () => guide.value?.close(),
    reset: () => guide.value?.reset(),
    isActive: computed(() => state.value.isActive),
    isCompleted: computed(() => state.value.isCompleted),
    currentStep: computed(() => state.value.currentStep),
    totalSteps: computed(() => state.value.totalSteps),
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
