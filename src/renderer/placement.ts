import type { Placement } from "../types.js";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PlacementResult {
  placement: Exclude<Placement, "auto">;
  top: number;
  left: number;
}

const GAP = 12;

export function computePlacement(
  targetRect: Rect,
  tooltipSize: { width: number; height: number },
  preferred: Placement,
  viewport: { width: number; height: number },
): PlacementResult {
  const order: Exclude<Placement, "auto">[] = preferred === "auto"
    ? ["bottom", "top", "right", "left"]
    : [preferred, ...(["bottom", "top", "right", "left"] as const).filter((p) => p !== preferred)];

  for (const candidate of order) {
    const pos = positionFor(candidate, targetRect, tooltipSize);
    if (fitsInViewport(pos, tooltipSize, viewport)) {
      return { placement: candidate, ...clampToViewport(pos, tooltipSize, viewport) };
    }
  }

  // Nothing fits cleanly — pick the preferred (or bottom) and clamp.
  const fallback = preferred === "auto" ? "bottom" : preferred;
  const pos = positionFor(fallback, targetRect, tooltipSize);
  return { placement: fallback, ...clampToViewport(pos, tooltipSize, viewport) };
}

function positionFor(
  placement: Exclude<Placement, "auto">,
  target: Rect,
  size: { width: number; height: number },
): { top: number; left: number } {
  switch (placement) {
    case "top":
      return {
        top: target.top - size.height - GAP,
        left: target.left + target.width / 2 - size.width / 2,
      };
    case "bottom":
      return {
        top: target.top + target.height + GAP,
        left: target.left + target.width / 2 - size.width / 2,
      };
    case "left":
      return {
        top: target.top + target.height / 2 - size.height / 2,
        left: target.left - size.width - GAP,
      };
    case "right":
      return {
        top: target.top + target.height / 2 - size.height / 2,
        left: target.left + target.width + GAP,
      };
  }
}

function fitsInViewport(
  pos: { top: number; left: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): boolean {
  return (
    pos.top >= 8 &&
    pos.left >= 8 &&
    pos.top + size.height <= viewport.height - 8 &&
    pos.left + size.width <= viewport.width - 8
  );
}

function clampToViewport(
  pos: { top: number; left: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  return {
    top: clamp(pos.top, 8, Math.max(8, viewport.height - size.height - 8)),
    left: clamp(pos.left, 8, Math.max(8, viewport.width - size.width - 8)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
