import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GridClipboardData,
  GridCellChangeEvent,
  GridEditCell,
  GridFilters,
  GridHistoryState,
  GridMasterProps,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
  GridSort,
} from "../../core/types";
import {
  DEFAULT_ENABLE_CELL_COLORING,
  DEFAULT_ENABLE_CLIPBOARD,
  DEFAULT_ENABLE_COLUMN_AUTOFIT,
  DEFAULT_ENABLE_COLUMN_RESIZE,
  DEFAULT_ENABLE_COLUMN_SELECTION,
  DEFAULT_ENABLE_COLUMN_VISIBILITY,
  DEFAULT_ENABLE_DELETE_ROW,
  DEFAULT_ENABLE_EDITING,
  DEFAULT_ENABLE_FILL_HANDLE,
  DEFAULT_ENABLE_FILTERING,
  DEFAULT_ENABLE_INSERT_ROW,
  DEFAULT_ENABLE_RANGE_SELECTION,
  DEFAULT_ENABLE_ROW_SELECTION,
  DEFAULT_ENABLE_SELECTION,
  DEFAULT_ENABLE_SORTING,
  DEFAULT_ENABLE_UNDO_REDO,
  DEFAULT_ENABLE_WRAP_TEXT,
  DEFAULT_FROZEN_COLUMNS,
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_MODE,
  DEFAULT_GRID_WIDTH,
  DEFAULT_HEADER_HEIGHT,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_SHOW_FORMULA_BAR,
  DEFAULT_SHOW_STATUS_BAR,
  EMPTY_CLIPBOARD,
  EMPTY_FILTERS,
  EMPTY_SORT,
} from "../../core/constants";
import { clearFillState, type GridFillState } from "../../core/features/fill";
import {
  createInitialColumnWidths,
  getVisibleColumns,
  syncWidthMapWithColumns,
  type GridColumnWidths,
} from "../../core/features/sizing";
import {
  createInitialHistoryState,
  historyReducer,
} from "../../core/state/historyReducer";
import { getDisplayRowIndexes, getDisplayRows } from "../../core/state/gridState";
import { createInitialSelectionState, setActiveCell } from "../../core/state/selectionState";
import { clamp, cloneRows, resolveColumns, shallowEqualRows } from "../../core/utils";

export type UseGridMasterResult<T extends GridRow = GridRow> = {
  props: GridMasterProps<T>;

  rows: T[];
  setRows: (rows: T[]) => void;

  columns: GridResolvedColumnDef<T>[];
  visibleColumns: GridResolvedColumnDef<T>[];
  displayRowIndexes: number[];
  hiddenColumnKeys: Set<string>;

  history: GridHistoryState;
  setHistory: React.Dispatch<React.SetStateAction<GridHistoryState>>;

  selection: GridSelectionState;
  setSelection: React.Dispatch<React.SetStateAction<GridSelectionState>>;
  editingCell: GridEditCell;
  setEditingCell: React.Dispatch<React.SetStateAction<GridEditCell>>;

  sort: GridSort;
  setSort: React.Dispatch<React.SetStateAction<GridSort>>;

  filters: GridFilters;
  setFilters: React.Dispatch<React.SetStateAction<GridFilters>>;

  clipboard: GridClipboardData;
  setClipboard: React.Dispatch<React.SetStateAction<GridClipboardData>>;

  fill: GridFillState;
  setFill: React.Dispatch<React.SetStateAction<GridFillState>>;

  columnWidths: GridColumnWidths;
  setColumnWidths: React.Dispatch<React.SetStateAction<GridColumnWidths>>;
  setColumnHidden: (columnKey: string, hidden: boolean) => void;
  toggleColumnHidden: (columnKey: string) => void;

  frozenColumns: number;
  setFrozenColumns: React.Dispatch<React.SetStateAction<number>>;

  displayRows: T[];
  visibleRowCount: number;

  height: number | string;
  width: number | string;
  rowHeight: number;
  headerHeight: number;
  mode: "editable" | "readonly";

  showFormulaBar: boolean;
  showStatusBar: boolean;

  enableSelection: boolean;
  enableRangeSelection: boolean;
  enableRowSelection: boolean;
  enableColumnSelection: boolean;
  enableEditing: boolean;
  enableClipboard: boolean;
  enableFillHandle: boolean;
  enableUndoRedo: boolean;
  enableSorting: boolean;
  enableFiltering: boolean;
  enableColumnResize: boolean;
  enableColumnAutoFit: boolean;
  enableColumnVisibility: boolean;
  enableCellColoring: boolean;
  enableWrapText: boolean;
  enableInsertRow: boolean;
  enableDeleteRow: boolean;

  updateRows: (nextRows: T[]) => void;
  emitCellChange: (event: GridCellChangeEvent<T>) => void;
};

