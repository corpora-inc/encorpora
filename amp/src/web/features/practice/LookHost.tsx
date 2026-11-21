import { lazy, Suspense, useLayoutEffect } from "react";
import { dressAhead } from "./look-ahead";
import type { PracticeScope } from "./practice-settings";

const Screen = lazy(() =>
  import("./LookHostScreen").then((m) => ({ default: m.LookHostScreen })),
);
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
  // else (a layout effect there changed how an adult's Overview sized its
  // page of cards; scripts/verify-progress-ui.ts).
  const learner = scope.learnerId;
  useLayoutEffect(() => dressAhead(learner), [learner]);
  return (
    <Suspense fallback={null}>
      <Screen scope={scope} />
    </Suspense>
  );
}
