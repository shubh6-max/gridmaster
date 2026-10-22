import { useCallback, useMemo } from "react";
import type {
  GridCellChangeEvent,
  GridClipboardData,
  GridClipboardErrorEvent,
  GridClipboardEvent,
  GridClipboardValueMode,
  GridPasteSkipSummary,
  GridPasteSkippedCell,
  GridResolvedColumnDef,
  GridRow,
  GridSelectionState,
} from "../../core/types";
import {
  createClipboardData,
  extractSelectionMatrix,
  getSelectionBounds,
  type GridClipboardBounds,
} from "../../core/features/clipboard";
import type { GridFormulaEvaluator } from "../../core/features/formulas";
import { shiftFormulaReferences } from "../../core/features/formulas";
import { deepEqual } from "../../core/equality";
import {
  cloneRows,
  clipboardToText,
  getRowValue,
  isFormulaValue,
  parseCellValue,
  setRowValue,
  textToClipboardMatrix,
} from "../../core/utils";

type UseClipboardParams<T extends object = GridRow> = {
  rows: T[];
  displayRows: T[];
  displayRowIndexes: number[];
  columns: GridResolvedColumnDef<T>[];
  /**
   * The FULL resolved column list (hidden columns included), used only to map a visible-column index
   * to its absolute index so pasted formula references shift on the all-columns axis the evaluator
   * uses. Defaults to `columns` (identity) when hidden columns cannot occur.
   */
  allColumns?: GridResolvedColumnDef<T>[];
  selection: GridSelectionState;
  clipboard: GridClipboardData;
  setClipboard: React.Dispatch<React.SetStateAction<GridClipboardData>>;
  updateRows: (rows: T[]) => void;
  /** `enableClipboard={false}`: copy, cut and paste do nothing. Defaults to true. */
  enableClipboard?: boolean;
  /**
   * Per-cell/row read-only guard for the write sinks (paste/cut/clear), so cell/row `readonly` meta
   * blocks writes, not just column flags (A-084). Defaults to the column check alone.
   */
  isCellReadonly?: (sourceRowIndex: number, column: GridResolvedColumnDef<T>) => boolean;
  /**
   * Resolved `enableEditing` (already false in `mode="readonly"`). False blocks every VALUE write
   * here (cut, paste, clear); copy is a read and stays available. Defaults to true.
   */
  enableEditing?: boolean;
  /** Per-changed-cell change event, coalesced one per cell (A-058). Shared with the editor sink. */
  emitCellChange?: (event: GridCellChangeEvent<T>) => void;
  /** Needed only for `clipboardValueMode="displayed"` so a formula cell copies its computed result. */
  formulaEvaluator?: GridFormulaEvaluator<T>;
  /** `"raw"` (default) copies stored values; `"displayed"` copies on-screen text (A-064). */
  clipboardValueMode?: GridClipboardValueMode;
  /** BCP-47 locale forwarded to strict paste parsing (A-059). */
  locale?: string;
  onCopy?: (event: GridClipboardEvent<T>) => void;
  onPaste?: (event: GridClipboardEvent<T>) => void;
  onClipboardError?: (event: GridClipboardErrorEvent) => void;
};

type WriteOutcome = "written" | "unchanged" | "unparseable";

type WriteResult = { status: "ok" | "unavailable" | "error"; error?: unknown };

/** Write to the system clipboard, reporting whether it succeeded, is unavailable, or threw (A-057). */
async function writeClipboardTextResult(text: string): Promise<WriteResult> {
  const api = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (!api?.writeText) return { status: "unavailable" };
  try {
    await api.writeText(text);
    return { status: "ok" };
  } catch (error) {
    return { status: "error", error };
  }
}

/** Read the system clipboard. `null` means it could not be read (permission denied / API missing). */
async function readClipboardTextResult(): Promise<{ text: string | null; error?: unknown }> {
  const api = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (!api?.readText) return { text: null };
  try {
    return { text: await api.readText() };
  } catch (error) {
    return { text: null, error };
  }
}

