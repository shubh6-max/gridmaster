import React from "react";
import { GridBody } from "./GridBody";
import { GridContextMenu } from "./GridContextMenu";
import { GridHeader } from "./GridHeader";
import { resolveCellReadonly } from "../core/features/readonly";
import { setActiveCell } from "../core/state/selectionState";
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
    columns,
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
    emitCellChange,
    formulaEvaluator,
    undo,
    redo,
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
    // Resolved A-004 flags (defaults = the pre-A-004 behaviour for a hand-built provider value).
    enableEditing = mode !== "readonly",
    enableClipboard = true,
    enableUndoRedo = true,
    enableRangeSelection = true,
    enableRowSelection = true,
    enableColumnSelection = true,
    canFormat = true,
    enableCellColoring = true,
    enableWrapText = true,
  } = useGridContext();
  const { toggleBold, toggleItalic, toggleUnderline } = useCellFormatting({
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
    canFormat,
    enableCellColoring,
    enableWrapText,
  });

  const { clearSelection, copy, cut, paste } = useClipboard({
    rows,
    displayRows,
    displayRowIndexes,
    columns: visibleColumns,
    allColumns: columns,
    selection,
    clipboard,
    setClipboard,
    updateRows,
    enableClipboard,
    enableEditing,
    isCellReadonly: (sourceRowIndex, column) =>
      resolveCellReadonly(props, history.present.cellMeta, rows[sourceRowIndex], sourceRowIndex, column),
    emitCellChange,
    formulaEvaluator,
    clipboardValueMode: props.clipboardValueMode,
    locale: props.locale,
    onCopy: props.onCopy,
    onPaste: props.onPaste,
    onClipboardError: props.onClipboardError,
  });

  // Evaluated DISPLAY value at display coordinates — drives Ctrl+Arrow data-edge jumps so hidden
  // columns / filtered rows are naturally excluded (the caller already works in display space).
  const getCellValue = (displayRowIndex: number, displayColIndex: number): unknown => {
    const sourceRowIndex = displayRowIndexes[displayRowIndex];
    const column = visibleColumns[displayColIndex];
    if (sourceRowIndex == null || !column) return undefined;
    return formulaEvaluator.getCellDisplayString(sourceRowIndex, column.key);
  };

  useKeyboardNavigation({
    containerRef: viewportRef,
    rows: displayRows,
    columns: visibleColumns,
    selection,
    setSelection,
    tabNavigation: props.tabNavigation,
    getCellValue,
    rowHeight,
    onUndo: undo,
    onRedo: redo,
    enableUndoRedo,
    enableClipboard,
    enableEditing,
    enableRangeSelection,
    enableRowSelection,
    enableColumnSelection,
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

  // A-009 / F-004: reset the cursor to A1 and scroll to the top ONLY when the view's filters / sort /
  // colour filters / colour sort IDENTITY changes — never on a mere row-count change (insert, delete,
  // undo, paste-append, live data, hide column). That previously jumped the user to A1 and overrode
  // `insertRow`'s active cell; the clamp effect in useGridMaster already keeps the cursor in bounds
  // when rows shrink, and scroll position is now preserved across insert/delete.
  const viewIdentityRef = React.useRef({ filters, sort, colorFilters, colorSort });
  const didMountRef = React.useRef(false);
  React.useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const prev = viewIdentityRef.current;
    const viewChanged =
      prev.filters !== filters ||
      prev.sort !== sort ||
      prev.colorFilters !== colorFilters ||
      prev.colorSort !== colorSort;
    viewIdentityRef.current = { filters, sort, colorFilters, colorSort };

    // Skip the first run (mount): there is nothing to reset to.
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (!viewChanged) return;

    container.scrollTo({ left: 0, top: 0 });
    setSelection((prevSelection) => {
      if (!displayRows.length || !visibleColumns.length) {
        return prevSelection;
      }
      // Already at the origin: keep the same object so onSelectionChange does not re-emit.
      if (
        prevSelection.cursor?.row === 0 &&
        prevSelection.cursor.col === 0 &&
        prevSelection.anchor?.row === 0 &&
        prevSelection.anchor.col === 0 &&
        prevSelection.mode === "cell"
      ) {
        return prevSelection;
      }
      return setActiveCell(prevSelection, { row: 0, col: 0 });
    });
  }, [
    colorFilters,
    colorSort,
    displayRows.length,
    filters,
    setSelection,
    sort,
    viewportRef,
    visibleColumns.length,
  ]);

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

      if (nextScrollLeft !== container.scrollLeft || nextScrollTop !== container.scrollTop) {
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

  // A1 (WAI-ARIA APG "Grid"): the focus owner carries the grid role so there is one tab stop. The
  // TITLE header row is the single exposed header row (see GridHeader), so the row axis is the display
  // rows plus 1; the column axis is the visible columns plus the row-header column.
  const headerRowsExposed = 1;
  const ariaMultiselectable =
    enableRangeSelection || enableRowSelection || enableColumnSelection || undefined;

  // A2 (APG Grid): focus stays on the grid element; the active (cursor) cell is exposed via
  // aria-activedescendant. `gridId` prefixes every data cell's DOM id (GridBody), unique and stable
  // per grid instance. GridBody keeps the active row mounted under virtualization, so the referenced
  // id is present whenever the cursor is in range — we only point at it then (never a dangling IDREF).
  const gridId = React.useId();
  const cursor = selection.cursor;
  const activeDescendant =
    cursor &&
    cursor.row >= 0 &&
    cursor.row < displayRows.length &&
    cursor.col >= 0 &&
    cursor.col < visibleColumns.length
      ? `${gridId}-r${cursor.row}-c${cursor.col}`
      : undefined;

  return (
    <div
      ref={viewportRef}
      className="gm-viewport"
      role="grid"
      aria-rowcount={displayRows.length + headerRowsExposed}
      aria-colcount={visibleColumns.length + 1}
      aria-multiselectable={ariaMultiselectable}
      aria-readonly={enableEditing ? undefined : true}
      aria-activedescendant={activeDescendant}
      onMouseDownCapture={(event) => {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName ?? "";
        const isInteractive =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          tag === "BUTTON" ||
          tag === "A";
        const isGridCellTarget = target?.closest?.(".gm-td") || target?.closest?.(".gm-rh");

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
        role="presentation"
        style={{
          borderCollapse: "collapse",
          tableLayout: "fixed",
          width: "max-content",
          minWidth: "100%",
        }}
      >
        <GridHeader />
        <GridBody cellIdPrefix={gridId} />
      </table>
      <GridContextMenu />
    </div>
  );
}

export default GridViewport;
