import type { GridColumnDef, GridResolvedColumnDef, GridRow } from "../types";
import { resolveColumns } from "../utils";

export function normalizeColumns<T extends GridRow>(
  columns: GridColumnDef<T>[]
): GridResolvedColumnDef<T>[] {
  return resolveColumns(columns);
}

export function reorderColumns<T extends GridRow>(
  columns: GridColumnDef<T>[],
  orderedKeys: string[]
): GridColumnDef<T>[] {
  const order = new Map(orderedKeys.map((key, index) => [key, index]));

  return [...columns].sort((left, right) => {
    const leftIndex = order.get(left.key) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = order.get(right.key) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

export function showOnlyColumns<T extends GridRow>(
  columns: GridColumnDef<T>[],
  visibleKeys: string[]
): GridColumnDef<T>[] {
  const visibleSet = new Set(visibleKeys);
  return columns.map((column) => ({
    ...column,
    hidden: !visibleSet.has(column.key),
  }));
}
