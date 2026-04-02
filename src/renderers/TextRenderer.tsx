import React from "react";
import type { GridCellRendererProps, GridRow } from "../core/types";

export function TextRenderer<T extends GridRow = GridRow>({
  formattedValue,
  column,
}: GridCellRendererProps<T>) {
  const shouldWrap = column.wrap || formattedValue.includes("\n");

  return (
    <span
      style={{
        display: "block",
        width: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: shouldWrap ? "pre-wrap" : "nowrap",
        textAlign: column.align ?? "left",
      }}
      title={formattedValue}
    >
      {formattedValue}
    </span>
  );
}

export default TextRenderer;
