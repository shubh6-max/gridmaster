# GridMaster Feature Lab

A manual test bed for every `gridmaster-react` feature. Dev/test tool only: it lives under `demo/`
and is **not** shipped (the package `files` list is just `dist`).

## Run it

```bash
npm run lab            # from the repo root; opens http://localhost:5173/lab.html
```

`npm run dev` still serves the showcase demo at `/`; `npm run build:demo` builds both pages into
`packages/gridmaster-react/demo-dist/` (`index.html` and `lab.html`).

The lab uses hash routing (`#/formulas`), so a reload keeps your scenario. Checklist ticks are saved
in `localStorage` (`gm-lab:<scenarioId>:<n>`); "Reset all checks" in the header clears them.

## Add a scenario

1. Create `demo/lab/scenarios/<name>.tsx`. Export `scenario = defineScenario({ id, area, order, title,
   summary, checks, Body })`, where `Body` is a React component that renders the `GridMaster` (plus
   `<EventLog api={events} />` when it emits events). Copy a small one such as `pointer.tsx`.
2. That is all: `registry.ts` globs `scenarios/*.tsx` and sorts by `order`, so there is nothing to
   register. The sidebar entry, progress badge and overview row appear automatically.

Each check is `{ do, expect }` ("Do X -> expect Y"), written so a non-expert can verify it. Use
`known: "..."` for a library bug you found while writing the check, and `pending: true` for
placeholders that a future task will fill in (shown under "Coming in A2-A9", not counted).

Helpers in `kit.tsx`: `makeRows(n, seed)` (deterministic 1k-250k rows), `labColumns()`,
`useEventLog()` / `<EventLog>` (newest first, capped at 200, JSON-safe summaries), `<Toggle>`,
`<Select>`, `copyText()`.

## Convention

**Every new feature or task adds its scenario, or a checklist item to an existing scenario, here.**
The accessibility inspector (`scenarios/accessibility.tsx`) is a registry: add a row to
`INSPECTOR_ROWS` with one line.

`tests/dom/lab-smoke.test.tsx` mounts every registered scenario under StrictMode and fails on any
`console.error`, so a broken scenario is caught by `npm test`.
