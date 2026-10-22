import type React from "react";

/* =========================================================
   Base row type
   ========================================================= */

/**
 * Default row shape, used when no row type can be inferred. It is NOT the constraint on `T`: every
 * generic in the library is `T extends object`, so interface row types (which have no implicit
 * index signature and would fail a `Record<string, unknown>` constraint) are accepted as-is.
 *
 * Since 0.2.1 a field read off the default row is `unknown` (it was `any` in 0.2.0). This is a
 * deliberate, source-level breaking change for consumers who used the default `GridRow` and accessed
 * a field without a cast (e.g. `e.row.price.toFixed(2)`). Migrate by passing a row type
 * (`<GridMaster<MyRow> ... />`, or let it be inferred from `rows`) or by narrowing the field.
 */
export type GridRow = Record<string, unknown>;

/**
 * The single deliberate `any` in the public types: a cell value as it is handed TO
 * consumer-implemented callbacks (renderer/editor context `value`, the `value` parameter of
 * `formatValue`/`validate`/`parseValue`/`setValue`, change-event `value`/`previousValue`).
 * Consumers written against 0.2.0 use those values loosely (`value.toFixed(2)`, `{value}` as a
 * JSX child) and `unknown` would turn that code into compile errors, which the additive,
 * source-compatible contract forbids. Everything flowing the other way (`updateValue`, getter
 * and parser return values, utility helpers) is `unknown`. Flip this alias in the next major.
 */
// biome-ignore lint/suspicious/noExplicitAny: documented source-compatibility escape hatch (see above).
export type GridCallbackValue = any;

/* =========================================================
   Primitive / value types
   ========================================================= */

export type GridPrimitive = string | number | boolean | null | undefined | Date;

export type GridCellValue =
  | GridPrimitive
  | Readonly<Record<string, unknown>>
  | readonly unknown[];

export type GridColumnType = "text" | "number" | "select" | "checkbox" | "link" | "date" | "custom";

export type GridMode = "editable" | "readonly";

export type GridSortDirection = "asc" | "desc";
export type GridRowInsertPosition = "above" | "below";
export type GridColumnInsertPosition = "left" | "right";
export type GridHorizontalAlign = "left" | "center" | "right";
export type GridVerticalAlign = "top" | "middle" | "bottom";
export type GridTextOrientation = "horizontal" | "rotateUp" | "rotateDown" | "vertical";

/* =========================================================
   Selection types
   ========================================================= */

export type GridCellCoord = {
  row: number;
  col: number;
};

export type GridSelectionRange = {
  start: GridCellCoord;
  end: GridCellCoord;
};

export type GridSelectionMode = "cell" | "range" | "row" | "column" | "all";

export type GridSelectionState = {
  mode: GridSelectionMode;
  anchor: GridCellCoord | null;
  cursor: GridCellCoord | null;
  range: GridSelectionRange | null;
  selectedRows: Set<number>;
  selectedCols: Set<number>;
};

export type GridEditCell = {
  row: number;
  col: number;
} | null;

/* =========================================================
   Sorting / filtering
   ========================================================= */

export type GridSort = {
  columnKey: string;
  direction: GridSortDirection;
} | null;

export type GridColorFilter = {
  values: Set<string>;
};

export type GridColorFilters = Record<string, GridColorFilter>;

export type GridColorSort = {
  columnKey: string;
  value: string;
} | null;

export type GridColorOption = {
  value: string;
  label: string;
  count: number;
  swatch?: string | null;
};

export type GridFilterOperator =
  | "includes"
  | "equals"
  | "startsWith"
  | "endsWith"
  | "isEmpty"
  | "isNotEmpty"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in";

export type GridColumnFilter =
  | {
      type: "valueSet";
      values: Set<string>;
    }
  | {
      type: "condition";
      operator: GridFilterOperator;
      value?: unknown;
    };

export type GridFilters = Record<string, GridColumnFilter>;

