// A-004 (Task 1.1c): public props that were accepted but ignored must be consumed, and read-only
// mode must not be bypassable. Language: TypeScript 6 (strict), React 19, vitest + jsdom.
//
// Split: this file = mode / enableEditing / enableClipboard / fill handle / write sinks.
//        props-wired-selection.test.tsx = enableSelection, enable{Range,Row,Column}Selection.
//        props-wired-format.test.tsx    = enableCellColoring, enableWrapText, enableValidation.
//
// ---------------------------------------------------------------------------------------------
// INVENTORY (verified by grep + reading, not taken from the audit). BEFORE -> AFTER.
//   WORKS = consumed and observable; PARTIAL = consumed on some paths only; IGNORED = no effect.
//
//   prop                      before    why (evidence)                                      after
//   mode="readonly"           PARTIAL   keyboard + startEditing + GridCell guarded; fill     WORKS
//                                       handle, toolbar Paste/Cut/format/colour/wrap, painter,
//                                       context-menu items, undo after a mode flip, moveRow/
//                                       moveColumn/updateColumns were not
//   enableEditing             PARTIAL   resolved in useGridMaster but absent from context;   WORKS
//                                       GridViewport passed `mode !== "readonly"`; startEditing,
//                                       GridCell (dbl-click, checkbox), FormulaBar, fill handle,
//                                       toolbar Paste/Cut ignored it
//   enableClipboard           IGNORED   GridViewport hard-coded `enableClipboard: true`;     WORKS
//                                       toolbar Copy/Paste/Cut unconditional
//   enableFillHandle          PARTIAL   only the raw prop gated it (readonly still filled)   WORKS
//   enableUndoRedo            WORKS     keyboard hook; (readonly + history from a mode flip  WORKS
//                                       could still undo)
//   enableSelection           IGNORED   never read anywhere outside useGridMaster            WORKS
//   enableRangeSelection      IGNORED   GridBody/GridHeader hard-coded `true`; keyboard      WORKS
//                                       (Shift+arrows, Ctrl+A, Ctrl+Shift+arrows), select-all,
//                                       fill/painter range creation ignored it
//   enableRowSelection        IGNORED   hard-coded `true` (row-header click, Ctrl+Shift+      WORKS
//                                       Left/Right, row context menu)
//   enableColumnSelection     IGNORED   hard-coded `true` (column-header click, Ctrl+Shift+  WORKS
//                                       Up/Down, column context menu)
//   enableCellColoring        IGNORED   Fill / Font-colour buttons + painter always applied  WORKS
//   enableWrapText            IGNORED   Wrap button + painter always applied                 WORKS
//   enableValidation          IGNORED   default `?? false` and never read; validateCell     WORKS
//                                       always ran in GridCell (default now `true`: unchanged)
//   enableInsertRow/Column,   PARTIAL   sinks guarded, but readonly still opened the         WORKS
//   enableDeleteRow/Column              context menu with dead items
//   enableRowDrag/ColumnDrag  PARTIAL   handlers consume the flag, there is NO UI (A-054,    sink only
//                                       out of scope); readonly did not block the handlers   (readonly)
//   enableSorting/Filtering/ColumnResize/AutoFit/ColumnVisibility, showToolbar/FormulaBar/
//   StatusBar, virtualizeRows, frozenColumns                                  WORKS, untouched
//   enableConditionalFormatting, initialConditionalFormats, onConditionalFormatsChange
//                             IGNORED   feature not rendered (A-016 / Task 1.4): report only
//   onValidationChange        IGNORED   never called: report only
//   onCopy / onPaste          IGNORED   never called (payload contract undefined): report only
// ---------------------------------------------------------------------------------------------
import { act, fireEvent, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  createInitialSelectionState,
  resolveColumns,
  setActiveCell,
  useClipboard,
  useGridMaster,
} from "../../src/index";
import {
  BOLD_BUTTON,
  COPY_BUTTON,
  CUT_BUTTON,
  FILL_COLOR_BUTTON,
  FONT_COLOR_BUTTON,
  FORMAT_PAINTER_BUTTON,
  PASTE_BUTTON,
  WRAP_BUTTON,
  bodyTexts,
  cellOf,
  clickCell,
  columnHeaderAt,
  columns,
  hasCellEditor,
  isAccessiblyDisabled,
  isEnabled,
  mountGrid,
  rows,
  shellOf,
  toolbarButton,
  type Row,
} from "./propsWiredHarness";

