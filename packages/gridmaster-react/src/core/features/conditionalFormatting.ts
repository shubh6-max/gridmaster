import type {
  GridConditionalFormats,
  GridConditionalFormat,
  GridCondition,
  GridRow,
} from "../types";
import { normalizeValue, toNumber } from "../utils";

/**
 * A-016: a value's number, treating blank/null/"" as "no number" (never 0). This is local to
 * conditional formatting — the shared `toNumber` (which coerces "" to 0) must not change, because
 * ~22 other callers rely on its semantics.
 */
function conditionalNumber(value: unknown): number | null {
  if (normalizeValue(value) === "") return null;
  return toNumber(value);
}

/** Text comparison for string operators: same locale/sensitivity as the grid's sort. */
function compareText(a: unknown, b: unknown): number {
  return normalizeValue(a).localeCompare(normalizeValue(b), undefined, { sensitivity: "base" });
}

function toDateValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = normalizeValue(value);
  if (text === "") return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Start of the Sunday-based week containing `date`, at local midnight. */
function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function clearConditionalFormats(): GridConditionalFormats {
  return {};
}

export function setConditionalFormats(
  formats: GridConditionalFormats,
  columnKey: string,
  rules: GridConditionalFormat[] | null
): GridConditionalFormats {
  const next = { ...formats };
  if (!rules || !rules.length) {
    delete next[columnKey];
    return next;
  }
  next[columnKey] = rules.map((rule) => ({ ...rule }));
  return next;
}

/**
 * A-016 evaluator. `now` is an injectable clock (defaults to the real one) so `timePeriod` rules are
 * deterministic in tests. Numbers compare as numbers and strings as text; blanks never coerce to 0;
 * `between` is inclusive and order-insensitive.
 */
export function evaluateCondition(
  value: unknown,
  condition: GridCondition,
  now: () => Date = () => new Date()
): boolean {
  switch (condition.type) {
    case "cellValue": {
      const leftNum = conditionalNumber(value);
      const rightNum = conditionalNumber(condition.value);
      const cmp =
        leftNum !== null && rightNum !== null
          ? Math.sign(leftNum - rightNum)
          : Math.sign(compareText(value, condition.value));

      switch (condition.operator) {
        case ">":
          return cmp > 0;
        case "<":
          return cmp < 0;
        case "=":
          return cmp === 0;
        case ">=":
          return cmp >= 0;
        case "<=":
          return cmp <= 0;
        case "<>":
          return cmp !== 0;
        default:
          return false;
      }
    }
    case "between": {
      const num = conditionalNumber(value);
      const low = conditionalNumber(condition.low);
      const high = conditionalNumber(condition.high);
      if (num === null || low === null || high === null) return false;
      return num >= Math.min(low, high) && num <= Math.max(low, high);
    }
    case "textContains":
      return normalizeValue(value).toLowerCase().includes(String(condition.value).toLowerCase());
    case "timePeriod": {
      const date = toDateValue(value);
      if (!date) return false;
      const today = now();

      switch (condition.value) {
        case "today":
          return isSameDay(date, today);
        case "yesterday": {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return isSameDay(date, yesterday);
        }
        case "thisWeek": {
          const weekStart = startOfWeek(today);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          return date >= weekStart && date < weekEnd;
        }
        case "thisMonth":
          return (
            date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
          );
        default:
          return false;
      }
    }
    default:
      return false;
  }
}

/**
 * First-match-wins (documented): the first rule in the column's array whose condition holds supplies
 * the cell style. Pass `options.value` to evaluate against the DISPLAYED/formula value (not the raw
 * field) and `options.now` to inject the clock for `timePeriod` rules.
 */
export function getMatchingConditionalFormat<T extends object>(
  row: T,
  columnKey: string,
  formats: GridConditionalFormats,
  options?: { value?: unknown; now?: () => Date }
): GridConditionalFormat | null {
  const rules = formats[columnKey];
  if (!rules?.length) return null;

  const value =
    options && "value" in options ? options.value : (row as Record<string, unknown>)[columnKey];
  const now = options?.now ?? (() => new Date());

  for (const rule of rules) {
    if (evaluateCondition(value, rule.condition, now)) {
      return rule;
    }
  }

  return null;
}
