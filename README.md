# GridMaster

<p align="center">
  <a href="https://www.npmjs.com/package/gridmaster-react"><img src="https://img.shields.io/npm/v/gridmaster-react?label=gridmaster-react" alt="npm version"></a>
  <a href="https://github.com/shubh6-max/gridmaster/blob/main/LICENSE"><img src="https://img.shields.io/github/license/shubh6-max/gridmaster" alt="MIT License"></a>
  <a href="https://github.com/shubh6-max/gridmaster/actions"><img src="https://img.shields.io/github/actions/workflow/status/shubh6-max/gridmaster/ci.yml?label=build" alt="Build status"></a>
  <a href="https://bundlephobia.com/package/gridmaster-react"><img src="https://img.shields.io/bundlephobia/minzip/gridmaster-react?label=gzip%20size" alt="Bundle size"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue" alt="TypeScript Ready"></a>
  <a href="https://github.com/shubh6-max/gridmaster/stargazers"><img src="https://img.shields.io/github/stars/shubh6-max/gridmaster?style=social" alt="GitHub stars"></a>
</p>

GridMaster is a **React spreadsheet-style grid** library with selection, editing, sorting, filtering, frozen columns, column sizing, formula-bar editing, clipboard operations, fill handle, format painter, undo/redo, and extensible renderers/editors — all tree-shakeable and zero-runtime-dependencies beyond React.

