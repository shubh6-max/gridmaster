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
import { deepEqual, equalRecords } from "./equality";

/* =========================================================
   Primitive / value helpers
   ========================================================= */

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function isFormulaValue(value: unknown): value is string {
  return typeof value === "string" && value.trimStart().startsWith("=");
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
    if ("value" in value) return toSafeString(value.value);
    if ("label" in value) return toSafeString(value.label);
    if ("name" in value) return toSafeString(value.name);
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

/** Options for the strict coercion-on-write helpers (A-059). `locale` is a BCP-47 tag. */
export type GridParseOptions = {
  locale?: string;
};

const DEFAULT_PARSE_LOCALE = "en-US";

/** Discover a locale's grouping and decimal separators without hard-coding them. */
function localeNumberSeparators(locale: string): { group: string; decimal: string } {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
    return {
      group: parts.find((part) => part.type === "group")?.value ?? ",",
      decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
    };
  } catch {
    return { group: ",", decimal: "." };
  }
}

// A plain decimal / scientific literal AFTER separators are normalised. Rejects hex (`0x10`),
// `Infinity`, `NaN` and other junk that `Number()` would otherwise accept or turn into NaN.
const STRICT_NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Strict, locale-aware number parse for the edit/paste/coercion-on-write paths (A-059). Returns a
 * finite number, or `null` when the input is blank or not a valid number — it NEVER silently turns
 * text into 0 or NaN. This is a NEW helper: the shared `toNumber` (sort/filter/fill/validation) is
 * left exactly as it was. Handles thousands/decimal separators for `locale`, surrounding and
 * grouping whitespace (incl. NBSP / narrow NBSP), leading `+`/`-`, Excel accounting negatives
 * `(123)`, and percent strings (`12%` -> 0.12). Rejects hex, `Infinity`, `NaN`.
 */
export function parseNumberStrict(value: unknown, locale: string = DEFAULT_PARSE_LOCALE): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") {
    if (typeof value === "bigint") return Number(value);
    return null;
  }

  let s = value.trim();
  if (!s) return null;

  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1).trim();
  }

  let scale = 1;
  if (s.endsWith("%")) {
    scale = 1 / 100;
    s = s.slice(0, -1).trim();
  }

  const { group, decimal } = localeNumberSeparators(locale);
  // Strip grouping: the locale's group char plus any whitespace (covers fr-FR NBSP groups and
  // stray spaces); then normalise the locale decimal to a `.`.
  s = s.split(group).join("");
  s = s.replace(/[\s  ]/g, "");
  if (decimal !== ".") s = s.split(decimal).join(".");

  if (!STRICT_NUMBER_RE.test(s)) return null;
  const parsed = Number(s);
  if (!Number.isFinite(parsed)) return null;
  return sign * scale * parsed;
}

function toLocalIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null; // rejects overflow like 2024-02-30
  }
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

/** True when `locale` writes the day before the month (e.g. en-GB, fr-FR) rather than month-first. */
function localeDayFirst(locale: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(2000, 0, 2));
    for (const part of parts) {
      if (part.type === "day") return true;
      if (part.type === "month") return false;
    }
  } catch {
    /* fall through */
  }
  return false;
}

/**
 * Strict date parse for the paste/coercion-on-write path (A-059). Returns a `YYYY-MM-DD` string
 * built from LOCAL date components (so an ISO date never shifts a day across time zones), or the
 * original string when the value cannot be parsed as a date. ISO `YYYY-MM-DD` passes through
 * verbatim; `DD/MM/YYYY` vs `MM/DD/YYYY` (with `/`, `-` or `.` separators) is disambiguated by the
 * optional `locale`.
 */
