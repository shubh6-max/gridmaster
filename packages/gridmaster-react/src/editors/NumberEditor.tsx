import React, { useEffect, useRef, useState } from "react";
import type { GridCellEditorProps, GridRow } from "../core/types";

export function NumberEditor<T extends object = GridRow>({
  value,
  commit,
  cancel,
  updateValue,
  requestViewportFocusAfterEdit,
  autoSelectOnFocus = true,
  isInvalid = false,
}: GridCellEditorProps<T>) {
  const [localValue, setLocalValue] = useState<string>(value == null ? "" : String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value == null ? "" : String(value));
  }, [value]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    if (autoSelectOnFocus) {
      input.select();
      return;
    }

    const caretIndex = input.value.length;
    input.setSelectionRange(caretIndex, caretIndex);
  }, [autoSelectOnFocus]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={localValue}
      aria-invalid={isInvalid || undefined}
      className={isInvalid ? "gm-number-editor gm-cell-editor-invalid" : "gm-number-editor"}
      onChange={(event) => {
        const nextValue = event.target.value;
        setLocalValue(nextValue);
        updateValue(nextValue);
      }}
      // item 7: blur with unparsable input CANCELS (restores the stored value) rather than
      // committing null over it; Enter keeps the editor open via the commit guard.
      onBlur={() => (isInvalid ? cancel() : commit())}
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
