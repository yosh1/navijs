/**
 * happy-dom doesn't run layout, so `getBoundingClientRect()` returns 0×0 for
 * every element. navijs's visibility filter treats 0×0 as hidden, which would
 * make every locator test fail. Patch the rect to a non-zero box for any
 * element that is connected and not display:none — i.e. mirror what a real
 * browser layout would produce for our tiny test fixtures.
 */
const originalRect = Element.prototype.getBoundingClientRect;

Element.prototype.getBoundingClientRect = function rect(this: Element) {
  const r = originalRect.call(this);
  if (r.width !== 0 || r.height !== 0) return r;
  if (!this.isConnected) return r;
  const style = this.ownerDocument?.defaultView?.getComputedStyle(this);
  if (style && (style.display === "none" || style.visibility === "hidden")) return r;
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 100,
    bottom: 20,
    width: 100,
    height: 20,
    toJSON: () => r,
  } as DOMRect;
};
