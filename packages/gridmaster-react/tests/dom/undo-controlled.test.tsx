// A-012 / F-009: undo/redo must notify a controlled host (onRowsChange / onColumnsChange) exactly
// once, the echo of that emit must not reset history or cell meta, and a genuinely different
// dataset from the parent keeps its documented reset behaviour.
// Note: the toolbar has no undo/redo buttons; the imperative `undo()`/`redo()` on the hook result
// (and context) is the programmatic path, covered here through `useGridMaster` directly.
// Language: TypeScript 6 (strict), React 19, vitest + jsdom.
import { StrictMode, useState, type ReactElement } from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  GridMaster,
  createCellMetaKey,
  useGridMaster,
  type GridCellMeta,
  type GridColumnDef,
  type GridMasterProps,
} from "../../src/index";
import {
  BOLD_BUTTON,
  bodyTexts,
  cellOf,
  clickCell,
  columns as baseColumns,
  rows as baseRows,
  shellOf,
  type Row,
  type User,
} from "./propsWiredHarness";

const NAMES = ["Asha", "Ben", "Cara"];
const names = (rows: Row[]) => rows.map((row) => row.name);
const UNDO = "{Control>}z{/Control}";
const REDO = "{Control>}y{/Control}";
const REDO_SHIFT = "{Control>}{Shift>}z{/Shift}{/Control}";

type Probe = {
  rows: Row[];
  columns: GridColumnDef<Row>[];
  replaceRows: (next: Row[]) => void;
};

type Spies = { onRowsChange: Mock; onColumnsChange: Mock };

/** The controlled-host contract: store whatever the grid emits, pass it straight back. */
function ControlledHost({
  probe,
  spies,
  extra,
}: {
  probe: Probe;
  spies: Spies;
  extra?: Partial<GridMasterProps<Row>>;
}) {
  const [rows, setRows] = useState<Row[]>(baseRows);
  const [columns, setColumns] = useState<GridColumnDef<Row>[]>(baseColumns);
  probe.rows = rows;
  probe.columns = columns;
  probe.replaceRows = setRows;
  return (
    <GridMaster<Row>
      rows={rows}
      columns={columns}
      onRowsChange={(next) => {
        spies.onRowsChange(next);
        setRows([...next]); // emitted arrays are readonly (A-029)
      }}
      onColumnsChange={(next) => {
        spies.onColumnsChange(next);
        setColumns([...next]);
      }}
      {...extra}
    />
  );
}

function mount(strict = false, extra?: Partial<GridMasterProps<Row>>) {
  const probe: Probe = { rows: baseRows, columns: baseColumns, replaceRows: () => {} };
  const spies: Spies = { onRowsChange: vi.fn(), onColumnsChange: vi.fn() };
  const user = userEvent.setup();
  const ui: ReactElement = <ControlledHost probe={probe} spies={spies} extra={extra} />;
  const utils = render(strict ? <StrictMode>{ui}</StrictMode> : ui);
  return { probe, spies, user, ...utils };
}

async function edit(user: User, from: string, to: string) {
  await user.dblClick(shellOf(from));
  await user.keyboard(`{Control>}a{/Control}${to}{Enter}`);
}

/** Text of the first column of the rendered grid, i.e. what the user actually sees. */
function displayedNames(): string[] {
  return NAMES.concat(["Zed", "Bob"]).filter((n) =>
    Array.from(document.querySelectorAll("td.gm-td")).some((td) => td.textContent === n)
  );
}

