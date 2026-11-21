import { useEffect, useLayoutEffect, useRef } from "react";
import { playCorrectFeedback, setFeedbackVoice } from "../feedback-preferences";
import { useLookOnScreen, usePrefersReducedMotion } from "../look";
import { creditAnswer, usePoints, usePracticeScope } from "../points";
import { colorfulVoice } from "./sound";
import { stage } from "./stage";
import { learnerKey, useCelebrationStore } from "./store";
import {
  evidenceMoments,
  momentsFor,
  type Answer,
  type Moment,
  type SkillEvidence,
} from "./tier";
import "./skin.css";

type Props = {
  /** The answer on screen, once graded. */
  outcome: (Answer & { skillId: string }) | null;
  /** The existing "Skill mastered" moment, when the host knows it. */
  mastered?: string | null;
  /** The problem on screen: a new one arrives with the sweep. */
  problemId: string;
};

/**
 * Practice's one seam for Colorful (PracticeWorkspace renders it once,
 * inside its `<main>`). It counts a right answer without help into the
 * learner's points, keeps the run of right answers, and plays what the
 * answer earned (tier.ts) on the page's one overlay (stage.ts). It renders
 * nothing itself: the overlay outlives each problem, so a celebration's tail
 * plays on over the next one, and nothing here can move the page or wait
 * on the learner. In Calm it only counts the point.
 */
export function Celebration({ outcome, mastered, problemId }: Props) {
  const scope = usePracticeScope();
  const look = useLookOnScreen();
  const reduced = usePrefersReducedMotion();
  const points = usePoints();
  const colorful = look === "bold" && !!scope;
  // An answer already on screen when this mounts (a return from a book)
  // was celebrated when it arrived.
  const seen = useRef(outcome?.id ?? null);
  // The run an answer brought, for this answer's sound.
  const streak = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!colorful) return;
    const shared = stage();
    shared.retain();
    return () => shared.release();
  }, [colorful]);
  useLayoutEffect(() => {
    if (colorful) stage().setPoints(points);
  }, [colorful, points]);
  useLayoutEffect(() => {
    if (!colorful) return;
    return setFeedbackVoice(colorfulVoice(() => streak.current));
  }, [colorful]);

  // A new problem: the glint along the bar (the problem's own entrance is
  // CSS, skin.css).
  useLayoutEffect(() => {
    if (colorful) stage().sweep(reduced);
    // Keyed on the problem only: a change of look is not a new problem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId]);

  // Grading: runs in the commit that shows the verdict, before the
  // workspace plays its sound (sound.ts reads the run).
  useLayoutEffect(() => {
    if (!outcome || seen.current === outcome.id || !scope) return;
    seen.current = outcome.id;
    const started = performance.now();
    const learner = learnerKey(scope);
    const store = useCelebrationStore.getState();
    const before = points;
    const counted = creditAnswer(scope, outcome);
    const run = store.count(learner, outcome);
    streak.current = counted ? run : null;
    if (!outcome.correct || outcome.assisted)
      store.saw(learner, outcome.skillId, "practicing");
    if (!colorful) return;
    const moments = momentsFor({
      answer: outcome,
      look,
      streak: run,
      pointsBefore: before,
      mastered: !!mastered,
    }).filter((moment) => store.play(outcome.id, moment));
    // (A host that knows "mastered" with the answer has already played
    // the milestone sound with it.)
    if (moments.length)
      stage().play({
        moments,
        from: counted ? before : null,
        to: counted && before != null ? before + 1 : null,
        reduced,
      });
    measured(started);
    // Graded once per answer; the rest is read as it stood then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome?.id]);
  return null;
}

/** The celebration's own main-thread time, as a user timing entry
 * (scripts/verify-celebration-ui.ts holds it under a long task). */
function measured(start: number) {
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
 * skill's first right answer without help. Each plays once per answer.
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
    stage().play({ moments, from: null, to: null, reduced });
    measured(started);
    // Once, when the record arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome?.id, !!evidence]);
}
