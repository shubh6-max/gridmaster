import React, { useEffect, useId, useMemo, useRef, useState } from "react";
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
import {
  buildDateFilterTree,
  collectDateFilterTreeValues,
  filterDateFilterTreeBySearch,
  getDateFilterTreeCheckState,
  getInitialCollapsedDateFilterTreeKeys,
  toggleDateFilterTreeCollapsedKey,
  toggleDateFilterTreeValues,
  type DateFilterTreeNode,
} from "../filters/dateFilterTree";
import { useFloatingAnchorRect, useFloatingPortal } from "../react/hooks/useFloatingPortal";
import { getColorMenuOptionListMaxHeight } from "./colorMenuLayout";
import { getColumnMenuSidePanelPosition } from "./columnMenuLayout";

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
  /** "date" renders the value filter as a year > month > day tree. */
  filterTree?: "date";
  filterLoading?: boolean;
  selectedFilterValues?: Set<string>;
  filterVisibleValueCount?: number;
  colorMenuVisibleValueCount?: number;
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
  /** Set on controls that show or hide something: becomes aria-expanded. */
  expanded?: boolean;
  /** Id of the element the control shows or hides: becomes aria-controls. */
  controls?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

type NestedColorMenu = "sort" | "filter" | null;
type MenuSection = "sort" | "filter" | "more" | null;

const DEFAULT_FILTER_VISIBLE_VALUE_COUNT = 4;
const FILTER_VALUE_ROW_HEIGHT = 38;
const FILTER_VALUE_LIST_PADDING = 8;
const COLOR_PANEL_WIDTH = 232;
const COLOR_PANEL_HEIGHT = 260;
const ICON_SIZE = { width: 14, height: 14 } as const;
const CHECK_SIZE = { width: 10, height: 10 } as const;
// Stable defaults: a fresh [] per render would re-trigger the effects keyed on these props.
const NO_VALUES: string[] = [];
const NO_COLOR_OPTIONS: GridColorOption[] = [];
const NO_KEYS: ReadonlySet<string> = new Set<string>();

