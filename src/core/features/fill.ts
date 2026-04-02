import type {
  GridCellCoord,
  GridResolvedColumnDef,
  GridRow,
} from "../types";
import {
  normalizeRange,
  getRowValue,
  setRowValue,
  parseCellValue,
  toDateInputString,
  toNumber,
} from "../utils";

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

function positiveModulo(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}

function parseSeriesNumber(value: unknown): number | null {
  return toNumber(value);
}

function parseSeriesDate(value: unknown): number | null {
  const normalized = toDateInputString(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const [year, month, day] = normalized.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatSeriesDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function createSeriesProjector<T extends GridRow>(
  values: unknown[],
  column?: GridResolvedColumnDef<T>
): ((relativeIndex: number) => unknown) | null {
  if (values.length < 2) {
    return null;
  }

  if (column?.type === "date") {
    const timestamps = values.map(parseSeriesDate);
    if (timestamps.some((value) => value === null)) {
      return null;
    }

    const series = timestamps as number[];
    const forwardStep = series[series.length - 1] - series[series.length - 2];
    const backwardStep = series[1] - series[0];

    return (relativeIndex: number) => {
      if (relativeIndex >= 0 && relativeIndex < series.length) {
        return values[relativeIndex];
      }

      if (relativeIndex < 0) {
        return formatSeriesDate(series[0] + backwardStep * relativeIndex);
      }

      return formatSeriesDate(
        series[series.length - 1] + forwardStep * (relativeIndex - (series.length - 1))
      );
    };
  }

  const numbers = values.map(parseSeriesNumber);
  if (numbers.some((value) => value === null)) {
    return null;
  }

  const series = numbers as number[];
  const forwardStep = series[series.length - 1] - series[series.length - 2];
  const backwardStep = series[1] - series[0];

  return (relativeIndex: number) => {
    if (relativeIndex >= 0 && relativeIndex < series.length) {
      return values[relativeIndex];
    }

    if (relativeIndex < 0) {
      return series[0] + backwardStep * relativeIndex;
    }

    return series[series.length - 1] + forwardStep * (relativeIndex - (series.length - 1));
  };
}

function shouldUseVerticalSeries(sourceBounds: GridFillBounds, targetBounds: GridFillBounds): boolean {
  return (
    sourceBounds.startCol === targetBounds.startCol &&
    sourceBounds.endCol === targetBounds.endCol &&
    (targetBounds.startRow !== sourceBounds.startRow || targetBounds.endRow !== sourceBounds.endRow)
  );
}

function shouldUseHorizontalSeries(sourceBounds: GridFillBounds, targetBounds: GridFillBounds): boolean {
  return (
    sourceBounds.startRow === targetBounds.startRow &&
    sourceBounds.endRow === targetBounds.endRow &&
    (targetBounds.startCol !== sourceBounds.startCol || targetBounds.endCol !== sourceBounds.endCol)
  );
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
  const useVerticalSeries =
    sourceRowCount >= 2 && sourceColCount >= 1 && shouldUseVerticalSeries(sourceBounds, targetBounds);
  const useHorizontalSeries =
    sourceColCount >= 2 && sourceRowCount >= 1 && shouldUseHorizontalSeries(sourceBounds, targetBounds);

  const verticalSeriesProjectors = useVerticalSeries
    ? Array.from({ length: sourceColCount }, (_, columnOffset) =>
        createSeriesProjector(
          sourceMatrix.map((row) => row[columnOffset]),
          columns[sourceBounds.startCol + columnOffset]
        )
      )
    : [];
  const horizontalSeriesProjectors = useHorizontalSeries
    ? Array.from({ length: sourceRowCount }, (_, rowOffset) =>
        createSeriesProjector(sourceMatrix[rowOffset])
      )
    : [];

  for (let rowIndex = targetBounds.startRow; rowIndex <= targetBounds.endRow; rowIndex++) {
    if (rowIndex >= nextRows.length) break;

    for (let colIndex = targetBounds.startCol; colIndex <= targetBounds.endCol; colIndex++) {
      if (colIndex >= columns.length) break;

      const column = columns[colIndex];
      if (!canFillColumn(column)) continue;

      const sourceRowOffset = positiveModulo(rowIndex - sourceBounds.startRow, sourceRowCount);
      const sourceColOffset = positiveModulo(colIndex - sourceBounds.startCol, sourceColCount);
      let sourceValue = sourceMatrix[sourceRowOffset][sourceColOffset];

      if (useVerticalSeries) {
        const projector = verticalSeriesProjectors[colIndex - sourceBounds.startCol];
        const relativeRowIndex = rowIndex - sourceBounds.startRow;
        if (projector) {
          sourceValue = projector(relativeRowIndex);
        }
      } else if (useHorizontalSeries) {
        const projector = horizontalSeriesProjectors[rowIndex - sourceBounds.startRow];
        const relativeColumnIndex = colIndex - sourceBounds.startCol;
        if (projector) {
          sourceValue = projector(relativeColumnIndex);
        }
      }

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