const NOTHING_FIRED = (spies: ReturnType<typeof mountGrid>["spies"]) => {
  expect(spies.onRowsChange).not.toHaveBeenCalled();
  expect(spies.onCellChange).not.toHaveBeenCalled();
};

async function editAshaTo(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.dblClick(shellOf("Asha"));
  await user.keyboard(`{Control>}a{/Control}${value}{Enter}`);
}

describe("mode=readonly: nothing mutates, from any path", () => {
  it("keyboard: type-to-edit, F2, Delete, Backspace, Ctrl+V, Ctrl+X, Ctrl+B are all inert", async () => {
    const { user, spies, container } = mountGrid({ mode: "readonly" });
    await navigator.clipboard.writeText("PASTED");
    await clickCell(user, "Asha");
    const before = bodyTexts(container);

    await user.keyboard("Z");
    await user.keyboard("{F2}");
    await user.keyboard("{Delete}{Backspace}");
    await user.keyboard("{Control>}v{/Control}");
    await user.keyboard("{Control>}x{/Control}");
    await user.keyboard("{Control>}b{/Control}");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(hasCellEditor(container)).toBe(false);
    expect(bodyTexts(container)).toEqual(before);
    expect(cellOf("Asha").style.fontWeight).toBe("");
    NOTHING_FIRED(spies);
  });

  it("double-click does not open an editor", async () => {
    const { user, spies, container } = mountGrid({ mode: "readonly" });
    await user.dblClick(shellOf("Asha"));
    expect(hasCellEditor(container)).toBe(false);
    NOTHING_FIRED(spies);
  });

  it("keyboard: Ctrl+Alt+C / Ctrl+Alt+V (format painter) cannot paint a format", async () => {
    const { user, spies } = mountGrid({
      mode: "readonly",
      initialCellMeta: { "0::name": { backgroundColor: "#ff0000" } },
    });
    await clickCell(user, "Asha");
    await user.keyboard("{Control>}{Alt>}c{/Alt}{/Control}");
    await clickCell(user, "Ben");
    await user.keyboard("{Control>}{Alt>}v{/Alt}{/Control}");
    await clickCell(user, "Cara");

    expect(cellOf("Ben").style.background).not.toContain("rgb(255, 0, 0)");
    expect(cellOf("Ben").style.background).not.toContain("#ff0000");
    NOTHING_FIRED(spies);
  });

  it("toolbar: Paste, Cut, Format Painter and every formatting control are accessibly disabled and inert", async () => {
    const { user, spies, container } = mountGrid({ mode: "readonly" });
    await navigator.clipboard.writeText("PASTED");
    await clickCell(user, "Asha");
    const before = bodyTexts(container);

    const mutating = [
      PASTE_BUTTON,
      CUT_BUTTON,
      FORMAT_PAINTER_BUTTON,
      BOLD_BUTTON,
      FILL_COLOR_BUTTON,
      FONT_COLOR_BUTTON,
      WRAP_BUTTON,
      "Increase Indent",
      "Align Center",
    ];
    for (const name of mutating) {
      const button = toolbarButton(name);
      expect(isAccessiblyDisabled(button), `${name} must be disabled`).toBe(true);
      await user.click(button);
    }
    for (const name of [
      "Apply font family to the current selection",
      "Apply font size to the current selection",
      "Change text orientation",
    ]) {
      expect((screen.getByRole("combobox", { name }) as HTMLSelectElement).disabled).toBe(true);
    }
    // Copy is read-only-safe and stays available (readonly preset: "clipboard copy only").
    expect(isEnabled(toolbarButton(COPY_BUTTON))).toBe(true);

    expect(bodyTexts(container)).toEqual(before);
    expect(cellOf("Asha").style.fontWeight).toBe("");
    expect(document.querySelector(".gm-color-menu")).toBeNull();
    NOTHING_FIRED(spies);
  });

  it("fill handle is not offered (and a fill drag cannot start)", async () => {
    const { user, spies, container } = mountGrid({ mode: "readonly" });
    await clickCell(user, "Asha");
    expect(container.querySelector(".gm-fill-handle")).toBeNull();
    NOTHING_FIRED(spies);
  });

  it("context menu does not offer insert/delete (cell, row header, column header)", async () => {
    const { user, container } = mountGrid({ mode: "readonly" });
    await clickCell(user, "Asha");
    fireEvent.contextMenu(cellOf("Asha"));
    fireEvent.contextMenu(container.querySelector("tbody td.gm-rh") as HTMLElement);
    fireEvent.contextMenu(columnHeaderAt(container, 0));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.querySelector("[data-gm-context-menu]")).toBeNull();
  });

  it("undo cannot revert data after the host flips editable -> readonly", async () => {
    const { user, spies, ui, rerender, container } = mountGrid();
    await editAshaTo(user, "Zed");
    expect(bodyTexts(container)).toContain("Zed");
    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);

    rerender(ui({ mode: "readonly" }));
    await clickCell(user, "Zed");
    await user.keyboard("{Control>}z{/Control}");

    expect(bodyTexts(container)).toContain("Zed");
    expect(bodyTexts(container)).not.toContain("Asha");
    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
  });

  it("control: the same edit works in the default (editable) mode and Ctrl+Z reverts it", async () => {
    const { user, spies, container } = mountGrid();
    await editAshaTo(user, "Zed");
    expect(bodyTexts(container)).toContain("Zed");
    expect(spies.onCellChange).toHaveBeenCalledTimes(1);

    await clickCell(user, "Zed");
    await user.keyboard("{Control>}z{/Control}");
    expect(bodyTexts(container)).toContain("Asha");
  });
});

