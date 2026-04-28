import { describe, expect, test } from "vitest";
import { locator } from "../src/locator/index.js";

describe("locator() — optimize()", () => {
  test("reorders strategies but keeps the same match", () => {
    document.body.innerHTML = `
      <div>
        <button data-testid="submit">Submit</button>
      </div>
    `;

    const base = locator().byText("Submit").byTestId("submit");
    const optimized = locator().byText("Submit").byTestId("submit").optimize();

    const a = base.resolve(document);
    const b = optimized.resolve(document);
    expect(a).toBeInstanceOf(HTMLElement);
    expect(b).toBeInstanceOf(HTMLElement);
    expect(a).toBe(b);
  });

  test("filters byText against existing candidate set", () => {
    document.body.innerHTML = `
      <div>
        <button role="button" data-testid="a">Alpha</button>
        <button role="button" data-testid="b">Beta</button>
      </div>
    `;

    const base = locator().byRole("button").byText("Beta");
    const optimized = locator().byRole("button").byText("Beta").optimize();

    expect(base.resolve(document)?.getAttribute("data-testid")).toBe("b");
    expect(optimized.resolve(document)?.getAttribute("data-testid")).toBe("b");
  });
});
