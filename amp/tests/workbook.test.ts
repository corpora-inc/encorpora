import { test } from "node:test";
import assert from "node:assert/strict";
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { estimateFrontier, initialLevel } from "../src/learning/frontier";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import type { SkillEvidence } from "../src/server/evidence";
import { templateRole } from "../src/learning/placement";
import { challengePool } from "../src/workbook/challenge-pool";
import { workbookResultsUrl } from "../src/workbook/links";
import { strandEstimate } from "../src/learning/frontier";
import { templateGrade } from "../src/server/mixed-practice";
import {
  CHALLENGE_WINDOW,
  composeWorkbook,
  printable,
  workbookCode,
  workbookMinutes,
  type WorkbookMinutes,
  type WorkbookSpec,
} from "../src/workbook/compose";
import { cardWords, workbookHtml } from "../src/workbook/render";
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
  // Storage (JSONB) reorders object keys; the printed code must not change.
  const reorder = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(reorder)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([k, v]) => [k, reorder(v)]),
          )
        : value;
  assert.equal(workbookCode(reorder(a) as WorkbookSpec), workbookCode(a));
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
  const key = html.indexOf('data-flow="key"');
  assert.ok(key > lastItem, "answer key follows every student problem");
  assert.equal(
    (html.match(/class="wb-key-item /g) ?? []).length,
    count,
    "one key entry per problem",
  );
  assert.ok(html.includes(workbookCode(spec)));
  for (let n = 1; n <= count; n++)
    assert.ok(
      html.includes(
        `<h2><span class="wb-num" aria-label="Problem ${n}">${n}</span>`,
      ),
      `problem ${n}`,
    );
});

test("no workbook prints the same problem twice", () => {
  for (const id of learners.keys())
    for (const date of ["2026-11-01", "2026-11-19", "2026-12-02"]) {
      const { frontier, evidence } = learners.get(id)!;
      const spec = composeWorkbook({
        templates,
        skills,
        lessons,
        frontier,
        evidence,
        date,
        minutes: 60,
        learnerKey: id,
        now,
      });
      const keys = items(spec).map((i) => {
        const p = generateProblem(i.templateId, i.seed);
        return `${p.public.prompt}|${p.answer}`;
      });
      assert.equal(new Set(keys).size, keys.length, `${id} ${date}`);
    }
});

test("invalid requests are rejected", () => {
  assert.throws(() => compose("third-grade", { minutes: 20 as never }));
  assert.throws(() => compose("third-grade", { number: 0 }));
});

test("the results page links to the learner's results with a QR code", () => {
  assert.equal(
    workbookResultsUrl({
      baseUrl: "https://amp.corpora.inc/",
      learnerId: "learner 1",
      workbookId: "wb/2",
    }),
    "https://amp.corpora.inc/learners/learner%201/workbooks/wb%2F2/results",
  );
  assert.throws(() =>
    workbookResultsUrl({
      baseUrl: "http://example.com",
      learnerId: "a",
      workbookId: "b",
    }),
  );
  const spec = compose("third-grade");
  const plain = workbookHtml(spec, { lessons, skillTitle });
  assert.ok(!plain.includes('class="wb-qr"'), "no link, no code");
  const linked = workbookHtml(spec, {
    lessons,
    skillTitle,
    results: {
      baseUrl: "https://amp.corpora.inc",
      learnerId: "l1",
      workbookId: "w1",
    },
  });
  assert.ok(linked.includes('class="wb-qr"'));
  assert.ok(linked.includes(workbookCode(spec)));
});

