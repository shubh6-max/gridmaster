import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  matchesConditionFilter,
  filterRowIndexes,
  createConditionFilter,
  compileFilters,
  rowMatchesCompiledFilters,
  rowMatchesFilters,
  getFilteredUniqueValuesForColumn,
  getFilterValuesForColumn,
} = require("../dist/index.cjs");

const numCol = { key: "n", title: "N", type: "number", sortable: true, filterable: true };

export function runFilteringTests() {
  /* --- A-069: numeric operators must NOT match blank/null/"" cells --------- */
  const gt = { type: "condition", operator: "gt", value: -1 };
  const lt = { type: "condition", operator: "lt", value: 5 };
  const lte = { type: "condition", operator: "lte", value: 0 };
  const gte = { type: "condition", operator: "gte", value: 0 };

  for (const blank of [null, undefined, "", "   "]) {
    assert.equal(matchesConditionFilter(blank, gt), false, `gt matched blank ${JSON.stringify(blank)}`);
    assert.equal(matchesConditionFilter(blank, lt), false, `lt matched blank ${JSON.stringify(blank)}`);
    assert.equal(matchesConditionFilter(blank, lte), false, `lte matched blank ${JSON.stringify(blank)}`);
    assert.equal(matchesConditionFilter(blank, gte), false, `gte matched blank ${JSON.stringify(blank)}`);
  }
  // Real numbers still compare (incl. 0, which is NOT blank).
  assert.equal(matchesConditionFilter(3, lt), true);
  assert.equal(matchesConditionFilter(0, lte), true);
  assert.equal(matchesConditionFilter(0, gte), true);
  assert.equal(matchesConditionFilter(-5, gt), false);

  // End-to-end through the row pipeline: blank rows drop out of `< 5`.
  const rows = [{ n: 3 }, { n: "" }, { n: 10 }, { n: null }, { n: 0 }, { n: -2 }];
  const kept = filterRowIndexes(rows, [numCol], { n: lt });
  assert.deepEqual(kept, [0, 4, 5], "lt 5 must keep only numeric cells below 5");

  /* --- A-071: compiled filters match the per-row path exactly -------------- */
  const columns = [numCol, { key: "t", title: "T", type: "text", filterable: true }];
  const filters = { n: createConditionFilter("gte", 0), t: createConditionFilter("includes", "a") };
  const compiled = compileFilters(columns, filters);
  assert.equal(compiled.length, 2);
  const sample = [
    { n: 1, t: "cat" },
    { n: -1, t: "cat" },
    { n: 2, t: "dog" },
    { n: 5, t: "bana" },
  ];
  sample.forEach((row, i) => {
    assert.equal(
      rowMatchesCompiledFilters(row, compiled, { rows: sample, rowIndex: i }),
      rowMatchesFilters(row, columns, filters, { rows: sample, rowIndex: i }),
      `compiled vs per-row diverged at ${i}`
    );
  });
  // Unknown column keys are dropped at compile time (not per row).
  assert.equal(compileFilters(columns, { nope: createConditionFilter("includes", "x") }).length, 0);

  /* --- A-046: formula filter values evaluate against FULL rows ------------- */
  // `calc` row i mirrors column B (the second column) of the SAME source row.
  const a = { key: "a", title: "A", type: "number", filterable: true };
  const b = { key: "b", title: "B", type: "number", filterable: true };
  const calc = { key: "calc", title: "Calc", type: "text", filterable: true };
  const fCols = [a, b, calc];
  const fRows = [];
  for (let i = 0; i < 6; i++) {
    fRows.push({ a: i, b: i * 10, calc: `=B${i + 1}` });
  }
  // Keep only rows whose A >= 3 (drops rows 0..2). The surviving source rows are 3,4,5
  // whose B values are 30,40,50 -> calc must report exactly those, never "#REF!".
  const values = getFilteredUniqueValuesForColumn(fRows, fCols, "calc", {
    a: createConditionFilter("gte", 3),
  });
  assert.ok(!values.some((v) => v.includes("#")), `calc produced an error value: ${values.join()}`);
  assert.deepEqual([...values].sort(), ["30", "40", "50"]);

  // Direct helper also evaluates cross-column formulas against the full column set.
  const direct = getFilterValuesForColumn(fRows, calc, fCols);
  assert.deepEqual([...direct].sort(), ["0", "10", "20", "30", "40", "50"]);
}
