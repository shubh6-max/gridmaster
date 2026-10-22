// A-081: column resize and the fill handle are pointer-driven (mouse/touch/pen). Resize emits
// onColumnResize ONCE with the final width and only on a real change; a press-release emits nothing;
// the click after a resize does not select the column; fill-drag fills; the disable flags still block;
// a mid-drag unmount leaves no window listeners. TypeScript 6 (strict), React 19, vitest + jsdom.
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GridMaster,
  createColumnFactory,
  type GridColumnDef,
  type GridColumnResizeEvent,
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

function mount(extra: Partial<GridMasterProps<Row>> = {}) {
  const onColumnResize = vi.fn();
  const onRowsChange = vi.fn();
  const onSelectionChange = vi.fn();
  const utils = render(
    <GridMaster<Row>
      rows={rows}
      columns={columns}
      showToolbar={false}
      showFormulaBar={false}
      showStatusBar={false}
      onColumnResize={onColumnResize}
      onRowsChange={onRowsChange}
      onSelectionChange={onSelectionChange}
      {...extra}
    />
  );
  return { ...utils, onColumnResize, onRowsChange, onSelectionChange };
}

const resizeHandle = (container: HTMLElement) =>
  container.querySelectorAll<HTMLElement>(".gm-resize-handle")[0];
const mainHeaderTh = (container: HTMLElement) =>
  container.querySelectorAll<HTMLElement>("thead th.gm-th:not(.gm-th-spreadsheet)")[0];
const fillHandle = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(".gm-fill-handle");
const cellAt = (container: HTMLElement, row: number, col: number) =>
  container.querySelectorAll("tbody tr")[row].querySelectorAll<HTMLElement>("td.gm-td")[col];

function lastSelection(spy: ReturnType<typeof vi.fn>) {
  const calls = spy.mock.calls;
  return (calls[calls.length - 1][0] as GridSelectionChangeEvent).selection;
}

describe("A-081 column resize via pointer events", () => {
  it("a drag changes the width and fires onColumnResize once with the final width", () => {
    const { container, onColumnResize } = mount();
    const handle = resizeHandle(container);
    expect(handle).toBeTruthy();

    fireEvent.pointerDown(handle, { button: 0, clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 130 });
    fireEvent.pointerMove(window, { clientX: 150 }); // net +50 from the start
    fireEvent.pointerUp(window);

    expect(onColumnResize).toHaveBeenCalledTimes(1);
    const event = onColumnResize.mock.calls[0][0] as GridColumnResizeEvent<Row>;
    expect(event.width).toBe((event.column.width ?? 0) + 50);
  });

  it("a press-release with NO movement fires nothing", () => {
    const { container, onColumnResize } = mount();
    fireEvent.pointerDown(resizeHandle(container), { button: 0, clientX: 100 });
    fireEvent.pointerUp(window);
    expect(onColumnResize).not.toHaveBeenCalled();
  });

  it("the click after a resize does not select the column", () => {
    const { container, onSelectionChange } = mount();
    const before = lastSelection(onSelectionChange);

    fireEvent.pointerDown(resizeHandle(container), { button: 0, clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 150 });
    fireEvent.pointerUp(window);
    // pointerup is followed by a synthetic click on the header; it must be swallowed.
    fireEvent.click(mainHeaderTh(container));

    expect(lastSelection(onSelectionChange).mode).not.toBe("column");
    expect(lastSelection(onSelectionChange)).toEqual(before);
  });

  it("a genuine header click after the suppressed one still selects the column", () => {
    const { container, onSelectionChange } = mount();
    fireEvent.pointerDown(resizeHandle(container), { button: 0, clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 150 });
    fireEvent.pointerUp(window);
    fireEvent.click(mainHeaderTh(container)); // suppressed
    fireEvent.click(mainHeaderTh(container)); // genuine
    expect(lastSelection(onSelectionChange).mode).toBe("column");
  });

  it("enableColumnResize={false} renders no resize handle", () => {
    const { container } = mount({ enableColumnResize: false });
    expect(resizeHandle(container)).toBeUndefined();
  });
});

describe("A-081 fill handle via pointer events", () => {
  function selectCell(container: HTMLElement, row: number, col: number) {
    fireEvent.pointerDown(cellAt(container, row, col), { button: 0 });
    fireEvent.pointerUp(window);
  }

  it("a pointer drag from the fill handle fills the dragged cells", () => {
    const { container, onRowsChange } = mount();
    selectCell(container, 0, 0);
    const handle = fillHandle(container);
    expect(handle).toBeTruthy();

    fireEvent.pointerDown(handle as HTMLElement, { button: 0 });
    fireEvent.pointerEnter(cellAt(container, 2, 0));
    fireEvent.pointerUp(window);

    expect(onRowsChange).toHaveBeenCalledTimes(1);
    const next = onRowsChange.mock.calls[0][0] as Row[];
    expect(next[1].name).toBe("Name0");
    expect(next[2].name).toBe("Name0");
  });

  it("enableFillHandle={false} renders no fill handle and fills nothing", () => {
    const { container, onRowsChange } = mount({ enableFillHandle: false });
    selectCell(container, 0, 0);
    expect(fillHandle(container)).toBeNull();
    expect(onRowsChange).not.toHaveBeenCalled();
  });

  it("mode='readonly' renders no fill handle", () => {
    const { container } = mount({ mode: "readonly" });
    selectCell(container, 0, 0);
    expect(fillHandle(container)).toBeNull();
  });
});

describe("A-081 mid-drag unmount leaves no window listeners", () => {
  afterEach(() => vi.restoreAllMocks());

  it("unmounting during a resize drag removes the pointer listeners", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const count = (spy: ReturnType<typeof vi.spyOn>, type: string) =>
      spy.mock.calls.filter((c: unknown[]) => c[0] === type).length;

    const { container, unmount } = mount();
    fireEvent.pointerDown(resizeHandle(container), { button: 0, clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 140 }); // drag in progress
    unmount();

    for (const type of ["pointermove", "pointerup", "pointercancel"]) {
      expect(count(add, type), type).toBe(count(remove, type));
    }
  });
});
