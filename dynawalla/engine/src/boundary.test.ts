/**
 * Gate EG-1 — engine purity, as a build failure.
 *
 * ARCHITECTURE.md puts this test in the **first** engine PR, before any model code,
 * and TEST_STRATEGY.md calls it architecture as a build failure. What it asserts:
 * nothing under `engine/src` reaches IO, the DOM, `Date.now` or `Math.random`, and
 * nothing imports the app, the curriculum, or any package at all.
 *
 * That is not tidiness. Determinism is a gate (EG-2: identical seeds produce
 * byte-identical transcripts on macOS and Linux), and a single `Date.now()` inside
 * the model would make a bug report irreproducible and every golden transcript a
 * coin flip.
 *
 * The float scan is duplicated here rather than imported from `curriculum/`,
 * deliberately: the two packages have independent CI filters, and an engine-only
 * pull request must be able to fail this on its own.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const SRC = dirname(fileURLToPath(import.meta.url));

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".ts")) out.push(full);
    }
  };
  walk(SRC);
  return out;
}

/** Blank out comments and string literals so prose cannot trip a scan. */
function code(text: string): string {
  const out: string[] = [];
  let i = 0;
  const blank = (from: number, to: number): void => {
    for (let j = from; j < to; j++) out.push(text[j] === "\n" ? "\n" : " ");
  };
  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      blank(i, stop);
      i = stop;
    } else if (char === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (char === '"' || char === "'" || char === "`") {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text[j] === char) {
          j += 1;
          break;
        }
        j += 1;
      }
      blank(i, j);
      i = j;
    } else {
      out.push(char ?? "");
      i += 1;
    }
  }
  return out.join("");
}

const IMPERATIVE = [
  { name: "wall clock", pattern: /\bDate\s*\.\s*now\b|\bnew\s+Date\b/ },
  { name: "randomness", pattern: /\bMath\s*\.\s*random\b|\bcrypto\s*\.\s*getRandomValues\b/ },
  { name: "high-resolution clock", pattern: /\bperformance\s*\.\s*now\b|\bprocess\s*\.\s*hrtime\b/ },
  { name: "timer", pattern: /\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/ },
  { name: "DOM", pattern: /\b(document|window|navigator|localStorage|indexedDB)\s*\./ },
  { name: "network", pattern: /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/ },
  { name: "process or filesystem", pattern: /\bprocess\s*\.\s*(env|argv|cwd)\b|\breadFileSync\b|\bwriteFileSync\b/ },
  { name: "locale-dependent formatting", pattern: /\bIntl\s*\.|\btoLocale[A-Z]/ },
] as const;

const FLOAT_MATH = [
  "random",
  "exp",
  "expm1",
  "log",
  "log1p",
  "log2",
  "log10",
  "pow",
  "sqrt",
  "cbrt",
  "hypot",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "sinh",
  "cosh",
  "tanh",
  "fround",
  "E",
  "PI",
  "LN2",
  "LN10",
  "LOG2E",
  "LOG10E",
  "SQRT2",
  "SQRT1_2",
];

const FLOATS = [
  { name: "fractional numeric literal", pattern: /(?<![\w$.])\d[\d_]*\.\d/ },
  { name: "leading-dot numeric literal", pattern: /(?<![\w$.)\]])\.\d/ },
  { name: "negative-exponent literal", pattern: /(?<![\w$.])\d[\d_]*(\.\d+)?[eE]-\d/ },
  { name: "floating-point Math member", pattern: new RegExp(`\\bMath\\.(${FLOAT_MATH.join("|")})\\b`) },
  { name: "parseFloat", pattern: /\bparseFloat\s*\(/ },
  { name: "toFixed", pattern: /\.toFixed\s*\(/ },
] as const;

const IMPORT = /^\s*import\s[^;]*?from\s*["']([^"']+)["']/gm;

function offenders(files: readonly string[], patterns: readonly { name: string; pattern: RegExp }[]): string[] {
  const found: string[] = [];
  for (const file of files) {
    const scanned = code(readFileSync(file, "utf8"));
    scanned.split("\n").forEach((line, index) => {
      for (const { name, pattern } of patterns) {
        if (new RegExp(pattern.source, pattern.flags).test(line)) {
          found.push(`${file}:${String(index + 1)} ${name}: ${line.trim()}`);
        }
      }
    });
  }
  return found;
}

test("EG-1: the engine reaches no clock, no randomness, no IO and no DOM", () => {
  const files = sourceFiles().filter((file) => !file.endsWith(".test.ts"));
  assert.ok(files.length >= 8, `expected engine sources, found ${String(files.length)}`);
  assert.deepEqual(offenders(files, IMPERATIVE), []);
});

test("EG-1: even the tests use no clock and no randomness", () => {
  // A test that reaches for `Math.random` makes EG-2 unfalsifiable: the transcript
  // it produces is not the transcript anyone else produces.
  const tests = sourceFiles().filter((file) => file.endsWith(".test.ts"));
  const forbidden = IMPERATIVE.filter(
    (rule) => rule.name === "wall clock" || rule.name === "randomness" || rule.name === "high-resolution clock",
  );
  assert.deepEqual(offenders(tests, forbidden), []);
});

test("EG-1: the engine imports nothing outside itself", () => {
  const files = sourceFiles().filter((file) => !file.endsWith(".test.ts"));
  const external: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(IMPORT)) {
      const specifier = match[1];
      if (specifier === undefined) continue;
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        if (specifier.includes("curriculum") || specifier.includes("dynawalla-app")) {
          external.push(`${file}: ${specifier}`);
        }
        continue;
      }
      external.push(`${file}: ${specifier}`);
    }
  }
  assert.deepEqual(external, [], "the learner model is a pure library and depends on nothing");
});

test("M-05: no floating-point arithmetic anywhere in the engine", () => {
  assert.deepEqual(offenders(sourceFiles(), FLOATS), []);
});

test("EG-1: the purity scan itself can fail", () => {
  // A gate with no failing case is indistinguishable from a gate that passes
  // everything. These fixtures are assembled rather than written, so this file
  // does not violate the rules it enforces.
  const clock = `const t = Date${"."}now();`;
  const random = `const r = Math${"."}random();`;
  const float = `const x = 0${"."}5;`;
  const write = (text: string): string[] => {
    const line = code(text);
    const hits: string[] = [];
    for (const { name, pattern } of [...IMPERATIVE, ...FLOATS]) {
      if (new RegExp(pattern.source, pattern.flags).test(line)) hits.push(name);
    }
    return hits;
  };
  assert.deepEqual(write(clock), ["wall clock"]);
  assert.deepEqual(write(random), ["randomness", "floating-point Math member"]);
  assert.deepEqual(write(float), ["fractional numeric literal"]);
  assert.deepEqual(write(`const s = "Date${"."}now()";`), [], "a string is not a call");
  assert.deepEqual(write(`// Date${"."}now() is banned`), [], "and a comment is not either");
});
