import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY_MS, MODEL, decayed, estimate, estimateOf, expectedSuccess, guessFloor, itemLocation, newEvidence,
  normalCdf, pCorrect, predictItem, probabilityAbove, recordAttempt, update, type EvidenceBook, type Item,
} from "../src/index.ts";
import { T0 } from "./fixtures.ts";

const obs = (correct: boolean, difficulty = 0.5, guess = 0, at = T0) => ({ correct, difficulty, guess, at });
const mc = (difficulty = 0.5): Item => ({ id: "q", skillId: "s", kind: "mc", choiceCount: 4, answer: "0", difficulty });

test("normalCdf matches known values", () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(normalCdf(1.959963985) - 0.975) < 1e-6);
  assert.ok(Math.abs(normalCdf(-1) - 0.158655254) < 1e-6);
});

test("item location maps 0..1 to -2..2 and clamps", () => {
  assert.equal(itemLocation(0.5), 0);
  assert.equal(itemLocation(0), -2);
  assert.equal(itemLocation(1), 2);
  assert.equal(itemLocation(1.7), 2);
  assert.throws(() => itemLocation(Number.NaN), RangeError);
});

test("guess floor: 1/k for mc only", () => {
  assert.equal(guessFloor({ kind: "mc", choiceCount: 4 }), 0.25);
  assert.equal(guessFloor({ kind: "mc" }), 0.25);
  assert.equal(guessFloor({ kind: "mc", choiceCount: 2 }), 0.5);
  assert.equal(guessFloor({ kind: "numeric" }), 0);
  assert.equal(guessFloor({ kind: "free_text" }), 0);
});

test("pCorrect is bounded by the guess floor and the slip", () => {
  assert.ok(Math.abs(pCorrect(-50, 0, 0.25) - 0.25) < 1e-9);
  assert.ok(Math.abs(pCorrect(50, 0, 0.25) - (1 - MODEL.slip)) < 1e-9);
});

test("a fresh skill: new, mastery 0.5-ish, wide interval", () => {
  const e = estimate(newEvidence("s"), T0);
  assert.equal(e.status, "new");
  assert.ok(Math.abs(e.mastery - 0.5) < 1e-6);
  assert.ok(e.low < 0.2 && e.high > 0.8);
  assert.ok(e.pMastered < 0.25);
});

test("correct raises the mean, a miss lowers it, both narrow the belief", () => {
  const e0 = newEvidence("s");
  const up = update(e0, obs(true));
  const down = update(e0, obs(false));
  assert.ok(up.mu > e0.mu);
  assert.ok(down.mu < e0.mu);
  assert.ok(up.sigma < e0.sigma && down.sigma < e0.sigma);
  assert.equal(up.n, 1);
  assert.equal(up.correct, 1);
  assert.equal(down.correct, 0);
  assert.equal(up.lastAt, T0);
});

test("a correct answer on a hard item is stronger evidence than on an easy one", () => {
  const e0 = newEvidence("s");
  assert.ok(update(e0, obs(true, 0.9)).mu > update(e0, obs(true, 0.1)).mu);
  // ...and missing an easy item is worse news than missing a hard one.
  assert.ok(update(e0, obs(false, 0.1)).mu < update(e0, obs(false, 0.9)).mu);
});

test("guessing weakens the evidence of a correct answer", () => {
  const e0 = newEvidence("s");
  assert.ok(update(e0, obs(true, 0.5, 0.25)).mu < update(e0, obs(true, 0.5, 0)).mu);
  assert.throws(() => update(e0, obs(true, 0.5, 0.99)), RangeError);
});

test("mastery needs repeated evidence, then holds", () => {
  let e = newEvidence("s");
  const statuses: string[] = [];
  for (let i = 0; i < 12; i++) {
    e = update(e, obs(true, 0.6, 0.25, T0 + i * 60_000));
    statuses.push(estimate(e, T0 + i * 60_000).status);
  }
  assert.equal(statuses[0], "learning");
  assert.equal(statuses.at(-1), "mastered");
  const first = statuses.indexOf("mastered");
  assert.ok(first >= 3, `mastered after ${first + 1}`);
  assert.ok(statuses.slice(first).every((s) => s === "mastered"));
  assert.equal(e.everMastered, true);
  const est = estimate(e, T0 + 12 * 60_000);
  assert.ok(est.mastery > 0.8 && est.low < est.mastery && est.high > est.mastery);
});

