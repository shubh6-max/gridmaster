import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  sortByDecoratedKeys,
  buildSortKey,
  compareSortKeys,
  compareValues,
  sortRowIndexes,
  getDisplayRowIndexes,
  toNumber,
  normalizeValue,
} = require("../dist/index.cjs");

/* ---------------------------------------------------------------------------
 * A-010 equivalence: the OLD comparator + OLD sort path, kept VERBATIM here
 * (copied from snapshots/task-8-base/src/core/utils.ts compareValues +
 * gridState/sorting index sort). The new decorate-sort-undecorate path MUST
 * produce byte-identical ordering on a mixed-type corpus, both directions,
 * including ties. toNumber/normalizeValue are imported from dist because the
 * task forbids changing them, so the old comparator uses the real helpers.
 * ------------------------------------------------------------------------- */
function oldCompareValues(a, b) {
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (numA !== null && numB !== null) return numA - numB;
  const strA = normalizeValue(a);
  const strB = normalizeValue(b);
  return strA.localeCompare(strB, undefined, { sensitivity: "base" });
}

// Old index sort path (relied on V8 stable sort for ties; input order ascending).
function oldSortIndexes(values, direction) {
  const dir = direction === "asc" ? 1 : -1;
  const indexes = values.map((_, i) => i);
  indexes.sort((a, b) => oldCompareValues(values[a], values[b]) * dir);
  return indexes;
}

// Deterministic seeded PRNG so the corpus is reproducible across CI runs.
function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildMixedCorpus(count, seed) {
  const rnd = makePrng(seed);
  const accents = ["café", "cafe", "Éclair", "eclair", "ÄPPLE", "apple", "Zebra", "zebra"];
  const values = [];
  for (let i = 0; i < count; i++) {
    const kind = Math.floor(rnd() * 9);
    switch (kind) {
      case 0:
        values.push(Math.floor(rnd() * 2000) - 1000);
        break;
      case 1:
        values.push(String(Math.floor(rnd() * 2000) - 1000));
        break;
      case 2:
        values.push(accents[Math.floor(rnd() * accents.length)]);
        break;
      case 3:
        values.push(new Date(2000 + Math.floor(rnd() * 25), Math.floor(rnd() * 12), 1));
        break;
      case 4:
        values.push(rnd() > 0.5);
        break;
      case 5:
        values.push([null, undefined, ""][Math.floor(rnd() * 3)]);
        break;
      case 6:
        values.push(Number.NaN);
        break;
      case 7:
        values.push(`${Math.floor(rnd() * 20)}${["a", "b", "x"][Math.floor(rnd() * 3)]}`);
        break;
      default:
        values.push((rnd() * 200 - 100).toFixed(2));
    }
  }
  return values;
}

export function runSortingTests() {
  // --- Helpers exist and behave like the old comparator for arbitrary pairs ---
  const probe = buildMixedCorpus(400, 7);
  for (let i = 0; i < probe.length; i++) {
    const a = probe[i];
    const b = probe[(i * 7 + 3) % probe.length];
    assert.equal(
      Math.sign(compareSortKeys(buildSortKey(a), buildSortKey(b))),
      Math.sign(oldCompareValues(a, b)),
      `compareSortKeys diverged for ${String(a)} vs ${String(b)}`
    );
    assert.equal(
      Math.sign(compareValues(a, b)),
      Math.sign(oldCompareValues(a, b)),
      `compareValues diverged for ${String(a)} vs ${String(b)}`
    );
  }

  // --- Equivalence of the new decorate-sort-undecorate sort to the old sort ---
  // >= 5000 values per direction across a mixed-type corpus with ties.
  const corpus = buildMixedCorpus(6000, 42);
  for (const direction of ["asc", "desc"]) {
    const dir = direction === "asc" ? 1 : -1;
    const oldOrder = oldSortIndexes(corpus, direction);
    const newOrder = sortByDecoratedKeys(
      corpus.map((_, i) => i),
      (i) => corpus[i],
      dir
    );
    assert.deepEqual(newOrder, oldOrder, `order diverged for direction=${direction}`);
  }

  // --- Stability: equal keys keep ascending source index (both directions) ---
  const ties = ["b", "b", "a", "a", "b", "a"];
  const tieAsc = sortByDecoratedKeys(ties.map((_, i) => i), (i) => ties[i], 1);
  assert.deepEqual(tieAsc, [2, 3, 5, 0, 1, 4]);
  const tieDesc = sortByDecoratedKeys(ties.map((_, i) => i), (i) => ties[i], -1);
  assert.deepEqual(tieDesc, [0, 1, 4, 2, 3, 5]);

  // --- The public sort paths stay equivalent to the old comparator ---
  const columns = [{ key: "v", title: "V", type: "text", sortable: true }];
  const rows = corpus.map((v) => ({ v }));

  for (const direction of ["asc", "desc"]) {
    const sort = { columnKey: "v", direction };
    const dir = direction === "asc" ? 1 : -1;
    const expected = oldSortIndexes(corpus, direction);

    const viaSortRowIndexes = sortRowIndexes(rows, columns, sort);
    assert.deepEqual(viaSortRowIndexes, expected, `sortRowIndexes diverged (${direction})`);

    const viaPipeline = getDisplayRowIndexes(rows, columns, {}, sort);
    assert.deepEqual(viaPipeline, expected, `getDisplayRowIndexes diverged (${direction})`);
  }

  // --- Each sort key is read exactly ONCE per row (decorate-sort-undecorate) ---
  let reads = 0;
  const indexes = [0, 1, 2, 3, 4];
  const data = [3, 1, 2, 1, 3];
  sortByDecoratedKeys(indexes, (i) => {
    reads++;
    return data[i];
  }, 1);
  assert.equal(reads, data.length, "getValue must be called once per index");
}
