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
        case ">": return left > right;
        case ">=": return left >= right;
        case "<": return left < right;
        case "<=": return left <= right;
        case "<>": return left !== right;
        case "=": return left === right;
      }
    }
    const ls = normalizeValue(value).toLowerCase();
    const rs = rhs.toLowerCase();
    if (op === "=") return ls === rs;
    if (op === "<>") return ls !== rs;
    return false;
  }
  if (criteriaStr.includes("*") || criteriaStr.includes("?")) {
    const pattern = criteriaStr
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp(`^${pattern}$`, "i").test(normalizeValue(value));
  }
  return normalizeValue(value).toLowerCase() === criteriaStr.toLowerCase();
}

function toDateValue(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") { const d = new Date(value); return isNaN(d.getTime()) ? null : d; }
  if (typeof value === "string") { const d = new Date(value); return isNaN(d.getTime()) ? null : d; }
  return null;
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

          case "COUNTIF": {
            const rangeVals = flattenFormulaValues([evaluatedArgs[0]]);
            const criteria = evaluatedArgs[1];
            return { value: rangeVals.filter((v) => matchFormulaCriteria(v, criteria)).length, error: null };
          }

          case "SUMIF": {
            const rangeVals = flattenFormulaValues([evaluatedArgs[0]]);
            const criteria = evaluatedArgs[1];
            const sumRange = evaluatedArgs[2] !== undefined
              ? flattenFormulaValues([evaluatedArgs[2]])
              : rangeVals;
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
            const avgRange = evaluatedArgs[2] !== undefined
              ? flattenFormulaValues([evaluatedArgs[2]])
              : rangeVals;
            const nums: number[] = [];
            for (let i = 0; i < rangeVals.length; i++) {
              if (matchFormulaCriteria(rangeVals[i], criteria)) {
                const n = coerceToNumber(avgRange[i]);
                if (n !== null) nums.push(n);
              }
            }
            if (!nums.length) return { value: GRID_FORMULA_DIV_ZERO, error: GRID_FORMULA_DIV_ZERO };
            return { value: nums.reduce((s, n) => s + n, 0) / nums.length, error: null };
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

          // ── Lookup ──────────────────────────────────────────────────
          case "MATCH": {
            const lookupValue = evaluatedArgs[0];
            const lookupArray = flattenFormulaValues([evaluatedArgs[1]]);
            const matchType = coerceToNumber(evaluatedArgs[2], 0) ?? 0;
            const lvNorm = normalizeValue(lookupValue).toLowerCase();
            for (let i = 0; i < lookupArray.length; i++) {
              const cellNorm = normalizeValue(lookupArray[i]).toLowerCase();
              if (matchType === 0 && cellNorm === lvNorm) return { value: i + 1, error: null };
              if (matchType === 1) {
                const cellNum = coerceToNumber(lookupArray[i]);
                const lvNum = coerceToNumber(lookupValue);
                if (cellNum !== null && lvNum !== null && cellNum <= lvNum) return { value: i + 1, error: null };
              }
              if (matchType === -1) {
                const cellNum = coerceToNumber(lookupArray[i]);
                const lvNum = coerceToNumber(lookupValue);
                if (cellNum !== null && lvNum !== null && cellNum >= lvNum) return { value: i + 1, error: null };
              }
            }
            return { value: "#N/A", error: "#N/A" };
          }

          case "INDEX": {
            const arr = flattenFormulaValues([evaluatedArgs[0]]);
            const rowNum = coerceToNumber(evaluatedArgs[1]) ?? 1;
            const idx = Number(rowNum) - 1;
            if (idx < 0 || idx >= arr.length) return { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
            return { value: arr[idx], error: null };
          }

          case "VLOOKUP": {
            const lookupValue = evaluatedArgs[0];
            const tableFlat = flattenFormulaValues([evaluatedArgs[1]]);
            const colIndex = coerceToNumber(evaluatedArgs[2]) ?? 1;
            const exactMatch = evaluatedArgs[3] === 0 || evaluatedArgs[3] === false;
            const lvNorm = normalizeValue(lookupValue).toLowerCase();
            // tableFlat is row-major; we don't know width here, so scan by colIndex stride
            // Best we can do without range metadata: treat tableFlat as rows of colIndex cols
            const stride = Math.max(1, Number(colIndex));
            for (let i = 0; i < tableFlat.length; i += stride) {
              const cellNorm = normalizeValue(tableFlat[i]).toLowerCase();
              if (exactMatch ? cellNorm === lvNorm : true) {
                if (!exactMatch || cellNorm === lvNorm) {
                  const colVal = tableFlat[i + Number(colIndex) - 1];
                  return colVal !== undefined
                    ? { value: colVal, error: null }
                    : { value: GRID_FORMULA_REF, error: GRID_FORMULA_REF };
                }
              }
            }
            return { value: "#N/A", error: "#N/A" };
          }

          // ── Date ────────────────────────────────────────────────────
          case "TODAY":
            return { value: new Date(new Date().toDateString()).getTime(), error: null };

          case "NOW":
            return { value: Date.now(), error: null };

          case "DATE": {
            const y = coerceToNumber(evaluatedArgs[0]);
            const m = coerceToNumber(evaluatedArgs[1]);
            const d = coerceToNumber(evaluatedArgs[2]);
            if (y === null || m === null || d === null) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: new Date(Number(y), Number(m) - 1, Number(d)).getTime(), error: null };
          }

          case "YEAR": {
            const d = toDateValue(evaluatedArgs[0]);
            if (!d) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: d.getFullYear(), error: null };
          }

          case "MONTH": {
            const d = toDateValue(evaluatedArgs[0]);
            if (!d) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: d.getMonth() + 1, error: null };
          }

          case "DAY": {
            const d = toDateValue(evaluatedArgs[0]);
            if (!d) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: d.getDate(), error: null };
          }

          case "DATEDIF": {
            const start = toDateValue(evaluatedArgs[0]);
            const end = toDateValue(evaluatedArgs[1]);
            const unit = coerceToString(evaluatedArgs[2]).toUpperCase();
            if (!start || !end) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            const msPerDay = 86400000;
            const totalDays = Math.floor((end.getTime() - start.getTime()) / msPerDay);
            switch (unit) {
              case "D": return { value: totalDays, error: null };
              case "M": {
                const months =
                  (end.getFullYear() - start.getFullYear()) * 12 +
                  (end.getMonth() - start.getMonth());
                return { value: months, error: null };
              }
              case "Y":
                return { value: end.getFullYear() - start.getFullYear(), error: null };
              default:
                return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            }
          }

          // ── Additional Text ──────────────────────────────────────────
          case "FIND": {
            const findText = coerceToString(evaluatedArgs[0]);
            const withinText = coerceToString(evaluatedArgs[1]);
            const startNum = coerceToNumber(evaluatedArgs[2], 1) ?? 1;
            const idx = withinText.indexOf(findText, Number(startNum) - 1);
            if (idx < 0) return { value: GRID_FORMULA_VALUE, error: GRID_FORMULA_VALUE };
            return { value: idx + 1, error: null };
          }

          case "SUBSTITUTE": {
            const text = coerceToString(evaluatedArgs[0]);
            const oldText = coerceToString(evaluatedArgs[1]);
            const newText = coerceToString(evaluatedArgs[2]);
            const instanceNum = evaluatedArgs[3] !== undefined ? coerceToNumber(evaluatedArgs[3]) : null;
            if (!oldText) return { value: text, error: null };
            if (instanceNum !== null) {
              let count = 0;
              let result = text;
              let searchFrom = 0;
              while (true) {
                const idx = result.indexOf(oldText, searchFrom);
                if (idx < 0) break;
                count++;
                if (count === Number(instanceNum)) {
                  result = result.slice(0, idx) + newText + result.slice(idx + oldText.length);
                  break;
                }
                searchFrom = idx + oldText.length;
              }
              return { value: result, error: null };
            }
            return { value: text.split(oldText).join(newText), error: null };
          }

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
