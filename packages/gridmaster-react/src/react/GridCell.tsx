import React from "react";
import {
  getEffectiveHorizontalAlign,
  getEffectiveIndentLevel,
  getEffectiveTextOrientation,
  getEffectiveVerticalAlign,
  getEffectiveWrapText,
} from "../core/features/formatting";
import { updateCellValue, validateCell } from "../core/features/editing";
import { getMatchingConditionalFormat } from "../core/features/conditionalFormatting";
import { isStrictParseRejection } from "../core/features/readonly";
import { validateColumnValue } from "../core/features/validation";
import { setActiveCell } from "../core/state/selectionState";
import type { GridCellMeta, GridResolvedColumnDef, GridRow } from "../core/types";
import { formatCellValue, getRowValue, isFormulaValue, parseCellValue } from "../core/utils";
import { getDefaultCellEditor } from "../editors";
import { getDefaultCellRenderer } from "../renderers";
import { useGridContext } from "./context/GridContext";

type GridCellProps<T extends object = GridRow> = {
  row: T;
  rowIndex: number;
  sourceRowIndex: number;
  column: GridResolvedColumnDef<T>;
  columnIndex: number;
  isSelected: boolean;
  isActive: boolean;
  baseMeta?: GridCellMeta;
  /** Resolved per-cell/row read-only (column flags + cell/row `readonly` meta), from GridBody via
   * the shared predicate (A-084). Combined here with the grid-wide mode / `enableEditing` gates. */
  isReadonly?: boolean;
};

function getVerticalJustify(
  verticalAlign: "top" | "middle" | "bottom"
): React.CSSProperties["justifyContent"] {
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

export function GridCell<T extends object = GridRow>({
  row,
  rowIndex,
  sourceRowIndex,
  column,
  columnIndex,
  isSelected,
  isActive,
  baseMeta,
  isReadonly: isReadonlyFromMeta = false,
}: GridCellProps<T>) {
  const {
    props: gridProps,
    mode,
    rows,
    formulaEvaluator,
    updateRows,
    emitCellChange,
    editingCell,
    editingOrigin,
    editingValue,
    editorAutoSelectOnFocus,
    setSelection,
    setEditingValue,
    startEditing,
    requestViewportFocusAfterEdit,
    commitEditing,
    cancelEditing,
    // Resolved A-004 flags; defaults reproduce the pre-A-004 behaviour for a hand-built provider.
    enableEditing = mode !== "readonly",
    enableValidation = true,
  } = useGridContext<T>();
  // What renderers/editors should see: a grid whose editing is off behaves as read-only to them.
  const effectiveMode = enableEditing ? mode : "readonly";

  const rawValue = getRowValue(row, column);
  const formulaResult = formulaEvaluator.evaluateCell(sourceRowIndex, column.key);
  const value = formulaResult.value;
  const formattedValue = formulaResult.error
    ? formulaResult.error
    : formatCellValue(value, row, column);
  // A-084: the grid-wide gates plus the per-cell/row read-only meta resolved by GridBody.
  const isReadonly = !enableEditing || mode === "readonly" || isReadonlyFromMeta;
  const locale = gridProps.locale;
  const isEditingCell = editingCell?.row === rowIndex && editingCell?.col === columnIndex;
  const isEditing = isEditingCell && editingOrigin !== "formulaBar";
  const draftValue = isEditingCell ? editingValue : rawValue;
  const parsedDraftValue = isEditingCell
    ? parseCellValue(draftValue, row, column, locale ? { locale } : undefined)
    : value;
  // item 7: a non-blank draft the column cannot parse (e.g. text in a number column). The editor
  // shows an error and cancels on blur instead of committing null over the stored value.
  const isDraftUnparsable = isEditingCell && isStrictParseRejection(draftValue, parsedDraftValue, column);
  const validationError =
    !enableValidation || formulaResult.error || isFormulaValue(parsedDraftValue)
      ? null
      : (validateCell(row, column, parsedDraftValue) ??
        validateColumnValue(parsedDraftValue, row, column));
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
  // A-016: resolve the matching conditional-format rule against the EVALUATED cell value (formula
  // result, not the raw field) and merge its style into the cell. This is the single style-merge
  // hook-up the rule set permits in this file.
  // ponytail: reads the `initialConditionalFormats` prop directly because v1 has no runtime setter
  // path for rules; if a conditional-format editor is added, route live state through GridContext.
  const conditionalFormat =
    gridProps.enableConditionalFormatting && gridProps.initialConditionalFormats
      ? getMatchingConditionalFormat(row, column.key, gridProps.initialConditionalFormats, {
          value,
          now: gridProps.conditionalFormatNow,
        })
      : null;
  const wrapperStyle: React.CSSProperties = {
    overflow: effectiveWrapText ? "visible" : "hidden",
    justifyContent: getVerticalJustify(effectiveVerticalAlign),
    ...(conditionalFormat?.backgroundColor
      ? { backgroundColor: conditionalFormat.backgroundColor }
      : {}),
  };
  const contentStyle: React.CSSProperties = {
    textAlign: effectiveHorizontalAlign,
    whiteSpace: effectiveWrapText ? "pre-wrap" : "nowrap",
    overflow: effectiveWrapText ? "visible" : "hidden",
    textOverflow: effectiveWrapText ? "clip" : "ellipsis",
    paddingInlineStart: effectiveIndentLevel ? `${effectiveIndentLevel * 12}px` : undefined,
    ...getOrientationStyles(effectiveTextOrientation),
    ...(conditionalFormat?.color ? { color: conditionalFormat.color } : {}),
    ...(conditionalFormat?.bold ? { fontWeight: 700 } : {}),
    ...(conditionalFormat?.italic ? { fontStyle: "italic" } : {}),
    ...(conditionalFormat?.underline ? { textDecoration: "underline" } : {}),
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
      mode: effectiveMode,
      updateValue: updateDraftValue,
      commit: (nextValue?: unknown) => commitEditing(nextValue),
      cancel: cancelEditing,
      requestViewportFocusAfterEdit,
      autoSelectOnFocus: editorAutoSelectOnFocus,
      isInvalid: isDraftUnparsable,
    };

    const editorWrapperClassName = [wrapperClassName, isDraftUnparsable ? "is-invalid" : ""]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        className={editorWrapperClassName}
        style={wrapperStyle}
        title={cellError ?? undefined}
        aria-invalid={isDraftUnparsable || undefined}
      >
        {column.renderEditor ? (
          <>{column.renderEditor(editorProps)}</>
        ) : (
          <DefaultEditor {...editorProps} />
        )}
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
    mode: effectiveMode,
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
        {column.renderCell ? (
          <>{column.renderCell(rendererProps)}</>
        ) : (
          <DefaultRenderer {...rendererProps} />
        )}
      </div>
      {cellError ? <span className="gm-cell-error-indicator" aria-label={cellError} /> : null}
    </div>
  );
}

export default GridCell;
