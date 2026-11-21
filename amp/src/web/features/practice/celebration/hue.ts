/**
 * Colorful's world is one number: `--look-hue` on <html> (ui/tokens.css
 * turns every role from it). It moves on by the golden angle with each new
 * problem, from a start that is the learner's own, so the next world is
 * always far from the last. A problem keeps its hue: this device remembers
 * which world each recent problem had, so a reload shows the same one.
 * The hue is never recorded anywhere but here; it is not a setting.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** The golden angle: successive hues never bunch up. */
export const GOLDEN_ANGLE = 137.508;
/** How many problems share one world: 1 is a new world every problem. */
export const PROBLEMS_PER_HUE = 1;
/** Problems remembered per learner. */
const REMEMBERED = 60;

/** A learner's own starting hue: the same on every device. */
export function startHue(learner: string) {
  let hash = 2166136261;
  for (let i = 0; i < learner.length; i++) {
    hash ^= learner.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
}

/** The hue of the `n`th problem (0, 1, 2…) a learner meets here. */
export const hueAt = (learner: string, n: number) =>
  Math.round(
    (startHue(learner) + Math.floor(n / PROBLEMS_PER_HUE) * GOLDEN_ANGLE) % 360,
  );

type Seen = { count: number; problems: Record<string, number> };
type HueState = {
  learners: Record<string, Seen>;
  /** The problem's place in this learner's run, assigned on first sight. */
  place: (learner: string, problem: string) => number;
  /** The learner's latest hue (their other screens wear it). */
  latest: (learner: string) => number;
};

const storage = createJSONStorage(() => ({
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn("Colorful's hues not read", error);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn("Colorful's hues not saved", error);
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("Colorful's hues not cleared", error);
    }
  },
}));

export const useHueStore = create<HueState>()(
  persist(
    (set, get) => ({
      learners: {},
      place: (learner, problem) => {
        const seen = get().learners[learner] ?? { count: 0, problems: {} };
        const known = seen.problems[problem];
        if (known != null) return known;
        const n = seen.count;
        const entries = Object.entries({ ...seen.problems, [problem]: n });
        set((state) => ({
          learners: {
            ...state.learners,
            [learner]: {
              count: n + 1,
              problems: Object.fromEntries(entries.slice(-REMEMBERED)),
            },
          },
        }));
        return n;
      },
      latest: (learner) => {
        const seen = get().learners[learner];
        return hueAt(learner, seen ? Math.max(0, seen.count - 1) : 0);
      },
    }),
    {
      name: "amp.colorful-hue",
      storage,
      partialize: ({ learners }) => ({ learners }),
    },
  ),
);

/** The hue for a problem, assigning its place on first sight. */
export const hueOf = (learner: string, problem: string) =>
  hueAt(learner, useHueStore.getState().place(learner, problem));

/** Paints the world: every role turns (or, with reduced motion, simply is)
 * at once. `boost`, 0 to 1, is a streak's extra color. */
export function paintHue(hue: number, boost = 0) {
  const style = document.documentElement.style;
  style.setProperty("--look-hue", `${hue}deg`);
  style.setProperty("--look-boost", String(Math.max(0, Math.min(1, boost))));
}
/** Calm again: nothing of the world stays on <html>. */
export function clearHue() {
  const style = document.documentElement.style;
  style.removeProperty("--look-hue");
  style.removeProperty("--look-boost");
  arrived();
}

/** While the dress is first going on, the world does not turn (tokens.css
 * turns it only without this attribute): a load arrives in its own hue, in
 * one frame, and never sweeps there from the property's first value. */
const ARRIVING = "data-look-arriving";
/** A screen with no problem (a student's standings) has nothing to wait
 * for; it has arrived by now. */
const ARRIVAL_LIMIT_MS = 1500;
let arrival: ReturnType<typeof setTimeout> | undefined;
/** The dress is going on: hold the turn until what it dresses has painted. */
export function arriving() {
  document.documentElement.setAttribute(ARRIVING, "");
  clearTimeout(arrival);
  arrival = setTimeout(arrived, ARRIVAL_LIMIT_MS);
}
/** The world may turn from here on. */
export function arrived() {
  clearTimeout(arrival);
  arrival = undefined;
  document.documentElement.removeAttribute(ARRIVING);
}
/** The first problem's hue is on the page: once that frame has painted,
 * the next problem turns the world. */
export function arriveAfterPaint() {
  if (!document.documentElement.hasAttribute(ARRIVING)) return;
  requestAnimationFrame(() => requestAnimationFrame(arrived));
}
