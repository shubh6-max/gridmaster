import React from "react";
import type { GridCellRendererProps, GridRow } from "../core/types";

export function SelectRenderer<T extends GridRow = GridRow>({
  formattedValue,
  column,
}: GridCellRendererProps<T>) {
  return (
    <span
      style={{
        display: "block",
        width: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: column.wrap ? "pre-wrap" : "nowrap",
      }}
      title={formattedValue}
    >
      {formattedValue || column.placeholder || ""}
    </span>
  );
}

export default SelectRenderer;
