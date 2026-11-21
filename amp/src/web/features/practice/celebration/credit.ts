import type { PracticeScope } from "../practice-settings";
import { creditAnswer } from "../points";
import { learnerKey, useCelebrationStore } from "./store";
import {
  evidenceMoments,
  type Answer,
  type Moment,
  type SkillEvidence,
} from "./tier";
import { useEffect } from "react";
import { playCorrectFeedback } from "../feedback-preferences";
import { useLookOnScreen, usePrefersReducedMotion } from "../look";
import { usePracticeScope } from "../points";

/** What counting one graded answer brought. */
export type Credit = {
  /** The answer counted. */
  answer: string;
  /** Whether it added a point (a right answer without help, once). */
  counted: boolean;
  /** The run of right answers it left. */
  run: number;
  /** The points before it, when known. */
  before: number | null;
  /** The run for its sound: null when it earned no point. */
  streak: number | null;
};

/**
 * Counts a graded answer into the learner's points and run, in every look:
 * Calm shows nothing of it, but the total and the run are the learner's
 * either way. (What Colorful then shows is Colorful.tsx, which loads only
 * for it.) Returns what it brought, for that to play.
 */
export function creditOutcome(
  scope: PracticeScope,
  outcome: Answer & { skillId: string },
  before: number | null,
): Credit {
  const store = useCelebrationStore.getState();
  const learner = learnerKey(scope);
  const counted = creditAnswer(scope, outcome);
  const run = store.count(learner, outcome);
  if (!outcome.correct || outcome.assisted)
    store.saw(learner, outcome.skillId, "practicing");
  return {
    answer: outcome.id,
    counted,
    run,
    before,
    streak: counted ? run : null,
  };
}

/** The celebration's own main-thread time, as a user timing entry
 * (scripts/verify-celebration-ui.ts holds it under a long task). */
export function measured(start: number) {
  try {
    performance.measure("amp-celebration", { start });
  } catch (error) {
    console.warn("Celebration timing not recorded", error);
  }
}

/** The Strong moment's sound: the milestone chord, once the answer's own
 * sound has started (the workspace plays it in this same commit). */
function playMilestoneSoon() {
  window.setTimeout(() => playCorrectFeedback(true), 180);
}

/**
 * The skill's record arriving after a right answer (AnswerFeedback loads
 * it): Strong when this answer made it so, else Earned when it was the
 * skill's first right answer without help. Each plays once per answer. The
 * record is always kept; only a Colorful learner has moments to play, and
 * only then is the stage's code fetched.
 */
export function useEvidenceMoments(
  outcome: (Answer & { skillId: string }) | null,
  evidence: SkillEvidence | undefined,
) {
  const scope = usePracticeScope();
  const look = useLookOnScreen();
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!outcome || !evidence || !scope) return;
    const learner = learnerKey(scope);
    const store = useCelebrationStore.getState();
    const before = store.runs[learner]?.skills[outcome.skillId];
    // Each answer's record is read once: a later look at it (a remount)
    // must not treat its own status as the one before it.
    if (!store.play(outcome.id, "evidence")) return;
    store.saw(learner, outcome.skillId, evidence.status);
    const moments: Moment[] = evidenceMoments({
      answer: outcome,
      look: look === "bold" ? "bold" : "calm",
      evidence,
      before,
    }).filter((moment) => store.play(outcome.id, moment));
    if (!moments.length) return;
    const started = performance.now();
    if (moments.includes("strong")) playMilestoneSoon();
    import("./stage").then(
      ({ stage }) => {
        stage().play({ moments, from: null, to: null, reduced });
        measured(started);
      },
      (error: unknown) => console.warn("The celebration didn’t load", error),
    );
    // Once, when the record arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome?.id, !!evidence]);
}
