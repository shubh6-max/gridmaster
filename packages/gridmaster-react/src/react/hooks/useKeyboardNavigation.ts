import { useEffect, useRef } from "react";
import type {
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
} from "../../core/types";
import { KEYBOARD_KEYS } from "../../core/constants";
import {
  navigateByKey,
  getCurrentCell,
  type GridBounds,
  type GridCellValueGetter,
} from "../../core/features/navigation";
import {
  hasColumnSelection,
  hasRowSelection,
  selectAllCells,
} from "../../core/state/selectionState";

type UseKeyboardNavigationParams<T extends object = GridRow> = {
  containerRef: React.RefObject<HTMLElement | null>;
  rows: T[];
  columns: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  setSelection: React.Dispatch<React.SetStateAction<GridSelectionState>>;
  // Hook-level undo/redo (useGridMaster): they step history AND notify a controlled host.
  onUndo?: () => boolean;
  onRedo?: () => boolean;
  enableUndoRedo?: boolean;
  enableClipboard?: boolean;
  enableEditing?: boolean;
  // Resolved selection flags (enableSelection already folded in). Defaults to true; false keeps the
  // active-cell cursor working but never creates that selection kind from the keyboard.
  enableRangeSelection?: boolean;
  enableRowSelection?: boolean;
  enableColumnSelection?: boolean;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onStartEdit?: (initialValue?: string) => void;
  onCommitEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveShortcut?: () => void;
  onCopyFormat?: () => boolean | void;
  onPasteFormat?: () => boolean | void;
  onCancelFormatPainter?: () => void;
  onToggleBold?: () => boolean | void;
  onToggleItalic?: () => boolean | void;
  onToggleUnderline?: () => boolean | void;
  isEditing?: boolean;
  isFormatPainterActive?: boolean;
  /** Tab behaviour (A-013); `"cells"` (default) moves between cells, `"native"` never intercepts Tab. */
  tabNavigation?: "cells" | "native";
  /** Evaluated DISPLAY value at a display (row, col) — drives Ctrl+Arrow data-edge jumps. */
  getCellValue?: GridCellValueGetter;
  /** Row height in px; used with the viewport height to size PageUp/PageDown. */
  rowHeight?: number;
};

function isTypingElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable === true;
}

/**
 * Targets that own their own keys (A-013): toolbar buttons/selects, links, the in-cell editor,
 * menus. Cell-cursor keys must not be stolen from them. The listener is attached to the viewport,
 * so most of these never reach it; this guard covers controls that live inside the viewport.
 */
function isExemptTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (
    tag === "BUTTON" ||
    tag === "SELECT" ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "A"
  ) {
    return true;
  }
  if (el.isContentEditable === true) return true;
  return el.closest?.("[role=menu], [role=menuitem]") != null;
}

function selectAxisByArrowShortcut(
  state: GridSelectionState,
  key: string,
  bounds: GridBounds
): GridSelectionState {
  if (bounds.totalRows === 0 || bounds.totalCols === 0) {
    return state;
  }

  const current = getCurrentCell(state);
  const rowIndex = Math.min(Math.max(current.row, 0), bounds.totalRows - 1);
  const colIndex = Math.min(Math.max(current.col, 0), bounds.totalCols - 1);
  const lastRow = bounds.totalRows - 1;
  const lastCol = bounds.totalCols - 1;
  const range = state.range
    ? {
        startRow: Math.min(state.range.start.row, state.range.end.row),
        endRow: Math.max(state.range.start.row, state.range.end.row),
        startCol: Math.min(state.range.start.col, state.range.end.col),
        endCol: Math.max(state.range.start.col, state.range.end.col),
      }
    : {
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: colIndex,
        endCol: colIndex,
      };
  const isSingleCell = range.startRow === range.endRow && range.startCol === range.endCol;

  let startRow = range.startRow;
  let endRow = range.endRow;
  let startCol = range.startCol;
  let endCol = range.endCol;

  if (key === KEYBOARD_KEYS.ARROW_LEFT || key === KEYBOARD_KEYS.ARROW_RIGHT) {
    if (isSingleCell) {
      startRow = rowIndex;
      endRow = rowIndex;
      startCol = 0;
      endCol = lastCol;
    } else if (key === KEYBOARD_KEYS.ARROW_LEFT) {
      startCol = 0;
    } else {
      endCol = lastCol;
    }
  } else if (key === KEYBOARD_KEYS.ARROW_UP || key === KEYBOARD_KEYS.ARROW_DOWN) {
    if (isSingleCell) {
      startRow = 0;
      endRow = lastRow;
      startCol = colIndex;
      endCol = colIndex;
    } else if (key === KEYBOARD_KEYS.ARROW_UP) {
      startRow = 0;
    } else {
      endRow = lastRow;
    }
  } else {
    return state;
  }

  const fullWidth = startCol === 0 && endCol === lastCol;
  const fullHeight = startRow === 0 && endRow === lastRow;
  const selectedRows = new Set<number>();
  const selectedCols = new Set<number>();

  if (fullWidth) {
    for (let row = startRow; row <= endRow; row++) {
      selectedRows.add(row);
    }
  }

  if (fullHeight) {
    for (let col = startCol; col <= endCol; col++) {
      selectedCols.add(col);
    }
  }

  return {
    mode:
      fullWidth && fullHeight
        ? "all"
        : fullWidth
          ? "row"
          : fullHeight
            ? "column"
            : isSingleCell
              ? "cell"
              : "range",
    anchor: { row: startRow, col: startCol },
    cursor: { row: endRow, col: endCol },
    range: {
      start: { row: startRow, col: startCol },
      end: { row: endRow, col: endCol },
    },
    selectedRows,
    selectedCols,
  };
}

