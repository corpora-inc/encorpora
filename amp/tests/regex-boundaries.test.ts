import { test } from "node:test";
import assert from "node:assert/strict";
import { toTex } from "../src/content/math-segments";
import { trailingDisplayMath } from "../src/content/prompt-structure";
import { formPattern, linkProse, scanForms } from "../src/glossary/scan";
import type { GlossaryLexicon } from "../src/glossary/types";
import { compactLine } from "../src/math/expression";
import { promptLine } from "../src/web/features/school/classes/prompt-line";

// Pins the character-boundary rules of browser code that once used regex
// lookbehind, which Safari before 16.4 rejects (the build fails on it now).

const WJ = "⁠";

test("promptLine joins a mark only to the character before it", () => {
  assert.equal(promptLine("About 40% of $12$"), `About 40${WJ}% of 12`);
  assert.equal(promptLine("$(3x+16)$°."), `(3x+16)${WJ}°.`);
  assert.equal(promptLine("a′b″"), `a${WJ}′b${WJ}″`);
  assert.equal(promptLine("5%%"), `5${WJ}%${WJ}%`);
  assert.equal(promptLine("x°C"), `x${WJ}°C`);
  // After a space, or at the start, there is nothing to hold.
  assert.equal(promptLine("40 %"), "40 %");
  assert.equal(promptLine("a  °"), "a °");
  assert.equal(promptLine("% done"), "% done");
  assert.equal(promptLine(" °"), "°");
  assert.equal(promptLine("no marks\nhere"), "no marks here");
});

test("toTex groups a thousands separator with its numeral", () => {
  const cases: [string, string][] = [
    ["1,000", "1{,}000"],
    ["12,345,678", "12{,}345{,}678"],
    ["x=1,000.", "x=1{,}000."],
    ["1,000.5", "1{,}000.5"],
    ["$1,000", "$1{,}000"],
    ["(1,000)", "(1{,}000)"],
    ["a1,000", "a1{,}000"],
    ["1,000x", "1{,}000x"],
    ["1,000 and 2,500", "1{,}000 and 2{,}500"],
    ["9,999,999 (10,000,000)", "9{,}999{,}999 (10{,}000{,}000)"],
    // Not a separated numeral: a digit, point or comma before it, a digit or
    // comma after it, or a group of the wrong size.
    ["1234,567", "1234,567"],
    ["0.1,000", "0.1,000"],
    ["1.1,000", "1.1,000"],
    ["1,000.1,000", "1{,}000.1,000"],
    ["3,1,000", "3,1,000"],
    [",1,000", ",1,000"],
    ["1,000,", "1,000,"],
    ["1,000,00", "1,000,00"],
    ["1,0000", "1,0000"],
  ];
  for (const [input, tex] of cases) assert.equal(toTex(input), tex, input);
});

test("toTex reads a standalone run of underscores as a blank", () => {
  const blank = "\\boxed{\\phantom{0}}";
  const cases: [string, string][] = [
    ["__", blank],
    ["___", blank],
    [" ___ ", ` ${blank} `],
    ["(__)", `(${blank})`],
    ["__\n", `${blank}\n`],
    ["__}", `${blank}}`],
    ["{__", `{${blank}`],
    ["8 × 5 = __", `8 \\times  5 = ${blank}`],
    ["a__ b__ __c __", `a__ b__ __c ${blank}`],
    // Next to a word character or a brace that binds it, it is TeX.
    ["a__", "a__"],
    ["1__", "1__"],
    ["__a", "__a"],
    ["x}__", "x}__"],
    ["__{", "__{"],
    ["x_1__", "x_1__"],
    ["a_b", "a_b"],
    ["_ _", "_ _"],
  ];
  for (const [input, tex] of cases) assert.equal(toTex(input), tex, input);
});

const display = (text: string, standalone = true) => {
  const found = trailingDisplayMath(text, standalone);
  return found && [found.lead, found.source, found.punctuation];
};

