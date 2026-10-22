// Task 6B — A-060 / A-106: fill series in the live fill path (`fillVertical` / `fillHorizontal`).
// Node suite against the built ../dist/index.cjs; only public exports are importable here.
// Covers numeric linear, single-cell copy, float-drift, negative steps, calendar date steps
// (day / month / year incl. month-end clamp + leap years), blanks, text/mixed copy, up/left fill,
// and formula-reference shifting. Date series must use LOCAL components (child-process TZ cases).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { fillVertical, fillHorizontal } = require("../dist/index.cjs");
const here = dirname(fileURLToPath(import.meta.url));

const numCol = (key = "v") => [{ key, type: "number", editable: true, readonly: false }];
const textCol = (key = "v") => [{ key, type: "text", editable: true, readonly: false }];
const dateCol = (key = "d") => [{ key, type: "date", editable: true, readonly: false }];

// Fill a single-column vertical source [rows 0..srcEnd] down through `toRow`.
function fillDown(rows, cols, srcEnd, toRow) {
  return fillVertical(rows, cols, { startRow: 0, endRow: srcEnd, startCol: 0, endCol: 0 }, toRow)
    .rows;
}

function testNumericLinear() {
  const out = fillDown([{ v: 2 }, { v: 4 }, {}, {}], numCol(), 1, 3);
  assert.equal(out[2].v, 6, "linear continues by step");
  assert.equal(out[3].v, 8, "linear row 4");
}

function testSingleCellCopy() {
  // Excel copies a lone number on plain fill (does NOT increment).
  const out = fillDown([{ v: 5 }, {}, {}], numCol(), 0, 2);
  assert.equal(out[1].v, 5, "single cell copies, not increments");
  assert.equal(out[2].v, 5, "single cell copies row 3");
}

function testDecimalDrift() {
  const out = fillDown([{ v: 0.1 }, { v: 0.2 }, {}, {}], numCol(), 1, 3);
  assert.equal(out[2].v, 0.3, "0.1 step reads 0.3, not 0.30000000000000004");
  assert.equal(out[3].v, 0.4, "0.1 step row 4 = 0.4");
}

function testNegativeStep() {
  const out = fillDown([{ v: 10 }, { v: 8 }, {}, {}], numCol(), 1, 3);
  assert.equal(out[2].v, 6, "negative step continues down");
  assert.equal(out[3].v, 4, "negative step row 4");
}

function testDateDayStep() {
  const out = fillDown(
    [{ d: "2024-01-01" }, { d: "2024-01-02" }, {}, {}],
    dateCol(),
    1,
    3
  );
  assert.equal(out[2].d, "2024-01-03", "day step +1");
  assert.equal(out[3].d, "2024-01-04", "day step +1 row 4");
}

function testDateMonthStep() {
  const out = fillDown(
    [{ d: "2024-01-01" }, { d: "2024-02-01" }, {}, {}],
    dateCol(),
    1,
    3
  );
  assert.equal(out[2].d, "2024-03-01", "month step (NOT ms-step 03-03)");
  assert.equal(out[3].d, "2024-04-01", "month step row 4");
}

function testMonthEndClampLeap() {
  // 31 Dec, 31 Jan => month step 1; next is Feb => clamp to the leap-year last day, then 31 Mar.
  const out = fillDown(
    [{ d: "2023-12-31" }, { d: "2024-01-31" }, {}, {}],
    dateCol(),
    1,
    3
  );
  assert.equal(out[2].d, "2024-02-29", "31 Jan + 1 month => 29 Feb (leap, clamped)");
  assert.equal(out[3].d, "2024-03-31", "then 31 Mar (anchored on day 31)");
}

function testMonthEndClampNonLeap() {
  const out = fillDown([{ d: "2022-12-31" }, { d: "2023-01-31" }, {}], dateCol(), 1, 2);
  assert.equal(out[2].d, "2023-02-28", "31 Jan + 1 month => 28 Feb (non-leap, clamped)");
}

function testYearStep() {
  const out = fillDown(
    [{ d: "2020-06-15" }, { d: "2021-06-15" }, {}, {}],
    dateCol(),
    1,
    3
  );
  assert.equal(out[2].d, "2022-06-15", "year step (= 12-month step)");
  assert.equal(out[3].d, "2023-06-15", "year step row 4");
}

