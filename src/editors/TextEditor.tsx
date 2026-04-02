import React, { useEffect, useRef, useState } from "react";
import type { GridCellEditorProps, GridRow } from "../core/types";

export function TextEditor<T extends GridRow = GridRow>({
  value,
  commit,
  cancel,
  updateValue,
  requestViewportFocusAfterEdit,
}: GridCellEditorProps<T>) {
  const [localValue, setLocalValue] = useState<string>(value == null ? "" : String(value));
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalValue(value == null ? "" : String(value));
  }, [value]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <textarea
      ref={inputRef}
      rows={1}
      value={localValue}
      onChange={(e) => {
        const next = e.target.value;
        setLocalValue(next);
        updateValue(next);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.altKey) {
          e.stopPropagation();
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          requestViewportFocusAfterEdit?.();
          commit();
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          requestViewportFocusAfterEdit?.();
          cancel();
          return;
        }

        if (e.key === "Tab") {
          e.preventDefault();
          requestViewportFocusAfterEdit?.();
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
        resize: "none",
      }}
    />
  );
}

export default TextEditor;
