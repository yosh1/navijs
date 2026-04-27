export function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
  if (!style) return true; // fallback: assume visible
  if (style.display === "none") return false;
  if (style.visibility === "hidden" || style.visibility === "collapse") return false;
  if (parseFloat(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
}

export function depth(el: HTMLElement): number {
  let d = 0;
  let cur: HTMLElement | null = el;
  while (cur) {
    d++;
    cur = cur.parentElement;
  }
  return d;
}

export function isInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const win = el.ownerDocument?.defaultView;
  if (!win) return true;
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < win.innerHeight &&
    rect.left < win.innerWidth
  );
}
