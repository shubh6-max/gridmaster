import type { ComponentType } from "react";
import type { GridCellEditorProps, GridColumnType, GridRow } from "../core/types";
import { CheckboxEditor } from "./CheckboxEditor";
import { DateEditor } from "./DateEditor";
import { NumberEditor } from "./NumberEditor";
import { SelectEditor } from "./SelectEditor";
import { TextEditor } from "./TextEditor";

export { CheckboxEditor } from "./CheckboxEditor";
export { DateEditor } from "./DateEditor";
export { NumberEditor } from "./NumberEditor";
export { SelectEditor } from "./SelectEditor";
export { TextEditor } from "./TextEditor";

export type GridDefaultCellEditor<T extends GridRow = GridRow> = ComponentType<
  GridCellEditorProps<T>
>;

export const defaultCellEditors: Record<GridColumnType, GridDefaultCellEditor<any>> = {
  text: TextEditor,
  number: NumberEditor,
  select: SelectEditor,
  checkbox: CheckboxEditor,
  link: TextEditor,
  date: DateEditor,
  custom: TextEditor,
};

export function getDefaultCellEditor<T extends GridRow = GridRow>(
  columnType?: GridColumnType
): GridDefaultCellEditor<T> {
  return (defaultCellEditors[columnType ?? "text"] ?? defaultCellEditors.text) as GridDefaultCellEditor<T>;
}
