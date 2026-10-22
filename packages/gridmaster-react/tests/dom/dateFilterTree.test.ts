// Unit tests for the year > month > day filter tree helpers. Language: TypeScript 6 (strict), vitest.
// Contract: ISO date strings group into year/month/day nodes; anything else lands in "Other values";
// month labels are fixed English names (never derived from the runtime locale).
import { describe, expect, it } from "vitest";
import {
  buildDateFilterTree,
  collectDateFilterTreeValues,
  filterDateFilterTreeBySearch,
  getDateFilterTreeCheckState,
  getInitialCollapsedDateFilterTreeKeys,
  toggleDateFilterTreeCollapsedKey,
  toggleDateFilterTreeValues,
} from "../../src/filters/dateFilterTree";

const sample = ["2024-03-15", "2024-03-02", "2024-11-30", "2023-12-31"];

describe("buildDateFilterTree", () => {
  it("returns no nodes for empty input", () => {
    expect(buildDateFilterTree([])).toEqual([]);
  });

  it("builds a single year > month > day chain for one value", () => {
    const [year] = buildDateFilterTree(["2024-03-15"]);
    expect(year.key).toBe("date:2024");
    expect(year.label).toBe("2024");
    expect([...year.values]).toEqual(["2024-03-15"]);
    expect(year.children).toHaveLength(1);
    const [month] = year.children;
    expect(month.key).toBe("date:2024:3");
    expect(month.label).toBe("March");
    const [day] = month.children;
    expect(day.key).toBe("date:2024:3:15");
    expect(day.label).toBe("15");
    expect(day.children).toEqual([]);
    expect([...day.values]).toEqual(["2024-03-15"]);
  });

  it("orders years and months newest first and days ascending", () => {
    const tree = buildDateFilterTree(sample);
    expect(tree.map((node) => node.label)).toEqual(["2024", "2023"]);
    expect(tree[0].children.map((node) => node.label)).toEqual(["November", "March"]);
    expect(tree[0].children[1].children.map((node) => node.label)).toEqual(["2", "15"]);
  });

  it("rolls leaf values up into every ancestor", () => {
    const [y2024] = buildDateFilterTree(sample);
    expect([...y2024.values].sort()).toEqual(["2024-03-02", "2024-03-15", "2024-11-30"]);
    expect([...y2024.children[1].values].sort()).toEqual(["2024-03-02", "2024-03-15"]);
  });

  it("keeps distinct raw strings that share a calendar day under one day node", () => {
    const [year] = buildDateFilterTree(["2024-03-15", "2024-03-15T10:00:00Z", "2024-03-15 08:30"]);
    const day = year.children[0].children[0];
    expect(day.values.size).toBe(3);
  });

  it("scales to many values without losing any", () => {
    const many: string[] = [];
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 28; d++) {
        many.push(`2022-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      }
    }
    const [year] = buildDateFilterTree(many);
    expect(year.children).toHaveLength(12);
    expect(year.values.size).toBe(12 * 28);
    expect(year.children[0].label).toBe("December");
  });

  it("uses fixed English month names regardless of runtime locale", () => {
    const tree = buildDateFilterTree(
      Array.from({ length: 12 }, (_, i) => `2021-${String(i + 1).padStart(2, "0")}-01`)
    );
    expect(tree[0].children.map((node) => node.label).reverse()).toEqual([
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]);
  });

  it("sends invalid or non-ISO dates to the Other values bucket", () => {
    const tree = buildDateFilterTree(["2023-02-29", "2024-13-01", "2024-00-10", "yesterday", "03/15/2024"]);
    expect(tree).toHaveLength(1);
    expect(tree[0].key).toBe("other");
    expect(tree[0].label).toBe("Other values");
    expect(tree[0].children).toHaveLength(5);
  });

  it("accepts a real leap day and rejects a non-leap one", () => {
    const tree = buildDateFilterTree(["2024-02-29", "2023-02-29"]);
    expect(tree.map((node) => node.key)).toEqual(["date:2024", "other"]);
  });

  it("keeps very early four-digit years (0000-0099) as years instead of rejecting them", () => {
    const [year] = buildDateFilterTree(["0050-06-15"]);
    expect(year.key).toBe("date:50");
    expect(year.label).toBe("50");
  });

  it("treats null, undefined and empty values as the (Blanks) entry under Other values", () => {
    const tree = buildDateFilterTree([null, undefined, "", "2024-01-05"]);
    const other = tree.find((node) => node.key === "other");
    expect(other).toBeDefined();
    expect([...(other?.values ?? [])]).toEqual([""]);
    expect(other?.children).toHaveLength(1);
    expect(other?.children[0].label).toBe("(Blanks)");
    expect(other?.children[0].key).toBe("other:blank");
  });

  it("lists Blanks first, then other values alphabetically", () => {
    const other = buildDateFilterTree(["zeta", "", "alpha"]).find((n) => n.key === "other");
    expect(other?.children.map((node) => node.label)).toEqual(["(Blanks)", "alpha", "zeta"]);
  });

  it("places the Other values bucket after all year nodes", () => {
    const tree = buildDateFilterTree(["n/a", "2020-01-01", "2021-01-01"]);
    expect(tree.map((node) => node.key)).toEqual(["date:2021", "date:2020", "other"]);
  });

  it("does not mutate or depend on the input array order", () => {
    const input = [...sample];
    const reversed = [...sample].reverse();
    const a = buildDateFilterTree(input);
    const b = buildDateFilterTree(reversed);
    expect(input).toEqual(sample);
    expect(a.map((n) => n.key)).toEqual(b.map((n) => n.key));
  });
});

describe("toggleDateFilterTreeValues", () => {
  it("selects every node value when none or only some are selected", () => {
    expect([...toggleDateFilterTreeValues(new Set(["a"]), new Set(["a", "b"]))].sort()).toEqual([
      "a",
      "b",
    ]);
    expect([...toggleDateFilterTreeValues(new Set(), new Set(["a", "b"]))].sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("deselects every node value when all are selected, leaving unrelated values", () => {
    const next = toggleDateFilterTreeValues(new Set(["a", "b", "z"]), new Set(["a", "b"]));
    expect([...next]).toEqual(["z"]);
  });

  it("is a no-op for a node with no values and never mutates its input", () => {
    const selected = new Set(["a"]);
    const next = toggleDateFilterTreeValues(selected, new Set());
    expect([...next]).toEqual(["a"]);
    expect(next).not.toBe(selected);
    toggleDateFilterTreeValues(selected, new Set(["b"]));
    expect([...selected]).toEqual(["a"]);
  });
});

describe("collapse helpers", () => {
  it("toggles a key in and out without mutating the original set", () => {
    const start = new Set(["a"]);
    const added = toggleDateFilterTreeCollapsedKey(start, "b");
    expect([...added].sort()).toEqual(["a", "b"]);
    expect([...start]).toEqual(["a"]);
    expect([...toggleDateFilterTreeCollapsedKey(added, "a")]).toEqual(["b"]);
  });

  it("collapses every node that has children and no leaves", () => {
    const keys = getInitialCollapsedDateFilterTreeKeys(buildDateFilterTree(sample));
    expect([...keys].sort()).toEqual([
      "date:2023",
      "date:2023:12",
      "date:2024",
      "date:2024:11",
      "date:2024:3",
    ]);
  });

  it("returns an empty set for an empty tree", () => {
    expect(getInitialCollapsedDateFilterTreeKeys([]).size).toBe(0);
  });
});

describe("getDateFilterTreeCheckState", () => {
  const [year] = buildDateFilterTree(["2024-03-15", "2024-03-02"]);

  it("reports unchecked, mixed and checked", () => {
    expect(getDateFilterTreeCheckState(year, new Set())).toBe("unchecked");
    expect(getDateFilterTreeCheckState(year, new Set(["2024-03-15"]))).toBe("mixed");
    expect(getDateFilterTreeCheckState(year, new Set(["2024-03-15", "2024-03-02"]))).toBe(
      "checked"
    );
  });

  it("never reports checked for a node without values", () => {
    expect(
      getDateFilterTreeCheckState({ key: "x", label: "x", values: new Set(), children: [] }, new Set())
    ).toBe("unchecked");
  });
});

describe("filterDateFilterTreeBySearch", () => {
  const tree = buildDateFilterTree(sample);

  it("returns the same nodes for an empty query", () => {
    expect(filterDateFilterTreeBySearch(tree, "")).toBe(tree);
  });

  it("keeps a whole matching node with all its children", () => {
    const result = filterDateFilterTreeBySearch(tree, "2023");
    expect(result.map((n) => n.key)).toEqual(["date:2023"]);
    expect(result[0].children).toHaveLength(1);
  });

  it("prunes to matching descendants and recomputes the ancestor values to what is shown", () => {
    const result = filterDateFilterTreeBySearch(tree, "march");
    expect(result.map((n) => n.key)).toEqual(["date:2024"]);
    expect(result[0].children.map((n) => n.label)).toEqual(["March"]);
    expect([...result[0].values].sort()).toEqual(["2024-03-02", "2024-03-15"]);
  });

  it("matches case-insensitively when the caller passes a lower-cased query", () => {
    expect(filterDateFilterTreeBySearch(tree, "november")).toHaveLength(1);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterDateFilterTreeBySearch(tree, "zzz")).toEqual([]);
  });
});

describe("collectDateFilterTreeValues", () => {
  it("returns the leaf values of whatever is shown", () => {
    const tree = buildDateFilterTree(sample);
    expect(collectDateFilterTreeValues(tree).size).toBe(4);
    const shown = filterDateFilterTreeBySearch(tree, "march");
    expect([...collectDateFilterTreeValues(shown)].sort()).toEqual(["2024-03-02", "2024-03-15"]);
  });

  it("returns an empty set for no nodes", () => {
    expect(collectDateFilterTreeValues([]).size).toBe(0);
  });
});
