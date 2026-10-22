import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createFormulaCellReference,
  insertCellReferenceIntoFormula,
} from "../../core/features/formulas";
import { isStrictParseRejection, resolveCellReadonly } from "../../core/features/readonly";
import { deepEqual } from "../../core/equality";
import type {
  GridCellChangeEvent,
  GridCellMeta,
  GridEditCell,
  GridMasterProps,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
} from "../../core/types";
import { getRowValue, isFormulaValue, parseCellValue, setRowValue } from "../../core/utils";

export type GridEditingTarget<T extends object = GridRow> = {
  displayRowIndex: number;
  sourceRowIndex: number;
  columnIndex: number;
  row: T;
  column: GridResolvedColumnDef<T>;
  value: unknown;
  readonly: boolean;
} | null;

type UseEditingParams<T extends object = GridRow> = {
  mode: "editable" | "readonly";
  rows: T[];
  columns: GridResolvedColumnDef<T>[];
  displayRowIndexes: number[];
  visibleColumns: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  editingCell: GridEditCell;
  setEditingCell: React.Dispatch<React.SetStateAction<GridEditCell>>;
  updateRows: (rows: T[]) => void;
  focusViewport: () => void;
  emitCellChange?: (event: GridCellChangeEvent<T>) => void;
  /** Resolved `enableEditing` (false in readonly mode and for `enableEditing={false}`). Defaults to true. */
  enableEditing?: boolean;
  /** For per-cell/row `readonly` meta (A-084) and the `locale` used by strict parsing (item 7). */
  props?: Pick<GridMasterProps<T>, "getRowMeta" | "getCellMeta" | "locale">;
  /** History cell meta, merged with `getCellMeta` for the shared read-only predicate (A-084). */
  cellMetaMap?: Record<string, GridCellMeta>;
};

const EMPTY_CELL_META_MAP: Record<string, GridCellMeta> = {};

function resolveEditingTarget<T extends object>(
  mode: "editable" | "readonly",
  enableEditing: boolean,
  rows: T[],
  displayRowIndexes: number[],
  visibleColumns: GridResolvedColumnDef<T>[],
  cell: GridEditCell,
  props: Pick<GridMasterProps<T>, "getRowMeta" | "getCellMeta">,
  cellMetaMap: Record<string, GridCellMeta>
): GridEditingTarget<T> {
  if (!cell) return null;

  const sourceRowIndex = displayRowIndexes[cell.row] ?? -1;
  const column = visibleColumns[cell.col];
  const row = sourceRowIndex >= 0 ? rows[sourceRowIndex] : undefined;

  if (!column || !row) return null;

  // A-084: cell/row `readonly` meta blocks editing, not just column flags. mode / enableEditing gate
  // the whole grid; the shared predicate adds the per-cell and per-row meta.
  const readonly =
    mode === "readonly" ||
    !enableEditing ||
    resolveCellReadonly(props, cellMetaMap, row, sourceRowIndex, column);

  return {
    displayRowIndex: cell.row,
    sourceRowIndex,
    columnIndex: cell.col,
    row,
    column,
    value: getRowValue(row, column),
    readonly,
  };
}

