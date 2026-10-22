# Plan 04 Contract Resolutions

**Decision date:** 2026-08-27  
**Authority:** Codex, delegated by the user

## Purpose

Resolve the contradictions discovered while implementing the React adapter so Plan 04 can complete without silently importing Plan 05 or Plan 09 behavior.

## Decisions

### 1. Data source contract reservation

`@gridmaster/core` will export the Plan 09 `DataSourceRequest`, `DataSourceResult<Row>`, and `DataSource<Row>` interfaces now as **type-only contracts**. This does not add a data-source feature, network behavior, request controller, cache, or state slice. It lets `DataGridProps<Row>` expose its required `dataSource?: DataSource<Row>` field without an unsafe placeholder.

The contract is:

```ts
type DataSourceRequest = {
  filters: readonly Filter[];
  sorting: readonly SortRule[];
  cursor: string | null;
  range: VisibleRange;
  signal: AbortSignal;
};
type DataSourceResult<Row> = {
  rows: readonly Row[];
  totalCount?: number;
  nextCursor: string | null;
};
type DataSource<Row> = {
  getRows(request: DataSourceRequest): Promise<DataSourceResult<Row>>;
};
```

Plan 09 owns all runtime behavior.

### 2. React feature context boundary

The Plan 04 React adapter does not expose a feature-context input. Its feature and plugin inputs therefore use `GridFeature<unknown>` and `GridPlugin<unknown>`, and the runtime receives `undefined`. The adapter does not make an unsound promise that application-defined context values exist. A later plan may add a context input through an explicit public-API decision.

### 3. Minimal DataGrid adapter root

Plan 04 permits one empty `<div role="grid">` as the adapter host. It consumes `ariaLabel`, `className`, and `style`, but must not render headers, rows, cells, or interaction UI. The complete semantic static shell remains Plan 05 scope.

### 4. Instance lifecycle

The core instance persists for one React provider mount. Consumers force a new instance with React's standard `key` remount mechanism on `GridProvider` or `DataGrid`. No public `instanceKey` prop will be added.

## Consequences

The Plan 04 wording about `instanceKey` is amended by Decision 4. The Plan 04 wording that `DataGrid` is not created until Plan 05 is narrowed by Decision 3 to allow only the minimal adapter root. These decisions supersede the contradictory lines in the original plan.
