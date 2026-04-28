# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] — 2026-04-28

### Fixed

- Guide: bail out of `setIndex` after each `await` when the guide has been closed (e.g. React StrictMode dev double-invoke of `useEffect`). Previously the renderer could mount after `close()` resolved, leaving exactly one orphan overlay/tooltip in the DOM that no further `next()` / `close()` would clean up.

## [0.2.0] — 2026-04-27

First fully-featured release. Adds Shadow DOM piercing, four built-in theme presets, full a11y polish (focus trap / live region / focus restore), `Step.render` for tooltip override, and the `useGuide` React hook.

### Added

#### Core
- `createGuide()` / `Guide` class — declarative tour controller with start / next / prev / skip / close / reset.
- Step API: `target`, `title`, `body`, `placement`, `url`, `canRender`, `beforeShow`, `afterShow`, `nextLabel` / `prevLabel` / `doneLabel` / `showProgress` / `showSkip`.
- Cross-page resume via `localStorage` (or pluggable `GuideStorage`). Navigates `pushState` / `popstate` / `hashchange` and resumes when the URL matches.
- Custom storage backends: `"localStorage"`, `"memory"`, or any `GuideStorage` implementation.
- `Guide.isActive()` / `Guide.getStepCount()` / `Guide.getCurrentStep()` for external state inspection.

#### Smart Locator
- `locator()` builder — chainable strategies evaluated as `AND` intersection.
- Strategies: `byText` (with `exact` / RegExp), `byRole` (explicit + implicit, with accessible-name filter), `byAriaLabel`, `byTestId` (data-testid / data-test / data-cy / data-qa / data-test-id), `bySelector`, `byXPath`.
- `fallback()` chain — alternate locator tried when primary returns 0 candidates.
- `timeout(ms)` — `MutationObserver`-backed wait for late-rendered targets.
- `includeHidden()` — opt back in to off-screen / hidden candidates.
- `skipShadow()` — opt out of Shadow DOM piercing per chain.
- Visibility filter (excludes `display:none` / `visibility:hidden` / 0×0 by default).
- Ranking: visible → in-viewport → shallower DOM → document order.
- **Shadow DOM piercing on by default** — text / role / aria / testid / selector traverse open shadow roots (including nested). Closed shadow roots and XPath excluded by spec.

#### Renderer
- Spotlight overlay (SVG mask) + tooltip with auto / top / bottom / left / right placement.
- Re-positions on scroll / resize via `ResizeObserver` + `MutationObserver`.
- 4 built-in theme presets: `lightTheme` (default), `darkTheme`, `glassTheme`, `minimalTheme`. Importable individually or via `themes.<name>`.
- CSS variable customization (`--navijs-accent`, `--navijs-bg`, etc.).
- `Step.render` callback — full tooltip override including chrome / buttons / progress.

#### Accessibility
- `role="dialog"` + `aria-modal="true"` on tooltip.
- `aria-labelledby` / `aria-describedby` wired to title and body elements.
- Polite `aria-live` region announcing step progress + content on each transition.
- Focus trap via Tab / Shift+Tab cycling within tooltip focusables.
- Initial focus moves to primary action (Next button).
- Focus restored to the previously focused element on close.
- `Escape` closes the tour by default (`closeOnEscape: false` to disable).

#### React adapter (`@yoshihisak/navijs/react`)
- `useGuide({ id, define, autoStart? })` hook returning reactive state (`isActive` / `currentStep` / `totalSteps` / `isCompleted`) and stable callbacks (`start` / `next` / `prev` / `skip` / `close` / `reset`).
- Guide is keyed by `id` — progress is preserved across renders.
- React >=17 supported as optional peer dependency.

#### Distribution
- ESM + CJS builds via tsup, plus full TypeScript declarations.
- IIFE / UMD CDN build (`dist/navijs.global.js`) — exposes `window.navijs`. Self-contained — styles inject at runtime, no separate CSS import needed.
- Available on unpkg and jsDelivr (`unpkg` / `jsdelivr` package fields).
- Bundle size: **25 KB minified / 8.4 KB gzipped** for the core IIFE build.
- Zero runtime dependencies.

#### Quality
- 57 unit tests covering locator strategies, AND intersection, fallback chains, visibility filter, timeout / waitFor, guide lifecycle, persistence, canRender skip, targetNotFound emission, ARIA wiring, focus management, focus trap, and Shadow DOM piercing.
- GitHub Actions CI: typecheck + tests + build on PRs and main.
- GitHub Pages workflow auto-deploys the demo from `main`.

#### Docs
- README with quickstart, CDN usage, React quickstart, comparison vs intro.js / react-joyride / @reactour/tour / shepherd.js, Smart Locator vs XPath rationale.
- `docs/SMART_LOCATOR.md` — full algorithm + strategy details + Shadow DOM behavior.
- `docs/CUSTOMIZATION.md` — 3-level theming guide (presets → body → render override).
- `docs/CONDITIONAL_STEPS.md` — wait / skip / branch / fallback patterns.
- `docs/API.md` — complete reference.
- `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md`.
- Live demo with interactive theme switcher: <https://yosh1.github.io/navijs/>.

## [0.1.0] — 2026-04-27

Initial preview publish. Core Guide controller + Smart Locator (without Shadow DOM piercing), spotlight + tooltip renderer, React adapter, IIFE / CDN build. Superseded by 0.2.0 the same day.

[Unreleased]: https://github.com/yosh1/navijs/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/yosh1/navijs/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yosh1/navijs/releases/tag/v0.1.0
