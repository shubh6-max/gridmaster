// Task 3 — state/history performance benchmark (A-047, A-074, A-066).
//
// NOT part of `npm test`. Run with `npm run bench:state` (or `node tests/bench/state.bench.mjs`).
// It records before/after numbers; it does NOT assert wall-clock timings (those live in the DOM
// suite as ratios/reference-counts so CI stays deterministic). The authoritative pass/fail checks
// for structural sharing are in tests/dom/perf-state.test.tsx.
//
// What it measures, on a 20k-row × 10-col grid over 50 single-cell edits (copy-on-write, exactly
// what updateCellValue produces):
//   (a) distinct row object references retained across the whole history (past + present)
//       — the "retained memory proxy" of A-047: O(edits) with structural sharing, O(edits × rows)
//       without it.
//   (b) wall-clock for the 50 pushes.
//   (c) heapUsed delta held by the history after the run.
// Two modes:
//   - "deep clone"   (preserveRowReferences:false) = the pre-fix default hot-path setting.
//   - "shared refs"  (preserveRowReferences:true)  = the post-fix hot-path setting (updateRows).
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createInitialHistoryState, historyReducer } = require("../../dist/index.cjs");

const ROWS = 20_000;
const COLS = 10;
const EDITS = 50;

function makeRows() {
  const rows = new Array(ROWS);
  for (let r = 0; r < ROWS; r++) {
    const row = { id: r };
    for (let c = 0; c < COLS; c++) row[`c${c}`] = r * 10 + c;
    rows[r] = row;
  }
  return rows;
}

const columns = Array.from({ length: COLS }, (_, c) => ({ key: `c${c}`, title: `C${c}` }));

function countDistinctRowRefs(state) {
  const seen = new Set();
  for (const snap of [...state.past, state.present]) {
    for (const row of snap.rows) seen.add(row);
  }
  return seen.size;
}

function run(label, preserveRowReferences) {
  const options = { preserveRowReferences, historyLimit: EDITS + 5 };
  const base = makeRows();
  let state = createInitialHistoryState(
    { rows: base, columns, cellMeta: {}, rowMeta: {} },
    options
  );

  if (global.gc) global.gc();
  const heapBefore = process.memoryUsage().heapUsed;
  const t0 = process.hrtime.bigint();

  for (let e = 0; e < EDITS; e++) {
    // Copy-on-write single-cell edit: new array, exactly one new row object.
    const prevRows = state.present.rows;
    const next = prevRows.slice();
    const i = (e * 37) % ROWS;
    next[i] = { ...next[i], c0: next[i].c0 + 1 };
    state = historyReducer(
      state,
      {
        type: "PUSH",
        payload: {
          rows: next,
          columns: state.present.columns,
          cellMeta: state.present.cellMeta,
          rowMeta: state.present.rowMeta,
        },
      },
      options
    );
  }

  const t1 = process.hrtime.bigint();
  if (global.gc) global.gc();
  const heapAfter = process.memoryUsage().heapUsed;

  const distinct = countDistinctRowRefs(state);
  const ms = Number(t1 - t0) / 1e6;
  const retainedMB = (heapAfter - heapBefore) / 1024 / 1024;

  console.log(`\n[${label}] preserveRowReferences=${preserveRowReferences}`);
  console.log(`  pushes:                 ${EDITS}`);
  console.log(`  time for ${EDITS} edits:      ${ms.toFixed(1)} ms  (${(ms / EDITS).toFixed(2)} ms/edit)`);
  console.log(`  distinct row refs kept: ${distinct.toLocaleString()}  (ideal O(edits) ≈ ${(ROWS + EDITS).toLocaleString()}; O(edits×rows) ≈ ${(ROWS * (EDITS + 1)).toLocaleString()})`);
  console.log(`  heap retained by history: ${retainedMB.toFixed(1)} MB`);
  return { distinct, ms, retainedMB };
}

console.log(`GridMaster state benchmark — ${ROWS.toLocaleString()} rows × ${COLS} cols, ${EDITS} single-cell edits`);
const deep = run("deep clone (pre-fix hot path)", false);
const shared = run("shared refs (post-fix hot path)", true);

console.log("\n=== summary ===");
console.log(`retained-ref ratio deep/shared: ${(deep.distinct / shared.distinct).toFixed(1)}×`);
console.log(`time ratio deep/shared:         ${(deep.ms / shared.ms).toFixed(1)}×`);
if (global.gc) {
  console.log(`heap ratio deep/shared:         ${(deep.retainedMB / Math.max(shared.retainedMB, 0.1)).toFixed(1)}×`);
} else {
  console.log(`heap numbers approximate (run with --expose-gc for stable deltas)`);
}
