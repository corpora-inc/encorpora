import { useLayoutEffect, useRef, type RefObject } from "react";
import { setFeedbackVoice } from "../feedback-preferences";
import { useLookOnScreen, usePrefersReducedMotion } from "../look";
import { usePoints, usePracticeScope } from "../points";
import { measured, type Credit } from "./credit";
import { colorfulVoice } from "./sound";
import { hueOf, paintHue } from "./hue";
import { stage } from "./stage";
import { learnerKey, useCelebrationStore } from "./store";
import { momentsFor, type Answer } from "./tier";

type Props = {
  /** What counting the answer on screen brought (credit.ts), read here. */
  credit: RefObject<Credit | null>;
  /** The answer on screen, once graded. */
  outcome: (Answer & { skillId: string }) | null;
  /** The existing "Skill mastered" moment, when the host knows it. */
  mastered?: string | null;
  /** The problem on screen: a new one turns the world to its hue. */
  problem: {
    id: string;
    prompt?: unknown;
    response?: unknown;
    hintSupport?: unknown;
  };
};

/** The names templates give the figure roles accent, warm and gold, as
 * Calm draws them ("some teal and some rust", "the gold arrow"). */
const NAMED_COLORS = /\b(teal|rust|gold)\b/i;
/** Whether the problem's words (its prompt, its answer's options and
 * labels, its hint) name a figure color: then the figure keeps Calm's marks,
 * so the words stay true. */
export const namesFigureColors = (problem: {
  prompt?: unknown;
  response?: unknown;
  hintSupport?: unknown;
}) => {
  try {
    return NAMED_COLORS.test(
      JSON.stringify([problem.prompt, problem.response, problem.hintSupport]),
    );
  } catch (error) {
    console.warn("A problem's words were not read for color names", error);
    return true;
  }
};
/** A streak's extra color on the page: from 3 right in a row, full at 10. */
export const boostFor = (streak: number) =>
  streak < 3 ? 0 : Math.min(1, (streak - 2) / 8);

/**
 * What Colorful shows, loaded only for a learner whose look is Colorful
 * (Celebration.tsx is the seam). It plays what the answer earned (tier.ts)
 * on the page's one overlay (stage.ts), turns the world to each problem's
 * hue, and lends the answer's sound its run. It renders nothing itself: the
 * overlay outlives each problem, so a celebration's tail plays on over the
 * next one, and nothing here can move the page or wait on the learner. The
 * answer was counted just before this runs (credit.ts).
 */
export function Colorful({ credit, outcome, mastered, problem }: Props) {
  const problemId = problem.id;
  const scope = usePracticeScope();
  const reduced = usePrefersReducedMotion();
  const points = usePoints();
  const colorful = !!scope;
  // An answer already on screen when this mounts (a return from a book)
  // was celebrated when it arrived.
  const seen = useRef(outcome?.id ?? null);

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
    return setFeedbackVoice(
      colorfulVoice(() => credit.current?.streak ?? null),
    );
  }, [colorful, credit]);

  // A new problem turns the world to its own hue, with its entrance
  // (skin.css), in the commit that shows it. A run in progress keeps its
  // extra color; a broken one has quietly let it go.
  useLayoutEffect(() => {
    if (!colorful || !scope) return;
    const root = document.documentElement;
    if (namesFigureColors(problem)) root.dataset.figureColors = "named";
    else delete root.dataset.figureColors;
    const run =
      useCelebrationStore.getState().runs[learnerKey(scope)]?.streak ?? 0;
    paintHue(hueOf(scope.learnerId, problemId), boostFor(run));
    return () => {
      delete root.dataset.figureColors;
    };
    // Keyed on the problem: the same problem keeps its world.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId, colorful]);

  // The verdict: runs in the commit that shows it, after the seam counted
  // the answer (a sibling before this one) and before the workspace plays
  // its sound (sound.ts reads the run).
  useLayoutEffect(() => {
    if (!outcome || seen.current === outcome.id || !scope) return;
    seen.current = outcome.id;
    const started = performance.now();
    const counted = credit.current;
    if (!counted || counted.answer !== outcome.id) return;
    const store = useCelebrationStore.getState();
    const moments = momentsFor({
      answer: outcome,
      look: "bold",
      streak: counted.run,
      pointsBefore: counted.before,
      mastered: !!mastered,
    }).filter((moment) => store.play(outcome.id, moment));
    // (A host that knows "mastered" with the answer has already played
    // the milestone sound with it.)
    if (moments.length)
      stage().play({
        moments,
        from: counted.counted ? counted.before : null,
        to:
          counted.counted && counted.before != null ? counted.before + 1 : null,
        reduced,
        streak: counted.counted ? counted.run : 0,
      });
    measured(started);
    // Graded once per answer; the rest is read as it stood then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome?.id]);
  return null;
}
