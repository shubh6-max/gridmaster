import React, { useEffect, useRef, useState } from "react";
import type { GridCellEditorProps, GridRow } from "../core/types";

export function NumberEditor<T extends GridRow = GridRow>({
  value,
  commit,
  cancel,
  updateValue,
  requestViewportFocusAfterEdit,
}: GridCellEditorProps<T>) {
  const [localValue, setLocalValue] = useState<string>(value == null ? "" : String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value == null ? "" : String(value));
  }, [value]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
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
          requestViewportFocusAfterEdit?.();
          commit();
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          requestViewportFocusAfterEdit?.();
          cancel();
          return;
        }

        if (event.key === "Tab") {
          event.preventDefault();
          requestViewportFocusAfterEdit?.();
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
        padding: "0 2px",
        fontSize: 12,
        fontFamily: "inherit",
        color: "inherit",
        textAlign: "right",
      }}
    />
  );
}

export default NumberEditor;
