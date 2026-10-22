// Sizing helper for the colour option list in the column menu. Language: TypeScript 6 (strict).
const COLOR_OPTION_ROW_HEIGHT = 38;
const COLOR_OPTION_LIST_PADDING = 8;

/** Max pixel height of the colour list so that exactly `visibleValueCount` rows show (min 1 row). */
export function getColorMenuOptionListMaxHeight(visibleValueCount: number | null | undefined): number {
  const requested = Number(visibleValueCount);
  const count = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;
  return count * COLOR_OPTION_ROW_HEIGHT + COLOR_OPTION_LIST_PADDING;
}
