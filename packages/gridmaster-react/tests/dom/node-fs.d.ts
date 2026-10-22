// Test-only: the repo has no @types/node, so declare the one Node API the stylesheet-coverage test
// uses (reading grid.css as text; Vite's ?raw import yields "" under vitest's css:false).
// Language: TypeScript 6.
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}
