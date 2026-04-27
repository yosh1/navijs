# Conditional Steps — wait, skip, branch

実プロジェクトのチュートリアルは「次へ」を機械的に押すだけでは終わらない。
非同期データのロード、ページ遷移、ユーザーロールによる分岐、要素の出現待ち、
こういった条件をどう書くかを navijs の API で整理する。

## Cheat sheet

| やりたいこと | 使う API |
| --- | --- |
| 要素が DOM にまだ無いので **出現を待ちたい** | `locator().timeout(ms)` |
| 「アップロード完了」のような **可視テキストの出現を待ちたい** | `locator().byText("...").timeout(ms)` |
| ある条件のときだけ **このステップをスキップ** | `step.canRender` |
| **別ページにあるステップ**で、ユーザーが移動するまで待ちたい | `step.url` |
| 表示直前に **副作用** を走らせたい（API 叩く / 計測） | `step.beforeShow` |
| 要素が見つからなかったときに **fallback** したい | `locator().fallback()` / `targetNotFound` イベント |

---

## 1. 出現を待つ（要素レベル）

非同期で API を叩いてからレンダリングされる要素を狙う場合、
locator に `.timeout()` を付けるだけ。内部で `MutationObserver` が走る。

```ts
tour.addStep({
  target: locator()
    .byTestId("invoice-row")
    .timeout(8000), // 8秒まで待つ
  body: "ここに作成した請求書が表示されます。",
});
```

タイムアウトに達した場合は `targetNotFound` イベントが発火する。

```ts
tour.on("targetNotFound", ({ step, locator }) => {
  console.warn("[tour] element not found:", step.id, locator.describe());
  // 例えば notify ライブラリで「ネットワークの調子が悪いようです」を出す等
});
```

---

## 2. 可視テキストの出現を待つ（ユーザーが感知できる状態を待つ）

「アップロードが完了した」のような **ユーザーが画面で確認できる状態** を
待ちたい場合、`byText` と `timeout` を組み合わせるのが一番表現的。

```ts
tour.addStep({
  target: locator()
    .byText("Upload complete")
    .byRole("status")          // ARIA live region なら更に絞り込める
    .timeout(15000),
  body: "アップロードが終わったら次へ進みましょう。",
});
```

> **設計の意図**: 「ユーザーから見えていない state」を条件にすると、
> ユーザーは何が起きているか分からないまま待たされる。
> 録音中に "REC" 表示が出るのと同じで、tutorial の進行も
> **ユーザーが画面で確認できるシグナル** で進める方が親切。
> navijs はこの哲学を locator API で自然に表現できるようにしている。

---

## 3. ステップをスキップ（条件付きレンダリング）

ステップ自体を条件付きで飛ばす場合は `canRender` を返す。
`false` を返すと **そのステップは表示されず即次に進む**。

```ts
tour.addStep({
  target: locator().byTestId("admin-panel"),
  body: "管理者向け機能はこちら。",
  canRender: () => currentUser.role === "admin",
});
```

ロールベースの分岐、A/B テストでの出し分け、機能フラグでの制御などに使う。

> 注: easy-tutorial-react などで言われる「隠れた state ではなく可視 state で
> 判定すべき」という指針は基本同意。ただし **ロール分岐や権限分岐** のように、
> 元から本人にしか見えない条件もある。可視 state で判定できるなら locator
> 側で表現し、それ以外（権限・実験フラグ）は `canRender` を使い分けるのが現実解。

---

## 4. ページ遷移を待つ

別ページに対象がある場合、`step.url` を指定すれば
**ユーザーがそのページに移動するまでツールチップが出ない**。

```ts
tour
  .addStep({
    target: locator().byText("請求書を作成"),
    body: "クリックすると作成画面に移ります。",
    url: /^\/invoices$/,
  })
  .addStep({
    target: locator().byTestId("invoice-form-title"),
    body: "ここに必要事項を入れてください。",
    url: /^\/invoices\/new/, // ← 別ページのステップ
  });
```

navijs は `pushState` / `popstate` / `hashchange` を監視しており、
SPA のクライアントサイドナビゲーションでも自動で再開する。

---

## 5. 副作用を起動 / 状態を準備する

「このステップを表示する **直前** に何かをしたい」場合は `beforeShow`。
`async` も使える。

```ts
tour.addStep({
  target: locator().byTestId("dashboard-chart"),
  body: "最新のデータを取得しました。",
  beforeShow: async ({ step }) => {
    await api.refreshDashboard();
    analytics.track("tour_step_view", { id: step.id });
  },
});
```

`afterShow` は表示後に呼ばれる（focus を別要素に飛ばしたい等）。

---

## 6. fallback で見つからない場合の代替を用意する

UI リファクタで対象が動いた、A/B 出し分けで違うコンポーネントが出ている、
そういう「主候補が無かったとき」のための代替を locator チェーンに積める。

```ts
target: locator()
  .byTestId("create-invoice-v2")
  .fallback(
    locator().byTestId("create-invoice")        // 旧テストID
  )
  .fallback(
    locator().byText("請求書を作成").byRole("button")  // 最終手段
  );
```

主チェーンが 0 件のときに次の `fallback` チェーンが評価される。
全部 0 件なら `targetNotFound` が発火する。

---

## 7. 組み合わせ例 — 実プロジェクト相当

```ts
import { createGuide, locator } from "navijs";

const tour = createGuide({ id: "onboarding-v3" });

// 1. ダッシュボード説明（管理者だけ）
tour.addStep({
  target: locator().byTestId("admin-stats"),
  title: "統計",
  body: "管理者向けのサマリです。",
  canRender: () => currentUser.role === "admin",
});

// 2. 請求書一覧へ移動するよう促す（待つ）
tour.addStep({
  target: locator().byText("請求書").byRole("link"),
  body: "請求書一覧を開きましょう。",
});

// 3. 別ページ。マウントを待つ
tour.addStep({
  target: locator().byTestId("invoice-form").timeout(10000),
  body: "ここで新規作成します。",
  url: /^\/invoices\/new$/,
});

// 4. アップロード完了を可視テキストで検知
tour.addStep({
  target: locator()
    .byRole("status")
    .byText(/upload complete/i)
    .timeout(20000),
  body: "完了したら次へ。",
  beforeShow: () => analytics.track("tour_upload_step"),
});

// 5. fallback で旧 UI もカバー
tour.addStep({
  target: locator()
    .byTestId("done-button-v2")
    .fallback(locator().byTestId("done-button")),
  body: "これでチュートリアル終了です！",
  doneLabel: "完了",
});

tour.on("targetNotFound", ({ step, locator }) => {
  console.warn("[tour] missing element on step", step.id, locator.describe());
});

tour.start();
```

---

## トラブルシューティング

**Q. `canRender` が同期しか返せないのは不便**
A. 設計上、ステップ進行の同期性を保つため。非同期を絡めるなら `beforeShow` を使う、
あるいは「待つ」用途なら locator の `.timeout()` の方を使ってほしい。

**Q. ステップ全体を後から差し替えたい**
A. 現在のところ `Guide` は addStep 後に置換 API を提供していない。
別ガイドを `id` を変えて作り、状況に応じて `start()` するパターンを推奨。