describe.each([
  ["plain", false],
  ["React.StrictMode", true],
])("A-012 keyboard undo/redo notifies a controlled host (%s)", (_label, strict) => {
  it("Ctrl+Z emits onRowsChange once with the reverted rows; host equals the grid; Ctrl+Y re-emits once", async () => {
    const { probe, spies, user, container } = mount(strict);

    await edit(user, "Asha", "Zed");
    expect(names(probe.rows)).toEqual(["Zed", "Ben", "Cara"]);
    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
    spies.onRowsChange.mockClear();

    await clickCell(user, "Zed");
    await user.keyboard(UNDO);

    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
    expect(names(spies.onRowsChange.mock.calls[0][0] as Row[])).toEqual(NAMES);
    expect(names(probe.rows)).toEqual(NAMES);
    expect(bodyTexts(container)).toContain("Asha");
    expect(bodyTexts(container)).not.toContain("Zed");
    spies.onRowsChange.mockClear();

    await user.keyboard(REDO);

    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
    expect(names(spies.onRowsChange.mock.calls[0][0] as Row[])).toEqual(["Zed", "Ben", "Cara"]);
    expect(names(probe.rows)).toEqual(["Zed", "Ben", "Cara"]);
    expect(bodyTexts(container)).toContain("Zed");
  });

  it("Ctrl+Shift+Z is redo and also emits exactly once", async () => {
    const { probe, spies, user } = mount(strict);
    await edit(user, "Asha", "Zed");
    await clickCell(user, "Zed");
    await user.keyboard(UNDO);
    spies.onRowsChange.mockClear();

    await user.keyboard(REDO_SHIFT);

    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
    expect(names(probe.rows)).toEqual(["Zed", "Ben", "Cara"]);
  });

  it("history survives the echo: undo twice works, a new edit after undo emits from the undone state", async () => {
    const { probe, spies, user } = mount(strict);

    await edit(user, "Asha", "Zed");
    await edit(user, "Ben", "Bob");
    expect(names(probe.rows)).toEqual(["Zed", "Bob", "Cara"]);

    await clickCell(user, "Bob");
    await user.keyboard(UNDO);
    expect(names(probe.rows)).toEqual(["Zed", "Ben", "Cara"]);
    await user.keyboard(UNDO);
    expect(names(probe.rows)).toEqual(NAMES);
    expect(displayedNames()).toEqual(NAMES);

    // Nothing left to undo: no further emit.
    spies.onRowsChange.mockClear();
    await user.keyboard(UNDO);
    expect(spies.onRowsChange).not.toHaveBeenCalled();

    // Redo twice walks forward through the same preserved history.
    await user.keyboard(REDO);
    await user.keyboard(REDO);
    expect(names(probe.rows)).toEqual(["Zed", "Bob", "Cara"]);

    // Undo once, then a NEW edit: it emits from the undone state (Zed stays, Bob is gone).
    await user.keyboard(UNDO);
    spies.onRowsChange.mockClear();
    await edit(user, "Cara", "Cy");
    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
    expect(names(spies.onRowsChange.mock.calls[0][0] as Row[])).toEqual(["Zed", "Ben", "Cy"]);
    expect(names(probe.rows)).toEqual(["Zed", "Ben", "Cy"]);

    // A new edit cleared redo, but undo still walks back through preserved history.
    await user.keyboard(UNDO);
    expect(names(probe.rows)).toEqual(["Zed", "Ben", "Cara"]);
    await user.keyboard(UNDO);
    expect(names(probe.rows)).toEqual(NAMES);
  });

  it("emits no onColumnsChange when only rows changed", async () => {
    const { spies, user } = mount(strict);
    await edit(user, "Asha", "Zed");
    await clickCell(user, "Zed");
    await user.keyboard(UNDO);
    expect(spies.onColumnsChange).not.toHaveBeenCalled();
  });
});

describe("A-012 column structure undo/redo through the context menu", () => {
  it("Insert Column Right then Ctrl+Z emits onColumnsChange (and rows) once with the reverted shape", async () => {
    const { probe, spies, user } = mount();
    expect(probe.columns).toHaveLength(3);

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByText("name", { selector: "th *", exact: false }),
    });
    await user.click(screen.getByText("Insert Column Right"));
    expect(probe.columns).toHaveLength(4);
    spies.onRowsChange.mockClear();
    spies.onColumnsChange.mockClear();

    await clickCell(user, "Asha");
    await user.keyboard(UNDO);

    expect(spies.onColumnsChange).toHaveBeenCalledTimes(1);
    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
    expect((spies.onColumnsChange.mock.calls[0][0] as GridColumnDef<Row>[]).map((c) => c.key)).toEqual(
      baseColumns.map((c) => c.key)
    );
    expect(probe.columns.map((c) => c.key)).toEqual(baseColumns.map((c) => c.key));
    expect(document.querySelectorAll("thead th.gm-th:not(.gm-th-spreadsheet)")).toHaveLength(3);
  });
});

