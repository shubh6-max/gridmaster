import React from "react";
import type { GridCellRendererProps, GridRow } from "../core/types";

export function CheckboxRenderer<T extends GridRow = GridRow>({
  value,
  column,
  mode,
  updateValue,
}: GridCellRendererProps<T>) {
  const isReadonly = mode === "readonly" || column.readonly || !column.editable;

  return (
    <span
      style={{
        display: "block",
        width: "100%",
        textAlign: "inherit",
      }}
    >
      <input
        type="checkbox"
        checked={Boolean(value)}
        disabled={isReadonly}
        readOnly={isReadonly}
        onClick={(event) => {
          event.stopPropagation();
          if (isReadonly) return;
          updateValue(!Boolean(value));
        }}
      />
    </span>
  );
}

export default CheckboxRenderer;
