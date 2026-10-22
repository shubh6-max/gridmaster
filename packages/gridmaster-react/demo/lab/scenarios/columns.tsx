// Scenario: columns (hidden, frozen, auto-fit, structure). Language: TypeScript 6 (strict), React 19.
import { useMemo, useState } from "react";
import { GridMaster, type GridRow, createColumnFactory } from "../../../src";
import { type Check, EventLog, Select, Toggle, defineScenario, useEventLog } from "../kit";

const g = createColumnFactory();

const checks: Check[] = [
  {
    do: 'Set frozenColumns = 2 and scroll the grid sideways (the "notes" column is wide).',
    expect: "ID and Name stay pinned on the left while the other columns scroll under them; no overlap or gap.",
  },
  {
    do: 'Note that the "Qty" column (letter D) starts HIDDEN, yet the Total column (=C*D) shows numbers, not errors.',
    expect: "Total evaluates normally (e.g. row 1 = 6 × 4 = 24): formulas still see hidden columns; column letters do not shift.",
  },
  {
    do: "Open any column menu → show/hide columns, un-hide Qty, then hide Price.",
    expect: "Qty appears between Price and Total; with Price hidden Total still shows the same numbers.",
  },
  {
    do: "Hide Qty again, then double-click the right border of the Total header (auto-fit).",
    expect: "Total's width snaps to fit its widest displayed value (including the header text), not to the formula text and not to a #REF!.",
  },
  {
    do: "Right-click a cell → Insert row above / below, then Delete row.",
    expect: "Rows are added/removed; Total formulas keep pointing at their own row's Price and Qty; onRowInsert / onRowDelete log once each.",
  },
  {
    do: "Right-click a column header → Insert column left / right, then Delete column.",
    expect: "A new empty column appears or disappears; onColumnInsert / onColumnDelete log once each; later formulas keep working (references shift with the columns).",
  },
  {
    do: "With enableRowDrag / enableColumnDrag on, drag a row header or a column header to a new position.",
    expect: "The row/column moves and onRowReorder / onColumnReorder log once.",
    known: "If your build has no drag handles for rows/columns the toggles do nothing; note it rather than failing the check.",
  },
];

const FLAGS = [
  "enableColumnAutoFit",
  "enableColumnVisibility",
  "enableInsertRow",
  "enableInsertColumn",
  "enableDeleteRow",
  "enableDeleteColumn",
  "enableRowDrag",
  "enableColumnDrag",
] as const;
type Flag = (typeof FLAGS)[number];

function Body() {
  const events = useEventLog();
  const { log } = events;
  const [frozen, setFrozen] = useState("0");
  const [flags, setFlags] = useState<Record<Flag, boolean>>(() =>
    Object.fromEntries(FLAGS.map((f) => [f, true])) as Record<Flag, boolean>
  );
  const columns = useMemo(
    () => [
      g.number("id", { title: "ID", width: 60 }),
      g.text("name", { width: 150 }),
      g.number("price", { width: 90 }),
      g.number("qty", { title: "Qty", width: 80, hidden: true }),
      g.text("total", { title: "Total", width: 80 }),
      g.text("notes", { width: 600 }),
    ],
    []
  );
  const [rows, setRows] = useState<GridRow[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      price: 6 + i,
      qty: 4 + (i % 3),
      total: `=C${i + 1}*D${i + 1}`,
      notes: "A deliberately wide column so there is something to scroll past the frozen columns.",
    }))
  );

  return (
    <>
      <div className="lab-controls">
        <Select label="frozenColumns" value={frozen} options={["0", "1", "2", "3"]} onChange={setFrozen} />
        {FLAGS.map((f) => (
          <Toggle key={f} label={f} checked={flags[f]} onChange={(next) => setFlags((p) => ({ ...p, [f]: next }))} />
        ))}
      </div>
      <GridMaster<GridRow>
        rows={rows}
        columns={columns}
        height={380}
        frozenColumns={Number(frozen)}
        {...flags}
        onRowsChange={(next) => setRows(next)}
        onColumnsChange={(cols) => log("onColumnsChange", cols.map((c) => c.key))}
        onRowInsert={(e) => log("onRowInsert", e.rowIndex)}
        onRowDelete={(e) => log("onRowDelete", e.rowIndex)}
        onColumnInsert={(e) => log("onColumnInsert", { at: e.columnIndex, position: e.position })}
        onColumnDelete={(e) => log("onColumnDelete", { at: e.columnIndex, key: e.column.key })}
        onRowReorder={(r) => log("onRowReorder", r)}
        onColumnReorder={(cols) => log("onColumnReorder", cols.map((c) => c.key))}
      />
      <EventLog api={events} />
    </>
  );
}

export const scenario = defineScenario({
  id: "columns",
  area: "Editing & columns",
  order: 9,
  title: "Columns: hidden, frozen, auto-fit, structure",
  summary:
    "Frozen columns, hide/show through the column menu, auto-fit on a formula column that references a hidden column, row/column insert and delete, and drag reorder.",
  checks,
  Body,
});
