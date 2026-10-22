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

// A-105: copy only the format keys actually set on the source cell. Never inject defaults
// (`wrap:false`, `backgroundColor:""`, `className:""`), which would masquerade as real overrides and
// (for wrap) switch off the column's own wrap default on an otherwise-plain target cell.
function pickFormatMeta(meta?: GridCellMeta): GridCellMeta {
  const next: GridCellMeta = {};
  if (!meta) return next;
  if (meta.backgroundColor) next.backgroundColor = meta.backgroundColor;
  if (meta.wrap !== undefined) next.wrap = meta.wrap;
  if (meta.wrapText !== undefined) next.wrapText = meta.wrapText;
  if (meta.horizontalAlign) next.horizontalAlign = meta.horizontalAlign;
  if (meta.verticalAlign) next.verticalAlign = meta.verticalAlign;
  if (meta.textOrientation) next.textOrientation = meta.textOrientation;
  if (meta.indentLevel) next.indentLevel = meta.indentLevel;
  if (meta.className) next.className = meta.className;
  if (meta.style && !isEmptyStyle(meta.style)) next.style = { ...meta.style };
  return next;
}

function isEmptyStyle(style?: React.CSSProperties): boolean {
  return !style || Object.keys(style).length === 0;
}

export function isEmptyFormatMeta(meta?: GridCellMeta): boolean {
  return (
    !meta?.backgroundColor &&
    meta?.wrap === undefined &&
    meta?.wrapText === undefined &&
    !meta?.horizontalAlign &&
    !meta?.verticalAlign &&
    !meta?.textOrientation &&
    !meta?.indentLevel &&
    !meta?.className &&
    isEmptyStyle(meta?.style)
  );
}

export function copyFormatFromSelection<T extends object>(
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
        pickFormatMeta(sourceMeta);
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

export function applyFormatPainterToBounds<T extends object>(
  cellMetaMap: Record<string, GridCellMeta>,
  painter: GridFormatPainterClipboard,
  targetBounds: {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  },
  displayRowIndexes: number[],
  columns: GridResolvedColumnDef<T>[],
  // Props like `enableCellColoring={false}` / `enableWrapText={false}`: keep the target's own value
  // for that facet instead of copying (or clearing) it from the source.
  options?: { keepBackground?: boolean; keepWrap?: boolean }
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
      // Already pick-filtered at copy time: carries only the keys set on the source cell.
      const sourceFormat = painter.meta[createCellMetaKey(patternRow, String(patternCol))] ?? {};
      const targetKey = createCellMetaKey(sourceRowIndex, column.key);
      const currentMeta = nextMetaMap[targetKey] ?? {};

      // Build from scratch, carrying only non-format cell state and the source's present keys, so
      // nothing injects `wrap:false` / empty strings onto the target (A-105).
      const nextMeta: GridCellMeta = {};
      if (currentMeta.readonly !== undefined) nextMeta.readonly = currentMeta.readonly;
      if (currentMeta.error != null) nextMeta.error = currentMeta.error;

      if (options?.keepBackground) {
        if (currentMeta.backgroundColor) nextMeta.backgroundColor = currentMeta.backgroundColor;
      } else if (sourceFormat.backgroundColor) {
        nextMeta.backgroundColor = sourceFormat.backgroundColor;
      }

      if (options?.keepWrap) {
        if (currentMeta.wrap !== undefined) nextMeta.wrap = currentMeta.wrap;
        if (currentMeta.wrapText !== undefined) nextMeta.wrapText = currentMeta.wrapText;
      } else {
        if (sourceFormat.wrap !== undefined) nextMeta.wrap = sourceFormat.wrap;
        if (sourceFormat.wrapText !== undefined) nextMeta.wrapText = sourceFormat.wrapText;
      }

      if (sourceFormat.horizontalAlign) nextMeta.horizontalAlign = sourceFormat.horizontalAlign;
      if (sourceFormat.verticalAlign) nextMeta.verticalAlign = sourceFormat.verticalAlign;
      if (sourceFormat.textOrientation) nextMeta.textOrientation = sourceFormat.textOrientation;
      if (sourceFormat.indentLevel) nextMeta.indentLevel = sourceFormat.indentLevel;
      if (sourceFormat.className) nextMeta.className = sourceFormat.className;
      if (sourceFormat.style && !isEmptyStyle(sourceFormat.style)) {
        nextMeta.style = { ...sourceFormat.style };
      }

      if (isEmptyFormatMeta(nextMeta) && nextMeta.readonly === undefined && nextMeta.error == null) {
        delete nextMetaMap[targetKey];
      } else {
        nextMetaMap[targetKey] = nextMeta;
      }
    }
  }

  return nextMetaMap;
}
