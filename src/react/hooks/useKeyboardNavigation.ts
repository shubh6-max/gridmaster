import { useEffect } from "react";
import type {
  GridHistoryState,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
} from "../../core/types";
import {
  KEYBOARD_KEYS,
} from "../../core/constants";
import {
  navigateByKey,
  getCurrentCell,
  type GridBounds,
} from "../../core/features/navigation";
import {
  canRedo,
  canUndo,
  historyReducer,
  redoHistory,
  undoHistory,
} from "../../core/state/historyReducer";
import {
  hasColumnSelection,
  hasRowSelection,
  selectAllCells,
} from "../../core/state/selectionState";

type UseKeyboardNavigationParams<T extends GridRow = GridRow> = {
  containerRef: React.RefObject<HTMLElement | null>;
  rows: T[];
  columns: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  setSelection: React.Dispatch<React.SetStateAction<GridSelectionState>>;
  history: GridHistoryState;
  setHistory: React.Dispatch<React.SetStateAction<GridHistoryState>>;
  enableUndoRedo?: boolean;
  enableClipboard?: boolean;
  enableEditing?: boolean;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onStartEdit?: (initialValue?: string) => void;
  onCancelEdit?: () => void;
  onCopyFormat?: () => boolean | void;
  onPasteFormat?: () => boolean | void;
  onCancelFormatPainter?: () => void;
  onToggleBold?: () => boolean | void;
  onToggleItalic?: () => boolean | void;
  onToggleUnderline?: () => boolean | void;
  isEditing?: boolean;
  isFormatPainterActive?: boolean;
};

function isTypingElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    (el as HTMLElement).isContentEditable === true
  );
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
  const isSingleCell =
    range.startRow === range.endRow && range.startCol === range.endCol;

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

export function useKeyboardNavigation<T extends GridRow = GridRow>({
  containerRef,
  rows,
  columns,
  selection,
  setSelection,
  history,
  setHistory,
  enableUndoRedo = true,
  enableClipboard = true,
  enableEditing = true,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onStartEdit,
  onCancelEdit,
  onCopyFormat,
  onPasteFormat,
  onCancelFormatPainter,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
  isEditing = false,
  isFormatPainterActive = false,
}: UseKeyboardNavigationParams<T>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const bounds: GridBounds = {
      totalRows: rows.length,
      totalCols: columns.length,
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeInsideGrid =
        document.activeElement === container || container.contains(document.activeElement);

      if (!activeInsideGrid && !isTypingElement(event.target)) {
        return;
      }

      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      const key = event.key;
      const altAndCtrlOrMeta = event.altKey && ctrlOrMeta;

      if (altAndCtrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.C) {
        event.preventDefault();
        onCopyFormat?.();
        return;
      }

      if (altAndCtrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.V) {
        event.preventDefault();
        onPasteFormat?.();
        return;
      }

      if (enableUndoRedo && ctrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.Z && !event.shiftKey) {
        event.preventDefault();
        if (canUndo(history)) {
          setHistory((prev) => historyReducer(prev, undoHistory()));
        }
        return;
      }

      if (
        enableUndoRedo &&
        ctrlOrMeta &&
        (key.toLowerCase() === KEYBOARD_KEYS.Y ||
          (key.toLowerCase() === KEYBOARD_KEYS.Z && event.shiftKey))
      ) {
        event.preventDefault();
        if (canRedo(history)) {
          setHistory((prev) => historyReducer(prev, redoHistory()));
        }
        return;
      }

      if (enableClipboard && ctrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.C) {
        event.preventDefault();
        onCopy?.();
        return;
      }

      if (!isEditing && ctrlOrMeta && key.toLowerCase() === "b") {
        event.preventDefault();
        onToggleBold?.();
        return;
      }

      if (!isEditing && ctrlOrMeta && key.toLowerCase() === "i") {
        event.preventDefault();
        onToggleItalic?.();
        return;
      }

      if (!isEditing && ctrlOrMeta && key.toLowerCase() === "u") {
        event.preventDefault();
        onToggleUnderline?.();
        return;
      }

      if (enableClipboard && enableEditing && ctrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.X) {
        event.preventDefault();
        onCut?.();
        return;
      }

      if (enableClipboard && enableEditing && ctrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.V) {
        event.preventDefault();
        onPaste?.();
        return;
      }

      if (ctrlOrMeta && key.toLowerCase() === KEYBOARD_KEYS.A) {
        event.preventDefault();
        setSelection(selectAllCells(rows.length, columns.length));
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
        setSelection((prev) => selectAxisByArrowShortcut(prev, key, bounds));
        return;
      }

      if (isEditing) {
        if (key === KEYBOARD_KEYS.ESCAPE) {
          event.preventDefault();
          onCancelEdit?.();
        }
        return;
      }

      if (isFormatPainterActive && key === KEYBOARD_KEYS.ESCAPE) {
        event.preventDefault();
        onCancelFormatPainter?.();
        return;
      }

      if (
        key === KEYBOARD_KEYS.ARROW_UP ||
        key === KEYBOARD_KEYS.ARROW_DOWN ||
        key === KEYBOARD_KEYS.ARROW_LEFT ||
        key === KEYBOARD_KEYS.ARROW_RIGHT ||
        key === KEYBOARD_KEYS.TAB ||
        key === KEYBOARD_KEYS.ENTER ||
        key === "Home" ||
        key === "End"
      ) {
        event.preventDefault();
        setSelection((prev) =>
          navigateByKey(prev, key, bounds, {
            shiftKey: event.shiftKey,
            reverse:
              key === KEYBOARD_KEYS.TAB
                ? event.shiftKey
                : key === KEYBOARD_KEYS.ENTER
                ? event.shiftKey
                : false,
          })
        );
        return;
      }

      if (enableEditing && (key === KEYBOARD_KEYS.DELETE || key === KEYBOARD_KEYS.BACKSPACE)) {
        event.preventDefault();
        onDelete?.();
        return;
      }

      if (enableEditing && key === KEYBOARD_KEYS.F2) {
        event.preventDefault();
        onStartEdit?.();
        return;
      }

      if (
        enableEditing &&
        !ctrlOrMeta &&
        !event.altKey &&
        key.length === 1 &&
        !hasRowSelection(selection) &&
        !hasColumnSelection(selection) &&
        !isTypingElement(event.target)
      ) {
        event.preventDefault();
        onStartEdit?.(key);
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    containerRef,
    rows,
    columns,
    selection,
    setSelection,
    history,
    setHistory,
    enableUndoRedo,
    enableClipboard,
    enableEditing,
    onCopy,
    onCut,
    onPaste,
    onDelete,
    onStartEdit,
    onCancelEdit,
    onCopyFormat,
    onPasteFormat,
    onCancelFormatPainter,
    onToggleBold,
    onToggleItalic,
    onToggleUnderline,
    isEditing,
    isFormatPainterActive,
  ]);
}
