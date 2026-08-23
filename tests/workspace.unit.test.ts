import { existsSync } from "node:fs";
import { expect, test } from "vitest";

test("v2 workspaces expose publishable packages", () => {
  expect(existsSync("packages/core/package.json")).toBe(true);
  expect(existsSync("packages/react/package.json")).toBe(true);
  expect(existsSync("apps/playground/package.json")).toBe(true);
});
