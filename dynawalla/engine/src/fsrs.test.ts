/**
 * Layer F. The weight vector is pinned; the behaviour is checked against the two
 * claims ADR-0008 makes about it.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_WEIGHTS, MAX_INTERVAL_DAYS, WEIGHT_COUNT, fsrsScheduler, intervalFor, retrievability, weightChecksum } from "./fsrs.ts";
import { NEW_LATENCY_STATS, ratingFor } from "./facts.ts";
import { ONE, format, fromRatio } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";

test("FSRS-6 carries exactly 21 weights, pinned by value and by checksum", () => {
  // A library upgrade, a re-fit or a hand edit must fail here rather than
  // silently rescheduling every child's review queue (ADR-0008 §4). The checksum
  // is order-sensitive, which a sum would not be.
  assert.equal(DEFAULT_WEIGHTS.length, WEIGHT_COUNT);
  assert.equal(fsrsScheduler().weightCount, WEIGHT_COUNT);
  assert.deepEqual(
    DEFAULT_WEIGHTS.map((w) => Number(w)),
    [
      217_200, 1_177_100, 3_260_200, 16_150_700, 7_011_400, 570_000, 2_096_600, 6_900, 1_526_100, 112_000, 1_017_800,
      1_849_000, 113_300, 312_700, 2_293_400, 219_100, 3_000_400, 753_600, 333_200, 143_700, 200_000,
    ],
  );
  assert.equal(weightChecksum(DEFAULT_WEIGHTS), weightChecksum(DEFAULT_WEIGHTS));
  const swapped = [...DEFAULT_WEIGHTS];
  const first = swapped[0];
  const second = swapped[1];
  if (first !== undefined && second !== undefined) {
    swapped[0] = second;
    swapped[1] = first;
  }
  assert.notEqual(weightChecksum(swapped), weightChecksum(DEFAULT_WEIGHTS), "the checksum ignores order");
});

test("FSRS-6 rejects a vector of the wrong length rather than indexing past it", () => {
  assert.throws(() => fsrsScheduler(DEFAULT_WEIGHTS.slice(0, 19)), RangeError);
});

test("the forgetting curve is a power law that passes through 0.9 at the stability", () => {
  // `R(S, S) = 0.9` is what makes "interval = stability at the default retention"
  // true rather than approximately true, and it is the identity the factor is
  // derived to satisfy.
  const stability = fromRatio(10, 1);
  const at = retrievability(DEFAULT_WEIGHTS, stability, 10);
  assert.ok(Math.abs(at - 900_000) < 2000, `R(10, 10) = ${format(at, 4)}`);
  assert.equal(retrievability(DEFAULT_WEIGHTS, stability, 0), ONE);
  assert.ok(retrievability(DEFAULT_WEIGHTS, stability, 40) < at, "recall does not decay");
});

test("a fluent success lengthens the interval and a lapse shortens it", () => {
  const scheduler = fsrsScheduler();
  const card = scheduler.create(0);
  const good = scheduler.review(card, "good", card.dueDay, false);
  const again = scheduler.review(card, "again", card.dueDay, false);
  assert.ok(good.dueDay - card.dueDay > card.dueDay, `good: ${String(good.dueDay - card.dueDay)} days`);
  assert.ok(again.dueDay - card.dueDay <= card.dueDay, "a lapse did not shorten the interval");
  assert.equal(again.lapses, 1);
  assert.equal(good.lapses, 0);
});

test("ADR-0008: a slow-correct answer is rated Hard and its interval is capped", () => {
  // This is the failure that is invisible in the healthy-looking direction. A
  // child counting on their fingers is "correct"; scheduling them as though they
  // recalled it is how the intervals get too long to recover from.
  const baseline = { ...NEW_LATENCY_STATS, meanS: fromRatio(8, 1), count: 20 };
  assert.equal(ratingFor(true, 2000, baseline).rating, "easy");
  assert.equal(ratingFor(true, 8000, baseline).rating, "good");
  const slow = ratingFor(true, 30_000, baseline);
  assert.equal(slow.rating, "hard");
  assert.equal(slow.capInterval, true);

  const scheduler = fsrsScheduler();
  const card = scheduler.review(scheduler.create(0), "good", 5, false);
  const previous = card.dueDay - 5;
  const capped = scheduler.review(card, "hard", card.dueDay, true);
  assert.ok(capped.dueDay - card.dueDay <= previous, "the cap let the interval grow");
});

test("intervals are whole days inside a stated range", () => {
  assert.equal(intervalFor(DEFAULT_WEIGHTS, fromRatio(1, 1000)), 1);
  assert.equal(intervalFor(DEFAULT_WEIGHTS, fromRatio(100_000, 1)), MAX_INTERVAL_DAYS);
  const week = intervalFor(DEFAULT_WEIGHTS, fromRatio(7, 1) as Fix);
  assert.equal(week, 7, "at the default retention the interval is the stability");
});
