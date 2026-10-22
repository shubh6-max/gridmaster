// Lists every public export (values AND types) of a built package entry d.ts.
// Usage: node scripts/api-surface.mjs <path/to/dist/index.d.ts>   -> prints sorted JSON to stdout.
// Used to (a) capture the v0.2.0 baseline in tests/fixtures/api-surface.v0.2.0.json and
// (b) let tests/api-surface.test.mjs assert the public API only ever grows (additive-only rule).
// Language: Node >=20 ESM (plain JS, no TS syntax).
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

/**
 * @param {string} entryDts absolute or relative path to an index.d.ts
 * @returns {{name: string, kind: "value" | "type"}[]} exports sorted by name
 */
export function listExports(entryDts) {
  const entry = path.resolve(entryDts);
  const program = ts.createProgram([entry], {
    noEmit: true,
    skipLibCheck: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX,
    types: [],
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  if (!source) throw new Error(`Cannot read ${entry}`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (!moduleSymbol) throw new Error(`${entry} is not a module`);

  return checker
    .getExportsOfModule(moduleSymbol)
    .map((symbol) => {
      // Follow `export { X } from` aliases so the kind reflects the real declaration.
      const resolved =
        symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      const isValue = (resolved.flags & ts.SymbolFlags.Value) !== 0;
      return { name: symbol.getName(), kind: isValue ? "value" : "type" };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// Only run as a CLI when invoked directly (the test imports listExports instead).
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: node scripts/api-surface.mjs <path/to/dist/index.d.ts>");
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(listExports(target), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
