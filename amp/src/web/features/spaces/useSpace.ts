import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouterState } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import { useCurrentLearner } from "../../learner-store";
import { AppError, refused, standing } from "../../lib/AppError";
import { isConfirmed } from "../../lib/session-generation";
import { hasAccountContext } from "../../lib/account-page";
import { meOptions, queryClient } from "../../lib/query";
import type { AuthSession } from "../../auth";
import { useSessionOrNull } from "../../lib/session";
import {
  classesOptions,
  classYearOptions,
  orgOptions,
  pilotOptions,
} from "../school/core-api";
import { familyOptions, familyPlacesOptions } from "../family/api";
import { lookFirst } from "../practice/look-ahead";
import { shellFrame } from "../navigation/shell-frame";
import {
  resolveSpace,
  type SpaceDescriptor,
  type SpaceMatch,
  type SpaceSession,
} from "./resolve";
import type { RouteSpace } from "./space";
import { logAhead } from "../../lib/ahead";

type MatchLike = {
  pathname: string;
  status: string;
  params?: Record<string, unknown>;
  /** The search this match was loaded with: the displayed route's own. */
  search?: Record<string, unknown>;
  staticData?: { space?: RouteSpace };
};

/** The space a route declares: its deepest match that says. */
function declared(matches: readonly MatchLike[]): RouteSpace | undefined {
  for (let index = matches.length - 1; index >= 0; index--) {
    const space = matches[index]!.staticData?.space;
    if (space) return space;
  }
  return undefined;
}

/** The displayed route, whole: its pathname, parameters and search all from
 * the same (displayed) matches, never the address still loading. */
function matchOf(matches: readonly MatchLike[]): SpaceMatch | null {
  const leaf = matches.at(-1);
  if (!leaf || leaf.status !== "success") return null;
  const search = leaf.search ?? {};
  const learner = leaf.params?.learnerId;
  return {
    pathname: leaf.pathname,
    space: declared(matches),
    search,
    ...(typeof learner === "string" ? { learner } : {}),
  };
}

/** The route the screen on view belongs to: its pathname, parameters and
 * search from one displayed-route snapshot. A route still loading, or one
 * abandoned on the way, changes nothing (features/spaces/identity.ts reads
 * the same committed address). `null` until a first route has settled. */
export function useSettledMatch(): SpaceMatch | null {
  // One string per settled route, so an unrelated router change (a pending
  // load) never makes a new match.
  const key = useRouterState({
    select: (state) =>
      JSON.stringify(matchOf(state.matches as unknown as MatchLike[])),
  });
  const settled = useMemo(() => JSON.parse(key) as SpaceMatch | null, [key]);
  const last = useRef<SpaceMatch | null>(null);
  if (settled) last.current = settled;
  return settled ?? last.current;
}

/** The live address, for a drawer outside the app frame. */
export function useLocationMatch(): SpaceMatch {
  const location = useLocation();
  return {
    pathname: location.pathname,
    search: location.search as Record<string, unknown>,
  };
}

/**
 * The space of a route (features/spaces/resolve.ts), from the resources its
 * screen already loaded: the session, this account's `/me`, the chosen
 * learner, and the org, classes, year and practice the route names. Every
 * request is keyed by the account and the resource, a response for another
 * account or place is never read, and the result is recomputed whenever any
 * of them changes (a sign-out, an ended role, a refetch): it is a render
 * snapshot, never a cached grant.
 */
type Answer<T> = {
  data: T | undefined;
  error: unknown;
  isError: boolean;
};
/** A resource as the resolver reads it: undefined until answered (or after a
 * failed lookup, which `failed` reports), null once refused (`standing`).
 * Nothing a replaced session asked is ever cached (`retireSession`); a
 * same-account renewal keeps the account's answers until its own `/me`
 * fails (`unconfirmed`). */
const current = standing;
/** A request its own session no longer stands behind (it was replaced on
 * the way) is no answer at all: what was there stays. */
const replaced = (error: unknown) =>
  error instanceof AppError && error.code === "session_replaced";
const failedLookup = (query: Answer<unknown>) =>
  query.isError &&
  query.data === undefined &&
  !refused(query.error) &&
  !replaced(query.error);

/** A learner's own screen (a signed-in student's, any of them; anyone's
 * practice, `/practice/<learner>`) paints in their look from its first
 * frame: the look is read with the place (features/practice/look-ahead.ts
 * `lookFirst`). A student's learner comes with their account. */
async function lookAhead(
  session: AuthSession,
  student: boolean,
  pathname: string,
) {
  let learnerId = /^\/practice\/([^/]+)/.exec(pathname)?.[1];
  if (student) {
    const me = await queryClient
      .ensureQueryData(meOptions(session))
      .catch((error: unknown) => {
        logAhead("A student's look waits for their account", error);
        return undefined;
      });
    learnerId = me?.signedIn ? me.learners[0]?.id : undefined;
  } else if (learnerId) learnerId = decodeURIComponent(learnerId);
  if (!learnerId) return;
  await lookFirst({
    identity: session.accountId,
    learnerId,
    token: session.token,
  });
}

/**
 * Everything `useSpace` reads for a screen at `pathname`, in the one cache,
 * before the screen renders: the account and the place the address names
 * (its family, or its school, classes and year). The router awaits it for
 * every signed-in screen (app/router.tsx, the root's `beforeLoad`), so the
 * frame's first paint is already the place's, whole: never another place's
 * bar, a bar without its tabs, or "isn't available" for an account still
 * loading. A cached answer costs nothing, so a warm move paints at once. A
 * failed read is logged; the frame says it (`failed`).
 */
