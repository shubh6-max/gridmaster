import type {
  GridCellCoord,
  GridCellMeta,
  GridClipboardData,
  GridColumnDef,
  GridResolvedColumnDef,
  GridRow,
  GridRowMeta,
  GridSelectionRange,
} from "./types";
import {
  DEFAULT_CELL_META,
  DEFAULT_COLUMN_ALIGN,
  DEFAULT_COLUMN_TYPE,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_MAX_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
} from "./constants";

/* =========================================================
   Primitive / value helpers
   ========================================================= */

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function isPlainObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function toSafeString(value: unknown): string {
  if (isNil(value)) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (isDate(value)) return value.toISOString();
  if (Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  if (isPlainObject(value)) {
    if ("value" in value) return toSafeString((value as any).value);
    if ("label" in value) return toSafeString((value as any).label);
    if ("name" in value) return toSafeString((value as any).name);
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

export function normalizeValue(value: unknown): string {
  return toSafeString(value).trim();
}

export function toDisplayString(value: unknown): string {
  if (isNil(value)) return "";
  if (isDate(value)) return value.toLocaleDateString();
  return toSafeString(value);
}

export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = normalizeValue(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(toSafeString(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function toDateInputString(value: unknown): string {
  if (isNil(value) || value === "") return "";

  if (isDate(value)) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const stringValue = normalizeValue(value);
  if (!stringValue) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue;

  const parsed = new Date(stringValue);
  if (Number.isNaN(parsed.getTime())) return stringValue;

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatDateValue(value: unknown): string {
  if (isNil(value) || value === "") return "";

  const dateInput = toDateInputString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return toSafeString(value);
  }

  const [year, month, day] = dateInput.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return toSafeString(value);
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* =========================================================
   URL / text helpers
   ========================================================= */

export function ensureHttps(value: unknown): string {
  const str = normalizeValue(value);
  if (!str) return "";
  if (str.startsWith("http://") || str.startsWith("https://")) return str;
  return `https://${str}`;
}

export function titleize(input: string): string {
  if (!input) return "";
  return input
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => normalizeValue(v)))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* =========================================================
   Excel-like helpers
   ========================================================= */

export function columnLetter(index: number): string {
  let result = "";
  let n = index + 1;

  while (n > 0) {
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
    n = Math.floor((n - 1) / 26);
  }

  return result;
}

export function cellAddress(rowIndex: number, columnIndex: number): string {
  return `${columnLetter(columnIndex)}${rowIndex + 1}`;
}

export function parseColumnLetter(letter: string): number {
  let result = 0;
  const upper = letter.toUpperCase();

  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64);
  }

  return result - 1;
}

/* =========================================================
   Coordinate / range helpers
   ========================================================= */

export function isSameCoord(a: GridCellCoord | null, b: GridCellCoord | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.row === b.row && a.col === b.col;
}

export function normalizeRange(range: GridSelectionRange): {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
} {
  return {
    startRow: Math.min(range.start.row, range.end.row),
    endRow: Math.max(range.start.row, range.end.row),
    startCol: Math.min(range.start.col, range.end.col),
    endCol: Math.max(range.start.col, range.end.col),
  };
}

export function createRange(start: GridCellCoord, end: GridCellCoord): GridSelectionRange {
  return { start, end };
}

export function isCoordInRange(coord: GridCellCoord, range: GridSelectionRange): boolean {
  const normalized = normalizeRange(range);
  return (
    coord.row >= normalized.startRow &&
    coord.row <= normalized.endRow &&
    coord.col >= normalized.startCol &&
    coord.col <= normalized.endCol
  );
}

export function rangeSize(range: GridSelectionRange): { rows: number; cols: number } {
  const normalized = normalizeRange(range);
  return {
    rows: normalized.endRow - normalized.startRow + 1,
    cols: normalized.endCol - normalized.startCol + 1,
  };
}

/* =========================================================
   Row / column value helpers
   ========================================================= */

export function getRowValue<T extends GridRow>(
  row: T,
  column: GridColumnDef<T> | GridResolvedColumnDef<T>
): any {
  if (column.getValue) return column.getValue(row);
  return row[column.key];
}

export function setRowValue<T extends GridRow>(
  row: T,
  column: GridColumnDef<T> | GridResolvedColumnDef<T>,
  value: any
): T {
  if (column.setValue) return column.setValue(row, value);

  return {
    ...row,
    [column.key]: value,
  };
}

export function formatCellValue<T extends GridRow>(
  value: any,
  row: T,
  column: GridColumnDef<T> | GridResolvedColumnDef<T>
): string {
  if (column.formatValue) return column.formatValue(value, row);
  if (column.type === "date") return formatDateValue(value);
  return toDisplayString(value);
}

export function parseCellValue<T extends GridRow>(
  value: any,
  row: T,
  column: GridColumnDef<T> | GridResolvedColumnDef<T>
): any {
  if (column.parseValue) return column.parseValue(value, row);

  switch (column.type) {
    case "number":
      return value === "" ? null : toNumber(value);
    case "checkbox":
      return toBoolean(value);
    case "link":
      return ensureHttps(value);
    case "date":
      return value === "" ? "" : toDateInputString(value);
    default:
      return value;
  }
}

/* =========================================================
   Column normalization
   ========================================================= */

export function resolveColumnDef<T extends GridRow>(
  column: GridColumnDef<T>
): GridResolvedColumnDef<T> {
  const minWidth = column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  const maxWidth = column.maxWidth ?? DEFAULT_MAX_COLUMN_WIDTH;
  const width = clamp(column.width ?? DEFAULT_COLUMN_WIDTH, minWidth, maxWidth);

  return {
    ...column,
    key: column.key,
    title: column.title,
    type: column.type ?? DEFAULT_COLUMN_TYPE,
    width,
    minWidth,
    maxWidth,
    editable: column.editable ?? true,
    readonly: column.readonly ?? false,
    sortable: column.sortable ?? true,
    filterable: column.filterable ?? true,
    resizable: column.resizable ?? true,
    frozen: column.frozen ?? false,
    wrap: column.wrap ?? false,
    hidden: column.hidden ?? false,
    align: column.align ?? DEFAULT_COLUMN_ALIGN,
  };
}

export function resolveColumns<T extends GridRow>(
  columns: GridColumnDef<T>[]
): GridResolvedColumnDef<T>[] {
  return columns.map(resolveColumnDef);
}

/* =========================================================
   Meta helpers
   ========================================================= */

export function createDefaultCellMeta(): GridCellMeta {
  return {
    ...DEFAULT_CELL_META,
  };
}

export function createCellMetaKey(rowIndex: number, columnKey: string): string {
  return `${rowIndex}::${columnKey}`;
}

export function cloneCellMetaMap(
  map: Record<string, GridCellMeta>
): Record<string, GridCellMeta> {
  const next: Record<string, GridCellMeta> = {};
  for (const key of Object.keys(map)) {
    next[key] = { ...map[key] };
  }
  return next;
}

export function cloneRowMetaMap(
  map: Record<number, GridRowMeta>
): Record<number, GridRowMeta> {
  const next: Record<number, GridRowMeta> = {};
  for (const key of Object.keys(map)) {
    next[Number(key)] = { ...map[Number(key)] };
  }
  return next;
}

/* =========================================================
   Array / row cloning helpers
   ========================================================= */

export function cloneRows<T extends GridRow>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row }));
}

