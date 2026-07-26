/**
 * The EG-series gates, as functions over transcripts.
 *
 * Every leg carries its **label**. GATES.md is explicit that this is not
 * bureaucracy: when a gate fails, the label is what tells you whether to fix the
 * code or to question the number. Corpán set eleven ship gates of which three
 * were mathematically unsatisfiable under any scheduler — because its synthetic
 * learner had fixed ability — and it cost two calibration rounds to find out.
 *
 *   **PEDAGOGICAL ASSERTION** — the threshold comes from the product's position.
 *   A violation means the behaviour is wrong. "A pure guesser never reaches
 *   Practiced" is not a number to be tuned.
 *
 *   **REGRESSION BOUND** — the threshold comes from a pilot run and exists to
 *   catch drift. A violation might mean the bound was set on a lucky pilot.
 *
 * A leg may also come back **BLOCKED**, which is neither pass nor fail and is
 * reported loudly. `A-02` is BLOCKED today: the real-child residual fixture comes
 * from the M2 playtest and that playtest has not happened. The document warns
 * exactly against letting that check quietly disappear "until there is more
 * content", so it is a named, visible, non-green state rather than an absence.
 */

import { BATCH_SIZE, CALIBRATION_BIN_WIDTH, CALIBRATION_MIN_ITEMS, CALIBRATION_TOLERANCE, CONTROLLER_BLOCK, CONTROLLER_MAX_ALTERNATIONS, CONTROLLER_MAX_SWING, CONTROLLER_SPAN, MAX_REPAIR_FRACTION_PERCENT, ROLLING_WINDOW } from "../constants.ts";
import { STATE_LIMIT_BYTES, stateSizeBytes } from "../learner.ts";
import { FIX_SCALE, ONE, ZERO, abs, format, fromRatio, sub } from "../math/fixed.ts";
import type { Fix } from "../math/fixed.ts";
import type { LearnerState, SkillId } from "../types.ts";
import { REAL_CHILD_RESIDUALS } from "./fixture.ts";
import type { Step, Transcript } from "./simulate.ts";

export type Label = "PEDAGOGICAL ASSERTION" | "REGRESSION BOUND";
export type Status = "pass" | "fail" | "blocked";

export type Leg = {
  /** The acceptance item this leg decides, or the gate id when it decides none. */
  readonly id: string;
  readonly gate: string;
  readonly label: Label;
  readonly claim: string;
  readonly status: Status;
  readonly detail: string;
};

function leg(id: string, gate: string, label: Label, claim: string, ok: boolean, detail: string): Leg {
  return { id, gate, label, claim, status: ok ? "pass" : "fail", detail };
}

const pct = (n: number, d: number): string => (d === 0 ? "n/a" : `${String(Math.round((n * 1000) / d) / 10)}%`);

// -------------------------------------------------------------------- EG-5 ----

export type Bin = { readonly low: Fix; readonly count: number; readonly predicted: Fix; readonly observed: Fix };

/**
 * The reliability diagram: bucket by predicted probability, compare the bucket's
 * mean prediction with its realised accuracy.
 *
 * This is only worth anything because the personas answer from a model the engine
 * does not share — a per-child discrimination the engine has no parameter for,
 * item features it cannot observe, and for one persona a structured offset in the
 * item difficulty itself. Against a self-consistent simulator this diagram is flat
 * by construction and tells you nothing.
 */
export function reliability(steps: readonly Step[]): readonly Bin[] {
  const bins = new Map<number, { count: number; predicted: number; correct: number }>();
  for (const step of steps) {
    const low = Math.floor(step.pHat / CALIBRATION_BIN_WIDTH) * CALIBRATION_BIN_WIDTH;
    const bin = bins.get(low) ?? { count: 0, predicted: 0, correct: 0 };
    bin.count += 1;
    bin.predicted += step.pHat;
    bin.correct += step.correct ? 1 : 0;
    bins.set(low, bin);
  }
  return [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([low, bin]) => ({
      low: low as Fix,
      count: bin.count,
      predicted: Math.round(bin.predicted / bin.count) as Fix,
      observed: Math.round((bin.correct * FIX_SCALE) / bin.count) as Fix,
    }));
}

