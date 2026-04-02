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
  isEditing?: boolean;
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
  isEditing = false,
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

      if (isEditing) {
        if (key === KEYBOARD_KEYS.ESCAPE) {
          event.preventDefault();
          onCancelEdit?.();
        }
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
    isEditing,
  ]);
}
