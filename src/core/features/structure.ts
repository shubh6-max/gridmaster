import type {
  GridCellMeta,
  GridColumnDef,
  GridColumnInsertPosition,
  GridResolvedColumnDef,
  GridRow,
  GridRowInsertPosition,
  GridRowMeta,
} from "../types";
import { createEmptyRow } from "./editing";
import { columnLetter, createCellMetaKey } from "../utils";

function getDefaultCellValue<T extends GridRow>(column: GridColumnDef<T>): any {
  switch (column.type) {
    case "checkbox":
      return false;
    case "number":
      return null;
    default:
      return "";
  }
}

function inferNextRowId<T extends GridRow>(rows: T[]): string | number | undefined {
  const ids = rows
    .map((row) => (row as { id?: unknown }).id)
    .filter(
      (value): value is string | number =>
        typeof value === "string" || (typeof value === "number" && Number.isFinite(value))
    );

  if (!ids.length) return undefined;

  if (ids.every((value) => typeof value === "number")) {
    return Math.max(...(ids as number[])) + 1;
  }

  return `row_${rows.length + 1}`;
}

export function createDefaultInsertedRow<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[]
): T {
  const row = createEmptyRow(columns);
  const nextId = inferNextRowId(rows);

  if (nextId !== undefined && !("id" in (row as Record<string, any>))) {
    (row as Record<string, any>).id = nextId;
  }

  return row;
}

export function createDefaultInsertedColumn<T extends GridRow>(
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
    referenceColumn?.type && referenceColumn.type !== "custom"
      ? referenceColumn.type
      : "text";

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

export function insertColumnAtIndex<T extends GridRow>(
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

export function insertColumnValueIntoRows<T extends GridRow>(
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
