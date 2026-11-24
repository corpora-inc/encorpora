import { z } from "zod";
import { studentGrantResource } from "../../schools/contracts";
import { accessSession, notifyDeviceSessionChanged } from "../auth";
import { isLearningPath } from "../features/profiles/practice-mode";
import {
  addressedIdentity,
  namesLearnerByPath,
} from "../features/spaces/identity";
import { childFamily } from "../features/spaces/learner-urls";
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
/** What the server says when this adult may not hand the device to this
 * child now (no access yet, or not a child of a family of theirs). */
const REFUSED = new Set(["learner_cannot_practice", "learner_not_found"]);

/**
 * A child's practice named by its address alone, in a tab that is an
 * adult's: `/practice/<child>` typed, bookmarked, on a home screen, in an
 * older link, a plain link in the app, or a first run's last step. A
 * child's practice is always the child's own sign-in, so the address is
 * enough to hand the device over, as "Practice" does; the way back is the
 * child's family. Null for anyone else's practice (the adult's own, a
 * practice profile, a learner this account doesn't read: their screens are
 * unchanged).
 */
async function addressedChild(
  pathname: string,
): Promise<FamilyPracticeEntry | null> {
  if (!namesLearnerByPath(pathname) || !pathname.startsWith("/practice/"))
    return null;
  const learnerId = addressedIdentity(pathname)?.id;
  if (!learnerId) return null;
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session || session.accountId.startsWith("school:")) return null;
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch((error: unknown) => {
      console.warn(
        "AMP couldn’t read the account for a child’s practice",
        error,
      );
      return null;
    });
  if (!me?.signedIn) return null;
  const family = childFamily(me, learnerId);
  const entry = marker.safeParse({
    learnerId,
    returnTo: `/family/${family}`,
  });
  return family && entry.success ? entry.data : null;
}

/**
 * The parent takes back the device they handed to their child, with no
 * reload: what the way home does on its way (below), for a control that
 * opens one of the parent's own screens itself ("Continue with AMP" at the
 * free problems' end). Returns the parent's sign-in, or null if it ended.
 */
export async function takeDeviceBack() {
  clearStudentDevice();
  const parent = await accessSession();
  notifyDeviceSessionChanged(parent, { handoff: true });
  return parent;
}

async function reconcile(
  location: { pathname: string; state: unknown },
  signal: AbortSignal,
) {
  const marked = isLearningPath(location.pathname)
    ? familyPracticeEntry(location.state)
    : null;
  const student = studentSession();
  const handed = handedStudentDevice();
  // No hand-over recorded and nobody's sign-in in this tab but the adult's:
  // the address may still name a child of theirs.
  const named =
    !marked && !student ? await addressedChild(location.pathname) : null;
  signal.throwIfAborted();
  const wanted = marked ?? named;
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
  // interrupted finishes): a family handoff. A tab that was the adult's all
  // along (an address alone) has nothing to take back.
  if (marked || leaving || interruptedReturn)
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
  ).catch((failure: unknown) => {
    // An address this adult may not hand over (the child has no access
    // yet): the screen opens on the adult's sign-in and says so, as it
    // always did. Never a dead end.
    if (
      named &&
      failure instanceof AppError &&
      failure.code &&
      REFUSED.has(failure.code)
    ) {
      console.warn("This child’s practice wasn’t handed over", failure.code);
      return null;
    }
    throw failure;
  });
  if (!grant) return;
  signal.throwIfAborted();
  const session = { accountId: grant.accountId, token: grant.token };
  rememberStudentSession(session, grant.mode, true, wanted.returnTo);
  notifyDeviceSessionChanged(session, { handoff: true });
  await queryClient.ensureQueryData(meOptions(session));
  signal.throwIfAborted();
}
