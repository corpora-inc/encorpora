/**
 * The pack-consumability boundary.
 *
 * This library is built to be imported by a **pack** — a bundle that runs in a
 * WebView with no Node, no Tauri and no host app around it. Three things would
 * break that quietly, each of which compiles and passes every other test:
 *
 *   1. an import that escapes the library (into the app, the engine, a sibling),
 *      which drags host code into a pack bundle or fails to resolve at all;
 *   2. a bare specifier, which makes the library depend on a consumer's
 *      `node_modules` and on that consumer's resolution config;
 *   3. a `node:` builtin on the runtime surface, which a bundler either shims
 *      into weight nobody asked for or fails on outright.
 *
 * The validator (`src/validate/`) and the tests are exempt from (3) on purpose:
 * they are tooling, they run under Node, and nothing a pack imports reaches them.
 * That exemption is the reason this test exists rather than a comment — the line
 * between "the library" and "the tooling beside it" is invisible at runtime and
 * obvious only to a check that draws it.
 *
 * `engine/src/boundary.test.ts` is the same idea for the learner model. Neither
 * package can rely on the other's copy: they have independent CI filters.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import test from "node:test";
import { listSourceFiles, stripNonCode } from "./validate/lints/scan.ts";

const SRC = new URL(".", import.meta.url).pathname;

/**
 * Every `from "…"` and `import("…")` specifier in a file, comments removed.
 *
 * String literals are kept — the specifier *is* a string literal — so the pattern
 * has to be tight enough not to read prose. A specifier never spans a newline,
 * which is what keeps `"…the run to regroup from"` in a test message from being
 * mistaken for an import of whatever follows it.
 */
function specifiersIn(path: string): string[] {
  const code = stripNonCode(readFileSync(path, "utf8"), true);
  const out: string[] = [];
  const pattern = /(?:\bfrom|\bimport)\s*\(?\s*(["'])([^"'\n]+)\1/g;
  let match = pattern.exec(code);
  while (match !== null) {
    const specifier = match[2];
    if (specifier !== undefined) out.push(specifier);
    match = pattern.exec(code);
  }
  return out;
}

const FILES = listSourceFiles(SRC);

/** Tooling: runs under Node, never reached from a pack's import graph. */
function isTooling(path: string): boolean {
  return path.endsWith(".test.ts") || relative(SRC, path).startsWith("validate/");
}

test("the library has source files to check", () => {
  // The same fail-open the lint gates guard against: an empty walk asserts nothing.
  assert.ok(FILES.length > 30, `only ${String(FILES.length)} source files found under ${SRC}`);
});

test("no import escapes the library", () => {
  for (const path of FILES) {
    for (const specifier of specifiersIn(path)) {
      if (!specifier.startsWith(".")) continue;
      const resolved = new URL(specifier, `file://${path}`).pathname;
      assert.ok(
        resolved.startsWith(SRC),
        `${relative(SRC, path)} imports ${specifier}, which resolves outside the library`,
      );
    }
  }
});

test("no bare specifier anywhere: a pack resolves nothing on our behalf", () => {
  for (const path of FILES) {
    for (const specifier of specifiersIn(path)) {
      if (specifier.startsWith(".")) continue;
      assert.ok(
        specifier.startsWith("node:"),
        `${relative(SRC, path)} imports the bare specifier ${specifier}`,
      );
    }
  }
});

test("the runtime surface imports no Node builtin", () => {
  for (const path of FILES) {
    if (isTooling(path)) continue;
    for (const specifier of specifiersIn(path)) {
      assert.ok(
        !specifier.startsWith("node:"),
        `${relative(SRC, path)} imports ${specifier}; a pack has no Node`,
      );
    }
  }
});

test("the runtime surface touches no DOM and no host global", () => {
  // Renderers are *declarations* here (`render/registry.ts`); drawing belongs to
  // the pack. A DOM reference in this package would mean the library had started
  // deciding what a pack looks like.
  const forbidden = [/\bdocument\s*\./, /\bwindow\s*\./, /\bnavigator\s*\./, /\blocalStorage\b/, /\b__TAURI/];
  for (const path of FILES) {
    if (isTooling(path)) continue;
    const code = stripNonCode(readFileSync(path, "utf8"));
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(code), `${relative(SRC, path)} reaches for ${String(pattern)}`);
    }
  }
});
