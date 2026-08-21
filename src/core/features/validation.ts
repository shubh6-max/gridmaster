import type {
  GridCellMeta,
  GridColumnDef,
  GridResolvedColumnDef,
  GridRow,
} from "../types";
import { isNil, normalizeValue, toNumber } from "../utils";

/* =========================================================
   Validation rule types
   ========================================================= */

export type GridValidationRule =
  | { type: "required"; message?: string }
  | { type: "min"; value: number; message?: string }
  | { type: "max"; value: number; message?: string }
  | { type: "minLength"; value: number; message?: string }
  | { type: "maxLength"; value: number; message?: string }
  | { type: "pattern"; value: string; message?: string }
  | {
      type: "custom";
      message?: string;
      validator: (value: unknown, row: GridRow) => string | null;
    };

export type GridColumnValidation = {
  rules: GridValidationRule[];
};

export type GridValidations = Record<string, GridColumnValidation>;

export function clearValidations(): GridValidations {
  return {};
}

export function setColumnValidation(
  validations: GridValidations,
  columnKey: string,
  validation: GridColumnValidation | null
): GridValidations {
  const next = { ...validations };
  if (!validation || !validation.rules.length) {
    delete next[columnKey];
    return next;
  }
  next[columnKey] = { rules: [...validation.rules] };
  return next;
}

export function validateCellValue<T extends GridRow>(
  value: unknown,
  row: T,
  columnKey: string,
  validations: GridValidations
): string | null {
  const columnValidation = validations[columnKey];
  if (!columnValidation) return null;

  for (const rule of columnValidation.rules) {
    const error = validateRule(value, row, rule);
    if (error) return error;
  }
  return null;
}

function validateRule<T extends GridRow>(
  value: unknown,
  row: T,
  rule: GridValidationRule
): string | null {
  const normalized = normalizeValue(value);

  switch (rule.type) {
    case "required":
      return normalized ? null : rule.message ?? "Required";
    case "min": {
      const num = toNumber(value);
      return num !== null && num >= rule.value ? null : rule.message ?? `Minimum is ${rule.value}`;
    }
    case "max": {
      const num = toNumber(value);
      return num !== null && num <= rule.value ? null : rule.message ?? `Maximum is ${rule.value}`;
    }
    case "minLength":
      return normalized.length >= rule.value ? null : rule.message ?? `Min length is ${rule.value}`;
    case "maxLength":
      return normalized.length <= rule.value ? null : rule.message ?? `Max length is ${rule.value}`;
    case "pattern":
      return new RegExp(rule.value).test(normalized) ? null : rule.message ?? "Invalid format";
    case "custom":
      return rule.validator?.(value, row) ?? null;
    default:
      return null;
  }
}