// Scenario: accessibility inspector. Language: TypeScript 6 (strict), React 19.
// The inspector is plain DOM reading. To add a row: append one entry to INSPECTOR_ROWS.
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { GridMaster } from "../../../src";
import { type Check, type LabRow, defineScenario, labColumns, makeRows } from "../kit";

type InspectCtx = { grid: HTMLElement | null };
type InspectorRow = { key: string; label: string; read: (ctx: InspectCtx) => string };

const DASH = "—";
const attr = (el: Element | null | undefined, name: string): string => el?.getAttribute(name) ?? DASH;

function rowIndexes(grid: HTMLElement | null): number[] {
  if (!grid) return [];
  return Array.from(grid.querySelectorAll<HTMLElement>('[role="row"][aria-rowindex]'))
    .map((row) => Number(row.getAttribute("aria-rowindex")))
    .filter((n) => Number.isFinite(n));
}

function describeRow(row: Element | null): string {
  if (!row) return DASH;
  const cells = Array.from(row.querySelectorAll('[role="gridcell"], [role="rowheader"], [role="columnheader"]'))
    .slice(0, 5)
    .map((cell) => `${attr(cell, "role")}/${attr(cell, "aria-colindex")}`);
  return `role=${attr(row, "role")} rowindex=${attr(row, "aria-rowindex")} cells: ${cells.join(", ") || DASH}`;
}

function hasAccessibleName(el: HTMLElement): boolean {
  if (el.getAttribute("aria-label")?.trim() || el.getAttribute("aria-labelledby")?.trim()) return true;
  if (el.getAttribute("title")?.trim() || el.textContent?.trim()) return true;
  const labels = (el as HTMLInputElement).labels;
  return Boolean(labels && labels.length > 0);
}