const rangeIndexes = (start: number, endInclusive: number): number[] => {
  const out: number[] = [];
  for (let i = start; i <= endInclusive; i++) out.push(i);
  return out;
};

/**
 * Display-row × column index grid a selection covers, matching `extractSelectionMatrix`'s layout:
 * a row selection spans every column, a column selection spans every display row, everything else is
 * the normalised bounds rectangle.
 */
function selectionGrid<T extends object>(
  selection: GridSelectionState,
  displayRowCount: number,
  columns: GridResolvedColumnDef<T>[],
  bounds: GridClipboardBounds
): { rowIdxs: number[]; colIdxs: number[] } {
  if (selection.mode === "row") {
    return {
      rowIdxs: [...selection.selectedRows].sort((a, b) => a - b),
      colIdxs: columns.map((_, i) => i),
    };
  }
  if (selection.mode === "column") {
    return {
      rowIdxs: rangeIndexes(0, displayRowCount - 1),
      colIdxs: [...selection.selectedCols].sort((a, b) => a - b),
    };
  }
  return {
    rowIdxs: rangeIndexes(bounds.startRow, bounds.endRow),
    colIdxs: rangeIndexes(bounds.startCol, bounds.endCol),
  };
}

/** Visit every cell a selection covers (display row index, source row index, column index, column). */
function forEachSelectionCell<T extends object>(
  selection: GridSelectionState,
  displayRowCount: number,
  columns: GridResolvedColumnDef<T>[],
  displayRowIndexes: number[],
  visit: (
    displayRowIndex: number,
    sourceRowIndex: number,
    columnIndex: number,
    column: GridResolvedColumnDef<T>
  ) => void
): void {
  const bounds = getSelectionBounds(selection, displayRowCount, columns.length);
  if (!bounds) return;
  const { rowIdxs, colIdxs } = selectionGrid(selection, displayRowCount, columns, bounds);
  for (const displayRowIndex of rowIdxs) {
    const sourceRowIndex = displayRowIndexes[displayRowIndex] ?? -1;
    if (sourceRowIndex < 0) continue;
    for (const columnIndex of colIdxs) {
      const column = columns[columnIndex];
      if (!column) continue;
      visit(displayRowIndex, sourceRowIndex, columnIndex, column);
    }
  }
}

/**
 * Copy-on-write cell writer: mutates the single `working` array in place (one array copy for the
 * whole batch — A-056), replacing only the row objects that actually change, and records one
 * `GridCellChangeEvent` per changed cell (A-058). Returns `"unchanged"` when the parsed value equals
 * the current one (identity preserved, no event), and `"unparseable"` when non-blank text fails a
 * strict column parse (value KEPT, never overwritten with `null` — A-059).
 */
function createCellWriter<T extends object>(
  working: T[],
  locale: string | undefined
): {
  events: GridCellChangeEvent<T>[];
  write: (
    sourceRowIndex: number,
    columnIndex: number,
    column: GridResolvedColumnDef<T>,
    rawValue: unknown
  ) => WriteOutcome;
} {
  const events: GridCellChangeEvent<T>[] = [];
  const parseOptions = locale ? { locale } : undefined;

  const write = (
    sourceRowIndex: number,
    columnIndex: number,
    column: GridResolvedColumnDef<T>,
    rawValue: unknown
  ): WriteOutcome => {
    if (sourceRowIndex < 0 || sourceRowIndex >= working.length) return "unchanged";
    const currentRow = working[sourceRowIndex];
    const previousValue = getRowValue(currentRow, column);
    const parsed = parseCellValue(rawValue, currentRow, column, parseOptions);

    // A-059: a non-blank string that a built-in strict parse rejects (→ null) must not clobber the
    // existing value. `parseCellValue` only yields null from the number path; blanks and formulas are
    // handled above it, and a custom `parseValue` owns its own result.
    if (
      parsed === null &&
      !column.parseValue &&
      !isFormulaValue(rawValue) &&
      typeof rawValue === "string" &&
      rawValue.trim() !== ""
    ) {
      return "unparseable";
    }

    if (deepEqual(previousValue, parsed)) return "unchanged";
    working[sourceRowIndex] = setRowValue(currentRow, column, parsed);
    events.push({
      rowIndex: sourceRowIndex,
      columnIndex,
      columnKey: column.key,
      row: working[sourceRowIndex],
      previousValue,
      value: parsed,
    });
    return "written";
  };

  return { events, write };
}

