import React, { useEffect, useRef } from "react";
import type { GridCellEditorProps, GridRow } from "../core/types";

export function CheckboxEditor<T extends object = GridRow>({
  value,
  commit,
  cancel,
  requestViewportFocusAfterEdit,
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
        // A-063: commit the NEW value synchronously — `commit()` alone would read the pre-toggle
        // draft from state and commit the stale value. One change event = exactly one toggle.
        onChange={(e) => commit(e.target.checked)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            requestViewportFocusAfterEdit?.();
            cancel();
            return;
          }

          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            requestViewportFocusAfterEdit?.();
            commit();
            return;
          }

          if (e.key === " ") {
            e.preventDefault();
            requestViewportFocusAfterEdit?.();
            commit(!checked);
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
