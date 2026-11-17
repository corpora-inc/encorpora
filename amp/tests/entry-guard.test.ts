import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/** public/entry-guard.js is served as written, to browsers too old to run
 * AMP, so it can tell them so: it must stay ES5. */
test("the entry guard is plain ES5, so any browser runs it", () => {
  const code = readFileSync("public/entry-guard.js", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  for (const [syntax, pattern] of [
    ["arrow function", /=>/],
    ["template literal", /`/],
    ["let/const", /\b(?:let|const)\s/],
    ["class", /\bclass\s/],
    ["spread or rest", /\.\.\./],
    ["trailing comma in a call", /,\s*\)/],
    ["optional chaining", /\?\./],
    ["nullish coalescing", /\?\?/],
    ["async/await", /\b(?:async|await)\b/],
  ] as const)
    assert.doesNotMatch(code, pattern, syntax);
});

test("every document runs the guard before the app", () => {
  const html = readFileSync("index.html", "utf8");
  const guard = html.indexOf('src="/entry-guard.js"');
  assert.ok(guard > 0, "index.html loads the guard");
  assert.match(
    html,
    /<script vite-ignore defer src="\/entry-guard\.js"><\/script>/,
  );
  assert.ok(guard < html.indexOf('type="module"'), "before the app's module");
});
