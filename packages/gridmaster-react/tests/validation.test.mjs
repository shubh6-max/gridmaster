// Task 6B — A-061: inline column validation. Pure, advisory, render-time.
// Node suite against the built ../dist/index.cjs (public exports only).
// `validateColumnValue(value,row,column)` reads `column.validations` (the array wired into GridCell);
// `validateCellValue(value,row,key,map)` is the record-keyed variant. Both share one rule engine.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { validateColumnValue, validateCellValue } = require("../dist/index.cjs");

const col = (rules) => ({ key: "c", type: "text", validations: rules });

function testRequired() {
  const c = col([{ type: "required" }]);
  assert.equal(validateColumnValue("", {}, c), "Required", "blank fails required");
  assert.equal(validateColumnValue("   ", {}, c), "Required", "whitespace fails required");
  assert.equal(validateColumnValue("x", {}, c), null, "non-blank passes required");
  assert.equal(validateColumnValue(0, {}, c), null, "0 is present, passes required");
  assert.equal(
    validateColumnValue("", {}, col([{ type: "required", message: "Need it" }])),
    "Need it",
    "custom required message honoured"
  );
}

function testMinMax() {
  const c = col([
    { type: "min", value: 10 },
    { type: "max", value: 20 },
  ]);
  assert.equal(validateColumnValue(15, {}, c), null, "within range passes");
  assert.equal(validateColumnValue(10, {}, c), null, "min boundary inclusive");
  assert.equal(validateColumnValue(20, {}, c), null, "max boundary inclusive");
  assert.equal(validateColumnValue(5, {}, c), "Minimum is 10", "below min fails");
  assert.equal(validateColumnValue(25, {}, c), "Maximum is 20", "above max fails");
  // Blank must NOT trip min/max — only `required` flags empties.
  assert.equal(validateColumnValue("", {}, c), null, "blank skips min/max");
  assert.equal(validateColumnValue(null, {}, c), null, "null skips min/max");
}

function testLengths() {
  const c = col([
    { type: "minLength", value: 2 },
    { type: "maxLength", value: 4 },
  ]);
  assert.equal(validateColumnValue("abc", {}, c), null, "length in range passes");
  assert.equal(validateColumnValue("a", {}, c), "Min length is 2", "too short fails");
  assert.equal(validateColumnValue("abcde", {}, c), "Max length is 4", "too long fails");
  assert.equal(validateColumnValue("", {}, c), null, "blank skips length rules");
}

function testPattern() {
  const c = col([{ type: "pattern", value: "^[A-Z]+$" }]);
  assert.equal(validateColumnValue("ABC", {}, c), null, "matching pattern passes");
  assert.equal(validateColumnValue("abc", {}, c), "Invalid format", "non-matching fails");
  // An invalid regex must NOT throw at render time.
  const bad = col([{ type: "pattern", value: "([unclosed" }]);
  assert.doesNotThrow(() => validateColumnValue("anything", {}, bad), "bad regex never throws");
  assert.equal(validateColumnValue("anything", {}, bad), null, "bad regex is skipped, not an error");
}

function testListLikeWithNumbers() {
  // No dedicated "list" rule type in the union; a list constraint is a `custom` rule. Verify a
  // numeric membership check works whether the value is a number or its string form.
  const allowed = new Set(["1", "2", "3"]);
  const c = col([
    {
      type: "custom",
      validator: (value) => (allowed.has(String(value)) ? null : "Not allowed"),
    },
  ]);
  assert.equal(validateColumnValue(2, {}, c), null, "number member passes");
  assert.equal(validateColumnValue("2", {}, c), null, "string member passes");
  assert.equal(validateColumnValue(9, {}, c), "Not allowed", "non-member fails");
}

function testCustomThrows() {
  const c = col([
    {
      type: "custom",
      validator: () => {
        throw new Error("boom");
      },
    },
  ]);
  let result;
  assert.doesNotThrow(() => {
    result = validateColumnValue("x", {}, c);
  }, "throwing custom validator never crashes the caller");
  assert.equal(result, "boom", "thrown message surfaces as the validation error");
}

function testNoRules() {
  assert.equal(validateColumnValue("x", {}, { key: "c" }), null, "no validations => null");
  assert.equal(validateColumnValue("x", {}, col([])), null, "empty rules => null");
}

function testRecordKeyedVariant() {
  const validations = { c: { rules: [{ type: "required" }, { type: "min", value: 5 }] } };
  assert.equal(validateCellValue("", {}, "c", validations), "Required", "record: required fails");
  assert.equal(validateCellValue(3, {}, "c", validations), "Minimum is 5", "record: min fails");
  assert.equal(validateCellValue(7, {}, "c", validations), null, "record: passing value");
  assert.equal(validateCellValue(1, {}, "other", validations), null, "record: unknown column => null");
}

export function runValidationTests() {
  testRequired();
  testMinMax();
  testLengths();
  testPattern();
  testListLikeWithNumbers();
  testCustomThrows();
  testNoRules();
  testRecordKeyedVariant();
}
