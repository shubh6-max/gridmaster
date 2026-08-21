import type React from "react";

/* =========================================================
   Base row type
   ========================================================= */

export type GridRow = Record<string, unknown>;

/* =========================================================
   Primitive / value types
   ========================================================= */

export type GridPrimitive = string | number | boolean | null | undefined | Date;

export type GridCellValue = GridPrimitive | Record<string, any> | any[];

export type GridColumnType =
  | "text"
  | "number"
  | "select"
  | "checkbox"
  | "link"
  | "date"
  | "custom";

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
      value?: any;
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
  origin: GridClipboardOrigin;
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

export type GridCellContext<T extends GridRow = GridRow> = {
  row: T;
  rowIndex: number;
  column: GridColumnDef<T>;
  columnIndex: number;
  value: any;
  formattedValue: string;
  meta?: GridCellMeta;
  isSelected: boolean;
  isActive: boolean;
  isEditing: boolean;
  mode: GridMode;
};

export type GridCellRendererProps<T extends GridRow = GridRow> = GridCellContext<T> & {
  updateValue: (nextValue: any) => void;
  startEditing?: () => void;
};

export type GridCellEditorProps<T extends GridRow = GridRow> = GridCellContext<T> & {
  updateValue: (nextValue: any) => void;
  commit: () => void;
  cancel: () => void;
  requestViewportFocusAfterEdit?: () => void;
  autoSelectOnFocus?: boolean;
};

/* =========================================================
   Events / callbacks
   ========================================================= */

