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
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  CHALLENGE_WINDOW,
  composeWorkbook,
  printable,
  specChoices,
  WORKBOOK_VERSION,
  workbookCode,
  workbookMinutes,
  workbookProblems,
  type WorkbookChoices,
  type WorkbookMinutes,
  type WorkbookSpec,
} from "../src/workbook/compose";
import {
  cardTrimRanks,
  cardWords,
  sentences,
  workbookHtml,
} from "../src/workbook/render";
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
  extra: {
    number?: number;
    minutes?: WorkbookMinutes;
    history?: WorkbookSpec[];
    choices?: Partial<WorkbookChoices>;
    focusSkill?: string;
  } = {},
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
        total >= minutes - 6 && total <= minutes,
        `${id} ${minutes}: ${total} minutes`,
      );
    }
});

test("a workbook's estimate never exceeds its length, and practice is never empty", () => {
  // Many numbers at every length: high school problems run long, and once
  // a 60-minute geometry workbook estimated 68 minutes.
  for (const id of learners.keys())
    for (const minutes of [30, 45, 60] as const)
      for (let number = 1; number <= 12; number++) {
        const spec = compose(id, { minutes, number });
        const total = workbookMinutes(spec);
        assert.ok(total <= minutes, `${id} ${minutes} #${number}: ${total}`);
        assert.ok(
          total >= minutes - 10,
          `${id} ${minutes} #${number}: ${total}`,
        );
        assert.ok(
          spec.sections.some((s) => s.kind === "practice" && s.items.length),
          `${id} ${minutes} #${number}: practice`,
        );
        const challenge = spec.sections.find((s) => s.kind === "challenge")!;
        assert.ok(
          challenge.items[0]!.minutes <= minutes / 5,
          `${id} ${minutes} #${number}: challenge ${challenge.items[0]!.minutes} min`,
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

test("a teacher's marking link takes the place of the parent's", () => {
  const spec = compose("third-grade");
  const parent = workbookHtml(spec, {
    lessons,
    skillTitle,
    results: {
      baseUrl: "https://amp.corpora.inc",
      learnerId: "l1",
      workbookId: "w1",
    },
  });
  const teacher = workbookHtml(spec, {
    lessons,
    skillTitle,
    results: {
      baseUrl: "https://amp.corpora.inc",
      learnerId: "l1",
      workbookId: "w1",
    },
    resultsUrl: "https://amp.corpora.inc/school/o/classes/c/workbooks/d",
  });
  assert.ok(teacher.includes('class="wb-qr"'));
  assert.notEqual(teacher, parent);
});

test("a focus skill leans a workbook on it, and an unusable one changes nothing", () => {
  const plain = compose("third-grade");
  assert.deepEqual(
    compose("third-grade", { focusSkill: "no-such-skill" }),
    plain,
  );
  const skill = plain.sections.find((s) => s.kind === "practice")!.items[0]!
    .skillId;
  const focused = compose("third-grade", { focusSkill: skill });
  assert.equal(focused.focusSkill, skill);
  const practice = focused.sections.find((s) => s.kind === "practice")!.items;
  assert.ok(practice.filter((item) => item.skillId === skill).length >= 2);
  assert.notEqual(workbookCode(focused), workbookCode(plain));
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

test("a long lesson card gives up content in one fixed order", () => {
  assert.deepEqual(
    sentences("Add the tens. Then add $3.5 + 1.2$ ones. Is it 4.7? Yes."),
    ["Add the tens.", "Then add $3.5 + 1.2$ ones.", "Is it 4.7?", "Yes."],
  );
  assert.deepEqual(sentences("No full stop inside $x. Y$ math"), [
    "No full stop inside $x. Y$ math",
  ]);
  assert.deepEqual(sentences("Mr. Lee has 3 pens. See Fig. 2 now."), [
    "Mr. Lee has 3 pens.",
    "See Fig. 2 now.",
  ]);
  assert.deepEqual(sentences("Use \\(x. Y\\) here. Then stop."), [
    "Use \\(x. Y\\) here.",
    "Then stop.",
  ]);
  // Prose between two prices is not math: it still splits.
  assert.deepEqual(sentences("A pen is $3. A book costs $5."), [
    "A pen is $3.",
    "A book costs $5.",
  ]);
  for (const lesson of lessons)
    for (const section of lesson.sections)
      for (const p of section.paragraphs)
        assert.equal(sentences(p).join(" "), p.trim(), lesson.id);
  const r = cardTrimRanks({
    paragraphs: 3,
    sentences: 3,
    pitfall: true,
    visual: true,
    words: 2,
    steps: 4,
    figure: true,
  });
  // Extra paragraphs (last first), pitfall, later sentences (last first),
  // diagram, words (last first), later steps (last first), figure.
  assert.deepEqual(r.paragraphs, [undefined, 2, 1]);
  assert.equal(r.pitfall, 3);
  assert.deepEqual(r.sentences, [undefined, 5, 4]);
  assert.equal(r.visual, 6);
  assert.deepEqual(r.words, [8, 7]);
  assert.deepEqual(r.steps, [undefined, 11, 10, 9]);
  assert.equal(r.figure, 12);
  // The first paragraph's first sentence and the first step always stay.
  const bare = cardTrimRanks({
    paragraphs: 1,
    sentences: 1,
    pitfall: false,
    visual: false,
    words: 0,
    steps: 1,
    figure: false,
  });
  assert.deepEqual(bare.paragraphs, [undefined]);
  assert.deepEqual(bare.steps, [undefined]);
});

test("the answer key carries the whole worked example, shown only when the card trims steps", () => {
  const learner = sampleLearners.find((l) => l.id === "third-grade")!;
  const { frontier, evidence, attempts } = simulateLearner(learner, now);
  const spec = composeWorkbook({
    templates,
    skills,
    lessons,
    frontier,
    evidence,
    recentTemplateIds: attempts.slice(-12).map((a) => a.templateId),
    date: "2026-10-31",
    learnerKey: learner.id,
    now,
  });
  const lessonId = spec.sections.find((s) => s.kind === "lesson")?.lessonId;
  assert.ok(lessonId, "the sample has a lesson");
  const html = workbookHtml(spec, { lessons, skillTitle: (s) => s });
  assert.match(html, /data-key-example="" hidden/);
  assert.match(html, /data-steps-more="" hidden/);
  assert.match(html, /The rest of the steps are in the answer key\./);
});

test("fractions in workbook prose print text-style; standalone mathematics and other publications stay display-style", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { PrintMathProse, PrintMathText } =
    await import("../src/content/PrintMathText");
  const render = (text: string, prose: boolean) =>
    renderToStaticMarkup(
      createElement(
        PrintMathProse.Provider,
        { value: prose },
        createElement(PrintMathText, { text }),
      ),
    );
  const sentence = "Shade \\(\\frac{3}{4}\\) of the strip.";
  assert.match(render(sentence, true), /print-math--prose/);
  assert.match(render(sentence, true), /\\textstyle/);
  // A card or choice holding only the fraction keeps the large form.
  assert.doesNotMatch(render("\\(\\frac{3}{4}\\)", true), /print-math--prose/);
  assert.doesNotMatch(
    render("\\(\\frac{3}{4}\\) cup.", true),
    /print-math--prose/,
  );
  // Books and lesson printables are unchanged.
  assert.doesNotMatch(render(sentence, false), /print-math--prose/);
  assert.match(render(sentence, false), /\\displaystyle/);
});

test("a stored version 1 workbook reprints the same problems under the same code", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/workbook-v1-spec.json", import.meta.url),
      "utf8",
    ),
  ) as { code: string; problems: string; spec: WorkbookSpec };
  assert.equal(fixture.spec.version, 1);
  assert.equal(fixture.spec.choices, undefined);
  assert.equal(workbookCode(fixture.spec), fixture.code);
  const problems = createHash("sha256")
    .update(
      JSON.stringify(
        workbookProblems(fixture.spec).map((p) => [p.public, p.answer]),
      ),
    )
    .digest("hex");
  assert.equal(problems, fixture.problems);
  assert.deepEqual(specChoices(fixture.spec), {
    areas: [],
    lean: "level",
    lesson: true,
  });
  assert.match(
    workbookHtml(fixture.spec, { lessons, skillTitle, learnerName: "Ada Q" }),
    /Workbook for Ada</,
  );
});

/** Six rolls on one day, each composed after the ones before it. */
const rolls = (
  id: string,
  choices?: Partial<WorkbookChoices>,
  count = 6,
): WorkbookSpec[] => {
  const made: WorkbookSpec[] = [];
  for (let number = 1; number <= count; number++)
    made.push(compose(id, { number, history: [...made].reverse(), choices }));
  return made;
};
const templateSet = (spec: WorkbookSpec) =>
  new Set(spec.sections.flatMap((s) => s.items.map((i) => i.templateId)));
const jaccard = (a: Set<string>, b: Set<string>) =>
  [...a].filter((x) => b.has(x)).length / new Set([...a, ...b]).size;

test("every roll is a different workbook: little template overlap, a new lesson and new review", () => {
  const overlaps: number[] = [];
  for (const id of ["third-grade", "algebra-two"]) {
    const made = rolls(id);
    for (let i = 1; i < made.length; i++)
      overlaps.push(jaccard(templateSet(made[i - 1]!), templateSet(made[i]!)));
    const lessonIds = made.map(
      (s) => s.sections.find((x) => x.kind === "lesson")?.lessonId,
    );
    // Both learners have more than six lessons near their frontier.
    assert.equal(new Set(lessonIds).size, made.length, `${id}: ${lessonIds}`);
    const reviews = made.map((s) =>
      s.sections
        .find((x) => x.kind === "review")!
        .items.map((i) => i.skillId)
        .join(","),
    );
    assert.ok(new Set(reviews).size >= made.length - 1, `${id}: ${reviews}`);
  }
  const mean = overlaps.reduce((a, b) => a + b, 0) / overlaps.length;
  // Before history-aware selection the mean was 0.17.
  assert.ok(mean < 0.1, `mean consecutive overlap ${mean.toFixed(3)}`);
});

test("rolls stay at the learner's level for every lean", () => {
  const { frontier } = learners.get("third-grade")!;
  const nodes = new Map(skills.map((s) => [s.id, s]));
  const byId = new Map(templates.map((t) => [t.id, t]));
  const offset = (templateId: string) => {
    const t = byId.get(templateId)!;
    return (
      templateGrade(t, nodes) -
      strandEstimate(frontier, nodes.get(t.skillId)!.strand).level
    );
  };
  const shift = { easier: -0.5, level: 0, stretch: 0.4 } as const;
  for (const lean of ["easier", "level", "stretch"] as const)
    for (const spec of rolls("third-grade", { lean }, 4)) {
      const section = (kind: string) =>
        spec.sections.find((s) => s.kind === kind)?.items ?? [];
      for (const i of section("practice")) {
        const o = offset(i.templateId);
        assert.ok(
          o >= -2 + shift[lean] - 1e-9 && o <= 0.8 + shift[lean] + 1e-9,
          `${lean} practice ${i.templateId} at ${o.toFixed(2)}`,
        );
      }
      for (const i of section("warm-up"))
        assert.ok(
          offset(i.templateId) <= 0.25 + 1e-9,
          `warm-up ${i.templateId}`,
        );
      const [challenge] = section("challenge");
      assert.ok(
        challenge!.grade <= frontier.overall.level + CHALLENGE_WINDOW[1] + 1e-9,
        `${lean} challenge ${challenge!.templateId}`,
      );
    }
});

test("choices change the workbook deterministically and are stored in the spec", () => {
  const plain = compose("third-grade", { number: 3 });
  assert.equal(plain.version, WORKBOOK_VERSION);
  assert.deepEqual(plain.choices, { areas: [], lean: "level", lesson: true });
  const choices: WorkbookChoices = {
    areas: ["geometry", "fractions"],
    lean: "stretch",
    lesson: false,
  };
  const mixed = compose("third-grade", { number: 3, choices });
  assert.deepEqual(compose("third-grade", { number: 3, choices }), mixed);
  assert.deepEqual(mixed.choices, {
    areas: ["fractions", "geometry"],
    lean: "stretch",
    lesson: false,
  });
  assert.notEqual(workbookCode(mixed), workbookCode(plain));
  const strand = new Map(skills.map((s) => [s.id, s.strand]));
  for (const i of items(mixed))
    assert.ok(
      ["fractions", "geometry"].includes(strand.get(i.skillId)!),
      i.skillId,
    );
  assert.ok(!mixed.sections.some((s) => s.kind === "lesson"));
  // A few areas still fill the time: practice shares out among them.
  const total = workbookMinutes(mixed);
  assert.ok(total <= 45 && total >= 35, `${total} minutes`);
  // Easier review, against the same workbook number: never less review
  // (more when the time allows; long problems can hit the 45-minute cap) and
  // never harder practice. A stretch practices higher.
  const same = compose("third-grade", { number: 4 });
  const easier = compose("third-grade", {
    number: 4,
    choices: { lean: "easier" },
  });
  assert.deepEqual(
    compose("third-grade", { number: 4, choices: { lean: "easier" } }),
    easier,
  );
  const stretch = compose("third-grade", {
    number: 4,
    choices: { lean: "stretch" },
  });
  const count = (spec: WorkbookSpec, kind: string) =>
    spec.sections.find((s) => s.kind === kind)?.items.length ?? 0;
  assert.ok(count(easier, "review") >= count(same, "review"));
  const meanGrade = (spec: WorkbookSpec) => {
    const list = spec.sections.find((s) => s.kind === "practice")!.items;
    return list.reduce((sum, i) => sum + i.grade, 0) / list.length;
  };
  assert.ok(meanGrade(easier) <= meanGrade(same));
  assert.ok(meanGrade(easier) < meanGrade(stretch));
});
