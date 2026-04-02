import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  EyeOff,
  Filter,
  FilterX,
  MoveHorizontal,
  Snowflake,
} from "lucide-react";
import type { GridSortDirection } from "../core/types";
import { Z_INDEX } from "../core/constants";
import { useFloatingAnchorRect, useFloatingPortal } from "../react/hooks/useFloatingPortal";

type ColumnMenuProps = {
  mode?: "column" | "visibility";
  anchorEl?: HTMLElement | null;
  anchorRect?: DOMRect | null;
  title: string;
  currentColumnKey?: string;
  currentVisibleColumnCount: number;
  showVisibilityControls?: boolean;
  columns: Array<{
    key: string;
    title: string;
    hidden: boolean;
  }>;
  sortDirection: GridSortDirection | null;
  isFiltered: boolean;
  isFrozen: boolean;
  onSortAsc?: () => void;
  onSortDesc?: () => void;
  onClearSort?: () => void;
  onAutoFit?: () => void;
  onFreezeToggle?: () => void;
  onOpenFilter?: () => void;
  onClearFilter?: () => void;
  onHideColumn?: () => void;
  onShowAllColumns?: () => void;
  onToggleColumnVisibility?: (columnKey: string, nextVisible: boolean) => void;
  onClose: () => void;
};

type ColumnMenuActionProps = {
  label: string;
  icon?: React.ReactNode;
  subtle?: boolean;
  onClick?: () => void;
};

function ColumnMenuAction({
  label,
  icon,
  subtle = false,
  onClick,
}: ColumnMenuActionProps) {
  if (!onClick) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={["gm-menu-action", subtle ? "is-subtle" : ""].filter(Boolean).join(" ")}
    >
      {icon ? <span className="gm-menu-action-icon">{icon}</span> : null}
      <span className="gm-menu-action-label">{label}</span>
    </button>
  );
}

export function ColumnMenu({
  mode = "column",
  anchorEl,
  anchorRect,
  title,
  currentColumnKey,
  currentVisibleColumnCount,
  showVisibilityControls = true,
  columns,
  sortDirection,
  isFiltered,
  isFrozen,
  onSortAsc,
  onSortDesc,
  onClearSort,
  onAutoFit,
  onFreezeToggle,
  onOpenFilter,
  onClearFilter,
  onHideColumn,
  onShowAllColumns,
  onToggleColumnVisibility,
  onClose,
}: ColumnMenuProps) {
  const target = useFloatingPortal();
  const rect = useFloatingAnchorRect(anchorEl, anchorRect, onClose);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-gm-column-menu]")) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const timeoutId = window.setTimeout(() => {
      document.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!target) return null;

  const menuWidth = 304;
  const hiddenColumnCount = Math.max(columns.length - currentVisibleColumnCount, 0);
  const manageVisibilityOnly = mode === "visibility" && showVisibilityControls;
  const menuHeight = manageVisibilityOnly ? 360 : 464;
  const viewportWidth = typeof window === "undefined" ? menuWidth + 16 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? menuHeight + 16 : window.innerHeight;
  const top =
    rect.bottom + menuHeight > viewportHeight
      ? Math.max(8, rect.top - menuHeight)
      : rect.bottom + 6;
  const left = Math.max(8, Math.min(rect.left, viewportWidth - menuWidth - 8));

  return createPortal(
    <div
      data-gm-column-menu
      className="gm-floating-menu"
      style={{
        position: "fixed",
        top,
        left,
        width: menuWidth,
        zIndex: Z_INDEX.FLOATING_MENU,
      }}
    >
      <div className="gm-menu-header">
        <div className="gm-menu-kicker">
          {manageVisibilityOnly ? "Column Visibility" : "Column Menu"}
        </div>
        <div className="gm-menu-title">{title}</div>
      </div>

      {!manageVisibilityOnly ? (
        <>
          <div className="gm-menu-section">
            <ColumnMenuAction
              label="Sort A to Z"
              icon={<ArrowUpAZ style={{ width: 14, height: 14 }} />}
              onClick={wrapAction(onSortAsc, onClose)}
            />
            <ColumnMenuAction
              label="Sort Z to A"
              icon={<ArrowDownAZ style={{ width: 14, height: 14 }} />}
              onClick={wrapAction(onSortDesc, onClose)}
            />
            {sortDirection ? (
              <ColumnMenuAction
                label="Clear Sort"
                subtle
                onClick={wrapAction(onClearSort, onClose)}
              />
            ) : null}
          </div>

          <div className="gm-menu-divider" />

          <div className="gm-menu-section">
            <ColumnMenuAction
              label="Auto-fit Width"
              icon={<MoveHorizontal style={{ width: 14, height: 14 }} />}
              onClick={wrapAction(onAutoFit, onClose)}
            />
            <ColumnMenuAction
              label={isFrozen ? "Unfreeze Through Here" : "Freeze Through Here"}
              icon={<Snowflake style={{ width: 14, height: 14 }} />}
              onClick={wrapAction(onFreezeToggle, onClose)}
            />
          </div>

          <div className="gm-menu-divider" />

          <div className="gm-menu-section">
            <ColumnMenuAction
              label="Filter by Values..."
              icon={<Filter style={{ width: 14, height: 14 }} />}
              onClick={wrapAction(onOpenFilter, onClose)}
            />
            {isFiltered ? (
              <ColumnMenuAction
                label="Clear Filter"
                subtle
                icon={<FilterX style={{ width: 14, height: 14 }} />}
                onClick={wrapAction(onClearFilter, onClose)}
              />
            ) : null}
            {currentVisibleColumnCount > 1 ? (
              <ColumnMenuAction
                label="Hide This Column"
                icon={<EyeOff style={{ width: 14, height: 14 }} />}
                onClick={wrapAction(onHideColumn, onClose)}
              />
            ) : null}
          </div>

          <div className="gm-menu-divider" />
        </>
      ) : null}

      {showVisibilityControls ? (
        <>
          <div className="gm-menu-section-heading">
            <div className="gm-menu-section-title">Manage columns</div>
            {hiddenColumnCount > 0 ? (
              <button
                type="button"
                className="gm-menu-inline-action"
                onClick={wrapAction(onShowAllColumns, onClose)}
              >
                Show all
              </button>
            ) : null}
          </div>
          <div className="gm-menu-section-note">
            {currentVisibleColumnCount} visible / {hiddenColumnCount} hidden
          </div>
          <div className="gm-menu-scroll">
            {columns.map((column) => {
              const visible = !column.hidden;
              const disableHide = visible && currentVisibleColumnCount <= 1;

              return (
                <button
                  key={column.key}
                  type="button"
                  className={[
                    "gm-menu-check-row",
                    column.key === currentColumnKey ? "is-current" : "",
                    disableHide ? "is-disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    if (disableHide || !onToggleColumnVisibility) return;
                    onToggleColumnVisibility(column.key, !visible);
                  }}
                >
                  <span className={["gm-menu-check", visible ? "is-checked" : ""].filter(Boolean).join(" ")}>
                    {visible ? <Check style={{ width: 10, height: 10 }} /> : null}
                  </span>
                  <span className="gm-menu-check-label">{column.title}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>,
    target
  );
}

function wrapAction(action?: () => void, onClose?: () => void) {
  if (!action) return undefined;

  return () => {
    action();
    onClose?.();
  };
}

export default ColumnMenu;
