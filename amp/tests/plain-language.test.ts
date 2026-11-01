import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  definesAt,
  mustDefine,
  screenViolations,
  sentences,
  wordCount,
  plainLanguageReport,
  plainLanguageReportTable,
} from "../src/content/plain-language-check";

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
    [
      "Subtract 3 from both sides, meaning the left and the right of the equals sign.",
      "sides",
    ],
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
    ["Find the slope, the intercept and the vertex.", "slope"],
    [
      "A term is a number, a variable, or numbers and variables multiplied together.",
      "variable",
    ],
    [
      "It cuts a triangle into right triangles, where sine and cosine are ratios of sides.",
      "right triangles",
    ],
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

// Report only: the counts track the rewrite's progress and never fail.
test("plain-language progress report (artifacts/plain-language/report.json)", () => {
  const report = plainLanguageReport();
  const dir = new URL("../artifacts/plain-language/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    new URL("report.json", dir),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(plainLanguageReportTable(report));
  assert.ok(report.bands.length > 0);
});
