// Micro-benchmarks for the formula engine. Not wired into `npm test` (run manually):
//   node tests/bench/formulas.bench.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createFormulaEvaluator } = require("../../dist/index.cjs");

const LETTERS = [...Array(26)].map((_, i) => String.fromCharCode(65 + i));
const COLUMNS = LETTERS.map((key) => ({ key }));

function time(label, fn) {
  const start = process.hrtime.bigint();
  const value = fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(`${label.padEnd(34)} ${ms.toFixed(1).padStart(8)} ms   (result: ${value})`);
}

// (a) 10k rows of =A{n}+B{n}
time("10k rows =A+B", () => {
  const rows = [];
  for (let i = 0; i < 10000; i++) rows.push({ A: i, B: i * 2, C: `=A${i + 1}+B${i + 1}` });
  const ev = createFormulaEvaluator(rows, COLUMNS);
  let sum = 0;
  for (let i = 0; i < rows.length; i++) sum += ev.evaluateCell(i, "C").value;
  return sum;
});

// (b) one 200k-cell SUM
time("200k-cell SUM", () => {
  const rows = new Array(200000);
  for (let i = 0; i < 200000; i++) rows[i] = { A: i + 1 };
  rows[0].B = "=SUM(A1:A200000)";
  return createFormulaEvaluator(rows, COLUMNS).evaluateCell(0, "B").value;
});

// (c) 500-deep dependency chain evaluated cold from the bottom
time("500-deep chain (cold bottom)", () => {
  const rows = [{ A: 1 }];
  for (let i = 1; i < 500; i++) rows.push({ A: `=A${i}+1` });
  return createFormulaEvaluator(rows, COLUMNS).evaluateCell(499, "A").value;
});

// bonus: 5000-deep chain, proves iterative warm-up scales past the old stack limit
time("5000-deep chain (cold bottom)", () => {
  const rows = [{ A: 1 }];
  for (let i = 1; i < 5000; i++) rows.push({ A: `=A${i}+1` });
  return createFormulaEvaluator(rows, COLUMNS).evaluateCell(4999, "A").value;
});
