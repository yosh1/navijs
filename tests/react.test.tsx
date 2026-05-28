import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useGuide } from "../src/react.js";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  document.querySelectorAll(".navijs-root").forEach((el) => el.remove());
});

function Demo() {
  const { start, isActive, currentStep, totalSteps, guide } = useGuide({
    id: "react-test-tour",
    storage: "memory",
    define: (g) => {
      g.addStep({ target: "#a", title: "A", body: "first" });
      g.addStep({ target: "#b", title: "B", body: "second" });
    },
  });
  return (
    <div>
      <button id="a" type="button">a</button>
      <button id="b" type="button">b</button>
      <button type="button" onClick={() => void start()}>start</button>
      <span data-testid="ready">{guide ? "ready" : "pending"}</span>
      <span data-testid="active">{String(isActive)}</span>
      <span data-testid="step">{currentStep}/{totalSteps}</span>
    </div>
  );
}

describe("useGuide React adapter", () => {
  it("mounts without breaking the Rules of Hooks (regression for conditional useSyncExternalStore)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(<Demo />);
    });
    // Flush the mount effect that creates the guide and triggers a re-render.
    await act(async () => {
      await Promise.resolve();
    });

    const errors = errSpy.mock.calls.map((c) => String(c[0])).join("\n");
    errSpy.mockRestore();

    expect(errors).not.toMatch(/Rendered (more|fewer) hooks|order of Hooks/);
    expect(utils.getByTestId("ready").textContent).toBe("ready");
    expect(utils.getByTestId("step").textContent).toBe("0/2");
    expect(utils.getByTestId("active").textContent).toBe("false");
  });

  it("reflects guide activation in reactive state when start() is called", async () => {
    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(<Demo />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(utils.getByText("start"));
    });

    await waitFor(() => {
      expect(utils.getByTestId("active").textContent).toBe("true");
    });
    expect(utils.getByTestId("step").textContent).toBe("0/2");
    expect(document.querySelector(".navijs-tooltip")).not.toBeNull();
  });
});
