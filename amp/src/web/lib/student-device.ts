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
 * URLs can carry a card's secret and which a parent has no reason to open. */
export function isStudentDevice(): boolean {
  return (
    !!studentSession() ||
    /^\/(join|c)(\/|$)/.test(globalThis.location?.pathname ?? "")
  );
}
export function rememberStudentSession(
  session: StudentSession,
  mode: "shared" | "personal",
) {
  clearStudentDevice();
  const store = mode === "shared" ? sessionStorage : localStorage;
  store.setItem(studentKey, JSON.stringify(session));
}
export function clearStudentDevice() {
  for (const [store, keys] of [
    [() => sessionStorage, [studentKey]],
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
