// Placement helper for the column menu's floating side panel. Language: TypeScript 6 (strict).
const VIEWPORT_INSET = 8;
const DEFAULT_GAP = 8;

export type ColumnMenuSidePanelPlacement = "left" | "right";

export type ColumnMenuSidePanelInput = {
  /** Rectangle of the button the panel hangs off (only left, right and top are read). */
  anchorRect: Pick<DOMRect, "left" | "right" | "top">;
  panelWidth: number;
  panelHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
};

export type ColumnMenuSidePanelPosition = {
  left: number;
  top: number;
  placement: ColumnMenuSidePanelPlacement;
};

/** Viewport-clamped left/right placement for a panel next to its anchor button. */
export function getColumnMenuSidePanelPosition({
  anchorRect,
  panelWidth,
  panelHeight,
  viewportWidth,
  viewportHeight,
  gap = DEFAULT_GAP,
}: ColumnMenuSidePanelInput): ColumnMenuSidePanelPosition {
  const rightSpace = viewportWidth - anchorRect.right;
  const leftSpace = anchorRect.left;
  const placement: ColumnMenuSidePanelPlacement =
    rightSpace >= panelWidth + gap || rightSpace >= leftSpace ? "right" : "left";
  const preferredLeft =
    placement === "right" ? anchorRect.right + gap : anchorRect.left - panelWidth - gap;
  const left = Math.max(
    VIEWPORT_INSET,
    Math.min(preferredLeft, viewportWidth - panelWidth - VIEWPORT_INSET)
  );
  const top = Math.max(
    VIEWPORT_INSET,
    Math.min(anchorRect.top - gap, viewportHeight - panelHeight - VIEWPORT_INSET)
  );

  return { left, top, placement };
}
