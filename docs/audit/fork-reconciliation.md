# GridMaster fork reconciliation: repo vs Stakeholder-app vendor copy

Date: 2026-10-15. Read-only analysis. Nothing was modified except this file. Audit IDs refer to `docs/audit/2026-10-14-audit-report.md`.

- REPO = `packages/gridmaster-react/src` (70 files; working tree is byte-identical to `HEAD:src/` modulo CRLF).
- VENDOR = `Stakeholder_360_v3.0/frontend/src/gridmaster` (75 files, no history).
- Compare method: `diff --strip-trailing-cr`, then a second pass with all three trees (repo, vendor, common ancestor) normalised through the same `biome format` settings (100 cols, double quotes, es5 commas, LF) in a scratch dir. Normalisation is what separates "formatting-only" from "semantic".

## 1. Headline finding

**The CLAUDE.md premise "vendor is usually newer" is stale. The repo is the newer tree for almost everything.** The last real sync happened on 2026-08-06 (`39dba57`, finished by `d888b2a`). Against `d888b2a` (the common ancestor):

- 35 of the 42 shared files that differ show **zero** vendor-side change. After format normalisation the vendor equals `d888b2a` there, and only the repo has moved on.
- Vendor-side edits since the sync are small: 7 shared files, about 420 changed lines, nearly all in the column menu (`ColumnMenu.tsx`), plus 5 vendor-only helper files.
- The repo has moved on in: `formulas.ts` (+398 lines, 6 to 48 `case` labels), `fill.ts` (+110), `clipboard.ts` (+25), `types.ts` (+62), `useGridMaster.ts` (+103), `index.ts`, `constants.ts`, and 3 new core files.
- Running the CLAUDE.md sync procedure (`cp -r vendor/. src/`) today would **delete about 800 lines of repo-only work** and break `tests/formulas.test.mjs` and the demo. Do a 3-way merge with the repo as base instead.

Timeline (repo, from git): sync `39dba57` 2026-08-06; v0.2.0 `ce3a1d2` 2026-08-06; TS-inference fix `a63e573` 2026-08-12; dead-export removal `6eaac2b` and Excel-feature commit `b00b50f` 2026-08-21; cleanup `e2ac358` 2026-08-22; v2 scaffold plus a whole-`src` reformat `3b00f0c` 2026-08-23.
Vendor evidence (file mtimes only, so indicative): untouched since 2026-07-29 for all but 7 files. Newer: `dateFilterTree.mjs` 08-21, `SelectEditor.tsx` and `selectOptions.mjs` 08-31, `types.ts`, `GridHeader.tsx`, `colorMenuLayout.mjs` 09-01, `ColumnMenu.tsx`, `columnMenuLayout.mjs`, `grid.css` 09-02.

## 2. Quick facts

| Class | Count | Files |
|---|---|---|
| identical (byte-equal modulo CR) | 24 | shared files not listed below |
| formatting-only | 29 | see section 3.4 |
| repo-newer | 8 | `createColumn.ts` (trivial), `constants.ts`, `clipboard.ts`, `fill.ts`, `formulas.ts`, `index.ts`, `useEditing.ts` (refactor), `useGridMaster.ts` |
| vendor-newer | 4 | `SelectEditor.tsx`, `ColumnMenu.tsx`, `GridHeader.tsx`, `grid.css` |
| both-diverged | 1 | `core/types.ts` (additive on both sides, no overlap) |
| one-sided-vendor | 9 | `columnDefaults.ts`, `columnTypes.ts`, `selectOptions.mjs`, `dateFilterTree.mjs`, `colorMenuLayout.mjs`, `columnMenuLayout.mjs`, `gridEditorFocusPolicy.mjs`, `gridPropSyncPolicy.mjs`, `colorFiltering.test.ts` |
| one-sided-repo | 4 | `conditionalFormatting.ts`, `dragDrop.ts`, `validation.ts`, `gridPropSyncPolicy.ts` (twin of the vendor `.mjs`) |
| Total | 66 shared + 9 + 4 = 79 | vendor 75, repo 70 |

