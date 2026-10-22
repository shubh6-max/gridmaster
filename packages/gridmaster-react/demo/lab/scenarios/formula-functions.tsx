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

function Results() {
  const [batch, setBatch] = useState("All");
  const [failingOnly, setFailingOnly] = useState(false);
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
            {shown.map(({ c, actual, ok }) => (
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

// Live sheet. Data in A1:B6 (numbers) and G1:I6 (a small sales table: region, product, qty; I6 is text
// on purpose); each formula (E) sits beside its expected result (F). Add one line per function when a
// new batch lands.
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
];

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
    expect: "The header reads N / N passing in green. Any red row is a regression: the Actual column shows what the library returned.",
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
