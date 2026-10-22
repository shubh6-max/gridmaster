// A-003: inline column defs (fresh array + fresh renderCell/getValue closures every parent render)
// and inline `initialCellMeta` objects must not wipe history, revert user edits/structure or loop.
// Language: TypeScript 6 (strict), React 19, vitest + jsdom.
import { StrictMode, useEffect, useState, type ReactElement } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  GridMaster,
  type GridCellMeta,
  type GridColumnDef,
  type GridSnapshot,
} from "../../src/index";

type Row = { id: number; name: string; city: string };
const rows: Row[] = [
  { id: 1, name: "Asha", city: "Pune" },
  { id: 2, name: "Ben", city: "Oslo" },
  { id: 3, name: "Cara", city: "Rome" },
];
const RERENDERS = 5;
type User = ReturnType<typeof userEvent.setup>;

/** A brand-new column array with brand-new closures: what `columns={[{...}]}` does every render. */
function inlineColumns(tick: number, extraKey?: string): GridColumnDef<Row>[] {
  const base: GridColumnDef<Row>[] = [
    {
      key: "name",
      title: "Name",
      type: "text",
      getValue: (row) => row.name,
      renderCell: (p) => (
        <span data-testid="name-cell" data-tick={tick}>
          {String(p.value ?? "")}
        </span>
      ),
    },
    { key: "city", title: "City", type: "text", getValue: (row) => row.city },
  ];
  return extraKey ? [...base, { key: extraKey, title: extraKey, type: "text" }] : base;
}

type Controls = {
  rerender: () => void;
  setExtraKey: (key: string) => void;
  reverse: () => void;
};

type ParentProps = {
  controls: Controls;
  onSnapshotChange?: (snapshot: GridSnapshot<Row>) => void;
  initialCellMeta?: () => Record<string, GridCellMeta>;
};

/** Re-renders on demand; every render hands GridMaster fresh columns (and fresh initialCellMeta). */
function Parent({ controls, onSnapshotChange, initialCellMeta }: ParentProps) {
  const [tick, setTick] = useState(0);
  const [extraKey, setExtraKey] = useState<string | undefined>(undefined);
  const [reversed, setReversed] = useState(false);
  useEffect(() => {
    controls.rerender = () => setTick((n) => n + 1);
    controls.setExtraKey = setExtraKey;
    controls.reverse = () => setReversed(true);
  }, [controls]);
  const columns = inlineColumns(tick, extraKey);
  return (
    <GridMaster<Row>
      rows={rows}
      columns={reversed ? columns.reverse() : columns}
      initialCellMeta={initialCellMeta?.()}
      onSnapshotChange={onSnapshotChange}
    />
  );
}

function mount(props: Omit<ParentProps, "controls"> = {}, strict = false) {
  const controls: Controls = { rerender: () => {}, setExtraKey: () => {}, reverse: () => {} };
  const user = userEvent.setup();
  const ui: ReactElement = <Parent controls={controls} {...props} />;
  const utils = render(strict ? <StrictMode>{ui}</StrictMode> : ui);
  return { controls, user, ...utils };
}

function rerenderParent(controls: Controls, times = RERENDERS) {
  for (let i = 0; i < times; i++) act(() => controls.rerender());
}

function firstCellShell(): HTMLElement {
  const shell = document.querySelector<HTMLElement>("td.gm-td .gm-cell-shell");
  if (!shell) throw new Error("first cell not found");
  return shell;
}

function bodyColumnTitles(): string[] {
  return Array.from(document.querySelectorAll("thead th"))
    .map((th) => th.textContent?.trim() ?? "")
    .filter((text) => ["Name", "City", "Phone"].some((t) => text.includes(t)));
}

/** Rendered text of the inline-renderCell "name" cells (grid body only, not the formula bar). */
function nameCells(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-testid="name-cell"]'));
}

function bodyCell(text: string): HTMLElement {
  const td = Array.from(document.querySelectorAll<HTMLElement>("td.gm-td")).find(
    (el) => el.textContent?.trim() === text
  );
  if (!td) throw new Error(`cell "${text}" not found`);
  return td;
}

async function editFirstCell(user: User, text: string) {
  await user.dblClick(firstCellShell());
  await user.keyboard(`{Control>}a{/Control}${text}{Enter}`);
}

