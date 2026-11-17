import { z } from "zod";
import { studentGrantResource } from "../../schools/contracts";
import { accessSession, notifyDeviceSessionChanged } from "../auth";
import { isLearningPath } from "../features/profiles/practice-mode";
import { request } from "./api";
import { AppError } from "./AppError";
import { meOptions, queryClient, sessionOptions } from "./query";
import {
  clearStudentDevice,
  handedStudentDevice,
  rememberStudentSession,
  studentSession,
} from "./student-device";

const marker = z.object({
  learnerId: z.uuid(),
  returnTo: z
    .string()
    .max(8192)
    .regex(/^\/(?!\/)[^\s\\]*$/),
});
export type FamilyPracticeEntry = z.infer<typeof marker>;
declare module "@tanstack/history" {
  interface HistoryState {
    ampFamilyPractice?: FamilyPracticeEntry;
  }
}
const KEY = "ampFamilyPractice";

/** History records who the practice entry is for, never a session credential.
 * Forward must authorize that child again, not fall back to the adult learner. */
export function familyPracticeEntry(
  state: unknown,
): FamilyPracticeEntry | null {
  const parsed = marker.safeParse(
    state && typeof state === "object"
      ? (state as Record<string, unknown>)[KEY]
      : undefined,
  );
  return parsed.success ? parsed.data : null;
}
export function familyPracticeState(entry: FamilyPracticeEntry) {
  return { [KEY]: entry };
}
/** Lessons, films and filtered practice belong to the same child session. */
export function carryFamilyPractice(
  pathname: string,
  next: object | undefined,
  current: unknown,
): object {
  const result = { ...next } as Record<string, unknown>;
  const entry = familyPracticeEntry(next) ?? familyPracticeEntry(current);
  if (handedStudentDevice() && isLearningPath(pathname) && entry)
    result[KEY] = entry;
  else delete result[KEY];
  return result;
}

/** Reconcile a committed navigation before any route reads account data.
 * Preloading a link must never change who's using the device. */
let transition:
  | { key: string; controller: AbortController; promise: Promise<void> }
  | undefined;
export function restoreFamilyPractice(location: {
  href: string;
  pathname: string;
  state: unknown;
}) {
  const key = JSON.stringify([location.href, location.state]);
  // Changing identity remounts the router. Both loads await the same switch;
  // the remount must not start a second grant or cancel its own session read.
  if (transition?.key === key) return transition.promise;
  transition?.controller.abort();
  const controller = new AbortController();
  const promise = Promise.resolve()
    .then(() => reconcile(location, controller.signal))
    .catch((error) => {
      if (transition?.promise === promise) transition = undefined;
      throw error;
    });
  transition = { key, controller, promise };
  return promise;
}
async function reconcile(
  location: { pathname: string; state: unknown },
  signal: AbortSignal,
) {
  const wanted = isLearningPath(location.pathname)
    ? familyPracticeEntry(location.state)
    : null;
  const student = studentSession();
  const handed = handedStudentDevice();
  if (wanted && student) {
    const me = await queryClient.ensureQueryData(meOptions(student));
    signal.throwIfAborted();
    if (handed && me.signedIn && me.learners[0]?.id === wanted.learnerId)
      return;
    if (!handed)
      throw new AppError(
        "permission",
        "This practice belongs to a different learner.",
        false,
      );
  }
  // A parent landing on their own screen ends the device handoff. A school's
  // independent student session does not gain the parent's cookie this way.
  const leaving = handed && (!isLearningPath(location.pathname) || !!wanted);
  const interruptedReturn =
    !student &&
    queryClient
      .getQueryData(sessionOptions.queryKey)
      ?.accountId.startsWith("school:");
  if (!wanted && !leaving && !interruptedReturn) return;
  if (leaving) clearStudentDevice();
  signal.throwIfAborted();
  const parent = await accessSession();
  signal.throwIfAborted();
  // The parent takes back the device they handed over (or a return that was
  // interrupted finishes): a family handoff.
  notifyDeviceSessionChanged(parent, { handoff: true });
  if (!wanted) return;
  if (!parent || parent.accountId.startsWith("school:"))
    throw new AppError(
      "authentication",
      "Sign in to open this child's practice.",
      true,
    );
  const grant = await request(
    `/family/learners/${wanted.learnerId}/practice-here`,
    studentGrantResource,
    { token: parent.token, body: {}, signal },
  );
  signal.throwIfAborted();
  const session = { accountId: grant.accountId, token: grant.token };
  rememberStudentSession(session, grant.mode, true, wanted.returnTo);
  notifyDeviceSessionChanged(session, { handoff: true });
  await queryClient.ensureQueryData(meOptions(session));
  signal.throwIfAborted();
}
