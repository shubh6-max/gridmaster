// Reports (and enforces) the size a consumer's bundler pays for the ESM entry:
// dist/index.js re-bundled with react / react-dom / lucide-react external and minified, then gzipped.
// vite's lib ES output is intentionally unminified, so raw `gzip dist/index.js` over-states the cost by ~15%.
// Usage: node scripts/size.mjs [maxGzipBytes]   (default budget 61440 = 60 KiB). Exit 1 when over budget.
// Language: Node >=20 ESM. Uses rolldown (a vite 8 dependency); Task 12 may swap in size-limit.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const budget = Number(process.argv[2] ?? 61440);
const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const require = createRequire(import.meta.url);

try {
  const { rolldown } = require("rolldown");
  const bundle = await rolldown({
    input: entry,
    external: [/^react(\/|$)/, /^react-dom(\/|$)/, /^lucide-react(\/|$)/],
    logLevel: "silent",
  });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  const code = output[0].code;
  const raw = readFileSync(entry);
  const minGzip = gzipSync(code).length;
  console.log(
    `dist/index.js  raw ${raw.length} B | gzip ${gzipSync(raw).length} B | minified ${Buffer.byteLength(code)} B | minified+gzip ${minGzip} B (budget ${budget} B)`
  );
  if (minGzip > budget) {
    console.error(`OVER BUDGET by ${minGzip - budget} B`);
    process.exit(1);
  }
} catch (error) {
  console.error("size check failed:", error instanceof Error ? error.message : String(error));
  process.exit(2);
}
