// Select-editor option helper. Language: TypeScript 6 (strict).
// Ported from the Stakeholder app's vendored selectOptions.mjs (the type build cannot use allowJs).

/**
 * Returns the options to render for a select editor. A stored value that is not in the options
 * list is appended (as a string) so it stays visible and selectable instead of silently
 * falling back to the blank/first option. Never mutates `options`; tolerates a missing list.
 */
export function getSelectOptionsWithCurrentValue(
  options: readonly (string | number)[] | null | undefined,
  currentValue: unknown
): (string | number)[] {
  const normalizedOptions = Array.isArray(options) ? [...options] : [];
  const value = currentValue == null ? "" : String(currentValue);

  // Empty means "no selection" (the placeholder option); otherwise compare as strings so a
  // numeric 1 matches the option "1".
  if (!value || normalizedOptions.some((option) => String(option) === value)) {
    return normalizedOptions;
  }

  return [...normalizedOptions, value];
}
