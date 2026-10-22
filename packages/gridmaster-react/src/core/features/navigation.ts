import type { GridCellCoord, GridSelectionState } from "../types";
import { clamp } from "../utils";
import { moveToCell, setActiveCell, setRangeSelection } from "../state/selectionState";

/* =========================================================
   Bounds helpers
   ========================================================= */

export type GridBounds = {
  totalRows: number;
  totalCols: number;
};

export function clampCellToBounds(cell: GridCellCoord, bounds: GridBounds): GridCellCoord {
  return {
    row: clamp(cell.row, 0, Math.max(bounds.totalRows - 1, 0)),
    col: clamp(cell.col, 0, Math.max(bounds.totalCols - 1, 0)),
  };
}

export function getCurrentCell(state: GridSelectionState): GridCellCoord {
  return state.cursor ?? state.anchor ?? { row: 0, col: 0 };
}

/* =========================================================
   Direct navigation
   ========================================================= */

export function goToCell(
  state: GridSelectionState,
  row: number,
  col: number,
  bounds: GridBounds,
  extendRange = false
): GridSelectionState {
  return moveToCell(state, row, col, bounds.totalRows, bounds.totalCols, extendRange);
}

export function goHome(
  state: GridSelectionState,
  bounds: GridBounds,
  extendRange = false
): GridSelectionState {
  const current = getCurrentCell(state);
  return goToCell(state, current.row, 0, bounds, extendRange);
}

export function goEnd(
  state: GridSelectionState,
  bounds: GridBounds,
  extendRange = false
): GridSelectionState {
  const current = getCurrentCell(state);
  return goToCell(state, current.row, Math.max(bounds.totalCols - 1, 0), bounds, extendRange);
}

export function goTop(
  state: GridSelectionState,
  bounds: GridBounds,
  extendRange = false
): GridSelectionState {
  const current = getCurrentCell(state);
  return goToCell(state, 0, current.col, bounds, extendRange);
}

export function goBottom(
  state: GridSelectionState,
  bounds: GridBounds,
  extendRange = false
): GridSelectionState {
  const current = getCurrentCell(state);
  return goToCell(state, Math.max(bounds.totalRows - 1, 0), current.col, bounds, extendRange);
}

/* =========================================================
   Arrow navigation
   ========================================================= */

export function moveUp(
  state: GridSelectionState,
  bounds: GridBounds,
  extendRange = false
): GridSelectionState {
  const current = getCurrentCell(state);
  return goToCell(state, current.row - 1, current.col, bounds, extendRange);
}

export function moveDown(
  state: GridSelectionState,
  bounds: GridBounds,
  extendRange = false
): GridSelectionState {
  const current = getCurrentCell(state);
  return goToCell(state, current.row + 1, current.col, bounds, extendRange);
}

export function moveLeft(
  state: GridSelectionState,
  bounds: GridBounds,
  extendRange = false
): GridSelectionState {
  const current = getCurrentCell(state);
  return goToCell(state, current.row, current.col - 1, bounds, extendRange);
}

export function moveRight(
  state: GridSelectionState,
  bounds: GridBounds,
  extendRange = false
): GridSelectionState {
  const current = getCurrentCell(state);
  return goToCell(state, current.row, current.col + 1, bounds, extendRange);
}

/* =========================================================
   Tab / Enter navigation
   ========================================================= */

export function moveTab(
  state: GridSelectionState,
  bounds: GridBounds,
  reverse = false
): GridSelectionState {
  const current = getCurrentCell(state);
  const lastCol = Math.max(bounds.totalCols - 1, 0);
  const lastRow = Math.max(bounds.totalRows - 1, 0);

  if (reverse) {
    if (current.col > 0) {
      return setActiveCell(state, { row: current.row, col: current.col - 1 });
    }

    const prevRow = clamp(current.row - 1, 0, lastRow);
    return setActiveCell(state, { row: prevRow, col: lastCol });
  }

  if (current.col < lastCol) {
    return setActiveCell(state, { row: current.row, col: current.col + 1 });
  }

  const nextRow = clamp(current.row + 1, 0, lastRow);
  return setActiveCell(state, { row: nextRow, col: 0 });
}

