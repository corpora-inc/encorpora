import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { timeMoneyTemplates } from "../src/math/time-money-practice";
import { CENTS, handAngles } from "../src/math/time-money-models";
import { generatedProblemSchema } from "../src/math/contracts";
import { problemLesson } from "../src/content/problem-lessons";
import { publicationHtml } from "../src/content/publications";
import { lessons } from "../src/content/lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { templateRole } from "../src/learning/placement";

const ids = timeMoneyTemplates.map((t) => t.id);
const label = (p: ReturnType<typeof generateProblem>) =>
  p.public.response.kind === "choice"
    ? p.public.response.options.find((o) => o.id === p.answer)!.label
    : p.answer;

test("clock and money families are deterministic, valid, distinct assessment items", () => {
  for (const id of ids) {
    assert.equal(templateRole(id), "assessment", id);
    const prompts = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(id, `tm-${i}`);
      assert.deepEqual(p, generateProblem(id, `tm-${i}`));
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

test("hands sit at exact angles and readings match the drawn clock", () => {
  assert.deepEqual(handAngles(3, 30), { hour: 105, minute: 180 });
  assert.deepEqual(handAngles(12, 0), { hour: 0, minute: 0 });
  assert.deepEqual(handAngles(9, 55), { hour: 297.5, minute: 330 });
  for (const id of ["read-clock-hour-half", "read-clock-five-minutes"])
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(id, `tm-${i}`);
      const f = p.public.figure;
      if (f?.kind !== "analog-clocks") throw new Error("figure");
      const { hour, minute } = f.clocks[0]!;
      assert.equal(label(p), `${hour}:${String(minute).padStart(2, "0")}`);
      // The next-hour misreading is offered late in the hour.
      if (minute >= 30 && p.public.response.kind === "choice")
        assert.ok(
          p.public.response.options.some((o) =>
            o.label.startsWith(`${(hour % 12) + 1}:`),
          ),
        );
    }
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("match-clock-five-minutes", `tm-${i}`);
    const [, h, m] = /shows (\d+):(\d+)\?/.exec(p.public.prompt)!;
    const f = p.public.figure;
    if (f?.kind !== "analog-clocks") throw new Error("figure");
    const right = f.clocks.filter(
      (c) => c.hour === Number(h) && c.minute === Number(m),
    );
    assert.equal(right.length, 1);
    assert.equal(label(p), `Clock ${right[0]!.label}`);
  }
});

test("money answers equal the drawn coins and bills", () => {
  const sum = (items: readonly (keyof typeof CENTS)[]) =>
    items.reduce((s, i) => s + CENTS[i], 0);
  for (let i = 0; i < 200; i++) {
    const coins = generateProblem("coin-total", `tm-${i}`);
    const cf = coins.public.figure;
    if (cf?.kind !== "money-sets") throw new Error("figure");
    assert.equal(coins.answer, `${sum(cf.sets[0]!.items)}`);

    const dollars = generateProblem("money-total-dollars", `tm-${i}`);
    const df = dollars.public.figure;
    if (df?.kind !== "money-sets") throw new Error("figure");
    assert.equal(dollars.answer, (sum(df.sets[0]!.items) / 100).toFixed(2));

    const pay = generateProblem("pay-exact-coins", `tm-${i}`);
    const pf = pay.public.figure;
    if (pf?.kind !== "money-sets") throw new Error("figure");
    const price = Number(/costs (\d+)¢/.exec(pay.public.prompt)![1]);
    const exact = pf.sets.filter((s) => sum(s.items) === price);
    assert.equal(exact.length, 1);
    assert.equal(label(pay), `Set ${exact[0]!.label}`);
  }
});

test("clock and money lessons, illustrations and worksheets cover every family", () => {
  for (const id of ids) {
    const lesson = lessons.find((l) => l.templateIds.includes(id));
    assert.ok(lesson, id);
    assert.ok(
      lesson.sections.some((s) => s.illustration),
      lesson.id,
    );
  }
  const workbook = publicationHtml(
    lessons.find((l) => l.id === "coins-and-bills")!,
    "workbook",
  );
  const items = [...workbook.matchAll(/<h2>\d+\. ([\s\S]*?)<\/h2>/g)].map(
    (m) => m[1],
  );
  assert.equal(items.length, 12 * 5);
  assert.ok(!workbook.includes("Answer:"));
});

test("the clock animation sweeps the long hand, then moves the short hand", () => {
  let count = 0;
  for (const id of [
    "read-clock-five-minutes",
    "minutes-past-hour",
    "read-clock-hour-half",
    "clock-hour-read",
  ])
    for (let i = 0; i < 40; i++) {
      const lesson = problemLesson(id, `tm-animation-${i}`);
      const model = animationModel(lesson);
      const f = lesson.example.figure;
      if (f?.kind !== "analog-clocks") throw new Error("figure");
      if (f.clocks[0]!.minute === 0) {
        assert.equal(model, null);
        continue;
      }
      assert.equal(model?.kind, "clock-sweep");
      if (model?.kind !== "clock-sweep") continue;
      count++;
      const frames = animationFrames(model);
      assert.equal(frames.length, 3);
      assert.equal(frames[0]!.math, `$${model.hour}{:}00$`);
      assert.equal(
        frames[2]!.math,
        `$${model.hour}{:}${String(model.minute).padStart(2, "0")}$`,
      );
    }
  assert.ok(count > 60, `${count} animated examples`);
});
