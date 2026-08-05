import type {
  GridColorFilter,
  GridColorFilters,
  GridColorSort,
  GridFilters,
  GridResolvedColumnDef,
  GridRow,
} from "../types";
import { getRowValue, normalizeValue } from "../utils";
import { rowMatchesFilters } from "./filtering";
import { createFormulaEvaluator, type GridFormulaEvaluator } from "./formulas";

function resolveColorFieldValue<T extends GridRow>(
  row: T,
  rowIndex: number,
  columns: GridResolvedColumnDef<T>[],
  columnKey: string,
  evaluator: GridFormulaEvaluator<T> | null
): unknown {
  const column = columns.find((col) => col.key === columnKey);
  if (!column) {
    return row[columnKey];
  }

  if (evaluator && rowIndex >= 0) {
    return evaluator.getCellValue(rowIndex, column.key);
  }

  return getRowValue(row, column);
}

export function createColorFilter(values: Iterable<string>): GridColorFilter {
  return {
    values: new Set(Array.from(values, (value) => normalizeValue(value))),
  };
}

export function clearColorFilters(): GridColorFilters {
  return {};
}

export function clearColorFilter(
  colorFilters: GridColorFilters,
  columnKey: string
): GridColorFilters {
  const next = { ...colorFilters };
  delete next[columnKey];
  return next;
}

export function setColorFilter(
  colorFilters: GridColorFilters,
  columnKey: string,
  filter: GridColorFilter | null
): GridColorFilters {
  if (!filter || filter.values.size === 0) {
    return clearColorFilter(colorFilters, columnKey);
  }

  return {
    ...colorFilters,
    [columnKey]: {
      values: new Set(filter.values),
    },
  };
}

export function hasActiveColorFilters(colorFilters: GridColorFilters): boolean {
  return Object.keys(colorFilters).length > 0;
}

export function matchesColorFilterValue(rawValue: unknown, filter: GridColorFilter): boolean {
  return filter.values.has(normalizeValue(rawValue));
}

export function rowMatchesColorFilters<T extends GridRow>(
  row: T,
  columns: GridResolvedColumnDef<T>[],
  colorFilters: GridColorFilters,
  options?: {
    rows?: T[];
    rowIndex?: number;
    evaluator?: GridFormulaEvaluator<T>;
  }
): boolean {
  const keys = Object.keys(colorFilters);
  if (!keys.length) return true;

  const rowIndex = options?.rowIndex ?? options?.rows?.indexOf(row) ?? -1;
  const evaluator =
    options?.evaluator ?? (options?.rows ? createFormulaEvaluator(options.rows, columns) : null);

  for (const columnKey of keys) {
    const filter = colorFilters[columnKey];
    if (!filter || filter.values.size === 0) continue;
    const value = resolveColorFieldValue(row, rowIndex, columns, columnKey, evaluator);

    if (!matchesColorFilterValue(value, filter)) {
      return false;
    }
  }

  return true;
}

export function applyColorSortToRowIndexes<T extends GridRow>(
  indexes: number[],
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  colorSort: GridColorSort
): number[] {
  if (!colorSort?.columnKey) return indexes;

  const evaluator = createFormulaEvaluator(rows, columns);
  const targetValue = normalizeValue(colorSort.value);
  const matching: number[] = [];
  const remaining: number[] = [];

  indexes.forEach((rowIndex) => {
    const value = normalizeValue(
      resolveColorFieldValue(
        rows[rowIndex],
        rowIndex,
        columns,
        colorSort.columnKey,
        evaluator
      )
    );
    if (value === targetValue) {
      matching.push(rowIndex);
      return;
    }
    remaining.push(rowIndex);
  });

  return [...matching, ...remaining];
}

export function getFilteredColorOptionsForColumn<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  targetColumnKey: string,
  filters: GridFilters,
  colorFilters: GridColorFilters
): Array<{ value: string; count: number }> {
  const nextColorFilters = { ...colorFilters };
  delete nextColorFilters[targetColumnKey];

  const evaluator = createFormulaEvaluator(rows, columns);
  const counts = new Map<string, number>();

  rows.forEach((row, rowIndex) => {
    if (!rowMatchesFilters(row, columns, filters, { rows, rowIndex, evaluator })) {
      return;
    }
    if (!rowMatchesColorFilters(row, columns, nextColorFilters, { rows, rowIndex, evaluator })) {
      return;
    }

    const value = normalizeValue(
      resolveColorFieldValue(row, rowIndex, columns, targetColumnKey, evaluator)
    );
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => left.value.localeCompare(right.value, undefined, { sensitivity: "base" }));
}
