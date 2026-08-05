import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Filter,
  FilterX,
  MoveHorizontal,
  Palette,
  Snowflake,
} from "lucide-react";
import type { GridColorOption, GridSortDirection } from "../core/types";
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
  onClearFilter?: () => void;
  colorOptions?: GridColorOption[];
  colorLoading?: boolean;
  selectedColorFilterValues?: Set<string>;
  selectedColorSortValue?: string | null;
  onApplyColorFilterValues?: (values: Set<string>) => void;
  onApplyColorSortValue?: (value: string | null) => void;
  filterValues?: string[];
  filterLoading?: boolean;
  selectedFilterValues?: Set<string>;
  filterVisibleValueCount?: number;
  onApplyFilterValues?: (values: Set<string>) => void;
  onHideColumn?: () => void;
  onShowAllColumns?: () => void;
  onToggleColumnVisibility?: (columnKey: string, nextVisible: boolean) => void;
  onClose: () => void;
};

type ColumnMenuActionProps = {
  label: string;
  icon?: React.ReactNode;
  subtle?: boolean;
  active?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
};

type NestedColorMenu = "sort" | "filter" | null;
const DEFAULT_FILTER_VISIBLE_VALUE_COUNT = 4;
const FILTER_VALUE_ROW_HEIGHT = 38;
const FILTER_VALUE_LIST_PADDING = 8;

function ColumnMenuAction({
  label,
  icon,
  subtle = false,
  active = false,
  trailing,
  onClick,
}: ColumnMenuActionProps) {
  if (!onClick) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "gm-menu-action",
        subtle ? "is-subtle" : "",
        active ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon ? <span className="gm-menu-action-icon">{icon}</span> : null}
      <span className="gm-menu-action-label">{label}</span>
      {trailing ? <span className="gm-menu-action-icon">{trailing}</span> : null}
    </button>
  );
}

function getColorOptionLabel(option: GridColorOption): string {
  const label = String(option.label ?? "").trim();
  const swatch = String(option.swatch ?? "").trim();
  const value = String(option.value ?? "").trim();

  if (!value) return "No Fill";
  return label || swatch || value;
}

