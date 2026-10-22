import type { GridPresetProps, GridRow } from "../core/types";

export function createReadonlyGridPreset<T extends object = GridRow>(): GridPresetProps<T> {
  return {
    mode: "readonly",
    enableEditing: false,
    enableClipboard: true,
    enableFillHandle: false,
    enableUndoRedo: false,
    enableInsertRow: false,
    enableInsertColumn: false,
    showFormulaBar: true,
    showStatusBar: true,
  };
}
