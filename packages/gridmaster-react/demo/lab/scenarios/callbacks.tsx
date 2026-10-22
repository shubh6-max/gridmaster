// Scenario: callbacks + controlled host. Language: TypeScript 6 (strict), React 19.
import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { GridMaster } from "../../../src";
import {
  type Check,
  EventLog,
  type LabRow,
  Toggle,
  col,
  defineScenario,
  labColumns,
  makeRows,
  useEventLog,
} from "../kit";

const checks: Check[] = [
  {
    do: 'Double-click a Name cell, type a new name, press Enter.',
    expect:
      "The log gets ONE onCellChange (with previousValue and value), one onRowsChange and one onSnapshotChange. The new name stays visible (controlled rows state fed by onRowsChange).",
  },
  {
    do: 'Click "Re-render parent ×5".',
    expect:
      'The "parent renders" counter goes up by 5 but NO new log lines appear (no onRowsChange / onSnapshotChange / onSelectionChange from a mere re-render).',
  },
  {
    do: 'Edit a cell, tick "Fresh inline columns every render", click "Re-render parent ×5", click into the grid and press Ctrl+Z.',
    expect:
      "The edit is undone: undo history survives new column objects with an inline renderCell (Name is shown in bold/blue while ticked).",
  },
  {
    do: "Click a cell, then Shift+click another cell, then press an arrow key.",
    expect:
      "onSelectionChange fires once per change (click, Shift+click, arrow), never repeatedly while idle.",
  },
  {
    do: "Click the Amount header to sort, then open its column menu and apply a filter.",
    expect:
      "onSortChange fires once per sort with { sort: { columnKey, direction } }; onFilterChange fires once per filter change.",
  },
  {
    do: "Paint a few Name cells with a fill colour (toolbar), then use the Name column menu: filter by colour, then sort by colour.",
    expect: "onColorFilterChange and onColorSortChange each fire once per action.",
  },
  {
    do: "Drag a column border to resize it, release.",
    expect: "onColumnResize fires once, at release, with the new width.",
  },
];

function Body() {
  const events = useEventLog();
  const { log } = events;
  const [rows, setRows] = useState<LabRow[]>(() => makeRows(200, 1));
  const [parentRenders, setParentRenders] = useState(0);
  const [inline, setInline] = useState(false);

  const stableColumns = useMemo(() => labColumns(), []);
  // Fresh column objects + a fresh inline renderCell on every render when the toggle is on.
  const columns = inline
    ? stableColumns.map((c) =>
        c.key === "name"
          ? col.text("name", {
              width: 150,
              renderCell: ({ value }) => <b style={{ color: "#2457d6" }}>{String(value ?? "")}</b>,
            })
          : { ...c }
      )
    : stableColumns;

  const rerenderFive = () => {
    for (let i = 0; i < 5; i += 1) flushSync(() => setParentRenders((n) => n + 1));
  };

  return (
    <>
      <div className="lab-controls">
        <button type="button" onClick={rerenderFive}>
          Re-render parent ×5
        </button>
        <Toggle label="Fresh inline columns every render" checked={inline} onChange={setInline} />
        <span>
          parent renders: <b data-testid="parent-renders">{parentRenders}</b>
        </span>
        <span className="lab-muted">Undo / redo: click the grid, then Ctrl+Z / Ctrl+Y (the toolbar has no undo buttons yet).</span>
      </div>
      <GridMaster<LabRow>
        rows={rows}
        columns={columns}
        height={380}
        onRowsChange={(next) => {
          setRows(next);
          log("onRowsChange", next);
        }}
        onCellChange={(e) => log("onCellChange", e)}
        onSelectionChange={(e) => log("onSelectionChange", e)}
        onSortChange={(e) => log("onSortChange", e)}
        onFilterChange={(e) => log("onFilterChange", e)}
        onColorFilterChange={(e) => log("onColorFilterChange", e)}
        onColorSortChange={(e) => log("onColorSortChange", e)}
        onSnapshotChange={(e) => log("onSnapshotChange", e.rows)}
        onColumnResize={(e) => log("onColumnResize", { key: e.column.key, width: e.width })}
      />
      <EventLog api={events} />
    </>
  );
}

export const scenario = defineScenario({
  id: "callbacks",
  area: "State & flags",
  order: 1,
  title: "Callbacks & controlled host",
  summary:
    "A controlled grid (rows fed back from onRowsChange) with every callback logging to the event log. Re-rendering the parent must be silent and must not reset undo history.",
  checks,
  Body,
});
