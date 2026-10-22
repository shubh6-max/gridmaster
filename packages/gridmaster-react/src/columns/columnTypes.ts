import type { GridColumnType } from "../core/types";

export const GRID_COLUMN_TYPES = [
  "text",
  "number",
  "select",
  "checkbox",
  "link",
  "date",
  "custom",
] as const satisfies readonly GridColumnType[];

export const GRID_COLUMN_TYPE_LABELS: Record<GridColumnType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  checkbox: "Checkbox",
  link: "Link",
  date: "Date",
  custom: "Custom",
};

export function isGridColumnType(value: unknown): value is GridColumnType {
  return typeof value === "string" && GRID_COLUMN_TYPES.includes(value as GridColumnType);
}
