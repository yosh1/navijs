import { afterEach, describe, expect, it, vi } from "vitest";
import { createGuide } from "../src/guide.js";

afterEach(() => {
  document.body.innerHTML = "";
  // Strip any leftover renderer roots between tests.
  document.querySelectorAll(".navijs-root").forEach((el) => el.remove());
});

function setup(html: string) {
  document.body.innerHTML = html;
}

describe("renderer — ARIA wiring", () => {
  it("tooltip has role=dialog and aria-modal", async () => {
    setup(`<button id="t">Target</button>`);
    const g = createGuide({ id: "a11y-1", storage: "memory" });
    g.addStep({ target: "#t", title: "Hello", body: "World" });
    await g.start();

    const tip = document.querySelector(".navijs-tooltip")!;
    expect(tip.getAttribute("role")).toBe("dialog");
    expect(tip.getAttribute("aria-modal")).toBe("true");
  });

  it("links aria-labelledby to the title element", async () => {
    setup(`<button id="t">x</button>`);
    const g = createGuide({ id: "a11y-2", storage: "memory" });
    g.addStep({ target: "#t", title: "ステップタイトル", body: "本文" });
    await g.start();

    const tip = document.querySelector(".navijs-tooltip")!;
    const labelledBy = tip.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const title = document.getElementById(labelledBy!);
    expect(title?.textContent).toBe("ステップタイトル");
  });

  it("links aria-describedby to the body element", async () => {
    setup(`<button id="t">x</button>`);
    const g = createGuide({ id: "a11y-3", storage: "memory" });
    g.addStep({ target: "#t", title: "T", body: "本文 description" });
    await g.start();

    const tip = document.querySelector(".navijs-tooltip")!;
    const describedBy = tip.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const body = document.getElementById(describedBy!);
    expect(body?.textContent).toBe("本文 description");
  });

  it("renders a polite live region with progress + content on stepChange", async () => {
    setup(`<button id="a">A</button><button id="b">B</button>`);
    const g = createGuide({ id: "a11y-4", storage: "memory" });
    g.addStep({ target: "#a", title: "First", body: "First step body" });
    g.addStep({ target: "#b", title: "Second", body: "Second step body" });

    await g.start();
    // requestAnimationFrame → wait one tick for live region update
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const live = document.querySelector(".navijs-live");
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.getAttribute("aria-atomic")).toBe("true");
    expect(live?.textContent).toContain("1 / 2");
    expect(live?.textContent).toContain("First");

    await g.next();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const live2 = document.querySelector(".navijs-live");
    expect(live2?.textContent).toContain("2 / 2");
    expect(live2?.textContent).toContain("Second");
  });
});

describe("renderer — focus management", () => {
  it("focuses the primary action on mount", async () => {
    setup(`<button id="t">x</button>`);
    const g = createGuide({ id: "f1", storage: "memory" });
    g.addStep({ target: "#t", title: "T", body: "B" });
    await g.start();

    // queueMicrotask in mount; flush
    await Promise.resolve();
    const primary = document.querySelector(".navijs-btn-primary");
    expect(document.activeElement).toBe(primary);
  });

  it("restores focus to the previously focused element on close", async () => {
    setup(`<button id="trigger">Open</button><button id="t">target</button>`);
    const trigger = document.getElementById("trigger") as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const g = createGuide({ id: "f2", storage: "memory" });
    g.addStep({ target: "#t", title: "T", body: "B" });
    await g.start();
    g.close();

    expect(document.activeElement).toBe(trigger);
  });

  it("Escape closes the tour when closeOnEscape (default) is on", async () => {
    setup(`<button id="t">x</button>`);
    const onClose = vi.fn();
    const g = createGuide({
      id: "f3",
      storage: "memory",
      events: { close: onClose },
    });
    g.addStep({ target: "#t", body: "B" });
    await g.start();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("renderer — focus trap", () => {
  it("Tab from the last focusable wraps to the first", async () => {
    setup(`<button id="t">x</button>`);
    const g = createGuide({ id: "ft1", storage: "memory" });
    g.addStep({ target: "#t", title: "T", body: "B" });
    await g.start();
    await Promise.resolve();

    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".navijs-tooltip a[href], .navijs-tooltip button, .navijs-tooltip input, .navijs-tooltip [tabindex]:not([tabindex='-1'])",
      ),
    );
    expect(focusables.length).toBeGreaterThan(0);

    const last = focusables[focusables.length - 1]!;
    const first = focusables[0]!;
    last.focus();

    const ev = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    window.dispatchEvent(ev);

    // Focus trap moves to the first item; this is observable via activeElement
    // since our handler runs preventDefault + first.focus().
    expect(document.activeElement).toBe(first);
  });

  it("Shift+Tab from the first focusable wraps to the last", async () => {
    setup(`<button id="t">x</button>`);
    const g = createGuide({ id: "ft2", storage: "memory" });
    g.addStep({ target: "#t", title: "T", body: "B" });
    await g.start();
    await Promise.resolve();

    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".navijs-tooltip a[href], .navijs-tooltip button, .navijs-tooltip input, .navijs-tooltip [tabindex]:not([tabindex='-1'])",
      ),
    );
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    first.focus();

    const ev = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true });
    window.dispatchEvent(ev);

    expect(document.activeElement).toBe(last);
  });
});