function ColorMenuPanel({
  mode,
  options,
  loading,
  selectedValues,
  selectedSortValue,
  onToggleValue,
  onSelectSortValue,
  onClearColorFilter,
  onClearColorSort,
}: {
  mode: Exclude<NestedColorMenu, null>;
  options: GridColorOption[];
  loading: boolean;
  selectedValues: Set<string>;
  selectedSortValue: string | null;
  onToggleValue: (value: string) => void;
  onSelectSortValue: (value: string) => void;
  onClearColorFilter: () => void;
  onClearColorSort: () => void;
}) {
  const title = mode === "sort" ? "Sort by Color" : "Filter by Color";
  const hasActiveSelection =
    mode === "sort" ? Boolean(selectedSortValue !== null) : selectedValues.size > 0;

  return (
    <div className="shrink-0 px-3 pb-2">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
            {title}
          </div>
          {hasActiveSelection ? (
            <button
              type="button"
              className="text-[11px] font-semibold text-[#2563eb]"
              onClick={mode === "sort" ? onClearColorSort : onClearColorFilter}
            >
              {mode === "sort" ? "Clear color sort" : "Clear color filter"}
            </button>
          ) : null}
        </div>

        <div className="max-h-48 overflow-y-auto pr-1">
          {loading ? (
            <div className="gm-menu-empty">Loading colors...</div>
          ) : options.length ? (
            options.map((option) => {
              const checked =
                mode === "sort"
                  ? selectedSortValue === option.value
                  : selectedValues.has(option.value);
              const label = getColorOptionLabel(option);
              const swatch = String(option.swatch ?? "").trim();
              const isNoFill = String(option.value ?? "").trim() === "";

              return (
                <button
                  key={option.value || "__no_fill__"}
                  type="button"
                  className={["gm-menu-check-row", checked ? "is-current" : ""].filter(Boolean).join(" ")}
                  onClick={() =>
                    mode === "sort" ? onSelectSortValue(option.value) : onToggleValue(option.value)
                  }
                >
                  <span
                    className={[
                      "gm-menu-check",
                      checked && mode === "filter" ? "is-checked" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {mode === "filter" && checked ? <Check style={{ width: 10, height: 10 }} /> : null}
                    {mode === "sort" && checked ? <ChevronRight style={{ width: 10, height: 10 }} /> : null}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300"
                    style={{
                      background: isNoFill ? "#ffffff" : swatch || "#ffffff",
                      boxShadow: isNoFill ? "inset 0 0 0 1px rgba(148, 163, 184, 0.55)" : undefined,
                    }}
                  />
                  <span className="gm-menu-check-label">{label}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{option.count}</span>
                </button>
              );
            })
          ) : (
            <div className="gm-menu-empty">No colors available</div>
          )}
        </div>
      </div>
    </div>
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
  onClearFilter,
  colorOptions = [],
  colorLoading = false,
  selectedColorFilterValues,
  selectedColorSortValue,
  onApplyColorFilterValues,
  onApplyColorSortValue,
  filterValues = [],
  filterLoading = false,
  selectedFilterValues,
  filterVisibleValueCount,
  onApplyFilterValues,
  onHideColumn,
  onShowAllColumns,
  onToggleColumnVisibility,
  onClose,
}: ColumnMenuProps) {
  const target = useFloatingPortal();
  const rect = useFloatingAnchorRect(anchorEl, anchorRect, onClose);
  const [search, setSearch] = useState("");
  const [openColorMenu, setOpenColorMenu] = useState<NestedColorMenu>(null);
  const [draftFilterValues, setDraftFilterValues] = useState<Set<string>>(
    () => new Set(selectedFilterValues ?? filterValues)
  );
  const [draftColorFilterValues, setDraftColorFilterValues] = useState<Set<string>>(
    () => new Set(selectedColorFilterValues ?? [])
  );
  const [draftColorSortValue, setDraftColorSortValue] = useState<string | null>(
    selectedColorSortValue ?? null
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-gm-column-menu]")) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (openColorMenu) {
          setOpenColorMenu(null);
          return;
        }
        onClose();
      }
    };

    const timeoutId = window.setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown, true);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, openColorMenu]);

  useEffect(() => {
    setDraftFilterValues(new Set(selectedFilterValues ?? filterValues));
  }, [filterValues, selectedFilterValues]);

  useEffect(() => {
    setDraftColorFilterValues(new Set(selectedColorFilterValues ?? []));
  }, [selectedColorFilterValues]);

  useEffect(() => {
    setDraftColorSortValue(selectedColorSortValue ?? null);
  }, [selectedColorSortValue]);

  const visibleFilterValues = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? filterValues.filter((value) => value.toLowerCase().includes(query))
      : filterValues;
  }, [filterValues, search]);

  if (!target) return null;

  const menuWidth = 304;
  const maxMenuHeight = typeof window === "undefined" ? 720 : Math.min(window.innerHeight * 0.88, 720);
  const hiddenColumnCount = Math.max(columns.length - currentVisibleColumnCount, 0);
  const manageVisibilityOnly = mode === "visibility" && showVisibilityControls;
  const showInlineFilter = !manageVisibilityOnly && Boolean(onApplyFilterValues);
  const hasColorTools =
    !manageVisibilityOnly && (Boolean(onApplyColorFilterValues) || Boolean(onApplyColorSortValue));
  const allFilterValuesSelected =
    draftFilterValues.size > 0 &&
    filterValues.length > 0 &&
    filterValues.every((value) => draftFilterValues.has(value));
  const allVisibleFilterValuesSelected =
    visibleFilterValues.length > 0 &&
    visibleFilterValues.every((value) => draftFilterValues.has(value));
  const viewportWidth = typeof window === "undefined" ? menuWidth + 16 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? maxMenuHeight + 16 : window.innerHeight;
  const top =
    rect.bottom + maxMenuHeight > viewportHeight
      ? Math.max(8, rect.top - maxMenuHeight)
      : rect.bottom + 6;
  const left = Math.max(8, Math.min(rect.left, viewportWidth - menuWidth - 8));
  const applyDisabled =
    filterLoading ||
    colorLoading ||
    (showInlineFilter && filterValues.length > 0 && draftFilterValues.size === 0);
  const effectiveFilterVisibleValueCount =
    typeof filterVisibleValueCount === "number" && filterVisibleValueCount > 0
      ? filterVisibleValueCount
      : DEFAULT_FILTER_VISIBLE_VALUE_COUNT;
  const filterValueListMaxHeight =
    effectiveFilterVisibleValueCount * FILTER_VALUE_ROW_HEIGHT + FILTER_VALUE_LIST_PADDING;

  const applyAll = () => {
    onApplyFilterValues?.(new Set(draftFilterValues));
    onApplyColorFilterValues?.(new Set(draftColorFilterValues));
    onApplyColorSortValue?.(draftColorSortValue);
    onClose();
  };

  const resetAll = () => {
    const resetValueFilters = new Set(filterValues);
    setSearch("");
    setOpenColorMenu(null);
    setDraftFilterValues(resetValueFilters);
    setDraftColorFilterValues(new Set());
    setDraftColorSortValue(null);
    onApplyFilterValues?.(resetValueFilters);
    onApplyColorFilterValues?.(new Set());
    onApplyColorSortValue?.(null);
  };

  return createPortal(
    <div
      data-gm-column-menu
      className="gm-floating-menu flex max-h-[min(88vh,720px)] flex-col overflow-hidden"
      style={{
        position: "fixed",
        top,
        left,
        width: menuWidth,
        zIndex: Z_INDEX.FLOATING_MENU,
      }}
    >
      <div className="gm-menu-header shrink-0">
        <div className="gm-menu-kicker">
          {manageVisibilityOnly ? "Column Visibility" : "Column Menu"}
        </div>
        <div className="gm-menu-title">{title}</div>
      </div>

      {!manageVisibilityOnly ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="gm-menu-section shrink-0">
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
            <ColumnMenuAction
              label="Sort by Color"
              icon={<Palette style={{ width: 14, height: 14 }} />}
              active={openColorMenu === "sort" || draftColorSortValue !== null}
              trailing={openColorMenu === "sort" ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
              onClick={
                onApplyColorSortValue
                  ? () => setOpenColorMenu((current) => (current === "sort" ? null : "sort"))
                  : undefined
              }
            />
            {sortDirection ? (
              <ColumnMenuAction
                label="Clear Sort"
                subtle
                onClick={wrapAction(onClearSort, onClose)}
              />
            ) : null}
          </div>

          {openColorMenu === "sort" && onApplyColorSortValue ? (
            <ColorMenuPanel
              mode="sort"
              options={colorOptions}
              loading={colorLoading}
              selectedValues={draftColorFilterValues}
              selectedSortValue={draftColorSortValue}
              onToggleValue={() => undefined}
              onSelectSortValue={(value) =>
                setDraftColorSortValue((current) => (current === value ? null : value))
              }
              onClearColorFilter={() => undefined}
              onClearColorSort={() => setDraftColorSortValue(null)}
            />
          ) : null}

          <div className="gm-menu-divider shrink-0" />

          <div className="gm-menu-section shrink-0">
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

          <div className="gm-menu-divider shrink-0" />

          {hasColorTools ? (
            <>
              <div className="gm-menu-section shrink-0">
                <ColumnMenuAction
                  label="Filter by Color"
                  icon={<Palette style={{ width: 14, height: 14 }} />}
                  active={openColorMenu === "filter" || draftColorFilterValues.size > 0}
                  trailing={openColorMenu === "filter" ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
                  onClick={
                    onApplyColorFilterValues
                      ? () => setOpenColorMenu((current) => (current === "filter" ? null : "filter"))
                      : undefined
                  }
                />
                {draftColorFilterValues.size > 0 ? (
                  <ColumnMenuAction
                    label="Clear color filter"
                    subtle
                    icon={<FilterX style={{ width: 14, height: 14 }} />}
                    onClick={() => setDraftColorFilterValues(new Set())}
                  />
                ) : null}
              </div>

              {openColorMenu === "filter" && onApplyColorFilterValues ? (
                <ColorMenuPanel
                  mode="filter"
                  options={colorOptions}
                  loading={colorLoading}
                  selectedValues={draftColorFilterValues}
                  selectedSortValue={draftColorSortValue}
                  onToggleValue={(value) =>
                    setDraftColorFilterValues((prev) => {
                      const next = new Set(prev);
                      if (next.has(value)) next.delete(value);
                      else next.add(value);
                      return next;
                    })
                  }
                  onSelectSortValue={() => undefined}
                  onClearColorFilter={() => setDraftColorFilterValues(new Set())}
                  onClearColorSort={() => undefined}
                />
              ) : null}

              <div className="gm-menu-divider shrink-0" />
            </>
          ) : null}

          {showInlineFilter ? (
            <>
              <div className="gm-menu-section-heading shrink-0">
                <div className="gm-menu-section-title">Filter by value</div>
              </div>
              <div className="gm-filter-search shrink-0">
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
                    disabled={filterLoading}
                    onClick={() => setDraftFilterValues(new Set(filterValues))}
                  >
                    {allFilterValuesSelected ? "All selected" : "Select all"}
                  </button>
                  <button
                    type="button"
                    className="gm-filter-action"
                    disabled={filterLoading}
                    onClick={() =>
                      setDraftFilterValues((prev) => {
                        const next = new Set(prev);
                        if (allVisibleFilterValuesSelected) {
                          visibleFilterValues.forEach((value) => next.delete(value));
                        } else {
                          visibleFilterValues.forEach((value) => next.add(value));
                        }
                        return next;
                      })
                    }
                  >
                    {allVisibleFilterValuesSelected ? "Unselect shown" : "Select shown"}
                  </button>
                </div>
              </div>

              <div
                className="gm-menu-scroll flex-1 min-h-0 overflow-y-auto"
                style={{ maxHeight: filterValueListMaxHeight ?? "none" }}
              >
                {filterLoading ? (
                  <div className="gm-menu-empty">Loading values...</div>
                ) : visibleFilterValues.length ? (
                  visibleFilterValues.map((value) => {
                    const checked = draftFilterValues.has(value);

                    return (
                      <button
                        key={value || "__empty__"}
                        type="button"
                        className={["gm-menu-check-row", checked ? "is-current" : ""].filter(Boolean).join(" ")}
                        onClick={() => {
                          setDraftFilterValues((prev) => {
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
            </>
          ) : null}

          <div className="gm-menu-section shrink-0">
            {isFiltered && !showInlineFilter ? (
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

          {showInlineFilter ? (
            <div className="gm-menu-footer shrink-0 border-t bg-white">
              <div className="gm-menu-footer-note">
                {draftFilterValues.size} of {filterValues.length} selected
                {draftColorFilterValues.size > 0 ? ` · ${draftColorFilterValues.size} color${draftColorFilterValues.size === 1 ? "" : "s"}` : ""}
                {draftColorSortValue !== null ? " · color sort" : ""}
              </div>
              <button
                type="button"
                className="gm-button gm-button-secondary"
                onClick={resetAll}
              >
                {isFiltered || draftColorFilterValues.size > 0 || draftColorSortValue !== null ? "Reset" : "Reset"}
              </button>
              <button
                type="button"
                className="gm-button gm-button-primary"
                disabled={applyDisabled}
                onClick={applyAll}
              >
                Apply
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showVisibilityControls ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="gm-menu-section-heading shrink-0">
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
          <div className="gm-menu-section-note shrink-0">
            {currentVisibleColumnCount} visible / {hiddenColumnCount} hidden
          </div>
          <div className="gm-menu-scroll flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: "none" }}>
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
        </div>
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
