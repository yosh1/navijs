# navijs — 要件定義書

> `navi`（道案内）+ `js` の意。
> 既存Webアプリへ後付けできる **操作ガイド／チュートリアル基盤** を、
> React等のフレームワーク非依存・軽量・型安全 に提供する TypeScript ライブラリ。

---

## 0. 概要

### 目的
- 既存の Web アプリへ **コードを最小変更で** ガイドを差し込めること。
- React／Vue／Angular／非SPA など **フロント技術を選ばない** こと。
- 将来の SaaS 化／ノーコード編集／AI 自動生成を見据えた **拡張可能な内部設計** を持つこと。

### スコープ（v1）
- npm パッケージ `navijs` として配布（ESM + CJS + d.ts）。
- ブラウザ実行のみ。SSR ビルド時は副作用ゼロでロード可能（lazy DOM access）。
- React / Vue ラッパは別パッケージで提供する前提（コア層は素のJSのまま）。

### 非スコープ（v1）
- ノーコード編集 GUI
- 操作ログのサーバー送信／分析バックエンド
- マルチテナント／権限管理

---

## 1. 想定ユースケース

### 1.1 エンドユーザー
- 初回ログイン時のオンボーディング
- 機能リリース時のスポット紹介
- 複雑な操作（請求書作成、初期設定）の段階的誘導

### 1.2 開発者
- コードでガイドを宣言（型補完あり）
- 複数ページにまたがるツアー
- 条件分岐・ABテスト・地域別ガイド

---

## 2. システム構成

```
navijs
 ├ guide       … ガイドのライフサイクル制御
 ├ step        … ステップ定義（ターゲット・本文・配置）
 ├ locator     … Smart Locator（要素特定の中核）
 ├ renderer    … ツールチップ／スポットライト／オーバーレイ描画
 ├ storage     … 進捗・完了フラグの永続化
 ├ events      … ライフサイクルイベント emitter
 └ utils       … DOM / placement ヘルパ
```

依存関係は **一方向**（renderer → utils, guide → step/locator/renderer/storage/events）。
循環依存は禁止。

---

## 3. 機能要件

### 3.1 ガイド管理 (MUST)
| API | 役割 |
| --- | --- |
| `createGuide(opts)` | ガイドインスタンス生成 |
| `guide.addStep(step)` | ステップ追加 |
| `guide.start(opts?)` | 開始（保存済み進捗から再開可能） |
| `guide.next()` / `prev()` / `close()` / `skip()` | ナビゲーション |
| `guide.isCompleted()` | 完了済みか |
| `guide.reset()` | 進捗を消す |

### 3.2 ステップ管理 (MUST)
- ステップは追加順を保ったうえで `id` でも参照可。
- `target` は `Locator` または CSS セレクタ文字列（簡易記法）。
- `body` は `string`（textContent として安全に挿入）か `HTMLElement`（信頼された DOM）。
- `placement` は `top` | `bottom` | `left` | `right` | `auto`（既定 `auto`）。
- `canRender(): boolean` で動的にステップをスキップ可。

### 3.3 Smart Locator (MUST — 差別化の中核)
> 単一の XPath/CSS だけに依存しない、複合戦略でDOM変更に強い要素特定。

```ts
locator()
  .byText("請求書を作成", { exact: false })
  .byRole("button")
  .byAriaLabel("submit")
  .byTestId("create-invoice")
  .bySelector("[data-cy=create-invoice]")
  .byXPath("//button[.='請求書を作成']")
  .fallback(locator().bySelector("#legacy-create"))
```

- 同じ chain に積まれた `by*` は **AND 条件**として交差。
- いずれの戦略も実行可能（テキスト→XPathまで段階的に絞る）。
- 0 件になったら `.fallback(...)` の chain を再評価。
- 解決結果が複数なら DOM 順 + 可視性 でランクし先頭を採用。
- `.timeout(ms)` で MutationObserver により出現待ち（既定 5000ms）。
- 詳細は [docs/SMART_LOCATOR.md](./SMART_LOCATOR.md)。

### 3.4 UI 表示 (MUST)
- ツールチップ（タイトル・本文・進捗・nav ボタン）
- スポットライト（対象要素の周りを切り抜いて強調 / SVG mask）
- オーバーレイ（背景暗転、クリック透過オプション）
- スクロール追従（対象が画面外なら `scrollIntoView`）
- リサイズ／DOM変動への追従（`ResizeObserver` + `MutationObserver`）

### 3.5 テーマ (SHOULD)
- CSS変数によるカラーカスタマイズ（`--navijs-accent`, `--navijs-bg`, `--navijs-fg` 等）。
- `prefers-color-scheme: dark` 自動対応。
- ユーザ提供の `theme: { ... }` で上書き可能。

