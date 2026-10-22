// DOM proof that A-016 conditional formatting actually colours cells, uses the EVALUATED value,
// and respects an injected clock for timePeriod rules. TypeScript 6 (strict), React 19, vitest + jsdom.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  GridMaster,
  createColumnFactory,
  type GridConditionalFormats,
  type GridMasterProps,
} from "../../src/index";

type Row = { id: number; score: number | string; when: Date };
const col = createColumnFactory<Row>();

function shellsInColumnOrder(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("tbody td.gm-td .gm-cell-shell"));
}

function mount(extra: Partial<GridMasterProps<Row>>, rows: Row[]) {
  return render(
    <GridMaster<Row>
      rows={rows}
      columns={[col.text("score")]}
      enableConditionalFormatting
      {...extra}
    />
  );
}

describe("conditional formatting rendering (A-016)", () => {
  it("colours a cell whose evaluated value matches a cellValue rule", () => {
    const formats: GridConditionalFormats = {
      score: [
        { condition: { type: "cellValue", operator: ">", value: 90 }, backgroundColor: "rgb(255, 0, 0)" },
      ],
    };
    const { container } = mount(
      { initialConditionalFormats: formats },
      [
        { id: 1, score: "=90+5", when: new Date() }, // evaluates to 95 -> matches
        { id: 2, score: 10, when: new Date() }, // 10 -> no match
      ]
    );

    const shells = shellsInColumnOrder(container);
    expect(shells[0].style.backgroundColor).toBe("rgb(255, 0, 0)");
    expect(shells[1].style.backgroundColor).toBe("");
  });

  it("respects the injected clock for a timePeriod rule", () => {
    const fixed = new Date(2026, 5, 15);
    const formats: GridConditionalFormats = {
      when: [
        { condition: { type: "timePeriod", value: "today" }, backgroundColor: "rgb(0, 128, 0)" },
      ],
    };
    const { container } = render(
      <GridMaster<Row>
        rows={[
          { id: 1, score: 0, when: new Date(2026, 5, 15) }, // "today" per the fixed clock
          { id: 2, score: 0, when: new Date(2026, 5, 10) }, // not today
        ]}
        columns={[col.date("when")]}
        enableConditionalFormatting
        initialConditionalFormats={formats}
        conditionalFormatNow={() => fixed}
      />
    );

    const shells = shellsInColumnOrder(container);
    expect(shells[0].style.backgroundColor).toBe("rgb(0, 128, 0)");
    expect(shells[1].style.backgroundColor).toBe("");
  });

  it("does nothing when the feature flag is off", () => {
    const formats: GridConditionalFormats = {
      score: [
        { condition: { type: "cellValue", operator: ">", value: 90 }, backgroundColor: "rgb(255, 0, 0)" },
      ],
    };
    const { container } = render(
      <GridMaster<Row>
        rows={[{ id: 1, score: 95, when: new Date() }]}
        columns={[col.text("score")]}
        initialConditionalFormats={formats}
      />
    );
    expect(shellsInColumnOrder(container)[0].style.backgroundColor).toBe("");
  });
});
