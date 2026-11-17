import { redirect } from "@tanstack/react-router";
import { hasInitialConsentChallenge } from "../consent-entry";
import { queryClient, sessionOptions } from "../lib/query";
import { nativeRuntime } from "../native-runtime";
import { requireSignedIn } from "./sign-in-gate";

/*
 * Old addresses (amp/AGENTS.md, "Frontend architecture"): every address the
 * app no longer names a screen by, or that carried state in its query
 * (`?lesson=`, `?skill=`), is ONE row of `LEGACY_ALIASES`. The router asks
 * `followAlias` first on every navigation (app/router.tsx, the root's
 * `beforeLoad`), so a row hops once, replacing the old entry, before any
 * screen's guard runs. One hop, never chained: no row's address is another
 * row's (app/__tests__/legacy-aliases.test.ts, generated from the table).
 *
 * A row's `to` builds the new address once, from the old one and canonical
 * state (the Query cache, the stores). Its code loads only when its row is
 * hit (dynamic imports), so the table stays in the entry at a few hundred
 * bytes. A row that needs the account calls the sign-in gate
 * (app/sign-in-gate.ts), which signs in and comes back to the old address.
 *
 * Nothing else in the app redirects an old address. Links inside the app go
 * straight to the new address; the rows are for bookmarks, mail, history
 * and other sites. This is a sanctioned mechanism
 * (tests/architecture-ratchet.test.ts, SANCTIONED).
 */

/** An old address, as a row reads it. */
export type OldAddress = {
  pathname: string;
  /** The row's `$name` segments; a final `$` is `_splat`. */
  params: Record<string, string>;
  search: Record<string, unknown>;
  searchStr: string;
  hash: string;
};

export type LegacyAlias = {
  /** The old address, in route-path syntax: `/family/learners`,
   * `/pathways/$skill`, `/account/billing/$` (a final `$` matches the rest,
   * one segment or more). A trailing slash is ignored. */
  from: string;
  /** What the address was, in a few words (the test names). */
  about: string;
  /** Only an old address carrying this is the row's: the screen still at
   * `from` (if any) opens otherwise. */
  when?: (old: OldAddress) => boolean;
  /** The new address (an href), built once. `undefined` only for a row
   * whose `when` can't be decided without the account. */
  to: (old: OldAddress) => string | undefined | Promise<string | undefined>;
};

