// Task 7A: clipboard hook (useClipboard). Audit A-011, A-056, A-057, A-058, A-065 + F-007.
// Language: TypeScript 6 (strict), React 19, vitest + jsdom. The hook is mounted directly with
// renderHook so each clipboard path is exercised without full-grid keyboard plumbing; the
// updateRows / setClipboard sinks and the on* callbacks are spies. `navigator.clipboard` is a
// per-test controllable stub so permission-denied and stale-clipboard paths are deterministic.
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createColumnFactory,
  createFormulaEvaluator,
  createInitialSelectionState,
  resolveColumns,
  selectAllCells,
  selectSingleRow,
  setActiveCell,
  setRangeSelection,
  useClipboard,
  type GridClipboardData,
} from "../../src/index";

type R = { a: string; b: string; c: string };
const col = createColumnFactory<R>();
const baseColumns = resolveColumns([col.text("a"), col.text("b"), col.text("c")]);
const baseRows = (): R[] => [
  { a: "a1", b: "b1", c: "c1" },
  { a: "a2", b: "b2", c: "c2" },
  { a: "a3", b: "b3", c: "c3" },
];

type Params = Parameters<typeof useClipboard<R>>[0];

function installClipboard(
  opts: {
    text?: string;
    readText?: () => Promise<string>;
    writeText?: (text: string) => Promise<void>;
  } = {}
) {
  const readText = vi.fn(opts.readText ?? (async () => opts.text ?? ""));
  const writeText = vi.fn(opts.writeText ?? (async (_text: string) => {}));
  Object.defineProperty(navigator, "clipboard", {
    value: { readText, writeText },
    configurable: true,
    writable: true,
  });
  return { readText, writeText };
}

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true, writable: true });
});

function setup(overrides: Partial<Params> = {}) {
  const rows = (overrides.rows as R[]) ?? baseRows();
  const spies = {
    updateRows: vi.fn(),
    setClipboard: vi.fn(),
    emitCellChange: vi.fn(),
    onCopy: vi.fn(),
    onPaste: vi.fn(),
    onClipboardError: vi.fn(),
  };
  const params: Params = {
    displayRows: rows,
    displayRowIndexes: rows.map((_, i) => i),
    columns: baseColumns,
    selection: setActiveCell(createInitialSelectionState(), { row: 0, col: 0 }),
    clipboard: null,
    ...spies,
    ...overrides,
    rows,
  };
  const hook = renderHook(() => useClipboard<R>(params));
  return { hook, ...spies, rows };
}

const internalClipboard = (
  data: string[][],
  origin: { startRow: number; endRow: number; startCol: number; endCol: number },
  isCut = false,
  sourceOrigin?: { row: number; col: number }
): GridClipboardData => ({ data, isCut, origin, sourceOrigin });

// =============================================================================
// A-011: paste anchors at the selection top-left, not the cursor/drag-end
// =============================================================================
describe("A-011 paste origin = normalised selection top-left", () => {
  it("shift-select A1:A3 (cursor at the bottom) anchors the paste at A1", async () => {
    installClipboard({ text: "P0\nP1\nP2" });
    // anchor top, cursor bottom: the classic shift+Down selection whose cursor is A3.
    const selection = setRangeSelection(createInitialSelectionState(), { row: 0, col: 0 }, { row: 2, col: 0 });
    const { hook, updateRows } = setup({ selection });

    await act(async () => {
      await hook.result.current.paste();
    });

    const written = updateRows.mock.calls[0][0] as R[];
    expect(written.map((r) => r.a)).toEqual(["P0", "P1", "P2"]);
  });

  it("select-all anchors the paste at A1", async () => {
    installClipboard({ text: "X\tY" });
    const selection = selectAllCells(3, 3);
    const { hook, updateRows } = setup({ selection });

    await act(async () => {
      await hook.result.current.paste();
    });

    const written = updateRows.mock.calls[0][0] as R[];
    expect(written[0]).toMatchObject({ a: "X", b: "Y" });
  });
});

