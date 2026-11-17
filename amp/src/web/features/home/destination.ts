import { meSchema, type SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { meOptions } from "../../lib/query";
import { confirmSession } from "../../lib/session-generation";
import { queryClient } from "../../lib/query-client";
import { setHome } from "../../lib/home-place";
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
  /** What it opens, said whole ("Open Your family"): its accessible name. */
  label: string;
  /** The place's name and its short state, and the button's word. */
  name: string;
  detail?: string;
  action: string;
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
    return [
      {
        id: "practice",
        label: "Continue practicing",
        name: "Your practice",
        action: "Continue",
        path: "practice",
      },
    ];
  // A gift waiting for a family none of whose children has access yet.
  if (
    me.next === "accept-gift" &&
    !me.learners.some((learner) => learner.entitlement.active)
  )
    return [
      {
        id: "access",
        label: "Accept your gift",
        name: "Your gift",
        action: "Accept",
        path: "access",
      },
    ];
  const entries = groups
    .flatMap((group) => group.entries)
    // A level to practice at is a choice, not a place to return to.
    .filter((entry) => entry.id !== "level");
  if (me.next === "start" || !entries.length)
    return [
      {
        id: "start",
        label: "Get started",
        name: "AMP",
        action: "Get started",
        path: "start",
      },
    ];
  // The place last used comes first, except a school still being set up
  // when the account has a family: a half-finished setup never takes the
  // family's place (as `homePlace` rules).
  const settingUp = (id: string) =>
    (me.staffOf ?? []).some(
      (org) => org.setupPending && id === `school:${org.orgId}`,
    );
  const hasFamily = entries.some((entry) => entry.id === "home");
  const first = entries.find(
    (entry) => entry.id === remembered && !(hasFamily && settingUp(entry.id)),
  );
  return [
    ...(first ? [first] : []),
    ...entries.filter((entry) => entry !== first),
  ].map((entry) => {
    const continuing = entry.id === "me" && entry.path === "me";
    return {
      id: entry.id,
      label: continuing
        ? "Continue practicing"
        : entry.id === "me"
          ? entry.name
          : `Open ${entry.name}`,
      name: entry.name,
      detail: entry.detail,
      action: continuing ? "Continue" : entry.id === "me" ? "Start" : "Open",
      path: entry.path,
      place: entry,
    };
  });
}

/**
 * Where a signed-in account goes when nothing else is asked for (after
 * signing in, say): the launcher's first choice, its final address, read
 * from the account and its places before navigating. Its places are cached
 * for the launcher too.
 */
export async function homeDestination(
  session: AuthSession,
  /** The account as just read, when the caller has it fresh. */
  known?: SignedInMe,
): Promise<string> {
  // Read directly, not through the cache: signing in replaces the
  // account's cached reads (and cancels any in flight) while this runs. The
  // answer then seeds the cache for the screen it opens.
  const me = known ?? (await readMe(session));
  if (!me.signedIn) return "/";
  // A new account's destination needs no places: its first question.
  const groups = me.next === "start" ? [] : await loadPlaceGroups(session, me);
  const [first] = launches(me, groups, rememberedPlace(me.account.id));
  if (!first) return "/";
  const href = `/${first.path}`;
  // Where this account's home links go from now on (its place, not /start).
  if (first.place) setHome(me.account.id, href);
  return href;
}

/** The launcher's one choice when it is a place and the only one; null
 * when `/` has a choice to offer or something that isn't a place. */
export function onlyLaunch(
  me: SignedInMe,
  groups: readonly PlaceGroup[],
  remembered: string | null,
): Launch | null {
  const all = launches(me, groups, remembered);
  return all.length === 1 && all[0]!.place ? all[0]! : null;
}

/**
 * `/` for an account with exactly one place: that place's own address (its
 * home, as choosing it would set). Null when `/` has something else to
 * show: a choice of several places, a first question (start), a gift to
 * accept or a student's own practice, none of which is a place.
 */
export async function onlyPlace(session: AuthSession): Promise<string | null> {
  // Fresh, as the launcher reads it: a place made a moment ago counts. A
  // failed read is not "no place": `/` shows the launcher, which reads it
  // again and says so.
  const me = await queryClient
    .fetchQuery({ ...meOptions(session), staleTime: 0 })
    .catch((error: unknown) => {
      console.warn(
        "Your account didn’t load ahead; opening the launcher",
        error,
      );
      return null;
    });
  if (!me?.signedIn || me.next === "start") return null;
  const groups = await loadPlaceGroups(session, me);
  const only = onlyLaunch(me, groups, rememberedPlace(me.account.id));
  if (!only) return null;
  const href = `/${only.path}`;
  // Where this account's home links go from now on.
  setHome(me.account.id, href);
  return href;
}

async function readMe(session: AuthSession) {
  const me = await request("/me", meSchema, { token: session.token });
  confirmSession(session.token);
  queryClient.setQueryData(meOptions(session).queryKey, me);
  return me;
}

/** An adult's places, as the place switcher groups them (its same reads). */
export async function loadPlaceGroups(
  session: AuthSession,
  me: SignedInMe,
): Promise<PlaceGroup[]> {
  if (me.account.kind === "student" || session.accountId.startsWith("school:"))
    return [];
  // Either read failing leaves the places `/me` names (as the switcher
  // does), never no destination.
  const read = <T>(what: string, load: Promise<T>) =>
    load.catch((error) => {
      console.warn(`${what} didn’t load; using what /me names`, error);
      return null;
    });
  const [families, places] = await Promise.all([
    read(
      "Your families",
      queryClient.ensureQueryData(familyPlacesOptions(session)),
    ),
    me.staffOf?.length
      ? read("Your places", queryClient.ensureQueryData(placesOptions(session)))
      : null,
  ]);
  return placeGroups(me, places, families);
}

/** One hop to this account's own place, never through `/`: the sign-in
 * gate's (app/sign-in-gate.ts `toOwnPlace`), for code that still asks here. */
export async function homeRedirect(known?: SignedInMe): Promise<never> {
  const { toOwnPlace } = await import("../../app/sign-in-gate");
  return toOwnPlace(known);
}
