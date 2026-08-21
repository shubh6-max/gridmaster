import type { GridConditionalFormats, GridConditionalFormat, GridCondition, GridRow } from "../types";
import { compareValues, normalizeValue, toNumber } from "../utils";

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

export function evaluateCondition(value: unknown, condition: GridCondition): boolean {
  const normalized = normalizeValue(value);

  switch (condition.type) {
    case "cellValue": {
      const leftNum = toNumber(value);
      const rightNum = toNumber(condition.value);

      if (leftNum !== null && rightNum !== null) {
        const cmp = compareValues(leftNum, rightNum);
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
        }
      }

      const cmpStr = compareValues(normalized, normalizeValue(condition.value));
      switch (condition.operator) {
        case "=":
          return cmpStr === 0;
        case "<>":
          return cmpStr !== 0;
        default:
          return false;
      }
    }
    case "between": {
      const num = toNumber(value);
      const low = toNumber(condition.low);
      const high = toNumber(condition.high);
      if (num === null || low === null || high === null) return false;
      return num > low && num < high;
    }
    case "textContains":
      return normalized.toLowerCase().includes(String(condition.value).toLowerCase());
    case "timePeriod":
      return false;
    default:
      return false;
  }
}

export function getMatchingConditionalFormat<T extends GridRow>(
  row: T,
  columnKey: string,
  formats: GridConditionalFormats
): GridConditionalFormat | null {
  const rules = formats[columnKey];
  if (!rules?.length) return null;

  const rawValue = (row as Record<string, unknown>)[columnKey];

  for (const rule of rules) {
    if (evaluateCondition(rawValue, rule.condition)) {
      return rule;
    }
  }

  return null;
}
