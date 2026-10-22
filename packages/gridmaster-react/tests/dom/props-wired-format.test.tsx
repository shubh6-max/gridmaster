// A-004 (Task 1.1c), formatting half: enableCellColoring, enableWrapText and enableValidation were
// accepted but ignored. Inventory + before/after table: see the header of props-wired.test.tsx.
//
// Semantics chosen here (conservative reading of the README/props, which have no JSDoc):
//   enableCellColoring=false -> the Fill and Font-colour controls are disabled, the colour API does not
//     write meta, and the format painter keeps each target cell's existing fill (it does not copy
//     or clear colours). Other formatting (bold, alignment, ...) is unaffected.
//   enableWrapText=false -> the Wrap control is disabled, the API does not write wrap meta, and the
//     format painter keeps each target's existing wrap setting.
//   enableValidation=false -> column validators are not run (no error indicator, validate() never
//     called). The default stays on: validators always ran before this change.
// Language: TypeScript 6 (strict), React 19, vitest + jsdom.
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createColumnFactory,
  createInitialHistoryState,
  createInitialSelectionState,
  resolveColumns,
  setActiveCell,
  useCellFormatting,
  type GridCellMeta,
} from "../../src/index";
import {
  BOLD_BUTTON,
  FILL_COLOR_BUTTON,
  FONT_COLOR_BUTTON,
  FORMAT_PAINTER_BUTTON,
  WRAP_BUTTON,
  cellOf,
  clickCell,
  columns,
  isAccessiblyDisabled,
  isEnabled,
  mountGrid,
  rows,
  toolbarButton,
  type Row,
} from "./propsWiredHarness";

const SEEDED: Record<string, GridCellMeta> = {
  "0::name": { backgroundColor: "#ff0000", wrap: true, wrapText: true },
};
// jsdom normalises #ff0000 to rgb() when it is assigned through element.style.
const RED = "rgb(255, 0, 0)";

/** Click Asha, arm the painter, paint Ben, then move away so Ben shows its real (non-active) style. */
async function paintAshaOntoBen(user: ReturnType<typeof mountGrid>["user"]) {
  await clickCell(user, "Asha");
  await user.click(toolbarButton(FORMAT_PAINTER_BUTTON));
  await clickCell(user, "Ben");
  await clickCell(user, "Cara");
}

describe("enableCellColoring={false}", () => {
  it("Fill and Font-colour controls are accessibly disabled, open no menu, and write nothing; Bold still works", async () => {
    const { user, spies } = mountGrid({ enableCellColoring: false });
    await clickCell(user, "Asha");

    for (const name of [FILL_COLOR_BUTTON, FONT_COLOR_BUTTON]) {
      const button = toolbarButton(name);
      expect(isAccessiblyDisabled(button), `${name} must be disabled`).toBe(true);
      await user.click(button);
    }
    expect(document.querySelector("[data-gm-color-menu]")).toBeNull();

    expect(isEnabled(toolbarButton(BOLD_BUTTON))).toBe(true);
    await user.click(toolbarButton(BOLD_BUTTON));
    expect(cellOf("Asha").style.fontWeight).toBe("700");
    expect(spies.onRowsChange).not.toHaveBeenCalled();
  });

  it("the format painter does not copy the source fill onto the target", async () => {
    const { user } = mountGrid({ enableCellColoring: false, initialCellMeta: SEEDED });
    await paintAshaOntoBen(user);
    expect(cellOf("Ben").style.background).not.toContain(RED);
  });

  it("control (default): the colour menu opens and applies a fill; the painter copies the fill", async () => {
    const first = mountGrid();
    await clickCell(first.user, "Asha");
    expect(isEnabled(toolbarButton(FILL_COLOR_BUTTON))).toBe(true);
    await first.user.click(toolbarButton(FILL_COLOR_BUTTON));
    const swatch = document.querySelector<HTMLElement>("[data-gm-color-menu] button[title=Yellow]");
    expect(swatch).not.toBeNull();
    await first.user.click(swatch as HTMLElement);
    await clickCell(first.user, "Cara");
    expect(cellOf("Asha").style.background).toContain("rgb(254, 240, 138)");
    first.unmount();

    const second = mountGrid({ initialCellMeta: SEEDED });
    await paintAshaOntoBen(second.user);
    expect(cellOf("Ben").style.background).toContain(RED);
  });
});

describe("enableWrapText={false}", () => {
  it("the Wrap control is accessibly disabled and wraps nothing; alignment still works", async () => {
    const { user } = mountGrid({ enableWrapText: false });
    await clickCell(user, "Asha");
    const wrap = toolbarButton(WRAP_BUTTON);
    expect(isAccessiblyDisabled(wrap)).toBe(true);
    await user.click(wrap);
    expect(cellOf("Asha").classList.contains("gm-wrap")).toBe(false);
    expect(isEnabled(toolbarButton("Align Center"))).toBe(true);
  });

  it("the format painter does not copy the source's wrap onto the target", async () => {
    const { user } = mountGrid({ enableWrapText: false, initialCellMeta: SEEDED });
    await paintAshaOntoBen(user);
    expect(cellOf("Ben").classList.contains("gm-wrap")).toBe(false);
  });

  it("control (default): Wrap toggles wrapping; the painter copies it", async () => {
    const first = mountGrid();
    await clickCell(first.user, "Asha");
    await first.user.click(toolbarButton(WRAP_BUTTON));
    expect(cellOf("Asha").classList.contains("gm-wrap")).toBe(true);
    first.unmount();

    const second = mountGrid({ initialCellMeta: SEEDED });
    await paintAshaOntoBen(second.user);
    expect(cellOf("Ben").classList.contains("gm-wrap")).toBe(true);
  });
});

