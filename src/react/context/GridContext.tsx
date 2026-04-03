import React, { createContext, useContext } from "react";
import type {
  GridCellChangeEvent,
  GridCellMeta,
  GridColumnDef,
  GridEditCell,
  GridFormatPainterClipboard,
  GridFormatPainterMode,
  GridHistoryState,
  GridMasterProps,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
  GridSort,
  GridFilters,
  GridClipboardData,
} from "../../core/types";
import type { GridColumnWidths } from "../../core/features/sizing";
import type { GridFillState } from "../../core/features/fill";
import type { GridFormulaEvaluator } from "../../core/features/formulas";

export type GridContextValue<T extends GridRow = GridRow> = {
  props: GridMasterProps<T>;

  viewportRef: React.RefObject<HTMLDivElement | null>;
  focusViewport: () => void;

  rows: T[];
  displayRows: T[];
  displayRowIndexes: number[];
  hiddenColumnKeys: Set<string>;

  columns: GridResolvedColumnDef<T>[];
  rawColumns: GridColumnDef<T>[];
  visibleColumns: GridResolvedColumnDef<T>[];
  formulaEvaluator: GridFormulaEvaluator<T>;
  cellMetaMap: Record<string, GridCellMeta>;

  history: GridHistoryState;
  selection: GridSelectionState;
  editingCell: GridEditCell;
  editingOrigin: "cell" | "formulaBar" | null;
  editingValue: unknown;
  isFormulaEditing: boolean;
  sort: GridSort;
  filters: GridFilters;
  clipboard: GridClipboardData;
  formatPainterClipboard: GridFormatPainterClipboard;
  formatPainterMode: GridFormatPainterMode;
  fill: GridFillState;
  columnWidths: GridColumnWidths;
  frozenColumns: number;

  rowHeight: number;
  headerHeight: number;
  height: number | string;
  width: number | string;
  mode: "editable" | "readonly";

  visibleRowCount: number;

  setRows: (rows: T[]) => void;
  updateRows: (rows: T[]) => void;
  emitCellChange?: (event: GridCellChangeEvent<T>) => void;
  setEditingValue: React.Dispatch<React.SetStateAction<unknown>>;
  requestViewportFocusAfterEdit: () => void;
  startEditing: (
    cell?: GridEditCell,
    initialValue?: unknown,
    origin?: "cell" | "formulaBar"
  ) => boolean;
  insertFormulaReference: (displayRowIndex: number, visibleColumnIndex: number) => boolean;
  commitEditing: (nextValue?: unknown) => boolean;
  cancelEditing: () => void;
  copyFormat: () => boolean;
  startFormatPainter: (locked?: boolean) => boolean;
  stopFormatPainter: () => void;
  pasteFormatToSelection: () => boolean;
  paintFormatAtCell: (displayRowIndex: number, visibleColumnIndex: number) => boolean;

  setHistory: React.Dispatch<React.SetStateAction<GridHistoryState>>;
  setSelection: React.Dispatch<React.SetStateAction<GridSelectionState>>;
  setEditingCell: React.Dispatch<React.SetStateAction<GridEditCell>>;
  setSort: React.Dispatch<React.SetStateAction<GridSort>>;
  setFilters: React.Dispatch<React.SetStateAction<GridFilters>>;
  setClipboard: React.Dispatch<React.SetStateAction<GridClipboardData>>;
  setFill: React.Dispatch<React.SetStateAction<GridFillState>>;
  setColumnWidths: React.Dispatch<React.SetStateAction<GridColumnWidths>>;
  setColumnHidden: (columnKey: string, hidden: boolean) => void;
  toggleColumnHidden: (columnKey: string) => void;
  setFrozenColumns: React.Dispatch<React.SetStateAction<number>>;

  enableSorting: boolean;
  enableFiltering: boolean;
  enableFillHandle: boolean;
  enableColumnResize: boolean;
  enableColumnAutoFit: boolean;
  enableColumnVisibility: boolean;
};

const GridContext = createContext<GridContextValue<GridRow> | null>(null);

export function GridProvider<T extends GridRow = GridRow>({
  value,
  children,
}: {
  value: GridContextValue<T>;
  children: React.ReactNode;
}) {
  return (
    <GridContext.Provider value={value as unknown as GridContextValue<GridRow>}>
      {children}
    </GridContext.Provider>
  );
}

export function useGridContext<T extends GridRow = GridRow>(): GridContextValue<T> {
  const context = useContext(GridContext);

  if (!context) {
    throw new Error('useGridContext must be used inside "GridProvider".');
  }

  return context as GridContextValue<T>;
}
