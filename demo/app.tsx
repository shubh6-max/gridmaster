import React, { useEffect, useRef, useState } from "react";
import {
  GridMaster,
  createColumn,
  type GridCellEditorProps,
  type GridCellRendererProps,
} from "../src";
import "./demo.css";

type Priority = "Critical" | "High" | "Medium" | "Low";
type Status = "Discovery" | "Build" | "Pilot" | "Live";
type Health = "On Track" | "Watch" | "Risk";

type DemoRow = {
  id: number;
  account: string;
  owner: string;
  series: number | null;
  priority: Priority;
  status: Status;
  budgetK: number;
  forecastK: number | string | null;
  active: boolean;
  launchDate: string;
  website: string;
  health: Health;
  notes: string;
};

const HEALTH_OPTIONS: Health[] = ["On Track", "Watch", "Risk"];
const PRIORITY_OPTIONS: Priority[] = ["Critical", "High", "Medium", "Low"];
const STATUS_OPTIONS: Status[] = ["Discovery", "Build", "Pilot", "Live"];

const healthStyles: Record<Health, { background: string; color: string; borderColor: string }> = {
  "On Track": {
    background: "#dcfce7",
    color: "#166534",
    borderColor: "#86efac",
  },
  Watch: {
    background: "#fef3c7",
    color: "#92400e",
    borderColor: "#fcd34d",
  },
  Risk: {
    background: "#fee2e2",
    color: "#b91c1c",
    borderColor: "#fca5a5",
  },
};

const budgetFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function HealthBadge<T extends DemoRow = DemoRow>({
  value,
}: GridCellRendererProps<T>) {
  const health = (value as Health) ?? "Watch";
  const style = healthStyles[health] ?? healthStyles.Watch;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 88,
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${style.borderColor}`,
        background: style.background,
        color: style.color,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {health}
    </span>
  );
}

function HealthEditor<T extends DemoRow = DemoRow>({
  value,
  updateValue,
  commit,
  cancel,
}: GridCellEditorProps<T>) {
  const [localValue, setLocalValue] = useState<Health>((value as Health) ?? "Watch");
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    setLocalValue((value as Health) ?? "Watch");
  }, [value]);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  return (
    <select
      ref={selectRef}
      value={localValue}
      onChange={(event) => {
        const nextValue = event.target.value as Health;
        setLocalValue(nextValue);
        updateValue(nextValue);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
          return;
        }

        if (event.key === "Tab") {
          event.preventDefault();
          commit();
          return;
        }

        event.stopPropagation();
      }}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        outline: "none",
        background: "transparent",
        fontSize: 12,
        fontFamily: "inherit",
        color: "inherit",
      }}
    >
      {HEALTH_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

const columns = [
  createColumn.text<DemoRow>("account", {
    title: "Account",
    width: 220,
    validate: (value) =>
      String(value ?? "").trim().length >= 3 ? null : "Account name should be at least 3 characters.",
  }),
  createColumn.text<DemoRow>("owner", {
    title: "Owner",
    width: 150,
  }),
  createColumn.number<DemoRow>("series", {
    title: "Series",
    width: 96,
  }),
  createColumn.select<DemoRow>("priority", {
    title: "Priority",
    width: 130,
    options: PRIORITY_OPTIONS,
  }),
  createColumn.select<DemoRow>("status", {
    title: "Status",
    width: 140,
    options: STATUS_OPTIONS,
  }),
  createColumn.number<DemoRow>("budgetK", {
    title: "Budget (K)",
    width: 140,
    formatValue: (value) => (value == null ? "" : `$${budgetFormatter.format(Number(value))}K`),
    validate: (value) => {
      if (value == null) return "Budget is required.";
      if (Number(value) < 50 || Number(value) > 600) {
        return "Budget must stay between 50K and 600K.";
      }

      return null;
    },
  }),
  createColumn.number<DemoRow>("forecastK", {
    title: "Forecast (K)",
    width: 148,
    formatValue: (value) => (value == null || value === "" ? "" : `$${budgetFormatter.format(Number(value))}K`),
  }),
  createColumn.checkbox<DemoRow>("active", {
    title: "Live",
    width: 100,
  }),
  createColumn.date<DemoRow>("launchDate", {
    title: "Launch",
    width: 138,
  }),
  createColumn.link<DemoRow>("website", {
    title: "Website",
    width: 220,
    validate: (value) =>
      String(value ?? "").includes(".") ? null : "Website should include a valid domain.",
  }),
  createColumn.custom<DemoRow>("health", {
    title: "Health",
    width: 132,
    renderCell: (props) => <HealthBadge {...props} />,
    renderEditor: (props) => <HealthEditor {...props} />,
  }),
  createColumn.text<DemoRow>("notes", {
    title: "Notes",
    width: 280,
    wrap: true,
    hidden: true,
  }),
];

const initialRows = [
  {
    id: 1,
    account: "Northwind Retail",
    owner: "Asha",
    priority: "Critical",
    status: "Build",
    budgetK: 420,
    forecastK: "=F1*1.1",
    active: true,
    launchDate: "2026-04-08",
    website: "northwindretail.com",
    health: "On Track",
    notes: "Pricing workbook is hidden by default so the unhide flow can be tested immediately.",
  },
  {
    id: 2,
    account: "BluePeak Health",
    owner: "Rahul",
    priority: "High",
    status: "Pilot",
    budgetK: 260,
    forecastK: "=IF(H2,F2,0)",
    active: true,
    launchDate: "2026-04-15",
    website: "bluepeakhealth.io",
    health: "Watch",
    notes: "Pilot feedback is positive, but mobile approvals still need sign-off.",
  },
  {
    id: 3,
    account: "Atlas Mobility",
    owner: "Neha",
    priority: "Medium",
    status: "Discovery",
    budgetK: 140,
    forecastK: "=SUM(F1:F3)",
    active: false,
    launchDate: "2026-05-03",
    website: "atlasmobility.ai",
    health: "On Track",
    notes: "Requirements workshop is scheduled for next week.",
  },
  {
    id: 4,
    account: "Harbor Energy",
    owner: "Dev",
    priority: "High",
    status: "Build",
    budgetK: 310,
    forecastK: null,
    active: true,
    launchDate: "2026-04-22",
    website: "harborenergy.co",
    health: "Watch",
    notes: "Finance wants one additional approval column before go-live.",
  },
  {
    id: 5,
    account: "Summit Foods",
    owner: "Priya",
    priority: "Low",
    status: "Live",
    budgetK: 120,
    forecastK: null,
    active: true,
    launchDate: "2026-03-27",
    website: "summitfoods.com",
    health: "On Track",
    notes: "This program is stable and useful for sorting plus filter demos.",
  },
  {
    id: 6,
    account: "Lumen Logistics",
    owner: "Ishaan",
    priority: "Critical",
    status: "Pilot",
    budgetK: 500,
    forecastK: null,
    active: false,
    launchDate: "2026-04-29",
    website: "lumenlogistics.net",
    health: "Risk",
    notes: "Data mapping is blocked on warehouse partner extracts.",
  },
  {
    id: 7,
    account: "Verde Finance",
    owner: "Kriti",
    priority: "Medium",
    status: "Build",
    budgetK: 210,
    forecastK: null,
    active: true,
    launchDate: "2026-05-12",
    website: "verdefinance.com",
    health: "Watch",
    notes: "Good candidate for freeze, resize, and column visibility checks.",
  },
  {
    id: 8,
    account: "Orbit Telecom",
    owner: "Rohan",
    priority: "High",
    status: "Discovery",
    budgetK: 160,
    forecastK: null,
    active: false,
    launchDate: "2026-05-18",
    website: "orbittelecom.org",
    health: "Risk",
    notes: "Stakeholders are still aligning on the scorecard definition.",
  },
  {
    id: 9,
    account: "Crescent Pharma",
    owner: "Mira",
    priority: "Critical",
    status: "Live",
    budgetK: 540,
    forecastK: null,
    active: true,
    launchDate: "2026-03-31",
    website: "crescentpharma.com",
    health: "On Track",
    notes: "Use this row for fast link, checkbox, and status edits.",
  },
  {
    id: 10,
    account: "Aurora Travel",
    owner: "Vikram",
    priority: "Low",
    status: "Pilot",
    budgetK: 90,
    forecastK: null,
    active: false,
    launchDate: "2026-05-25",
    website: "auroratravel.co",
    health: "Watch",
    notes: "Notes column becomes handy once it is restored from the visibility manager.",
  },
  {
    id: 11,
    account: "Cobalt Security",
    owner: "Arjun",
    priority: "High",
    status: "Build",
    budgetK: 285,
    forecastK: null,
    active: true,
    launchDate: "2026-05-28",
    website: "cobaltsecurity.io",
    health: "On Track",
    notes: "Useful row when testing horizontal keyboard movement into off-screen cells.",
  },
  {
    id: 12,
    account: "Maple Insurance",
    owner: "Sneha",
    priority: "Medium",
    status: "Pilot",
    budgetK: 235,
    forecastK: null,
    active: false,
    launchDate: "2026-06-02",
    website: "mapleinsurance.com",
    health: "Watch",
    notes: "Good candidate for row selection followed by downward expansion.",
  },
  {
    id: 13,
    account: "Nova Manufacturing",
    owner: "Aditya",
    priority: "Critical",
    status: "Discovery",
    budgetK: 390,
    forecastK: null,
    active: false,
    launchDate: "2026-06-09",
    website: "novamfg.ai",
    health: "Risk",
    notes: "Use this lower row to verify the viewport follows vertical keyboard navigation.",
  },
  {
    id: 14,
    account: "Riverbank Media",
    owner: "Tanvi",
    priority: "Low",
    status: "Live",
    budgetK: 115,
    forecastK: null,
    active: true,
    launchDate: "2026-04-03",
    website: "riverbankmedia.co",
    health: "On Track",
    notes: "Stable account that works well for clipboard checks across larger selections.",
  },
  {
    id: 15,
    account: "Vertex Mining",
    owner: "Kabir",
    priority: "High",
    status: "Pilot",
    budgetK: 330,
    forecastK: null,
    active: true,
    launchDate: "2026-06-14",
    website: "vertexmining.net",
    health: "Watch",
    notes: "Another row near the bottom so keyboard scrolling is easier to spot in the demo.",
  },
  {
    id: 16,
    account: "Pioneer Aerospace",
    owner: "Meera",
    priority: "Critical",
    status: "Build",
    budgetK: 580,
    forecastK: null,
    active: false,
    launchDate: "2026-06-21",
    website: "pioneeraerospace.com",
    health: "Risk",
    notes: "Strong sample for validation, filters, and long-distance arrow movement together.",
  },
  {
    id: 17,
    account: "Beacon Hospitality",
    owner: "Nikhil",
    priority: "Medium",
    status: "Discovery",
    budgetK: 175,
    forecastK: null,
    active: false,
    launchDate: "2026-06-27",
    website: "beaconhospitality.org",
    health: "Watch",
    notes: "Lets the viewport demonstrate downward movement after the first screenful of rows.",
  },
  {
    id: 18,
    account: "Granite Supply",
    owner: "Pooja",
    priority: "Low",
    status: "Live",
    budgetK: 105,
    forecastK: null,
    active: true,
    launchDate: "2026-07-01",
    website: "granitesupply.com",
    health: "On Track",
    notes: "Bottom-row account intended for scroll-follow and range-selection demos.",
  },
].map<DemoRow>((row, index) => ({
  ...row,
  series: index === 0 ? 1 : index === 1 ? 2 : null,
}));

const availableFeatures = [
  "Resize columns from the header handle.",
  "Double-click a resize handle to auto-fit width.",
  "Sort or clear sort from any column menu.",
  "Filter by visible values and clear filters.",
  "Freeze or unfreeze columns through a chosen header.",
  "Hide and show columns, including the Notes column that starts hidden.",
  "Edit text, number, select, checkbox, link, date, and custom cells.",
  "See validation markers on invalid values while editing.",
  "Use Ctrl/Cmd + Shift + Arrow to grow selection by row, column, or both axes.",
  "Move with arrow keys and let the viewport follow when the active cell goes off-screen.",
  "Drag the fill handle or double-click it to continue a numeric series down the grid.",
  "Type spreadsheet formulas like =F1*1.1, =SUM(F1:F3), and =IF(H2,F2,0).",
];

const demoTypes = ["text", "number", "select", "checkbox", "link", "date", "custom"];

const keyboardShortcuts = [
  {
    windows: ["Ctrl", "Shift", "Right"],
    mac: ["Cmd", "Shift", "Right"],
    description: "Select the active row across all visible columns.",
  },
  {
    windows: ["Ctrl", "Shift", "Down"],
    mac: ["Cmd", "Shift", "Down"],
    description: "Expand that selection downward, similar to Excel-style axis growth.",
  },
  {
    windows: ["Alt"],
    mac: ["Option"],
    description: "Can be held as an extra modifier with the same row and column shortcuts.",
  },
];

export default function App() {
  const [rows, setRows] = useState<DemoRow[]>(initialRows);

  return (
    <div className="demo-shell">
      <section className="demo-hero">
        <div>
          <p className="demo-eyebrow">Keyboard navigation demo</p>
          <h1 className="demo-title">Selection shortcuts, auto-scroll, and richer grid movement</h1>
          <p className="demo-copy">
            This sandbox now highlights keyboard-driven row and column selection plus viewport follow.
            Use arrow keys to move into cells that start off-screen, and try <strong>Ctrl/Cmd + Shift</strong>
            with the arrow keys to grow the selection across one axis and then the other. The
            <strong> Series </strong>
            column starts with <strong>1</strong> and <strong>2</strong> so drag-fill and double-click fill-down are easy to test.
            The <strong>Forecast</strong> column also includes live formulas, so selecting one of those cells in the
            formula bar shows the raw expression while the grid keeps showing the computed result.
          </p>
        </div>

        <div className="demo-stat-grid">
          <article className="demo-stat-card">
            <span className="demo-stat-label">Rows</span>
            <strong>{rows.length}</strong>
          </article>
          <article className="demo-stat-card">
            <span className="demo-stat-label">Visible at start</span>
            <strong>10</strong>
          </article>
          <article className="demo-stat-card">
            <span className="demo-stat-label">Hidden at start</span>
            <strong>1</strong>
          </article>
          <article className="demo-stat-card">
            <span className="demo-stat-label">Frozen by default</span>
            <strong>2</strong>
          </article>
        </div>
      </section>

      <div className="demo-layout">
        <aside className="demo-sidebar">
          <section className="demo-card">
            <h2>Available features</h2>
            <ul className="demo-checklist">
              {availableFeatures.map((item) => (
                <li key={item}>
                  <input type="checkbox" checked readOnly />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="demo-card">
            <h2>Column types in this demo</h2>
            <div className="demo-pill-list">
              {demoTypes.map((type) => (
                <span key={type} className="demo-pill">
                  {type}
                </span>
              ))}
            </div>
          </section>

          <section className="demo-card">
            <h2>Keyboard shortcuts to try</h2>
            <div className="demo-shortcut-list">
              {keyboardShortcuts.map((shortcut) => (
                <div key={`${shortcut.windows.join("+")}-${shortcut.mac.join("+")}`} className="demo-shortcut-row">
                  <div className="demo-shortcut-combos">
                    <div className="demo-shortcut-combo">
                      {shortcut.windows.map((key) => (
                        <kbd key={`win-${shortcut.description}-${key}`} className="demo-kbd">
                          {key}
                        </kbd>
                      ))}
                    </div>
                    <div className="demo-shortcut-combo demo-shortcut-combo-secondary">
                      {shortcut.mac.map((key) => (
                        <kbd key={`mac-${shortcut.description}-${key}`} className="demo-kbd">
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                  <p>{shortcut.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="demo-card">
            <h2>Quick things to try</h2>
            <ol className="demo-steps">
              <li>Click Account in the first row, press <strong>Ctrl/Cmd + Shift + Right</strong>, then press <strong>Ctrl/Cmd + Shift + Down</strong>.</li>
              <li>Keep pressing the right arrow until the active cell reaches Website or Health and watch the grid scroll with it.</li>
              <li>Select the first two cells in the <strong>Series</strong> column, then drag the fill handle or double-click it to continue <strong>1, 2, 3, 4...</strong>.</li>
              <li>Select a cell in <strong>Forecast (K)</strong> and confirm the formula bar shows raw entries like <strong>=SUM(F1:F3)</strong> while the cell shows the computed total.</li>
              <li>Open the top-left <strong>+1</strong> badge and restore the hidden Notes column, then continue navigating into it with the keyboard.</li>
            </ol>
          </section>
        </aside>

        <main className="demo-card demo-grid-card">
          <div className="demo-grid-header">
            <div>
              <h2>Program portfolio sandbox</h2>
              <p>
                Sorting, filtering, freezing, formulas, keyboard shortcuts, and viewport auto-scroll are all
                wired into this one data set.
              </p>
            </div>
          </div>

          <GridMaster<DemoRow>
            rows={rows}
            columns={columns}
            getRowId={(row) => String(row.id)}
            onRowsChange={setRows}
            frozenColumns={2}
            width="100%"
            height={460}
          />
        </main>
      </div>
    </div>
  );
}
