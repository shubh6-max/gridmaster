// Task 2 (A-038, A-048, A-049, A-051, A-052, A-104 + structurallyEqual): pure-helper tests.
// Hook-level behaviour lives in tests/dom/structure.test.tsx.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  cloneCellMetaMap,
  cloneColumns,
  cloneRows,
  cloneSnapshot,
  createColumn,
  createDefaultInsertedRow,
  createInitialHistoryState,
  deleteColumnValueFromRows,
  getDisplayRowIndexes,
  historyReducer,
  resolveColumns,
  sameColumnStructure,
  shallowEqualColumns,
  shallowEqualRows,
  shiftCellMetaForMovedRow,
  shiftRowMetaForMovedRow,
} = require("../dist/index.cjs");

const snap = (rows, extra = {}) => ({ rows, columns: [], cellMeta: {}, rowMeta: {}, ...extra });

function pushN(options, count) {
  let state = createInitialHistoryState(snap([{ n: 0 }]), options);
  for (let n = 1; n <= count; n++) {
    state = historyReducer(state, { type: "PUSH", payload: snap([{ n }]) }, options);
  }
  return state;
}

export function historyLimitTests() {
  // Positive limit keeps the NEWEST snapshots.
  const limited = pushN({ historyLimit: 2 }, 5);
  assert.deepEqual(
    limited.past.map((s) => s.rows[0].n),
    [3, 4]
  );

  // A-048: 0 means "no undo history", not unlimited (slice(-0) === slice(0)).
  const zero = pushN({ historyLimit: 0 }, 5);
  assert.equal(zero.past.length, 0, "historyLimit 0 must not retain snapshots");
  assert.equal(zero.present.rows[0].n, 5, "present still advances");

  // Negative is treated like 0 (conservative: never unbounded, never the wrong end of the stack).
  assert.equal(pushN({ historyLimit: -3 }, 5).past.length, 0);

  // NaN is invalid input and falls back to the default limit (50), not unlimited and not 0.
  assert.equal(pushN({ historyLimit: Number.NaN }, 60).past.length, 50);
  // Fractions floor.
  assert.equal(pushN({ historyLimit: 2.9 }, 5).past.length, 2);
  // Undefined keeps the default.
  assert.equal(pushN(undefined, 60).past.length, 50);

  // REDO re-pushes the present into `past`; it must honour the same limit.
  let state = pushN({ historyLimit: 0 }, 3);
  state = { ...state, future: [snap([{ n: 99 }])] };
  const redone = historyReducer(state, { type: "REDO" }, { historyLimit: 0 });
  assert.equal(redone.past.length, 0);
  assert.equal(redone.present.rows[0].n, 99);
}

export function allowedRowIdsTests() {
  const columns = resolveColumns([createColumn.text("name")]);
  const rows = [
    { id: 1, name: "a" },
    { id: 2, name: "b" },
    { id: 3, name: "c" },
  ];
  const show = (allowedRowIds) =>
    getDisplayRowIndexes(rows, columns, {}, null, {}, null, { allowedRowIds });

  // A-052: an EMPTY allow-list means "nothing visible"; only null/undefined means "no restriction".
  assert.deepEqual(show([]), []);
  assert.deepEqual(show(new Set()), []);
  assert.deepEqual(show(undefined), [0, 1, 2]);
  assert.deepEqual(show(null), [0, 1, 2]);
  assert.deepEqual(show(["3", "1"]), [2, 0], "non-empty list still filters and orders");
}

export function rowIdTests() {
  const columns = resolveColumns([createColumn.number("id"), createColumn.text("name")]);

  // A-051: Math.max(...ids) throws RangeError for ~120k+ arguments; 200k rows must work.
  const big = Array.from({ length: 200_000 }, (_, index) => ({ id: index + 1, name: "x" }));
  const inserted = createDefaultInsertedRow(big, columns);
  assert.equal(inserted.id, 200_001);

  // A numeric `id` column's blank cell (null) must not shadow the generated id.
  const plain = createDefaultInsertedRow([{ id: 4, name: "a" }], columns);
  assert.equal(plain.id, 5);

  // A text `id` column's "" default must not survive; two inserts must not both be "".
  const textColumns = resolveColumns([createColumn.text("id"), createColumn.text("name")]);
  let textRows = [
    { id: "a", name: "x" },
    { id: "b", name: "y" },
  ];
  const first = createDefaultInsertedRow(textRows, textColumns);
  textRows = [...textRows, first];
  const second = createDefaultInsertedRow(textRows, textColumns);
  assert.notEqual(first.id, "");
  assert.notEqual(second.id, "");
  assert.notEqual(first.id, second.id);

  // Generated `row_N` ids must not collide with an existing id (e.g. after a delete).
  const gapped = [
    { id: "row_1", name: "x" },
    { id: "row_3", name: "y" },
  ];
  const next = createDefaultInsertedRow(gapped, textColumns);
  assert.ok(!gapped.some((row) => row.id === next.id), `collided: ${next.id}`);

  // Rows without any `id` keep their previous behaviour: no id is invented.
  const noId = createDefaultInsertedRow(
    [{ name: "x" }],
    resolveColumns([createColumn.text("name")])
  );
  assert.equal("id" in noId, false);
}

