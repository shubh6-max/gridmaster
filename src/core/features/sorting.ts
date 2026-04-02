import type {
  GridResolvedColumnDef,
  GridRow,
  GridSort,
  GridSortDirection,
} from "../types";
import { compareValues, getRowValue } from "../utils";
import { createFormulaEvaluator } from "./formulas";

/* =========================================================
   Sort state helpers
   ========================================================= */

export function createSort(
  columnKey: string,
  direction: GridSortDirection
): GridSort {
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

export function toggleColumnSort(
  currentSort: GridSort,
  columnKey: string
): GridSort {
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

export function findSortableColumn<T extends GridRow>(
  columns: GridResolvedColumnDef<T>[],
  columnKey: string
): GridResolvedColumnDef<T> | undefined {
  return columns.find((col) => col.key === columnKey && col.sortable);
}

/* =========================================================
   Row sorting
   ========================================================= */

export function sortRows<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  sort: GridSort
): T[] {
  if (!sort) return [...rows];

  const column = findSortableColumn(columns, sort.columnKey);
  if (!column) return [...rows];

  const directionMultiplier = sort.direction === "asc" ? 1 : -1;
  const evaluator = createFormulaEvaluator(rows, columns);
  const rowIndexes = new Map<T, number>();

  rows.forEach((row, index) => {
    rowIndexes.set(row, index);
  });

  return [...rows].sort((rowA, rowB) => {
    const indexA = rowIndexes.get(rowA) ?? -1;
    const indexB = rowIndexes.get(rowB) ?? -1;
    const valueA =
      indexA >= 0 ? evaluator.getCellValue(indexA, column.key) : getRowValue(rowA, column);
    const valueB =
      indexB >= 0 ? evaluator.getCellValue(indexB, column.key) : getRowValue(rowB, column);

    const result = compareValues(valueA, valueB);
    return result * directionMultiplier;
  });
}

/* =========================================================
   Indexed sorting
   ========================================================= */

export function sortRowIndexes<T extends GridRow>(
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

  indexes.sort((indexA, indexB) => {
    const valueA = evaluator.getCellValue(indexA, column.key);
    const valueB = evaluator.getCellValue(indexB, column.key);

    const result = compareValues(valueA, valueB);
    return result * directionMultiplier;
  });

  return indexes;
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
