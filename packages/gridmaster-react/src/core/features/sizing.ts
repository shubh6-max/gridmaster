import type { GridResolvedColumnDef, GridRow } from "../types";
import {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_MAX_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
} from "../constants";
import { calculateAutoFitWidth, clamp } from "../utils";
import { createFormulaEvaluator } from "./formulas";

/** Measure text width in px, or null when no real text-metrics API is available. */
export type GridTextMeasurer = (text: string, font?: string) => number | null;

/**
 * A-073: a deterministic, representative sample of row indexes — always the head and tail plus
 * evenly spaced rows in between — so the longest value is not missed just because it sits past the
 * first N rows.
 */
export function sampleRowIndexes(total: number, sampleSize: number): number[] {
  if (total <= 0) return [];
  const size = Math.max(sampleSize, 1);
  if (total <= size) return Array.from({ length: total }, (_, index) => index);

  const indexes = new Set<number>([0, total - 1]);
  const step = (total - 1) / (size - 1);
  for (let i = 0; i < size; i++) indexes.add(Math.round(i * step));
  return [...indexes].sort((a, b) => a - b);
}

let sharedMeasureCanvas: HTMLCanvasElement | null = null;

/** Canvas-based measurer, SSR-safe (browser globals touched only inside the function). */
function defaultMeasureText(text: string, font?: string): number | null {
  if (typeof document === "undefined") return null;
  try {
    sharedMeasureCanvas = sharedMeasureCanvas ?? document.createElement("canvas");
    const ctx = sharedMeasureCanvas.getContext("2d");
    if (!ctx) return null;
    if (font) ctx.font = font;
    return ctx.measureText(text).width;
  } catch {
    return null;
  }
}

/* =========================================================
   Width map helpers
   ========================================================= */

export type GridColumnWidths = Record<string, number>;

export function createInitialColumnWidths<T extends object>(
  columns: GridResolvedColumnDef<T>[]
): GridColumnWidths {
  const widths: GridColumnWidths = {};

  for (const column of columns) {
    widths[column.key] = column.width ?? DEFAULT_COLUMN_WIDTH;
  }

  return widths;
}

export function getColumnWidth<T extends object>(
  column: GridResolvedColumnDef<T>,
  widthMap?: GridColumnWidths
): number {
  return widthMap?.[column.key] ?? column.width ?? DEFAULT_COLUMN_WIDTH;
}

export function setColumnWidth(
  widthMap: GridColumnWidths,
  columnKey: string,
  width: number,
  options?: {
    minWidth?: number;
    maxWidth?: number;
  }
): GridColumnWidths {
  const minWidth = options?.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_COLUMN_WIDTH;

  return {
    ...widthMap,
    [columnKey]: clamp(width, minWidth, maxWidth),
  };
}

export function setManyColumnWidths(
  widthMap: GridColumnWidths,
  updates: Array<{ columnKey: string; width: number; minWidth?: number; maxWidth?: number }>
): GridColumnWidths {
  let next = { ...widthMap };

  for (const update of updates) {
    next = setColumnWidth(next, update.columnKey, update.width, {
      minWidth: update.minWidth,
      maxWidth: update.maxWidth,
    });
  }

  return next;
}

export function resetColumnWidth<T extends object>(
  widthMap: GridColumnWidths,
  column: GridResolvedColumnDef<T>
): GridColumnWidths {
  const next = { ...widthMap };
  next[column.key] = column.width ?? DEFAULT_COLUMN_WIDTH;
  return next;
}

/* =========================================================
   Resize helpers
   ========================================================= */

export function resizeColumn<T extends object>(
  widthMap: GridColumnWidths,
  column: GridResolvedColumnDef<T>,
  deltaX: number
): GridColumnWidths {
  const currentWidth = getColumnWidth(column, widthMap);
  const nextWidth = currentWidth + deltaX;

  return setColumnWidth(widthMap, column.key, nextWidth, {
    minWidth: column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH,
    maxWidth: column.maxWidth ?? DEFAULT_MAX_COLUMN_WIDTH,
  });
}

export function startResizeState<T extends object>(
  column: GridResolvedColumnDef<T>,
  widthMap: GridColumnWidths,
  startX: number
): {
  columnKey: string;
  startX: number;
  startWidth: number;
  minWidth: number;
  maxWidth: number;
} {
  return {
    columnKey: column.key,
    startX,
    startWidth: getColumnWidth(column, widthMap),
    minWidth: column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH,
    maxWidth: column.maxWidth ?? DEFAULT_MAX_COLUMN_WIDTH,
  };
}

export function getResizedWidth(
  resizeState: {
    startX: number;
    startWidth: number;
    minWidth: number;
    maxWidth: number;
  },
  currentX: number
): number {
  return clamp(
    resizeState.startWidth + (currentX - resizeState.startX),
    resizeState.minWidth,
    resizeState.maxWidth
  );
}

