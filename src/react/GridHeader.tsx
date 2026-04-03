import React from "react";
import { ArrowDownAZ, ArrowUpAZ, ChevronsUpDown, Filter, Snowflake } from "lucide-react";
import { DEFAULT_HEADER_HEIGHT, DEFAULT_ROW_NUMBER_WIDTH, Z_INDEX } from "../core/constants";
import { clearFilter, createValueSetFilter, getFilteredUniqueValuesForColumn } from "../core/features/filtering";
import { isFrozenColumnIndex, toggleFrozenThroughColumn } from "../core/features/freezing";
import { buildColumnOffsets, getColumnWidth } from "../core/features/sizing";
import { columnLetter } from "../core/utils";
import { useGridContext } from "./context/GridContext";
import { useColumnSizing } from "./hooks/useColumnSizing";
import { useSelection } from "./hooks/useSelection";
import { ColumnMenu } from "../menus/ColumnMenu";
import { FilterMenu } from "../menus/FilterMenu";

type ColumnMenuState = {
  columnKey: string;
  anchorEl: HTMLElement | null;
  anchorRect: DOMRect;
  mode: "column" | "visibility";
} | null;

type FilterMenuState = {
  columnKey: string;
  anchorEl: HTMLElement | null;
  anchorRect: DOMRect;
} | null;

const SPREADSHEET_HEADER_HEIGHT = 24;