describe("mode=readonly: shared write sinks (useGridMaster) block programmatic bypasses", () => {
  function mountHook(mode: "readonly" | "editable") {
    const onRowsChange = vi.fn();
    const onColumnsChange = vi.fn();
    const onCellChange = vi.fn();
    const onRowReorder = vi.fn();
    const onColumnReorder = vi.fn();
    const hook = renderHook(() =>
      useGridMaster<Row>({
        rows,
        columns,
        mode,
        enableRowDrag: true,
        enableColumnDrag: true,
        onRowsChange,
        onColumnsChange,
        onCellChange,
        onRowReorder,
        onColumnReorder,
      })
    );
    return { hook, onRowsChange, onColumnsChange, onCellChange, onRowReorder, onColumnReorder };
  }

  it("updateRows / updateColumns / moveRow / moveColumn / emitCellChange do nothing", () => {
    const m = mountHook("readonly");
    const edited = rows.map((row, i) => (i === 0 ? { ...row, name: "Zed" } : row));

    act(() => {
      m.hook.result.current.updateRows(edited);
      m.hook.result.current.updateColumns([columns[1], columns[0], columns[2]]);
      m.hook.result.current.moveRow(0, 2);
      m.hook.result.current.moveColumn("name", "done");
      m.hook.result.current.emitCellChange({
        rowIndex: 0,
        columnIndex: 0,
        columnKey: "name",
        row: edited[0],
        previousValue: "Asha",
        value: "Zed",
      });
    });

    expect(m.hook.result.current.rows.map((r) => r.name)).toEqual(["Asha", "Ben", "Cara"]);
    expect(m.hook.result.current.rawColumns.map((c) => c.key)).toEqual(["name", "qty", "done"]);
    expect(m.onRowsChange).not.toHaveBeenCalled();
    expect(m.onColumnsChange).not.toHaveBeenCalled();
    expect(m.onCellChange).not.toHaveBeenCalled();
    expect(m.onRowReorder).not.toHaveBeenCalled();
    expect(m.onColumnReorder).not.toHaveBeenCalled();
  });

  it("control: the same calls work in editable mode", () => {
    const m = mountHook("editable");
    const edited = rows.map((row, i) => (i === 0 ? { ...row, name: "Zed" } : row));

    act(() => {
      m.hook.result.current.updateRows(edited);
    });
    expect(m.hook.result.current.rows[0].name).toBe("Zed");
    expect(m.onRowsChange).toHaveBeenCalledTimes(1);

    act(() => {
      m.hook.result.current.moveRow(0, 2);
      m.hook.result.current.moveColumn("name", "done");
    });
    expect(m.onRowReorder).toHaveBeenCalledTimes(1);
    expect(m.onColumnReorder).toHaveBeenCalledTimes(1);
  });

  it("enableEditing={false} blocks updateRows even in editable mode", () => {
    const onRowsChange = vi.fn();
    const hook = renderHook(() =>
      useGridMaster<Row>({ rows, columns, enableEditing: false, onRowsChange })
    );
    act(() => hook.result.current.updateRows(rows.map((r) => ({ ...r, name: "X" }))));
    expect(hook.result.current.rows[0].name).toBe("Asha");
    expect(onRowsChange).not.toHaveBeenCalled();
  });
});