/** Hook-level host: the programmatic undo()/redo() path (what a toolbar button or GridApi calls). */
function useHost(
  spies: Spies & { onCellChange?: Mock },
  extra: Partial<GridMasterProps<Row>> = {}
) {
  const [rows, setRows] = useState<Row[]>(baseRows);
  const [columns, setColumns] = useState<GridColumnDef<Row>[]>(baseColumns);
  const grid = useGridMaster<Row>({
    rows,
    columns,
    enableColumnDrag: true,
    onRowsChange: (next) => {
      spies.onRowsChange(next);
      setRows([...next]); // emitted arrays are readonly (A-029)
    },
    onColumnsChange: (next) => {
      spies.onColumnsChange(next);
      setColumns([...next]);
    },
    onCellChange: spies.onCellChange,
    ...extra,
  });
  return { grid, rows, columns };
}

function mountHook(strict = false, extra: Partial<GridMasterProps<Row>> = {}) {
  const spies: Spies & { onCellChange: Mock } = {
    onRowsChange: vi.fn(),
    onColumnsChange: vi.fn(),
    onCellChange: vi.fn(),
  };
  const hook = renderHook(() => useHost(spies, extra), strict ? { wrapper: StrictMode } : undefined);
  const edited = (name: string): Row[] =>
    baseRows.map((row, i) => (i === 0 ? { ...row, name } : row));
  return { hook, spies, edited };
}

