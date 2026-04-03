import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GridCellChangeEvent,
  GridClipboardData,
  GridColumnDef,
  GridColumnInsertPosition,
  GridFilters,
  GridHistoryState,
  GridMasterProps,
  GridResolvedColumnDef,
  GridRow,
  GridRowInsertPosition,
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
  DEFAULT_ENABLE_INSERT_COLUMN,
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
import { createFormulaEvaluator, type GridFormulaEvaluator } from "../../core/features/formulas";
import {
  createDefaultInsertedColumn,
  createDefaultInsertedRow,
  getInsertColumnIndex,
  getInsertRowIndex,
  insertColumnAtIndex,
  insertColumnValueIntoRows,
  shiftCellMetaForInsertedRow,
  shiftRowMetaForInsertedRow,
} from "../../core/features/structure";
import {
  createInitialColumnWidths,
  getVisibleColumns,
  syncWidthMapWithColumns,
  type GridColumnWidths,
} from "../../core/features/sizing";
import { insertRowAt } from "../../core/features/editing";
import { createInitialHistoryState, historyReducer } from "../../core/state/historyReducer";
import { getDisplayRowIndexes, getDisplayRows } from "../../core/state/gridState";
import { createInitialSelectionState, setActiveCell } from "../../core/state/selectionState";
import {
  clamp,
  cloneColumns,
  cloneRows,
  resolveColumns,
  shallowEqualColumns,
  shallowEqualRows,
} from "../../core/utils";

export type UseGridMasterResult<T extends GridRow = GridRow> = {
  props: GridMasterProps<T>;

  viewportRef: React.RefObject<HTMLDivElement | null>;
  focusViewport: () => void;

  rows: T[];
  setRows: (rows: T[]) => void;

  rawColumns: GridColumnDef<T>[];
  setColumns: (columns: GridColumnDef<T>[]) => void;

  columns: GridResolvedColumnDef<T>[];
  visibleColumns: GridResolvedColumnDef<T>[];
  displayRowIndexes: number[];
  hiddenColumnKeys: Set<string>;
  formulaEvaluator: GridFormulaEvaluator<T>;

  history: GridHistoryState<T>;
  setHistory: React.Dispatch<React.SetStateAction<GridHistoryState<T>>>;

  selection: GridSelectionState;
  setSelection: React.Dispatch<React.SetStateAction<GridSelectionState>>;
  editingCell: { row: number; col: number } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: number } | null>>;

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
  enableInsertColumn: boolean;
  enableDeleteRow: boolean;

  updateRows: (nextRows: T[]) => void;
  updateColumns: (nextColumns: GridColumnDef<T>[]) => void;
  insertRow: (sourceRowIndex: number, position: GridRowInsertPosition) => T | null;
  insertColumn: (columnKey: string, position: GridColumnInsertPosition) => GridColumnDef<T> | null;
  emitCellChange: (event: GridCellChangeEvent<T>) => void;
};