// =============================================================================
// A-056: one copy-on-write pass, one updateRows call, untouched rows keep identity
// =============================================================================
describe("A-056 batched writes", () => {
  it("a 10,000-cell paste makes exactly one updateRows call and keeps untouched rows by identity", async () => {
    const wide = createColumnFactory<Record<string, string>>();
    const columns = resolveColumns(Array.from({ length: 100 }, (_, i) => wide.text(`c${i}`)));
    const rows: Record<string, string>[] = Array.from({ length: 120 }, (_, r) => {
      const row: Record<string, string> = {};
      for (let c = 0; c < 100; c++) row[`c${c}`] = `r${r}c${c}`;
      return row;
    });
    const matrix = Array.from({ length: 100 }, (_, r) =>
      Array.from({ length: 100 }, (_, c) => `N${r}-${c}`)
    ).map((row) => row.join("\t")).join("\n");
    installClipboard({ text: matrix });

    const updateRows = vi.fn();
    const emitCellChange = vi.fn();
    const hook = renderHook(() =>
      useClipboard<Record<string, string>>({
        rows,
        displayRows: rows,
        displayRowIndexes: rows.map((_, i) => i),
        columns,
        selection: setActiveCell(createInitialSelectionState(), { row: 0, col: 0 }),
        clipboard: null,
        setClipboard: vi.fn(),
        updateRows,
        emitCellChange,
      })
    );

    await act(async () => {
      await hook.result.current.paste();
    });

    expect(updateRows).toHaveBeenCalledTimes(1);
    expect(emitCellChange).toHaveBeenCalledTimes(10000);
    const written = updateRows.mock.calls[0][0] as Record<string, string>[];
    expect(written[110]).toBe(rows[110]); // untouched row keeps object identity
    expect(written[0]).not.toBe(rows[0]); // touched row copied-on-write
  });
});

// =============================================================================
// A-057: cut safety + system-vs-internal clipboard precedence
// =============================================================================
describe("A-057 cut safety and clipboard precedence", () => {
  it("cut with a rejecting writeText keeps the source and reports onClipboardError", async () => {
    installClipboard({ writeText: async () => { throw new Error("denied"); } });
    const { hook, updateRows, setClipboard, onClipboardError } = setup();

    await act(async () => {
      await hook.result.current.cut();
    });

    expect(onClipboardError).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cut" })
    );
    expect(updateRows).not.toHaveBeenCalled(); // source NOT cleared
    expect(setClipboard).toHaveBeenCalledTimes(1); // internal copy still recorded
  });

  it("cut clears the source only after writeText succeeds", async () => {
    installClipboard({ writeText: async () => {} });
    const { hook, updateRows, onCopy } = setup();

    await act(async () => {
      await hook.result.current.cut();
    });

    expect(updateRows).toHaveBeenCalledTimes(1);
    const written = updateRows.mock.calls[0][0] as R[];
    expect(written[0].a).toBe(""); // A1 cleared
    expect(onCopy).toHaveBeenCalledWith(expect.objectContaining({ isCut: true }));
  });

  it("paste prefers the system clipboard text even when it differs from the internal copy", async () => {
    installClipboard({ text: "SYS" });
    const clipboard = internalClipboard([["INT"]], { startRow: 0, endRow: 0, startCol: 0, endCol: 0 });
    const { hook, updateRows } = setup({ clipboard });

    await act(async () => {
      await hook.result.current.paste();
    });

    const written = updateRows.mock.calls[0][0] as R[];
    expect(written[0].a).toBe("SYS");
  });

  it("paste falls back to the internal clipboard when readText rejects", async () => {
    installClipboard({ readText: async () => { throw new Error("denied"); } });
    const clipboard = internalClipboard([["INT"]], { startRow: 0, endRow: 0, startCol: 0, endCol: 0 });
    const { hook, updateRows, onClipboardError } = setup({ clipboard });

    await act(async () => {
      await hook.result.current.paste();
    });

    const written = updateRows.mock.calls[0][0] as R[];
    expect(written[0].a).toBe("INT");
    expect(onClipboardError).not.toHaveBeenCalled(); // graceful recovery, not an error
  });
});

