# GridMaster v2 - Continuation Guide

> **Purpose:** This is the durable handoff for a new Codex/Antigravity chat. Read it before changing the repository. It records implementation status, review decisions, and the workflow required to continue safely.
>
> **Last reviewed:** 2026-08-26
> **Current phase:** Plan 04 is in progress and **not accepted**. Plans 00-03 are accepted.

## 1. Project intent and source of truth

GridMaster is being rebuilt as a React-first data-grid **library**, not as an application. The v2 architecture deliberately separates a framework-neutral core from the React adapter:

```text
packages/core     @gridmaster/core - immutable state, commands, features, selectors
packages/react    @gridmaster/react - React provider, hooks, public component API
apps/playground   Workspace consumer; must use package public entry points
legacy/v1         Archived implementation only; never a dependency of v2
```

Read these documents in order before implementing a plan:

1. [`v2 design`](specs/2026-08-23-gridmaster-v2-design.md) - approved architectural source of truth.
2. [`execution map`](plans/README.md) - required plan order.
3. The specific `docs/superpowers/plans/<NN>-*.md` file - task-level contract and verification.
4. This document - current status, review findings, and handoff rules.

Do not revive v1 compatibility, import from `legacy/v1/`, or restore its large `enableX` prop surface. v2 has no v1 users and intentionally has a small public API.

## 2. Non-negotiable engineering rules

- Preserve existing user changes. The worktree is broadly dirty because v2 is being built in place. Do not reset, checkout, mass-rewrite, or commit unless the user explicitly asks.
- Use CodeGraph first for codebase understanding when `.codegraph/` exists. Use `codegraph explore "<question>"` before `rg` or direct source reading.
- Follow the named plan in numeric order. A plan may not begin until its predecessor is accepted and green.
- Work test-first: add focused failing tests, implement only enough to pass, then run all plan verification commands.
- Do not silently widen a prior plan's public contract. Report an unavoidable interface gap with evidence and wait for a decision.
- Keep state serializable. Caches, subscriptions, abort controllers, DOM objects, and browser globals remain outside `GridState`.
- Core imports neither React nor browser APIs. Browser globals are read only in React effects or event handlers.
- React and React DOM remain peer dependencies and must never be bundled in `@gridmaster/react`.
- Public package barrels expose only documented APIs; do not export internal contexts, reducers, components, or event helpers for convenience.

## 3. Verified plan ledger

| Plan | Status | Deliverable / decision |
| --- | --- | --- |
| 00 - Workspace & quality | Accepted | npm workspace, quality tooling, CI skeleton, and v1 isolation established. |
| 01 - Core contracts & store | Accepted | Framework-neutral state, command/store contracts, `createGrid`, `createGridStore`, and base reducer. |
| 02 - Features & query pipeline | Accepted, with selector-runtime amendment | Feature runtime, selector registration/access, and local query pipeline are available. |
| 03 - Formulas | Accepted | Deterministic parser/evaluator/registry and selector-based formula feature are complete. |
| 04 - React adapter & API | **In progress; revisions required** | Provider/hooks foundation exists, but review blockers below must be resolved before acceptance. |
| 05-11 | Not started | Do not begin until Plan 04 is accepted. |

### Plan 02: stable public contracts

The following must remain exported from `packages/core/src/index.ts` unless an explicitly approved later plan changes them:

`GridFeature`, `GridPlugin`, `GridState`, `GridColumn`, `GridCommand`, `GridEvent`, `GridReducer`, `GridStore`, `createGridStore`, `createGrid`, `createFeatureRuntime`, `createSelector`, `selectFilteredRows`, `selectSortedRows`, `selectPagedRows`, `selectVisibleRows`, `selectRenderedRows`, and `createQueryPipelineSelector`.

Plan 02 amendment: `FeatureRuntime` includes `getSelector(name)`. `createFeatureRuntime` captures selectors in a map. Do not remove or change this behavior.

`GridFeature.reduce` returns only that feature's slice. Do **not** change it to mutate all feature state or add formula-specific reducer capabilities. Feature selectors are the intended extension point.

### Plan 03: accepted formula architecture

Formula modules live in `packages/core/src/formulas/` and are selector-oriented:

- Parser, AST, error model, registry, and evaluator are pure core code.
- `formulaFeature` registers the `formulaEvaluator` selector through the feature runtime; it does not widen the feature reducer contract.
- Formula cache is snapshot-scoped and external to serializable `GridState`.
- Cache keys encode row/column IDs without collisions, including IDs that contain colons.
- Circular references return stable `#CYCLE!` results; invalid references return `#REF!`.
- Formula tests cover parsing, builtins, cycles, selector integration, cross-snapshot cache reuse/invalidation, row/column reorder, and colon-containing IDs.

Formula contracts exported from the core barrel:

`FormulaErrorCode`, `FormulaResult`, `FormulaValue`, `FormulaFunction`, `FormulaFunctionRegistry`, `createRegistry`, `registerBuiltins`, `FormulaContext`, `FormulaEvaluator`, `formulaFeature`, and `FormulaFeatureConfig`.

Final Plan 03 verification reported by the implementation agent:

- `npm.cmd run test:unit -- --project core` - exit 0, 84/84 core tests; 60/60 formula tests.
- `npm.cmd run typecheck` - exit 0.

## 4. Current Plan 04 status and mandatory review fixes

Plan 04 is defined in [`plans/04-react-adapter-api.md`](plans/04-react-adapter-api.md). Its purpose is a controlled/uncontrolled React adapter using `useSyncExternalStore`, **not** a rendered grid UI (that belongs to Plan 05).

