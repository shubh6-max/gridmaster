import React from "react";
import { DEFAULT_ROW_NUMBER_WIDTH, Z_INDEX } from "../core/constants";
import { getEffectiveVerticalAlign, getEffectiveWrapText } from "../core/features/formatting";
import { isCellReadonly } from "../core/features/readonly";
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

export function GridBody({ cellIdPrefix }: { cellIdPrefix: string }) {
  const {
    props,
    viewportRef,
    displayRows,
    displayRowIndexes,
    visibleColumns,
    columns,
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
    mode,
    enableFillHandle,
    enableInsertRow,
    enableInsertColumn,
    enableDeleteRow,
    enableDeleteColumn,
    openContextMenu,
    // Resolved A-004 flags; `= true` is the pre-A-004 behaviour for a hand-built provider value.
    enableRangeSelection = true,
    enableRowSelection = true,
    enableSelection = true,
    enableEditing = mode !== "readonly",
  } = useGridContext();
  // A2: aria-selected is emitted only when selection is enabled, never aria-selected="false" noise.
  const selectionEnabled = enableSelection !== false;
  // A2: effective cell read-only for aria-readonly = the grid-wide value gate OR the per-cell/row meta
  // read-only GridBody already derives for the gm-readonly class (isCellReadonly, the shared predicate).
  const gridValueReadonly = !enableEditing || mode === "readonly";
  const virtualizationEnabled = Boolean(props.virtualizeRows && displayRows.length > 0);
  const overscanRowCount = Math.max(2, props.overscanRowCount ?? 8);
  const [viewportMetrics, setViewportMetrics] = React.useState({
    scrollTop: 0,
    viewportHeight: 0,
  });

  const { onCellPointerDown, onCellPointerEnter, onRowHeaderClick } = useSelection({
    rows: displayRows,
    columns: visibleColumns,
    selection,
    setSelection,
    enableRangeSelection,
    enableRowSelection,
    // Column selection is a header gesture (GridHeader); the body never creates it.
    enableColumnSelection: true,
    viewportRef,
  });

  const {
    isFillHandleCell,
    isPreviewCell,
    onFillHandlePointerDown,
    onFillHandleDoubleClick,
    onCellPointerEnter: onFillPointerEnter,
  } = useFillHandle({
    rows,
    displayRows,
    displayRowIndexes,
    columns: visibleColumns,
    allColumns: columns,
    selection,
    setSelection,
    fill,
    setFill,
    updateRows,
    enableFillHandle: enableFillHandle && !editingCell,
    enableRangeSelection,
    props,
    cellMetaMap,
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
    (
      event: React.MouseEvent<HTMLElement>,
      rowIndex: number,
      colIndex: number,
      columnKey: string
    ) => {
      if (!enableInsertRow && !enableInsertColumn && !enableDeleteRow && !enableDeleteColumn) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      // A-077: right-click INSIDE the current selection keeps the range (Excel acts on it); right-click
      // outside moves the active cell to the clicked cell first.
      setSelection((prev) =>
        isCellSelected(prev, rowIndex, colIndex)
          ? prev
          : setActiveCell(prev, { row: rowIndex, col: colIndex })
      );
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
      // The menu targets `displayRowIndex`, so it does not need a row selection to work.
      setSelection((prev) =>
        enableRowSelection
          ? selectSingleRow(prev, rowIndex, visibleColumns.length)
          : setActiveCell(prev, { row: rowIndex, col: prev.cursor?.col ?? 0 })
      );
      openContextMenu({
        kind: "row",
        anchorRect: new DOMRect(event.clientX, event.clientY, 0, 0),
        displayRowIndex: rowIndex,
      });
    },
    [
      enableDeleteRow,
      enableInsertRow,
      enableRowSelection,
      openContextMenu,
      setSelection,
      visibleColumns.length,
    ]
  );

  const spacerRow = (height: number, key: string) =>
    height > 0 ? (
      // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: an aria-hidden virtualization spacer; role=presentation is intentional.
      <tr key={key} role="presentation" aria-hidden="true">
        <td
          colSpan={visibleColumns.length + 1}
          style={{ height, padding: 0, border: 0, background: "transparent" }}
        />
      </tr>
    ) : null;

  // A2: keep the ACTIVE (cursor) row mounted even when virtualization has scrolled it out of the
  // window, so aria-activedescendant never dangles. It renders in its true document position via split
  // spacers (above- or below-window), so spacer-height math, aria-rowindex and the visible layout stay
  // correct and only ONE extra row is mounted — the mounted-row count stays bounded.
  const activeRowIndex = selection.cursor?.row;
  const activeRowInWindow =
    activeRowIndex != null &&
    activeRowIndex >= firstVisibleRowIndex &&
    activeRowIndex < lastVisibleRowIndex;
  const activeRowExtra =
    virtualizationEnabled &&
    activeRowIndex != null &&
    activeRowIndex >= 0 &&
    activeRowIndex < displayRows.length &&
    !activeRowInWindow
      ? activeRowIndex
      : null;
  const activeAbove = activeRowExtra != null && activeRowExtra < firstVisibleRowIndex;
  const activeBelow = activeRowExtra != null && activeRowExtra >= lastVisibleRowIndex;

  const renderDataRow = (rowIndex: number) => {
    const row = displayRows[rowIndex];
    if (!row) return null;
    const isRowActive = selection.selectedRows?.has?.(rowIndex);
        const sourceRowIndex = displayRowIndexes[rowIndex] ?? rowIndex;
        const rowKey = resolveGridRowId(row, sourceRowIndex, props.getRowId);
        const rowMeta = props.getRowMeta?.(row, sourceRowIndex);
        const rowBackgroundColor =
          typeof rowMeta?.style?.backgroundColor === "string" &&
          rowMeta.style.backgroundColor.trim()
            ? rowMeta.style.backgroundColor
            : undefined;

        return (
          // biome-ignore lint/a11y/noRedundantRoles: presentation table (see GridViewport) requires the explicit row role.
          <tr role="row"
            key={rowKey}
            aria-rowindex={rowIndex + 2}
            aria-selected={selectionEnabled && isRowActive ? true : undefined}
            className={rowMeta?.className}
            style={{
              height: rowHeight,
              ...(rowMeta?.style ?? {}),
            }}
          >
            <td
              className="gm-rh"
              role="rowheader"
              aria-colindex={1}
              aria-selected={selectionEnabled && isRowActive ? true : undefined}
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
              // A-084: the one shared predicate GridCell / useEditing / fill / clipboard also use,
              // so the visual read-only state can never drift from the write guards.
              const isReadonly = isCellReadonly(column, cellMeta, rowMeta);
              const shouldWrap = getEffectiveWrapText(cellMeta, column);
              const backgroundColor = active
                ? "#ffffff"
                : selected
                  ? "#dbeafe"
                  : cellMeta?.backgroundColor || rowBackgroundColor || "#ffffff";
              const verticalAlign = getEffectiveVerticalAlign(cellMeta);

              return (
                // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: grid cells are gridcell by the APG Grid pattern; the presentation table (see GridViewport) removes the implicit cell role.
                <td role="gridcell"
                  key={`${rowKey}-${column.key}`}
                  id={`${cellIdPrefix}-r${rowIndex}-c${colIndex}`}
                  aria-colindex={colIndex + 2}
                  aria-selected={selectionEnabled && (selected || active) ? true : undefined}
                  aria-readonly={gridValueReadonly || isReadonly ? true : undefined}
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
                  onPointerDown={(e) => {
                    // Non-primary buttons fall through to onContextMenu (right-click range keep).
                    if (e.button !== 0) return;

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

                    onCellPointerDown(rowIndex, colIndex, {
                      shiftKey: e.shiftKey,
                      ctrlKey: e.ctrlKey,
                      metaKey: e.metaKey,
                      button: e.button,
                      clientX: e.clientX,
                      clientY: e.clientY,
                    });
                  }}
                  onPointerEnter={() => {
                    onCellPointerEnter(rowIndex, colIndex);
                    onFillPointerEnter(rowIndex, colIndex);
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
                    left: isFrozen
                      ? DEFAULT_ROW_NUMBER_WIDTH + (colOffsets[column.key] ?? 0)
                      : undefined,
                    zIndex: isFrozen ? Z_INDEX.FROZEN_CELL : undefined,
                    background: backgroundColor,
                    borderRight: "1px solid #e2e8f0",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "0 8px",
                    overflow: shouldWrap ? "visible" : "hidden",
                    textOverflow: shouldWrap ? "clip" : "ellipsis",
                    whiteSpace: shouldWrap ? "normal" : "nowrap",
                    verticalAlign,
                    boxShadow: active
                      ? "inset 0 0 0 2px #2563eb"
                      : isFrozen && colIndex === frozenColumns - 1
                        ? "3px 0 8px rgba(15, 23, 42, 0.08)"
                        : undefined,
                    color: isReadonly ? "#64748b" : "#0f172a",
                    fontSize: 12,
                    cursor: formatPainterMode !== "idle" ? "copy" : isReadonly ? "default" : "cell",
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
                    isReadonly={isReadonly}
                  />
                  {showFillHandle ? (
                    <button
                      type="button"
                      className="gm-fill-handle"
                      aria-label="Drag to fill selection"
                      onPointerDown={onFillHandlePointerDown}
                      onDoubleClick={onFillHandleDoubleClick}
                      // Touch-drag on the handle fills instead of scrolling the viewport.
                      style={{ touchAction: "none" }}
                      tabIndex={-1}
                    />
                  ) : null}
                </td>
              );
            })}
          </tr>
        );
  };

  return (
    // biome-ignore lint/a11y/noRedundantRoles: inner <table> is role=presentation (see GridViewport), so the rowgroup role is required, not redundant.
    <tbody role="rowgroup">
      {activeAbove && activeRowExtra != null ? (
        <React.Fragment key="gm-active-above">
          {spacerRow(activeRowExtra * rowHeight, "gm-sp-active-top")}
          {renderDataRow(activeRowExtra)}
          {spacerRow((firstVisibleRowIndex - activeRowExtra - 1) * rowHeight, "gm-sp-active-gap")}
        </React.Fragment>
      ) : (
        spacerRow(topSpacerHeight, "gm-sp-top")
      )}

      {renderedRows.map((_row, visibleRowOffset: number) =>
        renderDataRow(firstVisibleRowIndex + visibleRowOffset)
      )}

      {activeBelow && activeRowExtra != null ? (
        <React.Fragment key="gm-active-below">
          {spacerRow((activeRowExtra - lastVisibleRowIndex) * rowHeight, "gm-sp-active-gapb")}
          {renderDataRow(activeRowExtra)}
          {spacerRow((displayRows.length - activeRowExtra - 1) * rowHeight, "gm-sp-active-bottom")}
        </React.Fragment>
      ) : (
        spacerRow(bottomSpacerHeight, "gm-sp-bottom")
      )}

      {displayRows.length === 0 && (
        // biome-ignore lint/a11y/noRedundantRoles: presentation table (see GridViewport) requires the explicit row role.
        <tr role="row">
          {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: gridcell by the APG Grid pattern; the presentation table removes the implicit cell role. */}
          <td role="gridcell"
            colSpan={visibleColumns.length + 1}
            aria-colindex={1}
            aria-colspan={visibleColumns.length + 1}
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
