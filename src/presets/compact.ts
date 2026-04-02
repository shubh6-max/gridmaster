import type { GridMasterProps, GridRow } from "../core/types";

export function createCompactGridPreset<T extends GridRow = GridRow>(): Partial<GridMasterProps<T>> {
  return {
    rowHeight: 28,
    headerHeight: 34,
    showFormulaBar: false,
    showStatusBar: true,
    frozenColumns: 1,
  };
}
