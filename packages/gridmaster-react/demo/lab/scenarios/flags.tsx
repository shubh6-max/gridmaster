// Scenario: feature flags + read-only meta. Language: TypeScript 6 (strict), React 19.
import { useMemo, useState } from "react";
import { GridMaster, type GridMasterProps, type GridMode } from "../../../src";
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

const BOOL_FLAGS = [
  "enableEditing",
  "enableClipboard",
  "enableSelection",
  "enableRangeSelection",
  "enableRowSelection",
  "enableColumnSelection",
  "enableFillHandle",
  "enableUndoRedo",
  "enableValidation",
  "enableCellColoring",
  "enableWrapText",
  "enableSorting",
  "enableFiltering",
  "enableColumnResize",
  "showToolbar",
  "showFormulaBar",
  "showStatusBar",
  "virtualizeRows",
] as const;
type BoolFlag = (typeof BOOL_FLAGS)[number];

const checks: Check[] = [
  {
    do: 'Set mode = "readonly". Try typing in a cell, F2, Delete, paste (Ctrl+V), and drag the fill handle.',
    expect: "Nothing changes and NO onCellChange / onRowsChange lines appear. Copy, sort and filter still work.",
  },
  {
    do: "Back in editable mode, click a Status cell in row ID 5 or 10 (greyed). Try typing, Delete, pasting over it, and filling across it.",
    expect:
      "Those cells are read-only (getCellMeta): typing opens no editor, Delete/paste/fill skip them. Status cells of other rows still edit.",
  },
  {
    do: 'Tick "Make row ID 3 read-only (getRowMeta)". Try editing, toggling the Active checkbox and pasting in row 3.',
    expect: "The whole row refuses every write; other rows still edit.",
  },
  {
    do: "Untick enableEditing. Double-click a cell, press F2, type, and look at the formula bar.",
    expect: "No editor opens anywhere (cell, formula bar, checkbox, fill, cut, paste).",
  },
  {
    do: "Untick enableClipboard, select a cell, press Ctrl+C / Ctrl+X / Ctrl+V.",
    expect: "Nothing is copied or pasted, and the toolbar copy/cut/paste buttons are disabled.",
  },
  {
    do: "Untick enableSelection, then click a cell and Shift+click another.",
    expect: "Only the active cell is highlighted; no range, row or column selection.",
  },
  {
    do: "Untick enableUndoRedo, edit a cell, press Ctrl+Z.",
    expect: "The edit is NOT undone.",
  },
  {
    do: "Set frozenColumns = 2 and scroll horizontally; also try virtualizeRows off/on and showToolbar/showFormulaBar/showStatusBar off.",
    expect: "The first two columns stay pinned while scrolling; hidden bars disappear and the grid stays usable.",
  },
];

function Body() {
  const events = useEventLog();
  const { log } = events;
  const [mode, setMode] = useState<GridMode>("editable");
  const [frozen, setFrozen] = useState("0");
  const [row3, setRow3] = useState(false);
  const [flags, setFlags] = useState<Record<BoolFlag, boolean>>(() =>
    Object.fromEntries(BOOL_FLAGS.map((flag) => [flag, flag !== "virtualizeRows"])) as Record<
      BoolFlag,
      boolean
    >
  );
  const [rows, setRows] = useState<LabRow[]>(() => makeRows(200, 2));
  const columns = useMemo(() => labColumns(), []);

  const getCellMeta: GridMasterProps<LabRow>["getCellMeta"] = (row, _i, key) =>
    key === "status" && row.id % 5 === 0 ? { readonly: true } : undefined;
  const getRowMeta: GridMasterProps<LabRow>["getRowMeta"] = (row) =>
    row3 && row.id === 3 ? { readonly: true } : undefined;

  return (
    <>
      <div className="lab-controls">
        <Select
          label="mode"
          value={mode}
          options={["editable", "readonly"]}
          onChange={(v) => setMode(v === "readonly" ? "readonly" : "editable")}
        />
        <Select label="frozenColumns" value={frozen} options={["0", "1", "2", "3"]} onChange={setFrozen} />
        <Toggle label="Make row ID 3 read-only (getRowMeta)" checked={row3} onChange={setRow3} />
      </div>
      <div className="lab-controls">
        {BOOL_FLAGS.map((flag) => (
          <Toggle
            key={flag}
            label={flag}
            checked={flags[flag]}
            onChange={(next) => setFlags((prev) => ({ ...prev, [flag]: next }))}
          />
        ))}
      </div>
      <GridMaster<LabRow>
        rows={rows}
        columns={columns}
        height={380}
        mode={mode}
        frozenColumns={Number(frozen)}
        getCellMeta={getCellMeta}
        getRowMeta={getRowMeta}
        {...flags}
        onRowsChange={(next) => {
          setRows(next);
          log("onRowsChange", next);
        }}
        onCellChange={(e) => log("onCellChange", e)}
        onPaste={(e) => log("onPaste", { applied: e.applied, skipped: e.skipped })}
      />
      <EventLog api={events} />
    </>
  );
}

export const scenario = defineScenario({
  id: "flags",
  area: "State & flags",
  order: 2,
  title: "Flags & read-only",
  summary:
    "Toggle every enable*/show* flag, mode, frozen columns, and per-cell / per-row read-only meta. Read-only means no write path works: typing, paste, fill, Delete, checkbox.",
  checks,
  Body,
});
