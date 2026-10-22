// Task 7B — A-063 (CheckboxEditor committed the stale pre-toggle value) and F-013 (React warns
// "`checked` prop without `onChange`" for every checkbox cell). Language: TS 6 strict, React 19,
// vitest + jsdom. A toggle must commit the NEW value exactly once; the display checkbox must be a
// controlled input with onChange so React logs no warning.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GridMaster, createColumnFactory, type GridColumnDef } from "../../src/index";

type Row = { id: number; name: string; done: boolean };
const col = createColumnFactory<Row>();
const columns: GridColumnDef<Row>[] = [col.text("name"), col.checkbox("done")];
const rows = (): Row[] => [
  { id: 1, name: "Asha", done: false },
  { id: 2, name: "Ben", done: false },
  { id: 3, name: "Cara", done: false },
];

afterEach(() => vi.restoreAllMocks());

function doneCheckbox(rowIndex: number): HTMLInputElement {
  const boxes = document.querySelectorAll<HTMLInputElement>("td.gm-td input[type=checkbox]");
  const box = boxes[rowIndex];
  if (!box) throw new Error(`no checkbox in row ${rowIndex}`);
  return box;
}

describe("A-063: a checkbox toggle commits the NEW value, once", () => {
  it("clicking the display checkbox commits true exactly once", async () => {
    const user = userEvent.setup();
    const onCellChange = vi.fn();
    render(<GridMaster<Row> rows={rows()} columns={columns} onCellChange={onCellChange} />);

    await user.click(doneCheckbox(0));

    expect(onCellChange).toHaveBeenCalledTimes(1);
    expect(onCellChange.mock.calls[0][0]).toMatchObject({ columnKey: "done", value: true });
    expect(doneCheckbox(0).checked).toBe(true);
  });

  it("F2 then Space commits the toggled value, not the stale pre-toggle value", async () => {
    const user = userEvent.setup();
    const onCellChange = vi.fn();
    render(<GridMaster<Row> rows={rows()} columns={columns} onCellChange={onCellChange} />);

    await user.click(doneCheckbox(0)); // select + commit true (1st change)
    onCellChange.mockClear();

    // Re-open the cell as an editor and toggle with Space: must commit false (the NEW value).
    await user.keyboard("{F2}");
    await user.keyboard(" ");

    expect(onCellChange).toHaveBeenCalledTimes(1);
    expect(onCellChange.mock.calls[0][0]).toMatchObject({ columnKey: "done", value: false });
  });
});

describe("F-013: a checkbox column logs no React controlled-input warning", () => {
  it("rendering a grid with a checkbox column does not call console.error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GridMaster<Row> rows={rows()} columns={columns} />);
    const warned = errorSpy.mock.calls.some((call) =>
      String(call[0]).includes("checked") || String(call[0]).includes("onChange")
    );
    expect(warned).toBe(false);
  });
});
