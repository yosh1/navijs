import type { Strategy } from "./types.js";

const IMPLICIT_ROLE_TO_SELECTOR: Record<string, string> = {
  button: "button, input[type='button'], input[type='submit'], input[type='reset']",
  link: "a[href]",
  textbox: "input[type='text'], input[type='search'], input[type='email'], input[type='url'], input[type='tel'], input:not([type]), textarea",
  checkbox: "input[type='checkbox']",
  radio: "input[type='radio']",
  combobox: "select",
  heading: "h1, h2, h3, h4, h5, h6",
  img: "img",
  list: "ul, ol",
  listitem: "li",
  navigation: "nav",
  banner: "header",
  contentinfo: "footer",
  main: "main",
  form: "form",
  search: "[type='search']",
  dialog: "dialog",
};

const TEST_ID_ATTRS = ["data-testid", "data-test-id", "data-test", "data-cy", "data-qa"];

const INTERACTIVE_TAGS = new Set([
  "BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "LABEL", "SUMMARY", "DETAILS",
]);

/**
 * Run a single strategy against a root and return a list of HTMLElement candidates.
 * Visibility filtering happens later, in the Locator.
 *
 * `pierceShadow` controls whether queries descend into open shadow roots.
 * Closed shadow roots are unobservable from outside and skipped regardless.
 */
export function runStrategy(
  strategy: Strategy,
  root: ParentNode,
  pierceShadow = true,
): HTMLElement[] {
  switch (strategy.kind) {
    case "text":     return matchByText(root, strategy.value, strategy.options.exact ?? false, pierceShadow);
    case "role":     return matchByRole(root, strategy.value, strategy.options.name, pierceShadow);
    case "ariaLabel":return matchByAriaLabel(root, strategy.value, pierceShadow);
    case "testId":   return matchByTestId(root, strategy.value, pierceShadow);
    case "selector": return matchBySelector(root, strategy.value, pierceShadow);
    case "xpath":    return matchByXPath(root, strategy.value); // XPath cannot pierce shadow boundaries
  }
}

/**
 * querySelectorAll that descends into open shadow roots.
 * O(n) over the live element tree plus each shadow tree.
 */
function deepQueryAll<T extends Element>(root: ParentNode, selector: string): T[] {
  const out: T[] = [];
  for (const el of Array.from(root.querySelectorAll<T>(selector))) out.push(el);

  // Walk every element once and recurse into shadow roots we find.
  const all = root.querySelectorAll<Element>("*");
  for (const el of Array.from(all)) {
    if (el.shadowRoot) {
      for (const m of deepQueryAll<T>(el.shadowRoot, selector)) out.push(m);
    }
  }
  return out;
}

export function describeStrategy(s: Strategy): string {
  switch (s.kind) {
    case "text":      return `byText(${stringifyMatcher(s.value)}${s.options.exact ? ", exact" : ""})`;
    case "role":      return `byRole(${JSON.stringify(s.value)}${s.options.name ? `, name=${stringifyMatcher(s.options.name)}` : ""})`;
    case "ariaLabel": return `byAriaLabel(${stringifyMatcher(s.value)})`;
    case "testId":    return `byTestId(${JSON.stringify(s.value)})`;
    case "selector":  return `bySelector(${JSON.stringify(s.value)})`;
    case "xpath":     return `byXPath(${JSON.stringify(s.value)})`;
  }
}

function stringifyMatcher(v: string | RegExp): string {
  return v instanceof RegExp ? v.toString() : JSON.stringify(v);
}

// ---- byText ---------------------------------------------------------------

function matchByText(
  root: ParentNode,
  value: string | RegExp,
  exact: boolean,
  pierceShadow: boolean,
): HTMLElement[] {
  const matches = new Set<HTMLElement>();
  walkText(root, pierceShadow, (text, el) => {
    if (testText(text, value, exact)) matches.add(promoteToInteractive(el));
  });
  return Array.from(matches);
}

