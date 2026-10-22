# GridMaster v2 — Antigravity Plan 03 Handoff

You are taking over an existing TypeScript monorepo migration named GridMaster v2.

Repository root:

```text
C:\Users\ShubhamVishwasPurani\OneDrive - TheMathCompany Private Limited\Desktop\gridmaster
```

Your immediate task is to complete Plan 03 only. Do not begin Plan 04 or later plans.

## Project context

GridMaster is being rebuilt as a v2 npm workspace:

- `packages/core` — framework-neutral TypeScript state, features, selectors, formulas.
- `packages/react` — React adapter, not part of this task.
- `apps/playground` — later-stage live documentation.
- `legacy/v1` — archived old implementation. It is unsupported and v2 must never import from it.

Read these documents before editing:

- `docs/superpowers/specs/2026-08-23-gridmaster-v2-design.md`
- `docs/superpowers/plans/README.md`
- `docs/superpowers/plans/03-formulas.md`

## Plan sequence and current state

- Plan 00: workspace/quality foundation — completed.
- Plan 01: core types and external store — completed.
- Plan 02: feature runtime, selectors, local query pipeline — implemented.
- Plan 02 amendment: `createFeatureRuntime` captures registered selectors and exposes `getSelector(name)`; this is required for formulas.
- Plan 03: formulas — currently broken and must be rebuilt.
- Plan 04 and later: not authorized.

The working tree is intentionally dirty and contains work from earlier plans. Preserve unrelated changes. Do not use `git reset`, `git checkout`, destructive cleanup, commits, or rewrites outside the Plan 03 scope.

## Existing core contracts to preserve

Do not widen or change these contracts without explicitly reporting an unavoidable gap:

```ts
type GridFeature<Context = unknown> = {
  id: string;
  requires?: readonly string[];
  createInitialState(context: Context): unknown;
  reduce?(
    command: GridCommand,
    featureState: unknown,
    context: Context
  ): unknown | null;
  registerSelectors?(registry: GridSelectorRegistry<Context>): void;
};

type GridSelectorRegistry<Context = unknown> = {
  register(
    name: string,
    selector: (state: GridState, context: Context) => unknown
  ): void;
};
```

`GridState` owns immutable rows, columns, and serializable `featureState`.
`GridColumn` has `id`, `header`, and `getValue(row)`.

The Plan 02 selector-runtime amendment gives feature runtimes:

```ts
runtime.getSelector(name)
```

Use that mechanism. Formula evaluation must not require new reducer semantics, full-state reducer access, formula commands, mutable state snapshots, browser APIs, or global variables.

## Current Plan 03 problems

Plan 03 artifacts currently exist but are not trustworthy:

- `packages/core/src/formulas/errors.ts`
- `packages/core/src/formulas/ast.ts`
- `packages/core/src/formulas/parser.ts`
- `packages/core/src/formulas/registry.ts`
- `packages/core/src/formulas/evaluator.ts`
- `packages/core/src/formulas/feature.ts`
- `packages/core/tests/formulas.unit.test.ts`

Replace or rewrite only these Plan 03 artifacts as needed. Do not patch errors mechanically.

Known problems in the current attempt:

- `npm.cmd run typecheck` fails with many formula errors.
- Parser tokenization is incomplete: commas, ranges, leading `=`, and absolute references are not handled correctly.
- The evaluator leaks cycle state through `globalThis`.
- Referenced formulas return raw strings rather than being recursively evaluated.
- Dependency tracking and cache invalidation are not real.
- The formula feature does not properly implement `GridFeature`.
- An inline temporary built-in registry is created but not actually used.
- Formula contracts are not exported from `packages/core/src/index.ts`.

## Required Plan 03 design

Implement formulas as a selector-based core feature.

### Formula feature

Implement:

```ts
formulaFeature({ registry? })
```

It must be a valid `GridFeature`:

- `id: "formulas"`
- `createInitialState()` returns a serializable empty feature slice.
- `registerSelectors(registry)` registers the formula selector(s).
- No formula reducer is required unless a test proves it is necessary.

Use a clear selector name such as `formulas/evaluator`.

The registered selector receives `GridState` and returns a typed evaluator bound to that snapshot:

```ts
const selector = runtime.getSelector("formulas/evaluator");
const evaluator = selector?.(state, context) as FormulaEvaluator;
const result = evaluator.evaluateCell(rowIndex, columnIndex);
```

The evaluator gets raw values through `state.columns[colIndex].getValue(state.rows[rowIndex])`. A string beginning with `=` is a formula; other values are literal cell values.

### Parsing

Implement a strict tokenizer and recursive-descent parser. Do not use `eval` or `Function`.

Support:

- Leading `=` formula syntax.
- A1 references: `A1`, `B2`, `AA10`.
- Ranges: `A1:B3`.
- Absolute references: `$A$1`, `A$1`, `$A1`.
- Unary `+` and `-`.
- Arithmetic: `+`, `-`, `*`, `/`.
- Comparisons: `=`, `<>`, `>`, `>=`, `<`, `<=`.
- Parentheses.
- Function calls and comma-separated arguments.
- Precedence: reference/range → unary → `*`/`/` → `+`/`-` → comparisons → function calls.

