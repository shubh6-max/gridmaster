import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { createFormulaEvaluator } = require("../dist/index.cjs");
const here = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(readFileSync(resolve(here, "fixtures/formulas-corpus.json"), "utf8"));

// 26 generic columns A..Z. The evaluator only needs `.key`.
const LETTERS = [...Array(26)].map((_, i) => String.fromCharCode(65 + i));
const COLUMNS = LETTERS.map((key) => ({ key }));

function parseAddress(address) {
  const m = /^([A-Z]+)(\d+)$/.exec(address);
  return { col: m[1], rowIndex: Number(m[2]) - 1 };
}

/** Build rows from a positional grid, then drop the formula into `at`. */
function buildRows(grid, at, formula) {
  const { col, rowIndex } = parseAddress(at);
  const rowCount = Math.max(grid.length, rowIndex + 1);
  const rows = [];
  for (let r = 0; r < rowCount; r++) {
    const obj = {};
    const gridRow = grid[r] || [];
    gridRow.forEach((value, c) => {
      if (value !== null && value !== undefined) obj[LETTERS[c]] = value;
    });
    rows.push(obj);
  }
  rows[rowIndex][col] = formula;
  return { rows, col, rowIndex };
}

function resultOf(evaluator, rowIndex, col) {
  const res = evaluator.evaluateCell(rowIndex, col);
  return res.error !== null ? res.error : res.value;
}

function assertExpected(got, expected, label) {
  if (typeof expected === "number") {
    assert.equal(typeof got, "number", `${label}: expected number, got ${typeof got} (${got})`);
    assert.ok(Math.abs(got - expected) < 1e-9, `${label}: expected ${expected}, got ${got}`);
  } else if (typeof expected === "boolean") {
    assert.equal(got, expected, `${label}: expected ${expected}, got ${got}`);
  } else if (expected === null) {
    assert.ok(
      got === null || got === undefined || got === "",
      `${label}: expected blank, got ${JSON.stringify(got)}`
    );
  } else {
    assert.equal(got, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  }
}

function runCorpusCases() {
  const failures = [];
  for (const c of corpus) {
    const { rows, col, rowIndex } = buildRows(c.grid, c.at, c.formula);
    const evaluator = createFormulaEvaluator(rows, COLUMNS);
    let got;
    try {
      got = resultOf(evaluator, rowIndex, col);
    } catch (e) {
      failures.push({ id: c.id, auditId: c.auditId, reason: `THREW ${e.name}` });
      continue;
    }
    try {
      assertExpected(got, c.expected, c.id);
    } catch (e) {
      failures.push({ id: c.id, auditId: c.auditId, reason: e.message });
    }
  }
  return failures;
}

/** A1=1, A2=A1+1, ... A{depth}=A{depth-1}+1 evaluated from the BOTTOM cold (A-039). */
function evalChainBottomFirst(depth) {
  const rows = [{ A: 1 }];
  for (let i = 1; i < depth; i++) rows.push({ A: `=A${i}+1` });
  const evaluator = createFormulaEvaluator(rows, COLUMNS);
  return evaluator;
}

function runStructuralCases() {
  // A-039: deep dependency chain, cold bottom-first, no #ERROR!, no poisoned cache.
  for (const depth of [500, 2000]) {
    const ev = evalChainBottomFirst(depth);
    const bottom = ev.evaluateCell(depth - 1, "A");
    assert.equal(bottom.error, null, `chain ${depth}: error ${bottom.error}`);
    assert.equal(bottom.value, depth, `chain ${depth}: value ${bottom.value}`);
    // cache not poisoned: a middle cell still resolves correctly afterwards.
    assert.equal(ev.evaluateCell(Math.floor(depth / 2), "A").value, Math.floor(depth / 2) + 1);
  }

  // A-041: 200k-cell aggregates, no spread RangeError.
  const BIG = 200000;
  const bigRows = new Array(BIG);
  for (let i = 0; i < BIG; i++) bigRows[i] = { A: i + 1 };
  bigRows[0].B = "=SUM(A1:A200000)";
  bigRows[0].C = "=AVERAGE(A1:A200000)";
  bigRows[0].D = "=MIN(A1:A200000)";
  bigRows[0].E = "=MAX(A1:A200000)";
  bigRows[0].F = "=COUNT(A1:A200000)";
  const bigEv = createFormulaEvaluator(bigRows, COLUMNS);
  assert.equal(bigEv.evaluateCell(0, "B").value, (BIG * (BIG + 1)) / 2, "200k SUM");
  assert.equal(bigEv.evaluateCell(0, "C").value, (BIG + 1) / 2, "200k AVERAGE");
  assert.equal(bigEv.evaluateCell(0, "D").value, 1, "200k MIN");
  assert.equal(bigEv.evaluateCell(0, "E").value, BIG, "200k MAX");
  assert.equal(bigEv.evaluateCell(0, "F").value, BIG, "200k COUNT");

  // Cycle stability: #CYCLE! and does not poison an unrelated cell.
  const cyc = createFormulaEvaluator([{ A: "=B1", B: "=A1", C: "=5+5" }], COLUMNS);
  assert.equal(cyc.evaluateCell(0, "A").error, "#CYCLE!");
  assert.equal(cyc.evaluateCell(0, "B").error, "#CYCLE!");
  assert.equal(cyc.evaluateCell(0, "C").value, 10, "unrelated cell survives a cycle");

  // RAND / RANDBETWEEN (GridCraft port 1B): range and coverage by sampling; the table above only
  // covers their deterministic edge cases. 5000 draws miss one of six faces with probability ~1e-390.
  const draw = (formula) => createFormulaEvaluator([{ A: formula }], COLUMNS).evaluateCell(0, "A").value;
  const faces = new Set();
  for (let i = 0; i < 5000; i++) {
    const face = draw("=RANDBETWEEN(1,6)");
    assert.ok(Number.isInteger(face) && face >= 1 && face <= 6, `RANDBETWEEN(1,6) gave ${face}`);
    const unit = draw("=RAND()");
    assert.ok(unit >= 0 && unit < 1, `RAND() gave ${unit}`);
    faces.add(face);
  }
  assert.equal(faces.size, 6, "RANDBETWEEN(1,6) reaches every face");
}

// Deterministic PRNG (mulberry32) — no Math.random.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FUZZ_TOKENS = [
  "=", "+", "-", "*", "/", "^", "&", "%", "(", ")", ",", ":", " ",
  "A1", "B2", "Z9", "C3", "A1:B2", "A1:A3",
  "SUM", "IF", "IFERROR", "VLOOKUP", "MATCH", "INDEX", "LOG10", "UNKNOWN",
  '"x"', '"a""b"', "1", "2.5", "1e3", ".5", "TRUE", "FALSE",
  "#REF!", "$A$1", "0", "1000000000000", "e", "E-", "1.2.3",
];

