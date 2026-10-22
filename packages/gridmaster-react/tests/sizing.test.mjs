import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { autoFitColumn } = require("../dist/index.cjs");

// Deterministic injected measurer: one px per character, no font dependency.
const measureText = (text) => String(text).length;

export function runSizingTests() {
  /* --- A-073: representative sample captures a long value in the TAIL ----- */
  const col = { key: "v", title: "V", type: "text", minWidth: 1, maxWidth: 10000 };
  const rows = [];
  for (let i = 0; i < 600; i++) rows.push({ v: "x" });
  rows[599].v = "ABCDEFGHIJKLMNOPQRST"; // 20 chars, beyond the old first-500 window

  const widths = autoFitColumn({}, col, rows, {
    columns: [col],
    measureText,
    padding: 0,
  });
  assert.equal(widths.v, 20, "auto-fit must sample the tail, not just the first 500 rows");

  // Clamp still honoured.
  const clamped = autoFitColumn({}, { ...col, maxWidth: 12 }, rows, {
    columns: [col],
    measureText,
    padding: 0,
  });
  assert.equal(clamped.v, 12, "auto-fit respects maxWidth clamp");

  /* --- A-046: cross-column formulas measure the EVALUATED value ----------- */
  const a = { key: "a", title: "A", type: "number" };
  const b = { key: "b", title: "B", type: "number" };
  const cat = { key: "cat", title: "Cat", type: "text", minWidth: 1, maxWidth: 1000 };
  const fRows = [];
  for (let i = 0; i < 6; i++) {
    fRows.push({ a: (i + 1) * 100, b: i + 1, cat: `=A${i + 1}&B${i + 1}` });
  }
  const fitted = autoFitColumn({}, cat, fRows, {
    columns: [a, b, cat],
    measureText,
    padding: 0,
  });
  // Every row concatenates to 4 chars ("1001".."6006"); a broken evaluator would
  // measure "#REF!"/"#ERROR!" (5/7 chars) instead.
  assert.equal(fitted.cat, 4, "auto-fit must evaluate formulas against the full column set");

  /* --- Fallback estimate when no measurer is available -------------------- */
  const est = autoFitColumn({}, col, [{ v: "hello" }], { columns: [col] });
  assert.ok(est.v >= col.minWidth, "fallback estimate stays within clamps");
}
