import React from "react";
import {
  AlignCenter,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignEndVertical,
  ArrowBigDown,
  ArrowBigUp,
  ChevronDown,
  ClipboardPaste,
  Columns2,
  Copy,
  ListIndentDecrease,
  ListIndentIncrease,
  Paintbrush,
  Scissors,
  TableCellsMerge,
  TableCellsSplit,
  WrapText,
} from "lucide-react";
import type { GridSelectionFormattingValue } from "../core/features/formatting";
import { DEFAULT_COLOR_LABELS, DEFAULT_COLOR_PALETTE } from "../core/constants";
import type {
  GridHorizontalAlign,
  GridTextOrientation,
  GridVerticalAlign,
} from "../core/types";
import { ColorMenu } from "../menus/ColorMenu";
import { useGridContext } from "./context/GridContext";
import { useClipboard } from "./hooks/useClipboard";
import { useCellFormatting } from "./hooks/useCellFormatting";

const FONT_FAMILY_OPTIONS = [
  { value: "Aptos Narrow", label: "Aptos Narrow" },
  { value: "Calibri", label: "Calibri" },
  { value: "Segoe UI", label: "Segoe UI" },
  { value: "Verdana", label: "Verdana" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier New" },
] as const;

const FONT_SIZE_OPTIONS = [10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map((value) => ({
  value: String(value),
  label: String(value),
}));

const FONT_COLOR_LABELS = [
  "Automatic",
  "Yellow",
  "Green",
  "Blue",
  "Red",
  "Purple",
  "Orange",
  "Light",
  "Dark",
] as const;

const ORIENTATION_OPTIONS = [
  { value: "horizontal", label: "Horizontal" },
  { value: "rotateUp", label: "Rotate Up" },
  { value: "rotateDown", label: "Rotate Down" },
  { value: "vertical", label: "Vertical" },
] as const;

type CellFormattingApi = ReturnType<typeof useCellFormatting>;

function RibbonGroup({
  label,
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "gm-ribbon-group",
        label ? "has-footer" : "is-footerless",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="gm-ribbon-group-content">{children}</div>
      {label ? <div className="gm-ribbon-group-footer">{label}</div> : null}
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
      aria-label={title}
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

function RibbonSelectField({
  value,
  options,
  title,
  compact = false,
  mixed = false,
  mixedLabel = "Mixed",
  onChange,
}: {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  title: string;
  compact?: boolean;
  mixed?: boolean;
  mixedLabel?: string;
  onChange: (nextValue: string) => void;
}) {
  const renderedOptions = React.useMemo(() => {
    if (!mixed) return [...options];
    return [{ value: "__mixed__", label: mixedLabel }, ...options];
  }, [mixed, mixedLabel, options]);

  return (
    <label
      className={[
        "gm-ribbon-select-field",
        compact ? "is-compact" : "",
        mixed ? "is-mixed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={title}
    >
      <select
        className="gm-ribbon-select"
        value={value}
        aria-label={title}
        onChange={(event) => {
          if (event.target.value === "__mixed__") return;
          onChange(event.target.value);
        }}
      >
        {renderedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="gm-ribbon-select-caret" aria-hidden="true">
        <ChevronDown style={{ width: 12, height: 12 }} />
      </span>
    </label>
  );
}

function RibbonToolButton({
  icon,
  label,
  title,
  active = false,
  mixed = false,
  accent = false,
  disabled = false,
  onClick,
  indicatorColor,
  style,
}: {
  icon?: React.ReactNode;
  label?: string;
  title: string;
  active?: boolean;
  mixed?: boolean;
  accent?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  indicatorColor?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className={[
        "gm-ribbon-tool-button",
        accent ? "is-accent" : "",
        active ? "is-active" : "",
        mixed ? "is-mixed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={title}
      aria-label={title}
      aria-pressed={active || mixed || undefined}
      disabled={disabled}
      onClick={onClick}
      style={style}
    >
      {icon ? <span className="gm-ribbon-tool-icon">{icon}</span> : null}
      {label ? <span className="gm-ribbon-tool-label">{label}</span> : null}
      {indicatorColor !== undefined ? (
        <span
          className="gm-ribbon-tool-indicator"
          aria-hidden="true"
          style={{
            background: indicatorColor || "transparent",
            borderColor: indicatorColor ? indicatorColor : "#cbd5e1",
          }}
        />
      ) : null}
    </button>
  );
}

function resolveMixedString(
  value: GridSelectionFormattingValue<string>,
  fallback: string
): { value: string; mixed: boolean } {
  return value === "__mixed__"
    ? { value: "__mixed__", mixed: true }
    : { value: value ?? fallback, mixed: false };
}

function resolveMixedNumber(
  value: GridSelectionFormattingValue<number>,
  fallback: number
): { value: string; mixed: boolean } {
  return value === "__mixed__"
    ? { value: "__mixed__", mixed: true }
    : { value: String(value ?? fallback), mixed: false };
}

function ClipboardSection() {
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
    <div className="gm-ribbon-section-block">
      <div className="gm-ribbon-section-heading">Clipboard</div>
      <div className="gm-ribbon-clipboard-layout">
        <RibbonActionButton
          icon={<ClipboardPaste style={{ width: 15, height: 15 }} />}
          label="Paste"
          title="Paste into the current selection"
          onClick={() => {
            void paste();
            focusViewport();
          }}
        />
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
  );
}

function FontSection({ formatting }: { formatting: CellFormattingApi }) {
  const {
    summary,
    setFontFamily,
    setFontSize,
    applyFillColor,
    applyTextColor,
    toggleBold,
    toggleBorder,
    toggleItalic,
    toggleUnderline,
  } = formatting;
  const [colorMenu, setColorMenu] = React.useState<{
    kind: "fill" | "text";
    anchorRect: DOMRect;
  } | null>(null);

  const selectedFontFamily = resolveMixedString(summary.fontFamily, FONT_FAMILY_OPTIONS[0].value);
  const selectedFontSize = resolveMixedNumber(summary.fontSize, 12);
  const activeFillColor =
    typeof summary.backgroundColor === "string" && summary.backgroundColor !== "__mixed__"
      ? summary.backgroundColor
      : "";
  const activeTextColor =
    typeof summary.textColor === "string" && summary.textColor !== "__mixed__"
      ? summary.textColor
      : "";

  return (
    <div className="gm-ribbon-section-block">
      <div className="gm-ribbon-section-heading">Font</div>
      <div className="gm-ribbon-font-layout">
        <div className="gm-ribbon-font-row">
          <RibbonSelectField
            value={selectedFontFamily.value}
            options={FONT_FAMILY_OPTIONS}
            title="Apply font family to the current selection"
            mixed={selectedFontFamily.mixed}
            onChange={(nextValue) => {
              setFontFamily(nextValue);
            }}
          />
          <RibbonSelectField
            value={selectedFontSize.value}
            options={FONT_SIZE_OPTIONS}
            title="Apply font size to the current selection"
            compact
            mixed={selectedFontSize.mixed}
            onChange={(nextValue) => {
              setFontSize(Number.parseInt(nextValue, 10));
            }}
          />
        </div>

        <div className="gm-ribbon-font-row gm-ribbon-font-row-buttons">
          <RibbonToolButton
            label="B"
            title="Bold (Ctrl/Cmd+B)"
            accent
            active={summary.isBold === true}
            mixed={summary.isBold === "__mixed__"}
            onClick={() => {
              toggleBold();
            }}
            style={{ fontWeight: 700 }}
          />
          <RibbonToolButton
            label="I"
            title="Italic (Ctrl/Cmd+I)"
            accent
            active={summary.isItalic === true}
            mixed={summary.isItalic === "__mixed__"}
            onClick={() => {
              toggleItalic();
            }}
            style={{ fontStyle: "italic" }}
          />
          <RibbonToolButton
            label="U"
            title="Underline (Ctrl/Cmd+U)"
            accent
            active={summary.isUnderline === true}
            mixed={summary.isUnderline === "__mixed__"}
            onClick={() => {
              toggleUnderline();
            }}
            style={{ textDecoration: "underline" }}
          />
          <RibbonToolButton
            label="Bdr"
            title="Toggle border on the current selection"
            active={summary.hasBorder === true}
            mixed={summary.hasBorder === "__mixed__"}
            onClick={() => {
              toggleBorder();
            }}
          />
          <RibbonToolButton
            label="Fill"
            title="Apply fill color"
            active={Boolean(activeFillColor)}
            mixed={summary.backgroundColor === "__mixed__"}
            indicatorColor={activeFillColor || ""}
            onClick={(event) => {
              setColorMenu({
                kind: "fill",
                anchorRect: event.currentTarget.getBoundingClientRect(),
              });
            }}
          />
          <RibbonToolButton
            label="A"
            title="Apply font color"
            active={Boolean(activeTextColor)}
            mixed={summary.textColor === "__mixed__"}
            indicatorColor={activeTextColor || "#0f172a"}
            onClick={(event) => {
              setColorMenu({
                kind: "text",
                anchorRect: event.currentTarget.getBoundingClientRect(),
              });
            }}
            style={{ color: activeTextColor || "#0f172a" }}
          />
        </div>
      </div>

      {colorMenu ? (
        <ColorMenu
          anchorRect={colorMenu.anchorRect}
          colors={[...DEFAULT_COLOR_PALETTE]}
          labels={colorMenu.kind === "fill" ? DEFAULT_COLOR_LABELS : FONT_COLOR_LABELS}
          onSelect={(color) => {
            if (colorMenu.kind === "fill") {
              applyFillColor(color);
            } else {
              applyTextColor(color);
            }
            setColorMenu(null);
          }}
          onClose={() => setColorMenu(null)}
        />
      ) : null}
    </div>
  );
}

function AlignmentToolRow({ children }: { children: React.ReactNode }) {
  return <div className="gm-ribbon-alignment-row">{children}</div>;
}

function ClipboardFontGroup({ formatting }: { formatting: CellFormattingApi }) {
  return (
    <RibbonGroup className="gm-ribbon-group-clipboard-font">
      <div className="gm-ribbon-stacked-layout">
        <ClipboardSection />
        <div className="gm-ribbon-stacked-divider" aria-hidden="true" />
        <FontSection formatting={formatting} />
      </div>
    </RibbonGroup>
  );
}

function AlignmentGroup({ formatting }: { formatting: CellFormattingApi }) {
  const {
    summary,
    canDecreaseIndent,
    decreaseIndent,
    increaseIndent,
    setHorizontalAlign,
    setTextOrientation,
    setVerticalAlign,
    toggleWrapText,
  } = formatting;

  const selectedOrientation = resolveMixedString(summary.textOrientation, "horizontal");

  return (
    <RibbonGroup label="Alignment" className="gm-ribbon-group-alignment">
      <div className="gm-ribbon-alignment-layout">
        <AlignmentToolRow>
          <RibbonToolButton
            icon={<AlignLeft style={{ width: 16, height: 16 }} />}
            title="Align Left"
            active={summary.horizontalAlign === "left"}
            mixed={summary.horizontalAlign === "__mixed__"}
            onClick={() => {
              setHorizontalAlign("left" as GridHorizontalAlign);
            }}
          />
          <RibbonToolButton
            icon={<AlignCenter style={{ width: 16, height: 16 }} />}
            title="Align Center"
            active={summary.horizontalAlign === "center"}
            mixed={summary.horizontalAlign === "__mixed__"}
            onClick={() => {
              setHorizontalAlign("center" as GridHorizontalAlign);
            }}
          />
          <RibbonToolButton
            icon={<AlignRight style={{ width: 16, height: 16 }} />}
            title="Align Right"
            active={summary.horizontalAlign === "right"}
            mixed={summary.horizontalAlign === "__mixed__"}
            onClick={() => {
              setHorizontalAlign("right" as GridHorizontalAlign);
            }}
          />
        </AlignmentToolRow>

        <AlignmentToolRow>
          <RibbonToolButton
            icon={<AlignStartVertical style={{ width: 16, height: 16 }} />}
            title="Align Top"
            active={summary.verticalAlign === "top"}
            mixed={summary.verticalAlign === "__mixed__"}
            onClick={() => {
              setVerticalAlign("top" as GridVerticalAlign);
            }}
          />
          <RibbonToolButton
            icon={<AlignCenterVertical style={{ width: 16, height: 16 }} />}
            title="Align Middle"
            active={summary.verticalAlign === "middle"}
            mixed={summary.verticalAlign === "__mixed__"}
            onClick={() => {
              setVerticalAlign("middle" as GridVerticalAlign);
            }}
          />
          <RibbonToolButton
            icon={<AlignEndVertical style={{ width: 16, height: 16 }} />}
            title="Align Bottom"
            active={summary.verticalAlign === "bottom"}
            mixed={summary.verticalAlign === "__mixed__"}
            onClick={() => {
              setVerticalAlign("bottom" as GridVerticalAlign);
            }}
          />
        </AlignmentToolRow>

        <AlignmentToolRow>
          <RibbonToolButton
            icon={<WrapText style={{ width: 16, height: 16 }} />}
            label="Wrap"
            title="Wrap Text"
            active={summary.wrapText === true}
            mixed={summary.wrapText === "__mixed__"}
            onClick={() => {
              toggleWrapText();
            }}
          />
          <RibbonSelectField
            value={selectedOrientation.value}
            options={ORIENTATION_OPTIONS}
            title="Change text orientation"
            mixed={selectedOrientation.mixed}
            mixedLabel="Mixed"
            onChange={(nextValue) => {
              setTextOrientation(nextValue as GridTextOrientation);
            }}
          />
        </AlignmentToolRow>

        <AlignmentToolRow>
          <RibbonToolButton
            icon={<ListIndentDecrease style={{ width: 16, height: 16 }} />}
            title="Decrease Indent"
            disabled={!canDecreaseIndent}
            onClick={() => {
              decreaseIndent();
            }}
          />
          <RibbonToolButton
            icon={<ListIndentIncrease style={{ width: 16, height: 16 }} />}
            title="Increase Indent"
            onClick={() => {
              increaseIndent();
            }}
          />
          <RibbonToolButton
            icon={<ArrowBigUp style={{ width: 16, height: 16 }} />}
            title="Rotate Text Up"
            active={summary.textOrientation === "rotateUp"}
            mixed={summary.textOrientation === "__mixed__"}
            onClick={() => {
              setTextOrientation("rotateUp");
            }}
          />
          <RibbonToolButton
            icon={<ArrowBigDown style={{ width: 16, height: 16 }} />}
            title="Rotate Text Down"
            active={summary.textOrientation === "rotateDown"}
            mixed={summary.textOrientation === "__mixed__"}
            onClick={() => {
              setTextOrientation("rotateDown");
            }}
          />
          <RibbonToolButton
            icon={<Columns2 style={{ width: 16, height: 16 }} />}
            title="Vertical text"
            active={summary.textOrientation === "vertical"}
            mixed={summary.textOrientation === "__mixed__"}
            onClick={() => {
              setTextOrientation("vertical");
            }}
          />
        </AlignmentToolRow>

        <AlignmentToolRow>
          <RibbonToolButton
            icon={<TableCellsMerge style={{ width: 16, height: 16 }} />}
            label="Merge"
            title="Merge selected cells is planned for Phase 2. It stays disabled until rowSpan and colSpan behavior is integrated safely into selection, copy/paste, fill, and navigation."
            disabled
          />
          <RibbonToolButton
            icon={<TableCellsSplit style={{ width: 16, height: 16 }} />}
            label="Unmerge"
            title="Unmerge selected cells will land with full merge support in Phase 2."
            disabled
          />
        </AlignmentToolRow>
      </div>
    </RibbonGroup>
  );
}

export function GridToolbar() {
  const {
    history,
    setHistory,
    selection,
    displayRows,
    displayRowIndexes,
    visibleColumns,
    focusViewport,
  } = useGridContext();
  const formatting = useCellFormatting({
    history,
    setHistory,
    selection,
    displayRows,
    displayRowIndexes,
    visibleColumns,
    focusViewport,
  });

  return (
    <div className="gm-toolbar" role="toolbar" aria-label="Spreadsheet toolbar">
      <div className="gm-ribbon">
        <ClipboardFontGroup formatting={formatting} />
        <AlignmentGroup formatting={formatting} />
      </div>
    </div>
  );
}

export default GridToolbar;
