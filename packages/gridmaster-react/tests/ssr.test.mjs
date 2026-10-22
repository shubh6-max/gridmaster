// F-001: server-side rendering must not touch browser-only globals during render.
// `renderToString(<GridMaster/>)` in plain Node (no jsdom) previously threw
// `DOMRect is not defined` from `safeDomRect()`. This NODE suite renders the built
// package under real Node and asserts a non-empty string containing a row value,
// across several configurations. Language: Node ESM + node:assert (strict).
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToString } = require("react-dom/server");
const { GridMaster, createColumnFactory } = require("../dist/index.cjs");

const col = createColumnFactory();
const columns = [
  col.text("name"),
  col.number("qty"),
  col.checkbox("done"),
];
const rows = [
  { id: 1, name: "Alpha", qty: 10, done: false },
  { id: 2, name: "Bravo", qty: 20, done: true },
  { id: 3, name: "Charlie", qty: 30, done: false },
];

const configs = [
  ["default", {}],
  ["virtualizeRows", { virtualizeRows: true }],
  ["frozenColumns", { frozenColumns: 1 }],
  ["readonly", { mode: "readonly" }],
  ["chrome off", { showToolbar: false, showFormulaBar: false, showStatusBar: false }],
  ["chrome on", { showToolbar: true, showFormulaBar: true, showStatusBar: true }],
  ["conditional formatting", { enableConditionalFormatting: true }],
];

export function runSsrTests() {
  for (const [label, extra] of configs) {
    let html;
    assert.doesNotThrow(() => {
      html = renderToString(React.createElement(GridMaster, { rows, columns, ...extra }));
    }, `SSR must not throw for config: ${label}`);

    assert.ok(typeof html === "string" && html.length > 0, `SSR returns a non-empty string (${label})`);
    assert.ok(html.includes("Alpha"), `SSR output contains a row value (${label})`);
    // A1: the ARIA grid role and counts are present in the server-rendered markup.
    assert.ok(html.includes('role="grid"'), `SSR output exposes role=grid (${label})`);
    assert.ok(html.includes("aria-rowcount="), `SSR output exposes aria-rowcount (${label})`);
    assert.ok(html.includes("aria-colcount="), `SSR output exposes aria-colcount (${label})`);
    // A2: data cells carry a DOM id, and the default cursor's aria-activedescendant points at one
    // that is actually present in the server markup (a live IDREF, never a dangling reference).
    assert.ok(html.includes("id="), `SSR output includes cell ids (${label})`);
    const activeDescendant = html.match(/aria-activedescendant="([^"]+)"/);
    assert.ok(activeDescendant, `SSR output exposes aria-activedescendant (${label})`);
    assert.ok(
      html.includes(`id="${activeDescendant[1]}"`),
      `aria-activedescendant points at a rendered id (${label})`
    );
  }
}
