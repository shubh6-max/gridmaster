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
import { createFormulaEvaluator, type GridFormulaEvaluator } from "../features/formulas";
import { findSortableColumn } from "../features/sorting";
import { buildColumnMap } from "../features/filtering";
import { resolveGridRowId, sortByDecoratedKeys } from "../utils";

/* =========================================================
   Display rows
   ========================================================= */

export function getDisplayRowIndexes<T extends object>(
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
    /**
     * A-066: reuse the caller's snapshot evaluator instead of building (and re-evaluating) a second
     * one per pipeline run. Must be built from the SAME `rows`/`columns` passed here, so the result
     * is byte-for-byte identical; callers that pass modified rows/columns (insert/delete) omit it.
     */
    evaluator?: GridFormulaEvaluator<T>;
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
  const evaluator = options?.evaluator ?? createFormulaEvaluator(rows, columns);

  // An EMPTY allow-list means "no rows are permitted"; only null/undefined means unrestricted.
  if (allowedRowIds) {
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
    // A-071: hoist the per-filter column lookup out of the row loop (one shared Map, not a
    // `columns.find` per row per filter) so 100k rows × N filters no longer rescans `columns`.
    const columnMap = buildColumnMap(columns);
    indexes = indexes.filter((index) => {
      if (
        rowMatchesFilters(rows[index], columns, filters, {
          rows,
          rowIndex: index,
          evaluator,
          columnMap,
        }) &&
        rowMatchesColorFilters(rows[index], columns, colorFilters, {
          rows,
          rowIndex: index,
          evaluator,
          columnMap,
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
      indexes = sortByDecoratedKeys(
        indexes,
        (index) => evaluator.getCellValue(index, column.key),
        directionMultiplier
      );
    }
  }

  if (enableSorting && colorSort) {
    indexes = applyColorSortToRowIndexes(indexes, rows, columns, colorSort);
  }

  return indexes;
}

export function getDisplayRows<T extends object>(rows: T[], displayRowIndexes: number[]): T[] {
  return displayRowIndexes.map((index) => rows[index]).filter(Boolean);
}

export function mapDisplayRowToSourceIndex(
  displayRowIndexes: number[],
  displayRowIndex: number
): number {
  return displayRowIndexes[displayRowIndex] ?? -1;
}