export function parseDateToInputString(
  value: unknown,
  locale: string = DEFAULT_PARSE_LOCALE
): string {
  if (isNil(value) || value === "") return "";

  if (isDate(value)) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const s = normalizeValue(value);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // ISO: local, no construction, no shift

  const parts = /^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/.exec(s);
  if (parts) {
    const a = Number(parts[1]);
    const b = Number(parts[2]);
    const c = Number(parts[3]);
    // `YYYY/MM/DD` when the first group is a 4-digit year; otherwise day/month order by locale.
    let year: number;
    let month: number;
    let day: number;
    if (parts[1].length === 4) {
      year = a;
      month = b;
      day = c;
    } else {
      year = c < 100 ? 2000 + c : c;
      if (localeDayFirst(locale)) {
        day = a;
        month = b;
      } else {
        month = a;
        day = b;
      }
    }
    const iso = toLocalIsoDate(year, month, day);
    if (iso) return iso;
  }

  return s; // unparseable: keep the original text
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

/** Schemes we are willing to turn into a clickable anchor (A-082). */
const ALLOWED_LINK_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/**
 * A safe href for `value`, or `null` when it must NOT be rendered as a link (A-082).
 * - An explicit scheme is honoured only if it is in the allow-list (case-insensitive); any other
 *   scheme (`javascript:`, `data:`, `vbscript:`, `file:`, ...) returns `null`.
 * - Control characters are stripped first, so obfuscations like `java\tscript:` cannot slip a
 *   disallowed scheme past the check.
 * - A value with no scheme is treated as a bare host and gets `https://` prepended (leading
 *   slashes trimmed so `//evil.com` becomes `https://evil.com`, not a protocol-relative link).
 * - Empty / whitespace-only input returns `null`.
 */
export function safeLinkHref(value: unknown): string | null {
  const trimmed = normalizeValue(value);
  if (!trimmed) return null;

  // Remove ASCII control chars (incl. tab/newline) that could disguise a blocked scheme.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char sanitisation.
  const cleaned = trimmed.replace(/[\u0000-\u001F\u007F]/g, "");
  if (!cleaned) return null;

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(cleaned);
  if (schemeMatch) {
    return ALLOWED_LINK_SCHEMES.has(schemeMatch[1].toLowerCase()) ? cleaned : null;
  }

  return `https://${cleaned.replace(/^\/+/, "")}`;
}

/**
 * Normalises a link value for storage/display. Keeps its name and `(value) => string` signature
 * (used by `parseCellValue` on the link write path). Allowed schemes and bare hosts resolve to a
 * real href; a disallowed scheme returns the RAW value unchanged (never a mangled `https://mailto:`
 * or a fabricated link), so rendering — not coercion — decides whether it becomes an anchor.
 */
export function ensureHttps(value: unknown): string {
  return safeLinkHref(value) ?? normalizeValue(value);
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

export function getRowValue<T extends object>(
  row: T,
  column: GridColumnDef<T> | GridResolvedColumnDef<T>
): unknown {
  if (column.getValue) return column.getValue(row);
  return (row as Record<string, unknown>)[column.key];
}

export function setRowValue<T extends object>(
  row: T,
  column: GridColumnDef<T> | GridResolvedColumnDef<T>,
  value: unknown
): T {
  if (column.setValue) return column.setValue(row, value);

  return {
    ...row,
    [column.key]: value,
  };
}

export function formatCellValue<T extends object>(
  value: unknown,
  row: T,
  column: GridColumnDef<T> | GridResolvedColumnDef<T>
): string {
  if (column.formatValue) return column.formatValue(value, row);
  if (column.type === "date") return formatDateValue(value);
  return toDisplayString(value);
}

export function parseCellValue<T extends object>(
  value: unknown,
  row: T,
  column: GridColumnDef<T> | GridResolvedColumnDef<T>,
  options?: GridParseOptions
): unknown {
  if (isFormulaValue(value)) return String(value);
  if (column.parseValue) return column.parseValue(value, row);

  const locale = options?.locale;

  switch (column.type) {
    case "number":
      // Strict, locale-aware parse (A-059): blank stays blank, junk stays `null` (never a silent 0).
      return value === "" ? null : parseNumberStrict(value, locale);
    case "checkbox":
      return toBoolean(value);
    case "link":
      return ensureHttps(value);
    case "date":
      return value === "" ? "" : parseDateToInputString(value, locale);
    default:
      return value;
  }
}

/* =========================================================
   Column normalization
   ========================================================= */

export function resolveColumnDef<T extends object>(
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

export function resolveColumns<T extends object>(
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

export function cloneCellMetaMap(map: Record<string, GridCellMeta>): Record<string, GridCellMeta> {
  const next: Record<string, GridCellMeta> = {};
  for (const key of Object.keys(map)) {
    next[key] = cloneRecord(map[key]);
  }
  return next;
}

export function cloneRowMetaMap(map: Record<number, GridRowMeta>): Record<number, GridRowMeta> {
  const next: Record<number, GridRowMeta> = {};
  for (const key of Object.keys(map)) {
    next[Number(key)] = cloneRecord(map[Number(key)]);
  }
  return next;
}

/* =========================================================
   Array / row cloning helpers
   ========================================================= */

/** Plain `{}` / null-prototype objects only; class instances, Map, Set, ... are not "plain data". */
function isPlainRecord(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Copies nested plain data (arrays, plain objects, Dates) so a clone shares no mutable structure
 * with its source. Functions, class instances, Map and Set stay by reference. Cycle-safe.
 */
function clonePlain<V>(value: V, seen: WeakMap<object, unknown>): V {
  if (typeof value !== "object" || value === null) return value;

  const source: object = value;
  if (seen.has(source)) return seen.get(source) as V;
  if (source instanceof Date) return new Date(source.getTime()) as V;

  if (Array.isArray(source)) {
    const copy: unknown[] = [];
    seen.set(source, copy);
    for (let index = 0; index < source.length; index++) {
      copy[index] = clonePlain(source[index], seen);
    }
    return copy as V;
  }

  if (!isPlainRecord(source)) return value;

  const copy: Record<string | symbol, unknown> =
    Object.getPrototypeOf(source) === null ? Object.create(null) : {};
  seen.set(source, copy);
  for (const key of Object.keys(source)) {
    copy[key] = clonePlain((source as Record<string, unknown>)[key], seen);
  }
  // Keep Symbol-keyed props (by reference, like class/function values) instead of silently dropping
  // them: `Object.keys` ignores symbols, so a nested plain object would otherwise lose them.
  for (const sym of Object.getOwnPropertySymbols(source)) {
    if (Object.prototype.propertyIsEnumerable.call(source, sym)) {
      copy[sym] = (source as Record<symbol, unknown>)[sym];
    }
  }
  return copy as V;
}

/** One-level copy of `record` whose object-valued fields are deep-copied (see clonePlain). */
function cloneRecord<R extends object>(record: R): R {
  const next = { ...record } as Record<string, unknown>;
  let seen: WeakMap<object, unknown> | undefined;

  for (const key of Object.keys(next)) {
    const value = next[key];
    if (typeof value === "object" && value !== null) {
      if (!seen) {
        seen = new WeakMap();
        seen.set(record, next);
      }
      next[key] = clonePlain(value, seen);
    }
  }

  return next as R;
}

export function cloneRows<T extends object>(rows: readonly T[]): T[] {
  return rows.map((row) => cloneRecord(row));
}

export function cloneColumns<T extends object>(
  columns: ReadonlyArray<GridColumnDef<T> | GridResolvedColumnDef<T>>
): GridColumnDef<T>[] {
  return columns.map((column) => {
    const next = cloneRecord(column) as GridColumnDef<T>;
    // Keep the explicit (possibly undefined) option keys: column comparison is key-count sensitive.
    return { ...next, options: next.options, filterOptions: next.filterOptions };
  });
}

export function resolveGridRowId<T extends object>(
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

/** Shallow own-key equality. Takes `object` so interface-typed values (no index signature) are accepted. */
export function shallowEqualObjects(left: object, right: object): boolean {
  if (left === right) return true;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    if (!Object.is((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

export function shallowEqualRows<T extends object>(left: T[], right: T[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index++) {
    const leftRow = left[index];
    const rightRow = right[index];

    if (leftRow === rightRow) continue;
    if (!leftRow || !rightRow) return false;
    // Rows are deep-cloned (A-104), so nested values are new references each time: compare them by
    // content, otherwise a no-op write or undo step would always look like a change.
    if (!equalRecords(leftRow, rightRow)) return false;
  }

  return true;
}

function shallowEqualStringArrays(left?: string[], right?: string[]): boolean {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index++) {
    if (!Object.is(left[index], right[index])) return false;
  }

  return true;
}

export function shallowEqualColumns<T extends object>(
  left: GridColumnDef<T>[],
  right: GridColumnDef<T>[]
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index++) {
    const leftColumn = left[index];
    const rightColumn = right[index];

    if (leftColumn === rightColumn) continue;
    if (!leftColumn || !rightColumn) return false;

    const { options: leftOptions, filterOptions: leftFilterOptions, ...leftRest } = leftColumn;
    const { options: rightOptions, filterOptions: rightFilterOptions, ...rightRest } = rightColumn;

    if (!equalRecords(leftRest, rightRest)) return false;
    if (!shallowEqualStringArrays(leftOptions, rightOptions)) return false;
    if (!shallowEqualStringArrays(leftFilterOptions, rightFilterOptions)) return false;
  }

  return true;
}

/**
 * Deep structural equality for plain column data. Functions are compared by PRESENCE only
 * (never by identity or toString), so inline `renderCell: p => ...` closures that are new on every
 * parent render do not make two otherwise identical column definitions "different".
 */
function structurallyEqual(left: unknown, right: unknown): boolean {
  return deepEqual(left, right, true);
}

/** True when both column lists describe the same grid structure, ignoring function identity. */
export function sameColumnStructure<T extends object>(
  left: GridColumnDef<T>[],
  right: GridColumnDef<T>[]
): boolean {
  return left === right || structurallyEqual(left, right);
}

/**
 * Overlays the latest function-valued fields (renderCell, getValue, setValue, formatValue,
 * parseValue, validate, renderEditor, and the validators inside `validations`) from the consumer's
 * current `columns` prop onto grid-owned resolved columns, matched by key. Structure (order, width,
 * user-inserted columns, ...) stays whatever the grid holds; only behaviour is refreshed. Columns
 * without a counterpart, and fields the grid column does not have, are left untouched.
 */
export function applyLatestColumnFunctions<T extends object, C extends GridColumnDef<T>>(
  column: C,
  latest: GridColumnDef<T> | undefined
): C {
  if (!latest) return column;

  const patch: Record<string, unknown> = {};
  const current = column as Record<string, unknown>;
  const incoming = latest as Record<string, unknown>;

  for (const field of Object.keys(incoming)) {
    const value = incoming[field];
    const isRefreshable =
      typeof value === "function" ||
      (field === "validations" && structurallyEqual(current[field], value));

    if (isRefreshable && field in current && current[field] !== value) {
      patch[field] = value;
    }
  }

  return Object.keys(patch).length ? { ...column, ...patch } : column;
}

/* =========================================================
   Filter helpers
   ========================================================= */

export function getUniqueColumnValues<T extends object>(
  rows: T[],
  column: GridColumnDef<T> | GridResolvedColumnDef<T>
): string[] {
  return uniqueSorted(rows.map((row) => normalizeValue(getRowValue(row, column))));
}

/* =========================================================
   Sort helpers
   ========================================================= */

/**
 * A-010: one module-level collator reused across every sort (building one per comparison was a
 * large slice of the 100k-row freeze). `sensitivity:"base"` with the default locale is exactly what
 * `localeCompare(…, { sensitivity:"base" })` used before — NO `numeric:true`, which would reorder
 * numeric strings and break equivalence with the old comparator.
 */
const SORT_COLLATOR = new Intl.Collator(undefined, { sensitivity: "base" });

/** Precomputed sort key for one value: a numeric view (or null) plus the normalized string. */
export type GridSortKey = {
  num: number | null;
  str: string;
};

/** Read a value's sort key ONCE (decorate-sort-undecorate). Semantics mirror `compareValues`. */
export function buildSortKey(value: unknown): GridSortKey {
  return { num: toNumber(value), str: normalizeValue(value) };
}

/** Compare two precomputed keys. Identical per-pair result to the old `compareValues`. */
export function compareSortKeys(a: GridSortKey, b: GridSortKey): number {
  if (a.num !== null && b.num !== null) return a.num - b.num;
  return SORT_COLLATOR.compare(a.str, b.str);
}

/**
 * A-010: shared decorate-sort-undecorate used by every sort path (sorting.ts, gridState.ts). Reads
 * each row's key exactly once via `getValue`, then sorts the decorated entries on their precomputed
 * keys with the reused collator. Ties return 0 and `Array.prototype.sort` is stable (ES2019+), so
 * the INPUT order of `indexes` is preserved on ties — byte-identical to the old
 * `indexes.sort(compareValues * dir)` path, which relied on the same stability (this matters when
 * the input is already in a custom order, e.g. after an `allowedRowIds` reorder).
 */
export function sortByDecoratedKeys(
  indexes: number[],
  getValue: (index: number) => unknown,
  direction: 1 | -1
): number[] {
  const decorated = indexes.map((idx) => ({ idx, key: buildSortKey(getValue(idx)) }));
  decorated.sort((a, b) => compareSortKeys(a.key, b.key) * direction);
  return decorated.map((entry) => entry.idx);
}

export function compareValues(a: unknown, b: unknown): number {
  return compareSortKeys(buildSortKey(a), buildSortKey(b));
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

/** Quote a TSV cell RFC-4180-style iff it contains a tab, a newline or a double quote (A-055). */
function quoteTsvCell(cell: string): string {
  if (/[\t\n\r"]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function clipboardToText(clipboard: GridClipboardData): string {
  if (!clipboard?.data?.length) return "";
  return clipboard.data.map((row) => row.map(quoteTsvCell).join("\t")).join("\n");
}

/**
 * Quote-aware RFC-4180-style TSV parse (A-055): a quoted cell keeps its embedded tabs and newlines
 * as one cell, `""` inside quotes is a literal quote, `\r\n` and `\n` both end a row, a lone `"` in
 * the middle of an unquoted field is literal, and a single trailing row separator does not add an
 * empty row (a blank line in the middle still does).
 */
export function textToClipboardMatrix(text: string): string[][] {
  if (!text) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let endedWithRowSep = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      endedWithRowSep = false;
      continue;
    }

    if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === "\t") {
      pushField();
    } else if (ch === "\n") {
      pushRow();
      endedWithRowSep = true;
      continue;
    } else if (ch === "\r") {
      pushRow();
      if (text[i + 1] === "\n") i++;
      endedWithRowSep = true;
      continue;
    } else {
      field += ch;
    }
    endedWithRowSep = false;
  }

  // Flush the pending row unless the text ended exactly on a row separator (Excel adds no trailing row).
  if (!endedWithRowSep) pushRow();

  return rows;
}

/* =========================================================
   Empty / blank helpers
   ========================================================= */

export function isBlankValue(value: unknown): boolean {
  return normalizeValue(value) === "";
}

export function isRowBlank<T extends object>(
  row: T,
  columns: ReadonlyArray<GridColumnDef<T> | GridResolvedColumnDef<T>>
): boolean {
  return columns.every((column) => isBlankValue(getRowValue(row, column)));
}

/* =========================================================
   DOM / portal helpers
   ========================================================= */

export function safeDomRect(rect?: DOMRect | null): DOMRect {
  if (rect) return rect;
  // Server render / no DOM: `DOMRect` is undefined in plain Node (F-001). Return a plain
  // structural rect instead of constructing one, so render never touches a browser global.
  if (typeof DOMRect !== "undefined") return new DOMRect(0, 0, 200, 32);

  const x = 0;
  const y = 0;
  const width = 200;
  const height = 32;
  const plain = {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON() {
      return { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height };
    },
  };
  return plain as DOMRect;
}