test("the challenge comes from the curated pool, which is printable", () => {
  for (const id of challengePool) {
    const t = templates.find((x) => x.id === id);
    assert.ok(t, `${id} exists`);
    assert.ok(printable(t), `${id} prints`);
    assert.equal(templateRole(id), "assessment", id);
  }
  for (const id of learners.keys())
    for (const date of ["2026-11-01", "2026-11-02", "2026-11-03"]) {
      const { frontier, evidence } = learners.get(id)!;
      const spec = composeWorkbook({
        templates,
        skills,
        lessons,
        frontier,
        evidence,
        date,
        learnerKey: id,
        now,
      });
      const challenge = spec.sections.at(-1)!;
      assert.equal(challenge.kind, "challenge");
      assert.ok(
        challengePool.has(challenge.items[0]!.templateId),
        `${id} ${date}: ${challenge.items[0]!.templateId}`,
      );
    }
});

test("the lesson card defines up to six glossary words its own text uses", () => {
  let carded = 0;
  for (const lesson of lessons) {
    const words = cardWords(lesson);
    assert.ok(words.length <= 6, lesson.id);
    assert.equal(new Set(words.map((w) => w.id)).size, words.length);
    for (const w of words)
      assert.ok(w.plain.length > 0, `${lesson.id} ${w.id}`);
    if (words.length) carded++;
  }
  assert.ok(carded > lessons.length / 2, `${carded} cards have words to know`);
  const interest = lessons.find((l) => l.id === "simple-interest-blanks")!;
  assert.ok(cardWords(interest).some((w) => w.term === "principal"));
  const spec = compose("algebra-two");
  const lessonId = spec.sections.find((s) => s.kind === "lesson")!.lessonId!;
  const html = workbookHtml(spec, { lessons, skillTitle });
  const words = cardWords(lessons.find((l) => l.id === lessonId)!);
  if (words.length) {
    assert.ok(html.includes("Words to know"));
    for (const w of words)
      assert.ok(html.includes(`<dt>${w.term}</dt>`), w.term);
  }
});

test("the challenge sits 0.5 to 1.3 grades above the learner wherever the catalog allows", () => {
  const nodes = new Map(skills.map((s) => [s.id, s]));
  const [lo, hi] = CHALLENGE_WINDOW;
  // The shared learners plus the top of the catalog, where the window can
  // run past the last template.
  const precalculus = sampleLearners.find((l) => l.id === "precalculus")!;
  const all = new Map(learners);
  all.set("precalculus", {
    learner: precalculus,
    ...simulateLearner(precalculus, now),
  });
  for (const id of all.keys()) {
    const { frontier, evidence } = all.get(id)!;
    const offset = (t: (typeof templates)[number]) =>
      templateGrade(t, nodes) -
      strandEstimate(frontier, nodes.get(t.skillId)?.strand ?? t.skillId).level;
    const reachable = templates.some(
      (t) =>
        nodes.has(t.skillId) &&
        printable(t) &&
        templateRole(t.id) === "assessment" &&
        offset(t) >= lo &&
        offset(t) <= hi,
    );
    for (const date of [
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]) {
      const day = composeWorkbook({
        templates,
        skills,
        lessons,
        frontier,
        evidence,
        date,
        learnerKey: id,
        now,
      });
      {
        const item = day.sections.at(-1)!.items[0]!;
        const t = templates.find((x) => x.id === item.templateId)!;
        const off = offset(t);
        if (reachable) {
          assert.ok(
            off >= lo - 1e-9 && off <= hi + 1e-9,
            `${id} ${date}: offset ${off.toFixed(2)}`,
          );
          assert.ok(
            item.grade <= frontier.overall.level + hi + 1e-9 ||
              !templates.some(
                (x) =>
                  nodes.has(x.skillId) &&
                  printable(x) &&
                  templateRole(x.id) === "assessment" &&
                  offset(x) >= lo &&
                  offset(x) <= hi &&
                  templateGrade(x, nodes) <= frontier.overall.level + hi,
              ),
            `${id} ${date}: grade ${item.grade} above overall ${frontier.overall.level.toFixed(2)} + ${hi}`,
          );
        } else assert.ok(off < lo, `${id}: top of the catalog`);
      }
    }
  }
});
