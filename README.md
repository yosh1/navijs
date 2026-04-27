# navijs

[![npm](https://img.shields.io/npm/v/@yoshihisak/navijs.svg)](https://www.npmjs.com/package/@yoshihisak/navijs)
[![CI](https://github.com/yosh1/navijs/actions/workflows/ci.yml/badge.svg)](https://github.com/yosh1/navijs/actions/workflows/ci.yml)
[![bundle size](https://img.shields.io/badge/gzip-8.3%20KB-brightgreen)](#compared-to-other-tour-libraries)
[![types](https://img.shields.io/badge/types-included-blue)](./docs/API.md)
[![license](https://img.shields.io/badge/license-MIT-brightgreen.svg)](./LICENSE)

> Framework-agnostic, type-safe in-app tour & onboarding library — with a **Smart Locator** that doesn't break when your DOM does.

**[▶ Live demo](https://yosh1.github.io/navijs/)** · [npm](https://www.npmjs.com/package/@yoshihisak/navijs) · [docs](./docs/API.md)

```
npm install @yoshihisak/navijs
```

- ✅ Zero runtime dependencies
- ✅ ESM + CJS + TypeScript types
- ✅ Works with React / Vue / Angular / vanilla — anything that renders DOM
- ✅ Smart Locator combines text / role / aria / testid / selector / xpath as **AND constraints**
- ✅ Cross-page resume via localStorage
- ✅ Spotlight + tooltip out of the box, 4 built-in theme presets
- ✅ Shadow DOM piercing — works inside Lit / Stencil / web component apps
- ✅ a11y: focus trap, aria-live announcements, focus restore

---

## Quickstart

```ts
import { createGuide, locator } from "@yoshihisak/navijs";

const tour = createGuide({ id: "first-run" });

tour
  .addStep({
    target: locator().byTestId("search-input"),
    title: "検索",
    body: "ここからキーワード検索できます。",
    placement: "bottom",
  })
  .addStep({
    target: locator().byText("請求書を作成").byRole("button"),
    body: "ここから新規作成できます。",
    placement: "top",
    url: /\/invoices/, // 別ページに該当するステップは URL マッチを待つ
  })
  .addStep({
    target: locator().byAriaLabel("open-help"),
    body: "困ったらここから。",
  });

tour.on("complete", () => console.log("done!"));
tour.start();
```

## CDN (no build step)

```html
<script src="https://unpkg.com/@yoshihisak/navijs/dist/navijs.global.js"></script>
<script>
  const tour = navijs.createGuide({ id: "first-run" });
  tour
    .addStep({
      target: navijs.locator().byTestId("nav-home"),
      title: "ホーム",
      body: "ここからダッシュボードへ。",
    })
    .addStep({
      target: navijs.locator().byRole("button", { name: /create/i }),
      body: "新規作成はここから。",
    });
  tour.start();
</script>
```

The IIFE bundle is **25 KB minified / 8.3 KB gzipped**, fully self-contained (styles inject at runtime), and exposes `window.navijs`. Same `createGuide` / `locator` / events / Smart Locator as the npm build. Available on unpkg and jsDelivr.

## React

```tsx
import { useGuide, locator } from "@yoshihisak/navijs/react";

function App() {
  const tour = useGuide({
    id: "first-run",
    define: (g) => {
      g.addStep({
        target: locator().byTestId("nav-home"),
        title: "ホーム",
        body: "ここからダッシュボードへ。",
      });
      g.addStep({
        target: locator().byRole("button", { name: /create/i }),
        body: "新規作成はここから。",
      });
    },
  });

  return (
    <button onClick={() => tour.start()} disabled={tour.isActive}>
      Start tour ({tour.currentStep + 1} / {tour.totalSteps || "?"})
    </button>
  );
}
```

`useGuide` は `start / next / prev / close / reset` のコールバックと、
`isActive / currentStep / totalSteps / isCompleted` の reactive state を返す。
ガイドインスタンスは `id` が変わらない限り再生成されないので、進捗が保持される。

## Why Smart Locator

CSS selectors break when class names get hashed. XPath breaks when JSX inserts a `<Fragment>` somewhere. `data-testid` may be tree-shaken in production. **navijs** lets you stack multiple signals:

```ts
locator()
  .byText("請求書を作成")        // visible text
  .byRole("button")              // semantic role
  .byTestId("create-invoice")    // explicit test id
  .bySelector("[data-cy=create-invoice]")
  .byXPath("//button[contains(., '請求書')]")
  .fallback(locator().bySelector("#legacy-create"))
  .timeout(8000);                // wait for the element to appear
```

Strategies on the same chain are evaluated as **AND** — every signal must agree. If the chain returns zero matches, the `fallback` chain is tried. See [docs/SMART_LOCATOR.md](./docs/SMART_LOCATOR.md).

## Compared to other tour libraries

| | navijs | intro.js | react-joyride | @reactour/tour | shepherd.js |
| --- | --- | --- | --- | --- | --- |
| Bundle (min / **gzip**) † | **25 KB / 8.3 KB** | 62 / 17 | 80 / 27 ‡ | 29 / 10 ‡ | 41 / 14 |
| License | **MIT** | AGPLv3 (paid commercial) | MIT | MIT | MIT |
| Framework | any (React adapter built-in) | jQuery-era, ad-hoc React | React only | React only | any (jQuery-era) |
| TypeScript | first-class | `@types/intro.js` | typed | typed | typed |
| Selector strategy | **multi-signal AND + fallback + timeout** | `data-intro` attrs on DOM | string class/id | string class/id | string class/id |
| Wait for element | built-in (`MutationObserver`) | n/a | n/a | n/a | manual |
| Cross-page resume | built-in (`localStorage`) | n/a | manual | manual | manual |
| Custom render slot | `Step.render` (full chrome) | CSS only | render props | render props | template strings |
| CDN `<script>` build | yes | yes | n/a | n/a | yes |

† Measured 2026-04-27 with `esbuild --minify --format=iife --target=es2018`. React peers excluded for React-only libs.
‡ Excludes react / react-dom (peer deps). navijs row is core only; the React adapter adds ~2 KB ESM unminified.

navijs is the smallest of the bunch **and** the only one that doesn't make you decorate the DOM you're touring.

## Smart Locator vs XPath-only

Most React tour libraries ask you to either decorate every target with an `id` / `data-testid`, or to copy an absolute XPath out of DevTools. Both options break the moment the DOM moves:

| Concern | XPath only (e.g. `//div[2]/section/button[1]`) | Smart Locator |
| --- | --- | --- |
| Class names hashed by CSS Modules / Tailwind JIT | depends — XPath dodges class names | works (uses role / text / testid) |
| `<Fragment>` inserted/removed during render | **breaks** — sibling indices shift | survives — text + role still match |
| A11y refactor renames a `<div role="button">` to `<button>` | **breaks** | survives — role normalizes both |
| `data-testid` stripped in production | n/a | falls through to text + role |
| Target hasn't mounted yet (async route, lazy data) | needs custom polling | `.timeout(ms)` built-in via `MutationObserver` |
| Target legitimately moved to a new component | **breaks silently** | `.fallback()` chain catches it |
| Two matches on the page (e.g. duplicated CTA in header + body) | first match wins blindly | ranked by visibility → viewport → DOM depth |

The point isn't that XPath is bad — it's that **a single signal is fragile by definition**. Smart Locator lets you stack as many signals as you want, evaluated as `AND`, so any one of them breaking still leaves the lookup pinned by the others. One signal works too; you only add more when stability matters.

```ts
// Brittle: one signal, no fallback, no wait.
target: "xpath=/html/body/div[2]/main/section[3]/button[1]"

// Resilient: three signals + fallback + timeout.
target: locator()
  .byRole("button", { name: /create invoice/i })
  .byTestId("create-invoice")
  .fallback(locator().bySelector("#legacy-create"))
  .timeout(8000)
```

## Docs

- [REQUIREMENTS](./docs/REQUIREMENTS.md) — full requirements
- [ARCHITECTURE](./docs/ARCHITECTURE.md) — module layout & sequencing
- [SMART_LOCATOR](./docs/SMART_LOCATOR.md) — locator algorithm
- [CUSTOMIZATION](./docs/CUSTOMIZATION.md) — theming, custom body, full `render` override
- [CONDITIONAL_STEPS](./docs/CONDITIONAL_STEPS.md) — wait-for / skip / branch patterns
- [API](./docs/API.md) — full API reference

## Run the demo

```bash
npm install
npm run demo
```

## Roadmap

| Version | Plan |
| --- | --- |
| **v0.1** (current) | Core: createGuide / Smart Locator / spotlight + tooltip / localStorage resume / `navijs/react` hook / `Step.render` override / CDN UMD build / **theme presets** / **a11y polish** / **Shadow DOM piercing** |
| v0.2 | iframe traversal, near() / nthOf() locator extensions |
| v0.3 | Dedicated `@navijs/react` package (JSX-as-step API) |
| v0.4 | `@navijs/vue` |
| v1.0 | No-code editor + AI tour generator (SaaS) |

## License

MIT
