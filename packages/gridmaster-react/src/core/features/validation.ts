import type {
  GridColumnValidation,
  GridResolvedColumnDef,
  GridRow,
  GridValidationRule,
  GridValidations,
} from "../types";
import { normalizeValue, toNumber } from "../utils";

/* =========================================================
   Validation rule types live in ../types (canonical, re-exported from the package root as
   `GridValidationRule` / `GridColumnValidation` / `GridValidations`). This module is the pure,
   advisory rule engine for both the record-keyed map (`validateCellValue`) and a resolved column's
   inline `validations` array (`validateColumnValue`, wired into GridCell — A-061).
   ========================================================= */

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

/** Record-keyed lookup. Returns the first failing rule's message for `columnKey`, or null. */
export function validateCellValue<T extends object>(
  value: unknown,
  row: T,
  columnKey: string,
  validations: GridValidations
): string | null {
  const columnValidation = validations[columnKey];
  if (!columnValidation) return null;
  return runRules(value, row, columnValidation.rules);
}

/**
 * Render-time validation for a resolved column's inline `validations` array (A-061). Pure and
 * advisory: returns the first failing rule's message, or null. GridCell wires this alongside
 * `column.validate` so both produce the same `string | null` error shape; a column that declares
 * neither validates to null (default behaviour unchanged).
 */
export function validateColumnValue<T extends object>(
  value: unknown,
  row: T,
  column: GridResolvedColumnDef<T>
): string | null {
  const rules = column.validations;
  if (!rules?.length) return null;
  return runRules(value, row, rules);
}

function runRules<T extends object>(
  value: unknown,
  row: T,
  rules: GridValidationRule[]
): string | null {
  for (const rule of rules) {
    const error = validateRule(value, row, rule);
    if (error) return error;
  }
  return null;
}

function validateRule<T extends object>(
  value: unknown,
  row: T,
  rule: GridValidationRule
): string | null {
  const normalized = normalizeValue(value);
  const isBlank = normalized === "";

  // Only `required` flags a blank cell. Every other rule is skipped when empty, so a blank is not
  // reported as both "required" and "below min / too short" at once (A-061).
  if (isBlank && rule.type !== "required") return null;

  switch (rule.type) {
    case "required":
      return isBlank ? (rule.message ?? "Required") : null;
    case "min": {
      const num = toNumber(value);
      return num !== null && num >= rule.value
        ? null
        : (rule.message ?? `Minimum is ${rule.value}`);
    }
    case "max": {
      const num = toNumber(value);
      return num !== null && num <= rule.value
        ? null
        : (rule.message ?? `Maximum is ${rule.value}`);
    }
    case "minLength":
      return normalized.length >= rule.value
        ? null
        : (rule.message ?? `Min length is ${rule.value}`);
    case "maxLength":
      return normalized.length <= rule.value
        ? null
        : (rule.message ?? `Max length is ${rule.value}`);
    case "pattern": {
      let regExp: RegExp;
      try {
        regExp = new RegExp(rule.value);
      } catch {
        // A misconfigured pattern can never match reliably; skip it rather than throw at render.
        return null;
      }
      return regExp.test(normalized) ? null : (rule.message ?? "Invalid format");
    }
    case "custom":
      try {
        return rule.validator?.(value, row as GridRow) ?? null;
      } catch (error) {
        // A throwing custom validator is surfaced as a validation error, never a render crash.
        return rule.message ?? (error instanceof Error ? error.message : "Invalid");
      }
    default:
      return null;
  }
}
