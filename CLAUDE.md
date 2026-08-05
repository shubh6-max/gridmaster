# CLAUDE.md — GridMaster (gridmaster-react)

## What this is
Excel-like React grid **library** for others to consume: `npm install gridmaster-react` → `import { GridMaster } from "gridmaster-react"` + `import "gridmaster-react/styles.css"`. Every user-facing feature is an optional prop on `GridMaster` (or composed via presets). Keep the public API additive and backward-compatible — never remove/rename props.

## Commands (the gates)
- `npm run build` — vite lib bundle + `tsc` type declarations. **Pass/fail gate for any src change.**
- `npm test` — build + `node tests/run.mjs`; must print `passed 7 test suites`.
- `npm run build:demo` and `npm --prefix test-app run build` — demo + test-app (test-app type-checks).

## Syncing newer gridmaster from the Stakeholder app
The Stakeholder app vendors gridmaster in-tree and is usually **newer** than this repo's `src/`:
`C:\Users\ShubhamVishwasPurani\OneDrive - TheMathCompany Private Limited\Desktop\stackholer_zip\Stakeholder_360_V3.0\Stakeholder_360_v3.0\frontend\src\gridmaster`

Procedure (do not cherry-pick features — the files interlock; sync the tree):
1. `cp -r "$SRC_T/." src/`, then `rm src/core/features/colorFiltering.test.ts` — vendor tests belong in `tests/` (repo harness), not `src/` (they import `node:assert`, and there is no `@types/node`).
2. Convert the `.mjs` policy files (`gridEditorFocusPolicy`, `gridPropSyncPolicy`) to `.ts` and fix their imports. The type build uses `emitDeclarationOnly` and **cannot** use `allowJs`, so `.mjs` imports fail.
3. `npm run build`; fix any strict-TS errors **at the source** — never relax `strict` or enable `allowJs`.
4. Port vendor `*.test.ts` into `tests/*.test.mjs`: repo style is `node:assert`, importing from `../dist/index.cjs` via `createRequire`, exporting a `run*Tests()` function, wired into `tests/run.mjs`. Strip TS-only syntax (e.g. `as any`).
5. Fix repo tests broken by signature changes — e.g. `getDisplayRowIndexes(rows, cols, filters, sort, colorFilters, colorSort, options)` (7 args, color filters inserted before options).
6. `npm test` (7 suites) → `npm run build:demo` + test-app build → commit.

## Conventions
- Strict TypeScript everywhere. Tests are `.mjs` suites in `tests/`, importing the built `../dist/index.cjs`, one exported `run*Tests()` per file.
- Only runtime dependency is `lucide-react` (peer deps: `react`, `react-dom`). Do not add dependencies.
- Library stays self-contained: every import in `src/` resolves inside `src/` (or those packages).
- All features are props; presets (`src/presets/`) compose them. No build-time config for consumers.
- The demo (`demo/`) is vite-only and not type-checked — pre-existing type errors there are not a gate.
- Repo uses a main-only workflow: commits land on `main`, ending with `Co-Authored-By: Claude <noreply@anthropic.com>`.
