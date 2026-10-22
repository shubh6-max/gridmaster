import {
  useCallback,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  GridCellChangeEvent,
  GridColorFilters,
  GridColorSort,
  GridClipboardData,
  GridColumnDef,
  GridColumnInsertPosition,
  GridConditionalFormats,
  GridFilters,
  GridHistoryState,
  GridMasterProps,
  GridResolvedColumnDef,
  GridRow,
  GridRowInsertPosition,
  GridSelectionState,
  GridSnapshot,
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
  DEFAULT_ENABLE_DELETE_COLUMN,
  DEFAULT_ENABLE_ROW_DRAG,
  DEFAULT_ENABLE_COLUMN_DRAG,
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
import { clearColorFilters } from "../../core/features/colorFiltering";
import { clearConditionalFormats } from "../../core/features/conditionalFormatting";
import { clearFillState, type GridFillState } from "../../core/features/fill";
import { createFormulaEvaluator, type GridFormulaEvaluator } from "../../core/features/formulas";
import {
  createDefaultInsertedColumn,
  createDefaultInsertedRow,
  deleteCellMetaForColumn,
  deleteColumnAtIndex,
  deleteColumnValueFromRows,
  getInsertColumnIndex,
  getInsertRowIndex,
  insertColumnAtIndex,
  insertColumnValueIntoRows,
  rewriteFormulaCellsInRows,
  shiftCellMetaForDeletedRow,
  shiftCellMetaForInsertedRow,
  shiftCellMetaForMovedRow,
  shiftRowMetaForDeletedRow,
  shiftRowMetaForInsertedRow,
  shiftRowMetaForMovedRow,
} from "../../core/features/structure";
import {
  createInitialColumnWidths,
  getVisibleColumns,
  syncWidthMapWithColumns,
  type GridColumnWidths,
} from "../../core/features/sizing";
import { deleteRowAt, insertRowAt } from "../../core/features/editing";
import {
  moveColumn as moveColumnHelper,
  moveRow as moveRowHelper,
} from "../../core/features/dragDrop";
import {
  canRedo,
  canUndo,
  createInitialHistoryState,
  historyReducer,
  redoHistory,
  undoHistory,
} from "../../core/state/historyReducer";
import { getDisplayRowIndexes, getDisplayRows } from "../../core/state/gridState";
import {
  clearSelection,
  createInitialSelectionState,
  setActiveCell,
} from "../../core/state/selectionState";
import {
  applyLatestColumnFunctions,
  clamp,
  cloneCellMetaMap,
  cloneColumns,
  cloneRowMetaMap,
  cloneRows,
  resolveColumns,
  resolveGridRowId,
  sameColumnStructure,
  shallowEqualColumns,
  shallowEqualRows,
} from "../../core/utils";
import { getGridPropRowSyncAction } from "./gridPropSyncPolicy";

export type UseGridMasterResult<T extends object = GridRow> = {
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

  colorFilters: GridColorFilters;
  setColorFilters: React.Dispatch<React.SetStateAction<GridColorFilters>>;

  colorSort: GridColorSort;
  setColorSort: React.Dispatch<React.SetStateAction<GridColorSort>>;

  conditionalFormats: GridConditionalFormats;
  setConditionalFormats: React.Dispatch<React.SetStateAction<GridConditionalFormats>>;

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
  enableDeleteColumn: boolean;
  enableValidation: boolean;
  enableConditionalFormatting: boolean;
  enableRowDrag: boolean;
  enableColumnDrag: boolean;
  /** False in `mode="readonly"`: no formatting may write cell meta (see useCellFormatting). */
  canFormat: boolean;

  moveRow: (fromIndex: number, toIndex: number) => void;
  moveColumn: (fromKey: string, toKey: string) => void;

  updateRows: (nextRows: T[]) => void;
  updateColumns: (nextColumns: GridColumnDef<T>[]) => void;
  insertRow: (sourceRowIndex: number, position: GridRowInsertPosition) => T | null;
  insertColumn: (columnKey: string, position: GridColumnInsertPosition) => GridColumnDef<T> | null;
  deleteRow: (sourceRowIndex: number) => T | null;
  deleteColumn: (columnKey: string) => GridColumnDef<T> | null;
  emitCellChange: (event: GridCellChangeEvent<T>) => void;
  /**
   * Steps history back/forward and, for a controlled host, emits `onRowsChange` /
   * `onColumnsChange` once with the reverted data. Returns false (no change, no emit) when there
   * is nothing to step to or the grid's restriction flags forbid it.
   */
  undo: () => boolean;
  redo: () => boolean;
};

export function useGridMaster<T extends object = GridRow>(
  incomingProps: GridMasterProps<T>
): UseGridMasterResult<T> {
  const props = incomingProps;
  // Latest props for event handlers and change-callback effects, so their identity never matters.
  // Written in an insertion effect (not during render): a render React discards (concurrent
  // rendering, Suspense) must not leak never-committed props into handlers, and unlike a layout
  // effect it does not warn on the server and runs before any child layout effect.
  const propsRef = useRef(props);
  useInsertionEffect(() => {
    propsRef.current = props;
  });
  const viewportRef = useRef<HTMLDivElement>(null);

  const mode = props.mode ?? DEFAULT_GRID_MODE;
  const height = props.height ?? DEFAULT_GRID_HEIGHT;
  const width = props.width ?? DEFAULT_GRID_WIDTH;
  const rowHeight = props.rowHeight ?? DEFAULT_ROW_HEIGHT;
  const headerHeight = props.headerHeight ?? DEFAULT_HEADER_HEIGHT;

  const showFormulaBar = props.showFormulaBar ?? DEFAULT_SHOW_FORMULA_BAR;
  const showStatusBar = props.showStatusBar ?? DEFAULT_SHOW_STATUS_BAR;

  // A-004: ONE place resolves every gating flag from props + mode. Every consumer (context, hooks,
  // views) reads these, and the shared write sinks below enforce them, so no UI path can bypass a
  // restriction. Defaults are unchanged; only an explicit `false` (or readonly mode) restricts.
  const isReadonly = mode === "readonly";
  const enableSelection = props.enableSelection ?? DEFAULT_ENABLE_SELECTION;
  // The master switch folds into each kind: false keeps only the active-cell cursor.
  const enableRangeSelection =
    enableSelection && (props.enableRangeSelection ?? DEFAULT_ENABLE_RANGE_SELECTION);
  const enableRowSelection =
    enableSelection && (props.enableRowSelection ?? DEFAULT_ENABLE_ROW_SELECTION);
  const enableColumnSelection =
    enableSelection && (props.enableColumnSelection ?? DEFAULT_ENABLE_COLUMN_SELECTION);
  // Cell VALUE writes (edit, paste, cut, clear, fill, checkbox toggle).
  const enableEditing = !isReadonly && (props.enableEditing ?? DEFAULT_ENABLE_EDITING);
  const enableClipboard = props.enableClipboard ?? DEFAULT_ENABLE_CLIPBOARD;
  const enableFillHandle = enableEditing && (props.enableFillHandle ?? DEFAULT_ENABLE_FILL_HANDLE);
  const enableUndoRedo = !isReadonly && (props.enableUndoRedo ?? DEFAULT_ENABLE_UNDO_REDO);
  const enableSorting = props.enableSorting ?? DEFAULT_ENABLE_SORTING;
  const enableFiltering = props.enableFiltering ?? DEFAULT_ENABLE_FILTERING;
  const enableColumnResize = props.enableColumnResize ?? DEFAULT_ENABLE_COLUMN_RESIZE;
  const enableColumnAutoFit = props.enableColumnAutoFit ?? DEFAULT_ENABLE_COLUMN_AUTOFIT;
  const enableColumnVisibility = props.enableColumnVisibility ?? DEFAULT_ENABLE_COLUMN_VISIBILITY;
  // Cell META writes: readonly blocks all formatting; the two props narrow it further.
  const canFormat = !isReadonly;
  const enableCellColoring = canFormat && (props.enableCellColoring ?? DEFAULT_ENABLE_CELL_COLORING);
  const enableWrapText = canFormat && (props.enableWrapText ?? DEFAULT_ENABLE_WRAP_TEXT);
  const enableInsertRow = !isReadonly && (props.enableInsertRow ?? DEFAULT_ENABLE_INSERT_ROW);
  const enableInsertColumn =
    !isReadonly && (props.enableInsertColumn ?? DEFAULT_ENABLE_INSERT_COLUMN);
  const enableDeleteRow = !isReadonly && (props.enableDeleteRow ?? DEFAULT_ENABLE_DELETE_ROW);
  const enableDeleteColumn =
    !isReadonly && (props.enableDeleteColumn ?? DEFAULT_ENABLE_DELETE_COLUMN);
  // Validators always ran before this prop was wired, so the default stays on.
  const enableValidation = props.enableValidation ?? true;
  const enableConditionalFormatting = props.enableConditionalFormatting ?? false;
  const enableRowDrag = props.enableRowDrag ?? DEFAULT_ENABLE_ROW_DRAG;
  const enableColumnDrag = props.enableColumnDrag ?? DEFAULT_ENABLE_COLUMN_DRAG;
  const rowPatchMode = props.rowPatchMode ?? false;
  const historyLimit = props.historyLimit;

  const cloneGridRows = useCallback(
    (sourceRows: readonly T[]) => (rowPatchMode ? [...sourceRows] : cloneRows(sourceRows)),
    [rowPatchMode]
  );
  const historyCloneOptions = useMemo(
    () => ({
      preserveRowReferences: rowPatchMode,
      historyLimit,
    }),
    [historyLimit, rowPatchMode]
  );

  const lastPropRowsRef = useRef(props.rows);
  // A-074: lazy initialisers. `useRef(expr)` evaluates `expr` on EVERY render even though only the
  // first result is kept, so an eager `useRef(cloneRows(props.rows))` deep-cloned the whole dataset
  // on every selection/hover/keystroke render. Clone once, on first render.
  const lastPropRowsValueRef = useRef<T[] | null>(null);
  if (lastPropRowsValueRef.current === null) {
    lastPropRowsValueRef.current = cloneGridRows(props.rows ?? []);
  }
  const lastPropColumnsRef = useRef(props.columns);
  const lastPropColumnsValueRef = useRef<GridColumnDef<T>[] | null>(null);
  if (lastPropColumnsValueRef.current === null) {
    lastPropColumnsValueRef.current = cloneColumns(props.columns ?? []);
  }
  const lastEmittedRowsRef = useRef<T[] | null>(null);
  const lastEmittedColumnsRef = useRef<GridColumnDef<T>[] | null>(null);

  const [history, setHistory] = useState<GridHistoryState<T>>(() =>
    createInitialHistoryState(
      {
        rows: cloneGridRows(props.rows ?? []),
        columns: cloneColumns(props.columns ?? []),
        cellMeta: cloneCellMetaMap(props.initialCellMeta ?? {}),
        rowMeta: cloneRowMetaMap(props.initialRowMeta ?? {}),
      },
      historyCloneOptions
    )
  );

  // Latest committed history, readable from event handlers without a stale closure (the same
  // reason as `propsRef`). `stepHistory` also writes it so two steps in one tick chain correctly.
  const historyRef = useRef(history);
  useInsertionEffect(() => {
    historyRef.current = history;
  });

  const rows = history.present.rows as T[];
  const rawColumns = history.present.columns as GridColumnDef<T>[];
  // A-003: history owns column STRUCTURE; the consumer's latest function-valued fields (renderCell,
  // getValue, ...) are overlaid here instead of being written into history, so an inline
  // `columns={[{ renderCell: p => ... }]}` refreshes behaviour without resetting undo or user state.
  const latestPropColumnsByKey = useMemo(
    () => new Map((props.columns ?? []).map((column) => [column.key, column])),
    [props.columns]
  );
  const resolvedColumns = useMemo(
    () =>
      resolveColumns(rawColumns).map((column) =>
        applyLatestColumnFunctions(column, latestPropColumnsByKey.get(column.key))
      ),
    [rawColumns, latestPropColumnsByKey]
  );

  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<Set<string>>(
    () => new Set(resolvedColumns.filter((column) => column.hidden).map((column) => column.key))
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

      // Same members: keep the old Set so a behaviour-only column refresh causes no extra render.
      if (next.size === prev.size && [...next].every((key) => prev.has(key))) return prev;

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
    const nextRows = cloneGridRows(props.rows ?? []);
    const syncAction = getGridPropRowSyncAction({
      nextRows,
      // Non-null: lazily seeded during the first render, only ever reassigned to arrays after.
      previousPropRows: lastPropRowsValueRef.current ?? [],
      lastEmittedRows: lastEmittedRowsRef.current,
      currentRows: history.present.rows as T[],
      rowsEqual: shallowEqualRows,
    });

    if (syncAction === "ignore") {
      return;
    }

    lastPropRowsValueRef.current = nextRows;

    if (syncAction === "consume-emitted") {
      lastEmittedRowsRef.current = null;
      return;
    }

    setPreservedFilteredRowIds(null);

    setHistory((prev) =>
      createInitialHistoryState(
        {
          rows: nextRows,
          columns: cloneColumns(prev.present.columns as GridColumnDef<T>[]),
          // A genuine rows replacement re-seeds meta from the latest `initial*` props (read via the
          // ref: `initialCellMeta`/`initialRowMeta` are mount/rows-replacement seeds, never triggers).
          cellMeta: cloneCellMetaMap(
            propsRef.current.initialCellMeta ?? prev.present.cellMeta ?? {}
          ),
          rowMeta: cloneRowMetaMap(propsRef.current.initialRowMeta ?? prev.present.rowMeta ?? {}),
        },
        historyCloneOptions
      )
    );
  }, [cloneGridRows, history.present.rows, historyCloneOptions, props.rows]);

  useEffect(() => {
    if (props.columns === lastPropColumnsRef.current) return;

    lastPropColumnsRef.current = props.columns;
    const nextColumns = cloneColumns(props.columns ?? []);

    // Structure only: fresh inline closures / arrays with the same shape are not a change (A-003).
    if (sameColumnStructure(nextColumns, lastPropColumnsValueRef.current ?? [])) {
      return;
    }

    lastPropColumnsValueRef.current = nextColumns;

    if (
      (lastEmittedColumnsRef.current &&
        sameColumnStructure(nextColumns, lastEmittedColumnsRef.current)) ||
      sameColumnStructure(nextColumns, history.present.columns as GridColumnDef<T>[])
    ) {
      lastEmittedColumnsRef.current = null;
      return;
    }

    setHistory((prev) =>
      createInitialHistoryState(
        {
          rows: cloneGridRows(prev.present.rows as T[]),
          columns: nextColumns,
          cellMeta: prev.present.cellMeta ?? {},
          rowMeta: prev.present.rowMeta ?? {},
        },
        historyCloneOptions
      )
    );
  }, [cloneGridRows, history.present.columns, historyCloneOptions, props.columns]);

  const [selection, setSelection] = useState<GridSelectionState>(() =>
    setActiveCell(createInitialSelectionState(), { row: 0, col: 0 })
  );
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);

  const [sort, setSort] = useState<GridSort>(EMPTY_SORT);
  const [filters, setFiltersState] = useState<GridFilters>(
    () => props.initialFilters ?? EMPTY_FILTERS
  );
  const [colorFilters, setColorFiltersState] = useState<GridColorFilters>(
    () => props.initialColorFilters ?? clearColorFilters()
  );
  const [colorSort, setColorSort] = useState<GridColorSort>(() => props.initialColorSort ?? null);
  const [conditionalFormats, setConditionalFormats] = useState(
    () => props.initialConditionalFormats ?? clearConditionalFormats()
  );
  const [clipboard, setClipboard] = useState(EMPTY_CLIPBOARD);
  const [fill, setFill] = useState<GridFillState>(clearFillState());
  const [columnWidths, setColumnWidths] = useState<GridColumnWidths>(() =>
    createInitialColumnWidths(columns)
  );
  const [frozenColumns, setFrozenColumns] = useState<number>(
    props.frozenColumns ?? DEFAULT_FROZEN_COLUMNS
  );
  const [preservedFilteredRowIds, setPreservedFilteredRowIds] = useState<string[] | null>(null);

  useEffect(() => {
    setColumnWidths((prev) => syncWidthMapWithColumns(prev, columns));
  }, [columns]);

  useEffect(() => {
    setFrozenColumns(props.frozenColumns ?? DEFAULT_FROZEN_COLUMNS);
  }, [props.frozenColumns]);

  const setFilters = useCallback<React.Dispatch<React.SetStateAction<GridFilters>>>((next) => {
    setPreservedFilteredRowIds(null);
    setFiltersState(next);
  }, []);

  const setColorFilters = useCallback<React.Dispatch<React.SetStateAction<GridColorFilters>>>(
    (next) => {
      setPreservedFilteredRowIds(null);
      setColorFiltersState(next);
    },
    []
  );

  const computeDisplayRowIndexes = useCallback(
    (
      sourceRows: T[],
      sourceColumns: GridResolvedColumnDef<T>[] = columns,
      sourceFilters: GridFilters = filters,
      sourceSort: GridSort = sort,
      sourceColorFilters: GridColorFilters = colorFilters,
      sourceColorSort: GridColorSort = colorSort,
      overrides?: {
        enableFiltering?: boolean;
        enableSorting?: boolean;
        allowedRowIds?: Iterable<string> | null;
        preservedRowIds?: Iterable<string> | null;
        evaluator?: GridFormulaEvaluator<T>;
      }
    ) =>
      getDisplayRowIndexes(
        sourceRows,
        sourceColumns,
        sourceFilters,
        sourceSort,
        sourceColorFilters,
        sourceColorSort,
        {
          allowedRowIds:
            overrides?.allowedRowIds !== undefined ? overrides.allowedRowIds : props.allowedRowIds,
          enableFiltering: overrides?.enableFiltering ?? enableFiltering,
          enableSorting: overrides?.enableSorting ?? enableSorting,
          preservedRowIds:
            overrides?.preservedRowIds !== undefined
              ? overrides.preservedRowIds
              : preservedFilteredRowIds,
          getRowId: props.getRowId,
          evaluator: overrides?.evaluator,
        }
      ),
    [
      columns,
      colorFilters,
      colorSort,
      enableFiltering,
      enableSorting,
      filters,
      preservedFilteredRowIds,
      props.allowedRowIds,
      props.getRowId,
      sort,
    ]
  );

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

  // One evaluator per (rows, columns) snapshot, shared by the pipeline AND render (A-066/A-040):
  // filter/sort evaluations populate the same formula cache the cells read, so nothing is evaluated
  // twice. Built before the pipeline so it can be injected into it.
  const formulaEvaluator = useMemo(() => createFormulaEvaluator(rows, columns), [columns, rows]);
  const displayRowIndexes = useMemo(
    () =>
      computeDisplayRowIndexes(rows, undefined, undefined, undefined, undefined, undefined, {
        evaluator: formulaEvaluator,
      }),
    [computeDisplayRowIndexes, formulaEvaluator, rows]
  );
  const displayRows = useMemo(
    () => getDisplayRows(rows, displayRowIndexes),
    [rows, displayRowIndexes]
  );

  useEffect(() => {
    propsRef.current.onSnapshotChange?.(history.present as GridSnapshot<T>);
  }, [history.present]);

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
      const cloned = cloneGridRows(nextRows);
      setPreservedFilteredRowIds(null);

      setHistory(
        createInitialHistoryState(
          {
            rows: cloned,
            columns: cloneColumns(rawColumns),
            cellMeta: {},
            rowMeta: {},
          },
          historyCloneOptions
        )
      );

      lastEmittedRowsRef.current = cloned;
      propsRef.current.onRowsChange?.(cloned);
    },
    [cloneGridRows, historyCloneOptions, rawColumns]
  );

  const setColumns = useCallback(
    (nextColumns: GridColumnDef<T>[]) => {
      const cloned = cloneColumns(nextColumns);

      setHistory(
        createInitialHistoryState(
          {
            rows: cloneGridRows(rows),
            columns: cloned,
            cellMeta: history.present.cellMeta,
            rowMeta: history.present.rowMeta,
          },
          historyCloneOptions
        )
      );

      lastEmittedColumnsRef.current = cloned;
      propsRef.current.onColumnsChange?.(cloned);
    },
    [
      cloneGridRows,
      history.present.cellMeta,
      history.present.rowMeta,
      historyCloneOptions,
      rows,
    ]
  );

  const updateRows = useCallback(
    (nextRows: T[]) => {
      // Shared sink for every cell-value write (editor, clipboard, fill, checkbox): one guard.
      if (!enableEditing) return;

      // `nextRows` is the copy-on-write result of a cell write: a fresh array that shares every
      // UNCHANGED row object with the current snapshot (only edited rows are new). A-047: store it
      // in history BY REFERENCE (structural sharing) so retained memory is O(edits), not
      // O(edits × rows) — no per-edit deep clone of the whole dataset. `shallowEqualRows`
      // short-circuits on `===` for the shared rows, so the no-op check stays cheap.
      if (shallowEqualRows(nextRows, rows)) return;

      if (enableFiltering && Object.keys(filters).length > 0) {
        setPreservedFilteredRowIds(
          displayRowIndexes.map((sourceRowIndex) =>
            resolveGridRowId(rows[sourceRowIndex], sourceRowIndex, propsRef.current.getRowId)
          )
        );
      } else {
        setPreservedFilteredRowIds(null);
      }

      setHistory((prev) =>
        historyReducer(
          prev,
          {
            type: "PUSH",
            payload: {
              rows: nextRows,
              columns: cloneColumns(prev.present.columns as GridColumnDef<T>[]),
              cellMeta: prev.present.cellMeta,
              rowMeta: prev.present.rowMeta,
            },
          },
          // Force structural sharing of rows regardless of `rowPatchMode`: history never mutates its
          // snapshots and the consumer gets its own copy below, so sharing is always safe here.
          { ...historyCloneOptions, preserveRowReferences: true }
        )
      );

      // Trust boundary (unchanged contract): the consumer gets a DEFENSIVE copy, distinct from the
      // array stored in history, so mutating an emitted row cannot corrupt an undo snapshot.
      // `cloneGridRows` honours `rowPatchMode` exactly as before (deep copy by default; shallow when
      // the host opted into in-place mutation).
      const emitted = cloneGridRows(nextRows);
      lastEmittedRowsRef.current = emitted;
      propsRef.current.onRowsChange?.(emitted);
    },
    [
      cloneGridRows,
      displayRowIndexes,
      enableEditing,
      enableFiltering,
      filters,
      historyCloneOptions,
      rows,
    ]
  );

  const updateColumns = useCallback(
    (nextColumns: GridColumnDef<T>[]) => {
      if (isReadonly) return;

      const cloned = cloneColumns(nextColumns);
      if (shallowEqualColumns(cloned, rawColumns)) return;

      setHistory((prev) =>
        historyReducer(
          prev,
          {
            type: "PUSH",
            payload: {
              rows: cloneGridRows(prev.present.rows as T[]),
              columns: cloned,
              cellMeta: prev.present.cellMeta,
              rowMeta: prev.present.rowMeta,
            },
          },
          historyCloneOptions
        )
      );

      lastEmittedColumnsRef.current = cloned;
      propsRef.current.onColumnsChange?.(cloned);
    },
    [cloneGridRows, historyCloneOptions, isReadonly, rawColumns]
  );

  const handleMoveRow = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (isReadonly || !enableRowDrag) return;
      if (fromIndex === toIndex) return;
      // Out-of-range indexes would splice an `undefined` row into the data.
      if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= rows.length) return;
      if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= rows.length) return;

      // A-007: formula references retarget to the moved line (and shift the lines between), in the
      // same history push so one undo restores values and formulas together.
      const nextRows = rewriteFormulaCellsInRows(moveRowHelper(rows, fromIndex, toIndex), columns, {
        type: "move-row",
        from: fromIndex,
        to: toIndex,
      });

      setHistory((prev) =>
        historyReducer(
          prev,
          {
            type: "PUSH",
            payload: {
              rows: nextRows,
              columns: cloneColumns(prev.present.columns as GridColumnDef<T>[]),
              // Meta is keyed by row index: it must travel with the row (A-038).
              cellMeta: shiftCellMetaForMovedRow(prev.present.cellMeta, fromIndex, toIndex),
              rowMeta: shiftRowMetaForMovedRow(prev.present.rowMeta, fromIndex, toIndex),
            },
          },
          historyCloneOptions
        )
      );

      lastEmittedRowsRef.current = nextRows;
      propsRef.current.onRowsChange?.(nextRows);
      propsRef.current.onRowReorder?.(nextRows);
    },
    [columns, enableRowDrag, historyCloneOptions, isReadonly, rows]
  );

  const handleMoveColumn = useCallback(
    (fromKey: string, toKey: string) => {
      if (isReadonly || !enableColumnDrag) return;
      if (fromKey === toKey) return;

      const nextColumns = moveColumnHelper(rawColumns, fromKey, toKey);

      // A-007: formula references retarget across the column move, in the same push.
      const fromIndex = rawColumns.findIndex((column) => column.key === fromKey);
      const toIndex = rawColumns.findIndex((column) => column.key === toKey);
      const nextRows =
        fromIndex >= 0 && toIndex >= 0
          ? rewriteFormulaCellsInRows(rows, columns, {
              type: "move-column",
              from: fromIndex,
              to: toIndex,
            })
          : rows;
      const rowsChanged = nextRows !== rows;

      setHistory((prev) =>
        historyReducer(
          prev,
          {
            type: "PUSH",
            payload: {
              rows: cloneGridRows(nextRows),
              columns: nextColumns,
              cellMeta: prev.present.cellMeta,
              rowMeta: prev.present.rowMeta,
            },
          },
          historyCloneOptions
        )
      );

      if (rowsChanged) {
        lastEmittedRowsRef.current = nextRows;
        propsRef.current.onRowsChange?.(nextRows);
      }
      lastEmittedColumnsRef.current = nextColumns;
      propsRef.current.onColumnsChange?.(nextColumns);
      propsRef.current.onColumnReorder?.(nextColumns);
    },
    [columns, enableColumnDrag, historyCloneOptions, isReadonly, rawColumns, rows]
  );

  const insertRow = useCallback(
    (sourceRowIndex: number, position: GridRowInsertPosition) => {
      if (mode === "readonly" || !enableInsertRow) return null;

      const insertAt = getInsertRowIndex(sourceRowIndex, rows.length, position);
      const referenceRow = rows[Math.max(0, Math.min(sourceRowIndex, rows.length - 1))] ?? null;
      const nextRow =
        propsRef.current.createRowOnInsert?.({
          rows,
          columns,
          insertAt,
          position,
          referenceRow,
        }) ?? createDefaultInsertedRow(rows, columns);

      // A-007: references at/after the insert point shift down, in the same history push.
      const nextRows = rewriteFormulaCellsInRows(insertRowAt(rows, insertAt, nextRow), columns, {
        type: "insert-rows",
        at: insertAt,
        count: 1,
      });

      // A-050: a blank new row matches no active filter and would vanish. Keep every currently
      // shown row plus the new one visible, as updateRows does. Ids are resolved on the NEW rows
      // (old source indexes shift by one past `insertAt`) so index-derived ids stay correct.
      const filterActive =
        enableFiltering && (Object.keys(filters).length > 0 || Object.keys(colorFilters).length > 0);
      const nextPreservedIds = filterActive
        ? [...displayRowIndexes.map((index) => (index >= insertAt ? index + 1 : index)), insertAt].map(
            (index) => resolveGridRowId(nextRows[index], index, propsRef.current.getRowId)
          )
        : null;
      setPreservedFilteredRowIds(nextPreservedIds);

      setHistory((prev) =>
        historyReducer(
          prev,
          {
            type: "PUSH",
            payload: {
              rows: nextRows,
              columns: cloneColumns(prev.present.columns as GridColumnDef<T>[]),
              cellMeta: shiftCellMetaForInsertedRow(prev.present.cellMeta, insertAt),
              rowMeta: shiftRowMetaForInsertedRow(prev.present.rowMeta, insertAt),
            },
          },
          historyCloneOptions
        )
      );

      lastEmittedRowsRef.current = nextRows;
      propsRef.current.onRowsChange?.(nextRows);
      propsRef.current.onRowInsert?.({
        rowIndex: insertAt,
        row: nextRow,
      });

      const nextDisplayRowIndexes = getDisplayRowIndexes(
        nextRows,
        columns,
        filters,
        sort,
        colorFilters,
        colorSort,
        {
          allowedRowIds: propsRef.current.allowedRowIds,
          enableFiltering,
          enableSorting,
          preservedRowIds: nextPreservedIds,
          getRowId: propsRef.current.getRowId,
        }
      );
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
      colorFilters,
      colorSort,
      columns,
      displayRowIndexes,
      enableFiltering,
      enableInsertRow,
      enableSorting,
      filters,
      mode,
      rows,
      sort,
      visibleColumns.length,
      historyCloneOptions,
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
        propsRef.current.createColumnOnInsert?.({
          columns: cloneColumns(rawColumns),
          insertAt,
          position,
          referenceColumn,
        }) ?? createDefaultInsertedColumn(rawColumns, insertAt, referenceColumn, position);

      const nextColumns = insertColumnAtIndex(rawColumns, insertAt, nextColumn);
      // A-007: references at/after the inserted column shift right — same history push.
      const nextRows = rewriteFormulaCellsInRows(
        insertColumnValueIntoRows(rows, nextColumn),
        columns,
        { type: "insert-columns", at: insertAt, count: 1 }
      );

      setHistory((prev) =>
        historyReducer(
          prev,
          {
            type: "PUSH",
            payload: {
              rows: nextRows,
              columns: nextColumns,
              cellMeta: prev.present.cellMeta,
              rowMeta: prev.present.rowMeta,
            },
          },
          historyCloneOptions
        )
      );

      lastEmittedRowsRef.current = nextRows;
      lastEmittedColumnsRef.current = nextColumns;
      propsRef.current.onRowsChange?.(nextRows);
      propsRef.current.onColumnsChange?.(nextColumns);
      propsRef.current.onColumnInsert?.({
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
      const nextDisplayRowCount = getDisplayRowIndexes(
        nextRows,
        nextResolvedColumns,
        filters,
        sort,
        colorFilters,
        colorSort,
        {
          allowedRowIds: propsRef.current.allowedRowIds,
          enableFiltering,
          enableSorting,
          preservedRowIds: preservedFilteredRowIds,
          getRowId: propsRef.current.getRowId,
        }
      ).length;

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
      colorFilters,
      colorSort,
      columns,
      enableFiltering,
      enableInsertColumn,
      enableSorting,
      filters,
      hiddenColumnKeys,
      mode,
      rawColumns,
      rows,
      sort,
      historyCloneOptions,
    ]
  );

  const deleteRow = useCallback(
    (sourceRowIndex: number) => {
      if (mode === "readonly" || !enableDeleteRow) return null;
      if (sourceRowIndex < 0 || sourceRowIndex >= rows.length) return null;

      const deletedRow = rows[sourceRowIndex];
      // A-007: references to the deleted row become #REF!; those after it shift up — same push.
      const nextRows = rewriteFormulaCellsInRows(deleteRowAt(rows, sourceRowIndex), columns, {
        type: "delete-rows",
        at: sourceRowIndex,
        count: 1,
      });

      setHistory((prev) =>
        historyReducer(
          prev,
          {
            type: "PUSH",
            payload: {
              rows: nextRows,
              columns: cloneColumns(prev.present.columns as GridColumnDef<T>[]),
              cellMeta: shiftCellMetaForDeletedRow(prev.present.cellMeta, sourceRowIndex),
              rowMeta: shiftRowMetaForDeletedRow(prev.present.rowMeta, sourceRowIndex),
            },
          },
          historyCloneOptions
        )
      );

      setEditingCell(null);

      lastEmittedRowsRef.current = nextRows;
      propsRef.current.onRowsChange?.(nextRows);
      propsRef.current.onRowDelete?.({
        rowIndex: sourceRowIndex,
        row: deletedRow,
      });

      const nextDisplayRowIndexes = getDisplayRowIndexes(
        nextRows,
        columns,
        filters,
        sort,
        colorFilters,
        colorSort,
        {
          allowedRowIds: propsRef.current.allowedRowIds,
          enableFiltering,
          enableSorting,
          preservedRowIds: preservedFilteredRowIds,
          getRowId: propsRef.current.getRowId,
        }
      );

      if (!nextDisplayRowIndexes.length || !visibleColumns.length) {
        setSelection(clearSelection());
        return deletedRow;
      }

      const nextSourceRowIndex = Math.min(sourceRowIndex, nextRows.length - 1);
      const nextDisplayRowIndex = nextDisplayRowIndexes.findIndex(
        (rowIndex) => rowIndex === nextSourceRowIndex
      );

      setSelection((prev) =>
        setActiveCell(prev, {
          row:
            nextDisplayRowIndex >= 0
              ? nextDisplayRowIndex
              : Math.min(prev.cursor?.row ?? 0, nextDisplayRowIndexes.length - 1),
          col: Math.min(prev.cursor?.col ?? 0, visibleColumns.length - 1),
        })
      );

      return deletedRow;
    },
    [
      colorFilters,
      colorSort,
      columns,
      enableDeleteRow,
      enableFiltering,
      enableSorting,
      filters,
      mode,
      rows,
      sort,
      visibleColumns.length,
      historyCloneOptions,
    ]
  );

  const deleteColumn = useCallback(
    (columnKey: string) => {
      if (mode === "readonly" || !enableDeleteColumn) return null;

      const sourceColumnIndex = rawColumns.findIndex((column) => column.key === columnKey);
      if (sourceColumnIndex < 0 || rawColumns.length <= 1) return null;

      const deletedColumn = rawColumns[sourceColumnIndex];
      const currentVisibleColumnIndex = visibleColumns.findIndex(
        (column) => column.key === columnKey
      );
      const nextColumns = deleteColumnAtIndex(rawColumns, sourceColumnIndex);
      // Same array back when no row holds the key or the key is the row-id field (A-049).
      const strippedRows = deleteColumnValueFromRows(rows, columnKey, propsRef.current.getRowId);
      // A-007: references to the deleted column become #REF!; those after it shift left. Applied
      // even when the value itself is id-protected, since formulas in OTHER columns still shift.
      const nextRows = rewriteFormulaCellsInRows(strippedRows, columns, {
        type: "delete-columns",
        at: sourceColumnIndex,
        count: 1,
      });
      const rowsChanged = nextRows !== rows;
      const nextSort = sort?.columnKey === columnKey ? null : sort;
      const nextColorSort = colorSort?.columnKey === columnKey ? null : colorSort;
      const nextFilters =
        columnKey in filters
          ? Object.fromEntries(Object.entries(filters).filter(([key]) => key !== columnKey))
          : filters;
      const nextColorFilters =
        columnKey in colorFilters
          ? Object.fromEntries(Object.entries(colorFilters).filter(([key]) => key !== columnKey))
          : colorFilters;

      setHistory((prev) =>
        historyReducer(
          prev,
          {
            type: "PUSH",
            payload: {
              rows: nextRows,
              columns: nextColumns,
              cellMeta: deleteCellMetaForColumn(prev.present.cellMeta, columnKey),
              rowMeta: prev.present.rowMeta,
            },
          },
          historyCloneOptions
        )
      );

      setEditingCell(null);
      if (nextSort !== sort) {
        setSort(nextSort);
      }
      if (nextFilters !== filters) {
        setFilters(nextFilters);
      }
      if (nextColorSort !== colorSort) {
        setColorSort(nextColorSort);
      }
      if (nextColorFilters !== colorFilters) {
        setColorFilters(nextColorFilters);
      }

      if (rowsChanged) {
        lastEmittedRowsRef.current = nextRows;
        propsRef.current.onRowsChange?.(nextRows);
      }
      lastEmittedColumnsRef.current = nextColumns;
      propsRef.current.onColumnsChange?.(nextColumns);
      propsRef.current.onColumnDelete?.({
        columnIndex: sourceColumnIndex,
        column: deletedColumn,
      });

      const nextResolvedColumns = resolveColumns(nextColumns).map((column) => ({
        ...column,
        hidden: hiddenColumnKeys.has(column.key),
      }));
      const nextVisibleColumns = getVisibleColumns(nextResolvedColumns);
      const nextDisplayRowCount = getDisplayRowIndexes(
        nextRows,
        nextResolvedColumns,
        nextFilters,
        nextSort,
        nextColorFilters,
        nextColorSort,
        {
          allowedRowIds: propsRef.current.allowedRowIds,
          enableFiltering,
          enableSorting,
          preservedRowIds: nextFilters === filters ? preservedFilteredRowIds : null,
          getRowId: propsRef.current.getRowId,
        }
      ).length;

      if (!nextVisibleColumns.length || nextDisplayRowCount <= 0) {
        setSelection(clearSelection());
        return deletedColumn;
      }

      const nextVisibleColumnIndex = Math.min(
        currentVisibleColumnIndex < 0 ? 0 : currentVisibleColumnIndex,
        nextVisibleColumns.length - 1
      );

      setSelection((prev) =>
        setActiveCell(prev, {
          row: Math.min(prev.cursor?.row ?? 0, nextDisplayRowCount - 1),
          col: nextVisibleColumnIndex,
        })
      );

      return deletedColumn;
    },
    [
      colorFilters,
      colorSort,
      columns,
      enableDeleteColumn,
      enableFiltering,
      enableSorting,
      filters,
      hiddenColumnKeys,
      mode,
      rawColumns,
      rows,
      sort,
      visibleColumns,
      historyCloneOptions,
    ]
  );

  // A-012: undo/redo are hook-level so a controlled host hears about them. The next history is
  // computed HERE, outside any state updater (updaters must stay pure: StrictMode double-invokes
  // them, which would double-emit), then emitted once, and recorded in `lastEmitted*Ref` so the
  // host echoing it back is recognised as our own emit (no history/meta reset).
  const stepHistory = useCallback(
    (direction: "undo" | "redo") => {
      if (!enableUndoRedo) return false;

      const prev = historyRef.current;
      if (!(direction === "undo" ? canUndo(prev) : canRedo(prev))) return false;

      const next = historyReducer(
        prev,
        direction === "undo" ? undoHistory<T>() : redoHistory<T>(),
        historyCloneOptions
      );
      const prevRows = prev.present.rows as T[];
      const nextRows = next.present.rows as T[];
      const rowsChanged = !shallowEqualRows(prevRows, nextRows);
      const columnsChanged = !shallowEqualColumns(
        prev.present.columns as GridColumnDef<T>[],
        next.present.columns as GridColumnDef<T>[]
      );

      // enableEditing=false forbids cell VALUE writes, and a step that restores other values is one.
      // Formatting/column-only steps stay undoable (their own flags guarded the original change).
      if (!enableEditing && rowsChanged) return false;

      historyRef.current = next;
      setHistory(next);

      // Hosts get their own copy (same trust boundary as every other emit site).
      if (rowsChanged) {
        const emitted = cloneGridRows(nextRows);
        lastEmittedRowsRef.current = emitted;
        propsRef.current.onRowsChange?.(emitted);
      }
      if (columnsChanged) {
        const emitted = cloneColumns(next.present.columns as GridColumnDef<T>[]);
        lastEmittedColumnsRef.current = emitted;
        propsRef.current.onColumnsChange?.(emitted);
      }

      return true;
    },
    [cloneGridRows, enableEditing, enableUndoRedo, historyCloneOptions]
  );
  const undo = useCallback(() => stepHistory("undo"), [stepHistory]);
  const redo = useCallback(() => stepHistory("redo"), [stepHistory]);

  const emitCellChange = useCallback(
    (event: GridCellChangeEvent<T>) => {
      // A restricted grid never reports a cell edit (no value changed, so no event).
      if (!enableEditing) return;
      propsRef.current.onCellChange?.(event);
    },
    [enableEditing]
  );

  const focusViewport = useCallback(() => {
    viewportRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    propsRef.current.onSelectionChange?.({ selection });
  }, [selection]);

  useEffect(() => {
    propsRef.current.onSortChange?.({ sort });
  }, [sort]);

  useEffect(() => {
    propsRef.current.onFilterChange?.({ filters });
  }, [filters]);

  useEffect(() => {
    propsRef.current.onColorFilterChange?.({ colorFilters });
  }, [colorFilters]);

  useEffect(() => {
    propsRef.current.onColorSortChange?.({ colorSort });
  }, [colorSort]);

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

    colorFilters,
    setColorFilters,

    colorSort,
    setColorSort,

    conditionalFormats,
    setConditionalFormats,

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
    enableDeleteColumn,
    enableValidation,
    enableConditionalFormatting,
    enableRowDrag,
    enableColumnDrag,
    canFormat,

    moveRow: handleMoveRow,
    moveColumn: handleMoveColumn,

    updateRows,
    updateColumns,
    insertRow,
    insertColumn,
    deleteRow,
    deleteColumn,
    emitCellChange,
    undo,
    redo,
  };
}
