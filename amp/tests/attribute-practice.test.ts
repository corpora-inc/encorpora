import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { attributeTemplates } from "../src/math/attribute-practice";
import { generatedProblemSchema } from "../src/math/contracts";
import { problemLesson } from "../src/content/problem-lessons";
import { publicationHtml } from "../src/content/publications";
import { lessons } from "../src/content/lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { templateRole } from "../src/learning/placement";

const ids = attributeTemplates.map((t) => t.id);
const label = (p: ReturnType<typeof generateProblem>) =>
  p.public.response.kind === "choice"
    ? p.public.response.options.find((o) => o.id === p.answer)!.label
    : p.answer;

test("attribute families are deterministic, valid, distinct assessment items", () => {
  for (const id of ids) {
    assert.equal(templateRole(id), "assessment", id);
    const prompts = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(id, `at-${i}`);
      assert.deepEqual(p, generateProblem(id, `at-${i}`));
      generatedProblemSchema.parse(p);
      assert.ok(gradeAnswer(p, p.answer), `${id}: ${p.answer}`);
      prompts.add(JSON.stringify([p.public.prompt, p.public.figure]));
      if (p.public.response.kind === "choice")
        for (const o of p.public.response.options)
          if (o.id !== p.answer) assert.ok(p.choiceFeedback?.[o.id], id);
    }
    assert.ok(prompts.size >= 12, `${id} has ${prompts.size} distinct items`);
  }
});

test("comparisons defeat looks: misaligned strips and small heavy objects", () => {
  let misaligned = 0,
    smallHeavy = 0;
  for (let i = 0; i < 300; i++) {
    const lengths = generateProblem("compare-lengths", `at-${i}`);
    const f = lengths.public.figure;
    if (f?.kind !== "length-rods") throw new Error("figure");
    const [a, b] = f.rods;
    if (a!.start !== b!.start) {
      misaligned++;
      // The shorter strip ends further right, so its right end misleads.
      const [long, short] = a!.length > b!.length ? [a!, b!] : [b!, a!];
      assert.ok(short.start + short.length > long.start + long.length);
    }
    const ask = /longer/.test(lengths.public.prompt) ? "longer" : "shorter";
    if (a!.length === b!.length)
      assert.equal(label(lengths), "They are the same length.");
    else
      assert.equal(
        label(lengths),
        `Strip ${a!.length > b!.length === (ask === "longer") ? "A" : "B"}`,
      );

    const weights = generateProblem("compare-weights", `at-${i}`);
    const w = weights.public.figure;
    if (w?.kind !== "mass-balance" || "grams" in w.right)
      throw new Error("figure");
    if (w.tilt !== "level") {
      const [low, high] =
        w.tilt === "left" ? [w.left, w.right] : [w.right, w.left];
      if (low.size < high.size) smallHeavy++;
    }
  }
  assert.ok(misaligned >= 60, `${misaligned} misaligned`);
  assert.ok(smallHeavy >= 60, `${smallHeavy} small-but-heavy`);
});

test("measured answers equal the drawn units, masses and levels", () => {
  for (let i = 0; i < 200; i++) {
    const m = generateProblem("measure-with-units", `at-${i}`);
    const f = m.public.figure;
    if (f?.kind !== "unit-measure") throw new Error("figure");
    assert.equal(m.answer, `${f.panels[0]!.placements.length}`);
    assert.equal(f.panels[0]!.placements.length, f.panels[0]!.length);

    const b = generateProblem("balance-mass", `at-${i}`);
    const bf = b.public.figure;
    if (bf?.kind !== "mass-balance" || !("grams" in bf.right))
      throw new Error("figure");
    assert.equal(b.answer, `${bf.right.grams.reduce((x, y) => x + y, 0)}`);

    const l = generateProblem("read-liquid-volume", `at-${i}`);
    const lf = l.public.figure;
    if (lf?.kind !== "liquid-scale") throw new Error("figure");
    assert.equal(l.answer, `${lf.level}`);

    const c = generateProblem("correct-unit-measure", `at-${i}`);
    const cf = c.public.figure;
    if (cf?.kind !== "unit-measure") throw new Error("figure");
    const good = cf.panels.filter((p) =>
      p.placements.every((x, j) => x === j && p.placements.length === p.length),
    );
    assert.equal(good.length, 1);
    assert.equal(label(c), `Picture ${good[0]!.label}`);
  }
});

test("attribute lessons, illustrations and worksheets cover every family", () => {
  for (const id of ids) {
    const lesson = lessons.find((l) => l.templateIds.includes(id));
    assert.ok(lesson, id);
    assert.ok(
      lesson.sections.some((s) => s.illustration),
      lesson.id,
    );
  }
  const workbook = publicationHtml(
    lessons.find((l) => l.id === "mass-and-liquid-volume")!,
    "workbook",
  );
  assert.equal([...workbook.matchAll(/<h2>\d+\. /g)].length, 36);
  assert.ok(!workbook.includes("Answer:"));
});

test("the pour animation ends on the comparison the figure shows", () => {
  const outcomes = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const lesson = problemLesson("compare-capacity", `at-animation-${i}`);
    const model = animationModel(lesson);
    assert.equal(model?.kind, "pour");
    if (model?.kind !== "pour") continue;
    const frames = animationFrames(model);
    assert.equal(frames.length, 3);
    const end = frames[2]!.math;
    outcomes.add(end);
    assert.equal(
      end,
      model.eighths < 8
        ? "B holds more"
        : model.eighths === 8
          ? "A and B hold the same"
          : "A holds more",
    );
  }
  assert.equal(outcomes.size, 3);
});
