import { afterEach, describe, expect, it } from "vitest";
import { locator } from "../src/locator/index.js";

afterEach(() => {
  document.body.innerHTML = "";
});

function attachShadow(html: string): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement("div");
  host.id = "host";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = html;
  return { host, root };
}

describe("Smart Locator — shadow DOM piercing (default on)", () => {
  it("byTestId finds elements inside open shadow roots", () => {
    attachShadow(`<button data-testid="inside-shadow">Hi</button>`);
    const el = locator().byTestId("inside-shadow").resolve();
    expect(el?.textContent).toBe("Hi");
  });

  it("byText finds text nodes inside open shadow roots", () => {
    attachShadow(`<div><p>Hello from shadow</p></div>`);
    const el = locator().byText("from shadow").resolve();
    expect(el?.tagName).toBe("P");
  });

  it("byRole finds buttons inside open shadow roots", () => {
    attachShadow(`<button>Action</button>`);
    const el = locator().byRole("button", { name: "Action" }).resolve();
    expect(el?.tagName).toBe("BUTTON");
  });

  it("byAriaLabel finds aria-labelled elements inside shadow roots", () => {
    attachShadow(`<button aria-label="open-menu">⋯</button>`);
    expect(locator().byAriaLabel("open-menu").resolve()?.tagName).toBe("BUTTON");
  });

  it("recurses through nested shadow roots", () => {
    const { root } = attachShadow(`<div id="outer-host"></div>`);
    const outerHost = root.getElementById("outer-host")!;
    const inner = outerHost.attachShadow({ mode: "open" });
    inner.innerHTML = `<button data-testid="deep">Deep</button>`;
    expect(locator().byTestId("deep").resolve()?.textContent).toBe("Deep");
  });

  it("AND intersection works across shadow boundaries", () => {
    attachShadow(`
      <button data-testid="x">Save</button>
      <button data-testid="y">Save</button>
    `);
    const el = locator().byTestId("x").byText("Save").resolve();
    expect(el?.getAttribute("data-testid")).toBe("x");
  });
});

describe("Smart Locator — skipShadow() opt-out", () => {
  it("does not find elements inside shadow roots when skipShadow is set", () => {
    attachShadow(`<button data-testid="inside-shadow">Hi</button>`);
    expect(locator().byTestId("inside-shadow").skipShadow().resolve()).toBeNull();
  });

  it("still finds light-DOM elements when skipShadow is set", () => {
    document.body.innerHTML = `<button data-testid="light">Light</button>`;
    expect(locator().byTestId("light").skipShadow().resolve()?.textContent).toBe("Light");
  });
});
