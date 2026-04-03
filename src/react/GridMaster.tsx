import React from "react";
import type { GridMasterProps, GridRow } from "../core/types";
import { GridProvider } from "./context/GridContext";
import { useEditing } from "./hooks/useEditing";
import { useFormatPainter } from "./hooks/useFormatPainter";
import { useGridMaster } from "./hooks/useGridMaster";
import { FormulaBar } from "./FormulaBar";
import { StatusBar } from "./StatusBar";
import { GridToolbar } from "./GridToolbar";
import { GridViewport } from "./GridViewport";

export function GridMaster<T extends GridRow = GridRow>(props: GridMasterProps<T>) {
  const grid = useGridMaster(props);
  const editing = useEditing({
    mode: grid.mode,
    rows: grid.rows,
    columns: grid.columns,
    displayRowIndexes: grid.displayRowIndexes,
    visibleColumns: grid.visibleColumns,
    selection: grid.selection,
    editingCell: grid.editingCell,
    setEditingCell: grid.setEditingCell,
    updateRows: grid.updateRows,
    focusViewport: grid.focusViewport,
    emitCellChange: grid.emitCellChange,
  });
  const formatPainter = useFormatPainter({
    history: grid.history,
    setHistory: grid.setHistory,
    selection: grid.selection,
    setSelection: grid.setSelection,
    displayRows: grid.displayRows,
    displayRowIndexes: grid.displayRowIndexes,
    visibleColumns: grid.visibleColumns,
    focusViewport: grid.focusViewport,
  });

  return (
    <GridProvider
      value={{
        props: grid.props,

        viewportRef: grid.viewportRef,
        focusViewport: grid.focusViewport,

        rows: grid.rows,
        displayRows: grid.displayRows,
        displayRowIndexes: grid.displayRowIndexes,
        hiddenColumnKeys: grid.hiddenColumnKeys,

        columns: grid.columns,
        rawColumns: grid.props.columns,
        visibleColumns: grid.visibleColumns,
        formulaEvaluator: grid.formulaEvaluator,
        cellMetaMap: grid.history.present.cellMeta,

        history: grid.history,
        selection: grid.selection,
        editingCell: grid.editingCell,
        editingOrigin: editing.editingOrigin,
        editingValue: editing.editingValue,
        isFormulaEditing: editing.isFormulaEditing,
        sort: grid.sort,
        filters: grid.filters,
        clipboard: grid.clipboard,
        formatPainterClipboard: formatPainter.formatPainterClipboard,
        formatPainterMode: formatPainter.formatPainterMode,
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
        requestViewportFocusAfterEdit: editing.requestViewportFocusAfterEdit,
        startEditing: editing.startEditing,
        insertFormulaReference: editing.insertFormulaReference,
        commitEditing: editing.commitEditing,
        cancelEditing: editing.cancelEditing,
        copyFormat: formatPainter.copyFormat,
        startFormatPainter: formatPainter.startFormatPainter,
        stopFormatPainter: formatPainter.stopFormatPainter,
        pasteFormatToSelection: formatPainter.pasteFormatToSelection,
        paintFormatAtCell: formatPainter.paintFormatAtCell,

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
        enableFillHandle: grid.enableFillHandle,
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
        <GridToolbar />
        {grid.showFormulaBar && <FormulaBar />}
        <GridViewport />
        {grid.showStatusBar && <StatusBar />}
      </div>
    </GridProvider>
  );
}

export default GridMaster;
