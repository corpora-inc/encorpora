import { test } from "node:test";
import assert from "node:assert/strict";
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { estimateFrontier, initialLevel } from "../src/learning/frontier";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import type { SkillEvidence } from "../src/server/evidence";
import {
  composeWorkbook,
  workbookCode,
  workbookMinutes,
  type WorkbookMinutes,
  type WorkbookSpec,
} from "../src/workbook/compose";
import { workbookHtml } from "../src/workbook/render";
import { sampleLearners, simulateLearner } from "../src/workbook/synthetic";

const now = Date.parse("2026-10-31T13:00:00Z");
const skillTitle = (id: string) => skills.find((s) => s.id === id)?.title ?? id;
const learners = new Map(
  sampleLearners
    .filter((l) =>
      ["new-kindergartner", "third-grade", "algebra-two"].includes(l.id),
    )
    .map((l) => [l.id, { learner: l, ...simulateLearner(l, now) }]),
);
const compose = (
  id: string,
  extra: { number?: number; minutes?: WorkbookMinutes } = {},
) => {
  const { frontier, evidence, attempts } = learners.get(id)!;
  return composeWorkbook({
    templates,
    skills,
    lessons,
    frontier,
    evidence,
    recentTemplateIds: attempts.slice(-12).map((a) => a.templateId),
    date: "2026-10-31",
    learnerKey: id,
    now,
    ...extra,
  });
};
const items = (spec: WorkbookSpec) => spec.sections.flatMap((s) => s.items);

test("the same learner, date and number print the same workbook; another number is new", () => {
  const a = compose("third-grade");
  assert.deepEqual(compose("third-grade"), a);
  assert.equal(workbookCode(compose("third-grade")), workbookCode(a));
  const b = compose("third-grade", { number: 2 });
  assert.notDeepEqual(
    items(b).map((i) => i.seed),
    items(a).map((i) => i.seed),
  );
  assert.notEqual(workbookCode(b), workbookCode(a));
});

test("every workbook has the full structure at every level and length", () => {
  for (const id of learners.keys())
    for (const minutes of [30, 45, 60] as const) {
      const spec = compose(id, { minutes });
      assert.deepEqual(
        spec.sections.map((s) => s.kind),
        ["warm-up", "lesson", "practice", "review", "challenge"],
        `${id} ${minutes}`,
      );
      const lesson = spec.sections.find((s) => s.kind === "lesson")!;
      const taught = lessons.find((l) => l.id === lesson.lessonId)!;
      assert.ok(taught, `${id}: lesson ${lesson.lessonId}`);
      assert.ok(
        lesson.items.every((i) => taught.templateIds.includes(i.templateId)),
        `${id}: guided problems come from the lesson`,
      );
      assert.equal(spec.sections.at(-1)!.items.length, 1);
      const total = workbookMinutes(spec);
      assert.ok(
        total >= minutes - 6 && total <= minutes + 8,
        `${id} ${minutes}: ${total} minutes`,
      );
    }
});

test("only lesson problems share a template; every problem is valid", () => {
  for (const id of learners.keys()) {
    const spec = compose(id);
    const outside = spec.sections
      .filter((s) => s.kind !== "lesson")
      .flatMap((s) => s.items.map((i) => i.templateId));
    assert.equal(new Set(outside).size, outside.length, id);
    for (const item of items(spec))
      generatedProblemSchema.parse(generateProblem(item.templateId, item.seed));
  }
});

test("sections climb from warm-up through practice to the challenge", () => {
  for (const id of ["third-grade", "algebra-two"]) {
    const spec = compose(id);
    const mean = (kind: string) => {
      const list = spec.sections.find((s) => s.kind === kind)!.items;
      return list.reduce((sum, i) => sum + i.grade, 0) / list.length;
    };
    assert.ok(mean("warm-up") < mean("practice") + 0.25, `${id} warm-up`);
    assert.ok(mean("practice") < mean("challenge"), `${id} challenge`);
  }
});

test("a new learner with no answers still gets a complete workbook", () => {
  const frontier = estimateFrontier({
    start: initialLevel({ birthYear: 2016, now }),
    observations: [],
    gradeOf: () => undefined,
    strandOf: (id) => id,
    guessOf: () => 0,
    now,
  });
  const spec = composeWorkbook({
    templates,
    skills,
    lessons,
    frontier,
    evidence: [],
    date: "2026-10-31",
    learnerKey: "new",
    now,
  });
  assert.equal(spec.sections.length, 5);
  assert.ok(items(spec).length >= 12);
});

test("review brings back skills whose spaced review is due", () => {
  const { frontier } = learners.get("third-grade")!;
  const due = templates.find((t) => t.id === "add-within-20")!;
  const evidence: SkillEvidence[] = [
    {
      version: 1,
      skillId: due.skillId,
      attempts: 6,
      independentCorrect: 6,
      recentIndependentCorrect: 5,
      status: "review-ready",
      lastPracticedAt: "2026-10-01T12:00:00Z",
      recentOutcomes: [],
      latestIndependent: null,
      creditedRetrievals: 3,
      creditedAtMs: Date.parse("2026-10-01T12:00:00Z"),
      reviewDueAt: Date.parse("2026-10-08T12:00:00Z"),
    },
  ];
  const spec = composeWorkbook({
    templates,
    skills,
    lessons,
    frontier,
    evidence,
    date: "2026-10-31",
    learnerKey: "review",
    now,
  });
  const review = spec.sections.find((s) => s.kind === "review")!;
  assert.ok(
    review.items.some((i) => i.skillId === due.skillId),
    JSON.stringify(review.items.map((i) => i.skillId)),
  );
});

test("the printed workbook numbers every problem and keeps the key after them", () => {
  const spec = compose("third-grade");
  const html = workbookHtml(spec, { lessons, skillTitle });
  const count = items(spec).length;
  const lastItem = html.lastIndexOf('class="exercise wb-item');
  const key = html.indexOf('class="wb-key"');
  assert.ok(key > lastItem, "answer key follows every student problem");
  assert.equal(
    (html.match(/class="wb-key-item"/g) ?? []).length,
    count,
    "one key entry per problem",
  );
  assert.ok(html.includes(workbookCode(spec)));
  for (let n = 1; n <= count; n++)
    assert.ok(html.includes(`<h2>${n}. `), `problem ${n}`);
});

test("invalid requests are rejected", () => {
  assert.throws(() => compose("third-grade", { minutes: 20 as never }));
  assert.throws(() => compose("third-grade", { number: 0 }));
});
