import type { GridRow } from "../../core/types";

export type GridPropRowSyncAction = "ignore" | "consume-emitted" | "reset";

export function getGridPropRowSyncAction<T extends GridRow>({
  nextRows,
  previousPropRows,
  lastEmittedRows,
  currentRows,
  rowsEqual,
}: {
  nextRows: T[];
  previousPropRows: T[];
  lastEmittedRows: T[] | null;
  currentRows: T[];
  rowsEqual: (left: T[], right: T[]) => boolean;
}): GridPropRowSyncAction {
  if (rowsEqual(nextRows, previousPropRows)) return "ignore";
  if (lastEmittedRows && rowsEqual(nextRows, lastEmittedRows)) return "consume-emitted";
  if (rowsEqual(nextRows, currentRows)) return "ignore";
  return "reset";
}
