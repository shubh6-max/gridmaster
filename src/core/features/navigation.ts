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

  const nextRow = reverse
    ? clamp(current.row - 1, 0, lastRow)
    : clamp(current.row + 1, 0, lastRow);

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
   Keyboard dispatch helper
   ========================================================= */

export function navigateByKey(
  state: GridSelectionState,
  key: string,
  bounds: GridBounds,
  options?: {
    shiftKey?: boolean;
    reverse?: boolean;
  }
): GridSelectionState {
  const shiftKey = options?.shiftKey ?? false;
  const reverse = options?.reverse ?? false;

  switch (key) {
    case "ArrowUp":
      return shiftKey ? expandSelectionUp(state, bounds) : moveUp(state, bounds);

    case "ArrowDown":
      return shiftKey ? expandSelectionDown(state, bounds) : moveDown(state, bounds);

    case "ArrowLeft":
      return shiftKey ? expandSelectionLeft(state, bounds) : moveLeft(state, bounds);

    case "ArrowRight":
      return shiftKey ? expandSelectionRight(state, bounds) : moveRight(state, bounds);

    case "Tab":
      return moveTab(state, bounds, reverse);

    case "Enter":
      return moveEnter(state, bounds, reverse);

    case "Home":
      return goHome(state, bounds, shiftKey);

    case "End":
      return goEnd(state, bounds, shiftKey);

    default:
      return state;
  }
}