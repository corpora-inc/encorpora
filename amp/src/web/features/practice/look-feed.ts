/**
 * How a change of look made somewhere else reaches a screen already open.
 *
 * An adult turns "Allow Colorful" off because the color is distracting a
 * child right now, from their own phone or the teacher's desk. The child's
 * practice must follow without the child doing anything:
 *
 * - A student's practice holds one student stream for as long as it is on
 *   screen (features/live/useStudentLive.ts), and the server says on it when
 *   their settings change (a `settings` row in the live outbox:
 *   schools/live/events.ts). The stream's owner reads the practice settings
 *   again on every whole state it gets: about a second after the switch.
 *   While that stream streams, the tab is fed: practice asks the server
 *   nothing more per problem.
 * - A tab nothing feeds (an adult's own practice, a parent practicing on
 *   their own sign-in, a student whose network holds the stream so it
 *   polls) reads them again with each answer (`lookAgain`), so the next
 *   problem arrives in the look as it stands: never later than that.
 * - Their menu reads them before it opens (look-known.ts), and the one
 *   cache reads them again when the tab is looked at again.
 *
 * Nothing polls.
 *
 * A look that arrives under an open problem changes its colors at once and
 * moves nothing (the chip's room is the problem's: chip-room.ts). One that
 * arrives while an answer's feedback is on screen waits for the next
 * problem: the two looks size that sheet differently, and it must not
 * change shape under a child who is reading it. That is where an unfed
 * tab's read lands, so its next problem's first frame is the new look.
 */
import { qk } from "../../lib/keys";
import { queryClient } from "../../lib/query-client";

/** Whether the student stream is streaming in this tab. */
let fed = false;
/** The student stream's owner says whether it feeds this tab. */
export function setLookFed(on: boolean) {
  fed = on;
}
export const lookIsFed = () => fed;

/** The answer each learner's practice last read with, in this tab (practice
 * mounts its workspace anew for each problem and on a return from a book,
 * so this outlives it). */
const read = new Map<string, string>();

/**
 * An answer has just been graded (or a problem skipped) and counted. Where
 * nothing feeds this tab, the learner's practice settings are read again,
 * once per answer, and the screens that show them follow.
 *
 * With the answer and not with the next problem: the answer is in the
 * server's count of points by now, so the read brings the total the page
 * already shows, and it is back long before the next answer is sent. A read
 * that started as a problem arrived could cross a quick answer on its way
 * and land with a point the page was about to count itself.
 */
export function lookAgain(
  scope: { identity: string; learnerId: string },
  answerId: string,
) {
  if (!scope.learnerId) return;
  const key = `${scope.identity}:${scope.learnerId}`;
  if (read.get(key) === answerId) return;
  read.set(key, answerId);
  if (fed) return;
  queryClient
    .invalidateQueries({
      queryKey: qk.practiceSettings(scope.identity, scope.learnerId),
      exact: true,
    })
    .catch((error: unknown) =>
      console.warn("The look wasn’t read again with the answer", error),
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
