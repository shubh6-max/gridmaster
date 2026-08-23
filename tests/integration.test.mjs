import assert from "node:assert";
import React from "react";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { GridMaster } = require("../dist/index.cjs");

export function runIntegrationTests() {
  // Test basic component instantiation
  const element = React.createElement(GridMaster, {
    rows: [{ id: "1", a: "Val 1" }],
    columns: [{ key: "a", header: "A" }],
    showToolbar: false,
    showFormulaBar: false,
    showStatusBar: false,
  });

  assert.equal(element.type, GridMaster);
  assert.equal(element.props.rows[0].a, "Val 1");
  assert.equal(element.props.columns[0].key, "a");

  console.log("ok - integration basic render check");
}
