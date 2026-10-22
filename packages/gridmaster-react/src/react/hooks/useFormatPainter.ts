import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyFormatPainterToBounds,
  copyFormatFromSelection,
  createFormatPainterBounds,
} from "../../core/features/formatPainter";
import { historyReducer } from "../../core/state/historyReducer";
import { setActiveCell, setRangeSelection } from "../../core/state/selectionState";
import type {
  GridFormatPainterClipboard,
  GridFormatPainterMode,
  GridHistoryState,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
} from "../../core/types";
import { getSelectionBounds } from "../../core/features/clipboard";

type UseFormatPainterParams<T extends object = GridRow> = {
  history: GridHistoryState<T>;
  setHistory: React.Dispatch<React.SetStateAction<GridHistoryState<T>>>;
  selection: GridSelectionState;
  setSelection: React.Dispatch<React.SetStateAction<GridSelectionState>>;
  displayRows: T[];
  displayRowIndexes: number[];
  visibleColumns: GridResolvedColumnDef<T>[];
  focusViewport: () => void;
  historyLimit?: number;
  preserveRowReferences?: boolean;
  /** False in `mode="readonly"`: the painter cannot be armed or applied. */
  canFormat?: boolean;
  /** `enableCellColoring={false}`: painting keeps each target's own fill. */
  enableCellColoring?: boolean;
  /** `enableWrapText={false}`: painting keeps each target's own wrap. */
  enableWrapText?: boolean;
  /** `enableRangeSelection={false}`: painting never turns the selection into a range. */
  enableRangeSelection?: boolean;
};

function pushCellMetaHistory<T extends object = GridRow>(
  setHistory: React.Dispatch<React.SetStateAction<GridHistoryState<T>>>,
  apply: (state: GridHistoryState<T>) => GridHistoryState<T>
) {
  setHistory((prev) => apply(prev));
}

export function useFormatPainter<T extends object = GridRow>({
  history,
  setHistory,
  selection,
  setSelection,
  displayRows,
  displayRowIndexes,
  visibleColumns,
  focusViewport,
  historyLimit,
  preserveRowReferences,
  canFormat = true,
  enableCellColoring = true,
  enableWrapText = true,
  enableRangeSelection = true,
}: UseFormatPainterParams<T>) {
  const [formatPainterClipboard, setFormatPainterClipboard] =
    useState<GridFormatPainterClipboard>(null);
  const [formatPainterMode, setFormatPainterMode] = useState<GridFormatPainterMode>("idle");

  const isFormatPainterActive = formatPainterMode !== "idle" && Boolean(formatPainterClipboard);

  // F-012: if the host flips editable → readonly (or otherwise disallows formatting) mid-gesture,
  // disarm the painter so it cannot keep painting after the next click. Esc already cancels; this
  // covers the programmatic flip the user never gets a chance to Esc out of.
  useEffect(() => {
    if (!canFormat && formatPainterMode !== "idle") {
      setFormatPainterMode("idle");
    }
  }, [canFormat, formatPainterMode]);

  const copyFormat = useCallback(() => {
    const clipboard = copyFormatFromSelection(
      history.present.cellMeta,
      selection,
      displayRowIndexes,
      visibleColumns,
      displayRows.length
    );

    if (!clipboard) return false;

    setFormatPainterClipboard(clipboard);
    return true;
  }, [displayRowIndexes, displayRows.length, history.present.cellMeta, selection, visibleColumns]);

  const stopFormatPainter = useCallback(() => {
    setFormatPainterMode("idle");
  }, []);

  const startFormatPainter = useCallback(
    (locked = false) => {
      if (!canFormat) return false;

      const copied = copyFormat();
      if (!copied) return false;

      setFormatPainterMode(locked ? "locked" : "single");
      focusViewport();
      return true;
    },
    [canFormat, copyFormat, focusViewport]
  );

  const applyPainterToBounds = useCallback(
    (bounds: { startRow: number; endRow: number; startCol: number; endCol: number }) => {
      if (!formatPainterClipboard || !canFormat) return false;

      pushCellMetaHistory(setHistory, (prev) =>
        historyReducer(
          prev,
          {
            type: "PUSH",
            payload: {
              rows: prev.present.rows,
              columns: prev.present.columns,
              cellMeta: applyFormatPainterToBounds(
                prev.present.cellMeta,
                formatPainterClipboard,
                bounds,
                displayRowIndexes,
                visibleColumns,
                { keepBackground: !enableCellColoring, keepWrap: !enableWrapText }
              ),
              rowMeta: prev.present.rowMeta,
            },
          },
          {
            historyLimit,
            preserveRowReferences,
          }
        )
      );

      if (
        !enableRangeSelection ||
        (bounds.startRow === bounds.endRow && bounds.startCol === bounds.endCol)
      ) {
        setSelection((prev) => setActiveCell(prev, { row: bounds.startRow, col: bounds.startCol }));
      } else {
        setSelection((prev) =>
          setRangeSelection(
            prev,
            { row: bounds.startRow, col: bounds.startCol },
            { row: bounds.endRow, col: bounds.endCol }
          )
        );
      }

      if (formatPainterMode === "single") {
        setFormatPainterMode("idle");
      }

      focusViewport();
      return true;
    },
    [
      canFormat,
      displayRowIndexes,
      enableCellColoring,
      enableRangeSelection,
      enableWrapText,
      focusViewport,
      formatPainterClipboard,
      formatPainterMode,
      historyLimit,
      preserveRowReferences,
      setHistory,
      setSelection,
      visibleColumns,
    ]
  );

  const pasteFormatToSelection = useCallback(() => {
    const bounds = getSelectionBounds(selection, displayRows.length, visibleColumns.length);
    if (!bounds) return false;

    return applyPainterToBounds(bounds);
  }, [applyPainterToBounds, displayRows.length, selection, visibleColumns.length]);

  const paintFormatAtCell = useCallback(
    (displayRowIndex: number, visibleColumnIndex: number) => {
      const bounds = createFormatPainterBounds(
        displayRowIndex,
        visibleColumnIndex,
        formatPainterClipboard,
        displayRows.length,
        visibleColumns.length
      );
      if (!bounds) return false;

      return applyPainterToBounds(bounds);
    },
    [applyPainterToBounds, displayRows.length, formatPainterClipboard, visibleColumns.length]
  );

  return {
    formatPainterClipboard,
    formatPainterMode,
    isFormatPainterActive,
    copyFormat,
    startFormatPainter,
    stopFormatPainter,
    pasteFormatToSelection,
    paintFormatAtCell,
  };
}
