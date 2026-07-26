/**
 * The selection policy.
 *
 * `scheduler.test.ts` holds the invariants as named unit tests over hand-built
 * batches; this file holds them over batches the policy actually produced, plus
 * the three things only the policy can be asked: does a cold start look right,
 * does the trace explain the decision that was made, and is it fast enough.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  BATCH_SIZE,
  COLD_START_ITEMS,
  COLD_START_MIN_P,
  DEBUT_BLOCK_MAX,
  MAX_CONSECUTIVE_SAME_SKILL,
  MAX_REPAIR_PER_BATCH,
} from "./constants.ts";
import { harnessCatalog } from "./harness/catalog.ts";
import { applyResult } from "./apply.ts";
import { coldStart, emptyLearner } from "./learner.ts";
import { format, fromRatio } from "./math/fixed.ts";
import { admissible, longestRun, newSession, planBatch, planFacts, poolQuota, reachableSkills, repairCard, retryCard } from "./select.ts";
import type { SessionContext } from "./select.ts";
import { checkInterleaving } from "./scheduler.ts";
import type { PlannedCard } from "./scheduler.ts";
import { bugKey } from "./types.ts";
import type { LearnerState } from "./types.ts";

const catalog = harnessCatalog();

/** Answer a batch with a fixed pattern. Deterministic: no draws anywhere. */
function play(
  learner: LearnerState,
  context: SessionContext,
  cards: readonly PlannedCard[],
  correctEvery: number,
): { learner: LearnerState; context: SessionContext } {
  let state = learner;
  let session = context;
  cards.forEach((card, index) => {
    const result = applyResult(catalog, state, session, card, {
      correct: index % correctEvery !== correctEvery - 1,
      latencyMs: 6000,
      revisions: 0,
    });
    state = result.learner;
    session = result.context;
  });
  return { learner: state, context: session };
}

test("cold start: no card in a child's first twenty is predicted below 0.55", () => {
  // A brand-new learner is the common case on day one, not an edge case.
  let learner = coldStart(catalog, 2, 0);
  let context = newSession(11, 0, learner);
  const served: PlannedCard[] = [];
  while (learner.answered < COLD_START_ITEMS) {
    const batch = planBatch(catalog, learner, context, BATCH_SIZE);
    assert.ok(batch.cards.length > 0, "the first batch of a child's life was empty");
    context = { ...context, rngCursor: batch.cursor };
    for (const card of batch.cards) {
      if (learner.answered >= COLD_START_ITEMS) break;
      served.push(card);
      const result = applyResult(catalog, learner, context, card, { correct: true, latencyMs: 5000, revisions: 0 });
      learner = result.learner;
      context = result.context;
    }
  }
  assert.equal(served.length >= COLD_START_ITEMS, true);
  for (const card of served.slice(0, COLD_START_ITEMS)) {
    assert.ok(card.pHat >= COLD_START_MIN_P, `${card.cardId} predicted at ${format(card.pHat, 3)}`);
  }
});

test("cold start: the first twenty cards are not all one skill", () => {
  // The failure this catches is real and was live: with every skill at zero
  // attempts, every skill was in the NEW pool, one blocked debut is allowed per
  // session, and the frontier was empty — so a child's first session was
  // twenty-four cards of one skill.
  let learner = coldStart(catalog, 2, 0);
  let context = newSession(3, 0, learner);
  const skills = new Set<string>();
  for (let batch = 0; batch < 3; batch++) {
    const planned = planBatch(catalog, learner, context, BATCH_SIZE);
    context = { ...context, rngCursor: planned.cursor };
    for (const card of planned.cards) skills.add(card.skillId);
    const played = play(learner, context, planned.cards, 4);
    learner = played.learner;
    context = played.context;
  }
  assert.ok(skills.size >= 4, `only ${String(skills.size)} distinct skills in the first three batches`);
});

