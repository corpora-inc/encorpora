import { trialKey } from "./pending-trial";

/** A school student's sign-in on this device. Shared devices keep it in session
 * storage, so it ends with the tab; personal devices in local storage. It wins
 * over any parent session until the student signs out.
 *
 * A synchronous check on purpose: analytics and engagement consult it before
 * they start. This module imports nothing that could start them. */
const studentKey = "amp.student";
/** `useLearnerStore`'s persisted choice, which must not outlive the student. */
const learnerKey = "amp.learner";
/** When a shared device was last used, so a reload doesn't restart the clock. */
const activeKey = "amp.student.active";
/** A parent handed this device to their child ("Let Maya practice here"), so
 * signing out returns to the parent rather than to the class sign-in. */
const handedKey = "amp.student.handed";
export const STUDENT_IDLE_MS = 30 * 60_000;

export type StudentSession = { accountId: string; token: string };

function read(store: () => Storage): StudentSession | null {
  try {
    const saved: unknown = JSON.parse(store().getItem(studentKey) ?? "null");
    if (saved === null || typeof saved !== "object") return null;
    const { accountId, token } = saved as Record<string, unknown>;
    return typeof accountId === "string" &&
      accountId.startsWith("school:") &&
      typeof token === "string" &&
      token.startsWith("st_")
      ? { accountId, token }
      : null;
  } catch {
    return null;
  }
}
export function studentSession(): StudentSession | null {
  return read(() => sessionStorage) ?? read(() => localStorage);
}
/** Signed in as a student, or on the screens a student signs in from, whose
 * URLs can carry a card's secret and which a parent has no reason to open. A
 * family's progress link (`/p`) is held to the same silence: it can carry a
 * secret too, and nothing on it is measured. */
export function isStudentDevice(): boolean {
  return (
    !!studentSession() ||
    /^\/(join|c|p)(\/|$)/.test(globalThis.location?.pathname ?? "")
  );
}
export function rememberStudentSession(
  session: StudentSession,
  mode: "shared" | "personal",
  handed = false,
) {
  clearStudentDevice();
  const store = mode === "shared" ? sessionStorage : localStorage;
  store.setItem(studentKey, JSON.stringify(session));
  if (mode === "shared") store.setItem(activeKey, String(Date.now()));
  if (handed) sessionStorage.setItem(handedKey, "1");
}
/** This student's sign-in was handed over by a parent on their own device. */
export function handedStudentDevice(): boolean {
  try {
    return sessionStorage.getItem(handedKey) === "1";
  } catch {
    return false;
  }
}
export function clearStudentDevice() {
  for (const [store, keys] of [
    [() => sessionStorage, [studentKey, activeKey, handedKey]],
    [() => localStorage, [studentKey, learnerKey, trialKey]],
  ] as const)
    try {
      for (const key of keys) store().removeItem(key);
    } catch (error) {
      console.warn("Student sign-in not cleared", error);
    }
}
/** Parent-only routes also answer a student 401, so only `/me` can say that the
 * sign-in itself has ended. */
export async function studentSignInEnded(session: StudentSession) {
  const response = await fetch("/api/v1/me", {
    headers: { Authorization: `Bearer ${session.token}` },
    signal: AbortSignal.timeout(10000),
  });
  return response.status === 401;
}
/** A shared device signs out when it's left alone. Timers sleep with the tab,
 * so waking up checks too. A personal device, or no student, does nothing. */
export function watchStudentIdle(signOut: () => void) {
  const shared = () => !!read(() => sessionStorage);
  const check = () => {
    if (!shared()) return;
    const active = sessionStorage.getItem(activeKey);
    if (active === null) sessionStorage.setItem(activeKey, String(Date.now()));
    else if (Date.now() - Number(active) >= STUDENT_IDLE_MS) signOut();
  };
  let last = 0;
  const used = () => {
    if (!shared() || Date.now() - last < 5000) return;
    check();
    last = Date.now();
    if (shared()) sessionStorage.setItem(activeKey, String(last));
  };
  const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
  for (const event of events)
    window.addEventListener(event, used, { capture: true, passive: true });
  document.addEventListener("visibilitychange", check);
  window.addEventListener("pageshow", check);
  const timer = setInterval(check, 15_000);
  check();
  return () => {
    for (const event of events)
      window.removeEventListener(event, used, { capture: true });
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("pageshow", check);
    clearInterval(timer);
  };
}
