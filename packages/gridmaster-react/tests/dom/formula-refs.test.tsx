// Task 5 (A-007): formula references are rewritten at the shared write points and all inside one
// history push, so a single undo restores values and formulas together; and a controlled host hears
// the rewritten rows exactly once. Also: click-to-insert yields the SOURCE address under an active
// sort (addresses are source-row based; the row-number header stays display-based — see report).
// Language: TypeScript 6 (strict), React 19, vitest + jsdom.
import { act, fireEvent, render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  GridMaster,
  createColumnFactory,
  useGridMaster,
  type GridColumnDef,
  type GridMasterProps,
} from "../../src/index";

type Row = { a: number; b: number; f: string };

const col = createColumnFactory<Row>();
// Column order fixes the A1 axis: A = "a", B = "b", C = "f".
const columns: GridColumnDef<Row>[] = [col.number("a"), col.number("b"), col.text("f")];

function mount(initialRows: Row[], extra: Partial<GridMasterProps<Row>> = {}) {
  const onRowsChange = vi.fn();
  const hook = renderHook(() =>
    useGridMaster<Row>({ rows: initialRows, columns, onRowsChange, ...extra })
  );
  return { hook, onRowsChange };
}

describe("A-007 insertRow shifts references (one push, one undo)", () => {
  it("fill/insert row rewrites referencing formulas and a single undo restores them", () => {
    const { hook, onRowsChange } = mount([
      { a: 1, b: 2, f: "=A1+B1" },
      { a: 3, b: 4, f: "" },
    ]);

    act(() => {
      hook.result.current.insertRow(0, "above");
    });

    // Original row 0 moved to index 1 and its refs shifted down by one.
    expect(hook.result.current.rows[1].f).toBe("=A2+B2");
    expect(hook.result.current.rows[0].f).toBe("");
    // Emitted exactly once, with the rewritten formula in the payload.
    expect(onRowsChange).toHaveBeenCalledTimes(1);
    expect((onRowsChange.mock.calls[0][0] as Row[])[1].f).toBe("=A2+B2");

    act(() => {
      hook.result.current.undo();
    });
    expect(hook.result.current.rows[0].f).toBe("=A1+B1");
  });
});

describe("A-007 deleteRow: #REF! for the deleted row, shift for the rest", () => {
  it("rewrites both cases in one push", () => {
    const { hook } = mount([
      { a: 5, b: 0, f: "" },
      { a: 9, b: 0, f: "=A1" }, // references the row being deleted
      { a: 7, b: 0, f: "=A2" }, // references a surviving row -> shifts up
    ]);

    act(() => {
      hook.result.current.deleteRow(0);
    });

    expect(hook.result.current.rows[0].f).toBe("=#REF!");
    expect(hook.result.current.rows[1].f).toBe("=A1");
  });
});

describe("A-007 moveRow retargets references", () => {
  it("a moved formula's own references follow the move", () => {
    const { hook } = mount(
      [
        { a: 1, b: 0, f: "=A1" },
        { a: 2, b: 0, f: "" },
        { a: 3, b: 0, f: "" },
      ],
      { enableRowDrag: true }
    );

    act(() => {
      hook.result.current.moveRow(0, 2);
    });

    expect(hook.result.current.rows.map((row) => row.a)).toEqual([2, 3, 1]);
    expect(hook.result.current.rows[2].f).toBe("=A3");
  });
});

describe("A-007 insert/delete column shift references", () => {
  it("insertColumn shifts columns right; deleteColumn yields #REF!/shift", () => {
    const insert = mount([{ a: 1, b: 2, f: "=A1+B1" }]);
    act(() => {
      insert.hook.result.current.insertColumn("a", "left");
    });
    // A new column before A pushes A->B, B->C.
    expect(insert.hook.result.current.rows[0].f).toBe("=B1+C1");

    const del = mount([{ a: 1, b: 2, f: "=A1+B1" }]);
    act(() => {
      del.hook.result.current.deleteColumn("a");
    });
    // Column A deleted: =A1 -> #REF!, B1 shifts left to A1.
    expect(del.hook.result.current.rows[0].f).toBe("=#REF!+A1");
  });
});

describe("A-007 click-to-insert address when the display order differs from source", () => {
  // Decision: addresses are SOURCE-row based (stable, what the evaluator resolves). The row-number
  // header stays display-based, so under an active sort/filter the two can disagree — this test
  // pins the chosen convention. A filter is used to make display != source (there is no initial-sort
  // prop in this harness); sorting routes through the SAME `displayRowIndexes` mapping.
  it("inserts the SOURCE address, not the display row number", () => {
    type FRow = { n: number; label: string; f: string };
    const fc = createColumnFactory<FRow>();
    const fCols: GridColumnDef<FRow>[] = [fc.number("n"), fc.text("label"), fc.text("f")];
    const fRows: FRow[] = [
      { n: 10, label: "hide", f: "" },
      { n: 20, label: "keep", f: "" },
      { n: 30, label: "keep", f: "" },
    ];

    const { container } = render(
      <GridMaster
        rows={fRows}
        columns={fCols}
        showFormulaBar
        initialFilters={{ label: { type: "valueSet", values: new Set(["keep"]) } }}
        onRowsChange={() => {}}
      />
    );

    // Source row 0 is hidden -> display row 0 = source row 1, display row 1 = source row 2.
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);

    // Start a formula edit in the "f" cell of display row 1.
    const fCell = rows[1].querySelectorAll<HTMLElement>("td.gm-td")[2];
    act(() => {
      fireEvent.pointerDown(fCell, { button: 0 });
      fireEvent.pointerUp(window);
    });
    const textarea = container.querySelector<HTMLTextAreaElement>(".gm-formula-bar textarea");
    expect(textarea).not.toBeNull();
    act(() => {
      fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: "=" } });
    });

    // Click the "n" cell of display row 0 (source row 1) while editing.
    const nCellDisplay0 = rows[0].querySelectorAll<HTMLElement>("td.gm-td")[0];
    act(() => {
      fireEvent.pointerDown(nCellDisplay0, { button: 0 });
    });

    // Source address A2 (source row index 1 -> row 2), NOT the display number (header shows "1").
    expect((textarea as HTMLTextAreaElement).value).toBe("=A2");
  });
});
