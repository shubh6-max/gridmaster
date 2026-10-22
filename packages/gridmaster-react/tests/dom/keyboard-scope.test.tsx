// A-013: the keydown handler is scoped to THIS grid's viewport. It must not trap Tab, must not
// hijack keys from toolbar/menu/formula-bar/header controls, must not leak across grids, must honour
// `tabNavigation`, must ignore IME composition, and must wire PageUp/Down, Ctrl+Home/End, Ctrl+Arrow
// and Home/End. Language: TypeScript 6 (strict), React 19, vitest + jsdom + @testing-library.
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Name${i}`,
    qty: (i + 1) * 10,
    note: `note${i}`,
  }));
}

/** Last selection the grid emitted (keyboard nav flows through onSelectionChange). */
function cursorOf(spy: ReturnType<typeof vi.fn>) {
  const calls = spy.mock.calls;
  return (calls[calls.length - 1][0] as GridSelectionChangeEvent).selection;
}

function nonNullCursor(spy: ReturnType<typeof vi.fn>) {
  const c = cursorOf(spy).cursor;
  if (!c) throw new Error("expected a cursor");
  return c;
}

function renderGrid(extra: Partial<GridMasterProps<Row>> = {}, rowCount = 1) {
  const onSelectionChange = vi.fn();
  const utils = render(
    <div>
      <GridMaster<Row>
        rows={makeRows(rowCount)}
        columns={columns}
        showToolbar={false}
        showFormulaBar={false}
        showStatusBar={false}
        onSelectionChange={onSelectionChange}
        {...extra}
      />
      <button type="button" data-testid="after">
        after
      </button>
    </div>
  );
  return { ...utils, onSelectionChange };
}

function activeCellText(container: HTMLElement): string | null {
  return container.querySelector<HTMLElement>(".gm-td.gm-active")?.textContent ?? null;
}

function hasCellEditor(container: HTMLElement): boolean {
  return (
    container.querySelector("td.gm-td input:not([type=checkbox]), td.gm-td textarea") !== null
  );
}

describe("A-013 Tab is not a keyboard trap", () => {
  it("Tab at the LAST cell is not intercepted, so focus can leave the grid", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({}, 1); // 1 row x 3 cols: note is the last cell
    await user.click(screen.getByText("note0"));
    expect(activeCellText(container)).toBe("note0");

    const viewport = container.querySelector<HTMLElement>(".gm-viewport") as HTMLElement;
    // fireEvent returns false iff a handler called preventDefault. At the last cell the grid must
    // NOT preventDefault, so the browser's native Tab (focus leaves the grid) proceeds (WCAG 2.1.2).
    const notPrevented = fireEvent.keyDown(viewport, { key: "Tab" });
    expect(notPrevented).toBe(true);
    expect(activeCellText(container)).toBe("note0"); // cursor did not advance
  });

  it("Shift+Tab at the FIRST cell is not intercepted either", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({}, 1);
    await user.click(screen.getByText("Name0")); // first cell
    expect(activeCellText(container)).toBe("Name0");

    const viewport = container.querySelector<HTMLElement>(".gm-viewport") as HTMLElement;
    const notPrevented = fireEvent.keyDown(viewport, { key: "Tab", shiftKey: true });
    expect(notPrevented).toBe(true);
    expect(activeCellText(container)).toBe("Name0"); // cursor did not retreat
  });

  it('Tab between non-edge cells moves the cursor (default "cells")', async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({}, 1);
    await user.click(screen.getByText("Name0"));
    await user.keyboard("{Tab}");
    expect(activeCellText(container)).toBe("10"); // moved name -> qty
  });

  it('tabNavigation="native" never intercepts Tab, even between cells', async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({ tabNavigation: "native" }, 1);
    await user.click(screen.getByText("Name0")); // first cell, a non-edge move under "cells"
    const viewport = container.querySelector<HTMLElement>(".gm-viewport") as HTMLElement;
    const notPrevented = fireEvent.keyDown(viewport, { key: "Tab" });
    // Never intercepted: default proceeds and the cursor stays put.
    expect(notPrevented).toBe(true);
    expect(activeCellText(container)).toBe("Name0");
  });
});

describe("A-013 keys outside the viewport are not hijacked", () => {
  it("Enter / Space / Delete / typing on a control outside the viewport are ignored", async () => {
    const user = userEvent.setup();
    const onCellChange = vi.fn();
    const { container } = render(
      <div>
        <button type="button" data-testid="outside">
          outside
        </button>
        <GridMaster<Row>
          rows={makeRows(1)}
          columns={columns}
          showToolbar={false}
          showFormulaBar={false}
          showStatusBar={false}
          onCellChange={onCellChange}
        />
      </div>
    );
    await user.click(screen.getByText("10")); // cursor on qty
    screen.getByTestId("outside").focus();

    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.keyboard("{Delete}{Backspace}");
    await user.keyboard("Z");

    expect(hasCellEditor(container)).toBe(false);
    expect(onCellChange).not.toHaveBeenCalled();
    // The value is untouched.
    expect(within(container).getByText("10")).toBeTruthy();
  });

  it("arrows in the formula-bar textarea are not stolen by the grid", async () => {
    const user = userEvent.setup();
    const { container, onSelectionChange } = renderGrid({ showFormulaBar: true }, 3);
    // The formula bar echoes the active value, so "Name0" appears twice; click the body cell.
    const bodyCell = screen
      .getAllByText("Name0")
      .find((el) => el.closest("td.gm-td")) as HTMLElement;
    await user.click(bodyCell);
    const before = cursorOf(onSelectionChange).cursor;

    const formulaInput = container.querySelector<HTMLElement>(
      ".gm-formula-bar textarea, .gm-formula-bar input"
    );
    expect(formulaInput).toBeTruthy();
    formulaInput?.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");

    expect(cursorOf(onSelectionChange).cursor).toEqual(before);
  });
});

describe("A-013 two grids are isolated", () => {
  it("keys in grid B do not move grid A; Ctrl+C in A does not copy B", async () => {
    const user = userEvent.setup();
    const aSel = vi.fn();
    const aCopy = vi.fn();
    const bCopy = vi.fn();
    render(
      <div>
        <div data-testid="gridA">
          <GridMaster<Row>
            rows={makeRows(5)}
            columns={columns}
            showToolbar={false}
            showFormulaBar={false}
            showStatusBar={false}
            onSelectionChange={aSel}
            onCopy={aCopy}
          />
        </div>
        <div data-testid="gridB">
          <GridMaster<Row>
            rows={makeRows(5)}
            columns={columns}
            showToolbar={false}
            showFormulaBar={false}
            showStatusBar={false}
            onCopy={bCopy}
          />
        </div>
      </div>
    );

    const gridA = screen.getByTestId("gridA");
    // Put grid A's cursor somewhere known.
    await user.click(within(gridA).getByText("Name0"));
    const aCursorBefore = cursorOf(aSel).cursor;

    // Act inside grid B.
    const gridB = screen.getByTestId("gridB");
    await user.click(within(gridB).getAllByText("Name0")[0]);
    await user.keyboard("{ArrowDown}{ArrowDown}");

    // Grid A's cursor is unchanged.
    expect(cursorOf(aSel).cursor).toEqual(aCursorBefore);

    // Copy while grid A is focused must not reach grid B.
    await user.click(within(gridA).getByText("Name0"));
    await user.keyboard("{Control>}c{/Control}");
    expect(bCopy).not.toHaveBeenCalled();
  });

  it("typing while focus is outside any grid does nothing", async () => {
    const user = userEvent.setup();
    const onCellChange = vi.fn();
    const { container } = render(
      <div>
        <GridMaster<Row>
          rows={makeRows(1)}
          columns={columns}
          showToolbar={false}
          showFormulaBar={false}
          showStatusBar={false}
          onCellChange={onCellChange}
        />
        <button type="button" data-testid="outside">
          outside
        </button>
      </div>
    );
    screen.getByTestId("outside").focus();
    await user.keyboard("Q{Enter}{Delete}");
    expect(hasCellEditor(container)).toBe(false);
    expect(onCellChange).not.toHaveBeenCalled();
  });
});

describe("A-013 IME composition is ignored", () => {
  it("a composing keydown does not start an edit", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({}, 1);
    await user.click(screen.getByText("Name0"));
    const viewport = container.querySelector<HTMLElement>(".gm-viewport");
    expect(viewport).toBeTruthy();

    fireEvent.keyDown(viewport as HTMLElement, { key: "a", isComposing: true });
    fireEvent.keyDown(viewport as HTMLElement, { key: "b", keyCode: 229 });
    expect(hasCellEditor(container)).toBe(false);
  });
});

describe("A-013 focused-grid shortcuts still work", () => {
  it("Ctrl+Z undoes an edit in the focused grid", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid({}, 2);
    await user.click(screen.getByText("Name0"));
    await user.keyboard("X{Enter}"); // type-to-edit "X", commit
    expect(within(container).queryByText("Name0")).toBeNull();

    await user.keyboard("{Control>}z{/Control}");
    expect(within(container).getByText("Name0")).toBeTruthy();
  });
});

describe("A-013 listeners do not leak on document/window", () => {
  it("no net growth of document/window keydown listeners across mount, re-render, unmount", () => {
    const docAdd = vi.spyOn(document, "addEventListener");
    const docRemove = vi.spyOn(document, "removeEventListener");
    const winAdd = vi.spyOn(window, "addEventListener");
    const winRemove = vi.spyOn(window, "removeEventListener");

    const countKeydown = (spy: ReturnType<typeof vi.fn>) =>
      spy.mock.calls.filter((c) => c[0] === "keydown").length;

    const { rerender, unmount } = render(
      <GridMaster<Row> rows={makeRows(3)} columns={columns} />
    );
    rerender(<GridMaster<Row> rows={makeRows(4)} columns={columns} />);
    unmount();

    expect(countKeydown(docAdd)).toBe(countKeydown(docRemove));
    expect(countKeydown(winAdd)).toBe(countKeydown(winRemove));
    // The grid no longer attaches a document-level keydown listener at all.
    expect(countKeydown(docAdd)).toBe(0);

    docAdd.mockRestore();
    docRemove.mockRestore();
    winAdd.mockRestore();
    winRemove.mockRestore();
  });
});

describe.each([
  ["not virtualized", false],
  ["virtualized", true],
])("A-013 navigation key wiring (%s)", (_label, virtualizeRows) => {
  async function setup() {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const { container } = render(
      <GridMaster<Row>
        rows={makeRows(20)}
        columns={columns}
        virtualizeRows={virtualizeRows}
        showToolbar={false}
        showFormulaBar={false}
        showStatusBar={false}
        onSelectionChange={onSelectionChange}
      />
    );
    await user.click(within(container).getAllByText("Name0")[0]); // cursor at (0,0)
    return { user, onSelectionChange };
  }

  it("Ctrl+End to last cell, Ctrl+Home back to A1", async () => {
    const { user, onSelectionChange } = await setup();
    await user.keyboard("{Control>}{End}{/Control}");
    expect(cursorOf(onSelectionChange).cursor).toEqual({ row: 19, col: 2 });
    await user.keyboard("{Control>}{Home}{/Control}");
    expect(cursorOf(onSelectionChange).cursor).toEqual({ row: 0, col: 0 });
  });

  it("End/Home move to row edges", async () => {
    const { user, onSelectionChange } = await setup();
    await user.keyboard("{End}");
    expect(cursorOf(onSelectionChange).cursor).toEqual({ row: 0, col: 2 });
    await user.keyboard("{Home}");
    expect(cursorOf(onSelectionChange).cursor).toEqual({ row: 0, col: 0 });
  });

  it("PageDown then PageUp move by a page (fallback page size)", async () => {
    const { user, onSelectionChange } = await setup();
    await user.keyboard("{PageDown}");
    const afterDown = nonNullCursor(onSelectionChange);
    expect(afterDown.row).toBeGreaterThan(0);
    await user.keyboard("{PageUp}");
    expect(nonNullCursor(onSelectionChange).row).toBeLessThan(afterDown.row);
  });

  it("Ctrl+ArrowDown jumps to the last filled cell of the column", async () => {
    const { user, onSelectionChange } = await setup();
    await user.keyboard("{Control>}{ArrowDown}{/Control}");
    expect(nonNullCursor(onSelectionChange).row).toBe(19);
  });

  it("Shift+ArrowDown extends the range instead of moving a plain cursor", async () => {
    const { user, onSelectionChange } = await setup();
    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
    const sel = cursorOf(onSelectionChange);
    expect(sel.mode).toBe("range");
    expect(sel.cursor).toEqual({ row: 2, col: 0 });
    expect(sel.anchor).toEqual({ row: 0, col: 0 });
  });
});
