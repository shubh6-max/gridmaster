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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: column.align === "center" ? "center" : "flex-start",
        height: "100%",
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
    </div>
  );
}

export default CheckboxRenderer;