function runFuzz() {
  const rand = mulberry32(0x9e3779b9);
  const rows = [
    { A: 1, B: 2, C: 3, Z: 9 },
    { A: 4, B: 5, C: 6, Z: 8 },
    { A: 7, B: 8, C: 9, Z: 7 },
  ];
  const ok = new Set(["number", "string", "boolean", "undefined", "object"]);
  for (let n = 0; n < 2000; n++) {
    const len = 1 + Math.floor(rand() * 9);
    let formula = "=";
    for (let i = 0; i < len; i++) formula += FUZZ_TOKENS[Math.floor(rand() * FUZZ_TOKENS.length)];
    // occasionally truncate to force malformed input
    if (rand() < 0.3) formula = formula.slice(0, 1 + Math.floor(rand() * formula.length));
    const target = { ...rows[0], D: formula };
    const ev = createFormulaEvaluator([target, rows[1], rows[2]], COLUMNS);
    let res;
    try {
      res = ev.evaluateCell(0, "D");
    } catch (e) {
      throw new Error(`fuzz #${n} threw ${e.name} for formula: ${formula}`);
    }
    assert.ok(res && "value" in res && "error" in res, `fuzz #${n} malformed result for: ${formula}`);
    const got = res.error !== null ? res.error : res.value;
    assert.ok(ok.has(typeof got), `fuzz #${n} non-primitive result ${typeof got} for: ${formula}`);
  }
}

// A-043: date-only parsing must not shift in a negative-UTC-offset zone. Run in a child
// process with TZ=America/New_York (UTC-5) so TODAY/Date construction cannot mask a bug.
function runTimezoneCase() {
  const script = `
    const { createFormulaEvaluator } = require(${JSON.stringify(resolve(here, "../dist/index.cjs"))});
    const cols = [{key:"A"}];
    function ev(f){ const e = createFormulaEvaluator([{A:f}], cols); const r = e.evaluateCell(0,"A"); return r.error ?? r.value; }
    const out = {
      year: ev('=YEAR("2024-01-01")'),
      month: ev('=MONTH("2024-01-01")'),
      day: ev('=DAY("2024-01-01")'),
      yearEnd: ev('=YEAR("2023-12-31")'),
    };
    process.stdout.write(JSON.stringify(out));
  `;
  const raw = execFileSync(process.execPath, ["-e", script], {
    env: { ...process.env, TZ: "America/New_York" },
    encoding: "utf8",
  });
  const out = JSON.parse(raw);
  assert.equal(out.year, 2024, "TZ: YEAR(2024-01-01) must be 2024 in UTC-5");
  assert.equal(out.month, 1, "TZ: MONTH must be 1");
  assert.equal(out.day, 1, "TZ: DAY must be 1");
  assert.equal(out.yearEnd, 2023, "TZ: YEAR(2023-12-31) must be 2023");
}

export function runFormulaCorpusTests() {
  const failures = runCorpusCases();
  if (failures.length) {
    const byAudit = {};
    for (const f of failures) (byAudit[f.auditId || "general"] ||= []).push(f);
    let msg = `\n${failures.length}/${corpus.length} corpus cases failed:\n`;
    for (const [audit, list] of Object.entries(byAudit)) {
      msg += `  [${audit}] ${list.map((f) => f.id).join(", ")}\n`;
    }
    throw new Error(msg);
  }
  runStructuralCases();
  runFuzz();
  runTimezoneCase();
}