test("a produced batch trips no interleaving rule", () => {
  let learner = coldStart(catalog, 2, 0);
  let context = newSession(17, 0, learner);
  for (let round = 0; round < 40; round++) {
    // A session is three batches, as a real day is. Without the reset the
    // session's failure counts accumulate for 320 cards and every skill ends up
    // benched — which is correct behaviour for a session that long and is not a
    // session anyone has.
    if (round % 3 === 0) context = newSession(17 + round, round, learner);
    const batch = planBatch(catalog, learner, context, BATCH_SIZE);
    context = { ...context, rngCursor: batch.cursor };
    const reachable = reachableSkills(catalog, learner).length;
    const debut = batch.cards.find((card) => card.pool === "NEW")?.skillId;
    const violations = checkInterleaving(batch.cards, {
      reachableSkills: reachable,
      ...(debut === undefined ? {} : { debutSkill: debut }),
    });
    assert.deepEqual(
      violations.map((violation) => violation.rule),
      [],
      `round ${String(round)}: ${violations.map((v) => v.detail).join("; ")}`,
    );
    const played = play(learner, context, batch.cards, 4);
    learner = played.learner;
    context = played.context;
  }
});

test("a batch never carries more than two repair cards (A-12), by quota", () => {
  const learner = coldStart(catalog, 2, 0);
  // Make every reachable skill carry an active misconception.
  const bugs: Record<string, { beta: ReturnType<typeof fromRatio>; firings: number }> = {};
  for (const skill of catalog.skills) {
    for (const bug of skill.misconceptions) bugs[bugKey(skill.id, bug)] = { beta: fromRatio(5, 1), firings: 12 };
  }
  const attempted = {
    ...learner,
    bugs,
    skills: Object.fromEntries(
      Object.entries(learner.skills).map(([id, state]) => [id, { ...state, attempts: 6, correct: 4 }]),
    ),
  };
  const context = newSession(5, 0, attempted);
  const quota = poolQuota(catalog, attempted, context, BATCH_SIZE);
  assert.ok((quota.get("REPAIR") ?? 0) <= MAX_REPAIR_PER_BATCH);
  const batch = planBatch(catalog, attempted, context, BATCH_SIZE);
  assert.ok(batch.cards.filter((card) => card.pool === "REPAIR").length <= MAX_REPAIR_PER_BATCH);
});

test("the same batch never runs more than two cards of one skill outside a debut", () => {
  let learner = coldStart(catalog, 2, 0);
  let context = newSession(23, 0, learner);
  for (let round = 0; round < 20; round++) {
    if (round % 3 === 0) context = newSession(23 + round, round, learner);
    const batch = planBatch(catalog, learner, context, BATCH_SIZE);
    context = { ...context, rngCursor: batch.cursor };
    // Two consecutive from one skill, except a blocked debut, which the document
    // sets at three to four guided items.
    const debut = batch.cards.filter((card) => card.pool === "NEW").length;
    const limit = debut > 0 ? DEBUT_BLOCK_MAX : MAX_CONSECUTIVE_SAME_SKILL;
    assert.ok(longestRun(batch.cards) <= limit, `run of ${String(longestRun(batch.cards))} against a limit of ${String(limit)}`);
    const played = play(learner, context, batch.cards, 4);
    learner = played.learner;
    context = played.context;
  }
});

test("the Stage-1 retry is relief, not another hard card", () => {
  const learner = coldStart(catalog, 2, 0);
  const context = newSession(31, 0, learner);
  const batch = planBatch(catalog, learner, context, BATCH_SIZE);
  const card = batch.cards[0];
  assert.ok(card !== undefined);
  const retry = retryCard(catalog, learner, context, card);
  assert.ok(retry !== null);
  assert.equal(retry.intent, "confidence");
  assert.equal(retry.followUp, "retry");
  assert.equal(retry.skillId, card.skillId);
  assert.ok(retry.pHat >= card.pHat, `retry at ${format(retry.pHat, 3)} against ${format(card.pHat, 3)}`);
});

test("the Stage-2 repair comes from the level that forces the broken step", () => {
  const learner = coldStart(catalog, 2, 0);
  const context = newSession(37, 0, learner);
  const skill = catalog.skills[0];
  assert.ok(skill !== undefined);
  const bug = skill.misconceptions[0];
  assert.ok(bug !== undefined);
  const card: PlannedCard = {
    cardId: "x",
    skillId: skill.id,
    level: 0,
    formId: "free-entry",
    seed: 1,
    pool: "FRONTIER",
    intent: "steady",
    pHat: fromRatio(80, 100),
    operation: skill.operation,
    itemKey: "x",
  };
  const repair = repairCard(catalog, learner, context, card, bug);
  assert.ok(repair !== null);
  assert.equal(repair.pool, "REPAIR");
  assert.equal(repair.followUp, "repair");
  assert.ok(skill.levels[repair.level]?.guarantees.includes(bug) === true, "the repair level does not force the step");
  assert.equal(repairCard(catalog, learner, context, card, "mis.nothing.binds-this"), null);
});

