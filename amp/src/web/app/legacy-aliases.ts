import { redirect } from "@tanstack/react-router";
import type { AuthSession } from "../auth";
import {
  claimInitialConsentChallenge,
  hasInitialConsentChallenge,
} from "../consent-entry";
import { isFamilyId } from "../features/family/api";
import { continuationSearch, fundedPrograms } from "../lib/funded-entry";
import { meOptions, queryClient, sessionOptions } from "../lib/query";
import { requestFetch } from "../lib/request-transport";
import { nativeRuntime } from "../native-runtime";
import { currentLearner } from "../learner-store";
import { MAX_LAYERS, OPEN_KEY, work } from "../nav/entities";
import { layerScope, pushed, seedLayers, type Layer } from "../nav/layer-store";
import { withoutLayerKeys } from "../nav/legacy-layers";
import { legacyLayers } from "../nav/links";
import {
  LEARNING_PATHS,
  olderLearningHref,
} from "../features/profiles/practice-mode";
import { admit, requireSignedIn, toOwnPlace, withQuery } from "./sign-in-gate";

/*
 * Old addresses (amp/AGENTS.md, "Frontend architecture"): every address the
 * app no longer names a screen by, or that carried state in its query
 * (`?lesson=`, `?skill=`), is ONE row of `LEGACY_ALIASES`. The router asks
 * `followAlias` first on every navigation (app/router.tsx, the root's
 * `beforeLoad`), so a row hops once, replacing the old entry, before any
 * screen's guard runs. One hop, never chained: no row's address is another
 * row's (app/__tests__/legacy-aliases.test.tsx, generated from the table).
 *
 * A row's `to` builds the new address once, from the old one and canonical
 * state (the Query cache, the stores). Its code loads only when its row is
 * hit (dynamic imports), so the table stays small in the entry. A row that
 * needs the account calls the sign-in gate (app/sign-in-gate.ts). A row
 * whose address is old only for some people (a parent's family at its old
 * class address) answers `undefined` for everyone else, and the next row
 * that matches, or the screen at the address, takes it.
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

/** A new address: an href, or the router's parts of one (its search
 * serialized the router's way), with history state for a sheet, and the
 * layers (nav/layer-store.ts) the old address named, which go into the
 * store for the screen it lands on: the new address names the screen only. */
export type Target =
  | string
  | {
      to: string;
      search?: Record<string, unknown>;
      hash?: string;
      state?: Record<string, unknown>;
      layers?: Layer[];
    }
  | { href: string; state?: Record<string, unknown>; layers?: Layer[] };

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
  /** The new address, built once; `undefined` when the address isn't old
   * for this person (the next row, or the screen, takes it). */
  to: (old: OldAddress) => Target | undefined | Promise<Target | undefined>;
};

/** The keys a map's address carried its layers and view in (layers: the
 * layer store; view: features/pathways/map-view.ts). */
const MAP_VIEW_KEYS = ["topic", "filter", "area", "view"];
const MAP_KEYS = ["open", "skill", "lesson", ...MAP_VIEW_KEYS];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The session, if any, without asking anyone to sign in: a row that is
 * old only for some accounts. */
const sessionIfAny = (): Promise<AuthSession | null> =>
  queryClient.ensureQueryData(sessionOptions);

/** The screen at `path` (an old address's layer keys dropped from its
 * query), with `layers` for its store. */
const withLayers = (
  path: string,
  { search }: OldAddress,
  layers: Layer[],
): Target => ({
  href: withoutLayerKeys(path, search),
  layers: layers.slice(0, MAX_LAYERS),
});

/**
 * Pathways from before its layers: a skill's own address (`/pathways/<skill>`,
 * `?skill=<skill>`), a lesson (`?lesson=`) and an old shared stack
 * (`?open=`) land on the map whose learner the address names (a parent's
 * goes to their child's address, olderLearningHref), with their
 * layers in that map's store: the skill under any layers the address held,
 * then a lesson it names over them.
 */
async function pathwaysTarget(
  search: Record<string, unknown>,
  skill?: string,
  screen = "/pathways",
): Promise<Target> {
  const named =
    skill ?? (typeof search.skill === "string" ? search.skill : undefined);
  let stack: Layer[] = legacyLayers(search);
  if (named) stack = [{ kind: "skill", id: named }, ...stack];
  if (typeof search.lesson === "string")
    stack = pushed(stack, { kind: "lesson", id: search.lesson });
  // The map's view (its search, grade and area) leaves the address too,
  // for the map's own view store (features/pathways/map-view.ts).
  const map = withoutLayerKeys(screen, search, MAP_KEYS);
  const [path, query = ""] = map.split("?");
  const href =
    (await olderLearningHref({
      pathname: path!,
      searchStr: query ? `?${query}` : "",
    })) ?? map;
  if (MAP_VIEW_KEYS.some((key) => key in search))
    await (
      await import("../features/pathways/legacy-addresses")
    ).carryMapView(href, search);
  return { href, layers: stack.slice(0, MAX_LAYERS) };
}