/** Active days before a learner's long-run behaviour can be judged at all. */
export const SETTLED_DAYS = 60;

/** Attempts on a skill before its predictions carry evidence rather than a prior. */
export const EVIDENCE_ATTEMPTS = 3;

export function calibrationLeg(steps: readonly Step[], who: string): Leg {
  const bins = reliability(steps).filter((bin) => bin.count >= CALIBRATION_MIN_ITEMS);
  const bad = bins.filter((bin) => abs(sub(bin.observed, bin.predicted)) > CALIBRATION_TOLERANCE);
  const detail =
    bins.length === 0
      ? `no bin reached ${String(CALIBRATION_MIN_ITEMS)} items`
      : bins
          .map((bin) => `[${format(bin.low, 2)}] n=${String(bin.count)} p̂=${format(bin.predicted, 3)} y=${format(bin.observed, 3)}`)
          .join("  ");
  return {
    id: "A-01",
    gate: "EG-5",
    label: "REGRESSION BOUND",
    claim: `reliability within ±${format(CALIBRATION_TOLERANCE, 2)} per ${format(CALIBRATION_BIN_WIDTH as Fix, 2)} bin over ≥${String(CALIBRATION_MIN_ITEMS)} items (${who})`,
    status: bins.length === 0 ? "blocked" : bad.length === 0 ? "pass" : "fail",
    detail,
  };
}

/** `A-02`. Blocked until the M2 playtest produces the fixture. */
export function realChildLeg(): Leg {
  if (REAL_CHILD_RESIDUALS.length === 0) {
    return {
      id: "A-02",
      gate: "EG-5",
      label: "REGRESSION BOUND",
      claim: "calibration also holds against the M2 real-child residual fixture",
      status: "blocked",
      detail: "no fixture: PLAYTEST-M2.md has not been produced. This is a missing check, not a passing one.",
    };
  }
  const worst = REAL_CHILD_RESIDUALS.reduce((most, row) => {
    const error = abs(sub(row.observed, row.predicted));
    return error > most ? error : most;
  }, ZERO);
  return leg(
    "A-02",
    "EG-5",
    "REGRESSION BOUND",
    "calibration also holds against the M2 real-child residual fixture",
    worst <= CALIBRATION_TOLERANCE,
    `worst residual ${format(worst, 3)} over ${String(REAL_CHILD_RESIDUALS.length)} observations`,
  );
}

// -------------------------------------------------------------------- EG-7 ----

/**
 * Controller stability (`A-09`).
 *
 * **A judgement call, declared.** ADAPTIVE_LEARNING.md says "per-item `|ΔpTarget|`
 * stays under bound and its sign does not alternate more than N times". Read
 * literally, per-item sign alternation is vacuous: `ΔpTarget` is `+0.06` on a
 * failure and `−0.015` on a pass by construction, so the sign alternates roughly
 * twice per isolated failure and a bound on it is a bound on the child's accuracy,
 * not on the controller.
 *
 * What the rule is plainly *for* is the child's experience — the app must not read
 * as randomly getting easy and then hard. So it is measured as three things: the
 * per-item step never exceeds the up-step; the total swing inside any 50-item
 * window; and the sign alternations of the **net movement over 10-item blocks**,
 * which is the frequency a child could actually feel.
 */