describe("enableEditing={false} in editable mode", () => {
  it("double-click, F2 and type-to-edit do not open an editor", async () => {
    const { user, spies, container } = mountGrid({ enableEditing: false });
    await user.dblClick(shellOf("Asha"));
    expect(hasCellEditor(container)).toBe(false);
    await user.keyboard("{F2}");
    expect(hasCellEditor(container)).toBe(false);
    await user.keyboard("Z");
    expect(hasCellEditor(container)).toBe(false);
    NOTHING_FIRED(spies);
  });

  it("Delete/Backspace, Ctrl+V and Ctrl+X do not write values", async () => {
    const { user, spies, container } = mountGrid({ enableEditing: false });
    await navigator.clipboard.writeText("PASTED");
    await clickCell(user, "Asha");
    const before = bodyTexts(container);

    await user.keyboard("{Delete}{Backspace}");
    await user.keyboard("{Control>}v{/Control}");
    await user.keyboard("{Control>}x{/Control}");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(bodyTexts(container)).toEqual(before);
    NOTHING_FIRED(spies);
  });

  it("toolbar Paste and Cut are disabled; Copy and formatting stay available", async () => {
    const { user, spies, container } = mountGrid({ enableEditing: false });
    await navigator.clipboard.writeText("PASTED");
    await clickCell(user, "Asha");
    const before = bodyTexts(container);

    for (const name of [PASTE_BUTTON, CUT_BUTTON]) {
      const button = toolbarButton(name);
      expect(isAccessiblyDisabled(button), `${name} must be disabled`).toBe(true);
      await user.click(button);
    }
    expect(isEnabled(toolbarButton(COPY_BUTTON))).toBe(true);
    expect(isEnabled(toolbarButton(BOLD_BUTTON))).toBe(true);
    expect(bodyTexts(container)).toEqual(before);
    NOTHING_FIRED(spies);
  });

  it("formatting is not a value edit: Bold still applies", async () => {
    const { user } = mountGrid({ enableEditing: false });
    await clickCell(user, "Asha");
    await user.click(toolbarButton(BOLD_BUTTON));
    expect(cellOf("Asha").style.fontWeight).toBe("700");
  });

  it("fill handle is not offered", async () => {
    const { user, container } = mountGrid({ enableEditing: false });
    await clickCell(user, "Asha");
    expect(container.querySelector(".gm-fill-handle")).toBeNull();
  });

  it("formula bar is read-only and checkboxes are disabled (no write path left)", async () => {
    const { user, spies, container } = mountGrid({ enableEditing: false });
    await clickCell(user, "Asha");
    const formulaBar = container.querySelector<HTMLTextAreaElement>(".gm-formula-bar textarea");
    expect(formulaBar?.readOnly).toBe(true);
    const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>("input[type=checkbox]"));
    expect(checkboxes.length).toBe(rows.length);
    expect(checkboxes.every((box) => box.disabled)).toBe(true);
    for (const box of checkboxes) await user.click(box);
    NOTHING_FIRED(spies);
  });

  it("control (default): double-click edits, Enter commits, onCellChange fires, fill handle and toolbar are live", async () => {
    const { user, spies, container } = mountGrid();
    await clickCell(user, "Asha");
    expect(container.querySelector(".gm-fill-handle")).not.toBeNull();
    expect(isEnabled(toolbarButton(PASTE_BUTTON))).toBe(true);
    expect(isEnabled(toolbarButton(CUT_BUTTON))).toBe(true);

    await editAshaTo(user, "Zed");
    expect(bodyTexts(container)).toContain("Zed");
    expect(spies.onCellChange).toHaveBeenCalledTimes(1);
    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
  });

  it("control: type-to-edit opens the editor in the default mode", async () => {
    const { user, container } = mountGrid();
    await clickCell(user, "Asha");
    await user.keyboard("Q");
    expect(hasCellEditor(container)).toBe(true);
  });
});

