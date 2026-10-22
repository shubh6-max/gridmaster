import React from "react";
import type { GridCellRendererProps, GridRow } from "../core/types";
import { safeLinkHref } from "../core/utils";

export function LinkRenderer<T extends object = GridRow>({
  value,
  formattedValue,
}: GridCellRendererProps<T>) {
  // Build the href from the RAW value (A-082); the formatted text is only the display label.
  const href = safeLinkHref(value);

  // Disallowed scheme (javascript:, data:, ...) or no value: render plain text, never an anchor.
  if (href === null) {
    return formattedValue ? <>{formattedValue}</> : null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
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
