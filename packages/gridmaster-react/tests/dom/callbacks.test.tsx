// A-002: change callbacks must fire on mount and when their VALUE changes, never because the parent
// re-rendered with a fresh inline handler. Language: TypeScript 6 (strict), React 19, vitest + jsdom.
// rows/columns/resolveColorOptions are referentially stable on purpose (A-003 is a separate task).
import { StrictMode, useEffect, useState, type ReactElement } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  GridMaster,
  createColumnFactory,
  type GridColorOption,
  type GridSnapshot,
} from "../../src/index";

type Row = { id: number; name: string };
const col = createColumnFactory<Row>();
const columns = [col.text("name")];
const rows: Row[] = [
  { id: 1, name: "Asha" },
  { id: 2, name: "Ben" },
  { id: 3, name: "Cara" },
];
const colorOptions: GridColorOption[] = [
  { value: "#ff0000", label: "Red", count: 2, swatch: "#ff0000" },
  { value: "", label: "", count: 1, swatch: null },
];
const resolveColorOptions = () => colorOptions;

type CallbackName = "selection" | "sort" | "filter" | "colorFilter" | "colorSort" | "snapshot";
type Spies = Record<CallbackName, Mock>;
type Controls = { rerender: () => void };
type User = ReturnType<typeof userEvent.setup>;

function makeSpies(): Spies {
  return {
    selection: vi.fn(),
    sort: vi.fn(),
    filter: vi.fn(),
    colorFilter: vi.fn(),
    colorSort: vi.fn(),
    snapshot: vi.fn(),
  };
}

/** Re-renders on demand and hands GridMaster a FRESH inline handler for every callback each time. */
function Parent({ spies, controls }: { spies: Spies; controls: Controls }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    controls.rerender = () => setTick((n) => n + 1);
  }, [controls]);
  return (
    <GridMaster<Row>
      rows={rows}
      columns={columns}
      resolveColorOptions={resolveColorOptions}
      onSelectionChange={(e) => spies.selection(e)}
      onSortChange={(e) => spies.sort(e)}
      onFilterChange={(e) => spies.filter(e)}
      onColorFilterChange={(e) => spies.colorFilter(e)}
      onColorSortChange={(e) => spies.colorSort(e)}
      onSnapshotChange={(e: GridSnapshot<Row>) => spies.snapshot(e)}
    />
  );
}

function mount(strict: boolean) {
  const spies = makeSpies();
  const controls: Controls = { rerender: () => {} };
  const user = userEvent.setup();
  const ui: ReactElement = <Parent spies={spies} controls={controls} />;
  const utils = render(strict ? <StrictMode>{ui}</StrictMode> : ui);
  return { spies, controls, user, ...utils };
}

async function openMenu(user: User) {
  await user.click(screen.getByTitle("Open column options for Name"));
  const menu = document.querySelector<HTMLElement>("[data-gm-column-menu]");
  if (!menu) throw new Error("column menu did not open");
  // The menu registers its outside-click/Escape listeners on a 0ms timeout.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  return within(menu);
}

async function pickRedInSidePanel(user: User) {
  const panel = document.querySelector<HTMLElement>(".gm-menu-side-panel");
  if (!panel) throw new Error("colour side panel did not open");
  await waitFor(() => expect(within(panel).getByText("Red")).toBeTruthy());
  await user.click(within(panel).getByText("Red"));
}

/** One real user action per callback that changes exactly that callback's value. */
const actions: Record<
  CallbackName,
  { act: (user: User) => Promise<void>; matches: (arg: unknown) => boolean }
> = {
  selection: {
    act: async (user) => {
      const cell = screen.getAllByText("Ben").find((el) => el.closest("td"));
      if (!cell) throw new Error("Ben cell not found");
      await user.click(cell);
    },
    matches: (arg) =>
      (arg as { selection: { cursor: { row: number; col: number } | null } }).selection.cursor
        ?.row === 1,
  },
  sort: {
    act: async (user) => {
      const menu = await openMenu(user);
      await user.click(menu.getByRole("button", { name: "Sort" }));
      await user.click(menu.getByRole("button", { name: "Sort Z to A" }));
    },
    matches: (arg) =>
      JSON.stringify((arg as { sort: unknown }).sort) ===
      JSON.stringify({ columnKey: "name", direction: "desc" }),
  },
  filter: {
    act: async (user) => {
      const menu = await openMenu(user);
      await user.click(menu.getByRole("button", { name: "Filter" }));
      await user.click(menu.getByRole("button", { name: "Filter values" }));
      await user.click(menu.getByRole("checkbox", { name: "Ben" }));
      await user.click(menu.getByRole("button", { name: "Apply" }));
    },
    matches: (arg) => "name" in (arg as { filters: Record<string, unknown> }).filters,
  },
  colorFilter: {
    act: async (user) => {
      const menu = await openMenu(user);
      await user.click(menu.getByRole("button", { name: "Filter" }));
      await user.click(menu.getByRole("button", { name: /Filter by Color/ }));
      await pickRedInSidePanel(user);
      await user.click(menu.getByRole("button", { name: "Apply" }));
    },
    matches: (arg) =>
      (arg as { colorFilters: Record<string, { values: Set<string> }> }).colorFilters.name?.values.has(
        "#ff0000"
      ) === true,
  },
  colorSort: {
    act: async (user) => {
      const menu = await openMenu(user);
      await user.click(menu.getByRole("button", { name: "Sort" }));
      await user.click(menu.getByRole("button", { name: /Sort by Color/ }));
      await pickRedInSidePanel(user);
      await user.click(menu.getByRole("button", { name: "Apply" }));
    },
    matches: (arg) =>
      JSON.stringify((arg as { colorSort: unknown }).colorSort) ===
      JSON.stringify({ columnKey: "name", value: "#ff0000" }),
  },
  snapshot: {
    act: async (user) => {
      const cell = screen.getAllByText("Asha").find((el) => el.closest("td"));
      if (!cell) throw new Error("Asha cell not found");
      await user.dblClick(cell);
      await user.keyboard("{Control>}a{/Control}Zed{Enter}");
    },
    matches: (arg) =>
      (arg as GridSnapshot<Row>).rows.some((row) => row.name === "Zed"),
  },
};

