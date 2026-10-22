// Year > month > day tree over ISO date filter values. Language: TypeScript 6 (strict).
// Pure helpers (no React): the column menu renders and toggles what these build.

// Fixed English names on purpose: output must not depend on the runtime locale.
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type DateFilterTreeNode = {
  key: string;
  label: string;
  /** Every raw filter value at or below this node. */
  values: Set<string>;
  children: DateFilterTreeNode[];
};

export type DateFilterTreeCheckState = "checked" | "mixed" | "unchecked";

type CalendarDate = { year: number; month: number; day: number };

/** Fixed-locale comparison so ordering is the same on every machine. */
function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function parseCalendarDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // setUTCFullYear (unlike Date.UTC) does not remap years 0-99 to 1900-1999.
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);

  const valid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  return valid ? { year, month, day } : null;
}

function createNode(
  key: string,
  label: string,
  values: Iterable<string>,
  children: DateFilterTreeNode[] = []
): DateFilterTreeNode {
  return { key, label, values: new Set([...values].sort()), children };
}

/** Select every value of a node, or deselect them all when they are already all selected. */
export function toggleDateFilterTreeValues(
  selectedValues: ReadonlySet<string>,
  nodeValues: Iterable<string>
): Set<string> {
  const next = new Set(selectedValues);
  const values = [...nodeValues];
  const allSelected = values.length > 0 && values.every((value) => next.has(value));

  for (const value of values) {
    if (allSelected) next.delete(value);
    else next.add(value);
  }

  return next;
}

export function toggleDateFilterTreeCollapsedKey(
  collapsedKeys: ReadonlySet<string>,
  key: string
): Set<string> {
  const next = new Set(collapsedKeys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Keys of every expandable node, so the tree starts fully collapsed. */
export function getInitialCollapsedDateFilterTreeKeys(
  nodes: readonly DateFilterTreeNode[]
): Set<string> {
  const collapsed = new Set<string>();

  const visit = (current: readonly DateFilterTreeNode[]): void => {
    for (const node of current) {
      if (!node.children.length) continue;
      collapsed.add(node.key);
      visit(node.children);
    }
  };

  visit(nodes);
  return collapsed;
}

export function getDateFilterTreeCheckState(
  node: DateFilterTreeNode,
  selectedValues: ReadonlySet<string>
): DateFilterTreeCheckState {
  let selected = 0;
  for (const value of node.values) {
    if (selectedValues.has(value)) selected++;
  }
  if (selected === 0) return "unchecked";
  return selected === node.values.size ? "checked" : "mixed";
}

/**
 * Keep nodes whose label contains `query` (already lower-cased by the caller) or that have a
 * matching descendant. A pruned ancestor's `values` are recomputed from what remains so that
 * toggling it only touches what the user can see.
 */
export function filterDateFilterTreeBySearch(
  nodes: DateFilterTreeNode[],
  query: string
): DateFilterTreeNode[] {
  if (!query) return nodes;

  return nodes.flatMap((node) => {
    if (node.label.toLowerCase().includes(query)) return [node];

    const children = filterDateFilterTreeBySearch(node.children, query);
    if (!children.length) return [];

    const values = new Set<string>();
    for (const child of children) {
      for (const value of child.values) values.add(value);
    }
    return [{ ...node, values, children }];
  });
}

/** Union of the leaf values of the given nodes (what "select shown" should act on). */
export function collectDateFilterTreeValues(nodes: readonly DateFilterTreeNode[]): Set<string> {
  const values = new Set<string>();

  const visit = (current: readonly DateFilterTreeNode[]): void => {
    for (const node of current) {
      if (node.children.length) visit(node.children);
      else for (const value of node.values) values.add(value);
    }
  };

  visit(nodes);
  return values;
}

export function buildDateFilterTree(
  values: Iterable<string | null | undefined>
): DateFilterTreeNode[] {
  type DayBucket = Set<string>;
  type MonthBucket = { values: Set<string>; days: Map<number, DayBucket> };
  type YearBucket = { values: Set<string>; months: Map<number, MonthBucket> };

  const years = new Map<number, YearBucket>();
  const otherValues = new Set<string>();

  for (const rawValue of values) {
    const value = String(rawValue ?? "");
    const parts = parseCalendarDate(value);

    if (!parts) {
      otherValues.add(value);
      continue;
    }

    let year = years.get(parts.year);
    if (!year) {
      year = { values: new Set(), months: new Map() };
      years.set(parts.year, year);
    }
    year.values.add(value);

    let month = year.months.get(parts.month);
    if (!month) {
      month = { values: new Set(), days: new Map() };
      year.months.set(parts.month, month);
    }
    month.values.add(value);

    let day = month.days.get(parts.day);
    if (!day) {
      day = new Set();
      month.days.set(parts.day, day);
    }
    day.add(value);
  }

  // Newest year and month first; days ascending within a month.
  const yearNodes = [...years.entries()]
    .sort(([left], [right]) => right - left)
    .map(([yearNumber, year]) => {
      const monthNodes = [...year.months.entries()]
        .sort(([left], [right]) => right - left)
        .map(([monthNumber, month]) => {
          const dayNodes = [...month.days.entries()]
            .sort(([left], [right]) => left - right)
            .map(([dayNumber, dayValues]) =>
              createNode(
                `date:${yearNumber}:${monthNumber}:${dayNumber}`,
                String(dayNumber),
                dayValues
              )
            );

          return createNode(
            `date:${yearNumber}:${monthNumber}`,
            MONTH_NAMES[monthNumber - 1],
            month.values,
            dayNodes
          );
        });

      return createNode(`date:${yearNumber}`, String(yearNumber), year.values, monthNodes);
    });

  if (otherValues.size) {
    const otherChildren = [...otherValues]
      .sort((left, right) => {
        if (!left) return -1;
        if (!right) return 1;
        return compareText(left, right);
      })
      .map((value) => createNode(`other:${value || "blank"}`, value || "(Blanks)", [value]));

    yearNodes.push(createNode("other", "Other values", otherValues, otherChildren));
  }

  return yearNodes;
}
