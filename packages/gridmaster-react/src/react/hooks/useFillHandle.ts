import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  applyFillFromSelection,
  clearFillState,
  createFillState,
  getFillBounds,
  type GridFillBounds,
  type GridFillState,
} from "../../core/features/fill";
import { resolveCellReadonly } from "../../core/features/readonly";
import {
  getSelectionBounds as getSelectionStateBounds,
  setRangeSelection,
} from "../../core/state/selectionState";
import type {
  GridCellMeta,
  GridMasterProps,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
} from "../../core/types";
import { cloneRows, getRowValue, isBlankValue } from "../../core/utils";

type UseFillHandleParams<T extends object = GridRow> = {
  rows: T[];
  displayRows: T[];
  displayRowIndexes: number[];
  columns: GridResolvedColumnDef<T>[];
  /** All resolved columns (hidden included); maps a visible column to its absolute index for the
   * formula-reference shift under hidden columns. Defaults to `columns` (identity). */
  allColumns?: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  setSelection: React.Dispatch<React.SetStateAction<GridSelectionState>>;
  fill: GridFillState;
  setFill: React.Dispatch<React.SetStateAction<GridFillState>>;
  updateRows: (rows: T[]) => void;
  /** Resolved `enableFillHandle` (already false in readonly mode / `enableEditing={false}`). */
  enableFillHandle?: boolean;
  /** `enableRangeSelection={false}`: a fill never turns the selection into a range. */
  enableRangeSelection?: boolean;
  /** For per-cell/row `readonly` meta: read-only fill targets are skipped (A-084). */
  props?: Pick<GridMasterProps<T>, "getRowMeta" | "getCellMeta">;
  /** History cell meta merged with `getCellMeta` for the shared read-only predicate (A-084). */
  cellMetaMap?: Record<string, GridCellMeta>;
};

const EMPTY_CELL_META_MAP: Record<string, GridCellMeta> = {};

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
    row >= bounds.startRow && row <= bounds.endRow && col >= bounds.startCol && col <= bounds.endCol
  );
}

function resolveAutoFillDownRow<T extends object>(
  displayRows: T[],
  columns: GridResolvedColumnDef<T>[],
  sourceBounds: GridFillBounds
): number {
  const candidateColumns = [
    sourceBounds.startCol - 1,
    sourceBounds.endCol + 1,
    sourceBounds.startCol,
  ].filter(
    (value, index, values) =>
      value >= 0 && value < columns.length && values.indexOf(value) === index
  );

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

export function useFillHandle<T extends object = GridRow>({
  rows,
  displayRows,
  displayRowIndexes,
  columns,
  allColumns,
  selection,
  setSelection,
  fill,
  setFill,
  updateRows,
  enableFillHandle = true,
  enableRangeSelection = true,
  props,
  cellMetaMap,
}: UseFillHandleParams<T>) {
  const dragSourceRef = useRef<GridFillBounds | null>(null);
  const resolvedProps = props ?? {};
  const resolvedCellMetaMap = cellMetaMap ?? EMPTY_CELL_META_MAP;

  // Visible column index → absolute (all-columns) index, for formula column-reference shifting.
  const absoluteColByKey = useMemo(() => {
    const map = new Map<string, number>();
    (allColumns ?? columns).forEach((column, index) => map.set(column.key, index));
    return map;
  }, [allColumns, columns]);

  const sourceBounds = useMemo(() => {
    if (!enableFillHandle) return null;
    if (selection.mode !== "cell" && selection.mode !== "range") return null;
    return getSelectionStateBounds(selection);
  }, [enableFillHandle, selection]);

  const commitFill = useCallback(
    (activeSourceBounds: GridFillBounds, dragState: GridFillState) => {
      // Values/series stay in DISPLAY order (what the user sees); only formula refs shift in
      // source/absolute space, and read-only targets are skipped (A-084 + fill-under-sort).
      const result = applyFillFromSelection(displayRows, columns, activeSourceBounds, dragState, {
        mapRow: (displayRowIndex) => displayRowIndexes[displayRowIndex] ?? displayRowIndex,
        mapCol: (visibleColumnIndex) => {
          const column = columns[visibleColumnIndex];
          return (column && absoluteColByKey.get(column.key)) ?? visibleColumnIndex;
        },
        isWritable: (displayRowIndex, visibleColumnIndex) => {
          const sourceRowIndex = displayRowIndexes[displayRowIndex] ?? -1;
          return !resolveCellReadonly(
            resolvedProps,
            resolvedCellMetaMap,
            displayRows[displayRowIndex],
            sourceRowIndex,
            columns[visibleColumnIndex]
          );
        },
      });
      const affectedBounds = result.affectedBounds;

      setFill(clearFillState());

      if (!affectedBounds || isSameBounds(affectedBounds, activeSourceBounds)) {
        return;
      }

      const nextRows = cloneRows(rows);

      for (
        let displayRowIndex = affectedBounds.startRow;
        displayRowIndex <= affectedBounds.endRow;
        displayRowIndex++
      ) {
        const sourceRowIndex = displayRowIndexes[displayRowIndex] ?? -1;
        if (sourceRowIndex < 0 || sourceRowIndex >= nextRows.length) continue;

        const nextDisplayRow = result.rows[displayRowIndex];
        if (!nextDisplayRow) continue;

        nextRows[sourceRowIndex] = nextDisplayRow;
      }

      updateRows(nextRows);
      if (enableRangeSelection) {
        setSelection((prev) =>
          setRangeSelection(
            prev,
            { row: affectedBounds.startRow, col: affectedBounds.startCol },
            { row: affectedBounds.endRow, col: affectedBounds.endCol }
          )
        );
      }
    },
    [
      absoluteColByKey,
      columns,
      displayRowIndexes,
      displayRows,
      enableRangeSelection,
      resolvedCellMetaMap,
      resolvedProps,
      rows,
      setFill,
      setSelection,
      updateRows,
    ]
  );

  const onFillHandlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!sourceBounds || !enableFillHandle) return;
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();
      // Pointer capture keeps touch/pen drags alive once the pointer leaves the small handle; guarded
      // for SSR / older browsers (jsdom stubs it in tests/dom/setup.ts).
      event.currentTarget.setPointerCapture?.(event.pointerId);

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

  const onCellPointerEnter = useCallback(
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
    const handlePointerEnd = () => {
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

    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    return () => {
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [commitFill, fill, setFill]);

  useEffect(() => {
    if (sourceBounds || !dragSourceRef.current) return;

    dragSourceRef.current = null;
    setFill(clearFillState());
  }, [setFill, sourceBounds]);

  const previewBounds = useMemo(() => getFillBounds(fill), [fill]);

  const isFillHandleCell = useCallback(
    (rowIndex: number, colIndex: number) =>
      Boolean(sourceBounds && rowIndex === sourceBounds.endRow && colIndex === sourceBounds.endCol),
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
    onFillHandlePointerDown,
    onFillHandleDoubleClick,
    onCellPointerEnter,
  };
}