export function useEditing<T extends object = GridRow>({
  mode,
  rows,
  columns,
  displayRowIndexes,
  visibleColumns,
  selection,
  editingCell,
  setEditingCell,
  updateRows,
  focusViewport,
  emitCellChange,
  enableEditing = true,
  props,
  cellMetaMap,
}: UseEditingParams<T>) {
  const resolvedProps = props ?? {};
  const resolvedCellMetaMap = cellMetaMap ?? EMPTY_CELL_META_MAP;
  const locale = props?.locale;
  const [editingValue, setEditingValue] = useState<unknown>("");
  const [editingOrigin, setEditingOrigin] = useState<"cell" | "formulaBar" | null>(null);
  const [editorAutoSelectOnFocus, setEditorAutoSelectOnFocus] = useState(true);
  const preserveNextSyncRef = useRef(false);
  const shouldFocusViewportAfterEditRef = useRef(false);
  // A-062a: the cell + its underlying value at the moment the session started. The draft is only
  // re-synced from props when the UNDERLYING value genuinely changes (a real data update), never
  // merely because the parent handed down a new `rows` array identity on re-render.
  const sessionCellRef = useRef<GridEditCell>(null);
  const sessionValueRef = useRef<unknown>(undefined);

  const activeTarget = useMemo(
    () =>
      resolveEditingTarget(
        mode,
        enableEditing,
        rows,
        displayRowIndexes,
        visibleColumns,
        editingCell,
        resolvedProps,
        resolvedCellMetaMap
      ),
    [mode, enableEditing, rows, displayRowIndexes, visibleColumns, editingCell, resolvedProps, resolvedCellMetaMap]
  );

  useEffect(() => {
    if (!activeTarget) {
      sessionCellRef.current = null;
      return;
    }

    const sameCell =
      sessionCellRef.current != null &&
      sessionCellRef.current.row === editingCell?.row &&
      sessionCellRef.current.col === editingCell?.col;

    // A typing/initial-value start (or a formula-reference insert) keeps the draft; just record the
    // session so later re-renders know the underlying baseline.
    if (preserveNextSyncRef.current) {
      preserveNextSyncRef.current = false;
      sessionCellRef.current = editingCell;
      sessionValueRef.current = activeTarget.value;
      return;
    }

    // A brand-new session adopts the underlying value.
    if (!sameCell) {
      sessionCellRef.current = editingCell;
      sessionValueRef.current = activeTarget.value;
      setEditingValue(activeTarget.value);
      return;
    }

    // Same cell re-rendered: only overwrite the draft when the underlying value truly changed
    // (A-062a). An unchanged value under a new `rows` identity leaves the user's typing intact.
    if (!deepEqual(activeTarget.value, sessionValueRef.current)) {
      sessionValueRef.current = activeTarget.value;
      setEditingValue(activeTarget.value);
    }
  }, [activeTarget, editingCell]);

  useEffect(() => {
    if (editingCell) return;
    setEditingOrigin(null);
  }, [editingCell]);

  const isFormulaEditing = Boolean(activeTarget) && isFormulaValue(editingValue);

  const requestViewportFocusAfterEdit = useCallback(() => {
    shouldFocusViewportAfterEditRef.current = true;
  }, []);

  const flushViewportFocusAfterEdit = useCallback(() => {
    if (!shouldFocusViewportAfterEditRef.current) return;

    shouldFocusViewportAfterEditRef.current = false;
    window.requestAnimationFrame(() => {
      focusViewport();
    });
  }, [focusViewport]);

  const startEditing = useCallback(
    (cell?: GridEditCell, initialValue?: unknown, origin: "cell" | "formulaBar" = "cell") => {
      const nextCell = cell ?? selection.cursor ?? selection.anchor;
      const target = resolveEditingTarget(
        mode,
        enableEditing,
        rows,
        displayRowIndexes,
        visibleColumns,
        nextCell,
        resolvedProps,
        resolvedCellMetaMap
      );
      if (!nextCell || !target || target.readonly) return false;

      setEditorAutoSelectOnFocus(initialValue === undefined);

      if (initialValue !== undefined) {
        preserveNextSyncRef.current = true;
        setEditingValue(initialValue);
      } else {
        setEditingValue(target.value);
      }

      setEditingCell(nextCell);
      setEditingOrigin(origin);
      return true;
    },
    [
      displayRowIndexes,
      enableEditing,
      mode,
      rows,
      resolvedProps,
      resolvedCellMetaMap,
      selection.anchor,
      selection.cursor,
      setEditingCell,
      visibleColumns,
    ]
  );

  const insertFormulaReference = useCallback(
    (displayRowIndex: number, visibleColumnIndex: number) => {
      if (!activeTarget || !isFormulaEditing) return false;

      const sourceRowIndex = displayRowIndexes[displayRowIndex] ?? -1;
      const visibleColumn = visibleColumns[visibleColumnIndex];
      const absoluteColumnIndex = visibleColumn
        ? columns.findIndex((column) => column.key === visibleColumn.key)
        : -1;

      if (sourceRowIndex < 0 || absoluteColumnIndex < 0) {
        return false;
      }

      preserveNextSyncRef.current = true;
      setEditingValue((prev: unknown) =>
        insertCellReferenceIntoFormula(
          String(prev ?? ""),
          createFormulaCellReference(sourceRowIndex, absoluteColumnIndex)
        )
      );
      return true;
    },
    [activeTarget, columns, displayRowIndexes, isFormulaEditing, visibleColumns]
  );

  const cancelEditing = useCallback(() => {
    if (activeTarget) {
      setEditingValue(activeTarget.value);
    }
    setEditingCell(null);
    setEditingOrigin(null);
    flushViewportFocusAfterEdit();
    return true;
  }, [activeTarget, flushViewportFocusAfterEdit, setEditingCell]);

  const closeEditor = useCallback(() => {
    setEditingCell(null);
    setEditingOrigin(null);
    flushViewportFocusAfterEdit();
  }, [flushViewportFocusAfterEdit, setEditingCell]);

  const commitEditing = useCallback(
    (nextValue?: unknown) => {
      if (!activeTarget || activeTarget.readonly) {
        setEditingCell(null);
        return false;
      }

      const resolvedValue = nextValue !== undefined ? nextValue : editingValue;
      // item 7: parse with the configured locale (so `1.234,56` under de-DE commits 1234.56).
      const parsedValue = parseCellValue(
        resolvedValue,
        activeTarget.row,
        activeTarget.column,
        locale ? { locale } : undefined
      );

      // Unparsable non-blank text (strict number reject): KEEP the editor open and the old value
      // rather than clobbering it with null (A-059 / item 7). GridCell shows the error state.
      if (isStrictParseRejection(resolvedValue, parsedValue, activeTarget.column)) {
        return false;
      }

      // A-062b: a commit whose parsed value equals the previous value writes nothing, emits no
      // `onCellChange` and pushes no history (deep equality, so `{...}`/Date identity never counts).
      const previousValue = activeTarget.value;
      if (deepEqual(previousValue, parsedValue)) {
        closeEditor();
        return true;
      }

      // Write the already-parsed value directly (one parse): calling updateCellValue would re-parse
      // and double-apply a custom `parseValue`. Mirrors the clipboard write sink.
      const nextRow = setRowValue(activeTarget.row, activeTarget.column, parsedValue);
      const nextRows = rows.slice();
      nextRows[activeTarget.sourceRowIndex] = nextRow;

      updateRows(nextRows);
      emitCellChange?.({
        rowIndex: activeTarget.sourceRowIndex,
        columnIndex: activeTarget.columnIndex,
        columnKey: activeTarget.column.key,
        row: nextRow,
        previousValue,
        value: parsedValue,
      });

      closeEditor();
      return true;
    },
    [
      activeTarget,
      closeEditor,
      editingValue,
      emitCellChange,
      locale,
      rows,
      setEditingCell,
      updateRows,
    ]
  );

  return {
    activeTarget,
    editingOrigin,
    editingValue,
    editorAutoSelectOnFocus,
    isFormulaEditing,
    setEditingValue,
    requestViewportFocusAfterEdit,
    startEditing,
    insertFormulaReference,
    commitEditing,
    cancelEditing,
  };
}
