// Type-level compatibility guard: realistic consumer code written against gridmaster-react 0.2.0.
// Every section [Cnn] must keep compiling as the types evolve (the package API is additive-only
// and source-compatible). A section marked KNOWN-RED-0.2.0 failed to compile on the 0.2.0 types;
// it may turn green but nothing that was green may turn red. Compiled by
// `tsc -p tests/types/tsconfig.json` (no emit). Language: TypeScript 6 (strict), React 19.
import { useState, type Dispatch, type SetStateAction } from "react";
import {
  GridMaster,
  GridProvider,
  createColumn,
  createColumnFactory,
  createCompactGridPreset,
  createEditableGridPreset,
  createReadonlyGridPreset,
  type GridCellChangeEvent,
  type GridCellContext,
  type GridCellEditorProps,
  type GridCellMeta,
  type GridCellRendererProps,
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

type Row = { id: number; name: string; age: number };
interface IRow {
  id: number;
  name: string;
  age: number;
}

const data: Row[] = [{ id: 1, name: "Asha", age: 29 }];
const idata: IRow[] = [{ id: 1, name: "Asha", age: 29 }];

// [C01] Explicit generic, readonly handler, alias rows, typed column array.
export function C01() {
  const [rows, setRows] = useState<Row[]>(data);
  const columns: GridColumnDef<Row>[] = [
    { key: "name", title: "Name", type: "text" },
    { key: "age", title: "Age", type: "number", align: "right" },
  ];
  const onRowsChange = (next: readonly Row[]) => setRows([...next]);
  return <GridMaster<Row> rows={rows} columns={columns} onRowsChange={onRowsChange} />;
}

// [C02] Explicit generic, handler typed with MUTABLE Row[] (KNOWN-RED-0.2.0: callbacks were readonly).
export function C02() {
  const onRowsChange = (next: Row[]) => void next.length;
  return <GridMaster<Row> rows={data} columns={[]} onRowsChange={onRowsChange} />;
}

// [C03] Explicit generic with React's setState dispatcher (KNOWN-RED-0.2.0).
export function C03() {
  const [rows, setRows] = useState<Row[]>(data);
  return <GridMaster<Row> rows={rows} columns={[]} onRowsChange={setRows} />;
}

// [C04] createColumnFactory<Row>() columns with explicit generic.
export function C04() {
  const col = createColumnFactory<Row>();
  const columns = [col.text("name"), col.number("age"), col.checkbox("id", { title: "Done" })];
  return <GridMaster<Row> rows={data} columns={columns} />;
}

// [C05] The default (non-generic) `createColumn` singleton with GridRow-typed rows.
export function C05() {
  const rows: GridRow[] = [{ id: 1, name: "Asha" }];
  const columns = [createColumn.text("name"), createColumn.select("role", { options: ["a", "b"] })];
  return <GridMaster rows={rows} columns={columns} />;
}

// [C06] Presets, explicit generic, spread into the grid.
export function C06() {
  const columns: GridColumnDef<Row>[] = [{ key: "name", title: "Name" }];
  return (
    <>
      <GridMaster<Row> rows={data} columns={columns} {...createEditableGridPreset<Row>()} />
      <GridMaster<Row> rows={data} columns={columns} {...createReadonlyGridPreset<Row>()} />
      <GridMaster<Row> rows={data} columns={columns} {...createCompactGridPreset<Row>()} />
    </>
  );
}

// [C07] Presets without a type argument, GridRow rows (the documented zero-config usage).
export function C07() {
  const rows: GridRow[] = [{ name: "Asha" }];
  return (
    <GridMaster
      rows={rows}
      columns={[createColumn.text("name")]}
      {...createEditableGridPreset()}
      {...createReadonlyGridPreset()}
      {...createCompactGridPreset()}
    />
  );
}

// [C08] GridRow-typed state with a plain `GridRow[]` setter.
export function C08() {
  const [rows, setRows] = useState<GridRow[]>([{ a: 1 }]);
  return <GridMaster<GridRow> rows={rows} columns={[]} onRowsChange={(r) => setRows([...r])} />;
}

// [C09] Custom renderCell / renderEditor / getValue / formatValue using row fields.
export function C09() {
  const columns: GridColumnDef<Row>[] = [
    {
      key: "name",
      title: "Name",
      getValue: (row) => row.name.toUpperCase(),
      setValue: (row, value) => ({ ...row, name: String(value) }),
      formatValue: (value, row) => `${String(value)} (${row.id})`,
      parseValue: (value) => String(value).trim(),
      validate: (value, row) => (String(value).length > 0 && row.id > 0 ? null : "required"),
      renderCell: ({ row, formattedValue, isSelected }) => (
        <b data-selected={isSelected}>
          {row.name} / {formattedValue}
        </b>
      ),
      renderEditor: ({ row, value, updateValue, commit, cancel }) => (
        <input
          defaultValue={row.name}
          onChange={(e) => updateValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Escape" && cancel()}
          aria-label={String(value)}
        />
      ),
    },
  ];
  return <GridMaster<Row> rows={data} columns={columns} />;
}

// [C10] Annotated value handlers: consumers commonly narrow `value` in the signature.
export function C10() {
  const columns: GridColumnDef<Row>[] = [
    {
      key: "age",
      title: "Age",
      formatValue: (value: number) => value.toFixed(1),
      validate: (value: string, row: Row) => (value && row.id ? null : "bad"),
      parseValue: (value: string) => Number(value),
      setValue: (row: Row, value: number) => ({ ...row, age: value }),
      getValue: (row: Row): number => row.age,
    },
  ];
  return <GridMaster<Row> rows={data} columns={columns} />;
}

// [C11] Loose use of `value` (it was `any`): arithmetic, member access and as a JSX child.
export function C11() {
  const columns: GridColumnDef<Row>[] = [
    {
      key: "age",
      title: "Age",
      formatValue: (value) => value.toFixed(2),
      renderCell: ({ value }) => <i>{value}</i>,
      renderEditor: ({ value, updateValue }) => (
        <button type="button" onClick={() => updateValue(value + 1)}>
          {value.toString()}
        </button>
      ),
    },
  ];
  return <GridMaster<Row> rows={data} columns={columns} />;
}

// [C12] Interface rows with the explicit generic (KNOWN-RED-0.2.0: `T extends Record<string, unknown>`).
export function C12() {
  const [rows, setRows] = useState<IRow[]>(idata);
  const columns: GridColumnDef<IRow>[] = [{ key: "name", title: "Name" }];
  return <GridMaster<IRow> rows={rows} columns={columns} onRowsChange={(r) => setRows([...r])} />;
}

// [C13] Every event type import, used to annotate handlers; payload fields read.
export function C13() {
  const onCellChange = (e: GridCellChangeEvent<Row>) => void [e.rowIndex, e.columnKey, e.row.name];
  const onSelectionChange = (e: GridSelectionChangeEvent) => void e.selection.mode;
  const onSortChange = (e: GridSortChangeEvent) => void e.sort?.direction;
  const onFilterChange = (e: GridFilterChangeEvent) => void Object.keys(e.filters);
  const onColorFilterChange = (e: GridColorFilterChangeEvent) => void e.colorFilters;
  const onColorSortChange = (e: GridColorSortChangeEvent) => void e.colorSort;
  const onColumnResize = (e: GridColumnResizeEvent<Row>) => void [e.column.key, e.width];
  const onRowInsert = (e: GridRowInsertEvent<Row>) => void e.row.name;
  const onRowDelete = (e: GridRowDeleteEvent<Row>) => void e.row.name;
  const onColumnInsert = (e: GridColumnInsertEvent<Row>) => void e.position;
  const onColumnDelete = (e: GridColumnDeleteEvent<Row>) => void e.column.key;
  const onCopy = (e: GridClipboardEvent<Row>) => void e.rows.length;
  const onPaste = (e: GridClipboardEvent<Row>) => void e.selection;
  const onSnapshotChange = (s: GridSnapshot<Row>) => void s.rows.length;
  return (
    <GridMaster<Row>
      rows={data}
      columns={[]}
      onCellChange={onCellChange}
      onSelectionChange={onSelectionChange}
      onSortChange={onSortChange}
      onFilterChange={onFilterChange}
      onColorFilterChange={onColorFilterChange}
      onColorSortChange={onColorSortChange}
      onColumnResize={onColumnResize}
      onRowInsert={onRowInsert}
      onRowDelete={onRowDelete}
      onColumnInsert={onColumnInsert}
      onColumnDelete={onColumnDelete}
      onCopy={onCopy}
      onPaste={onPaste}
      onSnapshotChange={onSnapshotChange}
    />
  );
}

// [C14] Inline (un-annotated) event handlers read payload fields.
export function C14() {
  return (
    <GridMaster<Row>
      rows={data}
      columns={[]}
      onCellChange={(e) => void e.row.age}
      onRowInsert={(e) => void e.row.name}
      onColumnResize={(e) => void e.width}
      onCopy={(e) => void e.rows[0]?.name}
      onSnapshotChange={(s) => void s.columns.length}
      onSelectionChange={(e) => void e.selection.cursor}
      createRowOnInsert={() => ({ id: 0, name: "", age: 0 })}
      createColumnOnInsert={() => ({ key: "x", title: "X" })}
      getRowId={(row) => String(row.id)}
      getRowMeta={(row) => (row.age > 30 ? { className: "old" } : undefined)}
      getCellMeta={(row, _i, key): GridCellMeta | undefined =>
        key === "name" && row.name ? { backgroundColor: "#eee" } : undefined
      }
    />
  );
}

// [C15] Props type used directly: wrapper component forwarding GridMasterProps<Row>.
export function C15(props: GridMasterProps<Row>) {
  return <GridMaster<Row> {...props} />;
}
export function C15b() {
  const props: GridMasterProps<Row> = {
    rows: data,
    columns: [],
    mode: "editable",
    onRowsChange: (rows) => void rows.length,
  };
  return <C15 {...props} />;
}

// [C16] Context types used to build reusable renderers.
export function CustomRenderer(props: GridCellRendererProps<Row>) {
  return <span>{props.row.name}</span>;
}
export function CustomEditor(props: GridCellEditorProps<Row>) {
  return <input defaultValue={props.row.name} onBlur={props.commit} />;
}
export const ctx: Pick<GridCellContext<Row>, "rowIndex" | "mode"> = {
  rowIndex: 0,
  mode: "editable",
};
export function C16() {
  const columns: GridColumnDef<Row>[] = [
    { key: "name", title: "Name", renderCell: CustomRenderer, renderEditor: CustomEditor },
  ];
  return <GridMaster<Row> rows={data} columns={columns} />;
}

// [C17] Wrapper component generic over the row type (library authors wrapping GridMaster).
export function Wrapper<T extends GridRow>(props: { rows: T[]; columns: GridColumnDef<T>[] }) {
  return <GridMaster<T> rows={props.rows} columns={props.columns} />;
}
export function C17() {
  const rows: GridRow[] = [{ a: 1 }];
  return <Wrapper rows={rows} columns={[createColumn.text("a")]} />;
}

// [C18] Dispatch type alias for the setter, wrapped through a helper.
export function C18() {
  const [rows, setRows] = useState<Row[]>(data);
  const save: Dispatch<SetStateAction<Row[]>> = setRows;
  return (
    <GridMaster<Row>
      rows={rows}
      columns={[]}
      onRowsChange={(next) => save([...next])}
      onRowReorder={(next) => save([...next])}
    />
  );
}

// [C19] GridProvider is still a value export (shape unchanged), referenced for the surface only.
export const providerIsExported: typeof GridProvider = GridProvider;

// [C20] KNOWN-RED-0.2.0: uncast member access on the default GridRow. `GridRow` was
// `Record<string, any>` in 0.2.0 and is `Record<string, unknown>` since 0.2.1 (deliberate, audit A-030),
// so reading a field off the DEFAULT row type without a cast no longer compiles. The two `@ts-expect-error`
// lines MUST keep erroring (an unused directive fails the typecheck): they pin the documented break.
export const c20Default: GridMasterProps["onCellChange"] = (e) => {
  // @ts-expect-error 0.2.0 compiled this (field was `any`); `e.row.price` is `unknown` on the default row.
  e.row.price.toFixed(2);
  // @ts-expect-error same break, arithmetic on an uncast field.
  void (e.row.qty * 2);
};
// Sanctioned migration (a): pass a concrete row type (explicit generic, or inferred from `rows`).
export const c20Typed: GridMasterProps<{ price: number }>["onCellChange"] = (e) => {
  e.row.price.toFixed(2);
};
// Sanctioned migration (b): narrow the field explicitly on the default row.
export const c20Narrowed: GridMasterProps["onCellChange"] = (e) => {
  (e.row.price as number).toFixed(2);
  if (typeof e.row.qty === "number") void (e.row.qty * 2);
};
