import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  clipboardToText,
  copySelection,
  createColumn,
  createInitialSelectionState,
  extractSelectionMatrix,
  pasteMatrixAt,
  resolveColumns,
  setRangeSelection,
  textToClipboardMatrix,
} = require("../dist/index.cjs");

// A-055: RFC-4180-style TSV. clipboardToText quotes any cell with a tab, newline or quote
// (doubling embedded quotes); textToClipboardMatrix parses quote-aware so a round-trip is lossless.
function testRfc4180RoundTrip() {
  const matrices = [
    [["a", "b"], ["c", "d"]],
    [["tab\there", "plain"]],
    [["line1\nline2", "x"]],
    [["carriage\rreturn", "y"]],
    [['has "quotes"', "z"]],
    [["  leading/trailing  ", ""]],
    [["", "", ""]],
    [["café", "naïve", "😀"]],
    [['a"b\tc\nd', "mix"]],
  ];
  for (const matrix of matrices) {
    const text = clipboardToText({ data: matrix, isCut: false, origin: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 } });
    const parsed = textToClipboardMatrix(text);
    assert.deepEqual(parsed, matrix, `round-trip failed for ${JSON.stringify(matrix)} via ${JSON.stringify(text)}`);
  }
  // A cell with no special chars must NOT be quoted (default/back-compat shape).
  const plain = clipboardToText({ data: [["a", "b"]], isCut: false, origin: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 } });
  assert.equal(plain, "a\tb", "plain cells are not quoted");
}

// Paste of Excel-style clipboard text: CRLF rows, a quoted multi-line cell, a trailing newline.
function testExcelStylePaste() {
  // Two columns; second row's first cell is a quoted multi-line value. CRLF line endings.
  const text = 'name\tnote\r\n"multi\nline"\tok\r\n';
  const parsed = textToClipboardMatrix(text);
  assert.deepEqual(parsed, [
    ["name", "note"],
    ["multi\nline", "ok"],
  ], "CRLF + quoted multi-line cell + trailing newline");

  // Trailing newline (LF) does not create an extra empty row.
  assert.deepEqual(textToClipboardMatrix("a\tb\n"), [["a", "b"]], "trailing LF adds no row");
  // A blank line in the MIDDLE is a real empty row.
  assert.deepEqual(textToClipboardMatrix("a\n\nb"), [["a"], [""], ["b"]], "middle blank row kept");
  // A lone quote inside an unquoted field is literal.
  assert.deepEqual(textToClipboardMatrix('a"b\tc'), [['a"b', "c"]], "lone quote is literal");
  // Doubled quotes inside a quoted field = one literal quote.
  assert.deepEqual(textToClipboardMatrix('"a""b"\tc'), [['a"b', "c"]], "escaped quote inside quotes");
}

// A-064: copy exports RAW stored values by default; an opt-in valueMode:"displayed" formats them.
function testCopyValueMode() {
  const columns = resolveColumns([
    createColumn.number("amount", { title: "Amount" }),
    createColumn.date("when", { title: "When" }),
  ]);
  const rows = [{ amount: 1234.5, when: "2026-04-02" }];
  const selection = setRangeSelection(createInitialSelectionState(), { row: 0, col: 0 }, { row: 0, col: 1 });

  const raw = extractSelectionMatrix(rows, columns, selection);
  assert.deepEqual(raw.data, [["1234.5", "2026-04-02"]], "default is raw stored values");

  const displayed = extractSelectionMatrix(rows, columns, selection, { valueMode: "displayed" });
  // The date column formats via the date renderer; the number stays its string form.
  assert.equal(displayed.data[0][0], "1234.5", "raw number unchanged in displayed mode (no formatter)");
  assert.notEqual(displayed.data[0][1], "2026-04-02", "displayed date is formatted, not the ISO string");

  // copySelection forwards the option and still serialises to RFC-4180 text.
  const copied = copySelection(rows, columns, selection, false, { valueMode: "displayed" });
  assert.equal(copied.text, copied.clipboard.data.map((r) => r.join("\t")).join("\n"));
}

export function runClipboardAndPasteTests() {
  testRfc4180RoundTrip();
  testExcelStylePaste();
  testCopyValueMode();

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
