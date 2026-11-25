import type { SpaceDescriptor } from "../spaces/resolve";

/**
 * Whether a space's menu is a learner's own (their look is theirs to set
 * there), and the learner it names. One rule for the menu's rows
 * (DrawerContents.tsx) and for what is read before the menu opens
 * (practice/look-known.ts).
 */
export function menuLearner(space: SpaceDescriptor | null): {
  learning: boolean;
  learnerId: string | null;
} {
  const learning = space?.space === "me" || space?.space === "student";
  return {
    learning,
    // The look setting falls back to the learner on screen.
    learnerId:
      space?.space === "student" || space?.space === "me"
        ? (space.learner?.id ?? null)
        : null,
  };
}
