import { useLayoutEffect } from "react";
import { readyLazy } from "../../lib/ready-lazy";
import { dressAhead } from "./look-ahead";
import type { PracticeScope } from "./practice-settings";

// In hand before a student's first screen (look-first.ts fetches it ahead),
// so the look is held from the first commit; otherwise it renders when it
// arrives. Nothing is painted in its place either way.
const screen = readyLazy<{ scope: PracticeScope }>(
  async () => (await import("./LookHostScreen")).LookHostScreen,
  "A student's look",
);
export const preloadLookHostScreen = screen.preload;
const Screen = screen.Component;
/** A student's own screens wear the look they chose (the app frame renders
 * this for a student only). Its code, with the practice-state read, the look
 * rules and Colorful's dress, loads with a student's screens and never for an
 * adult's: the frame's entry code carries none of it. It paints nothing, so
 * waiting for it moves nothing. */
export function LookHost({ scope }: { scope: PracticeScope }) {
  // What this device remembers of their look is on in the commit that first
  // paints their screens, before that code or the server's answer arrives
  // (look-ahead.ts). Here, not in the app frame: only a student's screens
  // mount this, and the frame's own effects stay as they were for everyone
  // else.
  const learner = scope.learnerId;
  useLayoutEffect(() => dressAhead(learner), [learner]);
  return <Screen scope={scope} />;
}
