import React from "react";
import { DEFAULT_ROW_NUMBER_WIDTH, Z_INDEX } from "../core/constants";
import { buildColumnOffsets, getColumnWidth } from "../core/features/sizing";
import { isCellActive, isCellSelected } from "../core/state/selectionState";
import { useSelection } from "./hooks/useSelection";
import { useGridContext } from "./context/GridContext";
import { GridCell } from "./GridCell";

export function GridBody() {
  const {
    displayRows,
    displayRowIndexes,
    visibleColumns,
    selection,
    setSelection,
    columnWidths,
    frozenColumns,
    rowHeight,
  } = useGridContext();

  const { onCellMouseDown, onCellMouseEnter, onRowHeaderClick } = useSelection({
    rows: displayRows,
    columns: visibleColumns,
    selection,
    setSelection,
    enableRangeSelection: true,
    enableRowSelection: true,
    enableColumnSelection: true,
  });

  const colOffsets = React.useMemo(
    () => buildColumnOffsets(visibleColumns, columnWidths),
    [visibleColumns, columnWidths]
  );

  return (
    <tbody>
      {displayRows.map((row, rowIndex: number) => {
        const isRowActive = selection.selectedRows?.has?.(rowIndex);

        return (
          <tr key={row?.id ?? rowIndex} style={{ height: rowHeight }}>
            <td
              className="gm-rh"
              onClick={(e) =>
                onRowHeaderClick(rowIndex, {
                  shiftKey: e.shiftKey,
                  ctrlKey: e.ctrlKey,
                  metaKey: e.metaKey,
                })
              }
              style={{
                width: DEFAULT_ROW_NUMBER_WIDTH,
                minWidth: DEFAULT_ROW_NUMBER_WIDTH,
                maxWidth: DEFAULT_ROW_NUMBER_WIDTH,
                position: "sticky",
                left: 0,
                zIndex: Z_INDEX.ROW_HEADER,
                background: isRowActive ? "#dbeafe" : "#f8fafc",
                borderRight: "2px solid #cbd5e1",
                borderBottom: "1px solid #e2e8f0",
                textAlign: "right",
                padding: "0 10px",
                color: isRowActive ? "#1d4ed8" : "#64748b",
                fontSize: 11,
                fontWeight: isRowActive ? 700 : 500,
                userSelect: "none",
                cursor: "pointer",
              }}
            >
              {rowIndex + 1}
            </td>

            {visibleColumns.map((column, colIndex: number) => {
              const isFrozen = colIndex < frozenColumns;
              const width = getColumnWidth(column, columnWidths);
              const selected = isCellSelected(selection, rowIndex, colIndex);
              const active = isCellActive(selection, rowIndex, colIndex);

              return (
                <td
                  key={`${row?.id ?? rowIndex}-${column.key}`}
                  className={[
                    "gm-td",
                    selected && !active ? "gm-selected" : "",
                    active ? "gm-active" : "",
                    column.readonly ? "gm-readonly" : "",
                    column.wrap ? "gm-wrap" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseDown={(e) =>
                    onCellMouseDown(rowIndex, colIndex, {
                      shiftKey: e.shiftKey,
                      ctrlKey: e.ctrlKey,
                      metaKey: e.metaKey,
                    })
                  }
                  onMouseEnter={() => onCellMouseEnter(rowIndex, colIndex)}
                  style={{
                    width,
                    minWidth: width,
                    maxWidth: width,
                    height: rowHeight,
                    position: isFrozen ? "sticky" : undefined,
                    left: isFrozen ? DEFAULT_ROW_NUMBER_WIDTH + (colOffsets[column.key] ?? 0) : undefined,
                    zIndex: isFrozen ? Z_INDEX.FROZEN_CELL : undefined,
                    background: active ? "#ffffff" : selected ? "#dbeafe" : "#ffffff",
                    borderRight: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "0 8px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: column.wrap ? "pre-wrap" : "nowrap",
                    verticalAlign: "middle",
                    boxShadow:
                      active
                        ? "inset 0 0 0 2px #2563eb"
                        : isFrozen && colIndex === frozenColumns - 1
                        ? "3px 0 8px rgba(15, 23, 42, 0.08)"
                        : undefined,
                    color: column.readonly ? "#64748b" : "#0f172a",
                    fontSize: 12,
                    cursor: column.readonly ? "default" : "cell",
                  }}
                >
                  <GridCell
                    row={row}
                    rowIndex={rowIndex}
                    sourceRowIndex={displayRowIndexes[rowIndex] ?? -1}
                    column={column}
                    columnIndex={colIndex}
                    isSelected={selected}
                    isActive={active}
                  />
                </td>
              );
            })}
          </tr>
        );
      })}

      {displayRows.length === 0 && (
        <tr>
          <td
            colSpan={visibleColumns.length + 1}
            style={{
              padding: "24px 16px",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 13,
              background: "#fff",
            }}
          >
            No rows to display
          </td>
        </tr>
      )}
    </tbody>
  );
}

export default GridBody;
