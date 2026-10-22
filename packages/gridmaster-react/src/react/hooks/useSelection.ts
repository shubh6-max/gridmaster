import { useCallback, useEffect, useRef } from "react";
import type { GridResolvedColumnDef, GridRow, GridSelectionState } from "../../core/types";
import {
  selectColumnRange,
  selectRowRange,
  selectSingleColumn,
  selectSingleRow,
  setActiveCell,
  setRangeSelection,
  toggleColumnSelection,
  toggleRowSelection,
} from "../../core/state/selectionState";

type UseSelectionParams<T extends object = GridRow> = {
  rows: T[];
  columns: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  setSelection: React.Dispatch<React.SetStateAction<GridSelectionState>>;
  enableRangeSelection?: boolean;
  enableRowSelection?: boolean;
  enableColumnSelection?: boolean;
  /** Scroll container; when present, a drag near its edges auto-scrolls (A-077). */
  viewportRef?: React.RefObject<HTMLElement | null>;
};

type CellPointerDownOptions = {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  /** PointerEvent.button: 0 = primary. Non-primary (right/middle) never starts a selection (A-077). */
  button?: number;
  clientX?: number;
  clientY?: number;
};

// A-077 edge auto-scroll: within this many px of a viewport edge a drag scrolls toward it, faster the
// closer (and past) the edge, capped so a fast drag cannot overscroll in one frame.
const AUTO_SCROLL_EDGE_PX = 24;
const AUTO_SCROLL_MAX_SPEED_PX = 18;

function autoScrollSpeed(overshoot: number): number {
  return Math.min(AUTO_SCROLL_MAX_SPEED_PX, Math.max(1, Math.ceil(overshoot)));
}

