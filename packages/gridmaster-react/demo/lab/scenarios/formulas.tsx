// Scenario: formulas. Language: TypeScript 6 (strict), React 19.
// Column letters are positional (first column = A), so the demo sheet uses keys a..f.
import { useMemo, useState } from "react";
import {
  GridMaster,
  type GridColumnDef,
  type GridRow,
  columnLetter,
  createColumnFactory,
  evaluateGridCell,
} from "../../../src";
import { type Check, EventLog, Select, defineScenario, useEventLog } from "../kit";

const g = createColumnFactory();
type Cell = string | number | null;
type SheetLine = [Cell, Cell, Cell, Cell, Cell, Cell];

const KINDS = ["sheet", "chain", "block"] as const;
const KIND_LABEL: Record<string, string> = {
  sheet: "Demo sheet",
  chain: "500-row dependency chain",
  block: "200,000-cell SUM (2,000 × 100)",
};

const checks: Check[] = [
  {
    do: "Demo sheet: select E1 and drag its fill handle (small square at the bottom-right corner) down to E5.",
    expect:
      "E2 = 3, E3 = 11, E4 = 100 (blank B4 counts as 0), E5 = #VALUE! (B5 is text). Click E2: the formula bar shows =A2+B2 (references shifted by one row).",
  },
  {
    do: "Fill E27 (=$A$1+B1) down into E28.",
    expect: "E28 shows 12 and its formula bar reads =$A$1+B2: the $A$1 part stays, B1 shifted to B2.",
  },
  {
    do: "Compare every value in column E with the text in column F.",
    expect:
      "All match, in particular IFERROR=0, AVERAGE ignores the blank, COUNT=3, =2^3^2 → 64, & and %, VLOOKUP/INDEX/MATCH, EDATE → 2024-02-29, DATEDIF=2, and the errors #DIV/0!, #NAME?, #CYCLE! (E23 and E24).",
  },
  {
    do: "Right-click row header 1 → Insert row above.",
    expect: "Every formula reference moves down one row (the old =A1+B1 now sits in row 2 and reads =A2+B2) and all values stay unchanged.",
  },
  {
    do: "Right-click row header 3 → Delete row (the row holding 5, 6, 7).",
    expect: "The cell that was =A3*2 now shows #REF!, and =SUM(A1:A3) shrinks its range and still evaluates.",
  },
  {
    do: "Press Ctrl+Z once after the delete.",
    expect: "ONE undo step restores the row, the formulas and the values together (nothing stays #REF!).",
  },
  {
    do: "Sort column A ascending (header click), then fill E1 down a few rows.",
    expect:
      "Filled formulas refer to the row each cell actually lives on (its source row), not to its position on screen; values are consistent with that row's A and B.",
    known:
      "Expectation written from the task brief (fill under sort uses source-row references); confirm the exact formula text on first run.",
  },
  {
    do: 'Switch the dataset to "500-row dependency chain", then "200,000-cell SUM".',
    expect:
      "Chain: A500 shows 500 and the readout agrees, no #CYCLE!/#ERROR!. Block: the readout shows the evaluated SUM equal to the expected sum, with the evaluation time; scrolling stays smooth.",
  },
];

function sheetLines(): SheetLine[] {
  const sheet: Record<number, SheetLine> = {
    1: [10, 20, 30, "Fill-down: drag E1 down to E5", "=A1+B1", "30; after fill E2..E5 = 3, 11, 100, #VALUE!"],
    2: [1, 2, 3, null, null, null],
    3: [5, 6, 7, null, null, null],
    4: [100, null, 300, "(B4 is blank)", null, null],
    5: [4, "text", 8, "(B5 is text)", null, null],
    6: [null, null, null, "IFERROR", "=IFERROR(1/0,0)", "0"],
    7: [null, null, null, "AVERAGE over a blank", "=AVERAGE(B1:B4)", "9.3333 (blank ignored)"],
    8: [null, null, null, "COUNT with blank/text", "=COUNT(B1:B5)", "3"],
    9: [null, null, null, "MIN", "=MIN(A1:A5)", "1"],
    10: [null, null, null, "MAX", "=MAX(A1:A5)", "100"],
    11: [null, null, null, "^ is left-associative", "=2^3^2", "64"],
    12: [null, null, null, "& concatenation", '="a"&"b"&A1', "ab10"],
    13: [null, null, null, "% operator", "=A1*50%", "5"],
    14: [null, null, null, "VLOOKUP exact", "=VLOOKUP(20,A31:C35,2,FALSE)", "twenty"],
    15: [null, null, null, "VLOOKUP approximate", "=VLOOKUP(25,A31:C35,3,TRUE)", "200"],
    16: [null, null, null, "INDEX", "=INDEX(B31:B35,3)", "twenty"],
    17: [null, null, null, "MATCH exact", "=MATCH(30,A31:A35,0)", "4"],
    18: [null, null, null, "MATCH approximate", "=MATCH(25,A31:A35,1)", "3"],
    19: [null, null, null, "EDATE month-end clamp", '=EDATE("2024-01-31",1)', "2024-02-29"],
    20: [null, null, null, "DATEDIF months", '=DATEDIF("2024-01-15","2024-03-20","M")', "2"],
    21: [null, null, null, "Divide by zero", "=A1/0", "#DIV/0!"],
    22: [null, null, null, "Unknown function", "=FOOBAR(1)", "#NAME?"],
    23: [null, null, null, "Cycle (E23 <-> E24)", "=E24", "#CYCLE!"],
    24: [null, null, null, "Cycle (E24 -> E23)", "=E23", "#CYCLE!"],
    25: [null, null, null, "SUM of A1:A3", "=SUM(A1:A3)", "16"],
    26: [null, null, null, "A3*2 (delete row 3 → #REF!)", "=A3*2", "10"],
    27: [null, null, null, "Anchored: fill E27 down to E28", "=$A$1+B1", "30; E28 after fill = 12"],
    31: [0, "zero", 0, "VLOOKUP table (A31:C35)", null, null],
    32: [10, "ten", 100, null, null, null],
    33: [20, "twenty", 200, null, null, null],
    34: [30, "thirty", 300, null, null, null],
    35: [40, "forty", 400, null, null, null],
  };
  return Array.from({ length: 35 }, (_, i) => sheet[i + 1] ?? [null, null, null, null, null, null]);
}

