import { redirect } from "@tanstack/react-router";
import type { SignedInMe } from "../../../account/contracts";
import { useLearnerStore } from "../../learner-store";
import { hasHome } from "../onboarding/guard";
import { returnTarget } from "../../lib/return-to";
import { meOptions, queryClient, sessionOptions } from "../../lib/query";
import { studentSession } from "../../lib/student-device";
import { classesOptions, preload } from "../school/api";

/*
 * Practicing as someone else is a mode nested in a place (docs/design/ia.md,
 * "Places and modes"). It lives in the address, never only on the device:
 *
 *   /practice?profile=<the profile>&from=<where it was started>
 *
 * so refresh, Back and Forward reopen exactly that mode, and its way back
 * ("Back to Grade 5 Math") returns to where it was started (lib/return-to.ts).
 * Learning screens reached inside the mode carry both keys (app/router.tsx).
 */

/** The address keys that hold the practice mode. */
export const MODE_KEYS = ["profile", "from"] as const;

/** Learning screens: where a practice mode goes with the reader. */
const LEARNING = [
  "/practice",
  "/overview",
  "/progress",
  "/lessons",
  "/books",
  "/pathways",
  "/inventory",
];
/** Screens that are only someone's practice (no curriculum to browse). */
const PRACTICE_ONLY = /^\/(?:practice|overview|progress|books)(?:\/|$)/;
export const isLearningPath = (pathname: string) =>
  LEARNING.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

/** Practice as a profile, returning to `from` (an internal path). */
export function practiceAs(profile: string, from?: string) {
  const back = returnTarget(from);
  return {
    to: "/$" as const,
    params: { _splat: "practice" },
    search: { profile, ...(back ? { from: back } : {}) } as never,
  };
}

/** Where a practice mode returns: a place, never another learning screen. */
export function modeFrom(search: Record<string, unknown>) {
  const from = returnTarget(search.from);
  return from && !isLearningPath(new URL(from, "https://amp.invalid").pathname)
    ? from
    : undefined;
}

const PLACE = /^\/school\/([^/?#]+)(?:\/classes\/([^/?#]+))?/;

/** The school and class a mode returns to, from its `from`. */
export function modePlace(from: string | undefined) {
  const [, org, classId] = PLACE.exec(from ?? "") ?? [];
  return { org, classId };
}

/** "Back to Grade 5 Math": the class it was started from, else its school. */
export function modeReturnLabel(
  from: string,
  me: SignedInMe | null | undefined,
  classes: { id: string; name: string }[] | undefined,
) {
  const { org, classId } = modePlace(from);
  const name =
    (classId && classes?.find((entry) => entry.id === classId)?.name) ||
    me?.staffOf?.find((place) => place.orgId === org)?.orgName;
  return name
    ? { label: `Back to ${name}`, short: name }
    : { label: "Back to where you were", short: "Back" };
}

/**
 * Before a learning screen loads: the address chooses who practices.
 * - `?profile=` names one of the account's profiles: practice as it, and
 *   load the name of where it returns, so its way back paints whole.
 * - Without it, a profile left chosen on the device is put down: the screen
 *   is the account's own.
 * - An account with a place and nothing of its own to practice (staff,
 *   a demo school's admin) goes from practice screens to its place: never
 *   family setup.
 */
export async function adoptPracticeMode(location: {
  pathname: string;
  search: Record<string, unknown>;
}) {
  if (studentSession() || !isLearningPath(location.pathname)) return;
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) return;
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch(() => null);
  if (!me?.signedIn) return;
  const store = useLearnerStore.getState();
  const named = location.search.profile;
  const profile = me.practiceProfiles?.find((entry) => entry.id === named);
  if (profile) {
    if (store.learnerId !== profile.id) store.select(profile.id);
    const [, org] = PLACE.exec(modeFrom(location.search) ?? "") ?? [];
    if (org) await preload(classesOptions(session, org));
    return;
  }
  const own = me.adultPractice?.learner?.id ?? null;
  if (me.practiceProfiles?.some((entry) => entry.id === store.learnerId))
    store.select(own ?? me.learners[0]?.id ?? null);
  if (
    !own &&
    !hasHome(me) &&
    (me.staffOf?.length ?? 0) > 0 &&
    PRACTICE_ONLY.test(location.pathname)
  )
    throw redirect({ to: "/", replace: true });
}
