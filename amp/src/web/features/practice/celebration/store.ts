import { create } from "zustand";
import { nextStreak, type Answer, type SkillStatus } from "./tier";

/**
 * This tab's practice run, per learner (`identity:learner`): how many right
 * in a row, each skill's status as last seen, and which answers have already
 * been celebrated. Memory only: a run is a sitting, and a reload starts a
 * new one. Nothing here is a record; points live on the server.
 */
type Run = {
  streak: number;
  /** The last answer counted into the streak, so a remount never counts it
   * again. */
  last: string | null;
  skills: Record<string, SkillStatus>;
};
type CelebrationState = {
  runs: Record<string, Run>;
  /** `answer:moment` pairs already played. */
  played: Record<string, true>;
  /** The streak an answer brought, for its sound (sound.ts). */
  streakOf: Record<string, number>;
  count: (learner: string, answer: Answer) => number;
  saw: (learner: string, skillId: string, status: SkillStatus) => void;
  play: (answerId: string, moment: string) => boolean;
};
const empty: Run = { streak: 0, last: null, skills: {} };
const LIMIT = 400;
const trim = <T>(record: Record<string, T>) => {
  const keys = Object.keys(record);
  if (keys.length <= LIMIT) return record;
  return Object.fromEntries(
    keys.slice(keys.length - LIMIT).map((key) => [key, record[key]!]),
  );
};

export const useCelebrationStore = create<CelebrationState>()((set, get) => ({
  runs: {},
  played: {},
  streakOf: {},
  count: (learner, answer) => {
    const run = get().runs[learner] ?? empty;
    if (run.last === answer.id) return run.streak;
    const streak = nextStreak(run.streak, answer);
    set((state) => ({
      runs: { ...state.runs, [learner]: { ...run, streak, last: answer.id } },
      streakOf: trim({ ...state.streakOf, [answer.id]: streak }),
    }));
    return streak;
  },
  saw: (learner, skillId, status) =>
    set((state) => {
      const run = state.runs[learner] ?? empty;
      return {
        runs: {
          ...state.runs,
          [learner]: { ...run, skills: { ...run.skills, [skillId]: status } },
        },
      };
    }),
  play: (answerId, moment) => {
    const key = `${answerId}:${moment}`;
    if (get().played[key]) return false;
    set((state) => ({ played: trim({ ...state.played, [key]: true }) }));
    return true;
  },
}));

export const learnerKey = (scope: { identity: string; learnerId: string }) =>
  `${scope.identity}:${scope.learnerId}`;
