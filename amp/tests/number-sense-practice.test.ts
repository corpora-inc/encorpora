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
import { describeScene, layoutScene } from "../src/math/scene";
import type { NumberLine, Scene } from "../src/math/scene";
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

const sceneOf = (p: ReturnType<typeof generateProblem>): Scene => {
  const f = p.public.figure!;
  if (f.kind !== "scene") assert.fail(`${p.public.templateId}: not a scene`);
  return f.scene;
};
const lineOf = (scene: Scene) => {
  const line = scene.elements.find((e) => e.type === "numberLine");
  assert.ok(line);
  return line as NumberLine;
};

test("number-line hops agree with their scenes and stay on the line", () => {
  for (const p of sample("number-line-hops")) {
    const scene = sceneOf(p),
      line = lineOf(scene);
    const [start, tens, ones] = numbersIn(p.public.prompt);
    const sign = p.public.prompt.includes("forward") ? 1 : -1;
    assert.deepEqual(
      line.hops!.map((h) => [h.from, h.by]),
      [
        [start, sign * tens!],
        [start! + sign * tens!, sign * ones!],
      ],
    );
    // The landing is the unknown: masked in the problem, never in the payload.
    assert.equal(line.hops![1]!.landing, "derived");
    assert.ok(!line.marks!.some((m) => m.at === Number(p.answer)));
    assert.equal(Number(p.answer), start! + sign * (tens! + ones!));
    assert.ok(Number(p.answer) >= line.min && Number(p.answer) <= line.max);
    assert.match(describeScene(scene), /number to find|\?/);
    const labels = layoutScene(scene).items.flatMap((d) =>
      d.k === "text" ? [d.plain] : [],
    );
    assert.ok(labels.includes("?"), "The landing is drawn as ?");
    // Only a tick label (a ten) may show the landing's value.
    if (Number(p.answer) % 10)
      assert.ok(!labels.includes(p.answer), "The landing is masked");
  }
  for (const p of sample("number-line-missing-hop")) {
    const line = lineOf(sceneOf(p));
    const [a, b] = numbersIn(p.public.prompt);
    assert.deepEqual(
      line.hops!.map((h) => [h.from, h.by, h.label]),
      [[a, b! - a!, "?"]],
    );
    assert.equal(Number(p.answer), Math.abs(b! - a!));
  }
});

test("hundred-chart windows read as the chart, with one empty square", () => {
  for (const p of sample("hundred-chart-missing")) {
    const scene = sceneOf(p);
    const cells = scene.elements.flatMap((e) => (e.type === "rect" ? [e] : []));
    const texts = scene.elements.flatMap((e) => (e.type === "text" ? [e] : []));
    const blank = cells.find((c) => c.id === "blank");
    assert.ok(blank);
    assert.equal(texts.length, cells.length - 1);
    // Every number sits in its own square; right is +1 and down is +10.
    const at = new Map(
      texts.map((t) => [`${t.at[0] - 0.5},${t.at[1] - 0.5}`, Number(t.text)]),
    );
    for (const [key, value] of at) {
      const [x, y] = key.split(",").map(Number);
      const right = at.get(`${x! + 1},${y}`),
        below = at.get(`${x},${y! - 1}`);
      if (right !== undefined) assert.equal(right, value + 1);
      if (below !== undefined) assert.equal(below, value + 10);
    }
    const [bx, by] = blank.at;
    const left = at.get(`${bx - 1},${by}`),
      above = at.get(`${bx},${by + 1}`);
    assert.ok(left !== undefined || above !== undefined, "A visible neighbor");
    assert.equal(Number(p.answer), left !== undefined ? left + 1 : above! + 10);
    assert.ok(!texts.some((t) => t.text === p.answer));
  }
});

test("scene templates are sent only to clients that draw scenes", () => {
  for (const t of numberSenseTemplates)
    assert.equal(
      t.requiredFigureCapability === "scenes-v1",
      [
        "hundred-chart-missing",
        "number-line-hops",
        "number-line-missing-hop",
      ].includes(t.id),
      t.id,
    );
});

test("number-sense openers are numeric, short and placed", () => {
  const openers = new Set(openerSlots.flat(2));
  for (const id of [
    "numeral-for-quantity",
    "count-sequence-missing",
    "round-to-ten",
    "round-to-hundred",
  ])
    assert.ok(openers.has(id), id);
});

test("every number-sense family has one illustrated reference lesson", () => {
  for (const id of ids) {
    const bound = lessons.filter((lesson) => lesson.templateIds.includes(id));
    assert.equal(bound.length, 1, id);
    assert.ok(bound[0]!.sections.some((s) => s.illustration));
  }
});
