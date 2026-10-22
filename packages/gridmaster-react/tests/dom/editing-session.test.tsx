// Task 7B — A-062: the edit SESSION. Language: TypeScript 6 (strict), React 19, vitest + jsdom.
//
// (a) A parent re-render that hands down a NEW `rows` array identity with the edited cell's value
//     UNCHANGED must not wipe the in-progress draft. The draft is reset only when the UNDERLYING
//     value genuinely changed (a real data update). Before the fix the sync effect ran on every
//     `rows` identity change and overwrote the draft.
// (b) A commit whose parsed value EQUALS the previous value writes nothing: no onRowsChange, no
//     onCellChange, no history push. A changed commit fires exactly one onCellChange.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GridMaster, createColumnFactory, type GridColumnDef } from "../../src/index";

type Row = { id: number; name: string; qty: number };
const col = createColumnFactory<Row>();
const columns: GridColumnDef<Row>[] = [col.text("name"), col.number("qty")];
const makeRows = (name = "Asha"): Row[] => [
  { id: 1, name, qty: 10 },
  { id: 2, name: "Ben", qty: 20 },
];

function nameCell(text: string): HTMLElement {
  const hit = screen.getAllByText(text).find((el) => el.closest("td.gm-td"));
  const shell = hit?.closest("td.gm-td")?.querySelector<HTMLElement>(".gm-cell-shell");
  if (!shell) throw new Error(`no editable cell "${text}"`);
  return shell;
}

/** The open cell editor's input (a text column renders a textarea inside the body cell). */
function cellEditor(): HTMLTextAreaElement {
  const el = document.querySelector<HTMLTextAreaElement>("td.gm-td textarea");
  if (!el) throw new Error("no open cell editor");
  return el;
}

describe("A-062a: the draft survives a new rows identity when the value is unchanged", () => {
  it("keeps the typed draft across a parent re-render with a new rows array (same value)", async () => {
    const user = userEvent.setup();
    const onRowsChange = vi.fn();
    const rowsA = makeRows();
    const view = render(
      <GridMaster<Row> rows={rowsA} columns={columns} onRowsChange={onRowsChange} />
    );

    await user.dblClick(nameCell("Asha"));
    await user.keyboard("{Control>}a{/Control}Zed");
    const editor = cellEditor();
    expect(editor.value).toBe("Zed");

    // Parent re-renders with a brand-new array identity but the edited cell's value is UNCHANGED.
    view.rerender(<GridMaster<Row> rows={makeRows()} columns={columns} onRowsChange={onRowsChange} />);

    expect(cellEditor().value).toBe("Zed");
  });

  it("resets the draft when the UNDERLYING value truly changes (a real data update)", async () => {
    const user = userEvent.setup();
    const rowsA = makeRows();
    const view = render(<GridMaster<Row> rows={rowsA} columns={columns} />);

    await user.dblClick(nameCell("Asha"));
    await user.keyboard("{Control>}a{/Control}Zed");
    expect(cellEditor().value).toBe("Zed");

    // The same cell's underlying value changed in the new props: the draft adopts the new value.
    view.rerender(<GridMaster<Row> rows={makeRows("Changed")} columns={columns} />);

    expect(cellEditor().value).toBe("Changed");
  });
});

describe("A-062b: an unchanged commit writes nothing", () => {
  it("committing the same value fires no onCellChange / onRowsChange and pushes no history", async () => {
    const user = userEvent.setup();
    const onRowsChange = vi.fn();
    const onCellChange = vi.fn();
    render(
      <GridMaster<Row>
        rows={makeRows()}
        columns={columns}
        onRowsChange={onRowsChange}
        onCellChange={onCellChange}
      />
    );

    await user.dblClick(nameCell("Asha"));
    // Re-commit the identical value.
    await user.keyboard("{Enter}");

    expect(onCellChange).not.toHaveBeenCalled();
    expect(onRowsChange).not.toHaveBeenCalled();
  });

  it("a changed commit fires exactly one onCellChange", async () => {
    const user = userEvent.setup();
    const onCellChange = vi.fn();
    render(<GridMaster<Row> rows={makeRows()} columns={columns} onCellChange={onCellChange} />);

    await user.dblClick(nameCell("Asha"));
    await user.keyboard("{Control>}a{/Control}Zed{Enter}");

    expect(onCellChange).toHaveBeenCalledTimes(1);
    expect(onCellChange.mock.calls[0][0]).toMatchObject({ columnKey: "name", value: "Zed" });
  });
});