export type GridCellChangeEvent<T extends GridRow = GridRow> = {
  rowIndex: number;
  columnIndex: number;
  columnKey: string;
  row: T;
  previousValue: any;
  value: any;
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

export type GridColumnResizeEvent<T extends GridRow = GridRow> = {
  column: GridColumnDef<T>;
  width: number;
};

export type GridRowInsertEvent<T extends GridRow = GridRow> = {
  rowIndex: number;
  row: T;
};

export type GridColumnInsertEvent<T extends GridRow = GridRow> = {
  columnIndex: number;
  column: GridColumnDef<T>;
  position: GridColumnInsertPosition;
};

export type GridRowDeleteEvent<T extends GridRow = GridRow> = {
  rowIndex: number;
  row: T;
};

export type GridColumnDeleteEvent<T extends GridRow = GridRow> = {
  columnIndex: number;
  column: GridColumnDef<T>;
};

export type GridClipboardEvent<T extends GridRow = GridRow> = {
  selection: GridSelectionState;
  rows: readonly T[];
};

/* =========================================================
   Column definition
   ========================================================= */

export type GridValueGetter<T extends GridRow = GridRow> = (row: T) => any;

export type GridValueSetter<T extends GridRow = GridRow> = (row: T, value: any) => T;

export type GridValueFormatter<T extends GridRow = GridRow> = (value: any, row: T) => string;

export type GridValueParser<T extends GridRow = GridRow> = (value: any, row: T) => any;

export type GridCellValidator<T extends GridRow = GridRow> = (
  value: any,
  row: T
) => string | null;

export type GridRowIdGetter<T extends GridRow = GridRow> = (
  row: T,
  index: number
) => string;

export type GridRowMetaGetter<T extends GridRow = GridRow> = (
  row: T,
  sourceRowIndex: number
) => GridRowMeta | undefined;

export type GridCellMetaGetter<T extends GridRow = GridRow> = (
  row: T,
  sourceRowIndex: number,
  columnKey: string
) => GridCellMeta | undefined;

export type GridColumnDef<T extends GridRow = GridRow> = {
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

export type GridInsertedRowFactoryContext<T extends GridRow = GridRow> = {
  rows: T[];
  columns: GridResolvedColumnDef<T>[];
  insertAt: number;
  position: GridRowInsertPosition;
  referenceRow: T | null;
};

export type GridInsertedColumnFactoryContext<T extends GridRow = GridRow> = {
  columns: GridColumnDef<T>[];
  insertAt: number;
  position: GridColumnInsertPosition;
  referenceColumn: GridColumnDef<T> | null;
};

export type GridInsertedRowFactory<T extends GridRow = GridRow> = (
  context: GridInsertedRowFactoryContext<T>
) => T;

export type GridInsertedColumnFactory<T extends GridRow = GridRow> = (
  context: GridInsertedColumnFactoryContext<T>
) => GridColumnDef<T>;

/* =========================================================
   Internal normalized column
   ========================================================= */

export type GridResolvedColumnDef<T extends GridRow = GridRow> = Required<
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

export type GridSnapshot<T extends GridRow = GridRow> = {
  rows: T[];
  columns: GridColumnDef<T>[];
  cellMeta: Record<string, GridCellMeta>;
  rowMeta: Record<number, GridRowMeta>;
};

export type GridHistoryState<T extends GridRow = GridRow> = {
  past: GridSnapshot<T>[];
  present: GridSnapshot<T>;
  future: GridSnapshot<T>[];
};

export type GridHistoryAction<T extends GridRow = GridRow> =
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

export type GridState<T extends GridRow = GridRow> = {
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

export type GridMasterProps<T extends GridRow = GridRow> = {
  rows: T[];
  columns: GridColumnDef<T>[];
  getRowId?: GridRowIdGetter<T>;
  getRowMeta?: GridRowMetaGetter<T>;
  getCellMeta?: GridCellMetaGetter<T>;
  initialCellMeta?: Record<string, GridCellMeta>;
  initialRowMeta?: Record<number, GridRowMeta>;
  initialFilters?: GridFilters;
  initialColorFilters?: GridColorFilters;
  initialColorSort?: GridColorSort;
  resolveFilterValues?: (columnKey: string, filters: GridFilters) => Promise<string[]> | string[];
  filterMenuVisibleValueCount?: number;
  isColorMenuEnabled?: (columnKey: string) => boolean;
  getColorSourceColumnKey?: (columnKey: string) => string | null;
  resolveColorOptions?: (
    columnKey: string,
    filters: GridFilters,
    colorFilters: GridColorFilters
  ) => Promise<GridColorOption[]> | GridColorOption[];
  allowedRowIds?: Iterable<string> | null;

  onRowsChange?: (rows: readonly T[]) => void;
  onColumnsChange?: (columns: readonly GridColumnDef<T>[]) => void;
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
  onValidationChange?: (errors: Record<string, string>) => void;
  onConditionalFormatsChange?: (formats: GridConditionalFormats) => void;
  createRowOnInsert?: GridInsertedRowFactory<T>;
  createColumnOnInsert?: GridInsertedColumnFactory<T>;

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

  enableSelection?: boolean;
  enableRangeSelection?: boolean;
  enableRowSelection?: boolean;
  enableColumnSelection?: boolean;

  enableEditing?: boolean;
  enableClipboard?: boolean;
  enableFillHandle?: boolean;
  enableUndoRedo?: boolean;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableColumnResize?: boolean;
  enableColumnAutoFit?: boolean;
  enableColumnVisibility?: boolean;
  enableCellColoring?: boolean;
  enableWrapText?: boolean;
  enableInsertRow?: boolean;
  enableInsertColumn?: boolean;
  enableDeleteRow?: boolean;
  enableDeleteColumn?: boolean;
  enableValidation?: boolean;
  enableConditionalFormatting?: boolean;
  initialConditionalFormats?: GridConditionalFormats;
  enableRowDrag?: boolean;
  enableColumnDrag?: boolean;
  onRowReorder?: (rows: readonly T[]) => void;
  onColumnReorder?: (columns: readonly GridColumnDef<T>[]) => void;

  className?: string;
  style?: React.CSSProperties;
};

/* =========================================================
   Column helper creator types
   ========================================================= */

export type GridCreateColumnOptions<T extends GridRow = GridRow> = Omit<
  GridColumnDef<T>,
  "key" | "title" | "type"
>;

export type GridColumnFactory<T extends GridRow = GridRow> = {
  text: (key: string, options?: GridCreateColumnOptions<T> & { title?: string }) => GridColumnDef<T>;
  number: (key: string, options?: GridCreateColumnOptions<T> & { title?: string }) => GridColumnDef<T>;
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
  link: (key: string, options?: GridCreateColumnOptions<T> & { title?: string }) => GridColumnDef<T>;
  date: (key: string, options?: GridCreateColumnOptions<T> & { title?: string }) => GridColumnDef<T>;
  custom: (
    key: string,
    options?: GridCreateColumnOptions<T> & { title?: string }
  ) => GridColumnDef<T>;
};
