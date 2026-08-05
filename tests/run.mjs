import { runRowIdAndSelectionTests } from "./row-id-and-selection.test.mjs";
import { runClipboardAndPasteTests } from "./clipboard-and-paste.test.mjs";
import { runFormatPainterTests } from "./format-painter.test.mjs";
import { runFormattingTests } from "./formatting.test.mjs";
import { runFormulaTests } from "./formulas.test.mjs";
import { runStructureTests } from "./structure.test.mjs";
import { runColorFilteringTests } from "./color-filtering.test.mjs";

const suites = [
  ["row id and selection", runRowIdAndSelectionTests],
  ["clipboard and paste", runClipboardAndPasteTests],
  ["format painter", runFormatPainterTests],
  ["formatting", runFormattingTests],
  ["formulas", runFormulaTests],
  ["structure", runStructureTests],
  ["color filtering", runColorFilteringTests],
];

for (const [label, suite] of suites) {
  suite();
  console.log(`ok - ${label}`);
}

console.log(`passed ${suites.length} test suites`);
