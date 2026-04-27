# navijs

> Framework-agnostic, type-safe in-app tour & onboarding library — with a **Smart Locator** that doesn't break when your DOM does.

```
npm install navijs
```

- ✅ Zero runtime dependencies
- ✅ ESM + CJS + TypeScript types
- ✅ Works with React / Vue / Angular / vanilla — anything that renders DOM
- ✅ Smart Locator combines text / role / aria / testid / selector / xpath as **AND constraints**
- ✅ Cross-page resume via localStorage
- ✅ Spotlight + tooltip out of the box, themeable via CSS variables

---

## Quickstart

```ts
import { createGuide, locator } from "navijs";

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

## Docs

- [REQUIREMENTS](./docs/REQUIREMENTS.md) — full requirements
- [ARCHITECTURE](./docs/ARCHITECTURE.md) — module layout & sequencing
- [SMART_LOCATOR](./docs/SMART_LOCATOR.md) — locator algorithm
- [API](./docs/API.md) — full API reference

## Run the demo

```bash
npm install
npm run demo
```

## Roadmap

| Version | Plan |
| --- | --- |
| **v0.1** (current) | Core: createGuide / Smart Locator / spotlight + tooltip / localStorage resume |
| v0.2 | Theme presets, a11y polish, Shadow DOM piercing |
| v0.3 | `@navijs/react` |
| v0.4 | `@navijs/vue` |
| v0.5 | CDN UMD build |
| v1.0 | No-code editor + AI tour generator (SaaS) |

## License

MIT
