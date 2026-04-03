import type React from "react";
import type {
  GridCellMeta,
  GridHorizontalAlign,
  GridResolvedColumnDef,
  GridRow,
  GridTextOrientation,
  GridVerticalAlign,
} from "../types";
import { cloneCellMetaMap, createCellMetaKey } from "../utils";

export const MIXED_FORMAT_VALUE = "__mixed__" as const;

export type GridMixedFormatValue = typeof MIXED_FORMAT_VALUE;

export type GridSelectionFormattingValue<T> = T | GridMixedFormatValue | undefined;

export type GridCellMetaPatch = Partial<
  Pick<
    GridCellMeta,
    | "backgroundColor"
    | "wrap"
    | "wrapText"
    | "horizontalAlign"
    | "verticalAlign"
    | "textOrientation"
    | "indentLevel"
    | "className"
  >
> & {
  style?: React.CSSProperties;
};

export type GridSelectionFormattingSummary = {
  backgroundColor: GridSelectionFormattingValue<string>;
  wrapText: GridSelectionFormattingValue<boolean>;
  horizontalAlign: GridSelectionFormattingValue<GridHorizontalAlign>;
  verticalAlign: GridSelectionFormattingValue<GridVerticalAlign>;
  textOrientation: GridSelectionFormattingValue<GridTextOrientation>;
  indentLevel: GridSelectionFormattingValue<number>;
  fontFamily: GridSelectionFormattingValue<string>;
  fontSize: GridSelectionFormattingValue<number>;
  textColor: GridSelectionFormattingValue<string>;
  isBold: GridSelectionFormattingValue<boolean>;
  isItalic: GridSelectionFormattingValue<boolean>;
  isUnderline: GridSelectionFormattingValue<boolean>;
  hasBorder: GridSelectionFormattingValue<boolean>;
};

type GridDisplayBounds = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

type GridCellFormatterContext<T extends GridRow = GridRow> = {
  displayRow: number;
  sourceRowIndex: number;
  colIndex: number;
  column: GridResolvedColumnDef<T>;
};

function isEmptyStyle(style?: React.CSSProperties): boolean {
  return !style || Object.keys(style).length === 0;
}

function mergeStylePatch(
  currentStyle: React.CSSProperties | undefined,
  stylePatch: React.CSSProperties
): React.CSSProperties | undefined {
  const nextStyle: React.CSSProperties = {
    ...(currentStyle ?? {}),
  };

  for (const [key, value] of Object.entries(stylePatch)) {
    if (value === undefined || value === null || value === "") {
      delete nextStyle[key as keyof React.CSSProperties];
      continue;
    }

    nextStyle[key as keyof React.CSSProperties] = value as never;
  }

  return isEmptyStyle(nextStyle) ? undefined : nextStyle;
}

function cleanupCellMeta(meta: GridCellMeta): GridCellMeta | null {
  const nextMeta: GridCellMeta = {
    ...meta,
    style: meta.style && !isEmptyStyle(meta.style) ? { ...meta.style } : undefined,
  };

  if (!nextMeta.style || isEmptyStyle(nextMeta.style)) delete nextMeta.style;
  if (!nextMeta.backgroundColor) delete nextMeta.backgroundColor;
  if (nextMeta.wrap === undefined) delete nextMeta.wrap;
  if (nextMeta.wrapText === undefined) delete nextMeta.wrapText;
  if (!nextMeta.horizontalAlign) delete nextMeta.horizontalAlign;
  if (!nextMeta.verticalAlign) delete nextMeta.verticalAlign;
  if (!nextMeta.textOrientation) delete nextMeta.textOrientation;
  if (!nextMeta.indentLevel) delete nextMeta.indentLevel;
  if (!nextMeta.className) delete nextMeta.className;
  if (!nextMeta.readonly) delete nextMeta.readonly;
  if (nextMeta.error == null) delete nextMeta.error;

  return Object.keys(nextMeta).length === 0 ? null : nextMeta;
}

function hasPatchKey(metaPatch: GridCellMetaPatch, key: keyof GridCellMetaPatch): boolean {
  return Object.prototype.hasOwnProperty.call(metaPatch, key);
}

function updateSelectionSummary<T>(
  current: GridSelectionFormattingValue<T>,
  nextValue: T | undefined
): GridSelectionFormattingValue<T> {
  if (current === MIXED_FORMAT_VALUE) return current;
  if (current === undefined) return nextValue;
  if (Object.is(current, nextValue)) return current;
  return MIXED_FORMAT_VALUE;
}

export function getEffectiveWrapText<T extends GridRow>(
  meta: GridCellMeta | undefined,
  column: GridResolvedColumnDef<T>
): boolean {
  if (meta?.wrapText !== undefined) return meta.wrapText;
  if (meta?.wrap !== undefined) return meta.wrap;
  return Boolean(column.wrap);
}

