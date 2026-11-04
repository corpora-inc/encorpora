import assert from "node:assert/strict";
import test from "node:test";
import { lessons } from "../src/content/lessons";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { problemLesson } from "../src/content/problem-lessons";
import { templateArchetypes } from "../src/curriculum/template-archetypes";
import { skills } from "../src/curriculum/catalog";
import { templateGrade } from "../src/learning/item-calibration";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";
import { describeScene } from "../src/math/scene";
import type { Scene } from "../src/math/scene";

const PLACES = [
  "ones",
  "tens",
  "hundreds",
  "thousands",
  "ten thousands",
  "hundred thousands",
  "millions",
];
const num = (text: string) => Number(text.replaceAll(",", ""));
const ids = [
  "place-shift-value",
  "number-name-numeral",
  "large-number-line-point",
] as const;

const SMALL = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
function below100(n: number): string {
  if (n < 20) return SMALL[n]!;
  const unit = n % 10;
  return `${TENS[Math.floor(n / 10)]}${unit ? `-${SMALL[unit]}` : ""}`;
}
function below1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [
    hundreds ? `${SMALL[hundreds]} hundred` : "",
    rest ? below100(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}
/** Independent of the generator's numberWords. */
function numberName(n: number): string {
  if (n === 1_000_000) return "one million";
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  return [
    thousands ? `${below1000(thousands)} thousand` : "",
    rest ? below1000(rest) : "",
  ]
    .filter(Boolean)
    .join(", ");
}
function parseName(name: string): number {
  if (name === "one million") return 1_000_000;
  const [head, tail] = name.split(", ");
  if (name.includes("thousand")) {
    const thousands = head!.replace(/ thousand$/, "");
    return parseBelow1000(thousands) * 1000 + (tail ? parseBelow1000(tail) : 0);
  }
  return parseBelow1000(name);
}
function parseBelow1000(text: string): number {
  if (!text) return 0;
  const hundreds = text.match(/^(\w+) hundred(?: (.*))?$/);
  if (hundreds) {
    const h = SMALL.indexOf(hundreds[1]!);
    return h * 100 + parseBelow100(hundreds[2] ?? "");
  }
  return parseBelow100(text);
}
function parseBelow100(text: string): number {
  if (!text) return 0;
  const teen = SMALL.indexOf(text);
  if (teen >= 0) return teen;
  const [ten, unit] = text.split("-");
  return TENS.indexOf(ten!) * 10 + (unit ? SMALL.indexOf(unit) : 0);
}

function keyedLabels(problem: ReturnType<typeof generateProblem>) {
  const response = problem.public.response as MultiPartChoiceResponse;
  const key = JSON.parse(problem.answer) as Record<string, string>;
  return Object.fromEntries(
    response.blanks.map((blank) => [
      blank.id,
      blank.options.find((option) => option.id === key[blank.id])!.label,
    ]),
  );
}

test("grade-4 place-value types sit on large-place-value and have lessons", () => {
  const nodes = new Map(skills.map((skill) => [skill.id, skill]));
  for (const id of ids) {
    const template = templates.find((item) => item.id === id)!;
    assert.equal(template.skillId, "large-place-value");
    assert.equal(templateGrade(template, nodes), 4);
    assert.ok(templateArchetypes[id]?.length, id);
    assert.ok(actualFacetMappings.some((m) => m.templateId === id));
    assert.equal(
      lessons.filter((lesson) => lesson.templateIds.includes(id)).length,
      1,
    );
    const problem = generateProblem(id, "lesson-seed");
    const lesson = problemLesson(
      id,
      problem.public.seed,
      problem.public.prompt,
    );
    assert.ok(lesson.method.length >= 2, id);
    assert.ok(lesson.intuition && lesson.principle, id);
  }
});

test("a shifted digit and a product with 10 or 100 match the places", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const problem = generateProblem("place-shift-value", `shift-${i}`);
    generatedProblemSchema.parse(problem);
    assert.deepEqual(
      problem,
      generateProblem("place-shift-value", `shift-${i}`),
    );
    assert.equal(gradeAnswer(problem, problem.answer), true);
    const labels = keyedLabels(problem);
    const prompt = problem.public.prompt;
    const shift = prompt.match(
      /^In ([\d,]+), the digit (\d) is worth ([\d,]+)\. It shifts one place to the (left|right), so it is worth (10 times as much|one tenth as much)\. Choose its new place and its new value\.$/,
    );
    const product = prompt.match(
      /^([\d,]+) × (10|100) shifts every digit to the left\. Choose the product and how many places the digits move\.$/,
    );
    if (shift) {
      const n = num(shift[1]!);
      const digit = Number(shift[2]);
      const oldValue = num(shift[3]!);
      const side = shift[4]!;
      assert.ok(n <= 1_000_000);
      assert.equal(oldValue % digit, 0);
      const place = Math.round(Math.log10(oldValue / digit));
      assert.equal(digit * 10 ** place, oldValue);
      const next = side === "left" ? place + 1 : place - 1;
      assert.equal(labels.place, PLACES[next]);
      assert.equal(num(labels.value!), digit * 10 ** next);
      assert.ok(num(labels.value!) <= 1_000_000);
      seen.add(side === "left" ? "shift-left" : "shift-right");
    } else if (product) {
      const n = num(product[1]!);
      const factor = Number(product[2]);
      assert.equal(num(labels.product!), n * factor);
      assert.ok(n * factor <= 1_000_000);
      assert.equal(labels.places, factor === 10 ? "one place" : "two places");
      seen.add(factor === 10 ? "times-ten" : "times-hundred");
    } else {
      assert.fail(prompt);
    }
    const answerText = labels.value ?? labels.product!;
    const digits = answerText.replaceAll(",", "");
    assert.equal(
      new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(
        problem.public.prompt.replaceAll(",", ""),
      ),
      false,
      prompt,
    );
  }
  assert.deepEqual([...seen].sort(), [
    "shift-left",
    "shift-right",
    "times-hundred",
    "times-ten",
  ]);
});

