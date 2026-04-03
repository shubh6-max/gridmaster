import type React from "react";
import type {
  GridCellMeta,
  GridFormatPainterClipboard,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
} from "../types";
import { getSelectionBounds } from "./clipboard";
import { cloneCellMetaMap, createCellMetaKey } from "../utils";

function normalizeFormatMeta(meta?: GridCellMeta): GridCellMeta {
  return {
    backgroundColor: meta?.backgroundColor ?? "",
    wrap: meta?.wrap ?? false,
    className: meta?.className ?? "",
    style: meta?.style ? { ...meta.style } : undefined,
  };
}

function isEmptyStyle(style?: React.CSSProperties): boolean {
  return !style || Object.keys(style).length === 0;
}

export function isEmptyFormatMeta(meta?: GridCellMeta): boolean {
  return (
    !meta?.backgroundColor &&
    !meta?.wrap &&
    !meta?.className &&
    isEmptyStyle(meta?.style)
  );
}

export function copyFormatFromSelection<T extends GridRow>(
  cellMetaMap: Record<string, GridCellMeta>,
  selection: GridSelectionState,
  displayRowIndexes: number[],
  columns: GridResolvedColumnDef<T>[],
  totalDisplayRows: number
): GridFormatPainterClipboard {
  const bounds = getSelectionBounds(selection, totalDisplayRows, columns.length);
  if (!bounds) return null;

  const meta: Record<string, GridCellMeta> = {};

  for (let displayRow = bounds.startRow; displayRow <= bounds.endRow; displayRow++) {
    const sourceRowIndex = displayRowIndexes[displayRow] ?? -1;
    if (sourceRowIndex < 0) continue;

    for (let colIndex = bounds.startCol; colIndex <= bounds.endCol; colIndex++) {
      const column = columns[colIndex];
      if (!column) continue;

      const sourceMeta = cellMetaMap[createCellMetaKey(sourceRowIndex, column.key)];
      meta[createCellMetaKey(displayRow - bounds.startRow, String(colIndex - bounds.startCol))] =
        normalizeFormatMeta(sourceMeta);
    }
  }

  return {
    rows: bounds.endRow - bounds.startRow + 1,
    cols: bounds.endCol - bounds.startCol + 1,
    meta,
  };
}

export function createFormatPainterBounds(
  startRow: number,
  startCol: number,
  painter: GridFormatPainterClipboard,
  totalRows: number,
  totalCols: number
): {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
} | null {
  if (!painter) return null;

  return {
    startRow,
    endRow: Math.min(startRow + painter.rows - 1, Math.max(totalRows - 1, 0)),
    startCol,
    endCol: Math.min(startCol + painter.cols - 1, Math.max(totalCols - 1, 0)),
  };
}

export function applyFormatPainterToBounds<T extends GridRow>(
  cellMetaMap: Record<string, GridCellMeta>,
  painter: GridFormatPainterClipboard,
  targetBounds: {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  },
  displayRowIndexes: number[],
  columns: GridResolvedColumnDef<T>[]
): Record<string, GridCellMeta> {
  if (!painter) return cloneCellMetaMap(cellMetaMap);

  const nextMetaMap = cloneCellMetaMap(cellMetaMap);

  for (let displayRow = targetBounds.startRow; displayRow <= targetBounds.endRow; displayRow++) {
    const sourceRowIndex = displayRowIndexes[displayRow] ?? -1;
    if (sourceRowIndex < 0) continue;

    for (let colIndex = targetBounds.startCol; colIndex <= targetBounds.endCol; colIndex++) {
      const column = columns[colIndex];
      if (!column) continue;

      const patternRow = (displayRow - targetBounds.startRow) % Math.max(painter.rows, 1);
      const patternCol = (colIndex - targetBounds.startCol) % Math.max(painter.cols, 1);
      const formatMeta =
        painter.meta[createCellMetaKey(patternRow, String(patternCol))] ??
        normalizeFormatMeta();
      const targetKey = createCellMetaKey(sourceRowIndex, column.key);
      const currentMeta = nextMetaMap[targetKey] ?? {};

      const nextMeta: GridCellMeta = {
        readonly: currentMeta.readonly,
        error: currentMeta.error,
        backgroundColor: formatMeta.backgroundColor,
        wrap: formatMeta.wrap,
        className: formatMeta.className,
        style: formatMeta.style ? { ...formatMeta.style } : undefined,
      };

      if (isEmptyFormatMeta(nextMeta) && !nextMeta.readonly && !nextMeta.error) {
        delete nextMetaMap[targetKey];
      } else {
        nextMetaMap[targetKey] = nextMeta;
      }
    }
  }

  return nextMetaMap;
}
