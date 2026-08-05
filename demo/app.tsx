import React, { useMemo, useRef, useState } from "react";
import {
  GridMaster,
  createColumnFactory,
  createEditableGridPreset,
  createCompactGridPreset,
  createReadonlyGridPreset,
  getFilteredColorOptionsForColumn,
  resolveColumns,
} from "../src";
import type {
  GridCellMeta,
  GridColorFilters,
  GridColorSort,
  GridFilters,
} from "../src";
import "./demo.css";

/* ------------------------------------------------------------------ */
/*  Data constants                                                     */
/* ------------------------------------------------------------------ */

const CORP = ["Helios","Nova","Atlas","Vantage","Quanta","Meridian","Orbital","Lumen","Falcon","Solstice","Vertex","Harbor","Cobalt","Prism","Tundra","Ember","Zenith","Alpine","Ironbridge","Cascade"] as const;
const SUFFIX = ["Pharma","Retail","Industries","Capital","Health","Logistics","Energy","Group","Tech","Mobility"] as const;
const INDUSTRIES = ["Pharmaceuticals","Retail","Consumer Goods","Manufacturing","Financial Services","Healthcare","Energy","Technology"] as const;
const REGIONS = ["US","LATAM","EU","APAC","Middle-east","ROW"] as const;
const BIZ_UNITS = ["Commercial","Consumer","Finance","Manufacturing","Market access","Marketing","Medical affairs","Operations","Revenue","Supply Chain"] as const;
const OWNERS = ["Shashank K","Ayush J","Pradeep V","Prashanth S","Andy S","Srilekha K","Chandler J","Indu S","Pawan V","Pradipt D","Vedant P","William D","Abhinav S","Jayeeta S"] as const;
const STATUSES = ["Stakeholder","DND","M1 generated","Grey Response","Unsubscribe"] as const;
const HEALTH = ["On track","At risk","Off track"] as const;

const HEALTH_TINT: Record<string, string> = { "On track": "#E5F5EA", "At risk": "#FEF1DB", "Off track": "#FEE2E2" };
const HEALTH_SWATCH: Record<string, string> = { "On track": "#17A34A", "At risk": "#D97706", "Off track": "#DC2626" };

const NOTES = [
  "Strategic account — priority outreach scheduled.",
  "New relationship — needs Q3 check-in.",
  "Renewal approaching — pipeline review pending.",
  "",
  "No recent engagement — reactivation candidate.",
  "Key partner for APAC expansion.",
  "Strong relationship — can lead references.",
  "Risk of churn — escalate to leadership.",
];

/* ------------------------------------------------------------------ */
/*  Deterministic row generator                                         */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T extends readonly unknown[]>(arr: T, rng: () => number): T[number] =>
  arr[Math.floor(rng() * arr.length)];

