import React from "react";
import type { GridCellRendererProps, GridRow } from "../core/types";

export function CheckboxRenderer<T extends object = GridRow>({
  value,
  column,
  meta,
  mode,
  updateValue,
}: GridCellRendererProps<T>) {
  // A-084: per-cell `readonly` meta disables the toggle too, not only column flags. (The write is
  // also blocked at the cell's write sink, so a read-only row — carried as meta — is safe regardless.)
  const isReadonly = mode === "readonly" || column.readonly || !column.editable || Boolean(meta?.readonly);

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
        // F-013: a controlled checkbox needs `onChange` (or it is not interactive) — without it React
        // warns "`checked` prop without `onChange`" for every checkbox cell. onChange carries the new
        // value; the click handler only stops the cell-selection gesture.
        onChange={(event) => {
          if (isReadonly) return;
          updateValue(event.target.checked);
        }}
        onClick={(event) => event.stopPropagation()}
      />
    </span>
  );
}

export default CheckboxRenderer;
