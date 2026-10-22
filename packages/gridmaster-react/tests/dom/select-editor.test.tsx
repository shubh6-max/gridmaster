// DOM test: a select cell whose stored value is not among its options. Language: TypeScript 6, React 19.
// Before the fix the editor rendered only column.options, so the stored value vanished (the
// <select> fell back to the blank/first option) even though it was still the cell's value.
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GridMaster, createColumnFactory } from "../../src/index";

type Row = { id: number; status: string };
const col = createColumnFactory<Row>();

function mount(status: string) {
  const onRowsChange = vi.fn();
  const rows: Row[] = [{ id: 1, status }];
  const columns = [col.select("status", { options: ["Open", "Closed"] })];
  const utils = render(<GridMaster<Row> rows={rows} columns={columns} onRowsChange={onRowsChange} />);
  // The double-click handler lives on the cell's inner shell (td.gm-rh is the row header).
  const cell = utils.container.querySelector("td.gm-td .gm-cell-shell");
  if (!cell) throw new Error("no grid cell rendered");
  fireEvent.doubleClick(cell);
  // The toolbar also renders selects, so scope to the one inside the edited cell.
  const select = utils.container.querySelector("td select");
  if (!(select instanceof HTMLSelectElement)) throw new Error("cell editor select not rendered");
  return { onRowsChange, select, container: utils.container };
}

describe("SelectEditor with a stored value outside the options", () => {
  it("keeps the stale value selected and listed as an option", () => {
    const { select } = mount("Archived");
    expect(select.value).toBe("Archived");
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "",
      "Open",
      "Closed",
      "Archived",
    ]);
  });

  it("does not coerce the stale value when the editor blurs", () => {
    const { select, onRowsChange, container } = mount("Archived");
    act(() => {
      fireEvent.blur(select);
    });
    // Committing an untouched draft is a no-op for the rows (no coercion to "" or "Open") ...
    expect(onRowsChange).not.toHaveBeenCalled();
    // ... the editor closed, and the cell still shows the stale value.
    expect(container.querySelector("td.gm-td select")).toBeNull();
    expect(container.querySelector("td.gm-td .gm-select-cell-value")?.textContent).toBe("Archived");
  });

  it("commits a newly picked option normally", () => {
    const { select, onRowsChange } = mount("Archived");
    fireEvent.change(select, { target: { value: "Closed" } });
    act(() => {
      fireEvent.blur(select);
    });
    const next = onRowsChange.mock.calls[0]?.[0] as readonly Row[];
    expect(next[0]?.status).toBe("Closed");
  });

  it("still lists only the configured options when the value is one of them", () => {
    const { select } = mount("Open");
    expect(select.value).toBe("Open");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "Open", "Closed"]);
  });
});
