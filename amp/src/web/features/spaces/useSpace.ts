import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouterState } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import { useLearnerStore } from "../../learner-store";
import { AppError } from "../../lib/AppError";
import { meOptions, sessionOptions } from "../../lib/query";
import { classesOptions, orgOptions } from "../school/api";
import { classYearOptions } from "../school/org/org-api";
import { pilotOptions } from "../school/pilots/api";
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

function matchOf(
  matches: readonly MatchLike[],
  search: Record<string, unknown>,
): SpaceMatch | null {
  const leaf = matches.at(-1);
  if (!leaf || leaf.status !== "success") return null;
  const learner = leaf.params?.learnerId;
  return {
    pathname: leaf.pathname,
    space: declared(matches),
    search,
    ...(typeof learner === "string" ? { learner } : {}),
  };
}

/** The route the screen on view belongs to: a route still loading (or
 * redirecting) keeps the one before, so nothing changes for a screen that
 * never shows. `null` until a first route has settled. */
export function useSettledMatch(): SpaceMatch | null {
  // One string per settled route, so an unrelated router change (a pending
  // load) never makes a new match.
  const key = useRouterState({
    select: (state) =>
      JSON.stringify(
        matchOf(
          state.matches as unknown as MatchLike[],
          state.location.search as Record<string, unknown>,
        ),
      ),
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
/**
 * The session's generation is when it was established: a sign-in again as
 * the same account (a new token, the same query keys) starts a new one, and
 * every answer from before it stays unread until it is asked again.
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
  dataUpdatedAt: number;
};
/** A resource as the resolver reads it: undefined until answered in this
 * session's generation, null once refused or failed. */
function current<T>(query: Answer<T>, since: number): T | null | undefined {
  if (query.isError) return null;
  return query.dataUpdatedAt >= since ? query.data : undefined;
}

export function useSpace(match: SpaceMatch | null): SpaceDescriptor | null {
  const sessionQuery = useQuery(sessionOptions);
  const session = sessionQuery.data ?? null;
  const since = sessionQuery.dataUpdatedAt;
  const auth = session ?? { accountId: "", token: "" };
  const student = !!session?.accountId.startsWith("school:");
  const meQuery = useQuery({ ...meOptions(auth), enabled: !!session });
  // A refused `/me` means no relationships; a passing failure keeps the
  // last answer from this session.
  const me = refused(meQuery.error)
    ? undefined
    : meQuery.dataUpdatedAt >= since
      ? meQuery.data
      : undefined;
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
  const orgNow = current(org, since);
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
    org: orgNow,
    classes: current(classes, since) ?? null,
    year: current(year, since),
    // Practice that can't be confirmed running offers nothing to start.
    covered: current(pilot, since)?.coverage?.covered ?? 0,
  });
}
