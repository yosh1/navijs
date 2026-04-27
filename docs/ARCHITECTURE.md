# navijs — アーキテクチャ

## レイヤ図

```
 ┌─────────────────────────────────────────────────────────────┐
 │                       Public API                             │
 │  createGuide() / locator() / GuideRenderer / Storage          │
 └───────────────┬───────────────────────────────────────────────┘
                 │
 ┌───────────────▼───────────────────────────────────────────────┐
 │   guide (controller)                                          │
 │   - lifecycle: start/next/prev/skip/close                      │
 │   - step queue / canRender / url gate                          │
 │   - bridges renderer ⇄ events ⇄ storage                        │
 └───┬─────────────┬───────────────┬────────────┬────────────────┘
     │             │               │            │
     ▼             ▼               ▼            ▼
   step      locator         renderer       storage
  (data)   Smart Locator   overlay/tip     ls/memory
                │              │
                ▼              ▼
              utils/dom    utils/placement
```

依存は上→下のみ。renderer は guide を知らない（インターフェース経由でのみ呼ばれる）。

## モジュール責務

### `guide`
- `Guide` クラス。`addStep`, `start`, `next`, `prev`, `skip`, `close`, `reset`。
- 状態遷移は **単一の `setIndex(i)`** に集約し、副作用（保存／レンダ／イベント）は順序固定で発火。
- ターゲット解決は **Smart Locator**。失敗したら `onTargetNotFound` → 既定動作はガイド一時停止＋次の DOM 変動／URL 変動でリトライ。

### `step`
- 純粋データ。`{ id, target, title?, body, placement?, url?, canRender?, beforeShow?, afterShow? }`。

### `locator`
- chainable builder（`byText` / `byRole` / `byAriaLabel` / `byTestId` / `bySelector` / `byXPath` / `fallback` / `timeout`）。
- 内部表現は `Strategy[]`（AND）と `LocatorBuilder | undefined`（fallback）。
- `resolve(root)` は同期。`waitFor(root)` は MutationObserver で出現待ち。
- **これがライブラリの差別化の中核**。詳細 → `SMART_LOCATOR.md`。

### `renderer`
- `mount(target, step, ctx)` と `unmount()` のみが必須インターフェース。
- 既定 renderer は overlay + spotlight + tooltip を 1 つの shadow-less DOM ツリーで描く。
- 位置計算は `utils/placement.ts`。

### `storage`
- `interface GuideStorage { get(id): State | null; set(id, state): void; remove(id): void }`
- 既定で `localStorage`／`memory` の2実装。

### `events`
- 軽量 emitter（型補完つき）。

## ステップ進行のシーケンス

```
start()
  ├ load state from storage
  ├ pick currentStep
  ├ canRender? URL match? → if no, advance
  ├ locator.waitFor(timeout)
  │   ├ found    → renderer.mount(target, step)
  │   └ notFound → events.emit("targetNotFound") + pause
  ├ events.emit("stepChange")
  └ events.emit("start") (first only)

next()
  ├ renderer.unmount()
  ├ persist state
  └ proceed to next index (recursive into the resolution flow)

close()
  ├ renderer.unmount()
  ├ events.emit("close")
  └ keep state (so user can resume)
```

## DOM への副作用

- グローバルに 1 度だけ `<style data-navijs>` を注入（CSS変数で外側からカスタマイズ可能）。
- `body` への class 付与は行わない（既存スタイルとの衝突回避）。
- 描画ノードは `document.body` 直下に `<div class="navijs-root">` を1つ生成。

## SSR 安全性

- `typeof document === "undefined"` の環境ではモジュール evaluation 時に DOM へ触らない。
- `createGuide` は同期で問題ないが、`start()` を呼び出した瞬間にだけ DOM API を使う。

## エラーポリシー

- **ターゲット未解決はエラーではない**（`onTargetNotFound` を呼んで pause）。
- **設定不正はエラー**（`addStep` 時に同期 throw）：未指定の target、空 body、未登録 placement 等。
- 例外メッセージは英語ベース。`code` プロパティで分類。

## テスト戦略

- locator: happy-dom + vitest で純粋関数テスト。
- renderer: jsdom-likeで mount/unmount のスナップショット。
- guide: 状態遷移の単体テスト + URL gate のシミュレーション。
- E2E: Playwright（v0.2 で導入）。
