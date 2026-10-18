import test from "node:test";
import assert from "node:assert/strict";
import { trialProgress } from "../src/server/trial-progress";
import type { Outcome } from "../src/server/repository";
const attempt = (templateId: string, correct: boolean, assisted = false) =>
  ({ templateId, correct, assisted }) as Outcome;
test("teaching selects a recent independent error and reports lower scores without inventing improvement", () => {
  const placement = Array.from({ length: 20 }, (_, i) =>
    attempt(i < 16 ? "other" : "focus", i !== 19),
  );
  const lesson = trialProgress(placement, null, false);
  assert.equal(lesson.templateId, "focus");
  assert.equal(lesson.phase, "lesson");
  assert.deepEqual(lesson.before, { correct: 3, answered: 4 });
  const after = trialProgress(
    [
      ...placement,
      attempt("focus", false),
      attempt("focus", false),
      attempt("focus", true, true),
      attempt("focus", false),
    ],
    "focus",
    true,
  );
  assert.equal(after.phase, "complete");
  assert.deepEqual(after.totals, { independent: 23, assisted: 1 });
  assert.deepEqual(after.after, {
    correct: 1,
    answered: 4,
    assisted: 1,
    independentCorrect: 0,
  });
});
test("assisted placement results are excluded from the independent baseline", () => {
  const results = Array.from({ length: 20 }, () =>
    attempt("focus", true, true),
  );
  assert.deepEqual(trialProgress(results, null, false).before, {
    correct: 0,
    answered: 0,
  });
  assert.equal(
    trialProgress(results.slice(0, 19), null, false).phase,
    "placement",
  );
});