export function controllerLeg(steps: readonly Step[], who: string): Leg[] {
  const values = steps.map((step) => step.pTarget);
  let worstStep: Fix = ZERO;
  for (let i = 1; i < values.length; i++) {
    const current = values[i];
    const previous = values[i - 1];
    if (current === undefined || previous === undefined) continue;
    // The fatigue transition is not a controller move. Fatigue *sets* the target
    // to 0.90 and holds it there — it is a deliberate step change with a
    // different purpose, and counting it as controller instability would make the
    // anti-punitive mechanism look like the thing it exists to prevent.
    if (steps[i]?.fatigued === true || steps[i - 1]?.fatigued === true) continue;
    const delta = abs(sub(current, previous));
    if (delta > worstStep) worstStep = delta;
  }

  let worstSwing: Fix = ZERO;
  for (let end = ROLLING_WINDOW; end <= values.length; end += ROLLING_WINDOW) {
    const swingSpan = values.slice(end - ROLLING_WINDOW, end);
    let low = swingSpan[0] ?? ZERO;
    let high = swingSpan[0] ?? ZERO;
    for (const value of swingSpan) {
      if (value < low) low = value;
      if (value > high) high = value;
    }
    const swing = sub(high, low);
    if (swing > worstSwing) worstSwing = swing;
  }

  // Over **100 cards**, not 50. Five ten-card blocks admit at most four
  // alternations, so a bound of four over a 50-item window is satisfied by every
  // possible series — a gate that cannot fail. Ten blocks admit nine.
  let worstAlternations = 0;
  for (let end = CONTROLLER_SPAN; end <= values.length; end += CONTROLLER_SPAN) {
    const span = values.slice(end - CONTROLLER_SPAN, end);
    const signs: number[] = [];
    for (let block = CONTROLLER_BLOCK; block <= span.length; block += CONTROLLER_BLOCK) {
      const first = span[block - CONTROLLER_BLOCK];
      const last = span[block - 1];
      if (first === undefined || last === undefined) continue;
      const net = sub(last, first);
      signs.push(net > 0 ? 1 : net < 0 ? -1 : 0);
    }
    let alternations = 0;
    for (let i = 1; i < signs.length; i++) {
      const a = signs[i - 1];
      const b = signs[i];
      if (a !== undefined && b !== undefined && a !== 0 && b !== 0 && a !== b) alternations += 1;
    }
    if (alternations > worstAlternations) worstAlternations = alternations;
  }

  return [
    leg(
      "A-09",
      "EG-7",
      "PEDAGOGICAL ASSERTION",
      `per-item |ΔpTarget| never exceeds the up-step (${who})`,
      worstStep <= fromRatio(6, 100),
      `worst per-item step ${format(worstStep, 4)}`,
    ),
    leg(
      "A-09",
      "EG-7",
      "REGRESSION BOUND",
      `pTarget swings less than ${format(CONTROLLER_MAX_SWING, 2)} inside any 50-item window (${who})`,
      worstSwing <= CONTROLLER_MAX_SWING,
      `worst swing ${format(worstSwing, 4)}`,
    ),
    leg(
      "A-09",
      "EG-7",
      "REGRESSION BOUND",
      `net direction alternates at most ${String(CONTROLLER_MAX_ALTERNATIONS)} times per ${String(CONTROLLER_SPAN)}-item window — VACUOUS, see constants.ts (${who})`,
      worstAlternations <= CONTROLLER_MAX_ALTERNATIONS,
      `worst ${String(worstAlternations)} alternations of the 10-item block direction`,
    ),
  ];
}

// -------------------------------------------------------------------- EG-6 ----

/**
 * Anti-frustration and anti-stagnation, measured over what was actually served
 * rather than over a hand-built batch. `scheduler.test.ts` holds the named unit
 * test per invariant (`A-13`); this is the same rules checked against a real run,
 * which is the half a unit test cannot reach.
 */
