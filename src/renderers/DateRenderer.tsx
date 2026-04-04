import React from "react";
import type { GridCellRendererProps, GridRow } from "../core/types";

export function DateRenderer<T extends GridRow = GridRow>({
  formattedValue,
}: GridCellRendererProps<T>) {
  return (
    <span
      style={{
        display: "block",
        width: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "inherit",
        textAlign: "inherit",
      }}
      title={formattedValue}
    >
      {formattedValue}
    </span>
  );
}

export default DateRenderer;