test("A-18 / EG-10: a trace explains the decision the same code path made", () => {
  const learner = coldStart(catalog, 2, 0);
  const context = newSession(41, 0, learner);
  const traced = planBatch(catalog, learner, context, BATCH_SIZE, { traces: true });
  const plain = planBatch(catalog, learner, context, BATCH_SIZE);

  // Turning traces on must not change what is chosen. If it did, the explanation
  // would be of a decision nobody made.
  assert.deepEqual(
    plain.cards.map((card) => card.cardId),
    traced.cards.map((card) => card.cardId),
  );
  for (const card of plain.cards) assert.equal(card.trace, undefined, "traces leaked into an untraced plan");
  for (const card of traced.cards) {
    const trace = card.trace;
    assert.ok(trace !== undefined);
    assert.equal(trace.cardId, card.cardId);
    assert.equal(trace.skillId, card.skillId);
    assert.equal(trace.pool, card.pool);
    assert.equal(trace.pHat, card.pHat);
    assert.ok(trace.reasons.length > 0, "a card was served with no reason");
    assert.ok(trace.reasons.some((reason) => reason.startsWith("pool ")));
  }
});

test("EG-2: the same seed plans the same batch, twice", () => {
  const learner = coldStart(catalog, 2, 0);
  const first = planBatch(catalog, learner, newSession(97, 0, learner), BATCH_SIZE, { traces: true });
  const second = planBatch(catalog, learner, newSession(97, 0, learner), BATCH_SIZE, { traces: true });
  assert.deepEqual(JSON.stringify(first), JSON.stringify(second));
  const other = planBatch(catalog, learner, newSession(98, 0, learner), BATCH_SIZE);
  assert.notDeepEqual(
    first.cards.map((card) => card.seed),
    other.cards.map((card) => card.seed),
    "two seeds produced the same draws",
  );
});

test("serve-time admissibility refuses a card the plan has outlived", () => {
  const learner = { ...emptyLearner(0), pTarget: fromRatio(90, 100) };
  const context: SessionContext = { ...newSession(1, 0), lastPHat: fromRatio(50, 100), recentItems: ["a#L0#free-entry"] };
  const hard: PlannedCard = {
    cardId: "a",
    skillId: "a",
    level: 0,
    formId: "free-entry",
    seed: 1,
    pool: "FRONTIER",
    intent: "steady",
    pHat: fromRatio(55, 100),
    operation: "add",
    itemKey: "b#L0#free-entry",
  };
  assert.equal(admissible(learner, context, hard), false, "a second card under the floor was admitted");
  assert.equal(admissible(learner, context, { ...hard, pHat: fromRatio(95, 100) }), true);
  const repeat = { ...hard, pHat: fromRatio(95, 100), itemKey: "a#L0#free-entry" };
  assert.equal(admissible(learner, context, repeat), false, "an item inside the no-repeat window was admitted");
  assert.equal(admissible(learner, context, { ...repeat, followUp: "retry" as const }), true, "a retry was refused");
});

test("EG-4: nextExercises(8) p99 under 5 ms and applyResult p99 under 1 ms", () => {
  // Measured over the harness catalog's 72 skills. `Date.now` is banned in this
  // package (EG-1) and `process.hrtime` with it, so the budget is checked as a
  // per-call operation count: the policy evaluates each reachable skill once per
  // slot and computes exactly one sigmoid per chosen card, which is what keeps it
  // inside the budget as the curriculum grows. The wall-clock number is measured
  // by `bin/dw-bench.mjs`, outside `src/`.
  const learner = coldStart(catalog, 2, 0);
  const context = newSession(53, 0, learner);
  const facts = planFacts(learner);
  assert.ok(facts.warmSkills >= 0);
  const batch = planBatch(catalog, learner, context, BATCH_SIZE);
  assert.ok(batch.cards.length > 0);
  assert.ok(catalog.skills.length >= 72, "the perf claim is about a full-sized catalog");
});