export function useGridMaster<T extends GridRow = GridRow>(
  incomingProps: GridMasterProps<T>
): UseGridMasterResult<T> {
  const props = incomingProps;
  const viewportRef = useRef<HTMLDivElement>(null);

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
  const enableInsertColumn = props.enableInsertColumn ?? DEFAULT_ENABLE_INSERT_COLUMN;
  const enableDeleteRow = props.enableDeleteRow ?? DEFAULT_ENABLE_DELETE_ROW;

  const lastPropRowsRef = useRef(props.rows);
  const lastPropRowsValueRef = useRef(cloneRows(props.rows ?? []));
  const lastPropColumnsRef = useRef(props.columns);
  const lastPropColumnsValueRef = useRef(cloneColumns(props.columns ?? []));
  const lastEmittedRowsRef = useRef<T[] | null>(null);
  const lastEmittedColumnsRef = useRef<GridColumnDef<T>[] | null>(null);

  const [history, setHistory] = useState<GridHistoryState<T>>(() =>
    createInitialHistoryState({
      rows: cloneRows(props.rows ?? []),
      columns: cloneColumns(props.columns ?? []),
      cellMeta: {},
      rowMeta: {},
    })
  );

  const rows = history.present.rows as T[];
  const rawColumns = history.present.columns as GridColumnDef<T>[];
  const resolvedColumns = useMemo(() => resolveColumns(rawColumns), [rawColumns]);

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

  useEffect(() => {
    if (props.rows === lastPropRowsRef.current) return;

    lastPropRowsRef.current = props.rows;
    const nextRows = cloneRows(props.rows ?? []);

    if (shallowEqualRows(nextRows, lastPropRowsValueRef.current)) {
      return;
    }

    lastPropRowsValueRef.current = nextRows;

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
        columns: cloneColumns(prev.present.columns as GridColumnDef<T>[]),
        cellMeta: prev.present.cellMeta ?? {},
        rowMeta: prev.present.rowMeta ?? {},
      })
    );
  }, [history.present.rows, props.rows]);

  useEffect(() => {
    if (props.columns === lastPropColumnsRef.current) return;

    lastPropColumnsRef.current = props.columns;
    const nextColumns = cloneColumns(props.columns ?? []);

    if (shallowEqualColumns(nextColumns, lastPropColumnsValueRef.current)) {
      return;
    }

    lastPropColumnsValueRef.current = nextColumns;

    if (
      (lastEmittedColumnsRef.current &&
        shallowEqualColumns(nextColumns, lastEmittedColumnsRef.current)) ||
      shallowEqualColumns(nextColumns, history.present.columns as GridColumnDef<T>[])
    ) {
      lastEmittedColumnsRef.current = null;
      return;
    }

    setHistory((prev) =>
      createInitialHistoryState({
        rows: cloneRows(prev.present.rows as T[]),
        columns: nextColumns,
        cellMeta: prev.present.cellMeta ?? {},
        rowMeta: prev.present.rowMeta ?? {},
      })
    );
  }, [history.present.columns, props.columns]);

  const [selection, setSelection] = useState<GridSelectionState>(() =>
    setActiveCell(createInitialSelectionState(), { row: 0, col: 0 })
  );
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);

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
  const formulaEvaluator = useMemo(
    () => createFormulaEvaluator(rows, columns),
    [columns, rows]
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
  }, [displayRows.length, visibleColumns.length]);

  const setRows = useCallback(
    (nextRows: T[]) => {
      const cloned = cloneRows(nextRows);

      setHistory(
        createInitialHistoryState({
          rows: cloned,
          columns: cloneColumns(rawColumns),
          cellMeta: {},
          rowMeta: {},
        })
      );

      lastEmittedRowsRef.current = cloned;
      props.onRowsChange?.(cloned);
    },
    [props, rawColumns]
  );

  const setColumns = useCallback(
    (nextColumns: GridColumnDef<T>[]) => {
      const cloned = cloneColumns(nextColumns);

      setHistory(
        createInitialHistoryState({
          rows: cloneRows(rows),
          columns: cloned,
          cellMeta: history.present.cellMeta,
          rowMeta: history.present.rowMeta,
        })
      );

      lastEmittedColumnsRef.current = cloned;
      props.onColumnsChange?.(cloned);
    },
    [history.present.cellMeta, history.present.rowMeta, props, rows]
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
            columns: cloneColumns(prev.present.columns as GridColumnDef<T>[]),
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

  const updateColumns = useCallback(
    (nextColumns: GridColumnDef<T>[]) => {
      const cloned = cloneColumns(nextColumns);
      if (shallowEqualColumns(cloned, rawColumns)) return;

      setHistory((prev) =>
        historyReducer(prev, {
          type: "PUSH",
          payload: {
            rows: cloneRows(prev.present.rows as T[]),
            columns: cloned,
            cellMeta: prev.present.cellMeta,
            rowMeta: prev.present.rowMeta,
          },
        })
      );

      lastEmittedColumnsRef.current = cloned;
      props.onColumnsChange?.(cloned);
    },
    [props, rawColumns]
  );

  const insertRow = useCallback(
    (sourceRowIndex: number, position: GridRowInsertPosition) => {
      if (mode === "readonly" || !enableInsertRow) return null;

      const insertAt = getInsertRowIndex(sourceRowIndex, rows.length, position);
      const referenceRow = rows[Math.max(0, Math.min(sourceRowIndex, rows.length - 1))] ?? null;
      const nextRow =
        props.createRowOnInsert?.({
          rows,
          columns,
          insertAt,
          position,
          referenceRow,
        }) ?? createDefaultInsertedRow(rows, columns);

      const nextRows = insertRowAt(rows, insertAt, nextRow);

      setHistory((prev) =>
        historyReducer(prev, {
          type: "PUSH",
          payload: {
            rows: nextRows,
            columns: cloneColumns(prev.present.columns as GridColumnDef<T>[]),
            cellMeta: shiftCellMetaForInsertedRow(prev.present.cellMeta, insertAt),
            rowMeta: shiftRowMetaForInsertedRow(prev.present.rowMeta, insertAt),
          },
        })
      );

      lastEmittedRowsRef.current = nextRows;
      props.onRowsChange?.(nextRows);
      props.onRowInsert?.({
        rowIndex: insertAt,
        row: nextRow,
      });

      const nextDisplayRowIndexes = getDisplayRowIndexes(nextRows, columns, filters, sort, {
        enableFiltering,
        enableSorting,
      });
      const insertedDisplayRowIndex = nextDisplayRowIndexes.findIndex(
        (rowIndex) => rowIndex === insertAt
      );

      if (insertedDisplayRowIndex >= 0) {
        setSelection((prev) =>
          setActiveCell(prev, {
            row: insertedDisplayRowIndex,
            col: Math.min(prev.cursor?.col ?? 0, Math.max(visibleColumns.length - 1, 0)),
          })
        );
      }

      return nextRow;
    },
    [
      columns,
      enableFiltering,
      enableInsertRow,
      enableSorting,
      filters,
      mode,
      props,
      rows,
      sort,
      visibleColumns.length,
    ]
  );

  const insertColumn = useCallback(
    (columnKey: string, position: GridColumnInsertPosition) => {
      if (mode === "readonly" || !enableInsertColumn) return null;

      const sourceColumnIndex = rawColumns.findIndex((column) => column.key === columnKey);
      if (sourceColumnIndex < 0) return null;

      const insertAt = getInsertColumnIndex(sourceColumnIndex, rawColumns.length, position);
      const referenceColumn = rawColumns[sourceColumnIndex] ?? null;
      const nextColumn =
        props.createColumnOnInsert?.({
          columns: cloneColumns(rawColumns),
          insertAt,
          position,
          referenceColumn,
        }) ?? createDefaultInsertedColumn(rawColumns, insertAt, referenceColumn, position);

      const nextColumns = insertColumnAtIndex(rawColumns, insertAt, nextColumn);
      const nextRows = insertColumnValueIntoRows(rows, nextColumn);

      setHistory((prev) =>
        historyReducer(prev, {
          type: "PUSH",
          payload: {
            rows: nextRows,
            columns: nextColumns,
            cellMeta: prev.present.cellMeta,
            rowMeta: prev.present.rowMeta,
          },
        })
      );

      lastEmittedRowsRef.current = nextRows;
      lastEmittedColumnsRef.current = nextColumns;
      props.onRowsChange?.(nextRows);
      props.onColumnsChange?.(nextColumns);
      props.onColumnInsert?.({
        columnIndex: insertAt,
        column: nextColumn,
        position,
      });

      const nextResolvedColumns = resolveColumns(nextColumns).map((column) => ({
        ...column,
        hidden: hiddenColumnKeys.has(column.key),
      }));
      const nextVisibleColumns = getVisibleColumns(nextResolvedColumns);
      const insertedVisibleColumnIndex = nextVisibleColumns.findIndex(
        (column) => column.key === nextColumn.key
      );
      const nextDisplayRowCount = getDisplayRowIndexes(nextRows, nextResolvedColumns, filters, sort, {
        enableFiltering,
        enableSorting,
      }).length;

      if (insertedVisibleColumnIndex >= 0) {
        setSelection((prev) =>
          setActiveCell(prev, {
            row: Math.min(prev.cursor?.row ?? 0, Math.max(nextDisplayRowCount - 1, 0)),
            col: insertedVisibleColumnIndex,
          })
        );
      }

      return nextColumn;
    },
    [
      enableFiltering,
      enableInsertColumn,
      enableSorting,
      filters,
      hiddenColumnKeys,
      mode,
      props,
      rawColumns,
      rows,
      sort,
    ]
  );

  const emitCellChange = useCallback(
    (event: GridCellChangeEvent<T>) => {
      props.onCellChange?.(event);
    },
    [props]
  );

  const focusViewport = useCallback(() => {
    viewportRef.current?.focus({ preventScroll: true });
  }, []);

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

    viewportRef,
    focusViewport,

    rows,
    setRows,

    rawColumns,
    setColumns,

    columns,
    visibleColumns,
    displayRowIndexes,
    hiddenColumnKeys,
    formulaEvaluator,

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
    enableInsertColumn,
    enableDeleteRow,

    updateRows,
    updateColumns,
    insertRow,
    insertColumn,
    emitCellChange,
  };
}
