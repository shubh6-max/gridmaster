import React from "react";
import type { GridMasterProps, GridRow } from "../core/types";
import { GridProvider } from "./context/GridContext";
import { useEditing } from "./hooks/useEditing";
import { useGridMaster } from "./hooks/useGridMaster";
import { FormulaBar } from "./FormulaBar";
import { StatusBar } from "./StatusBar";
import { GridViewport } from "./GridViewport";

export function GridMaster<T extends GridRow = GridRow>(props: GridMasterProps<T>) {
  const grid = useGridMaster(props);
  const editing = useEditing({
    mode: grid.mode,
    rows: grid.rows,
    displayRowIndexes: grid.displayRowIndexes,
    visibleColumns: grid.visibleColumns,
    selection: grid.selection,
    editingCell: grid.editingCell,
    setEditingCell: grid.setEditingCell,
    updateRows: grid.updateRows,
    emitCellChange: grid.emitCellChange,
  });

  return (
    <GridProvider
      value={{
        props: grid.props,

        rows: grid.rows,
        displayRows: grid.displayRows,
        displayRowIndexes: grid.displayRowIndexes,
        hiddenColumnKeys: grid.hiddenColumnKeys,

        columns: grid.columns,
        rawColumns: grid.props.columns,
        visibleColumns: grid.visibleColumns,

        history: grid.history,
        selection: grid.selection,
        editingCell: grid.editingCell,
        editingValue: editing.editingValue,
        sort: grid.sort,
        filters: grid.filters,
        clipboard: grid.clipboard,
        fill: grid.fill,
        columnWidths: grid.columnWidths,
        frozenColumns: grid.frozenColumns,

        rowHeight: grid.rowHeight,
        headerHeight: grid.headerHeight,
        height: grid.height,
        width: grid.width,
        mode: grid.mode,

        visibleRowCount: grid.visibleRowCount,

        setRows: grid.setRows,
        updateRows: grid.updateRows,
        emitCellChange: grid.emitCellChange,
        setEditingValue: editing.setEditingValue,
        startEditing: editing.startEditing,
        commitEditing: editing.commitEditing,
        cancelEditing: editing.cancelEditing,

        setHistory: grid.setHistory,
        setSelection: grid.setSelection,
        setEditingCell: grid.setEditingCell,
        setSort: grid.setSort,
        setFilters: grid.setFilters,
        setClipboard: grid.setClipboard,
        setFill: grid.setFill,
        setColumnWidths: grid.setColumnWidths,
        setColumnHidden: grid.setColumnHidden,
        toggleColumnHidden: grid.toggleColumnHidden,
        setFrozenColumns: grid.setFrozenColumns,

        enableSorting: grid.enableSorting,
        enableFiltering: grid.enableFiltering,
        enableColumnResize: grid.enableColumnResize,
        enableColumnAutoFit: grid.enableColumnAutoFit,
        enableColumnVisibility: grid.enableColumnVisibility,
      }}
    >
      <div
        className={["gm-root", props.className].filter(Boolean).join(" ")}
        style={{
          width: grid.width,
          ...props.style,
        }}
      >
        {grid.showFormulaBar && <FormulaBar />}
        <GridViewport />
        {grid.showStatusBar && <StatusBar />}
      </div>
    </GridProvider>
  );
}

export default GridMaster;