describe.each([
  ["plain", false],
  ["React.StrictMode", true],
])("A-012 imperative undo()/redo() (toolbar / API path) (%s)", (_label, strict) => {
  it("undo()/redo() emit onRowsChange exactly once each; host equals the grid", () => {
    const { hook, spies, edited } = mountHook(strict);

    act(() => hook.result.current.grid.updateRows(edited("Zed")));
    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
    spies.onRowsChange.mockClear();

    let ok = false;
    act(() => {
      ok = hook.result.current.grid.undo();
    });
    expect(ok).toBe(true);
    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
    expect(names(spies.onRowsChange.mock.calls[0][0] as Row[])).toEqual(NAMES);
    expect(names(hook.result.current.rows)).toEqual(NAMES);
    expect(hook.result.current.grid.rows).toEqual(hook.result.current.rows);
    spies.onRowsChange.mockClear();

    act(() => {
      ok = hook.result.current.grid.redo();
    });
    expect(ok).toBe(true);
    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
    expect(names(hook.result.current.rows)).toEqual(["Zed", "Ben", "Cara"]);
    expect(hook.result.current.grid.rows).toEqual(hook.result.current.rows);
  });

  it("the echo does not reset history: a second undo/redo cycle still works", () => {
    const { hook, spies } = mountHook(strict);
    const g = () => hook.result.current.grid;

    act(() => g().updateRows(baseRows.map((r, i) => (i === 0 ? { ...r, name: "Zed" } : r))));
    act(() =>
      g().updateRows(
        hook.result.current.rows.map((r, i) => (i === 1 ? { ...r, name: "Bob" } : r))
      )
    );
    act(() => void g().undo());
    act(() => void g().undo());
    expect(names(hook.result.current.rows)).toEqual(NAMES);
    expect(g().history.future).toHaveLength(2);

    act(() => void g().redo());
    act(() => void g().redo());
    expect(names(hook.result.current.rows)).toEqual(["Zed", "Bob", "Cara"]);
    expect(g().history.past).toHaveLength(2);
    expect(spies.onRowsChange).toHaveBeenCalledTimes(6);
  });

  it("two undo() calls in one act step back twice and emit once each", () => {
    const { hook, spies } = mountHook(strict);
    const g = () => hook.result.current.grid;
    act(() => g().updateRows(baseRows.map((r, i) => (i === 0 ? { ...r, name: "Zed" } : r))));
    act(() =>
      g().updateRows(hook.result.current.rows.map((r, i) => (i === 1 ? { ...r, name: "Bob" } : r)))
    );
    spies.onRowsChange.mockClear();

    act(() => {
      g().undo();
      g().undo();
    });

    expect(spies.onRowsChange).toHaveBeenCalledTimes(2);
    expect(names(hook.result.current.rows)).toEqual(NAMES);
  });

  it("insert / delete / reorder a column, then undo(): onColumnsChange fires once with the reverted columns", () => {
    const { hook, spies } = mountHook(strict);
    const g = () => hook.result.current.grid;
    const keys = () => hook.result.current.columns.map((c) => c.key);
    const original = baseColumns.map((c) => c.key);

    // insert
    act(() => void g().insertColumn("name", "right"));
    expect(keys()).toHaveLength(4);
    spies.onColumnsChange.mockClear();
    spies.onRowsChange.mockClear();
    act(() => void g().undo());
    expect(spies.onColumnsChange).toHaveBeenCalledTimes(1);
    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
    expect(keys()).toEqual(original);
    expect(g().rawColumns.map((c) => c.key)).toEqual(original);

    // delete
    act(() => void g().deleteColumn("qty"));
    expect(keys()).toEqual(["name", "done"]);
    spies.onColumnsChange.mockClear();
    act(() => void g().undo());
    expect(spies.onColumnsChange).toHaveBeenCalledTimes(1);
    expect(keys()).toEqual(original);
    expect(hook.result.current.rows).toEqual(baseRows);

    // reorder (rows do not change, so only the columns callback fires)
    act(() => g().moveColumn("name", "done"));
    expect(keys()).toEqual(["qty", "done", "name"]);
    spies.onColumnsChange.mockClear();
    spies.onRowsChange.mockClear();
    act(() => void g().undo());
    expect(spies.onColumnsChange).toHaveBeenCalledTimes(1);
    expect(spies.onRowsChange).not.toHaveBeenCalled();
    expect(keys()).toEqual(original);

    // redo restores the reordered columns, once
    spies.onColumnsChange.mockClear();
    act(() => void g().redo());
    expect(spies.onColumnsChange).toHaveBeenCalledTimes(1);
    expect(keys()).toEqual(["qty", "done", "name"]);
  });

  it("undo of a formatting-only change emits neither rows nor columns", () => {
    const { hook, spies } = mountHook(strict);
    const g = () => hook.result.current.grid;
    const key = createCellMetaKey(0, "name");
    act(() =>
      g().setHistory((prev) => ({
        past: [...prev.past, prev.present],
        present: { ...prev.present, cellMeta: { [key]: { style: { fontWeight: 700 } } } },
        future: [],
      }))
    );
    expect(g().history.past).toHaveLength(1);
    spies.onRowsChange.mockClear();
    spies.onColumnsChange.mockClear();

    act(() => void g().undo());

    expect(g().history.past).toHaveLength(0);
    expect(g().history.present.cellMeta[key]).toBeUndefined();
    expect(spies.onRowsChange).not.toHaveBeenCalled();
    expect(spies.onColumnsChange).not.toHaveBeenCalled();
  });

  it("undo() with nothing to undo is a no-op that returns false", () => {
    const { hook, spies } = mountHook(strict);
    let ok = true;
    act(() => {
      ok = hook.result.current.grid.undo();
    });
    expect(ok).toBe(false);
    expect(spies.onRowsChange).not.toHaveBeenCalled();
  });
});