Changed lines (semantic, after normalisation, 13 shared files with real differences): repo-only 806 vs vendor-only 418 (repo 62 to 398 in the big formula, fill and hook files; vendor 366 of its 418 in `ColumnMenu.tsx`). One-sided files: repo 211 lines of new code (96 + 17 + 98, excluding the twin), vendor 494 lines (205 new features, 103 removed by the repo on purpose, 24 policy twins, 162 test already ported).
Raw (CR-stripped, un-normalised) counts for reference: 42 shared files differ, repo-side 1452 vs vendor-side 998 lines, the gap being mostly formatting from `3b00f0c`.

### Top-5 highest-risk conflicts

1. **Naive vendor-to-repo sync (CLAUDE.md steps 1-6)** overwrites `formulas.ts`, `fill.ts`, `clipboard.ts`, `types.ts`, `index.ts`, `useGridMaster.ts`, deleting about 40 formula functions (COUNTIF, SUMIF, VLOOKUP, IFERROR, DATE...), conditional-format/validation/drag types and event-type exports. Fix: base = repo, port only vendor delta (clusters C1-C3).
2. **`core/types.ts` typing contract.** Repo: `GridRow = Record<string, unknown>` (types.ts:7), `onRowsChange(rows: readonly T[])` (:517-518), `GridClipboardEvent.rows: readonly T[]` (:306). Vendor: `Record<string, any>` (:7), mutable `(rows: T[])` callbacks (:483-484). Taking vendor undoes the `a63e573` inference fix and adds `any`; keeping repo means a re-vendored Stakeholder app that passes `onRowsChange={setRows}` hits TS2322 (A-029) and can't re-use interface rows unless A-030 is fixed. Decision needed, see C5.
3. **Public-API removal in the repo (additive-compat violation).** `6eaac2b` dropped `columns/columnDefaults.ts` and `columnTypes.ts` from `index.ts`. Six symbols that shipped in v0.2.0 are gone from `dist`: `GRID_COLUMN_DEFAULTS`, `GRID_COLUMN_TYPES`, `GRID_COLUMN_TYPE_LABELS`, `applyColumnTypeDefaults`, `getColumnTypeDefaults`, `isGridColumnType` (verified: `git ls-tree ce3a1d2` and an export-name diff of `ce3a1d2` vs `HEAD`; README.md:368 still documents `columnDefaults.ts`). Vendor still has them and they are byte-identical to `6eaac2b^`. Restore (C1).
4. **`ColumnMenu.tsx` is a 450-line UX rewrite** (collapsed Sort/Filter/More expanders, floating side panels, date-tree filter, colour-list sizing). Repo has no semantic change to that file since the ancestor, so it can be taken wholesale, but it depends on 3 `.mjs` helpers (cannot build under `emitDeclarationOnly`), adds `any`, adds Tailwind-style classes the stylesheet does not ship (A-078), changes menu keyboard/Esc behaviour, and has zero tests. It also overlaps audit batch B7 (menus/CSS) file ownership, so merge it before B7.
5. **`.mjs` in `src/`.** 8 vendor imports go through `.mjs` (`SelectEditor.tsx:3`, `ColumnMenu.tsx:23,25,26`, `useEditing.ts:15`, `useGridMaster.ts:94`; plus the policy twins). The repo's type build cannot use `allowJs`, so every `.mjs` must become a typed `.ts` before `npm run build` passes. Mistyping them is where strict-TS breakage will surface.

## 3. File-by-file

Direction legend: take-V = take vendor, keep-R = keep repo, hand = hand-merge.

### 3.1 One-sided files

