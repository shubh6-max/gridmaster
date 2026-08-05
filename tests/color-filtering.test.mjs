import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  applyColorSortToRowIndexes,
  createColorFilter,
  createValueSetFilter,
  getFilteredColorOptionsForColumn,
  rowMatchesColorFilters,
} = require("../dist/index.cjs");

export function runColorFilteringTests() {
const columns = [
  {
    key: "org_chart_color_code",
    title: "Org Chart Color",
    type: "text",
    editable: false,
    readonly: true,
    sortable: true,
    filterable: true,
    resizable: true,
    frozen: false,
    wrap: false,
    hidden: false,
    width: 140,
    minWidth: 80,
  },
  {
    key: "account",
    title: "Account",
    type: "text",
    editable: false,
    readonly: true,
    sortable: true,
    filterable: true,
    resizable: true,
    frozen: false,
    wrap: false,
    hidden: false,
    width: 140,
    minWidth: 80,
  },
];

const rows = [
  { id: "1", org_chart_color_code: "light_blue", account: "Acme" },
  { id: "2", org_chart_color_code: "", account: "Acme" },
  { id: "3", org_chart_color_code: "light_red", account: "Globex" },
  { id: "4", org_chart_color_code: "light_blue", account: "Globex" },
];

{
  const colorFilters = {
    org_chart_color_code: createColorFilter(["light_blue", ""]),
  };

  assert.equal(
    rowMatchesColorFilters(rows[0], columns, colorFilters, { rows, rowIndex: 0 }),
    true,
    "manual color should match color filter"
  );
  assert.equal(
    rowMatchesColorFilters(rows[1], columns, colorFilters, { rows, rowIndex: 1 }),
    true,
    "blank color should match blank color filter"
  );
  assert.equal(
    rowMatchesColorFilters(rows[2], columns, colorFilters, { rows, rowIndex: 2 }),
    false,
    "non-selected colors should be excluded"
  );
}

{
  const visibleColumnsOnly = [columns[1]];
  const colorFilters = {
    org_chart_color_code: createColorFilter(["light_blue"]),
  };

  assert.equal(
    rowMatchesColorFilters(rows[0], visibleColumnsOnly, colorFilters, { rows, rowIndex: 0 }),
    true,
    "color filter should work even when the source key is not a visible grid column"
  );
  assert.equal(
    rowMatchesColorFilters(rows[2], visibleColumnsOnly, colorFilters, { rows, rowIndex: 2 }),
    false,
    "non-matching rows should still be excluded when color source column is hidden"
  );
}

{
  const sortedIndexes = applyColorSortToRowIndexes(
    [0, 1, 2, 3],
    rows,
    columns,
    { columnKey: "org_chart_color_code", value: "light_blue" }
  );

  assert.deepEqual(
    sortedIndexes,
    [0, 3, 1, 2],
    "selected color should be promoted to the top while preserving relative order"
  );
}

{
  const visibleColumnsOnly = [columns[1]];
  const sortedIndexes = applyColorSortToRowIndexes(
    [0, 1, 2, 3],
    rows,
    visibleColumnsOnly,
    { columnKey: "org_chart_color_code", value: "light_blue" }
  );

  assert.deepEqual(
    sortedIndexes,
    [0, 3, 1, 2],
    "color sort should work even when the source key is not a visible grid column"
  );
}

{
  const valueFilters = {
    account: createValueSetFilter(["Acme"]),
  };
  const colorFilters = {
    org_chart_color_code: createColorFilter(["light_blue"]),
  };

  const options = getFilteredColorOptionsForColumn(
    rows,
    columns,
    "org_chart_color_code",
    valueFilters,
    colorFilters
  );

  assert.deepEqual(
    options,
    [
      { value: "", count: 1 },
      { value: "light_blue", count: 1 },
    ],
    "color option counts should respect other filters but ignore the current column color filter"
  );
}

{
  const visibleColumnsOnly = [columns[1]];
  const options = getFilteredColorOptionsForColumn(
    rows,
    visibleColumnsOnly,
    "org_chart_color_code",
    {},
    {}
  );

  assert.deepEqual(
    options,
    [
      { value: "", count: 1 },
      { value: "light_blue", count: 2 },
      { value: "light_red", count: 1 },
    ],
    "color option counts should still resolve from row data when the source key is hidden"
  );
}
}