test("a colon introduces a display unless it sits between digits", () => {
  assert.deepEqual(display("Evaluate: 2 + 3."), ["Evaluate:", "2 + 3", "."]);
  assert.deepEqual(display("Compute:4+5."), ["Compute:", "4+5", "."]);
  assert.deepEqual(display("Time 3: 4 + 5."), ["Time 3:", "4 + 5", "."]);
  assert.deepEqual(display("Use 2:x + 1"), ["Use 2:", "x + 1", ""]);
  assert.deepEqual(display("Hint a:3 + 4"), ["Hint a:", "3 + 4", ""]);
  assert.deepEqual(display("Then : 2 + 2"), ["Then :", "2 + 2", ""]);
  assert.deepEqual(display("Then:\t2 + 2"), ["Then:", "2 + 2", ""]);
  assert.deepEqual(display("At 10:30 compute: 4 + 5."), [
    "At 10:30 compute:",
    "4 + 5",
    ".",
  ]);
  assert.deepEqual(display("Evaluate:  7 × 8."), ["Evaluate:", "7 × 8", "."]);
  assert.deepEqual(display("SIMPLIFY 3x+2x"), ["SIMPLIFY", "3x+2x", ""]);
  assert.equal(display("Ratio 2:3 is"), null);
  assert.equal(display("Note: 1:2."), null);
  assert.equal(display("2:3"), null);
  assert.equal(display("Rule 3 :4 + 5"), null);
});

test("only one sentence period leaves a display", () => {
  assert.deepEqual(display("Evaluate 2 + 3."), ["Evaluate", "2 + 3", "."]);
  assert.deepEqual(display("Simplify 3x + 2x."), ["Simplify", "3x + 2x", "."]);
  assert.deepEqual(display("Evaluate: 4 + 5"), ["Evaluate:", "4 + 5", ""]);
  // A run of dots or an escaped dot is notation, not a full stop.
  assert.equal(display("Evaluate: 2+3.."), null);
  assert.equal(display("Simplify: 0.333...."), null);
  assert.equal(display("Simplify: x\\."), null);
});

test("a sentence period just inside a math span moves outside it", () => {
  assert.deepEqual(display("Evaluate: $2+3.$"), ["Evaluate:", "$2+3$", "."]);
  assert.deepEqual(display("Evaluate: \\(2+3.\\)"), [
    "Evaluate:",
    "\\(2+3\\)",
    ".",
  ]);
  assert.deepEqual(display("Solve for $k$: $2.5k-4.1=-9.1$."), [
    "Solve for $k$:",
    "$2.5k-4.1=-9.1$",
    ".",
  ]);
  // After another dot or a backslash the dot is notation and stays.
  assert.deepEqual(display("Evaluate: $2+3..$"), ["Evaluate:", "$2+3..$", ""]);
  assert.deepEqual(display("Evaluate: $2+3\\.$"), [
    "Evaluate:",
    "$2+3\\.$",
    "",
  ]);
});

