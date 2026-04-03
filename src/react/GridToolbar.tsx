import React from "react";
import {
  ClipboardPaste,
  Copy,
  Paintbrush,
  Scissors,
} from "lucide-react";
import { useGridContext } from "./context/GridContext";
import { useClipboard } from "./hooks/useClipboard";

function ToolbarButton({
  icon,
  label,
  title,
  active = false,
  disabled = false,
  onClick,
  onDoubleClick,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "gm-toolbar-button",
        active ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={title}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span className="gm-toolbar-button-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function GridToolbar() {
  const {
    rows,
    displayRows,
    displayRowIndexes,
    visibleColumns,
    selection,
    clipboard,
    setClipboard,
    updateRows,
    focusViewport,
    formatPainterMode,
    startFormatPainter,
    stopFormatPainter,
  } = useGridContext();

  const { copy, cut, paste } = useClipboard({
    rows,
    displayRows,
    displayRowIndexes,
    columns: visibleColumns,
    selection,
    clipboard,
    setClipboard,
    updateRows,
  });

  return (
    <div className="gm-toolbar">
      <div className="gm-toolbar-group">
        <ToolbarButton
          icon={<Copy style={{ width: 14, height: 14 }} />}
          label="Copy"
          title="Copy selected cells"
          onClick={() => {
            void copy(false);
            focusViewport();
          }}
        />
        <ToolbarButton
          icon={<ClipboardPaste style={{ width: 14, height: 14 }} />}
          label="Paste"
          title="Paste into the current selection"
          onClick={() => {
            void paste();
            focusViewport();
          }}
        />
        <ToolbarButton
          icon={<Scissors style={{ width: 14, height: 14 }} />}
          label="Cut"
          title="Cut selected cells"
          onClick={() => {
            void cut();
            focusViewport();
          }}
        />
      </div>

      <div className="gm-toolbar-divider" />

      <div className="gm-toolbar-group">
        <ToolbarButton
          icon={<Paintbrush style={{ width: 14, height: 14 }} />}
          label="Format Painter"
          title="Click to paint formatting once. Double-click to keep painting until Esc."
          active={formatPainterMode !== "idle"}
          onClick={() => {
            if (formatPainterMode !== "idle") {
              stopFormatPainter();
            } else {
              startFormatPainter(false);
            }
          }}
          onDoubleClick={() => {
            startFormatPainter(true);
          }}
        />
      </div>
    </div>
  );
}

export default GridToolbar;
