// Unit tests for the column-menu layout helpers. Language: TypeScript 6 (strict), vitest.
import { describe, expect, it } from "vitest";
import { getColorMenuOptionListMaxHeight } from "../../src/menus/colorMenuLayout";
import { getColumnMenuSidePanelPosition } from "../../src/menus/columnMenuLayout";

describe("getColorMenuOptionListMaxHeight", () => {
  it("scales with the number of visible rows (38px per row + 8px padding)", () => {
    expect(getColorMenuOptionListMaxHeight(1)).toBe(46);
    expect(getColorMenuOptionListMaxHeight(4)).toBe(160);
    expect(getColorMenuOptionListMaxHeight(100)).toBe(3808);
  });

  it("floors fractional counts", () => {
    expect(getColorMenuOptionListMaxHeight(3.9)).toBe(getColorMenuOptionListMaxHeight(3));
  });

  it("falls back to one row for zero, negative, NaN, null, undefined and infinite input", () => {
    for (const bad of [0, -5, Number.NaN, null, undefined, Number.POSITIVE_INFINITY]) {
      expect(getColorMenuOptionListMaxHeight(bad)).toBe(46);
    }
  });
});

describe("getColumnMenuSidePanelPosition", () => {
  const base = {
    panelWidth: 232,
    panelHeight: 260,
    viewportWidth: 1000,
    viewportHeight: 800,
  };

  it("places the panel to the right of the anchor when it fits, 8px gap, top aligned above anchor", () => {
    const result = getColumnMenuSidePanelPosition({
      ...base,
      anchorRect: { left: 100, right: 300, top: 200 },
    });
    expect(result).toEqual({ left: 308, top: 192, placement: "right" });
  });

  it("flips to the left when the right side is too small and the left side is larger", () => {
    const result = getColumnMenuSidePanelPosition({
      ...base,
      anchorRect: { left: 600, right: 900, top: 200 },
    });
    expect(result.placement).toBe("left");
    expect(result.left).toBe(600 - 232 - 8);
  });

  it("keeps the panel on the right when neither side fits but right has more room", () => {
    const result = getColumnMenuSidePanelPosition({
      ...base,
      viewportWidth: 300,
      anchorRect: { left: 10, right: 150, top: 100 },
    });
    expect(result.placement).toBe("right");
    // clamped so it never leaves the viewport (8px inset)
    expect(result.left).toBe(300 - 232 - 8);
  });

  it("clamps to the viewport insets on every edge", () => {
    const tooHigh = getColumnMenuSidePanelPosition({
      ...base,
      anchorRect: { left: 100, right: 300, top: -50 },
    });
    expect(tooHigh.top).toBe(8);
    const tooLow = getColumnMenuSidePanelPosition({
      ...base,
      anchorRect: { left: 100, right: 300, top: 790 },
    });
    expect(tooLow.top).toBe(800 - 260 - 8);
    const tooFarLeft = getColumnMenuSidePanelPosition({
      ...base,
      anchorRect: { left: 10, right: 20, top: 100 },
      viewportWidth: 200,
    });
    expect(tooFarLeft.left).toBeGreaterThanOrEqual(8);
  });

  it("honours a custom gap", () => {
    const result = getColumnMenuSidePanelPosition({
      ...base,
      gap: 20,
      anchorRect: { left: 100, right: 300, top: 200 },
    });
    expect(result).toEqual({ left: 320, top: 180, placement: "right" });
  });
});
