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
import {
  FOLLOW_UP_DRAWS,
  admissible,
  closingCard,
  longestRun,
  newSession,
  planBatch,
  planFacts,
  poolQuota,
  reachableSkills,
  repairCard,
  retryCard,
  withCursor,
} from "./select.ts";
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

test("the policy evaluates a full-sized catalog and returns a full batch", () => {
  // **This is not a latency test and no longer claims to be.** It was named
  // "EG-4: nextExercises(8) p99 under 5 ms and applyResult p99 under 1 ms" and
  // asserted `warmSkills >= 0`, which is unfalsifiable for a count, and never
  // called `applyResult` at all. `Date.now` is banned in this package (EG-1), so
  // the wall clock cannot live here: the budget is measured by `bin/dw-bench.mjs`
  // — which now exists — and that script exits non-zero past it.
  //
  // What is worth asserting here is the shape the budget is claimed against: a
  // seventy-two-skill catalog, and a batch that comes back full rather than short.
  const learner = coldStart(catalog, 2, 0);
  const context = newSession(53, 0, learner);
  assert.ok(catalog.skills.length >= 72, "the perf claim is about a full-sized catalog");
  const batch = planBatch(catalog, learner, context, BATCH_SIZE);
  assert.equal(batch.cards.length, BATCH_SIZE, "a short batch is a slot the policy could not fill");
  assert.equal(planFacts(learner).warmSkills, 0, "a cold learner has no warm skill");
});

test("the draw cursor is the whole of the randomness — a frozen one re-serves one problem per class", () => {
  // The defect this pins was live in the app: `planBatch` returns the advanced
  // cursor and the loop discarded it, so `drawInt(seed, rngCursor + slot)` drew
  // from the same eight values for the whole session. A twenty-four-card session
  // served sixteen distinct exercises, and the no-repeat window saw nothing wrong
  // because the repeat was *inside* the item class, which is what the window
  // compares on.
  const learner = coldStart(catalog, 2, 0);
  const context = newSession(61, 0, learner);

  const frozen = planBatch(catalog, learner, context, BATCH_SIZE);
  const alsoFrozen = planBatch(catalog, learner, context, BATCH_SIZE);
  assert.deepEqual(
    frozen.cards.map((card) => card.seed),
    alsoFrozen.cards.map((card) => card.seed),
    "two batches planned at the same cursor drew differently — the draws are not a function of the cursor",
  );

  const moved = planBatch(catalog, learner, withCursor(context, frozen.cursor), BATCH_SIZE);
  assert.equal(frozen.cursor, context.rngCursor + BATCH_SIZE);
  const before = new Set(frozen.cards.map((card) => card.seed));
  const after = moved.cards.map((card) => card.seed);
  assert.ok(
    after.every((seed) => !before.has(seed)),
    "a batch planned at the advanced cursor re-drew a seed from the previous batch",
  );

  // …and the two injected cards move with it, so two retries in one session are
  // two problems rather than the same one twice.
  const card = frozen.cards[0];
  assert.ok(card !== undefined);
  const first = retryCard(catalog, learner, context, card);
  const second = retryCard(catalog, learner, withCursor(context, context.rngCursor + FOLLOW_UP_DRAWS), card);
  assert.ok(first !== null && second !== null);
  assert.notEqual(first.seed, second.seed, "two retries in a session were the identical problem");
});

test("the closing card is served even when the failed skill is benched", () => {
  // `retryCard` returns null for a benched skill, and a session that ended badly
  // is exactly the session whose last skill has three failures on it — so the
  // loop simply stopped, on the wrong answer, in 8 of 576 smoke sessions. The
  // bench is an allocation rule; the closing card is not an allocation.
  const learner = coldStart(catalog, 2, 0);
  const context = newSession(71, 0, learner);
  const card = planBatch(catalog, learner, context, BATCH_SIZE).cards[0];
  assert.ok(card !== undefined);
  const benched: SessionContext = { ...context, failuresBySkill: { [card.skillId]: 3 } };

  assert.equal(retryCard(catalog, learner, benched, card), null, "the retry was not refused; the test proves nothing");
  const closing = closingCard(catalog, learner, benched, card);
  assert.ok(closing !== null, "a session ended on a failure with no closing card");
  assert.equal(closing.followUp, "close");
  assert.equal(closing.intent, "confidence");
  assert.notEqual(closing.skillId, card.skillId, "the closing card came back from the benched skill");

  // With nothing benched it is the child's own skill, at a confidence difficulty.
  const own = closingCard(catalog, learner, context, card);
  assert.ok(own !== null);
  assert.equal(own.skillId, card.skillId);
});

test("a repair records the bug it repaired, so the batch is not re-planned for it again", () => {
  // `applyResult` recorded `card.skillId` while `replanReasons` reads a bug key
  // (`skill#bug`). The two can never be equal, so the guard was dead: every card
  // of a skill with an active bug reported "a misconception became active and no
  // repair is planned" and threw away a batch that did not need throwing away.
  const skill = catalog.skills.find((candidate) => candidate.misconceptions.length > 0);
  assert.ok(skill !== undefined);
  const bug = skill.misconceptions[0];
  assert.ok(bug !== undefined);
  const level = skill.levels.findIndex((meta) => meta.guarantees.includes(bug));
  assert.ok(level >= 0, "no level of this skill guarantees its own mal-rule");

  let learner = coldStart(catalog, 2, 0);
  const context = newSession(83, 0, learner);
  const card: PlannedCard = {
    cardId: "c",
    skillId: skill.id,
    level,
    formId: "free-entry",
    seed: 1,
    pool: "FRONTIER",
    intent: "steady",
    pHat: fromRatio(70, 100),
    operation: skill.operation,
    itemKey: `${skill.id}#L${String(level)}#free-entry`,
  };

  // Three firings make the misconception active. One per session, because three
  // failures on one skill in one session bench it — and a benched skill has no
  // repair item at all, which is a different rule and not the one under test.
  let session = context;
  for (let i = 0; i < 3; i++) {
    session = newSession(83 + i, i, learner);
    const result = applyResult(catalog, learner, session, card, {
      correct: false,
      latencyMs: 6000,
      revisions: 0,
      misconception: bug,
    });
    learner = result.learner;
    session = newSession(83 + i, i, learner);
  }
  assert.ok(learner.bugs[bugKey(skill.id, bug)] !== undefined);

  const repair = repairCard(catalog, learner, session, card, bug);
  assert.ok(repair !== null);
  assert.equal(repair.repairs, bugKey(skill.id, bug), "the repair did not carry the bug key it targets");

  // `remaining` has to be non-empty for `replanReasons` to say anything at all,
  // and it is the tail this rule is about: more cards of the skill whose bug is
  // active, with no REPAIR among them.
  const reason = "a misconception became active and no repair is planned";
  const before = applyResult(catalog, learner, session, card, { correct: true, latencyMs: 6000, revisions: 0 }, [card]);
  assert.ok(before.replan.includes(reason), "the rule under test did not fire; the assertion below proves nothing");

  const answered = applyResult(catalog, learner, session, repair, { correct: true, latencyMs: 6000, revisions: 0 }, [
    card,
  ]);
  assert.ok(
    answered.context.repairedBugs.includes(bugKey(skill.id, bug)),
    "the repaired bug was recorded under a key nothing reads",
  );
  assert.ok(!answered.replan.includes(reason), "the batch was re-planned for a repair that had just been served");
});
