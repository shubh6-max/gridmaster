# Audit follow-ups found while implementing (not in the original audit)

Findings surfaced by implementers/reviewers during Phase 1 that sit outside the task that found them.
Each has an owner task; remove a row when fixed and pinned by a test. Updated 2026-10-15.

| # | Finding | Evidence | Owner task |
|---|---|---|---|
| F-001 | Server-side render crashes: `renderToString(<GridMaster/>)` throws `DOMRect is not defined` (jsdom hides it) | `src/core/utils.ts:578` `safeDomRect()` | 1.6 (+ no-jsdom SSR test in tests/run.mjs) |
| F-002 | Per-cell / per-row `readonly` meta only styles the cell; `GridCell`, `useEditing` and the clipboard never check it, so "readonly" cells and rows are still editable and pasteable | `getRowMeta`/`getCellMeta` used only in `GridBody` | 1.5 (editing/clipboard sinks) |
| F-003 | Spurious `onColorFilterChange`: `ColumnMenu.applyAll` always calls `onApplyColorFilterValues(new Set(draft))`; `GridHeader.tsx` then does `setColorFilters(prev => ({...prev}))`, emitting with unchanged content on any Apply | `GridHeader.tsx:~628` | 1.6 / 1.7 |
| F-004 | `GridViewport` effect resets the cursor to (0,0) whenever `displayRows.length` changes, overriding `insertRow`'s active cell (A-009 family) | `GridViewport.tsx:~101` | 1.6 (A-009) |
| F-005 | `GridToolbar`'s `useCellFormatting` call omits `historyLimit`/`rowPatchMode`, unlike the `GridViewport` instance | `GridToolbar.tsx` | 1.1f |
| F-006 | `useClipboard` is instantiated twice (viewport + toolbar) | `GridViewport.tsx`, `GridToolbar.tsx` | 3.1 (hook decomposition) |
| F-007 | Declared but never invoked: `onCopy`, `onPaste`, `onValidationChange`, `onConditionalFormatsChange` | `core/types.ts` | 1.4 (conditional formats), 1.5 (copy/paste/validation events) |
| F-008 | Shift/Ctrl+click on a row header with `enableRowSelection={false}` is a no-op instead of moving the cursor | `GridBody.tsx` | 1.6 |
| F-009 | Rows-sync reset path overwrites `cellMeta` with `initialCellMeta` whenever `rows` is replaced (parent replacing `rows` loses user formatting) | `useGridMaster.ts` rows-sync effect | 1.1d (A-012 owns echo/controlled rows) |
| F-010 | `GridHeader.tsx:199,227` list `props.resolveFilterValues` / `props.resolveColorOptions` as effect deps: an inline resolver refetches every render | `GridHeader.tsx` | 1.6 |
| F-011 | Residual `any`: `shallowEqualObjects` in `utils.ts` (`Record<string, any>`), `updateCellValue` in `core/features/editing.ts` | — | 1.1e |
| F-012 | Format painter can stay armed if a host flips editable→readonly mid-gesture (Esc still cancels) | `useFormatPainter.ts` | 1.5 |
| F-013 | Any grid with a checkbox column logs React's "`checked` prop without `onChange`" warning (3x in a small grid) | checkbox renderer/editor | 1.5 |
| F-014 | Toolbar has no undo/redo buttons although the README implies undo/redo UI; `undo()`/`redo()` now exist on the hook/context (Task 1.1d) | `GridToolbar.tsx` | 1.7 / 3.2 (GridApi) |
| F-015 | `onCellChange` is not fired on undo/redo (one undo can restore many cells); hosts persisting per-cell diffs miss undos. `onRowsChange` is the source of truth | `useGridMaster.ts` `stepHistory` | document in 1.8 README; revisit in 3.2 |
| F-016 | CHANGELOG (Task 12) must list: GridRow default narrowed any→unknown; presets return GridPresetProps<T> | `src/core/types.ts` `GridRow`; `tests/types/compat-0.2.0.tsx` [C20] | 12 |
| F-017 | `setRows` and rows-prop replacement still reseed cellMeta/rowMeta positionally (by index), not by row id | `useGridMaster.ts` rows-sync | 3.4 (row model) |
| F-018 | Stale `preservedFilteredRowIds` captured in `insertColumn`/`deleteRow`/`deleteColumn` callbacks | `useGridMaster.ts` | 3 (hook decomposition) |
| F-019 | `allowedRowIds` hides an inserted row whose id is not on the list | `gridState.ts` / insertRow | 12 (document) or 3.4 |
| F-020 | Edge auto-scroll while dragging a selection does not extend the range while the pointer is held still (needs elementFromPoint hit-test in the rAF step) | `useSelection.ts` step loop | 12 / Phase 4 |
| F-021 | Touch long-press drag-select not supported (touch pans/scrolls; tap selects; mouse/pen drag works); no pointerId tracking for second finger mid-drag | `useSelection.ts`, `useColumnSizing.ts`, `useFillHandle.ts` | Phase 4 (touch gestures) |
| F-022 | CHANGELOG items to list: GridRow default any->unknown; presets return GridPresetProps<T>; GridPasteSkipReason gained "unparseable"; browser auto-fit uses canvas measure; cell/header/handle interactions moved to Pointer Events (fireEvent.mouseDown in consumer tests stops working); initial*Meta mount-only; collapsed column menu; historyLimit 0 = no history; enableValidation default; readonly undo block; `tabNavigation`; clipboard/locale/conditionalFormatNow props | 12 |
