import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { meOptions } from "../../lib/query";
import { queryClient } from "../../lib/query-client";
import { familyPlacesOptions } from "../family/api";
import { rememberedPlace } from "../onboarding/place-memory";
import {
  placeGroups,
  placesOptions,
  type PlaceEntry,
  type PlaceGroup,
} from "../spaces/places";

/** Where a signed-in person goes from `/`: each a final address. */
export type Launch = {
  id: string;
  label: string;
  detail?: string;
  /** The address, without its leading slash. */
  path: string;
  /** The place this opens, chosen and remembered when it is opened. */
  place?: PlaceEntry;
};

/**
 * Where `/` offers to go, first the one most likely wanted: from the
 * account's places alone, never by redirecting. A student's device goes to
 * practice; an account with no place yet starts; anyone else opens a place,
 * the one last used first.
 */
export function launches(
  me: SignedInMe,
  groups: readonly PlaceGroup[],
  remembered: string | null,
): Launch[] {
  if (me.account.kind === "student")
    return [{ id: "practice", label: "Continue practicing", path: "practice" }];
  if (me.next === "accept-gift")
    return [{ id: "access", label: "Accept your gift", path: "access" }];
  const entries = groups
    .flatMap((group) => group.entries)
    // A level to practice at is a choice, not a place to return to.
    .filter((entry) => entry.id !== "level");
  if (me.next === "start" || !entries.length)
    return [{ id: "start", label: "Get started", path: "start" }];
  const first = entries.find((entry) => entry.id === remembered);
  return [
    ...(first ? [first] : []),
    ...entries.filter((entry) => entry !== first),
  ].map((entry) => ({
    id: entry.id,
    label:
      entry.id !== "me"
        ? `Open ${entry.name}`
        : entry.path === "me"
          ? "Continue practicing"
          : entry.name,
    detail: entry.detail,
    path: entry.path,
    place: entry,
  }));
}

/**
 * Where a signed-in account goes when nothing else is asked for (after
 * signing in, say): the launcher's first choice, its final address, read
 * from the account and its places before navigating. Its places are cached
 * for the launcher too.
 */
export async function homeDestination(session: AuthSession): Promise<string> {
  const me = await queryClient.fetchQuery({
    ...meOptions(session),
    staleTime: 0,
  });
  if (!me.signedIn) return "/";
  const groups = await loadPlaceGroups(session, me);
  const [first] = launches(me, groups, rememberedPlace(me.account.id));
  return first ? `/${first.path}` : "/";
}

/** An adult's places, as the place switcher groups them (its same reads). */
export async function loadPlaceGroups(
  session: AuthSession,
  me: SignedInMe,
): Promise<PlaceGroup[]> {
  if (me.account.kind === "student" || session.accountId.startsWith("school:"))
    return [];
  const [families, places] = await Promise.all([
    queryClient.ensureQueryData(familyPlacesOptions(session)),
    me.staffOf?.length
      ? queryClient.ensureQueryData(placesOptions(session))
      : null,
  ]);
  return placeGroups(me, places, families);
}