| File | Class | Evidence and content | Direction |
|---|---|---|---|
| `columns/columnDefaults.ts` (V, 78 ln) | one-sided-vendor | Per-type default width/align/flags. Existed in repo since 2026-03-31, deleted by `6eaac2b` (2026-08-21) as "dead export". Exported from vendor `index.ts:52`. Public in v0.2.0. Unused internally. | take-V (restore; identical to `6eaac2b^`) |
| `columns/columnTypes.ts` (V, 25 ln) | one-sided-vendor | `GRID_COLUMN_TYPES`, labels, `isGridColumnType`. Same history, `index.ts:53`. Uses `as const satisfies` (TS 6 ok). | take-V (restore) |
| `editors/selectOptions.mjs` (V, 10 ln) | one-sided-vendor, new | `getSelectOptionsWithCurrentValue(options, current)`: appends a current value not in the options list; tolerates non-array options. Used by `SelectEditor.tsx:3,15`. Vendor-only fix, 08-31. | take-V, convert to `.ts` |
| `filters/dateFilterTree.mjs` (V, 161 ln) | one-sided-vendor, new | Year > month > day tree of ISO date filter values, collapse and toggle helpers. Used by `ColumnMenu.tsx:23`. Props: `GridColumnDef.filterTree?: "date"`. Not exported from vendor `index.ts`. | take-V, convert to `.ts` |
| `menus/colorMenuLayout.mjs` (V, 7 ln) | one-sided-vendor, new | `getColorMenuOptionListMaxHeight(n)` = `n*38+8`. Prop `colorMenuVisibleValueCount`. | take-V, convert |
| `menus/columnMenuLayout.mjs` (V, 27 ln) | one-sided-vendor, new | `getColumnMenuSidePanelPosition` (viewport-clamped left/right placement for the side panel). | take-V, convert |
| `react/hooks/gridEditorFocusPolicy.mjs` (V, 3 ln) | one-sided-vendor, equivalent | `!initialValueProvided`. Repo had it as `.ts` at the ancestor, then inlined in `6eaac2b` (`useEditing.ts:127`). Same behaviour. | keep-R (do not restore) |
| `react/hooks/gridPropSyncPolicy.mjs` (V) vs `.ts` (R) | one-sided both | Logic identical. Repo is the CLAUDE.md step-2 conversion. | keep-R |
| `core/features/colorFiltering.test.ts` (V, 162 ln) | one-sided-vendor | Already ported: `tests/color-filtering.test.mjs` (9 `assert` calls vs 9). Must not live in `src/`. | skip (already done) |
| `core/features/conditionalFormatting.ts` (R, 96 ln) | one-sided-repo | Added `b00b50f` 2026-08-21. Exported via `index.ts`. Not wired into rendering (A-016). | keep-R |
| `core/features/dragDrop.ts` (R, 17 ln) | one-sided-repo | `moveRow`/`moveColumn`. Exported via `index.ts`. Used by `useGridMaster.ts` but no UI (A-054). | keep-R |
| `core/features/validation.ts` (R, 98 ln) | one-sided-repo | Dead, not exported (A-061). Duplicates the type names `GridValidationRule` of `types.ts` (A-036). | keep-R |

### 3.2 Shared files with semantic differences