export function useSelection<T extends object = GridRow>({
  rows,
  columns,
  selection,
  setSelection,
  enableRangeSelection = true,
  enableRowSelection = true,
  enableColumnSelection = true,
  viewportRef,
}: UseSelectionParams<T>) {
  const isDraggingRef = useRef(false);
  const pointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragMoveRef = useRef<((event: PointerEvent) => void) | null>(null);

  const totalRows = rows.length;
  const totalCols = columns.length;

  const stopDrag = useCallback(() => {
    isDraggingRef.current = false;
    if (typeof window !== "undefined" && rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = null;
    pointerPosRef.current = null;
    if (typeof document !== "undefined" && dragMoveRef.current) {
      document.removeEventListener("pointermove", dragMoveRef.current);
    }
    dragMoveRef.current = null;
  }, []);

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      // SSR-safe: nothing here runs at render, only inside a pointerdown handler.
      if (typeof window === "undefined") return;
      isDraggingRef.current = true;

      if (!viewportRef) return;
      pointerPosRef.current = { x: clientX, y: clientY };

      const onMove = (event: PointerEvent) => {
        pointerPosRef.current = { x: event.clientX, y: event.clientY };
      };
      dragMoveRef.current = onMove;
      document.addEventListener("pointermove", onMove);

      const step = () => {
        const viewport = viewportRef.current;
        const pos = pointerPosRef.current;
        if (viewport && pos) {
          const rect = viewport.getBoundingClientRect();
          const belowBottom = AUTO_SCROLL_EDGE_PX - (rect.bottom - pos.y);
          const aboveTop = AUTO_SCROLL_EDGE_PX - (pos.y - rect.top);
          const pastRight = AUTO_SCROLL_EDGE_PX - (rect.right - pos.x);
          const pastLeft = AUTO_SCROLL_EDGE_PX - (pos.x - rect.left);

          if (belowBottom > 0) viewport.scrollTop += autoScrollSpeed(belowBottom);
          else if (aboveTop > 0) viewport.scrollTop -= autoScrollSpeed(aboveTop);

          if (pastRight > 0) viewport.scrollLeft += autoScrollSpeed(pastRight);
          else if (pastLeft > 0) viewport.scrollLeft -= autoScrollSpeed(pastLeft);
        }
        rafRef.current = window.requestAnimationFrame(step);
      };
      rafRef.current = window.requestAnimationFrame(step);
    },
    [viewportRef]
  );

  const onCellPointerDown = useCallback(
    (rowIndex: number, colIndex: number, options?: CellPointerDownOptions) => {
      // A-077: ignore non-primary buttons so a right-click never collapses/moves the selection here;
      // the context-menu handler decides whether to keep an existing range.
      if ((options?.button ?? 0) !== 0) return;

      const shiftKey = options?.shiftKey ?? false;

      setSelection((prev) => {
        if (shiftKey && enableRangeSelection && prev.anchor) {
          return setRangeSelection(prev, prev.anchor, { row: rowIndex, col: colIndex });
        }

        return setActiveCell(prev, { row: rowIndex, col: colIndex });
      });

      startDrag(options?.clientX ?? 0, options?.clientY ?? 0);
    },
    [enableRangeSelection, setSelection, startDrag]
  );

  const onCellPointerEnter = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!isDraggingRef.current || !enableRangeSelection) return;

      setSelection((prev) => {
        const anchor = prev.anchor ?? { row: rowIndex, col: colIndex };
        return setRangeSelection(prev, anchor, { row: rowIndex, col: colIndex });
      });
    },
    [setSelection, enableRangeSelection]
  );

  const onRowHeaderClick = useCallback(
    (rowIndex: number, options?: CellPointerDownOptions) => {
      if (!enableRowSelection) {
        // F-008: a disabled selection kind still moves the active-cell cursor (plain-click behaviour).
        setSelection((prev) => setActiveCell(prev, { row: rowIndex, col: 0 }));
        return;
      }

      const shiftKey = options?.shiftKey ?? false;
      const multiKey = (options?.ctrlKey ?? false) || (options?.metaKey ?? false);

      setSelection((prev) => {
        if (shiftKey && prev.anchor) {
          return selectRowRange(prev, prev.anchor.row, rowIndex, totalCols);
        }

        if (multiKey) {
          return toggleRowSelection(prev, rowIndex, totalCols);
        }

        return selectSingleRow(prev, rowIndex, totalCols);
      });
    },
    [enableRowSelection, setSelection, totalCols]
  );

  const onColumnHeaderClick = useCallback(
    (colIndex: number, options?: CellPointerDownOptions) => {
      if (!enableColumnSelection) {
        // F-008: disabled column selection still moves the cursor to that column (plain-click).
        setSelection((prev) => setActiveCell(prev, { row: prev.cursor?.row ?? 0, col: colIndex }));
        return;
      }

      const shiftKey = options?.shiftKey ?? false;
      const multiKey = (options?.ctrlKey ?? false) || (options?.metaKey ?? false);

      setSelection((prev) => {
        if (shiftKey && prev.anchor) {
          return selectColumnRange(prev, prev.anchor.col, colIndex, totalRows);
        }

        if (multiKey) {
          return toggleColumnSelection(prev, colIndex, totalRows);
        }

        return selectSingleColumn(prev, colIndex, totalRows);
      });
    },
    [enableColumnSelection, setSelection, totalRows]
  );

  const onSelectAll = useCallback(() => {
    // Select-all is the biggest range there is.
    if (!enableRangeSelection) return;

    setSelection({
      mode: "all",
      anchor: { row: 0, col: 0 },
      cursor: { row: Math.max(totalRows - 1, 0), col: Math.max(totalCols - 1, 0) },
      range: {
        start: { row: 0, col: 0 },
        end: { row: Math.max(totalRows - 1, 0), col: Math.max(totalCols - 1, 0) },
      },
      selectedRows: new Set(Array.from({ length: totalRows }, (_, i) => i)),
      selectedCols: new Set(Array.from({ length: totalCols }, (_, i) => i)),
    });
  }, [enableRangeSelection, setSelection, totalRows, totalCols]);

  useEffect(() => {
    // Pointer events cover mouse, touch and pen; pointercancel ends a drag the OS took over (scroll).
    const handlePointerEnd = () => stopDrag();

    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    return () => {
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      stopDrag(); // unmount mid-drag: drop listeners and the rAF loop.
    };
  }, [stopDrag]);

  return {
    onCellPointerDown,
    onCellPointerEnter,
    onRowHeaderClick,
    onColumnHeaderClick,
    onSelectAll,
    isDraggingRef,
  };
}
