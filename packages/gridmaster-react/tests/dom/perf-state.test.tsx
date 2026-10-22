// Task 3 — performance of state & rendering (A-074 eager clones, A-047 history retention).
// Counting harness: these assert reference-counts / clone-counts, never wall-clock (the bench
// script tests/bench/state.bench.mjs records the timings). Language: TS6 strict, React 19, vitest.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  cloneRows,
  useGridMaster,
  type GridColumnDef,
  type GridHistoryState,
} from "../../src/index";

type Row = { id: number; name: string; qty: number };

const columns: GridColumnDef<Row>[] = [
  { key: "name", title: "Name" },
  { key: "qty", title: "Qty" },
];

/** Rows whose `probe` property counts every enumeration (object spread in a deep clone reads it). */
function countingRows(n: number) {
  let reads = 0;
  const rows: Row[] = Array.from({ length: n }, (_, i) => {
    const row: Row = { id: i, name: `n${i}`, qty: i };
    Object.defineProperty(row, "probe", {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        return i;
      },
    });
    return row;
  });
  return { rows, reads: () => reads };
}

function allRowRefs(history: GridHistoryState<Row>): Set<object> {
  const seen = new Set<object>();
  for (const snap of [...history.past, history.present]) {
    for (const row of snap.rows as Row[]) seen.add(row);
  }
  return seen;
}

/** Copy-on-write single-cell edit, exactly what updateCellValue produces (one new row object). */
function cowEdit(rows: Row[], index: number, qty: number): Row[] {
  const next = rows.slice();
  next[index] = { ...next[index], qty };
  return next;
}

describe("A-074 — the dataset is not deep-cloned on every render", () => {
  it("re-rendering the hook with the same props does not re-clone rows", () => {
    const { rows, reads } = countingRows(40);
    const hook = renderHook(() => useGridMaster<Row>({ rows, columns }));

    const afterMount = reads();
    expect(afterMount).toBeGreaterThan(0); // mount legitimately clones (history seed etc.)

    for (let i = 0; i < 5; i++) act(() => hook.rerender());

    // Eager `useRef(cloneRows(props.rows))` re-clones on every render → +40 reads each time.
    // Lazy initialisers clone at most once, so a pure re-render adds nothing.
    expect(reads() - afterMount).toBe(0);
  });
});

describe("A-047 — history uses structural sharing (retention is O(edits), not O(edits × rows))", () => {
  it("keeps one shared reference per unchanged row across many edits", () => {
    const base = 500;
    const edits = 20;
    const { rows } = countingRows(base);
    const hook = renderHook(() => useGridMaster<Row>({ rows, columns }));

    for (let e = 0; e < edits; e++) {
      act(() =>
        hook.result.current.updateRows(cowEdit(hook.result.current.rows, e % base, 1000 + e))
      );
    }

    const distinct = allRowRefs(hook.result.current.history).size;
    // Structural sharing: ~base originals + one new object per edit.
    // Deep clone per push would retain ~base × (edits + 1) ≈ 10,500.
    expect(distinct).toBeLessThanOrEqual(base + edits * 2);
  });

  it("defensive clone keeps Symbol-keyed props on nested objects (Task 2 finding)", () => {
    const tag = Symbol("tag");
    const nested = { label: "x", [tag]: 42 };
    const [copy] = cloneRows([{ id: 1, meta: nested }]);
    const copiedNested = (copy as { meta: typeof nested }).meta;
    expect(copiedNested).not.toBe(nested); // deep-cloned, not shared
    expect(copiedNested.label).toBe("x");
    expect(copiedNested[tag]).toBe(42); // the symbol survived the clone
  });

  it("A-066: the display pipeline is memoised — a selection change does not re-run filter/sort", () => {
    const { rows } = countingRows(30);
    const hook = renderHook(() =>
      useGridMaster<Row>({ rows, columns, enableSorting: true, enableFiltering: true })
    );

    const before = hook.result.current.displayRowIndexes;
    // Move the active cell: pure selection state, nothing the pipeline depends on.
    act(() =>
      hook.result.current.setSelection((prev) => ({ ...prev, cursor: { row: 2, col: 1 } }))
    );
    expect(hook.result.current.displayRowIndexes).toBe(before); // same reference → not recomputed

    // A real data edit must recompute it.
    act(() => hook.result.current.updateRows(cowEdit(hook.result.current.rows, 0, 9999)));
    expect(hook.result.current.displayRowIndexes).not.toBe(before);
  });

  it("a consumer may mutate an emitted row without corrupting history (trust boundary intact)", () => {
    const emitted: Row[][] = [];
    const { rows } = countingRows(10);
    const hook = renderHook(() =>
      useGridMaster<Row>({ rows, columns, onRowsChange: (next) => emitted.push(next as Row[]) })
    );

    act(() => hook.result.current.updateRows(cowEdit(hook.result.current.rows, 0, 777)));
    const historyValue = (hook.result.current.history.present.rows as Row[])[0].qty;
    // Mutating the emitted copy must not reach into stored history.
    emitted[emitted.length - 1][0].qty = -999;
    expect((hook.result.current.history.present.rows as Row[])[0].qty).toBe(historyValue);
    expect(historyValue).toBe(777);
  });
});
