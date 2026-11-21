import type { AuthSession } from "../auth";
import { queryClient } from "../lib/query";
import { classYearOptions, preload } from "../features/school/core-api";

type Place = { org: string; class: string };
const watches = async (session: AuthSession, place: Place) =>
  (
    (await preload(classYearOptions(session, place.class))) as
      { can?: readonly string[] } | undefined
  )?.can?.includes("session.read");

/** A class's live snapshot, for someone who may watch its sessions. */
export async function classLive(session: AuthSession, place: Place) {
  const [watching, { liveOptions }] = await Promise.all([
    watches(session, place),
    import("../features/live/api"),
  ]);
  if (watching) await preload(liveOptions(session, place));
}

/** The class's sessions, at the Time report's foot. */
export async function classSessions(session: AuthSession, place: Place) {
  const [watching, { sessionsOptions }] = await Promise.all([
    watches(session, place),
    import("../features/live/api"),
  ]);
  if (watching) await preload(sessionsOptions(session, place));
}

/** One session's stored report: a session still running answers 409, which
 * the screen shows as the way back to the live view. */
export async function sessionReport(
  session: AuthSession,
  place: Place,
  id: string,
) {
  const { sessionReportOptions } = await import("../features/live/api");
  await queryClient
    .ensureQueryData(sessionReportOptions(session, place, id))
    .catch((error: unknown) =>
      console.warn("The session's report didn’t load ahead", error),
    );
}
