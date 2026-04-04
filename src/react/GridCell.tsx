import React from "react";
import {
  getEffectiveHorizontalAlign,
  getEffectiveIndentLevel,
  getEffectiveTextOrientation,
  getEffectiveVerticalAlign,
  getEffectiveWrapText,
} from "../core/features/formatting";
import { updateCellValue, validateCell } from "../core/features/editing";
import { setActiveCell } from "../core/state/selectionState";
import type { GridCellMeta, GridResolvedColumnDef, GridRow } from "../core/types";
import { formatCellValue, getRowValue, isFormulaValue, parseCellValue } from "../core/utils";
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
  baseMeta?: GridCellMeta;
};

function getVerticalJustify(verticalAlign: "top" | "middle" | "bottom"): React.CSSProperties["justifyContent"] {
  switch (verticalAlign) {
    case "top":
      return "flex-start";
    case "bottom":
      return "flex-end";
    default:
      return "center";
  }
}

function getOrientationStyles(
  orientation: "horizontal" | "rotateUp" | "rotateDown" | "vertical"
): React.CSSProperties {
  switch (orientation) {
    case "rotateUp":
      return {
        writingMode: "vertical-rl",
        textOrientation: "mixed",
        transform: "rotate(180deg)",
        transformOrigin: "center",
      };
    case "rotateDown":
      return {
        writingMode: "vertical-rl",
        textOrientation: "mixed",
      };
    case "vertical":
      return {
        writingMode: "vertical-rl",
        textOrientation: "upright",
      };
    default:
      return {};
  }
}

export function GridCell<T extends GridRow = GridRow>({
  row,
  rowIndex,
  sourceRowIndex,
  column,
  columnIndex,
  isSelected,
  isActive,
  baseMeta,
}: GridCellProps<T>) {
  const {
    mode,
    rows,
    formulaEvaluator,
    updateRows,
    emitCellChange,
    editingCell,
    editingOrigin,
    editingValue,
    setSelection,
    setEditingValue,
    startEditing,
    requestViewportFocusAfterEdit,
    commitEditing,
    cancelEditing,
  } = useGridContext<T>();

  const rawValue = getRowValue(row, column);
  const formulaResult = formulaEvaluator.evaluateCell(sourceRowIndex, column.key);
  const value = formulaResult.value;
  const formattedValue = formulaResult.error
    ? formulaResult.error
    : formatCellValue(value, row, column);
  const isReadonly = mode === "readonly" || column.readonly || !column.editable;
  const isEditingCell = editingCell?.row === rowIndex && editingCell?.col === columnIndex;
  const isEditing = isEditingCell && editingOrigin !== "formulaBar";
  const draftValue = isEditingCell ? editingValue : rawValue;
  const parsedDraftValue = isEditingCell ? parseCellValue(draftValue, row, column) : value;
  const validationError =
    formulaResult.error || isFormulaValue(parsedDraftValue)
      ? null
      : validateCell(row, column, parsedDraftValue);
  const cellError = formulaResult.error ?? validationError;
  const meta = React.useMemo(
    () =>
      baseMeta || cellError
        ? {
            ...(baseMeta ?? {}),
            error: cellError ?? baseMeta?.error ?? null,
          }
        : undefined,
    [baseMeta, cellError]
  );

  const startEdit = React.useCallback(() => {
    if (isReadonly) return;
    startEditing({ row: rowIndex, col: columnIndex });
  }, [columnIndex, isReadonly, rowIndex, startEditing]);

  const startSelectEdit = React.useCallback(() => {
    if (isReadonly) return;

    setSelection((prev) => setActiveCell(prev, { row: rowIndex, col: columnIndex }));
    startEditing({ row: rowIndex, col: columnIndex });
  }, [columnIndex, isReadonly, rowIndex, setSelection, startEditing]);

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

  const wrapperClassName = ["gm-cell-shell", cellError ? "is-invalid" : ""]
    .filter(Boolean)
    .join(" ");
  const wrapperTitle = cellError
    ? [formattedValue, cellError].filter(Boolean).join("\n")
    : formattedValue || undefined;
  const effectiveWrapText = getEffectiveWrapText(meta, column);
  const effectiveHorizontalAlign = getEffectiveHorizontalAlign(meta, column);
  const effectiveVerticalAlign = getEffectiveVerticalAlign(meta);
  const effectiveTextOrientation = getEffectiveTextOrientation(meta);
  const effectiveIndentLevel = getEffectiveIndentLevel(meta);
  const wrapperStyle: React.CSSProperties = {
    overflow: effectiveWrapText ? "visible" : "hidden",
    justifyContent: getVerticalJustify(effectiveVerticalAlign),
  };
  const contentStyle: React.CSSProperties = {
    textAlign: effectiveHorizontalAlign,
    whiteSpace: effectiveWrapText ? "pre-wrap" : "nowrap",
    overflow: effectiveWrapText ? "visible" : "hidden",
    textOverflow: effectiveWrapText ? "clip" : "ellipsis",
    paddingInlineStart: effectiveIndentLevel ? `${effectiveIndentLevel * 12}px` : undefined,
    ...getOrientationStyles(effectiveTextOrientation),
  };

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
      requestViewportFocusAfterEdit,
    };

    return (
      <div
        className={wrapperClassName}
        style={wrapperStyle}
        title={cellError ?? undefined}
      >
        {column.renderEditor ? <>{column.renderEditor(editorProps)}</> : <DefaultEditor {...editorProps} />}
        {cellError ? <span className="gm-cell-error-indicator" aria-label={cellError} /> : null}
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
    startEditing: column.type === "select" ? startSelectEdit : startEdit,
  };

  return (
    <div
      className={wrapperClassName}
      onDoubleClick={startEdit}
      style={wrapperStyle}
      title={wrapperTitle}
    >
      <div
        className={[
          "gm-cell-content",
          effectiveWrapText ? "is-wrap" : "",
          effectiveTextOrientation !== "horizontal" ? "is-oriented" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={contentStyle}
      >
        {column.renderCell ? <>{column.renderCell(rendererProps)}</> : <DefaultRenderer {...rendererProps} />}
      </div>
      {cellError ? <span className="gm-cell-error-indicator" aria-label={cellError} /> : null}
    </div>
  );
}

export default GridCell;
