import type {
  GridClipboardData,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
} from "../types";
import { EMPTY_CLIPBOARD } from "../constants";
import {
  clipboardToText,
  getRowValue,
  normalizeRange,
  setRowValue,
  textToClipboardMatrix,
} from "../utils";
import { hasColumnSelection, hasRowSelection } from "../state/selectionState";

/* =========================================================
   Types
   ========================================================= */

export type GridClipboardBounds = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

export type GridCopyResult = {
  clipboard: GridClipboardData;
  text: string;
};

export type GridPasteResult<T extends GridRow = GridRow> = {
  rows: T[];
  affectedBounds: GridClipboardBounds | null;
};

/* =========================================================
   Clipboard creators
   ========================================================= */

export function clearClipboard(): GridClipboardData {
  return EMPTY_CLIPBOARD;
}

export function createClipboardData(
  data: string[][],
  origin: GridClipboardBounds,
  isCut = false
): GridClipboardData {
  return {
    data,
    isCut,
    origin: {
      startRow: origin.startRow,
      endRow: origin.endRow,
      startCol: origin.startCol,
      endCol: origin.endCol,
    },
  };
}

/* =========================================================
   Selection extraction
   ========================================================= */

export function getSelectionBounds(
  selection: GridSelectionState,
  totalRows: number,
  totalCols: number
): GridClipboardBounds | null {
  if (selection.mode === "all") {
    return {
      startRow: 0,
      endRow: Math.max(totalRows - 1, 0),
      startCol: 0,
      endCol: Math.max(totalCols - 1, 0),
    };
  }

  if (hasRowSelection(selection)) {
    const rows = [...selection.selectedRows].sort((a, b) => a - b);
    if (!rows.length) return null;

    return {
      startRow: rows[0],
      endRow: rows[rows.length - 1],
      startCol: 0,
      endCol: Math.max(totalCols - 1, 0),
    };
  }

  if (hasColumnSelection(selection)) {
    const cols = [...selection.selectedCols].sort((a, b) => a - b);
    if (!cols.length) return null;

    return {
      startRow: 0,
      endRow: Math.max(totalRows - 1, 0),
      startCol: cols[0],
      endCol: cols[cols.length - 1],
    };
  }

  if (!selection.range) return null;

  const normalized = normalizeRange(selection.range);
  return {
    startRow: normalized.startRow,
    endRow: normalized.endRow,
    startCol: normalized.startCol,
    endCol: normalized.endCol,
  };
}

/* =========================================================
   Copy helpers
   ========================================================= */

export function extractSelectionMatrix<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  selection: GridSelectionState
): { data: string[][]; bounds: GridClipboardBounds | null } {
  const bounds = getSelectionBounds(selection, rows.length, columns.length);
  if (!bounds) {
    return { data: [], bounds: null };
  }

  const data: string[][] = [];

  if (hasRowSelection(selection)) {
    const selectedRows = [...selection.selectedRows].sort((a, b) => a - b);

    for (const rowIndex of selectedRows) {
      const row = rows[rowIndex];
      if (!row) continue;

      data.push(
        columns.map((column) => {
          const value = getRowValue(row, column);
          if (value === null || value === undefined) return "";
          return String(value);
        })
      );
    }

    return { data, bounds };
  }

  if (hasColumnSelection(selection)) {
    const selectedCols = [...selection.selectedCols].sort((a, b) => a - b);

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row) continue;

      data.push(
        selectedCols.map((colIndex) => {
          const column = columns[colIndex];
          if (!column) return "";
          const value = getRowValue(row, column);
          if (value === null || value === undefined) return "";
          return String(value);
        })
      );
    }

    return { data, bounds };
  }

  for (let rowIndex = bounds.startRow; rowIndex <= bounds.endRow; rowIndex++) {
    const row = rows[rowIndex];
    if (!row) continue;

    const line: string[] = [];

    for (let colIndex = bounds.startCol; colIndex <= bounds.endCol; colIndex++) {
      const column = columns[colIndex];
      if (!column) {
        line.push("");
        continue;
      }

      const value = getRowValue(row, column);
      line.push(value === null || value === undefined ? "" : String(value));
    }

    data.push(line);
  }

  return { data, bounds };
}

export function copySelection<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  selection: GridSelectionState,
  isCut = false
): GridCopyResult {
  const { data, bounds } = extractSelectionMatrix(rows, columns, selection);

  if (!bounds) {
    return {
      clipboard: EMPTY_CLIPBOARD,
      text: "",
    };
  }

  const clipboard = createClipboardData(data, bounds, isCut);

  return {
    clipboard,
    text: clipboardToText(clipboard),
  };
}

/* =========================================================
   Paste helpers
   ========================================================= */

export async function readClipboardText(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}

export async function writeClipboardText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // no-op
  }
}

export function getPasteMatrix(
  text?: string,
  clipboard?: GridClipboardData | null
): string[][] {
  if (text && text.trim() !== "") {
    return textToClipboardMatrix(text);
  }

  return clipboard?.data ?? [];
}

export function pasteMatrixAt<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  startRow: number,
  startCol: number,
  matrix: string[][]
): GridPasteResult<T> {
  if (!matrix.length || !matrix[0]?.length) {
    return {
      rows,
      affectedBounds: null,
    };
  }

  const nextRows = rows.map((row) => ({ ...row })) as T[];

  let endRow = startRow;
  let endCol = startCol;

  for (let r = 0; r < matrix.length; r++) {
    const rowIndex = startRow + r;
    if (rowIndex >= nextRows.length) break;

    for (let c = 0; c < matrix[r].length; c++) {
      const colIndex = startCol + c;
      if (colIndex >= columns.length) break;

      const column = columns[colIndex];
      if (!column || column.readonly || !column.editable) continue;

      nextRows[rowIndex] = setRowValue(nextRows[rowIndex], column, matrix[r][c]);
      endRow = Math.max(endRow, rowIndex);
      endCol = Math.max(endCol, colIndex);
    }
  }

  return {
    rows: nextRows,
    affectedBounds: {
      startRow,
      endRow,
      startCol,
      endCol,
    },
  };
}

export async function pasteFromClipboard<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  startRow: number,
  startCol: number,
  internalClipboard?: GridClipboardData | null
): Promise<GridPasteResult<T>> {
  const text = await readClipboardText();
  const matrix = getPasteMatrix(text, internalClipboard);
  return pasteMatrixAt(rows, columns, startRow, startCol, matrix);
}

/* =========================================================
   Cut helpers
   ========================================================= */

export function clearCutSelection<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  clipboard: GridClipboardData
): T[] {
  if (!clipboard?.isCut) return rows;

  const nextRows = rows.map((row) => ({ ...row })) as T[];
  const { startRow, endRow, startCol, endCol } = clipboard.origin;

  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
    if (rowIndex >= nextRows.length) break;

    for (let colIndex = startCol; colIndex <= endCol; colIndex++) {
      if (colIndex >= columns.length) break;

      const column = columns[colIndex];
      if (!column || column.readonly || !column.editable) continue;

      nextRows[rowIndex] = setRowValue(nextRows[rowIndex], column, "");
    }
  }

  return nextRows;
}