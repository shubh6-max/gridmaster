---
description: Run the next batch of the GridCraft port (reads the plan ledger, does one batch, stops at a checkpoint)
argument-hint: "[optional: batch id such as 1D, or notes like 'skip DOLLAR']"
---

Continue the GridCraft port in this repo. Work on ONE batch, then stop.

1. Read `docs/plans/gridcraft-port.md` completely (rules, checkpoint protocol, batch recipe, status ledger)
   and the project `CLAUDE.md` if it exists.
2. Run `git status --short`. If the tree has uncommitted changes to `packages/gridmaster-react/src`
   or `tests`, tell me and stop (a half-done batch or an uncommitted one must be resolved first).
3. Pick the batch: the ledger row marked `NEXT`. If `$ARGUMENTS` names a batch id or trims the list,
   follow that instead. If no row is `NEXT`, tell me and stop.
4. Do that batch exactly as the plan's "Batch recipe" says: implement in `formulas.ts`, add corpus
   cases to `tests/fixtures/formulas-corpus.json`, add the live-sheet lines in
   `demo/lab/scenarios/formula-functions.tsx`, then run every gate (build, `npm test`, typecheck, lint
   with a per-file `biome lint --max-diagnostics=200` on touched files, format:check, build:demo).
   Fix failures at the source; never relax `strict`, never use `any`, never edit
   `tests/fixtures/api-surface.v0.2.0.json`, add no dependencies.
5. **Sample app is mandatory.** Whenever anything is added OR changed, the Feature Lab must let me test
   it by hand (`npm run lab`, see `demo/lab/README.md`). Not done until this holds:
   - New or changed worksheet functions: add or update their lines in the `SHEET` array of
     `demo/lab/scenarios/formula-functions.tsx` (formula + expected result), and add data columns/rows
     if the formulas need them. If an existing function's behaviour changed, fix its old line and its
     corpus cases too.
   - Anything that is not a worksheet function (a new prop, grid feature, rule type, UI behaviour, or a
     change to one): add a new scenario file in `demo/lab/scenarios/` or new `{ do, expect }`
     checklist items to the matching existing scenario, written so a non-expert can verify them.
   - If a change removes or renames something the lab used, update the lab so it still works.
   - `tests/dom/lab-smoke.test.tsx` and `lab-formula-functions.test.tsx` must pass.
6. Update the ledger: this batch -> `DONE (awaiting commit)` with the functions added, case count and
   any behaviour notes; the next `TODO` batch -> `NEXT`.
7. Do NOT commit and do not write a commit message unless I ask. Do not start the next batch.
8. Finish with a short summary that includes a **"How to test it"** part: the command `npm run lab`, the
   page (`http://localhost:5173/lab.html#/<scenario-id>`), and 3-5 specific things to look at or type.
   Then the line `Checkpoint reached: <batch id>, safe to pause.` and what the next batch is.

Run one session at a time: all batches edit `formulas.ts`, so parallel sessions would conflict.
