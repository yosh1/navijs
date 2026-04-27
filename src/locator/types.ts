export interface ByTextOptions {
  exact?: boolean;
}

export interface ByRoleOptions {
  name?: string | RegExp;
}

export type Strategy =
  | { kind: "text"; value: string | RegExp; options: ByTextOptions }
  | { kind: "role"; value: string; options: ByRoleOptions }
  | { kind: "ariaLabel"; value: string | RegExp }
  | { kind: "testId"; value: string }
  | { kind: "selector"; value: string }
  | { kind: "xpath"; value: string };

export interface Locator {
  byText(text: string | RegExp, options?: ByTextOptions): Locator;
  byRole(role: string, options?: ByRoleOptions): Locator;
  byAriaLabel(label: string | RegExp): Locator;
  byTestId(id: string): Locator;
  bySelector(css: string): Locator;
  byXPath(xpath: string): Locator;
  fallback(other: Locator): Locator;
  timeout(ms: number): Locator;
  includeHidden(): Locator;
  /** Disable shadow DOM piercing for this chain. Default: piercing is on. */
  skipShadow(): Locator;

  resolve(root?: ParentNode): HTMLElement | null;
  resolveAll(root?: ParentNode): HTMLElement[];
  waitFor(root?: ParentNode): Promise<HTMLElement>;

  /** @internal */
  describe(): string;
}
