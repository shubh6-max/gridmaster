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
5. Update the ledger: this batch -> `DONE (awaiting commit)` with the functions added, case count and
   any behaviour notes; the next `TODO` batch -> `NEXT`.
6. Do NOT commit and do not write a commit message unless I ask. Do not start the next batch.
7. Finish with a short summary and the line `Checkpoint reached: <batch id>, safe to pause.`
   Then say what the next batch is.

Run one session at a time: all batches edit `formulas.ts`, so parallel sessions would conflict.
