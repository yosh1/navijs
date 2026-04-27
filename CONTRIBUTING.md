# Contributing

Thanks for considering a contribution to navijs.

## Local development

```bash
npm install
npm run demo       # vite dev server with the example app
npm run dev        # tsup --watch build for the library
npm test           # run vitest
npm run typecheck  # tsc --noEmit
npm run build      # production build (ESM + CJS + IIFE + d.ts)
```

## Project layout

```
src/
  guide.ts          - Guide controller (lifecycle, persistence, URL watch)
  events.ts         - typed EventEmitter
  storage.ts        - localStorage / memory backed GuideStorage
  themes.ts         - 4 named NavijsTheme presets
  errors.ts         - NavijsError wrapper
  index.ts          - public ESM entry
  react.ts          - useGuide hook for React (separate entry)
  locator/          - Smart Locator builder + strategies + visibility / ranking
  renderer/         - DOM renderer (overlay + tooltip + a11y wiring + placement)

tests/              - vitest + jsdom unit tests
examples/           - vite-served demo (also published to GitHub Pages)
docs/               - architecture / API / customization / locator references
.github/workflows/  - CI (test + build), Pages (deploy demo), Release (npm publish)
```

## Tests

We use vitest with jsdom. Layout doesn't run in jsdom, so `tests/setup.ts` shims
`getBoundingClientRect` to return non-zero dimensions for connected elements
that aren't `display:none` / `visibility:hidden`. This lets the locator's
visibility filter behave as it would in a real browser.

When adding a feature that touches the locator or renderer, add a test under
`tests/`. Patterns to follow:

- One `describe` block per feature area.
- Use `setup(html)` style helpers (see `tests/locator.test.ts`).
- Always `afterEach(() => { document.body.innerHTML = ""; })`.

## Releasing

1. Bump `package.json` version (`npm version patch|minor|major`).
2. Move the `## [Unreleased]` block in `CHANGELOG.md` to the new version
   heading and date it.
3. Commit with a `chore: release vX.Y.Z` message.
4. Tag it: `git tag vX.Y.Z` (npm version does this for you).
5. `git push --follow-tags` — the `Release` workflow takes over:
   - typecheck + test + build
   - `npm publish --provenance --access public`
   - creates a GitHub release

### One-time setup

The release workflow needs:

- An `NPM_TOKEN` repo secret — npm automation token with **publish** rights
  on `@yoshihisak/navijs`. Generate at <https://www.npmjs.com/settings/your-username/tokens>
  → "Automation" type so it bypasses 2FA in CI.
- The repo must allow GitHub Actions to create releases (Settings → Actions →
  General → Workflow permissions → "Read and write permissions").
- npm provenance requires `id-token: write` permission on the workflow,
  which is already declared in `.github/workflows/release.yml`.

## Code style

No formatter / linter is enforced yet. Match the surrounding style:

- TypeScript strict mode is on; `noUncheckedIndexedAccess` is on too.
- Prefer named exports.
- Don't write multi-paragraph comments — one short line max if needed.
- Follow the conventions in `CLAUDE.md` if present.
