import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { evaluateCondition, getMatchingConditionalFormat } = require("../dist/index.cjs");

export function runConditionalFormattingTests() {
  /* --- A-016: numeric comparisons, no blanks-as-0 ------------------------- */
  assert.equal(evaluateCondition(10, { type: "cellValue", operator: ">", value: 5 }), true);
  assert.equal(evaluateCondition(2, { type: "cellValue", operator: ">", value: 5 }), false);
  // Blank must NOT coerce to 0 (so it is not "> -1").
  for (const blank of [null, undefined, "", "  "]) {
    assert.equal(
      evaluateCondition(blank, { type: "cellValue", operator: ">", value: -1 }),
      false,
      `blank ${JSON.stringify(blank)} coerced to a number`
    );
  }
  // 0 is a real number, not blank.
  assert.equal(evaluateCondition(0, { type: "cellValue", operator: ">=", value: 0 }), true);

  /* --- String comparisons: >/< compare as text --------------------------- */
  assert.equal(evaluateCondition("banana", { type: "cellValue", operator: ">", value: "apple" }), true);
  assert.equal(evaluateCondition("apple", { type: "cellValue", operator: "<", value: "banana" }), true);
  assert.equal(evaluateCondition("apple", { type: "cellValue", operator: "=", value: "APPLE" }), true);

  /* --- between: inclusive and order-insensitive -------------------------- */
  assert.equal(evaluateCondition(5, { type: "between", low: 5, high: 10 }), true, "inclusive low");
  assert.equal(evaluateCondition(10, { type: "between", low: 5, high: 10 }), true, "inclusive high");
  assert.equal(evaluateCondition(7, { type: "between", low: 10, high: 5 }), true, "order-insensitive");
  assert.equal(evaluateCondition(4, { type: "between", low: 5, high: 10 }), false);
  assert.equal(evaluateCondition("", { type: "between", low: 5, high: 10 }), false, "blank excluded");

  /* --- textContains ------------------------------------------------------ */
  assert.equal(evaluateCondition("Hello World", { type: "textContains", value: "world" }), true);
  assert.equal(evaluateCondition("Hello", { type: "textContains", value: "zzz" }), false);

  /* --- timePeriod with an injectable clock ------------------------------- */
  const now = () => new Date(2026, 5, 15, 12, 0, 0); // 2026-06-15
  const tp = (value, period) => evaluateCondition(value, { type: "timePeriod", value: period }, now);
  assert.equal(tp(new Date(2026, 5, 15), "today"), true);
  assert.equal(tp(new Date(2026, 5, 14), "today"), false);
  assert.equal(tp(new Date(2026, 5, 14), "yesterday"), true);
  assert.equal(tp(new Date(2026, 5, 1), "thisMonth"), true);
  assert.equal(tp(new Date(2026, 4, 30), "thisMonth"), false);
  assert.equal(tp("not a date", "today"), false);

  /* --- getMatchingConditionalFormat uses the evaluated value & clock ------ */
  const formats = {
    score: [
      { condition: { type: "cellValue", operator: ">", value: 90 }, backgroundColor: "#0f0" },
      { condition: { type: "between", low: 50, high: 90 }, backgroundColor: "#ff0" },
    ],
  };
  // Raw row value is a formula string; the evaluated value (95) is what should match.
  const match = getMatchingConditionalFormat({ score: "=90+5" }, "score", formats, { value: 95 });
  assert.equal(match?.backgroundColor, "#0f0");
  // First-match-wins is documented: 70 hits the between rule.
  const match2 = getMatchingConditionalFormat({ score: 70 }, "score", formats, { value: 70 });
  assert.equal(match2?.backgroundColor, "#ff0");
  // No rule -> null.
  assert.equal(getMatchingConditionalFormat({ score: 10 }, "score", formats, { value: 10 }), null);

  // timePeriod rule respects the injected clock.
  const dateFormats = {
    due: [{ condition: { type: "timePeriod", value: "today" }, backgroundColor: "#f00" }],
  };
  const todayCell = new Date(2026, 5, 15);
  assert.equal(
    getMatchingConditionalFormat({ due: todayCell }, "due", dateFormats, { value: todayCell, now })
      ?.backgroundColor,
    "#f00"
  );
}
