import type {
  GridCellCoord,
  GridCellMeta,
  GridClipboardData,
  GridColumnFilter,
  GridDropdownEditState,
  GridEditCell,
  GridFillState,
  GridFilters,
  GridMode,
  GridSelectionRange,
  GridSelectionState,
  GridSort,
  GridUiState,
} from "./types";

/* =========================================================
   Grid sizing defaults
   ========================================================= */

export const DEFAULT_GRID_MODE: GridMode = "editable";

export const DEFAULT_GRID_HEIGHT = "72vh";
export const DEFAULT_GRID_WIDTH = "100%";

export const DEFAULT_ROW_HEIGHT = 30;
export const DEFAULT_HEADER_HEIGHT = 36;

export const DEFAULT_COLUMN_WIDTH = 170;
export const DEFAULT_MIN_COLUMN_WIDTH = 80;
export const DEFAULT_MAX_COLUMN_WIDTH = 420;

export const DEFAULT_ROW_NUMBER_WIDTH = 52;

export const DEFAULT_FROZEN_COLUMNS = 0;

export const MAX_HISTORY_SIZE = 50;

/* =========================================================
   Feature defaults
   ========================================================= */

export const DEFAULT_ENABLE_SELECTION = true;
export const DEFAULT_ENABLE_RANGE_SELECTION = true;
export const DEFAULT_ENABLE_ROW_SELECTION = true;
export const DEFAULT_ENABLE_COLUMN_SELECTION = true;

export const DEFAULT_ENABLE_EDITING = true;
export const DEFAULT_ENABLE_CLIPBOARD = true;
export const DEFAULT_ENABLE_FILL_HANDLE = true;
export const DEFAULT_ENABLE_UNDO_REDO = true;
export const DEFAULT_ENABLE_SORTING = true;
export const DEFAULT_ENABLE_FILTERING = true;
export const DEFAULT_ENABLE_COLUMN_RESIZE = true;
export const DEFAULT_ENABLE_COLUMN_AUTOFIT = true;
export const DEFAULT_ENABLE_COLUMN_VISIBILITY = true;
export const DEFAULT_ENABLE_CELL_COLORING = true;
export const DEFAULT_ENABLE_WRAP_TEXT = true;
export const DEFAULT_ENABLE_INSERT_ROW = true;
export const DEFAULT_ENABLE_DELETE_ROW = true;

export const DEFAULT_SHOW_FORMULA_BAR = true;
export const DEFAULT_SHOW_STATUS_BAR = true;

/* =========================================================
   Cell / column defaults
   ========================================================= */

export const DEFAULT_CELL_META: GridCellMeta = {
  backgroundColor: "",
  wrap: false,
  readonly: false,
  className: "",
  style: undefined,
  error: null,
};

export const DEFAULT_COLUMN_ALIGN = "left" as const;
export const DEFAULT_COLUMN_TYPE = "text" as const;

/* =========================================================
   Clipboard / fill defaults
   ========================================================= */

export const EMPTY_CLIPBOARD: GridClipboardData = null;
export const EMPTY_FILL_STATE: GridFillState = null;

/* =========================================================
   Editing / menu defaults
   ========================================================= */

export const EMPTY_EDIT_CELL: GridEditCell = null;
export const EMPTY_DROPDOWN_EDIT: GridDropdownEditState = null;

export const EMPTY_COLUMN_MENU = null;

/* =========================================================
   Selection helpers
   ========================================================= */

export const EMPTY_CELL_COORD: GridCellCoord = {
  row: 0,
  col: 0,
};

export const EMPTY_SELECTION_RANGE: GridSelectionRange = {
  start: { row: 0, col: 0 },
  end: { row: 0, col: 0 },
};

export const INITIAL_SELECTION_STATE: GridSelectionState = {
  mode: "cell",
  anchor: { row: 0, col: 0 },
  cursor: { row: 0, col: 0 },
  range: {
    start: { row: 0, col: 0 },
    end: { row: 0, col: 0 },
  },
  selectedRows: new Set<number>(),
  selectedCols: new Set<number>(),
};

/* =========================================================
   Sort / filter defaults
   ========================================================= */

export const EMPTY_SORT: GridSort = null;

export const EMPTY_FILTERS: GridFilters = {};

export const EMPTY_VALUE_SET_FILTER: GridColumnFilter = {
  type: "valueSet",
  values: new Set<string>(),
};

/* =========================================================
   UI defaults
   ========================================================= */

export const INITIAL_UI_STATE: GridUiState = {
  editingCell: EMPTY_EDIT_CELL,
  dropdownEdit: EMPTY_DROPDOWN_EDIT,
  columnMenu: EMPTY_COLUMN_MENU,
  showFormulaBar: DEFAULT_SHOW_FORMULA_BAR,
  showStatusBar: DEFAULT_SHOW_STATUS_BAR,
};

/* =========================================================
   Keyboard keys
   ========================================================= */

export const KEYBOARD_KEYS = {
  ENTER: "Enter",
  ESCAPE: "Escape",
  TAB: "Tab",
  BACKSPACE: "Backspace",
  DELETE: "Delete",
  SPACE: " ",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  Z: "z",
  Y: "y",
  C: "c",
  X: "x",
  V: "v",
  A: "a",
  F2: "F2",
} as const;

/* =========================================================
   Color palette
   ========================================================= */

export const DEFAULT_COLOR_PALETTE = [
  "",
  "#fef08a",
  "#bbf7d0",
  "#bfdbfe",
  "#fecaca",
  "#e9d5ff",
  "#fed7aa",
  "#f1f5f9",
  "#1e293b",
];

export const DEFAULT_COLOR_LABELS = [
  "None",
  "Yellow",
  "Green",
  "Blue",
  "Red",
  "Purple",
  "Orange",
  "Light",
  "Dark",
] as const;

/* =========================================================
   UI z-index defaults
   ========================================================= */

export const Z_INDEX = {
  HEADER: 20,
  FROZEN_HEADER: 30,
  ROW_HEADER: 15,
  FROZEN_CELL: 10,
  ACTIVE_CELL: 3,
  RESIZE_HANDLE: 30,
  FILL_HANDLE: 20,
  FLOATING_MENU: 99999,
} as const;

/* =========================================================
   Internal ids / class hooks
   ========================================================= */

export const GRID_CLASSNAMES = {
  ROOT: "gm-root",
  VIEWPORT: "gm-viewport",
  TABLE: "gm-table",
  HEADER_CELL: "gm-th",
  ROW_HEADER_CELL: "gm-rh",
  BODY_CELL: "gm-td",
  ACTIVE_CELL: "gm-active",
  SELECTED_CELL: "gm-selected",
  READONLY_CELL: "gm-readonly",
  DRAFT_ROW: "gm-draft-row",
  IMPORTED_ROW: "gm-imported-row",
  WRAP_CELL: "gm-wrap",
  CUT_CELL: "gm-cut",
  FREEZE_SHADOW: "gm-freeze-shadow",
  RESIZE_HANDLE: "gm-resize-handle",
  FILL_HANDLE: "gm-fill-handle",
  FORMULA_BAR: "gm-formula-bar",
  STATUS_BAR: "gm-status-bar",
} as const;
