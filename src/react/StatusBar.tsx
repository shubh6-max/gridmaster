import React from "react";
import { cellAddress } from "../core/utils";
import { useGridContext } from "./context/GridContext";

export function StatusBar() {
  const {
    selection,
    rows,
    displayRows,
    visibleColumns,
    columns,
    sort,
    filters,
    frozenColumns,
    clipboard,
    mode,
  } = useGridContext();

  const activeRowIndex = selection.cursor?.row ?? 0;
  const activeColIndex = selection.cursor?.col ?? 0;

  const filterCount = Object.keys(filters ?? {}).length;
  const sortLabel = sort ? `${sort.columnKey} ${sort.direction}` : "None";

  return (
    <div
      className="gm-status-bar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        border: "1px solid #0f172a",
        borderTop: "none",
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        background: "#0f172a",
        padding: "8px 12px",
        fontSize: 11,
        color: "#94a3b8",
      }}
    >
      <span>
        Cell:{" "}
        <strong style={{ color: "#ffffff" }}>
          {cellAddress(activeRowIndex, activeColIndex)}
        </strong>
      </span>

      <span>
        Rows:{" "}
        <strong style={{ color: "#ffffff" }}>
          {displayRows.length}
        </strong>{" "}
        / {rows.length}
      </span>

      <span>
        Mode:{" "}
        <strong style={{ color: mode === "readonly" ? "#86efac" : "#7dd3fc" }}>
          {mode === "readonly" ? "Read Only" : "Editable"}
        </strong>
      </span>

      <span>
        Columns:{" "}
        <strong style={{ color: "#ffffff" }}>
          {visibleColumns.length}
        </strong>{" "}
        / {columns.length}
      </span>

      <span>
        Sort:{" "}
        <strong style={{ color: sort ? "#fde68a" : "#94a3b8" }}>
          {sortLabel}
        </strong>
      </span>

      <span>
        Frozen:{" "}
        <strong style={{ color: "#a5b4fc" }}>
          {frozenColumns || "None"}
        </strong>
      </span>

      <span>
        Filters:{" "}
        <strong style={{ color: filterCount ? "#86efac" : "#94a3b8" }}>
          {filterCount || "None"}
        </strong>
      </span>

      {clipboard && (
        <span>
          Buffer:{" "}
          <strong style={{ color: clipboard.isCut ? "#fdba74" : "#86efac" }}>
            {clipboard.isCut ? "Cut" : "Copied"} {clipboard.data.length}x
            {clipboard.data[0]?.length ?? 0}
          </strong>
        </span>
      )}
    </div>
  );
}

export default StatusBar;