function build(kind: string): { rows: GridRow[]; columns: GridColumnDef[] } {
  if (kind === "block") {
    const columns = Array.from({ length: 100 }, (_, j) => g.number(`c${j}`, { title: columnLetter(j), width: 70 }));
    const rows: GridRow[] = Array.from({ length: 2001 }, (_, i) => {
      const row: GridRow = {};
      for (let j = 0; j < 100; j += 1) row[`c${j}`] = i === 0 ? (j === 0 ? "=SUM(A2:CV2001)" : null) : (i * 7 + j * 3) % 10;
      return row;
    });
    return { rows, columns };
  }
  const columns = [
    g.number("a", { title: "A", width: 90 }),
    g.number("b", { title: "B", width: 90 }),
    g.number("c", { title: "C", width: 90 }),
    g.text("d", { title: "D", width: 230 }),
    g.text("e", { title: "E", width: 200 }),
    g.text("f", { title: "F", width: 300 }),
  ];
  const lines: SheetLine[] =
    kind === "chain"
      ? Array.from({ length: 500 }, (_, i) => [i === 0 ? 1 : `=A${i}+1`, null, null, null, null, null])
      : sheetLines();
  const rows: GridRow[] = lines.map(([a, b, c, d, e, f]) => ({ a, b, c, d, e, f }));
  return { rows, columns };
}

function expectedBlockSum(): number {
  let sum = 0;
  for (let i = 1; i <= 2000; i += 1) for (let j = 0; j < 100; j += 1) sum += (i * 7 + j * 3) % 10;
  return sum;
}
const blockSum = expectedBlockSum();

function Sheet({ kind }: { kind: string }) {
  const events = useEventLog();
  const { log } = events;
  const initial = useMemo(() => build(kind), [kind]);
  const [rows, setRows] = useState<GridRow[]>(initial.rows);

  // Library-side evaluation of the headline cell, timed (re-runs after every edit).
  const readout = useMemo(() => {
    if (kind === "sheet") return null;
    const cell = kind === "chain" ? 499 : 0;
    const start = performance.now();
    const result = evaluateGridCell(rows, initial.columns, cell, initial.columns[0]);
    const ms = performance.now() - start;
    return { value: result.error ?? String(result.value), ms, expected: kind === "chain" ? 500 : blockSum };
  }, [kind, rows, initial.columns]);

  return (
    <>
      {readout ? (
        <div className="lab-panel" data-testid="formula-readout">
          {kind === "chain" ? "Bottom cell A500" : "SUM cell A1"} evaluated by the library: <b>{readout.value}</b> in{" "}
          <b>{readout.ms.toFixed(1)} ms</b>
          {` (expected ${readout.expected})`}
        </div>
      ) : null}
      <GridMaster<GridRow>
        rows={rows}
        columns={initial.columns}
        height={440}
        virtualizeRows
        onRowsChange={(next) => {
          setRows(next);
          log("onRowsChange", next);
        }}
        onCellChange={(e) => log("onCellChange", { at: `${e.columnKey}${e.rowIndex + 1}`, value: e.value })}
        onRowInsert={(e) => log("onRowInsert", e.rowIndex)}
        onRowDelete={(e) => log("onRowDelete", e.rowIndex)}
      />
      <EventLog api={events} />
    </>
  );
}

function Body() {
  const [kind, setKind] = useState<string>("sheet");
  return (
    <>
      <div className="lab-controls">
        <Select label="Dataset" value={kind} options={KINDS} onChange={setKind} format={(v) => KIND_LABEL[v]} />
        <span className="lab-muted">Column F shows the expected result of the formula in column E.</span>
      </div>
      <Sheet key={kind} kind={kind} />
    </>
  );
}

export const scenario = defineScenario({
  id: "formulas",
  area: "Data & formulas",
  order: 3,
  title: "Formulas",
  summary:
    "A small sheet of formulas (functions, operators, errors, cycles) plus two stress datasets: a 500-deep dependency chain and a 200,000-cell SUM.",
  checks,
  Body,
});
