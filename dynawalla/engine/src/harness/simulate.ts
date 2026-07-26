/**
 * One simulated learner, day by day.
 *
 * The loop here is the *app's* loop, written once so the harness and the real
 * work surface cannot drift: plan a batch, serve it card by card, apply each
 * answer, re-plan the moment the engine says an invariant would trip, insert the
 * Stage-1 retry or the Stage-2 repair a wrong answer earns, and never end a
 * session on a failure.
 *
 * The transcript it returns is the unit every gate reads. It records what the
 * engine predicted **and** the probability the persona actually had, which is the
 * pair EG-5 needs and the only place in the program where both exist.
 */

import { detectFatigue } from "../scheduler.ts";
import type { PlannedCard } from "../scheduler.ts";
import { accuracyPoints, applyResult, withFatigue } from "../apply.ts";
import type { ApplyOptions } from "../apply.ts";
import { preferredForm } from "../catalog.ts";
import type { Catalog } from "../catalog.ts";
import { BATCH_SIZE } from "../constants.ts";
import { coldStart } from "../learner.ts";
import { admissible, newSession, planBatch, reachableSkills, repairAllowed, repairCard, retryCard } from "../select.ts";
import type { SessionContext } from "../select.ts";
import type { Fix } from "../math/fixed.ts";
import type { Day, LearnerState, MasteryLevel, SkillId } from "../types.ts";
import { answerCard, creditSuccess, decayAway, isActiveDay, newChild } from "./persona.ts";
import type { Child, PersonaId, PersonaSpec } from "./persona.ts";
import { PERSONAS } from "./persona.ts";

/** One answered card, as the gates read it. */
export type Step = {
  readonly day: Day;
  readonly index: number;
  readonly skillId: SkillId;
  readonly level: number;
  readonly pool: string;
  readonly intent: string;
  /** What the engine predicted before it saw the answer. */
  readonly pHat: Fix;
  /** What the persona's own model gave. The engine never sees this. */
  readonly truthP: Fix;
  readonly correct: boolean;
  readonly latencyMs: number;
  readonly pTarget: Fix;
  readonly fatigued: boolean;
  readonly bugFired: boolean;
  readonly bugReported: boolean;
  /** "retry" or "repair" for a designed follow-up, else null. */
  readonly followUp: string | null;
  /** Distinct skills the child could have been served at plan time. */
  readonly alternatives: number;
  /** How far the policy relaxed its constraints to find this card. */
  readonly relaxed: number;
  /** Cards this learner had answered in total before this one. */
  readonly lifetime: number;
  /** Attempts the learner had on *this skill* before this card. */
  readonly skillAttempts: number;
  readonly sessionIndex: number;
  readonly cardInSession: number;
};

export type Transcript = {
  readonly persona: PersonaId;
  readonly learnerIndex: number;
  readonly seed: number;
  readonly steps: readonly Step[];
  readonly finalLearner: LearnerState;
  readonly sessions: number;
  readonly activeDays: number;
  /** Skill level at the end, by skill. */
  readonly levels: Readonly<Record<SkillId, MasteryLevel>>;
  /** Batches planned, and how many tripped a re-plan mid-way. */
  readonly batches: number;
  readonly replans: number;
  readonly starvedSlots: number;
};

export type SimOptions = {
  readonly days: number;
  readonly cardsPerSession: number;
  readonly grade: number;
  readonly apply?: ApplyOptions;
  /** Stop early once this many cards have been answered. Used by the EG-3 run. */
  readonly maxCards?: number;
};

export const DEFAULT_SIM: SimOptions = { days: 180, cardsPerSession: 24, grade: 2 };

/**
 * Run one child.
 *
 * `seed` is the whole of the run's randomness. Two calls with the same seed
 * produce byte-identical transcripts, which is what EG-2 asserts and what makes a
 * failing gate reproducible rather than a story about a bad night.
 */
