// Task 7B — fill under an active sort / filter / hidden column (carried from Task 5 review). The
// fill reads and writes DISPLAY-ordered rows, so value SERIES follow the display (what the user
// sees), but a filled FORMULA's relative references must shift by the SOURCE-row and ABSOLUTE-column
// delta (the axes the evaluator uses), mirroring the paste path. Language: TS 6 strict, vitest.
import { describe, expect, it } from "vitest";
import {
  applyFillFromSelection,
  createColumnFactory,
  createFillState,
  fillRangeWithSource,
  resolveColumns,
} from "../../src/index";

type Row = { a: number | string; b: number | string; c: number | string; d: number | string };
type Bounds = { startRow: number; endRow: number; startCol: number; endCol: number };
const col = createColumnFactory<Row>();
const cols = (keys: Array<keyof Row>) => resolveColumns(keys.map((k) => col.number(k as string)));

const cell = (row: number, colIndex: number): Bounds => ({
  startRow: row,
  endRow: row,
  startCol: colIndex,
  endCol: colIndex,
});

describe("formula references shift in SOURCE-row space under a sort", () => {
  it("sorted desc: fill =A3 down two display rows → =A2, =A1 (each references its own source row)", () => {
    const columns = cols(["a", "b", "c", "d"]);
    // displayRowIndexes [2,1,0]: display is sorted descending over 3 source rows.
    const displayRowIndexes = [2, 1, 0];
    const source: Row[] = [
      { a: 1, b: 2, c: "", d: 0 }, // source 0
      { a: 3, b: 4, c: "", d: 0 }, // source 1
      { a: 5, b: 6, c: "=A3", d: 0 }, // source 2 (a self-row formula)
    ];
    const displayRows = displayRowIndexes.map((i) => source[i]); // [s2, s1, s0]

    const result = fillRangeWithSource(
      displayRows,
      columns,
      cell(0, 2), // source cell = display row 0 (= source row 2), column c
      { startRow: 0, endRow: 2, startCol: 2, endCol: 2 },
      { mapRow: (d) => displayRowIndexes[d] ?? d }
    );

    // display row 1 = source 1: delta = 1 − 2 = −1 → =A2. display row 2 = source 0: −2 → =A1.
    expect(result.rows[1].c).toBe("=A2");
    expect(result.rows[2].c).toBe("=A1");
    // Buggy display-delta would have produced =A4 / =A5.
  });

  it("filtered: the source-row gap of a hidden row is honoured", () => {
    const columns = cols(["a", "b", "c", "d"]);
    const displayRowIndexes = [0, 2]; // source row 1 is filtered out
    const source: Row[] = [
      { a: 1, b: 2, c: "=A1", d: 0 }, // source 0 (copy source, display 0)
      { a: 3, b: 4, c: "", d: 0 }, // source 1 (filtered)
      { a: 5, b: 6, c: "", d: 0 }, // source 2 (display 1)
    ];
    const displayRows = displayRowIndexes.map((i) => source[i]);

    const result = fillRangeWithSource(
      displayRows,
      columns,
      cell(0, 2),
      { startRow: 0, endRow: 1, startCol: 2, endCol: 2 },
      { mapRow: (d) => displayRowIndexes[d] ?? d }
    );

    // display row 1 = source 2: delta = 2 − 0 = +2 → =A3 (not +1 → =A2).
    expect(result.rows[1].c).toBe("=A3");
  });

  it("hidden column: column refs shift on the ALL-columns axis", () => {
    // visible [a,b,d] with absolute indexes [0,1,3] (column c at absolute 2 is hidden).
    const columns = cols(["a", "b", "d"]);
    const absolute = [0, 1, 3];
    const source: Row[] = [{ a: "=A1", b: 0, c: 0, d: 0 }];
    const result = fillRangeWithSource(
      source,
      columns,
      cell(0, 0), // source: visible col 0 (a)
      { startRow: 0, endRow: 0, startCol: 0, endCol: 2 }, // fill across a → d
      { mapCol: (v) => absolute[v] ?? v }
    );
    // visible col 2 (d, absolute 3): colDelta = 3 − 0 = +3 → col A(0) → col D(3) = =D1.
    expect(result.rows[0].d).toBe("=D1");
  });
});

describe("value series follow the DISPLAY order, not the source order", () => {
  it("filling 1,2 down continues 3,4 in display order even under a desc sort", () => {
    const columns = cols(["a", "b", "c", "d"]);
    const displayRowIndexes = [3, 2, 1, 0];
    // Display shows a=1,2 at the top; the series must read 3,4 next in DISPLAY order.
    const displayRows: Row[] = [
      { a: 1, b: 0, c: 0, d: 0 },
      { a: 2, b: 0, c: 0, d: 0 },
      { a: 0, b: 0, c: 0, d: 0 },
      { a: 0, b: 0, c: 0, d: 0 },
    ];
    const result = applyFillFromSelection(
      displayRows,
      columns,
      { startRow: 0, endRow: 1, startCol: 0, endCol: 0 },
      createFillState({ row: 0, col: 0 }, { row: 3, col: 0 }),
      { mapRow: (d) => displayRowIndexes[d] ?? d }
    );
    expect(result.rows.map((r) => r.a)).toEqual([1, 2, 3, 4]);
  });
});