/* =========================================================
   Clipboard / fill
   ========================================================= */

export type GridClipboardOrigin = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

export type GridClipboardData = {
  data: string[][];
  isCut: boolean;
  /** Top-left of the copied block in DISPLAY space (what the UI selected). */
  origin: GridClipboardOrigin;
  /**
   * Top-left of the copied block in the formula address space (A-065): `row` is the SOURCE row index
   * and `col` is the ABSOLUTE column index (over all columns, hidden included). Relative formula
   * references are shifted by `destination − sourceOrigin` in this space so a paste under an active
   * sort / filter / hidden column shifts correctly. Absent on external or core-built clipboards.
   */
  sourceOrigin?: { row: number; col: number };
} | null;

export type GridPasteMode = "default" | "valuesOnly" | "formulasOnly" | "transpose" | "formatOnly";

export type GridFillState = {
  anchor: GridCellCoord;
  current: GridCellCoord;
} | null;

export type GridFormatPainterMode = "idle" | "single" | "locked";

export type GridFormatPainterClipboard = {
  rows: number;
  cols: number;
  meta: Record<string, GridCellMeta>;
} | null;

/* =========================================================
   Cell meta / row meta
   ========================================================= */

export type GridCellMeta = {
  backgroundColor?: string;
  wrap?: boolean;
  wrapText?: boolean;
  horizontalAlign?: GridHorizontalAlign;
  verticalAlign?: GridVerticalAlign;
  textOrientation?: GridTextOrientation;
  indentLevel?: number;
  readonly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  error?: string | null;
  conditionalFormat?: GridConditionalFormat | null;
};

