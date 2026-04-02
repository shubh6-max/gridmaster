import React from "react";
import type { GridCellRendererProps, GridRow } from "../core/types";

export function DateRenderer<T extends GridRow = GridRow>({
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
        textAlign: column.align ?? "left",
      }}
      title={formattedValue}
    >
      {formattedValue}
    </span>
  );
}

export default DateRenderer;