// =============================================================================
// A-058 + F-007: onCopy / onPaste / onCellChange fire with real payloads
// =============================================================================
describe("A-058 clipboard events", () => {
  it("copy fires onCopy with the selection and isCut=false", async () => {
    installClipboard({});
    const { hook, onCopy } = setup();

    await act(async () => {
      await hook.result.current.copy();
    });

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy.mock.calls[0][0]).toMatchObject({ isCut: false });
  });

  it("paste emits one onCellChange per changed cell and an onPaste with counts", async () => {
    installClipboard({ text: "a1\tNEW" }); // A1 unchanged, B1 changed
    const { hook, emitCellChange, onPaste } = setup();

    await act(async () => {
      await hook.result.current.paste();
    });

    // Only B1 actually changed (A1 pasted its own existing value).
    expect(emitCellChange).toHaveBeenCalledTimes(1);
    expect(emitCellChange.mock.calls[0][0]).toMatchObject({ columnKey: "b", value: "NEW" });
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(onPaste.mock.calls[0][0]).toMatchObject({ applied: 1 });
  });

  it("Delete/clear emits onCellChange for each cleared cell", () => {
    installClipboard({});
    const selection = setRangeSelection(createInitialSelectionState(), { row: 0, col: 0 }, { row: 0, col: 1 });
    const { hook, emitCellChange, updateRows } = setup({ selection });

    act(() => hook.result.current.clearSelection());

    expect(updateRows).toHaveBeenCalledTimes(1);
    expect(emitCellChange).toHaveBeenCalledTimes(2); // A1 + B1 both had non-empty values
  });
});

// =============================================================================
// A-065: skipped cells reported, formula shifting for internal copies
// =============================================================================
describe("A-065 overflow/readonly reporting and formula paste", () => {
  it("reports overflow and read-only cells via onPaste instead of dropping them silently", async () => {
    const roCols = resolveColumns([col.text("a"), col.text("b", { readonly: true }), col.text("c")]);
    installClipboard({ text: "X\tY\tZ\tW" }); // 4 wide into a 3-col grid at B1
    const selection = setActiveCell(createInitialSelectionState(), { row: 2, col: 1 }); // B3
    const { hook, onPaste } = setup({ columns: roCols, selection });

    await act(async () => {
      await hook.result.current.paste();
    });

    // Anchor B3: col B (read-only) skipped, col C written, cols 4 & 5 overflow off the grid edge.
    const payload = onPaste.mock.calls[0][0];
    expect(payload.applied).toBe(1); // only col C
    expect(payload.skipped.readonly).toBe(1); // col B
    expect(payload.skipped.overflow).toBe(2); // the 4th pasted column + nothing after (3-col grid)
    expect(payload.skipped.unparseable).toBe(0); // all text columns
    expect(payload.skipped.total).toBe(
      payload.skipped.overflow + payload.skipped.readonly + payload.skipped.unparseable
    );
  });

  it("an internal formula copy has its references shifted by the paste offset", async () => {
    type F = { a: number | string; b: number | string; c: number | string };
    const fcol = createColumnFactory<F>();
    const fcols = resolveColumns([fcol.number("a"), fcol.number("b"), fcol.number("c")]);
    const rows: F[] = [
      { a: 1, b: 2, c: "=A1+B1" },
      { a: 3, b: 4, c: "" },
      { a: 5, b: 6, c: "" },
    ];
    // Internal copy of C1 (the formula), origin at row 0 / col 2; readText rejects -> internal path.
    installClipboard({ readText: async () => { throw new Error("denied"); } });
    const clipboard = internalClipboard([["=A1+B1"]], { startRow: 0, endRow: 0, startCol: 2, endCol: 2 });
    const selection = setActiveCell(createInitialSelectionState(), { row: 2, col: 2 }); // paste at C3
    const updateRows = vi.fn();
    const hook = renderHook(() =>
      useClipboard<F>({
        rows,
        displayRows: rows,
        displayRowIndexes: [0, 1, 2],
        columns: fcols,
        selection,
        clipboard,
        setClipboard: vi.fn(),
        updateRows,
      })
    );

    await act(async () => {
      await hook.result.current.paste();
    });

    const written = updateRows.mock.calls[0][0] as F[];
    expect(written[2].c).toBe("=A3+B3"); // shifted down two rows
  });

  it("external '=' text is pasted as a live formula without shifting", async () => {
    installClipboard({ text: "=A1+B1" });
    const selection = setActiveCell(createInitialSelectionState(), { row: 2, col: 2 });
    const { hook, updateRows } = setup({ selection, clipboard: null });

    await act(async () => {
      await hook.result.current.paste();
    });

    const written = updateRows.mock.calls[0][0] as R[];
    expect(written[2].c).toBe("=A1+B1"); // stored verbatim (no source origin => no shift)
  });
});

