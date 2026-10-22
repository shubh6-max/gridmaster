// Shared helpers for the Feature Lab scenarios. DEV/TEST tool: lives under demo/, never shipped.
// Language: TypeScript 6 (strict), React 19.
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type GridColumnDef, createColumnFactory } from "../../src";
import pkg from "../../package.json";

export const LIB_VERSION: string = pkg.version;

/* ------------------------------------------------------------------ */
/*  Scenario model + checklist persistence                             */
/* ------------------------------------------------------------------ */

/** One manual check: "Try this -> Expect that". `pending` items are placeholders for future tasks. */
export type Check = { do: string; expect: string; known?: string; pending?: boolean };

export type ScenarioDef = {
  id: string;
  area: string;
  /** Sort position in the sidebar (ascending). */
  order: number;
  title: string;
  summary: string;
  checks: Check[];
  Component: ComponentType;
};

const PREFIX = "gm-lab:";
const checkKey = (id: string, n: number) => `${PREFIX}${id}:${n}`;
// In-memory mirror so checks still work (for this tab) when localStorage throws or is blocked.
const memory = new Map<string, boolean>();
const listeners = new Set<() => void>();
let version = 0;

function bump(): void {
  version += 1;
  for (const listener of listeners) listener();
}

export function isChecked(id: string, n: number): boolean {
  const key = checkKey(id, n);
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return memory.get(key) === true;
  }
}

export function setChecked(id: string, n: number, value: boolean): void {
  const key = checkKey(id, n);
  memory.set(key, value);
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable: the in-memory mirror above keeps the UI consistent
  }
  bump();
}

export function resetAllChecks(): void {
  memory.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable: nothing persisted to clear
  }
  bump();
}

/** Re-render whenever any checkbox changes (also returns the version, rarely needed). */
export function useChecksVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version
  );
}

/** Done / total over the real (non-pending) checks of a scenario. */
export function scenarioProgress(def: Pick<ScenarioDef, "id" | "checks">): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (let n = 0; n < def.checks.length; n += 1) {
    if (def.checks[n].pending) continue;
    total += 1;
    if (isChecked(def.id, n)) done += 1;
  }
  return { done, total };
}

/* ------------------------------------------------------------------ */
/*  Scenario wrapper                                                   */
/* ------------------------------------------------------------------ */

function CheckItem({ id, n, check }: { id: string; n: number; check: Check }) {
  useChecksVersion();
  return (
    <li className={check.pending ? "lab-check lab-check-pending" : "lab-check"}>
      <label>
        <input
          type="checkbox"
          checked={isChecked(id, n)}
          disabled={check.pending}
          onChange={(event) => setChecked(id, n, event.target.checked)}
        />
        <span>
          <span className="lab-check-do">
            <b>Try:</b> {check.do}
          </span>
          <span className="lab-check-expect">
            <b>Expect:</b> {check.expect}
          </span>
          {check.known ? <span className="lab-check-known">Known issue: {check.known}</span> : null}
        </span>
      </label>
    </li>
  );
}

