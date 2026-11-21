import { z } from "zod";

/** How practice looks: Calm, or Colorful ("bold" in code). The skin is
 * `:root[data-look="bold"]` in tokens.css; this file only decides which. */
export const looks = ["calm", "bold"] as const;
export const lookSchema = z.enum(looks);
export type Look = z.infer<typeof lookSchema>;
/** The look an answer was given under, recorded on the attempt: Colorful with
 * reduced motion keeps its colors and drops the motion, so it is its own
 * value for anyone comparing how kids did. */
export const shownLooks = ["calm", "bold", "bold-reduced"] as const;
export const shownLookSchema = z.enum(shownLooks);
export type ShownLook = z.infer<typeof shownLookSchema>;
export const defaultLook: Look = "calm";

/** What one class (with the school and district above it) says about look. */
export type ClassLook = {
  value: Look;
  /** Someone chose it; false is only the default. */
  set: boolean;
  /** A scope at or above the class locked it. */
  locked: boolean;
};

/** The one value several classes give: it, if they agree; otherwise calm,
 * the safer choice, as for `studentLevelVisibility`. */
const agreed = (classes: readonly ClassLook[]): Look | null =>
  classes.length === 0
    ? null
    : classes.every((entry) => entry.value === classes[0]!.value)
      ? classes[0]!.value
      : defaultLook;

/** Who holds the look so the learner can't change it. */
export type LookLockedBy = "class" | "adult";

/**
 * Pure. The look a learner sees, and who (if anyone) locked it:
 * 1. a locked class value wins, a teacher's or a school's (two locked
 *    classes that disagree: calm);
 * 2. else the learner's own choice (null inherits), which a grown-up may
 *    have locked for them;
 * 3. else what their classes chose (a family's class is the family default);
 * 4. else calm.
 */
export function resolveLook(input: {
  own: Look | null;
  /** A grown-up locked the learner's own choice. */
  ownLocked?: boolean;
  classes: readonly ClassLook[];
}): { look: Look; locked: boolean; lockedBy: LookLockedBy | null } {
  const byClass = agreed(input.classes.filter((entry) => entry.locked));
  if (byClass) return { look: byClass, locked: true, lockedBy: "class" };
  if (input.own)
    return input.ownLocked
      ? { look: input.own, locked: true, lockedBy: "adult" }
      : { look: input.own, locked: false, lockedBy: null };
  const chosen = agreed(input.classes.filter((entry) => entry.set));
  return { look: chosen ?? defaultLook, locked: false, lockedBy: null };
}

/** The value recorded on an attempt for the look on screen. */
export const shownLook = (look: Look, reducedMotion: boolean): ShownLook =>
  look === "bold" && reducedMotion ? "bold-reduced" : look;
