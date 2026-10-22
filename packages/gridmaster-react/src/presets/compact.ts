import type { GridPresetProps, GridRow } from "../core/types";

export function createCompactGridPreset<T extends object = GridRow>(): GridPresetProps<T> {
  return {
    rowHeight: 28,
    headerHeight: 34,
    showFormulaBar: false,
    showStatusBar: true,
    frozenColumns: 1,
  };
}
