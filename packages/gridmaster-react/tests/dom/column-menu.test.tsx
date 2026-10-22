// DOM tests for the column menu (sort/filter/more expanders, date tree, value-set filter, colour
// side panel, accessibility, stylesheet coverage). Language: TypeScript 6 (strict), React 19,
// vitest + jsdom + @testing-library. Mounts a real GridMaster and drives the menu like a user.
import { readFileSync } from "node:fs";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  GridMaster,
  createColumnFactory,
  type GridColorOption,
  type GridMasterProps,
} from "../../src/index";

// Read the shipped stylesheet as text (Vite's ?raw import is empty under vitest's css:false).
// vitest runs with the package root as cwd (npm workspace script / `npx vitest` inside the package).
const gridCss = readFileSync("src/styles/grid.css", "utf8");

type Row = { id: number; name: string; due: string };
const col = createColumnFactory<Row>();

const rows: Row[] = [
  { id: 1, name: "Asha", due: "2024-03-15" },
  { id: 2, name: "Ben", due: "2024-03-02" },
  { id: 3, name: "Cara", due: "2024-11-30" },
  { id: 4, name: "Dev", due: "2023-12-31" },
  { id: 5, name: "Ela", due: "not a date" },
];

function mount(extra: Partial<GridMasterProps<Row>> = {}) {
  const user = userEvent.setup();
  const utils = render(
    <GridMaster<Row>
      rows={rows}
      columns={[col.text("name"), col.date("due", { filterTree: "date" })]}
      {...extra}
    />
  );
  return { user, ...utils };
}

/** Names of the grid rows currently displayed, in display order. */
function displayedNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("tbody tr"))
    .map((tr) => tr.querySelector("td.gm-td")?.textContent?.trim() ?? "")
    .filter(Boolean);
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, columnTitle: string) {
  await user.click(screen.getByTitle(`Open column options for ${columnTitle}`));
  const menu = document.querySelector<HTMLElement>("[data-gm-column-menu]");
  if (!menu) throw new Error("column menu did not open");
  // The menu registers its outside-click/Escape listeners on a 0ms timeout.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  return within(menu);
}

describe("column menu expanders", () => {
  it("starts collapsed and toggles Sort / Filter / More with correct aria-expanded", async () => {
    const { user } = mount();
    const menu = await openMenu(user, "Name");

    const sort = menu.getByRole("button", { name: "Sort" });
    const filter = menu.getByRole("button", { name: "Filter" });
    const more = menu.getByRole("button", { name: "More" });
    for (const trigger of [sort, filter, more]) {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(trigger.getAttribute("aria-controls")).toBeTruthy();
    }
    expect(menu.queryByRole("button", { name: "Sort A to Z" })).toBeNull();
    expect(menu.queryByRole("button", { name: "Auto-fit Width" })).toBeNull();

    await user.click(sort);
    expect(sort.getAttribute("aria-expanded")).toBe("true");
    const sortRegion = document.getElementById(sort.getAttribute("aria-controls") ?? "");
    expect(sortRegion).not.toBeNull();
    expect(within(sortRegion as HTMLElement).getByRole("button", { name: "Sort A to Z" })).toBeTruthy();

    await user.click(sort);
    expect(sort.getAttribute("aria-expanded")).toBe("false");
    expect(menu.queryByRole("button", { name: "Sort A to Z" })).toBeNull();

    await user.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(menu.getByRole("button", { name: "Auto-fit Width" })).toBeTruthy();
    expect(menu.getByRole("button", { name: /Freeze Through Here/ })).toBeTruthy();

    await user.click(filter);
    expect(filter.getAttribute("aria-expanded")).toBe("true");
    // Opening Filter collapses More (one section open at a time).
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(menu.getByRole("button", { name: "Filter values" })).toBeTruthy();
  });

  it("closes the menu on Escape", async () => {
    const { user } = mount();
    await openMenu(user, "Name");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.querySelector("[data-gm-column-menu]")).toBeNull());
  });
});

