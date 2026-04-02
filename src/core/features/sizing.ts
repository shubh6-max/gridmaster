import type { GridResolvedColumnDef, GridRow } from "../types";
import {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_MAX_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
} from "../constants";
import { calculateAutoFitWidth, clamp } from "../utils";
import { createFormulaEvaluator } from "./formulas";

/* =========================================================
   Width map helpers
   ========================================================= */

export type GridColumnWidths = Record<string, number>;

export function createInitialColumnWidths<T extends GridRow>(
  columns: GridResolvedColumnDef<T>[]
): GridColumnWidths {
  const widths: GridColumnWidths = {};

  for (const column of columns) {
    widths[column.key] = column.width ?? DEFAULT_COLUMN_WIDTH;
  }

  return widths;
}

export function getColumnWidth<T extends GridRow>(
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

export function resetColumnWidth<T extends GridRow>(
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

export function resizeColumn<T extends GridRow>(
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

export function startResizeState<T extends GridRow>(
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

export function autoFitColumn<T extends GridRow>(
  widthMap: GridColumnWidths,
  column: GridResolvedColumnDef<T>,
  rows: T[],
  options?: {
    charWidth?: number;
    padding?: number;
    sampleSize?: number;
    columns?: GridResolvedColumnDef<T>[];
  }
): GridColumnWidths {
  const sampleSize = options?.sampleSize ?? 500;
  const sampledRows = rows.slice(0, sampleSize);
  const evaluator = createFormulaEvaluator(rows, options?.columns ?? [column]);

  const values = sampledRows.map((_, rowIndex) =>
    evaluator.getCellDisplayString(rowIndex, column.key)
  );

  const fittedWidth = calculateAutoFitWidth(column.title, values, {
    minWidth: column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH,
    maxWidth: column.maxWidth ?? DEFAULT_MAX_COLUMN_WIDTH,
    charWidth: options?.charWidth,
    padding: options?.padding,
  });

  return {
    ...widthMap,
    [column.key]: fittedWidth,
  };
}

export function autoFitManyColumns<T extends GridRow>(
  widthMap: GridColumnWidths,
  columns: GridResolvedColumnDef<T>[],
  rows: T[],
  options?: {
    charWidth?: number;
    padding?: number;
    sampleSize?: number;
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

export function buildColumnOffsets<T extends GridRow>(
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

export function getTotalTableWidth<T extends GridRow>(
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

export function getVisibleColumns<T extends GridRow>(
  columns: GridResolvedColumnDef<T>[]
): GridResolvedColumnDef<T>[] {
  return columns.filter((column) => !column.hidden);
}

export function getFrozenColumns<T extends GridRow>(
  columns: GridResolvedColumnDef<T>[],
  frozenCount: number
): GridResolvedColumnDef<T>[] {
  const visible = getVisibleColumns(columns);
  return visible.slice(0, Math.max(frozenCount, 0));
}

/* =========================================================
   Width sync helpers
   ========================================================= */

export function syncWidthMapWithColumns<T extends GridRow>(
  widthMap: GridColumnWidths,
  columns: GridResolvedColumnDef<T>[]
): GridColumnWidths {
  const next: GridColumnWidths = {};

  for (const column of columns) {
    next[column.key] = widthMap[column.key] ?? column.width ?? DEFAULT_COLUMN_WIDTH;
  }

  return next;
}
