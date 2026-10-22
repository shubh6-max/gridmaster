// Task 2 (A-038, A-048, A-049, A-050, A-051, A-052): hook-level behaviour of the structural
// operations. Pure helpers are covered by tests/state-structure.test.mjs.
// Language: TypeScript 6 (strict), React 19, vitest + jsdom.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createCellMetaKey,
  createColumnFactory,
  useGridMaster,
  type GridCellMeta,
  type GridColumnDef,
  type GridFilters,
  type GridMasterProps,
} from "../../src/index";

type Row = { id: number; name: string; qty: number | null };
type Bare = { name: string };

const col = createColumnFactory<Row>();
const bareCol = createColumnFactory<Bare>();

const columns: GridColumnDef<Row>[] = [col.number("id"), col.text("name"), col.number("qty")];
const rows: Row[] = [
  { id: 1, name: "Asha", qty: 10 },
  { id: 2, name: "Ben", qty: 20 },
  { id: 3, name: "Cara", qty: 30 },
];

const bareColumns: GridColumnDef<Bare>[] = [bareCol.text("name")];
const bareRows: Bare[] = [{ name: "Asha" }, { name: "Ben" }, { name: "Cara" }];

const only = (...names: string[]): GridFilters => ({
  name: { type: "valueSet", values: new Set(names) },
});

function mount(extra: Partial<GridMasterProps<Row>> = {}) {
  const onRowsChange = vi.fn();
  const onColumnsChange = vi.fn();
  const hook = renderHook(() =>
    useGridMaster<Row>({ rows, columns, onRowsChange, onColumnsChange, ...extra })
  );
  return { hook, onRowsChange, onColumnsChange };
}

function mountBare(extra: Partial<GridMasterProps<Bare>> = {}) {
  return renderHook(() => useGridMaster<Bare>({ rows: bareRows, columns: bareColumns, ...extra }));
}