// =============================================================================
// Copy serialisation (6A carry): quote-aware TSV + displayed value mode
// =============================================================================
describe("copy serialisation", () => {
  it("round-trips a quoted multi-line cell through copy -> clipboard -> paste", async () => {
    const rows: R[] = [{ a: "line1\nline2", b: "x", c: "y" }];
    const written: string[] = [];
    const clip = installClipboard({ writeText: async () => {} });
    clip.writeText.mockImplementation(async (t: string) => { written.push(t); });

    const selection = setRangeSelection(createInitialSelectionState(), { row: 0, col: 0 }, { row: 0, col: 2 });
    const { hook } = setup({
      rows,
      displayRows: rows,
      displayRowIndexes: [0],
      selection,
    });

    await act(async () => {
      await hook.result.current.copy();
    });

    // The multi-line cell must be RFC-4180 quoted so the newline is not a row separator.
    expect(written[0]).toBe('"line1\nline2"\tx\ty');
  });

  it("clipboardValueMode='displayed' copies a formula's computed result, not its source", async () => {
    type F = { a: number | string; b: number | string; c: number | string };
    const fcol = createColumnFactory<F>();
    const fcols = resolveColumns([fcol.number("a"), fcol.number("b"), fcol.number("c")]);
    const rows: F[] = [{ a: 2, b: 3, c: "=A1+B1" }];
    const evaluator = createFormulaEvaluator<F>(rows, fcols);
    const clip = installClipboard({ writeText: async () => {} });
    const written: string[] = [];
    clip.writeText.mockImplementation(async (t: string) => { written.push(t); });

    const selection = setActiveCell(createInitialSelectionState(), { row: 0, col: 2 });
    const hook = renderHook(() =>
      useClipboard<F>({
        rows,
        displayRows: rows,
        displayRowIndexes: [0],
        columns: fcols,
        selection,
        clipboard: null,
        setClipboard: vi.fn(),
        updateRows: vi.fn(),
        clipboardValueMode: "displayed",
        formulaEvaluator: evaluator,
      })
    );

    await act(async () => {
      await hook.result.current.copy();
    });

    expect(written[0]).toBe("5"); // 2 + 3 evaluated, not "=A1+B1"
  });
});

// =============================================================================
// B3 fix: formula paste shifts in SOURCE-row / ABSOLUTE-column space (sort / filter / hidden cols)
// =============================================================================
type Fml = { a: number | string; b: number | string; c: number | string; d: number | string; e: number | string };
const fcolFactory = createColumnFactory<Fml>();
const fmlCols = (keys: Array<keyof Fml>) =>
  resolveColumns(keys.map((k) => fcolFactory.number(k as string)));

function mountFormulaPaste(args: {
  rows: Fml[];
  displayRowIndexes: number[];
  columns: ReturnType<typeof fmlCols>;
  allColumns?: ReturnType<typeof fmlCols>;
  clipboard: GridClipboardData;
  selection: ReturnType<typeof setActiveCell>;
}) {
  installClipboard({ readText: async () => { throw new Error("denied"); } }); // force internal path
  const updateRows = vi.fn();
  const displayRows = args.displayRowIndexes.map((i) => args.rows[i]);
  const hook = renderHook(() =>
    useClipboard<Fml>({
      rows: args.rows,
      displayRows,
      displayRowIndexes: args.displayRowIndexes,
      columns: args.columns,
      allColumns: args.allColumns,
      selection: args.selection,
      clipboard: args.clipboard,
      setClipboard: vi.fn(),
      updateRows,
    })
  );
  return { hook, updateRows };
}

