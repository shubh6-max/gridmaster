# GridMaster v2 Design

## Status

Approved architecture blueprint. This document is the source of truth for the v2 implementation plans.

## Product goal

Ship a React-first data-grid library that is simple to adopt for internal business applications and sufficiently composable for polished product experiences. The library must offer one excellent default component while exposing a framework-neutral engine for advanced composition.

## Non-goals

- Preserve the v1 API or ship a compatibility layer. There are no v1 users.
- Claim Excel compatibility or implement an unbounded formula catalogue.
- Ship a non-React renderer in v2. The core must remain React-free so a future adapter is possible.
- Make the first remote-data implementation responsible for backend caching or transport; applications retain ownership of their HTTP client and cache.

## Package and repository topology

Use npm workspaces with the following tracked directories:

```text
packages/
  core/                 @gridmaster/core
  react/                @gridmaster/react
apps/
  playground/           live documentation and browser integration target
tests/
  e2e/                  Playwright browser and accessibility tests
  package-smoke/        consumer-install smoke fixture
docs/
  guides/               authored user documentation
  api/                  generated API documentation input
```

`@gridmaster/core` contains no React, DOM, CSS, or browser-global imports. `@gridmaster/react` depends on `@gridmaster/core`, React, and React DOM. It exposes both the ready-to-use `DataGrid` component and composable React primitives. `apps/playground` is an npm workspace that consumes the packages through their public package entry points, never source-relative imports.

## Public API

The easy path is intentionally narrow:

```tsx
<DataGrid
  rows={rows}
  columns={columns}
  defaultState={{ sorting: [{ columnId: "revenue", direction: "desc" }] }}
  onStateChange={setGridState}
  features={defaultFeatures}
/>
```

The component accepts only these top-level concerns:

- `rows` and `columns`: data and schema.
- `state`, `defaultState`, and `onStateChange`: one controlled/uncontrolled state protocol.
- `dataSource`: optional server-side query contract.
- `features` and `plugins`: explicit enabled capabilities and application extensions.
- `renderers`: named cell/header/editor slot overrides.
- `ariaLabel`, `className`, and `style`: host integration.

All other configuration belongs to a typed feature configuration object, for example `features: [selection(), editing({ commitOnBlur: true }), filtering()]`. No individual boolean feature flags are accepted by `DataGrid`.

`@gridmaster/react` exports `DataGrid`, `GridProvider`, `useGrid`, `useGridSelector`, `useGridCommand`, renderer types, feature factories, and the CSS entry points. Internal reducers, DOM event helpers, and implementation components are not public exports.

## Core architecture

The core uses a unidirectional state model:

```text
user interaction / application call
  -> typed GridCommand
  -> feature command handlers
  -> immutable GridState transaction
  -> derived selectors
  -> GridEvent + React render
```

### Data model

- Rows have stable string `id` values. The adapter resolves IDs once at ingestion; selection, history, formulas, and remote data never use render indexes as identity.
- Columns use stable `id` values and typed accessors. A column definition owns value access and its declared value type.
- `GridState` contains serializable feature slices only. DOM references, timers, request abort controllers, and derived arrays live outside it.
- A `GridSnapshot` is an immutable state plus the row/column version it was derived from. History stores commands or structural patches, never arbitrary mutable row references.

### Features and plugins

Every built-in capability is a feature with a small manifest:

```ts
type GridFeature = {
  id: string;
  requires?: readonly string[];
  createInitialState(context: GridContext): GridStateSlice;
  reduce(command: GridCommand, context: GridContext): GridStatePatch | null;
  extendSelectors?(selectors: GridSelectorRegistry): void;
  extendCommands?(commands: GridCommandRegistry): void;
};
```

Features cannot mutate other feature slices directly. Cross-feature work is expressed through typed commands and selectors. Dependency order is declared by `requires` and validated during grid creation. The initial built-ins are: row/column model, selection, navigation, editing, sorting, filtering, formulas, clipboard, history, formatting, sizing, virtualization, frozen columns, and drag/fill.

### Data pipeline

Derived output follows this stable order: source rows -> filters -> sort -> grouping/pagination when enabled -> visible range -> rendered cells. Each stage is a selector with memoization keyed by source and feature versions.

`DataSource` supports server-side filtering, sorting, pagination, and infinite loading with a request object containing normalized filters, sort, cursor, and visible range. It returns rows, row count or `undefined`, and next-cursor metadata. A request controller cancels stale requests, and the data-source feature exposes loading, error, and retry state. Local data must work without `DataSource`.