function walkText(
  root: ParentNode,
  pierceShadow: boolean,
  visit: (trimmed: string, parent: HTMLElement) => void,
): void {
  const doc = (root as Node).ownerDocument ?? (root as Document);
  const treeRoot = (root as Node).nodeType === 9 /* Document */
    ? ((root as Document).body as Node)
    : (root as Node);
  if (!treeRoot) return;

  const walker = doc.createTreeWalker(treeRoot, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode();
  while (node) {
    const trimmed = (node.nodeValue ?? "").trim();
    const el = node.parentElement;
    if (trimmed && el) visit(trimmed, el);
    node = walker.nextNode();
  }
  if (pierceShadow) {
    const els = (treeRoot as ParentNode).querySelectorAll<Element>("*");
    for (const e of Array.from(els)) {
      if (e.shadowRoot) walkText(e.shadowRoot, true, visit);
    }
  }
}

function testText(haystack: string, value: string | RegExp, exact: boolean): boolean {
  if (value instanceof RegExp) return value.test(haystack);
  return exact ? haystack === value : haystack.includes(value);
}

/**
 * If the element is a non-interactive wrapper sitting inside an interactive
 * element (button/a/label/...) prefer the interactive ancestor — that is the
 * thing a tutorial really wants to point at.
 */
function promoteToInteractive(el: HTMLElement): HTMLElement {
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body) {
    if (INTERACTIVE_TAGS.has(cur.tagName) || cur.hasAttribute("role")) return cur;
    cur = cur.parentElement;
  }
  return el;
}

// ---- byRole ---------------------------------------------------------------

function matchByRole(
  root: ParentNode,
  role: string,
  name: string | RegExp | undefined,
  pierceShadow: boolean,
): HTMLElement[] {
  const q = pierceShadow ? deepQueryAll : shallowQueryAll;
  const explicit = q<HTMLElement>(root, `[role='${escapeAttr(role)}']`);
  const implicitSelector = IMPLICIT_ROLE_TO_SELECTOR[role];
  const implicit = implicitSelector ? q<HTMLElement>(root, implicitSelector) : [];
  const all = uniq([...explicit, ...implicit]);
  if (!name) return all;
  return all.filter((el) => {
    const accName = accessibleName(el);
    return accName != null && testText(accName, name, false);
  });
}

function accessibleName(el: HTMLElement): string | null {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.trim();

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/);
    const txt = ids
      .map((id) => el.ownerDocument?.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (txt) return txt;
  }

  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
    const id = el.id;
    if (id) {
      const lbl = el.ownerDocument?.querySelector(`label[for='${escapeAttr(id)}']`);
      if (lbl?.textContent) return lbl.textContent.trim();
    }
    const wrappingLabel = el.closest("label");
    if (wrappingLabel?.textContent) return wrappingLabel.textContent.trim();
    const placeholder = (el as HTMLInputElement).placeholder;
    if (placeholder) return placeholder;
  }

  const title = el.getAttribute("title");
  if (title) return title;

  const text = el.textContent?.trim();
  return text || null;
}

// ---- byAriaLabel ----------------------------------------------------------

function matchByAriaLabel(
  root: ParentNode,
  value: string | RegExp,
  pierceShadow: boolean,
): HTMLElement[] {
  const q = pierceShadow ? deepQueryAll : shallowQueryAll;
  const all = q<HTMLElement>(root, "[aria-label], [aria-labelledby]");
  return all.filter((el) => {
    const direct = el.getAttribute("aria-label");
    if (direct && testText(direct, value, false)) return true;
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const txt = labelledBy
        .split(/\s+/)
        .map((id) => el.ownerDocument?.getElementById(id)?.textContent ?? "")
        .join(" ");
      if (testText(txt, value, false)) return true;
    }
    return false;
  });
}

// ---- byTestId -------------------------------------------------------------

function matchByTestId(root: ParentNode, id: string, pierceShadow: boolean): HTMLElement[] {
  const selectors = TEST_ID_ATTRS.map((a) => `[${a}='${escapeAttr(id)}']`).join(", ");
  const q = pierceShadow ? deepQueryAll : shallowQueryAll;
  return q<HTMLElement>(root, selectors);
}

// ---- bySelector / byXPath -------------------------------------------------

function matchBySelector(root: ParentNode, selector: string, pierceShadow: boolean): HTMLElement[] {
  try {
    const q = pierceShadow ? deepQueryAll : shallowQueryAll;
    return q<HTMLElement>(root, selector);
  } catch {
    return [];
  }
}

function shallowQueryAll<T extends Element>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

function matchByXPath(root: ParentNode, xpath: string): HTMLElement[] {
  const doc = (root as Document).ownerDocument ?? (root as Document);
  if (!doc.evaluate) return [];
  const ctx = (root as Node).nodeType === 9 ? (root as Document).documentElement : (root as Node);
  const result = doc.evaluate(xpath, ctx, null, 7 /* ORDERED_NODE_SNAPSHOT_TYPE */, null);
  const out: HTMLElement[] = [];
  for (let i = 0; i < result.snapshotLength; i++) {
    const n = result.snapshotItem(i);
    if (n && (n as HTMLElement).nodeType === 1) out.push(n as HTMLElement);
  }
  return out;
}

// ---- helpers --------------------------------------------------------------

function escapeAttr(value: string): string {
  return value.replace(/'/g, "\\'");
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