function isoDate(offsetDays: number): string {
  const d = new Date(Date.UTC(2026, 4, 1));
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

type DemoRow = {
  id: string;
  account: string;
  industry: string;
  region: string;
  businessUnit: string;
  owner: string;
  status: string;
  health: (typeof HEALTH)[number];
  spend: number;
  lastEngagement: string;
  email: string;
  notes: string;
  isPriority: boolean;
};

function buildRows(count: number): DemoRow[] {
  const rng = mulberry32(1337);
  const rows: DemoRow[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rng();
    const health = roll < 0.55 ? "On track" : roll < 0.85 ? "At risk" : "Off track";
    const spend =
      Math.round(
        (health === "On track" ? 40 + rng() * 160 : health === "At risk" ? 15 + rng() * 80 : 5 + rng() * 30) *
          10,
      ) / 10;
    const account = `${pick(CORP, rng)} ${pick(SUFFIX, rng)}`;
    rows.push({
      id: `a${String(i + 1).padStart(5, "0")}`,
      account,
      industry: pick(INDUSTRIES, rng),
      region: pick(REGIONS, rng),
      businessUnit: pick(BIZ_UNITS, rng),
      owner: pick(OWNERS, rng),
      status: pick(STATUSES, rng),
      health,
      spend,
      lastEngagement: isoDate((i * 13) % 120),
      email: `${account.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      notes: pick(NOTES, rng),
      isPriority: spend > 140,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Column definitions                                                  */
/* ------------------------------------------------------------------ */

const createColumn = createColumnFactory<DemoRow>();

const columns = [
  createColumn.text("account", { title: "Account", frozen: true, width: 190, sortable: true, filterable: true }),
  createColumn.select("industry", { title: "Industry", options: [...INDUSTRIES], width: 160, sortable: true, filterable: true }),
  createColumn.select("region", { title: "Region", options: [...REGIONS], filterOptions: [...REGIONS], width: 120, sortable: true, filterable: true }),
  createColumn.select("businessUnit", { title: "Business unit", options: [...BIZ_UNITS], width: 170, sortable: true, filterable: true }),
  createColumn.select("owner", { title: "Owner", options: [...OWNERS], width: 150, sortable: true, filterable: true }),
  createColumn.select("status", { title: "Status", options: [...STATUSES], filterOptions: [...STATUSES], width: 140, sortable: true, filterable: true }),
  createColumn.text("health", { title: "Health", readonly: true, filterable: true, sortable: true, width: 115 }),
  createColumn.number("spend", { title: "Annual spend ($M)", width: 155, sortable: true, filterable: true }),
  createColumn.date("lastEngagement", { title: "Last engagement", width: 140, sortable: true, filterable: true }),
  createColumn.link("email", { title: "Email", width: 210 }),
  createColumn.text("notes", { title: "Notes", width: 220 }),
];

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

export default function App() {
  const [rows, setRows] = useState<DemoRow[]>(() => buildRows(250));
  const [preset, setPreset] = useState<"editable" | "compact" | "readonly">("editable");
  const [priorityFirst, setPriorityFirst] = useState(false);
  const [viewEpoch, setViewEpoch] = useState(0);
  const [viewState, setViewState] = useState({
    sort: false,
    filters: 0,
    colorSort: null as string | null,
    colorFilters: 0,
  });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);

  const resolvedColumns = useMemo(() => resolveColumns(columns), []);

  const presetProps = useMemo(() => {
    if (preset === "editable") return createEditableGridPreset<DemoRow>();
    if (preset === "compact") return createCompactGridPreset<DemoRow>();
    return createReadonlyGridPreset<DemoRow>();
  }, [preset]);

  const allowedRowIds = useMemo(() => {
    if (!priorityFirst) return undefined;
    const prio = rows.filter((r) => r.isPriority).map((r) => r.id);
    const rest = rows.filter((r) => !r.isPriority).map((r) => r.id);
    return [...prio, ...rest];
  }, [priorityFirst, rows]);

  /* --- callbacks -------------------------------------------------- */

  const getCellMeta = React.useCallback(
    (row: DemoRow, _idx: number, key: string): GridCellMeta | undefined => {
      if (key === "health") return { backgroundColor: HEALTH_TINT[row.health] ?? undefined, horizontalAlign: "center" as const };
      if (key === "spend") return { horizontalAlign: "right" as const };
      if (key === "notes") return { wrap: true };
      return undefined;
    },
    [],
  );

  const getRowMeta = React.useCallback((row: DemoRow) => {
    if (row.account === "Helios Pharma") return { readonly: true };
    if (row.isPriority) return { className: "gm-demo-priority" };
    return undefined;
  }, []);

  const resolveColorOptions = React.useCallback(
    (key: string, filters: GridFilters, colorFilters: GridColorFilters) => {
      if (key !== "health") return [];
      return getFilteredColorOptionsForColumn(rows, resolvedColumns, "health", filters, colorFilters).map(
        (o) => ({
          value: o.value,
          label: o.value,
          count: o.count,
          swatch: HEALTH_SWATCH[o.value] ?? null,
        }),
      );
    },
    [rows, resolvedColumns],
  );

  const getColorSourceColumnKey = React.useCallback((key: string) => (key === "health" ? "health" : null), []);
  const isColorMenuEnabled = React.useCallback((key: string) => key === "health", []);

  const handleSave = React.useCallback(() => {
    window.clearTimeout(toastTimer.current);
    setToast("Snapshot saved");
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  }, []);

  const changeRows = (n: number) => {
    setRows(buildRows(n));
    setPriorityFirst(false);
    setViewState({ sort: false, filters: 0, colorSort: null, colorFilters: 0 });
    setViewEpoch((v) => v + 1);
  };

  const resetView = () => {
    setRows(buildRows(rows.length));
    setPriorityFirst(false);
    setViewState({ sort: false, filters: 0, colorSort: null, colorFilters: 0 });
    setViewEpoch((v) => v + 1);
  };

  const rowKind = preset === "compact" ? "Compact" : preset === "readonly" ? "Read-only" : "Editable";

  return (
    <div className="demo-shell">
      {/* ---- masthead ---- */}
      <header className="demo-masthead">
        <div className="demo-brand">
          <span className="demo-brand-mark" aria-hidden="true">
            ▦
          </span>
          <div>
            <h1 className="demo-title">GridMaster</h1>
            <p className="demo-tagline">Excel-like grid for React — account portfolio demo</p>
          </div>
        </div>
        <div className="demo-masthead-right">
          <span className="demo-pill demo-pill-live">
            <span className="dot dot-live" aria-hidden="true" />
            live
          </span>
          <span className="demo-pill">v0.1.1</span>
        </div>
      </header>

      {/* ---- controls ---- */}
      <section className="demo-controls" role="group" aria-label="Demo controls">
        <div className="demo-control-group">
          <span className="demo-control-label">Rows</span>
          <div className="demo-segmented" role="radiogroup" aria-label="Row count">
            {[50, 250, 1000].map((n) => (
              <button
                key={n}
                className={rows.length === n ? "active" : ""}
                onClick={() => changeRows(n)}
                role="radio"
                aria-checked={rows.length === n}
                type="button"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="demo-control-group">
          <span className="demo-control-label">Preset</span>
          <div className="demo-segmented" role="radiogroup" aria-label="Grid preset">
            {(["editable", "compact", "readonly"] as const).map((p) => (
              <button
                key={p}
                className={preset === p ? "active" : ""}
                onClick={() => setPreset(p)}
                role="radio"
                aria-checked={preset === p}
                type="button"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <button
          className={`demo-toggle ${priorityFirst ? "on" : ""}`}
          onClick={() => setPriorityFirst((v) => !v)}
          aria-pressed={priorityFirst}
          type="button"
        >
          {priorityFirst ? "★" : "☆"} Priority first
        </button>
        <button className="demo-text-btn" onClick={resetView} type="button">
          Reset
        </button>
      </section>

      {/* ---- status strip (signature) ---- */}
      <div className="demo-status" aria-live="polite">
        <span className="demo-chip">
          <span className="dot dot-on" aria-hidden="true" /> {rows.length} rows
        </span>
        <span className="demo-chip">
          <span className="dot dot-on" aria-hidden="true" /> virtualized
        </span>
        <span className="demo-chip">
          <span className={`dot ${viewState.sort ? "dot-on" : ""}`} aria-hidden="true" /> sort {viewState.sort ? "on" : "off"}
        </span>
        <span className="demo-chip">
          <span className={`dot ${viewState.filters ? "dot-on" : ""}`} aria-hidden="true" />{" "}
          {viewState.filters} filter{viewState.filters === 1 ? "" : "s"}
        </span>
        <span className="demo-chip">
          <span className={`dot ${viewState.colorSort ? "dot-signal" : ""}`} aria-hidden="true" /> color {viewState.colorSort ? viewState.colorSort.split(":")[1] : "sort off"}
        </span>
        <span className="demo-chip">
          <span className={`dot ${viewState.colorFilters ? "dot-signal" : ""}`} aria-hidden="true" /> {viewState.colorFilters} color
        </span>
        <span className="demo-chip">
          <span className="dot dot-on" aria-hidden="true" /> {rowKind}
        </span>
      </div>

      {/* ---- grid card ---- */}
      <main className="demo-grid-card">
        <div className="demo-grid-card-header">
          <span className="demo-grid-card-label">Portfolio overview</span>
          <div className="demo-signal-key" aria-label="Health color key">
            {HEALTH.map((h) => (
              <span key={h} className="demo-signal-chip">
                <i style={{ background: HEALTH_SWATCH[h] }} aria-hidden="true" />
                {h}
              </span>
            ))}
          </div>
        </div>

        <GridMaster<DemoRow>
          key={viewEpoch}
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          {...presetProps}
          virtualizeRows
          overscanRowCount={12}
          historyLimit={60}
          rowPatchMode
          frozenColumns={1}
          height={560}
          width="100%"
          getRowMeta={getRowMeta}
          getCellMeta={getCellMeta}
          resolveColorOptions={resolveColorOptions}
          getColorSourceColumnKey={getColorSourceColumnKey}
          isColorMenuEnabled={isColorMenuEnabled}
          allowedRowIds={allowedRowIds}
          onSaveShortcut={handleSave}
          onSortChange={({ sort }) => setViewState((v) => ({ ...v, sort: !!sort }))}
          onFilterChange={({ filters }) =>
            setViewState((v) => ({ ...v, filters: Object.keys(filters).length }))
          }
          onColorSortChange={({ colorSort: cs }) =>
            setViewState((v) => ({
              ...v,
              colorSort: cs ? `${cs.columnKey}:${cs.value}` : null,
            }))
          }
          onColorFilterChange={({ colorFilters: cf }) =>
            setViewState((v) => ({ ...v, colorFilters: Object.keys(cf).length }))
          }
        />
      </main>

      {/* ---- hints ---- */}
      <footer className="demo-hints">
        <span>
          <kbd>Ctrl</kbd>+<kbd>S</kbd> saves a snapshot
        </span>
        <span>
          Open the <strong>Health</strong> column menu <kbd>⋮</kbd> to filter or sort by color
        </span>
        <span>
          Try resizing columns — <strong>Account</strong> is frozen
        </span>
      </footer>

      {toast && (
        <div className="demo-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
