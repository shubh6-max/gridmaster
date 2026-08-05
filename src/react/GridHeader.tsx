import React from "react";
import { ArrowDownAZ, ArrowUpAZ, ChevronsUpDown, Filter, Snowflake } from "lucide-react";
import { DEFAULT_HEADER_HEIGHT, DEFAULT_ROW_NUMBER_WIDTH, Z_INDEX } from "../core/constants";
import { clearFilter, createValueSetFilter, getFilteredUniqueValuesForColumn } from "../core/features/filtering";
import type { GridColorOption } from "../core/types";
import { isFrozenColumnIndex, toggleFrozenThroughColumn } from "../core/features/freezing";
import { buildColumnOffsets, getColumnWidth } from "../core/features/sizing";
import { selectSingleColumn } from "../core/state/selectionState";
import { columnLetter } from "../core/utils";
import { useGridContext } from "./context/GridContext";
import { useColumnSizing } from "./hooks/useColumnSizing";
import { useSelection } from "./hooks/useSelection";
import { ColumnMenu } from "../menus/ColumnMenu";

type ColumnMenuState = {
  columnKey: string;
  anchorEl: HTMLElement | null;
  anchorRect: DOMRect;
  mode: "column" | "visibility";
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
    colorFilters,
    setColorFilters,
    colorSort,
    setColorSort,
    setColumnHidden,
    headerHeight,
    enableSorting,
    enableFiltering,
    enableColumnResize,
    enableColumnAutoFit,
    enableColumnVisibility,
    enableInsertColumn,
    enableDeleteColumn,
    openContextMenu,
  } = useGridContext();
  const [columnMenu, setColumnMenu] = React.useState<ColumnMenuState>(null);
  const [resolvedColumnMenuFilterValues, setResolvedColumnMenuFilterValues] = React.useState<string[] | null>(null);
  const [columnMenuFilterLoading, setColumnMenuFilterLoading] = React.useState(false);
  const [resolvedColumnMenuColorOptions, setResolvedColumnMenuColorOptions] =
    React.useState<GridColorOption[] | null>(null);
  const [columnMenuColorLoading, setColumnMenuColorLoading] = React.useState(false);

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
  const columnMenuFilterColumn = React.useMemo(
    () => {
      if (columnMenu?.mode !== "column" || !columnMenuColumn) return null;
      return columnMenuColumn.filterable ? columnMenuColumn : null;
    },
    [columnMenu?.mode, columnMenuColumn]
  );
  const columnMenuColorSourceKey = React.useMemo(
    () => {
      if (
        columnMenu?.mode !== "column" ||
        !columnMenuColumn ||
        !props.resolveColorOptions ||
        (props.isColorMenuEnabled && !props.isColorMenuEnabled(columnMenuColumn.key))
      ) {
        return null;
      }
      const sourceKey = props.getColorSourceColumnKey
        ? props.getColorSourceColumnKey(columnMenuColumn.key)
        : columnMenuColumn.key;
      if (!sourceKey) return null;
      return columnMenuColumn.filterable ? sourceKey : null;
    },
    [
      columnMenu?.mode,
      columnMenuColumn,
      props.getColorSourceColumnKey,
      props.isColorMenuEnabled,
      props.resolveColorOptions,
    ]
  );

  const columnMenuFilterValues = React.useMemo(
    () => {
      if (!columnMenuFilterColumn) return [];
      if (props.resolveFilterValues) return resolvedColumnMenuFilterValues ?? [];
      return (
        columnMenuFilterColumn.filterOptions ??
        getFilteredUniqueValuesForColumn(rows, columns, columnMenuFilterColumn.key, filters)
      );
    },
    [rows, columns, columnMenuFilterColumn, filters, props.resolveFilterValues, resolvedColumnMenuFilterValues]
  );

  const selectedColumnMenuFilterValues = React.useMemo(() => {
    if (!columnMenuFilterColumn) return new Set<string>();

    const currentFilter = filters[columnMenuFilterColumn.key];
    if (currentFilter?.type === "valueSet") {
      return new Set(currentFilter.values);
    }

    return new Set(columnMenuFilterValues);
  }, [columnMenuFilterColumn, columnMenuFilterValues, filters]);
  const selectedColumnMenuColorFilterValues = React.useMemo(
    () => new Set(colorFilters[columnMenuColorSourceKey ?? ""]?.values ?? []),
    [colorFilters, columnMenuColorSourceKey]
  );
  const selectedColumnMenuColorSortValue = React.useMemo(
    () =>
      colorSort && columnMenuColorSourceKey && colorSort.columnKey === columnMenuColorSourceKey
        ? colorSort.value
        : null,
    [colorSort, columnMenuColorSourceKey]
  );

  React.useEffect(() => {
    if (
      columnMenu?.mode === "column" &&
      !visibleColumns.some((column) => column.key === columnMenu.columnKey)
    ) {
      setColumnMenu(null);
    }
  }, [columnMenu, visibleColumns]);

  React.useEffect(() => {
    if (!columnMenuFilterColumn || !props.resolveFilterValues) {
      setResolvedColumnMenuFilterValues(null);
      setColumnMenuFilterLoading(false);
      return;
    }

    let cancelled = false;
    setColumnMenuFilterLoading(true);

    Promise.resolve(props.resolveFilterValues(columnMenuFilterColumn.key, filters))
      .then((values) => {
        if (cancelled) return;
        setResolvedColumnMenuFilterValues(Array.isArray(values) ? values : []);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedColumnMenuFilterValues([]);
      })
      .finally(() => {
        if (cancelled) return;
        setColumnMenuFilterLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [columnMenuFilterColumn, filters, props.resolveFilterValues]);
  React.useEffect(() => {
    if (!columnMenuColorSourceKey || !props.resolveColorOptions) {
      setResolvedColumnMenuColorOptions(null);
      setColumnMenuColorLoading(false);
      return;
    }

    let cancelled = false;
    setColumnMenuColorLoading(true);

    Promise.resolve(props.resolveColorOptions(columnMenuColorSourceKey, filters, colorFilters))
      .then((options) => {
        if (cancelled) return;
        setResolvedColumnMenuColorOptions(Array.isArray(options) ? options : []);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedColumnMenuColorOptions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setColumnMenuColorLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [columnMenuColorSourceKey, colorFilters, filters, props.resolveColorOptions]);

  const openColumnMenu = React.useCallback((columnKey: string, trigger: HTMLElement) => {
    const nextAnchor = trigger.getBoundingClientRect();
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

    setColumnMenu({
      columnKey: firstVisibleColumn.key,
      anchorEl: trigger,
      anchorRect: trigger.getBoundingClientRect(),
      mode: "visibility",
    });
  }, [enableColumnVisibility, visibleColumns]);

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
  const openColumnContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLElement>, columnKey: string, visibleColumnIndex: number) => {
      if (!enableInsertColumn && !enableDeleteColumn) return;

      event.preventDefault();
      event.stopPropagation();
      setSelection((prev) => selectSingleColumn(prev, visibleColumnIndex, displayRows.length));
      openContextMenu({
        kind: "column",
        anchorRect: new DOMRect(event.clientX, event.clientY, 0, 0),
        visibleColumnIndex,
        columnKey,
      });
    },
    [displayRows.length, enableDeleteColumn, enableInsertColumn, openContextMenu, setSelection]
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
                onContextMenu={(event) => openColumnContextMenu(event, column.key, index)}
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
            const colorSourceKeyForColumn = props.getColorSourceColumnKey
              ? props.getColorSourceColumnKey(column.key)
              : column.key;
            const isColorSorted =
              Boolean(colorSourceKeyForColumn) && colorSort?.columnKey === colorSourceKeyForColumn;
            const sortDirection = isSorted ? sort.direction : null;
            const activeFilter = filters[column.key];
            const activeColorFilter = colorSourceKeyForColumn
              ? colorFilters[colorSourceKeyForColumn]
              : undefined;
            const isFiltered = Boolean(activeFilter || activeColorFilter);
            const filterValueCount =
              activeFilter?.type === "valueSet"
                ? activeFilter.values.size + (activeColorFilter?.values.size ?? 0)
                : activeColorFilter?.values.size ?? null;
            const isMenuOpen = columnMenu?.columnKey === column.key;
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
                onContextMenu={(event) => openColumnContextMenu(event, column.key, index)}
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

                    {isSorted || isColorSorted ? (
                      <span
                        className="gm-header-badge gm-header-badge-sort"
                        title={
                          isColorSorted
                            ? "Sorted by color priority"
                            : sortDirection === "asc"
                              ? "Sorted ascending"
                              : "Sorted descending"
                        }
                      >
                        {isColorSorted ? (
                          <span style={{ fontSize: 10, fontWeight: 700 }}>Clr</span>
                        ) : sortDirection === "asc" ? (
                          <ArrowUpAZ style={{ width: 11, height: 11 }} />
                        ) : (
                          <ArrowDownAZ style={{ width: 11, height: 11 }} />
                        )}
                        <span>{isColorSorted ? "Color" : sortDirection === "asc" ? "A-Z" : "Z-A"}</span>
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
          showVisibilityControls={enableColumnVisibility && columnMenu.mode === "visibility"}
          columns={columnsForMenu}
          sortDirection={sort?.columnKey === columnMenuColumn.key ? sort.direction : null}
          isFiltered={Boolean(
            filters[columnMenuColumn.key] ||
              (columnMenuColorSourceKey ? colorFilters[columnMenuColorSourceKey] : null)
          )}
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
          onClearFilter={
            enableFiltering && filters[columnMenuColumn.key]
              ? () => setFilters((prev) => clearFilter(prev, columnMenuColumn.key))
              : undefined
          }
          colorOptions={resolvedColumnMenuColorOptions ?? []}
          colorLoading={columnMenuColorLoading}
          selectedColorFilterValues={selectedColumnMenuColorFilterValues}
          selectedColorSortValue={selectedColumnMenuColorSortValue}
          onApplyColorFilterValues={
            enableFiltering && columnMenuColorSourceKey && props.resolveColorOptions
              ? (draftValues) => {
                  setColorFilters((prev) => {
                    if (!draftValues.size) {
                      const next = { ...prev };
                      delete next[columnMenuColorSourceKey];
                      return next;
                    }

                    return {
                      ...prev,
                      [columnMenuColorSourceKey]: {
                        values: new Set(draftValues),
                      },
                    };
                  });
                }
              : undefined
          }
          onApplyColorSortValue={
            enableSorting && columnMenuColorSourceKey && props.resolveColorOptions
              ? (nextValue) => {
                  if (nextValue === null) {
                    setColorSort((prev) =>
                      prev?.columnKey === columnMenuColorSourceKey ? null : prev
                    );
                    return;
                  }

                  setColorSort({
                    columnKey: columnMenuColorSourceKey,
                    value: nextValue,
                  });
                }
              : undefined
          }
          filterValues={columnMenuFilterValues}
          filterLoading={columnMenuFilterLoading}
          selectedFilterValues={selectedColumnMenuFilterValues}
          filterVisibleValueCount={props.filterMenuVisibleValueCount}
          onApplyFilterValues={
            enableFiltering && columnMenuFilterColumn
              ? (draftValues) => {
                  setFilters((prev) => {
                    if (!draftValues.size || draftValues.size >= columnMenuFilterValues.length) {
                      return clearFilter(prev, columnMenuFilterColumn.key);
                    }

                    return {
                      ...prev,
                      [columnMenuFilterColumn.key]: createValueSetFilter(draftValues),
                    };
                  });
                }
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
    </>
  );
}

export default GridHeader;
