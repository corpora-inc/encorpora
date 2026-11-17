import { useEffect } from "react";
import { create } from "zustand";

/**
 * Which way practice moved within one area: the grade of the problem on the
 * screen against the grade of the one before it in the same area. AMP keeps
 * a frontier per area and interleaves areas, so a change of area is not a
 * step; within an area it is the engine's own move (a step up after
 * success, a step back to a foundation after a miss, or an older skill
 * coming back for review).
 */
export type GradeStep = "up" | "down" | null;
type Seen = { problemId: string; grade: number; step: GradeStep };

/** The trail's next entry. Idempotent for one problem: rendering it twice
 * (the bar's topic and the phone's) never counts it as a second step. */
export function nextGradeStep(
  last: Seen | undefined,
  problemId: string,
  grade: number,
): Seen {
  if (last?.problemId === problemId) return last;
  const step: GradeStep =
    !last || last.grade === grade ? null : grade > last.grade ? "up" : "down";
  return { problemId, grade, step };
}

/** The last problem seen in each area, per learner, for this tab's session.
 * Memory only: it holds what was on screen, never learning evidence. */
const useTrail = create<{
  seen: Record<string, Seen>;
  record: (key: string, seen: Seen) => void;
}>((set) => ({
  seen: {},
  record: (key, seen) =>
    set((state) =>
      state.seen[key] === seen
        ? state
        : { seen: { ...state.seen, [key]: seen } },
    ),
}));

/** The step this problem took in its area; null for the first problem seen
 * there, an unchanged grade, or no grade. */
export function useGradeStep(
  learnerId: string,
  strand: string,
  problemId: string,
  grade: number | null,
): GradeStep {
  const key = `${learnerId}\u0000${strand}`;
  const last = useTrail((state) => state.seen[key]);
  const record = useTrail((state) => state.record);
  const seen = grade === null ? null : nextGradeStep(last, problemId, grade);
  useEffect(() => {
    if (seen && seen !== last) record(key, seen);
  }, [key, seen, last, record]);
  return seen?.step ?? null;
}
