import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createColumn,
  createDefaultInsertedColumn,
  createDefaultInsertedRow,
  insertColumnAtIndex,
  insertColumnValueIntoRows,
  resolveColumns,
  shiftCellMetaForInsertedRow,
  shiftRowMetaForInsertedRow,
} = require("../dist/index.cjs");

export function runStructureTests() {
  const columns = resolveColumns([
    createColumn.text("account", { title: "Account" }),
    createColumn.number("contractorCount", { title: "Contractor Count" }),
    createColumn.checkbox("live", { title: "Live" }),
  ]);
  const rows = [
    { id: 10, account: "Northwind", contractorCount: 1, live: true },
    { id: 11, account: "BluePeak", contractorCount: 2, live: false },
  ];

  assert.deepEqual(createDefaultInsertedRow(rows, columns), {
    id: 12,
    account: "",
    contractorCount: null,
    live: false,
  });

  const insertedColumn = createDefaultInsertedColumn(
    [
      createColumn.text("account", { title: "Account" }),
      createColumn.select("status", {
        title: "Status",
        options: ["Open", "Closed"],
      }),
    ],
    1,
    createColumn.select("status", {
      title: "Status",
      options: ["Open", "Closed"],
    }),
    "left"
  );

  assert.equal(insertedColumn.type, "select");
  assert.deepEqual(insertedColumn.options, ["Open", "Closed"]);
  assert.notEqual(insertedColumn.key, "status");

  const nextColumns = insertColumnAtIndex(
    [
      createColumn.text("account", { title: "Account" }),
      createColumn.number("value", { title: "Value" }),
    ],
    1,
    createColumn.checkbox("live", { title: "Live" })
  );
  assert.deepEqual(nextColumns.map((column) => column.key), ["account", "live", "value"]);

  assert.deepEqual(
    insertColumnValueIntoRows(
      [
        { account: "Northwind", value: 120 },
        { account: "BluePeak", value: 80 },
      ],
      createColumn.checkbox("live", { title: "Live" })
    ),
    [
      { account: "Northwind", value: 120, live: false },
      { account: "BluePeak", value: 80, live: false },
    ]
  );

  assert.deepEqual(shiftCellMetaForInsertedRow({ "0::account": { error: null }, "2::value": { error: "bad" } }, 1), {
    "0::account": { error: null },
    "3::value": { error: "bad" },
  });

  assert.deepEqual(shiftRowMetaForInsertedRow({ 0: { className: "a" }, 2: { className: "b" } }, 1), {
    0: { className: "a" },
    3: { className: "b" },
  });
}
