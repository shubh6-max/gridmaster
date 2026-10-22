// Scenario: clipboard. Language: TypeScript 6 (strict), React 19.
import { useMemo, useState } from "react";
import { GridMaster, type GridClipboardValueMode, type GridRow, createColumnFactory } from "../../../src";
import { type Check, EventLog, Select, copyText, defineScenario, useEventLog } from "../kit";

const g = createColumnFactory();

const SAMPLES: { label: string; text: () => string }[] = [
  { label: "Tab-separated numbers (2×3)", text: () => "1\t2\t3\n4\t5\t6" },
  { label: "RFC-4180 quoted multi-line cell", text: () => '"Line 1\nLine 2 ""quoted"""\tnext' },
  { label: "Locale text 1.234,56", text: () => "1.234,56\n2.345,67" },
  { label: "Unparseable number (abc)", text: () => "abc\t5" },
  { label: "Excel-style CRLF block (2×2)", text: () => "a\tb\r\nc\td\r\n" },
  { label: "Formula text =A1+B1", text: () => "=A1+B1" },
  {
    label: "10,000-cell block (1000×10)",
    text: () =>
      Array.from({ length: 1000 }, (_, i) =>
        Array.from({ length: 10 }, (_, j) => String(i * 10 + j)).join("\t")
      ).join("\n"),
  },
];

const checks: Check[] = [
  {
    do: 'Click "Tab-separated numbers". In the grid drag-select from D6 UP-LEFT to B4 (start at the bottom-right), press Ctrl+V.',
    expect:
      "Pasting starts at the selection's TOP-LEFT cell (B4), not at the cell where the drag began; the 2×3 block fills B4:D5. Log: onPaste applied=6, skipped total=0.",
  },
  {
    do: 'Click "RFC-4180 quoted multi-line cell", select C1 and paste.',
    expect: 'C1 holds one two-line value (Line 1 / Line 2 "quoted") and D1 holds "next"; the log shows applied=2.',
  },
  {
    do: 'Choose locale de-DE, click "Locale text 1.234,56", select C8 and paste. Then switch to en-US and paste again at C10.',
    expect:
      "de-DE: C8 = 1234.56 and C9 = 2345.67. en-US: the text is not a valid number, so the cells keep their old values and the log reports skipped.unparseable = 2.",
  },
  {
    do: 'Click "Unparseable number (abc)", select C12 (a number column) and paste.',
    expect: 'C12 keeps its previous value (not blanked), D12 receives 5, and onPaste reports skipped.unparseable = 1.',
  },
  {
    do: 'Click "Excel-style CRLF block", select A14 and paste.',
    expect: "Exactly a 2×2 block lands in A14:B15: no extra empty row or column from the trailing CRLF.",
  },
  {
    do: 'Click "Formula text =A1+B1", paste into a cell, then select I1 (a formula) and press Ctrl+C with clipboardValueMode = raw, paste into the outside textarea; repeat with "displayed".',
    expect:
      "Pasting formula text makes a live formula. raw copies the source text (=C2+D2); displayed copies the computed number.",
  },
  {
    do: "Cut with a failing clipboard: in your browser site settings set Clipboard to Block (reload), select a cell with text, press Ctrl+X.",
    expect: "The log shows onClipboardError (action: cut) and the source cell is NOT cleared. Restore the permission afterwards.",
  },
  {
    do: 'Click "10,000-cell block", select A1, press Ctrl+V, then press Ctrl+Z once.',
    expect: "The 1000×10 block pastes (log: applied=10000, skipped 0; the last column K is read-only and untouched) and a SINGLE Ctrl+Z reverts all of it.",
  },
];

function Body() {
  const events = useEventLog();
  const { log } = events;
  const [error, setError] = useState("");
  const [mode, setMode] = useState<GridClipboardValueMode>("raw");
  const [locale, setLocale] = useState("en-US");

  const columns = useMemo(
    () => [
      g.text("k0", { title: "A", width: 100 }),
      g.text("k1", { title: "B", width: 130 }),
      ...Array.from({ length: 8 }, (_, j) => g.number(`k${j + 2}`, { title: String.fromCharCode(67 + j), width: 90 })),
      g.text("k10", { title: "K (read-only)", width: 110, readonly: true }),
    ],
    []
  );
  const [rows, setRows] = useState<GridRow[]>(() =>
    Array.from({ length: 1000 }, (_, i) => {
      const row: GridRow = { k0: `r${i + 1}`, k1: `item ${i + 1}`, k10: "locked" };
      for (let j = 2; j <= 9; j += 1) row[`k${j}`] = i + j;
      if (i === 0) row.k8 = "=C2+D2";
      return row;
    })
  );

  const put = async (text: string) => {
    const err = await copyText(text);
    setError(err ? `navigator.clipboard.writeText failed: ${err}` : "");
    log("clipboard.writeText", err ? `FAILED ${err}` : `${text.length} chars`);
  };

  return (
    <>
      <div className="lab-controls">
        {SAMPLES.map((sample) => (
          <button key={sample.label} type="button" onClick={() => put(sample.text())}>
            {sample.label}
          </button>
        ))}
      </div>
      {error ? <div className="lab-error" role="alert">{error}</div> : null}
      <div className="lab-controls">
        <Select label="clipboardValueMode" value={mode} options={["raw", "displayed"]} onChange={(v) => setMode(v === "displayed" ? "displayed" : "raw")} />
        <Select label="locale" value={locale} options={["en-US", "de-DE", "fr-FR"]} onChange={setLocale} />
        <label className="lab-select">
          Outside textarea (paste here to inspect copied text){" "}
          <textarea rows={2} cols={40} />
        </label>
      </div>
      <GridMaster<GridRow>
        rows={rows}
        columns={columns}
        height={360}
        virtualizeRows
        clipboardValueMode={mode}
        locale={locale}
        onRowsChange={(next) => setRows(next)}
        onCopy={(e) => log("onCopy", { isCut: e.isCut, rows: e.rows.length })}
        onPaste={(e) =>
          log("onPaste", {
            applied: e.applied,
            skipped: e.skipped
              ? { total: e.skipped.total, overflow: e.skipped.overflow, readonly: e.skipped.readonly, unparseable: e.skipped.unparseable }
              : null,
          })
        }
        onCellChange={(e) => log("onCellChange", { at: `${e.columnKey}${e.rowIndex + 1}`, value: e.value })}
        onClipboardError={(e) => log("onClipboardError", { action: e.action, error: String(e.error) })}
      />
      <EventLog api={events} />
    </>
  );
}

export const scenario = defineScenario({
  id: "clipboard",
  area: "Data & formulas",
  order: 4,
  title: "Clipboard",
  summary:
    "Put tricky text on the system clipboard with the buttons, then paste it into the grid. Covers quoting, CRLF, locale numbers, unparseable cells, formulas, cut failure and 10k-cell undo.",
  checks,
  Body,
});