export function useClipboard<T extends object = GridRow>({
  rows,
  displayRows,
  displayRowIndexes,
  columns,
  allColumns,
  selection,
  clipboard,
  setClipboard,
  updateRows,
  enableClipboard = true,
  enableEditing = true,
  isCellReadonly,
  emitCellChange,
  formulaEvaluator,
  clipboardValueMode = "raw",
  locale,
  onCopy,
  onPaste,
  onClipboardError,
}: UseClipboardParams<T>) {
  // Visible-column index → absolute (all-columns) index, for formula column-reference shifting. Hidden
  // columns make these differ; without `allColumns` the two axes are identical (identity map).
  const absoluteColByKey = useMemo(() => {
    const map = new Map<string, number>();
    const source = allColumns ?? columns;
    source.forEach((column, index) => map.set(column.key, index));
    return map;
  }, [allColumns, columns]);

  const absoluteColOf = useCallback(
    (visibleColumnIndex: number): number => {
      const column = columns[visibleColumnIndex];
      if (!column) return visibleColumnIndex;
      return absoluteColByKey.get(column.key) ?? visibleColumnIndex;
    },
    [absoluteColByKey, columns]
  );

  // A-084: a cell is a read-only write target if the injected predicate says so (cell/row meta), or
  // — with no predicate (direct-hook use) — by the column flags alone (the pre-A-084 behaviour).
  const isReadonlyTarget = useCallback(
    (sourceRowIndex: number, column: GridResolvedColumnDef<T>): boolean =>
      isCellReadonly ? isCellReadonly(sourceRowIndex, column) : column.readonly || !column.editable,
    [isCellReadonly]
  );

  // One updateRows call (one history push, one emission) + one onCellChange per changed cell.
  const commit = useCallback(
    (working: T[], events: GridCellChangeEvent<T>[]) => {
      if (!events.length) return;
      updateRows(working);
      for (const event of events) emitCellChange?.(event);
    },
    [emitCellChange, updateRows]
  );

  // Delete / clear and cut's source wipe: blank every editable cell the selection covers, batched.
  const clearSelection = useCallback(() => {
    if (!enableEditing) return;

    const working = rows.slice() as T[];
    const { events, write } = createCellWriter(working, locale);

    forEachSelectionCell(
      selection,
      displayRows.length,
      columns,
      displayRowIndexes,
      (_displayRowIndex, sourceRowIndex, columnIndex, column) => {
        if (isReadonlyTarget(sourceRowIndex, column)) return;
        // Clear writes "" (never a formula), so no reference shifting is needed here.
        write(sourceRowIndex, columnIndex, column, "");
      }
    );

    commit(working, events);
  }, [
    columns,
    commit,
    displayRowIndexes,
    displayRows.length,
    enableEditing,
    isReadonlyTarget,
    locale,
    rows,
    selection,
  ]);

  // Build the copy matrix. "raw" keeps today's exact stringification via extractSelectionMatrix;
  // "displayed" routes every cell through the evaluator so formula cells copy their RESULT (A-064).
  const buildCopyMatrix = useCallback((): {
    data: string[][];
    bounds: GridClipboardBounds | null;
  } => {
    if (clipboardValueMode !== "displayed" || !formulaEvaluator) {
      return extractSelectionMatrix(displayRows, columns, selection);
    }
    const bounds = getSelectionBounds(selection, displayRows.length, columns.length);
    if (!bounds) return { data: [], bounds: null };

    const { rowIdxs, colIdxs } = selectionGrid(selection, displayRows.length, columns, bounds);
    const data = rowIdxs.map((displayRowIndex) => {
      const sourceRowIndex = displayRowIndexes[displayRowIndex] ?? -1;
      return colIdxs.map((columnIndex) => {
        const column = columns[columnIndex];
        if (sourceRowIndex < 0 || !column) return "";
        return formulaEvaluator.getCellDisplayString(sourceRowIndex, column.key);
      });
    });
    return { data, bounds };
  }, [clipboardValueMode, columns, displayRowIndexes, displayRows, formulaEvaluator, selection]);

  const copy = useCallback(
    async (isCut = false) => {
      // Cut is copy + clear: it is a write, so a read-only/non-editable grid ignores it entirely.
      if (!enableClipboard || (isCut && !enableEditing)) return;

      const { data, bounds } = buildCopyMatrix();
      if (!bounds) {
        setClipboard(null);
        return;
      }

      // Remember the copy's top-left in formula address space (A-065): source row + absolute column,
      // so an in-grid paste shifts relative references by a SOURCE/absolute-space delta.
      const sourceOrigin = {
        row: displayRowIndexes[bounds.startRow] ?? bounds.startRow,
        col: absoluteColOf(bounds.startCol),
      };
      const base = createClipboardData(data, bounds, isCut);
      const nextClipboard: GridClipboardData = base ? { ...base, sourceOrigin } : null;
      setClipboard(nextClipboard);

      const writeResult = await writeClipboardTextResult(clipboardToText(nextClipboard));
      if (writeResult.status === "error") {
        onClipboardError?.({ action: isCut ? "cut" : "copy", error: writeResult.error });
        // A-057: a failed cut must NOT clear the source (the data is not safely on the clipboard).
        if (isCut) return;
      }

      // Hand the consumer a defensive deep copy (never the live source array), so mutating the payload
      // cannot corrupt grid state or an undo snapshot (Task 3 stores rows by reference).
      onCopy?.({ selection, rows: cloneRows(rows), isCut });

      // Clear the source only after the write succeeded, or when the API is unavailable and the
      // internal fallback was recorded (setClipboard above). Never on a failed write.
      if (isCut) clearSelection();
    },
    [
      absoluteColOf,
      buildCopyMatrix,
      clearSelection,
      displayRowIndexes,
      enableClipboard,
      enableEditing,
      onClipboardError,
      onCopy,
      rows,
      selection,
      setClipboard,
    ]
  );

  const paste = useCallback(async () => {
    if (!enableClipboard || !enableEditing) return;

    // A-057: prefer the system clipboard whenever it can be read; fall back to the internal copy
    // only when it cannot (permission denied / API missing) — never because the text merely differs.
    const read = await readClipboardTextResult();
    let matrix: string[][];
    // Formula-address-space top-left of the internal copy (source row + absolute column), present only
    // when the pasted data IS that copy. Relative references shift by (dest − this).
    let shiftOrigin: { row: number; col: number } | null = null;
    const originFromClipboard = (): { row: number; col: number } | null =>
      clipboard
        ? (clipboard.sourceOrigin ?? { row: clipboard.origin.startRow, col: clipboard.origin.startCol })
        : null;

    if (read.text !== null && read.text !== "") {
      matrix = textToClipboardMatrix(read.text);
      // Same bytes as the internal copy ⇒ we know its origin ⇒ shift relative formula refs (A-065).
      if (clipboard && clipboardToText(clipboard) === read.text) {
        shiftOrigin = originFromClipboard();
      }
    } else {
      matrix = clipboard?.data ?? [];
      if (clipboard) {
        shiftOrigin = originFromClipboard();
      } else if (read.text === null && read.error !== undefined) {
        // Nothing readable and no internal fallback: surface the failure instead of silence.
        onClipboardError?.({ action: "paste", error: read.error });
      }
    }
    if (!matrix.length || !matrix[0]?.length) return;

    // A-011: anchor at the normalised selection top-left for every selection kind, not the cursor.
    const bounds = getSelectionBounds(selection, displayRows.length, columns.length);
    const anchor = bounds
      ? { row: bounds.startRow, col: bounds.startCol }
      : (selection.cursor ?? selection.anchor);
    if (!anchor) return;

    const isSingleValuePaste = matrix.length === 1 && matrix[0].length === 1;
    const selectionSpansMultipleCells =
      selection.mode === "row" ||
      selection.mode === "column" ||
      selection.mode === "all" ||
      (bounds ? bounds.startRow !== bounds.endRow || bounds.startCol !== bounds.endCol : false);

    const working = rows.slice() as T[];
    const { events, write } = createCellWriter(working, locale);
    let overflow = 0;
    let readonly = 0;
    let unparseable = 0;
    const skippedCells: GridPasteSkippedCell[] = [];

    // A pasted relative formula from an internal copy shifts by (destination − source origin) in
    // SOURCE-row / ABSOLUTE-column space, so a paste under an active sort / filter / hidden column
    // lands correct; external-origin text (no shift origin) is stored verbatim.
    const shift = (raw: string, destSourceRow: number, destVisibleCol: number): string => {
      if (!shiftOrigin || !isFormulaValue(raw)) return raw;
      return shiftFormulaReferences(
        raw,
        destSourceRow - shiftOrigin.row,
        absoluteColOf(destVisibleCol) - shiftOrigin.col
      );
    };

    const account = (outcome: WriteOutcome, sourceRowIndex: number, columnKey: string): void => {
      if (outcome === "unparseable") {
        unparseable++;
        skippedCells.push({ rowIndex: sourceRowIndex, columnKey, reason: "unparseable" });
      }
    };

    if (isSingleValuePaste && selectionSpansMultipleCells) {
      const value = matrix[0][0];
      forEachSelectionCell(
        selection,
        displayRows.length,
        columns,
        displayRowIndexes,
        (_displayRowIndex, sourceRowIndex, columnIndex, column) => {
          if (isReadonlyTarget(sourceRowIndex, column)) {
            readonly++;
            skippedCells.push({ rowIndex: sourceRowIndex, columnKey: column.key, reason: "readonly" });
            return;
          }
          const outcome = write(
            sourceRowIndex,
            columnIndex,
            column,
            shift(value, sourceRowIndex, columnIndex)
          );
          account(outcome, sourceRowIndex, column.key);
        }
      );
    } else {
      for (let rowOffset = 0; rowOffset < matrix.length; rowOffset++) {
        const displayRowIndex = anchor.row + rowOffset;
        const sourceRowIndex = displayRowIndexes[displayRowIndex] ?? -1;
        const rowOutOfBounds = sourceRowIndex < 0 || sourceRowIndex >= working.length;

        for (let columnOffset = 0; columnOffset < matrix[rowOffset].length; columnOffset++) {
          const columnIndex = anchor.col + columnOffset;
          const column = columns[columnIndex];
          if (rowOutOfBounds || !column) {
            overflow++;
            continue;
          }
          if (isReadonlyTarget(sourceRowIndex, column)) {
            readonly++;
            skippedCells.push({ rowIndex: sourceRowIndex, columnKey: column.key, reason: "readonly" });
            continue;
          }
          const outcome = write(
            sourceRowIndex,
            columnIndex,
            column,
            shift(matrix[rowOffset][columnOffset], sourceRowIndex, columnIndex)
          );
          account(outcome, sourceRowIndex, column.key);
        }
      }
    }

    commit(working, events);

    const skipped: GridPasteSkipSummary = {
      total: overflow + readonly + unparseable,
      overflow,
      readonly,
      unparseable,
      cells: skippedCells,
    };
    // Defensive deep copy: `working` is stored in history by reference (Task 3), so the payload the
    // consumer receives must be a distinct clone they cannot mutate into the undo snapshot.
    onPaste?.({ selection, rows: cloneRows(working), applied: events.length, skipped });
  }, [
    absoluteColOf,
    clipboard,
    columns,
    commit,
    displayRowIndexes,
    displayRows.length,
    enableClipboard,
    enableEditing,
    isReadonlyTarget,
    locale,
    onClipboardError,
    onPaste,
    rows,
    selection,
  ]);

  return {
    clearSelection,
    copy,
    cut: () => copy(true),
    paste,
  };
}
