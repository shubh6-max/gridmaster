import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { updateCellValue } from "../../core/features/editing";
import type {
  GridCellChangeEvent,
  GridEditCell,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
} from "../../core/types";
import { getRowValue } from "../../core/utils";

export type GridEditingTarget<T extends GridRow = GridRow> = {
  displayRowIndex: number;
  sourceRowIndex: number;
  columnIndex: number;
  row: T;
  column: GridResolvedColumnDef<T>;
  value: unknown;
  readonly: boolean;
} | null;

type UseEditingParams<T extends GridRow = GridRow> = {
  mode: "editable" | "readonly";
  rows: T[];
  displayRowIndexes: number[];
  visibleColumns: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  editingCell: GridEditCell;
  setEditingCell: React.Dispatch<React.SetStateAction<GridEditCell>>;
  updateRows: (rows: T[]) => void;
  emitCellChange?: (event: GridCellChangeEvent<T>) => void;
};

function resolveEditingTarget<T extends GridRow>(
  mode: "editable" | "readonly",
  rows: T[],
  displayRowIndexes: number[],
  visibleColumns: GridResolvedColumnDef<T>[],
  cell: GridEditCell
): GridEditingTarget<T> {
  if (!cell) return null;

  const sourceRowIndex = displayRowIndexes[cell.row] ?? -1;
  const column = visibleColumns[cell.col];
  const row = sourceRowIndex >= 0 ? rows[sourceRowIndex] : undefined;

  if (!column || !row) return null;

  return {
    displayRowIndex: cell.row,
    sourceRowIndex,
    columnIndex: cell.col,
    row,
    column,
    value: getRowValue(row, column),
    readonly: mode === "readonly" || column.readonly || !column.editable,
  };
}

export function useEditing<T extends GridRow = GridRow>({
  mode,
  rows,
  displayRowIndexes,
  visibleColumns,
  selection,
  editingCell,
  setEditingCell,
  updateRows,
  emitCellChange,
}: UseEditingParams<T>) {
  const [editingValue, setEditingValue] = useState<unknown>("");
  const preserveNextSyncRef = useRef(false);

  const activeTarget = useMemo(
    () =>
      resolveEditingTarget(mode, rows, displayRowIndexes, visibleColumns, editingCell),
    [mode, rows, displayRowIndexes, visibleColumns, editingCell]
  );

  useEffect(() => {
    if (!activeTarget) return;

    if (preserveNextSyncRef.current) {
      preserveNextSyncRef.current = false;
      return;
    }

    setEditingValue(activeTarget.value);
  }, [activeTarget]);

  const startEditing = useCallback(
    (cell?: GridEditCell, initialValue?: unknown) => {
      const nextCell = cell ?? selection.cursor ?? selection.anchor;
      const target = resolveEditingTarget(mode, rows, displayRowIndexes, visibleColumns, nextCell);
      if (!nextCell || !target || target.readonly) return false;

      if (initialValue !== undefined) {
        preserveNextSyncRef.current = true;
        setEditingValue(initialValue);
      } else {
        setEditingValue(target.value);
      }

      setEditingCell(nextCell);
      return true;
    },
    [displayRowIndexes, mode, rows, selection.anchor, selection.cursor, setEditingCell, visibleColumns]
  );

  const cancelEditing = useCallback(() => {
    if (activeTarget) {
      setEditingValue(activeTarget.value);
    }
    setEditingCell(null);
    return true;
  }, [activeTarget, setEditingCell]);

  const commitEditing = useCallback(
    (nextValue?: unknown) => {
      if (!activeTarget || activeTarget.readonly) {
        setEditingCell(null);
        return false;
      }

      const resolvedValue = nextValue !== undefined ? nextValue : editingValue;
      const result = updateCellValue(
        rows,
        activeTarget.sourceRowIndex,
        activeTarget.column,
        resolvedValue
      );

      updateRows(result.rows);
      emitCellChange?.({
        rowIndex: activeTarget.sourceRowIndex,
        columnIndex: activeTarget.columnIndex,
        columnKey: activeTarget.column.key,
        row: result.rows[activeTarget.sourceRowIndex],
        previousValue: result.previousValue,
        value: result.value,
      });

      setEditingCell(null);
      return true;
    },
    [activeTarget, editingValue, emitCellChange, rows, setEditingCell, updateRows]
  );

  return {
    activeTarget,
    editingValue,
    setEditingValue,
    startEditing,
    commitEditing,
    cancelEditing,
  };
}
