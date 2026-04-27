# Smart Locator

navijs が他のチュートリアルライブラリと差別化される中核機能。

## なぜ必要か

従来手法の弱点:
- **CSS Selector** はクラス名がビルドハッシュ化されると壊れる（CSS Modules / Tailwind の動的クラス）。
- **XPath** は DOM 階層変更で簡単に壊れ、JSX のフラグメント挿入にも弱い。
- **id / data-testid** は本番ビルドから tree-shake される運用がある。

→ 単一戦略では脆い。**複数のシグナルの AND 交差** で要素を絞る方が安定する。

## API（builder）

```ts
import { locator } from "@yoshihisak/navijs";

const target = locator()
  .byText("請求書を作成", { exact: false })   // 1. 可視テキスト
  .byRole("button")                           // 2. ARIA role
  .byAriaLabel("create-invoice")              // 3. aria-label / aria-labelledby
  .byTestId("create-invoice")                 // 4. data-testid
  .bySelector("[data-cy='create-invoice']")   // 5. CSS Selector
  .byXPath("//button[contains(., '請求書')]") // 6. XPath
  .fallback(                                   // 万一上記が0件なら
    locator().bySelector("#legacy-create")
  )
  .timeout(8000);                              // 出現待ち
```

戦略を積めば積むほど **特定が厳しく** なる。1つだけでも動く。

## 評価アルゴリズム

```
candidates = ALL_ELEMENTS_IN_DOC
for each strategy in chain:
    next = candidates ∩ strategy.match(root)
    if next is empty:
        if fallback: switch chain to fallback and restart
        else:        return null (or wait via MutationObserver)
    candidates = next
return rank(candidates)[0]
```

### `rank()`
1. 表示中の要素（`offsetParent !== null` かつサイズ > 0）を優先
2. ビューポート内を優先
3. DOM tree の depth が浅いほうを優先（ラッパーより本体を狙うため）
4. 同点なら DOM 順（document order）

## 各 strategy の実装方針

| 戦略 | 内部実装 |
| --- | --- |
| `byText(s, { exact })` | TreeWalker で text node を走査。`exact` ならノード単位完全一致、`false` なら `includes`。closest(`button,a,...interactive`) に昇格。`RegExp` も可。 |
| `byRole(role, { name })` | 1) `[role=...]` 2) implicit role（`button`→`button`、`link`→`a` 等） 3) `name` は accessible name 計算（aria-label / 親 label / textContent） |
| `byAriaLabel(s)` | `[aria-label='...']` と `aria-labelledby` の参照テキスト一致 |
| `byTestId(id)` | `[data-testid='id']`、`[data-test='id']`、`[data-cy='id']` の OR |
| `bySelector(s)` | `document.querySelectorAll(s)` |
| `byXPath(x)` | `document.evaluate(...)` |
| `fallback(loc)` | 上記が0件のとき切替 |
| `timeout(ms)` | `MutationObserver` で `subtree:true, childList:true, attributes:true`。一致したら resolve。 |

## 不可視要素の扱い

- `display:none` / `visibility:hidden` / 0×0 は **候補から除外**（明示的に `.includeHidden()` で許可可能）。
- ガイド対象は基本的に「ユーザに見えている要素」だから既定で除外。

## Shadow DOM

Smart Locator は **デフォルトで open shadow root を貫通** する。Web Component を多用したアプリ（Lit / Stencil / Salesforce LWC など）でも、外側からの `data-testid` や aria 属性、可視テキストで普通にターゲットできる。

```ts
// 通常の light DOM と同じ書き方でシャドウ内の要素も拾える
locator().byTestId("inside-my-component");
locator().byText("Save").byRole("button"); // ネストしたシャドウも再帰的に貫通
```

closed shadow root (`attachShadow({ mode: "closed" })`) は仕様上外から不可視なので除外される。

パフォーマンスを優先したい / shadow を意図的に無視したい場合は `.skipShadow()`:

```ts
locator().bySelector(".btn-primary").skipShadow();
```

XPath だけは shadow を貫通できない（`document.evaluate` の仕様上の制約）。テキスト・role・testid・selector の方がシャドウと相性が良い。

## エラーメッセージ

ターゲット未解決時のメッセージは debug に役立つよう詳細化:

```
[navijs] target not found after 5000ms
  step: "step-create-invoice"
  strategies tried (in order):
    - byText("請求書を作成") → 0 candidates
    - byRole("button") → 142 candidates
    - byTestId("create-invoice") → 0 candidates
  fallback chain: bySelector("#legacy-create") → 0 candidates
```

## 将来拡張

- `near(otherLocator, { within: 200 })` … 近接要素絞り込み（座標ベース）。
- `nthOf(n)` … 複数候補時の明示的インデックス。
- `inFrame(selector)` … same-origin iframe 内部解決。
- `byVisualHash(...)` … 画像ベースのフォールバック（SaaS編集画面で記録）。
