import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createInitialSelectionState,
  getClipboardSelectionBounds,
  resolveGridRowId,
  selectSingleColumn,
  selectSingleRow,
  setRangeSelection,
} = require("../dist/index.cjs");

export function runRowIdAndSelectionTests() {
  const row = { id: 7, account: "Northwind" };
  assert.equal(
    resolveGridRowId(row, 3, (currentRow, index) => `${currentRow.account}-${index}`),
    "Northwind-3"
  );

  assert.equal(resolveGridRowId({ id: 42 }, 5), "42");
  assert.equal(resolveGridRowId({ account: "No id" }, 5), "5");

  const selection = setRangeSelection(
    createInitialSelectionState(),
    { row: 4, col: 3 },
    { row: 1, col: 0 }
  );
  assert.deepEqual(getClipboardSelectionBounds(selection, 10, 8), {
    startRow: 1,
    endRow: 4,
    startCol: 0,
    endCol: 3,
  });

  const rowSelection = selectSingleRow(createInitialSelectionState(), 2, 6);
  const columnSelection = selectSingleColumn(createInitialSelectionState(), 4, 9);

  assert.deepEqual(getClipboardSelectionBounds(rowSelection, 9, 6), {
    startRow: 2,
    endRow: 2,
    startCol: 0,
    endCol: 5,
  });

  assert.deepEqual(getClipboardSelectionBounds(columnSelection, 9, 6), {
    startRow: 0,
    endRow: 8,
    startCol: 4,
    endCol: 4,
  });
}
