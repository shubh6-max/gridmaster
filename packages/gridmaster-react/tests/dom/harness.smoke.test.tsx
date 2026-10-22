// DOM harness smoke test. Language: TypeScript 6 (strict), React 19, vitest + jsdom.
// Proves the harness can mount GridMaster with a typed row and observe real DOM output;
// later tasks build their behavioural regression tests on top of this.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GridMaster, createColumnFactory } from "../../src/index";

type Row = { id: number; name: string };
const col = createColumnFactory<Row>();

describe("DOM harness", () => {
  it("mounts GridMaster with a typed row and renders its value as its own element", () => {
    const rows: Row[] = [{ id: 1, name: "Asha" }];
    render(<GridMaster<Row> rows={rows} columns={[col.text("name")]} />);
    // "Asha" appears twice by design: in the grid cell and echoed in the formula bar's textarea
    // (the active cell A1 is selected on mount). Require one match to be inside a table cell so the
    // test proves a real grid cell rendered, not just the formula bar.
    const matches = screen.getAllByText("Asha");
    expect(matches.some((el) => el.closest("td") !== null)).toBe(true);
  });
});