| File | Class | What each side has that the other lacks |
|---|---|---|
| `core/features/formulas.ts` | repo-newer | Vendor = strict subset: only `SUM/AVG/AVERAGE/MIN/MAX/COUNT` + `IF` (vendor `:662`, `:679-711`; unknown functions return `#NAME?` at `:731`). Repo adds about 40 more function cases, 48 `case` labels vs 6 (COUNTA, COUNTIF, SUMIF, AVERAGEIF, ABS, ROUND, CEILING, FLOOR, POWER, SQRT, MOD, AND/OR/NOT, IFERROR, text, ISxxx, MATCH/INDEX/VLOOKUP, date) + coercion helpers. Evidence: `diff repo vendor` has no vendor-only line. Commits `b00b50f`, `e2ac358`. |
| `core/features/fill.ts` | repo-newer | Repo adds `FillSeriesType`, `detectFillSeries`, `generateFillSeries` (110 ln, `b00b50f`). Vendor 408 ln lacks them. New public exports. |
| `core/features/clipboard.ts` | repo-newer | Repo adds `transposeMatrix`, `coercePastedValues` (`GridPasteMode` type, not wired). |
| `core/constants.ts` | repo-newer | Repo adds `DEFAULT_ENABLE_ROW_DRAG/COLUMN_DRAG`. |
| `columns/createColumn.ts` | repo-newer (trivial) | `createColumnFactory<GridRow>()` (repo `:60`) vs `createColumnFactory()` (vendor `:64`). Same type. `6eaac2b` removed the singleton, `e2ac358` restored it; it was never lost from the public API. |
| `index.ts` | repo-newer | Repo adds 12 event-type exports (`a63e573`), `conditionalFormatting`/`dragDrop` `export *`, `export { GridProvider }` (`:85`). Vendor adds the `columnDefaults`/`columnTypes` exports (`:52-53`). |
| `react/hooks/useEditing.ts` | repo-newer (refactor) | Repo inlines `setEditorAutoSelectOnFocus(initialValue === undefined)` (`:127`); vendor goes via the `.mjs` policy (`:15`). Behaviour equal. |
| `react/hooks/useGridMaster.ts` | repo-newer | Repo adds: `conditionalFormats` state, `moveRow`/`moveColumn` handlers (history PUSH + `onRowReorder`/`onColumnReorder`), `enableConditionalFormatting/RowDrag/ColumnDrag`, an unused `enableValidation` (`:244`), `.ts` policy import (`:105`). Also the return type declares `colorFilters`/`colorSort` + setters (repo diff at the type block), which the vendor type omits although `GridMaster.tsx:70` reads `grid.colorFilters` (vendor type at `useGridMaster.ts:96`; a strict-TS error the repo fixed during the 08-06 sync). Vendor-only change: `.mjs` import (`:94`). |
| `core/types.ts` | both-diverged | Repo-only: `GridPasteMode`, `GridValidationRule/ColumnValidation/Validations`, `GridCondition/ConditionalFormat(s)`, `GridCellMeta.conditionalFormat`, `GridColumnDef.validations` (`:367`), `onValidationChange`, `onConditionalFormatsChange`, `enableValidation`, `enableConditionalFormatting`, `initialConditionalFormats`, `enableRowDrag`, `enableColumnDrag`, `onRowReorder`, `onColumnReorder`, `GridRow` = unknown, readonly callbacks/events. Vendor-only: `GridColumnDef.filterTree?: "date"` (`:324`), `GridMasterProps.colorMenuVisibleValueCount?: number` (`:473`), `GridRow` = any, mutable callbacks. No prop is removed or renamed on either side (the typing differences are narrowing, see risk 2). |
| `menus/ColumnMenu.tsx` | vendor-newer | Repo = ancestor (formatting only). Vendor adds: collapsible Sort/Filter/More (`:478-494`), floating side panels via `getColumnMenuSidePanelPosition` (`:429`), date-tree filter (`DateFilterTree` `:765`, `filterTreeNodesBySearch` `:83`), `colorMenuVisibleValueCount`, `role="checkbox"`/`aria-checked="mixed"`/`aria-expanded` on tree rows (`:795-806`). |
| `react/GridHeader.tsx` | vendor-newer | Two prop pass-throughs: `filterTree={columnMenuFilterColumn?.filterTree}`, `colorMenuVisibleValueCount={props.colorMenuVisibleValueCount}` (vendor `:646`). Rest identical. |
| `editors/SelectEditor.tsx` | vendor-newer | Renders `getSelectOptionsWithCurrentValue(column.options, localValue)` so a stored value outside the options list stays visible. Repo renders `(column.options ?? []).map`. |
| `styles/grid.css` | vendor-newer | Vendor adds `.gm-menu-section-compact`, `.gm-menu-sort-children`, `.gm-menu-action-summary` (unused in TSX), `.gm-menu-side-panel` (+29 ln, adds 3 hard-coded colours; `.is-partial` used by the tree has no rule). |

### 3.3 Dependencies between files (clusters that must move together)

