import type { Me, SignedInMe } from "../../../account/contracts";
import { AppError } from "../../lib/AppError";
import {
  learningIdentity,
  practiceParams,
  practicePath,
  selfOf,
  type AddressedIdentity,
} from "../spaces/identity";
import { nativeRuntime } from "../../native-runtime";
import { canonicalLearning } from "../spaces/learner-urls";
import { familyPlacesOptions } from "../family/api";
import { currentLearner, selectLearner } from "../../learner-store";
import type { AnyRouter } from "@tanstack/react-router";
import { hasHome } from "../onboarding/guard";
import { returnTarget } from "../../lib/return-to";
import { meKey, meOptions, queryClient, sessionOptions } from "../../lib/query";
import type { AuthSession } from "../../auth";
import { studentSession } from "../../lib/student-device";
import { classesOptions, preload } from "../school/core-api";
import { modeReturn, setModeReturn } from "./mode-return";

/*
 * Practicing as someone else is a mode nested in a place (docs/design/ia.md,
 * "Places and modes"). A profile is the adult's learner, so its practice is
 * at its own address, `/practice/<profile>`; the mode is the account's
 * current learner (learner-store.ts) being one of its profiles, and while it
 * is, the shared learning screens that name nobody are the profile's
 * (features/spaces/identity.ts `selfOf`). Its way back ("Back to Grade 5
 * Math") is the account's mode return (mode-return.ts). Nothing of it rides
 * in a query string; an older `?profile=&from=` link is an
 * app/legacy-aliases.ts row (`olderLearningHref`).
 */

/** An older link's key that named whose learning screen it was. */
const LEARNER_KEY = "learner";

