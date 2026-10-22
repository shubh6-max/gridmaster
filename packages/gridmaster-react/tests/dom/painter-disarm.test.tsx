// Task 7B — F-012: the format painter must not stay armed if the host flips editable → readonly
// mid-gesture. Arming then losing formatting permission disarms it, so the next click paints
// nothing. Language: TS 6 strict, React 19, vitest + jsdom.
import { describe, expect, it } from "vitest";
import {
  FORMAT_PAINTER_BUTTON,
  cellOf,
  clickCell,
  mountGrid,
  toolbarButton,
} from "./propsWiredHarness";

const RED = "rgb(255, 0, 0)";
const SEEDED = { "[REDACTED_IPV6_ADDRESS_1]name": { backgroundColor: "#ff0000" } };

describe("F-012: format painter disarms when formatting becomes disallowed", () => {
  it("flipping to readonly while the painter is armed stops it from painting the next cell", async () => {
    const { user, ui, rerender } = mountGrid({ initialCellMeta: SEEDED });

    await clickCell(user, "Asha");
    await user.click(toolbarButton(FORMAT_PAINTER_BUTTON)); // arm
    expect(document.querySelector(".gm-format-painter-target")).not.toBeNull();

    // Host flips to readonly mid-gesture: the painter must disarm (canFormat → false).
    rerender(ui({ mode: "readonly", initialCellMeta: SEEDED }));
    expect(document.querySelector(".gm-format-painter-target")).toBeNull();

    // A click that would have painted Ben does nothing now.
    await clickCell(user, "Ben");
    expect(cellOf("Ben").style.background).not.toContain(RED);
  });
});
