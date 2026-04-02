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
