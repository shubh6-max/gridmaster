import type {
  GridCellCoord,
  GridResolvedColumnDef,
  GridRow,
} from "../types";
import { normalizeRange, getRowValue, setRowValue, parseCellValue } from "../utils";

/* =========================================================
   Types
   ========================================================= */

export type GridFillBounds = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

export type GridFillState = {
  anchor: GridCellCoord;
  current: GridCellCoord;
} | null;

export type GridFillResult<T extends GridRow = GridRow> = {
  rows: T[];
  affectedBounds: GridFillBounds | null;
};

/* =========================================================
   Fill state helpers
   ========================================================= */

export function createFillState(
  anchor: GridCellCoord,
  current?: GridCellCoord
): GridFillState {
  return {
    anchor: { ...anchor },
    current: current ? { ...current } : { ...anchor },
  };
}

export function clearFillState(): GridFillState {
  return null;
}

export function updateFillState(
  state: GridFillState,
  current: GridCellCoord
): GridFillState {
  if (!state) return null;

  return {
    anchor: { ...state.anchor },
    current: { ...current },
  };
}

export function getFillBounds(state: GridFillState): GridFillBounds | null {
  if (!state) return null;

  const normalized = normalizeRange({
    start: state.anchor,
    end: state.current,
  });

  return {
    startRow: normalized.startRow,
    endRow: normalized.endRow,
    startCol: normalized.startCol,
    endCol: normalized.endCol,
  };
}

/* =========================================================
   Internal helpers
   ========================================================= */

function cloneRows<T extends GridRow>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row }));
}

function canFillColumn<T extends GridRow>(column: GridResolvedColumnDef<T> | undefined): boolean {
  if (!column) return false;
  if (column.readonly) return false;
  if (!column.editable) return false;
  return true;
}

function getSourceMatrix<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  bounds: GridFillBounds
): any[][] {
  const matrix: any[][] = [];

  for (let rowIndex = bounds.startRow; rowIndex <= bounds.endRow; rowIndex++) {
    const row = rows[rowIndex];
    if (!row) continue;

    const line: any[] = [];
    for (let colIndex = bounds.startCol; colIndex <= bounds.endCol; colIndex++) {
      const column = columns[colIndex];
      line.push(column ? getRowValue(row, column) : "");
    }

    matrix.push(line);
  }

  return matrix;
}

function applyValueToCell<T extends GridRow>(
  row: T,
  column: GridResolvedColumnDef<T>,
  value: any
): T {
  const parsed = parseCellValue(value, row, column);
  return setRowValue(row, column, parsed);
}

/* =========================================================
   Repeat fill
   ========================================================= */

export function fillRangeWithSource<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  sourceBounds: GridFillBounds,
  targetBounds: GridFillBounds
): GridFillResult<T> {
  const nextRows = cloneRows(rows);
  const sourceMatrix = getSourceMatrix(rows, columns, sourceBounds);

  if (!sourceMatrix.length || !sourceMatrix[0]?.length) {
    return {
      rows,
      affectedBounds: null,
    };
  }

  const sourceRowCount = sourceMatrix.length;
  const sourceColCount = sourceMatrix[0].length;

  for (let rowIndex = targetBounds.startRow; rowIndex <= targetBounds.endRow; rowIndex++) {
    if (rowIndex >= nextRows.length) break;

    for (let colIndex = targetBounds.startCol; colIndex <= targetBounds.endCol; colIndex++) {
      if (colIndex >= columns.length) break;

      const column = columns[colIndex];
      if (!canFillColumn(column)) continue;

      const sourceRowOffset = (rowIndex - targetBounds.startRow) % sourceRowCount;
      const sourceColOffset = (colIndex - targetBounds.startCol) % sourceColCount;
      const sourceValue = sourceMatrix[sourceRowOffset][sourceColOffset];

      nextRows[rowIndex] = applyValueToCell(nextRows[rowIndex], column, sourceValue);
    }
  }

  return {
    rows: nextRows,
    affectedBounds: targetBounds,
  };
}

/* =========================================================
   Vertical fill from anchor cell / range
   ========================================================= */

export function fillVertical<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  anchorBounds: GridFillBounds,
  fillToRow: number
): GridFillResult<T> {
  const startRow = Math.min(anchorBounds.startRow, fillToRow);
  const endRow = Math.max(anchorBounds.endRow, fillToRow);

  const targetBounds: GridFillBounds = {
    startRow,
    endRow,
    startCol: anchorBounds.startCol,
    endCol: anchorBounds.endCol,
  };

  return fillRangeWithSource(rows, columns, anchorBounds, targetBounds);
}

/* =========================================================
   Horizontal fill from anchor cell / range
   ========================================================= */

export function fillHorizontal<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  anchorBounds: GridFillBounds,
  fillToCol: number
): GridFillResult<T> {
  const startCol = Math.min(anchorBounds.startCol, fillToCol);
  const endCol = Math.max(anchorBounds.endCol, fillToCol);

  const targetBounds: GridFillBounds = {
    startRow: anchorBounds.startRow,
    endRow: anchorBounds.endRow,
    startCol,
    endCol,
  };

  return fillRangeWithSource(rows, columns, anchorBounds, targetBounds);
}

/* =========================================================
   Fill using drag state
   ========================================================= */

export function applyFillFromState<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  state: GridFillState
): GridFillResult<T> {
  if (!state) {
    return {
      rows,
      affectedBounds: null,
    };
  }

  const bounds = getFillBounds(state);
  if (!bounds) {
    return {
      rows,
      affectedBounds: null,
    };
  }

  const anchorBounds: GridFillBounds = {
    startRow: state.anchor.row,
    endRow: state.anchor.row,
    startCol: state.anchor.col,
    endCol: state.anchor.col,
  };

  return fillRangeWithSource(rows, columns, anchorBounds, bounds);
}

/* =========================================================
   Multi-cell source fill
   ========================================================= */

export function applyFillFromSelection<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  sourceBounds: GridFillBounds,
  dragState: GridFillState
): GridFillResult<T> {
  const targetBounds = getFillBounds(dragState);

  if (!dragState || !targetBounds) {
    return {
      rows,
      affectedBounds: null,
    };
  }

  return fillRangeWithSource(rows, columns, sourceBounds, targetBounds);
}