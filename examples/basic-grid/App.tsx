import React, { useState } from "react";
import { GridMaster, createColumn } from "../../src";

type CustomerRow = {
  id: number;
  name: string;
  city: string;
  score: number;
};

const columns = [
  createColumn.text<CustomerRow>("name", { title: "Name" }),
  createColumn.text<CustomerRow>("city", { title: "City" }),
  createColumn.number<CustomerRow>("score", { title: "Score" }),
];

const initialRows: CustomerRow[] = [
  { id: 1, name: "Northwind", city: "Bengaluru", score: 92 },
  { id: 2, name: "BluePeak", city: "Pune", score: 84 },
  { id: 3, name: "Aurora", city: "Hyderabad", score: 88 },
];

export function BasicGridExample() {
  const [rows, setRows] = useState(initialRows);

  return (
    <GridMaster<CustomerRow>
      rows={rows}
      columns={columns}
      getRowId={(row) => String(row.id)}
      onRowsChange={setRows}
      height={360}
    />
  );
}

export default BasicGridExample;
