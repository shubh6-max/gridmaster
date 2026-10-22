import { runRowIdAndSelectionTests } from "./row-id-and-selection.test.mjs";
import { runClipboardAndPasteTests } from "./clipboard-and-paste.test.mjs";
import { runDataCoercionTests } from "./data-coercion.test.mjs";
import { runFillSeriesTests } from "./fill-series.test.mjs";
import { runFormatPainterTests } from "./format-painter.test.mjs";
import { runFormattingTests } from "./formatting.test.mjs";
import { runValidationTests } from "./validation.test.mjs";
import { runFormulaTests } from "./formulas.test.mjs";
import { runFormulaCorpusTests } from "./formulas-corpus.test.mjs";
import { runFormulaRefTests } from "./formula-refs.test.mjs";
import { runStructureTests } from "./structure.test.mjs";
import { runStateStructureTests } from "./state-structure.test.mjs";
import { runColorFilteringTests } from "./color-filtering.test.mjs";
import { runSortingTests } from "./sorting.test.mjs";
import { runFilteringTests } from "./filtering.test.mjs";
import { runNavigationTests } from "./navigation.test.mjs";
import { runConditionalFormattingTests } from "./conditional-formatting.test.mjs";
import { runSizingTests } from "./sizing.test.mjs";
import { runIntegrationTests } from "./integration.test.mjs";
import { runApiSurfaceTests } from "./api-surface.test.mjs";
import { runSsrTests } from "./ssr.test.mjs";

const suites = [
  ["row id and selection", runRowIdAndSelectionTests],
  ["clipboard and paste", runClipboardAndPasteTests],
  ["data coercion (numbers, dates, links)", runDataCoercionTests],
  ["fill series (linear/date/blank/up-left + tz)", runFillSeriesTests],
  ["validation (rules, blanks, bad regex, throwing custom)", runValidationTests],
  ["format painter", runFormatPainterTests],
  ["formatting", runFormattingTests],
  ["formulas", runFormulaTests],
  ["formulas corpus (table-driven + fuzz + tz)", runFormulaCorpusTests],
  ["formula references (shift/rewrite + range reuse)", runFormulaRefTests],
  ["structure", runStructureTests],
  ["state and structure (history, ids, meta, clone)", runStateStructureTests],
  ["color filtering", runColorFilteringTests],
  ["sorting (equivalence corpus + decorate-sort-undecorate)", runSortingTests],
  ["filtering (blank numeric, hoist, formula values)", runFilteringTests],
  ["navigation (paging, document edges, data regions)", runNavigationTests],
  ["conditional formatting (evaluator + clock)", runConditionalFormattingTests],
  ["sizing (auto-fit sampling + measured width)", runSizingTests],
  ["integration", runIntegrationTests],
  ["public api surface (additive-only)", runApiSurfaceTests],
  ["server-side render safety (no jsdom)", runSsrTests],
];

for (const [label, suite] of suites) {
  suite();
  console.log(`ok - ${label}`);
}

console.log(`passed ${suites.length} test suites`);