Current files include `packages/react/src/GridProvider.tsx`, `context.ts`, `hooks/`, `DataGrid.tsx`, and `provider.test.tsx`. They are a useful starting point, but the plan is not accepted for these reasons:

1. **Required public types are missing.** `DataGridProps` must contain `dataSource` and `renderers`; the planned React `types.ts` is absent. Define type-only contracts from the approved specification, and report a genuine gap instead of inventing runtime behavior.
2. **Plugins are ignored.** `GridProvider` accepts `plugins` but only builds its runtime from `features`. Flatten plugin features together with explicit features and retain core duplicate-ID/dependency validation. Add an integration test for plugin-provided reducer/selector behavior.
3. **Plan 05 UI arrived early.** The current `DataGrid` directly renders a header, rows, and cells. Keep Plan 04 adapter-only; static shell composition is Plan 05 work.
4. **Internal API leaked.** `GridContext` is exported from `packages/react/src/index.ts`, while the Plan 04 public API allows only `DataGrid`, `GridProvider`, hooks, documented feature factories, public types, and CSS entry points.
5. **Controlled-mode coverage is insufficient.** The existing test starts with `state={undefined}`, so it begins uncontrolled. Add tests that mount with an actual `state`, accept an external snapshot replacement, and ensure synchronizing that prop does not invoke `onStateChange`.
6. **Type safety is masked.** Replace the provider/context/hook `any` casts with correctly parameterized row/context/feature types. Typecheck passing is not enough if the public adapter loses generic safety.
7. **`instanceKey` is unresolved.** The plan says the provider re-creates its core instance only when `instanceKey` changes, but the approved `DataGridProps` and design spec do not define that property. Do not add it publicly without explicit approval. Document the private lifecycle approach or report the gap.

The implementation agent mentioned a `walkthrough.md`, but no such file was found in the repository (including untracked files) during the 2026-08-26 review. If it matters, require the agent to provide its full path or save it under `docs/superpowers/`.

Independent 2026-08-26 verification of the current Plan 04 starting point:

- `npm.cmd run typecheck --workspace @gridmaster/react` - exit 0.
- `npm.cmd run test:unit -- --project react --reporter=verbose` - exit 0, 1 file / 4 tests.

Passing four tests does **not** accept Plan 04 until the seven findings above are addressed and all plan checks pass.

### Plan 04 decision amendment (2026-08-27)

The conflicting `dataSource`, feature-context, adapter-root, and `instanceKey` requirements are resolved in [`2026-08-27 Plan 04 contract resolutions`](decisions/2026-08-27-plan-04-contract-resolutions.md). Plan 04 may reserve the Plan 09 `DataSource` interfaces as type-only core contracts, expose `dataSource` in `DataGridProps`, use an `unknown` React feature-context boundary backed by `undefined`, render only a bare adapter root, and use React `key` remounting without a public `instanceKey`. Plan 09 retains every data-source runtime behavior.

## 5. Test and environment notes

Use the command required by the active plan first. Common commands:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit -- --project core
npm.cmd run test:unit -- --project react
npm.cmd run build --workspace @gridmaster/react
```

In restricted Codex sandboxes, Vitest/esbuild may fail before test collection with:

```text
Cannot read directory "../../..": Access is denied.
Could not resolve ...\vitest.config.ts
```

This is a sandbox permission limitation, not evidence of a product test failure. Re-run the same test command with the user-approved unsandboxed permission and report the actual exit code and test count. Do not conceal either result.

## 6. How to use Antigravity or another implementation agent

For every plan handoff:

1. State the exact plan file and require it to be read together with the v2 design and this guide.
2. State the allowed scope and forbidden scope (especially: no legacy imports, no unrelated files, no commits, no next plan).
3. Require test-first implementation and a clear report of the initial failure, changed files, public exports, exact verification commands, test counts, exit codes, and unresolved gaps.
4. Require the agent to stop rather than silently widen a predecessor's contract.
5. Independently review the changed code and run available verification before accepting the plan.

When reviewing an agent report, inspect code rather than trusting prose. Check public barrel exports, generic types, lifecycle/cleanup behavior, tests that truly exercise stated modes, plan scope, and package boundaries.

## 7. Future plan map

| Next plan | Scope after predecessor acceptance |
| --- | --- |
| 05 | Tokenized CSS entry points and static, semantic grid shell; no interaction behavior. |
| 06 | Selection, keyboard navigation, ARIA behavior, and editing lifecycle. |
| 07 | Local sort/filter, clipboard, transactions/history, formatting, and validation features. |
| 08 | Layout, sizing, virtualization, frozen columns, drag/reorder, and fill. |
| 09 | Opt-in remote `DataSource`, cancellation, loading/error/retry state. |
| 10 | Browser, accessibility, visual, package, and performance quality gates. |
| 11 | Playground, documentation, packaging, release process, and final acceptance. |

Read each individual plan before starting it; this table is sequencing context, not a substitute for acceptance criteria.

## 8. New-chat restart prompt

Paste the following into a new chat when resuming work:

```text
We are building the GridMaster v2 library. Read
docs/superpowers/PROJECT-CONTINUATION.md first, then follow its source-of-
truth and review workflow. Use CodeGraph before direct code searches. Preserve
the dirty worktree, do not import legacy/v1, and do not begin a later plan
until the current one is accepted. Current target: [state the plan/task].
```

## 9. Updating this guide

Update this file after every plan review or acceptance:

- change the current phase and plan ledger;
- record accepted public contracts and any explicit design decision;
- include only verified command results, with date and test counts;
- move active review findings to the next plan when resolved;
- keep it concise enough to read at the start of a new chat.
