import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createFormulaCellReference,
  insertCellReferenceIntoFormula,
} from "../../core/features/formulas";
import { updateCellValue } from "../../core/features/editing";
import type {
  GridCellChangeEvent,
  GridEditCell,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
} from "../../core/types";
import { getRowValue, isFormulaValue } from "../../core/utils";

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
  columns: GridResolvedColumnDef<T>[];
  displayRowIndexes: number[];
  visibleColumns: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  editingCell: GridEditCell;
  setEditingCell: React.Dispatch<React.SetStateAction<GridEditCell>>;
  updateRows: (rows: T[]) => void;
  focusViewport: () => void;
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
  columns,
  displayRowIndexes,
  visibleColumns,
  selection,
  editingCell,
  setEditingCell,
  updateRows,
  focusViewport,
  emitCellChange,
}: UseEditingParams<T>) {
  const [editingValue, setEditingValue] = useState<unknown>("");
  const [editingOrigin, setEditingOrigin] = useState<"cell" | "formulaBar" | null>(null);
  const preserveNextSyncRef = useRef(false);
  const shouldFocusViewportAfterEditRef = useRef(false);

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
      const target = resolveEditingTarget(mode, rows, displayRowIndexes, visibleColumns, nextCell);
      if (!nextCell || !target || target.readonly) return false;

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
    [displayRowIndexes, mode, rows, selection.anchor, selection.cursor, setEditingCell, visibleColumns]
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
      setEditingOrigin(null);
      flushViewportFocusAfterEdit();
      return true;
    },
    [
      activeTarget,
      editingValue,
      emitCellChange,
      flushViewportFocusAfterEdit,
      rows,
      setEditingCell,
      updateRows,
    ]
  );

  return {
    activeTarget,
    editingOrigin,
    editingValue,
    isFormulaEditing,
    setEditingValue,
    requestViewportFocusAfterEdit,
    startEditing,
    insertFormulaReference,
    commitEditing,
    cancelEditing,
  };
}