test("repeated misses read as struggling", () => {
  let e = newEvidence("s");
  for (let i = 0; i < 4; i++) e = update(e, obs(false, 0.4, 0.25, T0 + i));
  assert.equal(estimate(e, T0 + 5).status, "struggling");
  // Two misses are not yet enough to label anyone.
  const two = update(update(newEvidence("s"), obs(false)), obs(false));
  assert.equal(estimate(two, T0).status, "learning");
});

test("time without evidence widens the belief up to the prior, and a mastered skill comes back as review", () => {
  let e = newEvidence("s");
  for (let i = 0; i < 12; i++) e = update(e, obs(true, 0.7, 0, T0));
  assert.equal(estimate(e, T0).status, "mastered");
  const later = decayed(e, T0 + 120 * DAY_MS);
  assert.ok(later.sigma > e.sigma);
  assert.ok(later.sigma <= MODEL.priorSigma + 1e-12);
  assert.ok(later.mu < e.mu && later.mu > MODEL.priorMu, "the mean relaxes toward the prior");
  const halfLife = decayed(e, T0 + MODEL.meanHalfLifeDays * DAY_MS);
  assert.ok(Math.abs(halfLife.mu - (MODEL.priorMu + (e.mu - MODEL.priorMu) / 2)) < 1e-9);
  assert.equal(estimate(e, T0 + 7 * DAY_MS).status, "mastered", "a week off keeps mastery");
  assert.equal(estimate(e, T0 + 120 * DAY_MS).status, "review");
  assert.equal(decayed(e, T0 - DAY_MS), e, "clock going backwards changes nothing");
  assert.equal(decayed(newEvidence("s"), T0 + DAY_MS).sigma, MODEL.priorSigma);
});

test("sigma never drops below the floor", () => {
  let e = newEvidence("s");
  for (let i = 0; i < 300; i++) e = update(e, obs(i % 2 === 0, 0.5, 0, T0));
  assert.ok(e.sigma >= MODEL.minSigma);
  assert.ok(Math.abs(e.mu) < 0.5, "balanced evidence stays near the middle");
});

test("expectedSuccess and probabilityAbove behave", () => {
  assert.ok(Math.abs(expectedSuccess(0, 1) - 0.5) < 1e-6);
  assert.ok(expectedSuccess(1, 0.5) > expectedSuccess(0, 0.5));
  assert.ok(expectedSuccess(0, 0.5, -1) > expectedSuccess(0, 0.5, 1));
  assert.ok(Math.abs(probabilityAbove(0, 1, 0) - 0.5) < 1e-7);
  assert.ok(probabilityAbove(2, 0.3, 1) > 0.99);
});

test("book helpers are pure and per skill", () => {
  const book0: EvidenceBook = {};
  const book1 = recordAttempt(book0, { ...mc(), skillId: "a" }, true, T0);
  assert.deepEqual(book0, {});
  assert.equal(book1.a?.n, 1);
  assert.equal(book1.b, undefined);
  assert.equal(estimateOf(book1, "b", T0).status, "new");
  assert.equal(estimateOf(book1, "a", T0).n, 1);
});

test("predictItem: easier items and stronger skills predict higher; mc never below the floor", () => {
  let book: EvidenceBook = {};
  const easy = mc(0.1), hard = mc(0.9);
  assert.ok(predictItem(book, easy, T0) > predictItem(book, hard, T0));
  const before = predictItem(book, hard, T0);
  for (let i = 0; i < 5; i++) book = recordAttempt(book, mc(0.7), true, T0);
  assert.ok(predictItem(book, hard, T0) > before);
  for (let i = 0; i < 20; i++) book = recordAttempt(book, mc(0.1), false, T0);
  assert.ok(predictItem(book, hard, T0) >= 0.25);
});
