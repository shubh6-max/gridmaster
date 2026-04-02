import type {
  GridCellCoord,
  GridSelectionRange,
  GridSelectionState,
} from "../types";
import { INITIAL_SELECTION_STATE } from "../constants";
import { clamp, createRange, isCoordInRange, isSameCoord, normalizeRange } from "../utils";

/* =========================================================
   Base creators
   ========================================================= */

export function createCellCoord(row: number, col: number): GridCellCoord {
  return { row, col };
}

export function createSelectionRange(
  start: GridCellCoord,
  end: GridCellCoord
): GridSelectionRange {
  return createRange(start, end);
}

export function createInitialSelectionState(): GridSelectionState {
  return {
    mode: INITIAL_SELECTION_STATE.mode,
    anchor: INITIAL_SELECTION_STATE.anchor ? { ...INITIAL_SELECTION_STATE.anchor } : null,
    cursor: INITIAL_SELECTION_STATE.cursor ? { ...INITIAL_SELECTION_STATE.cursor } : null,
    range: INITIAL_SELECTION_STATE.range
      ? {
          start: { ...INITIAL_SELECTION_STATE.range.start },
          end: { ...INITIAL_SELECTION_STATE.range.end },
        }
      : null,
    selectedRows: new Set<number>(),
    selectedCols: new Set<number>(),
  };
}

export function cloneSelectionState(state: GridSelectionState): GridSelectionState {
  return {
    mode: state.mode,
    anchor: state.anchor ? { ...state.anchor } : null,
    cursor: state.cursor ? { ...state.cursor } : null,
    range: state.range
      ? {
          start: { ...state.range.start },
          end: { ...state.range.end },
        }
      : null,
    selectedRows: new Set(state.selectedRows),
    selectedCols: new Set(state.selectedCols),
  };
}

/* =========================================================
   Core normalizers
   ========================================================= */

export function normalizeSelectionRange(
  range: GridSelectionRange | null
): GridSelectionRange | null {
  if (!range) return null;

  const normalized = normalizeRange(range);

  return {
    start: { row: normalized.startRow, col: normalized.startCol },
    end: { row: normalized.endRow, col: normalized.endCol },
  };
}

export function clearSelection(): GridSelectionState {
  return {
    mode: "cell",
    anchor: null,
    cursor: null,
    range: null,
    selectedRows: new Set<number>(),
    selectedCols: new Set<number>(),
  };
}

export function setActiveCell(
  state: GridSelectionState,
  cell: GridCellCoord
): GridSelectionState {
  return {
    mode: "cell",
    anchor: { ...cell },
    cursor: { ...cell },
    range: {
      start: { ...cell },
      end: { ...cell },
    },
    selectedRows: new Set<number>(),
    selectedCols: new Set<number>(),
  };
}

export function setRangeSelection(
  state: GridSelectionState,
  anchor: GridCellCoord,
  cursor: GridCellCoord
): GridSelectionState {
  return {
    mode: isSameCoord(anchor, cursor) ? "cell" : "range",
    anchor: { ...anchor },
    cursor: { ...cursor },
    range: normalizeSelectionRange({
      start: { ...anchor },
      end: { ...cursor },
    }),
    selectedRows: new Set<number>(),
    selectedCols: new Set<number>(),
  };
}

/* =========================================================
   Row selection
   ========================================================= */

export function selectSingleRow(
  state: GridSelectionState,
  rowIndex: number,
  totalCols: number
): GridSelectionState {
  const endCol = Math.max(totalCols - 1, 0);

  return {
    mode: "row",
    anchor: { row: rowIndex, col: 0 },
    cursor: { row: rowIndex, col: endCol },
    range: {
      start: { row: rowIndex, col: 0 },
      end: { row: rowIndex, col: endCol },
    },
    selectedRows: new Set<number>([rowIndex]),
    selectedCols: new Set<number>(),
  };
}

export function toggleRowSelection(
  state: GridSelectionState,
  rowIndex: number,
  totalCols: number
): GridSelectionState {
  const nextRows = new Set(state.selectedRows);

  if (nextRows.has(rowIndex)) nextRows.delete(rowIndex);
  else nextRows.add(rowIndex);

  if (nextRows.size === 0) {
    return clearSelection();
  }

  const sortedRows = [...nextRows].sort((a, b) => a - b);
  const firstRow = sortedRows[0];
  const lastRow = sortedRows[sortedRows.length - 1];
  const endCol = Math.max(totalCols - 1, 0);

  return {
    mode: "row",
    anchor: { row: firstRow, col: 0 },
    cursor: { row: lastRow, col: endCol },
    range: {
      start: { row: firstRow, col: 0 },
      end: { row: lastRow, col: endCol },
    },
    selectedRows: nextRows,
    selectedCols: new Set<number>(),
  };
}

export function selectRowRange(
  state: GridSelectionState,
  fromRow: number,
  toRow: number,
  totalCols: number
): GridSelectionState {
  const startRow = Math.min(fromRow, toRow);
  const endRow = Math.max(fromRow, toRow);
  const selectedRows = new Set<number>();

  for (let row = startRow; row <= endRow; row++) {
    selectedRows.add(row);
  }

  const endCol = Math.max(totalCols - 1, 0);

  return {
    mode: "row",
    anchor: { row: startRow, col: 0 },
    cursor: { row: endRow, col: endCol },
    range: {
      start: { row: startRow, col: 0 },
      end: { row: endRow, col: endCol },
    },
    selectedRows,
    selectedCols: new Set<number>(),
  };
}

