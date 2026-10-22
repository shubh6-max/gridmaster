// Task 5 (A-007, A-040): pure reference rewriting (`shiftFormulaReferences`,
// `rewriteFormulaReferences`) and evaluator range-materialisation reuse.
// Node suite; imports the built `../dist/index.cjs`.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  shiftFormulaReferences,
  rewriteFormulaReferences,
  createFormulaEvaluator,
  fillVertical,
  fillHorizontal,
} = require("../dist/index.cjs");

/* ------------------------------------------------------------------ *
 * shiftFormulaReferences — fill / paste copy semantics ($ respected)  *
 * ------------------------------------------------------------------ */
// [formula, rowDelta, colDelta, expected]
const SHIFT_CASES = [
  // relative shifts
  ["=A1", 1, 0, "=A2"],
  ["=A1", 0, 1, "=B1"],
  ["=A1+B1", 1, 0, "=A2+B2"],
  ["=A1+B1", 0, 1, "=B1+C1"],
  ["=A1+B1", 2, 3, "=D3+E3"],
  ["=A10", 5, 0, "=A15"],
  ["=Z1", 0, 1, "=AA1"],
  ["=AA1", 0, -1, "=Z1"],
  // absolute anchors are respected (copy semantics)
  ["=$A$1", 5, 5, "=$A$1"],
  ["=$A1", 1, 1, "=$A2"],
  ["=A$1", 1, 1, "=B$1"],
  ["=$A$1+A1", 1, 1, "=$A$1+B2"],
  // ranges (per endpoint)
  ["=A1:B2", 1, 0, "=A2:B3"],
  ["=A1:B2", 0, 1, "=B1:C2"],
  ["=$A1:B$2", 1, 1, "=$A2:C$2"],
  ["=SUM(A1:A3)", 1, 0, "=SUM(A2:A4)"],
  ["=SUM(A1:A3)+LOG10(B2)", 1, 0, "=SUM(A2:A4)+LOG10(B3)"],
  // out of bounds -> #REF!
  ["=A1", -1, 0, "=#REF!"],
  ["=A1", 0, -1, "=#REF!"],
  ["=B2", -5, 0, "=#REF!"],
  ["=A1:B2", -1, 0, "=#REF!:B1"],
  ["=A2:B3", -2, 0, "=#REF!:B1"],
  // string literals untouched
  ['="A1"&A1', 1, 0, '="A1"&A2'],
  ['=CONCAT("col A1 ok",A1)', 1, 0, '=CONCAT("col A1 ok",A2)'],
  // function names / bare names untouched
  ["=LOG10(A1)", 1, 0, "=LOG10(A2)"],
  ["=ABC1D+A1", 1, 0, "=ABC1D+A2"],
  ["=SUM(A1,A2,A3)", 1, 0, "=SUM(A2,A3,A4)"],
  // literals untouched
  ["=A1+5", 1, 0, "=A2+5"],
  ["=1e3+A1", 1, 0, "=1e3+A2"],
  ["=A1*2%+B2", 1, 0, "=A2*2%+B3"],
  ["=.5+A1", 1, 0, "=.5+A2"],
  // whitespace preserved outside references
  ["= A1 + B1 ", 1, 0, "= A2 + B2 "],
  ["=  SUM( A1 : A3 )  ", 1, 0, "=  SUM( A2 : A4 )  "],
  // no-op
  ["=A1+B2", 0, 0, "=A1+B2"],
  // not a formula -> unchanged
  ["A1", 1, 0, "A1"],
  ["hello", 1, 0, "hello"],
  // lowercase normalises the reference, keeps surroundings
  ["=a1+b1", 1, 0, "=A2+B2"],
];

/* ------------------------------------------------------------------ *
 * rewriteFormulaReferences — structural edits ($ shifts too)          *
 * ------------------------------------------------------------------ */