export function useGridMaster<T extends GridRow = GridRow>(
  incomingProps: GridMasterProps<T>
): UseGridMasterResult<T> {
  const props = incomingProps;

  const mode = props.mode ?? DEFAULT_GRID_MODE;
  const height = props.height ?? DEFAULT_GRID_HEIGHT;
  const width = props.width ?? DEFAULT_GRID_WIDTH;
  const rowHeight = props.rowHeight ?? DEFAULT_ROW_HEIGHT;
  const headerHeight = props.headerHeight ?? DEFAULT_HEADER_HEIGHT;

  const showFormulaBar = props.showFormulaBar ?? DEFAULT_SHOW_FORMULA_BAR;
  const showStatusBar = props.showStatusBar ?? DEFAULT_SHOW_STATUS_BAR;

  const enableSelection = props.enableSelection ?? DEFAULT_ENABLE_SELECTION;
  const enableRangeSelection = props.enableRangeSelection ?? DEFAULT_ENABLE_RANGE_SELECTION;
  const enableRowSelection = props.enableRowSelection ?? DEFAULT_ENABLE_ROW_SELECTION;
  const enableColumnSelection = props.enableColumnSelection ?? DEFAULT_ENABLE_COLUMN_SELECTION;
  const enableEditing =
    mode === "readonly" ? false : (props.enableEditing ?? DEFAULT_ENABLE_EDITING);
  const enableClipboard = props.enableClipboard ?? DEFAULT_ENABLE_CLIPBOARD;
  const enableFillHandle = props.enableFillHandle ?? DEFAULT_ENABLE_FILL_HANDLE;
  const enableUndoRedo = props.enableUndoRedo ?? DEFAULT_ENABLE_UNDO_REDO;
  const enableSorting = props.enableSorting ?? DEFAULT_ENABLE_SORTING;
  const enableFiltering = props.enableFiltering ?? DEFAULT_ENABLE_FILTERING;
  const enableColumnResize = props.enableColumnResize ?? DEFAULT_ENABLE_COLUMN_RESIZE;
  const enableColumnAutoFit = props.enableColumnAutoFit ?? DEFAULT_ENABLE_COLUMN_AUTOFIT;
  const enableColumnVisibility =
    props.enableColumnVisibility ?? DEFAULT_ENABLE_COLUMN_VISIBILITY;
  const enableCellColoring = props.enableCellColoring ?? DEFAULT_ENABLE_CELL_COLORING;
  const enableWrapText = props.enableWrapText ?? DEFAULT_ENABLE_WRAP_TEXT;
  const enableInsertRow = props.enableInsertRow ?? DEFAULT_ENABLE_INSERT_ROW;
  const enableDeleteRow = props.enableDeleteRow ?? DEFAULT_ENABLE_DELETE_ROW;

  const resolvedColumns = useMemo(() => resolveColumns(props.columns ?? []), [props.columns]);
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<Set<string>>(
    () =>
      new Set(
        resolvedColumns.filter((column) => column.hidden).map((column) => column.key)
      )
  );

  useEffect(() => {
    setHiddenColumnKeys((prev) => {
      const next = new Set<string>();
      const hadAnyPrevious = prev.size > 0;

      resolvedColumns.forEach((column) => {
        if (prev.has(column.key)) next.add(column.key);
        else if (!hadAnyPrevious && column.hidden) next.add(column.key);
      });

      if (next.size === resolvedColumns.length && resolvedColumns.length > 0) {
        next.delete(resolvedColumns[0].key);
      }

      return next;
    });
  }, [resolvedColumns]);

  const columns = useMemo(
    () =>
      resolvedColumns.map((column) => ({
        ...column,
        hidden: hiddenColumnKeys.has(column.key),
      })),
    [hiddenColumnKeys, resolvedColumns]
  );
  const visibleColumns = useMemo(() => getVisibleColumns(columns), [columns]);
  const lastPropRowsRef = useRef(props.rows);
  const lastEmittedRowsRef = useRef<T[] | null>(null);

  const [history, setHistory] = useState<GridHistoryState>(() =>
    createInitialHistoryState({
      rows: cloneRows(props.rows ?? []),
      cellMeta: {},
      rowMeta: {},
    })
  );
  const rows = history.present.rows as T[];

  useEffect(() => {
    if (props.rows === lastPropRowsRef.current) return;

    lastPropRowsRef.current = props.rows;

    const nextRows = cloneRows(props.rows ?? []);

    if (
      (lastEmittedRowsRef.current && shallowEqualRows(nextRows, lastEmittedRowsRef.current)) ||
      shallowEqualRows(nextRows, history.present.rows as T[])
    ) {
      lastEmittedRowsRef.current = null;
      return;
    }

    setHistory((prev) =>
      createInitialHistoryState({
        rows: nextRows,
        cellMeta: prev.present.cellMeta ?? {},
        rowMeta: prev.present.rowMeta ?? {},
      })
    );
  }, [history.present.rows, props.rows]);

  const [selection, setSelection] = useState<GridSelectionState>(() =>
    setActiveCell(createInitialSelectionState(), { row: 0, col: 0 })
  );
  const [editingCell, setEditingCell] = useState<GridEditCell>(null);

  const [sort, setSort] = useState<GridSort>(EMPTY_SORT);
  const [filters, setFilters] = useState<GridFilters>(EMPTY_FILTERS);
  const [clipboard, setClipboard] = useState(EMPTY_CLIPBOARD);
  const [fill, setFill] = useState<GridFillState>(clearFillState());
  const [columnWidths, setColumnWidths] = useState<GridColumnWidths>(() =>
    createInitialColumnWidths(columns)
  );
  const [frozenColumns, setFrozenColumns] = useState<number>(
    props.frozenColumns ?? DEFAULT_FROZEN_COLUMNS
  );

  useEffect(() => {
    setColumnWidths((prev) => syncWidthMapWithColumns(prev, columns));
  }, [columns]);

  useEffect(() => {
    setFrozenColumns(props.frozenColumns ?? DEFAULT_FROZEN_COLUMNS);
  }, [props.frozenColumns]);

  const setColumnHidden = useCallback(
    (columnKey: string, hidden: boolean) => {
      setHiddenColumnKeys((prev) => {
        const next = new Set(prev);
        if (hidden) next.add(columnKey);
        else next.delete(columnKey);

        const visibleCount = columns.length - next.size;
        if (hidden && visibleCount <= 0) {
          return prev;
        }

        return next;
      });
    },
    [columns.length]
  );

  const toggleColumnHidden = useCallback(
    (columnKey: string) => {
      setHiddenColumnKeys((prev) => {
        const next = new Set(prev);
        if (next.has(columnKey)) next.delete(columnKey);
        else if (columns.length - next.size > 1) next.add(columnKey);
        return next;
      });
    },
    [columns.length]
  );

  const displayRowIndexes = useMemo(
    () =>
      getDisplayRowIndexes(rows, columns, filters, sort, {
        enableFiltering,
        enableSorting,
      }),
    [rows, columns, filters, sort, enableFiltering, enableSorting]
  );
  const displayRows = useMemo(
    () => getDisplayRows(rows, displayRowIndexes),
    [rows, displayRowIndexes]
  );

  const visibleRowCount = displayRows.length;

  useEffect(() => {
    setFrozenColumns((prev) => Math.min(prev, visibleColumns.length));
  }, [visibleColumns.length]);

  useEffect(() => {
    const maxRow = Math.max(displayRows.length - 1, 0);
    const maxCol = Math.max(visibleColumns.length - 1, 0);

    setSelection((prev) => {
      const clampCell = (cell: GridSelectionState["cursor"]) =>
        cell
          ? {
              row: clamp(cell.row, 0, maxRow),
              col: clamp(cell.col, 0, maxCol),
            }
          : null;

      const nextAnchor = clampCell(prev.anchor);
      const nextCursor = clampCell(prev.cursor);
      const nextRange = prev.range
        ? {
            start: {
              row: clamp(prev.range.start.row, 0, maxRow),
              col: clamp(prev.range.start.col, 0, maxCol),
            },
            end: {
              row: clamp(prev.range.end.row, 0, maxRow),
              col: clamp(prev.range.end.col, 0, maxCol),
            },
          }
        : null;
      const nextSelectedRows = new Set(
        [...prev.selectedRows].filter((rowIndex) => rowIndex <= maxRow)
      );
      const nextSelectedCols = new Set(
        [...prev.selectedCols].filter((colIndex) => colIndex <= maxCol)
      );

      if (
        prev.anchor?.row === nextAnchor?.row &&
        prev.anchor?.col === nextAnchor?.col &&
        prev.cursor?.row === nextCursor?.row &&
        prev.cursor?.col === nextCursor?.col &&
        prev.range?.start.row === nextRange?.start.row &&
        prev.range?.start.col === nextRange?.start.col &&
        prev.range?.end.row === nextRange?.end.row &&
        prev.range?.end.col === nextRange?.end.col &&
        prev.selectedRows.size === nextSelectedRows.size &&
        prev.selectedCols.size === nextSelectedCols.size
      ) {
        return prev;
      }

      return {
        ...prev,
        anchor: nextAnchor,
        cursor: nextCursor,
        range: nextRange,
        selectedRows: nextSelectedRows,
        selectedCols: nextSelectedCols,
      };
    });

    setEditingCell((prev) => {
      if (!prev) return prev;
      if (prev.row > maxRow || prev.col > maxCol) return null;
      return prev;
    });
  }, [displayRows.length, visibleColumns.length, setSelection]);

  const setRows = useCallback(
    (nextRows: T[]) => {
      const cloned = cloneRows(nextRows);
      setHistory(
        createInitialHistoryState({
          rows: cloned,
          cellMeta: {},
          rowMeta: {},
        })
      );
      lastEmittedRowsRef.current = cloned;
      props.onRowsChange?.(cloned);
    },
    [props]
  );

  const updateRows = useCallback(
    (nextRows: T[]) => {
      const cloned = cloneRows(nextRows);
      if (shallowEqualRows(cloned, rows)) return;

      setHistory((prev) =>
        historyReducer(prev, {
          type: "PUSH",
          payload: {
            rows: cloned,
            cellMeta: prev.present.cellMeta,
            rowMeta: prev.present.rowMeta,
          },
        })
      );
      lastEmittedRowsRef.current = cloned;
      props.onRowsChange?.(cloned);
    },
    [props, rows]
  );

  const emitCellChange = useCallback(
    (event: GridCellChangeEvent<T>) => {
      props.onCellChange?.(event);
    },
    [props]
  );

  useEffect(() => {
    props.onSelectionChange?.({ selection });
  }, [selection, props]);

  useEffect(() => {
    props.onSortChange?.({ sort });
  }, [sort, props]);

  useEffect(() => {
    props.onFilterChange?.({ filters });
  }, [filters, props]);

  return {
    props,

    rows,
    setRows,

    columns,
    visibleColumns,
    displayRowIndexes,
    hiddenColumnKeys,

    history,
    setHistory,

    selection,
    setSelection,
    editingCell,
    setEditingCell,

    sort,
    setSort,

    filters,
    setFilters,

    clipboard,
    setClipboard,

    fill,
    setFill,

    columnWidths,
    setColumnWidths,
    setColumnHidden,
    toggleColumnHidden,

    frozenColumns,
    setFrozenColumns,

    displayRows,
    visibleRowCount,

    height,
    width,
    rowHeight,
    headerHeight,
    mode,

    showFormulaBar,
    showStatusBar,

    enableSelection,
    enableRangeSelection,
    enableRowSelection,
    enableColumnSelection,
    enableEditing,
    enableClipboard,
    enableFillHandle,
    enableUndoRedo,
    enableSorting,
    enableFiltering,
    enableColumnResize,
    enableColumnAutoFit,
    enableColumnVisibility,
    enableCellColoring,
    enableWrapText,
    enableInsertRow,
    enableDeleteRow,

    updateRows,
    emitCellChange,
  };
}
