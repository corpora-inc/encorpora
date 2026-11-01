import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  acceptedGrowth,
  currentBaseline,
  definesAt,
  diffBaseline,
  mustDefine,
  screenViolations,
  sentences,
  wordCount,
  violationText,
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
      blocks([
        "The denominator is the bottom number.",
        "Divide by the denominator.",
        "Multiply by the numerator.",
      ]),
      {},
      "4",
    ).terms,
    ["numerator"],
  );
  assert.equal(mustDefine("equal", "4"), false);
  assert.equal(mustDefine("equal", "1"), true);
  assert.equal(mustDefine("denominator", "algebra-1"), true);
  // A term inside a longer word is not its use.
  assert.deepEqual(
    screenViolations(
      blocks(["To separate is the first step before you divide by the rate."]),
      {},
      "6",
    ).terms,
    ["rate"],
  );
  const long = Array.from({ length: 36 }, () => "word").join(" ") + ".";
  assert.deepEqual(screenViolations(blocks([long]), {}, "4").long, [
    "word word word word word word word word",
  ]);
  assert.deepEqual(
    screenViolations(
      [{ stage: "method", label: "method", lines: [long] }],
      {},
      "4",
    ).long,
    [],
    "sentence length is held in openings and goals only",
  );
});

test("the baseline diff names each new and fixed violation", () => {
  const was = { "lesson:a": { terms: ["slope"], long: ["one two"] } };
  const now = { "lesson:a": { terms: ["ratio"], long: ["one two", "three"] } };
  const { grown, stale } = diffBaseline(now, was);
  assert.deepEqual(grown, [
    { screen: "lesson:a", term: "ratio" },
    { screen: "lesson:a", long: "three" },
  ]);
  assert.deepEqual(stale, [{ screen: "lesson:a", term: "slope" }]);
});

test("growth from a newly named sense is accepted only on unchanged text", () => {
  const baseline = {
    "practice:a": { terms: [], long: [], hash: "aaa" },
    "practice:b": { terms: [], long: [], hash: "bbb" },
  };
  const current = {
    "practice:a": { terms: ["slope"], long: [], hash: "aaa" },
    "practice:b": { terms: ["slope"], long: ["new long one"], hash: "b2b" },
  };
  const grown = [
    { screen: "practice:a", term: "slope" },
    { screen: "practice:b", term: "slope" },
    { screen: "practice:b", long: "new long one" },
  ];
  const plain = acceptedGrowth(grown, baseline, current);
  assert.equal(plain.accepted.length, 0, "the default mode records nothing");
  const senses = acceptedGrowth(grown, baseline, current, { fromSenses: true });
  assert.deepEqual(senses.accepted, [{ screen: "practice:a", term: "slope" }]);
  assert.deepEqual(
    senses.refused.map((v) => [v.screen, v.term ?? v.long]),
    [
      ["practice:b", "slope"],
      ["practice:b", "new long one"],
    ],
    "changed text and long sentences are never recorded this way",
  );
  const added = acceptedGrowth(grown, baseline, current, {
    newTerms: ["slope"],
  });
  assert.equal(added.accepted.length, 2);
});

test("plain-language violations only shrink (tests/fixtures/plain-language-baseline.json)", () => {
  assert.ok(existsSync(BASELINE), "the baseline exists");
  const baseline: PlainLanguageBaseline = JSON.parse(
    readFileSync(BASELINE, "utf8"),
  );
  const { grown, stale } = diffBaseline(
    currentBaseline().screens,
    baseline.screens,
  );
  assert.deepEqual(
    grown.map(violationText),
    [],
    'New violations. Define each term in the sentence where it first appears on that screen ("X is called …", "X means …", "X, the …,", "X: …"), or split the sentence (35 words at most). A screen is a reference lesson (lesson:<id>) or a template\'s practice lesson (practice:<id>)',
  );
  assert.deepEqual(
    stale.map(violationText),
    [],
    "Fixed violations are still in the baseline: run npm run plain:baseline to shrink it",
  );
});
