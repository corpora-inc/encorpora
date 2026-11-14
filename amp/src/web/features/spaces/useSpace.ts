import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouterState } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import { useLearnerStore } from "../../learner-store";
import { AppError } from "../../lib/AppError";
import { isConfirmed } from "../../lib/session-generation";
import { meOptions, sessionOptions } from "../../lib/query";
import { classesOptions, orgOptions } from "../school/api";
import { classYearOptions } from "../school/org/org-api";
import { pilotOptions } from "../school/pilots/api";
import { familyOptions, familyPlacesOptions } from "../family/api";
import { shellFrame } from "../navigation/shell-frame";
import {
  resolveSpace,
  type SpaceDescriptor,
  type SpaceMatch,
  type SpaceSession,
} from "./resolve";
import type { RouteSpace } from "./space";

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
/** An answer the server refused: the place is gone for this person (a
 * revoked role, a removed class), unlike a passing network failure. */
const refused = (error: unknown) =>
  error instanceof AppError &&
  (error.status === 401 || error.status === 403 || error.status === 404);

type Answer<T> = {
  data: T | undefined;
  error: unknown;
  isError: boolean;
};
/** A resource as the resolver reads it: undefined until answered (or after a
 * failed lookup, which `failed` reports), null once refused. Nothing a
 * replaced session asked is ever cached (`retireSession`); a same-account
 * renewal keeps the account's answers until its own `/me` fails
 * (`unconfirmed`). */
function current<T>(query: Answer<T>): T | null | undefined {
  // A refused lookup is no answer; a refetch that failed otherwise keeps the
  // last answer on screen.
  return query.isError && refused(query.error) ? null : query.data;
}
/** A request its own session no longer stands behind (it was replaced on
 * the way) is no answer at all: what was there stays. */
const replaced = (error: unknown) =>
  error instanceof AppError && error.code === "session_replaced";
const failedLookup = (query: Answer<unknown>) =>
  query.isError &&
  query.data === undefined &&
  !refused(query.error) &&
  !replaced(query.error);

export function useSpace(match: SpaceMatch | null): SpaceDescriptor | null {
  const session = useQuery(sessionOptions).data ?? null;
  const auth = session ?? { accountId: "", token: "" };
  const student = !!session?.accountId.startsWith("school:");
  const meQuery = useQuery({ ...meOptions(auth), enabled: !!session });
  // A refused `/me` means no relationships; a passing failure keeps the
  // last answer from this session.
  const me = refused(meQuery.error) ? undefined : meQuery.data;
  const account =
    me?.signedIn && me.account.id === session?.accountId ? me : null;
  const learnerId = useLearnerStore((state) => state.learnerId);
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
  const familyId = frame?.kind === "family" ? frame.family : "";
  const family = useQuery({
    ...familyOptions(auth, familyId),
    enabled: !!familyId && !!session && !student,
    refetchOnMount: false,
  });
  const families = useQuery({
    ...familyPlacesOptions(auth),
    enabled: !!classId && !!session && !student,
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
  // Only a real school's class has practice to start.
  const pilot = useQuery({
    ...pilotOptions(auth, classId),
    enabled: !!classId && orgNow?.kind === "school" && orgNow.demo !== true,
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