/** Add a row to the inspector with one line here. `read` may throw; it is guarded by the caller. */
export const INSPECTOR_ROWS: InspectorRow[] = [
  { key: "role", label: "role", read: ({ grid }) => attr(grid, "role") },
  { key: "rowcount", label: "aria-rowcount", read: ({ grid }) => attr(grid, "aria-rowcount") },
  { key: "colcount", label: "aria-colcount", read: ({ grid }) => attr(grid, "aria-colcount") },
  { key: "multiselectable", label: "aria-multiselectable", read: ({ grid }) => attr(grid, "aria-multiselectable") },
  { key: "readonly", label: "aria-readonly", read: ({ grid }) => attr(grid, "aria-readonly") },
  {
    key: "activedescendant",
    label: "aria-activedescendant",
    read: ({ grid }) => {
      const id = grid?.getAttribute("aria-activedescendant");
      if (!id) return DASH;
      return `${id} (${document.getElementById(id) ? "exists in DOM" : "NOT in DOM"})`;
    },
  },
  {
    key: "activecell",
    label: "active cell (aria-activedescendant target)",
    read: ({ grid }) => {
      const id = grid?.getAttribute("aria-activedescendant");
      if (!id) return DASH;
      const el = document.getElementById(id);
      if (!el) return `${id} — NOT in DOM (dangling)`;
      const parts = [
        id,
        `role=${attr(el, "role")}`,
        `aria-selected=${attr(el, "aria-selected")}`,
        `aria-readonly=${attr(el, "aria-readonly")}`,
      ];
      if (grid) {
        const gridRect = grid.getBoundingClientRect();
        const cellRect = el.getBoundingClientRect();
        if (cellRect.bottom < gridRect.top || cellRect.top > gridRect.bottom) {
          parts.push("(scrolled out of view — kept mounted by the grid)");
        }
      }
      return parts.join(" · ");
    },
  },
  {
    key: "selectedcount",
    label: "aria-selected cells (mounted)",
    read: ({ grid }) =>
      grid ? String(grid.querySelectorAll('[role="gridcell"][aria-selected="true"]').length) : DASH,
  },
  {
    key: "mounted",
    label: "mounted rows (min–max aria-rowindex)",
    read: ({ grid }) => {
      const idx = rowIndexes(grid);
      if (!idx.length) return DASH;
      // A2: the kept active row may sit far outside the contiguous virtualization window. Show the
      // window range EXCLUDING it, and call the active row out separately, e.g. "window 120–148 (+ active row 2)".
      const activeId = grid?.getAttribute("aria-activedescendant");
      const activeEl = activeId ? document.getElementById(activeId) : null;
      const activeRowIndex = activeEl
        ? Number(activeEl.closest('[role="row"]')?.getAttribute("aria-rowindex"))
        : Number.NaN;
      const windowIdx = idx.filter((n) => n !== activeRowIndex);
      const apart =
        windowIdx.length > 0 &&
        Number.isFinite(activeRowIndex) &&
        (activeRowIndex < Math.min(...windowIdx) || activeRowIndex > Math.max(...windowIdx));
      if (apart) {
        return `${idx.length} rows: window ${Math.min(...windowIdx)}–${Math.max(...windowIdx)} (+ active row ${activeRowIndex})`;
      }
      return `${idx.length} rows (${Math.min(...idx)}–${Math.max(...idx)})`;
    },
  },
  {
    key: "firstrow",
    label: "first mounted row",
    read: ({ grid }) => describeRow(grid?.querySelector('[role="row"]') ?? null),
  },
  {
    key: "firstbody",
    label: "first body row",
    read: ({ grid }) => describeRow(grid?.querySelector('tbody [role="row"][aria-rowindex]') ?? null),
  },
  {
    key: "unnamed",
    label: "interactive without accessible name",
    read: ({ grid }) => {
      if (!grid) return DASH;
      const bad = Array.from(
        grid.querySelectorAll<HTMLElement>('button, input, select, textarea, [role="separator"]')
      )
        .filter((el) => !(el instanceof HTMLInputElement && el.type === "hidden") && !hasAccessibleName(el))
        .map((el) => `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(" ")[0]}` : ""}`);
      return bad.length ? `${bad.length}: ${bad.slice(0, 8).join(", ")}` : DASH;
    },
  },
];

const checks: Check[] = [
  {
    do: "Open browser devtools → Elements (or the Accessibility tab) on the grid and compare with the inspector's role and first-row lines.",
    expect: 'Role tree is grid > rowgroup > row > (rowheader / columnheader / gridcell). Inspector: role = "grid", rows show role=row, cells show gridcell/rowheader with 1-based aria-colindex.',
  },
  {
    do: "Scroll the grid slowly through the middle of the 10,000 rows.",
    expect: "aria-rowcount stays 10001 (10,000 rows + header) and aria-colcount stays 12 (11 columns + row header); only a few dozen rows are mounted, never 10,000.",
  },
  {
    do: "Click any cell, press Ctrl+End, then Ctrl+Home.",
    expect: "After Ctrl+End the mounted max aria-rowindex equals aria-rowcount (10001) and the last row's header number equals aria-rowindex − 1; after Ctrl+Home the min is 1 or 2. No gaps or repeats in indexes.",
  },
  {
    do: 'Look at "interactive without accessible name" (also while a column menu or cell editor is open).',
    expect: "It shows a dash (none). Any entry is an accessibility bug: report its tag/class.",
  },
  {
    do: "Press ArrowDown 20 times while watching the active-cell line.",
    expect:
      "aria-activedescendant changes each time and points at the highlighted (active) cell, whose id/role/aria-selected the inspector shows.",
  },
  {
    do: "Select a range with Shift+Arrows.",
    expect: "The inspector's aria-selected cell count matches the number of highlighted cells.",
  },
  {
    do: "Scroll the active row out of view (cursor in the middle, then scroll to the top/bottom).",
    expect:
      "The active row stays mounted (active-cell line still resolves, noting 'kept mounted by the grid') and aria-activedescendant never dangles.",
  },
  {
    do: "Move the cursor onto a read-only column/cell/row (or run in mode=readonly).",
    expect: "Readonly cells show aria-readonly=true on the active-cell line.",
  },
  { do: "A4: sort a column.", expect: "The header exposes aria-sort ascending/descending; others none.", pending: true },
  { do: "A5: sort, filter, paste, then listen with a screen reader.", expect: "A polite live region announces the result.", pending: true },
  { do: "A6–A9: open column menu / context menu with the keyboard.", expect: "Menus expose menu/menuitem roles, Escape closes and returns focus to the trigger.", pending: true },
];

function Inspector({ gridHost }: { gridHost: RefObject<HTMLDivElement | null> }) {
  const [snap, setSnap] = useState<{ key: string; label: string; value: string }[]>([]);
  useEffect(() => {
    const read = () => {
      const grid = gridHost.current?.querySelector<HTMLElement>('[role="grid"]') ?? null;
      const next = INSPECTOR_ROWS.map((row) => {
        let value: string;
        try {
          value = row.read({ grid });
        } catch (error) {
          value = `error: ${String(error)}`;
        }
        return { key: row.key, label: row.label, value };
      });
      setSnap((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    read();
    const timer = window.setInterval(read, 300);
    document.addEventListener("focusin", read);
    document.addEventListener("scroll", read, true);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("focusin", read);
      document.removeEventListener("scroll", read, true);
    };
  }, [gridHost]);

  return (
    <table className="lab-table lab-inspector" aria-label="Live ARIA inspector">
      <tbody>
        {snap.map((row) => (
          <tr key={row.key} data-inspector={row.key}>
            <td>{row.label}</td>
            <td>
              <code>{row.value}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Body() {
  const rows = useMemo<LabRow[]>(() => makeRows(10000, 5), []);
  const columns = useMemo(() => labColumns(), []);
  const host = useRef<HTMLDivElement | null>(null);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 10, alignItems: "start" }}>
      <div ref={host}>
        <GridMaster<LabRow> rows={rows} columns={columns} height={440} virtualizeRows />
      </div>
      <Inspector gridHost={host} />
    </div>
  );
}

export const scenario = defineScenario({
  id: "accessibility",
  area: "Accessibility",
  order: 10,
  title: "Accessibility inspector",
  summary:
    "A 10,000-row virtualized grid (no ariaLabel yet) beside a live inspector that reads roles, counts, indexes and unnamed controls straight from the DOM. Later accessibility tasks add rows to INSPECTOR_ROWS and tick the pending checks.",
  checks,
  Body,
});