/** The shared learning screens. */
export const LEARNING_PATHS = [
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
  LEARNING_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

/** Practice as a profile (the caller has made it the current learner:
 * api.ts `choosePracticeProfile`), returning to `from` (an internal path):
 * its practice's address, with where the mode returns recorded. Called as
 * the mode starts, from a person's own choice. */
export function practiceAs(profile: string, from?: string) {
  setModeReturn(modeFrom(from) ?? null);
  return { to: "/$" as const, params: practiceParams(profile) };
}

/** Where a practice mode may return: a place, never a learning screen. */
export function modeFrom(value: unknown) {
  const from = returnTarget(value);
  return from && !isLearningPath(new URL(from, "https://amp.invalid").pathname)
    ? from
    : undefined;
}

/** A guard's read that failed: logged, and the guard lets the screen open,
 * whose own query shows the failure. (This module is in the entry bundle,
 * so it logs to the console rather than load lib/report-error.ts.) */
const carryOn =
  (doing: string) =>
  (error: unknown): null => {
    console.warn(`AMP couldn’t ${doing}`, error);
    return null;
  };

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
 * Before a learning screen loads: whose it is, from its address and self
 * (features/spaces/identity.ts).
 * - A learner or profile this account doesn't read is unavailable.
 * - Practicing as a profile: the name of where the mode returns is loaded,
 *   so its way back paints whole.
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
    .catch(carryOn("read the account for practice"));
  if (!me?.signedIn) return;
  // The address names whose screen this is (features/spaces/identity.ts): a
  // profile or a learner this account doesn't read is unavailable, never
  // someone else. Nothing here changes the current learner: a guard also
  // runs for preloads and for navigations that never show
  // (followResolvedLearner adopts it once the navigation resolves).
  const named = learningIdentity(
    location.pathname,
    location.search,
    selfOf(me, currentLearner(session.accountId)),
    me,
  );
  if (named && !readsIdentity(me, named))
    throw new AppError(
      "permission",
      named.kind === "profile"
        ? "This practice profile isn’t available to your account."
        : "This learner isn’t available to your account.",
      false,
    );
  if (named?.kind === "profile") {
    const [, org] = PLACE.exec(modeReturn(session.accountId) ?? "") ?? [];
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
    throw await (await import("../home/destination")).homeRedirect();
}

/** Whose practice bare `/practice` meant: a school student's own learner;
 * an older link's `?learner=`; self (the profile practiced as, else the
 * adult's own); else the account's current
 * child (learner-store.ts), else its first. Null: nobody to practice. */
export function practiceLearnerFor(
  me: SignedInMe,
  named: string | null,
  chosen: string | null,
): string | null {
  if (me.account.kind === "student") return me.learners[0]?.id ?? null;
  if (named) return named;
  const self = selfOf(me, chosen);
  if (self?.kind === "profile") return self.id;
  const own = me.adultPractice?.learner?.id;
  if (own) return own;
  const children = [
    ...me.learners,
    ...(me.secondParentOf ?? []).flatMap((family) => family.learners),
  ];
  return (
    children.find((entry) => entry.id === chosen)?.id ?? children[0]?.id ?? null
  );
}

/** A school student's practice address, from the account already loaded:
 * synchronous, for a guard sending a student home (bare `/practice`, one
 * more hop, only before their `/me` has loaded). */
export function studentPracticeHref() {
  const student = studentSession();
  const me = student
    ? queryClient.getQueryData<Me>(meKey(student.accountId))
    : undefined;
  const learner = me?.signedIn ? me.learners[0]?.id : undefined;
  return learner ? practicePath(learner) : "/practice";
}

/** A school student's addresses that are a family's (its setup, buying,
 * consent): their practice is their one place (the route's guard sends
 * them, app/sign-in-gate.ts `admit`). */
export const notAStudents = (pathname: string) =>
  /^\/(?:family|purchase|consent)(?:\/|$)/.test(pathname);

/** The keys an older learning link carried, and practice's older filter. */
const OLDER_KEYS = [LEARNER_KEY, "profile", "from"];
const FOCUS_KEYS = ["template", "skill", "strand"] as const;

/**
 * Where an older learning address opens now (app/legacy-aliases.ts rows;
 * one hop, replacing it), or undefined when it isn't old for this person:
 * - bare `/practice` names nobody: `/practice/<learner>` (whose:
 *   `practiceLearnerFor`); practice's filter (`?skill=`, `?strand=`,
 *   `?template=`) is the address's own focus (identity.ts `practicePath`);
 * - `?profile=&from=` (practicing as a profile, from before the mode was
 *   the current learner): that profile becomes the current learner, where
 *   it returns is recorded (mode-return.ts), and the screen opens without
 *   them (practice at `/practice/<profile>`);
 * - `?learner=`, and a parent with no practice of their own on a shared
 *   screen that names nobody: the canonical address
 *   (features/spaces/learner-urls.ts). A learner this account doesn't read
 *   stays, for `adoptPracticeMode` to refuse.
 */
export async function olderLearningHref(old: {
  pathname: string;
  searchStr: string;
}): Promise<string | undefined> {
  if (nativeRuntime || !isLearningPath(old.pathname)) return undefined;
  const params = new URLSearchParams(old.searchStr);
  // Practice (`/practice`, `/practice/<learner>`) and its older filter.
  const practice = /^\/practice(?:\/([^/]+))?\/?$/.exec(old.pathname);
  const focus = Object.fromEntries(
    FOCUS_KEYS.map((key) => [key, params.get(key) || undefined]),
  );
  if (practice?.[1] && !params.has("profile") && !params.has(LEARNER_KEY)) {
    // Its learner named, only the filter is old: no account needed.
    for (const key of FOCUS_KEYS) params.delete(key);
    const path = practicePath(decodeURIComponent(practice[1]), focus);
    return `${path}${params.size ? `?${params}` : ""}`;
  }
  const bare = !!practice && !practice[1];
  if (studentSession() && !bare) return undefined;
  const session = await queryClient
    .ensureQueryData(sessionOptions)
    .catch(carryOn("read the session for a learning address"));
  if (!session) return undefined;
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch(carryOn("read the account for a learning address"));
  if (!me?.signedIn) return undefined;
  // An older link's profile, if it is one of this account's and the path
  // names nobody: the mode.
  const profile = params.get("profile");
  const asProfile =
    !!profile &&
    !practice?.[1] &&
    !!me.practiceProfiles?.some((entry) => entry.id === profile);
  if (asProfile) {
    selectLearner(profile, me.account.id);
    setModeReturn(modeFrom(params.get("from")) ?? null, me.account.id);
  }
  const chosen = currentLearner(me.account.id);
  const named = asProfile ? null : params.get(LEARNER_KEY) || null;
  for (const key of OLDER_KEYS) if (key !== LEARNER_KEY) params.delete(key);
  if (practice) {
    const learner = practice[1]
      ? decodeURIComponent(practice[1])
      : practiceLearnerFor(me, named, chosen);
    if (!learner) return undefined;
    params.delete(LEARNER_KEY);
    for (const key of FOCUS_KEYS) params.delete(key);
    return `${practicePath(learner, focus)}${params.size ? `?${params}` : ""}`;
  }
  const here = `${old.pathname}${params.size ? `?${params}` : ""}`;
  // Only an older key, or a parent with no practice of their own, can have
  // another address; a child's family id comes from the account's places.
  if (me.account.kind === "student") return undefined;
  const canonical =
    params.has(LEARNER_KEY) || !me.adultPractice?.learner
      ? canonicalLearning(
          old.pathname,
          params,
          me,
          await queryClient
            .ensureQueryData(familyPlacesOptions(session))
            .catch(carryOn("read the family places for a learning address")),
          chosen,
        )
      : null;
  const href = canonical ?? here;
  return href !== `${old.pathname}${old.searchStr}` ? href : undefined;
}

/** The learner a resolved navigation's address names becomes the account's
 * current one (learner-store.ts). */
function adoptChoice(
  me: SignedInMe,
  location: { pathname: string; search: Record<string, unknown> },
) {
  const choice = committedChoice(
    me,
    location.pathname,
    location.search,
    currentLearner(me.account.id),
  );
  if (choice !== undefined) selectLearner(choice, me.account.id);
}

/**
 * The router's one writer of the current learner (learner-store.ts): when a
 * navigation resolves (its screen is the one on view), the learner its
 * address names becomes the account's current one. A preload, a navigation
 * still loading and one abandoned never resolve, so they choose nobody. An
 * event, never a screen's effect; a school student's address names their
 * one learner, so their session chooses nothing.
 */
export function followResolvedLearner(router: Pick<AnyRouter, "subscribe">) {
  return router.subscribe("onResolved", ({ toLocation }) => {
    if (studentSession()) return;
    const session = queryClient.getQueryData<AuthSession | null>(
      sessionOptions.queryKey,
    );
    const me = session
      ? queryClient.getQueryData<Me>(meKey(session.accountId))
      : undefined;
    if (me?.signedIn && me.account.id === session?.accountId)
      adoptChoice(me, {
        pathname: toLocation.pathname,
        search: toLocation.search as Record<string, unknown>,
      });
  });
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
 * committed address): the learner or profile the address names (a family's
 * child by their path, a profile by its practice's), and the adult's own on
 * `/me`. A shared learning screen that names nobody is self's (the profile
 * practiced as, else the adult's own: identity.ts `selfOf`), so practicing
 * as a profile stays until a person leaves it. Returns the choice to make,
 * or undefined for none.
 */
export function committedChoice(
  me: SignedInMe,
  pathname: string,
  search: Record<string, unknown>,
  current: string | null,
): string | null | undefined {
  const own = me.adultPractice?.learner?.id ?? null;
  if (pathname === "/me") return own && current !== own ? own : undefined;
  if (
    !isLearningPath(pathname) &&
    !/^\/(?:learners|family\/[^/]+\/kids)\//.test(pathname)
  )
    return undefined;
  // An unnamed shared learning screen is self's.
  const named = learningIdentity(pathname, search, selfOf(me, current), me);
  if (named)
    return readsIdentity(me, named) && current !== named.id
      ? named.id
      : undefined;
  if (me.practiceProfiles?.some((entry) => entry.id === current))
    return own ?? me.learners[0]?.id ?? null;
  return undefined;
}
