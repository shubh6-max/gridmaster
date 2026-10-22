import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GridColumnResizeEvent, GridResolvedColumnDef, GridRow } from "../../core/types";
import {
  autoFitColumn,
  getResizedWidth,
  resizeColumn,
  type GridColumnWidths,
} from "../../core/features/sizing";

type ResizeState = {
  columnKey: string;
  startX: number;
  startWidth: number;
  minWidth: number;
  maxWidth: number;
} | null;

type UseColumnSizingParams<T extends object = GridRow> = {
  columns: GridResolvedColumnDef<T>[];
  rows: T[];
  columnWidths: GridColumnWidths;
  setColumnWidths: React.Dispatch<React.SetStateAction<GridColumnWidths>>;
  onColumnResize?: (event: GridColumnResizeEvent<T>) => void;
  /** Full resolved columns (hidden included) for the auto-fit formula axis; defaults to `columns`
   * (A-046 follow-up: a visible formula column referencing a hidden column must not fit on `#REF!`). */
  allColumns?: GridResolvedColumnDef<T>[];
};

export function useColumnSizing<T extends object = GridRow>({
  columns,
  rows,
  columnWidths,
  setColumnWidths,
  onColumnResize,
  allColumns,
}: UseColumnSizingParams<T>) {
  const [resizeState, setResizeState] = useState<ResizeState>(null);
  const widthRef = useRef(columnWidths);
  // A-081b: set true once a resize drag actually changes the width, so the synthetic click that
  // follows pointerup is suppressed by the header (consumed there). Cleared when a new drag starts.
  const resizedRef = useRef(false);

  useEffect(() => {
    widthRef.current = columnWidths;
  }, [columnWidths]);

  const columnMap = useMemo(
    () => new Map(columns.map((column) => [column.key, column])),
    [columns]
  );

  const startResize = useCallback(
    (column: GridResolvedColumnDef<T>, startX: number) => {
      resizedRef.current = false;
      setResizeState({
        columnKey: column.key,
        startX,
        startWidth: columnWidths[column.key] ?? column.width,
        minWidth: column.minWidth,
        maxWidth: column.maxWidth ?? Number.MAX_SAFE_INTEGER,
      });
    },
    [columnWidths]
  );

  const resizeTo = useCallback(
    (currentX: number) => {
      if (!resizeState) return;

      const width = getResizedWidth(resizeState, currentX);
      const next = {
        ...widthRef.current,
        [resizeState.columnKey]: width,
      };
      widthRef.current = next;
      setColumnWidths(next);
    },
    [resizeState, setColumnWidths]
  );

  useEffect(() => {
    if (!resizeState) return;

    const handlePointerMove = (event: PointerEvent) => {
      resizeTo(event.clientX);
      // A-081b: any real horizontal travel is a resize, not a click.
      if (event.clientX !== resizeState.startX) resizedRef.current = true;
    };

    const handlePointerEnd = () => {
      const column = columnMap.get(resizeState.columnKey);
      const finalWidth =
        widthRef.current[resizeState.columnKey] ?? column?.width ?? resizeState.startWidth;
      // A-081a: fire once, only when the width actually changed (a press-release emits nothing).
      if (column && finalWidth !== resizeState.startWidth) {
        onColumnResize?.({ column, width: finalWidth });
      }
      setResizeState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [columnMap, onColumnResize, resizeState, resizeTo]);

  const resizeBy = useCallback(
    (column: GridResolvedColumnDef<T>, deltaX: number) => {
      const next = resizeColumn(widthRef.current, column, deltaX);
      widthRef.current = next;
      setColumnWidths(next);
      onColumnResize?.({
        column,
        width: next[column.key] ?? column.width,
      });
    },
    [onColumnResize, setColumnWidths]
  );

  const autoFit = useCallback(
    (columnKey: string) => {
      const column = columnMap.get(columnKey);
      if (!column) return;

      // A-046: pass the FULL column set (hidden included) so cross-column formulas (e.g. `=A1+B1`)
      // auto-fit against their evaluated values instead of `#REF!`, even when a referenced column is
      // hidden from the display order.
      const next = autoFitColumn(widthRef.current, column, rows, {
        columns: allColumns ?? columns,
      });
      widthRef.current = next;
      setColumnWidths(next);
      onColumnResize?.({
        column,
        width: next[column.key] ?? column.width,
      });
    },
    [allColumns, columnMap, columns, onColumnResize, rows, setColumnWidths]
  );

  const stopResize = useCallback(() => {
    setResizeState(null);
  }, []);

  return {
    autoFit,
    resizeBy,
    resizedRef,
    resizeState,
    resizeTo,
    startResize,
    stopResize,
  };
}