/* =========================================================
   Auto-fit helpers
   ========================================================= */

export function autoFitColumn<T extends object>(
  widthMap: GridColumnWidths,
  column: GridResolvedColumnDef<T>,
  rows: T[],
  options?: {
    charWidth?: number;
    padding?: number;
    sampleSize?: number;
    columns?: GridResolvedColumnDef<T>[];
    /** Injectable text metrics (A-073). Defaults to a canvas measurer; falls back to the estimate. */
    measureText?: GridTextMeasurer;
    /** CSS `font` shorthand to measure with, e.g. the grid's computed cell font. */
    font?: string;
  }
): GridColumnWidths {
  const sampleSize = options?.sampleSize ?? 500;
  // A-046: evaluate against the FULL columns so cross-column formulas resolve (not `#REF!`).
  const evaluator = createFormulaEvaluator(rows, options?.columns ?? [column]);

  const values = sampleRowIndexes(rows.length, sampleSize).map((rowIndex) =>
    evaluator.getCellDisplayString(rowIndex, column.key)
  );

  const minWidth = column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  const maxWidth = column.maxWidth ?? DEFAULT_MAX_COLUMN_WIDTH;
  const measure = options?.measureText ?? defaultMeasureText;
  const padding = options?.padding ?? 32;

  let maxPx = 0;
  let measured = false;
  for (const text of [column.title, ...values]) {
    const width = measure(text, options?.font);
    if (width != null) {
      measured = true;
      if (width > maxPx) maxPx = width;
    }
  }

  const fittedWidth = measured
    ? clamp(Math.ceil(maxPx) + padding, minWidth, maxWidth)
    : // No real measurer (SSR / jsdom): fall back to the character-count estimate.
      calculateAutoFitWidth(column.title, values, {
        minWidth,
        maxWidth,
        charWidth: options?.charWidth,
        padding: options?.padding,
      });

  return {
    ...widthMap,
    [column.key]: fittedWidth,
  };
}

export function autoFitManyColumns<T extends object>(
  widthMap: GridColumnWidths,
  columns: GridResolvedColumnDef<T>[],
  rows: T[],
  options?: {
    charWidth?: number;
    padding?: number;
    sampleSize?: number;
    measureText?: GridTextMeasurer;
    font?: string;
  }
): GridColumnWidths {
  let next = { ...widthMap };

  for (const column of columns) {
    if (column.hidden) continue;
    next = autoFitColumn(next, column, rows, { ...options, columns });
  }

  return next;
}

/* =========================================================
   Offset helpers
   ========================================================= */

export function buildColumnOffsets<T extends object>(
  columns: GridResolvedColumnDef<T>[],
  widthMap: GridColumnWidths,
  options?: {
    includeHidden?: boolean;
  }
): Record<string, number> {
  const includeHidden = options?.includeHidden ?? false;
  const offsets: Record<string, number> = {};
  let running = 0;

  for (const column of columns) {
    if (column.hidden && !includeHidden) continue;

    offsets[column.key] = running;
    running += getColumnWidth(column, widthMap);
  }

  return offsets;
}

export function getTotalTableWidth<T extends object>(
  columns: GridResolvedColumnDef<T>[],
  widthMap: GridColumnWidths,
  options?: {
    includeHidden?: boolean;
    rowNumberWidth?: number;
  }
): number {
  const includeHidden = options?.includeHidden ?? false;
  const rowNumberWidth = options?.rowNumberWidth ?? 0;

  let total = rowNumberWidth;

  for (const column of columns) {
    if (column.hidden && !includeHidden) continue;
    total += getColumnWidth(column, widthMap);
  }

  return total;
}

/* =========================================================
   Visible column helpers
   ========================================================= */

export function getVisibleColumns<T extends object>(
  columns: GridResolvedColumnDef<T>[]
): GridResolvedColumnDef<T>[] {
  return columns.filter((column) => !column.hidden);
}

export function getFrozenColumns<T extends object>(
  columns: GridResolvedColumnDef<T>[],
  frozenCount: number
): GridResolvedColumnDef<T>[] {
  const visible = getVisibleColumns(columns);
  return visible.slice(0, Math.max(frozenCount, 0));
}

/* =========================================================
   Width sync helpers
   ========================================================= */

export function syncWidthMapWithColumns<T extends object>(
  widthMap: GridColumnWidths,
  columns: GridResolvedColumnDef<T>[]
): GridColumnWidths {
  const next: GridColumnWidths = {};

  for (const column of columns) {
    next[column.key] = widthMap[column.key] ?? column.width ?? DEFAULT_COLUMN_WIDTH;
  }

  return next;
}
