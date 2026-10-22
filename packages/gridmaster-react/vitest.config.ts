// Vitest config for DOM (React) tests. Language: TypeScript 6, ES2022 runtime (Node >=20).
// Node-only suites live in tests/*.test.mjs and run through tests/run.mjs against dist/;
// DOM suites live in tests/dom/ and import from src/ directly so failures point at source.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/dom/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/dom/setup.ts"],
    // The library imports CSS from src/index.ts; DOM tests do not need styles processed.
    css: false,
    restoreMocks: true,
    // Full-grid mounts with user-event interaction take ~1 s locally; leave headroom for slow CI runners.
    testTimeout: 20000,
  },
});
