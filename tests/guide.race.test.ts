import { afterEach, describe, expect, it } from "vitest";
import { createGuide } from "../src/guide.js";
import { locator } from "../src/locator/index.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.querySelectorAll(".navijs-root").forEach((el) => el.remove());
});

describe("Guide — race against close()", () => {
  // React StrictMode in dev double-invokes effects. The first guide's start()
  // is in flight (awaiting locator) when the cleanup fires close(). If
  // setIndex resumes after close(), it mounts a renderer that nothing will
  // ever unmount — leaking exactly one stale layer.
  it("does not mount the renderer if close() ran during start()", async () => {
    document.body.innerHTML = `<button id="a">A</button>`;

    const g = createGuide({ id: "race-1", storage: "memory" });
    g.addStep({ target: locator().bySelector("#a"), body: "1" });

    const startPromise = g.start();
    g.close(); // simulate strict-mode cleanup before locator resolves
    await startPromise;

    expect(document.querySelectorAll(".navijs-root").length).toBe(0);
  });
});