describe("enableClipboard={false}", () => {
  it("Ctrl+C, Ctrl+X and Ctrl+V do nothing (system clipboard and cells untouched)", async () => {
    const { user, spies, container } = mountGrid({ enableClipboard: false });
    await navigator.clipboard.writeText("SEED");
    await clickCell(user, "Asha");
    const before = bodyTexts(container);

    await user.keyboard("{Control>}c{/Control}");
    await user.keyboard("{Control>}x{/Control}");
    await user.keyboard("{Control>}v{/Control}");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(await navigator.clipboard.readText()).toBe("SEED");
    expect(bodyTexts(container)).toEqual(before);
    NOTHING_FIRED(spies);
  });

  it("toolbar Copy, Paste and Cut are accessibly disabled and inert", async () => {
    const { user, spies, container } = mountGrid({ enableClipboard: false });
    await navigator.clipboard.writeText("SEED");
    await clickCell(user, "Asha");
    const before = bodyTexts(container);

    for (const name of [COPY_BUTTON, PASTE_BUTTON, CUT_BUTTON]) {
      const button = toolbarButton(name);
      expect(isAccessiblyDisabled(button), `${name} must be disabled`).toBe(true);
      await user.click(button);
    }

    expect(await navigator.clipboard.readText()).toBe("SEED");
    expect(bodyTexts(container)).toEqual(before);
    NOTHING_FIRED(spies);
  });

  it("control (default): Ctrl+C writes the cell, Ctrl+V pastes it, toolbar buttons are live", async () => {
    const { user, spies, container } = mountGrid();
    await navigator.clipboard.writeText("SEED");
    await clickCell(user, "Asha");
    expect(isEnabled(toolbarButton(COPY_BUTTON))).toBe(true);

    await user.keyboard("{Control>}c{/Control}");
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe("Asha"));
    await clickCell(user, "Ben");
    await user.keyboard("{Control>}v{/Control}");

    await waitFor(() => expect(bodyTexts(container).filter((t) => t === "Asha")).toHaveLength(2));
    expect(spies.onRowsChange).toHaveBeenCalledTimes(1);
  });
});

describe("useClipboard write sinks (independent of any UI gating)", () => {
  type ClipboardParams = Parameters<typeof useClipboard<Row>>[0];

  function mountClipboard(extra: Partial<ClipboardParams>) {
    const resolved = resolveColumns(columns);
    const updateRows = vi.fn();
    const setClipboard = vi.fn();
    const hook = renderHook(() =>
      useClipboard<Row>({
        rows,
        displayRows: rows,
        displayRowIndexes: [0, 1, 2],
        columns: resolved,
        selection: setActiveCell(createInitialSelectionState(), { row: 0, col: 0 }),
        clipboard: null,
        setClipboard,
        updateRows,
        ...extra,
      })
    );
    return { hook, updateRows, setClipboard };
  }

  it("enableClipboard=false: copy, cut and paste are no-ops", async () => {
    userEvent.setup();
    await navigator.clipboard.writeText("SEED");
    const m = mountClipboard({ enableClipboard: false });
    await act(async () => {
      await m.hook.result.current.copy();
      await m.hook.result.current.cut();
      await m.hook.result.current.paste();
    });
    expect(m.setClipboard).not.toHaveBeenCalled();
    expect(m.updateRows).not.toHaveBeenCalled();
    expect(await navigator.clipboard.readText()).toBe("SEED");
  });

  it("enableEditing=false: cut, paste and clearSelection write nothing; copy still works", async () => {
    userEvent.setup();
    await navigator.clipboard.writeText("PASTED");
    const m = mountClipboard({ enableEditing: false });
    await act(async () => {
      await m.hook.result.current.paste();
      await m.hook.result.current.cut();
      m.hook.result.current.clearSelection();
    });
    expect(m.updateRows).not.toHaveBeenCalled();
    expect(m.setClipboard).not.toHaveBeenCalled();

    await act(async () => {
      await m.hook.result.current.copy();
    });
    expect(m.setClipboard).toHaveBeenCalledTimes(1);
  });

  it("control: defaults paste and clear through updateRows", async () => {
    userEvent.setup();
    await navigator.clipboard.writeText("PASTED");
    const m = mountClipboard({});
    await act(async () => {
      await m.hook.result.current.paste();
    });
    expect(m.updateRows).toHaveBeenCalledTimes(1);
    act(() => m.hook.result.current.clearSelection());
    expect(m.updateRows).toHaveBeenCalledTimes(2);
  });
});
