// Public-API guard: the package API is additive-only (CLAUDE.md). Every export (value or type)
// that shipped in a released baseline must still exist, with the same kind, in the current build.
// Baseline fixture: tests/fixtures/api-surface.v0.2.0.json, generated from a clean build of the
// v0.2.0 commit with `node scripts/api-surface.mjs <dist/index.d.ts>`.
// To grow the API, nothing to do. To raise the baseline for a new release, regenerate the fixture
// from that release's build; never edit it by hand to make a removal pass.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { listExports } from "../scripts/api-surface.mjs";

const require = createRequire(import.meta.url);

export function runApiSurfaceTests() {
  const baseline = JSON.parse(
    readFileSync(new URL("./fixtures/api-surface.v0.2.0.json", import.meta.url), "utf8")
  );
  const current = listExports(fileURLToPath(new URL("../dist/index.d.ts", import.meta.url)));
  const currentKinds = new Map(current.map((entry) => [entry.name, entry.kind]));

  // 1. Nothing from the baseline may disappear from the type surface.
  const missing = baseline.filter((entry) => !currentKinds.has(entry.name)).map((e) => e.name);
  assert.deepEqual(missing, [], `public exports removed since v0.2.0: ${missing.join(", ")}`);

  // 2. Nothing may change kind (a value turning into a type-only export breaks consumers).
  const kindChanged = baseline
    .filter((entry) => currentKinds.has(entry.name) && currentKinds.get(entry.name) !== entry.kind)
    .map((e) => e.name);
  assert.deepEqual(kindChanged, [], `export kind changed since v0.2.0: ${kindChanged.join(", ")}`);

  // 3. Value exports must also exist at runtime in the CommonJS bundle (not just in the .d.ts).
  const runtime = require("../dist/index.cjs");
  const missingAtRuntime = baseline
    .filter((entry) => entry.kind === "value" && !(entry.name in runtime))
    .map((e) => e.name);
  assert.deepEqual(
    missingAtRuntime,
    [],
    `value exports missing at runtime: ${missingAtRuntime.join(", ")}`
  );
}
