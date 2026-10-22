/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    exclude: ["**/node_modules/**", "**/legacy/**", "tests/e2e/**"],
    projects: [
      {
        extends: true,
        test: {
          include: ["tests/**/*.unit.test.ts", "tests/**/*.integration.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          include: ["packages/core/src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          include: ["packages/react/src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: [],
        },
      },
    ],
  },
});
