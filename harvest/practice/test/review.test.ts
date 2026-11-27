import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, REVIEW, dueCards, emptyDeck, isDue, nextDueAt, pickReviewItem, reviewAfter, type ReviewDeck } from "../src/index.ts";
import { T0 } from "./fixtures.ts";

const a = { id: "f1", skillId: "s", variantOf: null };
const a1 = { id: "f1.v1", skillId: "s", variantOf: "f1" };
const a2 = { id: "f1.v2", skillId: "s", variantOf: "f1" };
const b = { id: "f2", skillId: "s", variantOf: null };

test("a correct first answer opens nothing", () => {
  assert.deepEqual(reviewAfter(emptyDeck, a, true, 0, T0), emptyDeck);
});

test("a miss opens a card for the family, due after a few items or ten minutes", () => {
  const d = reviewAfter(emptyDeck, a1, false, 5, T0);
  const card = d.cards.f1!;
  assert.equal(card.base, "f1");
  assert.equal(card.box, 0);
  assert.equal(card.misses, 1);
  assert.deepEqual(card.seen, ["f1.v1"]);
  assert.equal(isDue(card, 5 + REVIEW.firstGapSteps - 1, T0), false);
  assert.equal(isDue(card, 5 + REVIEW.firstGapSteps, T0), true);
  assert.equal(isDue(card, 6, T0 + REVIEW.firstGapMs), true);
});

test("correct reviews climb the boxes on widening intervals, then retire", () => {
  let d = reviewAfter(emptyDeck, a, false, 0, T0);
  let at = T0 + REVIEW.firstGapMs;
  for (let box = 1; box <= REVIEW.intervalsMs.length; box++) {
    d = reviewAfter(d, a, true, 100, at);
    const card = d.cards.f1!;
    assert.equal(card.box, box);
    assert.equal(card.dueStep, null, "after the first review the schedule is by the clock");
    assert.equal(card.dueAt, at + REVIEW.intervalsMs[box - 1]!);
    assert.equal(isDue(card, 10_000, at + 1), false);
    at = card.dueAt;
  }
  d = reviewAfter(d, a, true, 100, at);
  assert.equal(d.cards.f1, undefined);
});

test("a correct answer before the card is due keeps the schedule", () => {
  const d1 = reviewAfter(emptyDeck, a, false, 0, T0);
  const d2 = reviewAfter(d1, a1, true, 1, T0 + 1000);
  assert.equal(d2.cards.f1!.box, 0);
  assert.equal(d2.cards.f1!.dueStep, d1.cards.f1!.dueStep);
  assert.deepEqual(d2.cards.f1!.seen, ["f1", "f1.v1"]);
});

test("a miss on review sends the card back to the start and counts the miss", () => {
  let d = reviewAfter(emptyDeck, a, false, 0, T0);
  d = reviewAfter(d, a, true, 3, T0 + REVIEW.firstGapMs);
  assert.equal(d.cards.f1!.box, 1);
  d = reviewAfter(d, a1, false, 4, T0 + 2 * DAY_MS);
  assert.equal(d.cards.f1!.box, 0);
  assert.equal(d.cards.f1!.misses, 2);
  assert.equal(d.cards.f1!.dueStep, 4 + REVIEW.firstGapSteps);
});

test("the deck survives JSON round trips", () => {
  let d = reviewAfter(emptyDeck, a, false, 0, T0);
  d = reviewAfter(d, a, true, 3, T0 + REVIEW.firstGapMs);
  const back = JSON.parse(JSON.stringify(d)) as ReviewDeck;
  assert.equal(isDue(back.cards.f1!, 10, T0 + REVIEW.firstGapMs + 1), false);
  assert.deepEqual(back, d);
});

test("dueCards orders the most overdue first; nextDueAt finds the next one", () => {
  let d = reviewAfter(emptyDeck, b, false, 0, T0 + 5000);
  d = reviewAfter(d, a, false, 0, T0);
  const due = dueCards(d, 100, T0 + DAY_MS);
  assert.deepEqual(due.map((c) => c.base), ["f1", "f2"]);
  assert.deepEqual(dueCards(d, 0, T0), []);
  assert.equal(nextDueAt(d, T0), T0 + REVIEW.firstGapMs);
  assert.equal(nextDueAt(emptyDeck, T0), null);
});

test("pickReviewItem prefers an unseen sibling, else the one seen longest ago", () => {
  const d = reviewAfter(emptyDeck, a, false, 0, T0);
  const card = d.cards.f1!;
  assert.equal(pickReviewItem(card, [a, a1, a2])!.id, "f1.v1");
  const seenAll = { ...card, seen: ["f1.v2", "f1", "f1.v1"] };
  assert.equal(pickReviewItem(seenAll, [a, a1, a2])!.id, "f1.v2");
  assert.equal(pickReviewItem(card, []), null);
});
