import React from "react";

export type GridRowProps = React.ComponentPropsWithoutRef<"tr">;

export function GridRow(props: GridRowProps) {
  return <tr {...props} />;
}

export default GridRow;
