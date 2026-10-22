// Scenario: sort / filter / conditional formatting at scale. Language: TypeScript 6 (strict), React 19.
import { useMemo, useState } from "react";
import { GridMaster, type GridConditionalFormats, type GridSortChangeEvent } from "../../../src";
import {
  type Check,
  EventLog,
  type LabRow,
  Select,
  Toggle,
  defineScenario,
  labColumns,
  makeRows,
  useEventLog,
} from "../kit";

const SIZES = ["1000", "10000", "100000", "250000"];

const FORMATS: GridConditionalFormats = {
  amount: [
    { condition: { type: "cellValue", operator: ">", value: 800 }, backgroundColor: "#fecaca", color: "#7f1d1d" },
    { condition: { type: "between", low: 400, high: 600 }, backgroundColor: "#fde68a" },
  ],
  notes: [{ condition: { type: "textContains", value: "VIP" }, bold: true, color: "#6d28d9" }],
  qty: [{ condition: { type: "cellValue", operator: "=", value: "" }, backgroundColor: "#e5e7eb" }],
  joined: [{ condition: { type: "timePeriod", value: "thisMonth" }, backgroundColor: "#bbf7d0" }],
};

const checks: Check[] = [
  {
    do: "Pick 100,000 rows, then click the Amount header to sort ascending and descending.",
    expect:
      'The "last sort" readout shows a time in ms (note it down for regressions) and the UI stays responsive; scrolling right after a sort is smooth.',
  },
  {
    do: "Open the Qty column menu → number filter → Greater than 5.",
    expect: "Rows whose Qty is blank disappear along with values ≤ 5 (blank is not > 5). Clearing the filter brings every row back.",
  },
  {
    do: "Open the Joined column menu and look at the value filter.",
    expect:
      "It is a Year > Month > Day tree. Unchecking a year hides that year's rows; re-checking restores them; the parent checkbox is partial when only some children are selected.",
  },
  {
    do: "Fill a few Name cells with a colour (toolbar fill), open the Name column menu, filter by that colour, then sort by colour.",
    expect: "The colour list shows the colour with its count; filtering keeps only those rows; sort-by-colour puts them first. onColorFilterChange / onColorSortChange appear in the log.",
  },
  {
    do: "Amount rules: look for cells > 800 (red) and 400–600 (amber). Edit an Amount to 800, 801, 400, 600, 601.",
    expect: "801 turns red; 800 is not red; 400 and 600 are amber (between is inclusive); 601 has no highlight.",
  },
  {
    do: 'Notes rule: find a note like "VIP customer #…" and a plain "Note …".',
    expect: "VIP notes are bold purple; other notes are unchanged.",
  },
  {
    do: "Blank rule: look at Qty cells that are empty (about 1 in 20).",
    expect: "Empty Qty cells have a grey fill; filled cells do not.",
  },
  {
    do: 'Tick "Fixed clock 2024-03-15", then untick it. Then pick 250,000 rows and press Ctrl+End.',
    expect:
      "With the fixed clock, Joined dates in March 2024 are green (timePeriod thisMonth); unticked (real date) none are. At 250,000 rows Ctrl+End jumps to the last row with no blank flashes.",
  },
];

function Body() {
  const events = useEventLog();
  const { log } = events;
  const [size, setSize] = useState("1000");
  const [fixedClock, setFixedClock] = useState(false);
  const [sortMs, setSortMs] = useState<string>("—");

  const rows = useMemo(() => makeRows(Number(size), 7), [size]);
  const columns = useMemo(() => labColumns(), []);
  const now = useMemo(() => (fixedClock ? () => new Date(Date.UTC(2024, 2, 15, 12)) : undefined), [fixedClock]);

  // Approximation: time from the onSortChange emit to the first paint after it (two rAFs).
  const onSort = (e: GridSortChangeEvent) => {
    log("onSortChange", e);
    const started = performance.now();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setSortMs(`${(performance.now() - started).toFixed(0)} ms (${size} rows)`))
    );
  };

  return (
    <>
      <div className="lab-controls">
        <Select label="Rows" value={size} options={SIZES} onChange={setSize} format={(v) => Number(v).toLocaleString("en-US")} />
        <Toggle label="Fixed clock 2024-03-15" checked={fixedClock} onChange={setFixedClock} />
        <span>
          last sort: <b data-testid="sort-ms">{sortMs}</b>
        </span>
      </div>
      <GridMaster<LabRow>
        key={size}
        rows={rows}
        columns={columns}
        height={440}
        virtualizeRows
        enableConditionalFormatting
        initialConditionalFormats={FORMATS}
        conditionalFormatNow={now}
        onSortChange={onSort}
        onFilterChange={(e) => log("onFilterChange", e)}
        onColorFilterChange={(e) => log("onColorFilterChange", e)}
        onColorSortChange={(e) => log("onColorSortChange", e)}
        onConditionalFormatsChange={(f) => log("onConditionalFormatsChange", Object.keys(f))}
      />
      <EventLog api={events} />
    </>
  );
}

export const scenario = defineScenario({
  id: "pipeline",
  area: "Data & formulas",
  order: 5,
  title: "Sort / filter / conditional formatting at scale",
  summary:
    "Up to 250,000 virtualized rows with sort timing, numeric and date-tree filters, colour filter/sort, and conditional-format rules (value, between, text, blank, time period).",
  checks,
  Body,
});
