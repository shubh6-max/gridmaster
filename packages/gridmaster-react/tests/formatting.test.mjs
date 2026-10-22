import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  MIXED_FORMAT_VALUE,
  applyCellMetaPatchToBounds,
  applyCellStyleToBounds,
  createColumn,
  resolveColumns,
  summarizeSelectionFormatting,
  transformCellMetaInBounds,
} = require("../dist/index.cjs");

export function runFormattingTests() {
  const columns = resolveColumns([
    createColumn.text("account", { title: "Account" }),
    createColumn.number("value", { title: "Value" }),
  ]);

  const nextMeta = applyCellStyleToBounds(
    {
      "0::account": {
        backgroundColor: "#fef3c7",
        style: {
          fontWeight: 700,
        },
      },
    },
    {
      fontFamily: "Calibri",
      fontSize: 14,
    },
    {
      startRow: 0,
      endRow: 1,
      startCol: 0,
      endCol: 1,
    },
    [0, 1],
    columns
  );

  assert.equal(nextMeta["0::account"].backgroundColor, "#fef3c7");
  assert.equal(nextMeta["0::account"].style.fontWeight, 700);
  assert.equal(nextMeta["0::account"].style.fontFamily, "Calibri");
  assert.equal(nextMeta["0::account"].style.fontSize, 14);
  assert.equal(nextMeta["1::value"].style.fontFamily, "Calibri");
  assert.equal(nextMeta["1::value"].style.fontSize, 14);

  const alignedMeta = applyCellMetaPatchToBounds(
    nextMeta,
    {
      backgroundColor: "#bfdbfe",
      wrap: true,
      wrapText: true,
      horizontalAlign: "center",
      verticalAlign: "bottom",
      textOrientation: "rotateDown",
      indentLevel: 2,
      style: {
        color: "#1d4ed8",
        border: "1px solid #475569",
      },
    },
    {
      startRow: 0,
      endRow: 0,
      startCol: 1,
      endCol: 1,
    },
    [0, 1],
    columns
  );

  assert.equal(alignedMeta["0::value"].backgroundColor, "#bfdbfe");
  assert.equal(alignedMeta["0::value"].wrap, true);
  assert.equal(alignedMeta["0::value"].wrapText, true);
  assert.equal(alignedMeta["0::value"].horizontalAlign, "center");
  assert.equal(alignedMeta["0::value"].verticalAlign, "bottom");
  assert.equal(alignedMeta["0::value"].textOrientation, "rotateDown");
  assert.equal(alignedMeta["0::value"].indentLevel, 2);
  assert.equal(alignedMeta["0::value"].style.color, "#1d4ed8");
  assert.equal(alignedMeta["0::value"].style.border, "1px solid #475569");

  const indentedMeta = transformCellMetaInBounds(
    alignedMeta,
    (currentMeta) => ({
      ...currentMeta,
      indentLevel: (currentMeta.indentLevel ?? 0) + 1,
    }),
    {
      startRow: 0,
      endRow: 0,
      startCol: 1,
      endCol: 1,
    },
    [0, 1],
    columns
  );

  assert.equal(indentedMeta["0::value"].indentLevel, 3);

  const clearedMeta = applyCellStyleToBounds(
    alignedMeta,
    {
      fontFamily: "",
      fontSize: "",
    },
    {
      startRow: 1,
      endRow: 1,
      startCol: 1,
      endCol: 1,
    },
    [0, 1],
    columns
  );

  assert.equal(clearedMeta["1::value"], undefined);

  const summary = summarizeSelectionFormatting(
    {
      "0::account": {
        horizontalAlign: "left",
        verticalAlign: "top",
        wrapText: false,
        style: {
          fontFamily: "Calibri",
          fontSize: 12,
          color: "#0f172a",
        },
      },
      "0::value": {
        horizontalAlign: "right",
        verticalAlign: "top",
        wrapText: true,
        indentLevel: 1,
        style: {
          fontFamily: "Calibri",
          fontSize: 12,
          color: "#0f172a",
        },
      },
    },
    {
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 1,
    },
    [0],
    columns
  );

  assert.equal(summary.horizontalAlign, MIXED_FORMAT_VALUE);
  assert.equal(summary.verticalAlign, "top");
  assert.equal(summary.wrapText, MIXED_FORMAT_VALUE);
  assert.equal(summary.fontFamily, "Calibri");
  assert.equal(summary.fontSize, 12);
  assert.equal(summary.textColor, "#0f172a");
  assert.equal(summary.indentLevel, MIXED_FORMAT_VALUE);
}