export async function loadSpaceFrame(
  session: AuthSession | null,
  pathname: string,
  search: Record<string, unknown> = {},
) {
  if (!session || !hasAccountContext(pathname)) return;
  const ahead = (options: { queryKey: readonly unknown[] }) =>
    queryClient.ensureQueryData(options as never).catch((error: unknown) => {
      logAhead("The screen's place didn’t load ahead", error);
    });
  const student = session.accountId.startsWith("school:");
  const frame = student
    ? null
    : shellFrame(
        pathname,
        typeof search.class === "string" ? search.class : undefined,
      );
  const orgId =
    frame?.kind === "class" || frame?.kind === "school" ? frame.org : "";
  const classId = frame?.kind === "class" ? frame.classId : "";
  const familyId = frame?.kind === "family" ? frame.family : "";
  await Promise.all([
    ahead(meOptions(session)),
    lookAhead(session, student, pathname),
    classId ? ahead(familyPlacesOptions(session)) : null,
    familyId ? ahead(familyOptions(session, familyId)) : null,
    classId ? ahead(classYearOptions(session, classId)) : null,
    orgId ? ahead(orgOptions(session, orgId)) : null,
    orgId ? ahead(classesOptions(session, orgId)) : null,
  ]);
  if (!classId) return;
  // Only an older server's year lacks the practice state the bar reads
  // (`useSpace`'s pilot read, on the same terms).
  const org = queryClient.getQueryData(orgOptions(session, orgId).queryKey);
  const year = queryClient.getQueryData(
    classYearOptions(session, classId).queryKey,
  );
  if (
    org?.kind === "school" &&
    org.demo !== true &&
    year &&
    year.practice === undefined &&
    (!!org.teaches?.includes(classId) || !!org.can?.includes("pilot.read"))
  )
    await ahead(pilotOptions(session, classId));
}

export function useSpace(match: SpaceMatch | null): SpaceDescriptor | null {
  const session = useSessionOrNull();
  const auth = session ?? { accountId: "", token: "" };
  const student = !!session?.accountId.startsWith("school:");
  // Public information, sign-in and the gallery never read the account
  // (lib/account-page.ts): a session that ended can't hold them up.
  const meQuery = useQuery({
    ...meOptions(auth),
    enabled: !!session && !!match && hasAccountContext(match.pathname),
  });
  // A refused `/me` means no relationships; a passing failure keeps the
  // last answer from this session.
  const me = refused(meQuery.error) ? undefined : meQuery.data;
  const account =
    me?.signedIn && me.account.id === session?.accountId ? me : null;
  const learnerId = useCurrentLearner();
  const frame =
    match && session && !student
      ? shellFrame(
          match.pathname,
          typeof match.search?.class === "string"
            ? match.search.class
            : undefined,
        )
      : null;
  const orgId =
    frame?.kind === "class" || frame?.kind === "school" ? frame.org : "";
  const classId = frame?.kind === "class" ? frame.classId : "";
  const families = useQuery({
    ...familyPlacesOptions(auth),
    enabled: !!classId && !!session && !student,
    refetchOnMount: false,
  });
  const familyId = frame?.kind === "family" ? frame.family : "";
  const family = useQuery({
    ...familyOptions(auth, familyId),
    enabled: !!familyId && !!session && !student,
    refetchOnMount: false,
  });
  const org = useQuery({
    ...orgOptions(auth, orgId),
    enabled: !!orgId,
    refetchOnMount: false,
  });
  const classes = useQuery({
    ...classesOptions(auth, orgId),
    enabled: !!orgId,
    refetchOnMount: false,
  });
  const year = useQuery({
    ...classYearOptions(auth, classId),
    enabled: !!classId,
    refetchOnMount: false,
  });
  const orgNow = current(org);
  // Only a real school's class has practice to start, and only an older
  // server's year read lacks the practice state; even then, only someone who
  // may read the class's pilot asks for it.
  const pilot = useQuery({
    ...pilotOptions(auth, classId),
    enabled:
      !!classId &&
      orgNow?.kind === "school" &&
      orgNow.demo !== true &&
      !!year.data &&
      year.data.practice === undefined &&
      (!!orgNow.teaches?.includes(classId) ||
        !!orgNow.can?.includes("pilot.read")),
    refetchOnMount: false,
  });
  if (!match) return null;
  const spaceSession: SpaceSession = !session
    ? { kind: "none" }
    : student || account?.account.kind === "student"
      ? { kind: "student", me: account }
      : { kind: "adult", me: account, learnerId };
  return resolveSpace(match, spaceSession, {
    // A `/me` that failed with nothing to show for this session (a new
    // sign-in whose account didn't load) fails the place too: its
    // relationships are unknown.
    failed: [org, classes, year, meQuery].some(failedLookup),
    // `/me` failed, and this session has no answer of its own from it (a
    // renewal whose account didn't load): what the screen shows is the old
    // session's, so none of it shows.
    unconfirmed:
      !!session &&
      meQuery.isError &&
      !refused(meQuery.error) &&
      !replaced(meQuery.error) &&
      !isConfirmed(session.token),
    org: orgNow,
    classes: current(classes) ?? null,
    year: current(year),
    // Coverage that can't be confirmed counts nobody as covered.
    covered: pilot.isError ? 0 : (pilot.data?.coverage?.covered ?? 0),
    family: current(family),
    families: current(families),
  });
}