test("number names and numerals name the same whole number up to 1,000,000", () => {
  const seen = new Set<string>();
  let dropped = 0;
  let swapped = 0;
  for (let i = 0; i < 200; i++) {
    const problem = generateProblem("number-name-numeral", `name-${i}`);
    generatedProblemSchema.parse(problem);
    assert.equal(gradeAnswer(problem, problem.answer), true);
    const response = problem.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") continue;
    const keyed = response.options.find((o) => o.id === problem.answer)!.label;
    const wordsToNumeral = problem.public.prompt.match(
      /^Which numeral matches this number name: (.+)\?$/,
    );
    const numeralToWords = problem.public.prompt.match(
      /^Which number name matches ([\d,]+)\?$/,
    );
    let value: number;
    if (wordsToNumeral) {
      value = parseName(wordsToNumeral[1]!);
      assert.equal(num(keyed), value);
      seen.add("words-to-numeral");
    } else if (numeralToWords) {
      value = num(numeralToWords[1]!);
      assert.equal(keyed, numberName(value));
      seen.add("numeral-to-words");
    } else {
      assert.fail(problem.public.prompt);
    }
    assert.ok(value! >= 1 && value! <= 1_000_000);
    const labels = response.options.map((o) => o.label);
    const text = String(value!);
    const zeroAt = text.indexOf("0");
    if (zeroAt > 0) {
      const shortened = Number(text.slice(0, zeroAt) + text.slice(zeroAt + 1));
      if (
        labels.some(
          (label) => labelValue(label, Boolean(wordsToNumeral)) === shortened,
        )
      )
        dropped++;
    }
    if (value! >= 1000 && value! < 1_000_000 && value! % 1000 !== 0) {
      const swappedValue = (value! % 1000) * 1000 + Math.floor(value! / 1000);
      if (
        labels.some(
          (label) =>
            labelValue(label, Boolean(wordsToNumeral)) === swappedValue,
        )
      )
        swapped++;
    }
    assert.equal(problem.public.prompt.includes(keyed), false);
  }
  assert.ok(seen.has("words-to-numeral") && seen.has("numeral-to-words"));
  assert.ok(dropped > 0, "a distractor drops an internal zero");
  assert.ok(swapped > 0, "a distractor swaps the thousands group");
});

function parseNameSafe(label: string): number | null {
  try {
    return parseName(label);
  } catch {
    return null;
  }
}
function labelValue(label: string, wordsPrompt: boolean): number | null {
  if (wordsPrompt) return /^\d/.test(label) ? num(label) : null;
  return parseNameSafe(label);
}

test("large number lines are read and located from the tick spacing", () => {
  const steps = new Set<number>();
  const directions = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const problem = generateProblem("large-number-line-point", `line-${i}`);
    generatedProblemSchema.parse(problem);
    assert.equal(gradeAnswer(problem, problem.answer), true);
    const response = problem.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") continue;
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "scene");
    if (figure?.kind !== "scene") continue;
    const scene = figure.scene as Scene;
    const line = scene.elements.find((el) => el.type === "numberLine");
    assert.ok(line && line.type === "numberLine");
    if (!line || line.type !== "numberLine") continue;
    assert.ok([1000, 10_000, 100_000].includes(line.step!));
    steps.add(line.step!);
    const marks = line.marks ?? [];
    const spoken = describeScene(scene);
    if (problem.public.prompt.startsWith("Which number")) {
      directions.add("read");
      assert.equal(marks.length, 1);
      assert.equal(marks[0]!.label, "P");
      const value = marks[0]!.at;
      const keyed = response.options.find(
        (o) => o.id === problem.answer,
      )!.label;
      assert.equal(num(keyed), value);
      assert.equal(spoken.includes(String(value)), false);
      for (const label of line.labels as number[])
        assert.notEqual(label, value);
    } else {
      directions.add("locate");
      const wanted = num(problem.public.prompt.match(/at ([\d,]+)/)![1]!);
      const keyed = response.options.find(
        (o) => o.id === problem.answer,
      )!.label;
      const mark = marks.find((item) => item.label === keyed);
      assert.equal(mark?.at, wanted);
      assert.equal((line.labels as number[]).includes(wanted), false);
    }
  }
  assert.deepEqual(
    [...steps].sort((a, b) => a - b),
    [1000, 10_000, 100_000],
  );
  assert.deepEqual([...directions].sort(), ["locate", "read"]);
});
