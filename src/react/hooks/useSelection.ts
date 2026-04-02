import { useCallback, useEffect, useRef } from "react";
import type { GridResolvedColumnDef, GridRow, GridSelectionState } from "../../core/types";
import {
  selectColumnRange,
  selectRowRange,
  selectSingleColumn,
  selectSingleRow,
  setActiveCell,
  setRangeSelection,
  toggleColumnSelection,
  toggleRowSelection,
} from "../../core/state/selectionState";

type UseSelectionParams<T extends GridRow = GridRow> = {
  rows: T[];
  columns: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  setSelection: React.Dispatch<React.SetStateAction<GridSelectionState>>;
  enableRangeSelection?: boolean;
  enableRowSelection?: boolean;
  enableColumnSelection?: boolean;
};

type CellMouseDownOptions = {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

export function useSelection<T extends GridRow = GridRow>({
  rows,
  columns,
  selection,
  setSelection,
  enableRangeSelection = true,
  enableRowSelection = true,
  enableColumnSelection = true,
}: UseSelectionParams<T>) {
  const isDraggingRef = useRef(false);

  const totalRows = rows.length;
  const totalCols = columns.length;

  const onCellMouseDown = useCallback(
    (rowIndex: number, colIndex: number, options?: CellMouseDownOptions) => {
      const shiftKey = options?.shiftKey ?? false;

      setSelection((prev) => {
        if (shiftKey && enableRangeSelection && prev.anchor) {
          return setRangeSelection(prev, prev.anchor, { row: rowIndex, col: colIndex });
        }

        return setActiveCell(prev, { row: rowIndex, col: colIndex });
      });

      isDraggingRef.current = true;
    },
    [setSelection, enableRangeSelection]
  );

  const onCellMouseEnter = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!isDraggingRef.current || !enableRangeSelection) return;

      setSelection((prev) => {
        const anchor = prev.anchor ?? { row: rowIndex, col: colIndex };
        return setRangeSelection(prev, anchor, { row: rowIndex, col: colIndex });
      });
    },
    [setSelection, enableRangeSelection]
  );

  const onRowHeaderClick = useCallback(
    (rowIndex: number, options?: CellMouseDownOptions) => {
      if (!enableRowSelection) return;

      const shiftKey = options?.shiftKey ?? false;
      const multiKey = (options?.ctrlKey ?? false) || (options?.metaKey ?? false);

      setSelection((prev) => {
        if (shiftKey && prev.anchor) {
          return selectRowRange(prev, prev.anchor.row, rowIndex, totalCols);
        }

        if (multiKey) {
          return toggleRowSelection(prev, rowIndex, totalCols);
        }

        return selectSingleRow(prev, rowIndex, totalCols);
      });
    },
    [enableRowSelection, setSelection, totalCols]
  );

  const onColumnHeaderClick = useCallback(
    (colIndex: number, options?: CellMouseDownOptions) => {
      if (!enableColumnSelection) return;

      const shiftKey = options?.shiftKey ?? false;
      const multiKey = (options?.ctrlKey ?? false) || (options?.metaKey ?? false);

      setSelection((prev) => {
        if (shiftKey && prev.anchor) {
          return selectColumnRange(prev, prev.anchor.col, colIndex, totalRows);
        }

        if (multiKey) {
          return toggleColumnSelection(prev, colIndex, totalRows);
        }

        return selectSingleColumn(prev, colIndex, totalRows);
      });
    },
    [enableColumnSelection, setSelection, totalRows]
  );

  const onSelectAll = useCallback(() => {
    setSelection({
      mode: "all",
      anchor: { row: 0, col: 0 },
      cursor: { row: Math.max(totalRows - 1, 0), col: Math.max(totalCols - 1, 0) },
      range: {
        start: { row: 0, col: 0 },
        end: { row: Math.max(totalRows - 1, 0), col: Math.max(totalCols - 1, 0) },
      },
      selectedRows: new Set(Array.from({ length: totalRows }, (_, i) => i)),
      selectedCols: new Set(Array.from({ length: totalCols }, (_, i) => i)),
    });
  }, [setSelection, totalRows, totalCols]);

  useEffect(() => {
    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  return {
    onCellMouseDown,
    onCellMouseEnter,
    onRowHeaderClick,
    onColumnHeaderClick,
    onSelectAll,
    isDraggingRef,
  };
}