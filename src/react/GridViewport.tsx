import React from "react";
import { GridBody } from "./GridBody";
import { GridContextMenu } from "./GridContextMenu";
import { GridHeader } from "./GridHeader";
import { useGridContext } from "./context/GridContext";
import { useCellFormatting } from "./hooks/useCellFormatting";
import { useClipboard } from "./hooks/useClipboard";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";

export function GridViewport() {
  const {
    props,
    viewportRef,
    rows,
    displayRows,
    displayRowIndexes,
    visibleColumns,
    selection,
    setSelection,
    sort,
    filters,
    colorFilters,
    colorSort,
    editingCell,
    history,
    setHistory,
    clipboard,
    setClipboard,
    updateRows,
    height,
    rowHeight,
    headerHeight,
    mode,
    startEditing,
    commitEditing,
    cancelEditing,
    isFormulaEditing,
    formatPainterMode,
    copyFormat,
    pasteFormatToSelection,
    stopFormatPainter,
  } = useGridContext();
  const {
    toggleBold,
    toggleItalic,
    toggleUnderline,
  } = useCellFormatting({
    history,
    setHistory,
    selection,
    displayRows,
    displayRowIndexes,
    visibleColumns,
    focusViewport: () => {
      viewportRef.current?.focus({ preventScroll: true });
    },
    historyLimit: props.historyLimit,
    preserveRowReferences: props.rowPatchMode,
  });

  const { clearSelection, copy, cut, paste } = useClipboard({
    rows,
    displayRows,
    displayRowIndexes,
    columns: visibleColumns,
    selection,
    clipboard,
    setClipboard,
    updateRows,
  });

  useKeyboardNavigation({
    containerRef: viewportRef,
    rows: displayRows,
    columns: visibleColumns,
    selection,
    setSelection,
    history,
    setHistory,
    historyLimit: props.historyLimit,
    preserveRowReferences: props.rowPatchMode,
    enableUndoRedo: props.enableUndoRedo,
    enableClipboard: true,
    enableEditing: mode !== "readonly",
    onCopy: copy,
    onCut: cut,
    onPaste: paste,
    onDelete: clearSelection,
    onStartEdit: (initialValue) => {
      startEditing(undefined, initialValue);
    },
    onCommitEdit: commitEditing,
    onCancelEdit: cancelEditing,
    onSaveShortcut: props.onSaveShortcut,
    isEditing: Boolean(editingCell),
    onCopyFormat: copyFormat,
    onPasteFormat: pasteFormatToSelection,
    onCancelFormatPainter: stopFormatPainter,
    onToggleBold: toggleBold,
    onToggleItalic: toggleItalic,
    onToggleUnderline: toggleUnderline,
    isFormatPainterActive: formatPainterMode !== "idle",
  });

  React.useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    container.scrollTo({
      left: 0,
      top: 0,
    });
    setSelection((prev) => {
      if (!displayRows.length || !visibleColumns.length) {
        return prev;
      }
      return {
        ...prev,
        cursor: { row: 0, col: 0 },
        anchor: { row: 0, col: 0 },
      };
    });
  }, [colorFilters, colorSort, displayRows.length, filters, setSelection, sort, viewportRef, visibleColumns.length]);

  React.useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const frameId = window.requestAnimationFrame(() => {
      const activeCell = container.querySelector<HTMLElement>(".gm-td.gm-active");
      if (!activeCell) {
        if (!props.virtualizeRows || selection.cursor == null) return;

        const topInset = 24 + headerHeight;
        const rowTop = topInset + selection.cursor.row * rowHeight;
        const rowBottom = rowTop + rowHeight;
        let nextScrollTop = container.scrollTop;

        if (rowTop < container.scrollTop + topInset) {
          nextScrollTop = Math.max(rowTop - topInset, 0);
        } else if (rowBottom > container.scrollTop + container.clientHeight) {
          nextScrollTop = Math.max(rowBottom - container.clientHeight, 0);
        }

        if (nextScrollTop !== container.scrollTop) {
          container.scrollTo({
            left: container.scrollLeft,
            top: nextScrollTop,
          });
        }
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const cellRect = activeCell.getBoundingClientRect();
      const rowCells = activeCell.parentElement
        ? Array.from(activeCell.parentElement.children)
        : [];

      let leftInset = 0;
      for (const cell of rowCells) {
        if (!(cell instanceof HTMLElement)) continue;

        if (window.getComputedStyle(cell).position === "sticky") {
          const stickyRect = cell.getBoundingClientRect();
          leftInset = Math.max(leftInset, stickyRect.right - containerRect.left);
        }
      }

      const header = container.querySelector("thead");
      const headerRect = header?.getBoundingClientRect();
      const topInset = headerRect ? Math.max(0, headerRect.bottom - containerRect.top) : 0;

      const visibleLeft = containerRect.left + leftInset;
      const visibleRight = containerRect.left + container.clientWidth;
      const visibleTop = containerRect.top + topInset;
      const visibleBottom = containerRect.top + container.clientHeight;

      let nextScrollLeft = container.scrollLeft;
      let nextScrollTop = container.scrollTop;

      if (cellRect.left < visibleLeft) {
        nextScrollLeft -= visibleLeft - cellRect.left;
      } else if (cellRect.right > visibleRight) {
        nextScrollLeft += cellRect.right - visibleRight;
      }

      if (cellRect.top < visibleTop) {
        nextScrollTop -= visibleTop - cellRect.top;
      } else if (cellRect.bottom > visibleBottom) {
        nextScrollTop += cellRect.bottom - visibleBottom;
      }

      if (
        nextScrollLeft !== container.scrollLeft ||
        nextScrollTop !== container.scrollTop
      ) {
        container.scrollTo({
          left: Math.max(nextScrollLeft, 0),
          top: Math.max(nextScrollTop, 0),
        });
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    headerHeight,
    props.virtualizeRows,
    rowHeight,
    selection.cursor?.row,
    selection.cursor?.col,
    selection.mode,
  ]);

  return (
    <div
      ref={viewportRef}
      className="gm-viewport"
      onMouseDownCapture={(event) => {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName ?? "";
        const isInteractive =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          tag === "BUTTON" ||
          tag === "A";
        const isGridCellTarget =
          target?.closest?.(".gm-td") || target?.closest?.(".gm-rh");

        if (!isInteractive && !(isFormulaEditing && isGridCellTarget)) {
          viewportRef.current?.focus({ preventScroll: true });
        }
      }}
      style={{
        position: "relative",
        overflow: "auto",
        height: height ?? "72vh",
        maxHeight: height ?? "72vh",
        outline: "none",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#fff",
      }}
      tabIndex={0}
    >
      <table
        className="gm-table"
        style={{
          borderCollapse: "collapse",
          tableLayout: "fixed",
          width: "max-content",
          minWidth: "100%",
        }}
      >
        <GridHeader />
        <GridBody />
      </table>
      <GridContextMenu />
    </div>
  );
}

export default GridViewport;
