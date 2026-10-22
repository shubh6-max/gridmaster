// Scenario: editing, editors & validation. Language: TypeScript 6 (strict), React 19.
import { useMemo, useState } from "react";
import { GridMaster, type GridColumnDef, createColumnFactory } from "../../../src";
import { type Check, EventLog, Select, Toggle, defineScenario, useEventLog } from "../kit";

type EditRow = {
  id: number;
  name: string;
  amount: number | null;
  status: string;
  active: boolean;
  joined: string;
  website: string;
  rating: number;
};

const c = createColumnFactory<EditRow>();
const STATUS_OPTIONS = ["Open", "In progress", "Closed"];
const URLS = [
  "https://example.com",
  "HTTP://EXAMPLE.COM",
  "mailto:team@example.com",
  "tel:+15551234567",
  "example.com",
  "javascript:alert(1)",
  "data:text/html,<b>x</b>",
  "https://example.org/path?x=1",
];

function makeRows(): EditRow[] {
  return URLS.map((website, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    amount: (i + 1) * 100,
    // Row 2 deliberately stores a value that is NOT in the select's options.
    status: i === 1 ? "Archived" : STATUS_OPTIONS[i % STATUS_OPTIONS.length],
    active: i % 2 === 0,
    joined: `2024-0${(i % 9) + 1}-1${i % 9}`,
    website,
    rating: (i % 5) + 1,
  }));
}

const checks: Check[] = [
  {
    do: 'Look at row 2\'s Status cell (value "Archived", not in the options list). Open its editor (double-click) and press Escape.',
    expect: 'The cell shows "Archived" (not blank, not the first option) before and after; Escape leaves it unchanged.',
  },
  {
    do: "Click an Active checkbox once; click another with the mouse, then press Space on a third.",
    expect: "Each click or Space toggles exactly once: the log shows ONE onCellChange per action, never two.",
  },
  {
    do: "Set locale de-DE, double-click an Amount cell, type 1.234,56 and press Enter.",
    expect: "The cell commits 1234.56 (one onCellChange with value 1234.56).",
  },
  {
    do: "Double-click an Amount cell, type abc and press Enter; then press Escape.",
    expect: "The editor stays open with an invalid (red) state and no onCellChange; Escape restores the previous value.",
  },
  {
    do: "Clear a Name cell (select, Delete) and set an Amount to 5000 or -5.",
    expect: "The cells get an advisory error indicator (hover for the message: required / max 1000 / min 0) but the value is still committed; onValidationChange logs. Untick enableValidation: indicators vanish.",
  },
  {
    do: "Inspect the Website column (right-click → Inspect on each link).",
    expect:
      "Only https:/http:/mailto:/tel: render as links (<a target=_blank rel contains noopener and noreferrer); HTTP:// in capitals is allowed. example.com, javascript: and data: render as PLAIN text, never as <a>.",
  },
  {
    do: 'Click "Re-render parent in 3 s", immediately double-click a Name cell, type "xyz" (do not press Enter) and wait 3 seconds.',
    expect: "The typed draft and caret survive the parent re-render (nothing resets or commits).",
  },
  {
    do: "Double-click a Name cell and press Enter without changing anything.",
    expect: "No onCellChange line is logged for an unchanged commit.",
  },
];

function Body() {
  const events = useEventLog();
  const { log } = events;
  const [rows, setRows] = useState<EditRow[]>(makeRows);
  const [locale, setLocale] = useState("en-US");
  const [validate, setValidate] = useState(true);
  const [tick, setTick] = useState(0);

  const columns = useMemo<GridColumnDef<EditRow>[]>(
    () => [
      c.number("id", { title: "ID", width: 60, editable: false }),
      c.text("name", { width: 140, validations: [{ type: "required", message: "Name is required" }] }),
      c.number("amount", {
        width: 100,
        validations: [
          { type: "min", value: 0, message: "Must be >= 0" },
          { type: "max", value: 1000, message: "Must be <= 1000" },
        ],
      }),
      c.select("status", { options: STATUS_OPTIONS, width: 120 }),
      c.checkbox("active", { width: 80 }),
      c.date("joined", { width: 120 }),
      c.link("website", { width: 220 }),
      c.custom("rating", {
        width: 110,
        renderCell: ({ value }) => <span aria-label={`${value} stars`}>{"★".repeat(Number(value) || 0)}</span>,
        renderEditor: ({ value, commit, cancel }) => (
          <select
            ref={(el) => el?.focus()}
            defaultValue={String(value ?? 1)}
            aria-label="Rating"
            onChange={(e) => commit(Number(e.target.value))}
            onKeyDown={(e) => e.key === "Escape" && cancel()}
            onBlur={() => cancel()}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        ),
      }),
    ],
    []
  );

  return (
    <>
      <div className="lab-controls">
        <Select label="locale" value={locale} options={["en-US", "de-DE"]} onChange={setLocale} />
        <Toggle label="enableValidation" checked={validate} onChange={setValidate} />
        <button type="button" onClick={() => setTimeout(() => setTick((n) => n + 1), 3000)}>
          Re-render parent in 3 s
        </button>
        <span className="lab-muted">parent renders triggered: {tick}</span>
      </div>
      <GridMaster<EditRow>
        rows={rows}
        columns={columns}
        height={380}
        locale={locale}
        enableValidation={validate}
        onRowsChange={(next) => setRows(next)}
        onCellChange={(e) => log("onCellChange", { at: `${e.columnKey}${e.rowIndex + 1}`, from: e.previousValue, to: e.value })}
        onValidationChange={(errors) => log("onValidationChange", { errors: Object.keys(errors).length })}
      />
      <EventLog api={events} />
    </>
  );
}

export const scenario = defineScenario({
  id: "editing",
  area: "Editing & columns",
  order: 8,
  title: "Editing, editors & validation",
  summary:
    "One column of every type: select with an out-of-list value, checkbox, locale-aware number, validation rules, a link column with safe and unsafe URLs, and a custom editor.",
  checks,
  Body,
});
