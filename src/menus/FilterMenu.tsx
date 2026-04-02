import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Filter } from "lucide-react";
import { Z_INDEX } from "../core/constants";
import { useFloatingAnchorRect, useFloatingPortal } from "../react/hooks/useFloatingPortal";

type FilterMenuProps = {
  anchorEl?: HTMLElement | null;
  anchorRect?: DOMRect | null;
  title: string;
  values: string[];
  selectedValues: Set<string>;
  onApply: (values: Set<string>) => void;
  onClear: () => void;
  onClose: () => void;
};

export function FilterMenu({
  anchorEl,
  anchorRect,
  title,
  values,
  selectedValues,
  onApply,
  onClear,
  onClose,
}: FilterMenuProps) {
  const target = useFloatingPortal();
  const rect = useFloatingAnchorRect(anchorEl, anchorRect, onClose);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selectedValues));

  useEffect(() => {
    setDraft(new Set(selectedValues));
  }, [selectedValues]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-gm-filter-menu]")) {
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

  const visibleValues = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? values.filter((value) => value.toLowerCase().includes(query)) : values;
  }, [search, values]);

  const allValuesSelected = draft.size > 0 && values.length > 0 && values.every((value) => draft.has(value));
  const allVisibleSelected =
    visibleValues.length > 0 && visibleValues.every((value) => draft.has(value));

  if (!target) return null;

  const menuWidth = 300;
  const menuHeight = 420;
  const viewportWidth = typeof window === "undefined" ? menuWidth + 16 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? menuHeight + 16 : window.innerHeight;
  const top =
    rect.bottom + menuHeight > viewportHeight
      ? Math.max(8, rect.top - menuHeight)
      : rect.bottom + 6;
  const left = Math.max(8, Math.min(rect.left, viewportWidth - menuWidth - 8));

  return createPortal(
    <div
      data-gm-filter-menu
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
        <div className="gm-menu-kicker">Filter Values</div>
        <div className="gm-menu-title">{title}</div>
      </div>

      <div className="gm-filter-search">
        <div className="gm-filter-search-input">
          <Filter style={{ width: 13, height: 13 }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search values..."
          />
        </div>

        <div className="gm-filter-actions">
          <button
            type="button"
            className="gm-filter-action"
            onClick={() => setDraft(new Set(values))}
          >
            {allValuesSelected ? "All selected" : "Select all"}
          </button>
          <button
            type="button"
            className="gm-filter-action"
            onClick={() =>
              setDraft((prev) => {
                const next = new Set(prev);
                if (allVisibleSelected) {
                  visibleValues.forEach((value) => next.delete(value));
                } else {
                  visibleValues.forEach((value) => next.add(value));
                }
                return next;
              })
            }
          >
            {allVisibleSelected ? "Unselect shown" : "Select shown"}
          </button>
        </div>
      </div>

      <div className="gm-menu-scroll">
        {visibleValues.length ? (
          visibleValues.map((value) => {
            const checked = draft.has(value);

            return (
              <button
                key={value || "__empty__"}
                type="button"
                className={["gm-menu-check-row", checked ? "is-current" : ""].filter(Boolean).join(" ")}
                onClick={() => {
                  setDraft((prev) => {
                    const next = new Set(prev);
                    if (checked) next.delete(value);
                    else next.add(value);
                    return next;
                  });
                }}
              >
                <span className={["gm-menu-check", checked ? "is-checked" : ""].filter(Boolean).join(" ")}>
                  {checked ? <Check style={{ width: 10, height: 10 }} /> : null}
                </span>
                <span className="gm-menu-check-label">{value || "(empty)"}</span>
              </button>
            );
          })
        ) : (
          <div className="gm-menu-empty">No matching values</div>
        )}
      </div>

      <div className="gm-menu-footer">
        <div className="gm-menu-footer-note">
          {draft.size} of {values.length} selected
        </div>
        <button type="button" className="gm-button gm-button-secondary" onClick={onClear}>
          Clear
        </button>
        <button
          type="button"
          className="gm-button gm-button-primary"
          disabled={draft.size === 0}
          onClick={() => onApply(draft)}
        >
          Apply
        </button>
      </div>
    </div>,
    target
  );
}

export default FilterMenu;
