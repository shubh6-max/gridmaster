import type { GridCellCoord, GridResolvedColumnDef, GridRow } from "../types";
import {
  normalizeRange,
  getRowValue,
  isFormulaValue,
  normalizeValue,
  setRowValue,
  parseCellValue,
  toDateInputString,
  toNumber,
} from "../utils";
import { shiftFormulaReferences } from "./formulas";

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

export type GridFillResult<T extends object = GridRow> = {
  rows: T[];
  affectedBounds: GridFillBounds | null;
};

/**
 * Optional display→source mappings so a fill under an active sort / filter / hidden column stays
 * correct. `rows`/`columns` the fill reads and writes stay in DISPLAY order (what the user sees, so
 * value series follow the display), but a filled FORMULA's relative references shift by the
 * SOURCE-row and ABSOLUTE-column delta (the axes the evaluator uses), mirroring the paste path.
 * `isWritable` skips read-only target cells (A-084) without touching the source.
 */
export type GridFillMapping = {
  /** display row index → source row index (identity when unsorted / unfiltered). */
  mapRow?: (displayRowIndex: number) => number;
  /** visible column index → absolute column index over all columns (identity when none hidden). */
  mapCol?: (visibleColumnIndex: number) => number;
  /** `(displayRowIndex, visibleColumnIndex) → writable`. A `false` leaves the target cell untouched. */
  isWritable?: (displayRowIndex: number, visibleColumnIndex: number) => boolean;
};

/* =========================================================
   Fill state helpers
   ========================================================= */

export function createFillState(anchor: GridCellCoord, current?: GridCellCoord): GridFillState {
  return {
    anchor: { ...anchor },
    current: current ? { ...current } : { ...anchor },
  };
}

export function clearFillState(): GridFillState {
  return null;
}

export function updateFillState(state: GridFillState, current: GridCellCoord): GridFillState {
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

function cloneRows<T extends object>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row }));
}

function canFillColumn<T extends object>(column: GridResolvedColumnDef<T> | undefined): boolean {
  if (!column) return false;
  if (column.readonly) return false;
  if (!column.editable) return false;
  return true;
}

function getSourceMatrix<T extends object>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  bounds: GridFillBounds
): unknown[][] {
  const matrix: unknown[][] = [];

  for (let rowIndex = bounds.startRow; rowIndex <= bounds.endRow; rowIndex++) {
    const row = rows[rowIndex];
    if (!row) continue;

    const line: unknown[] = [];
    for (let colIndex = bounds.startCol; colIndex <= bounds.endCol; colIndex++) {
      const column = columns[colIndex];
      line.push(column ? getRowValue(row, column) : "");
    }

    matrix.push(line);
  }

  return matrix;
}

function applyValueToCell<T extends object>(
  row: T,
  column: GridResolvedColumnDef<T>,
  value: unknown
): T {
  const parsed = parseCellValue(value, row, column);
  return setRowValue(row, column, parsed);
}

function positiveModulo(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}

const MS_PER_DAY = 86_400_000;

/** Blank source cells (nil / empty / whitespace) are never part of a numeric or date series — they
 * must copy through as blanks, never coerce to 0 (A-060). */
function isBlankCell(value: unknown): boolean {
  return normalizeValue(value) === "";
}

/** Collapse binary floating-point drift so a 0.1 step reads 0.3, not 0.30000000000000004. */
function cleanFloat(value: number): number {
  return Number.isFinite(value) ? Number(value.toPrecision(15)) : value;
}

