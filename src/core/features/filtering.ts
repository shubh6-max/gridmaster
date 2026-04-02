import type {
  GridColumnFilter,
  GridFilters,
  GridResolvedColumnDef,
  GridRow,
} from "../types";
import { getRowValue, normalizeValue, toNumber } from "../utils";

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
  value?: any
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

export function matchesConditionFilter(
  rawValue: unknown,
  filter: Extract<GridColumnFilter, { type: "condition" }>
): boolean {
  const normalized = normalizeValue(rawValue);

  switch (filter.operator) {
    case "includes":
      return normalized
        .toLowerCase()
        .includes(normalizeValue(filter.value).toLowerCase());

    case "equals":
      return normalized.toLowerCase() === normalizeValue(filter.value).toLowerCase();

    case "startsWith":
      return normalized
        .toLowerCase()
        .startsWith(normalizeValue(filter.value).toLowerCase());

    case "endsWith":
      return normalized
        .toLowerCase()
        .endsWith(normalizeValue(filter.value).toLowerCase());

    case "isEmpty":
      return normalized === "";

    case "isNotEmpty":
      return normalized !== "";

    case "gt": {
      const left = toNumber(rawValue);
      const right = toNumber(filter.value);
      return left !== null && right !== null ? left > right : false;
    }

    case "gte": {
      const left = toNumber(rawValue);
      const right = toNumber(filter.value);
      return left !== null && right !== null ? left >= right : false;
    }

    case "lt": {
      const left = toNumber(rawValue);
      const right = toNumber(filter.value);
      return left !== null && right !== null ? left < right : false;
    }

    case "lte": {
      const left = toNumber(rawValue);
      const right = toNumber(filter.value);
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

export function rowMatchesFilters<T extends GridRow>(
  row: T,
  columns: GridResolvedColumnDef<T>[],
  filters: GridFilters
): boolean {
  const keys = Object.keys(filters);
  if (!keys.length) return true;

  for (const columnKey of keys) {
    const filter = filters[columnKey];
    if (!filter) continue;

    const column = columns.find((col) => col.key === columnKey);
    if (!column) continue;

    const value = getRowValue(row, column);
    if (!matchesFilter(value, filter)) return false;
  }

  return true;
}

export function filterRows<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  filters: GridFilters
): T[] {
  if (!hasActiveFilters(filters)) return [...rows];
  return rows.filter((row) => rowMatchesFilters(row, columns, filters));
}

export function filterRowIndexes<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  filters: GridFilters
): number[] {
  if (!hasActiveFilters(filters)) return rows.map((_, index) => index);

  const result: number[] = [];

  for (let index = 0; index < rows.length; index++) {
    if (rowMatchesFilters(rows[index], columns, filters)) {
      result.push(index);
    }
  }

  return result;
}

/* =========================================================
   Unique values for filter menus
   ========================================================= */

export function getFilterValuesForColumn<T extends GridRow>(
  rows: T[],
  column: GridResolvedColumnDef<T>
): string[] {
  const set = new Set<string>();

  for (const row of rows) {
    set.add(normalizeValue(getRowValue(row, column)));
  }

  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function getFilteredUniqueValuesForColumn<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  targetColumnKey: string,
  filters: GridFilters
): string[] {
  const targetColumn = columns.find((col) => col.key === targetColumnKey);
  if (!targetColumn) return [];

  const otherFilters = { ...filters };
  delete otherFilters[targetColumnKey];

  const visibleRows = filterRows(rows, columns, otherFilters);
  return getFilterValuesForColumn(visibleRows, targetColumn);
}
