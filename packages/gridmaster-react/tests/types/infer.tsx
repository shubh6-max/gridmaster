// Type-level tests for Task 1.1e (audit A-029..A-038): generic inference, readonly rows, mutable
// callback payloads, exported event types and `any` removal. Pure compile-time: nothing runs.
// Compiled by `tsc -p tests/types/tsconfig.json`; a failing assertion is a compile error.
// Language: TypeScript 6 (strict), React 19.
import { useState, type Dispatch, type SetStateAction } from "react";
import {
  GridMaster,
  createColumn,
  createColumnFactory,
  createEditableGridPreset,
  createReadonlyGridPreset,
  shallowEqualObjects,
  updateCellValue,
  type GridCellChangeEvent,
  type GridCellContext,
  type GridCellEditorProps,
  type GridCellRendererProps,
  type GridCellValue,
  type GridClipboardEvent,
  type GridColorFilterChangeEvent,
  type GridColorSortChangeEvent,
  type GridColumnDef,
  type GridColumnDeleteEvent,
  type GridColumnInsertEvent,
  type GridColumnResizeEvent,
  type GridFilterChangeEvent,
  type GridMasterProps,
  type GridRow,
  type GridRowDeleteEvent,
  type GridRowInsertEvent,
  type GridSelectionChangeEvent,
  type GridSnapshot,
  type GridSortChangeEvent,
} from "../../src/index";

