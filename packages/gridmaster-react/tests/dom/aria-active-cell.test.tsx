// A2 (trust/ARIA): the active (cursor) cell is exposed per the WAI-ARIA APG Grid pattern — focus
// stays on the role=grid element and the active cell is named via aria-activedescendant, which must
// always resolve (via document.getElementById) to a mounted gridcell, even under virtualization.
// Plus aria-selected on selected/active cells (never "false" noise), aria-readonly on read-only
// cells, stable per-instance cell ids, and the empty-state row's colspan. useId() ids contain colons
// (a valid IDREF) so tests query with document.getElementById, never a CSS selector.
// Language: TypeScript 6 (strict), React 19, vitest + jsdom + @testing-library.
import { fireEvent, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GridMaster, createColumnFactory, type GridColumnDef } from "../../src/index";

type Row = { id: number; name: string; qty: number; note: string };
const col = createColumnFactory<Row>();
const columns: GridColumnDef<Row>[] = [col.text("name"), col.number("qty"), col.text("note")];

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Name${i}`,
    qty: (i + 1) * 10,
    note: `note${i}`,
  }));
}

function renderGrid(
  props: Partial<React.ComponentProps<typeof GridMaster<Row>>> = {},
  rowCount = 5
) {
  return render(
    <GridMaster<Row>
      rows={makeRows(rowCount)}
      columns={columns}
      showToolbar={false}
      showFormulaBar={false}
      showStatusBar={false}
      {...props}
    />
  );
}

function grid(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[role="grid"]');
  if (!el) throw new Error("no role=grid element");
  return el;
}

/** The gridcell currently named by aria-activedescendant, resolved the way a screen reader would. */
function activeDescendantCell(g: HTMLElement): HTMLElement | null {
  const id = g.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
}

describe("A2 stable cell ids", () => {
  it("every data cell has a defined, unique id across one grid", () => {
    const { container } = renderGrid({}, 5);
    const ids = Array.from(grid(container).querySelectorAll<HTMLElement>('[role="gridcell"]')).map(
      (c) => c.id
    );
    expect(ids.length).toBe(15); // 5 rows x 3 cols
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ids do not collide across two grids on one page", () => {
    const { container } = render(
      <div>
        <div data-testid="a">
          <GridMaster<Row> rows={makeRows(3)} columns={columns} />
        </div>
        <div data-testid="b">
          <GridMaster<Row> rows={makeRows(3)} columns={columns} />
        </div>
      </div>
    );
    const idsIn = (host: HTMLElement) =>
      Array.from(host.querySelectorAll<HTMLElement>('[role="gridcell"]')).map((c) => c.id);
    const a = idsIn(within(container).getByTestId("a"));
    const b = idsIn(within(container).getByTestId("b"));
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    // No shared id between the two instances (useId prefixes differ).
    expect(a.some((id) => b.includes(id))).toBe(false);
  });

  it("ids are stable across re-renders", () => {
    const { container, rerender } = render(<GridMaster<Row> rows={makeRows(3)} columns={columns} />);
    const first = grid(container).querySelector<HTMLElement>('[role="gridcell"]')?.id;
    rerender(<GridMaster<Row> rows={makeRows(4)} columns={columns} />);
    const second = grid(container).querySelector<HTMLElement>('[role="gridcell"]')?.id;
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });
});

describe("A2 aria-activedescendant follows the cursor", () => {
  it("points at a mounted gridcell and tracks each navigation key", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({}, 5);
    const g = grid(container);
    await user.click(within(container).getByText("Name0")); // cursor (0,0)

    const steps = ["{ArrowDown}", "{ArrowRight}", "{End}", "{Home}", "{PageDown}", "{Control>}{End}{/Control}"];
    for (const keys of steps) {
      await user.keyboard(keys);
      const cell = activeDescendantCell(g);
      expect(cell, `after ${keys}`).not.toBeNull();
      expect(cell?.getAttribute("role")).toBe("gridcell");
      // It names exactly the highlighted (active) cell.
      expect(cell?.classList.contains("gm-active")).toBe(true);
    }
  });

  it("no cursor (empty grid) ⇒ no aria-activedescendant", () => {
    const { container } = renderGrid({}, 0);
    expect(grid(container).getAttribute("aria-activedescendant")).toBeNull();
  });
});

describe("A2 active row stays mounted under virtualization", () => {
  it("cursor far below, scrolled to top ⇒ active cell still mounted, rowindex correct, rows bounded", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({ virtualizeRows: true }, 10_000);
    const g = grid(container);
    Object.defineProperty(g, "clientHeight", { configurable: true, value: 400 });

    await user.click(within(container).getAllByText("Name0")[0]);
    await user.keyboard("{Control>}{End}{/Control}"); // cursor to row 9999

    // Scroll the viewport back to the very top: the active row is now far outside the window.
    g.scrollTop = 0;
    fireEvent.scroll(g);

    const cell = activeDescendantCell(g);
    expect(cell).not.toBeNull();
    expect(cell?.getAttribute("role")).toBe("gridcell");
    const activeTr = cell?.closest('tr[role="row"]') as HTMLElement;
    // Display index 9999 → aria-rowindex 9999 + 2 = 10001.
    expect(activeTr.getAttribute("aria-rowindex")).toBe("10001");

    // Virtualization still bounds the mounted data rows (never 10,000).
    const dataRows = g.querySelectorAll('tbody tr[role="row"]');
    expect(dataRows.length).toBeGreaterThan(0);
    expect(dataRows.length).toBeLessThan(100);
    // And the window really unmounted the top rows (only the kept-mounted active row is deep).
    const topRow = g.querySelector('tbody tr[role="row"]') as HTMLElement;
    expect(Number(topRow.getAttribute("aria-rowindex"))).toBeLessThan(100);
  });
});

/**
 * Walk the tbody rows in DOM order. Spacer rows (aria-hidden) contribute their td pixel height; data
 * rows contribute one `rowHeight` (read from the tr itself). Mirrors exactly how GridBody emits them.
 */
function bodyRowAudit(g: HTMLElement) {
  let rowHeight = 0;
  let totalHeight = 0;
  const dataIndexes: number[] = [];
  for (const tr of Array.from(g.querySelectorAll<HTMLElement>("tbody > tr"))) {
    if (tr.getAttribute("aria-hidden") === "true") {
      const td = tr.querySelector<HTMLElement>("td");
      totalHeight += Number.parseFloat(td?.style.height ?? "0") || 0;
    } else if (tr.getAttribute("role") === "row") {
      const h = Number.parseFloat(tr.style.height) || 0;
      rowHeight = h || rowHeight;
      totalHeight += h;
      dataIndexes.push(Number(tr.getAttribute("aria-rowindex")));
    }
  }
  return { rowHeight, totalHeight, dataIndexes };
}

describe("A2 kept active row preserves DOM order and spacer math", () => {
  it("active row above the window: rowindexes ascending, total height = totalRows × rowHeight", async () => {
    const { container } = renderGrid({ virtualizeRows: true }, 10_000); // default cursor = row 0
    const g = grid(container);
    Object.defineProperty(g, "clientHeight", { configurable: true, value: 400 });
    g.scrollTop = 120_000;
    fireEvent.scroll(g);

    const { rowHeight, totalHeight, dataIndexes } = bodyRowAudit(g);
    expect(rowHeight).toBeGreaterThan(0);
    // The kept active row (rowindex 2) is first, then the deep window — strictly ascending, no dupes.
    expect(dataIndexes[0]).toBe(2);
    expect(dataIndexes).toEqual([...dataIndexes].sort((a, b) => a - b));
    expect(new Set(dataIndexes).size).toBe(dataIndexes.length);
    // Spacers + mounted rows reconstruct the full scroll height exactly (no jump, no duplicate row).
    expect(totalHeight).toBe(10_000 * rowHeight);
  });

  it("active row below the window (Ctrl+End at top): extra last row present, ascending order", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({ virtualizeRows: true }, 10_000);
    const g = grid(container);
    Object.defineProperty(g, "clientHeight", { configurable: true, value: 400 });
    await user.click(within(container).getAllByText("Name0")[0]);
    await user.keyboard("{Control>}{End}{/Control}"); // cursor to row 9999
    g.scrollTop = 0;
    fireEvent.scroll(g);

    const { rowHeight, totalHeight, dataIndexes } = bodyRowAudit(g);
    expect(dataIndexes[dataIndexes.length - 1]).toBe(10_001); // kept active last row (9999 + 2)
    expect(dataIndexes).toEqual([...dataIndexes].sort((a, b) => a - b));
    expect(new Set(dataIndexes).size).toBe(dataIndexes.length);
    expect(totalHeight).toBe(10_000 * rowHeight);
  });

  it("a stale cursor after the parent shrinks the rows never dangles", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(
      <GridMaster<Row> rows={makeRows(1000)} columns={columns} virtualizeRows showStatusBar={false} />
    );
    const g = grid(container);
    Object.defineProperty(g, "clientHeight", { configurable: true, value: 400 });
    await user.click(within(container).getAllByText("Name0")[0]);
    await user.keyboard("{Control>}{End}{/Control}"); // cursor deep (row 999)

    // Parent replaces rows with far fewer — the cursor must clamp and the IDREF must stay resolvable.
    expect(() =>
      rerender(
        <GridMaster<Row> rows={makeRows(3)} columns={columns} virtualizeRows showStatusBar={false} />
      )
    ).not.toThrow();

    const id = g.getAttribute("aria-activedescendant");
    if (id) {
      const cell = document.getElementById(id);
      expect(cell).not.toBeNull();
      expect(cell?.getAttribute("role")).toBe("gridcell");
    }
  });
});

describe("A2 aria-selected", () => {
  const selectedCells = (g: HTMLElement) =>
    g.querySelectorAll('[role="gridcell"][aria-selected="true"]');

  it("a Shift+Arrow range marks exactly the cells in the range", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({}, 5);
    const g = grid(container);
    await user.click(within(container).getByText("Name0")); // (0,0)
    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}"); // rows 0..2, col 0
    expect(selectedCells(g).length).toBe(3);
  });

  it("never emits aria-selected=false, and leaves unselected cells with no attribute", async () => {
    const { container } = renderGrid({}, 5);
    const g = grid(container);
    // Default cursor (0,0) is active → exactly one selected cell; no "false" anywhere.
    expect(g.querySelectorAll('[role="gridcell"][aria-selected="false"]').length).toBe(0);
    expect(selectedCells(g).length).toBe(1);
  });

  it("row selection marks the tr, its row header and its cells", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({}, 5);
    const g = grid(container);
    const header = g.querySelectorAll<HTMLElement>('tbody [role="rowheader"]')[1]; // row index 1
    await user.click(header);
    expect(header.getAttribute("aria-selected")).toBe("true");
    const tr = header.closest('tr[role="row"]') as HTMLElement;
    expect(tr.getAttribute("aria-selected")).toBe("true");
    expect(within(tr).getAllByRole("gridcell").every((c) => c.getAttribute("aria-selected") === "true")).toBe(true);
  });

  it("select-all marks every cell", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({}, 5);
    const g = grid(container);
    await user.click(within(container).getByText("Name0"));
    await user.keyboard("{Control>}a{/Control}");
    expect(selectedCells(g).length).toBe(15); // 5 x 3
  });

  it("enableSelection={false} emits no aria-selected at all", () => {
    const { container } = renderGrid({ enableSelection: false }, 5);
    expect(grid(container).querySelectorAll("[aria-selected]").length).toBe(0);
  });
});

describe("A2 aria-readonly on cells", () => {
  const readonlyCount = (g: HTMLElement) =>
    g.querySelectorAll('[role="gridcell"][aria-readonly="true"]').length;

  it("a read-only column marks its cells", () => {
    const roColumns: GridColumnDef<Row>[] = [
      col.text("name", { readonly: true }),
      col.number("qty"),
      col.text("note"),
    ];
    const { container } = render(
      <GridMaster<Row> rows={makeRows(5)} columns={roColumns} showStatusBar={false} />
    );
    const g = grid(container);
    expect(readonlyCount(g)).toBe(5); // the whole name column
  });

  it("read-only cell meta (getCellMeta) marks exactly that cell", () => {
    const { container } = renderGrid(
      { getCellMeta: (_r, i, key) => (i === 0 && key === "name" ? { readonly: true } : undefined) },
      5
    );
    expect(readonlyCount(grid(container))).toBe(1);
  });

  it("read-only row meta (getRowMeta) marks the whole row", () => {
    const { container } = renderGrid(
      { getRowMeta: (_r, i) => (i === 2 ? { readonly: true } : undefined) },
      5
    );
    expect(readonlyCount(grid(container))).toBe(3); // the 3 cells of row 2
  });

  it("mode=readonly marks every cell", () => {
    const { container } = renderGrid({ mode: "readonly" }, 5);
    expect(readonlyCount(grid(container))).toBe(15); // 5 x 3
  });

  it("an editable grid marks no cell", () => {
    const { container } = renderGrid({}, 5);
    expect(readonlyCount(grid(container))).toBe(0);
  });
});

describe("A2 empty-state row", () => {
  it("single gridcell spans all columns and keeps rowcount consistent", () => {
    const { container } = renderGrid({}, 0);
    const g = grid(container);
    const emptyRow = g.querySelector('tbody tr[role="row"]') as HTMLElement;
    const cell = emptyRow.querySelector('[role="gridcell"]') as HTMLElement;
    expect(cell.getAttribute("aria-colindex")).toBe("1");
    expect(cell.getAttribute("aria-colspan")).toBe("4"); // 3 columns + row header
    // Informational placeholder: rowcount stays header + 0 data rows, and it claims no numbered index.
    expect(g.getAttribute("aria-rowcount")).toBe("1");
    expect(emptyRow.getAttribute("aria-rowindex")).toBeNull();
  });
});

describe("A2 active highlighting is unchanged", () => {
  it("the gm-active cell is the aria-activedescendant target", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({}, 5);
    const g = grid(container);
    await user.click(within(container).getByText("Name0"));
    const active = container.querySelector<HTMLElement>(".gm-td.gm-active");
    expect(active).not.toBeNull();
    expect(active?.id).toBe(g.getAttribute("aria-activedescendant"));
  });
});
