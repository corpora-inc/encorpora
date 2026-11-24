/**
 * How a change of look made somewhere else reaches a screen already open.
 *
 * An adult turns "Allow Colorful" off because the color is distracting a
 * child right now, from their own phone or the teacher's desk. The child's
 * practice must follow without the child doing anything, in seconds, and
 * never later than their next problem:
 *
 * - Seconds: a signed-in student holds the student stream (features/live),
 *   and the server says on it when their settings change (a `settings` row
 *   in the live outbox: schools/live/events.ts). The stream's hook reads
 *   the practice settings again on every whole state it gets: about a
 *   second after the switch.
 * - The next problem, whatever the stream did: every practice screen reads
 *   them again as each new problem arrives (`lookAgain`). That is also the
 *   whole path for a tab with no stream (a child on a parent's device, an
 *   adult's own practice).
 * - Their menu reads them before it opens (look-known.ts), and the one
 *   cache reads them again when the tab is looked at again.
 *
 * Nothing polls.
 *
 * A look that arrives under an open problem changes its colors at once and
 * moves nothing (the chip's room is the problem's: chip-room.ts). One that
 * arrives while an answer's feedback is on screen waits for the next
 * problem: the two looks size that sheet differently, and it must not
 * change shape under a child who is reading it.
 */
import { qk } from "../../lib/keys";
import { queryClient } from "../../lib/query-client";

/** The problem each learner's practice last showed in this tab (practice
 * mounts its workspace anew for each problem, so this outlives it). */
const shown = new Map<string, string>();

/** A problem is on screen. When it is a new one (never the first: the
 * screen has just read them), the learner's practice settings are read
 * again, and the screens that show them follow. */
export function lookAgain(
  scope: { identity: string; learnerId: string },
  problemId: string,
) {
  if (!scope.learnerId) return;
  const key = `${scope.identity}:${scope.learnerId}`;
  const before = shown.get(key);
  shown.set(key, problemId);
  if (before === undefined || before === problemId) return;
  queryClient
    .invalidateQueries({
      queryKey: qk.practiceSettings(scope.identity, scope.learnerId),
      exact: true,
    })
    .catch((error: unknown) =>
      console.warn("The look wasn’t read again with the problem", error),
    );
}

/** A screen is holding a look back for the next problem (look.ts). */
let held = false;
/** Looks let go with a problem, counted: what the screens that show a look
 * render again on. */
let released = 0;
const screens = new Set<() => void>();
export const holdLook = () => {
  held = true;
};
export const lookReleases = () => released;
export function onLookRelease(notify: () => void) {
  screens.add(notify);
  return () => {
    screens.delete(notify);
  };
}
/** A new problem is in this commit: a look that waited for it goes on in
 * the same commit. Where none waited, nothing renders again. */
export function problemTurned() {
  if (!held) return;
  held = false;
  released++;
  for (const notify of [...screens]) notify();
}

/** Whether a look that changed somewhere else waits for the next problem:
 * an answer's feedback is on screen, and the learner's own menu (where a
 * change is theirs, and shows at once) is not over it. */
export const lookWaits = () =>
  !!document.querySelector(".feedback") &&
  !document.querySelector("[data-navigation-sheet]");
