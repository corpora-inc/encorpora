import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ExamClosed, ExamShortfall, MINUTE_MS, answerExam, baseOf, buildExam, deadline, domainCapacity, isOpen,
  originalChoice, remainingMs, scoreExam, startExam, submitExam, toggleFlag, validateBlueprint,
  type ExamBlueprint, type Item,
} from "../src/index.ts";
import { T0, makeItems } from "./fixtures.ts";

const items = makeItems(6, 3);
const byId = new Map(items.map((it) => [it.id, it]));
const BP: ExamBlueprint = {
  id: "core",
  minutes: 90,
  passPercent: 70,
  domains: [
    { id: "charts", skillIds: ["lc.read", "lc.deduct", "lc.radius", "lc.parts"], count: 10 },
    { id: "signals", skillIds: ["sig.hand", "sig.voice"], count: 6 },
    { id: "power", skillIds: ["pl.clear"], count: 4 },
  ],
};

test("blueprint validation", () => {
  validateBlueprint(BP);
  assert.throws(() => validateBlueprint({ ...BP, minutes: 0 }), RangeError);
  assert.throws(() => validateBlueprint({ ...BP, passPercent: 101 }), RangeError);
  assert.throws(() => validateBlueprint({ ...BP, domains: [] }), RangeError);
  assert.throws(() => validateBlueprint({ ...BP, domains: [BP.domains[0]!, BP.domains[0]!] }), RangeError);
  assert.throws(() => validateBlueprint({ ...BP, domains: [{ id: "x", skillIds: ["a"], count: 0 }] }), RangeError);
  assert.throws(() => validateBlueprint({ ...BP, domains: [{ id: "x", skillIds: ["a"], count: 1.5 }] }), RangeError);
  assert.throws(() => validateBlueprint({ ...BP, domains: [{ id: "x", skillIds: [], count: 1 }] }), RangeError);
});

test("a form has the exact count per domain, distinct items and distinct facts", () => {
  const form = buildExam(BP, items, "seed-1");
  assert.equal(form.items.length, 20);
  for (const d of BP.domains) {
    const mine = form.items.filter((f) => f.domainId === d.id);
    assert.equal(mine.length, d.count);
    for (const f of mine) assert.ok(d.skillIds.includes(f.skillId));
  }
  assert.equal(new Set(form.items.map((f) => f.itemId)).size, 20);
  assert.equal(new Set(form.items.map((f) => baseOf(byId.get(f.itemId)!))).size, 20, "never two variants of one fact");
  assert.equal(form.minutes, 90);
  assert.equal(form.passPercent, 70);
});

test("forms are deterministic per seed and vary across seeds", () => {
  const a = buildExam(BP, items, "x");
  assert.deepEqual(buildExam(BP, items, "x"), a);
  assert.notDeepEqual(buildExam(BP, items, "y").items.map((f) => f.itemId), a.items.map((f) => f.itemId));
});

test("domains are interleaved, not blocked", () => {
  const form = buildExam(BP, items, "mix");
  const firstHalf = new Set(form.items.slice(0, 10).map((f) => f.domainId));
  assert.equal(firstHalf.size, 3);
  let longest = 1, cur = 1;
  for (let i = 1; i < form.items.length; i++) {
    cur = form.items[i]!.domainId === form.items[i - 1]!.domainId ? cur + 1 : 1;
    longest = Math.max(longest, cur);
  }
  assert.ok(longest <= 3, `longest single-domain run ${longest}`);
});

test("choice order is a permutation; off when disabled; empty for non-mc", () => {
  const form = buildExam(BP, items, "c");
  for (const f of form.items) assert.deepEqual([...f.order].sort(), [0, 1, 2, 3]);
  assert.ok(form.items.some((f) => f.order.join() !== "0,1,2,3"));
  const plain = buildExam({ ...BP, shuffleChoices: false }, items, "c");
  for (const f of plain.items) assert.deepEqual(f.order, [0, 1, 2, 3]);
  const numeric: Item[] = items.map((it) => ({ ...it, kind: "numeric", answer: "5" }));
  for (const f of buildExam(BP, numeric, "n").items) assert.deepEqual(f.order, []);
  const f0 = form.items[0]!;
  assert.equal(originalChoice(f0, 0), f0.order[0]);
  assert.throws(() => originalChoice(f0, 4), RangeError);
});

test("shortfall names the domain and counts distinct facts", () => {
  const small = makeItems(2, 5); // 2 facts per skill, many variants
  assert.deepEqual(domainCapacity(BP, small), { charts: 8, signals: 4, power: 2 });
  assert.throws(() => buildExam(BP, small, "s"), (e: unknown) => {
    assert.ok(e instanceof ExamShortfall);
    assert.equal(e.domainId, "charts");
    assert.equal(e.needed, 10);
    assert.equal(e.available, 8);
    return true;
  });
});

test("prefer ranks items first (e.g. never seen)", () => {
  const fresh = new Set(items.filter((it) => it.id.endsWith(".v2")).map((it) => it.id));
  const form = buildExam(BP, items, "p", (it) => (fresh.has(it.id) ? 1 : 0));
  assert.ok(form.items.every((f) => fresh.has(f.itemId)));
});