export function moveMetaTests() {
  // A-038: meta is keyed by array index, so a row move must carry its meta with it.
  const cellMeta = {
    "0::name": { backgroundColor: "red" },
    "1::name": { backgroundColor: "green" },
    "2::name": { backgroundColor: "blue" },
    "2::qty": { wrap: true },
  };
  const down = shiftCellMetaForMovedRow(cellMeta, 0, 2);
  assert.deepEqual(down, {
    "2::name": { backgroundColor: "red" },
    "0::name": { backgroundColor: "green" },
    "1::name": { backgroundColor: "blue" },
    "1::qty": { wrap: true },
  });
  const up = shiftCellMetaForMovedRow(cellMeta, 2, 0);
  assert.deepEqual(up, {
    "1::name": { backgroundColor: "red" },
    "2::name": { backgroundColor: "green" },
    "0::name": { backgroundColor: "blue" },
    "0::qty": { wrap: true },
  });
  assert.deepEqual(shiftCellMetaForMovedRow(cellMeta, 1, 1), cellMeta);

  const rowMeta = { 0: { className: "a" }, 2: { className: "c" } };
  assert.deepEqual(shiftRowMetaForMovedRow(rowMeta, 0, 2), {
    2: { className: "a" },
    1: { className: "c" },
  });
  assert.deepEqual(shiftRowMetaForMovedRow(rowMeta, 2, 0), {
    1: { className: "a" },
    0: { className: "c" },
  });
}

export function deleteColumnTests() {
  const rows = [
    { id: 1, name: "a", qty: 1 },
    { id: 2, name: "b", qty: 2 },
  ];

  // Ordinary data column: stripped as before.
  assert.deepEqual(deleteColumnValueFromRows(rows, "qty"), [
    { id: 1, name: "a" },
    { id: 2, name: "b" },
  ]);

  // A-049: the row-id field is never stripped (ids would collapse to array indexes).
  const keptId = deleteColumnValueFromRows(rows, "id");
  assert.deepEqual(keptId, rows);

  // ...also when identity comes from getRowId over another field.
  const byName = (row) => `n:${row.name}`;
  assert.deepEqual(deleteColumnValueFromRows(rows, "name", byName), rows);
  assert.deepEqual(deleteColumnValueFromRows(rows, "id", byName), [
    { name: "a", qty: 1 },
    { name: "b", qty: 2 },
  ]);

  // Nothing to strip: same array back, so callers can skip the emit.
  assert.equal(deleteColumnValueFromRows(rows, "computed"), rows);
  assert.equal(deleteColumnValueFromRows(rows, "id"), rows);
}

export function cloneTests() {
  // A-104: nested plain data must not be shared with the source.
  const date = new Date(1_700_000_000_000);
  const rows = [{ id: 1, tags: ["a", "b"], owner: { name: "x", at: date } }];
  const copy = cloneRows(rows);
  assert.deepEqual(copy, rows);
  assert.notEqual(copy[0].tags, rows[0].tags);
  assert.notEqual(copy[0].owner, rows[0].owner);
  assert.notEqual(copy[0].owner.at, date);
  assert.equal(copy[0].owner.at.getTime(), date.getTime());
  rows[0].tags.push("c");
  rows[0].owner.name = "mutated";
  assert.deepEqual(copy[0].tags, ["a", "b"]);
  assert.equal(copy[0].owner.name, "x");

  // Cyclic row data must not recurse forever.
  const cyc = { id: 1 };
  cyc.self = cyc;
  const cycCopy = cloneRows([cyc])[0];
  assert.equal(cycCopy.self, cycCopy);
  assert.notEqual(cycCopy, cyc);

  // Class instances / functions stay by reference (not plain data).
  class Box {}
  const box = new Box();
  const fn = () => 1;
  const refRow = cloneRows([{ box, fn }])[0];
  assert.equal(refRow.box, box);
  assert.equal(refRow.fn, fn);

  const columns = [
    {
      ...createColumn.text("name"),
      options: ["a"],
      validations: [{ type: "required", message: "m" }],
    },
  ];
  const columnCopy = cloneColumns(columns);
  assert.deepEqual(columnCopy[0].validations, columns[0].validations);
  assert.deepEqual(columnCopy[0].options, columns[0].options);
  assert.notEqual(columnCopy[0].options, columns[0].options);
  assert.notEqual(columnCopy[0].validations, columns[0].validations);
  assert.notEqual(columnCopy[0].validations[0], columns[0].validations[0]);
  columns[0].validations[0].message = "mutated";
  assert.equal(columnCopy[0].validations[0].message, "m");

  const meta = { "0::name": { style: { color: "red" } } };
  const metaCopy = cloneCellMetaMap(meta);
  assert.notEqual(metaCopy["0::name"].style, meta["0::name"].style);

  // History snapshots cannot be mutated through shared nested references.
  const source = snap([{ id: 1, tags: ["a"] }]);
  const snapshot = cloneSnapshot(source);
  source.rows[0].tags.push("leak");
  assert.deepEqual(snapshot.rows[0].tags, ["a"]);
  const state = createInitialHistoryState(source);
  source.rows[0].tags.push("leak2");
  assert.deepEqual(state.present.rows[0].tags, ["a", "leak"]);

  // Cloned data still compares equal, so no-op detection (updateRows / undo) keeps working.
  assert.equal(shallowEqualRows(copy, cloneRows(copy)), true);
  assert.equal(
    shallowEqualRows([{ tags: ["a"] }], [{ tags: ["b"] }]),
    false,
    "nested difference is a difference"
  );
  const withRules = [{ ...createColumn.text("n"), validations: [{ type: "required" }] }];
  assert.equal(shallowEqualColumns(withRules, cloneColumns(withRules)), true);
  assert.equal(
    shallowEqualColumns(withRules, [
      { ...createColumn.text("n"), validations: [{ type: "required", message: "x" }] },
    ]),
    false
  );
}