export function moveEnter(
  state: GridSelectionState,
  bounds: GridBounds,
  reverse = false
): GridSelectionState {
  const current = getCurrentCell(state);
  const lastRow = Math.max(bounds.totalRows - 1, 0);

  const nextRow = reverse ? clamp(current.row - 1, 0, lastRow) : clamp(current.row + 1, 0, lastRow);

  return setActiveCell(state, { row: nextRow, col: current.col });
}

/* =========================================================
   Selection expansion navigation
   ========================================================= */

export function expandSelectionUp(
  state: GridSelectionState,
  bounds: GridBounds
): GridSelectionState {
  const cursor = getCurrentCell(state);
  const next = clampCellToBounds({ row: cursor.row - 1, col: cursor.col }, bounds);
  const anchor = state.anchor ?? cursor;
  return setRangeSelection(state, anchor, next);
}

export function expandSelectionDown(
  state: GridSelectionState,
  bounds: GridBounds
): GridSelectionState {
  const cursor = getCurrentCell(state);
  const next = clampCellToBounds({ row: cursor.row + 1, col: cursor.col }, bounds);
  const anchor = state.anchor ?? cursor;
  return setRangeSelection(state, anchor, next);
}

export function expandSelectionLeft(
  state: GridSelectionState,
  bounds: GridBounds
): GridSelectionState {
  const cursor = getCurrentCell(state);
  const next = clampCellToBounds({ row: cursor.row, col: cursor.col - 1 }, bounds);
  const anchor = state.anchor ?? cursor;
  return setRangeSelection(state, anchor, next);
}

export function expandSelectionRight(
  state: GridSelectionState,
  bounds: GridBounds
): GridSelectionState {
  const cursor = getCurrentCell(state);
  const next = clampCellToBounds({ row: cursor.row, col: cursor.col + 1 }, bounds);
  const anchor = state.anchor ?? cursor;
  return setRangeSelection(state, anchor, next);
}

/* =========================================================
   Paging and document-edge navigation (A-097)
   ========================================================= */

export function pageUp(
  state: GridSelectionState,
  bounds: GridBounds,
  pageSize: number,
  extendRange = false
): GridSelectionState {
  const current = getCurrentCell(state);
  return goToCell(state, current.row - Math.max(pageSize, 1), current.col, bounds, extendRange);
}

export function pageDown(
  state: GridSelectionState,
  bounds: GridBounds,
  pageSize: number,
  extendRange = false
): GridSelectionState {
  const current = getCurrentCell(state);
  return goToCell(state, current.row + Math.max(pageSize, 1), current.col, bounds, extendRange);
}

/** Ctrl+Home: the first cell (A1). */
export function goToFirstCell(
  state: GridSelectionState,
  bounds: GridBounds,
  extendRange = false
): GridSelectionState {
  return goToCell(state, 0, 0, bounds, extendRange);
}

/** Ctrl+End: the last cell (last row, last column). */
export function goToLastCell(
  state: GridSelectionState,
  bounds: GridBounds,
  extendRange = false
): GridSelectionState {
  return goToCell(
    state,
    Math.max(bounds.totalRows - 1, 0),
    Math.max(bounds.totalCols - 1, 0),
    bounds,
    extendRange
  );
}

/* =========================================================
   Data-region edge navigation (Ctrl+Arrow, Excel semantics)
   ========================================================= */

export type GridCellValueGetter = (row: number, col: number) => unknown;
export type GridDataEdgeDirection = "up" | "down" | "left" | "right";

function isBlankCell(value: unknown): boolean {
  if (value == null) return true;
  return typeof value === "string" && value.trim() === "";
}

/**
 * Ctrl+Arrow: jump to the edge of the current data region (Excel semantics). From a filled cell
 * whose neighbour is filled, land on the last filled cell of the contiguous block; otherwise skip
 * the gap to the next filled cell (or the grid edge if none). `getValue` reads DISPLAY coordinates,
 * so hidden columns / filtered rows are naturally excluded by the caller's bounds.
 */
