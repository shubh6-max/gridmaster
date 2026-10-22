// Task 6A — A-059 (strict, locale-aware coercion) and A-082 (link scheme allow-list).
// Node suite against the built ../dist/index.cjs. Only public exports are importable here.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { parseNumberStrict, parseDateToInputString, ensureHttps, safeLinkHref, parseCellValue } =
  require("../dist/index.cjs");
const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// A-059: number parsing — locale-aware, never silently 0/NaN, rejects junk.
// ---------------------------------------------------------------------------
function testNumberParsing() {
  const cases = [
    // input, locale, expected (null = not a number)
    ["1,234.56", "en-US", 1234.56],
    ["1.234,56", "de-DE", 1234.56],
    ["1 234,56", "fr-FR", 1234.56], // narrow no-break space thousands group
    ["1 234,56", "fr-FR", 1234.56], // regular NBSP variant
    ["12%", "en-US", 0.12],
    ["1e3", "en-US", 1000],
    [".5", "en-US", 0.5],
    ["-5", "en-US", -5],
    ["+5", "en-US", 5],
    ["(5)", "en-US", -5],
    ["  42  ", "en-US", 42],
    ["0x10", "en-US", null],
    ["Infinity", "en-US", null],
    ["NaN", "en-US", null],
    ["abc", "en-US", null],
    ["", "en-US", null],
    ["   ", "en-US", null],
    [42, "en-US", 42],
    [Number.NaN, "en-US", null],
  ];
  for (const [input, locale, expected] of cases) {
    const got = parseNumberStrict(input, locale);
    const label = `parseNumberStrict(${JSON.stringify(input)}, ${locale})`;
    if (expected === null) {
      assert.equal(got, null, `${label} expected null, got ${JSON.stringify(got)}`);
    } else {
      assert.equal(typeof got, "number", `${label} expected a number, got ${typeof got}`);
      assert.ok(Math.abs(got - expected) < 1e-9, `${label} expected ${expected}, got ${got}`);
    }
  }
  // default locale (omitted) behaves as en-US.
  assert.equal(parseNumberStrict("1,234.56"), 1234.56, "default locale parses en-US thousands");
}

// ---------------------------------------------------------------------------
// A-059: date parsing — ISO builds a local date (no TZ day-shift); locale hint
// disambiguates DD/MM vs MM/DD; unparseable stays the original string.
// ---------------------------------------------------------------------------
function testDateParsing() {
  assert.equal(parseDateToInputString("2026-03-15"), "2026-03-15", "ISO passes through");
  assert.equal(parseDateToInputString("03/04/2024", "en-US"), "2024-03-04", "en-US = MM/DD");
  assert.equal(parseDateToInputString("03/04/2024", "en-GB"), "2024-04-03", "en-GB = DD/MM");
  assert.equal(parseDateToInputString(""), "", "empty stays empty");
  assert.equal(parseDateToInputString("not a date"), "not a date", "unparseable stays text");
  const d = new Date(2024, 0, 2); // 2 Jan 2024 local
  assert.equal(parseDateToInputString(d), "2024-01-02", "Date -> local ISO");
}

// ISO date parse must not shift a day in zones east or west of UTC. Run in a child
// process pinned to a TZ, same technique as formulas-corpus.test.mjs.
function testDateTimezones() {
  const script = `
    const { parseDateToInputString } = require(${JSON.stringify(resolve(here, "../dist/index.cjs"))});
    process.stdout.write(JSON.stringify({
      la: parseDateToInputString("2026-03-15"),
      us: parseDateToInputString("03/04/2024", "en-US"),
    }));
  `;
  for (const tz of ["America/Los_Angeles", "Pacific/Auckland"]) {
    const raw = execFileSync(process.execPath, ["-e", script], {
      env: { ...process.env, TZ: tz },
      encoding: "utf8",
    });
    const out = JSON.parse(raw);
    assert.equal(out.la, "2026-03-15", `ISO must not shift in ${tz}`);
    assert.equal(out.us, "2024-03-04", `MM/DD must not shift in ${tz}`);
  }
}

// parseCellValue (the coercion-on-write path) must route through the strict helpers.
function testParseCellValueRouting() {
  const numberCol = { key: "n", title: "N", type: "number" };
  assert.equal(parseCellValue("1,234.56", {}, numberCol), 1234.56, "number paste uses strict parse");
  assert.equal(parseCellValue("abc", {}, numberCol), null, "unparseable number -> null (contract)");
  assert.equal(parseCellValue("", {}, numberCol), null, "empty number -> blank (null)");
  const dateCol = { key: "d", title: "D", type: "date" };
  assert.equal(parseCellValue("2026-03-15", {}, dateCol), "2026-03-15", "date paste keeps ISO");
  assert.equal(
    parseCellValue("03/04/2024", {}, dateCol, { locale: "en-GB" }),
    "2024-04-03",
    "date paste honours locale option"
  );
}

// ---------------------------------------------------------------------------
// A-082: link scheme allow-list (http/https/mailto/tel), case-insensitive,
// control-char obfuscation blocked, bare hosts get https, raw value is the href.
// ---------------------------------------------------------------------------
function testLinkSchemes() {
  const linked = [
    ["mailto:a@b.c", "mailto:a@b.c"],
    ["tel:+123", "tel:+123"],
    ["HTTP://x.y", "HTTP://x.y"],
    ["https://x.y/a?b=c#d", "https://x.y/a?b=c#d"],
    ["example.com", "https://example.com"],
    ["//evil.com", "https://evil.com"],
  ];
  for (const [input, href] of linked) {
    assert.equal(safeLinkHref(input), href, `safeLinkHref(${JSON.stringify(input)})`);
  }
  const rejected = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<b>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "",
    "   ",
  ];
  for (const input of rejected) {
    assert.equal(safeLinkHref(input), null, `safeLinkHref(${JSON.stringify(input)}) must reject`);
  }

  // ensureHttps keeps its name/signature; allowed schemes pass through, bare hosts get https,
  // rejected schemes return the RAW value (no mangling, no fake https:// link).
  assert.equal(ensureHttps("mailto:a@b.c"), "mailto:a@b.c", "mailto not mangled");
  assert.equal(ensureHttps("HTTP://x.y"), "HTTP://x.y", "HTTP not doubled");
  assert.equal(ensureHttps("example.com"), "https://example.com", "bare host gets https");
  assert.equal(ensureHttps("javascript:alert(1)"), "javascript:alert(1)", "rejected scheme stays raw");
  assert.equal(ensureHttps(""), "", "empty stays empty");
}

export function runDataCoercionTests() {
  testNumberParsing();
  testDateParsing();
  testDateTimezones();
  testParseCellValueRouting();
  testLinkSchemes();
}