describe("A-051 inserted row ids", () => {
  it("generates an id for a 200k-row grid (no Math.max(...ids) stack overflow)", () => {
    const big: Row[] = Array.from({ length: 200_000 }, (_, i) => ({
      id: i + 1,
      name: "x",
      qty: 1,
    }));
    const hook = renderHook(() => useGridMaster<Row>({ rows: big, columns }));

    let inserted: Row | null = null;
    act(() => {
      inserted = hook.result.current.insertRow(0, "below");
    });

    expect((inserted as Row | null)?.id).toBe(200_001);
    expect(hook.result.current.rows).toHaveLength(200_001);
  }, 60_000);

  it("two inserted rows in a text id column get distinct, non-empty ids", () => {
    type TextRow = { id: string; name: string };
    const tc = createColumnFactory<TextRow>();
    const textColumns: GridColumnDef<TextRow>[] = [tc.text("id"), tc.text("name")];
    const textRows: TextRow[] = [
      { id: "a", name: "x" },
      { id: "b", name: "y" },
    ];
    const hook = renderHook(() => useGridMaster<TextRow>({ rows: textRows, columns: textColumns }));

    act(() => {
      hook.result.current.insertRow(0, "below");
    });
    act(() => {
      hook.result.current.insertRow(0, "below");
    });

    const ids = hook.result.current.rows.map((row) => row.id);
    expect(ids).toHaveLength(4);
    expect(ids.every((id) => id !== "")).toBe(true);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("A-052 allowedRowIds", () => {
  it("an empty allow-list shows no rows; undefined shows all", () => {
    const empty = mount({ allowedRowIds: [] });
    expect(empty.hook.result.current.displayRowIndexes).toEqual([]);

    const unrestricted = mount({});
    expect(unrestricted.hook.result.current.displayRowIndexes).toEqual([0, 1, 2]);

    const some = mount({ allowedRowIds: ["2"] });
    expect(some.hook.result.current.displayRowIndexes).toEqual([1]);
  });
});

describe("A-038 moveRow carries cell/row meta", () => {
  it("meta follows the moved row, neighbours shift, and undo restores it", () => {
    const initialCellMeta: Record<string, GridCellMeta> = {
      [createCellMetaKey(0, "name")]: { backgroundColor: "red" },
      [createCellMetaKey(2, "name")]: { backgroundColor: "blue" },
    };
    const { hook } = mount({
      enableRowDrag: true,
      initialCellMeta,
      initialRowMeta: { 0: { className: "first" } },
    });

    act(() => hook.result.current.moveRow(0, 2));

    expect(hook.result.current.rows.map((row) => row.name)).toEqual(["Ben", "Cara", "Asha"]);
    const present = hook.result.current.history.present;
    expect(present.cellMeta[createCellMetaKey(2, "name")]).toEqual({ backgroundColor: "red" });
    expect(present.cellMeta[createCellMetaKey(1, "name")]).toEqual({ backgroundColor: "blue" });
    expect(present.cellMeta[createCellMetaKey(0, "name")]).toBeUndefined();
    expect(present.rowMeta[2]).toEqual({ className: "first" });
    expect(present.rowMeta[0]).toBeUndefined();

    act(() => {
      hook.result.current.undo();
    });
    expect(hook.result.current.history.present.cellMeta[createCellMetaKey(0, "name")]).toEqual({
      backgroundColor: "red",
    });
  });
});

describe("A-050 insertRow under an active filter", () => {
  it("keeps the inserted row visible and selected, also on repeated inserts", () => {
    const { hook } = mount({ initialFilters: only("Asha") });
    expect(hook.result.current.displayRowIndexes).toEqual([0]);

    act(() => {
      hook.result.current.insertRow(0, "below");
    });
    // Source row 1 is the new (blank) row; it matches no filter but must stay visible.
    expect(hook.result.current.displayRowIndexes).toEqual([0, 1]);
    expect(hook.result.current.selection.cursor?.row).toBe(1);

    act(() => {
      hook.result.current.insertRow(1, "below");
    });
    expect(hook.result.current.displayRowIndexes).toEqual([0, 1, 2]);
    expect(hook.result.current.selection.cursor?.row).toBe(2);
  });

  it("holds for rows identified only by array index (no id field)", () => {
    const hook = mountBare({ initialFilters: only("Ben", "Cara") });
    expect(hook.result.current.displayRowIndexes).toEqual([1, 2]);

    act(() => {
      hook.result.current.insertRow(1, "above");
    });

    // New row at source index 1; Ben/Cara moved to 2/3. All three stay visible.
    expect(hook.result.current.rows.map((row) => row.name)).toEqual(["Asha", "", "Ben", "Cara"]);
    expect(hook.result.current.displayRowIndexes).toEqual([1, 2, 3]);
    expect(hook.result.current.selection.cursor?.row).toBe(0);
  });

  it("without a filter nothing is preserved and behaviour is unchanged", () => {
    const { hook } = mount();
    act(() => {
      hook.result.current.insertRow(0, "below");
    });
    expect(hook.result.current.displayRowIndexes).toEqual([0, 1, 2, 3]);
    expect(hook.result.current.selection.cursor?.row).toBe(1);
  });
});

describe("A-049 deleteColumn and the row-id field", () => {
  it("deleting the id column removes the column but keeps ids and emits no stripped rows", () => {
    const { hook, onRowsChange, onColumnsChange } = mount();

    act(() => {
      hook.result.current.deleteColumn("id");
    });

    expect(hook.result.current.rawColumns.map((column) => column.key)).toEqual(["name", "qty"]);
    expect(hook.result.current.rows.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(onRowsChange).not.toHaveBeenCalled();
    expect(onColumnsChange).toHaveBeenCalledTimes(1);
  });

  it("a getRowId-identified field is kept too", () => {
    const { hook, onRowsChange } = mount({ getRowId: (row) => `n:${row.name}` });

    act(() => {
      hook.result.current.deleteColumn("name");
    });

    expect(hook.result.current.rows.map((row) => row.name)).toEqual(["Asha", "Ben", "Cara"]);
    expect(onRowsChange).not.toHaveBeenCalled();
  });

  it("an ordinary data column is still stripped and emitted once (default unchanged)", () => {
    const { hook, onRowsChange } = mount();

    act(() => {
      hook.result.current.deleteColumn("qty");
    });

    expect(onRowsChange).toHaveBeenCalledTimes(1);
    const emitted = onRowsChange.mock.calls[0][0] as Row[];
    expect(emitted.map((row) => "qty" in row)).toEqual([false, false, false]);
    expect(emitted.map((row) => row.id)).toEqual([1, 2, 3]);
  });
});

describe("A-048 historyLimit", () => {
  const edit = (name: string) => rows.map((row, i) => (i === 0 ? { ...row, name } : row));

  it("historyLimit 0 keeps no undo history (not unlimited)", () => {
    const { hook } = mount({ historyLimit: 0 });
    act(() => hook.result.current.updateRows(edit("A1")));
    act(() => hook.result.current.updateRows(edit("A2")));

    expect(hook.result.current.history.past).toHaveLength(0);
    expect(hook.result.current.rows[0].name).toBe("A2");
    let undone = true;
    act(() => {
      undone = hook.result.current.undo();
    });
    expect(undone).toBe(false);
  });

  it("a positive limit keeps the newest snapshots", () => {
    const { hook } = mount({ historyLimit: 2 });
    for (const name of ["A1", "A2", "A3", "A4"]) {
      act(() => hook.result.current.updateRows(edit(name)));
    }
    expect(hook.result.current.history.past.map((s) => (s.rows as Row[])[0].name)).toEqual([
      "A2",
      "A3",
    ]);
  });
});
