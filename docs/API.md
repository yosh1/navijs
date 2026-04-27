# navijs — API リファレンス

## `createGuide(options)`

ガイドインスタンスを生成する。

```ts
type CreateGuideOptions = {
  id: string;                          // 進捗の保存キー
  storage?: "localStorage" | "memory" | GuideStorage;
  theme?: Partial<NavijsTheme>;
  events?: Partial<GuideEvents>;
  rootElement?: HTMLElement;           // 描画ルート（既定 document.body）
  zIndex?: number;                     // 既定 9999
  closeOnEscape?: boolean;             // 既定 true
  closeOnOverlayClick?: boolean;       // 既定 false
};
```

返り値: [`Guide`](#guide-instance)

---

## Guide instance

### `addStep(step): this`
```ts
type Step = {
  id?: string;
  target: Locator | string;            // string は CSS Selector の簡易記法
  title?: string;
  body: string | HTMLElement | (() => string | HTMLElement);
  placement?: "top" | "bottom" | "left" | "right" | "auto"; // 既定 auto
  url?: string | RegExp | ((loc: Location) => boolean);
  canRender?: () => boolean;
  beforeShow?: (ctx: StepContext) => void | Promise<void>;
  afterShow?: (ctx: StepContext) => void;
  showProgress?: boolean;              // 既定 true
  showSkip?: boolean;                  // 既定 true
  nextLabel?: string;
  prevLabel?: string;
  doneLabel?: string;
};
```

### `start(opts?: { from?: number | string }): Promise<void>`
保存済み進捗があれば再開、なければ最初から。`from` で明示開始位置を指定可。

### `next(): Promise<void>` / `prev(): Promise<void>`
### `skip(): Promise<void>`
現ステップだけスキップ。完了扱いにはしない。

### `close(): void`
ガイドを閉じる。状態は保存される（再開可能）。

### `reset(): void`
保存状態を消す。

### `isCompleted(): boolean`
### `getCurrentStep(): Step | null`

### `on(event, handler) / off(event, handler)`
```ts
type GuideEvents = {
  start: (ctx: GuideContext) => void;
  stepChange: (ctx: { from: number; to: number; step: Step }) => void;
  complete: (ctx: GuideContext) => void;
  close: (ctx: GuideContext) => void;
  targetNotFound: (ctx: { step: Step; locator: Locator }) => void;
};
```

---

## `locator()`

[Smart Locator 仕様](./SMART_LOCATOR.md)。

```ts
type Locator = {
  byText(text: string | RegExp, options?: { exact?: boolean }): Locator;
  byRole(role: string, options?: { name?: string | RegExp }): Locator;
  byAriaLabel(label: string | RegExp): Locator;
  byTestId(id: string): Locator;
  bySelector(css: string): Locator;
  byXPath(xpath: string): Locator;
  fallback(other: Locator): Locator;
  timeout(ms: number): Locator;
  includeHidden(): Locator;

  resolve(root?: ParentNode): HTMLElement | null;
  resolveAll(root?: ParentNode): HTMLElement[];
  waitFor(root?: ParentNode): Promise<HTMLElement>;
};
```

---

## Theme

```ts
type NavijsTheme = {
  accent: string;       // 既定 "#5b8cff"
  bg: string;           // tooltip 背景
  fg: string;           // tooltip 文字色
  overlay: string;      // 暗転色 (rgba)
  radius: string;       // 角丸 ("8px")
  spotlightPadding: number; // px
};
```

CSS変数は `--navijs-accent` のように対応。

---

## Storage interface

```ts
interface GuideStorage {
  get(key: string): GuideState | null;
  set(key: string, state: GuideState): void;
  remove(key: string): void;
}

type GuideState = {
  guideId: string;
  currentStep: number;
  completed: boolean;
  version: number;
};
```

---

## Errors

- `NavijsError` … 共通基底クラス。`code: string` を持つ。
  - `code: "INVALID_STEP"` — addStep 引数不正
  - `code: "NO_STEPS"` — start 時にステップが0
  - `code: "TARGET_NOT_FOUND"` — タイムアウト超過（onTargetNotFound 経由でのみ通知）

---

## 簡易例

```ts
import { createGuide, locator } from "navijs";

const tour = createGuide({ id: "first-tour" });

tour
  .addStep({
    target: locator().byTestId("nav-home"),
    title: "ホーム",
    body: "まずここをクリックしてダッシュボードへ。",
  })
  .addStep({
    target: locator().byText("請求書を作成").byRole("button"),
    body: "請求書はここから作れます。",
    placement: "bottom",
    url: /\/invoices/,
  });

tour.on("complete", () => analytics.track("onboarding_done"));
tour.start();
```
