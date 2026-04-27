import { afterEach, describe, expect, it, vi } from "vitest";
import { createGuide } from "../src/guide.js";
import { locator } from "../src/locator/index.js";
import type { GuideState, GuideStorage } from "../src/types.js";

function dom(html: string) {
  document.body.innerHTML = html;
}

function memStorage(): GuideStorage {
  const map = new Map<string, GuideState>();
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, s) => { map.set(k, s); },
    remove: (k) => { map.delete(k); },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createGuide — validation", () => {
  it("requires an id", () => {
    expect(() => createGuide({ id: "" })).toThrow(/id/);
  });

  it("addStep rejects step without target", () => {
    const g = createGuide({ id: "t1", storage: "memory" });
    expect(() => g.addStep({ target: "", body: "x" })).toThrow(/target/);
  });

  it("addStep rejects step without body or render", () => {
    const g = createGuide({ id: "t2", storage: "memory" });
    expect(() => g.addStep({ target: "#x" } as never)).toThrow(/body.*render/);
  });

  it("addStep accepts step with only render", () => {
    const g = createGuide({ id: "t3", storage: "memory" });
    expect(() => g.addStep({
      target: "#x",
      render: () => document.createElement("div"),
    })).not.toThrow();
  });

  it("start throws when no steps were added", async () => {
    const g = createGuide({ id: "t4", storage: "memory" });
    await expect(g.start()).rejects.toThrow(/no steps/);
  });
});

describe("Guide — lifecycle", () => {
  it("emits start, stepChange, complete in order", async () => {
    dom(`<button id="a">A</button><button id="b">B</button>`);
    const order: string[] = [];
    const g = createGuide({
      id: "lc1",
      storage: "memory",
      events: {
        start: () => order.push("start"),
        stepChange: (e) => order.push(`step:${e.to}`),
        complete: () => order.push("complete"),
      },
    });
    g.addStep({ target: "#a", body: "1" });
    g.addStep({ target: "#b", body: "2" });

    await g.start();
    await g.next();
    await g.next();

    expect(order).toEqual(["start", "step:0", "step:1", "complete"]);
  });

  it("prev moves backwards but never below 0", async () => {
    dom(`<button id="a">A</button><button id="b">B</button>`);
    const seen: number[] = [];
    const g = createGuide({
      id: "lc2",
      storage: "memory",
      events: { stepChange: (e) => seen.push(e.to) },
    });
    g.addStep({ target: "#a", body: "1" });
    g.addStep({ target: "#b", body: "2" });

    await g.start();
    await g.next();
    await g.prev();
    await g.prev(); // already at 0, no-op

    expect(seen).toEqual([0, 1, 0]);
  });

  it("close emits close and stops accepting next/prev", async () => {
    dom(`<button id="a">A</button>`);
    const onClose = vi.fn();
    const g = createGuide({
      id: "lc3",
      storage: "memory",
      events: { close: onClose },
    });
    g.addStep({ target: "#a", body: "1" });

    await g.start();
    g.close();
    await g.next();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(g.isCompleted()).toBe(false);
  });

  it("getCurrentStep / isActive / getStepCount reflect runtime state", async () => {
    dom(`<button id="a">A</button>`);
    const g = createGuide({ id: "lc4", storage: "memory" });
    g.addStep({ target: "#a", body: "1", id: "first" });

    expect(g.getStepCount()).toBe(1);
    expect(g.isActive()).toBe(false);

    await g.start();
    expect(g.isActive()).toBe(true);
    expect(g.getCurrentStep()?.id).toBe("first");
  });
});

describe("Guide — canRender skips", () => {
  it("skips a step whose canRender returns false", async () => {
    dom(`<button id="a">A</button><button id="b">B</button><button id="c">C</button>`);
    const seen: number[] = [];
    const g = createGuide({
      id: "cr1",
      storage: "memory",
      events: { stepChange: (e) => seen.push(e.to) },
    });
    g.addStep({ target: "#a", body: "1" });
    g.addStep({ target: "#b", body: "2", canRender: () => false });
    g.addStep({ target: "#c", body: "3" });

    await g.start();
    await g.next(); // would go to 1, but canRender false → 2

    expect(seen).toEqual([0, 2]);
  });

  it("completes when all remaining steps are canRender:false", async () => {
    dom(`<button id="a">A</button><button id="b">B</button>`);
    const onComplete = vi.fn();
    const g = createGuide({
      id: "cr2",
      storage: "memory",
      events: { complete: onComplete },
    });
    g.addStep({ target: "#a", body: "1" });
    g.addStep({ target: "#b", body: "2", canRender: () => false });

    await g.start();
    await g.next();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(g.isCompleted()).toBe(true);
  });
});

describe("Guide — persistence", () => {
  it("writes progress to storage on each step", async () => {
    dom(`<button id="a">A</button><button id="b">B</button>`);
    const storage = memStorage();
    const g = createGuide({ id: "p1", storage });
    g.addStep({ target: "#a", body: "1" });
    g.addStep({ target: "#b", body: "2" });

    await g.start();
    expect(storage.get("p1")?.currentStep).toBe(0);
    await g.next();
    expect(storage.get("p1")?.currentStep).toBe(1);
  });

  it("resumes from saved progress on a new instance", async () => {
    dom(`<button id="a">A</button><button id="b">B</button>`);
    const storage = memStorage();
    const g1 = createGuide({ id: "p2", storage });
    g1.addStep({ target: "#a", body: "1" });
    g1.addStep({ target: "#b", body: "2" });
    await g1.start();
    await g1.next();
    g1.close();

    // new instance, same storage
    const seen: number[] = [];
    const g2 = createGuide({
      id: "p2",
      storage,
      events: { stepChange: (e) => seen.push(e.to) },
    });
    g2.addStep({ target: "#a", body: "1" });
    g2.addStep({ target: "#b", body: "2" });
    await g2.start(); // should resume at step 1

    expect(seen).toEqual([1]);
  });

  it("reset clears storage", async () => {
    dom(`<button id="a">A</button>`);
    const storage = memStorage();
    const g = createGuide({ id: "p3", storage });
    g.addStep({ target: "#a", body: "1" });
    await g.start();

    g.reset();
    expect(storage.get("p3")).toBeNull();
  });
});

describe("Guide — targetNotFound", () => {
  it("emits when locator can't resolve before timeout", async () => {
    dom(`<div></div>`);
    const onMiss = vi.fn();
    const g = createGuide({
      id: "tnf1",
      storage: "memory",
      events: { targetNotFound: onMiss },
    });
    g.addStep({
      target: locator().byTestId("never").timeout(50),
      body: "missing",
    });
    await g.start();

    expect(onMiss).toHaveBeenCalledTimes(1);
    expect(onMiss.mock.calls[0][0].step.body).toBe("missing");
  });
});
