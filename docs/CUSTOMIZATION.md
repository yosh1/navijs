# Customization

navijs にはチュートリアルの見た目を変える 3 段階のカスタマイズレベルがある。
**必要な分だけ深く入る**ことを目指している API なので、上から順に検討してほしい。

| レベル | 何ができるか | API |
| --- | --- | --- |
| 1. テーマ | 色・角丸・スポットライトの余白 | `theme` / CSS 変数 |
| 2. body 差し替え | ツールチップの中身だけを任意の DOM に | `step.body` に `HTMLElement` |
| 3. 完全置き換え | ツールチップ全体（タイトル・ボタン・進捗まで）を自前で描く | `step.render` |

スポットライト（暗転 + 穴あけ）は 3 つのレベルすべてで自動で出る。位置計算とリサイズ追従もこちらで持つ。

---

## レベル 1 — テーマ

CSS 変数で上書きできる。

```css
:root {
  --navijs-accent: #5b8cff;
  --navijs-bg: #fff;
  --navijs-fg: #111;
  --navijs-overlay: rgba(0, 0, 0, 0.55);
  --navijs-radius: 8px;
}
```

または `createGuide` の `theme` で渡す。

```ts
createGuide({
  id: "first-run",
  theme: {
    accent: "#ff5b8c",
    overlay: "rgba(20, 20, 30, 0.7)",
    spotlightPadding: 8,
  },
});
```

---

## レベル 2 — `body` に DOM を渡す

ツールチップのタイトル・ボタン・進捗表示はそのまま、本文だけ自前の DOM にする。

```ts
const body = document.createElement("div");
body.innerHTML = `
  <p>This is custom HTML!</p>
  <img src="/diagram.png" alt="" style="max-width:100%" />
`;

tour.addStep({
  target: locator().byTestId("dashboard"),
  title: "ダッシュボード",
  body, // string, HTMLElement, or () => HTMLElement
});
```

`body` を関数にすると、ステップが表示される直前に呼ばれる。
動的なコンテンツ（最新の値など）はこちらが向いている。

```ts
tour.addStep({
  target: "#balance",
  body: () => {
    const el = document.createElement("p");
    el.textContent = `現在の残高: ${getBalance()} 円`;
    return el;
  },
});
```

---

## レベル 3 — `render` でツールチップごと差し替え

`step.render` を渡すと、navijs はツールチップの中身を **一切** 描画しない。
タイトル・ボタン・進捗の表示まで含めて、すべて自分でコントロールできる。

```ts
tour.addStep({
  target: locator().byTestId("create-button"),
  render: ({ step, next, prev, skip, close }) => {
    const root = document.createElement("div");
    root.style.cssText = "padding:16px;background:#222;color:#fff;border-radius:12px;min-width:280px;";

    const heading = document.createElement("h4");
    heading.textContent = `Step ${step.index + 1} / ${step.total}`;
    root.appendChild(heading);

    const text = document.createElement("p");
    text.textContent = "ここをクリックして請求書を作成。";
    root.appendChild(text);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:12px;";

    if (step.index > 0) {
      const back = document.createElement("button");
      back.textContent = "戻る";
      back.onclick = prev;
      actions.appendChild(back);
    }

    const nextBtn = document.createElement("button");
    nextBtn.textContent = step.index === step.total - 1 ? "完了" : "次へ";
    nextBtn.onclick = next;
    actions.appendChild(nextBtn);

    root.appendChild(actions);
    return root;
  },
});
```

`render` のコンテキスト:

```ts
type RenderContext = {
  step: ResolvedStep;          // step.index / step.total / step.title など
  target: HTMLElement;          // ハイライトしている要素
  next: () => void;             // 次のステップへ
  prev: () => void;             // 前のステップへ
  skip: () => void;             // 現ステップだけスキップ
  close: () => void;            // ツアーを終了（state は保存される）
};
```

- スポットライトと位置計算は navijs が引き続き面倒を見る
- `body` と `render` を両方渡した場合、`render` が優先される
- 返した要素は次のステップに進むタイミングで自動的に取り外される

### `render` を React で使う

`@yoshihisak/navijs/react` の `useGuide` から渡す `define` 内で `step.render` を書ける。
React コンポーネントを描きたい場合は、stable な container DOM に `createPortal` する。

```tsx
import { useGuide } from "@yoshihisak/navijs/react";
import { createPortal } from "react-dom";
import { useRef } from "react";

function StepCard({ next, prev, step }) {
  return (
    <div className="my-card">
      <h4>{step.title}</h4>
      <p>{step.index + 1} / {step.total}</p>
      <button onClick={prev} disabled={step.index === 0}>戻る</button>
      <button onClick={next}>次へ</button>
    </div>
  );
}

function App() {
  const portalRef = useRef<HTMLDivElement>(null);
  const portalCtxRef = useRef<RenderContext | null>(null);

  const tour = useGuide({
    id: "first-run",
    define: (g) => {
      g.addStep({
        target: "#x",
        render: (ctx) => {
          portalCtxRef.current = ctx;
          // tell React to re-render the portal contents
          forceRerender();
          return portalRef.current!;
        },
      });
    },
  });

  return (
    <>
      <div ref={portalRef}>
        {portalCtxRef.current && createPortal(<StepCard {...portalCtxRef.current} />, portalRef.current!)}
      </div>
      <button onClick={() => tour.start()}>Start</button>
    </>
  );
}
```

> 注: 現在の navijs/react は `useGuide` フックのみ提供する。本格的な
> JSX-as-step API（`<Step body={<MyComp/>} />`）は v0.3 の `@navijs/react`
> パッケージで予定。レベル 3 までで足りないユースケースがあれば issue で
> 教えてほしい。

---

## どのレベルを選ぶか

- **CIで動かす最低限の見た目だけ整えたい** → レベル 1
- **本文に画像・リンク・リッチコンテンツを置きたい** → レベル 2
- **既存のデザインシステムに完全に合わせたい / アニメーションを足したい / 独自レイアウトにしたい** → レベル 3

迷ったらレベル 1 から始めて、足りなくなったら段階的に深く入るのが良い。
すべて同じガイド内で混ぜられる（あるステップだけ `render` で凝るのも可）。
