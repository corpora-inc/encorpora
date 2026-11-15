// @vitest-environment node
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { myStrings } from "../../../../scripts/check-no-my-chrome";

/* The whole-source scan is a lint (`npm run lint:navigation` runs
   scripts/check-no-my-chrome.ts), so a test run never waits on it. Here,
   only its scanner, on one small fixture. */

test("the check finds “my” in strings, template parts and JSX text, and only there", () => {
  const sample = resolve(
    process.cwd(),
    "src/web/ui/__tests__/fixtures/my-chrome.tsx",
  );
  expect(myStrings(sample)).toEqual([
    "My practice",
    "my levels",
    "Keep my settings",
    "for my child",
    "My class",
  ]);
});

test("words without “my” cost nothing to scan", () => {
  expect(myStrings("plain.tsx", 'const a = "Practice at a level";')).toEqual(
    [],
  );
});