function testBlanksStayBlank() {
  // A numeric source with a blank must not fabricate a 0 series: blanks copy through as blanks.
  const out = fillDown([{ v: 5 }, { v: "" }, {}, {}], numCol(), 1, 3);
  assert.notEqual(out[3].v, 0, "blank source cell never becomes 0");
  assert.equal(out[3].v, null, "blank fills a number column as null (blank), not 0");

  const allBlank = fillDown([{ v: "" }, { v: "" }, {}, {}], textCol(), 1, 3);
  assert.equal(allBlank[2].v, "", "all-blank text source fills blanks");
}

function testTextCopy() {
  // No weekday/month-name cycling in the live path => plain copy pattern, never NaN.
  const out = fillDown(
    [{ v: "Mon" }, { v: "Tue" }, {}, {}],
    textCol(),
    1,
    3
  );
  assert.equal(out[2].v, "Mon", "text copies (pattern repeat)");
  assert.equal(out[3].v, "Tue", "text copies row 4");
}

function testMixedCopyNeverNaN() {
  const out = fillDown([{ v: 1 }, { v: "x" }, {}, {}], textCol(), 1, 3);
  assert.equal(out[2].v, 1, "mixed number+text falls back to copy");
  assert.equal(out[3].v, "x", "mixed copy keeps text, never NaN");
}

function testFillUp() {
  // Source [2,4] at the bottom; filling UP continues the series backwards: 0, -2.
  const rows = [{}, {}, { v: 2 }, { v: 4 }];
  const out = fillVertical(rows, numCol(), { startRow: 2, endRow: 3, startCol: 0, endCol: 0 }, 0)
    .rows;
  assert.equal(out[1].v, 0, "fill up: row above source = 0");
  assert.equal(out[0].v, -2, "fill up: continues to -2");
}

function testFillLeft() {
  const cols = ["a", "b", "c", "d"].map((key) => ({
    key,
    type: "number",
    editable: true,
    readonly: false,
  }));
  const out = fillHorizontal(
    [{ a: null, b: null, c: 2, d: 4 }],
    cols,
    { startRow: 0, endRow: 0, startCol: 2, endCol: 3 },
    0
  ).rows;
  assert.equal(out[0].b, 0, "fill left: col before source = 0");
  assert.equal(out[0].a, -2, "fill left: continues to -2");
}

function testFormulaStillShifts() {
  const cols = ["A", "B"].map((key) => ({ key, type: "text", editable: true, readonly: false }));
  const out = fillVertical(
    [{ A: 1, B: "=A1+$A$1" }, { A: 2 }, { A: 3 }],
    cols,
    { startRow: 0, endRow: 0, startCol: 1, endCol: 1 },
    2
  ).rows;
  assert.equal(out[1].B, "=A2+$A$1", "filled formula shifts relative ref, keeps $A$1");
  assert.equal(out[2].B, "=A3+$A$1", "filled formula row 3");
}

// Date series must be built from LOCAL components: no day-shift in zones east or west of UTC.
function testDateSeriesTimezones() {
  const script = `
    const { fillVertical } = require(${JSON.stringify(resolve(here, "../dist/index.cjs"))});
    const cols = [{ key: "d", type: "date", editable: true, readonly: false }];
    const out = fillVertical(
      [{ d: "2024-01-01" }, { d: "2024-02-01" }, {}, {}],
      cols,
      { startRow: 0, endRow: 1, startCol: 0, endCol: 0 },
      3
    ).rows;
    process.stdout.write(JSON.stringify({ m1: out[2].d, m2: out[3].d }));
  `;
  for (const tz of ["America/Los_Angeles", "Pacific/Auckland"]) {
    const raw = execFileSync(process.execPath, ["-e", script], {
      env: { ...process.env, TZ: tz },
      encoding: "utf8",
    });
    const out = JSON.parse(raw);
    assert.equal(out.m1, "2024-03-01", `month series must not shift in ${tz}`);
    assert.equal(out.m2, "2024-04-01", `month series row 4 must not shift in ${tz}`);
  }
}

export function runFillSeriesTests() {
  testNumericLinear();
  testSingleCellCopy();
  testDecimalDrift();
  testNegativeStep();
  testDateDayStep();
  testDateMonthStep();
  testMonthEndClampLeap();
  testMonthEndClampNonLeap();
  testYearStep();
  testBlanksStayBlank();
  testTextCopy();
  testMixedCopyNeverNaN();
  testFillUp();
  testFillLeft();
  testFormulaStillShifts();
  testDateSeriesTimezones();
}