test("a glossary form is found only between word boundaries", () => {
  const pattern = formPattern([
    "rate",
    "unit rate",
    "négatif",
    "x-intercept",
    "sum",
    "ratio",
    "a.m.",
  ]);
  const scan = (text: string) =>
    scanForms(text, pattern).map(({ start, end, form }) => [start, end, form]);
  assert.deepEqual(scan("the rate"), [[4, 8, "rate"]]);
  assert.deepEqual(scan("unit rate here"), [[0, 9, "unit rate"]]);
  assert.deepEqual(scan("Rate."), [[0, 4, "rate"]]);
  assert.deepEqual(scan("(rate)"), [[1, 5, "rate"]]);
  assert.deepEqual(scan("rate rate"), [
    [0, 4, "rate"],
    [5, 9, "rate"],
  ]);
  assert.deepEqual(scan("the sum, ratio"), [
    [4, 7, "sum"],
    [9, 14, "ratio"],
  ]);
  assert.deepEqual(scan("sum,sum"), [
    [0, 3, "sum"],
    [4, 7, "sum"],
  ]);
  assert.deepEqual(scan("négatif nombre"), [[0, 7, "négatif"]]);
  assert.deepEqual(scan("x-intercept"), [[0, 11, "x-intercept"]]);
  assert.deepEqual(scan("at 9 a.m. rate"), [
    [5, 9, "a.m."],
    [10, 14, "rate"],
  ]);
  assert.deepEqual(scan("a.m.rate"), [[4, 8, "rate"]]);
  assert.deepEqual(scan("𝑥 rate"), [[3, 7, "rate"]]);
  // A leading hyphen continues a formula, so it is a boundary.
  assert.deepEqual(scan("-sum"), [[1, 4, "sum"]]);
  // A form inside a rejected longer form is still found.
  assert.deepEqual(scan("sunit rate"), [[6, 10, "rate"]]);
  assert.deepEqual(scan("xunit rate y"), [[6, 10, "rate"]]);
  // Letters (any script, astral too), digits, apostrophes and hyphens join.
  for (const text of [
    "rates",
    "prorate",
    "rate's",
    "the ratio’s",
    "non-rate",
    "first-rate",
    "rate-limited",
    "o'rate",
    "1rate",
    "rate1",
    "١rate",
    "Ωrate",
    "𝑥rate",
    "çsum",
    "sumé",
    "anégatif",
    "énégatif",
    "négatifs",
    "9a.m.",
    "\u0345rate",
  ])
    assert.deepEqual(scan(text), [], text);
  assert.deepEqual(scanForms("anything", formPattern([])), []);
});

test("linkProse splits prose around the payload's terms", () => {
  const lexicon = { rate: "rate", "unit rate": "unit-rate" } as GlossaryLexicon;
  assert.deepEqual(linkProse("the unit rate and rate", lexicon), [
    { text: "the " },
    { text: "unit rate", id: "unit-rate" },
    { text: " and " },
    { text: "rate", id: "rate" },
  ]);
  assert.deepEqual(linkProse("prorate rates", lexicon), [
    { text: "prorate rates" },
  ]);
});

test("a compound answer splits on commas and on 'or' between non-letters", () => {
  const cases: [string, string][] = [
    ["x=1 or x=2", "x=1 or x=2"],
    ["x=1 OR x=2", "x=1 or x=2"],
    ["x=1, x=2", "x=1 or x=2"],
    ["x = 1 , x = 2", "x=1 or x=2"],
    ["x=1 ,x=2", "x=1 or x=2"],
    ["a, b or c", "a or b or c"],
    ["1or2", "1 or 2"],
    ["2or-3", "2 or -3"],
    ["x=1or x=2", "x=1 or x=2"],
    ["x=1or", "x=1 or "],
    ["x=1 or", "x=1 or "],
    ["x=1,", "x=1 or "],
    [",x=1", " or x=1"],
    ["x=1,,x=2", "x=1 or  or x=2"],
    ["x=1 or or x=2", "x=1 or  or x=2"],
    ["or", " or "],
    ["", ""],
    // 'or' touching a letter is part of a word.
    ["x=1orx=2", "x=1orx=2"],
    ["x=1 orx=2", "x=1orx=2"],
    ["orx=2", "orx=2"],
    ["xor y", "xory"],
    ["for=2", "for=2"],
    ["order=1", "order=1"],
    ["Oregon=1", "Oregon=1"],
    ["nor=1", "nor=1"],
    ["sOr=1", "sOr=1"],
    ["factor=1 or b=2", "factor=1 or b=2"],
  ];
  for (const [input, line] of cases)
    assert.equal(compactLine(input, true), line, input);
  assert.equal(compactLine("x = 1 or x = 2"), "x=1orx=2");
});
