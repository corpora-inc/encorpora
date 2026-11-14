import type { SignedInMe } from "../../../account/contracts";
import { AppError } from "../../lib/AppError";
import { addressedIdentity, type AddressedIdentity } from "../spaces/identity";
import { hasHome } from "../onboarding/guard";
import { returnTarget } from "../../lib/return-to";
import { rootRedirect } from "../../nav/root";
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
/** The address key that names whose learning screens these are. */
export const LEARNER_KEY = "learner";

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
  LEARNING.some((path) => pathname === path || pathname.startsWith(`${path}/`));

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
  // Practice at a level returns to its grade and pace, to choose again.
  if (/^\/me\/level(?:[?#]|$)/.test(from))
    return { label: "Change level", short: "Change level" };
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
  // The address names whose screen this is (features/spaces/identity.ts): a
  // profile or a learner this account doesn't read is unavailable, never
  // someone else. Nothing here changes this device's choice: a guard also
  // runs for preloads and for navigations that never show, so the shell
  // adopts the named learner once its screen is on view (AppShell).
  const named = addressedIdentity(location.pathname, location.search);
  if (named && !readsIdentity(me, named))
    throw new AppError(
      "permission",
      named.kind === "profile"
        ? "This practice profile isn’t available to your account."
        : "This learner isn’t available to your account.",
      false,
    );
  if (named?.kind === "profile") {
    const [, org] = PLACE.exec(modeFrom(location.search) ?? "") ?? [];
    if (org) await preload(classesOptions(session, org));
    return;
  }
  const own = me.adultPractice?.learner?.id ?? null;
  if (
    !own &&
    !hasHome(me) &&
    (me.staffOf?.length ?? 0) > 0 &&
    PRACTICE_ONLY.test(location.pathname)
  )
    throw rootRedirect();
}

/** This account reads the learner or profile an address names. */
export function readsIdentity(me: SignedInMe, named: AddressedIdentity) {
  if (named.kind === "profile")
    return !!me.practiceProfiles?.some((entry) => entry.id === named.id);
  return (
    named.id === me.adultPractice?.learner?.id ||
    me.learners.some((learner) => learner.id === named.id) ||
    (me.secondParentOf ?? []).some((family) =>
      family.learners.some((learner) => learner.id === named.id),
    )
  );
}

/**
 * The device's choice once a screen is on view (called by the shell with the
 * committed address): the learner or profile the address names, the adult's
 * own on `/me`, and a profile left chosen is put down on a learning screen
 * that names none. Returns the choice to make, or undefined for none.
 */
export function committedChoice(
  me: SignedInMe,
  pathname: string,
  search: Record<string, unknown>,
  current: string | null,
): string | null | undefined {
  const own = me.adultPractice?.learner?.id ?? null;
  if (pathname === "/me") return own && current !== own ? own : undefined;
  if (!isLearningPath(pathname) && !/^\/learners\//.test(pathname))
    return undefined;
  const named = addressedIdentity(pathname, search);
  if (named)
    return readsIdentity(me, named) && current !== named.id
      ? named.id
      : undefined;
  if (me.practiceProfiles?.some((entry) => entry.id === current))
    return own ?? me.learners[0]?.id ?? null;
  return undefined;
}

type Place = { pathname: string; search: Record<string, unknown> };
const START = /^\/start(?:\/|$)/;

/**
 * The address keys a move carries from here to there, or null (one rule,
 * docs/architecture/spaces.md, "Learning screens"):
 * - between the starter's steps, where adding a place returns (`from`);
 * - between learning screens, whose they are: a practice profile (with its
 *   `from`), which outranks `?learner=`, or else the learner named here.
 * A destination that names its own learner or profile (`explicit`, the keys
 * the caller set) replaces the one here; a profile and a learner never
 * travel together.
 */
export function carriedKeys(
  here: Place,
  next: Place,
  explicit: readonly string[],
): Record<string, unknown> | null {
  const from = here.search.from;
  if (
    typeof from === "string" &&
    START.test(here.pathname) &&
    START.test(next.pathname) &&
    next.search.from === undefined &&
    !explicit.includes("from")
  )
    return { from };
  if (!isLearningPath(here.pathname) || !isLearningPath(next.pathname))
    return null;
  if (
    explicit.includes("profile") ||
    explicit.includes(LEARNER_KEY) ||
    next.search.profile !== undefined ||
    next.search[LEARNER_KEY] !== undefined
  )
    return null;
  if (typeof here.search.profile === "string")
    return Object.fromEntries(
      MODE_KEYS.filter((key) => here.search[key] !== undefined).map((key) => [
        key,
        here.search[key],
      ]),
    );
  const learner = here.search[LEARNER_KEY];
  return typeof learner === "string" ? { [LEARNER_KEY]: learner } : null;
}