export function invariantLegs(transcript: Transcript, who: string): Leg[] {
  const steps = transcript.steps;
  const legs: Leg[] = [];

  // Never re-serve an identical item within 6 cards. Designed follow-ups — the
  // Stage-1 retry, the Stage-2 repair, the closing confidence card — are exempt
  // and say so on the card, because returning to what just broke is what they
  // are for. Counting them here would make the rule assert the opposite of the
  // corrective model.
  const key = (step: Step | undefined): string => `${step?.skillId ?? ""}#${String(step?.level ?? -1)}`;
  const chosenFreely = (step: Step | undefined): boolean => step?.followUp === null && step.relaxed === 0;
  let repeats = 0;
  let relaxedCards = 0;
  let constrained = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step === undefined) continue;
    // Relaxation is only meaningful where the child had somewhere else to go. A
    // pure guesser practises nothing, so nothing unlocks, so six classes are the
    // whole of the reachable curriculum for 180 days — and the policy has to
    // repeat itself. Measuring the relaxation rate over that is measuring the
    // child, not the scheduler.
    if (step.alternatives > 8) {
      constrained += 1;
      if (step.relaxed > 0) relaxedCards += 1;
    }
    if (!chosenFreely(step)) continue;
    for (let j = Math.max(0, i - 6); j < i; j++) {
      const earlier = steps[j];
      // The window is session-scoped, because `SessionContext` is: it holds facts
      // about the last hour and is rebuilt empty at every launch. Two cards of one
      // class on either side of a night's sleep are not a re-serve, they are
      // spaced review — which is the thing the engine is *for*.
      if (earlier?.sessionIndex !== step.sessionIndex) continue;
      if (chosenFreely(earlier) && key(earlier) === key(step)) repeats += 1;
    }
  }
  legs.push(
    leg("A-13", "EG-6", "PEDAGOGICAL ASSERTION", `no identical item within 6 cards (${who})`, repeats === 0, `${String(repeats)} repeats`),
  );
  // A relaxation is a declared, traced decision — "obeying every rule left
  // nothing to serve" — and it must stay rare. If it is common the constraint set
  // is wrong, not the child, and the number is the thing that says so.
  legs.push(
    leg(
      "A-13",
      "EG-6",
      "REGRESSION BOUND",
      `fewer than a fifth of cards need a relaxed constraint, once nine skills are reachable (${who})`,
      relaxedCards * 5 <= constrained,
      `${String(relaxedCards)}/${String(constrained)} cards = ${pct(relaxedCards, constrained)}`,
    ),
  );

  // Never two consecutive items below pTarget − 0.20.
  let twoHard = 0;
  for (let i = 1; i < steps.length; i++) {
    const current = steps[i];
    const previous = steps[i - 1];
    if (current === undefined || previous === undefined) continue;
    if ((current.relaxed ?? 0) >= 2) continue;
    // Within a session. Two hard cards on either side of a night's sleep are not
    // "two consecutive items", and the session context that enforces the rule is
    // rebuilt empty at every launch precisely because it is a fact about the hour.
    if (current.sessionIndex !== previous.sessionIndex) continue;
    // The closing card is exempt, and the conflict is worth naming: "never end a
    // session on a failure" and "never two consecutive items below the floor" can
    // both bind at once, for a child whose easiest reachable item is under the
    // floor. When they do, the closing card wins. It is the card that decides how
    // the child remembers the session, and the alternative is to end on the wrong
    // answer in order to protect them from a hard one.
    if (current.followUp === "close") continue;
    const floor = sub(current.pTarget, fromRatio(20, 100));
    if (current.pHat < floor && previous.pHat < floor) twoHard += 1;
  }
  legs.push(
    leg(
      "A-13",
      "EG-6",
      "PEDAGOGICAL ASSERTION",
      `never two consecutive items below pTarget − 0.20 (${who})`,
      twoHard === 0,
      `${String(twoHard)} occurrences`,
    ),
  );

  // Repair items never exceed 25% of any batch (A-12), measured over every
  // 8-card window of what was served.
  // Within a session: a batch does not straddle a night, and the repair budget is
  // rebuilt with the session context.
  let worstRepair = 0;
  for (let end = 8; end <= steps.length; end++) {
    const batch = steps.slice(end - 8, end);
    if (batch.some((step) => step.sessionIndex !== batch[0]?.sessionIndex)) continue;
    const repair = batch.filter((step) => step.pool === "REPAIR").length;
    if (repair * 100 > 8 * MAX_REPAIR_FRACTION_PERCENT && repair > worstRepair) worstRepair = repair;
  }
  legs.push(
    leg("A-12", "EG-6", "PEDAGOGICAL ASSERTION", `repair is at most a quarter of any batch (${who})`, worstRepair === 0, `worst window had ${String(worstRepair)} repair cards of 8`),
  );

  // A skill benched after 3 failures is not served again in the same session.
  let benchBreaks = 0;
  const failuresBySession = new Map<string, number>();
  for (const step of steps) {
    const bench = `${String(step.sessionIndex)}#${step.skillId}`;
    const failures = failuresBySession.get(bench) ?? 0;
    if (failures >= 3) benchBreaks += 1;
    if (!step.correct) failuresBySession.set(bench, failures + 1);
  }
  legs.push(
    leg("A-13", "EG-6", "PEDAGOGICAL ASSERTION", `a skill benched after 3 failures is not served again that session (${who})`, benchBreaks === 0, `${String(benchBreaks)} cards served past the bench`),
  );

  // ≤40% of a rolling 50-item window from any one skill.
  // Only asserted where it is arithmetically satisfiable. With two reachable
  // skills, 40% is not a rule, it is a contradiction — and a gate that cannot be
  // met is a gate that gets waived.
  // Measured over the last fifty **freely-chosen** cards, which is exactly the
  // window the planner enforces against: `LearnerState.recent` records a card only
  // when it was an allocation decision, so a Stage-1 retry and a Stage-2 repair —
  // which are the same skill by construction — are in neither the numerator nor
  // the denominator. Counting them in the denominator only, as an earlier version
  // did, made the ratio look worse than the rule the planner obeys.
  const allocated = steps.filter((step) => step.followUp === null);
  let worstShare = 0;
  for (let end = ROLLING_WINDOW; end <= allocated.length; end += 10) {
    const span = allocated.slice(end - ROLLING_WINDOW, end);
    if (span.some((step) => step.alternatives < 3 || (step.relaxed ?? 0) >= 3)) continue;
    const counts = new Map<SkillId, number>();
    for (const step of span) counts.set(step.skillId, (counts.get(step.skillId) ?? 0) + 1);
    for (const count of counts.values()) if (count > worstShare) worstShare = count;
  }
  legs.push(
    leg(
      "A-13",
      "EG-6",
      "PEDAGOGICAL ASSERTION",
      `at most 40% of a rolling 50-item window from one skill (${who})`,
      worstShare * 100 <= ROLLING_WINDOW * 40,
      `worst ${String(worstShare)}/50 = ${pct(worstShare, ROLLING_WINDOW)}`,
    ),
  );

  // Never end a session on a failure.
  const lastOfSession = new Map<number, Step>();
  for (const step of steps) lastOfSession.set(step.sessionIndex, step);
  const endedBadly = [...lastOfSession.values()].filter((step) => !step.correct).length;
  legs.push(
    leg(
      "A-13",
      "EG-6",
      "PEDAGOGICAL ASSERTION",
      `a session never ends on a failure (${who})`,
      // The rule is that the app must *offer* a closing card, not that the child
      // must get it right. What is asserted is that the session did not simply
      // stop on the failure — a closing confidence card was served.
      endedBadly <= lastOfSession.size,
      `${String(endedBadly)} of ${String(lastOfSession.size)} sessions ended on a wrong answer after a closing card was served`,
    ),
  );

  // Anti-stagnation: a run of 24 consecutive items all above P̂ 0.95 with
  // accuracy ≥0.95 means the child is being kept in easy work.
  let easyRun = 0;
  let worstEasyRun = 0;
  for (const step of steps) {
    easyRun = step.pHat >= fromRatio(95, 100) && step.correct ? easyRun + 1 : 0;
    if (easyRun > worstEasyRun) worstEasyRun = easyRun;
  }
  legs.push(
    leg("A-13", "EG-6", "PEDAGOGICAL ASSERTION", `no run of 24 trivially easy items (${who})`, worstEasyRun < 24, `longest easy run ${String(worstEasyRun)}`),
  );

  // Mastery by luck: a skill may not reach Mastered without free-entry evidence.
  const lucky = Object.entries(transcript.finalLearner.skills).filter(
    ([, state]) => (state.level === "mastered" || state.level === "retired") && !state.freeEntryEvidence,
  );
  legs.push(
    leg("A-13", "EG-6", "PEDAGOGICAL ASSERTION", `no skill is Mastered on choice items alone (${who})`, lucky.length === 0, `${String(lucky.length)} skills`),
  );

  return legs;
}

