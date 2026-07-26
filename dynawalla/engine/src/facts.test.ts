import assert from "node:assert/strict";
import test from "node:test";
import { FACT_ELIGIBILITY_PHI } from "./constants.ts";
import { ONE, ZERO, fromInt, fromRatio } from "./math/fixed.ts";
import {
  NEW_LATENCY_STATS,
  isDue,
  isFactEligible,
  latencyToSeconds,
  latencyZ,
  observeLatency,
  ratingFor,
} from "./facts.ts";
import { factKey } from "./types.ts";
import type { FactCard, LatencyStats } from "./types.ts";

function baseline(meanMs: number, count = 20): LatencyStats {
  let stats = NEW_LATENCY_STATS;
  for (let i = 0; i < count; i++) stats = observeLatency(stats, meanMs);
  return stats;
}

test("facts: a card is keyed on the class of item, never on the instance", () => {
  // ADR-0008: generated exercises have no stable id, so a per-item key would mint
  // a new card per instance and degenerate spaced review into random practice.
  assert.equal(factKey("dw.add.regroup.subtract-multidigit", 2, "free-entry"), "skill:dw.add.regroup.subtract-multidigit#L2#free-entry");
  assert.equal(
    factKey("dw.add.regroup.subtract-multidigit", 2, "free-entry"),
    factKey("dw.add.regroup.subtract-multidigit", 2, "free-entry"),
    "two different seeds of the same class share one card",
  );
  assert.notEqual(
    factKey("dw.add.regroup.subtract-multidigit", 2, "free-entry"),
    factKey("dw.add.regroup.subtract-multidigit", 2, "column"),
    "but a different form is a different card",
  );
});

test("facts: latency is tracked in seconds and converted exactly", () => {
  assert.equal(latencyToSeconds(1000), ONE);
  assert.equal(latencyToSeconds(1500), fromRatio(3, 2));
  assert.equal(latencyToSeconds(0), ZERO);
  assert.throws(() => latencyToSeconds(-1), RangeError);
});

test("facts: the latency baseline is the child's own, and it moves toward new evidence", () => {
  const stats = baseline(4000);
  assert.ok(stats.meanS > fromRatio(35, 10) && stats.meanS <= fromInt(4));
  const slower = observeLatency(stats, 20000);
  assert.ok(slower.meanS > stats.meanS);
  assert.ok(slower.varianceS2 > stats.varianceS2, "an outlier widens the spread too");
  assert.equal(observeLatency(NEW_LATENCY_STATS, 3000).count, 1);
});

test("facts: z is zero until there is enough evidence to say anything", () => {
  assert.equal(latencyZ(NEW_LATENCY_STATS, 9000), ZERO);
  assert.equal(latencyZ(observeLatency(NEW_LATENCY_STATS, 3000), 9000), ZERO);
  const stats = baseline(4000, 30);
  const varied = observeLatency(observeLatency(stats, 8000), 2000);
  assert.notEqual(latencyZ(varied, 30000), ZERO);
  assert.ok(latencyZ(varied, 30000) > latencyZ(varied, 4000), "slower is further from the mean");
});

test("facts: the rating is a function of correctness AND latency", () => {
  const stats = baseline(4000);
  assert.deepEqual(ratingFor(false, 1000, stats), { rating: "again", capInterval: true });
  assert.deepEqual(ratingFor(true, 1000, stats), { rating: "easy", capInterval: false });
  assert.deepEqual(ratingFor(true, 4000, stats), { rating: "good", capInterval: false });
  // Slow-correct is Hard, and the interval is capped: a child who is still
  // computing an answer is not recalling it, however right they are.
  assert.deepEqual(ratingFor(true, 30000, stats), { rating: "hard", capInterval: true });
  assert.deepEqual(ratingFor(true, 9000, NEW_LATENCY_STATS), { rating: "good", capInterval: false });
});

test("facts: card creation is gated on fluency, not on correctness", () => {
  assert.equal(isFactEligible(ZERO), false);
  assert.equal(isFactEligible(FACT_ELIGIBILITY_PHI), true);
  assert.equal(isFactEligible(ONE), true);
  assert.equal(isFactEligible(fromRatio(49, 100)), false);
});

test("facts: due dates are whole days, compared without a clock", () => {
  const card: FactCard = { stability: ONE, difficulty: fromInt(5), dueDay: 30, reps: 2, lapses: 0 };
  assert.equal(isDue(card, 29), false);
  assert.equal(isDue(card, 30), true);
  assert.equal(isDue(card, 31), true);
});
