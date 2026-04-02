import type {
  GridResolvedColumnDef,
  GridRow,
  GridSort,
  GridSortDirection,
} from "../types";
import { compareValues, getRowValue } from "../utils";

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

  return [...rows].sort((rowA, rowB) => {
    const valueA = getRowValue(rowA, column);
    const valueB = getRowValue(rowB, column);

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

  indexes.sort((indexA, indexB) => {
    const valueA = getRowValue(rows[indexA], column);
    const valueB = getRowValue(rows[indexB], column);

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
