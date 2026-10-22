// A-009 / F-004: a row-count change (insert/delete/append/live data) must NOT reset the cursor to
// A1 or scroll to the top — only a filters/sort/colour identity change does. Language: TypeScript 6
// (strict), React 19, vitest + jsdom + @testing-library.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  GridMaster,
  createColumnFactory,
  type GridColumnDef,
  type GridSelectionChangeEvent,
} from "../../src/index";

type Row = { id: number; name: string; qty: number };
const col = createColumnFactory<Row>();
const columns: GridColumnDef<Row>[] = [col.text("name"), col.number("qty")];

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Name${i}`, qty: (i + 1) * 10 }));
}

function cursorOf(spy: ReturnType<typeof vi.fn>) {
  const calls = spy.mock.calls;
  return (calls[calls.length - 1][0] as GridSelectionChangeEvent).selection.cursor;
}

async function openSortMenu(user: ReturnType<typeof userEvent.setup>, columnTitle: string) {
  await user.click(screen.getByTitle(`Open column options for ${columnTitle}`));
  const menu = document.querySelector<HTMLElement>("[data-gm-column-menu]");
  if (!menu) throw new Error("column menu did not open");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  return within(menu);
}

describe("A-009 / F-004 cursor and scroll stability", () => {
  it("appending a row keeps the cursor and preserves scroll (no jump to A1)", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const { container, rerender } = render(
      <GridMaster<Row>
        rows={makeRows(10)}
        columns={columns}
        virtualizeRows={false}
        showFormulaBar={false}
        showStatusBar={false}
        onSelectionChange={onSelectionChange}
      />
    );

    await user.click(within(container).getByText("Name3")); // cursor -> (3, 0)
    expect(cursorOf(onSelectionChange)).toEqual({ row: 3, col: 0 });

    const viewport = container.querySelector<HTMLElement>(".gm-viewport");
    if (!viewport) throw new Error("viewport missing");
    viewport.scrollTop = 120;

    // Live data / append: one more row, same filters/sort identity.
    rerender(
      <GridMaster<Row>
        rows={makeRows(11)}
        columns={columns}
        virtualizeRows={false}
        showFormulaBar={false}
        showStatusBar={false}
        onSelectionChange={onSelectionChange}
      />
    );

    expect(cursorOf(onSelectionChange)).toEqual({ row: 3, col: 0 }); // not reset
    expect(viewport.scrollTop).toBe(120); // scroll preserved
  });

  it("a sort change DOES reset the cursor to A1 and scroll to top", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const { container } = render(
      <GridMaster<Row>
        rows={makeRows(10)}
        columns={columns}
        virtualizeRows={false}
        showFormulaBar={false}
        showStatusBar={false}
        onSelectionChange={onSelectionChange}
      />
    );

    await user.click(within(container).getByText("Name3"));
    const viewport = container.querySelector<HTMLElement>(".gm-viewport");
    if (!viewport) throw new Error("viewport missing");
    viewport.scrollTop = 120;

    const menu = await openSortMenu(user, "Name");
    await user.click(menu.getByRole("button", { name: "Sort" }));
    await user.click(menu.getByRole("button", { name: "Sort A to Z" }));

    expect(cursorOf(onSelectionChange)).toEqual({ row: 0, col: 0 });
    expect(viewport.scrollTop).toBe(0);
  });
});