function ColumnMenuAction({
  label,
  icon,
  subtle = false,
  active = false,
  trailing,
  expanded,
  controls,
  onClick,
}: ColumnMenuActionProps) {
  if (!onClick) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      className={["gm-menu-action", subtle ? "is-subtle" : "", active ? "is-active" : ""]
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
  visibleValueCount,
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
  visibleValueCount?: number;
}) {
  const title = mode === "sort" ? "Sort by Color" : "Filter by Color";
  const hasActiveSelection =
    mode === "sort" ? Boolean(selectedSortValue !== null) : selectedValues.size > 0;
  const optionListMaxHeight =
    typeof visibleValueCount === "number" &&
    Number.isFinite(visibleValueCount) &&
    visibleValueCount > 0
      ? getColorMenuOptionListMaxHeight(visibleValueCount)
      : undefined;

  return (
    <div className="gm-color-panel">
      <div className="gm-color-panel-head">
        <div className="gm-color-panel-title">{title}</div>
        {hasActiveSelection ? (
          <button
            type="button"
            className="gm-menu-inline-action"
            onClick={mode === "sort" ? onClearColorSort : onClearColorFilter}
          >
            {mode === "sort" ? "Clear color sort" : "Clear color filter"}
          </button>
        ) : null}
      </div>

      <div
        className="gm-color-panel-list"
        style={optionListMaxHeight === undefined ? undefined : { maxHeight: optionListMaxHeight }}
      >
        {loading ? (
          <div className="gm-menu-empty">Loading colors...</div>
        ) : options.length ? (
          options.map((option) => {
            const checked =
              mode === "sort" ? selectedSortValue === option.value : selectedValues.has(option.value);
            const label = getColorOptionLabel(option);
            const swatch = String(option.swatch ?? "").trim();
            const isNoFill = String(option.value ?? "").trim() === "";
            // Filter rows are independent toggles (checkbox); sort rows pick one colour (pressed).
            const stateProps =
              mode === "filter"
                ? ({ role: "checkbox", "aria-checked": checked } as const)
                : ({ "aria-pressed": checked } as const);

            return (
              <button
                key={option.value || "__no_fill__"}
                type="button"
                {...stateProps}
                className={["gm-menu-check-row", checked ? "is-current" : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() =>
                  mode === "sort" ? onSelectSortValue(option.value) : onToggleValue(option.value)
                }
              >
                <span
                  className={["gm-menu-check", checked && mode === "filter" ? "is-checked" : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {mode === "filter" && checked ? <Check style={CHECK_SIZE} /> : null}
                  {mode === "sort" && checked ? <ChevronRight style={CHECK_SIZE} /> : null}
                </span>
                <span
                  aria-hidden="true"
                  className={["gm-color-swatch", isNoFill || !swatch ? "is-empty" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  style={isNoFill || !swatch ? undefined : { background: swatch }}
                />
                <span className="gm-menu-check-label">{label}</span>
                <span className="gm-color-count">{option.count}</span>
              </button>
            );
          })
        ) : (
          <div className="gm-menu-empty">No colors available</div>
        )}
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
  colorOptions = NO_COLOR_OPTIONS,
  colorLoading = false,
  selectedColorFilterValues,
  selectedColorSortValue,
  onApplyColorFilterValues,
  onApplyColorSortValue,
  filterValues = NO_VALUES,
  filterTree,
  filterLoading = false,
  selectedFilterValues,
  filterVisibleValueCount,
  colorMenuVisibleValueCount,
  onApplyFilterValues,
  onHideColumn,
  onShowAllColumns,
  onToggleColumnVisibility,
  onClose,
}: ColumnMenuProps) {
  const target = useFloatingPortal();
  const rect = useFloatingAnchorRect(anchorEl, anchorRect, onClose);
  const idBase = useId();
  const [search, setSearch] = useState("");
  const [openSection, setOpenSection] = useState<MenuSection>(null);
  const [valuesExpanded, setValuesExpanded] = useState(false);
  const [openColorMenu, setOpenColorMenu] = useState<NestedColorMenu>(null);
  const [colorPanelAnchorRect, setColorPanelAnchorRect] = useState<DOMRect | null>(null);
  const [draftFilterValues, setDraftFilterValues] = useState<Set<string>>(
    () => new Set(selectedFilterValues ?? filterValues)
  );
  const [draftColorFilterValues, setDraftColorFilterValues] = useState<Set<string>>(
    () => new Set(selectedColorFilterValues ?? [])
  );
  const [draftColorSortValue, setDraftColorSortValue] = useState<string | null>(
    selectedColorSortValue ?? null
  );
  const [collapsedDateFilterKeys, setCollapsedDateFilterKeys] = useState<Set<string>>(new Set());
  const initializedCollapsedDateFilterColumnRef = useRef<string | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-gm-column-menu]")) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Escape peels back one layer: the colour side panel first, then the whole menu.
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

  // Start the date tree fully collapsed, once per column (values can reload while it is open).
  useEffect(() => {
    if (
      filterTree !== "date" ||
      !filterValues.length ||
      initializedCollapsedDateFilterColumnRef.current === currentColumnKey
    ) {
      return;
    }

    setCollapsedDateFilterKeys(
      getInitialCollapsedDateFilterTreeKeys(buildDateFilterTree(filterValues))
    );
    initializedCollapsedDateFilterColumnRef.current = currentColumnKey ?? null;
  }, [currentColumnKey, filterTree, filterValues]);

  const searchQuery = search.trim().toLowerCase();
  const visibleFilterValues = useMemo(
    () =>
      searchQuery
        ? filterValues.filter((value) => value.toLowerCase().includes(searchQuery))
        : filterValues,
    [filterValues, searchQuery]
  );
  const visibleDateFilterTree = useMemo(
    () =>
      filterTree === "date"
        ? filterDateFilterTreeBySearch(buildDateFilterTree(filterValues), searchQuery)
        : [],
    [filterTree, filterValues, searchQuery]
  );
  // What "Select shown" / "Unselect shown" act on: the leaves of the tree, or the plain list.
  const shownFilterValues = useMemo(
    () =>
      filterTree === "date"
        ? [...collectDateFilterTreeValues(visibleDateFilterTree)]
        : visibleFilterValues,
    [filterTree, visibleDateFilterTree, visibleFilterValues]
  );

  if (!target) return null;

  const menuWidth = 304;
  const maxMenuHeight =
    typeof window === "undefined" ? 720 : Math.min(window.innerHeight * 0.88, 720);
  const hiddenColumnCount = Math.max(columns.length - currentVisibleColumnCount, 0);
  const manageVisibilityOnly = mode === "visibility" && showVisibilityControls;
  const showInlineFilter = !manageVisibilityOnly && Boolean(onApplyFilterValues);
  const hasColorFilter = !manageVisibilityOnly && Boolean(onApplyColorFilterValues);
  const hasSortActions =
    Boolean(onSortAsc || onSortDesc || onApplyColorSortValue) || Boolean(sortDirection && onClearSort);
  const hasMoreActions = Boolean(onAutoFit || onFreezeToggle);
  const allFilterValuesSelected =
    draftFilterValues.size > 0 &&
    filterValues.length > 0 &&
    filterValues.every((value) => draftFilterValues.has(value));
  const allShownFilterValuesSelected =
    shownFilterValues.length > 0 && shownFilterValues.every((value) => draftFilterValues.has(value));
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

  const sortRegionId = `${idBase}-sort`;
  const filterRegionId = `${idBase}-filter`;
  const moreRegionId = `${idBase}-more`;
  const valuesRegionId = `${idBase}-values`;
  const colorPanelId = `${idBase}-color-panel`;

  const colorPanelPosition =
    openColorMenu && colorPanelAnchorRect
      ? getColumnMenuSidePanelPosition({
          anchorRect: colorPanelAnchorRect,
          panelWidth: COLOR_PANEL_WIDTH,
          panelHeight: COLOR_PANEL_HEIGHT,
          viewportWidth,
          viewportHeight,
        })
      : null;

  const chevronFor = (expanded: boolean) =>
    expanded ? <ChevronDown style={ICON_SIZE} /> : <ChevronRight style={ICON_SIZE} />;

  const toggleSection = (section: Exclude<MenuSection, null>) => {
    setOpenSection((current) => (current === section ? null : section));
    setOpenColorMenu(null);
  };

  const toggleColorMenu = (
    next: Exclude<NestedColorMenu, null>,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    setColorPanelAnchorRect(event.currentTarget.getBoundingClientRect());
    setOpenColorMenu((current) => (current === next ? null : next));
  };

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

  const setValueSelected = (value: string, selected: boolean) =>
    setDraftFilterValues((prev) => {
      const next = new Set(prev);
      if (selected) next.add(value);
      else next.delete(value);
      return next;
    });

  return createPortal(
    <div
      data-gm-column-menu
      className="gm-floating-menu gm-column-menu"
      style={{
        position: "fixed",
        top,
        left,
        width: menuWidth,
        zIndex: Z_INDEX.FLOATING_MENU,
      }}
    >
      <div className="gm-menu-header gm-menu-fixed">
        <div className="gm-menu-kicker">
          {manageVisibilityOnly ? "Column Visibility" : "Column Menu"}
        </div>
        <div className="gm-menu-title">{title}</div>
      </div>

      {!manageVisibilityOnly ? (
        <div className="gm-menu-body">
          <div className="gm-menu-section gm-menu-section-compact gm-menu-fixed">
            {hasSortActions ? (
              <ColumnMenuAction
                label="Sort"
                icon={<ArrowUpAZ style={ICON_SIZE} />}
                active={openSection === "sort"}
                expanded={openSection === "sort"}
                controls={sortRegionId}
                trailing={chevronFor(openSection === "sort")}
                onClick={() => toggleSection("sort")}
              />
            ) : null}
            {openSection === "sort" ? (
              <div id={sortRegionId} className="gm-menu-sort-children">
                <ColumnMenuAction
                  label="Sort A to Z"
                  icon={<ArrowUpAZ style={ICON_SIZE} />}
                  onClick={wrapAction(onSortAsc, onClose)}
                />
                <ColumnMenuAction
                  label="Sort Z to A"
                  icon={<ArrowDownAZ style={ICON_SIZE} />}
                  onClick={wrapAction(onSortDesc, onClose)}
                />
                <ColumnMenuAction
                  label="Sort by Color"
                  icon={<Palette style={ICON_SIZE} />}
                  active={openColorMenu === "sort" || draftColorSortValue !== null}
                  expanded={openColorMenu === "sort"}
                  controls={colorPanelId}
                  trailing={<ChevronRight style={ICON_SIZE} />}
                  onClick={
                    onApplyColorSortValue ? (event) => toggleColorMenu("sort", event) : undefined
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
            ) : null}

            {showInlineFilter || hasColorFilter ? (
              <ColumnMenuAction
                label="Filter"
                icon={<Filter style={ICON_SIZE} />}
                active={openSection === "filter"}
                expanded={openSection === "filter"}
                controls={filterRegionId}
                trailing={chevronFor(openSection === "filter")}
                onClick={() => toggleSection("filter")}
              />
            ) : null}
            {openSection === "filter" ? (
              <div id={filterRegionId} className="gm-menu-sort-children">
                {showInlineFilter ? (
                  <ColumnMenuAction
                    label="Filter values"
                    icon={<Filter style={ICON_SIZE} />}
                    active={valuesExpanded}
                    expanded={valuesExpanded}
                    controls={valuesRegionId}
                    trailing={chevronFor(valuesExpanded)}
                    onClick={() => setValuesExpanded((current) => !current)}
                  />
                ) : null}
                {hasColorFilter ? (
                  <ColumnMenuAction
                    label="Filter by Color"
                    icon={<Palette style={ICON_SIZE} />}
                    active={openColorMenu === "filter" || draftColorFilterValues.size > 0}
                    expanded={openColorMenu === "filter"}
                    controls={colorPanelId}
                    trailing={<ChevronRight style={ICON_SIZE} />}
                    onClick={(event) => toggleColorMenu("filter", event)}
                  />
                ) : null}
                {hasColorFilter && draftColorFilterValues.size > 0 ? (
                  <ColumnMenuAction
                    label="Clear color filter"
                    subtle
                    icon={<FilterX style={ICON_SIZE} />}
                    onClick={() => setDraftColorFilterValues(new Set())}
                  />
                ) : null}
              </div>
            ) : null}

            {hasMoreActions ? (
              <ColumnMenuAction
                label="More"
                active={openSection === "more"}
                expanded={openSection === "more"}
                controls={moreRegionId}
                trailing={chevronFor(openSection === "more")}
                onClick={() => toggleSection("more")}
              />
            ) : null}
            {openSection === "more" ? (
              <div id={moreRegionId} className="gm-menu-sort-children">
                <ColumnMenuAction
                  label="Auto-fit Width"
                  icon={<MoveHorizontal style={ICON_SIZE} />}
                  onClick={wrapAction(onAutoFit, onClose)}
                />
                <ColumnMenuAction
                  label={isFrozen ? "Unfreeze Through Here" : "Freeze Through Here"}
                  icon={<Snowflake style={ICON_SIZE} />}
                  onClick={wrapAction(onFreezeToggle, onClose)}
                />
              </div>
            ) : null}
          </div>

          <div className="gm-menu-divider gm-menu-fixed" />

          {showInlineFilter && openSection === "filter" && valuesExpanded ? (
            <div id={valuesRegionId} className="gm-menu-values">
              <div className="gm-menu-section-heading gm-menu-fixed">
                <div className="gm-menu-section-title">Filter by value</div>
              </div>
              <div className="gm-filter-search gm-menu-fixed">
                <div className="gm-filter-search-input">
                  <Filter style={{ width: 13, height: 13 }} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search values..."
                    aria-label="Search values"
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
                        for (const value of shownFilterValues) {
                          if (allShownFilterValuesSelected) next.delete(value);
                          else next.add(value);
                        }
                        return next;
                      })
                    }
                  >
                    {allShownFilterValuesSelected ? "Unselect shown" : "Select shown"}
                  </button>
                </div>
              </div>

              <div
                className="gm-menu-scroll gm-menu-scroll-fill"
                style={{ maxHeight: filterValueListMaxHeight }}
              >
                {filterLoading ? (
                  <div className="gm-menu-empty">Loading values...</div>
                ) : filterTree === "date" ? (
                  visibleDateFilterTree.length ? (
                    <DateFilterTree
                      idPrefix={`${idBase}-tree`}
                      nodes={visibleDateFilterTree}
                      selectedValues={draftFilterValues}
                      onToggle={(values) =>
                        setDraftFilterValues((current) => toggleDateFilterTreeValues(current, values))
                      }
                      // While searching, matches are shown expanded and the expanders are hidden.
                      searching={searchQuery !== ""}
                      collapsedKeys={searchQuery ? NO_KEYS : collapsedDateFilterKeys}
                      onToggleCollapsed={(key) =>
                        setCollapsedDateFilterKeys((current) =>
                          toggleDateFilterTreeCollapsedKey(current, key)
                        )
                      }
                    />
                  ) : (
                    <div className="gm-menu-empty">No matching values</div>
                  )
                ) : visibleFilterValues.length ? (
                  visibleFilterValues.map((value) => {
                    const checked = draftFilterValues.has(value);

                    return (
                      <button
                        key={value || "__empty__"}
                        type="button"
                        // biome-ignore lint/a11y/useSemanticElements: styled toggle button; role=checkbox keeps one pattern with the tri-state tree rows
                        role="checkbox"
                        aria-checked={checked}
                        className={["gm-menu-check-row", checked ? "is-current" : ""]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => setValueSelected(value, !checked)}
                      >
                        <span
                          className={["gm-menu-check", checked ? "is-checked" : ""]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {checked ? <Check style={CHECK_SIZE} /> : null}
                        </span>
                        <span className="gm-menu-check-label">{value || "(empty)"}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="gm-menu-empty">No matching values</div>
                )}
              </div>
            </div>
          ) : null}

          <div className="gm-menu-section gm-menu-fixed">
            {isFiltered && !showInlineFilter ? (
              <ColumnMenuAction
                label="Clear Filter"
                subtle
                icon={<FilterX style={ICON_SIZE} />}
                onClick={wrapAction(onClearFilter, onClose)}
              />
            ) : null}
            {currentVisibleColumnCount > 1 ? (
              <ColumnMenuAction
                label="Hide This Column"
                icon={<EyeOff style={ICON_SIZE} />}
                onClick={wrapAction(onHideColumn, onClose)}
              />
            ) : null}
          </div>

          {showInlineFilter ? (
            <div className="gm-menu-footer gm-menu-fixed">
              <div className="gm-menu-footer-note">
                {draftFilterValues.size} of {filterValues.length} selected
                {draftColorFilterValues.size > 0
                  ? ` · ${draftColorFilterValues.size} color${draftColorFilterValues.size === 1 ? "" : "s"}`
                  : ""}
                {draftColorSortValue !== null ? " · color sort" : ""}
              </div>
              <button type="button" className="gm-button gm-button-secondary" onClick={resetAll}>
                Reset
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
        <div className="gm-menu-body">
          <div className="gm-menu-section-heading gm-menu-fixed">
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
          <div className="gm-menu-section-note gm-menu-fixed">
            {currentVisibleColumnCount} visible / {hiddenColumnCount} hidden
          </div>
          <div className="gm-menu-scroll gm-menu-scroll-fill" style={{ maxHeight: "none" }}>
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
                  <span
                    className={["gm-menu-check", visible ? "is-checked" : ""]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {visible ? <Check style={CHECK_SIZE} /> : null}
                  </span>
                  <span className="gm-menu-check-label">{column.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {openColorMenu && colorPanelPosition ? (
        <section
          id={colorPanelId}
          aria-label={openColorMenu === "sort" ? "Sort by Color" : "Filter by Color"}
          className="gm-menu-side-panel"
          style={{
            position: "fixed",
            top: colorPanelPosition.top,
            left: colorPanelPosition.left,
            width: COLOR_PANEL_WIDTH,
            zIndex: Z_INDEX.FLOATING_MENU + 1,
          }}
        >
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
              visibleValueCount={colorMenuVisibleValueCount}
            />
          ) : null}
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
              visibleValueCount={colorMenuVisibleValueCount}
            />
          ) : null}
        </section>
      ) : null}
    </div>,
    target
  );
}

function DateFilterTree({
  idPrefix,
  nodes,
  selectedValues,
  onToggle,
  searching,
  collapsedKeys,
  onToggleCollapsed,
  depth = 0,
}: {
  idPrefix: string;
  nodes: DateFilterTreeNode[];
  selectedValues: Set<string>;
  onToggle: (values: Set<string>) => void;
  searching: boolean;
  collapsedKeys: ReadonlySet<string>;
  onToggleCollapsed: (key: string) => void;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node) => {
        const checkState = getDateFilterTreeCheckState(node, selectedValues);
        const checked = checkState === "checked";
        const partiallyChecked = checkState === "mixed";
        const hasChildren = node.children.length > 0;
        const collapsed = collapsedKeys.has(node.key);
        const childrenId = `${idPrefix}-${node.key}`;

        return (
          <React.Fragment key={node.key}>
            <div className="gm-menu-tree-row" style={{ paddingLeft: 12 + depth * 18 }}>
              {hasChildren && !searching ? (
                <button
                  type="button"
                  className="gm-menu-tree-toggle"
                  aria-label={`${collapsed ? "Expand" : "Collapse"} ${node.label}`}
                  aria-expanded={!collapsed}
                  aria-controls={childrenId}
                  onClick={() => onToggleCollapsed(node.key)}
                >
                  {collapsed ? (
                    <ChevronRight style={ICON_SIZE} />
                  ) : (
                    <ChevronDown style={ICON_SIZE} />
                  )}
                </button>
              ) : (
                <span className="gm-menu-tree-spacer" />
              )}
              <button
                type="button"
                // biome-ignore lint/a11y/useSemanticElements: tri-state needs aria-checked="mixed"; a native checkbox only exposes it through the indeterminate property
                role="checkbox"
                aria-checked={partiallyChecked ? "mixed" : checked}
                className={[
                  "gm-menu-check-row",
                  checked ? "is-current" : "",
                  partiallyChecked ? "is-partial" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onToggle(node.values)}
              >
                <span
                  className={[
                    "gm-menu-check",
                    checked ? "is-checked" : "",
                    partiallyChecked ? "is-partial" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {checked ? <Check style={CHECK_SIZE} /> : null}
                </span>
                <span className="gm-menu-check-label">{node.label}</span>
              </button>
            </div>
            {hasChildren && !collapsed ? (
              // biome-ignore lint/a11y/useSemanticElements: a fieldset would add a border and legend; this only names the children (a day's "15" needs its month)
              <div id={childrenId} role="group" aria-label={node.label}>
                <DateFilterTree
                  idPrefix={idPrefix}
                  nodes={node.children}
                  selectedValues={selectedValues}
                  onToggle={onToggle}
                  searching={searching}
                  collapsedKeys={collapsedKeys}
                  onToggleCollapsed={onToggleCollapsed}
                  depth={depth + 1}
                />
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
    </>
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
