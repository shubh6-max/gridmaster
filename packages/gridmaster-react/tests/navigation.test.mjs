import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createInitialSelectionState,
  setActiveCell,
  pageUp,
  pageDown,
  goToFirstCell,
  goToLastCell,
  goToDataEdge,
  navigateByKey,
} = require("../dist/index.cjs");

const bounds = { totalRows: 100, totalCols: 10 };

function at(row, col) {
  return setActiveCell(createInitialSelectionState(), { row, col });
}

export function runNavigationTests() {
  /* --- A-097: PageUp / PageDown by a visible page size --------------------- */
  assert.deepEqual(pageDown(at(0, 2), bounds, 20).cursor, { row: 20, col: 2 });
  assert.deepEqual(pageDown(at(90, 2), bounds, 20).cursor, { row: 99, col: 2 }, "clamp to last row");
  assert.deepEqual(pageUp(at(50, 3), bounds, 20).cursor, { row: 30, col: 3 });
  assert.deepEqual(pageUp(at(5, 3), bounds, 20).cursor, { row: 0, col: 3 }, "clamp to first row");

  /* --- Ctrl+Home / Ctrl+End ----------------------------------------------- */
  assert.deepEqual(goToFirstCell(at(40, 5), bounds).cursor, { row: 0, col: 0 });
  assert.deepEqual(goToLastCell(at(40, 5), bounds).cursor, { row: 99, col: 9 });

  /* --- Ctrl+Arrow data-region edges (Excel semantics) --------------------- */
  // Column 0: filled, filled, BLANK, filled, filled.
  const colValues = ["x", "y", "", "z", "w"];
  const smallBounds = { totalRows: 5, totalCols: 3 };
  const getValue = (row, col) => (col === 0 ? colValues[row] : "");

  // From a filled cell whose neighbour is filled -> jump to end of the block (before the blank).
  assert.deepEqual(goToDataEdge(at(0, 0), smallBounds, "down", getValue).cursor, { row: 1, col: 0 });
  // From a filled cell whose neighbour is blank -> skip the gap to the next filled cell.
  assert.deepEqual(goToDataEdge(at(1, 0), smallBounds, "down", getValue).cursor, { row: 3, col: 0 });
  // Inside the second block -> jump to the last filled row.
  assert.deepEqual(goToDataEdge(at(3, 0), smallBounds, "down", getValue).cursor, { row: 4, col: 0 });
  // Already at the edge -> stay put.
  assert.deepEqual(goToDataEdge(at(4, 0), smallBounds, "down", getValue).cursor, { row: 4, col: 0 });
  // Upward from the bottom block jumps to its top.
  assert.deepEqual(goToDataEdge(at(4, 0), smallBounds, "up", getValue).cursor, { row: 3, col: 0 });
  // From a blank-trailing column, a run of blanks lands on the far edge.
  const blanks = (row, col) => "";
  assert.deepEqual(goToDataEdge(at(0, 1), smallBounds, "down", blanks).cursor, { row: 4, col: 1 });

  /* --- navigateByKey dispatches the new combos when ctrlKey/pageSize given - */
  assert.deepEqual(
    navigateByKey(at(10, 1), "Home", bounds, { ctrlKey: true }).cursor,
    { row: 0, col: 0 },
    "Ctrl+Home -> first cell"
  );
  assert.deepEqual(
    navigateByKey(at(10, 1), "End", bounds, { ctrlKey: true }).cursor,
    { row: 99, col: 9 },
    "Ctrl+End -> last cell"
  );
  assert.deepEqual(
    navigateByKey(at(0, 0), "PageDown", bounds, { pageSize: 25 }).cursor,
    { row: 25, col: 0 }
  );
  assert.deepEqual(
    navigateByKey(at(1, 0), "ArrowDown", smallBounds, { ctrlKey: true, getValue }).cursor,
    { row: 3, col: 0 },
    "Ctrl+ArrowDown -> data edge"
  );
  // Plain Home still goes to the row start (back-compat).
  assert.deepEqual(navigateByKey(at(10, 4), "Home", bounds).cursor, { row: 10, col: 0 });
}