export function goToDataEdge(
  state: GridSelectionState,
  bounds: GridBounds,
  direction: GridDataEdgeDirection,
  getValue: GridCellValueGetter,
  extendRange = false
): GridSelectionState {
  const current = getCurrentCell(state);
  const [deltaRow, deltaCol] =
    direction === "up"
      ? [-1, 0]
      : direction === "down"
        ? [1, 0]
        : direction === "left"
          ? [0, -1]
          : [0, 1];

  const lastRow = Math.max(bounds.totalRows - 1, 0);
  const lastCol = Math.max(bounds.totalCols - 1, 0);
  const inBounds = (row: number, col: number) =>
    row >= 0 && row <= lastRow && col >= 0 && col <= lastCol;

  let row = current.row;
  let col = current.col;

  // Already at the grid edge in this direction: stay put.
  if (!inBounds(row + deltaRow, col + deltaCol)) {
    return goToCell(state, row, col, bounds, extendRange);
  }

  const currentBlank = isBlankCell(getValue(row, col));
  const neighbourBlank = isBlankCell(getValue(row + deltaRow, col + deltaCol));

  if (!currentBlank && !neighbourBlank) {
    // Inside a filled block: advance to its last filled cell.
    while (inBounds(row + deltaRow, col + deltaCol) && !isBlankCell(getValue(row + deltaRow, col + deltaCol))) {
      row += deltaRow;
      col += deltaCol;
    }
  } else {
    // Current or neighbour blank: skip to the next filled cell (or the edge if none).
    do {
      row += deltaRow;
      col += deltaCol;
    } while (inBounds(row, col) && isBlankCell(getValue(row, col)));

    if (!inBounds(row, col)) {
      row = clamp(row, 0, lastRow);
      col = clamp(col, 0, lastCol);
    }
  }

  return goToCell(state, row, col, bounds, extendRange);
}

/* =========================================================
   Keyboard dispatch helper
   ========================================================= */

export function navigateByKey(
  state: GridSelectionState,
  key: string,
  bounds: GridBounds,
  options?: {
    shiftKey?: boolean;
    reverse?: boolean;
    ctrlKey?: boolean;
    pageSize?: number;
    /** Required for Ctrl+Arrow data-edge jumps; without it Ctrl+Arrow falls back to single steps. */
    getValue?: GridCellValueGetter;
  }
): GridSelectionState {
  const shiftKey = options?.shiftKey ?? false;
  const reverse = options?.reverse ?? false;
  const ctrlKey = options?.ctrlKey ?? false;
  const pageSize = options?.pageSize ?? 10;
  const getValue = options?.getValue;

  switch (key) {
    case "ArrowUp":
      if (ctrlKey && getValue) return goToDataEdge(state, bounds, "up", getValue, shiftKey);
      return shiftKey ? expandSelectionUp(state, bounds) : moveUp(state, bounds);

    case "ArrowDown":
      if (ctrlKey && getValue) return goToDataEdge(state, bounds, "down", getValue, shiftKey);
      return shiftKey ? expandSelectionDown(state, bounds) : moveDown(state, bounds);

    case "ArrowLeft":
      if (ctrlKey && getValue) return goToDataEdge(state, bounds, "left", getValue, shiftKey);
      return shiftKey ? expandSelectionLeft(state, bounds) : moveLeft(state, bounds);

    case "ArrowRight":
      if (ctrlKey && getValue) return goToDataEdge(state, bounds, "right", getValue, shiftKey);
      return shiftKey ? expandSelectionRight(state, bounds) : moveRight(state, bounds);

    case "PageUp":
      return pageUp(state, bounds, pageSize, shiftKey);

    case "PageDown":
      return pageDown(state, bounds, pageSize, shiftKey);

    case "Tab":
      return moveTab(state, bounds, reverse);

    case "Enter":
      return moveEnter(state, bounds, reverse);

    case "Home":
      return ctrlKey ? goToFirstCell(state, bounds, shiftKey) : goHome(state, bounds, shiftKey);

    case "End":
      return ctrlKey ? goToLastCell(state, bounds, shiftKey) : goEnd(state, bounds, shiftKey);

    default:
      return state;
  }
}
