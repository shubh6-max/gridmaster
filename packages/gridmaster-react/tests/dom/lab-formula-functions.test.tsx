// The "Formula functions" lab scenario evaluates every GridCraft-port case in the formulas corpus.
// This guards the view itself: it lists the cases, reports all of them as passing, and mounts
// cleanly under StrictMode. It mounts the scenario directly (not through the registry glob).
// Language: TypeScript 6 (strict), React 19, vitest + jsdom.
import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createFormulaEvaluator } from "../../src";
import { SHEET, buildSheet, scenario, sheetColumns } from "../../demo/lab/scenarios/formula-functions";

function mount() {
  const Component = scenario.Component;
  return render(
    <StrictMode>
      <Component />
    </StrictMode>
  );
}

describe("lab: formula functions", () => {
  it("mounts under StrictMode without console.error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = mount();
    expect(errorSpy).not.toHaveBeenCalled();
    unmount();
  });

  it("reports every GridCraft-port corpus case as passing", () => {
    mount();
    const summary = screen.getByTestId("port-summary").textContent ?? "";
    const match = /^(\d+) \/ (\d+) passing$/.exec(summary);
    expect(match, `summary was "${summary}"`).not.toBeNull();
    expect(Number(match?.[2])).toBeGreaterThan(0); // at least one port case is listed
    expect(match?.[1]).toBe(match?.[2]); // and all of them pass
  });

  it("every live-sheet formula evaluates to the expected text beside it", () => {
    const rows = buildSheet();
    const evaluator = createFormulaEvaluator(rows, sheetColumns());
    const mismatches: string[] = [];
    SHEET.forEach(([label, formula, expected], i) => {
      if (expected.startsWith("a ")) return; // free-text expectation (random values)
      const result = evaluator.evaluateCell(i, "e");
      const actual = result.error ?? result.value;
      const want = Number(expected);
      // Errors and text compare exactly (booleans as Excel shows them); numbers to 1e-12.
      const shown = typeof actual === "boolean" ? (actual ? "TRUE" : "FALSE") : String(actual);
      const ok = expected.startsWith("#")
        ? actual === expected
        : typeof actual === "number"
          ? Number.isFinite(want) && Math.abs(actual - want) < 1e-12
          : shown === expected;
      if (!ok) mismatches.push(`${label}: ${formula} gave ${String(actual)}, expected ${expected}`);
    });
    expect(mismatches).toEqual([]);
  });

  it("evaluates a typed formula in the Try box", () => {
    mount();
    // Default text is =ROUNDUP(3.14159,3)
    expect(screen.getByTestId("try-result").textContent).toBe("3.142");
  });
});
