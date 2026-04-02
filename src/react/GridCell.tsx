import React from "react";
import { updateCellValue, validateCell } from "../core/features/editing";
import type { GridResolvedColumnDef, GridRow } from "../core/types";
import { formatCellValue, getRowValue, parseCellValue } from "../core/utils";
import { getDefaultCellEditor } from "../editors";
import { getDefaultCellRenderer } from "../renderers";
import { useGridContext } from "./context/GridContext";

type GridCellProps<T extends GridRow = GridRow> = {
  row: T;
  rowIndex: number;
  sourceRowIndex: number;
  column: GridResolvedColumnDef<T>;
  columnIndex: number;
  isSelected: boolean;
  isActive: boolean;
};

export function GridCell<T extends GridRow = GridRow>({
  row,
  rowIndex,
  sourceRowIndex,
  column,
  columnIndex,
  isSelected,
  isActive,
}: GridCellProps<T>) {
  const {
    mode,
    rows,
    updateRows,
    emitCellChange,
    editingCell,
    editingValue,
    setEditingValue,
    startEditing,
    commitEditing,
    cancelEditing,
  } = useGridContext<T>();

  const value = getRowValue(row, column);
  const formattedValue = formatCellValue(value, row, column);
  const isReadonly = mode === "readonly" || column.readonly || !column.editable;
  const isEditing = editingCell?.row === rowIndex && editingCell?.col === columnIndex;
  const draftValue = isEditing ? editingValue : value;
  const parsedDraftValue = isEditing ? parseCellValue(draftValue, row, column) : value;
  const validationError = validateCell(row, column, parsedDraftValue);
  const meta = validationError ? { error: validationError } : undefined;

  const startEdit = React.useCallback(() => {
    if (isReadonly) return;
    startEditing({ row: rowIndex, col: columnIndex });
  }, [columnIndex, isReadonly, rowIndex, startEditing]);

  const updateDraftValue = React.useCallback(
    (nextValue: unknown) => {
      setEditingValue(nextValue);
    },
    [setEditingValue]
  );

  const updateRenderedValue = React.useCallback(
    (nextValue: unknown) => {
      if (isReadonly) return;
      if (sourceRowIndex < 0 || sourceRowIndex >= rows.length) return;

      const result = updateCellValue(rows, sourceRowIndex, column, nextValue);
      updateRows(result.rows);

      emitCellChange?.({
        rowIndex: sourceRowIndex,
        columnIndex,
        columnKey: column.key,
        row: result.rows[sourceRowIndex],
        previousValue: result.previousValue,
        value: result.value,
      });
    },
    [column, columnIndex, emitCellChange, isReadonly, rows, sourceRowIndex, updateRows]
  );

  const wrapperClassName = ["gm-cell-shell", validationError ? "is-invalid" : ""]
    .filter(Boolean)
    .join(" ");
  const wrapperTitle = validationError
    ? [formattedValue, validationError].filter(Boolean).join("\n")
    : formattedValue || undefined;

  if (isEditing) {
    const DefaultEditor = getDefaultCellEditor<T>(column.type);
    const editorProps = {
      row,
      rowIndex,
      column,
      columnIndex,
      value: draftValue,
      formattedValue: formatCellValue(parsedDraftValue, row, column),
      meta,
      isSelected,
      isActive,
      isEditing,
      mode,
      updateValue: updateDraftValue,
      commit: () => commitEditing(),
      cancel: cancelEditing,
    };

    return (
      <div
        className={wrapperClassName}
        style={{ overflow: column.wrap ? "visible" : "hidden" }}
        title={validationError ?? undefined}
      >
        {column.renderEditor ? <>{column.renderEditor(editorProps)}</> : <DefaultEditor {...editorProps} />}
        {validationError ? <span className="gm-cell-error-indicator" aria-label={validationError} /> : null}
      </div>
    );
  }

  const DefaultRenderer = getDefaultCellRenderer<T>(column.type);
  const rendererProps = {
    row,
    rowIndex,
    column,
    columnIndex,
    value,
    formattedValue,
    meta,
    isSelected,
    isActive,
    isEditing,
    mode,
    updateValue: updateRenderedValue,
  };

  return (
    <div
      className={wrapperClassName}
      onDoubleClick={startEdit}
      style={{ overflow: column.wrap ? "visible" : "hidden" }}
      title={wrapperTitle}
    >
      {column.renderCell ? <>{column.renderCell(rendererProps)}</> : <DefaultRenderer {...rendererProps} />}
      {validationError ? <span className="gm-cell-error-indicator" aria-label={validationError} /> : null}
    </div>
  );
}

export default GridCell;
