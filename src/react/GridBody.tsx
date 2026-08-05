import React from "react";
import { DEFAULT_ROW_NUMBER_WIDTH, Z_INDEX } from "../core/constants";
import {
  getEffectiveVerticalAlign,
  getEffectiveWrapText,
} from "../core/features/formatting";
import { buildColumnOffsets, getColumnWidth } from "../core/features/sizing";
import {
  isCellActive,
  isCellSelected,
  selectSingleRow,
  setActiveCell,
} from "../core/state/selectionState";
import { createCellMetaKey, resolveGridRowId } from "../core/utils";
import { useFillHandle } from "./hooks/useFillHandle";
import { useSelection } from "./hooks/useSelection";
import { useGridContext } from "./context/GridContext";
import { GridCell } from "./GridCell";

export function GridBody() {
  const {
    props,
    viewportRef,
    displayRows,
    displayRowIndexes,
    visibleColumns,
    rows,
    selection,
    setSelection,
    cellMetaMap,
    isFormulaEditing,
    insertFormulaReference,
    formatPainterMode,
    paintFormatAtCell,
    fill,
    setFill,
    updateRows,
    columnWidths,
    frozenColumns,
    rowHeight,
    headerHeight,
    editingCell,
    enableFillHandle,
    enableInsertRow,
    enableInsertColumn,
    enableDeleteRow,
    enableDeleteColumn,
    openContextMenu,
  } = useGridContext();
  const virtualizationEnabled = Boolean(props.virtualizeRows && displayRows.length > 0);
  const overscanRowCount = Math.max(2, props.overscanRowCount ?? 8);
  const [viewportMetrics, setViewportMetrics] = React.useState({
    scrollTop: 0,
    viewportHeight: 0,
  });

  const { onCellMouseDown, onCellMouseEnter, onRowHeaderClick } = useSelection({
    rows: displayRows,
    columns: visibleColumns,
    selection,
    setSelection,
    enableRangeSelection: true,
    enableRowSelection: true,
    enableColumnSelection: true,
  });

  const {
    isFillHandleCell,
    isPreviewCell,
    onFillHandleMouseDown,
    onFillHandleDoubleClick,
    onCellMouseEnter: onFillMouseEnter,
  } = useFillHandle({
    rows,
    displayRows,
    displayRowIndexes,
    columns: visibleColumns,
    selection,
    setSelection,
    fill,
    setFill,
    updateRows,
    enableFillHandle: enableFillHandle && !editingCell,
  });

  const colOffsets = React.useMemo(
    () => buildColumnOffsets(visibleColumns, columnWidths),
    [visibleColumns, columnWidths]
  );

  React.useEffect(() => {
    if (!virtualizationEnabled) {
      setViewportMetrics((current) =>
        current.scrollTop === 0 && current.viewportHeight === 0
          ? current
          : {
              scrollTop: 0,
              viewportHeight: 0,
            }
      );
      return;
    }

    const container = viewportRef.current;
    if (!container) return;

    const updateMetrics = () => {
      setViewportMetrics((current) => {
        const next = {
          scrollTop: container.scrollTop,
          viewportHeight: container.clientHeight,
        };

        if (
          current.scrollTop === next.scrollTop &&
          current.viewportHeight === next.viewportHeight
        ) {
          return current;
        }

        return next;
      });
    };

    updateMetrics();
    container.addEventListener("scroll", updateMetrics, { passive: true });

    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", updateMetrics);
      resizeObserver.disconnect();
    };
  }, [viewportRef, virtualizationEnabled]);

  const stickyHeaderHeight = 24 + headerHeight;
  const visibleBodyHeight = Math.max(
    viewportMetrics.viewportHeight - stickyHeaderHeight,
    rowHeight
  );
  const firstVisibleRowIndex = virtualizationEnabled
    ? Math.min(
        Math.max(
          Math.floor(Math.max(viewportMetrics.scrollTop - stickyHeaderHeight, 0) / rowHeight) -
            overscanRowCount,
          0
        ),
        Math.max(displayRows.length - 1, 0)
      )
    : 0;
  const visibleRowWindow = virtualizationEnabled
    ? Math.ceil(visibleBodyHeight / rowHeight) + overscanRowCount * 2
    : displayRows.length;
  const lastVisibleRowIndex = virtualizationEnabled
    ? Math.min(displayRows.length, firstVisibleRowIndex + visibleRowWindow)
    : displayRows.length;
  const topSpacerHeight = virtualizationEnabled ? firstVisibleRowIndex * rowHeight : 0;
  const bottomSpacerHeight = virtualizationEnabled
    ? Math.max(displayRows.length - lastVisibleRowIndex, 0) * rowHeight
    : 0;
  const renderedRows = virtualizationEnabled
    ? displayRows.slice(firstVisibleRowIndex, lastVisibleRowIndex)
    : displayRows;

  const openCellContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLElement>, rowIndex: number, colIndex: number, columnKey: string) => {
      if (!enableInsertRow && !enableInsertColumn && !enableDeleteRow && !enableDeleteColumn) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setSelection((prev) => setActiveCell(prev, { row: rowIndex, col: colIndex }));
      openContextMenu({
        kind: "cell",
        anchorRect: new DOMRect(event.clientX, event.clientY, 0, 0),
        displayRowIndex: rowIndex,
        visibleColumnIndex: colIndex,
        columnKey,
      });
    },
    [
      enableDeleteColumn,
      enableDeleteRow,
      enableInsertColumn,
      enableInsertRow,
      openContextMenu,
      setSelection,
    ]
  );

  const openRowContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLElement>, rowIndex: number) => {
      if (!enableInsertRow && !enableDeleteRow) return;

      event.preventDefault();
      event.stopPropagation();
      setSelection((prev) => selectSingleRow(prev, rowIndex, visibleColumns.length));
      openContextMenu({
        kind: "row",
        anchorRect: new DOMRect(event.clientX, event.clientY, 0, 0),
        displayRowIndex: rowIndex,
      });
    },
    [enableDeleteRow, enableInsertRow, openContextMenu, setSelection, visibleColumns.length]
  );

  return (
    <tbody>
      {topSpacerHeight > 0 ? (
        <tr aria-hidden="true">
          <td
            colSpan={visibleColumns.length + 1}
            style={{
              height: topSpacerHeight,
              padding: 0,
              border: 0,
              background: "transparent",
            }}
          />
        </tr>
      ) : null}

      {renderedRows.map((row, visibleRowOffset: number) => {
        const rowIndex = firstVisibleRowIndex + visibleRowOffset;
        const isRowActive = selection.selectedRows?.has?.(rowIndex);
        const sourceRowIndex = displayRowIndexes[rowIndex] ?? rowIndex;
        const rowKey = resolveGridRowId(row, sourceRowIndex, props.getRowId);
        const rowMeta = props.getRowMeta?.(row, sourceRowIndex);
        const rowBackgroundColor =
          typeof rowMeta?.style?.backgroundColor === "string" &&
          rowMeta.style.backgroundColor.trim()
            ? rowMeta.style.backgroundColor
            : undefined;
        const isRowReadonly = Boolean(rowMeta?.readonly);

        return (
          <tr
            key={rowKey}
            className={rowMeta?.className}
            style={{
              height: rowHeight,
              ...(rowMeta?.style ?? {}),
            }}
          >
            <td
              className="gm-rh"
              onClick={(e) =>
                onRowHeaderClick(rowIndex, {
                  shiftKey: e.shiftKey,
                  ctrlKey: e.ctrlKey,
                  metaKey: e.metaKey,
                })
              }
              onContextMenu={(event) => openRowContextMenu(event, rowIndex)}
              style={{
                width: DEFAULT_ROW_NUMBER_WIDTH,
                minWidth: DEFAULT_ROW_NUMBER_WIDTH,
                maxWidth: DEFAULT_ROW_NUMBER_WIDTH,
                position: "sticky",
                left: 0,
                zIndex: Z_INDEX.ROW_HEADER,
                background: isRowActive ? "#dbeafe" : rowBackgroundColor || "#f8fafc",
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
                const preview = isPreviewCell(rowIndex, colIndex);
                const showFillHandle = isFillHandleCell(rowIndex, colIndex);
                const metaKey = createCellMetaKey(sourceRowIndex, column.key);
                const historyCellMeta = cellMetaMap[metaKey];
                const dynamicCellMeta = props.getCellMeta?.(row, sourceRowIndex, column.key);
                const cellMeta =
                  historyCellMeta || dynamicCellMeta
                    ? {
                        ...(historyCellMeta ?? {}),
                        ...(dynamicCellMeta ?? {}),
                        style: {
                          ...(historyCellMeta?.style ?? {}),
                          ...(dynamicCellMeta?.style ?? {}),
                        },
                      }
                    : undefined;
                const isMetaReadonly = Boolean(cellMeta?.readonly);
                const isReadonly = Boolean(column.readonly || isMetaReadonly || isRowReadonly);
                const shouldWrap = getEffectiveWrapText(cellMeta, column);
                const backgroundColor =
                active
                  ? "#ffffff"
                  : selected
                  ? "#dbeafe"
                  : cellMeta?.backgroundColor || rowBackgroundColor || "#ffffff";
              const verticalAlign = getEffectiveVerticalAlign(cellMeta);

              return (
                <td
                  key={`${rowKey}-${column.key}`}
                  className={[
                    "gm-td",
                    selected && !active ? "gm-selected" : "",
                    active ? "gm-active" : "",
                    preview ? "gm-fill-preview" : "",
                    isReadonly ? "gm-readonly" : "",
                    shouldWrap ? "gm-wrap" : "",
                    formatPainterMode !== "idle" ? "gm-format-painter-target" : "",
                    cellMeta?.className ?? "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseDown={(e) =>
                    {
                      if (isFormulaEditing) {
                        e.preventDefault();
                        setSelection((prev) => setActiveCell(prev, { row: rowIndex, col: colIndex }));
                        insertFormulaReference(rowIndex, colIndex);
                        return;
                      }

                      if (formatPainterMode !== "idle") {
                        e.preventDefault();
                        paintFormatAtCell(rowIndex, colIndex);
                        return;
                      }

                      onCellMouseDown(rowIndex, colIndex, {
                        shiftKey: e.shiftKey,
                        ctrlKey: e.ctrlKey,
                        metaKey: e.metaKey,
                      });
                    }
                  }
                  onMouseEnter={() => {
                    onCellMouseEnter(rowIndex, colIndex);
                    onFillMouseEnter(rowIndex, colIndex);
                  }}
                  onContextMenu={(event) =>
                    openCellContextMenu(event, rowIndex, colIndex, column.key)
                  }
                  style={{
                    width,
                    minWidth: width,
                    maxWidth: width,
                    height: shouldWrap ? undefined : rowHeight,
                    position: isFrozen ? "sticky" : undefined,
                    left: isFrozen ? DEFAULT_ROW_NUMBER_WIDTH + (colOffsets[column.key] ?? 0) : undefined,
                    zIndex: isFrozen ? Z_INDEX.FROZEN_CELL : undefined,
                    background: backgroundColor,
                    borderRight: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "0 8px",
                    overflow: shouldWrap ? "visible" : "hidden",
                    textOverflow: shouldWrap ? "clip" : "ellipsis",
                    whiteSpace: shouldWrap ? "normal" : "nowrap",
                    verticalAlign,
                    boxShadow:
                      active
                        ? "inset 0 0 0 2px #2563eb"
                        : isFrozen && colIndex === frozenColumns - 1
                        ? "3px 0 8px rgba(15, 23, 42, 0.08)"
                        : undefined,
                    color: isReadonly ? "#64748b" : "#0f172a",
                    fontSize: 12,
                    cursor:
                      formatPainterMode !== "idle"
                        ? "copy"
                        : isReadonly
                        ? "default"
                        : "cell",
                    ...(cellMeta?.style ?? {}),
                  }}
                >
                  <GridCell
                    row={row}
                    rowIndex={rowIndex}
                    sourceRowIndex={sourceRowIndex}
                    column={column}
                    columnIndex={colIndex}
                    isSelected={selected}
                    isActive={active}
                    baseMeta={cellMeta}
                  />
                  {showFillHandle ? (
                    <button
                      type="button"
                      className="gm-fill-handle"
                      aria-label="Drag to fill selection"
                      onMouseDown={onFillHandleMouseDown}
                      onDoubleClick={onFillHandleDoubleClick}
                      tabIndex={-1}
                    />
                  ) : null}
                </td>
              );
            })}
          </tr>
        );
      })}

      {bottomSpacerHeight > 0 ? (
        <tr aria-hidden="true">
          <td
            colSpan={visibleColumns.length + 1}
            style={{
              height: bottomSpacerHeight,
              padding: 0,
              border: 0,
              background: "transparent",
            }}
          />
        </tr>
      ) : null}

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
