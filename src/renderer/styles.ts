import type { NavijsTheme } from "../types.js";

export const DEFAULT_THEME: NavijsTheme = {
  accent: "#5b8cff",
  bg: "#ffffff",
  fg: "#1f2937",
  overlay: "rgba(15, 23, 42, 0.55)",
  radius: "10px",
  spotlightPadding: 6,
};

const STYLE_ID = "navijs-styles";

export function ensureStyles(theme: NavijsTheme, zIndex: number): void {
  const doc = document;
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = buildCss(theme, zIndex);
}

function buildCss(t: NavijsTheme, z: number): string {
  return `
:root {
  --navijs-accent: ${t.accent};
  --navijs-bg: ${t.bg};
  --navijs-fg: ${t.fg};
  --navijs-overlay: ${t.overlay};
  --navijs-radius: ${t.radius};
}
.navijs-root {
  position: fixed;
  inset: 0;
  z-index: ${z};
  pointer-events: none;
}
.navijs-overlay {
  position: fixed;
  inset: 0;
  pointer-events: auto;
}
.navijs-overlay svg {
  width: 100%;
  height: 100%;
  display: block;
}
.navijs-tooltip {
  position: absolute;
  max-width: 320px;
  min-width: 220px;
  background: var(--navijs-bg);
  color: var(--navijs-fg);
  border-radius: var(--navijs-radius);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 16px 18px;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
  pointer-events: auto;
  box-sizing: border-box;
}
.navijs-tooltip[data-placement="top"]    { transform: translateY(-8px); }
.navijs-tooltip[data-placement="bottom"] { transform: translateY(8px); }
.navijs-tooltip[data-placement="left"]   { transform: translateX(-8px); }
.navijs-tooltip[data-placement="right"]  { transform: translateX(8px); }
.navijs-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--navijs-fg);
}
.navijs-body {
  margin: 0 0 14px;
  color: var(--navijs-fg);
}
.navijs-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.navijs-progress {
  font-size: 12px;
  color: rgba(0,0,0,0.5);
}
.navijs-buttons {
  display: flex;
  gap: 6px;
}
.navijs-btn {
  border: 0;
  border-radius: 6px;
  padding: 6px 12px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  background: transparent;
  color: var(--navijs-fg);
}
.navijs-btn:hover { background: rgba(0,0,0,0.05); }
.navijs-btn-primary {
  background: var(--navijs-accent);
  color: #fff;
}
.navijs-btn-primary:hover { filter: brightness(1.05); }
.navijs-btn-skip {
  margin-right: auto;
  color: rgba(0,0,0,0.5);
  padding-left: 0;
  padding-right: 0;
}
@media (prefers-color-scheme: dark) {
  :root {
    --navijs-bg: #1f2937;
    --navijs-fg: #f3f4f6;
  }
  .navijs-btn:hover { background: rgba(255,255,255,0.08); }
  .navijs-progress { color: rgba(255,255,255,0.5); }
  .navijs-btn-skip { color: rgba(255,255,255,0.5); }
}
@media (prefers-reduced-motion: reduce) {
  .navijs-tooltip { transform: none !important; }
}
`;
}
