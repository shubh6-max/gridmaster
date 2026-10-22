import React from "react";
import type { GridCellRendererProps, GridRow } from "../core/types";
import { ensureHttps } from "../core/utils";

export function LinkRenderer<T extends GridRow = GridRow>({
  formattedValue,
}: GridCellRendererProps<T>) {
  if (!formattedValue) return null;

  return (
    <a
      href={ensureHttps(formattedValue)}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      style={{
        display: "block",
        width: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "inherit",
        textAlign: "inherit",
        color: "#2563eb",
        textDecoration: "none",
      }}
      title={formattedValue}
    >
      {formattedValue}
    </a>
  );
}

export default LinkRenderer;
