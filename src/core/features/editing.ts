import type {
  GridCellChangeEvent,
  GridResolvedColumnDef,
  GridRow,
  GridSnapshot,
} from "../types";
import {
  cloneCellMetaMap,
  cloneRowMetaMap,
  cloneRows,
  createCellMetaKey,
  getRowValue,
  parseCellValue,
  setRowValue,
} from "../utils";

/* =========================================================
   Row helpers
   ========================================================= */

export function updateRowAt<T extends GridRow>(
  rows: T[],
  rowIndex: number,
  nextRow: T
): T[] {
  if (rowIndex < 0 || rowIndex >= rows.length) return rows;
  const next = cloneRows(rows);
  next[rowIndex] = nextRow;
  return next;
}

export function insertRowAt<T extends GridRow>(
  rows: T[],
  rowIndex: number,
  newRow: T
): T[] {
  const next = cloneRows(rows);
  const safeIndex = Math.max(0, Math.min(rowIndex, next.length));
  next.splice(safeIndex, 0, newRow);
  return next;
}

export function appendRow<T extends GridRow>(rows: T[], newRow: T): T[] {
  return [...cloneRows(rows), { ...newRow }];
}

export function deleteRowAt<T extends GridRow>(rows: T[], rowIndex: number): T[] {
  if (rowIndex < 0 || rowIndex >= rows.length) return rows;
  return rows.filter((_, index) => index !== rowIndex).map((row) => ({ ...row }));
}

export function deleteRowsAt<T extends GridRow>(rows: T[], rowIndexes: number[]): T[] {
  if (!rowIndexes.length) return cloneRows(rows);
  const toDelete = new Set(rowIndexes);
  return rows.filter((_, index) => !toDelete.has(index)).map((row) => ({ ...row }));
}

/* =========================================================
   Cell helpers
   ========================================================= */

export function updateCellValue<T extends GridRow>(
  rows: T[],
  rowIndex: number,
  column: GridResolvedColumnDef<T>,
  rawValue: any
): {
  rows: T[];
  previousValue: any;
  value: any;
} {
  if (rowIndex < 0 || rowIndex >= rows.length) {
    return {
      rows,
      previousValue: undefined,
      value: rawValue,
    };
  }

  const currentRow = rows[rowIndex];
  const previousValue = getRowValue(currentRow, column);
  const parsedValue = parseCellValue(rawValue, currentRow, column);
  const nextRow = setRowValue(currentRow, column, parsedValue);
  const nextRows = updateRowAt(rows, rowIndex, nextRow);

  return {
    rows: nextRows,
    previousValue,
    value: parsedValue,
  };
}

export function clearCellValue<T extends GridRow>(
  rows: T[],
  rowIndex: number,
  column: GridResolvedColumnDef<T>
): {
  rows: T[];
  previousValue: any;
} {
  const result = updateCellValue(rows, rowIndex, column, "");
  return {
    rows: result.rows,
    previousValue: result.previousValue,
  };
}

export function updateManyCells<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  updates: Array<{
    rowIndex: number;
    columnKey: string;
    value: any;
  }>
): T[] {
  let nextRows = cloneRows(rows);

  for (const update of updates) {
    const column = columns.find((col) => col.key === update.columnKey);
    if (!column) continue;
    if (column.readonly || !column.editable) continue;

    nextRows = updateCellValue(nextRows, update.rowIndex, column, update.value).rows;
  }

  return nextRows;
}

export function clearCellRange<T extends GridRow>(
  rows: T[],
  columns: GridResolvedColumnDef<T>[],
  bounds: {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  }
): T[] {
  let nextRows = cloneRows(rows);

  for (let rowIndex = bounds.startRow; rowIndex <= bounds.endRow; rowIndex++) {
    for (let colIndex = bounds.startCol; colIndex <= bounds.endCol; colIndex++) {
      const column = columns[colIndex];
      if (!column) continue;
      if (column.readonly || !column.editable) continue;

      nextRows = clearCellValue(nextRows, rowIndex, column).rows;
    }
  }

  return nextRows;
}

/* =========================================================
   Validation helpers
   ========================================================= */

export function validateCell<T extends GridRow>(
  row: T,
  column: GridResolvedColumnDef<T>,
  value: any
): string | null {
  if (!column.validate) return null;
  return column.validate(value, row);
}

export function validateRow<T extends GridRow>(
  row: T,
  columns: GridResolvedColumnDef<T>[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const column of columns) {
    const value = getRowValue(row, column);
    const error = validateCell(row, column, value);
    if (error) {
      errors[column.key] = error;
    }
  }

  return errors;
}

/* =========================================================
   Snapshot editing helpers
   ========================================================= */

export function updateSnapshotCell<T extends GridRow>(
  snapshot: GridSnapshot<T>,
  rowIndex: number,
  column: GridResolvedColumnDef<T>,
  rawValue: any
): {
  snapshot: GridSnapshot<T>;
  event: GridCellChangeEvent<T> | null;
} {
  const currentRows = snapshot.rows as T[];

  if (rowIndex < 0 || rowIndex >= currentRows.length) {
    return { snapshot, event: null };
  }

  if (column.readonly || !column.editable) {
    return { snapshot, event: null };
  }

  const currentRow = currentRows[rowIndex];
  const result = updateCellValue(currentRows, rowIndex, column, rawValue);
  const nextRows = result.rows;
  const nextRow = nextRows[rowIndex];

  const nextSnapshot: GridSnapshot<T> = {
    rows: nextRows,
    columns: snapshot.columns,
    cellMeta: cloneCellMetaMap(snapshot.cellMeta),
    rowMeta: cloneRowMetaMap(snapshot.rowMeta),
  };

  const error = validateCell(nextRow, column, result.value);
  const metaKey = createCellMetaKey(rowIndex, column.key);
  const currentMeta = nextSnapshot.cellMeta[metaKey] ?? {};

  nextSnapshot.cellMeta[metaKey] = {
    ...currentMeta,
    error,
  };

  return {
    snapshot: nextSnapshot,
    event: {
      rowIndex,
      columnIndex: -1,
      columnKey: column.key,
      row: nextRow,
      previousValue: result.previousValue,
      value: result.value,
    },
  };
}

export function clearSnapshotRange<T extends GridRow>(
  snapshot: GridSnapshot<T>,
  columns: GridResolvedColumnDef<T>[],
  bounds: {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  }
): GridSnapshot<T> {
  const nextRows = clearCellRange(snapshot.rows as T[], columns, bounds);

  return {
    rows: nextRows,
    columns: snapshot.columns,
    cellMeta: cloneCellMetaMap(snapshot.cellMeta),
    rowMeta: cloneRowMetaMap(snapshot.rowMeta),
  };
}

/* =========================================================
   Row creation helpers
   ========================================================= */

export function createEmptyRow<T extends GridRow>(
  columns: GridResolvedColumnDef<T>[],
  defaults?: Partial<T>
): T {
  const row: GridRow = { ...(defaults ?? {}) };

  for (const column of columns) {
    if (column.key in row) continue;

    switch (column.type) {
      case "checkbox":
        row[column.key] = false;
        break;
      case "number":
        row[column.key] = null;
        break;
      default:
        row[column.key] = "";
        break;
    }
  }

  return row as T;
}

export function createMultipleEmptyRows<T extends GridRow>(
  count: number,
  columns: GridResolvedColumnDef<T>[],
  defaults?: Partial<T>
): T[] {
  return Array.from({ length: Math.max(0, count) }, () =>
    createEmptyRow(columns, defaults)
  );
}