/* =========================================================
   Column selection
   ========================================================= */

export function selectSingleColumn(
  state: GridSelectionState,
  colIndex: number,
  totalRows: number
): GridSelectionState {
  const endRow = Math.max(totalRows - 1, 0);

  return {
    mode: "column",
    anchor: { row: 0, col: colIndex },
    cursor: { row: endRow, col: colIndex },
    range: {
      start: { row: 0, col: colIndex },
      end: { row: endRow, col: colIndex },
    },
    selectedRows: new Set<number>(),
    selectedCols: new Set<number>([colIndex]),
  };
}

export function toggleColumnSelection(
  state: GridSelectionState,
  colIndex: number,
  totalRows: number
): GridSelectionState {
  const nextCols = new Set(state.selectedCols);

  if (nextCols.has(colIndex)) nextCols.delete(colIndex);
  else nextCols.add(colIndex);

  if (nextCols.size === 0) {
    return clearSelection();
  }

  const sortedCols = [...nextCols].sort((a, b) => a - b);
  const firstCol = sortedCols[0];
  const lastCol = sortedCols[sortedCols.length - 1];
  const endRow = Math.max(totalRows - 1, 0);

  return {
    mode: "column",
    anchor: { row: 0, col: firstCol },
    cursor: { row: endRow, col: lastCol },
    range: {
      start: { row: 0, col: firstCol },
      end: { row: endRow, col: lastCol },
    },
    selectedRows: new Set<number>(),
    selectedCols: nextCols,
  };
}

export function selectColumnRange(
  state: GridSelectionState,
  fromCol: number,
  toCol: number,
  totalRows: number
): GridSelectionState {
  const startCol = Math.min(fromCol, toCol);
  const endCol = Math.max(fromCol, toCol);
  const selectedCols = new Set<number>();

  for (let col = startCol; col <= endCol; col++) {
    selectedCols.add(col);
  }

  const endRow = Math.max(totalRows - 1, 0);

  return {
    mode: "column",
    anchor: { row: 0, col: startCol },
    cursor: { row: endRow, col: endCol },
    range: {
      start: { row: 0, col: startCol },
      end: { row: endRow, col: endCol },
    },
    selectedRows: new Set<number>(),
    selectedCols,
  };
}

/* =========================================================
   Select all
   ========================================================= */

export function selectAllCells(totalRows: number, totalCols: number): GridSelectionState {
  const endRow = Math.max(totalRows - 1, 0);
  const endCol = Math.max(totalCols - 1, 0);

  const selectedRows = new Set<number>();
  const selectedCols = new Set<number>();

  for (let row = 0; row < totalRows; row++) selectedRows.add(row);
  for (let col = 0; col < totalCols; col++) selectedCols.add(col);

  return {
    mode: "all",
    anchor: { row: 0, col: 0 },
    cursor: { row: endRow, col: endCol },
    range: {
      start: { row: 0, col: 0 },
      end: { row: endRow, col: endCol },
    },
    selectedRows,
    selectedCols,
  };
}

/* =========================================================
   Navigation helpers
   ========================================================= */

export function moveCursor(
  state: GridSelectionState,
  deltaRow: number,
  deltaCol: number,
  totalRows: number,
  totalCols: number,
  extendRange = false
): GridSelectionState {
  const current = state.cursor ?? state.anchor ?? { row: 0, col: 0 };

  const next = {
    row: clamp(current.row + deltaRow, 0, Math.max(totalRows - 1, 0)),
    col: clamp(current.col + deltaCol, 0, Math.max(totalCols - 1, 0)),
  };

  if (extendRange) {
    const anchor = state.anchor ?? current;
    return setRangeSelection(state, anchor, next);
  }

  return setActiveCell(state, next);
}

export function moveToCell(
  state: GridSelectionState,
  row: number,
  col: number,
  totalRows: number,
  totalCols: number,
  extendRange = false
): GridSelectionState {
  const next = {
    row: clamp(row, 0, Math.max(totalRows - 1, 0)),
    col: clamp(col, 0, Math.max(totalCols - 1, 0)),
  };

  if (extendRange) {
    const anchor = state.anchor ?? next;
    return setRangeSelection(state, anchor, next);
  }

  return setActiveCell(state, next);
}

/* =========================================================
   Query helpers
   ========================================================= */

export function isCellSelected(
  state: GridSelectionState,
  row: number,
  col: number
): boolean {
  if (state.mode === "row") return state.selectedRows.has(row);
  if (state.mode === "column") return state.selectedCols.has(col);
  if (state.mode === "all") return true;
  if (!state.range) return false;

  return isCoordInRange({ row, col }, state.range);
}

export function isCellActive(
  state: GridSelectionState,
  row: number,
  col: number
): boolean {
  if (!state.cursor) return false;
  return state.cursor.row === row && state.cursor.col === col;
}

export function hasRowSelection(state: GridSelectionState): boolean {
  return state.selectedRows.size > 0;
}

export function hasColumnSelection(state: GridSelectionState): boolean {
  return state.selectedCols.size > 0;
}

export function hasRangeSelection(state: GridSelectionState): boolean {
  if (!state.range) return false;
  const normalized = normalizeRange(state.range);
  return (
    normalized.startRow !== normalized.endRow ||
    normalized.startCol !== normalized.endCol
  );
}

export function getSelectionBounds(state: GridSelectionState): {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
} | null {
  if (!state.range) return null;
  return normalizeRange(state.range);
}