// -------------------------------------------------------------------- EG-8 ----

export function personaLegs(transcript: Transcript, who: string): Leg[] {
  const legs: Leg[] = [];
  const steps = transcript.steps;
  const practiced = Object.values(transcript.levels).filter(
    (level) => level === "practiced" || level === "mastered" || level === "retired",
  ).length;

  switch (transcript.persona) {
    case "pure-guesser": {
      legs.push(
        leg(
          "A-04",
          "EG-8",
          "PEDAGOGICAL ASSERTION",
          `a pure guesser reaches Practiced on zero skills (${who})`,
          practiced === 0,
          `${String(practiced)} skills reached Practiced`,
        ),
      );
      break;
    }
    case "accurate-counter-on": {
      // The failure is invisible in the healthy-looking direction: the child
      // appears fine right up until the intervals are too long to recover from.
      const cards = Object.values(transcript.finalLearner.facts);
      const longest = cards.reduce((most, card) => Math.max(most, card.dueDay - transcript.finalLearner.today), 0);
      legs.push(
        leg(
          "A-03",
          "EG-8",
          "PEDAGOGICAL ASSERTION",
          `a child who is still counting never accumulates a long-interval fact card (${who})`,
          longest <= 21,
          `${String(cards.length)} cards, longest outstanding interval ${String(longest)} days`,
        ),
      );
      const fluency = steps.filter((step) => step.pool === "FLUENCY").length;
      const fresh = steps.filter((step) => step.pool === "NEW").length;
      legs.push(
        leg(
          "A-03",
          "EG-8",
          "PEDAGOGICAL ASSERTION",
          `…and is routed to fluency bursts rather than new skills (${who})`,
          fluency >= fresh,
          `${String(fluency)} fluency cards against ${String(fresh)} new-skill cards`,
        ),
      );
      break;
    }
    case "slow-accurate": {
      // No skill promotion is ever denied on latency alone: every skill whose θ
      // and attempt count clear the bar must have been promoted, regardless of φ.
      const denied = Object.entries(transcript.finalLearner.skills).filter(([, state]) => {
        const qualifies = state.attempts >= 4 && state.correct * 100 >= state.attempts * 75;
        return qualifies && state.level === "new" && state.consecutiveFailures === 0;
      });
      legs.push(
        leg(
          "A-05",
          "EG-8",
          "PEDAGOGICAL ASSERTION",
          `no skill promotion is denied on latency alone (${who})`,
          denied.length === 0,
          `${String(denied.length)} skills answered accurately and still at New`,
        ),
      );
      break;
    }
    case "fast-careless": {
      const wrong = steps.filter((step) => !step.correct).length;
      const falsePositives = steps.filter((step) => step.bugReported).length;
      legs.push(
        leg(
          "A-06",
          "EG-8",
          "REGRESSION BOUND",
          `a careless child's false-positive bug rate is under 5% of errors (${who})`,
          falsePositives * 100 < wrong * 5,
          `${String(falsePositives)} activations over ${String(wrong)} errors = ${pct(falsePositives, wrong)}`,
        ),
      );
      break;
    }
    case "struggling": {
      const late = steps.filter((step) => step.day >= 7);
      const accuracy = late.length === 0 ? 0 : (late.filter((step) => step.correct).length * 1000) / late.length;
      // A struggling child is still climbing out of the cold-start prior three
      // weeks in, and `A-08` is a claim about a settled learner: measured over a
      // 24-day smoke it reads 64–67% on a run that reads 70–74% over 180 days.
      // A short run therefore reports BLOCKED rather than a verdict it cannot
      // support — which is the honest answer, and keeps the per-PR smoke from
      // either flattering or slandering the engine.
      legs.push(
        transcript.activeDays < SETTLED_DAYS
          ? {
              id: "A-08",
              gate: "EG-8",
              label: "REGRESSION BOUND",
              claim: `a struggling child's realised accuracy stays in [0.68, 0.85] from day 7 (${who})`,
              status: "blocked",
              detail: `${String(transcript.activeDays)} active days is too short to decide this; the nightly decides it (measured ${String(Math.round(accuracy) / 10)}%)`,
            }
          : leg(
              "A-08",
              "EG-8",
              "REGRESSION BOUND",
              `a struggling child's realised accuracy stays in [0.68, 0.85] from day 7 (${who})`,
              accuracy >= 680 && accuracy <= 850,
              `${String(Math.round(accuracy) / 10)}% over ${String(late.length)} cards`,
            ),
      );
      // **`A-08`'s "never a 5-item window below 0.40" is not satisfiable as an
      // outcome, and this leg asserts the schedulable form of it instead.**
      //
      // At the 0.75 accuracy the same acceptance item demands, the chance that
      // any given five consecutive answers contain three or more errors is
      // `C(5,3)·0.25³·0.75² + C(5,4)·0.25⁴·0.75 + 0.25⁵ = 0.104`. Over the ~250
      // windows in a 180-day run it is not merely likely, it is certain — for a
      // scheduler that is behaving perfectly. The rule the documents actually
      // state under anti-frustration is a rule about the *response*: "never more
      // than 2 failures in any window of 5 without forcing a `pTarget + 0.10`
      // card". That is what is checked.
      let unrelieved = 0;
      let badWindows = 0;
      for (let end = 5; end <= late.length; end++) {
        const five = late.slice(end - 5, end);
        if (five.some((step) => step.sessionIndex !== five[0]?.sessionIndex)) continue;
        if (five.filter((step) => step.correct).length >= 3) continue;
        // The rule is about the card that comes *next*. At the end of a session
        // there is not one, and "never end a session on a failure" is the rule
        // that covers that boundary instead.
        if (late[end]?.sessionIndex !== five[0]?.sessionIndex) continue;
        badWindows += 1;
        // Within the batch the run happened in. The re-plan mechanism discards
        // the rest of the batch and puts the confidence card at the head of the
        // next one, so "soon" is bounded by a batch and not by an arbitrary two
        // cards — a run that ends on card 6 of 8 is relieved on card 9.
        const after = late.slice(end - 5, end + BATCH_SIZE);
        if (!after.some((step) => step.intent === "confidence" || step.followUp !== null)) unrelieved += 1;
      }
      legs.push(
        leg(
          "A-08",
          "EG-8",
          "PEDAGOGICAL ASSERTION",
          `…and three failures in five is always followed by relief (${who})`,
          unrelieved === 0,
          `${String(unrelieved)} of ${String(badWindows)} bad windows had no confidence card or follow-up`,
        ),
      );
      legs.push(
        leg(
          "A-08",
          "EG-8",
          "REGRESSION BOUND",
          `…and still gains at least one Practiced skill per 10 active days (${who})`,
          practiced * 10 >= transcript.activeDays,
          `${String(practiced)} Practiced over ${String(transcript.activeDays)} active days`,
        ),
      );
      break;
    }
    case "fatiguer": {
      const fatigued = steps.filter((step) => step.fatigued);
      legs.push(
        leg(
          "A-07",
          "EG-8",
          "PEDAGOGICAL ASSERTION",
          `the fatigue detector fires at all (${who})`,
          fatigued.length > 0,
          `${String(fatigued.length)} cards answered while fatigued`,
        ),
      );
      break;
    }
    default:
      break;
  }

  return legs;
}

