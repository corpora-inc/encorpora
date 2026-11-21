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

/**
 * Pure. The look a learner sees, and whether a class locked it:
 * 1. a locked class value wins (two locked classes that disagree: calm);
 * 2. else the learner's own choice (null inherits);
 * 3. else what their classes chose (a family's class is the family default);
 * 4. else calm.
 */
export function resolveLook(input: {
  own: Look | null;
  classes: readonly ClassLook[];
}): { look: Look; locked: boolean } {
  const locked = agreed(input.classes.filter((entry) => entry.locked));
  if (locked) return { look: locked, locked: true };
  if (input.own) return { look: input.own, locked: false };
  const chosen = agreed(input.classes.filter((entry) => entry.set));
  return { look: chosen ?? defaultLook, locked: false };
}

/** The value recorded on an attempt for the look on screen. */
export const shownLook = (look: Look, reducedMotion: boolean): ShownLook =>
  look === "bold" && reducedMotion ? "bold-reduced" : look;