### 3.6 ページ遷移対応 (MUST)
- `start()` 時に保存済み state があれば **同一 URL マッチで自動再開**。
- ステップに `url?: string | RegExp | (loc: Location) => boolean` を許可し、URL不一致なら次の遷移を待つ。
- popstate / pushState を listen し復帰可能。

### 3.7 状態管理 (MUST)
- 保存単位は `guideId`。
- 形式：`{ guideId, currentStep, completed, version }`。
- 既定で `localStorage`、`memory` を選択可。`sessionStorage` 拡張余地。

### 3.8 イベントフック (MUST)
- `onStart(ctx)`
- `onStepChange({ from, to, step })`
- `onComplete(ctx)`
- `onClose(ctx)` — ユーザによる閉じる／skip
- `onTargetNotFound({ step, locator })` — タイムアウト時の救済フック

### 3.9 拡張ポイント (SHOULD)
- 独自 renderer の差し替え（`renderer: GuideRenderer` を opts で渡せる）
- 独自 storage の差し替え（`Storage` interface 実装）
- カスタム locator strategy の登録（`registerStrategy(name, fn)`）

---

## 4. 非機能要件

### 4.1 パフォーマンス
- バンドル： **gzip 後 < 10KB / minified < 30KB** を目標（コア）。
- 初期化： **< 50ms**（要素数1万のDOMで実測）。
- DOM監視：
  - `MutationObserver` は **アクティブステップ中のみ** 起動。
  - `attributes`/`childList`/`subtree` を必要分だけ subscribe。

### 4.2 依存関係
- **ランタイム依存ゼロ**。
- 開発時のみ `tsup`, `typescript`, `vitest`, `happy-dom` 等を使用。

### 4.3 ブラウザ対応
- Chrome / Edge / Safari / Firefox の最新2世代。
- IE は対象外。
- ES2020 ターゲット。

### 4.4 セキュリティ
- 文字列 body は `textContent` で挿入し XSS を防止。
- `body: HTMLElement` を渡された場合のみ DOM をそのまま採用（呼び出し側責任）。
- `eval`／任意 JS 実行 API は提供しない。
- `step.url` の正規表現はユーザ提供で十分（信頼境界外からは渡さない前提）。

### 4.5 アクセシビリティ
- ツールチップは `role="dialog"` + `aria-labelledby` / `aria-describedby`。
- フォーカストラップを実装し、Esc で `close()`。
- `prefers-reduced-motion` でアニメーション抑制。

---

## 5. API 仕様（要約）

### 5.1 初期化
```ts
import { createGuide, locator } from "@yoshihisak/navijs";

const guide = createGuide({
  id: "first-time-onboarding",
  storage: "localStorage", // | "memory"
  theme: { accent: "#5b8cff" },
  events: { onComplete: () => console.log("done!") },
});
```

### 5.2 ステップ追加
```ts
guide.addStep({
  id: "step-create-invoice",
  target: locator().byText("請求書を作成").byRole("button"),
  title: "請求書を作る",
  body: "ここから新規作成できます",
  placement: "bottom",
  url: /\/invoices\/?/,
});
```

### 5.3 実行
```ts
guide.start();      // 進捗から再開
guide.next();
guide.prev();
guide.skip();       // ステップだけスキップ
guide.close();      // ガイド終了（未完了扱い）
```

詳しくは [docs/API.md](./API.md)。

---

## 6. 拡張ロードマップ

| バージョン | 内容 |
| --- | --- |
| **v0.1 (MVP)** | 本要件の MUST を満たす |
| v0.2 | テーマ／ダーク自動／a11y 強化 |
| v0.3 | React wrapper (`@navijs/react`) |
| v0.4 | Vue wrapper (`@navijs/vue`) |
| v0.5 | Script タグ版（CDN UMD） |
| v0.6 | 操作ログ収集（pluggable transport） |
| v1.0 | ノーコード編集 SaaS、AI 自動生成 |

---

## 7. 参考にしたOSS／差別化ポイント

| OSS | 学ぶ点 | navijs の差別化 |
| --- | --- | --- |
| intro.js | 老舗。シンプルAPI／オーバーレイUX | TS-first、Smart Locator、framework-agnostic |
| shepherd.js | テーマ／プラグイン豊富 | 依存ゼロ、軽量、複合 locator |
| driver.js | 軽量。スポットライトが綺麗 | URL 跨ぎ・条件分岐・拡張API |
| easy-tutorial-react | XPath 起点で実用的 | XPath 単独依存を解消する Smart Locator |

---

## 8. オープン課題（v1で扱わないが議論済み）

- Shadow DOM 横断の locator（`::part` / piercing）。v0.2 で検討。
- iframe 内部要素の対応（cross-origin は不可）。
- 複数言語の本文（i18n キー解決）。
