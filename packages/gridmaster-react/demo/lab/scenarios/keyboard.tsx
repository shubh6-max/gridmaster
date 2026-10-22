// Scenario: keyboard & focus. Language: TypeScript 6 (strict), React 19.
import { useMemo, useState } from "react";
import { GridMaster } from "../../../src";
import {
  type Check,
  EventLog,
  type EventLogApi,
  type LabRow,
  Select,
  defineScenario,
  labColumns,
  makeRows,
  useEventLog,
} from "../kit";

const checks: Check[] = [
  {
    do: "Click the text input before the grids, then press Tab repeatedly.",
    expect:
      "Focus goes input → button → select → grid A's toolbar controls → grid A cells; Tab then walks A's cells and, at the LAST cell, the next Tab LEAVES grid A (no keyboard trap) into grid B.",
  },
  {
    do: "Click the first cell of grid A, press Shift+Tab.",
    expect: "Focus leaves the grid backwards at the FIRST cell (it does not wrap or get stuck).",
  },
  {
    do: 'Set tabNavigation = "native", click a cell, press Tab.',
    expect: "Tab never moves the cell cursor: it moves browser focus to the next focusable element. Switch back to cells afterwards.",
  },
  {
    do: "Tab to a grid toolbar button (e.g. Bold) and press Enter.",
    expect: "The button acts, but the grid's cell cursor does NOT move (the log shows no onSelectionChange).",
  },
  {
    do: "Click a cell in grid B and press arrow keys; then type in the input above the grids.",
    expect: 'Only "B:" selection events appear (grid A never moves). Typing in the outside input produces only "outside input" lines and changes no grid.',
  },
  {
    do: "In one grid: PageDown / PageUp, Ctrl+Home, Ctrl+End, Ctrl+Arrow, Home, End; then hold Shift with arrows.",
    expect:
      "PageUp/Down move a screenful; Ctrl+Home/End jump to the first/last cell; Ctrl+Arrow jumps to the edge of data; Home/End go to row start/end; Shift extends the selection from the anchor.",
  },
  {
    do: "Edit a cell in grid A, click grid B, press Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+X, Ctrl+V.",
    expect: "These act only in the focused grid (B); grid A's edit is not undone and its cells are untouched.",
  },
  {
    do: "With an IME (e.g. Japanese or Chinese) press F2 on a cell and start composing text; press Enter to pick a candidate.",
    expect:
      "While composing, Enter / arrows / Tab belong to the IME: the first Enter confirms the candidate and does NOT commit the cell or move the cursor; only a second Enter commits.",
  },
];

function GridPane({ name, tab, api }: { name: string; tab: "cells" | "native"; api: EventLogApi }) {
  const [rows, setRows] = useState<LabRow[]>(() => makeRows(60, name === "A" ? 3 : 4));
  const columns = useMemo(() => labColumns().slice(0, 6), []);
  return (
    <div>
      <b>Grid {name}</b>
      <GridMaster<LabRow>
        rows={rows}
        columns={columns}
        height={280}
        tabNavigation={tab}
        onRowsChange={setRows}
        onSelectionChange={(e) =>
          api.log(`${name}:onSelectionChange`, { cursor: e.selection.cursor, mode: e.selection.mode })
        }
        onCellChange={(e) => api.log(`${name}:onCellChange`, { at: `${e.columnKey}${e.rowIndex + 1}`, value: e.value })}
      />
    </div>
  );
}

function Outside({ where, api }: { where: string; api: EventLogApi }) {
  return (
    <div className="lab-controls">
      <b>{where}</b>
      <input aria-label={`${where} text input`} placeholder="type here" onChange={(e) => api.log(`outside input (${where})`, e.target.value)} />
      <button type="button" onClick={() => api.log(`outside button (${where})`)}>
        Button
      </button>
      <select aria-label={`${where} select`} onChange={(e) => api.log(`outside select (${where})`, e.target.value)}>
        <option>one</option>
        <option>two</option>
      </select>
    </div>
  );
}

function Body() {
  const events = useEventLog();
  const [tab, setTab] = useState<"cells" | "native">("cells");
  return (
    <>
      <Outside where="Before" api={events} />
      <div className="lab-controls">
        <Select label="tabNavigation" value={tab} options={["cells", "native"]} onChange={(v) => setTab(v === "native" ? "native" : "cells")} />
      </div>
      <div className="lab-pair">
        <GridPane name="A" tab={tab} api={events} />
        <GridPane name="B" tab={tab} api={events} />
      </div>
      <Outside where="After" api={events} />
      <EventLog api={events} />
    </>
  );
}

export const scenario = defineScenario({
  id: "keyboard",
  area: "Interaction",
  order: 6,
  title: "Keyboard & focus",
  summary:
    "Two grids side by side with plain inputs around them. Verifies Tab does not trap focus, key handling is scoped to the focused grid, and navigation / clipboard / undo shortcuts behave.",
  checks,
  Body,
});
