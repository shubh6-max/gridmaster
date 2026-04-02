import { useCallback } from "react";
import type {
  GridClipboardData,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
} from "../../core/types";
import {
  createClipboardData,
  extractSelectionMatrix,
  getSelectionBounds,
  readClipboardText,
  writeClipboardText,
} from "../../core/features/clipboard";
import { updateCellValue } from "../../core/features/editing";
import { textToClipboardMatrix } from "../../core/utils";

type UseClipboardParams<T extends GridRow = GridRow> = {
  rows: T[];
  displayRows: T[];
  displayRowIndexes: number[];
  columns: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  clipboard: GridClipboardData;
  setClipboard: React.Dispatch<React.SetStateAction<GridClipboardData>>;
  updateRows: (rows: T[]) => void;
};

export function useClipboard<T extends GridRow = GridRow>({
  rows,
  displayRows,
  displayRowIndexes,
  columns,
  selection,
  clipboard,
  setClipboard,
  updateRows,
}: UseClipboardParams<T>) {
  const clearSelection = useCallback(() => {
    let workingRows = rows.map((row) => ({ ...row })) as T[];
    let changed = false;

    const clearCell = (displayRowIndex: number, columnIndex: number) => {
      const sourceRowIndex = displayRowIndexes[displayRowIndex] ?? -1;
      if (sourceRowIndex < 0 || sourceRowIndex >= workingRows.length) return;

      const column = columns[columnIndex];
      if (!column || column.readonly || !column.editable) return;

      workingRows = updateCellValue(workingRows, sourceRowIndex, column, "").rows;
      changed = true;
    };

    if (selection.mode === "row") {
      [...selection.selectedRows]
        .sort((left, right) => left - right)
        .forEach((displayRowIndex) => {
          for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
            clearCell(displayRowIndex, columnIndex);
          }
        });
    } else if (selection.mode === "column") {
      [...selection.selectedCols]
        .sort((left, right) => left - right)
        .forEach((columnIndex) => {
          for (let displayRowIndex = 0; displayRowIndex < displayRows.length; displayRowIndex++) {
            clearCell(displayRowIndex, columnIndex);
          }
        });
    } else {
      const bounds = getSelectionBounds(selection, displayRows.length, columns.length);
      if (!bounds) return;

      for (let displayRowIndex = bounds.startRow; displayRowIndex <= bounds.endRow; displayRowIndex++) {
        for (let columnIndex = bounds.startCol; columnIndex <= bounds.endCol; columnIndex++) {
          clearCell(displayRowIndex, columnIndex);
        }
      }
    }

    if (changed) updateRows(workingRows);
  }, [columns, displayRowIndexes, displayRows.length, rows, selection, updateRows]);

  const copy = useCallback(
    async (isCut = false) => {
      const { data, bounds } = extractSelectionMatrix(displayRows, columns, selection);

      if (!bounds) {
        setClipboard(null);
        return;
      }

      const nextClipboard = createClipboardData(data, bounds, isCut);
      setClipboard(nextClipboard);
      await writeClipboardText(data.map((row) => row.join("\t")).join("\n"));

      if (isCut) clearSelection();
    },
    [clearSelection, columns, displayRows, selection, setClipboard]
  );

  const paste = useCallback(async () => {
    const cursor = selection.cursor ?? selection.anchor;
    if (!cursor) return;

    const text = await readClipboardText();
    const matrix = text ? textToClipboardMatrix(text) : clipboard?.data ?? [];
    if (!matrix.length || !matrix[0]?.length) return;

    let workingRows = rows.map((row) => ({ ...row })) as T[];
    let changed = false;

    for (let rowOffset = 0; rowOffset < matrix.length; rowOffset++) {
      const displayRowIndex = cursor.row + rowOffset;
      const sourceRowIndex = displayRowIndexes[displayRowIndex] ?? -1;
      if (sourceRowIndex < 0 || sourceRowIndex >= workingRows.length) break;

      for (let columnOffset = 0; columnOffset < matrix[rowOffset].length; columnOffset++) {
        const columnIndex = cursor.col + columnOffset;
        if (columnIndex >= columns.length) break;

        const column = columns[columnIndex];
        if (!column || column.readonly || !column.editable) continue;

        workingRows = updateCellValue(
          workingRows,
          sourceRowIndex,
          column,
          matrix[rowOffset][columnOffset]
        ).rows;
        changed = true;
      }
    }

    if (changed) updateRows(workingRows);
  }, [clipboard, columns, displayRowIndexes, rows, selection.anchor, selection.cursor, updateRows]);

  return {
    clearSelection,
    copy,
    cut: () => copy(true),
    paste,
  };
}
