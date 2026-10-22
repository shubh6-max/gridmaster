// Scenario: mouse, touch & pen. Language: TypeScript 6 (strict), React 19.
import { useMemo, useState } from "react";
import { GridMaster, type GridRow, createColumnFactory } from "../../../src";
import { type Check, EventLog, defineScenario, useEventLog } from "../kit";

const g = createColumnFactory();

const checks: Check[] = [
  {
    do: "Press on a cell and drag across several rows and columns, release.",
    expect: "A rectangular range is highlighted, following the pointer; the status bar shows the cell count.",
  },
  {
    do: "Start a drag-select and move the pointer past the right / bottom edge of the grid and hold it there.",
    expect: "The viewport auto-scrolls in that direction and the range keeps growing; it stops when you stop or release.",
  },
  {
    do: "Select a range of 3×3 cells, then right-click INSIDE it.",
    expect: "The context menu opens and the range stays selected.",
  },
  {
    do: "Right-click a cell OUTSIDE the selected range.",
    expect: "The selection moves to that cell, then the context menu opens.",
  },
  {
    do: "Drag the right border of a column header to resize, release. Then press on a border and release without moving.",
    expect: 'After the drag: ONE "onColumnResize" log line, at release. A press without movement logs nothing.',
  },
  {
    do: "Immediately after a resize drag, release over the header (the click that ends the drag).",
    expect: "The column is NOT sorted: no onSortChange line. A normal header click afterwards does sort.",
  },
  {
    do: 'Fill series: select "Series" rows 1–2 (values 1, 2) and drag the fill handle down 4 rows; then select "Month" rows 1–2 (2024-01-15, 2024-02-15) and drag down.',
    expect: "Series continues 3, 4, 5, 6. Dates continue month by month: 2024-03-15, 2024-04-15, …",
  },
  {
    do: "Open this page with browser devtools device mode (touch emulation). Tap a cell, then drag to scroll and try a two-finger pinch.",
    expect: "A tap selects the cell; dragging and pinching pan / scroll the page and grid as normal (no stuck selection, no accidental range).",
  },
];

function Body() {
  const events = useEventLog();
  const { log } = events;
  const columns = useMemo(
    () => [
      g.number("id", { title: "ID", width: 70, editable: false }),
      g.number("series", { title: "Series", width: 90 }),
      g.date("month", { title: "Month", width: 120 }),
      ...Array.from({ length: 27 }, (_, j) =>
        j % 2 === 0 ? g.number(`n${j}`, { width: 90 }) : g.text(`t${j}`, { width: 110 })
      ),
    ],
    []
  );
  const [rows, setRows] = useState<GridRow[]>(() =>
    Array.from({ length: 500 }, (_, i) => {
      const row: GridRow = {
        id: i + 1,
        series: i < 2 ? i + 1 : null,
        month: i === 0 ? "2024-01-15" : i === 1 ? "2024-02-15" : null,
      };
      for (let j = 0; j < 27; j += 1) row[j % 2 === 0 ? `n${j}` : `t${j}`] = j % 2 === 0 ? i * 100 + j : `r${i + 1}c${j + 4}`;
      return row;
    })
  );

  return (
    <>
      <GridMaster<GridRow>
        rows={rows}
        columns={columns}
        height={460}
        virtualizeRows
        onRowsChange={(next) => setRows(next)}
        onColumnResize={(e) => log("onColumnResize", { key: e.column.key, width: e.width })}
        onSortChange={(e) => log("onSortChange", e)}
        onSelectionChange={(e) => log("onSelectionChange", { mode: e.selection.mode, range: e.selection.range })}
        onCellChange={(e) => log("onCellChange", { at: `${e.columnKey}${e.rowIndex + 1}`, value: e.value })}
      />
      <EventLog api={events} />
    </>
  );
}

export const scenario = defineScenario({
  id: "pointer",
  area: "Interaction",
  order: 7,
  title: "Mouse, touch & pen",
  summary:
    "A 30-column × 500-row grid for pointer work: range drag, edge auto-scroll, context-menu selection rules, column resize events, fill-handle series, and touch.",
  checks,
  Body,
});
