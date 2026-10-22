// A1 (trust/ARIA): the viewport is the WAI-ARIA APG "Grid" — role tree, counts and the
// virtualization-proof aria-rowindex/aria-colindex. Header-row decision: the TITLE row is the single
// exposed header row (role="row", aria-rowindex 1); the spreadsheet LETTER row is decorative address
// chrome (role="presentation" + aria-hidden). So exposed header rows = 1 and:
//   aria-rowcount = displayRows + 1 ; data-row aria-rowindex = displayIndex + 2
//   aria-colcount = visibleColumns + 1 (row-header col) ; rowheader colindex 1, gridcell colindex = colIndex + 2
// Language: TypeScript 6 (strict), React 19, vitest + jsdom + @testing-library.
import { fireEvent, render, within } from "@testing-library/react";
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

function renderGrid(props: Partial<React.ComponentProps<typeof GridMaster<Row>>> = {}, rowCount = 5) {
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

describe("A1 role tree", () => {
  it("grid > rowgroup > row > columnheader/rowheader/gridcell", () => {
    const { container } = renderGrid({}, 2);
    const g = grid(container);

    // The focus owner (viewport) is the grid; the inner table is presentation (one tab stop).
    expect(g.classList.contains("gm-viewport")).toBe(true);
    expect(g.querySelector("table")?.getAttribute("role")).toBe("presentation");

    const rowgroups = g.querySelectorAll('[role="rowgroup"]');
    expect(rowgroups.length).toBe(2); // thead + tbody
    expect(container.querySelector("thead")?.getAttribute("role")).toBe("rowgroup");
    expect(container.querySelector("tbody")?.getAttribute("role")).toBe("rowgroup");

    // Header row: one columnheader per visible column + the select-all corner.
    const headerRow = g.querySelector('thead tr[role="row"]');
    expect(headerRow).toBeTruthy();
    const colHeaders = headerRow?.querySelectorAll('[role="columnheader"]') ?? [];
    expect(colHeaders.length).toBe(columns.length + 1);

    // A data row: one rowheader + gridcells.
    const dataRow = g.querySelector('tbody tr[role="row"]');
    expect(dataRow?.querySelectorAll('[role="rowheader"]').length).toBe(1);
    expect(dataRow?.querySelectorAll('[role="gridcell"]').length).toBe(columns.length);
  });

  it("select-all corner is a columnheader named 'Select all' at colindex 1", () => {
    const { container } = renderGrid({}, 2);
    const headerRow = grid(container).querySelector('thead tr[role="row"]') as HTMLElement;
    const corner = within(headerRow).getByRole("columnheader", { name: "Select all" });
    expect(corner.getAttribute("aria-colindex")).toBe("1");
  });

  it("spreadsheet letter row is presentation + aria-hidden", () => {
    const { container } = renderGrid({}, 2);
    const letterRow = container.querySelector("thead tr") as HTMLElement; // first thead row
    expect(letterRow.getAttribute("role")).toBe("presentation");
    expect(letterRow.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("A1 counts and indexes (non-virtualized 5x3)", () => {
  it("rowcount = rows + 1 header; colcount = visible cols + 1 row-header", () => {
    const { container } = renderGrid({}, 5);
    const g = grid(container);
    expect(g.getAttribute("aria-rowcount")).toBe("6");
    expect(g.getAttribute("aria-colcount")).toBe("4");
  });

  it("title header row is aria-rowindex 1; columnheaders are colindex 2..N", () => {
    const { container } = renderGrid({}, 5);
    const headerRow = grid(container).querySelector('thead tr[role="row"]') as HTMLElement;
    expect(headerRow.getAttribute("aria-rowindex")).toBe("1");
    const dataHeaders = Array.from(
      headerRow.querySelectorAll<HTMLElement>('[role="columnheader"]')
    ).filter((h) => h.getAttribute("aria-label") !== "Select all");
    expect(dataHeaders.map((h) => h.getAttribute("aria-colindex"))).toEqual(["2", "3", "4"]);
  });

  it("data rows are aria-rowindex displayIndex+2; cells colindex 1(rowheader),2,3,4", () => {
    const { container } = renderGrid({}, 5);
    const g = grid(container);
    const rows = Array.from(g.querySelectorAll<HTMLElement>('tbody tr[role="row"]'));
    expect(rows.length).toBe(5);
    rows.forEach((row, d) => {
      expect(row.getAttribute("aria-rowindex")).toBe(String(d + 2));
      const rh = row.querySelector('[role="rowheader"]') as HTMLElement;
      expect(rh.getAttribute("aria-colindex")).toBe("1");
      const cells = Array.from(row.querySelectorAll<HTMLElement>('[role="gridcell"]'));
      expect(cells.map((c) => c.getAttribute("aria-colindex"))).toEqual(["2", "3", "4"]);
    });
  });
});

describe("A1 virtualization keeps rowindex in sync (10k rows)", () => {
  it("rowcount = total+header and every mounted row's rowindex = its displayIndex+2", () => {
    const { container } = renderGrid({ virtualizeRows: true }, 10_000);
    const g = grid(container);
    expect(g.getAttribute("aria-rowcount")).toBe("10001");

    // Give the viewport a real height and scroll deep into the list.
    Object.defineProperty(g, "clientHeight", { configurable: true, value: 400 });
    g.scrollTop = 120_000;
    fireEvent.scroll(g);

    const rows = Array.from(g.querySelectorAll<HTMLElement>('tbody tr[role="row"]'));
    expect(rows.length).toBeGreaterThan(0);
    // Virtualization must have un-mounted the early rows: only a bounded window is in the DOM, and it
    // is far from the top. A2 keeps the default cursor's row (index 0 → rowindex 2) mounted even when
    // scrolled away, so AT MOST ONE shallow row (that kept active row) is allowed; every other mounted
    // row is deep. (If virtualization were off, all 10,000 rows would mount and both asserts would fail.)
    const mountedRowIndexes = rows.map((r) => Number(r.getAttribute("aria-rowindex")));
    expect(rows.length).toBeLessThan(100);
    expect(mountedRowIndexes.filter((i) => i <= 100).length).toBeLessThanOrEqual(1);

    for (const row of rows) {
      const name = row.querySelector('[role="gridcell"]')?.textContent ?? "";
      const displayIndex = Number(name.replace("Name", ""));
      expect(row.getAttribute("aria-rowindex")).toBe(String(displayIndex + 2));
      const cells = Array.from(row.querySelectorAll<HTMLElement>('[role="gridcell"]'));
      expect(cells.map((c) => c.getAttribute("aria-colindex"))).toEqual(["2", "3", "4"]);
    }
  });

  it("virtualization spacer rows are presentation + aria-hidden", () => {
    const { container } = renderGrid({ virtualizeRows: true }, 10_000);
    const g = grid(container);
    Object.defineProperty(g, "clientHeight", { configurable: true, value: 400 });
    g.scrollTop = 120_000;
    fireEvent.scroll(g);

    const spacers = Array.from(g.querySelectorAll<HTMLElement>('tbody tr[aria-hidden="true"]'));
    expect(spacers.length).toBeGreaterThan(0);
    for (const s of spacers) expect(s.getAttribute("role")).toBe("presentation");
  });
});

describe("A1 hidden / frozen columns", () => {
  it("hidden column: colcount and colindex count only visible columns", () => {
    const hidden: GridColumnDef<Row>[] = [
      col.text("name"),
      { ...col.number("qty"), hidden: true },
      col.text("note"),
    ];
    const { container } = render(
      <GridMaster<Row>
        rows={makeRows(3)}
        columns={hidden}
        showToolbar={false}
        showFormulaBar={false}
        showStatusBar={false}
      />
    );
    const g = grid(container);
    expect(g.getAttribute("aria-colcount")).toBe("3"); // 2 visible + row-header
    const dataRow = g.querySelector('tbody tr[role="row"]') as HTMLElement;
    const cells = Array.from(dataRow.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    expect(cells.map((c) => c.getAttribute("aria-colindex"))).toEqual(["2", "3"]);
  });

  it("frozen columns do not change the index sequence", () => {
    const { container } = renderGrid({ frozenColumns: 1 }, 3);
    const g = grid(container);
    expect(g.getAttribute("aria-colcount")).toBe("4");
    const dataRow = g.querySelector('tbody tr[role="row"]') as HTMLElement;
    const cells = Array.from(dataRow.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    expect(cells.map((c) => c.getAttribute("aria-colindex"))).toEqual(["2", "3", "4"]);
  });
});

describe("A1 display-row-count tracks filters", () => {
  it("a value-set filter shrinks aria-rowcount to displayed rows + header", () => {
    const { container } = renderGrid(
      { initialFilters: { name: { type: "valueSet", values: new Set(["Name0", "Name2"]) } } },
      5
    );
    const g = grid(container);
    expect(g.getAttribute("aria-rowcount")).toBe("3"); // 2 displayed + header
    expect(g.querySelectorAll('tbody tr[role="row"]').length).toBe(2);
  });
});

describe("A1 multiselectable and readonly", () => {
  it("selection enabled ⇒ aria-multiselectable=true", () => {
    const { container } = renderGrid({}, 3);
    expect(grid(container).getAttribute("aria-multiselectable")).toBe("true");
  });

  it("enableSelection=false ⇒ no aria-multiselectable", () => {
    const { container } = renderGrid({ enableSelection: false }, 3);
    expect(grid(container).getAttribute("aria-multiselectable")).toBeNull();
  });

  it("readonly mode ⇒ aria-readonly=true", () => {
    const { container } = renderGrid({ mode: "readonly" }, 3);
    expect(grid(container).getAttribute("aria-readonly")).toBe("true");
  });

  it("editable grid ⇒ no aria-readonly", () => {
    const { container } = renderGrid({}, 3);
    expect(grid(container).getAttribute("aria-readonly")).toBeNull();
  });
});

describe("A1 empty state", () => {
  it("the empty-state row is role=row with a single gridcell", () => {
    const { container } = renderGrid({}, 0);
    const g = grid(container);
    const emptyRow = g.querySelector('tbody tr[role="row"]') as HTMLElement;
    expect(emptyRow).toBeTruthy();
    expect(emptyRow.querySelectorAll('[role="gridcell"]').length).toBe(1);
    expect(g.getAttribute("aria-rowcount")).toBe("1"); // 0 data + header
  });
});