export function simulate(
  catalog: Catalog,
  persona: PersonaId,
  learnerIndex: number,
  seed: number,
  options: SimOptions = DEFAULT_SIM,
): Transcript {
  const spec: PersonaSpec = PERSONAS[persona];
  const child = newChild(spec, seed, catalog);
  let learner = coldStart(catalog, options.grade, 0);
  const steps: Step[] = [];

  let sessions = 0;
  let activeDays = 0;
  let batches = 0;
  let replans = 0;
  let starvedSlots = 0;
  let awaySince = 0;

  for (let day = 0; day < options.days; day++) {
    if (!isActiveDay(spec, day)) {
      awaySince += 1;
      continue;
    }
    if (awaySince > 0) {
      decayAway(child, catalog, awaySince);
      awaySince = 0;
    }
    activeDays += 1;
    learner = { ...learner, today: day };
    const session = runSession(catalog, child, learner, day, sessions, options, steps);
    learner = session.learner;
    sessions += 1;
    batches += session.batches;
    replans += session.replans;
    starvedSlots += session.starvedSlots;
    if (options.maxCards !== undefined && steps.length >= options.maxCards) break;
  }

  const levels: Record<SkillId, MasteryLevel> = {};
  for (const [id, state] of Object.entries(learner.skills)) levels[id] = state.level;

  return {
    persona,
    learnerIndex,
    seed,
    steps,
    finalLearner: learner,
    sessions,
    activeDays,
    levels,
    batches,
    replans,
    starvedSlots,
  };
}

type SessionResult = {
  readonly learner: LearnerState;
  readonly batches: number;
  readonly replans: number;
  readonly starvedSlots: number;
};

