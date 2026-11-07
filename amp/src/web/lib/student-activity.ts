import { EngagementClock } from "../../analytics/engagement";
import { screenForPath } from "../../analytics/engagement";
import { isStudentDevice, studentSession } from "./student-device";

/** Active time for a school student's session, sent to the school's own
 * activity route. Not analytics: it ignores DNT and GPC because a school
 * student's time in class is the school's record, and it carries no
 * identifiers beyond the session token. Time counts only while the page is
 * visible and the student has touched it within the last minute. */
type Surface = "practice" | "lesson" | "feedback" | "map" | "other";
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

let current: { noteProblem(id: string): void } | null = null;
/** The problem now showing, so time lands on its skill. A no-op off a student
 * device. */
export function noteStudentProblem(problemId: string) {
  current?.noteProblem(problemId);
}

export function startStudentActivity() {
  if (!isStudentDevice()) return { navigate: (_path: string) => {}, stop() {} };
  let surface: Surface = surfaceOf(location.pathname);
  let problemId: string | undefined;
  let stopped = false;
  type Delta = { surface: Surface; problemId?: string; activeMs: number };
  const queue: Delta[] = [];
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
    if (fresh <= 0) return;
    const last = queue[queue.length - 1];
    if (last && last.surface === surface && last.problemId === problemId)
      last.activeMs += fresh;
    else
      queue.push({
        surface,
        ...(problemId ? { problemId } : {}),
        activeMs: fresh,
      });
  }
  async function send(leaving: boolean) {
    bank();
    const session = studentSession();
    if (!session || !queue.length) {
      if (!session) queue.length = 0;
      return;
    }
    const deltas = queue.splice(0, MAX_DELTAS);
    try {
      const response = await fetch("/api/v1/school/student/activity", {
        method: "POST",
        keepalive: leaving,
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deltas: deltas.map((d) => ({
            ...d,
            activeMs: Math.min(90_000, d.activeMs),
          })),
        }),
      });
      if (!response.ok && response.status !== 401)
        console.warn("Student activity not saved", response.status);
    } catch (error) {
      console.warn("Student activity not saved", error);
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
  current = {
    noteProblem(id) {
      if (id === problemId) return;
      bank();
      problemId = id;
    },
  };
  return {
    navigate(path: string) {
      const next = surfaceOf(path.split(/[?#]/)[0]);
      if (next === surface) return;
      bank();
      surface = next;
      problemId = undefined;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      current = null;
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
