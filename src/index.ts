export { createGuide, Guide } from "./guide.js";
export { locator } from "./locator/index.js";
export { NavijsError } from "./errors.js";
export { DEFAULT_THEME } from "./renderer/styles.js";

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

export const VERSION = "0.1.0";