export function getEffectiveHorizontalAlign<T extends GridRow>(
  meta: GridCellMeta | undefined,
  column: GridResolvedColumnDef<T>
): GridHorizontalAlign {
  return meta?.horizontalAlign ?? column.align ?? "left";
}

export function getEffectiveVerticalAlign(meta: GridCellMeta | undefined): GridVerticalAlign {
  return meta?.verticalAlign ?? "middle";
}

export function getEffectiveTextOrientation(
  meta: GridCellMeta | undefined
): GridTextOrientation {
  return meta?.textOrientation ?? "horizontal";
}

export function getEffectiveIndentLevel(meta: GridCellMeta | undefined): number {
  return Math.max(0, meta?.indentLevel ?? 0);
}

export function getSelectionCellMeta<T extends GridRow>(
  cellMetaMap: Record<string, GridCellMeta>,
  displayRowIndexes: number[],
  columns: GridResolvedColumnDef<T>[],
  displayRow: number,
  colIndex: number
): GridCellMeta | undefined {
  const sourceRowIndex = displayRowIndexes[displayRow];
  const column = columns[colIndex];
  if (sourceRowIndex == null || !column) return undefined;
  return cellMetaMap[createCellMetaKey(sourceRowIndex, column.key)];
}

export function applyCellStyleToBounds<T extends GridRow>(
  cellMetaMap: Record<string, GridCellMeta>,
  stylePatch: React.CSSProperties,
  bounds: GridDisplayBounds,
  displayRowIndexes: number[],
  columns: GridResolvedColumnDef<T>[]
): Record<string, GridCellMeta> {
  return applyCellMetaPatchToBounds(
    cellMetaMap,
    {
      style: stylePatch,
    },
    bounds,
    displayRowIndexes,
    columns
  );
}

export function applyCellMetaPatchToBounds<T extends GridRow>(
  cellMetaMap: Record<string, GridCellMeta>,
  metaPatch: GridCellMetaPatch,
  bounds: GridDisplayBounds,
  displayRowIndexes: number[],
  columns: GridResolvedColumnDef<T>[]
): Record<string, GridCellMeta> {
  return transformCellMetaInBounds(
    cellMetaMap,
    (currentMeta) => {
      const nextMeta: GridCellMeta = {
        ...currentMeta,
        style: metaPatch.style
          ? mergeStylePatch(currentMeta.style, metaPatch.style)
          : currentMeta.style
          ? { ...currentMeta.style }
          : undefined,
      };

      if (hasPatchKey(metaPatch, "backgroundColor")) {
        nextMeta.backgroundColor = metaPatch.backgroundColor;
      }

      if (hasPatchKey(metaPatch, "wrap")) {
        nextMeta.wrap = metaPatch.wrap;
      }

      if (hasPatchKey(metaPatch, "wrapText")) {
        nextMeta.wrapText = metaPatch.wrapText;
      }

      if (hasPatchKey(metaPatch, "horizontalAlign")) {
        nextMeta.horizontalAlign = metaPatch.horizontalAlign;
      }

      if (hasPatchKey(metaPatch, "verticalAlign")) {
        nextMeta.verticalAlign = metaPatch.verticalAlign;
      }

      if (hasPatchKey(metaPatch, "textOrientation")) {
        nextMeta.textOrientation = metaPatch.textOrientation;
      }

      if (hasPatchKey(metaPatch, "indentLevel")) {
        nextMeta.indentLevel =
          metaPatch.indentLevel == null ? undefined : Math.max(0, metaPatch.indentLevel);
      }

      if (hasPatchKey(metaPatch, "className")) {
        nextMeta.className = metaPatch.className;
      }

      return nextMeta;
    },
    bounds,
    displayRowIndexes,
    columns
  );
}

export function transformCellMetaInBounds<T extends GridRow>(
  cellMetaMap: Record<string, GridCellMeta>,
  transform: (
    currentMeta: GridCellMeta,
    context: GridCellFormatterContext<T>
  ) => GridCellMeta,
  bounds: GridDisplayBounds,
  displayRowIndexes: number[],
  columns: GridResolvedColumnDef<T>[]
): Record<string, GridCellMeta> {
  const nextMetaMap = cloneCellMetaMap(cellMetaMap);

  for (let displayRow = bounds.startRow; displayRow <= bounds.endRow; displayRow++) {
    const sourceRowIndex = displayRowIndexes[displayRow] ?? -1;
    if (sourceRowIndex < 0) continue;

    for (let colIndex = bounds.startCol; colIndex <= bounds.endCol; colIndex++) {
      const column = columns[colIndex];
      if (!column) continue;

      const metaKey = createCellMetaKey(sourceRowIndex, column.key);
      const currentMeta = nextMetaMap[metaKey] ?? {};
      const cleanedMeta = cleanupCellMeta(
        transform(
          {
            ...currentMeta,
            style: currentMeta.style ? { ...currentMeta.style } : undefined,
          },
          {
            displayRow,
            sourceRowIndex,
            colIndex,
            column,
          }
        )
      );

      if (!cleanedMeta) {
        delete nextMetaMap[metaKey];
      } else {
        nextMetaMap[metaKey] = cleanedMeta;
      }
    }
  }

  return nextMetaMap;
}

