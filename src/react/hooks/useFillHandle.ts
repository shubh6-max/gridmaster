import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  applyFillFromSelection,
  clearFillState,
  createFillState,
  getFillBounds,
  type GridFillBounds,
  type GridFillState,
} from "../../core/features/fill";
import {
  getSelectionBounds as getSelectionStateBounds,
  setRangeSelection,
} from "../../core/state/selectionState";
import type { GridResolvedColumnDef, GridRow, GridSelectionState } from "../../core/types";
import { cloneRows, getRowValue, isBlankValue } from "../../core/utils";

type UseFillHandleParams<T extends GridRow = GridRow> = {
  rows: T[];
  displayRows: T[];
  displayRowIndexes: number[];
  columns: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  setSelection: React.Dispatch<React.SetStateAction<GridSelectionState>>;
  fill: GridFillState;
  setFill: React.Dispatch<React.SetStateAction<GridFillState>>;
  updateRows: (rows: T[]) => void;
  enableFillHandle?: boolean;
};

function isSameBounds(left: GridFillBounds, right: GridFillBounds): boolean {
  return (
    left.startRow === right.startRow &&
    left.endRow === right.endRow &&
    left.startCol === right.startCol &&
    left.endCol === right.endCol
  );
}

function isCellInsideBounds(row: number, col: number, bounds: GridFillBounds): boolean {
  return (
    row >= bounds.startRow &&
    row <= bounds.endRow &&
    col >= bounds.startCol &&
    col <= bounds.endCol
  );
}

function resolveAutoFillDownRow<T extends GridRow>(
  displayRows: T[],
  columns: GridResolvedColumnDef<T>[],
  sourceBounds: GridFillBounds
): number {
  const candidateColumns = [sourceBounds.startCol - 1, sourceBounds.endCol + 1, sourceBounds.startCol]
    .filter((value, index, values) => value >= 0 && value < columns.length && values.indexOf(value) === index);

  for (const columnIndex of candidateColumns) {
    let lastRow = sourceBounds.endRow;

    for (let rowIndex = sourceBounds.endRow + 1; rowIndex < displayRows.length; rowIndex++) {
      const row = displayRows[rowIndex];
      if (!row) break;

      if (isBlankValue(getRowValue(row, columns[columnIndex]))) {
        break;
      }

      lastRow = rowIndex;
    }

    if (lastRow > sourceBounds.endRow) {
      return lastRow;
    }
  }

  return Math.max(displayRows.length - 1, sourceBounds.endRow);
}

export function useFillHandle<T extends GridRow = GridRow>({
  rows,
  displayRows,
  displayRowIndexes,
  columns,
  selection,
  setSelection,
  fill,
  setFill,
  updateRows,
  enableFillHandle = true,
}: UseFillHandleParams<T>) {
  const dragSourceRef = useRef<GridFillBounds | null>(null);

  const sourceBounds = useMemo(() => {
    if (!enableFillHandle) return null;
    if (selection.mode !== "cell" && selection.mode !== "range") return null;
    return getSelectionStateBounds(selection);
  }, [enableFillHandle, selection]);

  const commitFill = useCallback(
    (activeSourceBounds: GridFillBounds, dragState: GridFillState) => {
      const result = applyFillFromSelection(displayRows, columns, activeSourceBounds, dragState);
      const affectedBounds = result.affectedBounds;

      setFill(clearFillState());

      if (!affectedBounds || isSameBounds(affectedBounds, activeSourceBounds)) {
        return;
      }

      const nextRows = cloneRows(rows);

      for (let displayRowIndex = affectedBounds.startRow; displayRowIndex <= affectedBounds.endRow; displayRowIndex++) {
        const sourceRowIndex = displayRowIndexes[displayRowIndex] ?? -1;
        if (sourceRowIndex < 0 || sourceRowIndex >= nextRows.length) continue;

        const nextDisplayRow = result.rows[displayRowIndex];
        if (!nextDisplayRow) continue;

        nextRows[sourceRowIndex] = nextDisplayRow;
      }

      updateRows(nextRows);
      setSelection((prev) =>
        setRangeSelection(
          prev,
          { row: affectedBounds.startRow, col: affectedBounds.startCol },
          { row: affectedBounds.endRow, col: affectedBounds.endCol }
        )
      );
    },
    [columns, displayRowIndexes, displayRows, rows, setFill, setSelection, updateRows]
  );

  const onFillHandleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!sourceBounds || !enableFillHandle) return;

      event.preventDefault();
      event.stopPropagation();

      dragSourceRef.current = sourceBounds;
      setFill(
        createFillState(
          { row: sourceBounds.startRow, col: sourceBounds.startCol },
          { row: sourceBounds.endRow, col: sourceBounds.endCol }
        )
      );
    },
    [enableFillHandle, setFill, sourceBounds]
  );

  const onFillHandleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!sourceBounds || !enableFillHandle) return;

      event.preventDefault();
      event.stopPropagation();

      const fillToRow = resolveAutoFillDownRow(displayRows, columns, sourceBounds);
      if (fillToRow <= sourceBounds.endRow) return;

      commitFill(
        sourceBounds,
        createFillState(
          { row: sourceBounds.startRow, col: sourceBounds.startCol },
          { row: fillToRow, col: sourceBounds.endCol }
        )
      );
    },
    [columns, commitFill, displayRows, enableFillHandle, sourceBounds]
  );

  const onCellMouseEnter = useCallback(
    (rowIndex: number, colIndex: number) => {
      const activeSourceBounds = dragSourceRef.current;
      if (!activeSourceBounds) return;

      setFill(
        createFillState(
          { row: activeSourceBounds.startRow, col: activeSourceBounds.startCol },
          {
            row: Math.max(rowIndex, activeSourceBounds.endRow),
            col: Math.max(colIndex, activeSourceBounds.endCol),
          }
        )
      );
    },
    [setFill]
  );

  useEffect(() => {
    const handleMouseUp = () => {
      const activeSourceBounds = dragSourceRef.current;
      dragSourceRef.current = null;

      if (!activeSourceBounds || !fill) {
        setFill(clearFillState());
        return;
      }

      const activeFillBounds = getFillBounds(fill);
      if (!activeFillBounds || isSameBounds(activeFillBounds, activeSourceBounds)) {
        setFill(clearFillState());
        return;
      }

      commitFill(activeSourceBounds, fill);
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [commitFill, fill, setFill]);

  useEffect(() => {
    if (sourceBounds || !dragSourceRef.current) return;

    dragSourceRef.current = null;
    setFill(clearFillState());
  }, [setFill, sourceBounds]);

  const previewBounds = useMemo(() => getFillBounds(fill), [fill]);

  const isFillHandleCell = useCallback(
    (rowIndex: number, colIndex: number) =>
      Boolean(
        sourceBounds &&
          rowIndex === sourceBounds.endRow &&
          colIndex === sourceBounds.endCol
      ),
    [sourceBounds]
  );

  const isPreviewCell = useCallback(
    (rowIndex: number, colIndex: number) =>
      Boolean(
        sourceBounds &&
          previewBounds &&
          !isSameBounds(previewBounds, sourceBounds) &&
          isCellInsideBounds(rowIndex, colIndex, previewBounds) &&
          !isCellInsideBounds(rowIndex, colIndex, sourceBounds)
      ),
    [previewBounds, sourceBounds]
  );

  return {
    sourceBounds,
    previewBounds,
    isFillHandleCell,
    isPreviewCell,
    onFillHandleMouseDown,
    onFillHandleDoubleClick,
    onCellMouseEnter,
  };
}
