import { useCallback, useMemo, useState } from "react";
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

type UseFormatPainterParams<T extends GridRow = GridRow> = {
  history: GridHistoryState<T>;
  setHistory: React.Dispatch<React.SetStateAction<GridHistoryState<T>>>;
  selection: GridSelectionState;
  setSelection: React.Dispatch<React.SetStateAction<GridSelectionState>>;
  displayRows: T[];
  displayRowIndexes: number[];
  visibleColumns: GridResolvedColumnDef<T>[];
  focusViewport: () => void;
};

function pushCellMetaHistory<T extends GridRow = GridRow>(
  setHistory: React.Dispatch<React.SetStateAction<GridHistoryState<T>>>,
  apply: (state: GridHistoryState<T>) => GridHistoryState<T>
) {
  setHistory((prev) => apply(prev));
}

export function useFormatPainter<T extends GridRow = GridRow>({
  history,
  setHistory,
  selection,
  setSelection,
  displayRows,
  displayRowIndexes,
  visibleColumns,
  focusViewport,
}: UseFormatPainterParams<T>) {
  const [formatPainterClipboard, setFormatPainterClipboard] =
    useState<GridFormatPainterClipboard>(null);
  const [formatPainterMode, setFormatPainterMode] =
    useState<GridFormatPainterMode>("idle");

  const isFormatPainterActive =
    formatPainterMode !== "idle" && Boolean(formatPainterClipboard);

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
  }, [
    displayRowIndexes,
    displayRows.length,
    history.present.cellMeta,
    selection,
    visibleColumns,
  ]);

  const stopFormatPainter = useCallback(() => {
    setFormatPainterMode("idle");
  }, []);

  const startFormatPainter = useCallback(
    (locked = false) => {
      const copied = copyFormat();
      if (!copied) return false;

      setFormatPainterMode(locked ? "locked" : "single");
      focusViewport();
      return true;
    },
    [copyFormat, focusViewport]
  );

  const applyPainterToBounds = useCallback(
    (bounds: { startRow: number; endRow: number; startCol: number; endCol: number }) => {
      if (!formatPainterClipboard) return false;

      pushCellMetaHistory(setHistory, (prev) =>
        historyReducer(prev, {
          type: "PUSH",
          payload: {
            rows: prev.present.rows,
            columns: prev.present.columns,
            cellMeta: applyFormatPainterToBounds(
              prev.present.cellMeta,
              formatPainterClipboard,
              bounds,
              displayRowIndexes,
              visibleColumns
            ),
            rowMeta: prev.present.rowMeta,
          },
        })
      );

      if (bounds.startRow === bounds.endRow && bounds.startCol === bounds.endCol) {
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
      displayRowIndexes,
      focusViewport,
      formatPainterClipboard,
      formatPainterMode,
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
