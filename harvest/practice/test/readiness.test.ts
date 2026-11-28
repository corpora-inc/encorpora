import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY_MS, createRng, itemLocation, pCorrect, readiness, recordAttempt, type EvidenceBook, type ExamBlueprint, type Item,
} from "../src/index.ts";
import { T0 } from "./fixtures.ts";

const BP: ExamBlueprint = {
  id: "mock", minutes: 90, passPercent: 70,
  domains: [
    { id: "site", skillIds: ["s1", "s2"], count: 18 },
    { id: "ops", skillIds: ["o1", "o2"], count: 24 },
    { id: "tech", skillIds: ["t1", "t2"], count: 25 },
    { id: "charts", skillIds: ["c1", "c2"], count: 23 },
  ],
};
const SKILLS = BP.domains.flatMap((d) => d.skillIds);
const item = (skillId: string, difficulty: number): Item =>
  ({ id: `${skillId}-${difficulty}`, skillId, kind: "mc", choiceCount: 4, answer: "0", difficulty });

function practice(right: Record<string, [number, number]>): EvidenceBook {
  // [correct, wrong] attempts per skill at difficulty 0.65, spread over the day before T0.
  let book: EvidenceBook = {};
  for (const [s, [c, w]] of Object.entries(right)) {
    for (let i = 0; i < c + w; i++) book = recordAttempt(book, item(s, 0.65), i < c, T0 - DAY_MS + i * 1000);
  }
  return book;
}

test("strong, weak and unpracticed learners", () => {
  const strong = readiness(practice(Object.fromEntries(SKILLS.map((s) => [s, [12, 0]]))), BP, T0, { draws: 300 });
  const weak = readiness(practice(Object.fromEntries(SKILLS.map((s) => [s, [2, 10]]))), BP, T0, { draws: 300 });
  const none = readiness({}, BP, T0, { draws: 300 });
  assert.ok(strong.pPass > 0.95, `strong ${strong.pPass}`);
  assert.ok(weak.pPass < 0.05, `weak ${weak.pPass}`);
  assert.equal(strong.passMark, 63);
  assert.equal(strong.items, 90);
  assert.ok(strong.confident);
  assert.equal(none.confident, false);
  assert.equal(none.evidence.coverage, 0);
  assert.ok(none.high - none.low > strong.high - strong.low, "no evidence means a wider interval");
  assert.ok(strong.low <= strong.expectedPercent && strong.expectedPercent <= strong.high);
});

test("more correct practice raises the pass probability; the weakest skill is named", () => {
  const base = Object.fromEntries(SKILLS.map((s) => [s, [6, 3] as [number, number]]));
  const a = readiness(practice(base), BP, T0, { draws: 300 });
  const b = readiness(practice({ ...base, c1: [9, 0], c2: [9, 0] }), BP, T0, { draws: 300 });
  assert.ok(b.pPass > a.pPass);
  const c = readiness(practice({ ...base, t2: [0, 9] }), BP, T0, { draws: 300 });
  assert.equal(c.weakest[0]?.skillId, "t2");
  assert.equal(c.byDomain.find((d) => d.domainId === "tech")!.count, 25);
  assert.ok(c.byDomain.find((d) => d.domainId === "tech")!.expected < a.byDomain.find((d) => d.domainId === "tech")!.expected);
});

test("partial coverage is not confident", () => {
  const r = readiness(practice({ s1: [10, 0], s2: [10, 0], o1: [10, 0], o2: [2, 1] }), BP, T0, { draws: 200 });
  assert.equal(r.confident, false);
  assert.ok(r.evidence.coverage > 0.2 && r.evidence.coverage < 0.4, `${r.evidence.coverage}`);
  assert.equal(r.evidence.skillsPracticed, 4, "o2 is practiced but under minAttempts, so not covered");
});