describe("useCellFormatting write sink (independent of toolbar gating)", () => {
  type FormattingParams = Parameters<typeof useCellFormatting<Row>>[0];

  function mountFormatting(extra: Partial<FormattingParams>) {
    const resolved = resolveColumns(columns);
    const setHistory = vi.fn();
    const hook = renderHook(() =>
      useCellFormatting<Row>({
        history: createInitialHistoryState({ rows, columns, cellMeta: {}, rowMeta: {} }),
        setHistory,
        selection: setActiveCell(createInitialSelectionState(), { row: 0, col: 0 }),
        displayRows: rows,
        displayRowIndexes: [0, 1, 2],
        visibleColumns: resolved,
        focusViewport: () => {},
        ...extra,
      })
    );
    return { hook, setHistory };
  }

  it("canFormat=false: every formatting call is a no-op returning false", () => {
    const m = mountFormatting({ canFormat: false });
    expect(m.hook.result.current.toggleBold()).toBe(false);
    expect(m.hook.result.current.applyFillColor("#ff0000")).toBe(false);
    expect(m.hook.result.current.toggleWrapText()).toBe(false);
    expect(m.hook.result.current.increaseIndent()).toBe(false);
    expect(m.setHistory).not.toHaveBeenCalled();
  });

  it("enableCellColoring=false blocks fill and font colour only", () => {
    const m = mountFormatting({ enableCellColoring: false });
    expect(m.hook.result.current.applyFillColor("#ff0000")).toBe(false);
    expect(m.hook.result.current.applyTextColor("#ff0000")).toBe(false);
    expect(m.setHistory).not.toHaveBeenCalled();
    expect(m.hook.result.current.toggleBold()).toBe(true);
    expect(m.setHistory).toHaveBeenCalledTimes(1);
  });

  it("enableWrapText=false blocks wrap only", () => {
    const m = mountFormatting({ enableWrapText: false });
    expect(m.hook.result.current.toggleWrapText()).toBe(false);
    expect(m.setHistory).not.toHaveBeenCalled();
    expect(m.hook.result.current.toggleBold()).toBe(true);
  });

  it("control: defaults format", () => {
    const m = mountFormatting({});
    expect(m.hook.result.current.applyFillColor("#ff0000")).toBe(true);
    expect(m.hook.result.current.toggleWrapText()).toBe(true);
    expect(m.setHistory).toHaveBeenCalledTimes(2);
  });
});

describe("enableValidation", () => {
  const col = createColumnFactory<Row>();
  const makeColumns = (validate: (value: unknown) => string | null) => [
    col.text("name", { validate }),
    col.number("qty"),
    col.checkbox("done"),
  ];
  const noAsha = (value: unknown) => (value === "Asha" ? "Asha is not allowed" : null);

  it("enableValidation={false}: validators are never run and no error indicator renders", () => {
    const validate = vi.fn(noAsha);
    const { container } = mountGrid({ columns: makeColumns(validate), enableValidation: false });
    expect(validate).not.toHaveBeenCalled();
    expect(container.querySelector(".gm-cell-error-indicator")).toBeNull();
    expect(container.querySelector(".is-invalid")).toBeNull();
  });

  it("control (default, and explicit true): the validator runs and flags the invalid cell", () => {
    for (const extra of [{}, { enableValidation: true }]) {
      const validate = vi.fn(noAsha);
      const view = mountGrid({ columns: makeColumns(validate), ...extra });
      expect(validate).toHaveBeenCalled();
      expect(view.container.querySelectorAll(".gm-cell-error-indicator")).toHaveLength(1);
      expect(view.container.querySelectorAll(".is-invalid")).toHaveLength(1);
      view.unmount();
    }
  });

  // A-061: `column.validations` runs through the same render-time error path as `column.validate`.
  const validationsColumns = (validator: (value: unknown) => string | null) => [
    col.text("name", { validations: [{ type: "custom", validator }] }),
    col.number("qty"),
    col.checkbox("done"),
  ];

  it("column.validations flags the invalid cell (same path as column.validate)", () => {
    const view = mountGrid({ columns: validationsColumns(noAsha) });
    expect(view.container.querySelectorAll(".gm-cell-error-indicator")).toHaveLength(1);
    expect(view.container.querySelectorAll(".is-invalid")).toHaveLength(1);
    view.unmount();
  });

  it("enableValidation={false}: column.validations is not evaluated", () => {
    const { container } = mountGrid({
      columns: validationsColumns(() => "always"),
      enableValidation: false,
    });
    expect(container.querySelector(".gm-cell-error-indicator")).toBeNull();
    expect(container.querySelector(".is-invalid")).toBeNull();
  });
});