### Formulas

The formula package is a core feature, not a separate public calculator. It supports A1 references, ranges, arithmetic, comparisons, circular-reference errors, dependency tracking, and memoization. Built-ins are `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `IF`, `AND`, `OR`, `NOT`, and `IFERROR`.

Applications extend formulas through a typed `FormulaFunctionRegistry`. Functions are deterministic and receive evaluated values only; no formula function can access the DOM, network, or mutable grid state. Unsupported syntax and functions produce stable documented errors. Locale-sensitive parsing, volatile functions, macros, and Excel-file compatibility are out of scope.

## React and UI architecture

`GridProvider` creates one core grid instance and subscribes React with `useSyncExternalStore`. `useGridSelector(selector)` subscribes to a selector result, so cell and header components only render for state they consume. `DataGrid` is a composition of private UI primitives: root, toolbar, viewport, header, body, row, cell, editors, overlays, and menus.

DOM interaction is separated from core commands. React event adapters translate keyboard, pointer, clipboard, focus, and scroll events into commands. All dragging uses Pointer Events with pointer capture; no feature relies on mouse-only listeners. The adapter must clean up document/window listeners and never read browser globals during server render.

## CSS and design system

Ship separate importable files:

```text
@gridmaster/react/styles/tokens.css
@gridmaster/react/styles/base.css
@gridmaster/react/styles/components.css
@gridmaster/react/styles/features.css
@gridmaster/react/styles.css
```

`styles.css` imports the four layers in order. All selectors are namespaced under `.gm` and use CSS cascade layers. Tokens cover colour, typography, space, border, radius, focus rings, z-index, row metrics, and motion. Components consume tokens only; consumers override documented custom properties on `.gm` or an ancestor. Styles do not leak global element rules.

## Accessibility and interaction requirements

- Implement the WAI-ARIA grid interaction model with one roving tab stop, announced row/column position, selected state, editable-cell semantics, and an accessible name.
- Every mouse or pointer action has a keyboard equivalent. Fill, resize, context actions, and menus remain operable with keyboard alternatives.
- Menus trap focus while open, close on Escape, restore focus to their trigger, and expose correct menu/menuitem semantics.
- Respect `prefers-reduced-motion`, visible focus requirements, high-contrast system settings, and zoom to 200%.
- Use pointer interactions for touch, pen, and mouse. Test a touch viewport in Playwright.

## Quality system

Use TypeScript strict mode for all workspaces. Add Biome for formatting and static linting, Vitest for unit and integration tests, React Testing Library for adapter behavior, Playwright for browser workflows and visual screenshots, and axe-core through Playwright for accessibility checks.

Every feature plan must add unit tests at the core boundary and integration tests at the React boundary when UI is involved. The end-to-end suite covers selection, keyboard navigation, editing, clipboard, filtering, sorting, undo/redo, resize, fill, virtual scrolling, touch pointer input, and a screen-reader-oriented keyboard flow. Benchmarks record local rows at 1k, 10k, and 100k sizes and set regression thresholds.

## Delivery and documentation

GitHub Actions must run install, format/lint, typecheck, unit/integration tests, browser tests, package build, package-install smoke test, and benchmark sanity checks for pull requests and `main`. The deploy workflow builds `apps/playground` from the current repository. Changesets generate package versions and changelog entries. Release jobs only publish from a tagged release workflow.

Documentation is generated and maintained in-repository: quick start, controlled state, feature recipes, rendering, theming, accessibility, performance, server data, formula extension, migration from v1, and troubleshooting. The playground has a scenario per documented capability and is the live smoke target.

## Migration and deletion policy

Move the current v1 source into `legacy/v1/` only during the first repository-foundation plan, exclude it from all v2 builds and npm packages, and label it unsupported. Delete v1-era scripts, broken deployment references, stale build outputs, and inaccurate documentation once the replacement workspace passes its package smoke test. No v1 implementation file may be imported by v2 code.

## Definition of complete

v2 is complete when a clean checkout can install, lint, typecheck, build all packages, run unit/integration/e2e/accessibility tests, run benchmarks, package and install a consumer fixture, deploy the playground, and guide a new React user from installation to a styled, keyboard-accessible grid. Each shipped documented capability must have an automated test at its core or UI boundary; interaction capabilities require both.
