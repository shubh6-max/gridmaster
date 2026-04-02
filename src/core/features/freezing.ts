import type { GridResolvedColumnDef, GridRow } from "../types";
import { clamp } from "../utils";

export function clampFrozenColumns(frozenColumns: number, visibleColumnCount: number): number {
  return clamp(frozenColumns, 0, Math.max(visibleColumnCount, 0));
}

export function isFrozenColumnIndex(columnIndex: number, frozenColumns: number): boolean {
  return columnIndex >= 0 && columnIndex < frozenColumns;
}

export function getFrozenColumnKeys<T extends GridRow>(
  columns: GridResolvedColumnDef<T>[],
  frozenColumns: number
): string[] {
  const count = clampFrozenColumns(
    frozenColumns,
    columns.filter((column) => !column.hidden).length
  );

  return columns
    .filter((column) => !column.hidden)
    .slice(0, count)
    .map((column) => column.key);
}

export function toggleFrozenThroughColumn(
  currentFrozenColumns: number,
  columnIndex: number,
  visibleColumnCount: number
): number {
  const nextFrozenColumns = clampFrozenColumns(columnIndex + 1, visibleColumnCount);
  return currentFrozenColumns === nextFrozenColumns ? 0 : nextFrozenColumns;
}
