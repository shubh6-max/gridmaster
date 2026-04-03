import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus } from "lucide-react";
import { Z_INDEX } from "../core/constants";
import { useFloatingAnchorRect, useFloatingPortal } from "./hooks/useFloatingPortal";
import { useGridContext } from "./context/GridContext";

type MenuActionProps = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

function MenuAction({ label, icon, onClick }: MenuActionProps) {
  return (
    <button type="button" className="gm-menu-action" onClick={onClick}>
      <span className="gm-menu-action-icon">{icon}</span>
      <span className="gm-menu-action-label">{label}</span>
    </button>
  );
}

export function GridContextMenu() {
  const {
    contextMenu,
    closeContextMenu,
    displayRowIndexes,
    visibleColumns,
    enableInsertRow,
    enableInsertColumn,
    insertRow,
    insertColumn,
    focusViewport,
  } = useGridContext();
  const target = useFloatingPortal();
  const rect = useFloatingAnchorRect(undefined, contextMenu?.anchorRect, closeContextMenu);

  useEffect(() => {
    if (!contextMenu) return undefined;

    const handleMouseDown = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-gm-context-menu]")) {
        closeContextMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
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
  }, [closeContextMenu, contextMenu]);

  if (!target || !contextMenu) return null;

  const showRowActions =
    enableInsertRow &&
    (contextMenu.kind === "cell" || contextMenu.kind === "row") &&
    typeof contextMenu.displayRowIndex === "number";
  const showColumnActions =
    enableInsertColumn &&
    (contextMenu.kind === "cell" || contextMenu.kind === "column") &&
    Boolean(contextMenu.columnKey);

  if (!showRowActions && !showColumnActions) {
    return null;
  }

  const menuWidth = 248;
  const menuHeight = showRowActions && showColumnActions ? 216 : 144;
  const viewportWidth = typeof window === "undefined" ? menuWidth + 16 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? menuHeight + 16 : window.innerHeight;
  const top =
    rect.bottom + menuHeight > viewportHeight
      ? Math.max(8, rect.top - menuHeight)
      : rect.bottom + 6;
  const left = Math.max(8, Math.min(rect.left, viewportWidth - menuWidth - 8));

  const runAction = (action: () => void) => {
    action();
    closeContextMenu();
    focusViewport();
  };

  const sourceRowIndex =
    typeof contextMenu.displayRowIndex === "number"
      ? (displayRowIndexes[contextMenu.displayRowIndex] ?? contextMenu.displayRowIndex)
      : -1;
  const columnKey =
    contextMenu.columnKey ??
    (typeof contextMenu.visibleColumnIndex === "number"
      ? visibleColumns[contextMenu.visibleColumnIndex]?.key
      : undefined);

  return createPortal(
    <div
      data-gm-context-menu
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
        <div className="gm-menu-kicker">Context Menu</div>
        <div className="gm-menu-title">Insert spreadsheet structure</div>
      </div>

      {showRowActions ? (
        <>
          <div className="gm-menu-section-heading">
            <div className="gm-menu-section-title">Rows</div>
          </div>
          <div className="gm-menu-section">
            <MenuAction
              label="Insert Row Above"
              icon={
                <>
                  <Plus style={{ width: 12, height: 12 }} />
                  <ArrowUp style={{ width: 12, height: 12 }} />
                </>
              }
              onClick={() => runAction(() => void insertRow(sourceRowIndex, "above"))}
            />
            <MenuAction
              label="Insert Row Below"
              icon={
                <>
                  <Plus style={{ width: 12, height: 12 }} />
                  <ArrowDown style={{ width: 12, height: 12 }} />
                </>
              }
              onClick={() => runAction(() => void insertRow(sourceRowIndex, "below"))}
            />
          </div>
        </>
      ) : null}

      {showRowActions && showColumnActions ? <div className="gm-menu-divider" /> : null}

      {showColumnActions && columnKey ? (
        <>
          <div className="gm-menu-section-heading">
            <div className="gm-menu-section-title">Columns</div>
          </div>
          <div className="gm-menu-section">
            <MenuAction
              label="Insert Column Left"
              icon={
                <>
                  <Plus style={{ width: 12, height: 12 }} />
                  <ArrowLeft style={{ width: 12, height: 12 }} />
                </>
              }
              onClick={() => runAction(() => void insertColumn(columnKey, "left"))}
            />
            <MenuAction
              label="Insert Column Right"
              icon={
                <>
                  <Plus style={{ width: 12, height: 12 }} />
                  <ArrowRight style={{ width: 12, height: 12 }} />
                </>
              }
              onClick={() => runAction(() => void insertColumn(columnKey, "right"))}
            />
          </div>
        </>
      ) : null}
    </div>,
    target
  );
}

export default GridContextMenu;