/** An older gallery address: its width and theme kept as this viewer's
 * (features/design/view.ts), then its document's own path, its section kept. */
async function toDesign(old: OldAddress) {
  const [{ useDesignView }, { designWidths }] = await Promise.all([
    import("../features/design/view"),
    import("../features/design/search"),
  ]);
  const { frame, specimen, width, theme } = old.search;
  const widthOf = Number(width);
  useDesignView.getState().set({
    ...(width === "fill"
      ? { width: "fill" as const }
      : designWidths.includes(widthOf as (typeof designWidths)[number])
        ? { width: widthOf as (typeof designWidths)[number] }
        : {}),
    ...(theme === "light" || theme === "dark" ? { theme } : {}),
  });
  const section = old.hash ? `#${old.hash}` : "";
  if (frame === "canvas") return `/design/canvas${section}`;
  if (
    frame === "specimen" &&
    typeof specimen === "string" &&
    /^[a-z0-9-]{1,60}$/.test(specimen)
  )
    return `/design/specimen/${specimen}`;
  return `/design${section}`;
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

/** The account's older addresses (features/account/legacy.ts): an overlay
 * over the account's settings hub, a panel written on the way. */
async function toAccount(old: OldAddress) {
  const session = await requireSignedIn(old);
  const [{ accountHop }, { setPanel }, { loadSettingsHub }] = await Promise.all(
    [
      import("../features/account/legacy"),
      import("../features/account/panels"),
      import("../features/spaces/settings-hub"),
    ],
  );
  const hop = accountHop(
    old.pathname,
    await loadSettingsHub(session),
    old.search,
  );
  if (hop?.panel) setPanel(session.accountId, hop.panel.overlay, hop.panel.id);
  return hop?.href ?? "/account";
}

/** The older pay addresses (features/pay/legacy.ts): a pay overlay, what
 * the address carried written into the pay store on the way. */
const toPay =
  (hop: import("../features/pay/legacy").LegacyHop) =>
  async (old: OldAddress) =>
    (await import("../features/pay/legacy")).legacyHop(hop, old);

/**
 * The separate free trial is retired: one product, one way in. Links to
 * `/try` from ads and email still work: signed out, they sign up (and the
 * starter follows), keeping a funded program's context (the funding pages
 * link here); signed in, straight to their place or the starter.
 */
async function retiredTrial({ search }: OldAddress) {
  admit({ adults: true });
  const session = await sessionIfAny();
  if (!session) {
    const carry = continuationSearch(search);
    return withQuery("/sign-up", {
      ...carry,
      return: carry.return ?? "free-practice",
    });
  }
  // A follow-up email's way back, now signed in: the follow-up is done.
  if (search.return === "free-practice")
    void requestFetch("/api/v1/parent-followup/complete", {
      signal: AbortSignal.timeout(10000),
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch((error: unknown) =>
      console.warn("The follow-up wasn’t marked done", error),
    );
  return toOwnPlace();
}

/** A parent's family lived at its class before it had an address of its
 * own: each old leaf opens the family's matching screen (app/family-redirect.ts).
 * Anyone else's class stays. */
async function familyAtClass(old: OldAddress) {
  const session = await sessionIfAny();
  if (!session) return undefined;
  const { toFamilyAddress } = await import("./family-redirect");
  return (
    (await toFamilyAddress(session, { location: old, params: old.params })) ??
    undefined
  );
}

/** A school-level page of a parent's own family org: the family's page. */
const familyAtOrg =
  (page: "roster" | "map" | "settings" | "today") =>
  async (old: OldAddress) => {
    const session = await sessionIfAny();
    if (!session) return undefined;
    const { toFamilyPage } = await import("./family-redirect");
    return (
      (await toFamilyPage(
        session,
        old.params.org!,
        page,
        old,
        old.params.class,
      )) ?? undefined
    );
  };

/** A family org's school-level pages and the family page each is now. */
const FAMILY_ORG_PAGES: [string, "roster" | "map" | "settings" | "today"][] = [
  ["", "today"],
  ["/standing", "map"],
  ["/standing/$class", "map"],
  ["/schools", "today"],
  ["/year", "today"],
  ["/year/$step", "today"],
  ["/integrations", "today"],
  ["/privacy", "today"],
  ["/activity", "today"],
  ["/classes", "today"],
  ["/students", "roster"],
  ["/staff", "roster"],
  ["/sign-in-help", "today"],
  ["/calendar", "settings"],
  ["/settings", "settings"],
  ["/license", "today"],
  ["/import", "today"],
  ["/import/$step", "today"],
];

/** The query a workbook day's link carried before its draft store. */
const WORKBOOK_KEYS = [
  "draft",
  "minutes",
  "paper",
  "number",
  "areas",
  "lean",
  "lesson",
] as const;

/** What a class's workbook stack chose in its query before its view store. */
const STACK_KEYS = [
  "date",
  "minutes",
  "paper",
  "set",
  "students",
  "skill",
] as const;

/** A school screen's view from an old query (features/school/view-store.ts):
 * written for the screen at the old address's path, which it opens without
 * the query. Nothing chosen (all malformed): the screen as it is. */
async function screenView(
  old: OldAddress,
  read: () => Promise<Record<string, string | number | undefined>>,
) {
  const path = old.pathname.replace(/\/+$/, "");
  const [view, { openView }, session] = await Promise.all([
    read(),
    import("../features/school/view-store"),
    sessionIfAny(),
  ]);
  openView(session?.accountId, path, view);
  return path;
}

/** The query keys practice's focus had before its paths. */
const FOCUS_KEYS = ["template", "skill", "strand"] as const;

/** `/family/<segment>` screens and rows that aren't a family's id. */
const FAMILY_SCREENS = new Set([
  "approve",
  "approvals",
  "learners",
  "privacy",
  "security",
  "access",
]);

/** The account's learners, from before families had a place: the family's
 * Settings (its children), with a sheet open (`sheet`). */
const familyLearners = (sheet?: string) => async (old: OldAddress) => {
  const session = await requireSignedIn(old, {
    web: true,
    adults: true,
    back: "here",
  });
  const [
    { familyPlacesOptions },
    { familyPath, landingFamily },
    { sheetState },
  ] = await Promise.all([
    import("../features/family/api"),
    import("../features/family/redirects"),
    import("../nav/sheet"),
  ]);
  const places = await queryClient.fetchQuery(familyPlacesOptions(session));
  const family = landingFamily(places);
  return family
    ? {
        to: familyPath(family, "settings"),
        ...(sheet ? { state: sheetState(sheet) } : {}),
      }
    : "/family";
};

/** An older family leaf that is part of Settings now, its sheet (`sheet`)
 * opened from history state. */
const familySettings =
  (sheet?: string) =>
  async ({ params }: OldAddress): Promise<Target> => {
    const { sheetState } = await import("../nav/sheet");
    return {
      to: `/family/${params.family}/settings`,
      ...(sheet ? { state: sheetState(sheet) } : {}),
    };
  };

/**
 * The family's old record pages (Progress, practice time, report cards,
 * workbooks), now parts of each child's page and of Today: for a one-child
 * family, that child's page at the part (`anchor`); for several, or with no
 * part (Progress), Today, where each child's card opens their page.
 * Progress's linked curriculum layers go with it.
 */
const familyRecord =
  (anchor: string | null) =>
  async (old: OldAddress): Promise<Target> => {
    const id = old.params.family!;
    let only: string | null = null;
    if (anchor) {
      const session = await requireSignedIn(old, {
        web: true,
        adults: true,
        back: "here",
      });
      const { familyOptions } = await import("../features/family/api");
      const data = await queryClient.ensureQueryData(
        familyOptions(session, id),
      );
      only = data.children.length === 1 ? data.children[0]!.id : null;
    }
    return only
      ? { to: `/family/${id}/kids/${only}`, hash: anchor! }
      : {
          to: `/family/${id}`,
          search: old.search,
          ...(old.hash ? { hash: old.hash } : {}),
        };
  };

/**
 * A family's workbooks: for one child, that child's page at their
 * workbooks; for several, the print for them all, which is this address
 * (an older `?several=1` or `?kids=` leaves the query: the print's own
 * identity stays, `kids` as the people they are in the family's class).
 */
async function familyWorkbooks(old: OldAddress): Promise<Target | undefined> {
  const id = old.params.family!;
  const session = await requireSignedIn(old, {
    web: true,
    adults: true,
    back: "here",
  });
  const [{ familyOptions }, { peopleOf, workbookPrintSearch }, { ownClassOf }] =
    await Promise.all([
      import("../features/family/api"),
      import("../features/family/redirects"),
      import("../features/spaces/resolve"),
    ]);
  const data = await queryClient.ensureQueryData(familyOptions(session, id));
  const [first, second] = data.children;
  if (!first) return { to: `/family/${id}` };
  if (!second)
    return { to: `/family/${id}/kids/${first.id}`, hash: "child-workbooks" };
  if (old.search.several === undefined && old.search.kids === undefined)
    return undefined;
  const own = ownClassOf(null, id, data);
  return {
    to: `/family/${id}/workbooks`,
    search: workbookPrintSearch(
      old.search,
      own ? peopleOf(data.children, own.id) : new Map(),
    ),
  };
}

/** A family address that opened one of its own children by their roster
 * person (`?open=student:<person>`, a link from before each child had a
 * page): that child's page, their answers over it. Another family's child
 * (a tutoring group's) stays a layer. */
async function familyChildLayer(old: OldAddress): Promise<Target | undefined> {
  const id = old.params.family!;
  const session = await requireSignedIn(old, {
    web: true,
    adults: true,
    back: "here",
  });
  const [{ familyOptions }, { familyOrgTarget, peopleOf }, { ownClassOf }] =
    await Promise.all([
      import("../features/family/api"),
      import("../features/family/redirects"),
      import("../features/spaces/resolve"),
    ]);
  const data = await queryClient.ensureQueryData(familyOptions(session, id));
  // The class the family hosts, else the one this parent teaches in (/me).
  const own =
    ownClassOf(null, id, data) ??
    (await queryClient
      .ensureQueryData(meOptions(session))
      .then((me) => ownClassOf(me.signedIn ? me : null, id, data)));
  if (!own) return undefined;
  const target = familyOrgTarget({
    family: id,
    page: "today",
    search: {
      [OPEN_KEY]: old.search[OPEN_KEY],
      ...(typeof old.search.skill === "string"
        ? { skill: old.search.skill }
        : {}),
    },
    people: peopleOf(data.children, own.id),
  });
  return target.href.includes("/kids/") ? target.href : undefined;
}

/** A class code as its address says it (schools/contracts.ts
 * `formatJoinCode`): `abc-def` or `ABCDEF` reads `ABC-DEF`. */
const JOIN_CODE = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/;
const plainCode = (code: string) =>
  code.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** A printed workbook page's QR code (src/schools/classroom-workbooks.ts):
 * its marking screen, on its workbook and student, set in the school view
 * store (features/school/view-store.ts). */
async function toMarking(old: OldAddress) {
  const session = await requireSignedIn(old, {
    web: true,
    adults: true,
    back: "here",
  });
  const { openView } = await import("../features/school/view-store");
  const set = Number(old.search.set);
  const student = old.search.student;
  openView(session.accountId, old.pathname, {
    set: Number.isInteger(set) && set > 0 ? set : undefined,
    student: typeof student === "string" ? student : undefined,
  });
  return old.pathname;
}

/** An inventory's view keys, from before its view store. */
const INVENTORY_KEYS = ["topic", "collection", "area"] as const;

/** An older inventory link: its view seeded for the screen it lands on
 * (the account's scope, as nav/layer-store.ts keys a screen), the address
 * without it. */
async function inventoryTarget(old: OldAddress): Promise<string> {
  const rest = new URLSearchParams(old.searchStr);
  const view: Record<string, string> = {};
  for (const key of INVENTORY_KEYS) {
    const value = rest.get(key);
    if (value) view[key] = value;
    rest.delete(key);
  }
  const clean = `${old.pathname}${rest.size ? `?${rest}` : ""}`;
  const href =
    (await olderLearningHref({
      pathname: old.pathname,
      searchStr: rest.size ? `?${rest}` : "",
    })) ?? clean;
  const session = await sessionIfAny();
  const { useInventoryViewStore } = await import(
    "../features/inventory/inventory-view"
  );
  useInventoryViewStore
    .getState()
    .set(layerScope(href.split(/[?#]/)[0]!, session?.accountId), view);
  return href;
}

/** Every old address, each one hop to where it opens now. */
export const LEGACY_ALIASES: readonly LegacyAlias[] = [
  // A consent email's link (its proof taken from the fragment at boot,
  // consent-entry.ts), wherever it landed: once this account may claim it,
  // the consent screen takes it. Signed out, the address stays.
  ...["/", "/$"].map((from) => ({
    from,
    about: "a consent email's link",
    when: ({ pathname }: OldAddress) =>
      !nativeRuntime &&
      hasInitialConsentChallenge() &&
      pathname.replace(/\/+$/, "") !== "/consent",
    to: async () => {
      const session = await sessionIfAny();
      return session && claimInitialConsentChallenge(session.accountId)
        ? "/consent"
        : undefined;
    },
  })),
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
  // The component gallery's documents and view, from when its address held
  // them: the frame is a path, the width and theme this viewer's own.
  {
    from: "/design",
    about: "the gallery's frame, width or theme, by its query",
    when: ({ search }) =>
      ["frame", "specimen", "width", "theme"].some((key) => key in search),
    to: toDesign,
  },
  // The plan's address from when it held the chosen interval.
  {
    from: "/start/plan",
    about: "the plan, with its interval in the query",
    when: ({ search }) => "interval" in search,
    to: async ({ search }) => {
      if (search.interval === "year" || search.interval === "month")
        (await import("../lib/pending-trial")).rememberPlanChoice(
          search.interval,
        );
      return "/start/plan";
    },
  },
  { from: "/try", about: "the retired free trial", to: retiredTrial },
  { from: "/try/$", about: "the retired free trial's steps", to: retiredTrial },

  // The account's and privacy's older addresses (IA v2 §2.3).
  { from: "/account/privacy/$panel", about: "a privacy panel", to: toPrivacy },
  { from: "/family/privacy", about: "a family's privacy", to: toPrivacy },
  {
    from: "/family/privacy/$panel",
    about: "a family's privacy panel",
    to: toPrivacy,
  },
  ...[
    "/account/security/delete",
    "/family/security/delete",
    "/account/billing/$",
    "/family/security",
    "/family/access",
    "/family/access/$",
  ].map((from) => ({ from, about: "an account page", to: toAccount })),

  // Paying, from before it was an overlay (features/pay/legacy.ts).
  {
    from: "/continue/$learnerId",
    about: "Continue with AMP",
    to: toPay("continue"),
  },
  {
    from: "/pay/$learnerId",
    about: "a learner's pay screen",
    to: toPay("continue"),
  },
  { from: "/purchase/annual", about: "the card plan", to: toPay("card") },
  { from: "/purchase/choose", about: "choosing a plan", to: toPay("choose") },
  { from: "/purchase/funded", about: "paying with funds", to: toPay("funds") },
  ...Object.values(fundedPrograms).map((program) => ({
    from: program.path,
    about: `${program.id}'s entry`,
    to: toPay("program"),
  })),

  // Lessons and skills, from before layers.
  {
    from: "/lessons",
    about: "the lessons library",
    to: ({ searchStr }): Target | Promise<Target> => {
      const params = new URLSearchParams(searchStr);
      const query = params.get("q")?.trim();
      // `?topic=` named a problem type's short lesson: Pathways opens it.
      const lesson = params.get("topic")?.trim();
      // Its search and area go into the map's view
      // (features/pathways/map-view.ts; an area the map doesn't have is
      // dropped there).
      const strand = params.get("strand")?.trim();
      const search = {
        ...(query ? { topic: query } : {}),
        ...(strand ? { area: strand } : {}),
      };
      return pathwaysTarget(lesson ? { ...search, lesson } : search);
    },
  },
  {
    from: "/lessons/$lesson",
    about: "a lesson AMP no longer has",
    // A lesson the catalog has opens in its reader. The catalog is the
    // reader's own (one download, in the Query cache); when it can't be
    // read, the reader says so with its Try again.
    to: async ({ params }) => {
      const { learningCatalogOptions } = await import("../learning-transport");
      const catalog = (await queryClient
        .ensureQueryData(learningCatalogOptions)
        .catch((error: unknown) => {
          console.warn("AMP couldn’t check a lesson’s address", error);
          return null;
        })) as { lessons?: { id: string }[] } | null;
      if (!catalog?.lessons?.length) return undefined;
      if (catalog.lessons.some((lesson) => lesson.id === params.lesson))
        return undefined;
      return pathwaysTarget({});
    },
  },
  {
    from: "/pathways",
    about: "a skill, lesson, shared stack or the map's view in the query",
    when: ({ search }) => MAP_KEYS.some((key) => search[key] !== undefined),
    to: ({ search }) => pathwaysTarget(search),
  },
  {
    from: "/family/$family/kids/$learner/pathways",
    about: "a child's map with its layers or view in the query",
    when: ({ search }) => MAP_KEYS.some((key) => search[key] !== undefined),
    to: (old) => pathwaysTarget(old.search, undefined, old.pathname),
  },
  {
    from: "/pathways/$skill",
    about: "a skill's own address",
    to: ({ search, params }) => pathwaysTarget(search, params.skill),
  },

  // A film opened as help for a problem, from before that had its path
  // (`?problem=`); its `?from=` went with it (closing goes back).
  {
    from: "/lessons/$templateId/watch",
    about: "a film's problem and return in the query",
    when: ({ search }) => "problem" in search || "from" in search,
    to: ({ params, search }) => {
      const film = `/lessons/${encodeURIComponent(params.templateId!)}/watch`;
      const raw = search.problem;
      const problem =
        (typeof raw === "string" || typeof raw === "number") &&
        String(raw).length <= 160
          ? String(raw)
          : undefined;
      return problem ? `${film}/${encodeURIComponent(problem)}` : film;
    },
  },

  // Practice held to a problem type, skill or area by its query, from before
  // each focus had its path (features/spaces/identity.ts practicePath).
  {
    from: "/practice/$learnerId",
    about: "a practice focus in the query",
    when: ({ search }) =>
      FOCUS_KEYS.some((key) => typeof search[key] === "string"),
    to: olderLearningHref,
  },
  // An inventory's view from before its view store (`?topic=`,
  // `?collection=`, `?area=`): into the store for the screen it lands on
  // (features/inventory/inventory-view.ts), which an older `?learner=` may
  // move to a child's address in the same hop.
  ...["/inventory", "/family/$family/kids/$learner/inventory"].map((from) => ({
    from,
    about: "an inventory's view in the query",
    when: ({ search }: OldAddress) =>
      INVENTORY_KEYS.some((key) => key in search),
    to: inventoryTarget,
  })),
  // Learning screens from before the address named whose they are: bare
  // `/practice` (nobody), an older `?learner=`, and `?profile=&from=`
  // (practicing as a profile, now the current learner, its return kept in
  // features/profiles/mode-return.ts). A parent with no practice of their
  // own goes from a shared screen that names nobody to their child's.
  // (`/lessons` is the lessons library's row above, `/pathways/<skill>` a
  // skill's.)
  ...LEARNING_PATHS.filter((path) => path !== "/lessons").map((path) => ({
    from: path,
    about: `${path}, naming nobody or by an older query`,
    to: olderLearningHref,
  })),
  {
    from: "/practice/$",
    about: "practice's screens, by an older query",
    when: ({ search }: OldAddress) =>
      "learner" in search || "profile" in search,
    to: olderLearningHref,
  },

  // A workbook day's link from before its draft store carried the draft in
  // its query (`?draft=`, `?minutes=`, …): the day's own address.
  {
    from: "/learners/$learnerId/workbooks/$date",
    about: "a workbook day's old query",
    when: ({ search }) => WORKBOOK_KEYS.some((key) => key in search),
    to: ({ pathname }) => pathname.replace(/\/+$/, ""),
  },

  // A school's older addresses. A parent's own family, at its class or its
  // org, first: everyone else's stays, or takes the rows below.
  {
    from: "/school/$org/classes/$class",
    about: "a parent's family at its class",
    when: ({ params }) => UUID.test(params.org!),
    to: familyAtClass,
  },
  {
    from: "/school/$org/classes/$class/$",
    about: "a parent's family at a class page",
    when: ({ params }) => UUID.test(params.org!),
    to: familyAtClass,
  },
  ...FAMILY_ORG_PAGES.map(([page, family]) => ({
    from: `/school/$org${page}`,
    about: `a parent's family at its org${page || "'s home"}`,
    when: ({ params }: OldAddress) => UUID.test(params.org!),
    to: familyAtOrg(family),
  })),
  {
    from: "/school/$org/classes/$class",
    about: "a class's own address",
    to: ({ params }) => `/school/${params.org}/classes/${params.class}/today`,
  },
  {
    from: "/school/$org/classes/$class/today",
    about: "today's lesson in the query",
    when: ({ search }) => search.lesson !== undefined,
    to: (old) =>
      withLayers(
        old.pathname.replace(/\/+$/, ""),
        old,
        typeof old.search.lesson === "string"
          ? pushed(legacyLayers(old.search), {
              kind: "lesson",
              id: old.search.lesson,
            })
          : legacyLayers(old.search),
      ),
  },
  {
    from: "/school/$org/classes/$class/map/$student",
    about: "a student on the class map",
    to: (old) =>
      withLayers(
        `/school/${old.params.org}/classes/${old.params.class}/map`,
        old,
        [{ kind: "student", id: old.params.student! }],
      ),
  },
  {
    from: "/school/$org/classes/$class/map/$student/work/$work",
    about: "a student's answer on the class map",
    to: (old) =>
      withLayers(
        `/school/${old.params.org}/classes/${old.params.class}/map`,
        old,
        [
          { kind: "student", id: old.params.student! },
          work(old.params.student!, old.params.work!),
        ],
      ),
  },
  // A school-level student page, and one of their answers on it, from
  // before layers: a student layer over the school's Students (a family's
  // child: their own page).
  ...(
    [
      "/school/$org/students/$student",
      "/school/$org/students/$student/work/$work",
    ] as const
  ).map((from) => ({
    from,
    about: from.endsWith("$work")
      ? "a student's answer in a school"
      : "a student in a school",
    to: async (old: OldAddress): Promise<Target> => {
      const {
        org,
        student,
        work: attempt,
      } = old.params as Record<string, string>;
      const session = await requireSignedIn(old, {
        web: true,
        adults: true,
        back: "here",
      });
      const { toFamilyChild } = await import("./family-redirect");
      const family = await toFamilyChild(
        session,
        org!,
        student!,
        attempt ?? null,
        old,
      );
      if (family) return family;
      return withLayers(`/school/${org}/students`, old, [
        { kind: "student", id: student! },
        ...(attempt ? [work(student!, attempt)] : []),
      ]);
    },
  })),
  // An older setup address (`/school/new?org=…&step=…`): the step's own
  // address. Signed out without a school named: the schools page.
  {
    from: "/school/new",
    about: "guided setup, from before each step had its address",
    to: async (old) => {
      const org = typeof old.search.org === "string" ? old.search.org : null;
      if (!org && !(await sessionIfAny())) return "/schools";
      const session = await requireSignedIn(old, {
        web: true,
        adults: true,
        back: "here",
      });
      const [{ orgsOptions }, { setupPath, setupSteps }] = await Promise.all([
        import("../features/school/core-api"),
        import("../features/school/paths"),
      ]);
      const orgId =
        org ??
        (await queryClient.fetchQuery(orgsOptions(session))).find(
          (entry) => entry.setupPending && entry.roles.includes("admin"),
        )?.id;
      // Signed in with nothing to set up: the school first run.
      if (!orgId) return "/start/school";
      const step = setupSteps.find((entry) => entry === old.search.step);
      return `/${setupPath(orgId, step)}`;
    },
  },
  // A district's adoption links from before the district had its path
  // (`?district=<id>`, `&manage=1`). A school's approval in the fragment is
  // kept for this tab first (adoption-session.ts), never carried on.
  {
    from: "/school/adopt",
    about: "a district's adoption link in the query",
    when: ({ search }) => UUID.test(String(search.district ?? "")),
    to: async ({ search }) => {
      const { prepareSchoolAdoption } =
        await import("../features/school/adoption-session");
      prepareSchoolAdoption();
      const manage = search.manage === 1 || search.manage === "1";
      return `/school/adopt/${String(search.district)}${manage ? "/manage" : ""}`;
    },
  },
  // One student's sign-in card, from before it had its path (`?student=`).
  {
    from: "/school/$org/classes/$class/cards",
    about: "a student's card in the query",
    when: ({ search }) => UUID.test(String(search.student ?? "")),
    to: ({ params, search }) =>
      `/school/${params.org}/classes/${params.class}/cards/${String(search.student)}`,
  },
  // A class's workbook screens and a student's standings, from before their
  // view had its store (features/school/view-store.ts): what the query
  // chose is that screen's view, and the address names the screen. (A
  // printed workbook page's QR code, `?set=&student=`, is the last row.)
  {
    from: "/school/$org/classes/$class/workbooks",
    about: "the workbook stack's view in the query",
    when: ({ search }) => STACK_KEYS.some((key) => key in search),
    to: (old) =>
      screenView(old, async () => {
        const { stackSearchSchema } =
          await import("../features/school/classroom/search");
        return stackSearchSchema.parse(old.search);
      }),
  },
  {
    from: "/standings",
    about: "a class's standings in the query",
    when: ({ search }) => "class" in search,
    to: (old) =>
      screenView(old, async () => {
        const { standingsSearchSchema } =
          await import("../features/school/classroom/search");
        return standingsSearchSchema.parse(old.search);
      }),
  },
  {
    from: "/school/$org/experience",
    about: "the student experience, from before Settings",
    to: ({ params }) => ({
      to: `/school/${params.org}/settings`,
      hash: "student-experience",
    }),
  },

  // A family's older addresses.
  {
    from: "/family/learners",
    about: "the account's learners",
    to: familyLearners(),
  },
  {
    from: "/family/learners/new",
    about: "adding a learner",
    to: familyLearners("add-children"),
  },
  { from: "/family/$family/people", about: "People", to: familySettings() },
  {
    from: "/family/$family/cards",
    about: "sign-in cards",
    to: familySettings("devices"),
  },
  { from: "/family/$family/map", about: "the map", to: familyRecord(null) },
  {
    from: "/family/$family/workbooks",
    about: "workbooks",
    to: familyWorkbooks,
  },
  {
    from: "/family/$family/time",
    about: "practice time",
    to: familyRecord("child-time"),
  },
  {
    from: "/family/$family/reports",
    about: "report cards",
    to: familyRecord("child-reports"),
  },
  // A family's address with what isn't a family's id (the account's own
  // `/family/<section>` addresses are their rows above, and `/family/approve`
  // and `/family/approvals/<id>` are screens): the account's family.
  ...["/family/$family", "/family/$family/$"].map((from) => ({
    from,
    about: "not a family's id",
    when: ({ params }: OldAddress) =>
      !isFamilyId(params.family!) && !FAMILY_SCREENS.has(params.family!),
    to: () => "/family",
  })),
  // One of the family's own children opened as a roster layer.
  ...["/family/$family", "/family/$family/$"].map((from) => ({
    from,
    about: "a child's roster layer",
    when: ({ params, search }: OldAddress) => {
      const open = search[OPEN_KEY];
      return (
        isFamilyId(params.family!) &&
        typeof open === "string" &&
        open.includes("student:")
      );
    },
    to: familyChildLayer,
  })),
  // An older address that opened a sheet with a key (`?devices=1`,
  // `?add=1`): the same screen, the sheet from history state.
  ...["/family/$family", "/family/$family/$"].map((from) => ({
    from,
    about: "a sheet in the query",
    when: ({ params }: OldAddress) => isFamilyId(params.family!),
    to: async (old: OldAddress): Promise<Target | undefined> => {
      const { sheetHop } = await import("../features/family/redirects");
      const hop = sheetHop(old.pathname.replace(/\/+$/, ""), old.search);
      return hop ? { to: hop.href, state: hop.state } : undefined;
    },
  })),
  // A class code typed or shared in another form; a school sign-in that
  // stopped comes back with its reason (`?sso=`), which the class shows.
  {
    from: "/join/$code",
    about: "a class code in another form",
    when: ({ params }) =>
      !JOIN_CODE.test(params.code!) && plainCode(params.code!).length === 6,
    to: ({ params, search }) => {
      const plain = plainCode(params.code!);
      return withQuery(`/join/${plain.slice(0, 3)}-${plain.slice(3)}`, {
        sso: search.sso,
      });
    },
  },
  {
    from: "/school/$org/classes/$class/workbooks/$date",
    about: "a printed page's QR code",
    when: ({ search }) => "set" in search || "student" in search,
    to: toMarking,
  },
  {
    // Progress's view in its query (`?filter=&page=&strand=&skill=`): the
    // area or skill is its address now, and which skills and the page are
    // the learner's view, kept in its store (app/progress-view.ts).
    from: "/progress",
    about: "Progress's view in its query",
    when: ({ search }) =>
      ["filter", "page", "strand", "skill"].some((key) => key in search),
    to: async ({ search }) => {
      const text = (key: string) =>
        typeof search[key] === "string" || typeof search[key] === "number"
          ? String(search[key])
          : "";
      const view = await import("./progress-view");
      const session = await sessionIfAny();
      const me = session
        ? await queryClient.ensureQueryData(meOptions(session))
        : null;
      // Whose Progress `/progress` shows: the adult's own, else the
      // account's current child, else its first (LegacyApp).
      const learner =
        me?.signedIn && session
          ? (me.adultPractice?.learner?.id ??
            currentLearner(session.accountId) ??
            me.learners[0]?.id)
          : undefined;
      const filter = text("filter");
      if (session && learner)
        view.useProgressViews
          .getState()
          .set(view.progressKey(session.accountId, learner), {
            filter:
              filter === "review" || filter === "explore"
                ? filter
                : "practiced",
            page: Math.max(0, Number(text("page")) || 0),
            strand: text("strand"),
            skillId: null,
          });
      return view.progressPath({
        strand: text("strand"),
        skillId: text("skill") || null,
      });
    },
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

/** Every row an address matches, in table order, with the old address as
 * each reads it. */
export function findAliases(
  at: At,
  table: readonly LegacyAlias[] = LEGACY_ALIASES,
): { alias: LegacyAlias; old: OldAddress }[] {
  const found: { alias: LegacyAlias; old: OldAddress }[] = [];
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
    found.push({ alias, old });
  }
  return found;
}

/** Where an old address opens now and the row that says so, or null when
 * it is no old address (for this person). */
export async function aliasTarget(
  at: At,
  table: readonly LegacyAlias[] = LEGACY_ALIASES,
): Promise<{ target: Target; alias: LegacyAlias } | null> {
  for (const { alias, old } of findAliases(at, table)) {
    const target = await alias.to(old);
    if (target !== undefined) return { target, alias };
  }
  return null;
}

/**
 * The one generic hop (app/router.tsx, the root's `beforeLoad`): an old
 * address goes to its new one, replacing it in history. Nothing else.
 */
export async function followAlias(
  at: At,
  table: readonly LegacyAlias[] = LEGACY_ALIASES,
) {
  const found = await aliasTarget(at, table);
  if (!found) return;
  const { target } = found;
  if (typeof target === "string") {
    if (target !== `${at.pathname}${at.searchStr}`)
      throw redirect({ href: target, replace: true });
    return;
  }
  const { layers, ...address } = target;
  if (layers?.length) {
    const path = ("href" in address ? address.href : address.to).split(
      /[?#]/,
    )[0]!;
    const session = await sessionIfAny().catch((error: unknown) => {
      console.warn("Layers from an older link go to the guest's map", error);
      return null;
    });
    seedLayers(layerScope(path, session?.accountId), layers);
  }
  throw redirect({ ...address, replace: true } as never);
}
