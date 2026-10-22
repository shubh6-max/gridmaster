// Task 7B — item 7 (6A carry): the number editor parses with the configured `locale`, and refuses
// to silently destroy data on unparsable input. Non-blank text a strict parse rejects keeps the
// editor OPEN with an error state (aria-invalid); Escape cancels; blur with bad input CANCELS
// (restores the stored value). Language: TS 6 strict, React 19, vitest + jsdom.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GridMaster, createColumnFactory, type GridColumnDef } from "../../src/index";

type Row = { id: number; qty: number };
const col = createColumnFactory<Row>();
const columns: GridColumnDef<Row>[] = [col.number("qty")];
const makeRows = (): Row[] => [{ id: 1, qty: 10 }];

function qtyCell(): HTMLElement {
  const hit = screen.getAllByText("10").find((el) => el.closest("td.gm-td"));
  const shell = hit?.closest("td.gm-td")?.querySelector<HTMLElement>(".gm-cell-shell");
  if (!shell) throw new Error("no qty cell");
  return shell;
}
const numberInput = () =>
  document.querySelector<HTMLInputElement>("td.gm-td input[inputmode=decimal]");

describe("item 7: locale-aware number parsing on commit", () => {
  it("de-DE: committing '1.234,56' stores 1234.56", async () => {
    const user = userEvent.setup();
    const onCellChange = vi.fn();
    render(
      <GridMaster<Row> rows={makeRows()} columns={columns} locale="de-DE" onCellChange={onCellChange} />
    );

    await user.dblClick(qtyCell());
    await user.keyboard("{Control>}a{/Control}1.234,56{Enter}");

    expect(onCellChange).toHaveBeenCalledTimes(1);
    expect(onCellChange.mock.calls[0][0].value).toBe(1234.56);
  });
});

describe("item 7: unparsable input does not destroy data", () => {
  it("typing 'abc' keeps the editor open with aria-invalid and commits nothing on Enter", async () => {
    const user = userEvent.setup();
    const onCellChange = vi.fn();
    render(<GridMaster<Row> rows={makeRows()} columns={columns} onCellChange={onCellChange} />);

    await user.dblClick(qtyCell());
    await user.keyboard("{Control>}a{/Control}abc");
    const input = numberInput();
    expect(input).not.toBeNull();
    expect(input?.getAttribute("aria-invalid")).toBe("true");

    await user.keyboard("{Enter}");
    // Editor still open, nothing committed (the value was NOT overwritten with null).
    expect(numberInput()).not.toBeNull();
    expect(onCellChange).not.toHaveBeenCalled();
  });

  it("Escape cancels and restores the stored value", async () => {
    const user = userEvent.setup();
    const onCellChange = vi.fn();
    render(<GridMaster<Row> rows={makeRows()} columns={columns} onCellChange={onCellChange} />);

    await user.dblClick(qtyCell());
    await user.keyboard("{Control>}a{/Control}abc{Escape}");

    expect(numberInput()).toBeNull(); // editor closed
    expect(onCellChange).not.toHaveBeenCalled();
    expect(qtyCell().textContent).toContain("10"); // original value restored
  });

  it("blur with unparsable input cancels (restores) rather than committing null", async () => {
    const user = userEvent.setup();
    const onCellChange = vi.fn();
    const onRowsChange = vi.fn();
    render(
      <GridMaster<Row>
        rows={makeRows()}
        columns={columns}
        onCellChange={onCellChange}
        onRowsChange={onRowsChange}
      />
    );

    await user.dblClick(qtyCell());
    await user.keyboard("{Control>}a{/Control}abc");
    // Blur the editor by clicking outside it (onto the row header).
    const rowHeader = document.querySelector<HTMLElement>("td.gm-rh");
    await user.click(rowHeader as HTMLElement);

    expect(onCellChange).not.toHaveBeenCalled();
    expect(onRowsChange).not.toHaveBeenCalled();
    expect(qtyCell().textContent).toContain("10"); // data intact
  });
});
