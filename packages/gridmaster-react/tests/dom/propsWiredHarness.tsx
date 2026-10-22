// Shared helpers for the A-004 "props are wired" suites (props-wired*.test.tsx). Not a test file.
// Language: TypeScript 6 (strict), React 19, vitest + jsdom + @testing-library.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, type Mock } from "vitest";
import {
  GridMaster,
  createColumnFactory,
  type GridColumnDef,
  type GridMasterProps,
  type GridSelectionChangeEvent,
} from "../../src/index";

export type Row = { id: number; name: string; qty: number; done: boolean };
export type User = ReturnType<typeof userEvent.setup>;

const col = createColumnFactory<Row>();

// Module-level and referentially stable on purpose (identity is not what these suites test).
export const columns: GridColumnDef<Row>[] = [
  col.text("name"),
  col.number("qty"),
  col.checkbox("done"),
];

export const rows: Row[] = [
  { id: 1, name: "Asha", qty: 10, done: false },
  { id: 2, name: "Ben", qty: 20, done: false },
  { id: 3, name: "Cara", qty: 30, done: false },
];

export type Spies = {
  onRowsChange: Mock;
  onCellChange: Mock;
  onSelectionChange: Mock;
};

export function mountGrid(extra: Partial<GridMasterProps<Row>> = {}) {
  const user = userEvent.setup();
  const spies: Spies = {
    onRowsChange: vi.fn(),
    onCellChange: vi.fn(),
    onSelectionChange: vi.fn(),
  };
  const ui = (props: Partial<GridMasterProps<Row>>) => (
    <GridMaster<Row> rows={rows} columns={columns} {...props} {...spies} />
  );
  const utils = render(ui(extra));
  return { user, spies, ui, ...utils };
}

/** The body cell (td.gm-td) whose rendered text is exactly `text`. */
export function cellOf(text: string): HTMLElement {
  const hit = screen.getAllByText(text).find((el) => el.closest("td.gm-td"));
  const td = hit?.closest<HTMLElement>("td.gm-td");
  if (!td) throw new Error(`no body cell with text "${text}"`);
  return td;
}

/** The element that receives double-click-to-edit (the cell shell inside the td). */
export function shellOf(text: string): HTMLElement {
  const shell = cellOf(text).querySelector<HTMLElement>(".gm-cell-shell");
  if (!shell) throw new Error(`no cell shell in "${text}"`);
  return shell;
}

/** Main column header (th) by zero-based visible index; the spreadsheet letter row is excluded. */
export function columnHeaderAt(container: HTMLElement, index: number): HTMLElement {
  return container.querySelectorAll<HTMLElement>("thead th.gm-th:not(.gm-th-spreadsheet)")[index];
}

/** Spreadsheet letter header (A, B, C...) by zero-based visible index. */
export function letterHeaderAt(container: HTMLElement, index: number): HTMLElement {
  return container.querySelectorAll<HTMLElement>("thead th.gm-th-spreadsheet")[index];
}

export async function clickCell(user: User, text: string) {
  await user.click(cellOf(text));
}

/** Text of every body cell, in DOM order: the "DOM value is unchanged" oracle. */
export function bodyTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("td.gm-td")).map((td) => td.textContent ?? "");
}

/** Cell editors render an input or textarea inside a body cell; checkboxes are not editors. */
export function hasCellEditor(container: HTMLElement): boolean {
  return container.querySelector("td.gm-td input:not([type=checkbox]), td.gm-td textarea") !== null;
}

export function toolbarButton(name: string): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

/** Accessible-disabled: the native flag AND aria-disabled, so assistive tech and tests agree. */
export function isAccessiblyDisabled(el: HTMLElement): boolean {
  return (el as HTMLButtonElement).disabled && el.getAttribute("aria-disabled") === "true";
}

export function isEnabled(el: HTMLElement): boolean {
  return !(el as HTMLButtonElement).disabled && el.getAttribute("aria-disabled") !== "true";
}

/** Every selection kind the grid emitted via onSelectionChange (including on mount). */
export function selectionModes(spy: Mock): Set<string> {
  return new Set(
    spy.mock.calls.map((call) => (call[0] as GridSelectionChangeEvent).selection.mode)
  );
}

export function lastSelection(spy: Mock) {
  const calls = spy.mock.calls;
  return (calls[calls.length - 1][0] as GridSelectionChangeEvent).selection;
}

export const PASTE_BUTTON = "Paste into the current selection";
export const COPY_BUTTON = "Copy selected cells";
export const CUT_BUTTON = "Cut selected cells";
export const FORMAT_PAINTER_BUTTON =
  "Click to paint formatting once. Double-click to keep painting until Esc.";
export const BOLD_BUTTON = "Bold (Ctrl/Cmd+B)";
export const FILL_COLOR_BUTTON = "Apply fill color";
export const FONT_COLOR_BUTTON = "Apply font color";
export const WRAP_BUTTON = "Wrap Text";
