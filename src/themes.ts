import type { NavijsTheme } from "./types.js";

/** Default light theme — also exported as DEFAULT_THEME. */
export const lightTheme: NavijsTheme = {
  accent: "#5b8cff",
  bg: "#ffffff",
  fg: "#1f2937",
  overlay: "rgba(15, 23, 42, 0.55)",
  radius: "10px",
  spotlightPadding: 6,
};

/** Dark theme — sits on dark surfaces, light text. */
export const darkTheme: NavijsTheme = {
  accent: "#7aa2ff",
  bg: "#1f2937",
  fg: "#f3f4f6",
  overlay: "rgba(0, 0, 0, 0.7)",
  radius: "10px",
  spotlightPadding: 6,
};

/** Glass / frosted theme — semi-transparent tooltip with subtle accent. */
export const glassTheme: NavijsTheme = {
  accent: "#a78bfa",
  bg: "rgba(255, 255, 255, 0.78)",
  fg: "#0f172a",
  overlay: "rgba(15, 23, 42, 0.45)",
  radius: "16px",
  spotlightPadding: 10,
};

/** Minimal monochrome theme — black accent, hairline overlay. */
export const minimalTheme: NavijsTheme = {
  accent: "#111827",
  bg: "#ffffff",
  fg: "#111827",
  overlay: "rgba(17, 24, 39, 0.35)",
  radius: "4px",
  spotlightPadding: 4,
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
  glass: glassTheme,
  minimal: minimalTheme,
} as const;

export type ThemeName = keyof typeof themes;
