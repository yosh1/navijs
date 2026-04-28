import { JSDOM } from "jsdom";
import { performance } from "node:perf_hooks";

// Build first: `npm run build`
// Run: `node scripts/bench-locator.mjs`

const { locator } = await import(new URL("../dist/index.js", import.meta.url));

function buildDom({ nodes = 5000, shadowEvery = 50 } = {}) {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    pretendToBeVisual: true,
  });
  const { document } = dom.window;

  const root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);

  for (let i = 0; i < nodes; i++) {
    const el = document.createElement("div");
    el.className = "item";
    el.textContent = `Item ${i}`;
    root.appendChild(el);

    if (i % shadowEvery === 0) {
      const host = document.createElement("div");
      host.className = "host";
      const sr = host.attachShadow({ mode: "open" });
      const inner = document.createElement("button");
      inner.textContent = `Shadow button ${i}`;
      sr.appendChild(inner);
      root.appendChild(host);
    }
  }

  // Put a target deep in shadow root.
  const host = document.createElement("div");
  const sr = host.attachShadow({ mode: "open" });
  const btn = document.createElement("button");
  btn.setAttribute("data-testid", "target");
  btn.textContent = "Target";
  sr.appendChild(btn);
  root.appendChild(host);

  return dom;
}

function bench(label, fn, iters = 30) {
  // Warmup
  for (let i = 0; i < 5; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const t1 = performance.now();
  const ms = (t1 - t0) / iters;
  console.log(`${label}: ${ms.toFixed(2)}ms/op (n=${iters})`);
}

const dom = buildDom({ nodes: 8000, shadowEvery: 40 });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.NodeFilter = dom.window.NodeFilter;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.ResizeObserver = dom.window.ResizeObserver;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;

const l1 = locator().byTestId("target").includeHidden();
bench("resolve byTestId (pierceShadow default)", () => {
  const el = l1.resolve(document);
  if (!el) throw new Error("not found");
});

const l2 = locator().byText("Target").includeHidden();
bench("resolve byText (pierceShadow default)", () => {
  const el = l2.resolve(document);
  if (!el) throw new Error("not found");
});
