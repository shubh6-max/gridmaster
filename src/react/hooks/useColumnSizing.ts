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

type UseColumnSizingParams<T extends GridRow = GridRow> = {
  columns: GridResolvedColumnDef<T>[];
  rows: T[];
  columnWidths: GridColumnWidths;
  setColumnWidths: React.Dispatch<React.SetStateAction<GridColumnWidths>>;
  onColumnResize?: (event: GridColumnResizeEvent<T>) => void;
};

export function useColumnSizing<T extends GridRow = GridRow>({
  columns,
  rows,
  columnWidths,
  setColumnWidths,
  onColumnResize,
}: UseColumnSizingParams<T>) {
  const [resizeState, setResizeState] = useState<ResizeState>(null);
  const widthRef = useRef(columnWidths);

  useEffect(() => {
    widthRef.current = columnWidths;
  }, [columnWidths]);

  const columnMap = useMemo(
    () => new Map(columns.map((column) => [column.key, column])),
    [columns]
  );

  const startResize = useCallback(
    (column: GridResolvedColumnDef<T>, startX: number) => {
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

    const handleMouseMove = (event: MouseEvent) => {
      resizeTo(event.clientX);
    };

    const handleMouseUp = () => {
      const column = columnMap.get(resizeState.columnKey);
      if (column) {
        onColumnResize?.({
          column,
          width: widthRef.current[resizeState.columnKey] ?? column.width,
        });
      }
      setResizeState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
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

      const next = autoFitColumn(widthRef.current, column, rows);
      widthRef.current = next;
      setColumnWidths(next);
      onColumnResize?.({
        column,
        width: next[column.key] ?? column.width,
      });
    },
    [columnMap, onColumnResize, rows, setColumnWidths]
  );

  const stopResize = useCallback(() => {
    setResizeState(null);
  }, []);

  return {
    autoFit,
    resizeBy,
    resizeState,
    resizeTo,
    startResize,
    stopResize,
  };
}