// [formula, edit, expected]
const REWRITE_CASES = [
  // insert rows
  ["=A1", { type: "insert-rows", at: 0, count: 1 }, "=A2"],
  ["=A5", { type: "insert-rows", at: 2, count: 1 }, "=A6"],
  ["=A5", { type: "insert-rows", at: 10, count: 1 }, "=A5"],
  ["=A5", { type: "insert-rows", at: 4, count: 1 }, "=A6"],
  ["=A5", { type: "insert-rows", at: 5, count: 1 }, "=A5"],
  ["=$A$5", { type: "insert-rows", at: 0, count: 1 }, "=$A$6"],
  ["=$A5", { type: "insert-rows", at: 0, count: 1 }, "=$A6"],
  ["=A1:A5", { type: "insert-rows", at: 2, count: 1 }, "=A1:A6"],
  ["=A1:A5", { type: "insert-rows", at: 0, count: 2 }, "=A3:A7"],
  ["=SUM(A1:A3)+B1", { type: "insert-rows", at: 0, count: 1 }, "=SUM(A2:A4)+B2"],
  // delete rows
  ["=A5", { type: "delete-rows", at: 4, count: 1 }, "=#REF!"],
  ["=A5", { type: "delete-rows", at: 0, count: 1 }, "=A4"],
  ["=A1", { type: "delete-rows", at: 4, count: 1 }, "=A1"],
  ["=$A$5", { type: "delete-rows", at: 0, count: 1 }, "=$A$4"],
  ["=A10", { type: "delete-rows", at: 2, count: 3 }, "=A7"],
  ["=A3", { type: "delete-rows", at: 2, count: 3 }, "=#REF!"],
  // delete rows shrinking ranges
  ["=A1:A5", { type: "delete-rows", at: 4, count: 1 }, "=A1:A4"],
  ["=A1:A5", { type: "delete-rows", at: 0, count: 1 }, "=A1:A4"],
  ["=A1:A5", { type: "delete-rows", at: 0, count: 5 }, "=#REF!"],
  ["=A2:A5", { type: "delete-rows", at: 0, count: 2 }, "=A1:A3"],
  ["=SUM(A1:A10)", { type: "delete-rows", at: 2, count: 3 }, "=SUM(A1:A7)"],
  ["=A1:A5", { type: "delete-rows", at: 1, count: 3 }, "=A1:A2"],
  // insert columns
  ["=A1", { type: "insert-columns", at: 0, count: 1 }, "=B1"],
  ["=C1", { type: "insert-columns", at: 1, count: 1 }, "=D1"],
  ["=A1", { type: "insert-columns", at: 5, count: 1 }, "=A1"],
  ["=$A$1", { type: "insert-columns", at: 0, count: 1 }, "=$B$1"],
  ["=A1:C1", { type: "insert-columns", at: 1, count: 1 }, "=A1:D1"],
  // delete columns
  ["=B1", { type: "delete-columns", at: 1, count: 1 }, "=#REF!"],
  ["=C1", { type: "delete-columns", at: 0, count: 1 }, "=B1"],
  ["=A1:C1", { type: "delete-columns", at: 2, count: 1 }, "=A1:B1"],
  ["=A1:C1", { type: "delete-columns", at: 0, count: 3 }, "=#REF!"],
  ["=A1+C1", { type: "delete-columns", at: 1, count: 1 }, "=A1+B1"],
  // move row (splice semantics)
  ["=A1", { type: "move-row", from: 0, to: 2 }, "=A3"],
  ["=A3", { type: "move-row", from: 0, to: 2 }, "=A2"],
  ["=A2", { type: "move-row", from: 0, to: 2 }, "=A1"],
  ["=A4", { type: "move-row", from: 0, to: 2 }, "=A4"],
  ["=A1", { type: "move-row", from: 5, to: 0 }, "=A2"],
  ["=A1:A3", { type: "move-row", from: 5, to: 0 }, "=A2:A4"],
  // move column
  ["=A1", { type: "move-column", from: 0, to: 2 }, "=C1"],
  ["=C1", { type: "move-column", from: 0, to: 2 }, "=B1"],
  ["=B1", { type: "move-column", from: 0, to: 2 }, "=A1"],
  // whitespace preservation
  ["= A1 : A5 ", { type: "delete-rows", at: 4, count: 1 }, "= A1 : A4 "],
  ["= A1 + B1 ", { type: "insert-rows", at: 0, count: 1 }, "= A2 + B2 "],
  // references inside strings untouched
  ['="A5"&A5', { type: "delete-rows", at: 4, count: 1 }, '="A5"&#REF!'],
  ['="row A5"&A5', { type: "insert-rows", at: 0, count: 1 }, '="row A5"&A6'],
  // function names untouched
  ["=LOG10(A5)", { type: "delete-rows", at: 4, count: 1 }, "=LOG10(#REF!)"],
  // not a formula -> unchanged
  ["A5", { type: "delete-rows", at: 4, count: 1 }, "A5"],
];