test("synthetic calibration: predicted pass probability matches simulated exam outcomes", () => {
  // Learners with known true ability practice under the model, then sit a simulated exam.
  const rng = createRng("calibration");
  const normal = () => {
    let u = 0;
    while (u === 0) u = rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
  };
  const diffs = [0.5, 0.65, 0.8];
  const preds: number[] = [];
  const outcomes: number[] = [];
  for (let l = 0; l < 240; l++) {
    const m = 1.2 + 1.1 * normal();
    const theta = Object.fromEntries(SKILLS.map((s) => [s, m + 0.5 * normal()]));
    let book: EvidenceBook = {};
    for (const s of SKILLS) {
      for (let i = 0; i < 10; i++) {
        const d = diffs[i % 3]!;
        const ok = rng.next() < pCorrect(theta[s]!, itemLocation(d), 0.25);
        book = recordAttempt(book, item(s, d), ok, T0 - DAY_MS + i * 1000);
      }
    }
    // The population prior is fit to the cohort, as it would be from real learners.
    preds.push(readiness(book, BP, T0, { draws: 100, seed: `l${l}`, populationMu: 1.2, populationSigma: 1.1, skillSpread: 0.5 }).pPass);
    let score = 0;
    for (const d of BP.domains) {
      for (let k = 0; k < d.count; k++) {
        const s = d.skillIds[Math.floor(rng.next() * d.skillIds.length)]!;
        const b = itemLocation(diffs[Math.floor(rng.next() * diffs.length)]!);
        if (rng.next() < pCorrect(theta[s]!, b, 0.25)) score++;
      }
    }
    outcomes.push(score >= 63 ? 1 : 0);
  }
  const brier = preds.reduce((s, p, i) => s + (p - outcomes[i]!) ** 2, 0) / preds.length;
  const base = outcomes.reduce((a, b) => a + b, 0) / outcomes.length;
  const brierBase = base * (1 - base);
  assert.ok(base > 0.2 && base < 0.8, `the simulated cohort should be mixed, got ${base}`);
  // At 600 learners this setup gives Brier 0.10 against 0.25; require a clear margin here.
  assert.ok(brier < 0.6 * brierBase, `Brier ${brier.toFixed(3)} vs base-rate ${brierBase.toFixed(3)}`);
  // The confident ends must be calibrated; the middle is known to run up to ~0.2 optimistic
  // (crane/eval/READINESS.md) and is checked loosely.
  const bins: Array<[number, number, number]> = [[0, 0.2, 0.1], [0.2, 0.8, 0.25], [0.8, 1.01, 0.1]];
  for (const [lo, hi, tol] of bins) {
    const idx = preds.map((p, i) => [p, i] as const).filter(([p]) => p >= lo && p < hi).map(([, i]) => i);
    if (idx.length < 20) continue;
    const meanP = idx.reduce((s, i) => s + preds[i]!, 0) / idx.length;
    const rate = idx.reduce((s, i) => s + outcomes[i]!, 0) / idx.length;
    assert.ok(Math.abs(meanP - rate) < tol,
      `bin [${lo.toFixed(2)}, ${hi.toFixed(2)}): predicted ${meanP.toFixed(2)}, observed ${rate.toFixed(2)} (n=${idx.length})`);
  }
});

test("rejects bad inputs instead of returning NaN", () => {
  assert.throws(() => readiness({}, { ...BP, domains: [] }, T0), RangeError);
  assert.throws(() => readiness({}, BP, T0, { examDifficulties: [] }), RangeError);
  assert.throws(() => readiness({}, BP, Number.NaN), RangeError);
  assert.throws(() => readiness({}, { ...BP, passPercent: Number.NaN }, T0), RangeError);
  assert.throws(() => readiness({}, BP, T0, { draws: 0 }), RangeError);
  assert.throws(() => readiness({}, BP, T0, { skillSpread: 0 }), RangeError);
  assert.throws(() => readiness({}, { ...BP, domains: [{ id: "x", skillIds: ["s1"], count: 2.5 }] }, T0), RangeError);
  const book = practice({ s1: [5, 0] });
  assert.throws(() => readiness({ ...book, s1: { ...book.s1!, mu: Number.NaN } }, BP, T0), RangeError);
});

test("forgetting moves the prediction smoothly toward no evidence and ends confidence", () => {
  // The review's case: steady practice, then idle days. The prediction must stay between the
  // trained value and the untrained one, move monotonically, and stop being confident.
  const book = practice(Object.fromEntries(SKILLS.map((s) => [s, [7, 3] as [number, number]])));
  const none = readiness({}, BP, T0, { draws: 300 }).pPass;
  const days = [0, 15, 30, 60, 65, 70, 90, 180, 365, 730];
  const runs = days.map((d) => readiness(book, BP, T0 + d * DAY_MS, { draws: 300 }));
  const p = runs.map((r) => r.pPass);
  const lo = Math.min(p[0]!, none) - 0.03;
  const hi = Math.max(p[0]!, none) + 0.03;
  for (let i = 0; i < p.length; i++) {
    assert.ok(p[i]! >= lo && p[i]! <= hi, `day ${days[i]}: pPass ${p[i]!.toFixed(3)} outside [${lo.toFixed(3)}, ${hi.toFixed(3)}]`);
    assert.ok(Math.abs(runs[i]!.evidence.learnerLevel) < 4, `day ${days[i]}: learner level ${runs[i]!.evidence.learnerLevel}`);
    if (i > 0) {
      const dir = Math.sign(none - p[0]!);
      assert.ok(dir * (p[i]! - p[i - 1]!) >= -0.03, `day ${days[i]}: moved away from the untrained value`);
    }
  }
  assert.ok(runs[0]!.confident);
  assert.equal(runs.at(-1)!.confident, false);
  assert.ok(Math.abs(p.at(-1)! - none) < Math.abs(p[0]! - none), "two idle years should be close to no evidence");
});

test("skill weights fill a domain like the bank does", () => {
  const book = practice({ ...Object.fromEntries(SKILLS.map((s) => [s, [8, 1] as [number, number]])), c1: [0, 9] });
  const even = readiness(book, BP, T0, { draws: 300 });
  const heavy = readiness(book, BP, T0, { draws: 300, skillWeights: { c1: 3, c2: 1 } });
  const charts = (r: typeof even) => r.byDomain.find((d) => d.domainId === "charts")!.expected;
  assert.ok(charts(heavy) < charts(even), "a weak skill that fills more of the domain lowers it");
  const c1 = heavy.weakest.find((w) => w.skillId === "c1")!;
  assert.ok(Math.abs(c1.expectedItemsLost / (1 - c1.expected) - 23 * 0.75) < 1e-9);
  assert.throws(() => readiness(book, BP, T0, { skillWeights: { c1: 0 } }), RangeError);
});
