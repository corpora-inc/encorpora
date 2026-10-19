import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import {
  decimalText,
  numberSenseTemplates,
} from "../src/math/number-sense-practice";
import { generatedProblemSchema } from "../src/math/contracts";
import { openerSlots, templateRole } from "../src/learning/placement";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { lessons } from "../src/content/lessons";

const ids = numberSenseTemplates.map((t) => t.id);
const numbersIn = (prompt: string) =>
  (prompt.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((t) =>
    Number(t.replaceAll(",", "")),
  );
const sample = (id: string, count = 300) =>
  Array.from({ length: count }, (_, i) => generateProblem(id, `ns-${i}`));

test("number-sense families are deterministic, valid and gradeable", () => {
  for (const id of ids)
    for (const problem of sample(id)) {
      const seed = problem.public.seed;
      assert.deepEqual(problem, generateProblem(id, seed));
      generatedProblemSchema.parse(problem);
      assert.equal(templateRole(id), "assessment");
      assert.equal(gradeAnswer(problem, problem.answer), true, id);
      assert.equal(gradeAnswer(problem, `${problem.answer}1`), false, id);
      assert.doesNotMatch(
        problem.answer,
        /,/,
        "answers are typed without commas",
      );
    }
});

test("rounding follows round-half-up, including carries and halfway values", () => {
  const units: Record<string, number> = {
    ten: 10,
    hundred: 100,
    thousand: 1000,
    "ten thousand": 10000,
  };
  const tags = new Set<string>();
  for (const id of ["round-to-ten", "round-to-hundred", "round-large"])
    for (const p of sample(id)) {
      const m = /^Round ([\d,]+) to the nearest (.+)\.$/.exec(p.public.prompt)!;
      const n = Number(m[1]!.replaceAll(",", "")),
        unit = units[m[2]!]!;
      const remainder = n % unit;
      const expected =
        remainder * 2 >= unit ? n - remainder + unit : n - remainder;
      assert.equal(Number(p.answer), expected, p.public.prompt);
      if (remainder * 2 === unit) tags.add(`${id}:halfway`);
      if (Math.floor(expected / (10 * unit)) !== Math.floor(n / (10 * unit)))
        tags.add(`${id}:carry`);
    }
  for (const id of ["round-to-ten", "round-to-hundred", "round-large"])
    for (const tag of ["halfway", "carry"])
      assert.ok(tags.has(`${id}:${tag}`), `${id}:${tag}`);
});

test("powers of ten move digits exactly, in decimal text", () => {
  assert.equal(decimalText(52, 2), "0.52");
  assert.equal(decimalText(71, 1 - 3), "7,100");
  assert.equal(decimalText(5200, 2), "52");
  for (const id of ["multiply-power-of-ten", "divide-power-of-ten"])
    for (const p of sample(id)) {
      const m = /^What is ([\d,.]+) ([×÷]) (10[¹²³]|[\d,]+)\?$/.exec(
        p.public.prompt,
      )!;
      const scale =
        { "10¹": 10, "10²": 100, "10³": 1000 }[m[3]!] ??
        Number(m[3]!.replaceAll(",", ""));
      const [whole, fraction = ""] = m[1]!.replaceAll(",", "").split(".");
      // Integer arithmetic on scaled values: no floating-point products.
      const units = BigInt(whole! + fraction),
        places = fraction.length;
      const [n, d] =
        m[2] === "×"
          ? [units * BigInt(scale), 10n ** BigInt(places)]
          : [units, 10n ** BigInt(places) * BigInt(scale)];
      const [aw, af = ""] = p.answer.split(".");
      assert.equal(
        BigInt(aw! + af) * d,
        n * 10n ** BigInt(af.length),
        p.public.prompt,
      );
    }
});

test("number-line hops agree with their figures and stay on the line", () => {
  for (const p of sample("number-line-hops")) {
    const f = p.public.figure!;
    assert.equal(f.kind, "hop-line");
    if (f.kind !== "hop-line") continue;
    const [start, tens, ones] = numbersIn(p.public.prompt);
    const sign = p.public.prompt.includes("forward") ? 1 : -1;
    assert.deepEqual(
      f.hops.map((h) => h.size),
      [sign * tens!, sign * ones!],
    );
    assert.equal(f.start, start);
    assert.equal(Number(p.answer), start! + sign * (tens! + ones!));
    assert.ok(Number(p.answer) >= f.min && Number(p.answer) <= f.max);
  }
  for (const p of sample("number-line-missing-hop")) {
    const [a, b] = numbersIn(p.public.prompt);
    assert.equal(Number(p.answer), Math.abs(b! - a!));
  }
});

test("hundred-chart blanks have a visible neighbor and the chart's value", () => {
  for (const p of sample("hundred-chart-missing")) {
    const f = p.public.figure!;
    if (f.kind !== "hundred-chart") assert.fail("figure");
    assert.notDeepEqual(f.blank, [0, 0]);
    assert.equal(Number(p.answer), f.first + 10 * f.blank[0] + f.blank[1]);
  }
});

test("number-sense openers are numeric, short and placed", () => {
  const openers = new Set(openerSlots.flat(2));
  for (const id of [
    "numeral-for-quantity",
    "count-sequence-missing",
    "hundred-chart-missing",
    "number-line-hops",
    "round-to-ten",
    "round-to-hundred",
    "multiply-power-of-ten",
  ])
    assert.ok(openers.has(id), id);
});

test("the hop animation lands on the example's answer", () => {
  for (let i = 0; i < 60; i++) {
    const lesson = problemLesson("number-line-hops", `animation-${i}`);
    const model = animationModel(lesson);
    assert.ok(model && model.kind === "hops");
    const frames = animationFrames(model);
    assert.equal(frames.length, 3);
    const end =
      model.figure.start +
      model.figure.hops[0]!.size +
      model.figure.hops[1]!.size;
    assert.equal(Number(lesson.example.answer), end);
    assert.match(frames[2]!.math, new RegExp(`= ${end}\\$$`));
  }
});

test("every number-sense family has one illustrated reference lesson", () => {
  for (const id of ids) {
    const bound = lessons.filter((lesson) => lesson.templateIds.includes(id));
    assert.equal(bound.length, 1, id);
    assert.ok(bound[0]!.sections.some((s) => s.illustration));
  }
});
