import { test } from "node:test";
import assert from "node:assert/strict";
import { excerpt } from "../src/search/corpus";
import { sourceCorpus } from "../src/search/source-corpus";

const formulas = (text: string) =>
  (text.replace(/\\\$/g, "").match(/\$/g) ?? []).length;

test("a snippet keeps a formula whole and drops nothing before its cut", () => {
  const summary =
    "A bike worth 500 dollars that loses 20% of its value each year keeps 80% of it. After one year it is worth $500 \\times 0.8 = 400$ dollars, then 320, then 256. Each value is the one before times 0.8. A rule that gives the first value and how to get each next value from the one before is called a recursive rule.";
  const shown = excerpt(summary);
  assert.equal(
    shown,
    "A bike worth 500 dollars that loses 20% of its value each year keeps 80% of it. After one year it is worth $500 \\times 0.8 = 400$ dollars, then 320, then 256.",
  );
  assert.ok(summary.startsWith(shown));
});

test("a long sentence ends at a whole word outside any formula", () => {
  const long = `Find ${"the value of $x + 2 = 3$ and ".repeat(8)}more.`;
  const shown = excerpt(long);
  assert.ok(shown.endsWith("…"));
  assert.equal(formulas(shown) % 2, 0, shown);
});

test("no snippet in the search corpus splits a formula", () => {
  const broken = sourceCorpus().filter((doc) => formulas(doc.snippet) % 2);
  assert.deepEqual(
    broken.map((doc) => doc.id),
    [],
  );
});