/** `path?key=value…`, leaving out keys with no value. */
function withQuery(path: string, query: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (typeof value === "string") params.set(key, value);
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

/** Privacy's older addresses (IA v2 §2.3): the Privacy overlay over the
 * account's settings hub, the panel the last part named open
 * (features/account/panels.ts). `/account/privacy` itself is the overlay
 * over `/account` (app/account-overlays.tsx). */
async function toPrivacy(old: OldAddress) {
  const session = await requireSignedIn(old, {
    web: true,
    adults: true,
    back: "here",
  });
  const [{ privacyPanel, setPanel }, { loadSettingsHub }] = await Promise.all([
    import("../features/account/panels"),
    import("../features/spaces/settings-hub"),
  ]);
  const panel = privacyPanel(old.params.panel);
  if (panel) setPanel(session.accountId, "privacy", panel);
  return loadSettingsHub(session, "privacy");
}

const pathwaysLegacy = () => import("../features/pathways/legacy-addresses");
/** The keys a map's address carried its layers and view in (kept here, in
 * the entry, so `when` needs no chunk; legacy-addresses.ts MAP_KEYS). */
const MAP_KEYS = ["open", "skill", "lesson", "topic", "filter", "area", "view"];
const carriesMap = (old: OldAddress) =>
  MAP_KEYS.some((key) => key in old.search);

/** Every old address, each one hop to where it opens now. */
export const LEGACY_ALIASES: readonly LegacyAlias[] = [
  // `/` from before the sign-in screens had addresses, in older mail.
  {
    from: "/",
    about: "sign-in or sign-up, by its query",
    when: (old) => "sign-in" in old.search,
    to: ({ search }) =>
      withQuery(search["sign-in"] === "create" ? "/sign-up" : "/sign-in", {
        return: search.return,
        error: search.error,
      }),
  },
  {
    from: "/",
    about: "a password reset, by its query",
    when: (old) => "reset-password" in old.search,
    to: ({ search }) =>
      withQuery("/reset-password", {
        token: search.token,
        error: search.error,
      }),
  },
  // A consent email's link (its proof in the fragment, consent-entry.ts):
  // signed in, the consent screen takes it; signed out, the pitch.
  {
    from: "/",
    about: "a consent email's link",
    when: () => !nativeRuntime && hasInitialConsentChallenge(),
    to: async () =>
      (await queryClient.ensureQueryData(sessionOptions))
        ? "/consent"
        : undefined,
  },
  // Pathways and the class map from before the layer and map-view stores
  // (features/pathways/legacy-addresses.ts): the layers and the view the
  // address named go into their stores; the map's own address, once.
  {
    from: "/pathways/$skill",
    about: "a skill's page from before layers",
    to: (old) => pathwaysLegacy().then((m) => m.toMap(old, "/pathways")),
  },
  {
    from: "/pathways",
    about: "the map with its layers or view in the address",
    when: (old) => carriesMap(old),
    to: (old) => pathwaysLegacy().then((m) => m.toMap(old)),
  },
  {
    from: "/family/$family/kids/$learner/pathways",
    about: "a child's map with its layers or view in the address",
    when: (old) => carriesMap(old),
    to: (old) => pathwaysLegacy().then((m) => m.toMap(old)),
  },
  {
    from: "/lessons",
    about: "the lessons library, now the map",
    to: (old) => pathwaysLegacy().then((m) => m.toMapFromLessons(old)),
  },
  {
    from: "/school/$org/classes/$class/today",
    about: "Today with a lesson in the address",
    when: (old) => "lesson" in old.search,
    to: (old) => pathwaysLegacy().then((m) => m.toLessonLayer(old)),
  },
  {
    from: "/school/$org/classes/$class/map/$student",
    about: "a class map's student page from before layers",
    to: (old) => pathwaysLegacy().then((m) => m.toClassMapLayers(old)),
  },
  {
    from: "/school/$org/classes/$class/map/$student/work/$work",
    about: "a class map's answer page from before layers",
    to: (old) => pathwaysLegacy().then((m) => m.toClassMapLayers(old)),
  },
  { from: "/account/privacy/$panel", about: "a privacy panel", to: toPrivacy },
  { from: "/family/privacy", about: "a family's privacy", to: toPrivacy },
  {
    from: "/family/privacy/$panel",
    about: "a family's privacy panel",
    to: toPrivacy,
  },
];

type At = {
  pathname: string;
  search: unknown;
  searchStr: string;
  hash?: string;
};

/** A row's params when `pathname` is its address, else null. */
export function matchPattern(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const want = pattern.split("/").filter(Boolean);
  const have = pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    const part = want[i]!;
    if (part === "$" && i === want.length - 1) {
      if (have.length <= i) return null;
      params._splat = have.slice(i).map(decode).join("/");
      return params;
    }
    const segment = have[i];
    if (segment === undefined) return null;
    if (part.startsWith("$")) params[part.slice(1)] = decode(segment);
    else if (part !== segment) return null;
  }
  return have.length === want.length ? params : null;
}

function decode(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch (error) {
    console.warn("An old address held a malformed segment", segment, error);
    return segment;
  }
}

/** The table's row for an address, with the old address as it reads it. */
export function findAlias(
  at: At,
  table: readonly LegacyAlias[] = LEGACY_ALIASES,
): { alias: LegacyAlias; old: OldAddress } | null {
  for (const alias of table) {
    const params = matchPattern(alias.from, at.pathname);
    if (!params) continue;
    const old: OldAddress = {
      pathname: at.pathname,
      params,
      search: (at.search ?? {}) as Record<string, unknown>,
      searchStr: at.searchStr,
      hash: at.hash ?? "",
    };
    if (alias.when && !alias.when(old)) continue;
    return { alias, old };
  }
  return null;
}

/** Where an old address opens now, or null when it is no old address (or
 * its row stays). */
export async function aliasTarget(
  at: At,
  table: readonly LegacyAlias[] = LEGACY_ALIASES,
): Promise<string | null> {
  const found = findAlias(at, table);
  if (!found) return null;
  const href = await found.alias.to(found.old);
  return href ?? null;
}

/**
 * The one generic hop (app/router.tsx, the root's `beforeLoad`): an old
 * address goes to its new one, replacing it in history. Nothing else.
 */
export async function followAlias(
  at: At,
  table: readonly LegacyAlias[] = LEGACY_ALIASES,
) {
  const href = await aliasTarget(at, table);
  if (href !== null && href !== `${at.pathname}${at.searchStr}`)
    throw redirect({ href, replace: true });
}
