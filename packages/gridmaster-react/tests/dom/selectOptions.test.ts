// Unit tests for the select-editor option helper. Language: TypeScript 6 (strict), vitest.
// Contract: a stored value that is not in the options list is appended so it stays visible/selectable.
import { describe, expect, it } from "vitest";
import { getSelectOptionsWithCurrentValue } from "../../src/editors/selectOptions";

describe("getSelectOptionsWithCurrentValue", () => {
  const options = ["Open", "Closed"];

  it("returns the options unchanged when the current value is present", () => {
    expect(getSelectOptionsWithCurrentValue(options, "Open")).toEqual(["Open", "Closed"]);
  });

  it("appends a current value that is absent from the options", () => {
    expect(getSelectOptionsWithCurrentValue(options, "Archived")).toEqual([
      "Open",
      "Closed",
      "Archived",
    ]);
  });

  it("does not mutate the options array it was given", () => {
    const input = ["A"];
    getSelectOptionsWithCurrentValue(input, "B");
    expect(input).toEqual(["A"]);
  });

  it("does not add an entry for an empty, null or undefined current value", () => {
    expect(getSelectOptionsWithCurrentValue(options, "")).toEqual(options);
    expect(getSelectOptionsWithCurrentValue(options, null)).toEqual(options);
    expect(getSelectOptionsWithCurrentValue(options, undefined)).toEqual(options);
  });

  it("matches numeric and string forms of the same value (no duplicate)", () => {
    expect(getSelectOptionsWithCurrentValue(["1", "2"], 1)).toEqual(["1", "2"]);
    expect(getSelectOptionsWithCurrentValue([1, 2], "2")).toEqual([1, 2]);
  });

  it("appends an absent numeric current value as its string form", () => {
    expect(getSelectOptionsWithCurrentValue(["1", "2"], 3)).toEqual(["1", "2", "3"]);
  });

  it("tolerates missing options (undefined / null) without throwing", () => {
    expect(getSelectOptionsWithCurrentValue(undefined, "X")).toEqual(["X"]);
    expect(getSelectOptionsWithCurrentValue(null, "X")).toEqual(["X"]);
    expect(getSelectOptionsWithCurrentValue(undefined, "")).toEqual([]);
  });
});
