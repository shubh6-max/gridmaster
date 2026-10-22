import type {
  GridCellMeta,
  GridColumnDef,
  GridColumnInsertPosition,
  GridResolvedColumnDef,
  GridRow,
  GridRowIdGetter,
  GridRowInsertPosition,
  GridRowMeta,
} from "../types";
import { createEmptyRow } from "./editing";
import { rewriteFormulaReferences, type GridFormulaRewriteEdit } from "./formulas";
import {
  cloneColumns,
  columnLetter,
  createCellMetaKey,
  getRowValue,
  isFormulaValue,
  resolveGridRowId,
  setRowValue,
} from "../utils";

/**
 * A-007: rewrite every formula cell in every row for a structural edit (insert/delete/move row or
 * column). Returns the SAME array when nothing changed, so callers emit no spurious `onRowsChange`.
 * `columns` must be the full column set in A1 order (hidden included); a column whose field is
 * missing or non-formula is skipped. O(rows × columns) in cheap `isFormulaValue` checks, with string
 * work only on actual formula cells.
 * ponytail: full scan, no dependency index — a structural edit is rare and already O(rows); Task 14
 * may add a dependency graph to narrow it.
 */
export function rewriteFormulaCellsInRows<T extends object>(
  rows: T[],
  columns: (GridColumnDef<T> | GridResolvedColumnDef<T>)[],
  edit: GridFormulaRewriteEdit
): T[] {
  let changed = false;
  const next = rows.map((row) => {
    let nextRow = row;
    for (const column of columns) {
      const value = getRowValue(nextRow, column);
      if (!isFormulaValue(value)) continue;
      const rewritten = rewriteFormulaReferences(value, edit);
      if (rewritten !== value) {
        nextRow = setRowValue(nextRow, column, rewritten);
        changed = true;
      }
    }
    return nextRow;
  });
  return changed ? next : rows;
}

function getDefaultCellValue<T extends object>(column: GridColumnDef<T>): unknown {
  switch (column.type) {
    case "checkbox":
      return false;
    case "number":
      return null;
    default:
      return "";
  }
}

/**
 * Next auto id for an inserted row, inferred from the existing `id` fields: all numeric ids give
 * `max + 1`; anything else gives a `row_N` that is not already taken. Returns undefined when rows
 * carry no usable ids (an id is then not invented). A plain loop, not `Math.max(...ids)`, which
 * throws RangeError for ~120k+ rows.
 */
function inferNextRowId<T extends object>(rows: T[]): string | number | undefined {
  let maxNumber = Number.NEGATIVE_INFINITY;
  let allNumeric = true;
  let found = false;
  const taken = new Set<string>();

  for (const row of rows) {
    const id = (row as { id?: unknown }).id;
    if (typeof id === "number" && Number.isFinite(id)) {
      if (id > maxNumber) maxNumber = id;
    } else if (typeof id === "string" && id !== "") {
      allNumeric = false;
    } else {
      continue;
    }
    found = true;
    taken.add(String(id));
  }

  if (!found) return undefined;
  if (allNumeric) return maxNumber + 1;

  let candidate = rows.length + 1;
  while (taken.has(`row_${candidate}`)) candidate += 1;
  return `row_${candidate}`;
}

export function createDefaultInsertedRow<T extends object>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[]
): T {
  const row = createEmptyRow(columns);
  const nextId = inferNextRowId(rows);
  const record = row as Record<string, unknown>;

  // An `id` column's blank default (null / "") must not shadow the generated id, or every inserted
  // row would share it.
  if (nextId !== undefined && (record.id === undefined || record.id === null || record.id === "")) {
    record.id = nextId;
  }

  return row;
}