describe("stored 0.2.0 behaviours through the new menu", () => {
  it("sorts descending then ascending from the Sort section and closes the menu", async () => {
    const { user, container } = mount();

    let menu = await openMenu(user, "Name");
    await user.click(menu.getByRole("button", { name: "Sort" }));
    await user.click(menu.getByRole("button", { name: "Sort Z to A" }));
    expect(displayedNames(container)).toEqual(["Ela", "Dev", "Cara", "Ben", "Asha"]);
    expect(document.querySelector("[data-gm-column-menu]")).toBeNull();

    menu = await openMenu(user, "Name");
    await user.click(menu.getByRole("button", { name: "Sort" }));
    await user.click(menu.getByRole("button", { name: "Sort A to Z" }));
    expect(displayedNames(container)).toEqual(["Asha", "Ben", "Cara", "Dev", "Ela"]);
  });

  it("filters a text column by a value set (deselect two values, Apply)", async () => {
    const { user, container } = mount();
    const menu = await openMenu(user, "Name");
    await user.click(menu.getByRole("button", { name: "Filter" }));
    await user.click(menu.getByRole("button", { name: "Filter values" }));

    expect(menu.getByText("5 of 5 selected")).toBeTruthy();
    await user.click(menu.getByRole("checkbox", { name: "Ben" }));
    await user.click(menu.getByRole("checkbox", { name: "Cara" }));
    expect(menu.getByRole("checkbox", { name: "Ben" }).getAttribute("aria-checked")).toBe("false");
    expect(menu.getByText("3 of 5 selected")).toBeTruthy();

    await user.click(menu.getByRole("button", { name: "Apply" }));
    expect(displayedNames(container)).toEqual(["Asha", "Dev", "Ela"]);
    expect(document.querySelector("[data-gm-column-menu]")).toBeNull();
  });

  it("narrows the value list with the search box and Select shown / Unselect shown", async () => {
    const { user } = mount();
    const menu = await openMenu(user, "Name");
    await user.click(menu.getByRole("button", { name: "Filter" }));
    await user.click(menu.getByRole("button", { name: "Filter values" }));

    await user.type(menu.getByRole("textbox", { name: "Search values" }), "as");
    expect(menu.getByRole("checkbox", { name: "Asha" })).toBeTruthy();
    expect(menu.queryByRole("checkbox", { name: "Ben" })).toBeNull();

    await user.click(menu.getByRole("button", { name: "Unselect shown" }));
    expect(menu.getByText("4 of 5 selected")).toBeTruthy();
    await user.click(menu.getByRole("button", { name: "Select shown" }));
    expect(menu.getByText("5 of 5 selected")).toBeTruthy();
  });

  it("Reset clears the filter again", async () => {
    const { user, container } = mount();
    let menu = await openMenu(user, "Name");
    await user.click(menu.getByRole("button", { name: "Filter" }));
    await user.click(menu.getByRole("button", { name: "Filter values" }));
    await user.click(menu.getByRole("checkbox", { name: "Ben" }));
    await user.click(menu.getByRole("button", { name: "Apply" }));
    expect(displayedNames(container)).not.toContain("Ben");

    menu = await openMenu(user, "Name");
    await user.click(menu.getByRole("button", { name: "Filter" }));
    await user.click(menu.getByRole("button", { name: "Reset" }));
    expect(displayedNames(container)).toContain("Ben");
  });
});

