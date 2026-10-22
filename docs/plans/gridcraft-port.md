# Plan: port GridCraft features into gridmaster-react

**Status ledger is at the bottom. Update it at the end of every session.**

## Goal
GridCraft (https://github.com/storytold/gridcraft, Rust/egui, MIT OR Apache-2.0, alpha) is a feature reference.
Re-implement its *behaviour* in strict TypeScript inside `packages/gridmaster-react/src/`. This is a port of logic,
not a conversion of the app. Do not port: egui UI, Rust engine internals (threading), XLSX/PDF crates.

## Rules (from CLAUDE.md; they win over this file)
- Public API additive only; never edit `tests/fixtures/api-surface.v0.2.0.json`.
- No new dependencies. Strict TS, no `any`. Features are optional props / presets.
- Gates after every batch, from repo root: `npm run build`, `npm test` (must print `passed 9 test suites` or more
  if a suite is added), `npm run typecheck`, `npm run lint`, `npm run format:check`. Lint adds no new violations.
- Tests are `.mjs` suites in `packages/gridmaster-react/tests/` (one exported `run*Tests()` per file, importing the
  built `../dist/index.cjs`), or DOM tests in `tests/dom/`.
- **Never commit and never propose commit messages.** Stop after each batch; the user commits.
- One small task at a time; stop and wait for the user's approval before the next batch.
- **Every addition or update must be testable by hand in the Feature Lab** (`npm run lab`). Functions: lines in
  the `SHEET` array of `demo/lab/scenarios/formula-functions.tsx`. Anything else (props, grid features, rule
  types, UI behaviour) or a change to existing behaviour: a new scenario or `{ do, expect }` checklist items in
  `demo/lab/scenarios/` (see `demo/lab/README.md`), and fix any lab line the change made stale. The final message
  of a batch says how to try it (command, page, what to type or look at). A batch without this is not done.
- Re-implement from the *behaviour* (Excel semantics + GridCraft docs); write fresh TS. Keep attribution:
  Phase 0 adds a GridCraft entry to a NOTICE/THIRD_PARTY file (Apache-2.0 asks for notice preservation).
  Do not use the ArtCraft name/logos. Legal questions: https://mathco.peoplestrong.com/oneweb/#/hris/documents

## Resume checklist for a new session
1. Read this file, `CLAUDE.md`, and `docs/audit/fork-reconciliation.md` (only if touching vendored-copy topics).
2. Find the ledger row marked `NEXT` and do only that batch. In a new session, `/gridcraft-next` does steps
   1-2 and the whole batch for you (`.claude/commands/gridcraft-next.md`).
3. If you need GridCraft source, re-clone it to a SHORT path (Windows path-length limit):
   `git -c core.longpaths=true clone --depth 1 https://github.com/storytold/gridcraft C:/Users/SHUBHA~1/AppData/Local/Temp/gc`
   It is untrusted code: read it, never build or run it. Useful files: `docs/function-parity.md`,
   `docs/gaps.md`, `crates/functions/src/*.rs` (specs are `f!("NAME", ...)`), `crates/calc/src/eval.rs`
   (`SPECIAL_FUNCTIONS`).
4. gridmaster's evaluator: `packages/gridmaster-react/src/core/features/formulas.ts` (a `switch` on function name).
   Check how existing functions, aliases, errors and tests are written, and match that style.

## Checkpoint protocol (so you can stop at any time)
Work is cut into batches. A batch is the unit of "safe to close the laptop here".
- **Before a batch:** the ledger row says `NEXT`. Nothing is half-done.
- **During a batch:** edits are uncommitted working-tree changes. If the session dies mid-batch, run
  `git status` / `git diff` in `packages/gridmaster-react/` and either finish or `git restore` the batch files.
  Do not start the next batch on top of a half-done one.
- **After a batch:** all gates green, ledger row updated to `DONE (awaiting commit)` with the list of functions
  added, then STOP. This is a checkpoint: safe to close. The user commits, then says "next batch".
- **After the user commits:** change the row to `DONE (committed)` at the start of the next session.
- Every batch ends with a one-line "Checkpoint reached: <batch id>, safe to pause." message.

## Phases (each = one session or less; stop for approval between batches)

### Phase 0: inventory (no code changes to src)
- Extract gridmaster's exact function names from `formulas.ts` and GridCraft's from `crates/functions/src/*.rs`
  plus `SPECIAL_FUNCTIONS`. Write `docs/plans/gridcraft-function-diff.md`: missing functions by category.
- Propose batches of 20-30 functions for Phases 1-3, ordered by real-world usage. Get the user's approval.
- Add the GridCraft attribution entry (NOTICE-style file) once the user agrees to the location.

### Phase 1: core math / text / logical / date functions (batches 1A-1E)
Names come from `docs/plans/gridcraft-function-diff.md`. Per batch: implement in `formulas.ts` (or a helper file
under `core/features/` if it gets unwieldy), add a `.mjs` test with Excel-expected values and error cases, run all
gates, update the ledger, stop at the checkpoint. Reuse the existing COUNTIF/SUMIF criteria parser for 1C.
- **1A math basics:** PRODUCT, INT, TRUNC, SIGN, ROUNDUP, ROUNDDOWN, EXP, LN, LOG, LOG10, PI, SUMSQ, QUOTIENT,
  MROUND, EVEN, ODD, FACT, GCD, LCM.
- **1B trig and angles:** SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, SINH, COSH, TANH, ASINH, ACOSH, ATANH, DEGREES,
  RADIANS, COMBIN, SQRTPI, RAND, RANDBETWEEN (RAND* are volatile: check how gridmaster treats TODAY/NOW).
- **1C criteria family:** SUMIFS, COUNTIFS, AVERAGEIFS, MAXIFS, MINIFS, SUMPRODUCT, COUNTBLANK.
- **1D text:** CONCATENATE, TEXTJOIN, SEARCH, REPLACE, REPT, PROPER, VALUE, EXACT, CHAR, CODE, CLEAN, T, UNICHAR,
  UNICODE, TEXTBEFORE, TEXTAFTER, NUMBERVALUE, FIXED, DOLLAR.
- **1E logical, date, info:** TRUE, FALSE, XOR; DATEVALUE, DAYS, HOUR, MINUTE, SECOND, TIME, TIMEVALUE, WEEKNUM,
  ISOWEEKNUM, NETWORKDAYS, WORKDAY, YEARFRAC, DAYS360; ISEVEN, ISODD, ISLOGICAL, ISNONTEXT, N, TYPE, ERROR.TYPE.
- Batch lists are proposals; the user can trim or reorder before a batch starts.

**Batch recipe (learned in 1A):**
- Code: `packages/gridmaster-react/src/core/features/formulas.ts`. Helpers (`excelRound`, `excelRoundDirected`,
  `roundSignificant`, `UNARY_MATH_FUNCTIONS` map for one-number functions) sit near line 1050. Cases go in the eager
  `switch (callee)` after `MOD`; lazy/short-circuit functions go in the first switch. Errors: `GRID_FORMULA_VALUE`
  (#VALUE!), `_NUM`, `_DIV_ZERO`, `_NA`. Coerce with `scalarToNumber` (blank = 0, text = null) or `aggregateNumbers()`.
- Tests: append cases to `packages/gridmaster-react/tests/fixtures/formulas-corpus.json` (fields id, auditId, grid,
  at, formula, expected, note; error expectations are the error string). No new suite, so the suite count stays 21.
  A grid of `[]` has one row only, so ranges past row 1 give #REF!: give the grid enough rows.
  Names that look like cell refs (LOG10, ATAN2, DAYS360) are why the `FOO10` test exists.
- Gates: from repo root, `npm run build`, `npm test` (node suites print `passed 21 test suites`, then vitest
  `395 passed` as of 1E; 1D had 394 and 1E added one lab test), `npm run typecheck`, `npm run lint` (exit 0 but it hides diagnostics; also run
  `npx biome lint <file> --max-diagnostics=200` on touched files and fix any new warning), `npm run format:check`.
- **Sample app step of every batch:** open `demo/lab/scenarios/formula-functions.tsx` and add one line per new
  function to the `SHEET` array (label, formula, expected text; numbers are compared to 1e-12, errors and text
  exactly, booleans as `TRUE`/`FALSE`, and an expected text starting with "a " is free text and skipped). `tests/dom/lab-formula-functions.test.tsx`
  evaluates every line, so a wrong expected value fails `npm test`. Sheet data lives in columns A-B (rows 1-6) and
  G-I (sales table, rows 1-6); add data columns if a batch needs more. Add a checklist item only if the batch has
  behaviour a table can't show (like volatile RAND). The automated results table picks up the new `gc<batch>-*`
  corpus cases by itself. Name corpus ids `gc1c-...`, `gc1d-...` so the table groups them by batch.
- Local vitest quirk: `node_modules/.vitest-cache` can serve a stale `demo/lab/registry.ts` transform, so a brand-new
  scenario file may be missing from `lab-smoke` locally until that cache is cleared
  (`rm -rf node_modules/.vitest-cache`). A fresh checkout/CI is unaffected; the formula-functions test imports the
  scenario directly so it is immune.
- Local vitest quirk 2 (1E): with the default worker count this machine can print `Timeout waiting for worker to
  respond` / `Failed to start forks worker` for a dozen test files (it spawns one worker per file at about 2.7 s
  each). That is not a test failure but it is not a pass either: re-run `npx vitest run --maxWorkers=2` in
  `packages/gridmaster-react` and expect `35 passed (35)` files.
- Time-zone checks (1E): Git Bash drops a `TZ=...` typed in the shell, so Node still runs in the system zone.
  Set it inside the script: `process.env.TZ = "America/Los_Angeles"` before any `Date` is made. Date cases should
  be written to hold in every zone (compare with `DATE(...)`, read parts with `DAY`/`HOUR`); 1E's were run in 12.
- The lab results table shows 100 rows until "Show all" (DOM cost grows with every batch); the count is for all cases.
- CLAUDE.md still says "9 test suites"; the real count is 21. Fix CLAUDE.md when convenient.
- The package dir is not yet tracked at its new path (restructure in progress), so `git diff` does not show these edits.

### Phase 2: lookup and reference
- XLOOKUP, XMATCH, HLOOKUP, LOOKUP, ROW/COLUMN(S), ADDRESS, TRANSPOSE where scalar-friendly. Dynamic-array
  results wait for Phase 4.

### Phase 3: statistical, financial, engineering, information
- STDEV/VAR family, MEDIAN, MODE, LARGE/SMALL, RANK, PERCENTILE, CORREL, PMT/PV/FV/NPV/IRR, base conversions,
  IS* info functions. Batch by category.

### Phase 4: dynamic arrays and LET (design first)
- Design doc before code: how multi-cell results spill, `#SPILL!`, how the evaluator handles array values.
  Then FILTER, SORT, UNIQUE, SEQUENCE, LET, then LAMBDA/MAP/REDUCE if still wanted.
- Needs user sign-off on the design; it changes the evaluator core.

### Phase 5: grid features
- Compare gridmaster's conditional-format and validation rule types against GridCraft's
  (`docs/ui-parity.md`, `crates/model/src/features.rs`), then port gaps as optional props.
- Tables, sort/AutoFilter, fill handle gaps, number formats (`crates/numfmt`).

### Phase 6: charts, pivot tables, sparklines (decision first)
- Charts would likely need a library, which CLAUDE.md forbids. Options: own minimal SVG renderer, sparklines only,
  or skip. Ask the user before any work. Pivot tables: design doc first.

## Status ledger (update each session)
| Phase | Status | Notes |
|---|---|---|
| 0 inventory | DONE (committed) | `gridcraft-function-diff.md` written: gridmaster 57 names, GridCraft 514, 458 missing. Attribution is in root `THIRD_PARTY_NOTICES.md`. |
| 1A math basics | DONE (committed) | Added PRODUCT, INT, TRUNC, SIGN, ROUNDUP, ROUNDDOWN, EXP, LN, LOG, LOG10, PI, SUMSQ, QUOTIENT, MROUND, EVEN, ODD, FACT, GCD, LCM (19). 82 cases `gc1a-*` in `tests/fixtures/formulas-corpus.json`. Old test `log10-unknown` became `cellish-name-unknown` (`=FOO10(100)`) because LOG10 now exists. |
| 1B trig and angles | DONE (committed) | Added SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, SINH, COSH, TANH, ASINH, ACOSH, ATANH, DEGREES, RADIANS, SQRTPI, COMBIN, RAND, RANDBETWEEN (19). 63 cases `gc1b-*`, plus a 5000-draw sampling check for RAND/RANDBETWEEN in `formulas-corpus.test.mjs`. |
| sample app (Feature Lab) | DONE (committed) | New scenario "Formula functions" (`demo/lab/scenarios/formula-functions.tsx`, run with `npm run lab`, hash `#/formula-functions`) plus `tests/dom/lab-formula-functions.test.tsx`. |
| 1C criteria family | DONE (committed) | Added SUMIFS, COUNTIFS, AVERAGEIFS, MAXIFS, MINIFS, SUMPRODUCT, COUNTBLANK (7). 39 cases `gc1c-*`; live-sheet lines + G1:I6 sales table in the lab; 200k-row spot check ran in under 0.6 s. Notes: (1) the value range counts only real numbers (Excel rule, A-006), unlike the older SUMIF/AVERAGEIF which also accept numeric text; (2) criteria go through the existing `matchFormulaCriteria`, so it shares COUNTIF's limits (no `~` wildcard escape); (3) SUMPRODUCT takes ranges and scalars only, array expressions such as `SUMPRODUCT((A1:A3>1)*B1:B3)` need Phase 4. |
| 1D text | DONE (committed) | Added CONCATENATE, TEXTJOIN, SEARCH, REPLACE, REPT, PROPER, VALUE, EXACT, CHAR, CODE, CLEAN, T, UNICHAR, UNICODE, TEXTBEFORE, TEXTAFTER, NUMBERVALUE, FIXED, DOLLAR (19). 243 cases `gc1d-*`; 41 live-sheet lines. Notes: (1) the single-value text functions share one guard (`SCALAR_TEXT_ARITY`): a range argument or a wrong argument count is #VALUE! (no implicit intersection or spill yet); TEXTJOIN takes ranges and checks itself. (2) SEARCH wildcards use a hand-written matcher, not a RegExp: the regex version took 19 s for 4 `*` on 800 characters; the case `gc1d-search-many-stars-no-match` guards it. (3) CHAR/CODE use Windows-1252 as Excel for Windows does (checked against `TextDecoder` for 1-255); CODE gives 63 outside it, UNICHAR/UNICODE cover all of Unicode. (4) VALUE/NUMBERVALUE read numbers only (`$`, `%`, commas, `(1,000)`, e-notation); dates and times are #VALUE! until 1E's DATEVALUE/TIMEVALUE; commas in the integer part are ignored wherever they sit. (5) TEXTBEFORE/TEXTAFTER take one delimiter (no delimiter arrays); the parser has no empty-argument syntax, so `if_not_found` needs the three arguments before it written out. (6) FIXED/DOLLAR: decimals above 100 are #VALUE!; past about 15 significant digits they print the binary expansion (`FIXED(1/3,20)`), and 1e21 or more prints `1e+21` (Excel prints the digits). (7) Text results over 32,767 characters are #VALUE! (CONCATENATE, TEXTJOIN, REPT, REPLACE). (8) Not touched, but found: the older `CONCAT(A1:A3)` returns "1,2,3" because it stringifies the range (Excel gives "123"). (9) No Excel was available: expected values are Microsoft's documented examples plus known behaviour. Least certain: `CODE("Ω")` = 63, `VALUE("(1,000)")` = -1000 and the empty-delimiter TEXTBEFORE/TEXTAFTER cases. |
| 1E logical/date/info | DONE (awaiting commit) | Added TRUE, FALSE, XOR; DATEVALUE, DAYS, HOUR, MINUTE, SECOND, TIME, TIMEVALUE, WEEKNUM, ISOWEEKNUM, NETWORKDAYS, WORKDAY, YEARFRAC, DAYS360; ISEVEN, ISODD, ISLOGICAL, ISNONTEXT, N, TYPE, ERROR.TYPE (23). 531 cases `gc1e-*` (all pass in 12 time zones incl. DST ones); 55 live-sheet lines, a holiday column J1:J3 and 3 checklist items in the lab. Notes: (1) **Date model**: dates stay epoch milliseconds (as DATE/TODAY give); TIME/TIMEVALUE return milliseconds since midnight (`TIME(12,0,0)` = 43200000, Excel shows 0.5), so `DATE(...)+TIME(...)` is a real timestamp. HOUR/MINUTE/SECOND read time text, a number in [0, 86400000) as a time of day, and any other number or Date as a local timestamp. Excel's serial/day-fraction semantics need the audit's `formulaDateMode` (A-043); not done. (2) DATEVALUE/TIMEVALUE use a new strict `parseDateText` (ISO, US `M/D/YYYY`, `22-May-2011`, `15 January 2024`, `Jan 15, 2024`; rejects 2024-02-30 and loose text like "1"), text only; the other date functions still use the older `parseLocalDate` (`new Date(text)` fallback, rolls 30 Feb over). VALUE still does not read dates or times. (3) Day counts (DAYS, NETWORKDAYS, WORKDAY, WEEKNUM, YEARFRAC) use calendar days built in UTC from local parts, so DST never shifts one (`DAYS("2024-03-11","2024-03-09")` = 2 in US zones). (4) WEEKNUM types 1, 2, 11-17, 21 (ISO); others #NUM!. NETWORKDAYS/WORKDAY: Saturday+Sunday weekend only (no .INTL), holidays a range or one date, blanks skipped, non-date holiday #VALUE!; WORKDAY steps day by day and gives #NUM! past 3,000,000 days (`ponytail:` comment). (5) TYPE, ERROR.TYPE, ISLOGICAL, ISNONTEXT are lazy (first switch) so an error argument is an answer (`ISNONTEXT(1/0)` TRUE, `TYPE(1/0)` 16, `ERROR.TYPE(1/0)` 2); `TYPE(range)` is 64 without evaluating. `#ERROR!`/`#CYCLE!` have no Excel code, so ERROR.TYPE gives #N/A for them. Found, not touched: the older ISNUMBER/ISTEXT/ISBLANK return the argument's error where Excel gives FALSE. (6) XOR: references skip text and blanks, typed `"TRUE"`/`"FALSE"` count, other typed text and no logical value at all are #VALUE!. ISEVEN/ISODD: booleans and non-numeric text are #VALUE!. N("5") is 0. (7) `SCALAR_TEXT_ARITY` was renamed `SCALAR_ARITY` (it now also guards the 1E single-value functions). (8) **Lab**: the results table now lists the first 100 rows plus a Show all button (958 rows made one mount take about 7 s in jsdom, near the 20 s test timeout); the count still covers every case; new DOM test for it. vitest is now 395 passed. (9) No Excel available. Least certain: `XOR("TRUE",...)`, TIME's per-argument range 0-32767 (Excel may allow a negative minute when the total stays positive), the end-of-February rules (YEARFRAC basis 0 moves a February-end start only when the end is also February-end, DAYS360 US always does; the two are from POI and LibreOffice, unchecked), YEARFRAC basis 1 (POI's algorithm), and the NETWORKDAYS example numbers (expected values are calendar arithmetic, e.g. 110 for 2012-10-01..2013-03-01; Microsoft's own table was not checked). |
| 2 lookup | NEXT | |
| 3 stat/fin/eng/info | TODO | |
| 4 dynamic arrays + LET | TODO | needs design sign-off |
| 5 grid features | TODO | |
| 6 charts/pivot/sparklines | TODO | needs decision |

Analysis (2026-10-20): GridCraft has 514 function names in code (its doc says 505, likely stale); gridmaster has
57 (the `switch` in `formulas.ts` is the only registry; unknown names return `#NAME?`), so 458 are missing.
No gridmaster source has been changed yet. Extraction scripts were throwaway; to regenerate the diff, parse
`f!(` specs in `crates/functions/src/*.rs` (scalar-arg lists like `&[true, false]` contain commas) plus
`SPECIAL_FUNCTIONS` in `crates/calc/src/eval.rs`, and drop the test-only `ADD2`.
