// A-004 (Task 1.1c), selection half: enableSelection, enableRangeSelection, enableRowSelection and
// enableColumnSelection were accepted but ignored (GridBody/GridHeader hard-coded `true`).
// Inventory + before/after table: see the header of props-wired.test.tsx.
// Oracle: every selection the grid emits through onSelectionChange (`selection.mode`); the active
// cell cursor must keep working under every restriction. Language: TypeScript 6 (strict), React 19.
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FORMAT_PAINTER_BUTTON,
  cellOf,
  clickCell,
  columnHeaderAt,
  lastSelection,
  letterHeaderAt,
  mountGrid,
  selectionModes,
  shellOf,
  toolbarButton,
  type User,
} from "./propsWiredHarness";

const rowHeader = (container: HTMLElement, index: number) =>
  container.querySelectorAll<HTMLElement>("tbody td.gm-rh")[index];
const cornerHeader = () => screen.getByText("#").closest("th") as HTMLElement;
const KEY_CTRL_SHIFT = (arrow: string) => `{Control>}{Shift>}{${arrow}}{/Shift}{/Control}`;

async function shiftClick(user: User, text: string) {
  await user.keyboard("{Shift>}");
  await user.click(cellOf(text));
  await user.keyboard("{/Shift}");
}

function dragCells(from: string, to: string) {
  // Selection drag is pointer-based (A-077): mouse, touch and pen all flow through pointer events.
  fireEvent.pointerDown(cellOf(from), { button: 0 });
  fireEvent.pointerEnter(cellOf(to));
  fireEvent.pointerUp(window);
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

describe("enableSelection={false}: no selection kind beyond the active cell", () => {
  it("click, shift+click, drag, headers, corner, Ctrl+A and axis shortcuts never leave 'cell'", async () => {
    const { user, spies, container } = mountGrid({ enableSelection: false });

    await clickCell(user, "Asha");
    await shiftClick(user, "Cara");
    dragCells("Asha", "Cara");
    await user.click(rowHeader(container, 1));
    await user.click(columnHeaderAt(container, 0));
    await user.click(letterHeaderAt(container, 0));
    await user.click(cornerHeader());
    await user.keyboard("{Control>}a{/Control}");
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    await user.keyboard(KEY_CTRL_SHIFT("ArrowRight"));
    await user.keyboard(KEY_CTRL_SHIFT("ArrowDown"));
    await settle();

    expect([...selectionModes(spies.onSelectionChange)]).toEqual(["cell"]);
  });

  it("the active-cell cursor still works: click and arrow keys move it", async () => {
    const { user, spies } = mountGrid({ enableSelection: false });
    await clickCell(user, "Ben");
    expect(lastSelection(spies.onSelectionChange).cursor).toEqual({ row: 1, col: 0 });
    await user.keyboard("{ArrowDown}");
    expect(lastSelection(spies.onSelectionChange).cursor).toEqual({ row: 2, col: 0 });
    await user.keyboard("{ArrowRight}");
    expect(lastSelection(spies.onSelectionChange).cursor).toEqual({ row: 2, col: 1 });
  });

  it("restrictions do not stop editing (selection is not editing)", async () => {
    const { user, spies } = mountGrid({ enableSelection: false });
    await user.dblClick(shellOf("Asha"));
    await user.keyboard("{Control>}a{/Control}Zed{Enter}");
    expect(spies.onCellChange).toHaveBeenCalledTimes(1);
  });
});

describe("enableRangeSelection={false}: no range / select-all, rows and columns still select", () => {
  it("shift+click, drag, shift+arrows, Ctrl+A and the corner never create 'range' or 'all'", async () => {
    const { user, spies } = mountGrid({ enableRangeSelection: false });

    await clickCell(user, "Asha");
    await shiftClick(user, "Cara");
    dragCells("Asha", "Cara");
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    await user.keyboard("{Shift>}{End}{/Shift}");
    await user.keyboard("{Control>}a{/Control}");
    await user.click(cornerHeader());
    await settle();

    const modes = selectionModes(spies.onSelectionChange);
    expect(modes.has("range")).toBe(false);
    expect(modes.has("all")).toBe(false);
    expect(modes.has("cell")).toBe(true);
  });

  it("the cursor still follows Shift+Arrow as a plain move", async () => {
    const { user, spies } = mountGrid({ enableRangeSelection: false });
    await clickCell(user, "Asha");
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(lastSelection(spies.onSelectionChange).cursor).toEqual({ row: 1, col: 0 });
    expect(lastSelection(spies.onSelectionChange).mode).toBe("cell");
  });

  it("a fill drag does not turn the selection into a range", async () => {
    const { user, spies, container } = mountGrid({ enableRangeSelection: false });
    await clickCell(user, "Asha");
    const handle = container.querySelector<HTMLElement>(".gm-fill-handle");
    expect(handle).not.toBeNull();
    fireEvent.pointerDown(handle as HTMLElement, { button: 0 });
    fireEvent.pointerEnter(cellOf("Cara"));
    fireEvent.pointerUp(window);
    await settle();

    expect(spies.onRowsChange).toHaveBeenCalledTimes(1); // the fill itself still works
    expect(selectionModes(spies.onSelectionChange).has("range")).toBe(false);
  });

  it("a multi-cell format-painter paste does not create a range", async () => {
    const { user, spies, container } = mountGrid({ enableRangeSelection: false });
    await user.click(rowHeader(container, 0)); // row selection stays available
    await user.click(toolbarButton(FORMAT_PAINTER_BUTTON));
    await clickCell(user, "Ben"); // paints a 1x3 pattern -> multi-cell bounds
    await settle();

    expect(selectionModes(spies.onSelectionChange).has("range")).toBe(false);
  });

  it("control: row and column header clicks still select rows and columns", async () => {
    const { user, spies, container } = mountGrid({ enableRangeSelection: false });
    await user.click(rowHeader(container, 1));
    expect(lastSelection(spies.onSelectionChange).mode).toBe("row");
    await user.click(columnHeaderAt(container, 0));
    expect(lastSelection(spies.onSelectionChange).mode).toBe("column");
  });
});

describe("enableRowSelection={false}: rows cannot be selected", () => {
  it("row-header click, row context menu and Ctrl+Shift+Left/Right never create 'row'", async () => {
    const { user, spies, container } = mountGrid({ enableRowSelection: false });

    await user.click(rowHeader(container, 1));
    await clickCell(user, "Asha");
    await user.keyboard(KEY_CTRL_SHIFT("ArrowRight"));
    await user.keyboard(KEY_CTRL_SHIFT("ArrowLeft"));
    fireEvent.contextMenu(rowHeader(container, 1));
    await settle();

    expect(selectionModes(spies.onSelectionChange).has("row")).toBe(false);
  });

  it("control: columns and ranges still select", async () => {
    const { user, spies, container } = mountGrid({ enableRowSelection: false });
    await user.click(columnHeaderAt(container, 0));
    expect(lastSelection(spies.onSelectionChange).mode).toBe("column");
    await clickCell(user, "Asha");
    await shiftClick(user, "Cara");
    expect(lastSelection(spies.onSelectionChange).mode).toBe("range");
  });
});

describe("enableColumnSelection={false}: columns cannot be selected", () => {
  it("column-header click (both header rows), column context menu and Ctrl+Shift+Up/Down never create 'column'", async () => {
    const { user, spies, container } = mountGrid({ enableColumnSelection: false });

    await user.click(columnHeaderAt(container, 0));
    await user.click(letterHeaderAt(container, 0));
    await clickCell(user, "Asha");
    await user.keyboard(KEY_CTRL_SHIFT("ArrowDown"));
    await user.keyboard(KEY_CTRL_SHIFT("ArrowUp"));
    fireEvent.contextMenu(columnHeaderAt(container, 0));
    await settle();

    expect(selectionModes(spies.onSelectionChange).has("column")).toBe(false);
  });

  it("control: rows and ranges still select", async () => {
    const { user, spies, container } = mountGrid({ enableColumnSelection: false });
    await user.click(rowHeader(container, 1));
    expect(lastSelection(spies.onSelectionChange).mode).toBe("row");
    await clickCell(user, "Asha");
    await shiftClick(user, "Cara");
    expect(lastSelection(spies.onSelectionChange).mode).toBe("range");
  });
});

describe("defaults: every selection kind is reachable (no behaviour change)", () => {
  it("row, column, range and all can all be created", async () => {
    const { user, spies, container } = mountGrid();

    await user.click(rowHeader(container, 1));
    await user.click(columnHeaderAt(container, 0));
    await clickCell(user, "Asha");
    await shiftClick(user, "Cara");
    await user.click(cornerHeader());
    await settle();

    const modes = selectionModes(spies.onSelectionChange);
    for (const kind of ["cell", "row", "column", "range", "all"]) {
      expect(modes.has(kind), `${kind} must be reachable by default`).toBe(true);
    }
  });

  it("keyboard shortcuts still work by default: Ctrl+A and Ctrl+Shift+Arrow", async () => {
    const { user, spies } = mountGrid();
    await clickCell(user, "Asha");
    await user.keyboard("{Control>}a{/Control}");
    expect(lastSelection(spies.onSelectionChange).mode).toBe("all");
    await clickCell(user, "Asha");
    await user.keyboard(KEY_CTRL_SHIFT("ArrowRight"));
    expect(lastSelection(spies.onSelectionChange).mode).toBe("row");
    await clickCell(user, "Asha");
    await user.keyboard(KEY_CTRL_SHIFT("ArrowDown"));
    expect(lastSelection(spies.onSelectionChange).mode).toBe("column");
  });
});
