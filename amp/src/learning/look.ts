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
/** Colorful is where a child starts through this grade (K is 0): the
 * elementary years. From grade 6, and for an adult or a learner whose grade
 * isn't known, it is Calm. Either may switch, unless a grown-up or a class
 * holds the look. */
export const COLORFUL_THROUGH_GRADE = 5;
/** The look a learner in this grade starts with, before anyone chooses. */
export const startingLook = (grade: number | null): Look =>
  grade !== null && grade <= COLORFUL_THROUGH_GRADE ? "bold" : defaultLook;

/**
 * Colorful is allowed unless an adult turned it off. This is the one rule
 * for what is stored, at every scope (a district, a school, a class, a
 * child's own settings): Colorful is off only where the stored look is Calm
 * AND it is held. That pair is what "Allow Colorful: off" writes, and it is
 * what the earlier lock on Calm wrote. Everything else allows it: nothing
 * stored, Calm not held, Colorful, and Colorful with a hold (a hold on
 * Colorful never meant anything: nobody needs keeping in it).
 */
export const colorfulAllowed = (
  stored: Look | null | undefined,
  held: boolean,
): boolean => !(held && stored === "calm");

/** What one class (with the school and district above it) says about look. */
export type ClassLook = {
  /** The look stored for it: only Calm, held, means anything now. */
  value: Look;
  /** Someone stored one; false is only the default. */
  set: boolean;
  /** A scope at or above the class holds it. */
  locked: boolean;
};

/** Who turned Colorful off for the learner. */
export type LookLockedBy = "class" | "adult";

/**
 * Pure. The look a learner sees, and whether Colorful is off for them
 * (`locked`) and by whom:
 * 1. any of their classes (or its school or district) has Colorful off:
 *    Calm, by the class;
 * 2. else a grown-up of theirs has it off: Calm, by the adult;
 * 3. else it is theirs to choose: their own choice, and until they make one,
 *    where a learner their age starts (`startingLook`; Calm when not given).
 *
 * An adult no longer chooses a starting look for anyone else: a class's
 * stored Colorful, or Calm that is not held, changes nothing here. A
 * learner's own choice is kept while Colorful is off and applies again when
 * it is allowed.
 */
export function resolveLook(input: {
  own: Look | null;
  /** A grown-up turned Colorful off for the learner. */
  ownOff?: boolean;
  classes: readonly ClassLook[];
  /** Where this learner starts when they have not chosen (`startingLook`). */
  starting?: Look;
}): { look: Look; locked: boolean; lockedBy: LookLockedBy | null } {
  if (
    input.classes.some((entry) => !colorfulAllowed(entry.value, entry.locked))
  )
    return { look: "calm", locked: true, lockedBy: "class" };
  if (input.ownOff) return { look: "calm", locked: true, lockedBy: "adult" };
  return {
    look: input.own ?? input.starting ?? defaultLook,
    locked: false,
    lockedBy: null,
  };
}

/** The value recorded on an attempt for the look on screen. */
export const shownLook = (look: Look, reducedMotion: boolean): ShownLook =>
  look === "bold" && reducedMotion ? "bold-reduced" : look;