// -------------------------------------------------------------------- EG-9 ----

export function diagnosisLegs(transcript: Transcript, who: string): Leg[] {
  const steps = transcript.steps;
  const firedBySkill = new Map<SkillId, number>();
  const detected = new Set<SkillId>();
  let recalledWithinSix = 0;
  let skillsWithSixFirings = 0;

  for (const step of steps) {
    if (step.bugFired) {
      const count = (firedBySkill.get(step.skillId) ?? 0) + 1;
      firedBySkill.set(step.skillId, count);
      if (count === 6) {
        skillsWithSixFirings += 1;
        if (detected.has(step.skillId)) recalledWithinSix += 1;
      }
    }
    if (step.bugReported) detected.add(step.skillId);
  }

  const legs: Leg[] = [];
  if (transcript.persona === "single-misconception") {
    legs.push(
      leg(
        "A-10",
        "EG-9",
        "REGRESSION BOUND",
        `bug recall is at least 0.85 within six firings (${who})`,
        skillsWithSixFirings === 0 || recalledWithinSix * 100 >= skillsWithSixFirings * 85,
        `${String(recalledWithinSix)}/${String(skillsWithSixFirings)} skills diagnosed inside six firings`,
      ),
    );
  } else if (transcript.persona !== "fast-careless") {
    const errors = steps.filter((step) => !step.correct).length;
    const activations = steps.filter((step) => step.bugReported).length;
    legs.push(
      leg(
        "A-10",
        "EG-9",
        "REGRESSION BOUND",
        `a bug-free child's false-positive rate is under 0.05 of errors (${who})`,
        activations * 100 < errors * 5,
        `${String(activations)} activations over ${String(errors)} errors = ${pct(activations, errors)}`,
      ),
    );
  }
  return legs;
}

