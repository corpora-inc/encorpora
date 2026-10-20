import test from "node:test";
import assert from "node:assert/strict";
import {
  flagReasonLabels,
  flagReasons,
  noteAllowed,
  problemFlagSchema,
} from "../src/feedback/problem-flags.js";

const now = new Date("2026-10-20T12:00:00Z");

test("a note is offered only to a consented learner certainly 13 or older", () => {
  assert.equal(noteAllowed({ trial: false, birthYear: 2012 }, now), true);
  // Born in December 2013, a learner is still 12 in October 2026.
  assert.equal(noteAllowed({ trial: false, birthYear: 2013 }, now), false);
  assert.equal(noteAllowed({ trial: false, birthYear: 2016 }, now), false);
  assert.equal(noteAllowed({ trial: false, birthYear: null }, now), false);
  assert.equal(noteAllowed({ trial: true, birthYear: 1990 }, now), false);
});

test("report labels are short and cover every reason", () => {
  assert.deepEqual(Object.keys(flagReasonLabels), [...flagReasons]);
  for (const label of Object.values(flagReasonLabels))
    assert.ok(label.length <= 20, label);
});

test("the report body accepts only known reasons and the client's own details", () => {
  const body = {
    problemId: "a".repeat(64),
    requestId: "6f1c2f4e-6c1d-4a4b-9a0e-2b6f8d1c0a11",
    reasons: ["wrong-answer"],
    client: { kind: "web", viewport: { width: 390, height: 844 } },
  };
  assert.equal(problemFlagSchema.safeParse(body).success, true);
  for (const bad of [
    { ...body, reasons: [] },
    { ...body, reasons: ["wrong-answer", "wrong-answer"] },
    { ...body, outcome: "correct" },
    { ...body, prompt: "Edited" },
    { ...body, client: { ...body.client, kind: "bot" } },
    { ...body, client: { ...body.client, userAgent: "x" } },
    { ...body, webCommit: "HEAD" },
  ])
    assert.equal(
      problemFlagSchema.safeParse(bad).success,
      false,
      JSON.stringify(bad),
    );
});