function runShiftCases() {
  for (const [formula, rowDelta, colDelta, expected] of SHIFT_CASES) {
    const got = shiftFormulaReferences(formula, rowDelta, colDelta);
    assert.equal(
      got,
      expected,
      `shift(${JSON.stringify(formula)}, ${rowDelta}, ${colDelta}) => ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`
    );
  }
}

function runRewriteCases() {
  for (const [formula, edit, expected] of REWRITE_CASES) {
    const got = rewriteFormulaReferences(formula, edit);
    assert.equal(
      got,
      expected,
      `rewrite(${JSON.stringify(formula)}, ${JSON.stringify(edit)}) => ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`
    );
  }
}

/* ------------------------------------------------------------------ *
 * A-040: range matrices are materialised once per evaluator, not      *
 * once per referencing formula.                                       *
 * ------------------------------------------------------------------ */
function runRangeMemoisation() {
  const COLUMNS = [...Array(26)].map((_, i) => ({ key: String.fromCharCode(65 + i) }));
  const ROW_COUNT = 5000;
  const FORMULA_COUNT = 2000;

  // Column A: 5000 numbers. Column B: 2000 formulas each summing the SAME 5000-cell range.
  const rows = new Array(ROW_COUNT);
  for (let i = 0; i < ROW_COUNT; i++) rows[i] = { A: i + 1 };
  for (let i = 0; i < FORMULA_COUNT; i++) rows[i].B = "=SUM(A1:A5000)";

  const evaluator = createFormulaEvaluator(rows, COLUMNS);
  assert.equal(
    typeof evaluator.getRangeMaterializationCount,
    "function",
    "evaluator exposes getRangeMaterializationCount for A-040"
  );

  const expectedSum = (ROW_COUNT * (ROW_COUNT + 1)) / 2;
  for (let i = 0; i < FORMULA_COUNT; i++) {
    assert.equal(evaluator.evaluateCell(i, "B").value, expectedSum, `formula ${i} sum`);
  }

  const materialisations = evaluator.getRangeMaterializationCount();
  // The identical A1:A5000 range must be built a tiny, bounded number of times (memoised),
  // NOT once per formula. Allow a small constant for warm-up re-entry.
  assert.ok(
    materialisations <= 5,
    `range A1:A5000 materialised ${materialisations} times for ${FORMULA_COUNT} formulas (expected <= 5)`
  );
}

/* ------------------------------------------------------------------ *
 * Fill wiring: fillVertical / fillHorizontal shift filled formulas.    *
 * ------------------------------------------------------------------ */
function runFillWiring() {
  const cols = ["A", "B", "C", "D"].map((key) => ({
    key,
    type: "text",
    editable: true,
    readonly: false,
  }));

  // Fill-down of a formula shifts rows; $-anchored parts stay.
  const down = fillVertical(
    [{ A: 1, B: "=A1+$A$1" }, { A: 2 }, { A: 3 }],
    cols,
    { startRow: 0, endRow: 0, startCol: 1, endCol: 1 },
    2
  );
  assert.equal(down.rows[1].B, "=A2+$A$1", "fill-down shifts rel, keeps $A$1");
  assert.equal(down.rows[2].B, "=A3+$A$1", "fill-down row 3");

  // Right-fill shifts columns.
  const right = fillHorizontal(
    [{ A: 1, B: "=A1" }],
    cols,
    { startRow: 0, endRow: 0, startCol: 1, endCol: 1 },
    3
  );
  assert.equal(right.rows[0].C, "=B1", "right-fill to C");
  assert.equal(right.rows[0].D, "=C1", "right-fill to D");

  // Non-formula numeric series is unaffected by the formula path.
  const series = fillVertical(
    [{ A: 1 }, { A: 2 }, { A: null }, { A: null }],
    cols,
    { startRow: 0, endRow: 1, startCol: 0, endCol: 0 },
    3
  );
  assert.equal(series.rows[2].A, 3, "numeric series still projects");
  assert.equal(series.rows[3].A, 4, "numeric series row 4");
}

export function runFormulaRefTests() {
  runShiftCases();
  runRewriteCases();
  runFillWiring();
  runRangeMemoisation();
}
