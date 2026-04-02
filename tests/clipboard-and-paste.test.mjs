import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createColumn,
  createInitialSelectionState,
  extractSelectionMatrix,
  pasteMatrixAt,
  resolveColumns,
  setRangeSelection,
} = require("../dist/index.cjs");

export function runClipboardAndPasteTests() {
  const extractColumns = resolveColumns([
    createColumn.text("account", { title: "Account" }),
    createColumn.number("budgetK", { title: "Budget" }),
    createColumn.checkbox("active", { title: "Live" }),
  ]);
  const extractRows = [
    { account: "Northwind", budgetK: 120, active: true },
    { account: "BluePeak", budgetK: 260, active: false },
    { account: "Aurora", budgetK: 310, active: true },
  ];
  const selection = setRangeSelection(
    createInitialSelectionState(),
    { row: 0, col: 1 },
    { row: 1, col: 2 }
  );

  const { data, bounds } = extractSelectionMatrix(extractRows, extractColumns, selection);

  assert.deepEqual(bounds, {
    startRow: 0,
    endRow: 1,
    startCol: 1,
    endCol: 2,
  });
  assert.deepEqual(data, [
    ["120", "true"],
    ["260", "false"],
  ]);

  const pasteColumns = resolveColumns([
    createColumn.number("series", { title: "Series" }),
    createColumn.checkbox("active", { title: "Active" }),
    createColumn.date("launchDate", { title: "Launch" }),
    createColumn.text("notes", { title: "Notes" }),
  ]);
  const pasteRows = [
    { series: null, active: false, launchDate: "", notes: "" },
    { series: null, active: false, launchDate: "", notes: "" },
  ];

  const result = pasteMatrixAt(pasteRows, pasteColumns, 0, 0, [
    ["1", "true", "2026-04-02", "ready"],
    ["2", "false", "2026-04-03", "next"],
  ]);

  assert.deepEqual(result.affectedBounds, {
    startRow: 0,
    endRow: 1,
    startCol: 0,
    endCol: 3,
  });
  assert.deepEqual(result.rows, [
    { series: 1, active: true, launchDate: "2026-04-02", notes: "ready" },
    { series: 2, active: false, launchDate: "2026-04-03", notes: "next" },
  ]);
}
