import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";
import { useGuide, type UseGuideReturn } from "../src/vue.js";

let app: App | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  app?.unmount();
  app = null;
  host?.remove();
  host = null;
  document.body.innerHTML = "";
  document.querySelectorAll(".navijs-root").forEach((el) => el.remove());
});

/**
 * Mount a component that calls `useGuide` and hand back what the composable
 * returned, so assertions can drive it the way a real component would.
 */
function mount(setup: () => UseGuideReturn): UseGuideReturn {
  let api!: UseGuideReturn;

  const Demo = defineComponent({
    setup() {
      api = setup();
      return () =>
        h("div", [
          h("button", { id: "a", type: "button" }, "a"),
          h("button", { id: "b", type: "button" }, "b"),
        ]);
    },
  });

  host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp(Demo);
  app.mount(host);

  return api;
}

function twoSteps(id: string) {
  return () =>
    useGuide({
      id,
      storage: "memory",
      define: (g) => {
        g.addStep({ target: "#a", title: "A", body: "first" });
        g.addStep({ target: "#b", title: "B", body: "second" });
      },
    });
}

describe("useGuide Vue adapter", () => {
  it("creates the guide on mount and exposes its snapshot reactively", () => {
    const { guide, isActive, isCompleted, currentStep, totalSteps } = mount(
      twoSteps("vue-test-tour"),
    );

    expect(guide.value).not.toBeNull();
    expect(isActive.value).toBe(false);
    expect(isCompleted.value).toBe(false);
    expect(currentStep.value).toBe(0);
    expect(totalSteps.value).toBe(2);
  });

  it("reflects guide activation in reactive state when start() is called", async () => {
    const { start, isActive, currentStep, totalSteps } = mount(twoSteps("vue-test-start"));

    await start();
    await nextTick();

    expect(isActive.value).toBe(true);
    expect(currentStep.value).toBe(0);
    expect(totalSteps.value).toBe(2);
    expect(document.querySelector(".navijs-tooltip")).not.toBeNull();
  });

  it("advances the mirrored step when next() is called", async () => {
    const { start, next, currentStep } = mount(twoSteps("vue-test-next"));

    await start();
    await next();
    await nextTick();

    expect(currentStep.value).toBe(1);
  });

  it("tears the guide down when the component unmounts", async () => {
    const { start, guide } = mount(twoSteps("vue-test-unmount"));

    await start();
    await nextTick();
    expect(document.querySelector(".navijs-tooltip")).not.toBeNull();

    const created = guide.value;
    expect(created).not.toBeNull();

    app?.unmount();
    app = null;
    await nextTick();

    expect(created?.isActive()).toBe(false);
    expect(document.querySelector(".navijs-tooltip")).toBeNull();
  });

  it("rebuilds the guide when a reactive id changes", async () => {
    const id = ref("vue-test-id-a");
    const { guide } = mount(() =>
      useGuide({
        id,
        storage: "memory",
        define: (g) => {
          g.addStep({ target: "#a", title: "A", body: "first" });
          g.addStep({ target: "#b", title: "B", body: "second" });
        },
      }),
    );

    const first = guide.value;
    expect(first).not.toBeNull();

    id.value = "vue-test-id-b";
    await nextTick();

    expect(guide.value).not.toBeNull();
    expect(guide.value).not.toBe(first);
    // The retired instance must be closed, not left rendering behind the new one.
    expect(first?.isActive()).toBe(false);
  });
});