export function GridHeader() {
  const {
    props,
    rows,
    displayRows,
    columns,
    hiddenColumnKeys,
    visibleColumns,
    selection,
    setSelection,
    columnWidths,
    setColumnWidths,
    frozenColumns,
    setFrozenColumns,
    sort,
    setSort,
    filters,
    setFilters,
    setColumnHidden,
    headerHeight,
    enableSorting,
    enableFiltering,
    enableColumnResize,
    enableColumnAutoFit,
    enableColumnVisibility,
  } = useGridContext();
  const [columnMenu, setColumnMenu] = React.useState<ColumnMenuState>(null);
  const [filterMenu, setFilterMenu] = React.useState<FilterMenuState>(null);

  const { onColumnHeaderClick, onSelectAll } = useSelection({
    rows: displayRows,
    columns: visibleColumns,
    selection,
    setSelection,
    enableRangeSelection: true,
    enableRowSelection: true,
    enableColumnSelection: true,
  });

  const { autoFit, resizeState, startResize } = useColumnSizing({
    columns: visibleColumns,
    rows: displayRows,
    columnWidths,
    setColumnWidths,
    onColumnResize: props.onColumnResize,
  });

  const colOffsets = React.useMemo(
    () => buildColumnOffsets(visibleColumns, columnWidths),
    [visibleColumns, columnWidths]
  );

  const columnMenuColumn = React.useMemo(
    () => (columnMenu ? columns.find((column) => column.key === columnMenu.columnKey) ?? null : null),
    [columnMenu, columns]
  );
  const filterMenuColumn = React.useMemo(
    () => (filterMenu ? columns.find((column) => column.key === filterMenu.columnKey) ?? null : null),
    [filterMenu, columns]
  );

  const filterMenuValues = React.useMemo(
    () =>
      filterMenuColumn
        ? getFilteredUniqueValuesForColumn(rows, columns, filterMenuColumn.key, filters)
        : [],
    [rows, columns, filterMenuColumn, filters]
  );

  const selectedFilterValues = React.useMemo(() => {
    if (!filterMenuColumn) return new Set<string>();

    const currentFilter = filters[filterMenuColumn.key];
    if (currentFilter?.type === "valueSet") {
      return new Set(currentFilter.values);
    }

    return new Set(filterMenuValues);
  }, [filterMenuColumn, filterMenuValues, filters]);

  React.useEffect(() => {
    if (
      columnMenu?.mode === "column" &&
      !visibleColumns.some((column) => column.key === columnMenu.columnKey)
    ) {
      setColumnMenu(null);
    }
  }, [columnMenu, visibleColumns]);

  React.useEffect(() => {
    if (filterMenu && !visibleColumns.some((column) => column.key === filterMenu.columnKey)) {
      setFilterMenu(null);
    }
  }, [filterMenu, visibleColumns]);

  const openColumnMenu = React.useCallback((columnKey: string, trigger: HTMLElement) => {
    const nextAnchor = trigger.getBoundingClientRect();
    setFilterMenu(null);
    setColumnMenu((prev) =>
      prev?.columnKey === columnKey && prev.mode === "column"
        ? null
        : {
            columnKey,
            anchorEl: trigger,
            anchorRect: nextAnchor,
            mode: "column",
          }
    );
  }, []);

  const openVisibilityMenu = React.useCallback((trigger: HTMLElement) => {
    if (!enableColumnVisibility) return;

    const firstVisibleColumn = visibleColumns[0];
    if (!firstVisibleColumn) return;

    setFilterMenu(null);
    setColumnMenu({
      columnKey: firstVisibleColumn.key,
      anchorEl: trigger,
      anchorRect: trigger.getBoundingClientRect(),
      mode: "visibility",
    });
  }, [enableColumnVisibility, visibleColumns]);

  const openFilterMenu = React.useCallback(
    (columnKey: string, anchorEl: HTMLElement | null, anchorRect: DOMRect) => {
    setColumnMenu(null);
    setFilterMenu({
      columnKey,
      anchorEl,
      anchorRect,
    });
    },
    []
  );

  const closeMenus = React.useCallback(() => {
    setColumnMenu(null);
    setFilterMenu(null);
  }, []);

  const columnsForMenu = React.useMemo(
    () =>
      columns.map((column) => ({
        key: column.key,
        title: column.title,
        hidden: column.hidden,
      })),
    [columns]
  );

  const allSelected = selection.mode === "all";
  const hiddenColumnCount = hiddenColumnKeys.size;
  const spreadsheetColumnIndexes = React.useMemo(
    () =>
      Object.fromEntries(columns.map((column, index) => [column.key, index])),
    [columns]
  );

  return (
    <>
      <thead>
        <tr style={{ height: SPREADSHEET_HEADER_HEIGHT }}>
          <th
            className="gm-rh gm-rh-spreadsheet"
            style={{
              width: DEFAULT_ROW_NUMBER_WIDTH,
              minWidth: DEFAULT_ROW_NUMBER_WIDTH,
              maxWidth: DEFAULT_ROW_NUMBER_WIDTH,
              position: "sticky",
              left: 0,
              top: 0,
              zIndex: Z_INDEX.FROZEN_HEADER + 6,
            }}
          >
            <div className="gm-corner-header gm-corner-header-spreadsheet" aria-hidden="true" />
          </th>

          {visibleColumns.map((column, index) => {
            const isFrozen = isFrozenColumnIndex(index, frozenColumns);
            const width = getColumnWidth(column, columnWidths);
            const isSelected = selection.selectedCols.has(index);
            const spreadsheetIndex = spreadsheetColumnIndexes[column.key] ?? index;

            return (
              <th
                key={`${column.key}-spreadsheet`}
                className={[
                  "gm-th",
                  "gm-th-spreadsheet",
                  isSelected ? "gm-th-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={(event) => {
                  onColumnHeaderClick(index, {
                    shiftKey: event.shiftKey,
                    ctrlKey: event.ctrlKey,
                    metaKey: event.metaKey,
                  });
                }}
                style={{
                  width,
                  minWidth: width,
                  maxWidth: width,
                  height: SPREADSHEET_HEADER_HEIGHT,
                  position: "sticky",
                  top: 0,
                  left: isFrozen
                    ? DEFAULT_ROW_NUMBER_WIDTH + (colOffsets[column.key] ?? 0)
                    : undefined,
                  zIndex: isFrozen ? Z_INDEX.FROZEN_HEADER + 2 : Z_INDEX.HEADER + 2,
                  boxShadow:
                    isFrozen && index === frozenColumns - 1
                      ? "3px 0 8px rgba(15, 23, 42, 0.08)"
                      : undefined,
                }}
                title={`Spreadsheet column ${columnLetter(spreadsheetIndex)}`}
              >
                <div className="gm-spreadsheet-header-label">
                  {columnLetter(spreadsheetIndex)}
                </div>
              </th>
            );
          })}
        </tr>

        <tr style={{ height: headerHeight ?? DEFAULT_HEADER_HEIGHT }}>
          <th
            className="gm-rh"
            onClick={onSelectAll}
            style={{
              width: DEFAULT_ROW_NUMBER_WIDTH,
              minWidth: DEFAULT_ROW_NUMBER_WIDTH,
              maxWidth: DEFAULT_ROW_NUMBER_WIDTH,
              position: "sticky",
              left: 0,
              top: SPREADSHEET_HEADER_HEIGHT,
              zIndex: Z_INDEX.FROZEN_HEADER + 5,
              background: allSelected ? "#dbeafe" : "#f8fafc",
              borderRight: "2px solid #cbd5e1",
              borderBottom: "1px solid #cbd5e1",
              textAlign: "center",
              fontSize: 11,
              color: allSelected ? "#1d4ed8" : "#64748b",
              fontWeight: allSelected ? 700 : 500,
              userSelect: "none",
              cursor: "pointer",
            }}
          >
            <div className="gm-corner-header">
              <span>#</span>
              {enableColumnVisibility && hiddenColumnCount > 0 ? (
                <button
                  type="button"
                  className="gm-hidden-columns-trigger"
                  onClick={(event) => {
                    event.stopPropagation();
                    openVisibilityMenu(event.currentTarget);
                  }}
                  title={`Manage ${hiddenColumnCount} hidden column${hiddenColumnCount === 1 ? "" : "s"}`}
                >
                  +{hiddenColumnCount}
                </button>
              ) : null}
            </div>
          </th>

          {visibleColumns.map((column, index) => {
            const isFrozen = isFrozenColumnIndex(index, frozenColumns);
            const width = getColumnWidth(column, columnWidths);
            const isSelected = selection.selectedCols.has(index);
            const isSorted = sort?.columnKey === column.key;
            const sortDirection = isSorted ? sort.direction : null;
            const activeFilter = filters[column.key];
            const isFiltered = Boolean(activeFilter);
            const filterValueCount = activeFilter?.type === "valueSet" ? activeFilter.values.size : null;
            const isMenuOpen =
              columnMenu?.columnKey === column.key || filterMenu?.columnKey === column.key;
            const showResizeHandle = enableColumnResize && column.resizable;

            return (
              <th
                key={column.key}
                className={["gm-th", isSelected ? "gm-th-selected" : ""].filter(Boolean).join(" ")}
                onClick={(event) => {
                  onColumnHeaderClick(index, {
                    shiftKey: event.shiftKey,
                    ctrlKey: event.ctrlKey,
                    metaKey: event.metaKey,
                  });
                }}
                style={{
                  width,
                  minWidth: width,
                  maxWidth: width,
                  height: headerHeight ?? DEFAULT_HEADER_HEIGHT,
                  position: "sticky",
                  top: SPREADSHEET_HEADER_HEIGHT,
                  left: isFrozen ? DEFAULT_ROW_NUMBER_WIDTH + (colOffsets[column.key] ?? 0) : undefined,
                  zIndex: isFrozen ? Z_INDEX.FROZEN_HEADER : Z_INDEX.HEADER,
                  boxShadow:
                    isFrozen && index === frozenColumns - 1
                      ? "3px 0 8px rgba(15, 23, 42, 0.08)"
                      : undefined,
                }}
              >
                <div
                  className="gm-header-inner"
                  style={{
                    paddingRight: showResizeHandle ? 12 : 8,
                  }}
                >
                  <span className="gm-header-label" title={column.title}>
                    {column.title}
                  </span>

                  <div className="gm-header-badges">
                    {isFrozen ? (
                      <span className="gm-header-badge gm-header-badge-frozen" title="Frozen column">
                        <Snowflake style={{ width: 10, height: 10 }} />
                      </span>
                    ) : null}

                    {isFiltered ? (
                      <span
                        className="gm-header-badge gm-header-badge-filter"
                        title={
                          filterValueCount === null
                            ? "Filtered"
                            : `${filterValueCount} values selected`
                        }
                      >
                        <Filter style={{ width: 10, height: 10 }} />
                        <span>{filterValueCount ?? "On"}</span>
                      </span>
                    ) : null}

                    {isSorted ? (
                      <span
                        className="gm-header-badge gm-header-badge-sort"
                        title={sortDirection === "asc" ? "Sorted ascending" : "Sorted descending"}
                      >
                        {sortDirection === "asc" ? (
                          <ArrowUpAZ style={{ width: 11, height: 11 }} />
                        ) : (
                          <ArrowDownAZ style={{ width: 11, height: 11 }} />
                        )}
                        <span>{sortDirection === "asc" ? "A-Z" : "Z-A"}</span>
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className={[
                      "gm-column-trigger",
                      isMenuOpen ? "is-active" : "",
                      isSorted || isFiltered ? "is-emphasized" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={(event) => {
                      event.stopPropagation();
                      openColumnMenu(column.key, event.currentTarget);
                    }}
                    title={`Open column options for ${column.title}`}
                  >
                    <ChevronsUpDown style={{ width: 12, height: 12 }} />
                  </button>

                  {showResizeHandle ? (
                    <div
                      className={[
                        "gm-resize-handle",
                        resizeState?.columnKey === column.key ? "is-resizing" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        startResize(column, event.clientX);
                      }}
                      onDoubleClick={(event) => {
                        if (!enableColumnAutoFit) return;
                        event.preventDefault();
                        event.stopPropagation();
                        autoFit(column.key);
                      }}
                      title={enableColumnAutoFit ? "Drag to resize. Double-click to auto-fit." : "Drag to resize."}
                    />
                  ) : null}
                </div>
              </th>
            );
          })}
        </tr>
      </thead>

      {columnMenu && columnMenuColumn ? (
        <ColumnMenu
          mode={columnMenu.mode}
          anchorEl={columnMenu.anchorEl}
          anchorRect={columnMenu.anchorRect}
          title={columnMenu.mode === "visibility" ? "Manage Columns" : columnMenuColumn.title}
          currentColumnKey={columnMenu.mode === "visibility" ? undefined : columnMenuColumn.key}
          currentVisibleColumnCount={visibleColumns.length}
          showVisibilityControls={enableColumnVisibility}
          columns={columnsForMenu}
          sortDirection={sort?.columnKey === columnMenuColumn.key ? sort.direction : null}
          isFiltered={Boolean(filters[columnMenuColumn.key])}
          isFrozen={isFrozenColumnIndex(
            visibleColumns.findIndex((column) => column.key === columnMenuColumn.key),
            frozenColumns
          )}
          onSortAsc={
            enableSorting && columnMenuColumn.sortable
              ? () =>
                  setSort({
                    columnKey: columnMenuColumn.key,
                    direction: "asc",
                  })
              : undefined
          }
          onSortDesc={
            enableSorting && columnMenuColumn.sortable
              ? () =>
                  setSort({
                    columnKey: columnMenuColumn.key,
                    direction: "desc",
                  })
              : undefined
          }
          onClearSort={
            enableSorting && sort?.columnKey === columnMenuColumn.key ? () => setSort(null) : undefined
          }
          onAutoFit={
            enableColumnAutoFit && columnMenuColumn.resizable
              ? () => autoFit(columnMenuColumn.key)
              : undefined
          }
          onFreezeToggle={() => {
            const columnIndex = visibleColumns.findIndex((column) => column.key === columnMenuColumn.key);
            if (columnIndex < 0) return;

            setFrozenColumns((prev) =>
              toggleFrozenThroughColumn(prev, columnIndex, visibleColumns.length)
            );
          }}
          onOpenFilter={
            enableFiltering && columnMenuColumn.filterable
              ? () => openFilterMenu(columnMenuColumn.key, columnMenu.anchorEl, columnMenu.anchorRect)
              : undefined
          }
          onClearFilter={
            enableFiltering && filters[columnMenuColumn.key]
              ? () => setFilters((prev) => clearFilter(prev, columnMenuColumn.key))
              : undefined
          }
          onHideColumn={
            enableColumnVisibility && visibleColumns.length > 1
              ? () => setColumnHidden(columnMenuColumn.key, true)
              : undefined
          }
          onShowAllColumns={
            enableColumnVisibility
              ? () => {
                  columns.forEach((column) => {
                    setColumnHidden(column.key, false);
                  });
                }
              : undefined
          }
          onToggleColumnVisibility={
            enableColumnVisibility
              ? (columnKey, nextVisible) => {
                  setColumnHidden(columnKey, !nextVisible);
                }
              : undefined
          }
          onClose={() => setColumnMenu(null)}
        />
      ) : null}

      {filterMenu && filterMenuColumn ? (
        <FilterMenu
          anchorEl={filterMenu.anchorEl}
          anchorRect={filterMenu.anchorRect}
          title={filterMenuColumn.title}
          values={filterMenuValues}
          selectedValues={selectedFilterValues}
          onApply={(draftValues) => {
            setFilters((prev) => {
              if (!draftValues.size || draftValues.size >= filterMenuValues.length) {
                return clearFilter(prev, filterMenuColumn.key);
              }

              return {
                ...prev,
                [filterMenuColumn.key]: createValueSetFilter(draftValues),
              };
            });
            setFilterMenu(null);
          }}
          onClear={() => {
            setFilters((prev) => clearFilter(prev, filterMenuColumn.key));
            closeMenus();
          }}
          onClose={() => setFilterMenu(null)}
        />
      ) : null}
    </>
  );
}

export default GridHeader;
