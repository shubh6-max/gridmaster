import type {
  GridColorFilters,
  GridColorSort,
  GridFilters,
  GridRowIdGetter,
  GridResolvedColumnDef,
  GridRow,
  GridSort,
} from "../types";
import { applyColorSortToRowIndexes, rowMatchesColorFilters } from "../features/colorFiltering";
import { rowMatchesFilters } from "../features/filtering";
import { createFormulaEvaluator } from "../features/formulas";
import { findSortableColumn } from "../features/sorting";
import { compareValues, resolveGridRowId } from "../utils";

/* =========================================================
   Display rows
   ========================================================= */

export function getDisplayRowIndexes<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  filters: GridFilters,
  sort: GridSort,
  colorFilters: GridColorFilters = {},
  colorSort: GridColorSort = null,
  options?: {
    enableFiltering?: boolean;
    enableSorting?: boolean;
    allowedRowIds?: Iterable<string> | null;
    preservedRowIds?: Iterable<string> | null;
    getRowId?: GridRowIdGetter<T>;
  }
): number[] {
  const enableFiltering = options?.enableFiltering ?? true;
  const enableSorting = options?.enableSorting ?? true;
  const allowedRowIdList = options?.allowedRowIds
    ? Array.from(options.allowedRowIds, (rowId) => String(rowId))
    : null;
  const allowedRowIds = allowedRowIdList ? new Set(allowedRowIdList) : null;
  const allowedRowOrder = new Map<string, number>();
  allowedRowIdList?.forEach((rowId, order) => {
    if (!allowedRowOrder.has(rowId)) {
      allowedRowOrder.set(rowId, order);
    }
  });
  const preservedRowIds = options?.preservedRowIds
    ? new Set(Array.from(options.preservedRowIds, (rowId) => String(rowId)))
    : null;

  let indexes = rows.map((_, index) => index);
  const evaluator = createFormulaEvaluator(rows, columns);

  if (allowedRowIds?.size) {
    indexes = indexes.filter((index) =>
      allowedRowIds.has(resolveGridRowId(rows[index], index, options?.getRowId))
    );

    indexes.sort((indexA, indexB) => {
      const orderA =
        allowedRowOrder.get(resolveGridRowId(rows[indexA], indexA, options?.getRowId)) ??
        Number.MAX_SAFE_INTEGER;
      const orderB =
        allowedRowOrder.get(resolveGridRowId(rows[indexB], indexB, options?.getRowId)) ??
        Number.MAX_SAFE_INTEGER;

      return orderA - orderB;
    });
  }

  if (enableFiltering) {
    indexes = indexes.filter((index) => {
      if (
        rowMatchesFilters(rows[index], columns, filters, { rows, rowIndex: index, evaluator }) &&
        rowMatchesColorFilters(rows[index], columns, colorFilters, {
          rows,
          rowIndex: index,
          evaluator,
        })
      ) {
        return true;
      }

      if (!preservedRowIds?.size) return false;

      return preservedRowIds.has(resolveGridRowId(rows[index], index, options?.getRowId));
    });
  }

  if (enableSorting && sort) {
    const column = findSortableColumn(columns, sort.columnKey);

    if (column) {
      const directionMultiplier = sort.direction === "asc" ? 1 : -1;

      indexes.sort((indexA, indexB) => {
        const valueA = evaluator.getCellValue(indexA, column.key);
        const valueB = evaluator.getCellValue(indexB, column.key);
        return compareValues(valueA, valueB) * directionMultiplier;
      });
    }
  }

  if (enableSorting && colorSort) {
    indexes = applyColorSortToRowIndexes(indexes, rows, columns, colorSort);
  }

  return indexes;
}

export function getDisplayRows<T extends GridRow>(rows: T[], displayRowIndexes: number[]): T[] {
  return displayRowIndexes.map((index) => rows[index]).filter(Boolean);
}

export function mapDisplayRowToSourceIndex(
  displayRowIndexes: number[],
  displayRowIndex: number
): number {
  return displayRowIndexes[displayRowIndex] ?? -1;
}
