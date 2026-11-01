import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  currentBaseline,
  definesAt,
  diffBaseline,
  mustDefine,
  screenViolations,
  sentences,
  wordCount,
  type PlainLanguageBaseline,
} from "../src/content/plain-language-check";

const BASELINE = new URL(
  "./fixtures/plain-language-baseline.json",
  import.meta.url,
);

/** Whether `term` is defined at its first appearance in `sentence`. */
const defines = (sentence: string, term: string) => {
  const start = sentence.toLowerCase().indexOf(term);
  assert.ok(start >= 0, `${term} in "${sentence}"`);
  return definesAt(sentence, start, start + term.length);
};

test("sentences split outside formulas, decimals and abbreviations", () => {
  assert.deepEqual(sentences("Add 2.5 and 3. Then stop."), [
    "Add 2.5 and 3.",
    "Then stop.",
  ]);
  assert.deepEqual(sentences("Use $a. b$ here. Next, e.g. this one."), [
    "Use $a. b$ here.",
    "Next, e.g. this one.",
  ]);
  assert.deepEqual(sentences("The legs meet; the hypotenuse is opposite."), [
    "The legs meet;",
    "the hypotenuse is opposite.",
  ]);
  assert.equal(wordCount("The sum $3 + 4 = 7$ is seven."), 5);
});

test("a defining sentence says what the term means", () => {
  for (const [sentence, term] of [
    ["The denominator is the number below the line.", "denominator"],
    ["A right triangle has one square corner.", "right triangle"],
    ["Factors are the parts being multiplied.", "factors"],
    ["Slope means how steep a line is.", "slope"],
    ["Here $m$ stands for the slope.", "slope"],
    ["One distinct solution, called a repeated root.", "repeated root"],
    ["The longest side is the hypotenuse.", "hypotenuse"],
    ["Find the quotient, the answer to a division.", "quotient"],
    ["Find the quotient (the answer to a division).", "quotient"],
    ["Exponent: the small raised number.", "exponent"],
    ["We write $|x|$ for the absolute value.", "absolute value"],
  ] as const)
    assert.ok(defines(sentence, term), `"${term}" defined in "${sentence}"`);
  for (const [sentence, term] of [
    [
      "Use the zero-product property to find the roots.",
      "zero-product property",
    ],
    ["Divide by the coefficient of $x$.", "coefficient"],
    ["Find the slope from two points.", "slope"],
    ["The quotient is 4 here.", "quotient"],
  ] as const)
    assert.ok(
      !defines(sentence, term),
      `"${term}" not defined in "${sentence}"`,
    );
});

test("only the first use on a screen must define; K–2 words are known from grade 3", () => {
  const blocks = (lines: string[]) => [
    { stage: "intuition" as const, label: "opening", lines },
  ];
  assert.deepEqual(
    screenViolations(
      "lesson",
      blocks([
        "The denominator is the bottom number.",
        "Divide by the denominator.",
        "Multiply by the numerator.",
      ]),
      {},
      "4",
    ).undefined,
    ["lesson/numerator"],
  );
  assert.equal(mustDefine("equal", "4"), false);
  assert.equal(mustDefine("equal", "1"), true);
  assert.equal(mustDefine("denominator", "algebra-1"), true);
  const long = Array.from({ length: 36 }, () => "word").join(" ") + ".";
  assert.equal(screenViolations("lesson", blocks([long]), {}, "4").long, 1);
  assert.equal(
    screenViolations(
      "lesson",
      [{ stage: "method", label: "method", lines: [long] }],
      {},
      "4",
    ).long,
    0,
    "sentence length is held in openings and goals only",
  );
});

test("plain-language violations only shrink (tests/fixtures/plain-language-baseline.json)", () => {
  const baseline: PlainLanguageBaseline = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, "utf8"))
    : {};
  const { grown, stale } = diffBaseline(currentBaseline(), baseline);
  assert.deepEqual(
    grown,
    [],
    'New violations. Define each term in the sentence where it first appears on that screen ("X is called …", "X means …", "X, the …,", "X: …"), or split the sentence (35 words at most). A term is "<screen>/<term id>": the screen is the reference lesson or a template\'s practice lesson',
  );
  assert.deepEqual(
    stale,
    [],
    "Fixed violations are still in the baseline: run npm run plain:baseline to shrink it",
  );
});
