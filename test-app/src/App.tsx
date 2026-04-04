import React, { useState } from "react";
import { GridMaster, createColumnFactory } from "gridmaster-react";
import "gridmaster-react/styles.css";

type TaskRow = {
  id: number;
  task: string;
  owner: string;
  status: string;
  priority: string;
  region: string;
  dueDate: string;
  estimate: number | null;
  ticket: string;
  notes: string;
};

const ownerOptions = ["Asha", "Rahul", "Mara", "Jonas", "Priyanka"] as const;
const statusOptions = ["Backlog", "Planned", "In Progress", "Review", "Done"] as const;
const priorityOptions = ["Low", "Medium", "High", "Critical"] as const;
const regionOptions = ["US", "EU", "APAC", "LATAM"] as const;
const createColumn = createColumnFactory<TaskRow>();

const columns = [
  createColumn.text("task", {
    title: "Task",
    width: 220,
  }),
  createColumn.select("owner", {
    title: "Owner",
    width: 140,
    options: [...ownerOptions],
  }),
  createColumn.select("status", {
    title: "Status",
    width: 150,
    options: [...statusOptions],
  }),
  createColumn.select("priority", {
    title: "Priority",
    width: 140,
    options: [...priorityOptions],
  }),
  createColumn.select("region", {
    title: "Region",
    width: 130,
    options: [...regionOptions],
  }),
  createColumn.date("dueDate", {
    title: "Due Date",
    width: 140,
  }),
  createColumn.number("estimate", {
    title: "Estimate (hrs)",
    width: 140,
  }),
  createColumn.link("ticket", {
    title: "Ticket Link",
    width: 220,
  }),
  createColumn.text("notes", {
    title: "Notes",
    width: 260,
    wrap: true,
    hidden: true,
  }),
];

const initialRows: TaskRow[] = [
  {
    id: 1,
    task: "Polish toolbar sizing",
    owner: "Asha",
    status: "Done",
    priority: "High",
    region: "US",
    dueDate: "2026-04-06",
    estimate: 6,
    ticket: "github.com/shubh6-max/gridmaster/issues/101",
    notes: "Use this row to confirm readonly display, styling, and selection states.",
  },
  {
    id: 2,
    task: "Validate dropdown arrow behavior",
    owner: "Rahul",
    status: "Review",
    priority: "Critical",
    region: "EU",
    dueDate: "2026-04-08",
    estimate: 4,
    ticket: "github.com/shubh6-max/gridmaster/issues/102",
    notes: "Click the caret in Owner or Status to open the dropdown directly.",
  },
  {
    id: 3,
    task: "Check context-menu row delete",
    owner: "Mara",
    status: "Planned",
    priority: "High",
    region: "APAC",
    dueDate: "2026-04-11",
    estimate: 3,
    ticket: "github.com/shubh6-max/gridmaster/issues/103",
    notes: "Right-click a row header to verify insert and delete actions.",
  },
  {
    id: 4,
    task: "Check context-menu column delete",
    owner: "Jonas",
    status: "In Progress",
    priority: "Medium",
    region: "LATAM",
    dueDate: "2026-04-12",
    estimate: 5,
    ticket: "github.com/shubh6-max/gridmaster/issues/104",
    notes: "Right-click a column header to verify insert and delete actions.",
  },
  {
    id: 5,
    task: "Try fill handle and formulas",
    owner: "Priyanka",
    status: "Backlog",
    priority: "Low",
    region: "US",
    dueDate: "2026-04-15",
    estimate: 2,
    ticket: "github.com/shubh6-max/gridmaster/issues/105",
    notes: "Estimate column is good for fill-handle testing after selecting 2 cells.",
  },
];

const checks = [
  "Click dropdown carets in select columns and confirm the menu opens immediately.",
  "Right-click row and column headers to verify insert and delete actions.",
  "Check the merged Clipboard + Font toolbar section and divider styling.",
  "Use keyboard selection and fill handle behavior across multiple cells.",
  "Toggle hidden Notes column from the header controls.",
];

export default function App() {
  const [rows, setRows] = useState<TaskRow[]>(initialRows);

  return (
    <div className="qa-shell">
      <section className="qa-hero">
        <div className="qa-hero-copy">
          <p className="qa-kicker">Published Package Smoke Test</p>
          <h1>GridMaster React test app using the npm library build</h1>
          <p>
            This app imports <strong>gridmaster-react</strong> from npm and exercises the
            latest toolbar, dropdown, and context-menu behavior in a lightweight QA surface.
          </p>
        </div>

        <div className="qa-stats">
          <article>
            <span>Package</span>
            <strong>gridmaster-react</strong>
          </article>
          <article>
            <span>Rows</span>
            <strong>{rows.length}</strong>
          </article>
          <article>
            <span>Frozen</span>
            <strong>2 columns</strong>
          </article>
        </div>
      </section>

      <section className="qa-layout">
        <aside className="qa-panel">
          <h2>What To Check</h2>
          <ul className="qa-checks">
            {checks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>

        <main className="qa-grid-card">
          <div className="qa-grid-header">
            <div>
              <p className="qa-grid-kicker">Manual QA</p>
              <h2>Interactive validation grid</h2>
            </div>
            <span className="qa-chip">npm package consumer</span>
          </div>

          <GridMaster<TaskRow>
            rows={rows}
            columns={columns}
            getRowId={(row) => String(row.id)}
            onRowsChange={setRows}
            width="100%"
            height={460}
            frozenColumns={2}
          />
        </main>
      </section>
    </div>
  );
}
