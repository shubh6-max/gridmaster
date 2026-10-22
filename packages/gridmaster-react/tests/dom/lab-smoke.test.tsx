// Smoke test for the Feature Lab (demo/lab): every scenario mounts cleanly under StrictMode, has a
// checklist, the sidebar lists them all, the a11y inspector reads the live grid, and checklist state
// persists. Language: TypeScript 6 (strict), React 19, vitest + jsdom.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Lab from "../../demo/lab/Lab";
import { resetAllChecks } from "../../demo/lab/kit";
import { scenarios } from "../../demo/lab/registry";

function mountLab(hash: string) {
  window.location.hash = hash;
  return render(
    <StrictMode>
      <Lab />
    </StrictMode>
  );
}

beforeEach(() => {
  resetAllChecks();
  try {
    localStorage.clear();
  } catch {
    // storage blocked: nothing to clear
  }
});

describe("Feature Lab registry + sidebar", () => {
  it("registers at least the 11 planned scenarios with unique ids", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(11);
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length);
  });

  it("lists every scenario in the sidebar", () => {
    mountLab("#/overview");
    const nav = screen.getByRole("navigation", { name: "Scenarios" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(scenarios.length);
    for (const scenario of scenarios) {
      expect(within(nav).getByRole("link", { name: new RegExp(scenario.title) })).toBeTruthy();
    }
  });

  it("shows the library version and the reset button", () => {
    mountLab("#/overview");
    expect(screen.getByTestId("lib-version").textContent).toMatch(/v\d+\.\d+\.\d+/);
    expect(screen.getByRole("button", { name: "Reset all checks" })).toBeTruthy();
  });
});

describe.each(scenarios.map((s) => [s.id, s.title] as const))("scenario %s", (id, title) => {
  it("renders under StrictMode without console.error and shows a checklist", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container, unmount } = mountLab(`#/${id}`);

    const root = container.querySelector(`[data-scenario="${id}"]`);
    expect(root, `scenario root for ${title}`).not.toBeNull();
    const checks = container.querySelectorAll<HTMLInputElement>(".lab-check input[type=checkbox]");
    expect(checks.length).toBeGreaterThan(0);
    expect(container.querySelector(".lab-check-do")?.textContent?.trim()).toBeTruthy();

    unmount();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("Accessibility inspector", () => {
  it("reads role=grid from the mounted grid", async () => {
    const { container } = mountLab("#/accessibility");
    await waitFor(() => {
      const cell = container.querySelector('[data-inspector="role"] td:last-child');
      expect(cell?.textContent).toBe("grid");
    });
  });
});

describe("Checklist persistence", () => {
  it("keeps a ticked check across unmount/remount via localStorage", () => {
    const first = mountLab("#/flags");
    const box = first.container.querySelector<HTMLInputElement>(
      ".lab-check input[type=checkbox]:not(:disabled)"
    );
    expect(box).not.toBeNull();
    if (!box) return;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    expect(localStorage.getItem("gm-lab:flags:0")).toBe("1");
    first.unmount();

    const second = mountLab("#/flags");
    const again = second.container.querySelector<HTMLInputElement>(
      ".lab-check input[type=checkbox]:not(:disabled)"
    );
    expect(again?.checked).toBe(true);
    expect(second.container.querySelector('[data-testid="progress"]')?.textContent).toMatch(/^1\//);
  });
});
