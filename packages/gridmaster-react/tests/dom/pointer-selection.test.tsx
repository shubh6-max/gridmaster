// A-077: pointer-based selection. Right-click keeps a range it lands inside (moves otherwise);
// press-drag selects via Pointer Events (mouse/touch/pen) with edge auto-scroll; Shift/Ctrl+click are
// unchanged; a tap selects; pointercancel ends a drag; no window/document listeners leak on unmount.
// Language: TypeScript 6 (strict), React 19, vitest + jsdom + @testing-library.
import { act, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GridMaster,
  createColumnFactory,
  type GridColumnDef,
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

function mount() {
  const onSelectionChange = vi.fn();
  const utils = render(
    <GridMaster<Row>
      rows={rows}
      columns={columns}
      showToolbar={false}
      showFormulaBar={false}
      showStatusBar={false}
      onSelectionChange={onSelectionChange}
    />
  );
  return { ...utils, onSelectionChange };
}

function lastSelection(spy: ReturnType<typeof vi.fn>) {
  const calls = spy.mock.calls;
  return (calls[calls.length - 1][0] as GridSelectionChangeEvent).selection;
}

function cellAt(container: HTMLElement, row: number, col: number): HTMLElement {
  const tr = container.querySelectorAll("tbody tr")[row];
  return tr.querySelectorAll<HTMLElement>("td.gm-td")[col];
}

function viewportOf(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>(".gm-viewport") as HTMLElement;
}

describe("A-077 right-click and a range", () => {
  it("right-click INSIDE a range keeps the range (it is not collapsed)", () => {
    const { container, onSelectionChange } = mount();
    // Drag-select (0,0) -> (1,1).
    fireEvent.pointerDown(cellAt(container, 0, 0), { button: 0 });
    fireEvent.pointerEnter(cellAt(container, 1, 1));
    fireEvent.pointerUp(window);
    expect(lastSelection(onSelectionChange).mode).toBe("range");

    // Right-click a cell inside the range: selection must be preserved.
    fireEvent.contextMenu(cellAt(container, 0, 1));
    const sel = lastSelection(onSelectionChange);
    expect(sel.mode).toBe("range");
    expect(sel.range?.start).toEqual({ row: 0, col: 0 });
    expect(sel.range?.end).toEqual({ row: 1, col: 1 });
  });

  it("right-click OUTSIDE a range moves the active cell to the clicked cell", () => {
    const { container, onSelectionChange } = mount();
    fireEvent.pointerDown(cellAt(container, 0, 0), { button: 0 });
    fireEvent.pointerEnter(cellAt(container, 1, 1));
    fireEvent.pointerUp(window);

    fireEvent.contextMenu(cellAt(container, 3, 2));
    const sel = lastSelection(onSelectionChange);
    expect(sel.mode).toBe("cell");
    expect(sel.cursor).toEqual({ row: 3, col: 2 });
  });
});

describe("A-077 pointer drag selects a range", () => {
  it("pointerdown + pointerenter across cells + pointerup forms a range", () => {
    const { container, onSelectionChange } = mount();
    fireEvent.pointerDown(cellAt(container, 0, 0), { button: 0 });
    fireEvent.pointerEnter(cellAt(container, 2, 1));
    fireEvent.pointerUp(window);

    const sel = lastSelection(onSelectionChange);
    expect(sel.mode).toBe("range");
    expect(sel.anchor).toEqual({ row: 0, col: 0 });
    expect(sel.cursor).toEqual({ row: 2, col: 1 });
  });

  it("pointercancel ends the drag: a later pointerenter does not extend", () => {
    const { container, onSelectionChange } = mount();
    fireEvent.pointerDown(cellAt(container, 0, 0), { button: 0 });
    fireEvent.pointerEnter(cellAt(container, 1, 1));
    fireEvent.pointerCancel(window);

    const afterCancel = lastSelection(onSelectionChange);
    fireEvent.pointerEnter(cellAt(container, 3, 2)); // drag is over: must be ignored
    expect(lastSelection(onSelectionChange)).toEqual(afterCancel);
  });

  it("a non-primary (right) button press never starts a drag selection", () => {
    const { container, onSelectionChange } = mount();
    fireEvent.pointerDown(cellAt(container, 1, 1), { button: 2 });
    fireEvent.pointerEnter(cellAt(container, 2, 2));
    fireEvent.pointerUp(window);
    // No selection beyond the mount default was created by the right button.
    expect(lastSelection(onSelectionChange).mode).not.toBe("range");
  });
});

describe("A-077 edge auto-scroll", () => {
  const rafMap = new Map<number, FrameRequestCallback>();
  let nextRaf = 1;

  afterEach(() => {
    rafMap.clear();
    nextRaf = 1;
  });

  function flushRaf() {
    const entries = [...rafMap.entries()];
    rafMap.clear();
    for (const [, cb] of entries) cb(16);
  }

  it("a drag near the bottom edge scrolls the viewport, and stops on pointerup", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      const id = nextRaf++;
      rafMap.set(id, cb);
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      rafMap.delete(id as number);
    });

    const { container } = mount();
    const viewport = viewportOf(container);
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 200,
      left: 0,
      right: 200,
      width: 200,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    // Begin a drag, then move the pointer within 24px of the bottom edge.
    fireEvent.pointerDown(cellAt(container, 0, 0), { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 195 });

    expect(viewport.scrollTop).toBe(0);
    flushRaf();
    const scrolledOnce = viewport.scrollTop;
    expect(scrolledOnce).toBeGreaterThan(0);
    flushRaf();
    expect(viewport.scrollTop).toBeGreaterThan(scrolledOnce);

    // Pointer up stops the loop: no further scheduled frames run.
    fireEvent.pointerUp(window);
    const frozen = viewport.scrollTop;
    flushRaf();
    expect(viewport.scrollTop).toBe(frozen);
  });
});

