// Scenario: worksheet functions added by the GridCraft port (docs/plans/gridcraft-port.md).
// Three parts: an automated pass/fail table over the `gc*` cases in the formulas corpus (a new batch
// shows up here by itself), a "try a formula" box, and a live sheet with expected results beside
// each formula. Language: TypeScript 6 (strict), React 19.
import { useMemo, useState } from "react";
import { GridMaster, type GridRow, createColumnFactory, createFormulaEvaluator } from "../../../src";
import corpusJson from "../../../tests/fixtures/formulas-corpus.json";
import { type Check, Select, defineScenario } from "../kit";

const g = createColumnFactory();
type Cell = string | number | null;
type CorpusCase = {
  id: string;
  grid: Cell[][];
  at: string;
  formula: string;
  expected: string | number | boolean | null;
  note: string;
};

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const EVAL_COLUMNS = LETTERS.map((key) => g.text(key));

/** Batch id from a corpus id: "gc1a-product-args" -> "1A". Only GridCraft-port cases are listed. */
function batchOf(id: string): string | null {
  const match = /^gc(\w+?)-/.exec(id);
  return match ? match[1].toUpperCase() : null;
}

/** Positional grid -> row objects keyed A..Z, with `formula` dropped into `at` (same as the corpus test). */
function evaluateCase(grid: Cell[][], at: string, formula: string): unknown {
  const m = /^([A-Z]+)(\d+)$/.exec(at);
  if (!m) return "bad address";
  const rowIndex = Number(m[2]) - 1;
  const rows: GridRow[] = [];
  for (let r = 0; r < Math.max(grid.length, rowIndex + 1); r += 1) {
    const row: GridRow = {};
    (grid[r] ?? []).forEach((value, c) => {
      if (value !== null && value !== undefined) row[LETTERS[c]] = value;
    });
    rows.push(row);
  }
  rows[rowIndex][m[1]] = formula;
  try {
    const result = createFormulaEvaluator(rows, EVAL_COLUMNS).evaluateCell(rowIndex, m[1]);
    return result.error ?? result.value;
  } catch (error) {
    return `THREW ${error instanceof Error ? error.name : "error"}`;
  }
}

/** Same comparison rules as tests/formulas-corpus.test.mjs. */
function matches(actual: unknown, expected: CorpusCase["expected"]): boolean {
  if (typeof expected === "number") return typeof actual === "number" && Math.abs(actual - expected) < 1e-9;
  if (expected === null) return actual === null || actual === undefined || actual === "";
  return actual === expected;
}

const PORT_CASES = (corpusJson as CorpusCase[]).filter((c) => batchOf(c.id) !== null);
const BATCHES = ["All", ...Array.from(new Set(PORT_CASES.map((c) => batchOf(c.id) as string)))];

// The table shows this many rows until "Show all" is pressed: every row is DOM, and the corpus grows with
// each batch (about 1,000 rows made one mount take seconds). The pass/fail count always covers every case.
const ROW_LIMIT = 100;