describe("B3 formula paste under sort/filter/hidden columns", () => {
  it("sorted desc: a formula shifts by the SOURCE-row delta, not the display-row delta", async () => {
    // displayRowIndexes [2,1,0]: copy C from source row 2 (display 0), paste into source row 0 (display 2).
    const columns = fmlCols(["a", "b", "c"]);
    const rows: Fml[] = [
      { a: 1, b: 2, c: "", d: 0, e: 0 }, // source row 0 (paste target)
      { a: 3, b: 4, c: "", d: 0, e: 0 }, // source row 1
      { a: 5, b: 6, c: "=A3", d: 0, e: 0 }, // source row 2 (copy source)
    ];
    const clipboard = internalClipboard(
      [["=A3"]],
      { startRow: 0, endRow: 0, startCol: 2, endCol: 2 }, // display-space origin (display row 0)
      false,
      { row: 2, col: 2 } // source-space origin: source row 2, absolute col 2
    );
    const selection = setActiveCell(createInitialSelectionState(), { row: 2, col: 2 }); // display row 2
    const { hook, updateRows } = mountFormulaPaste({
      rows,
      displayRowIndexes: [2, 1, 0],
      columns,
      clipboard,
      selection,
    });

    await act(async () => {
      await hook.result.current.paste();
    });

    // destSourceRow 0 − sourceOriginRow 2 = −2; "=A3" shifted −2 rows = "=A1". (buggy display delta = +2 → "=A5")
    expect((updateRows.mock.calls[0][0] as Fml[])[0].c).toBe("=A1");
  });

  it("filtered: a formula shifts by the hidden source-row gap", async () => {
    // displayRowIndexes [0,2]: source row 1 is filtered out. Copy source row 0, paste source row 2.
    const columns = fmlCols(["a", "b", "c"]);
    const rows: Fml[] = [
      { a: 1, b: 2, c: "=A1", d: 0, e: 0 }, // source row 0 (copy source)
      { a: 3, b: 4, c: "", d: 0, e: 0 }, // source row 1 (filtered out)
      { a: 5, b: 6, c: "", d: 0, e: 0 }, // source row 2 (paste target)
    ];
    const clipboard = internalClipboard(
      [["=A1"]],
      { startRow: 0, endRow: 0, startCol: 2, endCol: 2 },
      false,
      { row: 0, col: 2 }
    );
    const selection = setActiveCell(createInitialSelectionState(), { row: 1, col: 2 }); // display row 1 = source 2
    const { hook, updateRows } = mountFormulaPaste({
      rows,
      displayRowIndexes: [0, 2],
      columns,
      clipboard,
      selection,
    });

    await act(async () => {
      await hook.result.current.paste();
    });

    // destSourceRow 2 − 0 = +2; "=A1" → "=A3". (buggy display delta = +1 → "=A2")
    expect((updateRows.mock.calls[0][0] as Fml[])[2].c).toBe("=A3");
  });

  it("hidden column between source and dest: column refs shift on the ALL-columns axis", async () => {
    // all columns a,b,c,d,e; column c hidden → visible [a,b,d,e] with absolute indexes [0,1,3,4].
    const allColumns = fmlCols(["a", "b", "c", "d", "e"]);
    const columns = fmlCols(["a", "b", "d", "e"]); // visible (c hidden)
    const rows: Fml[] = [{ a: 1, b: 2, c: 0, d: "=A1", e: 0 }];
    const clipboard = internalClipboard(
      [["=A1"]],
      { startRow: 0, endRow: 0, startCol: 1, endCol: 1 }, // display: visible col 1 (b)
      false,
      { row: 0, col: 1 } // source origin: absolute col 1 (b)
    );
    // paste into visible col 2 (d, absolute col 3).
    const selection = setActiveCell(createInitialSelectionState(), { row: 0, col: 2 });
    const { hook, updateRows } = mountFormulaPaste({
      rows,
      displayRowIndexes: [0],
      columns,
      allColumns,
      clipboard,
      selection,
    });

    await act(async () => {
      await hook.result.current.paste();
    });

    // colDelta = abs(3) − abs(1) = +2; "=A1" col A(0) → col C(2) = "=C1". (buggy visible delta = +1 → "=B1")
    expect((updateRows.mock.calls[0][0] as Fml[])[0].d).toBe("=C1");
  });

  it("unsorted regression: source == display so shifting is unchanged", async () => {
    const columns = fmlCols(["a", "b", "c"]);
    const rows: Fml[] = [
      { a: 1, b: 2, c: "=A1", d: 0, e: 0 },
      { a: 3, b: 4, c: "", d: 0, e: 0 },
      { a: 5, b: 6, c: "", d: 0, e: 0 },
    ];
    const clipboard = internalClipboard(
      [["=A1"]],
      { startRow: 0, endRow: 0, startCol: 2, endCol: 2 },
      false,
      { row: 0, col: 2 }
    );
    const selection = setActiveCell(createInitialSelectionState(), { row: 2, col: 2 });
    const { hook, updateRows } = mountFormulaPaste({
      rows,
      displayRowIndexes: [0, 1, 2],
      columns,
      clipboard,
      selection,
    });

    await act(async () => {
      await hook.result.current.paste();
    });

    expect((updateRows.mock.calls[0][0] as Fml[])[2].c).toBe("=A3"); // +2 rows, unchanged
  });

  it("copy captures a source-space origin (source row + absolute column)", async () => {
    installClipboard({});
    const allColumns = fmlCols(["a", "b", "c", "d", "e"]);
    const columns = fmlCols(["a", "b", "d", "e"]); // c hidden
    const rows: Fml[] = [
      { a: 1, b: 2, c: 0, d: 0, e: 0 },
      { a: 3, b: 4, c: 0, d: 0, e: 0 },
      { a: 5, b: 6, c: 0, d: 0, e: 0 },
    ];
    const setClipboard = vi.fn();
    const hook = renderHook(() =>
      useClipboard<Fml>({
        rows,
        displayRows: [rows[2], rows[1], rows[0]], // sorted desc
        displayRowIndexes: [2, 1, 0],
        columns,
        allColumns,
        selection: setActiveCell(createInitialSelectionState(), { row: 0, col: 2 }), // display 0 / visible col 2 (d)
        clipboard: null,
        setClipboard,
        updateRows: vi.fn(),
      })
    );

    await act(async () => {
      await hook.result.current.copy();
    });

    const record = setClipboard.mock.calls[0][0] as GridClipboardData;
    // display row 0 → source row 2; visible col 2 (d) → absolute col 3.
    expect(record?.sourceOrigin).toEqual({ row: 2, col: 3 });
  });
});

