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
    startEditing,
    commitEditing,
    cancelEditing,
  } = useGridContext();

  const activeRowIndex = selection?.cursor?.row ?? 0;
  const activeColIndex = selection?.cursor?.col ?? 0;

  const row = displayRows[activeRowIndex];
  const column = visibleColumns[activeColIndex];

  const rawValue = row && column ? getRowValue(row, column) : "";
  const stringValue = rawValue == null ? "" : String(rawValue);
  const isReadonly = mode === "readonly" || !column || column.readonly || !column.editable;
  const isEditingActiveCell =
    editingCell?.row === activeRowIndex && editingCell?.col === activeColIndex;
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
        {cellAddress(activeRowIndex, activeColIndex)}
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

      <input
        value={draftValue}
        readOnly={isReadonly}
        onChange={(event) => setEditingValue(event.target.value)}
        onFocus={() => {
          if (!isReadonly) {
            startEditing({ row: activeRowIndex, col: activeColIndex });
          }
        }}
        onBlur={() => {
          if (isEditingActiveCell) {
            commitEditing();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitEditing();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
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
        }}
      />
    </div>
  );
}

export default FormulaBar;