export function Scenario(props: {
  id: string;
  title: string;
  summary: string;
  checks: Check[];
  children: ReactNode;
}) {
  const { id, title, summary, checks, children } = props;
  useChecksVersion();
  const { done, total } = scenarioProgress({ id, checks });
  const active = checks.filter((check) => !check.pending);
  const pending = checks.filter((check) => check.pending);
  return (
    <section className="lab-scenario" data-scenario={id}>
      <header className="lab-scenario-head">
        <h2>{title}</h2>
        <p>{summary}</p>
      </header>
      <div className="lab-scenario-body">
        <div className="lab-demo">{children}</div>
        <aside className="lab-checks" aria-label="Checklist">
          <h3>
            Checklist{" "}
            <span className="lab-badge" data-testid="progress">
              {done}/{total}
            </span>
          </h3>
          <ol>
            {active.map((check) => (
              <CheckItem key={check.do} id={id} n={checks.indexOf(check)} check={check} />
            ))}
          </ol>
          {pending.length > 0 ? (
            <>
              <h4>Coming in A2–A9</h4>
              <ol>
                {pending.map((check) => (
                  <CheckItem key={check.do} id={id} n={checks.indexOf(check)} check={check} />
                ))}
              </ol>
            </>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

/** Build a registry entry: the file supplies metadata + a Body component; the wrapper is added here. */
export function defineScenario(
  def: Omit<ScenarioDef, "Component"> & { Body: ComponentType }
): ScenarioDef {
  const { Body, ...meta } = def;
  const Component = () => (
    <Scenario id={meta.id} title={meta.title} summary={meta.summary} checks={meta.checks}>
      <Body />
    </Scenario>
  );
  return { ...meta, Component };
}

/* ------------------------------------------------------------------ */
/*  Event log                                                          */
/* ------------------------------------------------------------------ */

export type LogEntry = { id: number; time: string; name: string; summary: string };
const LOG_CAP = 200;
const SUMMARY_MAX = 200;

function summarizeInner(value: unknown, depth: number): string {
  if (value === null || value === undefined) return String(value);
  switch (typeof value) {
    case "string":
      return JSON.stringify(value.length > 60 ? `${value.slice(0, 57)}…` : value);
    case "number":
    case "boolean":
    case "bigint":
      return String(value);
    case "function":
      return "fn";
    case "symbol":
      return "symbol";
    default:
      break;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "InvalidDate" : value.toISOString();
  if (value instanceof Set) return `Set(${value.size})`;
  if (value instanceof Map) return `Map(${value.size})`;
  if (Array.isArray(value)) {
    const first: unknown = value[0];
    const hasId = typeof first === "object" && first !== null && "id" in first;
    return `[${value.length} items${hasId ? `, first id=${String((first as { id: unknown }).id)}` : ""}]`;
  }
  if (depth >= 2) return "{…}";
  const entries = Object.entries(value as Record<string, unknown>);
  const shown = entries.slice(0, 8).map(([k, v]) => `${k}: ${summarizeInner(v, depth + 1)}`);
  const more = entries.length > 8 ? `, …+${entries.length - 8}` : "";
  return `{ ${shown.join(", ")}${more} }`;
}

/** JSON-safe, bounded one-line summary: counts / first-row id instead of dumping rows. */
export function summarize(value: unknown): string {
  let text: string;
  try {
    text = summarizeInner(value, 0);
  } catch {
    text = "(unsummarisable)";
  }
  return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1)}…` : text;
}

export type EventLogApi = {
  entries: LogEntry[];
  /** Stable identity: safe to call from inline callbacks. */
  log: (name: string, payload?: unknown) => void;
  clear: () => void;
};

export function useEventLog(): EventLogApi {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const seq = useRef(0);
  const log = useCallback((name: string, payload?: unknown) => {
    seq.current += 1;
    const entry: LogEntry = {
      id: seq.current,
      time: new Date().toISOString().slice(11, 23),
      name,
      summary: payload === undefined ? "" : summarize(payload),
    };
    setEntries((prev) => [entry, ...prev].slice(0, LOG_CAP));
  }, []);
  const clear = useCallback(() => setEntries([]), []);
  return { entries, log, clear };
}

/** Copy text to the system clipboard; resolves to an error message, or null on success. */
export async function copyText(text: string): Promise<string | null> {
  try {
    await navigator.clipboard.writeText(text);
    return null;
  } catch (error) {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
}

export function EventLog({ api, title = "Event log" }: { api: EventLogApi; title?: string }) {
  const [copyStatus, setCopyStatus] = useState("");
  const onCopy = async () => {
    const text = api.entries.map((e) => `${e.time} ${e.name} ${e.summary}`).join("\n");
    const error = await copyText(text);
    setCopyStatus(error ? `Copy failed: ${error}` : "Copied");
  };
  return (
    <div className="lab-log">
      <div className="lab-log-head">
        <b>{title}</b> <span className="lab-muted">({api.entries.length}, newest first, max {LOG_CAP})</span>
        <button type="button" onClick={api.clear}>
          Clear
        </button>
        <button type="button" onClick={onCopy}>
          Copy log
        </button>
        {copyStatus ? <span className="lab-muted">{copyStatus}</span> : null}
      </div>
      <ul data-testid="event-log">
        {api.entries.map((entry) => (
          <li key={entry.id}>
            <span className="lab-muted">{entry.time}</span> <b>{entry.name}</b> {entry.summary}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small controls                                                     */
/* ------------------------------------------------------------------ */

export function Toggle(props: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="lab-toggle">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />{" "}
      {props.label}
    </label>
  );
}

export function Select(props: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
  /** Optional display text per option value. */
  format?: (value: string) => string;
}) {
  return (
    <label className="lab-select">
      {props.label}{" "}
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option) => (
          <option key={option} value={option}>
            {props.format ? props.format(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Deterministic data                                                 */
/* ------------------------------------------------------------------ */

export type LabRow = {
  id: number;
  name: string;
  email: string;
  city: string;
  amount: number | null;
  qty: number | null;
  status: string;
  active: boolean;
  joined: string;
  website: string;
  notes: string;
};

export const STATUSES = ["Open", "In progress", "Closed", "Blocked"];
const FIRST = ["Asha", "Ben", "Cara", "Dev", "Esha", "Femi", "Gus", "Hana", "Ivan", "Jia"];
const LAST = ["Patel", "Stone", "Ito", "Roy", "Khan", "Silva", "Novak", "Lee", "Ortiz", "Moss"];
const CITIES = ["Chicago", "Bangalore", "Pune", "Austin", "Berlin", "Lyon", "Osaka", "Lagos"];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Memoised per (n, seed); only the two most recent sizes are kept so 250k rows do not pile up.
const rowCache = new Map<string, LabRow[]>();

/** Deterministic rows (same n + seed => identical data). ~5% of amount/qty cells are blank (null). */
export function makeRows(n: number, seed = 1): LabRow[] {
  const key = `${n}:${seed}`;
  const hit = rowCache.get(key);
  if (hit) return hit;
  const rand = mulberry32(seed);
  const rows: LabRow[] = new Array<LabRow>(n);
  for (let i = 0; i < n; i += 1) {
    const id = i + 1;
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    const day = Math.floor(rand() * 730); // 2023-01-01 .. 2024-12-30
    rows[i] = {
      id,
      name: `${first} ${last}`,
      email: `${first}.${last}${id}@example.com`.toLowerCase(),
      city: CITIES[Math.floor(rand() * CITIES.length)],
      amount: rand() < 0.05 ? null : Math.floor(rand() * 1001),
      qty: rand() < 0.05 ? null : 1 + Math.floor(rand() * 10),
      status: STATUSES[Math.floor(rand() * STATUSES.length)],
      active: rand() < 0.5,
      joined: new Date(Date.UTC(2023, 0, 1 + day)).toISOString().slice(0, 10),
      website: `https://example.com/u/${id}`,
      notes: rand() < 0.08 ? `VIP customer #${id}` : `Note ${id}`,
    };
  }
  if (rowCache.size >= 2) {
    const oldest = rowCache.keys().next().value;
    if (oldest !== undefined) rowCache.delete(oldest);
  }
  rowCache.set(key, rows);
  return rows;
}

export const col = createColumnFactory<LabRow>();

/** The standard lab column set (fresh array each call; memoise at the call site if identity matters). */
export function labColumns(): GridColumnDef<LabRow>[] {
  return [
    col.number("id", { title: "ID", width: 70, editable: false }),
    col.text("name", { width: 150 }),
    col.text("email", { width: 220 }),
    col.text("city", { width: 110 }),
    col.number("amount", { width: 100 }),
    col.number("qty", { width: 80 }),
    col.select("status", { options: STATUSES, width: 120 }),
    col.checkbox("active", { width: 80 }),
    col.date("joined", { width: 120, filterTree: "date" }),
    col.link("website", { width: 200 }),
    col.text("notes", { width: 200 }),
  ];
}
