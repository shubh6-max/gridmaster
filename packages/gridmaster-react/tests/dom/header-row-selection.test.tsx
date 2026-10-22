// F-008: with a selection kind disabled, a header click is not a dead no-op — it moves the
// active-cell cursor (plain-click behaviour). Row headers with enableRowSelection={false} move the
// cursor to the row's first cell; column headers with enableColumnSelection={false} move it to that
// column. Shift/Ctrl behave like a plain click here. TypeScript 6 (strict), React 19, vitest + jsdom.
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  GridMaster,
  createColumnFactory,
  type GridColumnDef,
  type GridMasterProps,
  type GridSelectionChangeEvent,
} from "../../src/index";

type Row = { id: number; name: string; qty: number; note: string };
const col = createColumnFactory<Row>();
const columns: GridColumnDef<Row>[] = [col.text("name"), col.number("qty"), col.text("note")];
const rows: Row[] = Array.from({ length: 4 }, (_, i) => ({
  id: i + 1,
  name: `Name${i}`,
  qty: (i + 1) * 10,
  note: `note${i}`,
}));

function mount(extra: Partial<GridMasterProps<Row>>) {
  const onSelectionChange = vi.fn();
  const utils = render(
    <GridMaster<Row>
      rows={rows}
      columns={columns}
      showToolbar={false}
      showFormulaBar={false}
      showStatusBar={false}
      onSelectionChange={onSelectionChange}
      {...extra}
    />
  );
  return { ...utils, onSelectionChange };
}

function lastSelection(spy: ReturnType<typeof vi.fn>) {
  const calls = spy.mock.calls;
  return (calls[calls.length - 1][0] as GridSelectionChangeEvent).selection;
}

const rowHeader = (container: HTMLElement, i: number) =>
  container.querySelectorAll<HTMLElement>("tbody td.gm-rh")[i];
const columnHeader = (container: HTMLElement, i: number) =>
  container.querySelectorAll<HTMLElement>("thead th.gm-th:not(.gm-th-spreadsheet)")[i];
const cellAt = (container: HTMLElement, row: number, col: number) =>
  container.querySelectorAll("tbody tr")[row].querySelectorAll<HTMLElement>("td.gm-td")[col];

describe("F-008 row header with enableRowSelection={false}", () => {
  it("plain click moves the cursor to the row's first cell", () => {
    const { container, onSelectionChange } = mount({ enableRowSelection: false });
    fireEvent.click(rowHeader(container, 2));
    const sel = lastSelection(onSelectionChange);
    expect(sel.mode).toBe("cell");
    expect(sel.cursor).toEqual({ row: 2, col: 0 });
  });

  it("Shift+click and Ctrl+click also just move the cursor (never create a row selection)", () => {
    const { container, onSelectionChange } = mount({ enableRowSelection: false });
    fireEvent.click(rowHeader(container, 1), { shiftKey: true });
    expect(lastSelection(onSelectionChange).cursor).toEqual({ row: 1, col: 0 });
    expect(lastSelection(onSelectionChange).mode).toBe("cell");

    fireEvent.click(rowHeader(container, 3), { ctrlKey: true });
    expect(lastSelection(onSelectionChange).cursor).toEqual({ row: 3, col: 0 });
    expect(lastSelection(onSelectionChange).mode).toBe("cell");
  });
});

describe("F-008 column header with enableColumnSelection={false}", () => {
  it("plain click moves the cursor to that column, keeping the current row", () => {
    const { container, onSelectionChange } = mount({ enableColumnSelection: false });
    // Put the cursor on row 2 first.
    fireEvent.pointerDown(cellAt(container, 2, 0), { button: 0 });
    fireEvent.pointerUp(window);

    fireEvent.click(columnHeader(container, 1));
    const sel = lastSelection(onSelectionChange);
    expect(sel.mode).toBe("cell");
    expect(sel.cursor).toEqual({ row: 2, col: 1 });
  });

  it("Shift+click also just moves the cursor (never creates a column selection)", () => {
    const { container, onSelectionChange } = mount({ enableColumnSelection: false });
    fireEvent.click(columnHeader(container, 2), { shiftKey: true });
    const sel = lastSelection(onSelectionChange);
    expect(sel.mode).toBe("cell");
    expect(sel.cursor?.col).toBe(2);
  });
});