describe("A-077 Shift/Ctrl click and touch are unchanged", () => {
  it("Shift+click extends a range from the anchor", async () => {
    const user = userEvent.setup();
    const { container, onSelectionChange } = mount();
    await user.click(cellAt(container, 0, 0));
    await user.keyboard("{Shift>}");
    await user.click(cellAt(container, 2, 0));
    await user.keyboard("{/Shift}");
    const sel = lastSelection(onSelectionChange);
    expect(sel.mode).toBe("range");
    expect(sel.cursor).toEqual({ row: 2, col: 0 });
  });

  it("Ctrl+click on a cell moves the active cell (no multi-range), as before", async () => {
    const user = userEvent.setup();
    const { container, onSelectionChange } = mount();
    await user.click(cellAt(container, 0, 0));
    await user.keyboard("{Control>}");
    await user.click(cellAt(container, 2, 1));
    await user.keyboard("{/Control}");
    const sel = lastSelection(onSelectionChange);
    expect(sel.mode).toBe("cell");
    expect(sel.cursor).toEqual({ row: 2, col: 1 });
  });

  it("a touch tap selects the tapped cell", () => {
    const { container, onSelectionChange } = mount();
    const target = cellAt(container, 1, 2);
    fireEvent.pointerDown(target, { button: 0, pointerType: "touch" });
    fireEvent.pointerUp(window);
    const sel = lastSelection(onSelectionChange);
    expect(sel.cursor).toEqual({ row: 1, col: 2 });
  });
});

describe("A-077 listeners do not leak", () => {
  it("window pointerup/pointercancel add/remove balance across mount and unmount", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const count = (spy: ReturnType<typeof vi.spyOn>, type: string) =>
      spy.mock.calls.filter((c: unknown[]) => c[0] === type).length;

    const { container, unmount } = mount();
    // Start and end a drag so the document pointermove listener is attached and detached too.
    const docRemove = vi.spyOn(document, "removeEventListener");
    fireEvent.pointerDown(cellAt(container, 0, 0), { button: 0 });
    fireEvent.pointerUp(window);
    expect(docRemove.mock.calls.some((c) => c[0] === "pointermove")).toBe(true);

    unmount();
    act(() => {});
    expect(count(add, "pointerup")).toBe(count(remove, "pointerup"));
    expect(count(add, "pointercancel")).toBe(count(remove, "pointercancel"));
  });
});
