# GridMaster

GridMaster is a React spreadsheet-style grid with selection, editing, sorting, filtering, frozen columns, column sizing, formula-bar editing, and extensible renderers/editors.

## Install

```bash
npm install gridmaster
```

## Minimal Usage

```tsx
import { GridMaster, createColumn } from "gridmaster";
import "gridmaster/styles.css";

type Row = {
  id: number;
  name: string;
  age: number;
  active: boolean;
};

const columns = [
  createColumn.text<Row>("name", { title: "Name" }),
  createColumn.number<Row>("age", { title: "Age" }),
  createColumn.checkbox<Row>("active", { title: "Active" }),
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

That is the intended happy path:

```tsx
<GridMaster rows={rows} columns={columns} getRowId={(row) => String(row.id)} onRowsChange={setRows} />
```

## Built-In Column Types

- `text`
- `number`
- `select`
- `checkbox`
- `link`
- `date`
- `custom`

## Useful Props

- `height` and `width` control the grid container size.
- `getRowId` provides a stable row identity and is recommended for sorted, filtered, or virtualized grids.
- `frozenColumns` freezes leading visible columns.
- `enableSorting`, `enableFiltering`, `enableColumnResize`, `enableColumnAutoFit`, and `enableColumnVisibility` control header power features.
- `showFormulaBar` and `showStatusBar` toggle spreadsheet chrome.
- `mode="readonly"` disables editing without changing the rest of the surface.

## Keyboard Shortcuts

- `Ctrl + Shift + Left/Right` selects the full active row. On macOS, use `Cmd + Shift + Left/Right`.
- `Ctrl + Shift + Up/Down` selects the full active column. On macOS, use `Cmd + Shift + Up/Down`.
- Repeating the shortcut on the other axis expands the current selection, so `Ctrl/Cmd + Shift + Right` followed by `Ctrl/Cmd + Shift + Down` grows the selection downward instead of replacing it.
- Holding `Alt` on Windows/Linux or `Option` on macOS as an extra modifier also works for these row and column selection shortcuts.

## Presets

```tsx
import {
  GridMaster,
  createColumn,
  createCompactGridPreset,
  createEditableGridPreset,
} from "gridmaster";

const compactEditableProps = {
  ...createEditableGridPreset(),
  ...createCompactGridPreset(),
};

<GridMaster {...compactEditableProps} rows={rows} columns={columns} onRowsChange={setRows} />;
```

Available presets:

- `createEditableGridPreset`
- `createReadonlyGridPreset`
- `createCompactGridPreset`

## Styling

Import the packaged stylesheet once:

```tsx
import "gridmaster/styles.css";
```

## Development

```bash
npm install
npm run dev
```

The demo app is served from `index.html` and `demo/`.

## Build

```bash
npm run build
```

Library output:

- `dist/index.js`
- `dist/index.cjs`
- `dist/index.d.ts`
- `dist/styles.css`

## Examples

- [basic-grid](./examples/basic-grid/App.tsx)
- [editable-grid](./examples/editable-grid/App.tsx)