/* ---------- helpers ---------- */
type Equal<A, B> =
  (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
/** Resolves the `T` the compiler infers for a `GridMasterProps<T>` argument. */
declare function inferT<T extends object>(props: GridMasterProps<T>): T;

type Row = { id: number; name: string; age: number };
interface IRow {
  id: number;
  name: string;
  age: number;
}
type Other = { sku: string };

const rowsA: Row[] = [{ id: 1, name: "Asha", age: 29 }];
const rowsI: IRow[] = [{ id: 1, name: "Asha", age: 29 }];

/* ---------- [I01] the ANALYSIS.md repro: zero explicit generics, type alias row ---------- */
export function I01() {
  const createCol = createColumnFactory<Row>();
  const columns = [createCol.text("name"), createCol.number("age")];
  const [rows, setRows] = useState<Row[]>([{ id: 1, name: "Asha", age: 29 }]);
  return <GridMaster rows={rows} columns={columns} onRowsChange={setRows} />;
}

/* ---------- [I02] same, with an INTERFACE row (no implicit index signature) ---------- */
export function I02() {
  const createCol = createColumnFactory<IRow>();
  const columns = [createCol.text("name"), createCol.number("age")];
  const [rows, setRows] = useState<IRow[]>(rowsI);
  return <GridMaster rows={rows} columns={columns} onRowsChange={setRows} />;
}

/* ---------- [I03] readonly rows, alias and interface ---------- */
export function I03() {
  const readonlyRows: readonly Row[] = rowsA;
  const readonlyIRows: readonly IRow[] = rowsI;
  const [state, setState] = useState<readonly Row[]>(readonlyRows);
  const col = createColumnFactory<Row>();
  const icol = createColumnFactory<IRow>();
  return (
    <>
      <GridMaster rows={readonlyRows} columns={[col.text("name")]} />
      <GridMaster rows={readonlyIRows} columns={[icol.text("name")]} />
      <GridMaster<Row> rows={readonlyRows} columns={[col.text("name")]} />
      <GridMaster rows={state} columns={[col.text("name")]} onRowsChange={setState} />
    </>
  );
}

/* ---------- [I04] handlers typed mutable OR readonly, inferred and explicit ---------- */
export function I04() {
  const col = createColumnFactory<Row>();
  const columns = [col.text("name")];
  const mutable = (rows: Row[]) => void rows.length;
  const readonlyHandler = (rows: readonly Row[]) => void rows.length;
  const colsMutable = (cols: GridColumnDef<Row>[]) => void cols.length;
  const colsReadonly = (cols: readonly GridColumnDef<Row>[]) => void cols.length;
  return (
    <>
      <GridMaster rows={rowsA} columns={columns} onRowsChange={mutable} />
      <GridMaster rows={rowsA} columns={columns} onRowsChange={readonlyHandler} />
      <GridMaster<Row> rows={rowsA} columns={columns} onRowsChange={mutable} />
      <GridMaster<Row> rows={rowsA} columns={columns} onRowsChange={readonlyHandler} />
      <GridMaster rows={rowsA} columns={columns} onRowReorder={mutable} />
      <GridMaster rows={rowsA} columns={columns} onRowReorder={readonlyHandler} />
      <GridMaster rows={rowsA} columns={columns} onColumnsChange={colsMutable} />
      <GridMaster rows={rowsA} columns={columns} onColumnsChange={colsReadonly} />
      <GridMaster rows={rowsA} columns={columns} onColumnReorder={colsMutable} />
      <GridMaster rows={rowsA} columns={columns} onColumnReorder={colsReadonly} />
    </>
  );
}

/* ---------- [I05] T is inferred from `rows`, never from callbacks or columns ---------- */
const col = createColumnFactory<Row>();
const inferredFromRows = inferT({
  rows: rowsA,
  columns: [col.text("name")],
  onRowsChange: (rows: readonly GridRow[]) => void rows,
});
export type I05a = Expect<Equal<typeof inferredFromRows, Row>>;

const setRowsFn: Dispatch<SetStateAction<Row[]>> = () => {};
const inferredWithSetter = inferT({ rows: rowsA, columns: [], onRowsChange: setRowsFn });
export type I05b = Expect<Equal<typeof inferredWithSetter, Row>>;

const inferredInterface = inferT({ rows: rowsI, columns: [], onRowsChange: () => {} });
export type I05c = Expect<Equal<typeof inferredInterface, IRow>>;

const inferredReadonly = inferT({ rows: rowsA as readonly Row[], columns: [] });
export type I05d = Expect<Equal<typeof inferredReadonly, Row>>;

// Un-annotated callback parameters get the inferred row type (not GridRow / unknown / any).
export function I05e() {
  return (
    <GridMaster
      rows={rowsA}
      columns={[col.text("name")]}
      onCellChange={(e) => {
        type _a = Expect<Equal<typeof e.row, Row>>;
        type _b = Expect<Equal<GridCellChangeEvent<Row>, typeof e>>;
      }}
      onRowsChange={(rows) => {
        type _a = Expect<Equal<typeof rows, Row[]>>;
      }}
      onColumnsChange={(cols) => {
        type _a = Expect<Equal<typeof cols, GridColumnDef<Row>[]>>;
      }}
      onSnapshotChange={(s) => {
        type _a = Expect<Equal<typeof s, GridSnapshot<Row>>>;
      }}
      onRowInsert={(e) => {
        type _a = Expect<Equal<typeof e.row, Row>>;
      }}
      onCopy={(e) => {
        type _a = Expect<Equal<typeof e.rows, Row[]>>;
      }}
      createRowOnInsert={() => ({ id: 0, name: "", age: 0 })}
      getRowId={(row) => {
        type _a = Expect<Equal<typeof row, Row>>;
        return String(row.id);
      }}
    />
  );
}

/* ---------- [I06] negative cases still error (inference must not make everything pass) ---------- */
export function I06() {
  const otherCol = createColumnFactory<Other>();
  return (
    <>
      {/* @ts-expect-error columns built for another row type are rejected */}
      <GridMaster rows={rowsA} columns={[otherCol.text("sku")]} />
      {/* @ts-expect-error a handler for another row type is rejected */}
      <GridMaster rows={rowsA} columns={[col.text("name")]} onRowsChange={(r: Other[]) => void r} />
      {/* @ts-expect-error a handler for a different payload is rejected */}
      <GridMaster rows={rowsA} columns={[col.text("name")]} onRowsChange={(r: string[]) => void r} />
      {/* @ts-expect-error cell events carry the inferred row, not another type */}
      <GridMaster rows={rowsA} columns={[col.text("name")]} onCellChange={(e: GridCellChangeEvent<Other>) => void e} />
    </>
  );
}

/* ---------- [I07] explicit generic form (0.2.0 style) keeps compiling incl. interfaces ---------- */
export function I07() {
  const [rows, setRows] = useState<Row[]>(rowsA);
  const [irows, setIRows] = useState<IRow[]>(rowsI);
  const icol = createColumnFactory<IRow>();
  return (
    <>
      <GridMaster<Row> rows={rows} columns={[col.text("name")]} onRowsChange={setRows} />
      <GridMaster<IRow> rows={irows} columns={[icol.text("name")]} onRowsChange={setIRows} />
      <GridMaster<GridRow> rows={[{ a: 1 }]} columns={[createColumn.text("a")]} />
    </>
  );
}

/* ---------- [I08] presets spread into typed grids ---------- */
export function I08() {
  const icol = createColumnFactory<IRow>();
  return (
    <>
      <GridMaster rows={rowsA} columns={[col.text("name")]} {...createEditableGridPreset()} />
      <GridMaster rows={rowsI} columns={[icol.text("name")]} {...createReadonlyGridPreset()} />
      <GridMaster<IRow> rows={rowsI} columns={[icol.text("name")]} {...createEditableGridPreset<IRow>()} />
    </>
  );
}

/* ---------- [I09] every event / payload type is reachable from the package entry ---------- */
export type EventTypes = [
  GridCellChangeEvent<Row>,
  GridSelectionChangeEvent,
  GridSortChangeEvent,
  GridFilterChangeEvent,
  GridColorFilterChangeEvent,
  GridColorSortChangeEvent,
  GridColumnResizeEvent<Row>,
  GridRowInsertEvent<Row>,
  GridColumnInsertEvent<Row>,
  GridRowDeleteEvent<Row>,
  GridColumnDeleteEvent<Row>,
  GridClipboardEvent<Row>,
  GridSnapshot<Row>,
  GridCellContext<Row>,
  GridCellRendererProps<Row>,
  GridCellEditorProps<Row>,
];
// Every prop of GridMasterProps whose value is a callback must have a payload type from the entry:
// derive each handler's parameter and check it is one of the exported types (structural identity).
type Props = GridMasterProps<Row>;
type Param<K extends keyof Props> = NonNullable<Props[K]> extends (arg: infer A) => unknown
  ? A
  : never;
export type I09 = [
  Expect<Equal<Param<"onCellChange">, GridCellChangeEvent<Row>>>,
  Expect<Equal<Param<"onSelectionChange">, GridSelectionChangeEvent>>,
  Expect<Equal<Param<"onSortChange">, GridSortChangeEvent>>,
  Expect<Equal<Param<"onFilterChange">, GridFilterChangeEvent>>,
  Expect<Equal<Param<"onColorFilterChange">, GridColorFilterChangeEvent>>,
  Expect<Equal<Param<"onColorSortChange">, GridColorSortChangeEvent>>,
  Expect<Equal<Param<"onColumnResize">, GridColumnResizeEvent<Row>>>,
  Expect<Equal<Param<"onRowInsert">, GridRowInsertEvent<Row>>>,
  Expect<Equal<Param<"onColumnInsert">, GridColumnInsertEvent<Row>>>,
  Expect<Equal<Param<"onRowDelete">, GridRowDeleteEvent<Row>>>,
  Expect<Equal<Param<"onColumnDelete">, GridColumnDeleteEvent<Row>>>,
  Expect<Equal<Param<"onCopy">, GridClipboardEvent<Row>>>,
  Expect<Equal<Param<"onPaste">, GridClipboardEvent<Row>>>,
  Expect<Equal<Param<"onSnapshotChange">, GridSnapshot<Row>>>,
];

/* ---------- [I10] `any` removal ---------- */
export type NoAny = [
  Expect<Equal<IsAny<GridCellValue>, false>>,
  Expect<Equal<IsAny<GridRow[string]>, false>>,
  Expect<Equal<IsAny<Parameters<GridCellRendererProps<Row>["updateValue"]>[0]>, false>>,
  Expect<Equal<IsAny<Parameters<GridCellEditorProps<Row>["updateValue"]>[0]>, false>>,
  Expect<Equal<IsAny<Parameters<typeof shallowEqualObjects>[0]>, false>>,
  Expect<Equal<IsAny<Parameters<typeof updateCellValue>[number]>, false>>,
];
// updateValue accepts any value without a cast (it is `unknown`, a safe sink).
export function I10(props: GridCellEditorProps<Row>) {
  props.updateValue("x");
  props.updateValue(1);
  props.updateValue(null);
  props.updateValue({ nested: [1, 2] });
  return shallowEqualObjects({ a: 1 }, { a: 1 });
}

/* ---------- [I11] wider-typed handlers must not drag `T` towards GridRow (contravariant poison) ---------- */
const inferredWideHandlers = inferT({
  rows: rowsA,
  columns: [col.text("name")],
  onRowsChange: (rows: GridRow[]) => void rows,
  onCellChange: (e: GridCellChangeEvent<GridRow>) => void e,
  onRowInsert: (e: GridRowInsertEvent<GridRow>) => void e,
});
export type I11 = Expect<Equal<typeof inferredWideHandlers, Row>>;
