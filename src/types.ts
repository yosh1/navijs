import type { Locator } from "./locator/types.js";

export type Placement = "top" | "bottom" | "left" | "right" | "auto";

export type StepBody =
  | string
  | HTMLElement
  | (() => string | HTMLElement);

export interface Step {
  id?: string;
  target: Locator | string;
  title?: string;
  body: StepBody;
  placement?: Placement;
  url?: string | RegExp | ((loc: Location) => boolean);
  canRender?: () => boolean;
  beforeShow?: (ctx: StepContext) => void | Promise<void>;
  afterShow?: (ctx: StepContext) => void;
  showProgress?: boolean;
  showSkip?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  doneLabel?: string;
}

export interface ResolvedStep extends Step {
  index: number;
  total: number;
}

export interface StepContext {
  step: ResolvedStep;
  element: HTMLElement | null;
  guideId: string;
}

export interface GuideContext {
  guideId: string;
  currentIndex: number;
  totalSteps: number;
}

export interface GuideEvents {
  start: (ctx: GuideContext) => void;
  stepChange: (ctx: { from: number; to: number; step: ResolvedStep }) => void;
  complete: (ctx: GuideContext) => void;
  close: (ctx: GuideContext) => void;
  targetNotFound: (ctx: { step: ResolvedStep; locator: Locator }) => void;
}

export interface NavijsTheme {
  accent: string;
  bg: string;
  fg: string;
  overlay: string;
  radius: string;
  spotlightPadding: number;
}

export type StorageKind = "localStorage" | "memory";

export interface GuideState {
  guideId: string;
  currentStep: number;
  completed: boolean;
  version: number;
}

export interface GuideStorage {
  get(key: string): GuideState | null;
  set(key: string, state: GuideState): void;
  remove(key: string): void;
}

export interface CreateGuideOptions {
  id: string;
  storage?: StorageKind | GuideStorage;
  theme?: Partial<NavijsTheme>;
  events?: Partial<GuideEvents>;
  rootElement?: HTMLElement;
  zIndex?: number;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
}
