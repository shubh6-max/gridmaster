import React from "react";
import { cellAddress, getRowValue } from "../core/utils";
import { useGridContext } from "./context/GridContext";

export function FormulaBar() {
  const {
    selection,
    displayRows = [],
    visibleColumns = [],
    mode,
    editingCell,
    editingValue,
    setEditingValue,
    requestViewportFocusAfterEdit,
    startEditing,
    commitEditing,
    cancelEditing,
  } = useGridContext();

  const targetRowIndex = editingCell?.row ?? selection?.cursor?.row ?? 0;
  const targetColIndex = editingCell?.col ?? selection?.cursor?.col ?? 0;

  const row = displayRows[targetRowIndex];
  const column = visibleColumns[targetColIndex];

  const rawValue = row && column ? getRowValue(row, column) : "";
  const stringValue = rawValue == null ? "" : String(rawValue);
  const isReadonly = mode === "readonly" || !column || column.readonly || !column.editable;
  const isEditingActiveCell =
    editingCell?.row === targetRowIndex && editingCell?.col === targetColIndex;
  const draftValue = isEditingActiveCell ? String(editingValue ?? "") : stringValue;

  return (
    <div
      className="gm-formula-bar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: "1px solid #e2e8f0",
        borderBottom: "none",
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        background: "#ffffff",
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          minWidth: 72,
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 600,
          color: "#334155",
          textAlign: "center",
        }}
      >
        {cellAddress(targetRowIndex, targetColIndex)}
      </div>

      <div
        style={{
          minWidth: 140,
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
          padding: "6px 10px",
          fontSize: 12,
          color: "#64748b",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {column?.title ?? "No column"}
      </div>

      <textarea
        rows={1}
        value={draftValue}
        readOnly={isReadonly}
        onChange={(event) => {
          if (!isEditingActiveCell && !isReadonly) {
            startEditing(
              { row: targetRowIndex, col: targetColIndex },
              event.target.value,
              "formulaBar"
            );
            return;
          }

          setEditingValue(event.target.value);
        }}
        onFocus={() => {
          if (!isReadonly) {
            startEditing({ row: targetRowIndex, col: targetColIndex }, undefined, "formulaBar");
          }
        }}
        onBlur={() => {
          if (isEditingActiveCell) {
            commitEditing();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.altKey) {
            event.stopPropagation();
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            requestViewportFocusAfterEdit();
            commitEditing();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            requestViewportFocusAfterEdit();
            cancelEditing();
            return;
          }

          event.stopPropagation();
        }}
        style={{
          flex: 1,
          minHeight: 36,
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: mode === "readonly" ? "#f8fafc" : "#ffffff",
          padding: "7px 10px",
          fontSize: 12,
          color: "#0f172a",
          outline: "none",
          resize: "none",
          lineHeight: 1.4,
        }}
      />
    </div>
  );
}

export default FormulaBar;
