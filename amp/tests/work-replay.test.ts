import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine";
import {
  problemDigest,
  replayOf,
  secondsSince,
  type StoredWork,
} from "../src/schools/work-replay";

/* The replay's mapping from stored rows: the served problem when whole, a
   rebuild from template, version and seed when not, and otherwise nothing
   drawn, never a stand-in. */
const template = "add-within-20";
const generated = generateProblem(template, "fixture-seed");
const stored = (
  patch: Partial<StoredWork> = {},
  outcome: StoredWork["outcome"] = {},
): StoredWork => ({
  attemptId: "attempt-1",
  day: "2026-11-10",
  content: {
    ...generated,
    selection: { reason: "review" },
  } as unknown as StoredWork["content"],
  ...patch,
  outcome: {
    id: "attempt-1",
    skillId: generated.public.skillId,
    templateId: template,
    correct: false,
    assisted: true,
    response: "7",
    answer: generated.answer,
    explanation: ["Count on."],
    help: ["hint", "person", "nonsense"],
    createdAt: "2026-11-10T19:42:00.000Z",
    ...outcome,
  },
});

test("a whole served problem replays as it was, with its origin", () => {
  const replay = replayOf(stored());
  assert.equal(replay.source, "served");
  assert.deepEqual(replay.problem, generated.public);
  assert.deepEqual(replay.origin, {
    templateId: template,
    version: generated.public.templateVersion,
    seed: "fixture-seed",
    digest: problemDigest(generated.public),
  });
  assert.equal(replay.item.id, "attempt-1");
  assert.equal(replay.item.at, "2026-11-10T19:42:00.000Z");
  assert.equal(replay.item.prompt, generated.public.prompt);
  assert.equal(replay.item.result, "missed");
  assert.equal(replay.item.review, true);
  assert.equal(replay.item.response, "7");
  assert.deepEqual(replay.help, ["hint", "person"]);
  assert.equal(replay.outcome.correct, false);
  assert.equal(replay.outcome.answer, generated.answer);
  assert.deepEqual(replay.outcome.explanation, ["Count on."]);
  assert.equal(replay.outcome.paper, false);
  assert.equal(replay.lesson.skillId, generated.public.skillId);
});

test("the digest ignores the instance id and key order", () => {
  const { id: _id, ...rest } = generated.public;
  const reordered = Object.fromEntries(Object.entries(rest).reverse());
  assert.equal(
    problemDigest({ ...(reordered as typeof rest), id: "other" }),
    problemDigest(generated.public),
  );
  assert.notEqual(
    problemDigest({ ...generated.public, prompt: "Something else" }),
    problemDigest(generated.public),
  );
});

test("an incomplete stored copy is rebuilt from template, version and seed", () => {
  const { prompt: _prompt, ...partial } = generated.public;
  const replay = replayOf(
    stored({ content: { public: partial as never, answer: "9" } }),
  );
  assert.equal(replay.source, "rebuilt");
  assert.equal(replay.problem?.prompt, generated.public.prompt);
  assert.equal(replay.origin?.digest, problemDigest(generated.public));
});

test("no seed, or a retired template, draws nothing and keeps what's stored", () => {
  const placeholder = replayOf(
    stored(
      {
        content: {
          public: {
            id: "p1",
            skillId: generated.public.skillId,
            templateId: template,
            prompt: "",
            response: { kind: "number" },
          },
          answer: "1",
          explanation: [],
        },
      },
      {
        response: "0",
        answer: undefined,
        explanation: undefined,
        help: undefined,
      },
    ),
  );
  assert.equal(placeholder.source, "unavailable");
  assert.equal(placeholder.problem, null);
  assert.equal(placeholder.origin, null);
  assert.equal(placeholder.item.prompt, "");
  assert.equal(placeholder.item.response, "0");
  // The answer falls back to the instance's own.
  assert.equal(placeholder.item.answer, "1");
  assert.equal(placeholder.help, null);
  assert.ok(!templates.some((entry) => entry.id === "retired-fixture"));
  const retired = replayOf(
    stored({
      content: {
        public: { templateId: "retired-fixture", seed: "s", prompt: "Old" },
      },
    }),
  );
  assert.equal(retired.source, "unavailable");
  assert.equal(retired.item.prompt, "Old");
});

test("paper marks and help-free answers read as they counted", () => {
  const paper = replayOf(
    stored({}, { correct: true, evidenceWeight: 0.5, evidenceSource: "paper" }),
  );
  assert.equal(paper.item.result, "paper");
  assert.equal(paper.outcome.paper, true);
  const alone = replayOf(
    stored({}, { correct: true, assisted: false, help: [] }),
  );
  assert.equal(alone.item.result, "independent");
  assert.deepEqual(alone.help, []);
});

test("time counts from the answer before only within a sitting", () => {
  const at = "2026-11-10T19:42:00.000Z";
  assert.equal(secondsSince(at, "2026-11-10T19:41:12.000Z"), 48);
  assert.equal(secondsSince(at, "2026-11-10T19:20:00.000Z"), null);
  assert.equal(secondsSince(at, null), null);
  assert.equal(secondsSince(at, at), null);
});
