// Task 7B — A-084 / F-002: per-cell and per-row `readonly` meta must BLOCK every value-write path
// (start editing, checkbox toggle, paste, cut, Delete, fill), not merely grey the cell. Formatting
// is a META write and stays allowed. Language: TS 6 strict, React 19, vitest + jsdom.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  GridMaster,
  createColumnFactory,
  fillRangeWithSource,
  isCellReadonly,
  resolveCellReadonly,
  resolveColumns,
  type GridCellMeta,
  type GridColumnDef,
  type GridRowMeta,
} from "../../src/index";

type Row = { id: number; name: string; qty: number; done: boolean };
const col = createColumnFactory<Row>();
const columns: GridColumnDef<Row>[] = [col.text("name"), col.number("qty"), col.checkbox("done")];
const rows = (): Row[] => [
  { id: 1, name: "Asha", qty: 10, done: false },
  { id: 2, name: "Ben", qty: 20, done: false },
  { id: 3, name: "Cara", qty: 30, done: false },
];

function cellByText(text: string): HTMLElement {
  const hit = screen.getAllByText(text).find((el) => el.closest("td.gm-td"));
  const td = hit?.closest<HTMLElement>("td.gm-td");
  if (!td) throw new Error(`no cell "${text}"`);
  return td;
}
const shellByText = (text: string) =>
  cellByText(text).querySelector<HTMLElement>(".gm-cell-shell") as HTMLElement;
const hasEditor = () =>
  document.querySelector("td.gm-td input:not([type=checkbox]), td.gm-td textarea") !== null;

// Make the "Asha" cell read-only three different ways, parametrised.
const readonlyAsha: Record<string, Partial<Parameters<typeof GridMaster<Row>>[0]>> = {
  "getCellMeta": {
    getCellMeta: (_r, i, key): GridCellMeta | undefined =>
      i === 0 && key === "name" ? { readonly: true } : undefined,
  },
  "getRowMeta": {
    getRowMeta: (_r, i): GridRowMeta | undefined => (i === 0 ? { readonly: true } : undefined),
  },
  "static initialCellMeta": {
    initialCellMeta: { "0::name": { readonly: true } },
  },
};

describe("A-084: read-only meta blocks editing from every source", () => {
  for (const [label, extra] of Object.entries(readonlyAsha)) {
    it(`${label}: double-click and typing do not open an editor; nothing mutates`, async () => {
      const user = userEvent.setup();
      const onRowsChange = vi.fn();
      render(<GridMaster<Row> rows={rows()} columns={columns} onRowsChange={onRowsChange} {...extra} />);

      expect(cellByText("Asha").classList.contains("gm-readonly")).toBe(true);
      await user.dblClick(shellByText("Asha"));
      expect(hasEditor()).toBe(false);

      await user.click(cellByText("Asha"));
      await user.keyboard("Z{F2}");
      expect(hasEditor()).toBe(false);
      expect(onRowsChange).not.toHaveBeenCalled();
    });
  }
});

