import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  lessonGlossaryContext,
  screenBand,
} from "../src/content/problem-lessons";
import { glossaryPayload, linksOnScreen } from "../src/glossary/resolve";
import { termsIn } from "../src/glossary/link";
import type { GlossaryPayload } from "../src/glossary/types";
import { estimateFrontier } from "../src/learning/frontier";
import { defaultPracticeSettings } from "../src/learning/practice-settings";
import { generateProblem } from "../src/math/engine";
import { buildApp } from "../src/server/app";
import type {
  Outcome,
  Repository,
  SavedProblem,
} from "../src/server/repository";

const TEMPLATE = "add-fractions";

/** A payload names a card for every term its text links, and for every term
 * those cards' definitions use, so drill-down needs no other request. */
function assertCovers(payload: GlossaryPayload, texts: string[]) {
  const ids = new Set(payload.glossary?.map((card) => card.id));
  // A screen for grade 3 or later links only words it does not already know.
  const used = texts
    .flatMap((text) => termsIn(text, lessonGlossaryContext(TEMPLATE)))
    .filter((id) => linksOnScreen(id, screenBand(TEMPLATE)));
  assert.ok(used.length > 0, `no glossary words in ${texts.join(" ")}`);
  for (const id of used) assert.ok(ids.has(id), `missing card ${id}`);
  for (const card of payload.glossary ?? [])
    for (const id of card.uses)
      assert.ok(ids.has(id), `${card.id} uses ${id}, which has no card`);
  for (const id of Object.values(payload.glossaryLexicon ?? {}))
    if (id) {
      assert.ok(ids.has(id), `lexicon links ${id} with no card`);
      assert.ok(
        linksOnScreen(id, screenBand(TEMPLATE)),
        `${id} is known at this level and must not be linked`,
      );
    }
  assert.ok(payload.glossaryLexicon, "no lexicon");
}

function fixture() {
  const problems = new Map<string, SavedProblem>();
  const attempts: Outcome[] = [];
  const tx = {
    satMathFocus: async () => false,
    trialRemaining: async () => null,
    recentAttempts: async () => [],
    recentSkips: async () => [],
    skillEvidence: async () => [],
    practiceSettings: async () => defaultPracticeSettings(),
    masteredSkills: async () => [],
    frontier: async () =>
      estimateFrontier({
        start: 4,
        observations: [],
        gradeOf: () => 4,
        strandOf: () => "math",
        guessOf: () => 0,
      }),
    problem: async (id: string) => problems.get(id),
    saveProblem: async (problem: SavedProblem) => {
      problems.set(problem.public.id, problem);
    },
    saveSkip: async (problem: SavedProblem) => {
      problems.set(problem.public.id, problem);
    },
    attemptByProblem: async (id: string) =>
      attempts.find((a) => a.problemId === id),
    attemptByRequest: async (id: string) =>
      attempts.find((a) => a.requestId === id),
    saveAttempt: async (outcome: Outcome) => {
      attempts.push(structuredClone(outcome));
    },
  };
  const repository = {
    transaction: async (
      _account: string,
      _learner: string,
      run: (transaction: typeof tx) => unknown,
    ) => run(tx),
  } as unknown as Repository;
  const app = buildApp({
    repository,
    authenticate: async () => "glossary-family",
    development: true,
  });
  const base = "/api/v1/learners/00000000-0000-4000-8000-000000000001";
  const post = async (path: string, payload: object) => {
    const response = await app.inject({
      method: "POST",
      url: `${base}/${path}`,
      payload,
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  return { app, post, attempts };
}

test("hints, explanations, skips and lessons carry the term cards their words open", async () => {
  const { app, post, attempts } = fixture();
  try {
    const batch = await post("batches", { templateId: TEMPLATE, count: 3 });
    const [first, second, third] = batch.problems;
    for (const problem of batch.problems) {
      const hint = batch.hints[problem.id];
      assert.equal(hint.hint, generateProblem(TEMPLATE, problem.seed).hint);
      assertCovers(hint, [hint.hint]);
    }

    // Requesting a hint returns the same support as the batch preloaded.
    assert.deepEqual(
      await post("hints", { problemId: first.id }),
      batch.hints[first.id],
    );

    const generated = generateProblem(TEMPLATE, first.seed);
    const input = {
      problemId: first.id,
      requestId: randomUUID(),
      response: generated.answer,
    };
    const outcome = await post("attempts", input);
    assert.deepEqual(outcome.explanation, generated.explanation);
    assertCovers(outcome, outcome.explanation);
    // Cards go to the learner, never into the stored attempt.
    assert.equal(attempts.length, 1);
    assert.ok(!("glossary" in attempts[0]!));
    assert.ok(!("glossaryLexicon" in attempts[0]!));
    // A retried submission returns the stored attempt with its cards.
    assert.deepEqual(await post("attempts", input), outcome);

    const skipped = await post("skips", { problemId: second.id });
    assertCovers(skipped, skipped.explanation);

    const { lesson } = await post("lesson-support", { problemId: third.id });
    assertCovers(lesson, [lesson.intuition, ...lesson.method]);
    assert.ok(lesson.keyWords.length > 0);
    for (const id of lesson.keyWords)
      assert.ok(lesson.glossary.some((card: { id: string }) => card.id === id));
  } finally {
    await app.close();
  }
});

test("a grade 3+ screen does not link words first met in kindergarten to grade 2", () => {
  const text =
    "Add the two numbers to find the sum, then compare each denominator.";
  const early = glossaryPayload([text], {}, [], "1");
  const later = glossaryPayload([text], {}, [], "6");
  assert.equal(early.glossaryLexicon.sum, "sum");
  assert.equal(later.glossaryLexicon.sum, null);
  assert.ok(early.glossary.some((card) => card.id === "sum"));
  assert.equal(later.glossaryLexicon.denominator, "denominator");
  // Inside a card the definition still links every word it uses, known or
  // not, and those cards come with it for drill-down.
  const denominator = later.glossary.find((c) => c.id === "denominator")!;
  for (const id of Object.values(denominator.lexicon ?? {}))
    if (id) assert.ok(later.glossary.some((card) => card.id === id));
  assert.ok(Object.values(denominator.lexicon ?? {}).some(Boolean));
});
