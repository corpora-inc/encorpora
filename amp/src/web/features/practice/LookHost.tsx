import { lazy, Suspense } from "react";
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
  return (
    <Suspense fallback={null}>
      <Screen scope={scope} />
    </Suspense>
  );
}
