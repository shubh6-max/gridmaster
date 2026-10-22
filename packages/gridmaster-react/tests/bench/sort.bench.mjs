// A-010 sort benchmark: 100k rows, OLD per-pair comparator vs the NEW decorate-sort-undecorate.
// Not part of `npm test` (wall-clock is environment-dependent). CI asserts equivalence + call-count
// bounds in tests/sorting.test.mjs; this script just reports before/after milliseconds.
//   node tests/bench/sort.bench.mjs
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { sortByDecoratedKeys, toNumber, normalizeValue } = require("../../dist/index.cjs");

const N = 100_000;

function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const rnd = makePrng(12345);
const words = ["café", "zebra", "Apple", "apple", "éclair", "9", "10", "1a"];
const values = Array.from({ length: N }, () => {
  const k = Math.floor(rnd() * 4);
  if (k === 0) return Math.floor(rnd() * 100000);
  if (k === 1) return String(Math.floor(rnd() * 100000));
  if (k === 2) return words[Math.floor(rnd() * words.length)];
  return [null, "", undefined][Math.floor(rnd() * 3)];
});

// OLD: comparator re-read both keys + built a collator-less localeCompare per comparison.
function oldCompare(a, b) {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na - nb;
  return normalizeValue(a).localeCompare(normalizeValue(b), undefined, { sensitivity: "base" });
}

function timeOld() {
  const idx = values.map((_, i) => i);
  const t = performance.now();
  idx.sort((a, b) => oldCompare(values[a], values[b]));
  return performance.now() - t;
}

function timeNew() {
  const idx = values.map((_, i) => i);
  const t = performance.now();
  sortByDecoratedKeys(idx, (i) => values[i], 1);
  return performance.now() - t;
}

// Warm up, then take the median of a few runs.
const median = (fn) => {
  const samples = [];
  for (let i = 0; i < 5; i++) samples.push(fn());
  samples.sort((a, b) => a - b);
  return samples[2];
};

timeOld();
timeNew();
const oldMs = median(timeOld);
const newMs = median(timeNew);
console.log(`rows=${N}`);
console.log(`OLD (per-pair comparator): ${oldMs.toFixed(1)} ms`);
console.log(`NEW (decorate-sort-undecorate): ${newMs.toFixed(1)} ms`);
console.log(`speedup: ${(oldMs / newMs).toFixed(2)}x`);
