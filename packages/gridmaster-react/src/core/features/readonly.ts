// Shared, pure write-guard predicates (A-084 / F-002). ONE source of truth for "is this cell a
// read-only VALUE target", used by GridBody (visual), useEditing, GridCell, the fill hook and the
// clipboard write sink so they can never drift. Language: TypeScript 6 (strict).
//
// Readonly meta is intentionally VALUE-only: a read-only cell still accepts FORMATTING (the format
// painter, colour, wrap, bold), because formatting is a cell-META write, not a value write. Blocking
// formatting by readonly meta is deliberately NOT done here.
import type {
  GridCellMeta,
  GridMasterProps,
  GridResolvedColumnDef,
  GridRow,
  GridRowMeta,
} from "../types";
import { createCellMetaKey, isFormulaValue } from "../utils";

/**
 * Whether a cell is a read-only value target, from already-resolved meta. `cellMeta`/`rowMeta` are
 * the SAME merged objects a caller already computed (e.g. GridBody), so the visual and the write
 * guards share one rule. A missing column is treated as read-only (there is nothing to write into).
 */
export function isCellReadonly<T extends object = GridRow>(
  column: GridResolvedColumnDef<T> | undefined,
  cellMeta: GridCellMeta | undefined,
  rowMeta: GridRowMeta | undefined
): boolean {
  if (!column) return true;
  return Boolean(
    column.readonly || column.editable === false || cellMeta?.readonly || rowMeta?.readonly
  );
}

/**
 * Resolve read-only from the raw sources exactly as GridBody merges them: column flags, history
 * cell meta (`cellMetaMap`), dynamic `getCellMeta`, and dynamic `getRowMeta`. For the write sinks
 * (useEditing, fill, clipboard, GridCell) that do not already hold a merged meta object.
 */
export function resolveCellReadonly<T extends object = GridRow>(
  props: Pick<GridMasterProps<T>, "getRowMeta" | "getCellMeta">,
  cellMetaMap: Record<string, GridCellMeta>,
  row: T | undefined,
  sourceRowIndex: number,
  column: GridResolvedColumnDef<T> | undefined
): boolean {
  if (!column) return true;
  if (column.readonly || column.editable === false) return true;
  if (!row || sourceRowIndex < 0) return false;
  if (cellMetaMap[createCellMetaKey(sourceRowIndex, column.key)]?.readonly) return true;
  if (props.getCellMeta?.(row, sourceRowIndex, column.key)?.readonly) return true;
  if (props.getRowMeta?.(row, sourceRowIndex)?.readonly) return true;
  return false;
}

/**
 * True when committing `rawValue` to `column` would silently destroy data: a non-blank string that a
 * built-in STRICT parse rejected (`parsed === null`). Only the number path yields null; blanks,
 * formulas and custom `parseValue` columns own their own result and are never a rejection. Shared by
 * the edit commit guard and the number editor's invalid state (A-059 / item 7) so they agree.
 */
export function isStrictParseRejection<T extends object = GridRow>(
  rawValue: unknown,
  parsedValue: unknown,
  column: GridResolvedColumnDef<T> | undefined
): boolean {
  return Boolean(
    column &&
      parsedValue === null &&
      !column.parseValue &&
      !isFormulaValue(rawValue) &&
      typeof rawValue === "string" &&
      rawValue.trim() !== ""
  );
}
