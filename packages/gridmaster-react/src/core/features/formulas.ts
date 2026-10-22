import type { GridColumnDef, GridResolvedColumnDef, GridRow } from "../types";
import {
  cellAddress,
  columnLetter,
  formatCellValue,
  getRowValue,
  isFormulaValue,
  normalizeValue,
  parseColumnLetter,
} from "../utils";

/**
 * Strict decimal/scientific matcher. Rejects hex (`0x10`), `Infinity`, `NaN`, and other JS-ism
 * strings that `Number()` would silently accept — Excel treats those as text (#VALUE!), not numbers.
 */
const NUMERIC_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;

function strictStringToNumber(value: string): number | null {
  const text = value.trim();
  if (text === "" || !NUMERIC_RE.test(text)) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

/**
 * Coercion for function arguments that must be numbers (ROUND digits, indices, counts, ...).
 * Blanks and non-numeric text yield `fallback`; strings coerce only when strictly numeric.
 * (A-006: never route blanks through the shared `toNumber`, which maps "" to 0.)
 */
function coerceToNumber(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : fallback;
  }
  if (typeof value === "string") {
    const num = strictStringToNumber(value);
    return num ?? fallback;
  }
  return fallback;
}

/**
 * Scalar arithmetic coercion. A blank cell reference is 0 (Excel), but an empty/non-numeric string
 * is text and yields `null` (→ #VALUE!). Numeric text coerces; booleans are 1/0.
 */
function scalarToNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null || value === undefined) return 0;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === "string") return strictStringToNumber(value);
  return null;
}

/**
 * Coercion for a non-range aggregate argument. Blanks and non-numeric text are skipped (`null`),
 * matching Excel's handling of direct arguments to SUM/COUNT/AVERAGE/MIN/MAX. Range values use a
 * stricter `typeof number` rule applied at the call site (A-006).
 */
function aggregateScalarNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === "string") return strictStringToNumber(value);
  return null;
}

function coerceToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

/** `&` concatenation: blanks become "", booleans TRUE/FALSE, numbers their text form. */
function concatToString(value: unknown): string {
  return coerceToString(value);
}

type GridFormulaColumn<T extends object = GridRow> = GridColumnDef<T> | GridResolvedColumnDef<T>;

type GridFormulaTokenType =
  | "number"
  | "string"
  | "identifier"
  | "operator"
  | "paren"
  | "comma"
  | "colon"
  | "eof";

type GridFormulaToken = {
  type: GridFormulaTokenType;
  value: string;
};

type GridFormulaBinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "^"
  | "&"
  | "="
  | "<>"
  | ">"
  | ">="
  | "<"
  | "<=";

type GridFormulaAstNode =
  | { type: "NumberLiteral"; value: number }
  | { type: "StringLiteral"; value: string }
  | { type: "BooleanLiteral"; value: boolean }
  | { type: "CellRef"; ref: string }
  | { type: "RangeRef"; startRef: string; endRef: string }
  | { type: "NameRef"; name: string }
  | { type: "PercentExpression"; argument: GridFormulaAstNode }
  | {
      type: "UnaryExpression";
      operator: "+" | "-";
      argument: GridFormulaAstNode;
    }
  | {
      type: "BinaryExpression";
      operator: GridFormulaBinaryOperator;
      left: GridFormulaAstNode;
      right: GridFormulaAstNode;
    }
  | {
      type: "CallExpression";
      callee: string;
      arguments: GridFormulaAstNode[];
    };

type GridFormulaScalarResult = {
  value: unknown;
  error: string | null;
};

type GridFormulaInternalResult = GridFormulaScalarResult & {
  isRange?: boolean;
};

export type GridFormulaEvaluationResult = {
  rawValue: unknown;
  formula: string | null;
  value: unknown;
  error: string | null;
};

export type GridFormulaEvaluator<T extends object = GridRow> = {
  evaluateCell: (
    rowIndex: number,
    columnIndexOrKey: number | string,
    stack?: Set<string>
  ) => GridFormulaEvaluationResult;
  getCellValue: (rowIndex: number, columnIndexOrKey: number | string) => unknown;
  getCellDisplayString: (rowIndex: number, columnIndexOrKey: number | string) => string;
  /**
   * Diagnostic (A-040): how many times a range matrix was materialised. With per-range memoisation
   * this stays a small constant no matter how many formulas reference the same range; tests assert
   * on it instead of wall-clock time.
   */
  getRangeMaterializationCount: () => number;
};

export const GRID_FORMULA_ERROR = "#ERROR!";
export const GRID_FORMULA_CYCLE = "#CYCLE!";
export const GRID_FORMULA_REF = "#REF!";
export const GRID_FORMULA_DIV_ZERO = "#DIV/0!";
export const GRID_FORMULA_NAME = "#NAME?";
export const GRID_FORMULA_VALUE = "#VALUE!";

// Error codes that are values, not part of the public export surface.
const GRID_FORMULA_NA = "#N/A";
const GRID_FORMULA_NUM = "#NUM!";

export function insertCellReferenceIntoFormula(formula: string, reference: string): string {
  const current = String(formula ?? "");
  const trimmedStart = current.trimStart();

  if (!trimmedStart) {
    return `=${reference}`;
  }

  if (!trimmedStart.startsWith("=")) {
    return current;
  }

  const trimmedEnd = current.replace(/\s+$/, "");
  const trailingReferenceMatch = /([A-Z]+[1-9][0-9]*(?::[A-Z]+[1-9][0-9]*)?)$/i.exec(trimmedEnd);

  if (trailingReferenceMatch) {
    const matchIndex = trailingReferenceMatch.index;
    const prefix = trimmedEnd.slice(0, matchIndex);
    const previousChar = prefix.trimEnd().slice(-1);

    if (!previousChar || previousChar === "=" || "+-*/(,<>:".includes(previousChar)) {
      return `${prefix}${reference}`;
    }
  }

  return `${trimmedEnd}${reference}`;
}

export function createFormulaCellReference(rowIndex: number, columnIndex: number): string {
  return cellAddress(rowIndex, columnIndex);
}

/* =========================================================
   A-007: pure, offset-based reference rewriting

   Two transforms, both token-offset based (never a blind string replace) so text OUTSIDE the
   rewritten references — whitespace, string literals, function-name case — is preserved verbatim:

   - shiftFormulaReferences: COPY semantics (fill, paste). Relative refs move by the deltas;
     `$`-anchored parts stay put. A part pushed off the grid (row < 1 / col < A) becomes `#REF!`.
   - rewriteFormulaReferences: STRUCTURAL edits (insert/delete/move row or column). ALL refs shift,
     absolute ones included (Excel does this); deleted cells become `#REF!`; ranges shrink when an
     edge is deleted and collapse to `#REF!` only when fully deleted.

   `at`/`from`/`to` are 0-based source indices (row index, or column index in the full column order
   including hidden columns — the same axis the A1 letters map to). Both functions no-op on a value
   that is not a formula (does not start with `=`), so a plain text cell is never mangled.
   ========================================================= */

type GridRefPart = { col: number; row: number; colAbs: boolean; rowAbs: boolean };

type GridRefUnit =
  | { kind: "cell"; start: number; end: number; part: GridRefPart }
  | {
      kind: "range";
      start: number;
      end: number;
      aStart: number;
      aEnd: number;
      a: GridRefPart;
      bStart: number;
      bEnd: number;
      b: GridRefPart;
    };

export type GridFormulaRewriteEdit =
  | { type: "insert-rows"; at: number; count: number }
  | { type: "delete-rows"; at: number; count: number }
  | { type: "insert-columns"; at: number; count: number }
  | { type: "delete-columns"; at: number; count: number }
  | { type: "move-row"; from: number; to: number }
  | { type: "move-column"; from: number; to: number };

const REF_PART_RE = /^(\$?)([A-Za-z]+)(\$?)([1-9][0-9]*)$/;
const IDENT_START_RE = /[A-Za-z_$]/;
const IDENT_CHAR_RE = /[A-Za-z0-9_.$]/;
const DIGIT_RE = /[0-9]/;

function parseRefPart(text: string): GridRefPart | null {
  const parts = REF_PART_RE.exec(text);
  if (!parts) return null;
  const col = parseColumnLetter(parts[2]);
  const row = Number(parts[4]) - 1;
  if (!Number.isFinite(col) || col < 0 || row < 0) return null;
  return { col, row, colAbs: parts[1] === "$", rowAbs: parts[3] === "$" };
}

function refPartToText(part: GridRefPart): string {
  return `${part.colAbs ? "$" : ""}${columnLetter(part.col)}${part.rowAbs ? "$" : ""}${part.row + 1}`;
}

type GridRefReplacement = { start: number; end: number; text: string };

function applyReplacements(formula: string, replacements: GridRefReplacement[]): string {
  if (!replacements.length) return formula;
  // Right-to-left so earlier offsets stay valid as we splice.
  replacements.sort((left, right) => right.start - left.start);
  let out = formula;
  for (const replacement of replacements) {
    out = out.slice(0, replacement.start) + replacement.text + out.slice(replacement.end);
  }
  return out;
}

/**
 * Walks a formula and returns every cell / range reference with source offsets, skipping string
 * literals, number literals, and function names (an identifier directly followed by `(`). Ranges
 * come back as a unit (so a delete can shrink them) but keep each endpoint's own offsets, so the
 * `:` and any spacing between them is preserved.
 */