describe.each([
  ["plain", false],
  ["React.StrictMode", true],
])("A-003 inline columns keep edits and undo history (%s)", (_label, strict) => {
  it("edit survives parent re-renders and is still undoable; no snapshot churn", async () => {
    const snapshot = vi.fn();
    const { controls, user } = mount({ onSnapshotChange: snapshot }, strict);

    await editFirstCell(user, "Zed");
    expect(nameCells()[0].textContent).toBe("Zed");
    const afterEdit = (snapshot as Mock).mock.calls.length;

    rerenderParent(controls);

    // Still edited, and the FRESH inline closure is what renders (latest functions applied).
    expect(nameCells()[0].textContent).toBe("Zed");
    expect(nameCells()[0].getAttribute("data-tick")).toBe(String(RERENDERS));
    expect((snapshot as Mock).mock.calls.length).toBe(afterEdit);

    // History was not wiped: Ctrl+Z on the grid reverts the edit.
    await user.keyboard("{Control>}z{/Control}");
    expect(nameCells()[0].textContent).toBe("Asha");
  });
});

describe("A-003 user column structure survives inline columns", () => {
  it("a user-inserted column is not reverted by parent re-renders", async () => {
    const { controls, user } = mount();
    expect(bodyColumnTitles()).toEqual(["Name", "City"]);

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Name", { selector: "th *" }) });
    await user.click(screen.getByText("Insert Column Right"));
    const inserted = document.querySelectorAll("thead th").length;

    rerenderParent(controls);

    expect(document.querySelectorAll("thead th").length).toBe(inserted);
    expect(bodyColumnTitles()).toEqual(["Name", "City"]);
  });

  it("a genuine structural change from the parent (new column key) still updates the grid", () => {
    const { controls } = mount();
    expect(screen.queryByText("Phone")).toBeNull();

    act(() => controls.setExtraKey("Phone"));

    expect(bodyColumnTitles()).toEqual(["Name", "City", "Phone"]);
  });

  it("a genuine reorder from the parent still replaces the grid columns", () => {
    const { controls } = mount();
    expect(bodyColumnTitles()).toEqual(["Name", "City"]);

    act(() => controls.reverse());

    expect(bodyColumnTitles()).toEqual(["City", "Name"]);
  });
});

describe("A-003 loop guard", () => {
  it.each([
    ["plain", false],
    ["React.StrictMode", true],
  ])("parent that stores onSnapshotChange in state + inline columns does not loop (%s)", (_l, strict) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const LOOP_CAP = 30;
    let calls = 0;
    const controls: Controls = { rerender: () => {}, setExtraKey: () => {}, reverse: () => {} };

    function StoringParent() {
      const [, setSnap] = useState<GridSnapshot<Row> | null>(null);
      const [tick, setTick] = useState(0);
      useEffect(() => {
        controls.rerender = () => setTick((n) => n + 1);
      }, []);
      return (
        <GridMaster<Row>
          rows={rows}
          columns={inlineColumns(tick)}
          onSnapshotChange={(snap) => {
            calls++;
            if (calls <= LOOP_CAP) setSnap(snap);
          }}
        />
      );
    }

    const tree = <StoringParent />;
    expect(() => render(strict ? <StrictMode>{tree}</StrictMode> : tree)).not.toThrow();
    const afterMount = calls;
    for (let i = 0; i < RERENDERS; i++) {
      expect(() => act(() => controls.rerender())).not.toThrow();
    }

    expect(calls).toBe(afterMount);
    expect(calls).toBeLessThan(LOOP_CAP);
    const depthErrors = errors.mock.calls.filter((args) =>
      String(args[0]).includes("Maximum update depth exceeded")
    );
    expect(depthErrors).toEqual([]);
  });
});

describe("A-003 initialCellMeta is a mount-only seed", () => {
  it("a fresh initialCellMeta object on parent re-render does not overwrite user formatting", async () => {
    const seed = () => ({ "2::name": { style: { fontStyle: "italic" } } });
    const { controls, user } = mount({ initialCellMeta: seed });

    // Bold the "Ben" cell through the toolbar.
    await user.click(bodyCell("Ben"));
    await user.click(screen.getByTitle("Bold (Ctrl/Cmd+B)"));
    const boldBefore = bodyCell("Ben").getAttribute("style") ?? "";
    expect(boldBefore).toMatch(/font-weight:\s*(700|bold)/);

    rerenderParent(controls);

    const after = bodyCell("Ben").getAttribute("style") ?? "";
    expect(after).toMatch(/font-weight:\s*(700|bold)/);
  });
});
