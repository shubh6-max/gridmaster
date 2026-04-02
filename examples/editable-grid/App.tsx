import React, { useState } from "react";
import {
  GridMaster,
  createColumn,
  createCompactGridPreset,
  createEditableGridPreset,
} from "../../src";

type PipelineRow = {
  id: number;
  account: string;
  stage: "Discovery" | "Build" | "Pilot" | "Live";
  budgetK: number;
  active: boolean;
  launchDate: string;
};

const columns = [
  createColumn.text<PipelineRow>("account", { title: "Account", width: 220 }),
  createColumn.select<PipelineRow>("stage", {
    title: "Stage",
    options: ["Discovery", "Build", "Pilot", "Live"],
    width: 140,
  }),
  createColumn.number<PipelineRow>("budgetK", { title: "Budget (K)", width: 140 }),
  createColumn.checkbox<PipelineRow>("active", { title: "Live", width: 90 }),
  createColumn.date<PipelineRow>("launchDate", { title: "Launch", width: 140 }),
];

const initialRows: PipelineRow[] = [
  {
    id: 1,
    account: "Northwind Retail",
    stage: "Build",
    budgetK: 320,
    active: true,
    launchDate: "2026-04-10",
  },
  {
    id: 2,
    account: "Verde Finance",
    stage: "Pilot",
    budgetK: 210,
    active: false,
    launchDate: "2026-04-22",
  },
];

const gridProps = {
  ...createEditableGridPreset<PipelineRow>(),
  ...createCompactGridPreset<PipelineRow>(),
  frozenColumns: 1,
};

export function EditableGridExample() {
  const [rows, setRows] = useState(initialRows);

  return (
    <GridMaster<PipelineRow>
      {...gridProps}
      rows={rows}
      columns={columns}
      onRowsChange={setRows}
      enableColumnVisibility
      height={420}
    />
  );
}

export default EditableGridExample;
