import React from "react";
import { ChevronDown } from "lucide-react";
import type { GridCellRendererProps, GridRow } from "../core/types";

export function SelectRenderer<T extends GridRow = GridRow>({
  formattedValue,
  column,
  mode,
  startEditing,
}: GridCellRendererProps<T>) {
  const isReadonly = mode === "readonly" || column.readonly || !column.editable;

  return (
    <span className="gm-select-cell" title={formattedValue || column.placeholder || ""}>
      <span className="gm-select-cell-value">
        {formattedValue || column.placeholder || ""}
      </span>
      {isReadonly ? (
        <span className="gm-select-cell-caret" aria-hidden="true">
          <ChevronDown style={{ width: 14, height: 14 }} />
        </span>
      ) : (
        <button
          type="button"
          className="gm-select-cell-trigger"
          aria-label={`Open options for ${column.title}`}
          tabIndex={-1}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            startEditing?.();
          }}
        >
          <ChevronDown style={{ width: 14, height: 14 }} />
        </button>
      )}
    </span>
  );
}

export default SelectRenderer;
