import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  applyFormatPainterToBounds,
  copyFormatFromSelection,
  createColumn,
  createInitialSelectionState,
  resolveColumns,
  setRangeSelection,
} = require("../dist/index.cjs");

export function runFormatPainterTests() {
  const columns = resolveColumns([
    createColumn.text("account", { title: "Account" }),
    createColumn.text("owner", { title: "Owner" }),
  ]);
  const selection = setRangeSelection(
    createInitialSelectionState(),
    { row: 0, col: 0 },
    { row: 0, col: 0 }
  );
  const copied = copyFormatFromSelection(
    {
      "0::account": {
        backgroundColor: "#fee2e2",
        wrap: true,
        wrapText: true,
        horizontalAlign: "center",
        verticalAlign: "bottom",
        textOrientation: "rotateDown",
        indentLevel: 2,
        style: { fontWeight: 700, color: "#b91c1c" },
      },
    },
    selection,
    [0, 1],
    columns,
    2
  );

  // A-105: copy only the keys actually set on the source — no injected `className: ""`.
  assert.deepEqual(copied, {
    rows: 1,
    cols: 1,
    meta: {
      "0::0": {
        backgroundColor: "#fee2e2",
        wrap: true,
        wrapText: true,
        horizontalAlign: "center",
        verticalAlign: "bottom",
        textOrientation: "rotateDown",
        indentLevel: 2,
        style: { fontWeight: 700, color: "#b91c1c" },
      },
    },
  });

  const applied = applyFormatPainterToBounds(
    {},
    copied,
    { startRow: 1, endRow: 1, startCol: 1, endCol: 1 },
    [0, 1],
    columns
  );

  // A-105: applied meta carries only the source's present keys — no `className: ""`, no
  // `readonly: undefined` / `error: undefined` noise.
  assert.deepEqual(applied, {
    "1::owner": {
      backgroundColor: "#fee2e2",
      wrap: true,
      wrapText: true,
      horizontalAlign: "center",
      verticalAlign: "bottom",
      textOrientation: "rotateDown",
      indentLevel: 2,
      style: { fontWeight: 700, color: "#b91c1c" },
    },
  });

  // A-105: painting a plain cell (only a background colour, no wrap) must NOT inject wrap:false,
  // which would override the column's own wrap default.
  const plain = copyFormatFromSelection(
    { "0::account": { backgroundColor: "#eef" } },
    selection,
    [0, 1],
    columns,
    2
  );
  assert.deepEqual(plain.meta["0::0"], { backgroundColor: "#eef" }, "plain cell copies only bg");

  const paintedPlain = applyFormatPainterToBounds(
    {},
    plain,
    { startRow: 1, endRow: 1, startCol: 1, endCol: 1 },
    [0, 1],
    columns
  );
  const plainKey = "1::owner";
  assert.ok(!("wrap" in paintedPlain[plainKey]), "no injected wrap:false");
  assert.ok(!("wrapText" in paintedPlain[plainKey]), "no injected wrapText");
  assert.ok(!("className" in paintedPlain[plainKey]), "no injected className");
  assert.deepEqual(paintedPlain[plainKey], { backgroundColor: "#eef" }, "only bg survives");

  // A-105: applying twice is idempotent (no accumulated undefined keys).
  const once = applyFormatPainterToBounds(
    {},
    copied,
    { startRow: 0, endRow: 1, startCol: 0, endCol: 1 },
    [0, 1],
    columns
  );
  const twice = applyFormatPainterToBounds(
    once,
    copied,
    { startRow: 0, endRow: 1, startCol: 0, endCol: 1 },
    [0, 1],
    columns
  );
  assert.deepEqual(twice, once, "painter is idempotent");

  // `keepWrap` preserves the target's own wrap instead of copying the source's.
  const keep = applyFormatPainterToBounds(
    { "1::owner": { wrap: true } },
    copyFormatFromSelection(
      { "0::account": { backgroundColor: "#eef", wrap: false } },
      selection,
      [0, 1],
      columns,
      2
    ),
    { startRow: 1, endRow: 1, startCol: 1, endCol: 1 },
    [0, 1],
    columns,
    { keepWrap: true }
  );
  assert.equal(keep["1::owner"].wrap, true, "keepWrap retains the target's wrap");
}
