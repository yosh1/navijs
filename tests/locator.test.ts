import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { locator } from "../src/locator/index.js";

function setup(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("locator() — byText", () => {
  it("finds an element by partial text match (default)", () => {
    setup(`<div><p>Welcome to navijs!</p></div>`);
    const el = locator().byText("navijs").resolve();
    expect(el?.tagName).toBe("P");
  });

  it("respects exact:true", () => {
    setup(`<div><p>Hello world</p><p>Hello</p></div>`);
    const el = locator().byText("Hello", { exact: true }).resolve();
    expect(el?.textContent).toBe("Hello");
  });

  it("matches via RegExp", () => {
    setup(`<button>Create invoice</button>`);
    const el = locator().byText(/create/i).resolve();
    expect(el?.tagName).toBe("BUTTON");
  });

  it("promotes a non-interactive wrapper to its interactive ancestor", () => {
    setup(`<button data-cta><span>Click me</span></button>`);
    const el = locator().byText("Click me").resolve();
    expect(el?.tagName).toBe("BUTTON");
    expect(el?.hasAttribute("data-cta")).toBe(true);
  });
});

describe("locator() — byRole", () => {
  it("finds explicit role", () => {
    setup(`<div role="button">Pseudo button</div>`);
    const el = locator().byRole("button").resolve();
    expect(el?.getAttribute("role")).toBe("button");
  });

  it("finds implicit role (button tag)", () => {
    setup(`<button>Real button</button>`);
    const el = locator().byRole("button").resolve();
    expect(el?.tagName).toBe("BUTTON");
  });

  it("finds implicit role (input[type=submit])", () => {
    setup(`<form><input type="submit" value="Go" /></form>`);
    const el = locator().byRole("button").resolve();
    expect(el?.tagName).toBe("INPUT");
  });

  it("filters by accessible name", () => {
    setup(`
      <button>Save</button>
      <button>Cancel</button>
      <button aria-label="Delete row">×</button>
    `);
    expect(locator().byRole("button", { name: "Save" }).resolve()?.textContent).toBe("Save");
    expect(locator().byRole("button", { name: /delete/i }).resolve()?.getAttribute("aria-label")).toBe("Delete row");
  });

  it("returns nothing when role doesn't exist", () => {
    setup(`<p>No buttons here</p>`);
    expect(locator().byRole("button").resolve()).toBeNull();
  });
});

describe("locator() — byAriaLabel", () => {
  it("matches direct aria-label", () => {
    setup(`<button aria-label="open-help">?</button>`);
    expect(locator().byAriaLabel("open-help").resolve()?.tagName).toBe("BUTTON");
  });

  it("matches aria-labelledby reference", () => {
    setup(`
      <span id="lbl">Profile menu</span>
      <button aria-labelledby="lbl">⋯</button>
    `);
    expect(locator().byAriaLabel("Profile").resolve()?.tagName).toBe("BUTTON");
  });
});

describe("locator() — byTestId", () => {
  it("matches data-testid", () => {
    setup(`<div data-testid="x">A</div>`);
    expect(locator().byTestId("x").resolve()?.textContent).toBe("A");
  });

  it("matches data-test, data-cy, data-qa as fallbacks", () => {
    setup(`
      <div data-test="t1">T1</div>
      <div data-cy="t2">T2</div>
      <div data-qa="t3">T3</div>
    `);
    expect(locator().byTestId("t1").resolve()?.textContent).toBe("T1");
    expect(locator().byTestId("t2").resolve()?.textContent).toBe("T2");
    expect(locator().byTestId("t3").resolve()?.textContent).toBe("T3");
  });
});

describe("locator() — bySelector / byXPath", () => {
  it("bySelector reads CSS selectors", () => {
    setup(`<div><span class="x">hit</span></div>`);
    expect(locator().bySelector(".x").resolve()?.textContent).toBe("hit");
  });

  it("invalid selector silently returns nothing", () => {
    setup(`<div>x</div>`);
    expect(locator().bySelector("!!! invalid !!!").resolve()).toBeNull();
  });

  it("byXPath returns matching elements", () => {
    setup(`<div><p>x</p><p>y</p></div>`);
    expect(locator().byXPath("//p[1]").resolve()?.textContent).toBe("x");
  });
});

describe("locator chain — AND intersection", () => {
  it("returns only elements that satisfy every strategy", () => {
    setup(`
      <button data-testid="a">Save</button>
      <button data-testid="b">Save</button>
      <a data-testid="a">Save</a>
    `);
    const el = locator().byRole("button").byTestId("a").byText("Save").resolve();
    expect(el?.tagName).toBe("BUTTON");
    expect(el?.getAttribute("data-testid")).toBe("a");
  });

  it("returns null when AND can't be satisfied", () => {
    setup(`<button>Save</button><button data-testid="x">Other</button>`);
    expect(locator().byRole("button").byTestId("x").byText("Save").resolve()).toBeNull();
  });
});

describe("locator chain — fallback", () => {
  it("uses the fallback chain when primary returns nothing", () => {
    setup(`<button id="legacy">Legacy</button>`);
    const el = locator()
      .byTestId("missing")
      .fallback(locator().bySelector("#legacy"))
      .resolve();
    expect(el?.id).toBe("legacy");
  });

  it("does not invoke fallback when primary has matches", () => {
    setup(`
      <button data-testid="primary">A</button>
      <button id="legacy">B</button>
    `);
    const el = locator()
      .byTestId("primary")
      .fallback(locator().bySelector("#legacy"))
      .resolve();
    expect(el?.textContent).toBe("A");
  });
});

describe("locator — visibility filter", () => {
  it("excludes display:none elements by default", () => {
    setup(`
      <button data-testid="hidden" style="display:none">Hidden</button>
      <button data-testid="hidden">Visible</button>
    `);
    const el = locator().byTestId("hidden").resolve();
    expect(el?.textContent).toBe("Visible");
  });

  it("includeHidden() opts back in", () => {
    setup(`
      <button data-testid="hidden" style="display:none">First</button>
      <button data-testid="hidden">Second</button>
    `);
    const all = locator().byTestId("hidden").includeHidden().resolveAll();
    expect(all).toHaveLength(2);
  });
});

describe("locator — waitFor / timeout", () => {
  it("resolves immediately when target already present", async () => {
    setup(`<button data-testid="now">Hi</button>`);
    const el = await locator().byTestId("now").timeout(500).waitFor();
    expect(el.textContent).toBe("Hi");
  });

  it("resolves after the element appears", async () => {
    setup(`<div id="root"></div>`);
    setTimeout(() => {
      const btn = document.createElement("button");
      btn.setAttribute("data-testid", "late");
      btn.textContent = "Late";
      document.getElementById("root")!.appendChild(btn);
    }, 30);
    const el = await locator().byTestId("late").timeout(2000).waitFor();
    expect(el.textContent).toBe("Late");
  });

  it("rejects after timeout", async () => {
    setup(`<div></div>`);
    await expect(locator().byTestId("never").timeout(50).waitFor()).rejects.toThrow(/target not found/);
  });
});