export function pushDedupeTests() {
  // A-104: re-applying identical formatting must not burn a history slot or clear redo.
  const base = snap([{ n: 1 }], { cellMeta: { "0::n": { backgroundColor: "red" } } });
  let state = createInitialHistoryState(base);
  const present = state.present;
  const payload = {
    rows: present.rows,
    columns: present.columns,
    rowMeta: present.rowMeta,
    cellMeta: { "0::n": { backgroundColor: "red" } },
  };
  const same = historyReducer(state, { type: "PUSH", payload });
  assert.equal(same, state, "identical formatting push is a no-op");

  state = historyReducer(state, {
    type: "PUSH",
    payload: { ...payload, cellMeta: { "0::n": { backgroundColor: "blue" } } },
  });
  assert.equal(state.past.length, 1);
  const undone = historyReducer(state, { type: "UNDO" });
  assert.equal(undone.future.length, 1);
  // Identical re-push while redo is available must keep redo.
  const noop = historyReducer(undone, {
    type: "PUSH",
    payload: {
      rows: undone.present.rows,
      columns: undone.present.columns,
      rowMeta: undone.present.rowMeta,
      cellMeta: { "0::n": { backgroundColor: "red" } },
    },
  });
  assert.equal(noop.future.length, 1);
}

export function structurallyEqualTests() {
  // structurallyEqual is internal; sameColumnStructure is its public face.
  const col = (extra) => ({ key: "a", title: "A", ...extra });
  const same = (a, b) => sameColumnStructure([col(a)], [col(b)]);

  assert.equal(same({ x: new Date(1) }, { x: new Date(1) }), true);
  assert.equal(same({ x: new Date(1) }, { x: new Date(2) }), false, "Dates compare by time");
  assert.equal(same({ x: new Date(1) }, { x: {} }), false, "Date vs plain empty object");
  assert.equal(same({ x: {} }, { x: [] }), false);
  assert.equal(same({ x: new Map([[1, 2]]) }, { x: new Map([[1, 3]]) }), false);
  assert.equal(same({ x: new Map([[1, 2]]) }, { x: new Map([[1, 2]]) }), true);
  assert.equal(same({ x: new Set([1]) }, { x: new Set([2]) }), false);
  assert.equal(same({ x: new Set([1]) }, { x: new Set([1]) }), true);
  assert.equal(same({ x: new Map() }, { x: new Set() }), false);
  assert.equal(same({ x: new Map() }, { x: {} }), false, "empty Map vs empty object");
  // Functions still compare by presence (inline closures must not look like a change).
  assert.equal(same({ f: () => 1 }, { f: () => 2 }), true);
  assert.equal(same({ f: () => 1 }, {}), false);

  // Cyclic values must terminate.
  const a = col({});
  a.self = a;
  const b = col({});
  b.self = b;
  assert.equal(sameColumnStructure([a], [b]), true);
  const c = col({});
  c.self = { key: "a", title: "different" };
  assert.equal(sameColumnStructure([a], [c]), false);
}

export function runStateStructureTests() {
  historyLimitTests();
  allowedRowIdsTests();
  rowIdTests();
  moveMetaTests();
  deleteColumnTests();
  cloneTests();
  pushDedupeTests();
  structurallyEqualTests();
}
