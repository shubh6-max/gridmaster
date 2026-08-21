import type { GridColumnDef, GridResolvedColumnDef, GridRow } from "../types";
import {
  cellAddress,
  formatCellValue,
  getRowValue,
  isFormulaValue,
  normalizeValue,
  parseColumnLetter,
  toNumber,
} from "../utils";

function coerceToNumber(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const num = toNumber(value);
  return num ?? fallback;
}

function coerceToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

type GridFormulaColumn<T extends GridRow = GridRow> =
  | GridColumnDef<T>
  | GridResolvedColumnDef<T>;

type GridFormulaTokenType =
  | "number"
  | "string"
  | "identifier"
  | "cell"
  | "operator"
  | "paren"
  | "comma"
  | "colon"
  | "eof";

type GridFormulaToken = {
  type: GridFormulaTokenType;
  value: string;
};

type GridFormulaAstNode =
  | { type: "NumberLiteral"; value: number }
  | { type: "StringLiteral"; value: string }
  | { type: "BooleanLiteral"; value: boolean }
  | { type: "CellRef"; ref: string }
  | { type: "RangeRef"; startRef: string; endRef: string }
  | {
      type: "UnaryExpression";
      operator: "+" | "-";
      argument: GridFormulaAstNode;
    }
  | {
      type: "BinaryExpression";
      operator: "+" | "-" | "*" | "/" | "=" | "<>" | ">" | ">=" | "<" | "<=";
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

export type GridFormulaEvaluator<T extends GridRow = GridRow> = {
  evaluateCell: (
    rowIndex: number,
    columnIndexOrKey: number | string,
    stack?: Set<string>
  ) => GridFormulaEvaluationResult;
  getCellValue: (rowIndex: number, columnIndexOrKey: number | string) => unknown;
  getCellDisplayString: (rowIndex: number, columnIndexOrKey: number | string) => string;
};

export const GRID_FORMULA_ERROR = "#ERROR!";
export const GRID_FORMULA_CYCLE = "#CYCLE!";
export const GRID_FORMULA_REF = "#REF!";
export const GRID_FORMULA_DIV_ZERO = "#DIV/0!";
export const GRID_FORMULA_NAME = "#NAME?";
export const GRID_FORMULA_VALUE = "#VALUE!";

export function insertCellReferenceIntoFormula(
  formula: string,
  reference: string
): string {
  const current = String(formula ?? "");
  const trimmedStart = current.trimStart();

  if (!trimmedStart) {
    return `=${reference}`;
  }

  if (!trimmedStart.startsWith("=")) {
    return current;
  }

  const trimmedEnd = current.replace(/\s+$/, "");
  const trailingReferenceMatch =
    /([A-Z]+[1-9][0-9]*(?::[A-Z]+[1-9][0-9]*)?)$/i.exec(trimmedEnd);

  if (trailingReferenceMatch) {
    const matchIndex = trailingReferenceMatch.index;
    const prefix = trimmedEnd.slice(0, matchIndex);
    const previousChar = prefix.trimEnd().slice(-1);

    if (
      !previousChar ||
      previousChar === "=" ||
      "+-*/(,<>:".includes(previousChar)
    ) {
      return `${prefix}${reference}`;
    }
  }

  return `${trimmedEnd}${reference}`;
}

export function createFormulaCellReference(
  rowIndex: number,
  columnIndex: number
): string {
  return cellAddress(rowIndex, columnIndex);
}

function tokenizeFormula(input: string): GridFormulaToken[] {
  const tokens: GridFormulaToken[] = [];
  let index = 0;

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

    if (/[0-9.]/.test(char)) {
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
        if (!/[0-9]/.test(current)) break;
        index += 1;
      }

      tokens.push({ type: "number", value: input.slice(start, index) });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;

      while (index < input.length && /[A-Za-z0-9_.]/.test(input[index])) {
        index += 1;
      }

      const value = input.slice(start, index);
      const upperValue = value.toUpperCase();

      if (/^[A-Z]+[1-9][0-9]*$/.test(upperValue)) {
        tokens.push({ type: "cell", value: upperValue });
      } else {
        tokens.push({ type: "identifier", value: upperValue });
      }
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
      if ((char === ">" || char === "<") && nextChar === "=") {
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

    if ("+-*/=<>".includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unexpected character "${char}" in formula.`);
  }

  tokens.push({ type: "eof", value: "" });
  return tokens;
}

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
      return {
        type: "NumberLiteral",
        value: Number(token.value),
      };
    }

    if (token.type === "string") {
      next();
      return {
        type: "StringLiteral",
        value: token.value,
      };
    }

    if (token.type === "cell") {
      const startToken = next();
      if (match("colon")) {
        next();
        const endToken = expect("cell");
        return {
          type: "RangeRef",
          startRef: startToken.value,
          endRef: endToken.value,
        };
      }

      return {
        type: "CellRef",
        ref: startToken.value,
      };
    }

    if (token.type === "identifier") {
      const identifier = next().value;

      if (identifier === "TRUE" || identifier === "FALSE") {
        return {
          type: "BooleanLiteral",
          value: identifier === "TRUE",
        };
      }

      if (!match("paren", "(")) {
        throw new Error(`Unknown identifier "${identifier}".`);
      }

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

      return {
        type: "CallExpression",
        callee: identifier,
        arguments: args,
      };
    }

    if (match("paren", "(")) {
      next();
      const expression = parseExpression();
      expect("paren", ")");
      return expression;
    }

    throw new Error(`Unexpected token "${token.value}".`);
  };

  const parseUnary = (): GridFormulaAstNode => {
    if (match("operator", "+") || match("operator", "-")) {
      const operator = next().value as "+" | "-";
      return {
        type: "UnaryExpression",
        operator,
        argument: parseUnary(),
      };
    }

    return parsePrimary();
  };

  const parseMultiplicative = (): GridFormulaAstNode => {
    let node = parseUnary();

    while (match("operator", "*") || match("operator", "/")) {
      const operator = next().value as "*" | "/";
      node = {
        type: "BinaryExpression",
        operator,
        left: node,
        right: parseUnary(),
      };
    }

    return node;
  };

  const parseAdditive = (): GridFormulaAstNode => {
    let node = parseMultiplicative();

    while (match("operator", "+") || match("operator", "-")) {
      const operator = next().value as "+" | "-";
      node = {
        type: "BinaryExpression",
        operator,
        left: node,
        right: parseMultiplicative(),
      };
    }

    return node;
  };

  const parseComparison = (): GridFormulaAstNode => {
    let node = parseAdditive();

    while (
      match("operator", "=") ||
      match("operator", "<>") ||
      match("operator", ">") ||
      match("operator", ">=") ||
      match("operator", "<") ||
      match("operator", "<=")
    ) {
      const operator = next().value as "=" | "<>" | ">" | ">=" | "<" | "<=";
      node = {
        type: "BinaryExpression",
        operator,
        left: node,
        right: parseAdditive(),
      };
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

function flattenFormulaValues(values: unknown[]): unknown[] {
  const flattened: unknown[] = [];

  for (const value of values) {
    if (isFormulaRangeValue(value)) {
      flattened.push(...flattenFormulaValues(value));
      continue;
    }

    flattened.push(value);
  }

  return flattened;
}

function coerceFormulaNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return toNumber(value);
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

export function createFormulaEvaluator<T extends GridRow = GridRow>(
  rows: T[],
  columns: GridFormulaColumn<T>[]
): GridFormulaEvaluator<T> {
  const cache = new Map<string, GridFormulaEvaluationResult>();

  const evaluateNode = (
    node: GridFormulaAstNode,
    stack: Set<string>
  ): GridFormulaInternalResult => {
    switch (node.type) {
      case "NumberLiteral":
      case "StringLiteral":
      case "BooleanLiteral":
        return { value: node.value, error: null };

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

        const startRow = Math.min(start.rowIndex, end.rowIndex);
        const endRow = Math.max(start.rowIndex, end.rowIndex);
        const startCol = Math.min(start.columnIndex, end.columnIndex);
        const endCol = Math.max(start.columnIndex, end.columnIndex);
        const values: unknown[] = [];

        for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
          for (let columnIndex = startCol; columnIndex <= endCol; columnIndex++) {
            const result = evaluateCell(rowIndex, columnIndex, stack);
            if (result.error) {
              return { value: result.error, error: result.error };
            }
            values.push(result.value);
          }
        }

        return { value: values, error: null, isRange: true };
      }

      case "UnaryExpression": {
        const argument = evaluateNode(node.argument, stack);
        if (argument.error) return argument;
        if (isFormulaRangeValue(argument.value)) {
          return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
        }

        const numericValue = coerceFormulaNumber(argument.value);
        if (numericValue === null) {
          return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
        }

        return {
          value: node.operator === "-" ? -numericValue : numericValue,
          error: null,
        };
      }

      case "BinaryExpression": {
        const left = evaluateNode(node.left, stack);
        if (left.error) return left;
        const right = evaluateNode(node.right, stack);
        if (right.error) return right;

        if (isFormulaRangeValue(left.value) || isFormulaRangeValue(right.value)) {
          return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
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

        const leftNumber = coerceFormulaNumber(left.value);
        const rightNumber = coerceFormulaNumber(right.value);
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
          default:
            return { value: GRID_FORMULA_ERROR, error: GRID_FORMULA_ERROR };
        }
      }

      case "CallExpression": {
        const callee = node.callee.toUpperCase();

        if (callee === "IF") {
          const condition = node.arguments[0]
            ? evaluateNode(node.arguments[0], stack)
            : { value: false, error: null };
          if (condition.error) return condition;

          const branch =
            coerceFormulaBoolean(condition.value) ? node.arguments[1] : node.arguments[2];

          if (!branch) {
            return { value: "", error: null };
          }

          return evaluateNode(branch, stack);
        }

        const evaluatedArgs: unknown[] = [];
        for (const argument of node.arguments) {
          const result = evaluateNode(argument, stack);
          if (result.error) return result;
          evaluatedArgs.push(result.value);
        }

        const flatValues = flattenFormulaValues(evaluatedArgs);
        const numericValues = flatValues
          .map((value) => coerceFormulaNumber(value))
          .filter((value): value is number => value !== null);

        switch (callee) {
          case "SUM":
            return {
              value: numericValues.reduce((sum, value) => sum + value, 0),
              error: null,
            };

          case "AVG":
          case "AVERAGE":
            if (!numericValues.length) {
              return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
            }
            return {
              value:
                numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length,
              error: null,
            };

          case "MIN":
            if (!numericValues.length) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return { value: Math.min(...numericValues), error: null };

          case "MAX":
            if (!numericValues.length) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return { value: Math.max(...numericValues), error: null };

          case "COUNT":
            return { value: numericValues.length, error: null };

          case "COUNTA": {
            const nonBlank = flatValues.filter((value) => {
              const normalized = normalizeValue(value);
              return normalized !== "";
            }).length;
            return { value: nonBlank, error: null };
          }

          case "ABS":
            return {
              value: Math.abs(numericValues[0] ?? 0),
              error: null,
            };

          case "ROUND": {
            const number = coerceToNumber(evaluatedArgs[0]);
            const digits = coerceToNumber(evaluatedArgs[1], 0) ?? 0;
            if (number === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            const factor = Math.pow(10, Number(digits));
            return { value: Math.round(number * factor) / factor, error: null };
          }

          case "CEILING": {
            const number = coerceToNumber(evaluatedArgs[0]);
            const significance = coerceToNumber(evaluatedArgs[1], 1) ?? 1;
            if (number === null || significance === 0) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return { value: Math.ceil(number / significance) * significance, error: null };
          }

          case "FLOOR": {
            const number = coerceToNumber(evaluatedArgs[0]);
            const significance = coerceToNumber(evaluatedArgs[1], 1) ?? 1;
            if (number === null || significance === 0) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return { value: Math.floor(number / significance) * significance, error: null };
          }

          case "POWER": {
            const base = coerceToNumber(evaluatedArgs[0]);
            const exponent = coerceToNumber(evaluatedArgs[1]);
            if (base === null || exponent === null) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return { value: Math.pow(base, exponent), error: null };
          }

          case "SQRT": {
            const number = coerceToNumber(evaluatedArgs[0]);
            if (number === null || number < 0) {
              return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
            return { value: Math.sqrt(number), error: null };
          }

          case "MOD": {
            const left = coerceToNumber(evaluatedArgs[0]);
            const right = coerceToNumber(evaluatedArgs[1]);
            if (left === null || right === null || right === 0) {
              return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
            }
            return { value: left % right, error: null };
          }

          case "AND": {
            const result = evaluatedArgs.every((value) => coerceFormulaBoolean(value));
            return { value: result, error: null };
          }

          case "OR": {
            const result = evaluatedArgs.some((value) => coerceFormulaBoolean(value));
            return { value: result, error: null };
          }

          case "NOT": {
            const value = coerceFormulaBoolean(evaluatedArgs[0]);
            return { value: !value, error: null };
          }

          case "IFERROR": {
            const primary = evaluateNode(node.arguments[0] ?? { type: "NumberLiteral", value: 0 }, stack);
            if (!primary.error) return primary;
            const fallback = node.arguments[1];
            if (!fallback) return { value: primary.error, error: primary.error };
            return evaluateNode(fallback, stack);
          }

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
            const count = coerceToNumber(evaluatedArgs[1], text.length) ?? text.length;
            return { value: text.slice(0, Number(count)), error: null };
          }

          case "RIGHT": {
            const text = coerceToString(evaluatedArgs[0]);
            const count = coerceToNumber(evaluatedArgs[1], text.length) ?? text.length;
            return { value: text.slice(-Number(count)), error: null };
          }

          case "MID": {
            const text = coerceToString(evaluatedArgs[0]);
            const start = coerceToNumber(evaluatedArgs[1], 1) ?? 1;
            const length = coerceToNumber(evaluatedArgs[2], 0) ?? 0;
            const index = Number(start) - 1;
            return { value: text.slice(index, index + Number(length)), error: null };
          }

          case "CONCAT":
            return { value: evaluatedArgs.map(coerceToString).join(""), error: null };

          case "TEXT": {
            const value = evaluatedArgs[0];
            return { value: coerceToString(value), error: null };
          }

          case "ISBLANK":
            return { value: normalizeValue(evaluatedArgs[0]) === "", error: null };

          case "ISNUMBER":
            return { value: coerceToNumber(evaluatedArgs[0], null) !== null, error: null };

          case "ISTEXT":
            return { value: typeof evaluatedArgs[0] === "string", error: null };

          default:
            return { value: GRID_FORMULA_NAME, error: GRID_FORMULA_NAME };
        }
      }

      default:
        return { value: GRID_FORMULA_ERROR, error: GRID_FORMULA_ERROR };
    }
  };

  const evaluateCell = (
    rowIndex: number,
    columnIndexOrKey: number | string,
    stack = new Set<string>()
  ): GridFormulaEvaluationResult => {
    const column =
      typeof columnIndexOrKey === "number"
        ? columns[columnIndexOrKey]
        : columns.find((item) => item.key === columnIndexOrKey);

    if (!column || rowIndex < 0 || rowIndex >= rows.length) {
      return normalizeFormulaErrorResult(null, null, GRID_FORMULA_REF);
    }

    const cacheKey = `${rowIndex}::${column.key}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    if (stack.has(cacheKey)) {
      const cycleResult = normalizeFormulaErrorResult(
        getRowValue(rows[rowIndex], column),
        typeof getRowValue(rows[rowIndex], column) === "string"
          ? String(getRowValue(rows[rowIndex], column))
          : null,
        GRID_FORMULA_CYCLE
      );
      cache.set(cacheKey, cycleResult);
      return cycleResult;
    }

    const row = rows[rowIndex];
    const rawValue = getRowValue(row, column);

    if (!isFormulaValue(rawValue)) {
      const result = {
        rawValue,
        formula: null,
        value: rawValue,
        error: null,
      };
      cache.set(cacheKey, result);
      return result;
    }

    try {
      const nextStack = new Set(stack);
      nextStack.add(cacheKey);
      const formula = String(rawValue);
      const ast = parseFormulaAst(formula);
      const evaluated = evaluateNode(ast, nextStack);
      const result = evaluated.error
        ? normalizeFormulaErrorResult(rawValue, formula, evaluated.error)
        : {
            rawValue,
            formula,
            value: evaluated.value,
            error: null,
          };
      cache.set(cacheKey, result);
      return result;
    } catch {
      const errorResult = normalizeFormulaErrorResult(
        rawValue,
        String(rawValue),
        GRID_FORMULA_ERROR
      );
      cache.set(cacheKey, errorResult);
      return errorResult;
    }
  };

  const getCellValue = (rowIndex: number, columnIndexOrKey: number | string) =>
    evaluateCell(rowIndex, columnIndexOrKey).value;

  const getCellDisplayString = (rowIndex: number, columnIndexOrKey: number | string) => {
    const result = evaluateCell(rowIndex, columnIndexOrKey);
    if (result.error) return result.error;

    const column =
      typeof columnIndexOrKey === "number"
        ? columns[columnIndexOrKey]
        : columns.find((item) => item.key === columnIndexOrKey);
    const row = rows[rowIndex];

    if (!column || !row) return "";

    return formatCellValue(result.value, row, column);
  };

  return {
    evaluateCell,
    getCellValue,
    getCellDisplayString,
  };
}

export function evaluateGridCell<T extends GridRow = GridRow>(
  rows: T[],
  columns: GridFormulaColumn<T>[],
  rowIndex: number,
  column: GridFormulaColumn<T>
): GridFormulaEvaluationResult {
  return createFormulaEvaluator(rows, columns).evaluateCell(rowIndex, column.key);
}
