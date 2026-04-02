import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createColumn,
  createConditionFilter,
  createFormulaEvaluator,
  evaluateGridCell,
  getDisplayRowIndexes,
  resolveColumns,
} = require("../dist/index.cjs");

export function runFormulaTests() {
  const columns = resolveColumns([
    createColumn.number("base", { title: "Base" }),
    createColumn.number("delta", { title: "Delta" }),
    createColumn.number("result", { title: "Result" }),
  ]);

  const rows = [
    { base: 10, delta: 20, result: "=A1+B1" },
    { base: 15, delta: 5, result: "=SUM(A1:A2)" },
    { base: 40, delta: 0, result: "=IF(B3=0,A3,999)" },
  ];

  const evaluator = createFormulaEvaluator(rows, columns);

  assert.deepEqual(evaluateGridCell(rows, columns, 0, columns[2]), {
    rawValue: "=A1+B1",
    formula: "=A1+B1",
    value: 30,
    error: null,
  });
  assert.equal(evaluator.getCellValue(1, "result"), 25);
  assert.equal(evaluator.getCellValue(2, "result"), 40);

  const filteredIndexes = getDisplayRowIndexes(
    rows,
    columns,
    {
      result: createConditionFilter("gt", 26),
    },
    null,
    {
      enableFiltering: true,
      enableSorting: false,
    }
  );
  assert.deepEqual(filteredIndexes, [0, 2]);

  const sortedIndexes = getDisplayRowIndexes(
    rows,
    columns,
    {},
    {
      columnKey: "result",
      direction: "desc",
    },
    {
      enableFiltering: false,
      enableSorting: true,
    }
  );
  assert.deepEqual(sortedIndexes, [2, 0, 1]);

  const cycleRows = [
    { base: "=B1", delta: "=A1", result: 0 },
  ];
  const cycleEvaluator = createFormulaEvaluator(cycleRows, columns);

  assert.equal(cycleEvaluator.evaluateCell(0, "base").error, "#CYCLE!");
  assert.equal(cycleEvaluator.evaluateCell(0, "delta").error, "#CYCLE!");
}
