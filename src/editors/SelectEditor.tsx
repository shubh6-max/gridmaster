import React, { useEffect, useRef, useState } from "react";
import type { GridCellEditorProps, GridRow } from "../core/types";

export function SelectEditor<T extends GridRow = GridRow>({
  value,
  column,
  commit,
  cancel,
  updateValue,
}: GridCellEditorProps<T>) {
  const [localValue, setLocalValue] = useState<string>(value == null ? "" : String(value));
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    setLocalValue(value == null ? "" : String(value));
  }, [value]);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  return (
    <select
      ref={selectRef}
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
    >
      <option value="">{column.placeholder ?? "Select..."}</option>
      {(column.options ?? []).map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export default SelectEditor;
