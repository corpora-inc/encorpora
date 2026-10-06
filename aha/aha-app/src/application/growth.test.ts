import { test } from "node:test";
import assert from "node:assert/strict";
import { growthSummary } from "./growth";
import type { AttemptEvidence, SkillProgress } from "../learning/types";

const now = new Date(2026, 9, 5, 15, 0);
const at = (daysAgo: number, hour = 10) => new Date(2026, 9, 5 - daysAgo, hour).toISOString();
let n = 0;
const base = (skillId: string, daysAgo: number, correct = true) => ({
  id: `e${++n}`, activityId: `a${n}`, skillId, at: at(daysAgo), correct, answer: "1", variant: `v${n}`,
  hintsUsed: 0, activeMs: 1000, interrupted: false, independent: correct,
});
const task = (skillId: string, daysAgo: number, correct = true): AttemptEvidence =>
  ({ ...base(skillId, daysAgo, correct), mode: "concept", expected: "1", task: { kind: "fraction", numerator: 1, denominator: 2 } });
const spec = (skillIds: string[], daysAgo: number, correct = true): AttemptEvidence =>
  ({ ...base(skillIds[0]!, daysAgo, correct), source: "ai-spec", mode: "concept",
    spec: { hash: "h", skillIds, difficulty: 2, responseType: "numeric", response: {}, content: {} } });
const progress = (skillId: string, p: Partial<SkillProgress> = {}): SkillProgress => ({
  skillId, concept: "developing", fluency: "not-applicable", retention: "unconfirmed", independentSuccesses: 1,
  distinctVariants: [], reviewStage: 0, nextReviewAt: null, lastAttemptAt: at(0), ...p,
});

test("a new learner has no areas, no streak and an empty week", () => {
  const g = growthSummary(undefined, now);
  assert.deepEqual(g.areas, []);
  assert.equal(g.streak, 0);
  assert.equal(g.week.length, 7);
  assert.ok(g.week.every(d => !d.practiced));
  assert.equal(g.week.at(-1)!.today, true);
  assert.deepEqual(g.recent, []);
});

test("local and AI-authored evidence both count, grouped by skill area", () => {
  const g = growthSummary({
    attempts: [task("3.NF.A.1", 0), spec(["3.OA.C.7", "3.OA.A.1"], 1), task("3.MD.C.7", 2, false)],
    progress: {
      "3.NF.A.1": progress("3.NF.A.1", { retention: "retained" }),
      "3.MD.C.7": progress("3.MD.C.7", { nextReviewAt: at(1) }),
    },
  }, now);
  assert.deepEqual(g.areas.map(a => a.id), ["operations", "fractions", "measurement"]);
  assert.deepEqual(g.areas[0]!.skills.map(s => s.id), ["3.OA.A.1", "3.OA.C.7"], "every skill an AI activity is evidence for");
  assert.equal(g.areas[1]!.skills[0]!.status, "confident");
  assert.equal(g.areas[2]!.skills[0]!.status, "review");
  assert.equal(g.areas[0]!.skills[0]!.status, "growing");
});

test("streak counts consecutive local days ending today, or yesterday while today is open", () => {
  const days = (ds: number[]) => ({ attempts: ds.map(d => task("2.OA.B.2", d)), progress: {} });
  assert.equal(growthSummary(days([0, 1, 2, 4]), now).streak, 3);
  assert.equal(growthSummary(days([1, 2]), now).streak, 2, "yesterday keeps the streak alive today");
  assert.equal(growthSummary(days([2, 3]), now).streak, 0);
  assert.deepEqual(growthSummary(days([0, 2]), now).week.map(d => d.practiced), [false, false, false, false, true, false, true]);
});

test("set-aside evidence never counts", () => {
  const flagged = { ...task("4.NF.B.3", 0), excluded: { reason: "dispute", at: at(0) } };
  const g = growthSummary({ attempts: [flagged], progress: {} }, now);
  assert.equal(g.streak, 0);
  assert.deepEqual(g.recent, []);
  assert.deepEqual(g.areas, []);
});

test("recent discoveries: newest correct answers, one per skill, at most four", () => {
  const attempts = [task("1.OA.C.6", 5), task("1.OA.C.6", 0), task("2.G.A.3", 1), task("3.NBT.A.1", 2), task("3.NF.A.3", 3, false),
    spec(["4.NBT.B.5"], 3), task("5.MD.C.5", 4)];
  const g = growthSummary({ attempts, progress: {} }, now);
  assert.deepEqual(g.recent.map(r => r.skillId), ["1.OA.C.6", "2.G.A.3", "3.NBT.A.1", "4.NBT.B.5"]);
  assert.equal(g.recent[1]!.area, "Shapes and space");
});