- **Live demo:** [shubh6-max.github.io/gridmaster/test-app-pages](https://shubh6-max.github.io/gridmaster/test-app-pages/)
- **npm:** `npm install gridmaster-react`
- **Peer deps:** `react >= 18`, `react-dom >= 18`

---

## Quick Start

```bash
npm install gridmaster-react
```

```tsx
import { GridMaster, createColumnFactory } from "gridmaster-react";
import "gridmaster-react/styles.css";

type Row = { id: number; name: string; age: number; active: boolean };

const createColumn = createColumnFactory<Row>();

const columns = [
  createColumn.text("name", { title: "Name" }),
  createColumn.number("age", { title: "Age" }),
  createColumn.checkbox("active", { title: "Active" }),
];

export function App() {
  const [rows, setRows] = useState<Row[]>([
    { id: 1, name: "Asha", age: 29, active: true },
    { id: 2, name: "Rahul", age: 33, active: false },
  ]);

  return (
    <GridMaster
      rows={rows}
      columns={columns}
      getRowId={(row) => String(row.id)}
      onRowsChange={setRows}
    />
  );
}
```

**No explicit generic required** — `T` infers from the `rows` prop.

---

## Features

| Category | Capabilities |
|----------|--------------|
| **Editing** | Inline cell editing, formula bar (`=SUM(A1:A10)`), validators, parsers, formatters |
| **Selection** | Cell, range, row, column, full-grid; keyboard + mouse |
| **Sorting** | Multi-column, ascending/descending, type-aware |
| **Filtering** | Value-set (checkbox menu) + condition filters (includes, equals, gt/lt, empty, etc.) |
| **Columns** | Freeze, resize, auto-fit, hide/show, reorder, insert/delete |
| **Clipboard** | Copy/paste (TSV/CSV), cut, cross-app compatible |
| **Fill Handle** | Drag to copy/fill down/across (values, formulas, formats) |
| **Format Painter** | Single-click or locked mode to replicate cell styling |
| **Undo/Redo** | Full history with configurable limit |
| **Virtualization** | Row virtualization with overscan (column virtualization planned) |
| **Formulas** | A1 refs, ranges, `+ - * /`, comparisons, `IF`, `SUM`, `AVG/AVERAGE`, `MIN`, `MAX`, `COUNT`, circular-ref detection, memoized eval |
| **Color Filtering** | Filter/sort by cell background color |
| **Row Identity** | Stable `getRowId` for sorting/filtering/virtualization |
| **Presets** | `createEditableGridPreset()`, `createReadonlyGridPreset()`, `createCompactGridPreset()` |
| **Theming** | CSS variables, bundled `styles.css` (theme + grid) |

---

## Column Types

| Type | Factory | Use Case |
|------|---------|----------|
| `text` | `createColumn.text(key, opts?)` | Free-form text |
| `number` | `createColumn.number(key, opts?)` | Numeric input with step/precision |
| `select` | `createColumn.select(key, { options, filterOptions? })` | Dropdown from allowed values |
| `checkbox` | `createColumn.checkbox(key, opts?)` | Boolean toggle |
| `link` | `createColumn.link(key, opts?)` | Clickable URLs |
| `date` | `createColumn.date(key, opts?)` | Native date picker |
| `custom` | `createColumn.custom(key, { renderCell, renderEditor? })` | Full control |

Each factory accepts `GridCreateColumnOptions` — width, alignment, editable/readonly, sortable, filterable, frozen, wrap, placeholder, custom renderers, validators, formatters, parsers.

---

## Key Props

```ts
interface GridMasterProps<T> {
  // Data
  rows: T[];
  columns: GridColumnDef<T>[];
  getRowId?: (row: T, index: number) => string;

  // Callbacks (all typed, no `any`)
  onRowsChange?: (rows: readonly T[]) => void;
  onColumnsChange?: (columns: readonly GridColumnDef<T>[]) => void;
  onCellChange?: (event: GridCellChangeEvent<T>) => void;
  onSelectionChange?: (event: GridSelectionChangeEvent) => void;
  onSortChange?: (event: GridSortChangeEvent) => void;
  onFilterChange?: (event: GridFilterChangeEvent) => void;
  onColumnResize?: (event: GridColumnResizeEvent<T>) => void;
  onRowInsert?: (event: GridRowInsertEvent<T>) => void;
  onRowDelete?: (event: GridRowDeleteEvent<T>) => void;
  onCopy?: (event: GridClipboardEvent<T>) => void;
  onPaste?: (event: GridClipboardEvent<T>) => void;

  // Layout
  height?: number | string;
  width?: number | string;
  rowHeight?: number;
  headerHeight?: number;
  frozenColumns?: number;

  // Features (all default true unless noted)
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableColumnResize?: boolean;
  enableColumnAutoFit?: boolean;
  enableColumnVisibility?: boolean;
  enableEditing?: boolean;
  enableClipboard?: boolean;
  enableFillHandle?: boolean;
  enableUndoRedo?: boolean;
  enableSelection?: boolean;
  enableRangeSelection?: boolean;
  enableRowSelection?: boolean;
  enableColumnSelection?: boolean;
  enableCellColoring?: boolean;
  enableWrapText?: boolean;
  enableInsertRow?: boolean;
  enableInsertColumn?: boolean;
  enableDeleteRow?: boolean;
  enableDeleteColumn?: boolean;

  // Chrome
  showToolbar?: boolean;
  showFormulaBar?: boolean;
  showStatusBar?: boolean;
  mode?: "editable" | "readonly";

  // Virtualization
  virtualizeRows?: boolean;
  overscanRowCount?: number;

  // History
  historyLimit?: number;

  // Advanced
  rowPatchMode?: boolean;          // mutate rows in-place for perf
  initialFilters?: GridFilters;
  initialColorFilters?: GridColorFilters;
  resolveFilterValues?: (key, filters) => Promise<string[]> | string[];
  getRowMeta?: (row, index) => GridRowMeta;
  getCellMeta?: (row, index, colKey) => GridCellMeta;
}
```

**All event types are exported** from the main entry:
```ts
import type {
  GridCellChangeEvent,
  GridSelectionChangeEvent,
  GridSortChangeEvent,
  GridFilterChangeEvent,
  GridColumnResizeEvent,
  GridRowInsertEvent,
  GridRowDeleteEvent,
  GridClipboardEvent,
  // ...and more
} from "gridmaster-react";
```

---

## Presets

```tsx
import {
  GridMaster,
  createColumnFactory,
  createEditableGridPreset,
  createReadonlyGridPreset,
  createCompactGridPreset,
} from "gridmaster-react";

const createColumn = createColumnFactory<Row>();

// Compose presets — later spreads win
<GridMaster
  {...createEditableGridPreset()}
  {...createCompactGridPreset()}
  rows={rows}
  columns={columns}
  onRowsChange={setRows}
/>
```

| Preset | Description |
|--------|-------------|
| `createEditableGridPreset()` | Full editing, sorting, filtering, clipboard, fill, undo/redo, formula bar, status bar |
| `createReadonlyGridPreset()` | Selection, sorting, filtering, clipboard copy only |
| `createCompactGridPreset()` | Reduced row height, hidden toolbar/formula bar/status bar |

---

## Styling

Import once at your app root:

```tsx
import "gridmaster-react/styles.css";
```

Customize via CSS variables (all scoped to `.gm-root`):

```css
:root {
  --gm-bg: #fff;
  --gm-header-bg: #f5f5f5;
  --gm-border: #e0e0e0;
  --gm-selection-bg: rgba(25, 118, 210, 0.12);
  --gm-selection-border: #1976d2;
  --gm-frozen-border: #e0e0e0;
  --gm-row-hover: #fafafa;
  --gm-focus-ring: #1976d2;
  --gm-row-height: 36px;
  --gm-header-height: 38px;
}
```

---

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Select full row | `Ctrl + Shift + ←/→` | `Cmd + Shift + ←/→` |
| Select full column | `Ctrl + Shift + ↑/↓` | `Cmd + Shift + ↑/↓` |
| Expand selection (repeat on other axis) | Same | Same |
| Alt/Option modifier also works | `Alt + Shift + …` | `Option + Shift + …` |
| Edit cell | `Enter` / `F2` | `Enter` / `F2` |
| Cancel edit | `Escape` | `Escape` |
| Commit edit | `Enter` / `Tab` | `Enter` / `Tab` |
| Copy | `Ctrl + C` | `Cmd + C` |
| Paste | `Ctrl + V` | `Cmd + V` |
| Cut | `Ctrl + X` | `Cmd + X` |
| Undo | `Ctrl + Z` | `Cmd + Z` |
| Redo | `Ctrl + Y` / `Ctrl + Shift + Z` | `Cmd + Shift + Z` |

---

## Formula Engine

Hand-written tokenizer + recursive-descent parser + memoized evaluator.

**Supported:** literals, A1 refs (`A1`, `$A$1`), ranges (`A1:B10`), `+ - * /`, comparisons (`= <> > >= < <=`), `IF(cond, a, b)`, `SUM`, `AVG`/`AVERAGE`, `MIN`, `MAX`, `COUNT`, circular-reference detection.

**Example:**
```tsx
<GridMaster
  rows={rows}
  columns={columns}
  showFormulaBar={true}
  onRowsChange={setRows}
/>
```

Type `=SUM(B2:B10)` in the formula bar or directly in a cell.

---

## TypeScript

- **Strict by default** — no `any` in public API
- **Generic inference** — `T` inferred from `rows` prop; explicit `<GridMaster<Row>>` still works
- **Full event typing** — all callbacks receive properly typed events
- **Column factories** — `createColumnFactory<Row>()` gives typed column builders

```tsx
// Infers T = Row from rows prop
<GridMaster rows={rows} columns={columns} onRowsChange={setRows} />

// Explicit generic also works
<GridMaster<Row> rows={rows} columns={columns} onRowsChange={setRows} />
```

---

## Performance

- Row virtualization with configurable overscan (`virtualizeRows`, `overscanRowCount`)
- Column width memoization
- Formula evaluation memoization
- `rowPatchMode` for in-place row mutation (opt-in)
- Tree-shakeable ESM + CJS builds (~51 KB gzipped JS, ~3.3 KB gzipped CSS)

---

## Development

```bash
# Install deps
npm install

# Dev server (demo)
npm run dev

# Build library (ESM + CJS + .d.ts)
npm run build

# Run tests (11 suites)
npm run test

# Build demo
npm run build:demo

# Build test app
npm run build:test-app
```

---

## Project Structure

```
src/
├── core/
│   ├── types.ts           # All public types
│   ├── constants.ts       # Defaults
│   ├── utils.ts           # Shared utilities
│   ├── state/             # Grid state, history, selection
│   ├── features/          # Editing, sorting, filtering, formulas, clipboard, fill, etc.
│   └── transforms/        # Row/column transformations
├── columns/
│   ├── createColumn.ts    # Column factory
│   ├── columnTypes.ts     # Built-in column type configs
│   └── columnDefaults.ts  # Default options per type
├── react/
│   ├── GridMaster.tsx     # Main component
│   ├── GridViewport.tsx   # Virtualized viewport
│   ├── GridHeader.tsx     # Column headers
│   ├── GridBody.tsx       # Row rendering
│   ├── GridCell.tsx       # Cell rendering
│   ├── FormulaBar.tsx
│   ├── StatusBar.tsx
│   ├── GridToolbar.tsx
│   ├── hooks/             # useGridMaster, useEditing, useSelection, etc.
│   └── context/           # React context for internal components
├── editors/               # Built-in cell editors
├── renderers/             # Built-in cell renderers
├── menus/                 # Column menu, filter menu, context menu
├── presets/               # Preset factories
└── index.ts               # Public barrel export
```

---

## Browser Support

Modern browsers (last 2 versions):
- Chrome / Edge
- Firefox
- Safari

---

## License

MIT — see [LICENSE](LICENSE).

---

## Contributing

Issues and PRs welcome. Please:
1. Open an issue first for significant changes
2. Run `npm run build && npm run test` before pushing
3. Follow existing code style (strict TS, no new dependencies)

---

## Related

- **Test app source:** [`test-app/`](test-app/)
- **Examples:** [`examples/`](examples/)
- **Changelog:** See GitHub Releases