export function summarizeSelectionFormatting<T extends GridRow>(
  cellMetaMap: Record<string, GridCellMeta>,
  bounds: GridDisplayBounds,
  displayRowIndexes: number[],
  columns: GridResolvedColumnDef<T>[]
): GridSelectionFormattingSummary {
  let backgroundColor: GridSelectionFormattingValue<string>;
  let wrapText: GridSelectionFormattingValue<boolean>;
  let horizontalAlign: GridSelectionFormattingValue<GridHorizontalAlign>;
  let verticalAlign: GridSelectionFormattingValue<GridVerticalAlign>;
  let textOrientation: GridSelectionFormattingValue<GridTextOrientation>;
  let indentLevel: GridSelectionFormattingValue<number>;
  let fontFamily: GridSelectionFormattingValue<string>;
  let fontSize: GridSelectionFormattingValue<number>;
  let textColor: GridSelectionFormattingValue<string>;
  let isBold: GridSelectionFormattingValue<boolean>;
  let isItalic: GridSelectionFormattingValue<boolean>;
  let isUnderline: GridSelectionFormattingValue<boolean>;
  let hasBorder: GridSelectionFormattingValue<boolean>;

  for (let displayRow = bounds.startRow; displayRow <= bounds.endRow; displayRow++) {
    const sourceRowIndex = displayRowIndexes[displayRow] ?? -1;
    if (sourceRowIndex < 0) continue;

    for (let colIndex = bounds.startCol; colIndex <= bounds.endCol; colIndex++) {
      const column = columns[colIndex];
      if (!column) continue;

      const meta = cellMetaMap[createCellMetaKey(sourceRowIndex, column.key)];
      const style = meta?.style ?? {};
      const fontWeight = style.fontWeight;
      const borderValue =
        typeof style.border === "string" && style.border.trim()
          ? style.border
          : typeof style.borderTop === "string" && style.borderTop.trim()
          ? style.borderTop
          : typeof style.borderBottom === "string" && style.borderBottom.trim()
          ? style.borderBottom
          : undefined;
      const fontSizeValue =
        typeof style.fontSize === "number"
          ? style.fontSize
          : typeof style.fontSize === "string" && style.fontSize.trim()
          ? Number.parseInt(style.fontSize, 10) || undefined
          : undefined;

      backgroundColor = updateSelectionSummary(backgroundColor, meta?.backgroundColor || undefined);
      wrapText = updateSelectionSummary(wrapText, getEffectiveWrapText(meta, column));
      horizontalAlign = updateSelectionSummary(
        horizontalAlign,
        getEffectiveHorizontalAlign(meta, column)
      );
      verticalAlign = updateSelectionSummary(verticalAlign, getEffectiveVerticalAlign(meta));
      textOrientation = updateSelectionSummary(
        textOrientation,
        getEffectiveTextOrientation(meta)
      );
      indentLevel = updateSelectionSummary(indentLevel, getEffectiveIndentLevel(meta));
      fontFamily = updateSelectionSummary(
        fontFamily,
        typeof style.fontFamily === "string" && style.fontFamily.trim()
          ? style.fontFamily
          : undefined
      );
      fontSize = updateSelectionSummary(fontSize, fontSizeValue);
      textColor = updateSelectionSummary(
        textColor,
        typeof style.color === "string" && style.color.trim() ? style.color : undefined
      );
      isBold = updateSelectionSummary(
        isBold,
        fontWeight === 700 ||
          fontWeight === "700" ||
          String(fontWeight ?? "").toLowerCase() === "bold"
      );
      isItalic = updateSelectionSummary(
        isItalic,
        String(style.fontStyle ?? "").toLowerCase() === "italic"
      );
      isUnderline = updateSelectionSummary(
        isUnderline,
        String(style.textDecoration ?? "").toLowerCase().includes("underline")
      );
      hasBorder = updateSelectionSummary(hasBorder, Boolean(borderValue));
    }
  }

  return {
    backgroundColor,
    wrapText,
    horizontalAlign,
    verticalAlign,
    textOrientation,
    indentLevel,
    fontFamily,
    fontSize,
    textColor,
    isBold,
    isItalic,
    isUnderline,
    hasBorder,
  };
}