describe("date filter tree", () => {
  async function openDateTree(user: ReturnType<typeof userEvent.setup>) {
    const menu = await openMenu(user, "Due");
    await user.click(menu.getByRole("button", { name: "Filter" }));
    await user.click(menu.getByRole("button", { name: "Filter values" }));
    return menu;
  }
  const state = (menu: ReturnType<typeof within>, name: string) =>
    menu.getByRole("checkbox", { name }).getAttribute("aria-checked");

  it("shows years collapsed, all checked, with real expander buttons", async () => {
    const { user } = mount();
    const menu = await openDateTree(user);

    expect(state(menu, "2024")).toBe("true");
    expect(state(menu, "2023")).toBe("true");
    expect(state(menu, "Other values")).toBe("true");
    expect(menu.queryByRole("checkbox", { name: "March" })).toBeNull();

    const expander = menu.getByRole("button", { name: "Expand 2024" });
    expect(expander.tagName).toBe("BUTTON");
    expect(expander.getAttribute("type")).toBe("button");
    expect(expander.getAttribute("aria-expanded")).toBe("false");
    expect(expander.getAttribute("aria-controls")).toBeTruthy();

    await user.click(expander);
    const collapse = menu.getByRole("button", { name: "Collapse 2024" });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(collapse.getAttribute("aria-controls") ?? "")).not.toBeNull();
    expect(menu.getByRole("checkbox", { name: "March" })).toBeTruthy();
    expect(menu.getByRole("checkbox", { name: "November" })).toBeTruthy();
  });

  it("drives year > month > day selection with tri-state (mixed) parents", async () => {
    const { user } = mount();
    const menu = await openDateTree(user);
    await user.click(menu.getByRole("button", { name: "Expand 2024" }));
    await user.click(menu.getByRole("button", { name: "Expand March" }));

    // Deselect a month: its days clear, the year becomes mixed.
    await user.click(menu.getByRole("checkbox", { name: "March" }));
    expect(state(menu, "March")).toBe("false");
    expect(state(menu, "2")).toBe("false");
    expect(state(menu, "15")).toBe("false");
    expect(state(menu, "November")).toBe("true");
    expect(state(menu, "2024")).toBe("mixed");
    expect(menu.getByText("3 of 5 selected")).toBeTruthy();

    // Select one day: month and year both mixed.
    await user.click(menu.getByRole("checkbox", { name: "15" }));
    expect(state(menu, "15")).toBe("true");
    expect(state(menu, "March")).toBe("mixed");
    expect(state(menu, "2024")).toBe("mixed");

    // Select the other day: month fully checked again, so is the year.
    await user.click(menu.getByRole("checkbox", { name: "2" }));
    expect(state(menu, "March")).toBe("true");
    expect(state(menu, "2024")).toBe("true");

    // Deselecting the whole year clears every descendant.
    await user.click(menu.getByRole("checkbox", { name: "2024" }));
    expect(state(menu, "2024")).toBe("false");
    expect(state(menu, "November")).toBe("false");
    expect(state(menu, "15")).toBe("false");
    expect(state(menu, "2023")).toBe("true");
  });

  it("applies the date selection and filters the grid rows", async () => {
    const { user, container } = mount();
    const menu = await openDateTree(user);
    expect(displayedNames(container)).toHaveLength(5);

    // Drop 2023, the non-date bucket, and March of 2024: only 2024-11-30 (Cara) remains.
    await user.click(menu.getByRole("checkbox", { name: "2023" }));
    await user.click(menu.getByRole("checkbox", { name: "Other values" }));
    await user.click(menu.getByRole("button", { name: "Expand 2024" }));
    await user.click(menu.getByRole("checkbox", { name: "March" }));
    await user.click(menu.getByRole("button", { name: "Apply" }));

    expect(displayedNames(container)).toEqual(["Cara"]);
  });

  it("keeps the unselectable Apply guard when everything is deselected", async () => {
    const { user } = mount();
    const menu = await openDateTree(user);
    for (const name of ["2024", "2023", "Other values"]) {
      await user.click(menu.getByRole("checkbox", { name }));
    }
    expect((menu.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("search auto-expands matching nodes and Select/Unselect shown act on what is shown", async () => {
    const { user } = mount();
    const menu = await openDateTree(user);

    await user.type(menu.getByRole("textbox", { name: "Search values" }), "march");
    expect(menu.getByRole("checkbox", { name: "March" })).toBeTruthy();
    expect(menu.queryByRole("checkbox", { name: "November" })).toBeNull();
    expect(menu.queryByRole("checkbox", { name: "2023" })).toBeNull();

    await user.click(menu.getByRole("button", { name: "Unselect shown" }));
    expect(menu.getByText("3 of 5 selected")).toBeTruthy();
    await user.click(menu.getByRole("button", { name: "Select shown" }));
    expect(menu.getByText("5 of 5 selected")).toBeTruthy();
  });

  it("shows the empty state when search matches nothing", async () => {
    const { user } = mount();
    const menu = await openDateTree(user);
    await user.type(menu.getByRole("textbox", { name: "Search values" }), "zzzz");
    expect(menu.getByText("No matching values")).toBeTruthy();
  });

  it("does not render the tree for columns without filterTree", async () => {
    const { user } = mount({ columns: [col.text("name"), col.date("due")] });
    const menu = await openMenu(user, "Due");
    await user.click(menu.getByRole("button", { name: "Filter" }));
    await user.click(menu.getByRole("button", { name: "Filter values" }));
    expect(menu.queryByRole("button", { name: "Expand 2024" })).toBeNull();
    expect(menu.getByRole("checkbox", { name: "2024-03-15" })).toBeTruthy();
  });
});

describe("colour side panel", () => {
  const colorOptions: GridColorOption[] = [
    { value: "#ff0000", label: "Red", count: 2, swatch: "#ff0000" },
    { value: "", label: "", count: 3, swatch: null },
  ];
  const colorProps: Partial<GridMasterProps<Row>> = {
    resolveColorOptions: () => colorOptions,
    colorMenuVisibleValueCount: 2,
  };

  it("opens Sort by Color as a side panel; Escape closes the panel before the menu", async () => {
    const { user } = mount(colorProps);
    const menu = await openMenu(user, "Name");
    await user.click(menu.getByRole("button", { name: "Sort" }));
    await user.click(menu.getByRole("button", { name: /Sort by Color/ }));

    const panel = document.querySelector<HTMLElement>(".gm-menu-side-panel");
    expect(panel).not.toBeNull();
    await waitFor(() => expect(within(panel as HTMLElement).getByText("Red")).toBeTruthy());
    expect(within(panel as HTMLElement).getByText("No Fill")).toBeTruthy();
    // colorMenuVisibleValueCount=2 caps the list at 2 rows (2 * 38 + 8).
    const list = (panel as HTMLElement).querySelector<HTMLElement>(".gm-color-panel-list");
    expect(list?.style.maxHeight).toBe("84px");

    await user.keyboard("{Escape}");
    expect(document.querySelector(".gm-menu-side-panel")).toBeNull();
    expect(document.querySelector("[data-gm-column-menu]")).not.toBeNull();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.querySelector("[data-gm-column-menu]")).toBeNull());
  });

  it("filters by colour from the Filter section and keeps the draft until Apply", async () => {
    const { user } = mount(colorProps);
    const menu = await openMenu(user, "Name");
    await user.click(menu.getByRole("button", { name: "Filter" }));
    await user.click(menu.getByRole("button", { name: /Filter by Color/ }));
    const panel = document.querySelector<HTMLElement>(".gm-menu-side-panel");
    expect(panel).not.toBeNull();
    await waitFor(() => expect(within(panel as HTMLElement).getByText("Red")).toBeTruthy());
    await user.click(within(panel as HTMLElement).getByText("Red"));
    expect(menu.getByText(/1 color/)).toBeTruthy();
  });
});

describe("accessibility and stylesheet coverage", () => {
  async function openEverything() {
    const ctx = mount({
      resolveColorOptions: () => [{ value: "#ff0000", label: "Red", count: 1, swatch: "#ff0000" }],
    });
    const menuEl = (await openMenu(ctx.user, "Due")) && document.querySelector<HTMLElement>("[data-gm-column-menu]");
    if (!menuEl) throw new Error("no menu");
    const menu = within(menuEl);
    await ctx.user.click(menu.getByRole("button", { name: "Sort" }));
    await ctx.user.click(menu.getByRole("button", { name: /Sort by Color/ }));
    await ctx.user.click(menu.getByRole("button", { name: "Filter" }));
    await ctx.user.click(menu.getByRole("button", { name: "Filter values" }));
    await ctx.user.click(menu.getByRole("button", { name: "Expand 2024" }));
    await ctx.user.click(menu.getByRole("button", { name: "Expand March" }));
    await ctx.user.click(menu.getByRole("checkbox", { name: "15" }));
    await ctx.user.click(menu.getByRole("button", { name: /Filter by Color/ }));
    return { ...ctx, menuEl };
  }

  it("gives every interactive control in the open menu and side panel an accessible name", async () => {
    const { menuEl } = await openEverything();
    const controls = Array.from(menuEl.querySelectorAll<HTMLElement>("button, input, select, textarea"));
    expect(controls.length).toBeGreaterThan(10);
    for (const control of controls) {
      const name = (
        control.getAttribute("aria-label") ||
        control.textContent ||
        ""
      ).trim();
      expect(name, `unnamed control: ${control.outerHTML.slice(0, 120)}`).not.toBe("");
    }
  });

  it("uses only gm-/is- class names, each with a rule in grid.css (no Tailwind utilities)", async () => {
    const { menuEl } = await openEverything();
    const tokens = new Set<string>();
    for (const el of [menuEl, ...Array.from(menuEl.querySelectorAll("*"))]) {
      for (const token of Array.from(el.classList)) tokens.add(token);
    }
    // lucide icons add their own `lucide*` svg classes; they are not the menu's markup.
    const own = [...tokens].filter((token) => !token.startsWith("lucide"));
    expect(own.length).toBeGreaterThan(10);
    const unprefixed = own.filter((token) => !/^(gm-|is-)/.test(token));
    expect(unprefixed).toEqual([]);
    // Whole-token match so `.gm-menu-action-icon` does not satisfy `gm-menu-action`.
    const missing = own.filter((token) => !new RegExp(`\\.${token}(?![\\w-])`).test(gridCss));
    expect(missing).toEqual([]);
  });

  it("defines a rule for the partially selected tree item", () => {
    expect(gridCss).toMatch(/\.is-partial/);
  });
});
