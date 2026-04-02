import type { GridColumnDef, GridColumnType, GridRow } from "../core/types";

type GridColumnTypeDefaults = Pick<
  GridColumnDef,
  "width" | "align" | "editable" | "sortable" | "filterable" | "resizable"
>;

export const GRID_COLUMN_DEFAULTS: Record<GridColumnType, GridColumnTypeDefaults> = {
  text: {
    width: 180,
    align: "left",
    editable: true,
    sortable: true,
    filterable: true,
    resizable: true,
  },
  number: {
    width: 120,
    align: "right",
    editable: true,
    sortable: true,
    filterable: true,
    resizable: true,
  },
  select: {
    width: 180,
    align: "left",
    editable: true,
    sortable: true,
    filterable: true,
    resizable: true,
  },
  checkbox: {
    width: 96,
    align: "center",
    editable: true,
    sortable: true,
    filterable: true,
    resizable: true,
  },
  link: {
    width: 220,
    align: "left",
    editable: true,
    sortable: true,
    filterable: true,
    resizable: true,
  },
  date: {
    width: 150,
    align: "left",
    editable: true,
    sortable: true,
    filterable: true,
    resizable: true,
  },
  custom: {
    width: 180,
    align: "left",
    editable: true,
    sortable: true,
    filterable: true,
    resizable: true,
  },
};

export function getColumnTypeDefaults(type: GridColumnType = "text"): GridColumnTypeDefaults {
  return GRID_COLUMN_DEFAULTS[type] ?? GRID_COLUMN_DEFAULTS.text;
}

export function applyColumnTypeDefaults<T extends GridRow>(
  column: GridColumnDef<T>
): GridColumnDef<T> {
  return {
    ...getColumnTypeDefaults(column.type ?? "text"),
    ...column,
  };
}