/** A source value as a local `YYYY-MM-DD`, or null when it is blank / not a date. */
function toSeriesDateIso(value: unknown): string | null {
  if (isBlankCell(value)) return null;
  const iso = toDateInputString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function isoToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localDateToIso(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

type DateStep = { months: number; days: number };

/** Excel-style step between two LOCAL dates: identical day-of-month ⇒ a calendar-month step (a year
 * is just a 12-month step); otherwise a plain day step. All arithmetic is on local components, so a
 * date series never shifts a day across time zones (A-106). */
function detectDateStep(fromIso: string, toIso: string): DateStep {
  const a = isoToLocalDate(fromIso);
  const b = isoToLocalDate(toIso);
  if (a.getDate() === b.getDate()) {
    const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (months !== 0) return { months, days: 0 };
  }
  return { months: 0, days: Math.round((b.getTime() - a.getTime()) / MS_PER_DAY) };
}

/** `baseIso` advanced by `multiplier` steps. Month steps clamp the day to the target month's last
 * day, so 31 Jan + 1 month ⇒ 28/29 Feb (A-060 month-end rules). */
function addDateStep(baseIso: string, step: DateStep, multiplier: number): string {
  const base = isoToLocalDate(baseIso);
  if (step.months !== 0) {
    const total = base.getFullYear() * 12 + base.getMonth() + step.months * multiplier;
    const year = Math.floor(total / 12);
    const month = total - year * 12; // always 0..11
    const lastDay = new Date(year, month + 1, 0).getDate();
    return localDateToIso(new Date(year, month, Math.min(base.getDate(), lastDay)));
  }
  return localDateToIso(
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + step.days * multiplier)
  );
}

function createSeriesProjector<T extends object>(
  values: unknown[],
  column?: GridResolvedColumnDef<T>
): ((relativeIndex: number) => unknown) | null {
  if (values.length < 2) {
    return null;
  }
  // Any blank in the source breaks the series: fall back to the copy/repeat pattern (the caller's
  // modulo), so blanks stay blank instead of being coerced to 0 (A-060).
  if (values.some(isBlankCell)) {
    return null;
  }

  if (column?.type === "date") {
    const isoValues = values.map(toSeriesDateIso);
    if (isoValues.some((iso) => iso === null)) {
      return null;
    }

    const series = isoValues as string[];
    const forwardStep = detectDateStep(series[series.length - 2], series[series.length - 1]);
    const backwardStep = detectDateStep(series[1], series[0]);

    return (relativeIndex: number) => {
      if (relativeIndex >= 0 && relativeIndex < values.length) {
        return values[relativeIndex];
      }
      if (relativeIndex < 0) {
        return addDateStep(series[0], backwardStep, -relativeIndex);
      }
      return addDateStep(series[series.length - 1], forwardStep, relativeIndex - (series.length - 1));
    };
  }

  const numbers = values.map(toNumber);
  if (numbers.some((value) => value === null)) {
    return null;
  }

  const series = numbers as number[];
  const forwardStep = series[series.length - 1] - series[series.length - 2];
  const backwardStep = series[1] - series[0];

  return (relativeIndex: number) => {
    if (relativeIndex >= 0 && relativeIndex < values.length) {
      return values[relativeIndex];
    }
    if (relativeIndex < 0) {
      return cleanFloat(series[0] + backwardStep * relativeIndex);
    }
    return cleanFloat(
      series[series.length - 1] + forwardStep * (relativeIndex - (series.length - 1))
    );
  };
}

function shouldUseVerticalSeries(
  sourceBounds: GridFillBounds,
  targetBounds: GridFillBounds
): boolean {
  return (
    sourceBounds.startCol === targetBounds.startCol &&
    sourceBounds.endCol === targetBounds.endCol &&
    (targetBounds.startRow !== sourceBounds.startRow || targetBounds.endRow !== sourceBounds.endRow)
  );
}

function shouldUseHorizontalSeries(
  sourceBounds: GridFillBounds,
  targetBounds: GridFillBounds
): boolean {
  return (
    sourceBounds.startRow === targetBounds.startRow &&
    sourceBounds.endRow === targetBounds.endRow &&
    (targetBounds.startCol !== sourceBounds.startCol || targetBounds.endCol !== sourceBounds.endCol)
  );
}

/* =========================================================
   Repeat fill
   ========================================================= */

export function fillRangeWithSource<T extends object>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  sourceBounds: GridFillBounds,
  targetBounds: GridFillBounds,
  mapping?: GridFillMapping
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
    sourceRowCount >= 2 &&
    sourceColCount >= 1 &&
    shouldUseVerticalSeries(sourceBounds, targetBounds);
  const useHorizontalSeries =
    sourceColCount >= 2 &&
    sourceRowCount >= 1 &&
    shouldUseHorizontalSeries(sourceBounds, targetBounds);

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
      // A-084: a read-only target cell/row keeps its value (the source is unaffected).
      if (mapping?.isWritable && !mapping.isWritable(rowIndex, colIndex)) continue;

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

      // A-007: a filled formula shifts its relative references by its offset from the source cell
      // (`$`-anchored parts stay). Formulas never form a numeric/date series, so the projectors
      // above leave them as the raw string — this is the only place they need rewriting.
      if (isFormulaValue(sourceValue)) {
        const sourceRow = sourceBounds.startRow + sourceRowOffset;
        const sourceCol = sourceBounds.startCol + sourceColOffset;
        // Shift in SOURCE-row / ABSOLUTE-column space so a fill under sort / filter / hidden columns
        // rewrites references correctly; identity mappings reproduce the plain display-space delta.
        const rowDelta = mapping?.mapRow
          ? mapping.mapRow(rowIndex) - mapping.mapRow(sourceRow)
          : rowIndex - sourceRow;
        const colDelta = mapping?.mapCol
          ? mapping.mapCol(colIndex) - mapping.mapCol(sourceCol)
          : colIndex - sourceCol;
        sourceValue = shiftFormulaReferences(sourceValue, rowDelta, colDelta);
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

export function fillVertical<T extends object>(
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

export function fillHorizontal<T extends object>(
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

export function applyFillFromState<T extends object>(
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

export function applyFillFromSelection<T extends object>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  sourceBounds: GridFillBounds,
  dragState: GridFillState,
  mapping?: GridFillMapping
): GridFillResult<T> {
  const targetBounds = getFillBounds(dragState);

  if (!dragState || !targetBounds) {
    return {
      rows,
      affectedBounds: null,
    };
  }

  return fillRangeWithSource(rows, columns, sourceBounds, targetBounds, mapping);
}

/* =========================================================
   Fill series helpers
   ========================================================= */

export type FillSeriesType = "copy" | "linear" | "date" | "weekday" | "none";

export function detectFillSeries(values: unknown[]): FillSeriesType {
  if (values.length < 2) return "copy";
  if (values.some(isBlankCell)) return "copy"; // blanks are not a series

  const isoValues = values.map(toSeriesDateIso);
  if (isoValues.every((iso) => iso !== null)) {
    const series = isoValues as string[];
    const step = detectDateStep(series[0], series[1]);
    if (step.months === 0 && step.days === 0) return "copy";
    if (
      step.months === 0 &&
      step.days === 1 &&
      series.every((iso) => {
        const day = isoToLocalDate(iso).getDay();
        return day >= 1 && day <= 5;
      })
    ) {
      return "weekday";
    }
    return "date";
  }

  const numbers = values.map(toNumber);
  if (numbers.every((value) => value !== null)) {
    const step = (numbers[1] as number) - (numbers[0] as number);
    return Number.isFinite(step) && step !== 0 ? "linear" : "copy";
  }

  return "copy";
}

export function generateFillSeries(
  series: FillSeriesType,
  source: unknown[],
  count: number
): unknown[] {
  if (series === "copy" || series === "none" || count <= 0 || source.length < 2) {
    return source.slice(-count);
  }

  if (series === "linear") {
    const numbers = source.map((value) => toNumber(value));
    if (numbers.some((value) => value === null)) return source.slice(-count);

    const numericSeries = numbers as number[];
    const step = numericSeries[numericSeries.length - 1] - numericSeries[numericSeries.length - 2];

    const result: unknown[] = [];
    for (let index = 0; index < count; index++) {
      result.push(cleanFloat(numericSeries[numericSeries.length - 1] + step * (index + 1)));
    }
    return result;
  }

  if (series === "date" || series === "weekday") {
    const isoValues = source.map(toSeriesDateIso);
    if (isoValues.some((iso) => iso === null)) return source.slice(-count);

    const dates = isoValues as string[];
    const step = detectDateStep(dates[dates.length - 2], dates[dates.length - 1]);
    const result: unknown[] = [];

    if (series === "weekday") {
      const direction = step.days < 0 ? -1 : 1;
      let cursor = isoToLocalDate(dates[dates.length - 1]);
      for (let index = 0; index < count; index++) {
        do {
          cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + direction);
        } while (cursor.getDay() === 0 || cursor.getDay() === 6);
        result.push(localDateToIso(cursor));
      }
      return result;
    }

    const last = dates[dates.length - 1];
    for (let index = 0; index < count; index++) {
      result.push(addDateStep(last, step, index + 1));
    }
    return result;
  }

  return source.slice(-count);
}