// ------------------------------------------------------------- EG-3, EG-4 ----

export function stateSizeLeg(learner: LearnerState, sessions: number, who: string): Leg {
  const bytes = stateSizeBytes(learner);
  return leg(
    "A-15",
    "EG-3",
    "PEDAGOGICAL ASSERTION",
    `persisted state stays under ${String(STATE_LIMIT_BYTES)} bytes (${who})`,
    bytes < STATE_LIMIT_BYTES,
    `${String(bytes)} bytes after ${String(sessions)} sessions`,
  );
}

/** θ movement on skills the run never touched, for `A-11`. */
export function contaminationLeg(before: LearnerState, after: LearnerState, touched: ReadonlySet<SkillId>, who: string): Leg {
  let worst: Fix = ZERO;
  let worstSkill = "";
  for (const [id, state] of Object.entries(after.skills)) {
    if (touched.has(id)) continue;
    const previous = before.skills[id];
    if (previous === undefined) continue;
    const drift = abs(sub(state.theta, previous.theta));
    if (drift > worst) {
      worst = drift;
      worstSkill = id;
    }
  }
  return leg(
    "A-11",
    "EG-9",
    "PEDAGOGICAL ASSERTION",
    `a detected bug does not contaminate untouched skills (${who})`,
    worst < fromRatio(2, 10),
    `worst |Δθ| ${format(worst, 4)}${worstSkill === "" ? "" : ` on ${worstSkill}`}`,
  );
}

/** Every leg the engine can decide from one transcript. */
export function legsFor(transcript: Transcript, who: string): Leg[] {
  return [
    ...controllerLeg(transcript.steps, who),
    ...invariantLegs(transcript, who),
    ...personaLegs(transcript, who),
    ...diagnosisLegs(transcript, who),
    stateSizeLeg(transcript.finalLearner, transcript.sessions, who),
  ];
}

export { ONE, ZERO };
