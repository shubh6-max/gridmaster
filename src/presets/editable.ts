import type { GridMasterProps, GridRow } from "../core/types";

export function createEditableGridPreset<T extends GridRow = GridRow>(): Partial<GridMasterProps<T>> {
  return {
    mode: "editable",
    enableEditing: true,
    enableClipboard: true,
    enableFillHandle: true,
    enableUndoRedo: true,
    enableSorting: true,
    enableFiltering: true,
    enableColumnResize: true,
    enableColumnAutoFit: true,
    enableCellColoring: true,
    enableWrapText: true,
    enableInsertRow: true,
    enableInsertColumn: true,
    enableDeleteRow: true,
    enableDeleteColumn: true,
    showFormulaBar: true,
    showStatusBar: true,
  };
}
