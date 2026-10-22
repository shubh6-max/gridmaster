import type { GridResolvedColumnDef, GridRow, GridSort, GridSortDirection } from "../types";
import { sortByDecoratedKeys } from "../utils";
import { createFormulaEvaluator } from "./formulas";

/* =========================================================
   Sort state helpers
   ========================================================= */

export function createSort(columnKey: string, direction: GridSortDirection): GridSort {
  return {
    columnKey,
    direction,
  };
}

export function clearSort(): GridSort {
  return null;
}

export function toggleSortDirection(direction?: GridSortDirection): GridSortDirection {
  if (!direction) return "asc";
  return direction === "asc" ? "desc" : "asc";
}

export function toggleColumnSort(currentSort: GridSort, columnKey: string): GridSort {
  if (!currentSort || currentSort.columnKey !== columnKey) {
    return createSort(columnKey, "asc");
  }

  if (currentSort.direction === "asc") {
    return createSort(columnKey, "desc");
  }

  return clearSort();
}

export function isSortedColumn(sort: GridSort, columnKey: string): boolean {
  return !!sort && sort.columnKey === columnKey;
}

/* =========================================================
   Column lookup
   ========================================================= */

export function findSortableColumn<T extends object>(
  columns: GridResolvedColumnDef<T>[],
  columnKey: string
): GridResolvedColumnDef<T> | undefined {
  return columns.find((col) => col.key === columnKey && col.sortable);
}

/* =========================================================
   Row sorting
   ========================================================= */

export function sortRows<T extends object>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  sort: GridSort
): T[] {
  if (!sort) return [...rows];

  const column = findSortableColumn(columns, sort.columnKey);
  if (!column) return [...rows];

  const directionMultiplier = sort.direction === "asc" ? 1 : -1;
  const evaluator = createFormulaEvaluator(rows, columns);

  const sortedIndexes = sortByDecoratedKeys(
    rows.map((_, index) => index),
    (index) => evaluator.getCellValue(index, column.key),
    directionMultiplier
  );

  return sortedIndexes.map((index) => rows[index]);
}

/* =========================================================
   Indexed sorting
   ========================================================= */

export function sortRowIndexes<T extends object>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  sort: GridSort
): number[] {
  const indexes = rows.map((_, index) => index);

  if (!sort) return indexes;

  const column = findSortableColumn(columns, sort.columnKey);
  if (!column) return indexes;

  const directionMultiplier = sort.direction === "asc" ? 1 : -1;
  const evaluator = createFormulaEvaluator(rows, columns);

  return sortByDecoratedKeys(
    indexes,
    (index) => evaluator.getCellValue(index, column.key),
    directionMultiplier
  );
}

/* =========================================================
   Header click helper
   ========================================================= */

export function nextSortOnHeaderClick(
  currentSort: GridSort,
  column: { key: string; sortable?: boolean }
): GridSort {
  if (!column.sortable) return currentSort;
  return toggleColumnSort(currentSort, column.key);
}
