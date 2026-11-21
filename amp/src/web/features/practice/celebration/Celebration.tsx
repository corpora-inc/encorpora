import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { readyLazy } from "../../../lib/ready-lazy";
import { useLookOnScreen } from "../look";
import { usePoints, usePracticeScope } from "../points";
import { creditOutcome, type Credit } from "./credit";
import type { Answer } from "./tier";

export { useEvidenceMoments } from "./credit";

type Props = {
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

/** What Colorful shows (Colorful.tsx, with the stage, the hues, the sound
 * and the overlay's stylesheet): fetched only for a learner whose look is
 * Colorful, and fetched when that look resolves, so the first right answer
 * after it already finds it. Nothing paints in its place. */
const colorful = readyLazy<{
  credit: RefObject<Credit | null>;
  outcome: Props["outcome"];
  mastered?: string | null;
  problem: Props["problem"];
}>(async () => (await import("./Colorful")).Colorful, "Colorful");
export const preloadColorful = colorful.preload;
const Colorful = colorful.Component;

/**
 * Practice's one seam for Colorful (the practice host, app/LegacyApp.tsx,
 * hands it to PracticeWorkspace, which renders it once inside its `<main>`). In every look it counts a right answer without help
 * into the learner's points and keeps the run of right answers: those are
 * the learner's own. Only in Colorful does it render what the answer earned,
 * through code a Calm learner never downloads. It renders nothing itself,
 * so nothing here can move the page or wait on the learner.
 */
export function Celebration(props: Props) {
  const look = useLookOnScreen();
  const scope = usePracticeScope();
  const credit = useRef<Credit | null>(null);
  useEffect(() => {
    if (look === "bold") void preloadColorful();
  }, [look]);
  return (
    <>
      {/* First: siblings' layout effects run in order, so the answer is
       * counted before Colorful reads what counting it brought. */}
      <Counter credit={credit} outcome={props.outcome} />
      {look === "bold" && scope ? (
        <Colorful credit={credit} {...props} />
      ) : null}
    </>
  );
}

function Counter({
  credit,
  outcome,
}: {
  credit: RefObject<Credit | null>;
  outcome: Props["outcome"];
}) {
  const scope = usePracticeScope();
  const points = usePoints();
  // An answer already on screen when this mounts (a return from a book)
  // was counted when it arrived.
  const seen = useRef(outcome?.id ?? null);
  // Counting: runs in the commit that shows the verdict, before the
  // workspace plays its sound (sound.ts reads the run).
  useLayoutEffect(() => {
    if (!outcome || seen.current === outcome.id || !scope) return;
    seen.current = outcome.id;
    credit.current = creditOutcome(scope, outcome, points);
    // Counted once per answer; the points are read as they stood then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome?.id]);
  return null;
}
