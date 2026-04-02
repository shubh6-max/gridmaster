import type { ComponentType } from "react";
import type { GridCellRendererProps, GridColumnType, GridRow } from "../core/types";
import { CheckboxRenderer } from "./CheckboxRenderer";
import { DateRenderer } from "./DateRenderer";
import { LinkRenderer } from "./LinkRenderer";
import { SelectRenderer } from "./SelectRenderer";
import { TextRenderer } from "./TextRenderer";

export { CheckboxRenderer } from "./CheckboxRenderer";
export { DateRenderer } from "./DateRenderer";
export { LinkRenderer } from "./LinkRenderer";
export { SelectRenderer } from "./SelectRenderer";
export { TextRenderer } from "./TextRenderer";

export type GridDefaultCellRenderer<T extends GridRow = GridRow> = ComponentType<
  GridCellRendererProps<T>
>;

export const defaultCellRenderers: Record<GridColumnType, GridDefaultCellRenderer<any>> = {
  text: TextRenderer,
  number: TextRenderer,
  select: SelectRenderer,
  checkbox: CheckboxRenderer,
  link: LinkRenderer,
  date: DateRenderer,
  custom: TextRenderer,
};

export function getDefaultCellRenderer<T extends GridRow = GridRow>(
  columnType?: GridColumnType
): GridDefaultCellRenderer<T> {
  return (defaultCellRenderers[columnType ?? "text"] ??
    defaultCellRenderers.text) as GridDefaultCellRenderer<T>;
}
