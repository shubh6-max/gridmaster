import React, { createContext, useContext } from "react";
import type {
  GridCellChangeEvent,
  GridColumnDef,
  GridEditCell,
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

export type GridContextValue<T extends GridRow = GridRow> = {
  props: GridMasterProps<T>;

  rows: T[];
  displayRows: T[];
  displayRowIndexes: number[];
  hiddenColumnKeys: Set<string>;

  columns: GridResolvedColumnDef<T>[];
  rawColumns: GridColumnDef<T>[];
  visibleColumns: GridResolvedColumnDef<T>[];

  history: GridHistoryState;
  selection: GridSelectionState;
  editingCell: GridEditCell;
  editingValue: unknown;
  sort: GridSort;
  filters: GridFilters;
  clipboard: GridClipboardData;
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
  startEditing: (cell?: GridEditCell, initialValue?: unknown) => boolean;
  commitEditing: (nextValue?: unknown) => boolean;
  cancelEditing: () => void;

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
