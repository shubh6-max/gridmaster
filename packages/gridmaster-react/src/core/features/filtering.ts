import type { GridColumnFilter, GridFilters, GridResolvedColumnDef, GridRow } from "../types";
import { getRowValue, normalizeValue, toNumber } from "../utils";
import { createFormulaEvaluator, type GridFormulaEvaluator } from "./formulas";

/* =========================================================
   Filter creators
   ========================================================= */

export function createValueSetFilter(values: Iterable<string>): GridColumnFilter {
  return {
    type: "valueSet",
    values: new Set(Array.from(values).map((v) => normalizeValue(v))),
  };
}

export function createConditionFilter(
  operator: GridColumnFilter extends { type: "condition"; operator: infer O } ? O : never,
  value?: unknown
): GridColumnFilter {
  return {
    type: "condition",
    operator,
    value,
  };
}

export function clearFilters(): GridFilters {
  return {};
}

export function clearFilter(filters: GridFilters, columnKey: string): GridFilters {
  const next = { ...filters };
  delete next[columnKey];
  return next;
}

export function setFilter(
  filters: GridFilters,
  columnKey: string,
  filter: GridColumnFilter | null
): GridFilters {
  const next = { ...filters };

  if (!filter) {
    delete next[columnKey];
    return next;
  }

  if (filter.type === "valueSet" && filter.values.size === 0) {
    delete next[columnKey];
    return next;
  }

  next[columnKey] = filter;
  return next;
}

export function hasActiveFilters(filters: GridFilters): boolean {
  return Object.keys(filters).length > 0;
}

export function isFilteredColumn(filters: GridFilters, columnKey: string): boolean {
  return !!filters[columnKey];
}

/* =========================================================
   Filter evaluation helpers
   ========================================================= */

export function matchesValueSetFilter(
  rawValue: unknown,
  filter: Extract<GridColumnFilter, { type: "valueSet" }>
): boolean {
  return filter.values.has(normalizeValue(rawValue));
}

/**
 * A-069: numeric filter operands. A blank/null/"" cell has NO number (the shared `toNumber` coerces
 * "" to 0, which would make every blank match `< 5`). Treat blanks as "no value" LOCALLY here —
 * never in the shared `toNumber`, which ~22 other callers depend on.
 */
function numericOperand(value: unknown): number | null {
  if (normalizeValue(value) === "") return null;
  return toNumber(value);
}

export function matchesConditionFilter(
  rawValue: unknown,
  filter: Extract<GridColumnFilter, { type: "condition" }>
): boolean {
  const normalized = normalizeValue(rawValue);

  switch (filter.operator) {
    case "includes":
      return normalized.toLowerCase().includes(normalizeValue(filter.value).toLowerCase());

    case "equals":
      return normalized.toLowerCase() === normalizeValue(filter.value).toLowerCase();

    case "startsWith":
      return normalized.toLowerCase().startsWith(normalizeValue(filter.value).toLowerCase());

    case "endsWith":
      return normalized.toLowerCase().endsWith(normalizeValue(filter.value).toLowerCase());

    case "isEmpty":
      return normalized === "";

    case "isNotEmpty":
      return normalized !== "";

    case "gt": {
      const left = numericOperand(rawValue);
      const right = numericOperand(filter.value);
      return left !== null && right !== null ? left > right : false;
    }

    case "gte": {
      const left = numericOperand(rawValue);
      const right = numericOperand(filter.value);
      return left !== null && right !== null ? left >= right : false;
    }

    case "lt": {
      const left = numericOperand(rawValue);
      const right = numericOperand(filter.value);
      return left !== null && right !== null ? left < right : false;
    }

    case "lte": {
      const left = numericOperand(rawValue);
      const right = numericOperand(filter.value);
      return left !== null && right !== null ? left <= right : false;
    }

    case "in": {
      const candidates = Array.isArray(filter.value) ? filter.value : [filter.value];
      const normalizedCandidates = new Set(candidates.map((v) => normalizeValue(v).toLowerCase()));
      return normalizedCandidates.has(normalized.toLowerCase());
    }

    default:
      return true;
  }
}

export function matchesFilter(rawValue: unknown, filter: GridColumnFilter): boolean {
  if (filter.type === "valueSet") return matchesValueSetFilter(rawValue, filter);
  return matchesConditionFilter(rawValue, filter);
}

/* =========================================================
   Row filtering
   ========================================================= */

/** A-071: one `key -> column` Map built once, shared across the whole row loop. */
export function buildColumnMap<T extends object>(
  columns: GridResolvedColumnDef<T>[]
): Map<string, GridResolvedColumnDef<T>> {
  const map = new Map<string, GridResolvedColumnDef<T>>();
  for (const column of columns) map.set(column.key, column);
  return map;
}

export type GridCompiledFilter<T extends object> = {
  column: GridResolvedColumnDef<T>;
  filter: GridColumnFilter;
};

