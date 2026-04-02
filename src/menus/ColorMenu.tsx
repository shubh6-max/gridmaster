import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_COLOR_LABELS, DEFAULT_COLOR_PALETTE, Z_INDEX } from "../core/constants";
import { safeDomRect } from "../core/utils";
import { useFloatingPortal } from "../react/hooks/useFloatingPortal";

type ColorMenuProps = {
  anchorRect?: DOMRect | null;
  colors?: string[];
  labels?: readonly string[];
  onSelect: (color: string) => void;
  onClose: () => void;
};

export function ColorMenu({
  anchorRect,
  colors = [...DEFAULT_COLOR_PALETTE],
  labels = DEFAULT_COLOR_LABELS,
  onSelect,
  onClose,
}: ColorMenuProps) {
  const target = useFloatingPortal();
  const rect = safeDomRect(anchorRect);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-gm-color-menu]")) {
        onClose();
      }
    };

    const timeoutId = window.setTimeout(() => {
      document.addEventListener("mousedown", handleMouseDown);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [onClose]);

  if (!target) return null;

  return createPortal(
    <div
      data-gm-color-menu
      style={{
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.left,
        zIndex: Z_INDEX.FLOATING_MENU,
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
        padding: 12,
        boxShadow: "0 16px 40px rgba(15, 23, 42, 0.16)",
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {colors.map((color, index) => (
          <button
            key={`${color}-${index}`}
            title={labels[index] ?? `Color ${index + 1}`}
            onClick={() => onSelect(color)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: color || "#ffffff",
              cursor: "pointer",
              outline: color ? "none" : "2px dashed #cbd5e1",
            }}
          />
        ))}
      </div>
    </div>,
    target
  );
}

export default ColorMenu;