export type GridRowMeta = {
  id?: string;
  isDraft?: boolean;
  readonly?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/* =========================================================
   Validation types
   ========================================================= */

export type GridValidationRule =
  | { type: "required"; message?: string }
  | { type: "min"; value: number; message?: string }
  | { type: "max"; value: number; message?: string }
  | { type: "minLength"; value: number; message?: string }
  | { type: "maxLength"; value: number; message?: string }
  | { type: "pattern"; value: string; message?: string }
  | {
      type: "custom";
      message?: string;
      validator: (value: unknown, row: GridRow) => string | null;
    };

export type GridColumnValidation = {
  rules: GridValidationRule[];
};

export type GridValidations = Record<string, GridColumnValidation>;

/* =========================================================
   Conditional formatting types
   ========================================================= */

export type GridCondition =
  | { type: "cellValue"; operator: ">" | "<" | "=" | ">=" | "<=" | "<>"; value: unknown }
  | { type: "between"; low: unknown; high: unknown }
  | { type: "textContains"; value: string }
  | { type: "timePeriod"; value: "today" | "yesterday" | "thisWeek" | "thisMonth" };

export type GridConditionalFormat = {
  condition: GridCondition;
  backgroundColor?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type GridConditionalFormats = Record<string, GridConditionalFormat[]>;

/* =========================================================
   Renderer / editor props
   ========================================================= */

export type GridCellContext<T extends object = GridRow> = {
  row: T;
  rowIndex: number;
  column: GridColumnDef<T>;
  columnIndex: number;
  value: GridCallbackValue;
  formattedValue: string;
  meta?: GridCellMeta;
  isSelected: boolean;
  isActive: boolean;
  isEditing: boolean;
  mode: GridMode;
};

export type GridCellRendererProps<T extends object = GridRow> = GridCellContext<T> & {
  updateValue: (nextValue: unknown) => void;
  startEditing?: () => void;
};

export type GridCellEditorProps<T extends object = GridRow> = GridCellContext<T> & {
  updateValue: (nextValue: unknown) => void;
  /**
   * Commit the edit. Pass `nextValue` to commit a specific value synchronously (e.g. a checkbox
   * toggle) instead of the possibly-stale draft held in state (A-063). Calling it with no argument
   * commits the current draft. Never pass a DOM event: wire blur as `onBlur={() => commit()}`.
   */
  commit: (nextValue?: unknown) => void;
  cancel: () => void;
  requestViewportFocusAfterEdit?: () => void;
  autoSelectOnFocus?: boolean;
  /**
   * The current draft cannot be parsed into the column's type (e.g. non-numeric text in a number
   * column). An editor should surface an error state (`aria-invalid`) and cancel rather than commit
   * on blur, so bad input does not silently destroy the stored value (A-059 / item 7).
   */
  isInvalid?: boolean;
};

/* =========================================================
   Events / callbacks
   ========================================================= */

export type GridCellChangeEvent<T extends object = GridRow> = {
  rowIndex: number;
  columnIndex: number;
  columnKey: string;
  row: T;
  previousValue: GridCallbackValue;
  value: GridCallbackValue;
};

export type GridSelectionChangeEvent = {
  selection: GridSelectionState;
};

export type GridSortChangeEvent = {
  sort: GridSort;
};

export type GridFilterChangeEvent = {
  filters: GridFilters;
};

export type GridColorFilterChangeEvent = {
  colorFilters: GridColorFilters;
};

export type GridColorSortChangeEvent = {
  colorSort: GridColorSort;
};

export type GridColumnResizeEvent<T extends object = GridRow> = {
  column: GridColumnDef<T>;
  width: number;
};

export type GridRowInsertEvent<T extends object = GridRow> = {
  rowIndex: number;
  row: T;
};

export type GridColumnInsertEvent<T extends object = GridRow> = {
  columnIndex: number;
  column: GridColumnDef<T>;
  position: GridColumnInsertPosition;
};

export type GridRowDeleteEvent<T extends object = GridRow> = {
  rowIndex: number;
  row: T;
};

export type GridColumnDeleteEvent<T extends object = GridRow> = {
  columnIndex: number;
  column: GridColumnDef<T>;
};

/**
 * Why a pasted cell was not written (A-065/A-059). Reported in bulk via `onPaste`, never dropped
 * silently. `"unparseable"` = non-blank text that a strict column parse rejected (e.g. `"abc"` into a
 * number column): the previous value is KEPT rather than silently replaced with `null`.
 */
export type GridPasteSkipReason = "overflow" | "readonly" | "unparseable";

export type GridPasteSkippedCell = {
  /** Source row index of the target cell. Omitted for off-grid `"overflow"` cells (no cell exists). */
  rowIndex?: number;
  /** Target column key. Omitted for `"overflow"` cells past the last column. */
  columnKey?: string;
  reason: GridPasteSkipReason;
};

/** Counts plus per-cell reasons for the cells a paste could not write (A-065). */
export type GridPasteSkipSummary = {
  /** `overflow + readonly + unparseable`. */
  total: number;
  /** Cells dropped because the paste extended past the last row or column. */
  overflow: number;
  /** Cells dropped because the target column is read-only / not editable. */
  readonly: number;
  /** Cells dropped because the pasted text failed the column's strict parse (value kept). */
  unparseable: number;
  cells: GridPasteSkippedCell[];
};

/**
 * Payload for `onCopy`/`onPaste`. `selection` and `rows` are the original 0.2.0 shape; the remaining
 * fields are additive (A-058/A-065) and only populated for the relevant action.
 */
export type GridClipboardEvent<T extends object = GridRow> = {
  selection: GridSelectionState;
  rows: T[];
  /** `copy`/`cut` only: whether the source cells are cleared (`cut`). Absent on paste. */
  isCut?: boolean;
  /** `paste` only: number of cells actually written. */
  applied?: number;
  /** `paste` only: cells not written, by reason — never silent (A-065). */
  skipped?: GridPasteSkipSummary;
};

/** How copy serialises cell values (A-064); `"raw"` is the unchanged default. */
export type GridClipboardValueMode = "raw" | "displayed";

/** A failed clipboard read/write surfaced via `onClipboardError` instead of silence (A-057). */
export type GridClipboardErrorEvent = {
  action: "copy" | "cut" | "paste";
  error: unknown;
};

/* =========================================================
   Column definition
   ========================================================= */

export type GridValueGetter<T extends object = GridRow> = (row: T) => unknown;

export type GridValueSetter<T extends object = GridRow> = (row: T, value: GridCallbackValue) => T;

export type GridValueFormatter<T extends object = GridRow> = (
  value: GridCallbackValue,
  row: T
) => string;

export type GridValueParser<T extends object = GridRow> = (
  value: GridCallbackValue,
  row: T
) => unknown;

export type GridCellValidator<T extends object = GridRow> = (
  value: GridCallbackValue,
  row: T
) => string | null;

export type GridRowIdGetter<T extends object = GridRow> = (row: T, index: number) => string;

export type GridRowMetaGetter<T extends object = GridRow> = (
  row: T,
  sourceRowIndex: number
) => GridRowMeta | undefined;

export type GridCellMetaGetter<T extends object = GridRow> = (
  row: T,
  sourceRowIndex: number,
  columnKey: string
) => GridCellMeta | undefined;

export type GridColumnDef<T extends object = GridRow> = {
  key: string;
  title: string;

  type?: GridColumnType;

  width?: number;
  minWidth?: number;
  maxWidth?: number;

  editable?: boolean;
  readonly?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  frozen?: boolean;
  wrap?: boolean;
  hidden?: boolean;

  placeholder?: string;
  options?: string[];
  filterOptions?: string[];
  /** Show the column-menu value filter as a year > month > day tree (ISO date strings). */
  filterTree?: "date";

  align?: "left" | "center" | "right";

  getValue?: GridValueGetter<T>;
  setValue?: GridValueSetter<T>;
  formatValue?: GridValueFormatter<T>;
  parseValue?: GridValueParser<T>;
  validate?: GridCellValidator<T>;

  validations?: GridValidationRule[];

  cellClassName?: string;
  headerClassName?: string;

  renderCell?: (props: GridCellRendererProps<T>) => React.ReactNode;
  renderEditor?: (props: GridCellEditorProps<T>) => React.ReactNode;
};

export type GridInsertedRowFactoryContext<T extends object = GridRow> = {
  rows: T[];
  columns: GridResolvedColumnDef<T>[];
  insertAt: number;
  position: GridRowInsertPosition;
  referenceRow: T | null;
};

export type GridInsertedColumnFactoryContext<T extends object = GridRow> = {
  columns: GridColumnDef<T>[];
  insertAt: number;
  position: GridColumnInsertPosition;
  referenceColumn: GridColumnDef<T> | null;
};

export type GridInsertedRowFactory<T extends object = GridRow> = (
  context: GridInsertedRowFactoryContext<T>
) => T;

export type GridInsertedColumnFactory<T extends object = GridRow> = (
  context: GridInsertedColumnFactoryContext<T>
) => GridColumnDef<T>;

/* =========================================================
   Internal normalized column
   ========================================================= */

export type GridResolvedColumnDef<T extends object = GridRow> = Required<
  Pick<
    GridColumnDef<T>,
    | "key"
    | "title"
    | "type"
    | "editable"
    | "readonly"
    | "sortable"
    | "filterable"
    | "resizable"
    | "frozen"
    | "wrap"
    | "hidden"
  >
> &
  GridColumnDef<T> & {
    width: number;
    minWidth: number;
    maxWidth?: number;
  };

/* =========================================================
   Grid history
   ========================================================= */

export type GridSnapshot<T extends object = GridRow> = {
  rows: T[];
  columns: GridColumnDef<T>[];
  cellMeta: Record<string, GridCellMeta>;
  rowMeta: Record<number, GridRowMeta>;
};

export type GridHistoryState<T extends object = GridRow> = {
  past: GridSnapshot<T>[];
  present: GridSnapshot<T>;
  future: GridSnapshot<T>[];
};

export type GridHistoryAction<T extends object = GridRow> =
  | { type: "RESET"; payload: GridSnapshot<T> }
  | { type: "PUSH"; payload: GridSnapshot<T> }
  | { type: "UNDO" }
  | { type: "REDO" };

/* =========================================================
   UI state
   ========================================================= */

export type GridColumnMenuState = {
  columnKey: string;
  columnIndex: number;
  anchorRect: DOMRect;
} | null;

export type GridDropdownEditState = {
  row: number;
  col: number;
  columnKey: string;
  anchorRect: DOMRect;
} | null;

export type GridUiState = {
  editingCell: GridEditCell;
  dropdownEdit: GridDropdownEditState;
  columnMenu: GridColumnMenuState;
  showFormulaBar: boolean;
  showStatusBar: boolean;
};

/* =========================================================
   Main grid state
   ========================================================= */

export type GridState<T extends object = GridRow> = {
  rows: T[];
  columns: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  sort: GridSort;
  filters: GridFilters;
  colorFilters: GridColorFilters;
  colorSort: GridColorSort;
  clipboard: GridClipboardData;
  fill: GridFillState;
  formatPainter: GridFormatPainterClipboard;
  ui: GridUiState;
};

/* =========================================================
   Main props
   ========================================================= */

export type GridMasterProps<T extends object = GridRow> = {
  /** Accepts `readonly` arrays; `T` is inferred from this prop. The grid never mutates it. */
  rows: readonly T[];
  columns: readonly GridColumnDef<T>[];
  getRowId?: GridRowIdGetter<T>;
  getRowMeta?: GridRowMetaGetter<T>;
  getCellMeta?: GridCellMetaGetter<T>;
  /**
   * Seed for cell formatting. Read on mount (and when `rows` is genuinely replaced); a new object
   * identity on a later render is ignored so it cannot overwrite the user's formatting. Remount
   * the grid with a React `key` to re-seed deliberately.
   */
  initialCellMeta?: Record<string, GridCellMeta>;
  /** Seed for row meta; same mount-only semantics as `initialCellMeta`. */
  initialRowMeta?: Record<number, GridRowMeta>;
  initialFilters?: GridFilters;
  initialColorFilters?: GridColorFilters;
  initialColorSort?: GridColorSort;
  resolveFilterValues?: (columnKey: string, filters: GridFilters) => Promise<string[]> | string[];
  filterMenuVisibleValueCount?: number;
  /** Rows shown in the column menu's colour list before it scrolls (default: about 5). */
  colorMenuVisibleValueCount?: number;
  isColorMenuEnabled?: (columnKey: string) => boolean;
  getColorSourceColumnKey?: (columnKey: string) => string | null;
  resolveColorOptions?: (
    columnKey: string,
    filters: GridFilters,
    colorFilters: GridColorFilters
  ) => Promise<GridColorOption[]> | GridColorOption[];
  allowedRowIds?: Iterable<string> | null;

  /**
   * Receives a mutable `T[]` (typed so `onRowsChange={setRows}` and handlers typed `Row[]` or
   * `readonly Row[]` both compile). `T` is inferred from `rows`; the emitted array is the grid's
   * own copy, so treat it as read-only and set it into state instead of mutating it in place.
   */
  onRowsChange?: (rows: T[]) => void;
  onColumnsChange?: (columns: GridColumnDef<T>[]) => void;
  onSnapshotChange?: (snapshot: GridSnapshot<T>) => void;
  onCellChange?: (event: GridCellChangeEvent<T>) => void;
  onSaveShortcut?: () => void;
  onSelectionChange?: (event: GridSelectionChangeEvent) => void;
  onSortChange?: (event: GridSortChangeEvent) => void;
  onFilterChange?: (event: GridFilterChangeEvent) => void;
  onColorFilterChange?: (event: GridColorFilterChangeEvent) => void;
  onColorSortChange?: (event: GridColorSortChangeEvent) => void;
  onColumnResize?: (event: GridColumnResizeEvent<T>) => void;
  onRowInsert?: (event: GridRowInsertEvent<T>) => void;
  onColumnInsert?: (event: GridColumnInsertEvent<T>) => void;
  onRowDelete?: (event: GridRowDeleteEvent<T>) => void;
  onColumnDelete?: (event: GridColumnDeleteEvent<T>) => void;
  onCopy?: (event: GridClipboardEvent<T>) => void;
  onPaste?: (event: GridClipboardEvent<T>) => void;
  /** Surfaces a failed clipboard read/write (permission denied, API missing) instead of silence (A-057). */
  onClipboardError?: (event: GridClipboardErrorEvent) => void;
  onValidationChange?: (errors: Record<string, string>) => void;
  onConditionalFormatsChange?: (formats: GridConditionalFormats) => void;
  createRowOnInsert?: GridInsertedRowFactory<T>;
  createColumnOnInsert?: GridInsertedColumnFactory<T>;

  /**
   * `"readonly"` guarantees no mutation of rows, cell meta or columns from any user path (keyboard,
   * toolbar, context menu, fill handle, format painter, clipboard, undo/redo): `onRowsChange`,
   * `onCellChange` and the other change callbacks never fire. Copy, selection, sorting, filtering
   * and column sizing/visibility remain available. Default: `"editable"`.
   */
  mode?: GridMode;

  height?: number | string;
  width?: number | string;

  rowHeight?: number;
  headerHeight?: number;

  frozenColumns?: number;
  virtualizeRows?: boolean;
  overscanRowCount?: number;
  historyLimit?: number;
  rowPatchMode?: boolean;

  showToolbar?: boolean;
  showFormulaBar?: boolean;
  showStatusBar?: boolean;

  /** `false` leaves only the active-cell cursor: no range, row, column or select-all selection. */
  enableSelection?: boolean;
  /** `false`: no range selection (Shift+click/arrows, drag, Ctrl+A, select-all corner). */
  enableRangeSelection?: boolean;
  /** `false`: no row selection (row-header click, Ctrl+Shift+Left/Right). */
  enableRowSelection?: boolean;
  /** `false`: no column selection (column-header click, Ctrl+Shift+Up/Down). */
  enableColumnSelection?: boolean;

  /**
   * How Tab / Shift+Tab behave inside the grid (A-013).
   * - `"cells"` (default): Tab moves to the next cell and Shift+Tab to the previous, matching a
   *   spreadsheet. At the LAST cell (Tab) / FIRST cell (Shift+Tab) the keystroke is NOT intercepted,
   *   so focus leaves the grid and the page tab order continues (WCAG 2.1.2, no keyboard trap).
   * - `"native"`: Tab is never intercepted; it always moves browser focus, never the cell cursor.
   */
  tabNavigation?: "cells" | "native";

  /**
   * `false`: cell values cannot be written even in `"editable"` mode: no cell editor (F2, Enter,
   * double-click, typing), formula bar, checkbox toggle, fill, cut, paste or clear. Formatting is
   * separate (see `enableCellColoring`, `enableWrapText`, `mode`).
   */
  enableEditing?: boolean;
  /** `false`: copy, cut and paste do nothing (keyboard and toolbar; toolbar buttons are disabled). */
  enableClipboard?: boolean;
  /**
   * How copy serialises cell values (A-064). `"raw"` (default, unchanged behaviour) copies the stored
   * value, so a formula cell copies its source text (`=A1+B1`) and an in-grid paste round-trips to a
   * live formula. `"displayed"` copies the on-screen text, so a formula cell copies its computed RESULT.
   */
  clipboardValueMode?: GridClipboardValueMode;
  /**
   * BCP-47 locale for strict number/date parsing on the paste path (A-059); matches the editor locale.
   * Default: `en-US`. Only affects how pasted text is coerced; it never changes existing values.
   */
  locale?: string;
  /** `false`: no fill handle. Also off when editing is off (readonly or `enableEditing={false}`). */
  enableFillHandle?: boolean;
  enableUndoRedo?: boolean;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableColumnResize?: boolean;
  enableColumnAutoFit?: boolean;
  enableColumnVisibility?: boolean;
  /** `false`: the fill and font colour controls are disabled and the format painter keeps each target's fill. */
  enableCellColoring?: boolean;
  /** `false`: the wrap control is disabled and the format painter keeps each target's wrap. */
  enableWrapText?: boolean;
  enableInsertRow?: boolean;
  enableInsertColumn?: boolean;
  enableDeleteRow?: boolean;
  enableDeleteColumn?: boolean;
  /** `false`: column validators are not run (no error indicator). Default: `true`. */
  enableValidation?: boolean;
  enableConditionalFormatting?: boolean;
  initialConditionalFormats?: GridConditionalFormats;
  /**
   * Injectable clock for `timePeriod` conditional-format rules (today / yesterday / this week /
   * this month). Defaults to the real clock; provide a fixed one for deterministic rendering/tests.
   */
  conditionalFormatNow?: () => Date;
  enableRowDrag?: boolean;
  enableColumnDrag?: boolean;
  onRowReorder?: (rows: T[]) => void;
  onColumnReorder?: (columns: GridColumnDef<T>[]) => void;

  className?: string;
  style?: React.CSSProperties;
};

/* =========================================================
   Column helper creator types
   ========================================================= */

export type GridCreateColumnOptions<T extends object = GridRow> = Omit<
  GridColumnDef<T>,
  "key" | "title" | "type"
>;

export type GridColumnFactory<T extends object = GridRow> = {
  text: (
    key: string,
    options?: GridCreateColumnOptions<T> & { title?: string }
  ) => GridColumnDef<T>;
  number: (
    key: string,
    options?: GridCreateColumnOptions<T> & { title?: string }
  ) => GridColumnDef<T>;
  select: (
    key: string,
    options?: GridCreateColumnOptions<T> & {
      title?: string;
      options?: string[];
      filterOptions?: string[];
    }
  ) => GridColumnDef<T>;
  checkbox: (
    key: string,
    options?: GridCreateColumnOptions<T> & { title?: string }
  ) => GridColumnDef<T>;
  link: (
    key: string,
    options?: GridCreateColumnOptions<T> & { title?: string }
  ) => GridColumnDef<T>;
  date: (
    key: string,
    options?: GridCreateColumnOptions<T> & { title?: string }
  ) => GridColumnDef<T>;
  custom: (
    key: string,
    options?: GridCreateColumnOptions<T> & { title?: string }
  ) => GridColumnDef<T>;
};

/* =========================================================
   Presets
   ========================================================= */

/**
 * What the `create*GridPreset()` helpers return: configuration props only. None of these keys
 * mention the row type, so spreading a preset into `<GridMaster rows={...} />` can never pull the
 * inferred `T` towards `GridRow` (audit A-035). `T` is kept only so `createEditableGridPreset<Row>()`
 * written against 0.2.0 still compiles.
 */
export type GridPresetProps<T extends object = GridRow> = Partial<
  Pick<
    GridMasterProps<T>,
    | "mode"
    | "enableEditing"
    | "enableClipboard"
    | "enableFillHandle"
    | "enableUndoRedo"
    | "enableSorting"
    | "enableFiltering"
    | "enableColumnResize"
    | "enableColumnAutoFit"
    | "enableCellColoring"
    | "enableWrapText"
    | "enableInsertRow"
    | "enableInsertColumn"
    | "enableDeleteRow"
    | "enableDeleteColumn"
    | "showFormulaBar"
    | "showStatusBar"
    | "rowHeight"
    | "headerHeight"
    | "frozenColumns"
  >
>;