/**
 * A-071: resolve every active filter to its column ONCE, dropping filters for missing columns, so
 * the per-row path does no `Object.keys` / `columns.find` work.
 */
export function compileFilters<T extends object>(
  columns: GridResolvedColumnDef<T>[],
  filters: GridFilters
): GridCompiledFilter<T>[] {
  const columnMap = buildColumnMap(columns);
  const compiled: GridCompiledFilter<T>[] = [];
  for (const columnKey of Object.keys(filters)) {
    const filter = filters[columnKey];
    const column = columnMap.get(columnKey);
    if (filter && column) compiled.push({ column, filter });
  }
  return compiled;
}

export function rowMatchesCompiledFilters<T extends object>(
  row: T,
  compiled: GridCompiledFilter<T>[],
  options?: {
    rows?: T[];
    rowIndex?: number;
    evaluator?: GridFormulaEvaluator<T>;
  }
): boolean {
  if (!compiled.length) return true;
  const rowIndex = options?.rowIndex ?? options?.rows?.indexOf(row) ?? -1;
  const evaluator = options?.evaluator ?? null;

  for (const { column, filter } of compiled) {
    const value =
      evaluator && rowIndex >= 0
        ? evaluator.getCellValue(rowIndex, column.key)
        : getRowValue(row, column);
    if (!matchesFilter(value, filter)) return false;
  }

  return true;
}

export function rowMatchesFilters<T extends object>(
  row: T,
  columns: GridResolvedColumnDef<T>[],
  filters: GridFilters,
  options?: {
    rows?: T[];
    rowIndex?: number;
    evaluator?: GridFormulaEvaluator<T>;
    /** A-071: a prebuilt column Map so the hot loop skips `columns.find` per row. */
    columnMap?: Map<string, GridResolvedColumnDef<T>>;
  }
): boolean {
  const keys = Object.keys(filters);
  if (!keys.length) return true;
  const rowIndex = options?.rowIndex ?? options?.rows?.indexOf(row) ?? -1;
  const evaluator =
    options?.evaluator ?? (options?.rows ? createFormulaEvaluator(options.rows, columns) : null);
  const columnMap = options?.columnMap;

  for (const columnKey of keys) {
    const filter = filters[columnKey];
    if (!filter) continue;

    const column = columnMap ? columnMap.get(columnKey) : columns.find((col) => col.key === columnKey);
    if (!column) continue;

    const value =
      evaluator && rowIndex >= 0
        ? evaluator.getCellValue(rowIndex, column.key)
        : getRowValue(row, column);
    if (!matchesFilter(value, filter)) return false;
  }

  return true;
}

export function filterRows<T extends object>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  filters: GridFilters
): T[] {
  if (!hasActiveFilters(filters)) return [...rows];
  const evaluator = createFormulaEvaluator(rows, columns);
  const compiled = compileFilters(columns, filters);
  return rows.filter((row, rowIndex) =>
    rowMatchesCompiledFilters(row, compiled, { rows, rowIndex, evaluator })
  );
}

export function filterRowIndexes<T extends object>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  filters: GridFilters
): number[] {
  if (!hasActiveFilters(filters)) return rows.map((_, index) => index);

  const result: number[] = [];
  const evaluator = createFormulaEvaluator(rows, columns);
  const compiled = compileFilters(columns, filters);

  for (let index = 0; index < rows.length; index++) {
    if (rowMatchesCompiledFilters(rows[index], compiled, { rows, rowIndex: index, evaluator })) {
      result.push(index);
    }
  }

  return result;
}

/* =========================================================
   Unique values for filter menus
   ========================================================= */

export function getFilterValuesForColumn<T extends object>(
  rows: T[],
  column: GridResolvedColumnDef<T>,
  columns?: GridResolvedColumnDef<T>[]
): string[] {
  const set = new Set<string>();
  const evaluator = createFormulaEvaluator(rows, columns ?? [column]);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    set.add(normalizeValue(evaluator.getCellValue(rowIndex, column.key)));
  }

  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function getFilteredUniqueValuesForColumn<T extends object>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  targetColumnKey: string,
  filters: GridFilters
): string[] {
  const targetColumn = columns.find((col) => col.key === targetColumnKey);
  if (!targetColumn) return [];

  const otherFilters = { ...filters };
  delete otherFilters[targetColumnKey];

  // A-046: build ONE evaluator over the FULL rows/columns so formulas keep their real cell
  // addresses, then collect values only for the rows the other filters leave visible. Evaluating
  // against a pre-filtered row subset shifted every formula's references (yielding `#REF!`/wrong).
  const evaluator = createFormulaEvaluator(rows, columns);
  const compiled = compileFilters(columns, otherFilters);
  const set = new Set<string>();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    if (!rowMatchesCompiledFilters(rows[rowIndex], compiled, { rows, rowIndex, evaluator })) {
      continue;
    }
    set.add(normalizeValue(evaluator.getCellValue(rowIndex, targetColumn.key)));
  }

  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
