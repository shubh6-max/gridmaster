import React from "react";
import {
  ChevronDown,
  ClipboardPaste,
  Copy,
  Paintbrush,
  Scissors,
} from "lucide-react";
import { useGridContext } from "./context/GridContext";
import { useClipboard } from "./hooks/useClipboard";

function RibbonGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={["gm-ribbon-group", className].filter(Boolean).join(" ")}>
      <div className="gm-ribbon-group-content">{children}</div>
      <div className="gm-ribbon-group-footer">{label}</div>
    </section>
  );
}

function RibbonActionButton({
  icon,
  label,
  title,
  size = "small",
  active = false,
  onClick,
  onDoubleClick,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  size?: "large" | "small";
  active?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "gm-ribbon-action",
        size === "large" ? "is-large" : "is-small",
        active ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={title}
      aria-pressed={active || undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span className="gm-ribbon-action-icon">{icon}</span>
      <span className="gm-ribbon-action-label">{label}</span>
      {size === "large" ? (
        <span className="gm-ribbon-action-caret" aria-hidden="true">
          <ChevronDown style={{ width: 12, height: 12 }} />
        </span>
      ) : null}
    </button>
  );
}

function RibbonPlaceholderField({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "gm-ribbon-placeholder-field",
        compact ? "is-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <span>{label}</span>
      <ChevronDown style={{ width: 12, height: 12 }} />
    </div>
  );
}

function RibbonPlaceholderButton({
  label,
  accent = false,
}: {
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "gm-ribbon-placeholder-button",
        accent ? "is-accent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}

function ClipboardGroup() {
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
    <RibbonGroup label="Clipboard" className="gm-ribbon-group-clipboard">
      <div className="gm-ribbon-clipboard-layout">
        <RibbonActionButton
          size="large"
          icon={<ClipboardPaste style={{ width: 28, height: 28 }} />}
          label="Paste"
          title="Paste into the current selection"
          onClick={() => {
            void paste();
            focusViewport();
          }}
        />

        <div className="gm-ribbon-clipboard-stack">
          <RibbonActionButton
            icon={<Copy style={{ width: 15, height: 15 }} />}
            label="Copy"
            title="Copy selected cells"
            onClick={() => {
              void copy(false);
              focusViewport();
            }}
          />

          <RibbonActionButton
            icon={<Scissors style={{ width: 15, height: 15 }} />}
            label="Cut"
            title="Cut selected cells"
            onClick={() => {
              void cut();
              focusViewport();
            }}
          />

          <RibbonActionButton
            icon={<Paintbrush style={{ width: 15, height: 15 }} />}
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
    </RibbonGroup>
  );
}

function FontScaffoldGroup() {
  return (
    <RibbonGroup label="Font" className="gm-ribbon-group-font">
      <div className="gm-ribbon-font-layout" aria-hidden="true">
        <div className="gm-ribbon-font-row">
          <RibbonPlaceholderField label="Aptos Narrow" />
          <RibbonPlaceholderField label="11" compact />
        </div>

        <div className="gm-ribbon-font-row gm-ribbon-font-row-buttons">
          <RibbonPlaceholderButton label="B" accent />
          <RibbonPlaceholderButton label="I" accent />
          <RibbonPlaceholderButton label="U" accent />
          <RibbonPlaceholderButton label="▦" />
          <RibbonPlaceholderButton label="Fill" />
          <RibbonPlaceholderButton label="A" />
        </div>
      </div>
    </RibbonGroup>
  );
}

export function GridToolbar() {
  return (
    <div className="gm-toolbar" role="toolbar" aria-label="Spreadsheet toolbar">
      <div className="gm-ribbon">
        <ClipboardGroup />
        <FontScaffoldGroup />
      </div>
    </div>
  );
}

export default GridToolbar;