const names = Object.keys(actions) as CallbackName[];
const RERENDERS = 5;

describe.each([
  ["plain", false],
  ["React.StrictMode", true],
])("A-002 change callbacks (%s)", (_label, strict) => {
  it.each(names)("%s: does not refire when only the parent re-renders", (name) => {
    const { spies, controls } = mount(strict);
    const afterMount = spies[name].mock.calls.length;
    // The on-mount emit is kept for back-compat (StrictMode legitimately double-invokes it).
    expect(afterMount).toBeGreaterThan(0);

    for (let i = 0; i < RERENDERS; i++) act(() => controls.rerender());

    expect(spies[name].mock.calls.length).toBe(afterMount);
  });

  it("every callback emits exactly once on mount (selection included)", () => {
    const { spies } = mount(strict);
    // StrictMode double-invokes mount effects, so 2 there; plain mounts must be 1 for all six.
    const expected = strict ? 2 : 1;
    expect(names.map((name) => spies[name].mock.calls.length)).toEqual(names.map(() => expected));
  });

  it("no callback refires after parent re-renders (all six together)", () => {
    const { spies, controls } = mount(strict);
    const afterMount = names.map((name) => spies[name].mock.calls.length);
    for (let i = 0; i < RERENDERS; i++) act(() => controls.rerender());
    expect(names.map((name) => spies[name].mock.calls.length)).toEqual(afterMount);
  });

  it.each(names)("%s: a real user action emits exactly once with the new value", async (name) => {
    const { spies, user } = mount(strict);
    const before = spies[name].mock.calls.length;

    await actions[name].act(user);

    const calls = spies[name].mock.calls;
    expect(calls.length - before).toBe(1);
    expect(actions[name].matches(calls[calls.length - 1][0])).toBe(true);
  });

  it.each(names)("%s: still no refire on parent re-renders after the user action", async (name) => {
    const { spies, controls, user } = mount(strict);
    await actions[name].act(user);
    const afterAction = spies[name].mock.calls.length;

    for (let i = 0; i < RERENDERS; i++) act(() => controls.rerender());

    expect(spies[name].mock.calls.length).toBe(afterAction);
  });
});

describe("A-002 loop guard", () => {
  it.each([
    ["plain", false],
    ["React.StrictMode", true],
  ])("onSortChange that sets parent state each call does not hit max update depth (%s)", (_l, strict) => {
    // React only console.errors "Maximum update depth exceeded" for effect loops (it keeps
    // spinning), so the handler stops feeding the loop after a cap and the test asserts on the
    // call count and on the console instead of hanging.
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const LOOP_CAP = 30;
    let calls = 0;
    let rerender: () => void = () => {};

    function SettingParent() {
      const [last, setLast] = useState<unknown>(null);
      const [, setTick] = useState(0);
      useEffect(() => {
        rerender = () => setTick((n) => n + 1);
      }, []);
      return (
        <GridMaster<Row>
          rows={rows}
          columns={columns}
          // Fresh object every call: the classic "max update depth" trigger.
          onSortChange={(e) => {
            calls++;
            if (calls <= LOOP_CAP) setLast({ ...e });
          }}
          className={last ? "has-sort-event" : undefined}
        />
      );
    }

    const tree = <SettingParent />;
    expect(() => render(strict ? <StrictMode>{tree}</StrictMode> : tree)).not.toThrow();
    const afterMount = calls;
    for (let i = 0; i < RERENDERS; i++) {
      expect(() => act(() => rerender())).not.toThrow();
    }

    // Only the on-mount emit (twice under StrictMode); the setState it triggers must not re-emit.
    expect(afterMount).toBe(strict ? 2 : 1);
    expect(calls).toBe(afterMount);
    const depthErrors = errors.mock.calls.filter((args) =>
      String(args[0]).includes("Maximum update depth exceeded")
    );
    expect(depthErrors).toEqual([]);
  });
});