describe("A-084: read-only meta blocks clipboard and Delete, reports skipped", () => {
  it("paste into a read-only cell is skipped and reported reason 'readonly'; value unchanged", async () => {
    const user = userEvent.setup();
    const onPaste = vi.fn();
    const onRowsChange = vi.fn();
    render(
      <GridMaster<Row>
        rows={rows()}
        columns={columns}
        onPaste={onPaste}
        onRowsChange={onRowsChange}
        getCellMeta={(_r, i, key) => (i === 0 && key === "name" ? { readonly: true } : undefined)}
      />
    );

    await user.click(cellByText("Asha"));
    await navigator.clipboard.writeText("PASTED");
    await user.keyboard("{Control>}v{/Control}");

    expect(cellByText("Asha")).toBeTruthy(); // value kept
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(onPaste.mock.calls[0][0].skipped.readonly).toBeGreaterThanOrEqual(1);
    expect(onPaste.mock.calls[0][0].skipped.cells[0]).toMatchObject({ reason: "readonly" });
  });

  it("Delete over a read-only cell leaves it unchanged", async () => {
    const user = userEvent.setup();
    const onRowsChange = vi.fn();
    render(
      <GridMaster<Row>
        rows={rows()}
        columns={columns}
        onRowsChange={onRowsChange}
        getCellMeta={(_r, i, key) => (i === 0 && key === "name" ? { readonly: true } : undefined)}
      />
    );
    await user.click(cellByText("Asha"));
    await user.keyboard("{Delete}");
    expect(cellByText("Asha")).toBeTruthy();
    expect(onRowsChange).not.toHaveBeenCalled();
  });

  it("a read-only checkbox cell cannot be toggled", async () => {
    const user = userEvent.setup();
    const onCellChange = vi.fn();
    render(
      <GridMaster<Row>
        rows={rows()}
        columns={columns}
        onCellChange={onCellChange}
        getCellMeta={(_r, i, key) => (i === 0 && key === "done" ? { readonly: true } : undefined)}
      />
    );
    const box = document.querySelectorAll<HTMLInputElement>("td.gm-td input[type=checkbox]")[0];
    expect(box.disabled).toBe(true);
    await user.click(box);
    expect(onCellChange).not.toHaveBeenCalled();
  });
});

describe("A-084: formatting is still allowed on a read-only cell", () => {
  it("Bold applies to a read-only cell (formatting is a meta write, not a value write)", async () => {
    const user = userEvent.setup();
    const onRowsChange = vi.fn();
    render(
      <GridMaster<Row>
        rows={rows()}
        columns={columns}
        onRowsChange={onRowsChange}
        getCellMeta={(_r, i, key) => (i === 0 && key === "name" ? { readonly: true } : undefined)}
      />
    );
    await user.click(cellByText("Asha"));
    await user.click(screen.getByRole("button", { name: "Bold (Ctrl/Cmd+B)" }));
    expect(cellByText("Asha").style.fontWeight).toBe("700");
    expect(onRowsChange).not.toHaveBeenCalled(); // no VALUE write
  });
});

describe("A-084: the shared predicate and fill skip read-only targets", () => {
  const resolved = resolveColumns(columns);

  it("isCellReadonly is true for column, cell-meta and row-meta readonly", () => {
    expect(isCellReadonly(resolved[0], undefined, undefined)).toBe(false);
    expect(isCellReadonly(resolved[0], { readonly: true }, undefined)).toBe(true);
    expect(isCellReadonly(resolved[0], undefined, { readonly: true })).toBe(true);
    expect(isCellReadonly(resolveColumns([col.text("x", { readonly: true })])[0], undefined, undefined)).toBe(true);
  });

  it("resolveCellReadonly reads getCellMeta / getRowMeta / history cell meta", () => {
    const r = rows()[0];
    expect(
      resolveCellReadonly({ getCellMeta: () => ({ readonly: true }) }, {}, r, 0, resolved[0])
    ).toBe(true);
    expect(
      resolveCellReadonly({ getRowMeta: () => ({ readonly: true }) }, {}, r, 0, resolved[0])
    ).toBe(true);
    expect(resolveCellReadonly({}, { "0::name": { readonly: true } }, r, 0, resolved[0])).toBe(true);
    expect(resolveCellReadonly({}, {}, r, 0, resolved[0])).toBe(false);
  });

  it("fillRangeWithSource skips a target cell flagged read-only by isWritable", () => {
    const src = [
      { id: 1, name: "x", qty: 5, done: false },
      { id: 2, name: "x", qty: 0, done: false },
    ];
    // Fill qty from row0 (5) down into row1, but row1 is read-only → it keeps its 0.
    const result = fillRangeWithSource(
      src,
      resolved,
      { startRow: 0, endRow: 0, startCol: 1, endCol: 1 },
      { startRow: 0, endRow: 1, startCol: 1, endCol: 1 },
      { isWritable: (displayRow) => displayRow !== 1 }
    );
    expect(result.rows[1].qty).toBe(0); // read-only target untouched
    expect(result.rows[0].qty).toBe(5); // source unaffected
  });
});