Keep AST node types discriminated. The plan says AST details remain file-local except for `parseFormula`; export only what is genuinely part of the intended public formula contract.

Malformed input must produce `#PARSE!`, not throw during rendering.

### Errors

Use exactly these error codes:

```ts
type FormulaErrorCode =
  | "#PARSE!"
  | "#NAME?"
  | "#REF!"
  | "#VALUE!"
  | "#DIV/0!"
  | "#CYCLE!";
```

Invalid cell coordinates or ranges return `#REF!`. Unknown functions return `#NAME?`. Invalid arithmetic/coercion returns `#VALUE!`. Division by zero returns `#DIV/0!`. Cycles return `#CYCLE!`.

### Registry and built-ins

Provide a typed `FormulaFunctionRegistry`, `createRegistry`, and `registerBuiltins`.

Formula functions receive evaluated scalar/range values only. They must never receive grid state, DOM access, network access, or mutable runtime state.

Implement only:

- `SUM`
- `AVERAGE`
- `MIN`
- `MAX`
- `COUNT`
- `IF`
- `AND`
- `OR`
- `NOT`
- `IFERROR`

Support a custom registered function, verified with `MARGIN`.

Handle `IF` and `IFERROR` carefully: formula errors must be catchable by `IFERROR`; do not return early before it can receive and handle the evaluated error result.

### Evaluation, memoization, and dependencies

The evaluator must expose at least:

```ts
evaluateCell(rowIndex: number, columnIndex: number): FormulaResult
```

Requirements:

- Recursively evaluate referenced formula cells.
- Use row/column IDs only for cache and dependency keys.
- Detect cycles with an evaluator-local `visiting` set. Never use `globalThis`.
- Capture direct dependencies for every evaluated formula.
- Cache results by immutable grid snapshot.
- Preserve or reuse cached results only when the formula cell and all direct referenced cells are unchanged. An unrelated cell change must not invalidate a formula result.
- Keep caching internal and non-serializable; never place `Map`, `Set`, or evaluator instances in `GridState.featureState`.
- Never mutate rows, columns, or the snapshot.

A `WeakMap<GridState, SnapshotCache>` is appropriate for snapshot ownership. If cross-snapshot reuse is implemented, compare formula-source and dependency values through stable row/column IDs before reusing a prior result.

## Test-first requirements

Replace the formula test suite before implementation. Tests must cover:

1. Parser:
   - `=A1+B2`
   - `=SUM(A1:A3)`
   - `=IF(A1>0,1,0)`
   - absolute references
   - malformed ranges/input
   - precedence

2. Evaluation:
   - all documented error codes
   - recursive referenced formulas
   - real circular references, not a test that mutates evaluator internals
   - division by zero
   - invalid references
   - ranges and nested functions

3. Built-ins:
   - normal cases
   - empty ranges
   - non-numeric values
   - falsey values
   - `IFERROR` handling an evaluation error

4. Feature integration:
   - `formulaFeature` registers its selector through `createFeatureRuntime`
   - selector returns an evaluator for a real `GridState`
   - custom `MARGIN` registry function executes
   - repeated evaluation for an unchanged snapshot returns the cached result/reference where applicable
   - an unrelated source-cell change preserves an unaffected formula cache entry
   - a referenced-cell change invalidates and recalculates it

Do not import from `legacy/v1` in tests or implementation.

## Scope and exports

Allowed changes:

- `packages/core/src/formulas/**`
- `packages/core/tests/formulas.unit.test.ts`
- `packages/core/src/index.ts` for formula exports
- a minimal Plan 02 runtime correction only if a test proves it is necessary

Do not modify React, playground, legacy, workspace configuration, package dependencies, or unrelated tests.

Export the planned formula contracts from `packages/core/src/index.ts` only after the implementation works. Expected public contracts:

- `FormulaErrorCode`
- `FormulaResult`
- `FormulaValue`
- `FormulaFunction`
- `FormulaFunctionRegistry`
- `createRegistry`
- `registerBuiltins`
- `FormulaContext`
- `FormulaEvaluator`
- `formulaFeature`
- `FormulaFeatureConfig`

Do not export internal parser/token/AST implementation details unless the approved Plan 03 contract explicitly requires them.

## Verification and reporting

Run these commands from the repository root:

```powershell
npm.cmd run test:unit -- --project core
npm.cmd run typecheck
```

Do not call Plan 03 complete unless both commands pass.

At the end, report:

1. Files changed.
2. Exact core test totals.
3. Typecheck result.
4. Formula contracts exported from `packages/core/src/index.ts`.
5. Whether any Plan 02 API was changed; if so, why it was unavoidable.
6. Confirmation that no legacy imports, commits, or unrelated rewrites were made.

Do not proceed to Plan 04 after reporting. Wait for the next instruction.
