import React from "react";
import { GridBody } from "./GridBody";
import { GridHeader } from "./GridHeader";
import { useGridContext } from "./context/GridContext";
import { useClipboard } from "./hooks/useClipboard";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";

export function GridViewport() {
  const {
    rows,
    displayRows,
    displayRowIndexes,
    visibleColumns,
    selection,
    setSelection,
    editingCell,
    history,
    setHistory,
    clipboard,
    setClipboard,
    updateRows,
    height,
    mode,
    startEditing,
    cancelEditing,
  } = useGridContext();

  const containerRef = React.useRef<HTMLDivElement>(null);
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
    containerRef,
    rows: displayRows,
    columns: visibleColumns,
    selection,
    setSelection,
    history,
    setHistory,
    enableUndoRedo: true,
    enableClipboard: true,
    enableEditing: mode !== "readonly",
    onCopy: copy,
    onCut: cut,
    onPaste: paste,
    onDelete: clearSelection,
    onStartEdit: (initialValue) => {
      startEditing(undefined, initialValue);
    },
    onCancelEdit: cancelEditing,
    isEditing: Boolean(editingCell),
  });

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const frameId = window.requestAnimationFrame(() => {
      const activeCell = container.querySelector<HTMLElement>(".gm-td.gm-active");
      if (!activeCell) return;

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
  }, [selection.cursor?.row, selection.cursor?.col, selection.mode]);

  return (
    <div
      ref={containerRef}
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

        if (!isInteractive) {
          containerRef.current?.focus({ preventScroll: true });
        }
      }}
      style={{
        position: "relative",
        overflow: "auto",
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
    </div>
  );
}

export default GridViewport;
