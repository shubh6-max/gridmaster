import React, { useEffect, useRef, useState } from "react";
import type { GridCellEditorProps, GridRow } from "../core/types";
import { toDateInputString } from "../core/utils";

function getEditorDateValue(value: unknown): string {
  const normalized = toDateInputString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

export function DateEditor<T extends GridRow = GridRow>({
  value,
  commit,
  cancel,
  updateValue,
}: GridCellEditorProps<T>) {
  const [localValue, setLocalValue] = useState<string>(getEditorDateValue(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(getEditorDateValue(value));
  }, [value]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="date"
      value={localValue}
      onChange={(event) => {
        const nextValue = event.target.value;
        setLocalValue(nextValue);
        updateValue(nextValue);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
          return;
        }

        if (event.key === "Tab") {
          event.preventDefault();
          commit();
          return;
        }

        event.stopPropagation();
      }}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        outline: "none",
        background: "transparent",
        fontSize: 12,
        fontFamily: "inherit",
        color: "inherit",
      }}
    />
  );
}

export default DateEditor;
