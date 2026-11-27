import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY_MS, SESSION, absorbExam, answer, baseOf, createRng, frontiers, indexBank, newPractice, nextPick, skillReport,
  type Item, type PracticeState,
} from "../src/index.ts";
import { SKILLS, T0, makeItems } from "./fixtures.ts";

const ix = indexBank({ skills: SKILLS, items: makeItems() });

/** Simulated learner: always right on the listed skills, always wrong elsewhere (or a custom rule). */
function run(n: number, rule: (it: Item, i: number) => boolean, seed = "s", start: PracticeState = newPractice(), focus?: { topicIds?: string[]; skillIds?: string[] }) {
  const rng = createRng(seed);
  let state = start;
  const picks = [];
  for (let i = 0; i < n; i++) {
    const now = T0 + i * 20_000;
    const pick = nextPick(ix, state, { now, rng, ...(focus ? { focus } : {}) });
    if (!pick) break;
    picks.push(pick);
    state = answer(ix, state, pick, rule(pick.item, i), now);
  }
  return { state, picks };
}

test("indexBank rejects broken banks", () => {
  assert.throws(() => indexBank({ skills: [...SKILLS, SKILLS[0]!], items: [] }), /Duplicate skill/);
  assert.throws(() => indexBank({ skills: [{ id: "x", topicId: "t", prereqs: ["nope"] }], items: [] }), /unknown/);
  const items = makeItems(1, 1);
  assert.throws(() => indexBank({ skills: SKILLS, items: [...items, items[0]!] }), /Duplicate item/);
  assert.throws(() => indexBank({ skills: SKILLS, items: [{ ...items[0]!, id: "z", skillId: "ghost" }] }), /unknown skill/);
});

test("the first frontier opens every topic at once, honouring prerequisites", () => {
  const f = frontiers(ix, newPractice(), T0);
  assert.deepEqual([...f.keys()], ["loadcharts", "signals", "powerlines"]);
  assert.deepEqual(f.get("loadcharts")!.map((s) => s.id), ["lc.read"]);
  assert.deepEqual(f.get("signals")!.map((s) => s.id), ["sig.hand"]);
  assert.deepEqual(f.get("powerlines")!.map((s) => s.id), ["pl.clear"]);
});

test("early practice spreads across topics instead of drilling one", () => {
  const { picks } = run(9, () => true);
  const topics = new Set(picks.map((p) => ix.skillById.get(p.item.skillId)!.topicId));
  assert.equal(topics.size, 3);
  for (let i = 1; i < picks.length; i++) {
    assert.notEqual(baseOf(picks[i]!.item), baseOf(picks[i - 1]!.item), "no family twice in a row");
  }
});

test("mastering a prerequisite opens the next skills in that topic", () => {
  const { state } = run(80, () => true);
  const f = frontiers(ix, state, T0 + 80 * 20_000);
  const report = skillReport(ix, state, T0 + 80 * 20_000);
  const status = Object.fromEntries(report.map((r) => [r.skillId, r.status]));
  assert.equal(status["lc.read"], "mastered");
  assert.ok(["lc.deduct", "lc.radius", "lc.parts"].some((s) => status[s] !== "new"), "deeper load chart skills got practice");
  assert.ok(!(f.get("loadcharts") ?? []).some((s) => s.id === "lc.read"));
});

test("a skill stays locked while its prerequisite is weak", () => {
  // Wrong on every lc.read item: lc.deduct, lc.radius and lc.parts never appear.
  const { picks } = run(60, (it) => it.skillId !== "lc.read");
  assert.ok(picks.some((p) => p.item.skillId === "lc.read"));
  assert.ok(!picks.some((p) => ["lc.deduct", "lc.radius", "lc.parts"].includes(p.item.skillId)));
});

test("a miss comes back as a review a few items later, as an unseen sibling", () => {
  let missed: Item | null = null;
  const { picks } = run(12, (it, i) => {
    if (i === 0) {
      missed = it;
      return false;
    }
    return true;
  });
  const first = picks[0]!.item;
  assert.equal(missed, first);
  const back = picks.findIndex((p, i) => i > 0 && p.reason === "review" && baseOf(p.item) === baseOf(first));
  assert.ok(back >= 1 + SESSION.noRepeatWindow - 1 && back <= 5, `review came back at ${back}`);
  assert.notEqual(picks[back]!.item.id, first.id, "a sibling variant, not the same item");
});

test("reviews never run more than two in a row while new work exists", () => {
  // Miss everything for a while to flood the deck.
  const { picks } = run(40, (_, i) => i > 30);
  let run_ = 0;
  for (const p of picks) {
    run_ = p.reason === "review" ? run_ + 1 : 0;
    assert.ok(run_ <= SESSION.maxReviewsInARow);
  }
  assert.ok(picks.some((p) => p.reason === "review"));
});

