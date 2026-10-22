// F-010: the column menu's async resolvers are read through a ref, so an INLINE resolver (new
// identity every parent render) does not re-run the fetch effect. Opening the menu once must fetch
// once, no matter how often the parent re-renders. TypeScript 6 (strict), React 19, vitest + jsdom.
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GridMaster, createColumnFactory, type GridColumnDef } from "../../src/index";

type Row = { id: number; name: string; qty: number };
const col = createColumnFactory<Row>();
const columns: GridColumnDef<Row>[] = [col.text("name"), col.number("qty")];
const rows: Row[] = Array.from({ length: 4 }, (_, i) => ({
  id: i + 1,
  name: `Name${i}`,
  qty: (i + 1) * 10,
}));

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

describe("F-010 inline resolver does not refetch on parent re-render", () => {
  it("opening the menu once fetches once, across 5 parent re-renders", async () => {
    const resolver = vi.fn(async (_key: string, _filters: unknown) => ["Name0", "Name1"]);
    // A NEW inline arrow every render — the identity changes each time, the data does not.
    const Harness = (_props: { tick: number }) => (
      <GridMaster<Row>
        rows={rows}
        columns={columns}
        showToolbar={false}
        showFormulaBar={false}
        showStatusBar={false}
        resolveFilterValues={(key, filters) => resolver(key, filters)}
      />
    );

    const { container, rerender } = render(<Harness tick={0} />);

    // Open the "name" column menu (its filter effect fetches once).
    const trigger = container.querySelector<HTMLElement>(".gm-column-trigger");
    expect(trigger).toBeTruthy();
    await act(async () => {
      fireEvent.click(trigger as HTMLElement);
    });
    await settle();
    expect(resolver).toHaveBeenCalledTimes(1);

    // Re-render the parent 5 times with a fresh inline resolver each time.
    for (let tick = 1; tick <= 5; tick++) {
      rerender(<Harness tick={tick} />);
    }
    await settle();

    // The fetch did not re-run: the resolver identity churn is absorbed by the ref.
    expect(resolver).toHaveBeenCalledTimes(1);
  });
});
