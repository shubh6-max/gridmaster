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
        style: { fontWeight: 700, color: "#b91c1c" },
      },
    },
    selection,
    [0, 1],
    columns,
    2
  );

  assert.deepEqual(copied, {
    rows: 1,
    cols: 1,
    meta: {
      "0::0": {
        backgroundColor: "#fee2e2",
        wrap: true,
        className: "",
        style: { fontWeight: 700, color: "#b91c1c" },
      },
    },
  });

  const applied = applyFormatPainterToBounds(
    {},
    copied,
    {
      startRow: 1,
      endRow: 1,
      startCol: 1,
      endCol: 1,
    },
    [0, 1],
    columns
  );

  assert.deepEqual(applied, {
    "1::owner": {
      backgroundColor: "#fee2e2",
      wrap: true,
      className: "",
      style: { fontWeight: 700, color: "#b91c1c" },
      readonly: undefined,
      error: undefined,
    },
  });
}