function Results() {
  const [batch, setBatch] = useState("All");
  const [failingOnly, setFailingOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Evaluated once per mount; the corpus is static data.
  const results = useMemo(
    () =>
      PORT_CASES.map((c) => {
        const actual = evaluateCase(c.grid, c.at, c.formula);
        return { c, actual, ok: matches(actual, c.expected) };
      }),
    []
  );
  const scoped = results.filter((r) => batch === "All" || batchOf(r.c.id) === batch);
  const passing = scoped.filter((r) => r.ok).length;
  const shown = failingOnly ? scoped.filter((r) => !r.ok) : scoped;
  const visible = showAll || failingOnly ? shown : shown.slice(0, ROW_LIMIT);

  return (
    <section data-testid="port-results">
      <div className="lab-controls">
        <Select label="Batch" value={batch} options={BATCHES} onChange={setBatch} />
        <label>
          <input type="checkbox" checked={failingOnly} onChange={(e) => setFailingOnly(e.target.checked)} /> Failing
          only
        </label>
        <b data-testid="port-summary" className={passing === scoped.length ? "lab-ok" : "lab-fail"}>
          {passing} / {scoped.length} passing
        </b>
      </div>
      <div className="lab-results">
        <table className="lab-table">
          <thead>
            <tr>
              <th>Batch</th>
              <th>Formula</th>
              <th>Data</th>
              <th>Expected</th>
              <th>Actual</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map(({ c, actual, ok }) => (
              <tr key={c.id} className={ok ? undefined : "lab-fail-row"}>
                <td>{batchOf(c.id)}</td>
                <td>
                  <code>{c.formula}</code>
                </td>
                <td>{c.grid.length ? JSON.stringify(c.grid).slice(0, 40) : ""}</td>
                <td>{String(c.expected)}</td>
                <td>{String(actual)}</td>
                <td>{ok ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length < shown.length ? (
        <p className="lab-muted">
          Showing the first {visible.length} of {shown.length} rows.{" "}
          <button type="button" onClick={() => setShowAll(true)}>
            Show all {shown.length}
          </button>
        </p>
      ) : null}
    </section>
  );
}

function TryIt() {
  const [formula, setFormula] = useState("=ROUNDUP(3.14159,3)");
  const actual = useMemo(() => evaluateCase([], "A1", formula.startsWith("=") ? formula : `=${formula}`), [formula]);
  return (
    <div className="lab-panel">
      Try a formula (no cell references here; use the sheet below for those):{" "}
      <input
        aria-label="Formula to try"
        value={formula}
        onChange={(e) => setFormula(e.target.value)}
        style={{ width: 280 }}
      />{" "}
      → <b data-testid="try-result">{String(actual)}</b>
    </div>
  );
}

// Live sheet. Data in A1:B6 (numbers), G1:I6 (a small sales table: region, product, qty; I6 is text
// on purpose) and J1:J3 (holiday dates); each formula (E) sits beside its expected result (F). Add one
// line per function when a new batch lands.
const DATA_A: Cell[] = [2, 3, 4, 8.9, -8.9, 0];
const DATA_B: Cell[] = [24, 36, 5];
const SALES: [region: Cell, product: Cell, qty: Cell][] = [
  ["East", "Apple", 5],
  ["West", "Apple", 3],
  ["East", "Pear", 7],
  ["West", "Pear", 2],
  ["East", "Apple", 4],
  ["North", "Apple", "x"],
];
export const SHEET: [label: string, formula: string, expected: string][] = [
  // Batch 1A: math basics
  ["PRODUCT of A1:A3", "=PRODUCT(A1:A3)", "24"],
  ["SUMSQ of A1:A3", "=SUMSQ(A1:A3)", "29"],
  ["INT rounds down (A5 = -8.9)", "=INT(A5)", "-9"],
  ["TRUNC toward zero (A4 = 8.9)", "=TRUNC(A4)", "8"],
  ["SIGN of A5", "=SIGN(A5)", "-1"],
  ["ROUNDUP away from zero", "=ROUNDUP(A4,0)", "9"],
  ["ROUNDDOWN toward zero", "=ROUNDDOWN(A5,0)", "-8"],
  ["ROUNDUP to 3 digits", "=ROUNDUP(3.14159,3)", "3.142"],
  ["EXP(0)", "=EXP(0)", "1"],
  ["LN(1)", "=LN(1)", "0"],
  ["LOG with base", "=LOG(1000,10)", "3"],
  ["LOG10", "=LOG10(100)", "2"],
  ["PI()", "=PI()", "3.14159265358979"],
  ["QUOTIENT drops the remainder (B1 = 24)", "=QUOTIENT(B1,5)", "4"],
  ["MROUND to a multiple of 5", "=MROUND(B1,5)", "25"],
  ["EVEN rounds away to even (A4)", "=EVEN(A4)", "10"],
  ["ODD rounds away to odd (A4)", "=ODD(A4)", "9"],
  ["FACT(A3 = 4)", "=FACT(A3)", "24"],
  ["GCD(B1, B2)", "=GCD(B1,B2)", "12"],
  ["LCM(B1, B2)", "=LCM(B1,B2)", "72"],
  ["LN of zero (A6 = 0)", "=LN(A6)", "#NUM!"],
  ["FACT overflow", "=FACT(171)", "#NUM!"],
  ["QUOTIENT by zero (A6 = 0)", "=QUOTIENT(B3,A6)", "#DIV/0!"],
  // Batch 1B: trig and angles
  ["SIN(PI()/2)", "=SIN(PI()/2)", "1"],
  ["COS(PI())", "=COS(PI())", "-1"],
  ["TAN(PI()/4)", "=TAN(PI()/4)", "1"],
  ["SIN beyond 2^27 radians", "=SIN(134217728)", "#NUM!"],
  ["ASIN(1)", "=ASIN(1)", "1.5707963267949"],
  ["ACOS(0.5)", "=ACOS(0.5)", "1.0471975511966"],
  ["ASIN outside -1..1", "=ASIN(2)", "#NUM!"],
  ["ATAN(1)", "=ATAN(1)", "0.785398163397448"],
  ["ATAN2 takes (x, y)", "=ATAN2(1,1)", "0.785398163397448"],
  ["ATAN2(-1,0)", "=ATAN2(-1,0)", "3.14159265358979"],
  ["ATAN2(0,0)", "=ATAN2(0,0)", "#DIV/0!"],
  ["SINH(1)", "=SINH(1)", "1.1752011936438"],
  ["COSH(1)", "=COSH(1)", "1.54308063481524"],
  ["TANH(1)", "=TANH(1)", "0.761594155955765"],
  ["ASINH(1)", "=ASINH(1)", "0.881373587019543"],
  ["ACOSH(2)", "=ACOSH(2)", "1.31695789692482"],
  ["ACOSH below 1", "=ACOSH(0.5)", "#NUM!"],
  ["ATANH(0.5)", "=ATANH(0.5)", "0.549306144334055"],
  ["ATANH(1)", "=ATANH(1)", "#NUM!"],
  ["DEGREES(PI())", "=DEGREES(PI())", "180"],
  ["RADIANS(180)", "=RADIANS(180)", "3.14159265358979"],
  ["SQRTPI(1)", "=SQRTPI(1)", "1.77245385090552"],
  ["COMBIN(8,2)", "=COMBIN(8,2)", "28"],
  ["COMBIN(52,5)", "=COMBIN(52,5)", "2598960"],
  ["COMBIN k larger than n", "=COMBIN(5,6)", "#NUM!"],
  ["RAND() is below 1", "=INT(RAND())", "0"],
  ["RAND() live value", "=RAND()", "a number from 0 to under 1"],
  ["RANDBETWEEN fixed", "=RANDBETWEEN(5,5)", "5"],
  ["RANDBETWEEN dice", "=RANDBETWEEN(1,6)", "a whole number from 1 to 6"],
  ["RANDBETWEEN bottom above top", "=RANDBETWEEN(5,4)", "#NUM!"],
  // Batch 1C: criteria family (uses the sales table in G1:I6)
  ["SUMIFS, one criterion", '=SUMIFS(I1:I6,G1:G6,"East")', "16"],
  ["SUMIFS, two criteria", '=SUMIFS(I1:I6,G1:G6,"East",H1:H6,"Apple")', "9"],
  ["SUMIFS skips text in the sum range", '=SUMIFS(I1:I6,G1:G6,"North")', "0"],
  ["SUMIFS, ranges of different size", '=SUMIFS(I1:I6,G1:G5,"East")', "#VALUE!"],
  ["COUNTIFS, one criterion", '=COUNTIFS(G1:G6,"East")', "3"],
  ["COUNTIFS, text and number", '=COUNTIFS(G1:G6,"East",I1:I6,">4")', "2"],
  ["COUNTIFS with a wildcard", '=COUNTIFS(H1:H6,"P*")', "2"],
  ["AVERAGEIFS", '=AVERAGEIFS(I1:I6,G1:G6,"East")', "5.33333333333333"],
  ["AVERAGEIFS, nothing matches", '=AVERAGEIFS(I1:I6,G1:G6,"Mars")', "#DIV/0!"],
  ["MAXIFS", '=MAXIFS(I1:I6,G1:G6,"East")', "7"],
  ["MINIFS", '=MINIFS(I1:I6,G1:G6,"East")', "4"],
  ["MAXIFS, nothing matches", '=MAXIFS(I1:I6,G1:G6,"Mars")', "0"],
  ["SUMPRODUCT of A1:A3 and B1:B3", "=SUMPRODUCT(A1:A3,B1:B3)", "176"],
  ["SUMPRODUCT, ranges of different size", "=SUMPRODUCT(A1:A3,B1:B2)", "#VALUE!"],
  ["COUNTBLANK over A1:B8", "=COUNTBLANK(A1:B8)", "7"],
  // Batch 1D: text (uses the region and product text in G1:H6; text results are compared as text)
  ["CONCATENATE (G1, H1)", '=CONCATENATE(G1,"-",H1)', "East-Apple"],
  ["CONCATENATE with a number", '=CONCATENATE("Q",3)', "Q3"],
  ["TEXTJOIN over a range", '=TEXTJOIN(", ",TRUE,G1:G3)', "East, West, East"],
  ["TEXTJOIN reads a 2-D range row by row", '=TEXTJOIN("/",TRUE,G1:H2)', "East/Apple/West/Apple"],
  ["TEXTJOIN keeps empty items when ignore_empty is FALSE", '=TEXTJOIN("-",FALSE,"a","","b")', "a--b"],
  ["SEARCH ignores case (H3 = Pear)", '=SEARCH("EA",H3)', "2"],
  ["SEARCH with ? as any character (H1 = Apple)", '=SEARCH("A?p",H1)', "1"],
  ["SEARCH with several *", '=SEARCH("a*c*e","xaxbxcxdxe")', "2"],
  ["SEARCH, ~ makes * literal", '=SEARCH("~*","2*3")', "2"],
  ["SEARCH, text not found", '=SEARCH("z",H1)', "#VALUE!"],
  ["REPLACE part of a word (H1 = Apple)", '=REPLACE(H1,2,3,"--")', "A--e"],
  ["REPLACE inserts when the length is 0", '=REPLACE(G1,1,0,">> ")', ">> East"],
  ["REPT", '=REPT("ab",3)', "ababab"],
  ["REPT as a bar (I1 = 5)", '=REPT("|",I1)', "|||||"],
  ["PROPER", '=PROPER("hello WORLD")', "Hello World"],
  ["PROPER restarts after a digit", '=PROPER("76budget")', "76Budget"],
  ["VALUE of numeric text", '=VALUE("1,234.5")', "1234.5"],
  ["VALUE with $ and %", '=VALUE("$1,000")+VALUE("50%")', "1000.5"],
  ["VALUE, not a number", '=VALUE("abc")', "#VALUE!"],
  ["EXACT is case-sensitive", '=EXACT(G1,"east")', "FALSE"],
  ["EXACT, same text (G1, G5)", "=EXACT(G1,G5)", "TRUE"],
  ["CHAR(65)", "=CHAR(65)", "A"],
  ["CODE of the first letter (G1 = East)", "=CODE(G1)", "69"],
  ["CLEAN drops control characters", '=CLEAN("a"&CHAR(7)&"b")', "ab"],
  ["T keeps text", "=T(G1)", "East"],
  ["T blanks out a number (I1 = 5)", "=T(I1)", ""],
  ["UNICHAR(8364)", "=UNICHAR(8364)", "€"],
  ["UNICODE of the euro sign", '=UNICODE("€")', "8364"],
  ["UNICHAR(0)", "=UNICHAR(0)", "#VALUE!"],
  ["TEXTBEFORE", '=TEXTBEFORE("a,b,c",",")', "a"],
  ["TEXTBEFORE, counting from the end", '=TEXTBEFORE("a,b,c",",",-1)', "a,b"],
  ["TEXTAFTER", '=TEXTAFTER("user@example.com","@")', "example.com"],
  ["TEXTAFTER, not found with a fallback", '=TEXTAFTER("abc","x",1,0,0,"none")', "none"],
  ["TEXTAFTER, not found", '=TEXTAFTER("abc","x")', "#N/A"],
  ["NUMBERVALUE with separators", '=NUMBERVALUE("2.500,27",",",".")', "2500.27"],
  ["NUMBERVALUE with %", '=NUMBERVALUE("3.5%")', "0.035"],
  ["FIXED", "=FIXED(1234.567,1)", "1,234.6"],
  ["FIXED, rounding left of the point", "=FIXED(1234.567,-1)", "1,230"],
  ["FIXED without commas", "=FIXED(1234.567,1,TRUE)", "1234.6"],
  ["DOLLAR", "=DOLLAR(1234.567,2)", "$1,234.57"],
  ["DOLLAR, negative in parentheses", "=DOLLAR(-1234.567,-2)", "($1,200)"],
  // Batch 1E: logical, date, info. Dates in this grid are epoch milliseconds and a time of day is the
  // milliseconds since midnight (Excel shows 0.5 for noon; here TIME(12,0,0) is 43200000). Date results are
  // checked by comparing with DATE(). Holidays are in J1:J3 (the 27th is a Saturday, so it never counts).
  ["TRUE()", "=TRUE()", "TRUE"],
  ["FALSE()", "=FALSE()", "FALSE"],
  ["XOR: exactly one is true", "=XOR(3>12,4<6)", "TRUE"],
  ["XOR: two true is FALSE", "=XOR(TRUE,TRUE)", "FALSE"],
  ["XOR over a range (A1:A3 are all non-zero)", "=XOR(A1:A3)", "TRUE"],
  ["XOR, a range with no logical value (G1:G3 is text)", "=XOR(G1:G3)", "#VALUE!"],
  ["DATEVALUE reads text as a date", '=DATEVALUE("22-MAY-2011")=DATE(2011,5,22)', "TRUE"],
  ["DATEVALUE, 30 February", '=DATEVALUE("2024-02-30")', "#VALUE!"],
  ["TIMEVALUE (ms since midnight; Excel shows 0.1)", '=TIMEVALUE("2:24 AM")', "8640000"],
  ["TIME (ms since midnight; Excel shows 0.5)", "=TIME(12,0,0)", "43200000"],
  ["TIME wraps past 24 hours (27:00 is 3:00)", "=TIME(27,0,0)", "10800000"],
  ["HOUR of a time text", '=HOUR("4:48:18 PM")', "16"],
  ["MINUTE of a time text", '=MINUTE("4:48:18 PM")', "48"],
  ["SECOND of a time text", '=SECOND("4:48:18 PM")', "18"],
  ["HOUR of a DATE plus a TIME", "=HOUR(DATE(2024,1,15)+TIME(9,30,0))", "9"],
  ["HOUR, text that is not a time", '=HOUR("abc")', "#VALUE!"],
  ["DAYS(end, start)", '=DAYS("2021-03-15","2021-02-15")', "28"],
  ["DAYS, negative", '=DAYS("2021-02-15","2021-03-15")', "-28"],
  ["DAYS across a daylight-saving change", '=DAYS("2024-03-11","2024-03-09")', "2"],
  ["WEEKNUM, weeks start on Sunday", '=WEEKNUM("2012-03-09")', "10"],
  ["WEEKNUM, weeks start on Monday", '=WEEKNUM("2012-03-09",2)', "11"],
  ["WEEKNUM, ISO system (21)", '=WEEKNUM("2012-03-09",21)', "10"],
  ["WEEKNUM, return type 3 does not exist", '=WEEKNUM("2012-03-09",3)', "#NUM!"],
  ["ISOWEEKNUM: 1 Jan 2012 is in week 52 of 2011", '=ISOWEEKNUM("2012-01-01")', "52"],
  ["ISOWEEKNUM: 3 Jan 2021 is in week 53", '=ISOWEEKNUM("2021-01-03")', "53"],
  ["NETWORKDAYS over January 2024", '=NETWORKDAYS("2024-01-01","2024-01-31")', "23"],
  ["NETWORKDAYS with holidays J1:J3", '=NETWORKDAYS("2024-01-01","2024-01-31",J1:J3)', "21"],
  ["NETWORKDAYS, start after end is negative", '=NETWORKDAYS("2024-01-31","2024-01-01")', "-23"],
  ["WORKDAY skips the weekend (Fri 12 Jan + 1 = Mon 15 Jan)", '=WORKDAY("2024-01-12",1)=DATE(2024,1,15)', "TRUE"],
  ["WORKDAY backwards (Mon 15 Jan - 1 = Fri 12 Jan)", '=WORKDAY("2024-01-15",-1)=DATE(2024,1,12)', "TRUE"],
  ["WORKDAY with holidays (15 Jan is one, so Tue 16 Jan)", '=WORKDAY("2024-01-12",1,J1:J3)=DATE(2024,1,16)', "TRUE"],
  ["DAYS360, US method", '=DAYS360("2024-01-15","2024-03-31")', "76"],
  ["DAYS360, European method", '=DAYS360("2024-01-15","2024-03-31",TRUE)', "75"],
  ["YEARFRAC, 30/360 (Excel shows 0.58055556)", '=YEARFRAC("2012-01-01","2012-07-30")', "0.580555555555556"],
  ["YEARFRAC, actual/365", '=YEARFRAC("2012-01-01","2012-07-30",3)', "0.578082191780822"],
  ["YEARFRAC, actual/actual", '=YEARFRAC("2012-01-01","2012-07-30",1)', "0.576502732240437"],
  ["YEARFRAC, basis 5 does not exist", '=YEARFRAC("2012-01-01","2012-07-30",5)', "#NUM!"],
  ["ISEVEN(2.5) cuts to 2", "=ISEVEN(2.5)", "TRUE"],
  ["ISODD(-1)", "=ISODD(-1)", "TRUE"],
  ["ISEVEN of text (G1 = East)", "=ISEVEN(G1)", "#VALUE!"],
  ["ISLOGICAL(TRUE)", "=ISLOGICAL(TRUE)", "TRUE"],
  ['ISLOGICAL of the text "TRUE"', '=ISLOGICAL("TRUE")', "FALSE"],
  ["ISNONTEXT of a number (I1 = 5)", "=ISNONTEXT(I1)", "TRUE"],
  ["ISNONTEXT of text (G1 = East)", "=ISNONTEXT(G1)", "FALSE"],
  ["ISNONTEXT of an empty cell (C1)", "=ISNONTEXT(C1)", "TRUE"],
  ["N of a number (I1 = 5)", "=N(I1)", "5"],
  ["N of text is 0 (G1 = East)", "=N(G1)", "0"],
  ["N(TRUE)", "=N(TRUE)", "1"],
  ["TYPE of a number (I1)", "=TYPE(I1)", "1"],
  ["TYPE of text (G1)", "=TYPE(G1)", "2"],
  ["TYPE of a range", "=TYPE(A1:A3)", "64"],
  ["TYPE of an error", "=TYPE(1/0)", "16"],
  ["ERROR.TYPE of #DIV/0!", "=ERROR.TYPE(1/0)", "2"],
  ["ERROR.TYPE of #N/A", "=ERROR.TYPE(NA())", "7"],
  ["ERROR.TYPE of a value that is not an error", "=ERROR.TYPE(5)", "#N/A"],
];

// Holidays for the NETWORKDAYS / WORKDAY rows, in J1:J3.
const HOLIDAYS: Cell[] = ["2024-01-01", "2024-01-15", "2024-01-27"];

export function buildSheet(): GridRow[] {
  return SHEET.map(([d, e, f], i) => ({
    a: DATA_A[i] ?? null,
    b: DATA_B[i] ?? null,
    c: null,
    d,
    e,
    f,
    g: SALES[i]?.[0] ?? null,
    h: SALES[i]?.[1] ?? null,
    i: SALES[i]?.[2] ?? null,
    j: HOLIDAYS[i] ?? null,
  }));
}

export function sheetColumns() {
  return [
    g.number("a", { title: "A", width: 80 }),
    g.number("b", { title: "B", width: 80 }),
    g.number("c", { title: "C", width: 60 }),
    g.text("d", { title: "D", width: 280 }),
    g.text("e", { title: "E", width: 200 }),
    g.text("f", { title: "F", width: 150 }),
    g.text("g", { title: "G", width: 70 }),
    g.text("h", { title: "H", width: 70 }),
    g.text("i", { title: "I", width: 50 }),
    g.text("j", { title: "J", width: 100 }),
  ];
}

function Sheet() {
  const columns = useMemo(sheetColumns, []);
  const [rows, setRows] = useState<GridRow[]>(buildSheet);
  return (
    <>
      <p className="lab-muted">
        Column E is the live formula and column F is Excel's expected result. Edit any cell, or type your own
        formula into the empty rows below the list.
      </p>
      <GridMaster<GridRow> rows={rows} columns={columns} height={460} onRowsChange={setRows} />
    </>
  );
}

const checks: Check[] = [
  {
    do: 'Open the "Results" table below with Batch = All.',
    expect: "The header reads N / N passing in green (the count covers every case, but only the first 100 rows are listed until you press Show all). Any red row is a regression: the Actual column shows what the library returned.",
  },
  {
    do: "Pick one batch (for example 1A) in the Batch menu, then tick Failing only.",
    expect: "The table is empty and the count is still all-passing.",
  },
  {
    do: "In the sheet, compare every value in column E with the expected text in column F.",
    expect: "Every row matches, including the error rows (#NUM!, #DIV/0!).",
  },
  {
    do: "Change B1 from 24 to 30 and look at GCD, LCM, QUOTIENT and MROUND.",
    expect: "GCD(30,36) = 6, LCM = 180, QUOTIENT(30,5) = 6, MROUND(30,5) = 30. The F column text no longer applies to these rows.",
  },
  {
    do: "Type =ROUNDDOWN(-0.5,0) and =TRUNC(0.29,2) into the Try box (use one at a time).",
    expect: "0 and 0.29. Not -0 and not 0.28.",
  },
  {
    do: "Look at the two RAND rows and the dice row, then edit any other cell (this re-evaluates the sheet).",
    expect: "RAND stays between 0 and 1 and RANDBETWEEN(1,6) stays a whole number from 1 to 6 after each edit; over a few edits you see different values.",
  },
  {
    do: "Type =HOUR(DATE(2024,1,15)+TIME(9,30,0)) into the Try box, then =MINUTE(DATE(2024,1,15)+TIME(9,30,0)).",
    expect: "9, then 30. TIME gives milliseconds since midnight (not Excel's 0.5-style day fraction), so adding it to a DATE makes a real date and time.",
  },
  {
    do: 'Type =DATEVALUE("2024-02-30") into the Try box, then =DAY(DATEVALUE("2024-02-29")).',
    expect: "#VALUE! (February 2024 has no 30th), then 29 (the leap day).",
  },
  {
    do: "In the sheet, change J1 from 2024-01-01 to 2024-01-06 (a Saturday) and look at the NETWORKDAYS row that uses J1:J3.",
    expect: "It becomes 22: a holiday on a weekend is not counted. The F column text (21) no longer applies to that row.",
  },
  {
    do: "Type a function that is not implemented yet, for example =HLOOKUP(1,2,3).",
    expect: "#NAME? (it will start working when its batch lands and then appears in the table).",
  },
];

function Body() {
  return (
    <>
      <h3>Results (automated)</h3>
      <Results />
      <h3>Try a formula</h3>
      <TryIt />
      <h3>Live sheet</h3>
      <Sheet />
    </>
  );
}

export const scenario = defineScenario({
  id: "formula-functions",
  area: "Data & formulas",
  order: 3.5,
  title: "Formula functions",
  summary:
    "Worksheet functions added by the GridCraft port: an automated pass/fail table over the port's test cases, a formula scratch box, and a live sheet with the expected result next to each formula.",
  checks,
  Body,
});