describe("A-012 undo/redo is blocked by the restriction flags (no change, no emit)", () => {
  it("enableUndoRedo=false", async () => {
    const { probe, spies, user, rerender, container } = mount(false);
    await edit(user, "Asha", "Zed");
    spies.onRowsChange.mockClear();
    rerender(
      <ControlledHost probe={probe} spies={spies} extra={{ enableUndoRedo: false }} />
    );
    await clickCell(user, "Zed");
    await user.keyboard(UNDO);
    expect(bodyTexts(container)).toContain("Zed");
    expect(spies.onRowsChange).not.toHaveBeenCalled();
    expect(names(probe.rows)).toEqual(["Zed", "Ben", "Cara"]);
  });

  it("mode=readonly after an edit (host flips editable -> readonly)", async () => {
    const { probe, spies, user, rerender, container } = mount(false);
    await edit(user, "Asha", "Zed");
    spies.onRowsChange.mockClear();
    rerender(<ControlledHost probe={probe} spies={spies} extra={{ mode: "readonly" }} />);
    await clickCell(user, "Zed");
    await user.keyboard(UNDO);
    expect(bodyTexts(container)).toContain("Zed");
    expect(spies.onRowsChange).not.toHaveBeenCalled();
  });

  it("enableEditing=false after an edit: the step that would revert cell values is blocked", async () => {
    const { probe, spies, user, rerender, container } = mount(false);
    await edit(user, "Asha", "Zed");
    spies.onRowsChange.mockClear();
    rerender(<ControlledHost probe={probe} spies={spies} extra={{ enableEditing: false }} />);
    await clickCell(user, "Zed");
    await user.keyboard(UNDO);
    expect(bodyTexts(container)).toContain("Zed");
    expect(bodyTexts(container)).not.toContain("Asha");
    expect(spies.onRowsChange).not.toHaveBeenCalled();
    expect(names(probe.rows)).toEqual(["Zed", "Ben", "Cara"]);
  });

  it("imperative undo()/redo() honour the same flags and return false", () => {
    for (const extra of [
      { mode: "readonly" as const },
      { enableUndoRedo: false },
    ] satisfies Partial<GridMasterProps<Row>>[]) {
      const spies: Spies = { onRowsChange: vi.fn(), onColumnsChange: vi.fn() };
      let editable = true;
      const hook = renderHook(() =>
        useHost(spies, editable ? {} : extra)
      );
      act(() =>
        hook.result.current.grid.updateRows(
          baseRows.map((r, i) => (i === 0 ? { ...r, name: "Zed" } : r))
        )
      );
      editable = false;
      hook.rerender();
      spies.onRowsChange.mockClear();

      let undone = true;
      let redone = true;
      act(() => {
        undone = hook.result.current.grid.undo();
        redone = hook.result.current.grid.redo();
      });
      expect(undone).toBe(false);
      expect(redone).toBe(false);
      expect(spies.onRowsChange).not.toHaveBeenCalled();
      expect(names(hook.result.current.grid.rows)).toEqual(["Zed", "Ben", "Cara"]);
    }
  });

  it("enableEditing=false still lets a formatting-only step be undone (no value revert)", () => {
    const spies: Spies = { onRowsChange: vi.fn(), onColumnsChange: vi.fn() };
    let editing = true;
    const hook = renderHook(() => useHost(spies, { enableEditing: editing }));
    const key = createCellMetaKey(0, "name");
    act(() =>
      hook.result.current.grid.setHistory((prev) => ({
        past: [...prev.past, prev.present],
        present: { ...prev.present, cellMeta: { [key]: { style: { fontWeight: 700 } } } },
        future: [],
      }))
    );
    editing = false;
    hook.rerender();

    let ok = false;
    act(() => {
      ok = hook.result.current.grid.undo();
    });

    expect(ok).toBe(true);
    expect(hook.result.current.grid.history.present.cellMeta[key]).toBeUndefined();
    expect(spies.onRowsChange).not.toHaveBeenCalled();
  });
});

describe("A-012 uncontrolled grid (no change callbacks)", () => {
  it("undo/redo still work and nothing throws", async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<GridMaster<Row> rows={baseRows} columns={baseColumns} />);

    await edit(user, "Asha", "Zed");
    expect(bodyTexts(container)).toContain("Zed");
    await clickCell(user, "Zed");
    await user.keyboard(UNDO);
    expect(bodyTexts(container)).toContain("Asha");
    await user.keyboard(REDO);
    expect(bodyTexts(container)).toContain("Zed");
    // The checkbox column's pre-existing React "checked without onChange" warning is unrelated noise.
    const unexpected = errors.mock.calls.filter((args) => !String(args[0]).includes("`checked` prop"));
    expect(unexpected).toEqual([]);
  });

  it("the imperative undo()/redo() work without callbacks", () => {
    const hook = renderHook(() => useGridMaster<Row>({ rows: baseRows, columns: baseColumns }));
    act(() =>
      hook.result.current.updateRows(baseRows.map((r, i) => (i === 0 ? { ...r, name: "Zed" } : r)))
    );
    act(() => void hook.result.current.undo());
    expect(names(hook.result.current.rows)).toEqual(NAMES);
    act(() => void hook.result.current.redo());
    expect(names(hook.result.current.rows)).toEqual(["Zed", "Ben", "Cara"]);
  });
});

