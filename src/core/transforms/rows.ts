import type { GridColumnDef, GridResolvedColumnDef, GridRow } from "../types";
import { getRowValue, setRowValue } from "../utils";

type GridColumnInput<T extends GridRow> = GridColumnDef<T> | GridResolvedColumnDef<T>;

export function rowsToMatrix<T extends GridRow>(
  rows: T[],
  columns: GridColumnInput<T>[]
): string[][] {
  return rows.map((row) =>
    columns.map((column) => {
      const value = getRowValue(row, column);
      return value == null ? "" : String(value);
    })
  );
}

export function matrixToRows<T extends GridRow>(
  matrix: string[][],
  columns: GridColumnInput<T>[],
  baseRows?: T[]
): T[] {
  return matrix.map((line, rowIndex) => {
    let row = { ...(baseRows?.[rowIndex] ?? {}) } as T;

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      const column = columns[columnIndex];
      row = setRowValue(row, column, line[columnIndex] ?? "");
    }

    return row;
  });
}