test("item difficulty tracks the learner", () => {
  // Same three starting skills for both: focus keeps prerequisites out of it.
  const focus = { skillIds: ["lc.read", "sig.hand", "pl.clear"] };
  const strong = run(40, () => true, "d", newPractice(), focus);
  const weak = run(40, (it) => it.difficulty < 0.4, "d", newPractice(), focus);
  const mean = (r: typeof strong) => {
    const xs = r.picks.slice(12).map((p) => p.item.difficulty);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  assert.ok(mean(strong) > mean(weak) + 0.05, `strong ${mean(strong)} vs weak ${mean(weak)}`);
});

test("least-seen items come first: no item repeats until its skill's items are used", () => {
  const { picks } = run(14, () => true, "seen", newPractice(), { skillIds: ["pl.clear"] });
  const ids = picks.map((p) => p.item.id);
  assert.equal(new Set(ids.slice(0, 12)).size, 12, "12 items in pl.clear, all shown once before any repeat");
});

test("focus limits practice to the chosen topic", () => {
  const { picks } = run(20, () => true, "f", newPractice(), { topicIds: ["signals"] });
  assert.ok(picks.length > 0);
  assert.ok(picks.every((p) => p.item.skillId.startsWith("sig.")));
});

test("when everything is mastered, practice keeps going as a refresh", () => {
  const { state } = run(400, () => true, "m");
  const now = T0 + 400 * 20_000;
  const report = skillReport(ix, state, now);
  assert.ok(report.every((r) => r.status === "mastered"), JSON.stringify(report.map((r) => [r.skillId, r.status])));
  const pick = nextPick(ix, state, { now, rng: createRng(1) });
  assert.equal(pick?.reason, "refresh");
});

test("mastered skills return after a long break", () => {
  const { state } = run(400, () => true, "m");
  const later = T0 + 400 * 20_000 + 120 * DAY_MS;
  const report = skillReport(ix, state, later);
  assert.ok(report.some((r) => r.status === "review"));
  const pick = nextPick(ix, state, { now: later, rng: createRng(1) });
  assert.equal(pick?.reason, "frontier");
});

test("deterministic for a seed, different across seeds", () => {
  const a = run(30, (it) => it.difficulty < 0.6, "same").picks.map((p) => p.item.id);
  const b = run(30, (it) => it.difficulty < 0.6, "same").picks.map((p) => p.item.id);
  const c = run(30, (it) => it.difficulty < 0.6, "other").picks.map((p) => p.item.id);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("answer is pure and bounded", () => {
  const s0 = newPractice();
  const item = ix.bank.items[0]!;
  const s1 = answer(ix, s0, { item, reason: "frontier" }, true, T0);
  assert.equal(s0.step, 0);
  assert.equal(s1.step, 1);
  assert.equal(s1.seen[item.id], 1);
  let s = s1;
  for (let i = 0; i < SESSION.historyLength + 10; i++) s = answer(ix, s, { item, reason: "frontier" }, true, T0);
  assert.equal(s.history.length, SESSION.historyLength);
  assert.throws(() => answer(ix, s0, { item: { ...item, skillId: "ghost" }, reason: "frontier" }, true, T0));
});

test("state survives a JSON round trip mid-session", () => {
  const { state } = run(15, (_, i) => i % 3 !== 0, "j");
  const back = JSON.parse(JSON.stringify(state)) as PracticeState;
  const now = T0 + 15 * 20_000;
  assert.deepEqual(nextPick(ix, back, { now, rng: createRng(9) })?.item.id, nextPick(ix, state, { now, rng: createRng(9) })?.item.id);
});

test("an empty focus returns null", () => {
  assert.equal(nextPick(ix, newPractice(), { now: T0, rng: createRng(1), focus: { topicIds: ["none"] } }), null);
  const empty = indexBank({ skills: SKILLS, items: [] });
  assert.equal(nextPick(empty, newPractice(), { now: T0, rng: createRng(1) }), null);
});

test("skillReport lists every skill in blueprint order with due reviews", () => {
  const item = ix.itemsBySkill.get("sig.hand")![0]!;
  const s = answer(ix, newPractice(), { item, reason: "frontier" }, false, T0);
  const report = skillReport(ix, s, T0 + DAY_MS);
  assert.deepEqual(report.map((r) => r.skillId), SKILLS.map((x) => x.id));
  assert.equal(report.find((r) => r.skillId === "sig.hand")!.dueReviews, 1);
  assert.equal(report.find((r) => r.skillId === "sig.hand")!.topicId, "signals");
});

test("absorbExam feeds evidence and opens reviews for misses, leaving history alone", () => {
  const items = ix.itemsBySkill.get("pl.clear")!.slice(0, 4);
  const results = items.map((it, i) => ({ itemId: it.id, correct: i % 2 === 0 }));
  const s = absorbExam(ix, newPractice(), results, T0);
  assert.equal(s.book["pl.clear"]!.n, 4);
  assert.equal(s.history.length, 0);
  assert.equal(Object.keys(s.deck.cards).length, 2);
  assert.throws(() => absorbExam(ix, newPractice(), [{ itemId: "ghost", correct: true }], T0));
});