export function resolveGridRowId<T extends GridRow>(
  row: T,
  index: number,
  getRowId?: (row: T, index: number) => string
): string {
  if (getRowId) return getRowId(row, index);

  const fallbackId = (row as { id?: unknown }).id;
  if (
    typeof fallbackId === "string" ||
    typeof fallbackId === "number" ||
    typeof fallbackId === "bigint"
  ) {
    return String(fallbackId);
  }

  return String(index);
}

export function clone2DArray<T>(input: T[][]): T[][] {
  return input.map((row) => [...row]);
}

export function shallowEqualObjects(
  left: Record<string, any>,
  right: Record<string, any>
): boolean {
  if (left === right) return true;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    if (!Object.is(left[key], right[key])) return false;
  }

  return true;
}

export function shallowEqualRows<T extends GridRow>(left: T[], right: T[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index++) {
    const leftRow = left[index];
    const rightRow = right[index];

    if (leftRow === rightRow) continue;
    if (!leftRow || !rightRow) return false;
    if (!shallowEqualObjects(leftRow, rightRow)) return false;
  }

  return true;
}

/* =========================================================
   Filter helpers
   ========================================================= */

export function getUniqueColumnValues<T extends GridRow>(
  rows: T[],
  column: GridColumnDef<T> | GridResolvedColumnDef<T>
): string[] {
  return uniqueSorted(rows.map((row) => normalizeValue(getRowValue(row, column))));
}

/* =========================================================
   Sort helpers
   ========================================================= */

export function compareValues(a: unknown, b: unknown): number {
  const numA = toNumber(a);
  const numB = toNumber(b);

  if (numA !== null && numB !== null) return numA - numB;

  const strA = normalizeValue(a);
  const strB = normalizeValue(b);

  return strA.localeCompare(strB, undefined, { sensitivity: "base" });
}

/* =========================================================
   Width helpers
   ========================================================= */

export function calculateAutoFitWidth(
  headerText: string,
  values: string[],
  options?: {
    minWidth?: number;
    maxWidth?: number;
    charWidth?: number;
    padding?: number;
  }
): number {
  const minWidth = options?.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_COLUMN_WIDTH;
  const charWidth = options?.charWidth ?? 8;
  const padding = options?.padding ?? 32;

  const longest = Math.max(
    headerText.length,
    ...values.map((value) => toDisplayString(value).length)
  );

  return clamp(longest * charWidth + padding, minWidth, maxWidth);
}

/* =========================================================
   Clipboard helpers
   ========================================================= */

export function clipboardToText(clipboard: GridClipboardData): string {
  if (!clipboard?.data?.length) return "";
  return clipboard.data.map((row) => row.join("\t")).join("\n");
}

export function textToClipboardMatrix(text: string): string[][] {
  if (!text) return [];

  const rows = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((row) => row.split("\t"));

  if (rows.length > 1 && rows[rows.length - 1].every((cell) => cell === "")) {
    rows.pop();
  }

  return rows;
}

/* =========================================================
   Empty / blank helpers
   ========================================================= */

export function isBlankValue(value: unknown): boolean {
  return normalizeValue(value) === "";
}

export function isRowBlank<T extends GridRow>(
  row: T,
  columns: Array<GridColumnDef<T> | GridResolvedColumnDef<T>>
): boolean {
  return columns.every((column) => isBlankValue(getRowValue(row, column)));
}

/* =========================================================
   DOM / portal helpers
   ========================================================= */

export function safeDomRect(rect?: DOMRect | null): DOMRect {
  return rect ?? new DOMRect(0, 0, 200, 32);
}
