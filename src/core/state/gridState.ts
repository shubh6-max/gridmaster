import type {
  GridFilters,
  GridResolvedColumnDef,
  GridRow,
  GridSort,
} from "../types";
import { rowMatchesFilters } from "../features/filtering";
import { createFormulaEvaluator } from "../features/formulas";
import { findSortableColumn } from "../features/sorting";
import { compareValues, getRowValue } from "../utils";

/* =========================================================
   Display rows
   ========================================================= */

export function getDisplayRowIndexes<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  filters: GridFilters,
  sort: GridSort,
  options?: {
    enableFiltering?: boolean;
    enableSorting?: boolean;
  }
): number[] {
  const enableFiltering = options?.enableFiltering ?? true;
  const enableSorting = options?.enableSorting ?? true;

  let indexes = rows.map((_, index) => index);
  const evaluator = createFormulaEvaluator(rows, columns);

  if (enableFiltering) {
    indexes = indexes.filter((index) =>
      rowMatchesFilters(rows[index], columns, filters, { rows, rowIndex: index, evaluator })
    );
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
