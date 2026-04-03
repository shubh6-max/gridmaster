import { useCallback, useMemo } from "react";
import type React from "react";
import { getSelectionBounds } from "../../core/features/clipboard";
import {
  MIXED_FORMAT_VALUE,
  applyCellMetaPatchToBounds,
  applyCellStyleToBounds,
  summarizeSelectionFormatting,
  transformCellMetaInBounds,
  type GridCellMetaPatch,
  type GridSelectionFormattingSummary,
} from "../../core/features/formatting";
import { historyReducer } from "../../core/state/historyReducer";
import type {
  GridCellMeta,
  GridHistoryState,
  GridHorizontalAlign,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
  GridTextOrientation,
  GridVerticalAlign,
} from "../../core/types";

type UseCellFormattingParams<T extends GridRow = GridRow> = {
  history: GridHistoryState<T>;
  setHistory: React.Dispatch<React.SetStateAction<GridHistoryState<T>>>;
  selection: GridSelectionState;
  displayRows: T[];
  displayRowIndexes: number[];
  visibleColumns: GridResolvedColumnDef<T>[];
  focusViewport: () => void;
};

type ApplyCellMetaTransform<T extends GridRow = GridRow> = (
  currentMeta: GridCellMeta,
  context: {
    displayRow: number;
    sourceRowIndex: number;
    colIndex: number;
    column: GridResolvedColumnDef<T>;
  }
) => GridCellMeta;

export function useCellFormatting<T extends GridRow = GridRow>({
  history,
  setHistory,
  selection,
  displayRows,
  displayRowIndexes,
  visibleColumns,
  focusViewport,
}: UseCellFormattingParams<T>) {
  const bounds = useMemo(
    () => getSelectionBounds(selection, displayRows.length, visibleColumns.length),
    [displayRows.length, selection, visibleColumns.length]
  );

  const summary = useMemo<GridSelectionFormattingSummary>(
    () =>
      bounds
        ? summarizeSelectionFormatting(
            history.present.cellMeta,
            bounds,
            displayRowIndexes,
            visibleColumns
          )
        : {
            backgroundColor: undefined,
            wrapText: undefined,
            horizontalAlign: undefined,
            verticalAlign: undefined,
            textOrientation: undefined,
            indentLevel: undefined,
            fontFamily: undefined,
            fontSize: undefined,
            textColor: undefined,
            isBold: undefined,
            isItalic: undefined,
            isUnderline: undefined,
            hasBorder: undefined,
          },
    [bounds, displayRowIndexes, history.present.cellMeta, visibleColumns]
  );

  const pushCellMetaHistory = useCallback(
    (nextCellMeta: Record<string, GridCellMeta>) => {
      setHistory((prev) =>
        historyReducer(prev, {
          type: "PUSH",
          payload: {
            rows: prev.present.rows,
            columns: prev.present.columns,
            cellMeta: nextCellMeta,
            rowMeta: prev.present.rowMeta,
          },
        })
      );

      focusViewport();
      return true;
    },
    [focusViewport, setHistory]
  );

  const applyStyle = useCallback(
    (stylePatch: React.CSSProperties) => {
      if (!bounds) return false;

      return pushCellMetaHistory(
        applyCellStyleToBounds(
          history.present.cellMeta,
          stylePatch,
          bounds,
          displayRowIndexes,
          visibleColumns
        )
      );
    },
    [
      bounds,
      displayRowIndexes,
      history.present.cellMeta,
      pushCellMetaHistory,
      visibleColumns,
    ]
  );

  const applyMetaPatch = useCallback(
    (metaPatch: GridCellMetaPatch) => {
      if (!bounds) return false;

      return pushCellMetaHistory(
        applyCellMetaPatchToBounds(
          history.present.cellMeta,
          metaPatch,
          bounds,
          displayRowIndexes,
          visibleColumns
        )
      );
    },
    [
      bounds,
      displayRowIndexes,
      history.present.cellMeta,
      pushCellMetaHistory,
      visibleColumns,
    ]
  );

  const applyMetaTransform = useCallback(
    (transform: ApplyCellMetaTransform<T>) => {
      if (!bounds) return false;

      return pushCellMetaHistory(
        transformCellMetaInBounds(
          history.present.cellMeta,
          transform,
          bounds,
          displayRowIndexes,
          visibleColumns
        )
      );
    },
    [
      bounds,
      displayRowIndexes,
      history.present.cellMeta,
      pushCellMetaHistory,
      visibleColumns,
    ]
  );

  const wrapEnabled = summary.wrapText === true;
  const boldEnabled = summary.isBold === true;
  const italicEnabled = summary.isItalic === true;
  const underlineEnabled = summary.isUnderline === true;
  const borderEnabled = summary.hasBorder === true;
  const canDecreaseIndent =
    summary.indentLevel === MIXED_FORMAT_VALUE ||
    (typeof summary.indentLevel === "number" && summary.indentLevel > 0);

  return {
    summary,
    mixedValue: MIXED_FORMAT_VALUE,
    hasSelection: Boolean(bounds),
    canDecreaseIndent,
    applyStyle,
    applyMetaPatch,
    setFontFamily: (fontFamily: string) =>
      applyStyle({
        fontFamily,
      }),
    setFontSize: (fontSize: number) =>
      applyStyle({
        fontSize,
      }),
    applyFillColor: (color: string) =>
      applyMetaPatch({
        backgroundColor: color,
      }),
    applyTextColor: (color: string) =>
      applyStyle({
        color,
      }),
    toggleBold: () =>
      applyStyle({
        fontWeight: boldEnabled ? "" : 700,
      }),
    toggleItalic: () =>
      applyStyle({
        fontStyle: italicEnabled ? "" : "italic",
      }),
    toggleUnderline: () =>
      applyStyle({
        textDecoration: underlineEnabled ? "" : "underline",
      }),
    toggleBorder: () =>
      applyStyle({
        border: borderEnabled ? "" : "1px solid #475569",
      }),
    setHorizontalAlign: (horizontalAlign: GridHorizontalAlign) =>
      applyMetaPatch({
        horizontalAlign,
      }),
    setVerticalAlign: (verticalAlign: GridVerticalAlign) =>
      applyMetaPatch({
        verticalAlign,
      }),
    toggleWrapText: () =>
      applyMetaPatch({
        wrap: !wrapEnabled,
        wrapText: !wrapEnabled,
      }),
    setTextOrientation: (textOrientation: GridTextOrientation) =>
      applyMetaPatch({
        textOrientation,
      }),
    increaseIndent: () =>
      applyMetaTransform((currentMeta) => ({
        ...currentMeta,
        indentLevel: Math.max(0, (currentMeta.indentLevel ?? 0) + 1),
      })),
    decreaseIndent: () =>
      applyMetaTransform((currentMeta) => ({
        ...currentMeta,
        indentLevel: Math.max(0, (currentMeta.indentLevel ?? 0) - 1),
      })),
  };
}
