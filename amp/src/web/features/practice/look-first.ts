/**
 * A learner's look, before their first screen paints.
 *
 * The look is the server's to say (learning/look.ts: a class's, the
 * learner's own, a grown-up's lock, else where their grade starts), and
 * Colorful's dress is code only a Colorful learner loads. Both used to
 * arrive after the screen: a child on a device new to them (every sign-in
 * on a shared school laptop) saw Calm for a moment, and on any device the
 * dress's shapes and the room it keeps for the points chip landed a frame
 * or more after the colors, moving the topic line. So the router reads both
 * ahead, with the account and the place (app/router.tsx, the root's
 * `beforeLoad`): the practice state into the one cache, and for Colorful
 * the dress and the screens that wear it. The first commit then finds
 * everything in hand and dresses before it paints (look.ts `useLook`).
 *
 * This file is its own chunk: an adult's entry code carries one `import()`.
 */
import { queryClient } from "../../lib/query";
import { canShowColorful } from "./look-ahead";
import { preloadLookHostScreen } from "./LookHost";
import { loadDress } from "./look";
import {
  practiceSettingsOptions,
  type PracticeScope,
} from "./practice-settings";

export async function lookBeforePaint(scope: PracticeScope) {
  const [state] = await Promise.all([
    queryClient.ensureQueryData(practiceSettingsOptions(scope)),
    // A student's screens hold the look through this (LookHost.tsx).
    preloadLookHostScreen(),
  ]);
  if (state.effectiveLook !== "bold" || !canShowColorful()) return;
  await loadDress();
  // The moments and the points chip: wanted soon, never waited for.
  void import("./celebration/Celebration").then(
    (module) => module.preloadColorful(),
    (error: unknown) => console.warn("Colorful didn’t load ahead", error),
  );
}