// =============================================================================
// MINOR 1: onCopy / onPaste payloads are defensive deep copies (no history corruption)
// =============================================================================
describe("clipboard event payloads are defensive copies", () => {
  it("mutating the onPaste payload rows does not touch the committed array", async () => {
    installClipboard({ text: "NEW" });
    const { hook, updateRows, onPaste } = setup();

    await act(async () => {
      await hook.result.current.paste();
    });

    const committed = updateRows.mock.calls[0][0] as R[];
    const payloadRows = onPaste.mock.calls[0][0].rows as R[];
    expect(payloadRows).not.toBe(committed);
    payloadRows[0].a = "MUTATED";
    expect(committed[0].a).not.toBe("MUTATED");
  });

  it("mutating the onCopy payload rows does not touch the live source rows", async () => {
    installClipboard({});
    const { hook, onCopy, rows } = setup();

    await act(async () => {
      await hook.result.current.copy();
    });

    const payloadRows = onCopy.mock.calls[0][0].rows as R[];
    payloadRows[0].a = "MUTATED";
    expect(rows[0].a).not.toBe("MUTATED");
  });
});

// =============================================================================
// MINOR 2: text that fails a strict number parse is skipped, not written as null (A-059)
// =============================================================================
describe("unparseable paste is reported, value kept", () => {
  it("'abc' into a number column keeps the previous value and reports skipped.unparseable", async () => {
    type N = { n: number };
    const ncol = createColumnFactory<N>();
    const columns = resolveColumns([ncol.number("n")]);
    const rows: N[] = [{ n: 10 }];
    installClipboard({ text: "abc" });
    const updateRows = vi.fn();
    const onPaste = vi.fn();
    const hook = renderHook(() =>
      useClipboard<N>({
        rows,
        displayRows: rows,
        displayRowIndexes: [0],
        columns,
        selection: setActiveCell(createInitialSelectionState(), { row: 0, col: 0 }),
        clipboard: null,
        setClipboard: vi.fn(),
        updateRows,
        onPaste,
      })
    );

    await act(async () => {
      await hook.result.current.paste();
    });

    expect(updateRows).not.toHaveBeenCalled(); // value NOT clobbered with null
    expect(rows[0].n).toBe(10);
    const payload = onPaste.mock.calls[0][0];
    expect(payload.applied).toBe(0);
    expect(payload.skipped.unparseable).toBe(1);
    expect(payload.skipped.cells).toEqual([{ rowIndex: 0, columnKey: "n", reason: "unparseable" }]);
  });
});
