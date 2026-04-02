import React, { useEffect, useRef } from "react";
import type { GridCellEditorProps, GridRow } from "../core/types";

export function CheckboxEditor<T extends GridRow = GridRow>({
  value,
  commit,
  cancel,
  updateValue,
}: GridCellEditorProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const checked = Boolean(value);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        width: "100%",
      }}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          updateValue(e.target.checked);
          commit();
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
            return;
          }

          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            commit();
            return;
          }

          if (e.key === " ") {
            e.preventDefault();
            updateValue(!checked);
            commit();
            return;
          }

          e.stopPropagation();
        }}
        className="gm-checkbox-editor"
        style={{
          cursor: "pointer",
        }}
      />
    </div>
  );
}

export default CheckboxEditor;