test("the clock: remaining time, expiry, answers refused after time", () => {
  const form = buildExam(BP, items, "t");
  let s = startExam(form, T0);
  assert.equal(deadline(s), T0 + 90 * MINUTE_MS);
  assert.equal(remainingMs(s, T0 + MINUTE_MS), 89 * MINUTE_MS);
  assert.equal(remainingMs(s, T0 + 200 * MINUTE_MS), 0);
  const id = form.items[0]!.itemId;
  s = answerExam(s, id, 1, T0 + 1000);
  assert.equal(s.answers[id], 1);
  s = answerExam(s, id, null, T0 + 2000);
  assert.equal(s.answers[id], undefined);
  assert.equal(isOpen(s, deadline(s)), false);
  assert.throws(() => answerExam(s, id, 1, deadline(s)), ExamClosed);
  assert.throws(() => toggleFlag(s, id, deadline(s)), ExamClosed);
  assert.throws(() => answerExam(s, "ghost", 1, T0), RangeError);
});

test("flags toggle and submission closes the exam", () => {
  const form = buildExam(BP, items, "f");
  const id = form.items[3]!.itemId;
  let s = toggleFlag(startExam(form, T0), id, T0);
  assert.deepEqual(s.flagged, [id]);
  s = toggleFlag(s, id, T0);
  assert.deepEqual(s.flagged, []);
  s = submitExam(s, T0 + 5 * MINUTE_MS);
  assert.equal(s.submittedAt, T0 + 5 * MINUTE_MS);
  assert.equal(submitExam(s, T0 + 9 * MINUTE_MS), s, "idempotent");
  assert.throws(() => answerExam(s, id, 0, T0 + 6 * MINUTE_MS), ExamClosed);
  const late = submitExam(startExam(form, T0), T0 + 500 * MINUTE_MS);
  assert.equal(late.submittedAt, T0 + 90 * MINUTE_MS, "late submission is clamped to the deadline");
});

test("scoring: totals, pass mark on exact counts, by domain and by skill, unanswered wrong", () => {
  const form = buildExam({ ...BP, passPercent: 75 }, items, "score");
  let s = startExam(form, T0);
  // Right on the first 15, wrong on 3, blank on 2.
  form.items.forEach((f, i) => {
    const key = Number(byId.get(f.itemId)!.answer);
    if (i < 15) s = answerExam(s, f.itemId, key, T0 + i);
    else if (i < 18) s = answerExam(s, f.itemId, (key + 1) % 4, T0 + i);
  });
  assert.throws(() => scoreExam(s, items, T0 + MINUTE_MS), /Submit/);
  s = submitExam(s, T0 + 30 * MINUTE_MS);
  const r = scoreExam(s, items, T0 + 30 * MINUTE_MS);
  assert.equal(r.correct, 15);
  assert.equal(r.total, 20);
  assert.equal(r.percent, 75);
  assert.equal(r.passed, true, "exactly at the mark passes");
  assert.equal(r.answered, 18);
  assert.equal(r.durationMs, 30 * MINUTE_MS);
  assert.equal(r.timedOut, false);
  assert.deepEqual(r.byDomain.map((d) => d.id).sort(), ["charts", "power", "signals"]);
  assert.equal(r.byDomain.reduce((a, d) => a + d.total, 0), 20);
  assert.equal(r.bySkill.reduce((a, d) => a + d.correct, 0), 15);
  for (const t of [...r.byDomain, ...r.bySkill]) assert.equal(t.percent, Math.round((t.correct / t.total) * 1000) / 10);
  assert.equal(r.items.filter((x) => x.response === null).length, 2);
  assert.ok(r.items.filter((x) => x.response === null).every((x) => !x.correct));
});

test("scoring a timed-out exam closes it at the deadline", () => {
  const form = buildExam(BP, items, "late");
  const s = answerExam(startExam(form, T0), form.items[0]!.itemId, Number(byId.get(form.items[0]!.itemId)!.answer), T0);
  const r = scoreExam(s, items, T0 + 91 * MINUTE_MS);
  assert.equal(r.timedOut, true);
  assert.equal(r.durationMs, 90 * MINUTE_MS);
  assert.equal(r.correct, 1);
  assert.equal(r.passed, false);
});

test("pass mark just below is a fail (no rounding up)", () => {
  // 2 of 3 = 66.67%; a 66.7% mark must fail.
  const bp: ExamBlueprint = { id: "tiny", minutes: 5, passPercent: 66.7, domains: [{ id: "p", skillIds: ["pl.clear"], count: 3 }] };
  const form = buildExam(bp, items, "r");
  let s = startExam(form, T0);
  form.items.slice(0, 2).forEach((f) => (s = answerExam(s, f.itemId, Number(byId.get(f.itemId)!.answer), T0)));
  const r = scoreExam(submitExam(s, T0 + 1), items, T0 + 1);
  assert.equal(r.percent, 66.7);
  assert.equal(r.passed, false);
});

test("scoring needs every form item in the bank", () => {
  const form = buildExam(BP, items, "m");
  const s = submitExam(startExam(form, T0), T0 + 1);
  assert.throws(() => scoreExam(s, items.slice(0, 5), T0 + 1), /missing/);
});