| Cluster | Members | Why |
|---|---|---|
| X1 Column-menu | `ColumnMenu.tsx`, `dateFilterTree`, `colorMenuLayout`, `columnMenuLayout`, `types.ts` (2 props), `GridHeader.tsx` (2 lines), `grid.css` (+29) | ColumnMenu imports the three helpers; props flow `types.ts` > `GridHeader` > `ColumnMenu`; CSS classes referenced by the new markup. `FilterMenu.tsx` is identical on both sides (no work). |
| X2 Select editor | `SelectEditor.tsx`, `selectOptions` | Import. |
| X3 Public exports | `index.ts`, `columnDefaults.ts`, `columnTypes.ts` (+ `GridColumnType` in `types.ts`, present on both sides) | Exports only. |
| X4 Repo feature set (nothing to merge, do not break) | `types.ts`, `index.ts`, `constants.ts`, `useGridMaster.ts`, `conditionalFormatting.ts`, `dragDrop.ts`, `validation.ts`, `formulas.ts`, `fill.ts`, `clipboard.ts` | Interlocking additions from `b00b50f`; moving any one without the others breaks the build. |
| X5 Sync policy | `useEditing.ts`, `useGridMaster.ts`, `gridPropSyncPolicy.ts` | Already converted in repo; vendor `.mjs` twins are not needed. |

### 3.4 Formatting-only (29 files, zero semantic difference after normalisation)

Cause: whole-`src` reformat in `3b00f0c` (43 files, 779+/791-); vendor was never reformatted. Direction for all: **keep-R**, take nothing.

`core/features/{colorFiltering,editing,filtering,formatPainter,formatting,navigation,sorting,structure}.ts`, `core/state/selectionState.ts`, `core/utils.ts`, `editors/index.ts`, `menus/FilterMenu.tsx`, `presets/{compact,editable,readonly}.ts`, `react/{GridBody,GridCell,GridContextMenu,GridToolbar,GridViewport,StatusBar}.tsx`, `react/context/GridContext.tsx`, `react/hooks/{useCellFormatting,useClipboard,useFillHandle,useFormatPainter,useKeyboardNavigation,useSelection}.ts`, `renderers/SelectRenderer.tsx`.
(`useSelection.ts` differs by whitespace only. Raw diffs of 10 to 95 lines in `FilterMenu`, `GridBody` and the hooks are all formatting.)
24 further shared files are byte-identical: all other editors, renderers, `core/state/{gridState,historyReducer}.ts`, `core/transforms/*`, `freezing.ts`, `sizing.ts`, `FormulaBar.tsx`, `GridMaster.tsx`, `GridRow.tsx`, `ColorMenu.tsx`, `menus/index.ts`, `useColumnSizing.ts`, `useFloatingPortal.ts`, `theme.css`, `global.d.ts`, etc.

## 4. Audit findings vs vendor

Because vendor == ancestor for 21 of the 42 differing files and formatting-only for 29, **vendor has the same bug as the repo for every finding located in formatting-only/identical files** (A-009 to A-015, A-046 to A-053, A-056 to A-059, A-062, A-063, A-065 to A-071, A-073 to A-077, A-081 to A-085, A-088 to A-098, etc.; the code is the same modulo whitespace). Findings located in semantically differing files:

