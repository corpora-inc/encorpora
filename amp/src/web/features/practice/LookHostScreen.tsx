import { useLook } from "./look";
import type { PracticeScope } from "./practice-settings";

/** Holds the learner's look on <html> while mounted (look.ts `useLook`). */
export function LookHostScreen({ scope }: { scope: PracticeScope }) {
  useLook(scope);
  return null;
}
