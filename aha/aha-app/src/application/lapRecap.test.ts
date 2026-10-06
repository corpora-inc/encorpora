import { test } from "node:test";
import assert from "node:assert/strict";
import { LAP, lapRecap } from "./lapRecap";
import { getSkill } from "../learning/curriculum";
import type { AttemptEvidence, SkillProgress } from "../learning/types";

const t0 = Date.parse("2026-10-05T10:00:00Z");
let n = 0;
const at = (i: number) => new Date(t0 + i * 60_000).toISOString();
const base = (skillId: string, correct: boolean, variant?: string) => {
  n++;
  return { id: `e${n}`, activityId: `a${n}`, skillId, at: at(n), correct, answer: "1", variant: variant ?? `v${n}`,
    hintsUsed: 0, activeMs: 1000, interrupted: false, independent: correct };
};
const task = (skillId: string, correct = true, variant?: string): AttemptEvidence =>
  ({ ...base(skillId, correct, variant), mode: "concept", expected: "1", task: { kind: "fraction", numerator: 1, denominator: 2 } });
const spec = (skillIds: string[], correct = true): AttemptEvidence =>
  ({ ...base(skillIds[0]!, correct), source: "ai-spec", mode: "concept",
    spec: { hash: "h", skillIds, difficulty: 2, responseType: "numeric", response: {}, content: {} } });
const progress = (skillId: string, p: Partial<SkillProgress> = {}): SkillProgress => ({
  skillId, concept: "developing", fluency: "not-applicable", retention: "unconfirmed", independentSuccesses: 0,
  distinctVariants: [], reviewStage: 0, nextReviewAt: null, lastAttemptAt: at(n), ...p,
});
const title = (id: string) => getSkill(id)!.title;

test("no evidence, no recap", () => {
  assert.equal(lapRecap(undefined, 0), undefined);
  assert.equal(lapRecap({ attempts: [], progress: {} }, 3), undefined);
});

test("the last ten answers, local and AI-authored alike; set-aside answers are left out", () => {
  const older = [task("3.NF.A.1"), task("3.NF.A.1")];
  const lap = [task("3.OA.C.7"), task("3.OA.C.7", false), spec(["3.OA.C.7", "3.OA.A.1"]), task("3.OA.C.7"), task("3.MD.C.7"),
    task("3.OA.C.7"), task("3.OA.C.7", false), task("3.MD.C.7"), spec(["3.OA.A.1"]), task("3.OA.C.7")];
  const r = lapRecap({ attempts: [...older, ...lap], progress: {} }, 4)!;
  assert.equal(lap.length, LAP);
  assert.equal(r.answers.length, 10);
  assert.equal(r.correct, 8);
  assert.deepEqual(r.answers, [true, false, true, true, true, true, false, true, true, true]);
  assert.deepEqual(r.skills.map(s => s.id), ["3.OA.C.7", "3.OA.A.1", "3.MD.C.7"], "most practised first, at most three; AI tags count");
  assert.equal(r.skills[0]!.title, title("3.OA.C.7"));
  assert.equal(r.streak, 4);
  const flagged = [...older, ...lap.slice(0, 9), { ...lap[9]!, excluded: { reason: "dispute", at: at(99) } }];
  const s = lapRecap({ attempts: flagged, progress: {} }, 1)!;
  assert.equal(s.answers.length, 9);
  assert.equal(s.correct, 7);
});

test("taking root: provisional now, not before the lap", () => {
  const before = [task("2.OA.B.2"), task("2.OA.B.2"), task("2.OA.B.2"), task("1.OA.C.6")];
  const lap = [task("2.OA.B.2"), task("1.OA.C.6"), task("1.OA.C.6"), task("1.OA.C.6"), task("2.NBT.B.5")];
  const r = lapRecap({
    attempts: [...before, ...lap],
    progress: {
      "2.OA.B.2": progress("2.OA.B.2", { concept: "provisional" }),
      "1.OA.C.6": progress("1.OA.C.6", { concept: "provisional" }),
      "2.NBT.B.5": progress("2.NBT.B.5"),
    },
  }, 0, lap.length)!;
  const growth = Object.fromEntries(r.skills.map(s => [s.id, s.growth]));
  assert.equal(growth["1.OA.C.6"], "rooted", "three distinct correct answers reached in the lap");
  assert.equal(growth["2.OA.B.2"], undefined, "already provisional before the lap");
  assert.equal(growth["2.NBT.B.5"], undefined);
  assert.equal(r.skills[0]!.id, "1.OA.C.6", "a change is listed first");
});

test("an error before the lap resets the count: regaining it in the lap is taking root again", () => {
  const before = [task("4.NF.B.3"), task("4.NF.B.3"), task("4.NF.B.3"), task("4.NF.B.3", false)];
  const lap = [task("4.NF.B.3"), task("4.NF.B.3"), task("4.NF.B.3")];
  const r = lapRecap({ attempts: [...before, ...lap], progress: { "4.NF.B.3": progress("4.NF.B.3", { concept: "provisional" }) } }, 0, lap.length)!;
  assert.equal(r.skills[0]!.growth, "rooted");
});

test("remembered: retained at review stage 2, reached during the lap", () => {
  const before = [task("3.G.A.1"), task("3.G.A.1"), task("3.G.A.1")];
  const lap = [task("5.NBT.B.5"), task("3.G.A.1")];
  const seven = 7 * 86_400_000;
  const inLap = new Date(Date.parse(lap[0]!.at) + 30_000 + seven).toISOString();
  const earlier = new Date(Date.parse(lap[0]!.at) - 86_400_000 + seven).toISOString();
  const r = lapRecap({
    attempts: [...before, ...lap],
    progress: {
      "5.NBT.B.5": progress("5.NBT.B.5", { concept: "provisional", retention: "retained", reviewStage: 2, nextReviewAt: inLap }),
      "3.G.A.1": progress("3.G.A.1", { concept: "provisional", retention: "retained", reviewStage: 2, nextReviewAt: earlier }),
    },
  }, 0, lap.length)!;
  const growth = Object.fromEntries(r.skills.map(s => [s.id, s.growth]));
  assert.equal(growth["5.NBT.B.5"], "remembered");
  assert.equal(growth["3.G.A.1"], undefined, "remembered on an earlier day is not new");
});

test("the recap is fast on a long history", () => {
  const attempts = Array.from({ length: 5000 }, (_, i) => task(i % 2 ? "3.OA.C.7" : "3.NF.A.1"));
  const progressMap = { "3.OA.C.7": progress("3.OA.C.7", { concept: "provisional" }), "3.NF.A.1": progress("3.NF.A.1", { concept: "provisional" }) };
  const t = performance.now();
  const r = lapRecap({ attempts, progress: progressMap }, 0)!;
  assert.ok(performance.now() - t < 50, "well under a frame budget");
  assert.equal(r.correct, 10);
});