function runSession(
  catalog: Catalog,
  child: Child,
  start: LearnerState,
  day: Day,
  sessionIndex: number,
  options: SimOptions,
  steps: Step[],
): SessionResult {
  let learner = start;
  let context: SessionContext = newSession(mixSeed(child.seed, day), day, start);
  let batches = 0;
  let replans = 0;
  let starvedSlots = 0;
  let elapsedMs = 0;
  let served = 0;
  /** Forced follow-ups — the retry a Stage-1 error earns, or a repair item. */
  const forced: PlannedCard[] = [];
  /** Pools of the cards actually served, for the repair-density cap. */
  const servedPools: string[] = [];

  // A hard ceiling on planning attempts. Dropping an inadmissible card can, in
  // principle, drop every card of a batch — and then the loop re-plans, drops it
  // again, and the session never ends. A bound turns that into a short session
  // and a visible `starvedSlots`, which is a bug report rather than a hang.
  const maxBatches = Math.max(8, options.cardsPerSession);
  while (served < options.cardsPerSession && batches < maxBatches) {
    // Always plan a whole batch of eight, even when fewer cards are wanted. A
    // batch of one or two cannot hold a confidence card at each end *and* a
    // stretch item, and `batchIntents` says so by throwing — asking for a short
    // batch is the caller's error, not something for the controller to paper
    // over. The unserved tail is discarded, which is what a re-plan does anyway.
    const batch = planBatch(catalog, learner, context, BATCH_SIZE, {
      last: served + BATCH_SIZE >= options.cardsPerSession,
    });
    batches += 1;
    context = { ...context, rngCursor: batch.cursor };
    if (batch.cards.length === 0) break;
    starvedSlots += BATCH_SIZE - batch.cards.length;

    let index = 0;
    while (index < batch.cards.length && served < options.cardsPerSession) {
      const forcedCard = forced.shift();
      const card = forcedCard ?? batch.cards[index];
      if (card === undefined) break;
      if (forcedCard === undefined) index += 1;
      // The plan is eight cards old by the time its tail is served. A card that
      // no longer satisfies a sequence rule is dropped rather than served.
      if (!admissible(learner, context, card, servedPools)) {
        starvedSlots += 1;
        continue;
      }

      const skill = catalog.byId.get(card.skillId);
      const level = skill?.levels[card.level];
      if (skill === undefined || level === undefined) break;
      const form = level.forms.find((entry) => entry.id === card.formId) ?? preferredForm(level);

      const minutes = Math.floor(elapsedMs / 60_000);
      const answer = answerCard(child, catalog, card, form.guessFloor, minutes);
      elapsedMs += answer.latencyMs;
      served += 1;

      servedPools.push(card.pool);
      const remaining = batch.cards.slice(index);
      const result = applyResult(
        catalog,
        learner,
        context,
        card,
        {
          correct: answer.correct,
          latencyMs: answer.latencyMs,
          revisions: answer.revisions,
          ...(answer.misconception === undefined ? {} : { misconception: answer.misconception }),
        },
        remaining,
        options.apply ?? {},
      );

      steps.push({
        day,
        index: steps.length,
        skillId: card.skillId,
        level: card.level,
        pool: card.pool,
        intent: card.intent,
        pHat: card.pHat,
        truthP: answer.truthP,
        correct: answer.correct,
        latencyMs: answer.latencyMs,
        pTarget: learner.pTarget,
        fatigued: context.fatigued,
        bugFired: answer.misconception !== undefined,
        bugReported: result.bugBecameActive,
        followUp: card.followUp ?? null,
        alternatives: reachableSkills(catalog, learner).length,
        relaxed: card.relaxed ?? 0,
        lifetime: learner.answered,
        skillAttempts: learner.skills[card.skillId]?.attempts ?? 0,
        sessionIndex,
        cardInSession: served,
      });

      learner = result.learner;
      context = result.context;
      if (answer.correct) creditSuccess(child, skill, day);

      // The corrective model, as the app runs it: a wrong answer earns a Stage-1
      // retry, or a repair item once the misconception is active.
      if (!answer.correct) {
        const repair =
          result.bugBecameActive && answer.misconception !== undefined && repairAllowed(servedPools)
            ? repairCard(catalog, learner, context, card, answer.misconception)
            : null;
        const follow = repair ?? retryCard(catalog, learner, context, card);
        if (follow !== null && forced.length === 0) forced.push(follow);
      }

      // Fatigue is decided from the same two signals a real detector would have.
      const third = Math.max(1, Math.floor(context.outcomes.length / 3));
      const fatigued = detectFatigue({
        latencyRising: answer.latencyMs > Math.floor((child.spec.baseLatencyMs * 3) / 2),
        accuracyNowPoints: accuracyPoints(context.outcomes, context.outcomes.length - third, context.outcomes.length),
        accuracyFirstThirdPoints: accuracyPoints(context.outcomes, 0, third),
        minutesElapsed: minutes,
        personalSessionMinutes: personalMinutes(learner),
      });
      context = withFatigue(context, fatigued);

      if (result.replan.length > 0) {
        replans += 1;
        break;
      }
    }
  }

  // Never end a session on a failure. The last card is a confidence card at the
  // easiest thing the child can currently do, and it is served rather than the
  // session simply stopping.
  const lastOutcome = context.outcomes[context.outcomes.length - 1];
  const lastStep = steps[steps.length - 1];
  if (lastOutcome === false && lastStep !== undefined) {
    const closing = retryCard(catalog, learner, context, {
      cardId: "closing",
      skillId: lastStep.skillId,
      level: lastStep.level,
      formId: "free-entry",
      seed: 0,
      pool: "FRONTIER",
      intent: "confidence",
      pHat: lastStep.pHat,
      operation: "close",
      itemKey: `${lastStep.skillId}#close`,
    });
    if (closing !== null) {
      const skill = catalog.byId.get(closing.skillId);
      const level = skill?.levels[closing.level];
      if (skill !== undefined && level !== undefined) {
        const form = preferredForm(level);
        const answer = answerCard(child, catalog, closing, form.guessFloor, Math.floor(elapsedMs / 60_000));
        const result = applyResult(catalog, learner, context, closing, {
          correct: answer.correct,
          latencyMs: answer.latencyMs,
          revisions: answer.revisions,
        });
        steps.push({
          day,
          index: steps.length,
          skillId: closing.skillId,
          level: closing.level,
          pool: closing.pool,
          intent: "confidence",
          pHat: closing.pHat,
          truthP: answer.truthP,
          correct: answer.correct,
          latencyMs: answer.latencyMs,
          pTarget: learner.pTarget,
          fatigued: context.fatigued,
          bugFired: answer.misconception !== undefined,
          bugReported: result.bugBecameActive,
          followUp: "close",
          alternatives: reachableSkills(catalog, learner).length,
          relaxed: closing.relaxed ?? 0,
          lifetime: learner.answered,
          skillAttempts: learner.skills[closing.skillId]?.attempts ?? 0,
          sessionIndex,
          cardInSession: served + 1,
        });
        learner = result.learner;
        context = result.context;
      }
    }
  }

  return { learner, batches, replans, starvedSlots };
}

/**
 * The child's own typical session length, from their rollups.
 *
 * A constant was wrong in a way that silenced the whole fatigue mechanism: the
 * harness's latency model gives a 24-card session of about three minutes, so a
 * hard-coded twelve-minute baseline meant the "minutes past the child's personal
 * EWMA" indicator never fired, only one indicator was ever available, and
 * `detectFatigue` needs two. The pilot reported zero fatigued cards for the
 * fatiguer persona — the gate caught a dead mechanism, which is what it is for.
 */
function personalMinutes(learner: LearnerState): number {
  const recent = learner.rollups.slice(-14);
  if (recent.length === 0) return 3;
  const seconds = recent.reduce((total, day) => total + day.seconds, 0);
  return Math.max(1, Math.round(seconds / (60 * recent.length)));
}

/** A per-day stream seed, so two days of one child do not share draws. */
function mixSeed(seed: number, day: Day): number {
  return (Math.imul(seed ^ (day + 1), 0x9e3779b1) >>> 0) >>> 0;
}
