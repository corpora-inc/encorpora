import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/** CP-2 r3 N2: the held link has one home, this page's memory. No tab-bound
 * store a cloned or opened tab could copy, and no name to forge. */
test("capability-entry keeps nothing in sessionStorage, localStorage or window.name", () => {
  const source = readFileSync(
    new URL("../src/web/capability-entry.ts", import.meta.url),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(source, /sessionStorage\.setItem|localStorage\.setItem/);
  assert.doesNotMatch(source, /window\.name|\.name\s*=/);
});
