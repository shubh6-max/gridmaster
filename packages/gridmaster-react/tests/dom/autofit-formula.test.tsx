// A-046 (caller): useColumnSizing must auto-fit a cross-column-formula column against the EVALUATED
// values, not `#REF!`. The core `autoFitColumn` already supports `options.columns`; this guards the
// one caller (useColumnSizing.ts:118). Language: TypeScript 6 (strict), React 19, vitest + jsdom.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolveColumns, type GridColumnDef } from "../../src/index";
import { useColumnSizing } from "../../src/react/hooks/useColumnSizing";
import { autoFitColumn } from "../../src/core/features/sizing";

type Row = { a: number; b: number; cat: string };

const rawColumns: GridColumnDef<Row>[] = [
  { key: "a", title: "A", type: "number" },
  { key: "b", title: "B", type: "number" },
  { key: "cat", title: "Cat", type: "text", minWidth: 1, maxWidth: 1000 },
];

// cat = `=A{n}&B{n}` concatenates two other columns; `#REF!`/`#ERROR!` are wider than the result.
const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({
  a: (i + 1) * 100,
  b: i + 1,
  cat: `=A${i + 1}&B${i + 1}`,
}));

describe("A-046 auto-fit evaluates cross-column formulas", () => {
  it("auto-fit of a =A&B column measures the evaluated value, not #REF!", () => {
    const columns = resolveColumns(rawColumns);
    const catColumn = columns.find((c) => c.key === "cat");
    if (!catColumn) throw new Error("cat column missing");

    // Oracles computed exactly as the hook calls the core: correct (full columns) vs broken (self).
    const correct = autoFitColumn({}, catColumn, rows, { columns }).cat;
    const broken = autoFitColumn({}, catColumn, rows, { columns: [catColumn] }).cat;
    expect(correct).not.toBe(broken); // the two paths genuinely differ

    const onColumnResize = vi.fn();
    const { result } = renderHook(() =>
      useColumnSizing<Row>({
        columns,
        rows,
        columnWidths: {},
        setColumnWidths: vi.fn(),
        onColumnResize,
      })
    );

    act(() => {
      result.current.autoFit("cat");
    });

    const calls = onColumnResize.mock.calls;
    const emitted = calls[calls.length - 1]?.[0]?.width;
    // The hook now passes the full column set, so it matches the correct oracle, not the broken one.
    expect(emitted).toBe(correct);
    expect(emitted).not.toBe(broken);
  });
});

// A-046 follow-up: the auto-fit formula axis is ALL columns (hidden included). A visible column whose
// formula references a HIDDEN column must evaluate that reference, not fit on `#REF!`.
type HiddenRow = { a: number; secret: string; cat: string };

const hiddenRawColumns: GridColumnDef<HiddenRow>[] = [
  { key: "a", title: "A", type: "number" },
  { key: "secret", title: "Secret", type: "text", hidden: true },
  // cat = `=A{n}&B{n}` where, in the FULL axis, B is the hidden "secret" column.
  { key: "cat", title: "Cat", type: "text", minWidth: 1, maxWidth: 1000 },
];

const hiddenRows: HiddenRow[] = Array.from({ length: 6 }, (_, i) => ({
  a: (i + 1) * 10,
  secret: `SECRET-${"X".repeat(i + 1)}`,
  cat: `=A${i + 1}&B${i + 1}`,
}));

describe("A-046 follow-up: auto-fit resolves a reference to a HIDDEN column", () => {
  it("passes the full (hidden-inclusive) axis so a hidden reference is not #REF!", () => {
    const allColumns = resolveColumns(hiddenRawColumns);
    const visibleColumns = allColumns.filter((c) => !c.hidden);
    const catColumn = allColumns.find((c) => c.key === "cat");
    if (!catColumn) throw new Error("cat column missing");

    const correct = autoFitColumn({}, catColumn, hiddenRows, { columns: allColumns }).cat;
    const broken = autoFitColumn({}, catColumn, hiddenRows, { columns: visibleColumns }).cat;
    expect(correct).not.toBe(broken); // hidden reference genuinely changes the fit

    const onColumnResize = vi.fn();
    const { result } = renderHook(() =>
      useColumnSizing<HiddenRow>({
        columns: visibleColumns,
        allColumns,
        rows: hiddenRows,
        columnWidths: {},
        setColumnWidths: vi.fn(),
        onColumnResize,
      })
    );

    act(() => {
      result.current.autoFit("cat");
    });

    const calls = onColumnResize.mock.calls;
    const emitted = calls[calls.length - 1]?.[0]?.width;
    expect(emitted).toBe(correct);
    expect(emitted).not.toBe(broken);
  });
});