| ID | Location (differing file) | Vendor status | Evidence (vendor file:line) |
|---|---|---|---|
| A-002 | `useGridMaster.ts` | same bug | callbacks keyed on `props`: `:1070-1088`; `:508-510` `[history.present, props.onSnapshotChange]` |
| A-003 | `useGridMaster.ts`, `utils.ts` | same bug | `shallowEqualColumns` `:342,351,658` |
| A-004 | `useGridMaster.ts`, `GridViewport.tsx` | same bug | `GridViewport.tsx:83-84` hard-coded `enableClipboard: true`, `enableEditing` only by mode |
| A-005 IFERROR | `formulas.ts` | **not fixed, absent** | function unsupported: `#NAME?` at `formulas.ts:731`; only `IF` is lazy (`:662`) |
| A-006 blanks as 0 | `formulas.ts` | same bug | `coerceFormulaNumber` `:477-481` calls shared `toNumber`; aggregates `:679-711` |
| A-007, A-040, A-042, A-045 | `formulas.ts` | same bug | shared tokenizer/evaluator; 6-function switch `:679-731` |
| A-008 VLOOKUP/INDEX/MATCH, A-043 dates, A-044 text/math | `formulas.ts` | n/a, functions absent in vendor (repo-only code) | `#NAME?` |
| A-039 | `formulas.ts` | same bug | bare `catch` `:793` |
| A-041 | `formulas.ts` | same bug | `Math.min/max(...numericValues)` `:712,718` |
| A-012 | `useGridMaster.ts`, `useKeyboardNavigation.ts` | same bug | undo/redo only call `historyReducer` (`useKeyboardNavigation.ts:252,270`) |
| A-050 | `useGridMaster.ts` | same bug | `insertRow` `:678-726` passes `preservedFilteredRowIds` without the new id |
| A-074 | `useGridMaster.ts` | same bug | eager `useRef(cloneGridRows(...))` `:234-237,245` |
| A-029 | `types.ts` | **partially fixed** | callbacks mutable `(rows: T[])` `:483-484`, so `onRowsChange={setRows}` compiles. Repo is `readonly` (`:517-518`) and has the TS2322. `rows: T[]` input (vendor `:461`) still rejects readonly arrays (TS4104) on both sides |
| A-030 | `types.ts` | **avoided via `any`** | `Record<string, any>` `:7` accepts interface rows; repo's `unknown` (`:7`) triggers TS2344. Do not copy: fix via `T extends object` (audit) |
| A-034, A-036 | `types.ts`, `index.ts`, `createColumn.ts` | same bug | `createColumn` singleton `createColumn.ts:64`; `export *` surface. Vendor exports fewer symbols but no `GridProvider` |
| A-016 conditional formatting, A-054 drag UI, A-061 validation, A-038 moveRow meta, A-106 dead fill helpers | repo-only files | n/a, vendor lacks the code entirely | no `conditionalFormat`/`enableRowDrag`/`validations` anywhere in vendor |
| A-060 fill | `fill.ts` | same bug on shared core | vendor `fill.ts` (408 ln) |
| A-055, A-057, A-064 | `clipboard.ts` | same bug | shared code |
| A-072, A-079 | `ColumnMenu.tsx` | same bug, worse | un-virtualised value list kept, new un-virtualised date tree (`:765+`) |
| A-078 Tailwind classes | `ColumnMenu.tsx`, `grid.css` | same bug, worse | new un-shipped utilities, e.g. `hover:bg-slate-100`, `h-7 w-6 shrink-0` (`:793`); `.is-partial` has no rule |
| A-080 menu semantics | `ColumnMenu.tsx` | **partially improved** | tree rows `role="checkbox"` `aria-checked` (`:805-806`), `aria-expanded` (`:795`); no `role=dialog`, no focus management, plain value list unchanged |
| A-087 i18n / dead ternary | `ColumnMenu.tsx` | same bug, worse | `"Reset" : "Reset"` `:697`; new hard-coded "Sort"/"Filter"/"More" (`:478,490,494`). Repo `:624-625` |
| A-015 keyboard route to menus | `ColumnMenu.tsx`, `GridHeader.tsx` | same bug | new expanders add more mouse-only steps |
| A-086, A-092, A-108 | `grid.css` | same bug, slightly worse | +3 hex, +1 rgba in new rules (`:825-827` region) |
| A-062, A-063 | `useEditing.ts` | same bug | identical apart from import |
| A-096, A-103 | `SelectEditor.tsx` | same; A-034 select-options crash **fixed in editor** | `selectOptions.mjs:2` `Array.isArray` guard; options still strings only; no accessible name |
| A-036 mutable constants | `constants.ts` | same bug | |

**Net: the vendor already fixes no audit finding outright.** It partially fixes A-029 (mutable callbacks), sidesteps A-030 (at the cost of `any`), partially improves A-080 (date-tree checkbox semantics only), and fixes the select-options-missing-value edge of A-034/A-103. Everything else is either the same bug or code the vendor lacks.

## 5. Recommendation

**Base tree: the repo.** Merge direction is vendor to repo for three small clusters only (about 450 changed lines + 205 new helper lines), then update CLAUDE.md so the standing sync direction is repo to vendor. Do this reconciliation **before** audit batches B1 to B7 (they own `useGridMaster.ts`, `types.ts`, `menus/*`, `grid.css`; merging the menu rewrite after B7 would conflict).

