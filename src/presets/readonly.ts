import type { GridMasterProps, GridRow } from "../core/types";

export function createReadonlyGridPreset<T extends GridRow = GridRow>(): Partial<GridMasterProps<T>> {
  return {
    mode: "readonly",
    enableEditing: false,
    enableClipboard: true,
    enableFillHandle: false,
    enableUndoRedo: false,
    showFormulaBar: true,
    showStatusBar: true,
  };
}
