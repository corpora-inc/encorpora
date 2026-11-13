import assert from "node:assert/strict";
import test from "node:test";
import { article, withArticle } from "../src/math/agreement";
import { fractionAmount } from "../src/math/story-kit/fractions";
import { generateProblem } from "../src/math/engine";

const cases: [string | number, "a" | "an"][] = [
  ...[
    "apple",
    "equilateral triangle",
    "isosceles triangle",
    "obtuse angle",
    "ellipse",
    "integer",
    "octagon",
    "umbrella",
    "unknown",
    "unidentified",
    "unimproved",
    "uninteresting",
    "unusual",
    "hour",
    "hourglass",
    "honest",
    "honor",
    "honour",
    "heir",
    "nth root",
    "x-intercept",
    "n-gon",
    "L shape",
    "LCD",
    "LCM",
    "HCF",
    "SAS",
    "SSS",
    "MBA",
    "FBI",
    "RMS",
    8,
    11,
    18,
    80,
    89,
    800,
    899,
    8000,
    11000,
    18000,
    "8,000",
    "18,000",
    "8.5",
    "11.2",
    "18%",
    "8-foot",
    "$85^\\circ$",
    "\\text{hour}",
    "  ‘apple’",
    "(equilateral triangle)",
    "**hour**",
  ].map((word): [string | number, "an"] => [word, "an"]),
  ...[
    "square",
    "triangle",
    "circle",
    "rectangle",
    "unit",
    "unit fraction",
    "MAD",
    "uniform",
    "union",
    "unique",
    "university",
    "unicorn",
    "unicycle",
    "unilateral",
    "useful",
    "usual",
    "utensil",
    "European",
    "ewe",
    "one",
    "ones digit",
    "one-sided",
    "once",
    "ubiquitous",
    "uranium",
    "GCF",
    "USB",
    "URL",
    "B",
    "y-intercept",
    "U-shaped",
    "historic",
    "hotel",
    0,
    1,
    2,
    7,
    10,
    12,
    19,
    100,
    110,
    180,
    1100,
    1800,
    10000,
    12000,
    "1.8",
    "180%",
    -8,
    "−11",
    "−8-foot",
    " $1$ ",
    "\\mathrm{unit}",
    "",
  ].map((word): [string | number, "a"] => [word, "a"]),
];

for (const [word, expected] of cases)
  test(`article for ${JSON.stringify(word)} follows its spoken beginning`, () => {
    assert.equal(article(word), expected);
    const capital = expected === "an" ? "An" : "A";
    assert.equal(article(word, true), capital);
    assert.equal(withArticle(word), `${expected} ${word}`);
    assert.equal(withArticle(word, true), `${capital} ${word}`);
  });

test("each letter uses its name, in either case", () => {
  const vowelNames = new Set("aefhilmnorsx");
  for (const letter of "abcdefghijklmnopqrstuvwxyz")
    for (const value of [letter, letter.toUpperCase(), `${letter}-shaped`])
      assert.equal(article(value), vowelNames.has(letter) ? "an" : "a", value);
});

test("fraction stories choose the unit's article without a caller override", () => {
  assert.equal(fractionAmount(1, 2, "hour"), "1/2 of an hour");
  assert.equal(fractionAmount(3, 4, "inch"), "3/4 of an inch");
  assert.equal(fractionAmount(1, 2, "liter"), "1/2 liter");
});

test("shape-side reprints preserve versions 1–2; version 3 changes only articles", () => {
  let corrected = 0;
  for (let seed = 0; seed < 40; seed++) {
    const previous = generateProblem(
      "shape-sides-select",
      `articles-${seed}`,
      2,
    );
    const current = generateProblem(
      "shape-sides-select",
      `articles-${seed}`,
      3,
    );
    const before = JSON.stringify(previous);
    const after = JSON.stringify(current);
    corrected += Number(before.includes("a L shape"));
    assert.equal(
      after,
      before
        .replaceAll("a L shape", "an L shape")
        .replace('"templateVersion":2', '"templateVersion":3'),
    );
  }
  assert.ok(corrected > 0);
  assert.match(
    JSON.stringify(generateProblem("shape-sides-select", "gate-legacy:3", 1)),
    /a L shape/,
  );
});