Ordered clusters. After each: `npm run build`, `npm test` (must still print `passed 8 test suites`, plus any new suites below; the package `test` also runs vitest `test:dom`), `npm run typecheck`, `npm run lint`. The user commits.

| # | Cluster | Files | Direction | Tests to add (repo style: `node:assert`, `createRequire("../dist/index.cjs")`, one `run*Tests()`, wired in `tests/run.mjs`) | Risks |
|---|---|---|---|---|---|
| C0 | Guard first | none (test only) | n/a | `public-api.test.mjs`: assert `Object.keys(dist/index.cjs)` contains the v0.2.0 export list (`git show ce3a1d2:src/index.ts` names). It fails today for the 6 column symbols. | none |
| C1 | Restore public exports | `columns/columnDefaults.ts`, `columns/columnTypes.ts` (take vendor, identical to `6eaac2b^`), `index.ts` (hand: add the 2 `export *` lines, keep all repo lines) | take-V + hand | `column-defaults.test.mjs`: `GRID_COLUMN_DEFAULTS.number` is `{width:120,align:"right",...}`; `applyColumnTypeDefaults({key:"a",type:"number"}).width === 120` and an explicit `width` wins; `isGridColumnType("select") === true`, `("x") === false`; `GRID_COLUMN_TYPE_LABELS.checkbox === "Checkbox"`. | Low. Re-exports 6 names; no collision (verified with an export-name diff). Check the README mention. |
| C2 | Select editor | `editors/selectOptions.ts` (new, from `.mjs`, typed `(options: readonly string[] \| undefined, current: unknown): string[]`), `editors/SelectEditor.tsx` (take vendor, import without `.mjs`) | take-V + convert | `select-options.test.mjs` (export the helper additively or test via vitest `tests/dom`): `(["a","b"],"c")` gives `["a","b","c"]`; `(["a"],"a")` unchanged; `(undefined,"x")` gives `["x"]`; `(["a"],null)` and `""` unchanged. DOM test: render `SelectEditor` with an out-of-list value and assert an `<option>` exists. | Low. Keep the `key={option}` uniqueness (appended value never duplicates by construction). |
| C3 | Column menu | `menus/ColumnMenu.tsx` (take vendor file; repo has no semantic edits to it), `filters/dateFilterTree.ts`, `menus/colorMenuLayout.ts`, `menus/columnMenuLayout.ts` (convert), `core/types.ts` (hand: add `filterTree?: "date"` to `GridColumnDef`, `colorMenuVisibleValueCount?: number` to `GridMasterProps`), `react/GridHeader.tsx` (take the 2 vendor lines), `styles/grid.css` (take the +29 hunk, add `.gm-menu-check-row.is-partial`, drop or use `.gm-menu-action-summary`) | take-V + hand + convert | (a) `.mjs` unit tests on the helpers: `buildDateFilterTree(["2024-01-15","2024-02-01","2023-12-31","","n/a"])` gives years `[2024,2023,"other"]` with months descending and days ascending; invalid dates and blanks land under `other`/`(Blanks)`; `toggleDateFilterTreeValues` selects all then clears; `getInitialCollapsedDateFilterTreeKeys` collapses every node with children; `getColorMenuOptionListMaxHeight(0)` is 46, `(4)` is 160; `getColumnMenuSidePanelPosition` places right when it fits, flips left otherwise, clamps to the 8px viewport inset. (b) vitest DOM test (infra exists in `tests/dom`): open `ColumnMenu`, expand Filter then "Filter values", assert tree rows with `aria-checked="mixed"` for partial selection; Esc closes the side panel first, then the menu. | Medium-high. UX change (Sort/Filter hidden behind expanders, extra clicks), no existing tests, new `any` must be replaced by a typed `DateFilterNode`, Tailwind-style classes (A-078) get worse, `Z_INDEX.FLOATING_MENU + 1` side panel. Preserve the formula-driven `filterOptions` path. Make the 4 helpers non-public (not in `index.ts`) unless tests need them; if exporting for `.mjs` tests, say so as additive. |
| C4 | Policy files | none | keep-R | none | Repo already inlines the editor focus policy (`useEditing.ts:127`) and keeps `gridPropSyncPolicy.ts` (logic identical to vendor `.mjs`). Do not re-add `.mjs`. |
| C5 | `types.ts` typing decision | `core/types.ts` | keep-R + decide | tsc fixture (no new deps) compiling consumer snippets: `onRowsChange={setRows}`, interface rows, readonly `rows` | Highest conceptual risk. Recommended: keep `unknown` and readonly (no `any` regression), then make callback params mutable `T[]` (source-compatible, A-029) and move to `T extends object` (A-030) inside audit B1. Do not copy vendor `GridRow = Record<string, any>`. |
| C6 | Repo-only features | formulas, fill, clipboard, constants, validation, conditionalFormatting, dragDrop, `useGridMaster` hunks | keep-R | none required for the merge. Existing suites: formulas (1 file), none for conditional formatting/validation/drag/fill series/`transposeMatrix` (A-101). Props are dead (A-004/A-016/A-054/A-061): mark them `@deprecated not yet implemented` before any reverse sync | n/a |
| C7 | Formatting-only (29) and identical (24) | see section 3.4 | keep-R | none | none |
| C8 | Close out | `CLAUDE.md` sync section (human edit): replace the "cp -r vendor to src" procedure with a 3-way merge from the last-sync commit `d888b2a`, or reverse it (repo to vendor); delete nothing from `src/` | n/a | none | The old procedure is destructive now. |