function scanFormulaReferences(formula: string): GridRefUnit[] {
  const units: GridRefUnit[] = [];
  const len = formula.length;
  let index = 0;

  const skipWhitespace = (from: number): number => {
    let cursor = from;
    while (cursor < len && /\s/.test(formula[cursor])) cursor += 1;
    return cursor;
  };

  const readIdentifier = (from: number): { start: number; end: number; text: string } | null => {
    if (from >= len || !IDENT_START_RE.test(formula[from])) return null;
    let cursor = from + 1;
    while (cursor < len && IDENT_CHAR_RE.test(formula[cursor])) cursor += 1;
    return { start: from, end: cursor, text: formula.slice(from, cursor) };
  };

  while (index < len) {
    const char = formula[index];

    if (char === '"') {
      index += 1;
      while (index < len) {
        if (formula[index] === '"') {
          if (formula[index + 1] === '"') {
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    // Number literal (so `1e3` / `.5` never leak into the identifier scanner as a false ref).
    if (DIGIT_RE.test(char) || (char === "." && DIGIT_RE.test(formula[index + 1] ?? ""))) {
      let cursor = index + 1;
      let hasDot = char === ".";
      while (cursor < len) {
        if (formula[cursor] === ".") {
          if (hasDot) break;
          hasDot = true;
          cursor += 1;
          continue;
        }
        if (!DIGIT_RE.test(formula[cursor])) break;
        cursor += 1;
      }
      if (formula[cursor] === "e" || formula[cursor] === "E") {
        const signLength = formula[cursor + 1] === "+" || formula[cursor + 1] === "-" ? 1 : 0;
        if (DIGIT_RE.test(formula[cursor + 1 + signLength] ?? "")) {
          cursor += 1 + signLength;
          while (cursor < len && DIGIT_RE.test(formula[cursor])) cursor += 1;
        }
      }
      index = cursor;
      continue;
    }

    if (IDENT_START_RE.test(char)) {
      const token = readIdentifier(index);
      if (!token) {
        index += 1;
        continue;
      }
      const part = parseRefPart(token.text);
      const afterToken = skipWhitespace(token.end);
      // Not a ref, or a function call (`SUM(`): leave it alone.
      if (!part || formula[afterToken] === "(") {
        index = token.end;
        continue;
      }
      // Range: ref `:` ref.
      if (formula[afterToken] === ":") {
        const afterColon = skipWhitespace(afterToken + 1);
        const endToken = readIdentifier(afterColon);
        const endPart = endToken ? parseRefPart(endToken.text) : null;
        if (endToken && endPart && formula[skipWhitespace(endToken.end)] !== "(") {
          units.push({
            kind: "range",
            start: token.start,
            end: endToken.end,
            aStart: token.start,
            aEnd: token.end,
            a: part,
            bStart: endToken.start,
            bEnd: endToken.end,
            b: endPart,
          });
          index = endToken.end;
          continue;
        }
      }
      units.push({ kind: "cell", start: token.start, end: token.end, part });
      index = token.end;
      continue;
    }

    index += 1;
  }

  return units;
}

function isFormulaText(value: string): boolean {
  return value.trimStart().startsWith("=");
}

function shiftPart(part: GridRefPart, rowDelta: number, colDelta: number): GridRefPart | null {
  const col = part.colAbs ? part.col : part.col + colDelta;
  const row = part.rowAbs ? part.row : part.row + rowDelta;
  if (col < 0 || row < 0) return null;
  return { col, row, colAbs: part.colAbs, rowAbs: part.rowAbs };
}

/**
 * Shifts the RELATIVE references in a formula by `(rowDelta, colDelta)` — the copy/fill/paste
 * transform. `$`-anchored parts stay fixed; a reference pushed off the top/left edge becomes
 * `#REF!` (per endpoint for ranges). Text outside references is preserved verbatim. Task 7 uses
 * this for pasted formulas with `(destRow - sourceRow, destCol - sourceCol)`.
 */
export function shiftFormulaReferences(
  formula: string,
  rowDelta: number,
  colDelta: number
): string {
  const text = String(formula ?? "");
  if (!isFormulaText(text)) return text;
  if (rowDelta === 0 && colDelta === 0) return text;

  const replacements: GridRefReplacement[] = [];
  for (const unit of scanFormulaReferences(text)) {
    if (unit.kind === "cell") {
      const shifted = shiftPart(unit.part, rowDelta, colDelta);
      replacements.push({
        start: unit.start,
        end: unit.end,
        text: shifted ? refPartToText(shifted) : GRID_FORMULA_REF,
      });
      continue;
    }
    const shiftedA = shiftPart(unit.a, rowDelta, colDelta);
    const shiftedB = shiftPart(unit.b, rowDelta, colDelta);
    replacements.push({
      start: unit.aStart,
      end: unit.aEnd,
      text: shiftedA ? refPartToText(shiftedA) : GRID_FORMULA_REF,
    });
    replacements.push({
      start: unit.bStart,
      end: unit.bEnd,
      text: shiftedB ? refPartToText(shiftedB) : GRID_FORMULA_REF,
    });
  }
  return applyReplacements(text, replacements);
}

type LineResult = number | "ref";

function insertLine(line: number, at: number, count: number): number {
  return line >= at ? line + count : line;
}

function deleteLine(line: number, at: number, count: number): LineResult {
  if (line >= at && line < at + count) return "ref";
  return line >= at + count ? line - count : line;
}

function moveLine(line: number, from: number, to: number): number {
  if (line === from) return to;
  if (from < to && line > from && line <= to) return line - 1;
  if (from > to && line >= to && line < from) return line + 1;
  return line;
}

/** Shrinks a `[lo, hi]` range for a deletion on one axis; `"ref"` when the whole range is gone. */
function deleteRange(lo: number, hi: number, at: number, count: number): [number, number] | "ref" {
  if (lo >= at && hi < at + count) return "ref";
  const newLo = lo < at ? lo : lo >= at + count ? lo - count : at;
  const newHi = hi < at ? hi : hi >= at + count ? hi - count : at - 1;
  if (newLo > newHi) return "ref";
  return [newLo, newHi];
}

/**
 * Rewrites every reference in a formula for a STRUCTURAL edit (insert/delete/move row or column).
 * Unlike {@link shiftFormulaReferences}, absolute (`$`) references shift too — matching Excel, where
 * inserting a row above `$A$1` yields `$A$2`. Deleted cells become `#REF!`; a range whose edge is
 * deleted shrinks, and collapses to `#REF!` only when deleted entirely. Text outside references
 * (whitespace, string literals, function names) is preserved verbatim.
 */
export function rewriteFormulaReferences(formula: string, edit: GridFormulaRewriteEdit): string {
  const text = String(formula ?? "");
  if (!isFormulaText(text)) return text;

  const axis: "row" | "col" =
    edit.type === "insert-rows" || edit.type === "delete-rows" || edit.type === "move-row"
      ? "row"
      : "col";
  const lineOf = (part: GridRefPart) => (axis === "row" ? part.row : part.col);
  const withLine = (part: GridRefPart, line: number): GridRefPart =>
    axis === "row" ? { ...part, row: line } : { ...part, col: line };

  const transformLine = (line: number): LineResult => {
    switch (edit.type) {
      case "insert-rows":
      case "insert-columns":
        return insertLine(line, edit.at, edit.count);
      case "delete-rows":
      case "delete-columns":
        return deleteLine(line, edit.at, edit.count);
      case "move-row":
      case "move-column":
        return moveLine(line, edit.from, edit.to);
    }
  };

  const replacements: GridRefReplacement[] = [];
  for (const unit of scanFormulaReferences(text)) {
    if (unit.kind === "cell") {
      const line = transformLine(lineOf(unit.part));
      replacements.push({
        start: unit.start,
        end: unit.end,
        text: line === "ref" ? GRID_FORMULA_REF : refPartToText(withLine(unit.part, line)),
      });
      continue;
    }

    if (edit.type === "delete-rows" || edit.type === "delete-columns") {
      const lineA = lineOf(unit.a);
      const lineB = lineOf(unit.b);
      const lo = Math.min(lineA, lineB);
      const hi = Math.max(lineA, lineB);
      const shrunk = deleteRange(lo, hi, edit.at, edit.count);
      if (shrunk === "ref") {
        replacements.push({ start: unit.start, end: unit.end, text: GRID_FORMULA_REF });
        continue;
      }
      // Preserve which endpoint was the lower bound.
      const newA = lineA <= lineB ? shrunk[0] : shrunk[1];
      const newB = lineA <= lineB ? shrunk[1] : shrunk[0];
      replacements.push({
        start: unit.aStart,
        end: unit.aEnd,
        text: refPartToText(withLine(unit.a, newA)),
      });
      replacements.push({
        start: unit.bStart,
        end: unit.bEnd,
        text: refPartToText(withLine(unit.b, newB)),
      });
      continue;
    }

    // insert / move: endpoints shift independently.
    const lineA = transformLine(lineOf(unit.a));
    const lineB = transformLine(lineOf(unit.b));
    replacements.push({
      start: unit.aStart,
      end: unit.aEnd,
      text: lineA === "ref" ? GRID_FORMULA_REF : refPartToText(withLine(unit.a, lineA)),
    });
    replacements.push({
      start: unit.bStart,
      end: unit.bEnd,
      text: lineB === "ref" ? GRID_FORMULA_REF : refPartToText(withLine(unit.b, lineB)),
    });
  }
  return applyReplacements(text, replacements);
}

function tokenizeFormula(input: string): GridFormulaToken[] {
  const tokens: GridFormulaToken[] = [];
  let index = 0;

  const isDigit = (char: string | undefined) => char !== undefined && char >= "0" && char <= "9";

  while (index < input.length) {
    const char = input[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '"') {
      let value = "";
      index += 1;

      while (index < input.length) {
        const current = input[index];
        if (current === '"') {
          if (input[index + 1] === '"') {
            value += '"';
            index += 2;
            continue;
          }

          index += 1;
          break;
        }

        value += current;
        index += 1;
      }

      tokens.push({ type: "string", value });
      continue;
    }

    // Number literal: a digit, or a dot immediately followed by a digit. Supports `1e3` / `2E-1`,
    // but only treats `e` as an exponent when digits follow (A-042: no false positives).
    if (isDigit(char) || (char === "." && isDigit(input[index + 1]))) {
      const start = index;
      let hasDot = char === ".";
      index += 1;

      while (index < input.length) {
        const current = input[index];
        if (current === ".") {
          if (hasDot) break;
          hasDot = true;
          index += 1;
          continue;
        }
        if (!isDigit(current)) break;
        index += 1;
      }

      if (input[index] === "e" || input[index] === "E") {
        const signLength = input[index + 1] === "+" || input[index + 1] === "-" ? 1 : 0;
        if (isDigit(input[index + 1 + signLength])) {
          index += 1 + signLength;
          while (isDigit(input[index])) index += 1;
        }
      }

      tokens.push({ type: "number", value: input.slice(start, index) });
      continue;
    }

    // Identifier / cell reference / function name / `$`-anchored reference. Classification happens
    // in the parser (A-042: names ending in digits like LOG10 must not become cell refs here).
    if (/[A-Za-z_$]/.test(char)) {
      const start = index;
      index += 1;

      while (index < input.length && /[A-Za-z0-9_.$]/.test(input[index])) {
        index += 1;
      }

      tokens.push({ type: "identifier", value: input.slice(start, index).toUpperCase() });
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma", value: char });
      index += 1;
      continue;
    }

    if (char === ":") {
      tokens.push({ type: "colon", value: char });
      index += 1;
      continue;
    }

    if (char === ">" || char === "<") {
      const nextChar = input[index + 1];
      if (nextChar === "=") {
        tokens.push({ type: "operator", value: `${char}=` });
        index += 2;
        continue;
      }
      if (char === "<" && nextChar === ">") {
        tokens.push({ type: "operator", value: "<>" });
        index += 2;
        continue;
      }
    }

    if ("+-*/=<>^&%".includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unexpected character "${char}" in formula.`);
  }

  tokens.push({ type: "eof", value: "" });
  return tokens;
}

const CELL_REF_RE = /^[A-Z]+[1-9][0-9]*$/;

function createFormulaParser(tokens: GridFormulaToken[]) {
  let index = 0;

  const peek = () => tokens[index] ?? tokens[tokens.length - 1];
  const next = () => {
    const token = peek();
    index += 1;
    return token;
  };
  const match = (type: GridFormulaTokenType, value?: string) => {
    const token = peek();
    if (!token || token.type !== type) return false;
    if (value !== undefined && token.value !== value) return false;
    return true;
  };
  const expect = (type: GridFormulaTokenType, value?: string) => {
    const token = next();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(`Unexpected token "${token.value}".`);
    }
    return token;
  };

  const parsePrimary = (): GridFormulaAstNode => {
    const token = peek();

    if (token.type === "number") {
      next();
      return { type: "NumberLiteral", value: Number(token.value) };
    }

    if (token.type === "string") {
      next();
      return { type: "StringLiteral", value: token.value };
    }

    if (token.type === "identifier") {
      const name = next().value;

      // Function call: any identifier directly followed by `(`.
      if (match("paren", "(")) {
        next();
        const args: GridFormulaAstNode[] = [];
        if (!match("paren", ")")) {
          do {
            args.push(parseExpression());
            if (!match("comma")) break;
            next();
          } while (!match("eof"));
        }
        expect("paren", ")");
        return { type: "CallExpression", callee: name, arguments: args };
      }

      if (name === "TRUE" || name === "FALSE") {
        return { type: "BooleanLiteral", value: name === "TRUE" };
      }

      const bare = name.replace(/\$/g, "");
      if (CELL_REF_RE.test(bare)) {
        if (match("colon")) {
          next();
          const endToken = expect("identifier");
          const endBare = endToken.value.replace(/\$/g, "");
          if (!CELL_REF_RE.test(endBare)) {
            throw new Error(`Invalid range end "${endToken.value}".`);
          }
          return { type: "RangeRef", startRef: bare, endRef: endBare };
        }
        return { type: "CellRef", ref: bare };
      }

      // Bare, unknown name (not a call, not a cell): #NAME?.
      return { type: "NameRef", name };
    }

    if (match("paren", "(")) {
      next();
      const expression = parseExpression();
      expect("paren", ")");
      return expression;
    }

    throw new Error(`Unexpected token "${token.value}".`);
  };

  // Precedence (tightest → loosest): unary(-) > % > ^ > * / > + - > & > comparison.
  const parseUnary = (): GridFormulaAstNode => {
    if (match("operator", "+") || match("operator", "-")) {
      const operator = next().value as "+" | "-";
      return { type: "UnaryExpression", operator, argument: parseUnary() };
    }
    return parsePrimary();
  };

  const parsePercent = (): GridFormulaAstNode => {
    let node = parseUnary();
    while (match("operator", "%")) {
      next();
      node = { type: "PercentExpression", argument: node };
    }
    return node;
  };

  const parseExponent = (): GridFormulaAstNode => {
    let node = parsePercent();
    // Excel `^` is LEFT-associative: 2^3^2 = (2^3)^2 = 64.
    while (match("operator", "^")) {
      next();
      node = { type: "BinaryExpression", operator: "^", left: node, right: parsePercent() };
    }
    return node;
  };

  const parseMultiplicative = (): GridFormulaAstNode => {
    let node = parseExponent();
    while (match("operator", "*") || match("operator", "/")) {
      const operator = next().value as "*" | "/";
      node = { type: "BinaryExpression", operator, left: node, right: parseExponent() };
    }
    return node;
  };

  const parseAdditive = (): GridFormulaAstNode => {
    let node = parseMultiplicative();
    while (match("operator", "+") || match("operator", "-")) {
      const operator = next().value as "+" | "-";
      node = { type: "BinaryExpression", operator, left: node, right: parseMultiplicative() };
    }
    return node;
  };

  const parseConcat = (): GridFormulaAstNode => {
    let node = parseAdditive();
    while (match("operator", "&")) {
      next();
      node = { type: "BinaryExpression", operator: "&", left: node, right: parseAdditive() };
    }
    return node;
  };

  const parseComparison = (): GridFormulaAstNode => {
    let node = parseConcat();
    while (
      match("operator", "=") ||
      match("operator", "<>") ||
      match("operator", ">") ||
      match("operator", ">=") ||
      match("operator", "<") ||
      match("operator", "<=")
    ) {
      const operator = next().value as "=" | "<>" | ">" | ">=" | "<" | "<=";
      node = { type: "BinaryExpression", operator, left: node, right: parseConcat() };
    }
    return node;
  };

  const parseExpression = (): GridFormulaAstNode => parseComparison();

  return {
    parse() {
      const ast = parseExpression();
      if (!match("eof")) {
        throw new Error(`Unexpected trailing token "${peek().value}".`);
      }
      return ast;
    },
  };
}

function parseFormulaAst(formula: string): GridFormulaAstNode {
  const expression = formula.trim().replace(/^=/, "").trim();
  if (!expression) {
    throw new Error("Empty formula.");
  }
  return createFormulaParser(tokenizeFormula(expression)).parse();
}

function cellRefToIndexes(ref: string): { rowIndex: number; columnIndex: number } | null {
  const match = /^([A-Z]+)([1-9][0-9]*)$/.exec(ref.toUpperCase());
  if (!match) return null;
  return {
    columnIndex: parseColumnLetter(match[1]),
    rowIndex: Number(match[2]) - 1,
  };
}

function isFormulaRangeValue(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function flattenInto(values: unknown[], out: unknown[]): void {
  for (const value of values) {
    if (isFormulaRangeValue(value)) {
      flattenInto(value, out);
      continue;
    }
    out.push(value);
  }
}

// Recursive flatten with no argument spread (A-041: `push(...bigArray)` throws past ~125k cells).
function flattenFormulaValues(values: unknown[]): unknown[] {
  const flattened: unknown[] = [];
  flattenInto(values, flattened);
  return flattened;
}

/** Normalise a value into a row-major matrix for the lookup functions. */
function asMatrix(value: unknown): unknown[][] {
  if (Array.isArray(value)) {
    if (value.length > 0 && Array.isArray(value[0])) return value as unknown[][];
    return [value as unknown[]];
  }
  return [[value]];
}

function coerceFormulaNumber(value: unknown): number | null {
  return scalarToNumber(value);
}

function coerceFormulaBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = normalizeValue(value).toLowerCase();
  return normalized !== "" && normalized !== "false" && normalized !== "0";
}

function compareFormulaValues(left: unknown, right: unknown): number {
  const leftNumber = coerceFormulaNumber(left);
  const rightNumber = coerceFormulaNumber(right);

  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber - rightNumber;
  }

  return normalizeValue(left).localeCompare(normalizeValue(right), undefined, {
    sensitivity: "base",
  });
}

/** Loose numeric read for lookups (numeric text counts); non-numeric text → null. */
function lookupNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") return strictStringToNumber(value);
  return null;
}

function lookupEquals(a: unknown, b: unknown): boolean {
  const na = lookupNumber(a);
  const nb = lookupNumber(b);
  if (na !== null && nb !== null) return na === nb;
  return normalizeValue(a).toLowerCase() === normalizeValue(b).toLowerCase();
}

/** Returns true when `cell` compares <= `target` (numeric when both numeric, else text). */
function lookupLessOrEqual(cell: unknown, target: unknown): boolean {
  const nc = lookupNumber(cell);
  const nt = lookupNumber(target);
  if (nc !== null && nt !== null) return nc <= nt;
  return normalizeValue(cell).toLowerCase().localeCompare(normalizeValue(target).toLowerCase()) <= 0;
}

function lookupGreaterOrEqual(cell: unknown, target: unknown): boolean {
  const nc = lookupNumber(cell);
  const nt = lookupNumber(target);
  if (nc !== null && nt !== null) return nc >= nt;
  return normalizeValue(cell).toLowerCase().localeCompare(normalizeValue(target).toLowerCase()) >= 0;
}

/**
 * Full-text wildcard match (`*` any run, `?` any one character), case-insensitive. Shared by the
 * COUNTIF-family criteria matcher and XLOOKUP/XMATCH match_mode 2. No `~` escape (known limit).
 */
function matchesWildcardPattern(value: unknown, pattern: string): boolean {
  const regexSource = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regexSource}$`, "i").test(normalizeValue(value));
}

/**
 * A lookup argument as a flat vector. A scalar is a 1-item vector; a 2-D range (both dimensions
 * above 1) is null — XLOOKUP/XMATCH take one row or one column until Phase 4 spill.
 */
function asLookupVector(value: unknown): unknown[] | null {
  if (!isFormulaRangeValue(value)) return [value];
  const matrix = asMatrix(value);
  if (matrix.length > 1 && (matrix[0]?.length ?? 0) > 1) return null;
  return flattenFormulaValues([value]);
}

/**
 * XLOOKUP/XMATCH scan: 0-based index into `values`, or null when nothing matches.
 * matchMode 0 = exact, -1 = exact or next smaller, 1 = exact or next larger, 2 = wildcard.
 * `reverse` scans last-to-first (search_mode -1/-2). Binary search modes run as this same linear
 * scan: on the sorted data they require, the answer is identical.
 */
function xLookupScan(
  lookupValue: unknown,
  values: unknown[],
  matchMode: number,
  reverse: boolean
): number | null {
  const order = values.map((_, i) => i);
  if (reverse) order.reverse();
  if (matchMode === 2) {
    const pattern = normalizeValue(lookupValue);
    for (const i of order) if (matchesWildcardPattern(values[i], pattern)) return i;
    return null;
  }
  let best: number | null = null;
  for (const i of order) {
    if (lookupEquals(values[i], lookupValue)) return i;
    if (matchMode === -1 && lookupLessOrEqual(values[i], lookupValue)) {
      if (best === null || compareFormulaValues(values[i], values[best]) > 0) best = i;
    } else if (matchMode === 1 && lookupGreaterOrEqual(values[i], lookupValue)) {
      if (best === null || compareFormulaValues(values[i], values[best]) < 0) best = i;
    }
  }
  return matchMode === 0 ? null : best;
}

function normalizeFormulaErrorResult(
  rawValue: unknown,
  formula: string | null,
  error: string
): GridFormulaEvaluationResult {
  return {
    rawValue,
    formula,
    value: error,
    error,
  };
}

function matchFormulaCriteria(value: unknown, criteria: unknown): boolean {
  if (criteria === null || criteria === undefined) return false;
  const criteriaStr = String(criteria);
  const opMatch = /^(>=|<=|<>|>|<|=)(.*)$/.exec(criteriaStr);
  if (opMatch) {
    const [, op, rhs] = opMatch;
    const left = coerceToNumber(value);
    const right = coerceToNumber(rhs);
    if (left !== null && right !== null) {
      switch (op) {
        case ">":
          return left > right;
        case ">=":
          return left >= right;
        case "<":
          return left < right;
        case "<=":
          return left <= right;
        case "<>":
          return left !== right;
        case "=":
          return left === right;
      }
    }
    const ls = normalizeValue(value).toLowerCase();
    const rs = rhs.toLowerCase();
    if (op === "=") return ls === rs;
    if (op === "<>") return ls !== rs;
    return false;
  }
  if (criteriaStr.includes("*") || criteriaStr.includes("?")) {
    return matchesWildcardPattern(value, criteriaStr);
  }
  return normalizeValue(value).toLowerCase() === criteriaStr.toLowerCase();
}

/**
 * Parses a date value without UTC pitfalls (A-043). Date-only strings (`YYYY-MM-DD`, `YYYY/MM/DD`)
 * are built from LOCAL components so they never shift a day in a negative-UTC-offset zone.
 */
function parseLocalDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const text = value.trim();
    const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(text);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/** Excel-style rounding: half away from zero, with an epsilon to fix binary-float edges (1.005). */
function excelRound(num: number, digits: number): number {
  const factor = 10 ** digits;
  const scaled = Math.abs(num) * factor;
  const rounded = Math.round(scaled + 1e-9);
  return (Math.sign(num) * rounded) / factor;
}

/**
 * Shared step of SUMIFS / COUNTIFS / AVERAGEIFS / MAXIFS / MINIFS: the row-major positions where every
 * (criteria range, criteria) pair matches. Every range (and the optional value range) must have the same
 * shape, otherwise `null` (the caller returns #VALUE!). Criteria use the same matcher as COUNTIF.
 */
function criteriaMatchPositions(
  pairs: [range: unknown, criteria: unknown][],
  valueRange?: unknown
): number[] | null {
  const shapeOf = (range: unknown): string => {
    const matrix = asMatrix(range);
    return `${matrix.length}x${matrix[0]?.length ?? 0}`;
  };
  const ranges = pairs.map(([range]) => range);
  if (valueRange !== undefined) ranges.unshift(valueRange);
  const shape = shapeOf(ranges[0]);
  if (ranges.some((range) => shapeOf(range) !== shape)) return null;

  const flat = pairs.map(([range]) => flattenFormulaValues([range]));
  const positions: number[] = [];
  for (let i = 0; i < flat[0].length; i++) {
    if (pairs.every(([, criteria], p) => matchFormulaCriteria(flat[p][i], criteria))) positions.push(i);
  }
  return positions;
}

/**
 * ROUNDUP / ROUNDDOWN / TRUNC core: scale, snap binary-float noise (same epsilon as `excelRound`,
 * so TRUNC(0.29, 2) is 0.29 and not 0.28), then take the magnitude's ceiling (`away`) or floor.
 */
function excelRoundDirected(num: number, digits: number, away: boolean): number {
  const factor = 10 ** digits;
  const scaled = Math.abs(num) * factor;
  const stepped = away ? Math.ceil(scaled - 1e-9) : Math.floor(scaled + 1e-9);
  return (Math.sign(num) * stepped) / factor || 0; // `|| 0` avoids -0
}

/** Trim float noise to Excel's 15 significant digits (LOG(1000, 10) is 3, not 2.9999999999999996). */
function roundSignificant(num: number): number {
  return Number(num.toPrecision(15));
}

function gcdPair(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y) [x, y] = [y, x % y];
  return x;
}

/** Excel caps a text result at 32,767 characters; REPT / TEXTJOIN / CONCATENATE / REPLACE give #VALUE! past it. */
const MAX_TEXT_LENGTH = 32767;

function textResult(value: string): GridFormulaScalarResult {
  if (value.length > MAX_TEXT_LENGTH) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
  return { value, error: null };
}

/**
 * [min, max] argument counts of the single-value functions (text from batch 1D, logical/date/info from 1E).
 * A wrong count or a range argument (there is no implicit intersection or spill yet) is #VALUE!. TEXTJOIN,
 * XOR, NETWORKDAYS and WORKDAY take ranges, so they check themselves.
 */
const SCALAR_ARITY = new Map<string, [min: number, max: number]>([
  ["CONCATENATE", [1, 255]],
  ["SEARCH", [2, 3]],
  ["REPLACE", [4, 4]],
  ["REPT", [2, 2]],
  ["PROPER", [1, 1]],
  ["VALUE", [1, 1]],
  ["EXACT", [2, 2]],
  ["CHAR", [1, 1]],
  ["CODE", [1, 1]],
  ["CLEAN", [1, 1]],
  ["T", [1, 1]],
  ["UNICHAR", [1, 1]],
  ["UNICODE", [1, 1]],
  ["TEXTBEFORE", [2, 6]],
  ["TEXTAFTER", [2, 6]],
  ["NUMBERVALUE", [1, 3]],
  ["FIXED", [1, 3]],
  ["DOLLAR", [1, 2]],
  ["TRUE", [0, 0]],
  ["FALSE", [0, 0]],
  ["DATEVALUE", [1, 1]],
  ["DAYS", [2, 2]],
  ["HOUR", [1, 1]],
  ["MINUTE", [1, 1]],
  ["SECOND", [1, 1]],
  ["TIME", [3, 3]],
  ["TIMEVALUE", [1, 1]],
  ["WEEKNUM", [1, 2]],
  ["ISOWEEKNUM", [1, 1]],
  ["YEARFRAC", [2, 3]],
  ["DAYS360", [2, 3]],
  ["ISEVEN", [1, 1]],
  ["ISODD", [1, 1]],
  ["N", [1, 1]],
  ["ADDRESS", [2, 5]],
]);

/** Windows-1252 characters for codes 128-159 (CHAR / CODE use the ANSI code page); unassigned codes stay C1 controls. */
const CP1252_HIGH =
  "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f" +
  "\u0090‘’“”•–—˜™š›œ\u009džŸ";

/**
 * SEARCH core: 0-based index of the leftmost case-insensitive match of a wildcard pattern in `text` at or
 * after `from`, or -1. `?` is any one character, `*` any run, `~` escapes `?` `*` `~`.
 * Not a RegExp: several `*` backtrack catastrophically (4 of them on 800 characters took 19 s). The pattern
 * is cut at its `*`s into pieces of literals and `?` (null). The first must match at the start index and each
 * later piece is taken at its leftmost spot after the one before it; that is exact because the text after
 * the match is free, and it means a missing piece rules out every later start too.
 */
function wildcardSearch(text: string, pattern: string, from: number): number {
  const pieces: (string | null)[][] = [[]];
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "~" && "?*~".includes(pattern[i + 1] ?? "")) pieces[pieces.length - 1].push(pattern[++i].toLowerCase());
    else if (ch === "*") pieces.push([]);
    else pieces[pieces.length - 1].push(ch === "?" ? null : ch.toLowerCase());
  }
  const fitsAt = (piece: (string | null)[], at: number) =>
    at + piece.length <= text.length && piece.every((ch, k) => ch === null || text[at + k].toLowerCase() === ch);
  const [head, ...rest] = pieces;
  for (let start = from; start + head.length <= text.length; start++) {
    if (!fitsAt(head, start)) continue;
    let end = start + head.length;
    for (const piece of rest) {
      let at = end;
      while (at + piece.length <= text.length && !fitsAt(piece, at)) at++;
      if (at + piece.length > text.length) return -1;
      end = at + piece.length;
    }
    return start;
  }
  return -1;
}

/**
 * VALUE / NUMBERVALUE text parser: optional sign, group separators (integer part only), one decimal
 * separator, an `e` exponent and trailing `%` signs (each divides by 100). `null` means not a number.
 */
function parseNumberText(text: string, decimal: string, group: string): number | null {
  const stripped = text.replace(/%+$/, "");
  const percents = text.length - stripped.length;
  const [whole, fraction, ...extra] = stripped.split(decimal);
  if (extra.length || fraction?.includes(group)) return null;
  const plain = whole.split(group).join("") + (fraction === undefined ? "" : `.${fraction}`);
  const num = strictStringToNumber(plain);
  return num === null ? null : num / 100 ** percents;
}

/**
 * TEXTBEFORE / TEXTAFTER core. `instance` > 0 counts delimiters from the start, < 0 from the end
 * (non-overlapping). `matchEnd` lets the end of the text (the start, counting from the end) stand in for
 * the one delimiter that is missing. Returns `null` when the instance is not found.
 */
function textAroundDelimiter(
  text: string,
  delimiter: string,
  instance: number,
  ignoreCase: boolean,
  matchEnd: boolean,
  before: boolean
): string | null {
  // ponytail: positions come from the lowercased copy, so a character whose lowercase has another length
  // (such as İ) would shift the cut; fine for ordinary text.
  const hay = ignoreCase ? text.toLowerCase() : text;
  const needle = ignoreCase ? delimiter.toLowerCase() : delimiter;
  const wanted = Math.abs(instance);
  const forward = instance > 0;
  let from = forward ? 0 : hay.length - needle.length; // forward: where to search from; backward: latest match start
  let at = -1;
  let found = 0;
  while (found < wanted) {
    at = forward ? hay.indexOf(needle, from) : from < 0 ? -1 : hay.lastIndexOf(needle, from);
    if (at < 0) break;
    found += 1;
    from = forward ? at + needle.length : at - needle.length;
  }
  let size = needle.length;
  if (found < wanted) {
    if (!matchEnd || found < wanted - 1) return null;
    at = forward ? text.length : 0; // the text boundary is the missing delimiter
    size = 0;
  }
  return before ? text.slice(0, at) : text.slice(at + size);
}

/** Excel's SIN/COS/TAN reject angles at or beyond 2^27 radians. */
const TRIG_ANGLE_LIMIT = 2 ** 27;

/**
 * Single-number math functions. A `null` result means #NUM!; argument coercion (#VALUE!) and the
 * non-finite check are done once by the caller.
 */
const UNARY_MATH_FUNCTIONS = new Map<string, (num: number) => number | null>([
  ["INT", (num) => Math.floor(num)],
  ["SIGN", (num) => Math.sign(num) || 0],
  ["EXP", (num) => Math.exp(num)],
  ["LN", (num) => (num > 0 ? Math.log(num) : null)],
  ["LOG10", (num) => (num > 0 ? Math.log10(num) : null)],
  [
    "FACT",
    (num) => {
      const n = Math.trunc(num);
      if (n < 0 || n > 170) return null; // 171! overflows a double
      let product = 1;
      for (let i = 2; i <= n; i++) product *= i;
      return product;
    },
  ],
  // EVEN / ODD round away from zero to the next even / odd integer; ODD(0) is 1.
  ["EVEN", (num) => Math.sign(num) * Math.ceil(Math.abs(num) / 2) * 2 || 0],
  [
    "ODD",
    (num) => {
      const magnitude = Math.ceil(Math.abs(num));
      return (num < 0 ? -1 : 1) * (magnitude % 2 === 0 ? magnitude + 1 : magnitude);
    },
  ],
  // Circular functions: Excel returns #NUM! for |angle| >= 2^27; inverse ones have domain limits.
  ["SIN", (num) => (Math.abs(num) < TRIG_ANGLE_LIMIT ? Math.sin(num) : null)],
  ["COS", (num) => (Math.abs(num) < TRIG_ANGLE_LIMIT ? Math.cos(num) : null)],
  ["TAN", (num) => (Math.abs(num) < TRIG_ANGLE_LIMIT ? Math.tan(num) : null)],
  ["ASIN", (num) => (Math.abs(num) <= 1 ? Math.asin(num) : null)],
  ["ACOS", (num) => (Math.abs(num) <= 1 ? Math.acos(num) : null)],
  ["ATAN", (num) => Math.atan(num)],
  ["SINH", (num) => Math.sinh(num)],
  ["COSH", (num) => Math.cosh(num)],
  ["TANH", (num) => Math.tanh(num)],
  ["ASINH", (num) => Math.asinh(num)],
  ["ACOSH", (num) => (num >= 1 ? Math.acosh(num) : null)],
  ["ATANH", (num) => (Math.abs(num) < 1 ? Math.atanh(num) : null)],
  ["DEGREES", (num) => (num * 180) / Math.PI],
  ["RADIANS", (num) => (num * Math.PI) / 180],
  ["SQRTPI", (num) => (num >= 0 ? Math.sqrt(num * Math.PI) : null)],
]);

/** Minimal TEXT() numeric formatter: decimals (`0.00`), percent (`0%`), thousands (`#,##0`). */
function formatNumberPattern(num: number, fmt: string): string {
  const decimalsOf = (pattern: string) => pattern.split(".")[1]?.match(/0/g)?.length ?? 0;
  if (fmt.includes("%")) {
    return `${(num * 100).toFixed(decimalsOf(fmt))}%`;
  }
  const decimals = decimalsOf(fmt);
  let text = num.toFixed(decimals);
  if (fmt.includes(",")) {
    const negative = text.startsWith("-");
    if (negative) text = text.slice(1);
    const [intPart, decPart] = text.split(".");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    text = `${negative ? "-" : ""}${grouped}${decPart ? `.${decPart}` : ""}`;
  }
  return text;
}

function datedif(start: Date, end: Date, unit: string): number | null {
  const msPerDay = 86400000;
  const sy = start.getFullYear();
  const sm = start.getMonth();
  const sd = start.getDate();
  const ey = end.getFullYear();
  const em = end.getMonth();
  const ed = end.getDate();
  switch (unit) {
    case "D":
      return Math.floor((end.getTime() - start.getTime()) / msPerDay);
    case "M": {
      let months = (ey - sy) * 12 + (em - sm);
      if (ed < sd) months -= 1;
      return months;
    }
    case "Y": {
      let years = ey - sy;
      if (em < sm || (em === sm && ed < sd)) years -= 1;
      return years;
    }
    case "YM": {
      let months = em - sm;
      if (ed < sd) months -= 1;
      return ((months % 12) + 12) % 12;
    }
    case "MD": {
      const anchor = new Date(ey, em, sd);
      return Math.floor((end.getTime() - anchor.getTime()) / msPerDay);
    }
    case "YD": {
      const anchor = new Date(ey, sm, sd);
      let diff = Math.floor((end.getTime() - anchor.getTime()) / msPerDay);
      if (diff < 0) {
        const anchorPrev = new Date(ey - 1, sm, sd);
        diff = Math.floor((end.getTime() - anchorPrev.getTime()) / msPerDay);
      }
      return diff;
    }
    default:
      return null;
  }
}

// ── Date / time helpers (GridCraft port batch 1E) ───────────────────────────────────────────────
// A date is an epoch-millisecond timestamp (DATE, TODAY, NOW) and a time of day is the milliseconds since
// midnight, so DATE(...) + TIME(...) is a real timestamp. Excel's day-fraction times (TIME(12,0,0) = 0.5)
// need serial dates, which the evaluator does not have yet (audit A-043).

const MS_PER_DAY = 86400000;

/** ERROR.TYPE codes. Errors with no Excel number (#ERROR!, #CYCLE!) are not listed, so they give #N/A. */
const ERROR_TYPE_CODES = new Map<string, number>([
  [GRID_FORMULA_DIV_ZERO, 2],
  [GRID_FORMULA_VALUE, 3],
  [GRID_FORMULA_REF, 4],
  [GRID_FORMULA_NAME, 5],
  [GRID_FORMULA_NUM, 6],
  [GRID_FORMULA_NA, 7],
]);

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Whole days since 1970-01-01 of a calendar day (`month` is 0-11). Built in UTC, so DST never shifts it. */
function dayNumberOf(year: number, month: number, day: number): number {
  const utc = new Date(0);
  utc.setUTCFullYear(year, month, day);
  return utc.getTime() / MS_PER_DAY;
}

/** The calendar day of a local date, as a day number: the time of day is dropped (Excel's INT of a serial). */
function dayNumber(date: Date): number {
  return dayNumberOf(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local midnight of a day number (the inverse of `dayNumber`). */
function dateFromDayNumber(day: number): Date {
  const utc = new Date(day * MS_PER_DAY);
  const local = new Date(0);
  local.setFullYear(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  local.setHours(0, 0, 0, 0);
  return local;
}

/** 0 = Sunday ... 6 = Saturday; 1970-01-01 (day 0) was a Thursday. */
function weekdayOfDay(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

function isWorkday(day: number): boolean {
  const weekday = weekdayOfDay(day);
  return weekday !== 0 && weekday !== 6;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Local midnight of a real calendar date (`month` is 1-12), or null when the month has no such day. */
function calendarDate(year: number, month: number, day: number): Date | null {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/**
 * A date written as text, or null. Year first (`2024-01-15`, `2024/1/5`), US order (`1/15/2024`, day and month
 * are not swapped), `22-May-2011`, `15 January 2024` and `Jan 15, 2024`. Unlike `new Date(text)` it rejects a
 * day the month doesn't have (2024-02-30) and loose text ("1", "abc 1").
 */
function parseDateText(text: string): Date | null {
  const input = text.trim();
  const monthOf = (name: string): number => {
    const lower = name.toLowerCase();
    return lower.length < 3 ? 0 : MONTH_NAMES.findIndex((full) => full.startsWith(lower)) + 1;
  };
  let match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(input);
  if (match) return calendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (match) return calendarDate(Number(match[3]), Number(match[1]), Number(match[2]));
  match = /^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s,]+(\d{4})$/.exec(input);
  if (match) return calendarDate(Number(match[3]), monthOf(match[2]), Number(match[1]));
  match = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(input);
  if (match) return calendarDate(Number(match[3]), monthOf(match[1]), Number(match[2]));
  return null;
}

/**
 * Text holding a date, a time or both: a date alone, `14:30`, `2:30:15 PM`, `2 pm`, or a date then a time
 * (`2024-01-15 14:30`, `2024-01-15T14:30:15`). `time` is milliseconds since midnight. Time zones are not read.
 */
function parseDateTimeText(text: string): { date: Date | null; time: number | null } | null {
  const input = text.trim();
  const dateOnly = parseDateText(input);
  if (dateOnly) return { date: dateOnly, time: null };
  const match = /^(?:(.+?)[\sT])?(\d{1,2})(?::(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*([ap]m)?$/i.exec(input);
  if (!match) return null;
  const [, datePart, hourText, minuteText, secondText, meridiem] = match;
  if (minuteText === undefined && meridiem === undefined) return null; // a bare number is not a time
  const date = datePart === undefined ? null : parseDateText(datePart);
  if (datePart !== undefined && !date) return null;
  let hour = Number(hourText);
  const minute = Number(minuteText ?? 0);
  const second = Number(secondText ?? 0);
  if (meridiem !== undefined) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0);
  }
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { date, time: ((hour * 60 + minute) * 60 + second) * 1000 };
}

/**
 * Milliseconds since midnight for HOUR / MINUTE / SECOND. Text is read as a date and/or time; a number in
 * [0, 86400000) is already a time of day (TIME's result); any other number or a Date is a timestamp, read in
 * local time. (A timestamp inside the first UTC day of 1970 therefore reads as a time of day.)
 */
function timeOfDayMs(value: unknown): number | null {
  if (typeof value === "string") {
    const parsed = parseDateTimeText(value);
    if (parsed) return parsed.time ?? 0;
  }
  const number = scalarToNumber(value);
  if (number === null) return null;
  if (number >= 0 && number < MS_PER_DAY) return Math.floor(number);
  const date = new Date(number);
  if (Number.isNaN(date.getTime())) return null;
  return ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000 + date.getMilliseconds();
}

/** WEEKNUM return_type -> the weekday a week starts on (0 = Sunday). 21 is the ISO system, handled apart. */
const WEEK_START_DAY = new Map<number, number>([
  [1, 0],
  [2, 1],
  [11, 1],
  [12, 2],
  [13, 3],
  [14, 4],
  [15, 5],
  [16, 6],
  [17, 0],
]);

/** Week 1 is the week holding 1 January; weeks start on `startDay`. */
function weekNumber(date: Date, startDay: number): number {
  const year = date.getFullYear();
  const yearStart = dayNumberOf(year, 0, 1);
  const lead = (weekdayOfDay(yearStart) - startDay + 7) % 7; // days of week 1 that fall before 1 January
  return Math.floor((dayNumber(date) - yearStart + lead) / 7) + 1;
}

/** ISO 8601 week: weeks start on Monday and week 1 holds the year's first Thursday. */
function isoWeekNumber(date: Date): number {
  const day = dayNumber(date);
  const thursday = day - ((weekdayOfDay(day) + 6) % 7) + 3; // the Thursday of this ISO week fixes its year
  const year = new Date(thursday * MS_PER_DAY).getUTCFullYear();
  return Math.floor((thursday - dayNumberOf(year, 0, 1)) / 7) + 1;
}

/**
 * Day numbers of a holiday list (a range or one date), or null when an item isn't a date. Blank items are
 * skipped. `undefined` (no argument) is an empty list.
 */
function holidayDays(value: unknown): Set<number> | null {
  const days = new Set<number>();
  if (value === undefined) return days;
  for (const item of flattenFormulaValues([value])) {
    if (item === null || item === undefined || item === "") continue;
    const date = parseLocalDate(item);
    if (!date) return null;
    days.add(dayNumber(date));
  }
  return days;
}

/** Monday-Friday days in [first, last] (day numbers, first <= last) that are not holidays. Whole weeks count at once. */
function countWorkdays(first: number, last: number, holidays: Set<number>): number {
  const weeks = Math.floor((last - first + 1) / 7);
  let count = weeks * 5;
  for (let day = first + weeks * 7; day <= last; day++) if (isWorkday(day)) count++;
  for (const holiday of holidays) if (holiday >= first && holiday <= last && isWorkday(holiday)) count--;
  return count;
}

const isLastDayOfFebruary = (date: Date): boolean =>
  date.getMonth() === 1 && date.getDate() === (isLeapYear(date.getFullYear()) ? 29 : 28);

/**
 * Days between two dates on a 360-day year (twelve 30-day months). "us" is DAYS360's default (a start on the last
 * day of February counts as the 30th); "yearfrac" is the US rule YEARFRAC basis 0 uses, which only moves a
 * February start when the end is also the last day of February; "european" caps day 31 at 30 on both dates.
 * Negative when `start` is after `end`.
 */
function days360(start: Date, end: Date, rule: "us" | "yearfrac" | "european"): number {
  let startDay = start.getDate();
  let endDay = end.getDate();
  if (rule === "european") {
    startDay = Math.min(startDay, 30);
    endDay = Math.min(endDay, 30);
  } else {
    if (rule === "yearfrac" && isLastDayOfFebruary(start) && isLastDayOfFebruary(end)) {
      startDay = 30;
      endDay = 30;
    }
    if (startDay === 31 || (rule === "us" && isLastDayOfFebruary(start))) startDay = 30;
    if (endDay === 31 && startDay === 30) endDay = 30;
  }
  return (
    (end.getFullYear() - start.getFullYear()) * 360 + (end.getMonth() - start.getMonth()) * 30 + (endDay - startDay)
  );
}

/** YEARFRAC for `first` <= `last` and basis 0-4 (30/360 US, actual/actual, actual/360, actual/365, 30/360 European). */
function yearFraction(first: Date, last: Date, basis: number): number {
  const days = dayNumber(last) - dayNumber(first);
  if (basis === 0) return days360(first, last, "yearfrac") / 360;
  if (basis === 2) return days / 360;
  if (basis === 3) return days / 365;
  if (basis === 4) return days360(first, last, "european") / 360;
  // Actual/actual: within one year of the start, the length of the year(s) touched by 29 February; beyond
  // that, the average year length from the first year through the last.
  const firstYear = first.getFullYear();
  const lastYear = last.getFullYear();
  const withinOneYear =
    firstYear === lastYear ||
    (lastYear === firstYear + 1 &&
      (last.getMonth() < first.getMonth() ||
        (last.getMonth() === first.getMonth() && last.getDate() <= first.getDate())));
  if (!withinOneYear) {
    return days / ((dayNumberOf(lastYear + 1, 0, 1) - dayNumberOf(firstYear, 0, 1)) / (lastYear - firstYear + 1));
  }
  const countsLeapDay =
    firstYear === lastYear
      ? isLeapYear(firstYear)
      : (isLeapYear(firstYear) && dayNumber(first) <= dayNumberOf(firstYear, 1, 29)) ||
        (isLeapYear(lastYear) && dayNumber(last) >= dayNumberOf(lastYear, 1, 29));
  return days / (countsLeapDay ? 366 : 365);
}

// Above this area a range is assumed to be bulk literal data and is not pre-warmed (A-039).
// ponytail: fixed cap; only matters for a huge range that also holds a deep formula chain.
const DEP_RANGE_CAP = 4096;

/** Collects the formula-cell dependencies of an AST (for iterative warm-up). */
function collectDependencies(node: GridFormulaAstNode, out: { row: number; col: number }[]): void {
  switch (node.type) {
    case "CellRef": {
      const indexes = cellRefToIndexes(node.ref);
      if (indexes) out.push({ row: indexes.rowIndex, col: indexes.columnIndex });
      return;
    }
    case "RangeRef": {
      const start = cellRefToIndexes(node.startRef);
      const end = cellRefToIndexes(node.endRef);
      if (!start || !end) return;
      const startRow = Math.min(start.rowIndex, end.rowIndex);
      const endRow = Math.max(start.rowIndex, end.rowIndex);
      const startCol = Math.min(start.columnIndex, end.columnIndex);
      const endCol = Math.max(start.columnIndex, end.columnIndex);
      if ((endRow - startRow + 1) * (endCol - startCol + 1) > DEP_RANGE_CAP) return;
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) out.push({ row: r, col: c });
      }
      return;
    }
    case "UnaryExpression":
    case "PercentExpression":
      collectDependencies(node.argument, out);
      return;
    case "BinaryExpression":
      collectDependencies(node.left, out);
      collectDependencies(node.right, out);
      return;
    case "CallExpression":
      for (const arg of node.arguments) collectDependencies(arg, out);
      return;
    default:
      return;
  }
}

export function createFormulaEvaluator<T extends object = GridRow>(
  rows: T[],
  columns: GridFormulaColumn<T>[]
): GridFormulaEvaluator<T> {
  const cache = new Map<string, GridFormulaEvaluationResult>();
  // Parsed-AST cache keyed by the raw formula string (shared between warm-up and evaluation).
  const astCache = new Map<string, GridFormulaAstNode | { error: true }>();
  // A-040: memoise materialised range matrices by coordinates so 2,000 formulas summing the same
  // 5,000-cell range build the matrix once, not once each. Only error-free matrices are cached
  // (an error result is stack-dependent — a cycle seen on one path may not exist on another).
  const rangeCache = new Map<string, unknown[][]>();
  let rangeMaterializations = 0;
  let warming = false;
  // The cell whose formula is being evaluated, for no-argument ROW()/COLUMN(). Saved and restored
  // around each evaluateCell so nested evaluation of other cells' formulas sees its own cell.
  let currentCell: { row: number; col: number } | null = null;

  const parseCached = (formula: string): GridFormulaAstNode | { error: true } => {
    const existing = astCache.get(formula);
    if (existing) return existing;
    let parsed: GridFormulaAstNode | { error: true };
    try {
      parsed = parseFormulaAst(formula);
    } catch {
      parsed = { error: true };
    }
    astCache.set(formula, parsed);
    return parsed;
  };

  const columnByKey = new Map<string, number>();
  columns.forEach((column, columnIndex) => {
    if (column && !columnByKey.has(column.key)) columnByKey.set(column.key, columnIndex);
  });

  const resolveColumnIndex = (columnIndexOrKey: number | string): number =>
    typeof columnIndexOrKey === "number"
      ? columnIndexOrKey
      : (columnByKey.get(columnIndexOrKey) ?? -1);

  const buildMatrix = (
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number,
    stack: Set<string>
  ): GridFormulaInternalResult => {
    const rangeKey = `${startRow}:${endRow}:${startCol}:${endCol}`;
    const memoised = rangeCache.get(rangeKey);
    if (memoised) return { value: memoised, error: null, isRange: true };

    rangeMaterializations += 1;
    const matrix: unknown[][] = [];
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
      const rowValues: unknown[] = [];
      for (let columnIndex = startCol; columnIndex <= endCol; columnIndex++) {
        const result = evaluateCell(rowIndex, columnIndex, stack);
        if (result.error) {
          return { value: result.error, error: result.error };
        }
        rowValues.push(result.value);
      }
      matrix.push(rowValues);
    }
    rangeCache.set(rangeKey, matrix);
    return { value: matrix, error: null, isRange: true };
  };

  const evaluateNode = (
    node: GridFormulaAstNode,
    stack: Set<string>
  ): GridFormulaInternalResult => {
    switch (node.type) {
      case "NumberLiteral":
      case "StringLiteral":
      case "BooleanLiteral":
        return { value: node.value, error: null };

      case "NameRef":
        return { value: GRID_FORMULA_NAME, error: GRID_FORMULA_NAME };

      case "CellRef": {
        const indexes = cellRefToIndexes(node.ref);
        if (!indexes) {
          return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
        }
        const result = evaluateCell(indexes.rowIndex, indexes.columnIndex, stack);
        if (result.error) {
          return { value: result.error, error: result.error };
        }
        return { value: result.value, error: null };
      }

      case "RangeRef": {
        const start = cellRefToIndexes(node.startRef);
        const end = cellRefToIndexes(node.endRef);
        if (!start || !end) {
          return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
        }
        return buildMatrix(
          Math.min(start.rowIndex, end.rowIndex),
          Math.max(start.rowIndex, end.rowIndex),
          Math.min(start.columnIndex, end.columnIndex),
          Math.max(start.columnIndex, end.columnIndex),
          stack
        );
      }

      case "PercentExpression": {
        const argument = evaluateNode(node.argument, stack);
        if (argument.error) return argument;
        if (isFormulaRangeValue(argument.value)) {
          return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
        }
        const numeric = scalarToNumber(argument.value);
        if (numeric === null) {
          return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
        }
        return { value: numeric / 100, error: null };
      }

      case "UnaryExpression": {
        const argument = evaluateNode(node.argument, stack);
        if (argument.error) return argument;
        if (isFormulaRangeValue(argument.value)) {
          return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
        }
        const numericValue = scalarToNumber(argument.value);
        if (numericValue === null) {
          return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
        }
        return { value: node.operator === "-" ? -numericValue : numericValue, error: null };
      }

      case "BinaryExpression": {
        const left = evaluateNode(node.left, stack);
        if (left.error) return left;
        const right = evaluateNode(node.right, stack);
        if (right.error) return right;

        if (isFormulaRangeValue(left.value) || isFormulaRangeValue(right.value)) {
          return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
        }

        if (node.operator === "&") {
          return { value: concatToString(left.value) + concatToString(right.value), error: null };
        }

        if (
          node.operator === "=" ||
          node.operator === "<>" ||
          node.operator === ">" ||
          node.operator === ">=" ||
          node.operator === "<" ||
          node.operator === "<="
        ) {
          const comparison = compareFormulaValues(left.value, right.value);
          let value = false;
          switch (node.operator) {
            case "=":
              value = comparison === 0;
              break;
            case "<>":
              value = comparison !== 0;
              break;
            case ">":
              value = comparison > 0;
              break;
            case ">=":
              value = comparison >= 0;
              break;
            case "<":
              value = comparison < 0;
              break;
            case "<=":
              value = comparison <= 0;
              break;
          }
          return { value, error: null };
        }

        const leftNumber = scalarToNumber(left.value);
        const rightNumber = scalarToNumber(right.value);
        if (leftNumber === null || rightNumber === null) {
          return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
        }

        switch (node.operator) {
          case "+":
            return { value: leftNumber + rightNumber, error: null };
          case "-":
            return { value: leftNumber - rightNumber, error: null };
          case "*":
            return { value: leftNumber * rightNumber, error: null };
          case "/":
            if (rightNumber === 0) {
              return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
            }
            return { value: leftNumber / rightNumber, error: null };
          case "^": {
            const power = leftNumber ** rightNumber;
            if (!Number.isFinite(power)) {
              return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            }
            return { value: power, error: null };
          }
          default:
            return { value: GRID_FORMULA_ERROR, error: GRID_FORMULA_ERROR };
        }
      }

      case "CallExpression": {
        const callee = node.callee.toUpperCase();
        const args = node.arguments;

        // ── Lazy / short-circuiting functions (evaluated before eager argument loop) ──
        switch (callee) {
          case "IF": {
            const condition = args[0]
              ? evaluateNode(args[0], stack)
              : { value: false, error: null };
            if (condition.error) return condition;
            const branch = coerceFormulaBoolean(condition.value) ? args[1] : args[2];
            if (!branch) return { value: "", error: null };
            return evaluateNode(branch, stack);
          }
          case "IFERROR": {
            const primary = evaluateNode(args[0] ?? { type: "NumberLiteral", value: 0 }, stack);
            if (!primary.error) return primary;
            if (!args[1]) return primary;
            return evaluateNode(args[1], stack);
          }
          case "IFNA": {
            const primary = evaluateNode(args[0] ?? { type: "NumberLiteral", value: 0 }, stack);
            if (primary.error === GRID_FORMULA_NA && args[1]) return evaluateNode(args[1], stack);
            return primary;
          }
          case "IFS": {
            for (let i = 0; i + 1 < args.length; i += 2) {
              const cond = evaluateNode(args[i], stack);
              if (cond.error) return cond;
              if (coerceFormulaBoolean(cond.value)) return evaluateNode(args[i + 1], stack);
            }
            return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
          }
          case "SWITCH": {
            const subject = evaluateNode(args[0] ?? { type: "NumberLiteral", value: 0 }, stack);
            if (subject.error) return subject;
            let i = 1;
            for (; i + 1 < args.length; i += 2) {
              const candidate = evaluateNode(args[i], stack);
              if (candidate.error) return candidate;
              if (lookupEquals(subject.value, candidate.value)) {
                return evaluateNode(args[i + 1], stack);
              }
            }
            if (i < args.length) return evaluateNode(args[i], stack);
            return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
          }
          case "CHOOSE": {
            const indexResult = evaluateNode(args[0] ?? { type: "NumberLiteral", value: 0 }, stack);
            if (indexResult.error) return indexResult;
            const chooseIndex = coerceToNumber(indexResult.value);
            if (chooseIndex === null || chooseIndex < 1 || chooseIndex >= args.length) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return evaluateNode(args[Math.trunc(chooseIndex)], stack);
          }
          case "ISERROR":
          case "ISERR":
          case "ISNA": {
            const inner = evaluateNode(args[0] ?? { type: "NumberLiteral", value: 0 }, stack);
            if (callee === "ISNA") return { value: inner.error === GRID_FORMULA_NA, error: null };
            if (callee === "ISERR") {
              return { value: inner.error !== null && inner.error !== GRID_FORMULA_NA, error: null };
            }
            return { value: inner.error !== null, error: null };
          }
          case "NA":
            return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
          // Info functions (batch 1E). Lazy like ISERROR: an error in the argument is an answer, not a failure.
          case "ISLOGICAL":
          case "ISNONTEXT":
          case "TYPE":
          case "ERROR.TYPE": {
            if (args.length !== 1) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            // A range reference is an array whatever its cells hold.
            if (callee === "TYPE" && args[0].type === "RangeRef") return { value: 64, error: null };
            const inner = evaluateNode(args[0], stack);
            if (callee === "ERROR.TYPE") {
              const code = inner.error === null ? undefined : ERROR_TYPE_CODES.get(inner.error);
              return code === undefined
                ? { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA }
                : { value: code, error: null };
            }
            if (callee === "TYPE") {
              if (inner.error !== null) return { value: 16, error: null };
              if (isFormulaRangeValue(inner.value)) return { value: 64, error: null };
              const kind = typeof inner.value;
              return { value: kind === "string" ? 2 : kind === "boolean" ? 4 : 1, error: null };
            }
            if (isFormulaRangeValue(inner.value)) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            const isText = inner.error === null && typeof inner.value === "string";
            const isLogical = inner.error === null && typeof inner.value === "boolean";
            return { value: callee === "ISLOGICAL" ? isLogical : !isText, error: null };
          }
          // Reference functions (batch 2). Lazy: they read the reference itself, never the cell
          // values, so an error cell or an out-of-grid range does not matter (Excel semantics).
          case "ROW":
          case "COLUMN": {
            if (args.length > 1) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            const arg = args[0];
            if (!arg) {
              if (!currentCell) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
              const own = callee === "ROW" ? currentCell.row : currentCell.col;
              return { value: own + 1, error: null };
            }
            let indexes: { rowIndex: number; columnIndex: number } | null = null;
            if (arg.type === "CellRef") {
              indexes = cellRefToIndexes(arg.ref);
            } else if (arg.type === "RangeRef") {
              const start = cellRefToIndexes(arg.startRef);
              const end = cellRefToIndexes(arg.endRef);
              if (start && end) {
                // Top-left corner: the scalar answer until arrays can spill (Phase 4).
                indexes = {
                  rowIndex: Math.min(start.rowIndex, end.rowIndex),
                  columnIndex: Math.min(start.columnIndex, end.columnIndex),
                };
              }
            } else {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            if (!indexes) return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
            return {
              value: (callee === "ROW" ? indexes.rowIndex : indexes.columnIndex) + 1,
              error: null,
            };
          }
          case "ROWS":
          case "COLUMNS": {
            if (args.length !== 1) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            const arg = args[0];
            if (arg.type === "CellRef") return { value: 1, error: null };
            if (arg.type === "RangeRef") {
              const start = cellRefToIndexes(arg.startRef);
              const end = cellRefToIndexes(arg.endRef);
              if (!start || !end) return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
              const span =
                callee === "ROWS"
                  ? Math.abs(end.rowIndex - start.rowIndex)
                  : Math.abs(end.columnIndex - start.columnIndex);
              return { value: span + 1, error: null };
            }
            // Not a reference (e.g. ROWS(TRANSPOSE(...))): evaluate and measure the value.
            const inner = evaluateNode(arg, stack);
            if (inner.error) return inner;
            const matrix = asMatrix(inner.value);
            return {
              value: callee === "ROWS" ? matrix.length : (matrix[0]?.length ?? 0),
              error: null,
            };
          }
        }

        // ── Eager argument evaluation (errors propagate) ──
        const argResults: { value: unknown; isRange: boolean }[] = [];
        for (const argument of args) {
          const result = evaluateNode(argument, stack);
          if (result.error) return result;
          argResults.push({ value: result.value, isRange: Array.isArray(result.value) });
        }
        const evaluatedArgs = argResults.map((entry) => entry.value);

        const aggregateNumbers = (): number[] => {
          const nums: number[] = [];
          for (const entry of argResults) {
            if (entry.isRange) {
              for (const value of flattenFormulaValues(entry.value as unknown[])) {
                if (typeof value === "number" && Number.isFinite(value)) nums.push(value);
              }
            } else {
              const num = aggregateScalarNumber(entry.value);
              if (num !== null) nums.push(num);
            }
          }
          return nums;
        };

        const scalarArity = SCALAR_ARITY.get(callee);
        if (
          scalarArity &&
          (evaluatedArgs.length < scalarArity[0] ||
            evaluatedArgs.length > scalarArity[1] ||
            argResults.some((entry) => entry.isRange))
        ) {
          return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
        }

        const unaryMath = UNARY_MATH_FUNCTIONS.get(callee);
        if (unaryMath) {
          const number = scalarToNumber(evaluatedArgs[0]);
          if (number === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
          const result = unaryMath(number);
          if (result === null || !Number.isFinite(result)) {
            return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
          }
          return { value: result, error: null };
        }

        switch (callee) {
          case "SUM": {
            let total = 0;
            for (const num of aggregateNumbers()) total += num;
            return { value: total, error: null };
          }

          case "AVG":
          case "AVERAGE": {
            const nums = aggregateNumbers();
            if (!nums.length) {
              return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
            }
            let total = 0;
            for (const num of nums) total += num;
            return { value: total / nums.length, error: null };
          }

          case "MIN": {
            const nums = aggregateNumbers();
            if (!nums.length) return { value: 0, error: null };
            let min = nums[0];
            for (const num of nums) if (num < min) min = num;
            return { value: min, error: null };
          }

          case "MAX": {
            const nums = aggregateNumbers();
            if (!nums.length) return { value: 0, error: null };
            let max = nums[0];
            for (const num of nums) if (num > max) max = num;
            return { value: max, error: null };
          }

          case "COUNT":
            return { value: aggregateNumbers().length, error: null };

          case "COUNTA": {
            const nonBlank = flattenFormulaValues(evaluatedArgs).filter(
              (value) => normalizeValue(value) !== ""
            ).length;
            return { value: nonBlank, error: null };
          }

          case "COUNTIF": {
            const rangeVals = flattenFormulaValues([evaluatedArgs[0]]);
            const criteria = evaluatedArgs[1];
            return {
              value: rangeVals.filter((value) => matchFormulaCriteria(value, criteria)).length,
              error: null,
            };
          }

          case "SUMIF": {
            const rangeVals = flattenFormulaValues([evaluatedArgs[0]]);
            const criteria = evaluatedArgs[1];
            const sumRange =
              evaluatedArgs[2] !== undefined ? flattenFormulaValues([evaluatedArgs[2]]) : rangeVals;
            let total = 0;
            for (let i = 0; i < rangeVals.length; i++) {
              if (matchFormulaCriteria(rangeVals[i], criteria)) {
                total += coerceToNumber(sumRange[i]) ?? 0;
              }
            }
            return { value: total, error: null };
          }

          case "AVERAGEIF": {
            const rangeVals = flattenFormulaValues([evaluatedArgs[0]]);
            const criteria = evaluatedArgs[1];
            const avgRange =
              evaluatedArgs[2] !== undefined ? flattenFormulaValues([evaluatedArgs[2]]) : rangeVals;
            const nums: number[] = [];
            for (let i = 0; i < rangeVals.length; i++) {
              if (matchFormulaCriteria(rangeVals[i], criteria)) {
                const num = coerceToNumber(avgRange[i]);
                if (num !== null) nums.push(num);
              }
            }
            if (!nums.length) return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
            return { value: nums.reduce((sum, num) => sum + num, 0) / nums.length, error: null };
          }

          case "COUNTIFS": {
            // (criteria_range1, criteria1, [criteria_range2, criteria2], ...)
            if (evaluatedArgs.length < 2 || evaluatedArgs.length % 2 !== 0) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const pairs: [unknown, unknown][] = [];
            for (let i = 0; i < evaluatedArgs.length; i += 2) {
              pairs.push([evaluatedArgs[i], evaluatedArgs[i + 1]]);
            }
            const hits = criteriaMatchPositions(pairs);
            if (!hits) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: hits.length, error: null };
          }

          case "SUMIFS":
          case "AVERAGEIFS":
          case "MAXIFS":
          case "MINIFS": {
            // (value_range, criteria_range1, criteria1, [criteria_range2, criteria2], ...)
            if (evaluatedArgs.length < 3 || evaluatedArgs.length % 2 === 0) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const pairs: [unknown, unknown][] = [];
            for (let i = 1; i < evaluatedArgs.length; i += 2) {
              pairs.push([evaluatedArgs[i], evaluatedArgs[i + 1]]);
            }
            const hits = criteriaMatchPositions(pairs, evaluatedArgs[0]);
            if (!hits) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            // Only real numbers count (text, booleans and blanks in the value range are skipped).
            const values = flattenFormulaValues([evaluatedArgs[0]]);
            const nums: number[] = [];
            for (const position of hits) {
              const value = values[position];
              if (typeof value === "number" && Number.isFinite(value)) nums.push(value);
            }
            if (callee === "AVERAGEIFS") {
              if (!nums.length) return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
              return { value: nums.reduce((sum, num) => sum + num, 0) / nums.length, error: null };
            }
            if (callee === "SUMIFS") return { value: nums.reduce((sum, num) => sum + num, 0), error: null };
            if (!nums.length) return { value: 0, error: null }; // MAXIFS / MINIFS with no match
            // Loop, not Math.max(...nums): spreading a huge array throws RangeError (see A-041).
            let best = nums[0];
            for (const num of nums) {
              if (callee === "MAXIFS" ? num > best : num < best) best = num;
            }
            return { value: best, error: null };
          }

          case "SUMPRODUCT": {
            // Arrays must share a shape; non-numeric entries count as 0 (as in Excel).
            if (!evaluatedArgs.length) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            const matrices = evaluatedArgs.map((arg) => asMatrix(arg));
            const rowCount = matrices[0].length;
            const colCount = matrices[0][0]?.length ?? 0;
            if (matrices.some((m) => m.length !== rowCount || (m[0]?.length ?? 0) !== colCount)) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            let total = 0;
            for (let r = 0; r < rowCount; r++) {
              for (let c = 0; c < colCount; c++) {
                let product = 1;
                for (const matrix of matrices) {
                  const cell = matrix[r][c];
                  product *= typeof cell === "number" && Number.isFinite(cell) ? cell : 0;
                }
                total += product;
              }
            }
            return { value: total, error: null };
          }

          case "COUNTBLANK":
            return {
              value: flattenFormulaValues([evaluatedArgs[0]]).filter(
                (value) => normalizeValue(value) === ""
              ).length,
              error: null,
            };

          case "ABS": {
            const num = scalarToNumber(evaluatedArgs[0]);
            if (num === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: Math.abs(num), error: null };
          }

          case "ROUND": {
            const number = scalarToNumber(evaluatedArgs[0]);
            const digits = coerceToNumber(evaluatedArgs[1], 0) ?? 0;
            if (number === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return { value: excelRound(number, Math.trunc(digits)), error: null };
          }

          case "CEILING": {
            const number = scalarToNumber(evaluatedArgs[0]);
            const significance = coerceToNumber(evaluatedArgs[1], 1) ?? 1;
            if (number === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            if (significance === 0) return { value: 0, error: null };
            return { value: Math.ceil(number / significance) * significance, error: null };
          }

          case "FLOOR": {
            const number = scalarToNumber(evaluatedArgs[0]);
            const significance = coerceToNumber(evaluatedArgs[1], 1) ?? 1;
            if (number === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            if (significance === 0) return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
            return { value: Math.floor(number / significance) * significance, error: null };
          }

          case "POWER": {
            const base = scalarToNumber(evaluatedArgs[0]);
            const exponent = scalarToNumber(evaluatedArgs[1]);
            if (base === null || exponent === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const power = base ** exponent;
            if (!Number.isFinite(power)) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            return { value: power, error: null };
          }

          case "SQRT": {
            const number = scalarToNumber(evaluatedArgs[0]);
            if (number === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            if (number < 0) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            return { value: Math.sqrt(number), error: null };
          }

          case "MOD": {
            const left = scalarToNumber(evaluatedArgs[0]);
            const right = scalarToNumber(evaluatedArgs[1]);
            if (left === null || right === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            if (right === 0) return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
            // Excel MOD takes the sign of the divisor: ((a % b) + b) % b.
            return { value: ((left % right) + right) % right, error: null };
          }

          case "PRODUCT": {
            const nums = aggregateNumbers();
            if (!nums.length) return { value: 0, error: null }; // Excel: no numbers => 0
            let product = 1;
            for (const num of nums) product *= num;
            if (!Number.isFinite(product)) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            return { value: product, error: null };
          }

          case "SUMSQ": {
            let total = 0;
            for (const num of aggregateNumbers()) total += num * num;
            return { value: total, error: null };
          }

          case "PI":
            return { value: Math.PI, error: null };

          case "TRUNC":
          case "ROUNDUP":
          case "ROUNDDOWN": {
            const number = scalarToNumber(evaluatedArgs[0]);
            const digits = coerceToNumber(evaluatedArgs[1], 0) ?? 0;
            if (number === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            const rounded = excelRoundDirected(number, Math.trunc(digits), callee === "ROUNDUP");
            if (!Number.isFinite(rounded)) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            return { value: rounded, error: null };
          }

          case "LOG": {
            const number = scalarToNumber(evaluatedArgs[0]);
            const base = evaluatedArgs[1] === undefined ? 10 : scalarToNumber(evaluatedArgs[1]);
            if (number === null || base === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            if (number <= 0 || base <= 0) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            if (base === 1) return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
            return { value: roundSignificant(Math.log(number) / Math.log(base)), error: null };
          }

          case "QUOTIENT": {
            const numerator = scalarToNumber(evaluatedArgs[0]);
            const denominator = scalarToNumber(evaluatedArgs[1]);
            if (numerator === null || denominator === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            if (denominator === 0) return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
            return { value: Math.trunc(numerator / denominator), error: null };
          }

          case "MROUND": {
            const number = scalarToNumber(evaluatedArgs[0]);
            const multiple = scalarToNumber(evaluatedArgs[1]);
            if (number === null || multiple === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            if (multiple === 0) return { value: 0, error: null };
            if (number * multiple < 0) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            return { value: roundSignificant(excelRound(number / multiple, 0) * multiple), error: null };
          }

          case "GCD":
          case "LCM": {
            // Non-negative integers only (decimals truncate); negatives are #NUM!.
            const nums = aggregateNumbers().map((num) => Math.trunc(num));
            if (!nums.length || nums.some((num) => num < 0)) {
              return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            }
            let result = nums[0];
            for (const num of nums.slice(1)) {
              if (callee === "GCD") result = gcdPair(result, num);
              else result = result === 0 || num === 0 ? 0 : (result / gcdPair(result, num)) * num;
            }
            if (!Number.isFinite(result)) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            return { value: result, error: null };
          }

          case "ATAN2": {
            // Excel's argument order is (x, y), the reverse of Math.atan2(y, x).
            const x = scalarToNumber(evaluatedArgs[0]);
            const y = scalarToNumber(evaluatedArgs[1]);
            if (x === null || y === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            if (x === 0 && y === 0) return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
            return { value: Math.atan2(y, x), error: null };
          }

          case "COMBIN": {
            const total = scalarToNumber(evaluatedArgs[0]);
            const chosen = scalarToNumber(evaluatedArgs[1]);
            if (total === null || chosen === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const n = Math.trunc(total);
            const k = Math.trunc(chosen);
            if (n < 0 || k < 0 || k > n) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            // Each step yields the integer C(n - m + i, i), so the running value stays exact.
            const m = Math.min(k, n - k);
            let combinations = 1;
            for (let i = 1; i <= m; i++) combinations = (combinations * (n - m + i)) / i;
            if (!Number.isFinite(combinations)) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            return { value: Math.round(combinations), error: null };
          }

          // RAND / RANDBETWEEN read Math.random() when evaluated; like NOW() they are not re-run on
          // their own, only when the sheet is re-evaluated.
          case "RAND":
            return { value: Math.random(), error: null };

          case "RANDBETWEEN": {
            const bottom = scalarToNumber(evaluatedArgs[0]);
            const top = scalarToNumber(evaluatedArgs[1]);
            if (bottom === null || top === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const low = Math.ceil(bottom);
            const high = Math.floor(top);
            if (low > high) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            return { value: low + Math.floor(Math.random() * (high - low + 1)), error: null };
          }

          case "AND":
            return { value: evaluatedArgs.every((value) => coerceFormulaBoolean(value)), error: null };

          case "OR":
            return { value: evaluatedArgs.some((value) => coerceFormulaBoolean(value)), error: null };

          case "NOT":
            return { value: !coerceFormulaBoolean(evaluatedArgs[0]), error: null };

          case "UPPER":
            return { value: coerceToString(evaluatedArgs[0]).toUpperCase(), error: null };

          case "LOWER":
            return { value: coerceToString(evaluatedArgs[0]).toLowerCase(), error: null };

          case "TRIM":
            return { value: coerceToString(evaluatedArgs[0]).trim(), error: null };

          case "LEN":
            return { value: coerceToString(evaluatedArgs[0]).length, error: null };

          case "LEFT": {
            const text = coerceToString(evaluatedArgs[0]);
            const count = evaluatedArgs[1] === undefined ? 1 : coerceToNumber(evaluatedArgs[1]);
            if (count === null || count < 0) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return { value: text.slice(0, Math.trunc(count)), error: null };
          }

          case "RIGHT": {
            const text = coerceToString(evaluatedArgs[0]);
            const count = evaluatedArgs[1] === undefined ? 1 : coerceToNumber(evaluatedArgs[1]);
            if (count === null || count < 0) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const truncated = Math.trunc(count);
            return { value: truncated === 0 ? "" : text.slice(-truncated), error: null };
          }

          case "MID": {
            const text = coerceToString(evaluatedArgs[0]);
            const start = coerceToNumber(evaluatedArgs[1]);
            const length = coerceToNumber(evaluatedArgs[2]);
            if (start === null || length === null || start < 1 || length < 0) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const from = Math.trunc(start) - 1;
            return { value: text.slice(from, from + Math.trunc(length)), error: null };
          }

          case "CONCAT":
            return { value: evaluatedArgs.map(coerceToString).join(""), error: null };

          case "TEXT": {
            const value = evaluatedArgs[0];
            const fmt = coerceToString(evaluatedArgs[1]);
            const num = scalarToNumber(value);
            if (num === null || !fmt) return { value: coerceToString(value), error: null };
            return { value: formatNumberPattern(num, fmt), error: null };
          }

          case "ISBLANK":
            return { value: evaluatedArgs[0] === null || evaluatedArgs[0] === undefined, error: null };

          case "ISNUMBER":
            return {
              value: typeof evaluatedArgs[0] === "number" && Number.isFinite(evaluatedArgs[0]),
              error: null,
            };

          case "ISTEXT":
            return { value: typeof evaluatedArgs[0] === "string", error: null };

          // ── Lookup ──────────────────────────────────────────────────
          case "MATCH": {
            const lookupValue = evaluatedArgs[0];
            const lookupArray = flattenFormulaValues([evaluatedArgs[1]]);
            const matchType = coerceToNumber(evaluatedArgs[2], 1) ?? 1;
            if (matchType === 0) {
              for (let i = 0; i < lookupArray.length; i++) {
                if (lookupEquals(lookupArray[i], lookupValue)) return { value: i + 1, error: null };
              }
              return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
            }
            if (matchType > 0) {
              // Ascending: largest value <= lookup.
              let found = -1;
              for (let i = 0; i < lookupArray.length; i++) {
                if (lookupLessOrEqual(lookupArray[i], lookupValue)) found = i;
                else break;
              }
              if (found < 0) return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
              return { value: found + 1, error: null };
            }
            // matchType < 0, descending: smallest value >= lookup.
            let found = -1;
            for (let i = 0; i < lookupArray.length; i++) {
              if (lookupGreaterOrEqual(lookupArray[i], lookupValue)) found = i;
              else break;
            }
            if (found < 0) return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
            return { value: found + 1, error: null };
          }

          case "INDEX": {
            const matrix = asMatrix(evaluatedArgs[0]);
            const rowCount = matrix.length;
            const colCount = matrix[0]?.length ?? 0;
            const rowNum = coerceToNumber(evaluatedArgs[1]);
            const colArg = evaluatedArgs[2];
            if (rowNum === null) return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
            const rowIndex = Math.trunc(rowNum);

            if (colArg === undefined) {
              if (rowCount === 1) {
                if (rowIndex < 1 || rowIndex > colCount) {
                  return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
                }
                return { value: matrix[0][rowIndex - 1], error: null };
              }
              if (colCount === 1) {
                if (rowIndex < 1 || rowIndex > rowCount) {
                  return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
                }
                return { value: matrix[rowIndex - 1][0], error: null };
              }
              return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
            }

            const colNum = coerceToNumber(colArg);
            if (colNum === null) return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
            const colIndex = Math.trunc(colNum);
            if (rowIndex < 1 || rowIndex > rowCount || colIndex < 1 || colIndex > colCount) {
              return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
            }
            return { value: matrix[rowIndex - 1][colIndex - 1], error: null };
          }

          case "VLOOKUP": {
            const lookupValue = evaluatedArgs[0];
            const matrix = asMatrix(evaluatedArgs[1]);
            const indexArg = coerceToNumber(evaluatedArgs[2]);
            const approximate = !(evaluatedArgs[3] === 0 || evaluatedArgs[3] === false);
            if (indexArg === null || indexArg < 1) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const resultIndex = Math.trunc(indexArg);
            const colCount = matrix[0]?.length ?? 0;
            if (resultIndex > colCount) {
              return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
            }

            if (!approximate) {
              for (const tableRow of matrix) {
                if (lookupEquals(tableRow[0], lookupValue)) {
                  return { value: tableRow[resultIndex - 1], error: null };
                }
              }
              return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
            }
            // Approximate (sorted ascending): largest key in column 1 that is <= lookup.
            let found = -1;
            for (let i = 0; i < matrix.length; i++) {
              if (lookupLessOrEqual(matrix[i][0], lookupValue)) found = i;
              else break;
            }
            if (found < 0) return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
            return { value: matrix[found][resultIndex - 1], error: null };
          }

          case "HLOOKUP": {
            const lookupValue = evaluatedArgs[0];
            const matrix = asMatrix(evaluatedArgs[1]);
            const indexArg = coerceToNumber(evaluatedArgs[2]);
            const approximate = !(evaluatedArgs[3] === 0 || evaluatedArgs[3] === false);
            if (indexArg === null || indexArg < 1) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const resultIndex = Math.trunc(indexArg);
            if (resultIndex > matrix.length) {
              return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
            }
            const firstRow = matrix[0] ?? [];

            if (!approximate) {
              for (let col = 0; col < firstRow.length; col++) {
                if (lookupEquals(firstRow[col], lookupValue)) {
                  return { value: matrix[resultIndex - 1][col], error: null };
                }
              }
              return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
            }
            // Approximate (sorted ascending): largest key in row 1 that is <= lookup.
            let found = -1;
            for (let col = 0; col < firstRow.length; col++) {
              if (lookupLessOrEqual(firstRow[col], lookupValue)) found = col;
              else break;
            }
            if (found < 0) return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
            return { value: matrix[resultIndex - 1][found], error: null };
          }

          case "LOOKUP": {
            if (evaluatedArgs.length < 2 || evaluatedArgs.length > 3) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const lookupValue = evaluatedArgs[0];
            let lookupVec: unknown[];
            let resultVec: unknown[];
            if (evaluatedArgs.length === 3) {
              // Vector form: result_vector must be the lookup_vector's size.
              lookupVec = flattenFormulaValues([evaluatedArgs[1]]);
              resultVec = flattenFormulaValues([evaluatedArgs[2]]);
              if (lookupVec.length !== resultVec.length) {
                return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
              }
            } else {
              // Array form: taller-or-square searches column 1 → last column; wider searches
              // row 1 → last row.
              const matrix = asMatrix(evaluatedArgs[1]);
              const colCount = matrix[0]?.length ?? 0;
              if (matrix.length >= colCount) {
                lookupVec = matrix.map((tableRow) => tableRow[0]);
                resultVec = matrix.map((tableRow) => tableRow[colCount - 1]);
              } else {
                lookupVec = matrix[0];
                resultVec = matrix[matrix.length - 1];
              }
            }
            // Always approximate (sorted ascending): largest value <= lookup.
            let found = -1;
            for (let i = 0; i < lookupVec.length; i++) {
              if (lookupLessOrEqual(lookupVec[i], lookupValue)) found = i;
              else break;
            }
            if (found < 0) return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
            return { value: resultVec[found], error: null };
          }

          case "XLOOKUP": {
            if (evaluatedArgs.length < 3 || evaluatedArgs.length > 6) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const lookupVec = asLookupVector(evaluatedArgs[1]);
            const returnVec = asLookupVector(evaluatedArgs[2]);
            if (!lookupVec || !returnVec || lookupVec.length !== returnVec.length) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const matchMode = evaluatedArgs[4] === undefined ? 0 : coerceToNumber(evaluatedArgs[4]);
            const searchMode = evaluatedArgs[5] === undefined ? 1 : coerceToNumber(evaluatedArgs[5]);
            if (
              matchMode === null ||
              ![0, -1, 1, 2].includes(matchMode) ||
              searchMode === null ||
              ![1, -1, 2, -2].includes(searchMode)
            ) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const found = xLookupScan(evaluatedArgs[0], lookupVec, matchMode, searchMode < 0);
            if (found !== null) return { value: returnVec[found], error: null };
            if (evaluatedArgs.length >= 4) return { value: evaluatedArgs[3], error: null };
            return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
          }

          case "XMATCH": {
            if (evaluatedArgs.length < 2 || evaluatedArgs.length > 4) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const lookupVec = asLookupVector(evaluatedArgs[1]);
            const matchMode = evaluatedArgs[2] === undefined ? 0 : coerceToNumber(evaluatedArgs[2]);
            const searchMode = evaluatedArgs[3] === undefined ? 1 : coerceToNumber(evaluatedArgs[3]);
            if (
              !lookupVec ||
              matchMode === null ||
              ![0, -1, 1, 2].includes(matchMode) ||
              searchMode === null ||
              ![1, -1, 2, -2].includes(searchMode)
            ) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const found = xLookupScan(evaluatedArgs[0], lookupVec, matchMode, searchMode < 0);
            if (found === null) return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
            return { value: found + 1, error: null };
          }

          case "ADDRESS": {
            // Argument count and range rejection are SCALAR_ARITY's job above.
            const rowNum = coerceToNumber(evaluatedArgs[0]);
            const colNum = coerceToNumber(evaluatedArgs[1]);
            const absNum = evaluatedArgs[2] === undefined ? 1 : coerceToNumber(evaluatedArgs[2]);
            const a1 = evaluatedArgs[3] === undefined ? true : coerceFormulaBoolean(evaluatedArgs[3]);
            if (rowNum === null || colNum === null || absNum === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const rowIndex = Math.trunc(rowNum);
            const colIndex = Math.trunc(colNum);
            const abs = Math.trunc(absNum);
            if (rowIndex < 1 || colIndex < 1 || abs < 1 || abs > 4) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            // abs: 1 = $A$1, 2 = A$1, 3 = $A1, 4 = A1. In R1C1, relative parts are bracketed.
            const rowAbs = abs === 1 || abs === 2;
            const colAbs = abs === 1 || abs === 3;
            const ref = a1
              ? `${colAbs ? "$" : ""}${columnLetter(colIndex - 1)}${rowAbs ? "$" : ""}${rowIndex}`
              : `${rowAbs ? `R${rowIndex}` : `R[${rowIndex}]`}${colAbs ? `C${colIndex}` : `C[${colIndex}]`}`;
            if (evaluatedArgs.length < 5) return { value: ref, error: null };
            const sheet = coerceToString(evaluatedArgs[4]);
            const quoted = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(sheet)
              ? sheet
              : `'${sheet.replace(/'/g, "''")}'`;
            return { value: `${quoted}!${ref}`, error: null };
          }

          case "TRANSPOSE": {
            if (evaluatedArgs.length !== 1) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            if (!argResults[0].isRange) return { value: evaluatedArgs[0], error: null };
            const matrix = asMatrix(evaluatedArgs[0]);
            const rowCount = matrix.length;
            const colCount = matrix[0]?.length ?? 0;
            // A 1×1 result is the scalar; a larger one is a range value other functions can take
            // (SUM, INDEX, ...). As a whole cell result it stays #VALUE! until Phase 4 spill.
            if (rowCount === 1 && colCount === 1) return { value: matrix[0][0], error: null };
            const transposed: unknown[][] = [];
            for (let col = 0; col < colCount; col++) {
              const outRow: unknown[] = [];
              for (let row = 0; row < rowCount; row++) outRow.push(matrix[row][col]);
              transposed.push(outRow);
            }
            return { value: transposed, error: null };
          }

          // ── Date ────────────────────────────────────────────────────
          case "TODAY":
            return { value: new Date(new Date().toDateString()).getTime(), error: null };

          case "NOW":
            return { value: Date.now(), error: null };

          case "DATE": {
            const year = coerceToNumber(evaluatedArgs[0]);
            const month = coerceToNumber(evaluatedArgs[1]);
            const day = coerceToNumber(evaluatedArgs[2]);
            if (year === null || month === null || day === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return { value: new Date(year, month - 1, day).getTime(), error: null };
          }

          case "EDATE": {
            const date = parseLocalDate(evaluatedArgs[0]);
            const months = coerceToNumber(evaluatedArgs[1]);
            if (!date || months === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            // Clamp the day to the target month's end so EDATE("2024-01-31",1) = 2024-02-29
            // instead of overflowing into March (Task 4 deferred minor).
            const targetYear = date.getFullYear();
            const targetMonth = date.getMonth() + Math.trunc(months);
            const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
            const clampedDay = Math.min(date.getDate(), lastDayOfTargetMonth);
            return {
              value: new Date(targetYear, targetMonth, clampedDay).getTime(),
              error: null,
            };
          }

          case "EOMONTH": {
            const date = parseLocalDate(evaluatedArgs[0]);
            const months = coerceToNumber(evaluatedArgs[1]);
            if (!date || months === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return {
              value: new Date(date.getFullYear(), date.getMonth() + Math.trunc(months) + 1, 0).getTime(),
              error: null,
            };
          }

          case "YEAR": {
            const date = parseLocalDate(evaluatedArgs[0]);
            if (!date) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: date.getFullYear(), error: null };
          }

          case "MONTH": {
            const date = parseLocalDate(evaluatedArgs[0]);
            if (!date) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: date.getMonth() + 1, error: null };
          }

          case "DAY": {
            const date = parseLocalDate(evaluatedArgs[0]);
            if (!date) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: date.getDate(), error: null };
          }

          case "WEEKDAY": {
            const date = parseLocalDate(evaluatedArgs[0]);
            if (!date) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: date.getDay() + 1, error: null };
          }

          case "DATEDIF": {
            const start = parseLocalDate(evaluatedArgs[0]);
            const end = parseLocalDate(evaluatedArgs[1]);
            const unit = coerceToString(evaluatedArgs[2]).toUpperCase();
            if (!start || !end) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            const result = datedif(start, end, unit);
            if (result === null) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            return { value: result, error: null };
          }

          // ── Additional Text ──────────────────────────────────────────
          case "FIND": {
            const findText = coerceToString(evaluatedArgs[0]);
            const withinText = coerceToString(evaluatedArgs[1]);
            const startNum = coerceToNumber(evaluatedArgs[2], 1) ?? 1;
            if (startNum < 1) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            const idx = withinText.indexOf(findText, Math.trunc(startNum) - 1);
            if (idx < 0) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: idx + 1, error: null };
          }

          case "SUBSTITUTE": {
            const text = coerceToString(evaluatedArgs[0]);
            const oldText = coerceToString(evaluatedArgs[1]);
            const newText = coerceToString(evaluatedArgs[2]);
            const instanceNum =
              evaluatedArgs[3] !== undefined ? coerceToNumber(evaluatedArgs[3]) : null;
            if (!oldText) return { value: text, error: null };
            if (instanceNum !== null) {
              let count = 0;
              let result = text;
              let searchFrom = 0;
              while (true) {
                const idx = result.indexOf(oldText, searchFrom);
                if (idx < 0) break;
                count += 1;
                if (count === Math.trunc(instanceNum)) {
                  result = result.slice(0, idx) + newText + result.slice(idx + oldText.length);
                  break;
                }
                searchFrom = idx + oldText.length;
              }
              return { value: result, error: null };
            }
            return { value: text.split(oldText).join(newText), error: null };
          }

          // ── Text (GridCraft port batch 1D) ───────────────────────────
          case "CONCATENATE":
            return textResult(evaluatedArgs.map(coerceToString).join(""));

          case "TEXTJOIN": {
            // (delimiter, ignore_empty, text1, [text2], ...): range items are read row by row.
            const ignoreEmpty = scalarToNumber(evaluatedArgs[1]);
            if (evaluatedArgs.length < 3 || argResults[0].isRange || ignoreEmpty === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const parts = flattenFormulaValues(evaluatedArgs.slice(2)).map(coerceToString);
            const kept = ignoreEmpty !== 0 ? parts.filter((part) => part !== "") : parts;
            return textResult(kept.join(coerceToString(evaluatedArgs[0])));
          }

          case "SEARCH": {
            const withinText = coerceToString(evaluatedArgs[1]);
            const startNum = evaluatedArgs[2] === undefined ? 1 : scalarToNumber(evaluatedArgs[2]);
            if (startNum === null || startNum < 1 || startNum > withinText.length) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const idx = wildcardSearch(withinText, coerceToString(evaluatedArgs[0]), Math.trunc(startNum) - 1);
            if (idx < 0) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: idx + 1, error: null };
          }

          case "REPLACE": {
            const text = coerceToString(evaluatedArgs[0]);
            const start = scalarToNumber(evaluatedArgs[1]);
            const count = scalarToNumber(evaluatedArgs[2]);
            if (start === null || count === null || start < 1 || count < 0) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const from = Math.trunc(start) - 1;
            return textResult(
              text.slice(0, from) + coerceToString(evaluatedArgs[3]) + text.slice(from + Math.trunc(count))
            );
          }

          case "REPT": {
            const text = coerceToString(evaluatedArgs[0]);
            const times = scalarToNumber(evaluatedArgs[1]);
            // Check the size first so a huge count never allocates.
            if (times === null || times < 0 || text.length * Math.trunc(times) > MAX_TEXT_LENGTH) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return { value: text.repeat(Math.trunc(times)), error: null };
          }

          case "PROPER":
            // Every run of letters is capitalised, so digits and apostrophes start a new word ("It'S").
            return {
              value: coerceToString(evaluatedArgs[0]).replace(
                /\p{L}+/gu,
                (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              ),
              error: null,
            };

          case "VALUE": {
            const input = evaluatedArgs[0];
            if (typeof input === "number") return { value: input, error: null };
            if (input === null || input === undefined) return { value: 0, error: null }; // blank cell
            if (typeof input !== "string") return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            // Numbers only: one leading `$` and `(1,000)` negatives are accepted; dates and times are #VALUE!
            // here (DATEVALUE / TIMEVALUE read them).
            const trimmed = input.trim();
            const negative = /^\(.*\)$/.test(trimmed);
            const unwrapped = (negative ? trimmed.slice(1, -1) : trimmed).replace(/^([+-]?)\$/, "$1");
            // "(-5)" is not a number: the parentheses already mean negative.
            const num = negative && /^[+-]/.test(unwrapped) ? null : parseNumberText(unwrapped, ".", ",");
            if (num === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: negative ? -num : num, error: null };
          }

          case "NUMBERVALUE": {
            // (text, [decimal_separator="."], [group_separator=","]): spaces are ignored; empty text is 0.
            const separator = (arg: unknown, fallback: string) => coerceToString(arg).charAt(0) || fallback;
            const decimal = separator(evaluatedArgs[1], ".");
            const group = separator(evaluatedArgs[2], ",");
            const text = coerceToString(evaluatedArgs[0]).replace(/\s+/g, "");
            if (decimal === group) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            if (text === "") return { value: 0, error: null };
            const num = parseNumberText(text, decimal, group);
            if (num === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: num, error: null };
          }

          case "EXACT":
            return {
              value: coerceToString(evaluatedArgs[0]) === coerceToString(evaluatedArgs[1]),
              error: null,
            };

          case "CHAR": {
            const code = scalarToNumber(evaluatedArgs[0]);
            const n = code === null ? 0 : Math.trunc(code);
            if (n < 1 || n > 255) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: n >= 128 && n <= 159 ? CP1252_HIGH[n - 128] : String.fromCharCode(n), error: null };
          }

          case "CODE": {
            const text = coerceToString(evaluatedArgs[0]);
            if (text === "") return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            // Windows-1252 code; a character outside it comes back as "?" (63), as in Excel. UNICODE has them all.
            const ansi = CP1252_HIGH.indexOf(text[0]);
            const code = text.charCodeAt(0);
            return { value: ansi >= 0 ? 128 + ansi : code <= 255 ? code : 63, error: null };
          }

          case "CLEAN":
            // Drops the 32 ASCII control characters (0-31), line breaks included.
            return {
              value: [...coerceToString(evaluatedArgs[0])].filter((ch) => ch.charCodeAt(0) > 31).join(""),
              error: null,
            };

          case "T":
            return { value: typeof evaluatedArgs[0] === "string" ? evaluatedArgs[0] : "", error: null };

          case "UNICHAR": {
            const code = scalarToNumber(evaluatedArgs[0]);
            const n = code === null ? 0 : Math.trunc(code);
            if (n < 1 || n > 0x10ffff) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            // A lone surrogate is not a character: #N/A, as in Excel.
            if (n >= 0xd800 && n <= 0xdfff) return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
            return { value: String.fromCodePoint(n), error: null };
          }

          case "UNICODE": {
            const code = coerceToString(evaluatedArgs[0]).codePointAt(0);
            if (code === undefined) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: code, error: null };
          }

          case "TEXTBEFORE":
          case "TEXTAFTER": {
            // (text, delimiter, [instance_num=1], [match_mode=0], [match_end=0], [if_not_found=#N/A])
            // One delimiter only (no delimiter arrays yet). Blank arguments can't be skipped: the parser has no
            // empty-argument syntax, so if_not_found needs the three before it written out.
            const text = coerceToString(evaluatedArgs[0]);
            const instance = evaluatedArgs[2] === undefined ? 1 : scalarToNumber(evaluatedArgs[2]);
            const mode = evaluatedArgs[3] === undefined ? 0 : scalarToNumber(evaluatedArgs[3]);
            const matchEnd = evaluatedArgs[4] === undefined ? 0 : scalarToNumber(evaluatedArgs[4]);
            if (
              instance === null ||
              mode === null ||
              matchEnd === null ||
              Math.trunc(instance) === 0 ||
              Math.abs(instance) > text.length ||
              (mode !== 0 && mode !== 1)
            ) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const piece = textAroundDelimiter(
              text,
              coerceToString(evaluatedArgs[1]),
              Math.trunc(instance),
              mode === 1,
              matchEnd !== 0,
              callee === "TEXTBEFORE"
            );
            if (piece !== null) return { value: piece, error: null };
            if (evaluatedArgs.length > 5) return { value: evaluatedArgs[5], error: null };
            return { value: GRID_FORMULA_NA, error: GRID_FORMULA_NA };
          }

          case "FIXED":
          case "DOLLAR": {
            // FIXED(number, [decimals=2], [no_commas=FALSE]); DOLLAR(number, [decimals=2]) adds "$" and
            // wraps a negative in parentheses. A negative `decimals` rounds left of the point.
            const number = scalarToNumber(evaluatedArgs[0]);
            const decimals = evaluatedArgs[1] === undefined ? 2 : scalarToNumber(evaluatedArgs[1]);
            const noCommas = evaluatedArgs[2] === undefined ? 0 : scalarToNumber(evaluatedArgs[2]);
            if (number === null || decimals === null || noCommas === null || decimals > 100) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const places = Math.trunc(decimals);
            const rounded = excelRound(number, places);
            const body = formatNumberPattern(
              Math.abs(rounded),
              `${noCommas !== 0 ? "0" : "#,##0"}${places > 0 ? `.${"0".repeat(places)}` : ""}`
            );
            if (callee === "FIXED") return { value: `${rounded < 0 ? "-" : ""}${body}`, error: null };
            return { value: rounded < 0 ? `($${body})` : `$${body}`, error: null };
          }

          // ── Logical, date, info (GridCraft port batch 1E) ─────────────
          case "TRUE":
            return { value: true, error: null };

          case "FALSE":
            return { value: false, error: null };

          case "XOR": {
            // TRUE when an odd number of the arguments are TRUE. A reference skips text and blanks; typed-in text
            // other than "TRUE" / "FALSE" is #VALUE!, and so is having no logical value at all.
            let seen = 0;
            let trues = 0;
            for (let i = 0; i < evaluatedArgs.length; i++) {
              const fromReference = argResults[i].isRange || args[i].type === "CellRef";
              const items = argResults[i].isRange ? flattenFormulaValues([evaluatedArgs[i]]) : [evaluatedArgs[i]];
              for (const item of items) {
                let flag: boolean | null = null;
                if (typeof item === "boolean") flag = item;
                else if (typeof item === "number") flag = item !== 0;
                else if (typeof item === "string" && !fromReference) {
                  const word = item.trim().toUpperCase();
                  if (word !== "TRUE" && word !== "FALSE") return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
                  flag = word === "TRUE";
                }
                if (flag === null) continue;
                seen += 1;
                if (flag) trues += 1;
              }
            }
            if (seen === 0) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: trues % 2 === 1, error: null };
          }

          case "DATEVALUE": {
            // Text only, as in Excel; any time in the text is dropped. See `parseDateText` for the formats.
            const parsed = typeof evaluatedArgs[0] === "string" ? parseDateTimeText(evaluatedArgs[0]) : null;
            if (!parsed?.date) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: parsed.date.getTime(), error: null };
          }

          case "TIMEVALUE": {
            // Text only; any date in the text is dropped. The result is milliseconds since midnight.
            const parsed = typeof evaluatedArgs[0] === "string" ? parseDateTimeText(evaluatedArgs[0]) : null;
            if (!parsed) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: parsed.time ?? 0, error: null };
          }

          case "DAYS": {
            // DAYS(end_date, start_date): calendar days, so the time of day never counts.
            const end = parseLocalDate(evaluatedArgs[0]);
            const start = parseLocalDate(evaluatedArgs[1]);
            if (!end || !start) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: dayNumber(end) - dayNumber(start), error: null };
          }

          case "HOUR":
          case "MINUTE":
          case "SECOND": {
            const time = timeOfDayMs(evaluatedArgs[0]);
            if (time === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            if (callee === "HOUR") return { value: Math.floor(time / 3600000), error: null };
            if (callee === "MINUTE") return { value: Math.floor(time / 60000) % 60, error: null };
            return { value: Math.floor(time / 1000) % 60, error: null };
          }

          case "TIME": {
            // TIME(hour, minute, second) as milliseconds since midnight. Each part is cut to a whole number in
            // 0-32767 and the total wraps past 24 hours (TIME(27,0,0) is 3:00).
            const hour = scalarToNumber(evaluatedArgs[0]);
            const minute = scalarToNumber(evaluatedArgs[1]);
            const second = scalarToNumber(evaluatedArgs[2]);
            if (hour === null || minute === null || second === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const h = Math.trunc(hour);
            const m = Math.trunc(minute);
            const s = Math.trunc(second);
            if ([h, m, s].some((part) => part < 0 || part > 32767)) {
              return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            }
            return { value: ((h * 3600 + m * 60 + s) % 86400) * 1000, error: null };
          }

          case "WEEKNUM": {
            // WEEKNUM(date, [return_type=1]): 1/17 Sunday start, 2/11 Monday ... 16 Saturday, 21 is ISO.
            const date = parseLocalDate(evaluatedArgs[0]);
            const type = evaluatedArgs[1] === undefined ? 1 : scalarToNumber(evaluatedArgs[1]);
            if (!date || type === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            const returnType = Math.trunc(type);
            if (returnType === 21) return { value: isoWeekNumber(date), error: null };
            const startDay = WEEK_START_DAY.get(returnType);
            if (startDay === undefined) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            return { value: weekNumber(date, startDay), error: null };
          }

          case "ISOWEEKNUM": {
            const date = parseLocalDate(evaluatedArgs[0]);
            if (!date) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: isoWeekNumber(date), error: null };
          }

          case "NETWORKDAYS":
          case "WORKDAY": {
            // (start_date, end_date | days, [holidays]); Saturday and Sunday never count and the holidays may be a range.
            const start = parseLocalDate(evaluatedArgs[0]);
            const holidays = holidayDays(evaluatedArgs[2]);
            if (evaluatedArgs.length < 2 || evaluatedArgs.length > 3 || !start || !holidays) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const first = dayNumber(start);
            if (callee === "NETWORKDAYS") {
              const end = parseLocalDate(evaluatedArgs[1]);
              if (!end) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
              const last = dayNumber(end);
              // Negative when the start is after the end; `|| 0` avoids -0.
              const count = first <= last ? countWorkdays(first, last, holidays) : -countWorkdays(last, first, holidays);
              return { value: count || 0, error: null };
            }
            const offset = scalarToNumber(evaluatedArgs[1]);
            if (offset === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            // ponytail: steps one day at a time; the cap bounds the loop (Excel's dates hold about 2.1 million workdays).
            const steps = Math.trunc(offset);
            if (Math.abs(steps) > 3000000) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            let day = first;
            for (let left = Math.abs(steps); left > 0; ) {
              day += steps < 0 ? -1 : 1;
              if (isWorkday(day) && !holidays.has(day)) left -= 1;
            }
            const result = dateFromDayNumber(day).getTime();
            if (!Number.isFinite(result)) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            return { value: result, error: null };
          }

          case "DAYS360": {
            // DAYS360(start, end, [european=FALSE]); negative when start is after end.
            const start = parseLocalDate(evaluatedArgs[0]);
            const end = parseLocalDate(evaluatedArgs[1]);
            const european = evaluatedArgs[2] === undefined ? 0 : scalarToNumber(evaluatedArgs[2]);
            if (!start || !end || european === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: days360(start, end, european !== 0 ? "european" : "us"), error: null };
          }

          case "YEARFRAC": {
            // YEARFRAC(start, end, [basis=0]); the order of the dates does not matter.
            const start = parseLocalDate(evaluatedArgs[0]);
            const end = parseLocalDate(evaluatedArgs[1]);
            const basis = evaluatedArgs[2] === undefined ? 0 : scalarToNumber(evaluatedArgs[2]);
            if (!start || !end || basis === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            const kind = Math.trunc(basis);
            if (kind < 0 || kind > 4) return { value: GRID_FORMULA_NUM, error: GRID_FORMULA_NUM };
            const [first, last] = dayNumber(start) <= dayNumber(end) ? [start, end] : [end, start];
            return { value: yearFraction(first, last, kind), error: null };
          }

          case "ISEVEN":
          case "ISODD": {
            // A number cut toward zero; text that isn't numeric and booleans are #VALUE!.
            const number = typeof evaluatedArgs[0] === "boolean" ? null : scalarToNumber(evaluatedArgs[0]);
            if (number === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            const odd = Math.trunc(number) % 2 !== 0;
            return { value: callee === "ISODD" ? odd : !odd, error: null };
          }

          case "N": {
            // Numbers pass through, TRUE/FALSE are 1/0, text (even "5") and blanks are 0.
            const value = evaluatedArgs[0];
            return { value: typeof value === "string" ? 0 : (scalarToNumber(value) ?? 0), error: null };
          }

          default:
            return { value: GRID_FORMULA_NAME, error: GRID_FORMULA_NAME };
        }
      }

      default:
        return { value: GRID_FORMULA_ERROR, error: GRID_FORMULA_ERROR };
    }
  };

  /**
   * Iterative, explicit-stack warm-up of a formula cell's transitive dependencies (A-039). It
   * populates the cache bottom-up so the recursive evaluation below never nests more than a couple
   * of levels — a 500+/arbitrary-deep chain evaluates without a JS call-stack overflow, and no
   * RangeError is ever cached.
   */
  const warmDependencies = (rootRow: number, rootColumnIndex: number): void => {
    type Frame = { row: number; col: number; expanded: boolean };
    const stack: Frame[] = [{ row: rootRow, col: rootColumnIndex, expanded: false }];
    const onStack = new Set<string>();
    const keyOf = (row: number, col: number) => `${row}::${columns[col]?.key ?? col}`;
    onStack.add(keyOf(rootRow, rootColumnIndex));

    while (stack.length) {
      const frame = stack[stack.length - 1];
      const column = columns[frame.col];
      if (!column || frame.row < 0 || frame.row >= rows.length) {
        onStack.delete(keyOf(frame.row, frame.col));
        stack.pop();
        continue;
      }
      const cacheKey = `${frame.row}::${column.key}`;
      if (cache.has(cacheKey)) {
        onStack.delete(cacheKey);
        stack.pop();
        continue;
      }
      const raw = getRowValue(rows[frame.row], column);
      if (!isFormulaValue(raw)) {
        onStack.delete(cacheKey);
        stack.pop();
        continue;
      }
      if (frame.expanded) {
        onStack.delete(cacheKey);
        stack.pop();
        // Dependencies are cached now, so this evaluation stays shallow.
        evaluateCell(frame.row, frame.col);
        continue;
      }
      frame.expanded = true;
      const parsed = parseCached(String(raw));
      if ("error" in parsed) continue;
      const deps: { row: number; col: number }[] = [];
      collectDependencies(parsed, deps);
      for (const dep of deps) {
        const depKey = keyOf(dep.row, dep.col);
        if (cache.has(`${dep.row}::${columns[dep.col]?.key ?? dep.col}`)) continue;
        if (onStack.has(depKey)) continue; // cycle edge — the recursive pass reports it
        onStack.add(depKey);
        stack.push({ row: dep.row, col: dep.col, expanded: false });
      }
    }
  };

  const evaluateCell = (
    rowIndex: number,
    columnIndexOrKey: number | string,
    stack = new Set<string>()
  ): GridFormulaEvaluationResult => {
    const columnIndex = resolveColumnIndex(columnIndexOrKey);
    const column = columnIndex >= 0 ? columns[columnIndex] : undefined;

    if (!column || rowIndex < 0 || rowIndex >= rows.length) {
      return normalizeFormulaErrorResult(null, null, GRID_FORMULA_REF);
    }

    const cacheKey = `${rowIndex}::${column.key}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    if (stack.has(cacheKey)) {
      const rawCycleValue = getRowValue(rows[rowIndex], column);
      const cycleResult = normalizeFormulaErrorResult(
        rawCycleValue,
        typeof rawCycleValue === "string" ? String(rawCycleValue) : null,
        GRID_FORMULA_CYCLE
      );
      cache.set(cacheKey, cycleResult);
      return cycleResult;
    }

    const row = rows[rowIndex];
    const rawValue = getRowValue(row, column);

    if (!isFormulaValue(rawValue)) {
      const result = { rawValue, formula: null, value: rawValue, error: null };
      cache.set(cacheKey, result);
      return result;
    }

    // Top-level (external) evaluation of an uncached formula: warm its dependency graph first so
    // deep chains resolve iteratively instead of blowing the call stack (A-039).
    if (!warming && stack.size === 0) {
      warming = true;
      try {
        warmDependencies(rowIndex, columnIndex);
      } catch {
        // warm-up is best-effort; never let it fail the actual evaluation.
      } finally {
        warming = false;
      }
      const afterWarm = cache.get(cacheKey);
      if (afterWarm) return afterWarm;
    }

    const formula = String(rawValue);
    const parsed = parseCached(formula);
    if ("error" in parsed) {
      const errorResult = normalizeFormulaErrorResult(rawValue, formula, GRID_FORMULA_ERROR);
      cache.set(cacheKey, errorResult);
      return errorResult;
    }

    const previousCell = currentCell;
    currentCell = { row: rowIndex, col: columnIndex };
    try {
      const nextStack = new Set(stack);
      nextStack.add(cacheKey);
      const evaluated = evaluateNode(parsed, nextStack);
      // A bare range as the whole result is not a scalar cell value → #VALUE! (implicit
      // intersection failure), keeping every result a primitive or an error code.
      const error =
        evaluated.error ?? (isFormulaRangeValue(evaluated.value) ? GRID_FORMULA_VALUE : null);
      const result = error
        ? normalizeFormulaErrorResult(rawValue, formula, error)
        : { rawValue, formula, value: evaluated.value, error: null };
      cache.set(cacheKey, result);
      return result;
    } catch (caught) {
      // Pathological depth: never cache a RangeError (A-039), so a later warmed re-eval can succeed.
      if (caught instanceof RangeError) {
        return normalizeFormulaErrorResult(rawValue, formula, GRID_FORMULA_ERROR);
      }
      const errorResult = normalizeFormulaErrorResult(rawValue, formula, GRID_FORMULA_ERROR);
      cache.set(cacheKey, errorResult);
      return errorResult;
    } finally {
      currentCell = previousCell;
    }
  };

  const getCellValue = (rowIndex: number, columnIndexOrKey: number | string) =>
    evaluateCell(rowIndex, columnIndexOrKey).value;

  const getCellDisplayString = (rowIndex: number, columnIndexOrKey: number | string) => {
    const result = evaluateCell(rowIndex, columnIndexOrKey);
    if (result.error) return result.error;

    const columnIndex = resolveColumnIndex(columnIndexOrKey);
    const column = columnIndex >= 0 ? columns[columnIndex] : undefined;
    const row = rows[rowIndex];

    if (!column || !row) return "";

    return formatCellValue(result.value, row, column);
  };

  return {
    evaluateCell,
    getCellValue,
    getCellDisplayString,
    getRangeMaterializationCount: () => rangeMaterializations,
  };
}

export function evaluateGridCell<T extends object = GridRow>(
  rows: T[],
  columns: GridFormulaColumn<T>[],
  rowIndex: number,
  column: GridFormulaColumn<T>
): GridFormulaEvaluationResult {
  return createFormulaEvaluator(rows, columns).evaluateCell(rowIndex, column.key);
}