export function createDefaultInsertedColumn<T extends object>(
  columns: GridColumnDef<T>[],
  insertAt: number,
  referenceColumn: GridColumnDef<T> | null,
  position: GridColumnInsertPosition
): GridColumnDef<T> {
  const existingKeys = new Set(columns.map((column) => column.key));
  const baseKey = referenceColumn?.key ? `${referenceColumn.key}_${position}` : "column";
  let nextKey = baseKey;
  let suffix = 1;

  while (existingKeys.has(nextKey)) {
    nextKey = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  const nextType =
    referenceColumn?.type && referenceColumn.type !== "custom" ? referenceColumn.type : "text";

  return {
    key: nextKey,
    title: `Column ${columnLetter(insertAt)}`,
    type: nextType,
    width: referenceColumn?.width,
    minWidth: referenceColumn?.minWidth,
    maxWidth: referenceColumn?.maxWidth,
    editable: referenceColumn?.editable ?? true,
    readonly: false,
    sortable: referenceColumn?.sortable ?? true,
    filterable: referenceColumn?.filterable ?? true,
    resizable: referenceColumn?.resizable ?? true,
    wrap: referenceColumn?.wrap ?? false,
    align: referenceColumn?.align,
    options: nextType === "select" ? [...(referenceColumn?.options ?? [])] : undefined,
  };
}

export function insertColumnAtIndex<T extends object>(
  columns: GridColumnDef<T>[],
  insertAt: number,
  column: GridColumnDef<T>
): GridColumnDef<T>[] {
  const next = columns.map((current) => ({
    ...current,
    options: current.options ? [...current.options] : current.options,
  }));
  const safeIndex = Math.max(0, Math.min(insertAt, next.length));
  next.splice(safeIndex, 0, {
    ...column,
    options: column.options ? [...column.options] : column.options,
  });
  return next;
}

export function insertColumnValueIntoRows<T extends object>(
  rows: T[],
  column: GridColumnDef<T>
): T[] {
  const defaultValue = getDefaultCellValue(column);

  return rows.map((row) => {
    if (column.key in row) {
      return { ...row };
    }

    return {
      ...row,
      [column.key]: defaultValue,
    };
  });
}

export function deleteColumnAtIndex<T extends object>(
  columns: GridColumnDef<T>[],
  deleteAt: number
): GridColumnDef<T>[] {
  if (deleteAt < 0 || deleteAt >= columns.length) {
    return cloneColumns(columns);
  }

  const next = cloneColumns(columns);
  next.splice(deleteAt, 1);
  return next;
}

/**
 * Removes `columnKey`'s data from every row. The row-id field is never stripped: when removing the
 * key would change any row's id (the `id` field, or whatever `getRowId` reads) the rows are
 * returned untouched, because id-less rows silently collapse to array-index identity. The same
 * array is also returned when no row holds the key, so callers can skip a no-op emit.
 */
export function deleteColumnValueFromRows<T extends object>(
  rows: T[],
  columnKey: string,
  getRowId?: GridRowIdGetter<T>
): T[] {
  if (!rows.some((row) => Object.prototype.hasOwnProperty.call(row, columnKey))) return rows;

  const stripped = rows.map((row) => {
    const { [columnKey]: _deletedValue, ...rest } = row as Record<string, unknown>;
    return rest as T;
  });

  try {
    for (let index = 0; index < rows.length; index++) {
      if (
        resolveGridRowId(stripped[index], index, getRowId) !==
        resolveGridRowId(rows[index], index, getRowId)
      ) {
        return rows;
      }
    }
  } catch {
    // A getRowId that cannot run on the stripped row depends on this field: keep the data.
    return rows;
  }

  return stripped;
}

export function shiftCellMetaForInsertedRow(
  cellMeta: Record<string, GridCellMeta>,
  insertAt: number
): Record<string, GridCellMeta> {
  const next: Record<string, GridCellMeta> = {};

  for (const [key, meta] of Object.entries(cellMeta)) {
    const separatorIndex = key.indexOf("::");
    if (separatorIndex < 0) {
      next[key] = { ...meta };
      continue;
    }

    const rowIndex = Number(key.slice(0, separatorIndex));
    const columnKey = key.slice(separatorIndex + 2);
    const nextRowIndex = rowIndex >= insertAt ? rowIndex + 1 : rowIndex;
    next[createCellMetaKey(nextRowIndex, columnKey)] = { ...meta };
  }

  return next;
}

export function shiftCellMetaForDeletedRow(
  cellMeta: Record<string, GridCellMeta>,
  deleteAt: number
): Record<string, GridCellMeta> {
  const next: Record<string, GridCellMeta> = {};

  for (const [key, meta] of Object.entries(cellMeta)) {
    const separatorIndex = key.indexOf("::");
    if (separatorIndex < 0) {
      next[key] = { ...meta };
      continue;
    }

    const rowIndex = Number(key.slice(0, separatorIndex));
    const columnKey = key.slice(separatorIndex + 2);

    if (rowIndex === deleteAt) continue;

    const nextRowIndex = rowIndex > deleteAt ? rowIndex - 1 : rowIndex;
    next[createCellMetaKey(nextRowIndex, columnKey)] = { ...meta };
  }

  return next;
}

export function deleteCellMetaForColumn(
  cellMeta: Record<string, GridCellMeta>,
  columnKey: string
): Record<string, GridCellMeta> {
  const next: Record<string, GridCellMeta> = {};

  for (const [key, meta] of Object.entries(cellMeta)) {
    const separatorIndex = key.indexOf("::");
    if (separatorIndex < 0) {
      next[key] = { ...meta };
      continue;
    }

    const metaColumnKey = key.slice(separatorIndex + 2);
    if (metaColumnKey === columnKey) continue;
    next[key] = { ...meta };
  }

  return next;
}

export function shiftRowMetaForInsertedRow(
  rowMeta: Record<number, GridRowMeta>,
  insertAt: number
): Record<number, GridRowMeta> {
  const next: Record<number, GridRowMeta> = {};

  for (const [key, meta] of Object.entries(rowMeta)) {
    const rowIndex = Number(key);
    const nextRowIndex = rowIndex >= insertAt ? rowIndex + 1 : rowIndex;
    next[nextRowIndex] = { ...meta };
  }

  return next;
}

export function shiftRowMetaForDeletedRow(
  rowMeta: Record<number, GridRowMeta>,
  deleteAt: number
): Record<number, GridRowMeta> {
  const next: Record<number, GridRowMeta> = {};

  for (const [key, meta] of Object.entries(rowMeta)) {
    const rowIndex = Number(key);
    if (rowIndex === deleteAt) continue;

    const nextRowIndex = rowIndex > deleteAt ? rowIndex - 1 : rowIndex;
    next[nextRowIndex] = { ...meta };
  }

  return next;
}

/** Row index after moving the row at `from` to `to` (splice semantics, as `moveRow` does). */
function movedRowIndex(rowIndex: number, from: number, to: number): number {
  if (rowIndex === from) return to;
  if (from < to && rowIndex > from && rowIndex <= to) return rowIndex - 1;
  if (from > to && rowIndex >= to && rowIndex < from) return rowIndex + 1;
  return rowIndex;
}

/** Cell meta is keyed by row index, so a row move must re-key it (A-038). */
export function shiftCellMetaForMovedRow(
  cellMeta: Record<string, GridCellMeta>,
  from: number,
  to: number
): Record<string, GridCellMeta> {
  const next: Record<string, GridCellMeta> = {};

  for (const [key, meta] of Object.entries(cellMeta)) {
    const separatorIndex = key.indexOf("::");
    if (separatorIndex < 0) {
      next[key] = { ...meta };
      continue;
    }

    const rowIndex = Number(key.slice(0, separatorIndex));
    const columnKey = key.slice(separatorIndex + 2);
    next[createCellMetaKey(movedRowIndex(rowIndex, from, to), columnKey)] = { ...meta };
  }

  return next;
}

export function shiftRowMetaForMovedRow(
  rowMeta: Record<number, GridRowMeta>,
  from: number,
  to: number
): Record<number, GridRowMeta> {
  const next: Record<number, GridRowMeta> = {};

  for (const [key, meta] of Object.entries(rowMeta)) {
    next[movedRowIndex(Number(key), from, to)] = { ...meta };
  }

  return next;
}

export function getInsertRowIndex(
  sourceRowIndex: number,
  rowCount: number,
  position: GridRowInsertPosition
): number {
  if (rowCount <= 0) return 0;
  return position === "below"
    ? Math.max(0, Math.min(sourceRowIndex + 1, rowCount))
    : Math.max(0, Math.min(sourceRowIndex, rowCount));
}

export function getInsertColumnIndex(
  sourceColumnIndex: number,
  columnCount: number,
  position: GridColumnInsertPosition
): number {
  if (columnCount <= 0) return 0;
  return position === "right"
    ? Math.max(0, Math.min(sourceColumnIndex + 1, columnCount))
    : Math.max(0, Math.min(sourceColumnIndex, columnCount));
}