const isBold = (text: string) =>
  /font-weight:\s*(700|bold)/.test(cellOf(text).getAttribute("style") ?? "");

describe("F-009 rows-sync: our own echo vs a genuinely different dataset", () => {
  // `initialCellMeta` is deliberately provided: it is the only thing that could overwrite meta.
  const seed: Record<string, GridCellMeta> = {
    [createCellMetaKey(2, "name")]: { style: { fontStyle: "italic" } },
  };

  it("echo of emitted rows (edit AND undo) keeps cell formatting and history", async () => {
    const { probe, user } = mount(false, { initialCellMeta: seed });

    await clickCell(user, "Ben");
    await user.click(screen.getByTitle(BOLD_BUTTON));
    expect(isBold("Ben")).toBe(true);

    await edit(user, "Asha", "Zed"); // host echoes the emitted rows
    expect(isBold("Ben")).toBe(true);
    expect(names(probe.rows)).toEqual(["Zed", "Ben", "Cara"]);

    await clickCell(user, "Zed");
    await user.keyboard(UNDO); // host echoes the undone rows
    expect(names(probe.rows)).toEqual(NAMES);
    expect(isBold("Ben")).toBe(true); // meta survived the undo echo

    await user.keyboard(UNDO); // history survived: the bold step is still there to undo
    expect(isBold("Ben")).toBe(false);
  });

  it("a different dataset from the parent resets history and, when initialCellMeta is given, re-seeds meta (documented policy)", async () => {
    const { probe, spies, user, container } = mount(false, { initialCellMeta: seed });
    await clickCell(user, "Ben");
    await user.click(screen.getByTitle(BOLD_BUTTON));
    await edit(user, "Asha", "Zed");
    spies.onRowsChange.mockClear();

    act(() =>
      probe.replaceRows([
        { id: 9, name: "Xan", qty: 1, done: false },
        { id: 8, name: "Yul", qty: 2, done: false },
        { id: 7, name: "Zoe", qty: 3, done: false },
      ])
    );

    expect(bodyTexts(container)).toEqual(expect.arrayContaining(["Xan", "Yul", "Zoe"]));
    expect(isBold("Yul")).toBe(false); // user formatting replaced by the seed
    expect(cellOf("Zoe").getAttribute("style") ?? "").toMatch(/italic/);

    await clickCell(user, "Xan");
    await user.keyboard(UNDO); // history was reset: nothing to undo, nothing emitted
    expect(bodyTexts(container)).toContain("Xan");
    expect(spies.onRowsChange).not.toHaveBeenCalled();
  });

  it("without initialCellMeta, a different dataset keeps existing (positional) meta but still resets history", async () => {
    const { probe, user, container } = mount(false);
    await clickCell(user, "Ben");
    await user.click(screen.getByTitle(BOLD_BUTTON));
    await edit(user, "Asha", "Zed");

    act(() =>
      probe.replaceRows([
        { id: 9, name: "Xan", qty: 1, done: false },
        { id: 8, name: "Yul", qty: 2, done: false },
        { id: 7, name: "Zoe", qty: 3, done: false },
      ])
    );

    expect(bodyTexts(container)).toEqual(expect.arrayContaining(["Xan", "Yul", "Zoe"]));
    // Meta is index-keyed (A-038 owns that); row 1 stays bold because nothing seeds over it.
    expect(isBold("Yul")).toBe(true);
    await clickCell(user, "Xan");
    await user.keyboard(UNDO);
    expect(bodyTexts(container)).toContain("Xan"); // history was reset
    expect(displayedNames()).toEqual([]);
  });
});
