import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { partWholeTemplates } from "../src/math/part-whole-practice";
import { snakeRegions } from "../src/math/part-whole-models";
import { generatedProblemSchema } from "../src/math/contracts";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { templateRole } from "../src/learning/placement";

const ids = partWholeTemplates.map((t) => t.id);

test("part-whole families are deterministic, valid and whole assessment items", () => {
  for (const id of ids) {
    assert.equal(templateRole(id), "assessment", id);
    const prompts = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(id, `pw-${i}`);
      assert.deepEqual(p, generateProblem(id, `pw-${i}`));
      generatedProblemSchema.parse(p);
      prompts.add(JSON.stringify([p.public.prompt, p.public.figure]));
    }
    assert.ok(prompts.size >= 12, `${id} has ${prompts.size} distinct items`);
  }
});

test("choice answers move between positions and wrong options explain the error", () => {
  for (const id of ids) {
    const first = generateProblem(id, "pw-0");
    if (first.public.response.kind !== "choice") continue;
    const positions = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(id, `pw-${i}`);
      positions.add(p.answer);
      const options =
        p.public.response.kind === "choice" ? p.public.response.options : [];
      for (const option of options)
        if (option.id !== p.answer)
          assert.ok(p.choiceFeedback?.[option.id], `${id}: ${option.label}`);
    }
    assert.ok(positions.size >= 2, `${id} always answers ${[...positions]}`);
  }
});

test("comparison figures set up the wholes without shading the answer", () => {
  for (const id of [
    "compare-like-denominators",
    "compare-like-numerators",
    "compare-unlike-fractions",
  ])
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(id, `pw-${i}`);
      const f = p.public.figure;
      assert.equal(f?.kind, "fraction-bars");
      if (f?.kind !== "fraction-bars") continue;
      assert.ok(f.bars.every((bar) => bar.shaded === 0));
      const [a, b] = f.bars.map((bar) => bar.label.split("/").map(Number));
      const values = [a![0]! / a![1]!, b![0]! / b![1]!];
      const greater = /greater/.test(p.public.prompt);
      const expected = greater ? Math.max(...values) : Math.min(...values);
      const [n, d] = p.answer.split("/").map(Number);
      assert.equal(n! / d!, expected, p.public.prompt);
      // Equivalent forms are accepted: 2/4 for 1/2.
      assert.ok(gradeAnswer(p, `${n! * 3}/${d! * 3}`));
      assert.match(
        p.explanation.at(-1)!,
        new RegExp(`fraction is ${p.answer}\\.$`),
      );
    }
});

test("founder's anchor item compares 3/4 and 2/3 through missing pieces", () => {
  let found = false;
  for (let i = 0; i < 3000 && !found; i++) {
    const p = generateProblem("compare-unlike-fractions", `anchor-${i}`);
    if (!/3\/4 or 2\/3|2\/3 or 3\/4/.test(p.public.prompt)) continue;
    found = true;
    assert.match(p.explanation[0]!, /one piece short of a whole/);
    assert.match(p.explanation.join(" "), /9\/12/);
  }
  assert.ok(found);
});

test("equal-area partitions are equal and always include a bent part", () => {
  let bent = 0;
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("equal-area-fraction", `pw-${i}`);
    const f = p.public.figure;
    if (f?.kind !== "area-partition") throw new Error("figure");
    const counts = new Map<number, number>();
    for (const r of f.regions) counts.set(r, (counts.get(r) ?? 0) + 1);
    assert.equal(new Set(counts.values()).size, 1);
    assert.equal(p.answer, `1/${counts.size}`);
    const rowsOf = (region: number) =>
      new Set(
        f.regions.flatMap((r, i) =>
          r === region ? [Math.floor(i / f.columns)] : [],
        ),
      ).size;
    const colsOf = (region: number) =>
      new Set(
        f.regions.flatMap((r, i) => (r === region ? [i % f.columns] : [])),
      ).size;
    if ([...counts.keys()].some((r) => rowsOf(r) * colsOf(r) !== counts.get(r)))
      bent++;
  }
  assert.ok(
    bent === 200,
    `${bent} of 200 partitions have a non-rectangular part`,
  );
  assert.deepEqual(snakeRegions(4, 3, 4), [0, 0, 0, 1, 2, 2, 1, 1, 2, 3, 3, 3]);
});

test("part-whole animations conserve the example's quantities", () => {
  const kinds = new Set<string>();
  for (const id of [
    "name-equal-share",
    "name-share",
    "compare-like-denominators",
    "compare-like-numerators",
    "compare-unlike-fractions",
    "equal-area-fraction",
    "equal-area-part-size",
  ])
    for (let i = 0; i < 60; i++) {
      const lesson = problemLesson(id, `pw-animation-${i}`);
      const model = animationModel(lesson);
      assert.ok(model, id);
      const frames = animationFrames(model);
      assert.equal(frames.length, 3);
      kinds.add(model.kind);
      if (model.kind === "compare") {
        const [a, b] = model.bars;
        const sign = a.n * b.d > b.n * a.d ? ">" : "<";
        assert.match(frames[2]!.math, new RegExp(` ${sign} `));
        const answer = lesson.example.answer.split("/").map(Number);
        assert.ok(
          [a, b].some((x) => x.n * answer[1]! === x.d * answer[0]!),
          lesson.example.answer,
        );
      }
      if (model.kind === "area") {
        const cells = model.figure.columns * model.figure.rows,
          count = Math.max(...model.figure.regions) + 1;
        assert.ok(frames[2]!.math.endsWith(`\\dfrac{1}{${count}}$`));
        assert.equal(cells % count, 0);
      }
      if (model.kind === "partition")
        assert.equal(
          frames[2]!.math,
          `$\\dfrac{${model.shape.shaded.length}}{${model.shape.sizes.length}}$`,
        );
    }
  assert.deepEqual([...kinds].sort(), ["area", "compare", "partition"]);
  const lesson = problemLesson("compare-like-numerators", "pw");
  const f = lesson.example.figure;
  if (f?.kind !== "fraction-bars") throw new Error("figure");
  assert.equal(
    animationModel({
      ...lesson,
      example: {
        ...lesson.example,
        figure: { ...f, bars: [f.bars[0]!, { ...f.bars[1]!, label: "x" }] },
      },
    }),
    null,
  );
});