Then, outside this repo: the Stakeholder app can re-vendor from the repo once C1-C3 land. That brings it conditional-format/validation/drag props, formulas (about 40 more functions) and fill series, and the app's own ColumnMenu work is preserved because it will have been merged first.

### Vendor code that violates repo rules (fix at source during merge)

| Rule | Violation | Where (vendor) |
|---|---|---|
| no `allowJs`, `.mjs` unusable | 5 helper `.mjs` files imported from `.ts/.tsx` | `SelectEditor.tsx:3`, `ColumnMenu.tsx:23,25,26`, `useEditing.ts:15`, `useGridMaster.ts:94` |
| strict TS, no new `any` (biome `noExplicitAny` is a warning, no new violations allowed) | `any` added | `ColumnMenu.tsx:83` (x2), `:773`; `types.ts:7` (`GridRow` any); `colorFiltering.test.ts:41` (`as any`, test file, not ported) |
| tests belong in `tests/` | node:assert test inside `src/` (no `@types/node`) | `core/features/colorFiltering.test.ts` (already ported, do not copy) |
| self-contained library, no consumer Tailwind | Tailwind utility classes not shipped in `styles.css` | `ColumnMenu.tsx:793` and the whole compact menu (A-078) |
| no new runtime deps; imports resolve inside `src/` | **none found**: only `react`, `react-dom`, `lucide-react` (and `node:assert/strict` in the test file); no `../../../` imports | whole vendor tree (checked by grep of non-relative imports) |
| strict-TS error | `UseGridMasterResult` omits `colorFilters`/`colorSort` but `GridMaster.tsx:70` reads `grid.colorFilters` | vendor `useGridMaster.ts:96`, `GridMaster.tsx:70` (repo fixed it, keep repo) |

## 6. Caveats

- Not verified by building: I did not run `npm run build`/`npm test` (read-only task; the scratch copies had no `node_modules`). The claim that `.mjs` imports fail the type build rests on CLAUDE.md step 2 and `tsconfig.build.json` (`emitDeclarationOnly`, no `allowJs`).
- Vendor chronology is inferred from file mtimes plus the fact that vendor equals the 08-06 sync result everywhere except the 7 listed files. mtimes can be altered by zip extraction or copying.
- Normalised line counts depend on `biome format` (1.9.4 from the repo's `node_modules`) with the repo's formatter options; the 29 formatting-only files are equal under it. The repo's own `biome.json` ignores `packages/gridmaster-react/src` for the format check, so formatting there is not gated.
- A published v0.2.0 tarball was not inspected; "public in v0.2.0" is taken from `git show ce3a1d2:src/index.ts` and the `v0.2.0` tag history.