export function useKeyboardNavigation<T extends object = GridRow>({
  containerRef,
  rows,
  columns,
  selection,
  setSelection,
  onUndo,
  onRedo,
  enableUndoRedo = true,
  enableClipboard = true,
  enableEditing = true,
  enableRangeSelection = true,
  enableRowSelection = true,
  enableColumnSelection = true,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onSaveShortcut,
  onCopyFormat,
  onPasteFormat,
  onCancelFormatPainter,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
  isEditing = false,
  isFormatPainterActive = false,
  tabNavigation = "cells",
  getCellValue,
  rowHeight,
}: UseKeyboardNavigationParams<T>) {
  // All params flow through one ref so the keydown listener is subscribed ONCE (A-013): it never
  // re-subscribes per render, yet always reads the latest values and callbacks.
  const latest = useRef({
    rows,
    columns,
    selection,
    setSelection,
    onUndo,
    onRedo,
    enableUndoRedo,
    enableClipboard,
    enableEditing,
    enableRangeSelection,
    enableRowSelection,
    enableColumnSelection,
    onCopy,
    onCut,
    onPaste,
    onDelete,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onSaveShortcut,
    onCopyFormat,
    onPasteFormat,
    onCancelFormatPainter,
    onToggleBold,
    onToggleItalic,
    onToggleUnderline,
    isEditing,
    isFormatPainterActive,
    tabNavigation,
    getCellValue,
    rowHeight,
  });
  latest.current = {
    rows,
    columns,
    selection,
    setSelection,
    onUndo,
    onRedo,
    enableUndoRedo,
    enableClipboard,
    enableEditing,
    enableRangeSelection,
    enableRowSelection,
    enableColumnSelection,
    onCopy,
    onCut,
    onPaste,
    onDelete,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onSaveShortcut,
    onCopyFormat,
    onPasteFormat,
    onCancelFormatPainter,
    onToggleBold,
    onToggleItalic,
    onToggleUnderline,
    isEditing,
    isFormatPainterActive,
    tabNavigation,
    getCellValue,
    rowHeight,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // IME: a composing keystroke (or the legacy 229 keyCode) belongs to the input method.
      if (event.isComposing || event.keyCode === 229) return;

      const p = latest.current;
      const target = event.target;
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      const key = event.key;

      // The listener lives on the viewport, so the target is already inside THIS grid. Interactive
      // controls and the in-cell editor own their keys; let everything through to them except the
      // global Save shortcut (so Ctrl+S commits an edit as before).
      if (isExemptTarget(target) && !(ctrlOrMeta && key.toLowerCase() === "s")) {
        return;
      }

      const bounds: GridBounds = {
        totalRows: p.rows.length,
        totalCols: p.columns.length,
      };

      const allowsSelectionMode = (selectionMode: GridSelectionState["mode"]) =>
        selectionMode === "row"
          ? p.enableRowSelection
          : selectionMode === "column"
            ? p.enableColumnSelection
            : selectionMode === "range" || selectionMode === "all"
              ? p.enableRangeSelection
              : true;

      const altAndCtrlOrMeta = event.altKey && ctrlOrMeta;

      if (altAndCtrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.C) {
        event.preventDefault();
        p.onCopyFormat?.();
        return;
      }

      if (altAndCtrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.V) {
        event.preventDefault();
        p.onPasteFormat?.();
        return;
      }

      if (
        p.enableUndoRedo &&
        ctrlOrMeta &&
        key.toLowerCase() === KEYBOARD_KEYS.Z &&
        !event.shiftKey
      ) {
        event.preventDefault();
        p.onUndo?.();
        return;
      }

      if (
        p.enableUndoRedo &&
        ctrlOrMeta &&
        (key.toLowerCase() === KEYBOARD_KEYS.Y ||
          (key.toLowerCase() === KEYBOARD_KEYS.Z && event.shiftKey))
      ) {
        event.preventDefault();
        p.onRedo?.();
        return;
      }

      if (p.enableClipboard && ctrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.C) {
        event.preventDefault();
        p.onCopy?.();
        return;
      }

      if (!p.isEditing && ctrlOrMeta && key.toLowerCase() === "b") {
        event.preventDefault();
        p.onToggleBold?.();
        return;
      }

      if (!p.isEditing && ctrlOrMeta && key.toLowerCase() === "i") {
        event.preventDefault();
        p.onToggleItalic?.();
        return;
      }

      if (!p.isEditing && ctrlOrMeta && key.toLowerCase() === "u") {
        event.preventDefault();
        p.onToggleUnderline?.();
        return;
      }

      if (p.enableClipboard && p.enableEditing && ctrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.X) {
        event.preventDefault();
        p.onCut?.();
        return;
      }

      if (p.enableClipboard && p.enableEditing && ctrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.V) {
        event.preventDefault();
        p.onPaste?.();
        return;
      }

      if (ctrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.A) {
        event.preventDefault();
        if (allowsSelectionMode("all")) {
          p.setSelection(selectAllCells(p.rows.length, p.columns.length));
        }
        return;
      }

      if (ctrlOrMeta && key.toLowerCase() === "s") {
        event.preventDefault();
        if (p.isEditing) {
          p.onCommitEdit?.();
          window.requestAnimationFrame(() => {
            p.onSaveShortcut?.();
          });
          return;
        }
        p.onSaveShortcut?.();
        return;
      }

      if (
        ctrlOrMeta &&
        event.shiftKey &&
        (key === KEYBOARD_KEYS.ARROW_UP ||
          key === KEYBOARD_KEYS.ARROW_DOWN ||
          key === KEYBOARD_KEYS.ARROW_LEFT ||
          key === KEYBOARD_KEYS.ARROW_RIGHT)
      ) {
        event.preventDefault();
        p.setSelection((prev) => {
          const next = selectAxisByArrowShortcut(prev, key, bounds);
          return allowsSelectionMode(next.mode) ? next : prev;
        });
        return;
      }

      if (p.isEditing) {
        if (key === KEYBOARD_KEYS.ESCAPE) {
          event.preventDefault();
          p.onCancelEdit?.();
        }
        return;
      }

      if (p.isFormatPainterActive && key === KEYBOARD_KEYS.ESCAPE) {
        event.preventDefault();
        p.onCancelFormatPainter?.();
        return;
      }

      // Tab leaves the grid at the edges (WCAG 2.1.2); `"native"` never intercepts it.
      if (key === KEYBOARD_KEYS.TAB) {
        if (p.tabNavigation === "native") return;

        const current = getCurrentCell(p.selection);
        const lastRow = Math.max(bounds.totalRows - 1, 0);
        const lastCol = Math.max(bounds.totalCols - 1, 0);
        const atLastCell = !event.shiftKey && current.row === lastRow && current.col === lastCol;
        const atFirstCell = event.shiftKey && current.row === 0 && current.col === 0;
        if (atLastCell || atFirstCell) {
          // Do NOT preventDefault: let focus move out of the grid.
          return;
        }

        event.preventDefault();
        p.setSelection((prev) => navigateByKey(prev, KEYBOARD_KEYS.TAB, bounds, { reverse: event.shiftKey }));
        return;
      }

      if (
        key === KEYBOARD_KEYS.ARROW_UP ||
        key === KEYBOARD_KEYS.ARROW_DOWN ||
        key === KEYBOARD_KEYS.ARROW_LEFT ||
        key === KEYBOARD_KEYS.ARROW_RIGHT ||
        key === KEYBOARD_KEYS.ENTER ||
        key === "Home" ||
        key === "End" ||
        key === "PageUp" ||
        key === "PageDown"
      ) {
        event.preventDefault();

        // Page size = whole visible rows in the viewport; fall back when the height is unmeasurable.
        const viewportHeight = container.clientHeight;
        const rh = p.rowHeight && p.rowHeight > 0 ? p.rowHeight : 0;
        const pageSize =
          viewportHeight > 0 && rh > 0 ? Math.max(1, Math.floor(viewportHeight / rh) - 1) : 10;

        p.setSelection((prev) =>
          navigateByKey(prev, key, bounds, {
            // Shift extends a range; without range selection it is a plain cursor move.
            shiftKey: event.shiftKey && p.enableRangeSelection,
            reverse: key === KEYBOARD_KEYS.ENTER ? event.shiftKey : false,
            ctrlKey: ctrlOrMeta,
            pageSize,
            getValue: p.getCellValue,
          })
        );
        return;
      }

      if (p.enableEditing && (key === KEYBOARD_KEYS.DELETE || key === KEYBOARD_KEYS.BACKSPACE)) {
        event.preventDefault();
        p.onDelete?.();
        return;
      }

      if (p.enableEditing && key === KEYBOARD_KEYS.F2) {
        event.preventDefault();
        p.onStartEdit?.();
        return;
      }

      if (
        p.enableEditing &&
        !ctrlOrMeta &&
        !event.altKey &&
        key.length === 1 &&
        !hasRowSelection(p.selection) &&
        !hasColumnSelection(p.selection) &&
        !isTypingElement(event.target)
      ) {
        event.preventDefault();
        p.onStartEdit?.(key);
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [containerRef]);
}
