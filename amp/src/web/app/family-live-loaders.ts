import type { AuthSession } from "../auth";
import { meOptions, queryClient } from "../lib/query";
import { classYearOptions, preload } from "../features/school/core-api";
import { familyOptions } from "../features/family/api";
import { sessionReport } from "./class-live-loaders";
import { ownClassOf } from "../features/spaces/resolve";

const orNull =
  (what: string) =>
  (error: unknown): null => {
    console.warn(`${what} didn’t load ahead`, error);
    return null;
  };

/**
 * A family's practice sessions, with the Today that shows them: the class's
 * `can`, the live snapshot (a session already running paints with the
 * cockpit in place, its chunk loaded with it) and the first page of past
 * sessions, for a parent who may watch them. Nothing is asked of a family
 * that may not (a co-teacher, say), and a family with nothing running loads
 * none of the cockpit's code.
 */
export async function familySessions(session: AuthSession, familyId: string) {
  const [data, me] = await Promise.all([
    queryClient
      .ensureQueryData(familyOptions(session, familyId))
      .catch(orNull("The family")),
    queryClient
      .ensureQueryData(meOptions(session))
      .catch(orNull("Your account")),
  ]);
  const own = ownClassOf(me?.signedIn ? me : null, familyId, data);
  if (!own) return null;
  const [year, { liveOptions, sessionsOptions }] = await Promise.all([
    preload(classYearOptions(session, own.id)) as Promise<
      { can?: readonly string[] } | undefined
    >,
    import("../features/live/api"),
  ]);
  if (!year?.can?.includes("session.read")) return null;
  const place = { org: own.org, class: own.id };
  const [snapshot] = await Promise.all([
    preload(liveOptions(session, place)) as Promise<
      { session: unknown; signals: unknown[] } | undefined
    >,
    preload(sessionsOptions(session, place)),
  ]);
  // Running, or a child asking: the cockpit is there on first paint.
  if (snapshot && (snapshot.session || snapshot.signals.length > 0))
    await import("../features/family/cockpit-chunk").then(
      ({ loadFamilyCockpit }) => loadFamilyCockpit(),
    );
  return own;
}

/** Today's reads: the dashboard, and the family's sessions. */
export async function todayLoader(session: AuthSession, id: string) {
  const { familyDashboardOptions } =
    await import("../features/family/dashboard-api");
  await Promise.all([
    preload(familyDashboardOptions(session, id)),
    familySessions(session, id),
  ]);
}

/** A session's report, with the dashboard's per-child settings. */
export async function reportLoader(input: {
  context: unknown;
  params: unknown;
}) {
  const { session } = input.context as { session: AuthSession };
  const { family: id, session: sessionId } = input.params as {
    family: string;
    session: string;
  };
  const [own] = await Promise.all([
    familySessions(session, id),
    todayLoader(session, id).catch(orNull("The family's dashboard")),
  ]);
  if (own)
    await sessionReport(session, { org: own.org, class: own.id }, sessionId);
}
