import React, { useEffect, useRef, useState } from "react";
import type { GridCellEditorProps, GridRow } from "../core/types";

export function TextEditor<T extends GridRow = GridRow>({
  value,
  commit,
  cancel,
  updateValue,
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
      value={localValue}
      onChange={(e) => {
        const next = e.target.value;
        setLocalValue(next);
        updateValue(next);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
          return;
        }

        if (e.key === "Tab") {
          e.preventDefault();
          commit();
          return;
        }

        e.stopPropagation();
      }}
      className="gm-text-editor"
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
      }}
    />
  );
}

export default TextEditor;