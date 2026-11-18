import { requestFetch } from "./request-transport";
import { EngagementClock } from "../../analytics/engagement";
import { screenForPath } from "../../analytics/engagement";
import type { Me } from "../../account/contracts";
import type { AuthSession } from "../auth";
import { currentLearner, useLearnerStore } from "../learner-store";
import { nativeRuntime } from "../native-runtime";
import { practiceLearners } from "./adult-learner";
import { meKey, queryClient, sessionOptions } from "./query";
import { isStudentDevice, studentSession } from "./student-device";
import { HelpQueue, onHelp } from "./help-events";

/** Active time for a learner's own record, the same for every learner: a
 * school or family-class student's session sends to the school's activity
 * route, and an account sends for whichever of its learners is chosen (a
 * child, its adult, a practice profile). Not analytics: it is the learner's
 * record, so it ignores DNT and GPC, and it carries no identifiers beyond the
 * sign-in and the learner. Time counts only while the page is visible and the
 * learner has touched it within the last minute. */
type Surface =
  | "practice"
  | "lesson"
  | "feedback"
  | "map"
  | "other"
  | "hint"
  | "video"
  | "example";
/** What help is showing over the route, so its time is its own. */
type HelpSurface = "lesson" | "hint" | "video" | "example";
type Overlay = { surface: HelpSurface; problemId?: string; skillId?: string };
/** Where the time goes now, or null to let it go uncounted. */
type Destination = { url: string; token: string } | null;
type Activity = {
  navigate(path: string): void;
  /** Sends what is counted so far to `to`, the destination it was counted
   * for, before the destination changes. */
  flush(to: Destination): void;
  stop(): void;
};
const idle: Activity = { navigate: () => {}, flush: () => {}, stop() {} };
const SEND_EVERY_MS = 30_000;
const MAX_DELTAS = 10;

export function surfaceOf(path: string): Surface {
  if (path === "/") return "practice";
  const screen = screenForPath(path);
  if (screen === "practice") return "practice";
  if (screen === "lesson") return "lesson";
  if (screen === "pathways") return "map";
  return "other";
}

type Watcher = {
  noteProblem(id: string): void;
  overlay(): void;
  attend(): void;
};
const running = new Set<Watcher>();
/** The problem now showing, so time lands on its skill. A no-op when no one's
 * time is counted. */
export function noteActiveProblem(problemId: string) {
  for (const clock of running) clock.noteProblem(problemId);
}
/** Help showing over the route, innermost last. */
const overlays: Overlay[] = [];
/** While help shows (a hint, a lesson, a video, a worked explanation), active
 * time counts under its surface, on its problem's skill: the same clock, idle
 * rule and server cap as all active time. Returns the call that ends it. */
export function showHelpSurface(overlay: Overlay): () => void {
  const entry = { ...overlay };
  for (const clock of running) clock.overlay();
  overlays.push(entry);
  return () => {
    const at = overlays.indexOf(entry);
    if (at < 0) return;
    for (const clock of running) clock.overlay();
    overlays.splice(at, 1);
  };
}
/** Playing media holds attention without a touch: a video that plays counts
 * like input, still only while the page is visible and focused. */
export function noteAttention() {
  for (const clock of running) clock.attend();
}

/** A school student's time in class. The clock runs from boot whoever is
 * signed in, and sends only while a student is: a student session often
 * begins without a reload ("Let Aug practice here", a class code typed in the
 * app), and a clock decided once at boot never counted it. */
export function startStudentActivity(): Activity {
  return startActivity(() => {
    const session = studentSession();
    return session
      ? { url: "/api/v1/school/student/activity", token: session.token }
      : null;
  });
}

/** Where an account's time goes: the learner it has chosen (or `pick`
 * picks), when that is one it practices as (its children, its adult, its
 * practice profiles). A student session's time is the session's, never the
 * account's. */
function chosenLearner(
  pick: (accountId: string) => string | null = currentLearner,
): Destination {
  if (studentSession()) return null;
  const session = queryClient.getQueryData<AuthSession | null>(
    sessionOptions.queryKey,
  );
  if (!session) return null;
  const me = queryClient.getQueryData<Me>(meKey(session.accountId));
  const learnerId = pick(session.accountId);
  if (!me?.signedIn || !learnerId) return null;
  return practiceLearners(me).some((learner) => learner.id === learnerId)
    ? {
        url: `/api/v1/learners/${encodeURIComponent(learnerId)}/activity`,
        token: session.token,
      }
    : null;
}

/** A learner's time on an account: practice, lessons, help and the map,
 * while that learner is the one chosen. The family's screens, a school's and
 * a record are not practice. Choosing another learner first sends the time
 * so far to the one it was counted for. (The native app practices offline
 * and keeps its time on the device.) */
export function startLearnerActivity(): Activity {
  if (isStudentDevice() || nativeRuntime) return idle;
  const activity = startActivity(
    () => chosenLearner(),
    (surface) => surface !== "other",
  );
  const unsubscribe = useLearnerStore.subscribe((state, previous) => {
    const before = chosenLearner((id) => previous.learners[id] ?? null);
    const after = chosenLearner((id) => state.learners[id] ?? null);
    if (before?.url !== after?.url) activity.flush(before);
  });
  return {
    navigate: activity.navigate,
    flush: activity.flush,
    stop() {
      unsubscribe();
      activity.stop();
    },
  };
}

/** One learner's heartbeat to `destination` (exported for its tests). */
export function startActivity(
  destination: () => Destination,
  /** Which surfaces count; every one when absent. */
  counts: (surface: Surface) => boolean = () => true,
): Activity {
  let routeSurface: Surface = surfaceOf(location.pathname);
  let routeProblem: string | undefined;
  /** What is showing: the innermost help, else the route and its problem. */
  const showing = (): {
    surface: Surface;
    problemId?: string;
    skillId?: string;
  } => {
    const top = overlays.at(-1);
    return top
      ? {
          surface: top.surface,
          problemId: top.problemId ?? routeProblem,
          skillId: top.skillId,
        }
      : { surface: routeSurface, problemId: routeProblem };
  };
  let stopped = false;
  type Delta = {
    surface: Surface;
    problemId?: string;
    skillId?: string;
    activeMs: number;
  };
  const queue: Delta[] = [];
  const help = new HelpQueue();
  const unsubscribe = onHelp((note, at) => help.push(note, at));
  const visible = () =>
    document.visibilityState === "visible" && document.hasFocus();
  let clock = new EngagementClock(performance.now(), visible());
  let banked = 0;
  /** Moves the clock's active time into the queue, under what is showing now. */
  function bank() {
    clock.sample(performance.now(), visible());
    const total = Math.floor(clock.activeMs);
    const fresh = total - banked;
    banked = total;
    const { surface, problemId, skillId } = showing();
    if (fresh <= 0 || !counts(surface)) return;
    const last = queue[queue.length - 1];
    if (
      last &&
      last.surface === surface &&
      last.problemId === problemId &&
      last.skillId === skillId
    )
      last.activeMs += fresh;
    else
      queue.push({
        surface,
        ...(problemId ? { problemId } : {}),
        ...(skillId && !problemId ? { skillId } : {}),
        activeMs: fresh,
      });
  }
  async function send(leaving: boolean, to?: Destination) {
    bank();
    const target = to === undefined ? destination() : to;
    if (!target || (!queue.length && !help.size)) {
      if (!target) {
        queue.length = 0;
        help.clear();
      }
      return;
    }
    const deltas = queue.splice(0, MAX_DELTAS);
    const takenAt = performance.now();
    const events = help.take(takenAt);
    try {
      const response = await requestFetch(target.url, {
        method: "POST",
        keepalive: leaving,
        credentials: "same-origin",
        headers: {
          ...(target.token ? { Authorization: `Bearer ${target.token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deltas: deltas.map((d) => ({
            ...d,
            activeMs: Math.min(90_000, d.activeMs),
          })),
          ...(events.length ? { events } : {}),
        }),
      });
      // Lost time is a wrong record for a teacher and a family: every
      // refusal is said aloud, with the server's reason.
      if (!response.ok)
        console.error(
          "Active time not saved",
          response.status,
          await response
            .json()
            .then((body: { error?: unknown }) => body?.error ?? null)
            .catch((error: unknown) => {
              console.warn("The refusal's reason wasn’t readable", error);
              return null;
            }),
        );
    } catch (error) {
      // Offline: the help waits for the next heartbeat (time already passed
      // can't be claimed again, so its deltas are not kept).
      help.restore(events, takenAt);
      console.error("Active time not saved", error);
    }
  }
  const interact = () => clock.sample(performance.now(), visible(), true);
  const leave = () => void send(true);
  const interactions = [
    "pointerdown",
    "keydown",
    "scroll",
    "touchstart",
  ] as const;
  for (const e of interactions)
    window.addEventListener(e, interact, { passive: true });
  window.addEventListener("focus", interact);
  window.addEventListener("blur", leave);
  window.addEventListener("pagehide", leave);
  document.addEventListener("visibilitychange", leave);
  const timer = setInterval(() => void send(false), SEND_EVERY_MS);
  const watcher: Watcher = {
    noteProblem(id: string) {
      if (id === routeProblem) return;
      bank();
      routeProblem = id;
    },
    overlay: bank,
    attend: interact,
  };
  running.add(watcher);
  return {
    flush(to: Destination) {
      void send(true, to);
    },
    navigate(path: string) {
      const next = surfaceOf(path.split(/[?#]/)[0]);
      if (next === routeSurface) return;
      bank();
      routeSurface = next;
      routeProblem = undefined;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      running.delete(watcher);
      unsubscribe();
      clearInterval(timer);
      for (const e of interactions) window.removeEventListener(e, interact);
      window.removeEventListener("focus", interact);
      window.removeEventListener("blur", leave);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", leave);
      void send(true);
    },
  };
}
