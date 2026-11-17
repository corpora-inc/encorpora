import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { usePanelsStore } from "../../features/account/panels";
import { useViewStore, viewScope } from "../../features/school/view-store";
import { layerScope, useLayerStore } from "../../nav/layer-store";
import { meOptions, queryClient, sessionOptions } from "../../lib/query";
import {
  modeReturn,
  useModeReturns,
} from "../../features/profiles/mode-return";
import { currentLearner, useLearnerStore } from "../../learner-store";
import { knownDocumentPath } from "../document-routes";
import {
  aliasTarget,
  followAlias,
  LEGACY_ALIASES,
  matchPattern,
  type LegacyAlias,
} from "../legacy-aliases";

/*
 * Every row of the legacy-alias table (app/legacy-aliases.ts) lands in ONE
 * hop on its right address, and that address is no row's for the same
 * person: never chained. The rows come from the table; a row no example
 * reaches fails, so a new row brings its example with it.
 *
 * What a row reads from other modules is stubbed at their edge (the
 * settings hub, the pay hops, a family's projection): their own logic has
 * its own tests. Here the table and its one hop are under test.
 */

const FAMILY = "11111111-1111-4111-8111-111111111111";
const SCHOOL = "22222222-2222-4222-8222-222222222222";
const FAMILY_ORG = "33333333-3333-4333-8333-333333333333";
const CLASS = "44444444-4444-4444-8444-444444444444";
const CHILD = "55555555-5555-4555-8555-555555555555";
const ATTEMPT = "77777777-7777-4777-8777-777777777777";
/** A family of three children in its own class, each by their person. */
const FAMILY_OF_THREE = "88888888-8888-4888-8888-888888888888";
const KIDS = [
  [
    "99999999-9999-4999-8999-999999999991",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  ],
  [
    "99999999-9999-4999-8999-999999999992",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  ],
  [
    "99999999-9999-4999-8999-999999999993",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  ],
] as const;
const SESSION = { accountId: "parent", token: "test-token" };

/** Who opens the old address. */
type World = "family parent" | "adult" | "signed out";

const state = vi.hoisted(() => ({
  hub: "",
  consent: false,
  parent: false,
}));
vi.mock("../../features/spaces/settings-hub", () => ({
  loadSettingsHub: async (_session: unknown, overlay?: string) =>
    overlay ? `${state.hub}/${overlay}` : state.hub,
}));
// The catalog the lesson reader reads: one lesson AMP still has.
vi.mock("../../learning-transport", () => ({
  learningCatalogOptions: {
    queryKey: ["search-catalog"],
    queryFn: async () => ({ lessons: [{ id: "ratios" }] }),
    staleTime: Infinity,
  },
}));
vi.mock("../../consent-entry", () => ({
  hasInitialConsentChallenge: () => state.consent,
  claimInitialConsentChallenge: () => state.consent,
}));
vi.mock("../../features/home/destination", () => ({
  homeDestination: async () => `/family/${FAMILY}`,
}));
vi.mock("../../features/pay/legacy", () => ({
  legacyHop: async (hop: string, input: { params: Record<string, string> }) =>
    `/family/${FAMILY}/kids/${input.params.learnerId ?? CHILD}/pay${hop === "funds" || hop === "program" ? "/funds" : ""}`,
}));
vi.mock("../family-redirect", () => ({
  toFamilyAddress: async (
    _session: unknown,
    { params }: { params: { org: string } },
  ) =>
    state.parent && params.org === FAMILY_ORG
      ? { href: `/family/${FAMILY}` }
      : null,
  toFamilyChild: async (_session: unknown, org: string, person: string) =>
    state.parent && org === FAMILY_ORG
      ? { href: `/family/${FAMILY}/kids/${person}` }
      : null,
  toFamilyPage: async (
    _session: unknown,
    org: string,
    page: string,
    location: { hash?: string },
  ) =>
    state.parent && org === FAMILY_ORG
      ? {
          // Roster and Settings are Settings; Map and Today are Today (or a
          // one child's page: features/family/redirects.ts). A settings
          // section's anchor rides in the href.
          href: `/family/${FAMILY}${page === "roster" || page === "settings" ? "/settings" : ""}${location.hash ? `#${location.hash}` : ""}`,
        }
      : null,
}));
vi.mock("../../features/family/api", async (original) => ({
  ...(await original<typeof import("../../features/family/api")>()),
  familyPlacesOptions: () => ({
    queryKey: ["test", "places"],
    queryFn: async () => ({
      families: state.parent ? [{ familyId: FAMILY, role: "holder" }] : [],
    }),
  }),
  familyOptions: (_session: unknown, id: string) => ({
    queryKey: ["test", "family", id],
    queryFn: async () =>
      id === FAMILY_OF_THREE
        ? {
            familyId: id,
            children: KIDS.map(([learner, person]) => ({
              id: learner,
              classes: [
                {
                  id: CLASS,
                  personId: person,
                  name: "Our family",
                  orgId: FAMILY_ORG,
                  hostedByFamily: true,
                },
              ],
            })),
          }
        : { familyId: id, children: [{ id: CHILD, classes: [] }] },
  }),
}));

/** The adult's own practice and their practice profile, for the learning
 * screens' rows (their `/me`). */
const OWN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROFILE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ADULT_ME = {
  signedIn: true,
  account: { id: SESSION.accountId, kind: "adult", email: null },
  learners: [],
  adultPractice: { eligible: true, learner: { id: OWN, name: "Ines" } },
  practiceProfiles: [{ id: PROFILE, label: "Grade 4" }],
};
function enter(world: World, consent = false, me?: object) {
  queryClient.clear();
  queryClient.setQueryData(
    sessionOptions.queryKey,
    world === "signed out" ? null : SESSION,
  );
  if (me) queryClient.setQueryData(meOptions(SESSION).queryKey, me as never);
  // No current learner and no practice mode carried from another example.
  useLearnerStore.setState({ learners: {} });
  useModeReturns.setState({ returns: {} });
  state.hub =
    world === "family parent" ? `/family/${FAMILY}/settings` : "/account";
  state.parent = world === "family parent";
  state.consent = consent;
}

type Example = {
  /** The old address. */
  from: string;
  world: World;
  /** Where it lands: its path, query and hash. */
  lands: string;
  /** The panel store afterwards, where the row writes one. */
  panel?: { overlay: "privacy" | "billing"; id: string | null };
  /** The sheet history state opens, where the row opens one. */
  sheet?: string;
  /** The layers the store holds for the screen it lands on. */
  layers?: string[];
  /** The consent email's proof is held (consent-entry.ts). */
  consent?: boolean;
  /** The school view store afterwards, for the landing screen. */
  view?: Record<string, unknown>;
  /** Their `/me`, where the row reads it. */
  me?: object;
};

const PRIVACY = `/family/${FAMILY}/settings/privacy`;
const CLASS_AT = `/school/${SCHOOL}/classes/${CLASS}`;
const FAMILY_PAY = `/family/${FAMILY}/kids/${CHILD}/pay`;
const EXAMPLES: Example[] = [
  { from: "/", world: "adult", consent: true, lands: "/consent" },
  {
    from: `/practice/${CHILD}`,
    world: "adult",
    consent: true,
    lands: "/consent",
  },
  {
    from: "/?sign-in=create&return=school&error=bad",
    world: "signed out",
    lands: "/sign-up?return=school&error=bad",
  },
  { from: "/?sign-in", world: "signed out", lands: "/sign-in" },
  {
    from: "/?reset-password&token=abc",
    world: "signed out",
    lands: "/reset-password?token=abc",
  },
  {
    from: "/design?frame=specimen&specimen=tab-row-family-open&theme=dark",
    world: "signed out",
    lands: "/design/specimen/tab-row-family-open",
  },
  {
    from: "/design?frame=canvas&theme=light#buttons",
    world: "signed out",
    lands: "/design/canvas#buttons",
  },
  { from: "/design?width=390", world: "signed out", lands: "/design" },
  { from: "/try", world: "signed out", lands: "/sign-up?return=free-practice" },
  { from: "/try/anything", world: "adult", lands: `/family/${FAMILY}` },

  ...(
    ["export", "consent", "delete", "retention", "measurement"] as const
  ).flatMap((panel) => [
    {
      from: `/account/privacy/${panel}`,
      world: "family parent" as const,
      lands: PRIVACY,
      panel: { overlay: "privacy" as const, id: panel },
    },
    {
      from: `/family/privacy/${panel}`,
      world: "adult" as const,
      lands: "/account/privacy",
      panel: { overlay: "privacy" as const, id: panel },
    },
  ]),
  {
    from: "/family/privacy",
    world: "family parent",
    lands: PRIVACY,
    panel: { overlay: "privacy", id: null },
  },
  {
    from: "/account/privacy/elsewhere",
    world: "adult",
    lands: "/account/privacy",
    panel: { overlay: "privacy", id: null },
  },
  {
    from: "/family/privacy/export",
    world: "signed out",
    lands: "/sign-in?return=school&next=%2Ffamily%2Fprivacy%2Fexport",
  },
  {
    from: "/account/security/delete",
    world: "family parent",
    lands: `/family/${FAMILY}/settings/delete-account`,
  },
  {
    from: "/family/security/delete",
    world: "adult",
    lands: "/account/delete-account",
  },
  {
    from: "/account/billing/records",
    world: "adult",
    lands: "/account/billing",
    panel: { overlay: "billing", id: "receipts" },
  },
  { from: "/family/security", world: "adult", lands: "/account/security" },
  { from: "/family/access", world: "adult", lands: "/account/billing" },
  {
    from: "/family/access/purchases",
    world: "adult",
    lands: "/account/billing",
  },
  { from: "/family/access", world: "signed out", lands: "/sign-in" },

  { from: `/continue/${CHILD}`, world: "family parent", lands: FAMILY_PAY },
  { from: `/pay/${CHILD}`, world: "family parent", lands: FAMILY_PAY },
  { from: "/purchase/annual", world: "family parent", lands: FAMILY_PAY },
  { from: "/purchase/choose", world: "family parent", lands: FAMILY_PAY },
  {
    from: "/purchase/funded",
    world: "family parent",
    lands: `${FAMILY_PAY}/funds`,
  },
  ...["arkansas-efa", "arizona-esa", "new-hampshire-efa"].map((program) => ({
    from: `/purchase/${program}`,
    world: "family parent" as const,
    lands: `${FAMILY_PAY}/funds`,
  })),

  {
    from: "/lessons?q=fractions&topic=add-fractions",
    world: "adult",
    // The search goes into the map's view (features/pathways/map-view.ts).
    lands: "/pathways",
    layers: ["lesson:add-fractions"],
  },
  { from: "/lessons?q=fractions", world: "adult", lands: "/pathways" },
  {
    from: "/lessons?q=fractions&strand=geometry",
    world: "adult",
    lands: "/pathways",
  },
  // A lesson AMP no longer has; one it has opens in its reader (below).
  { from: "/lessons/retired-lesson", world: "adult", lands: "/pathways" },
  {
    from: "/pathways?skill=s1&view=3d",
    world: "signed out",
    // 3D becomes this device's choice of view.
    lands: "/pathways",
    layers: ["skill:s1"],
  },
  {
    from: "/pathways?open=skill%3As2",
    world: "signed out",
    lands: "/pathways",
    layers: ["skill:s2"],
  },
  {
    from: "/pathways/s1?lesson=t1",
    world: "adult",
    lands: "/pathways",
    layers: ["skill:s1", "lesson:t1"],
  },
  {
    from: "/pathways?topic=fractions&filter=3&area=geometry",
    world: "adult",
    lands: "/pathways",
  },
  {
    from: `/family/${FAMILY}/kids/${CHILD}/pathways?open=skill%3As1&topic=x`,
    world: "family parent",
    lands: `/family/${FAMILY}/kids/${CHILD}/pathways`,
    layers: ["skill:s1"],
  },

  {
    from: `/learners/${CHILD}/workbooks/2026-11-16?minutes=45&paper=a4`,
    world: "adult",
    lands: `/learners/${CHILD}/workbooks/2026-11-16`,
  },
  {
    from: "/lessons/add-fractions/watch?problem=p1&from=%2Fpathways",
    world: "adult",
    lands: "/lessons/add-fractions/watch/p1",
  },
  {
    from: "/lessons/add-fractions/watch?from=%2Fpathways",
    world: "adult",
    lands: "/lessons/add-fractions/watch",
  },
  {
    from: `/practice/${CHILD}?skill=s1&profile=p`,
    world: "adult",
    me: ADULT_ME,
    lands: `/practice/${CHILD}/skills/s1`,
  },
  // Learning screens by an older query, or naming nobody.
  { from: "/practice", world: "adult", me: ADULT_ME, lands: `/practice/${OWN}` },
  {
    from: `/practice?profile=${PROFILE}&from=%2Fme%2Flevel&skill=s1`,
    world: "adult",
    me: ADULT_ME,
    lands: `/practice/${PROFILE}/skills/s1`,
  },
  {
    from: `/practice/${CHILD}/skills/s1?learner=${OWN}`,
    world: "adult",
    me: ADULT_ME,
    lands: `/practice/${CHILD}/skills/s1`,
  },
  ...["/overview", "/progress", "/books", "/inventory", "/pathways"].map(
    (path) => ({
      from: `${path}?learner=${OWN}`,
      world: "adult" as const,
      me: ADULT_ME,
      lands: path,
    }),
  ),
  {
    from: `/practice/${CHILD}?template=t1&strand=geometry`,
    world: "adult",
    lands: `/practice/${CHILD}/types/t1`,
  },
  {
    from: `/practice/${CHILD}?strand=geometry`,
    world: "signed out",
    lands: `/practice/${CHILD}/areas/geometry`,
  },
  {
    from: `/school/${FAMILY_ORG}/classes/${CLASS}`,
    world: "family parent",
    lands: `/family/${FAMILY}`,
  },
  {
    from: `/school/${FAMILY_ORG}/classes/${CLASS}/map/${CHILD}`,
    world: "family parent",
    lands: `/family/${FAMILY}`,
  },
  ...[
    ["", ""],
    ["/standing", ""],
    [`/standing/${CLASS}`, ""],
    ["/schools", ""],
    ["/year", ""],
    ["/year/classes", ""],
    ["/integrations", ""],
    ["/privacy", ""],
    ["/activity", ""],
    ["/classes", ""],
    ["/students", "/settings"],
    ["/staff", "/settings"],
    ["/sign-in-help", ""],
    ["/calendar", "/settings"],
    ["/settings", "/settings"],
    ["/license", ""],
    ["/import", ""],
    ["/import/columns", ""],
  ].map(([page, leaf]) => ({
    from: `/school/${FAMILY_ORG}${page}`,
    world: "family parent" as const,
    lands: `/family/${FAMILY}${leaf}`,
  })),
  // A family target's href keeps its anchor through the one hop.
  {
    from: `/school/${FAMILY_ORG}/settings#family-year`,
    world: "family parent",
    lands: `/family/${FAMILY}/settings#family-year`,
  },
  { from: CLASS_AT, world: "adult", lands: `${CLASS_AT}/today` },
  // Everyone else's class address: the class's own rows.
  { from: CLASS_AT, world: "family parent", lands: `${CLASS_AT}/today` },
  {
    from: `${CLASS_AT}/today?lesson=t1`,
    world: "adult",
    lands: `${CLASS_AT}/today`,
    layers: ["lesson:t1"],
  },
  {
    from: `${CLASS_AT}/map/${CHILD}?sort=name`,
    world: "adult",
    lands: `${CLASS_AT}/map?sort=name`,
    layers: [`student:${CHILD}`],
  },
  {
    from: `${CLASS_AT}/map/${CHILD}/work/${ATTEMPT}`,
    world: "adult",
    lands: `${CLASS_AT}/map`,
    layers: [`student:${CHILD}`, `work:${CHILD}.${ATTEMPT}`],
  },
  {
    from: `/school/${SCHOOL}/students/${CHILD}`,
    world: "adult",
    lands: `/school/${SCHOOL}/students`,
    layers: [`student:${CHILD}`],
  },
  {
    from: `/school/${SCHOOL}/students/${CHILD}/work/${ATTEMPT}`,
    world: "adult",
    lands: `/school/${SCHOOL}/students`,
    layers: [`student:${CHILD}`, `work:${CHILD}.${ATTEMPT}`],
  },
  {
    from: `/school/${FAMILY_ORG}/students/${CHILD}`,
    world: "family parent",
    lands: `/family/${FAMILY}/kids/${CHILD}`,
  },
  { from: "/school/new", world: "signed out", lands: "/schools" },
  {
    from: `/school/new?org=${SCHOOL}&step=calendar`,
    world: "adult",
    lands: `/school/${SCHOOL}/setup/calendar`,
  },
  {
    from: `/school/${SCHOOL}/experience`,
    world: "adult",
    lands: `/school/${SCHOOL}/settings#student-experience`,
  },

  {
    from: "/family/learners",
    world: "family parent",
    lands: `/family/${FAMILY}/settings`,
  },
  {
    from: "/family/learners/new",
    world: "family parent",
    lands: `/family/${FAMILY}/settings`,
    sheet: "add-children",
  },
  { from: "/family/learners", world: "adult", lands: "/family" },
  { from: "/family/not-an-id", world: "adult", lands: "/family" },
  { from: "/family/not-an-id/settings", world: "adult", lands: "/family" },
  {
    from: `/family/${FAMILY}?devices=1`,
    world: "family parent",
    lands: `/family/${FAMILY}`,
    sheet: "devices",
  },
  {
    from: `/family/${FAMILY}/settings?add=1`,
    world: "family parent",
    lands: `/family/${FAMILY}/settings`,
    sheet: "add-children",
  },
  {
    from: `/family/${FAMILY}/people`,
    world: "family parent",
    lands: `/family/${FAMILY}/settings`,
  },
  {
    from: `/family/${FAMILY}/cards`,
    world: "family parent",
    lands: `/family/${FAMILY}/settings`,
    sheet: "devices",
  },
  {
    from: `/family/${FAMILY}/map?open=skill%3As1`,
    world: "family parent",
    lands: `/family/${FAMILY}?open=skill%3As1`,
  },
  // Several children: their workbook print is the address itself; an older
  // flag or learner list leaves the query, the children as their people.
  {
    from: `/family/${FAMILY_OF_THREE}/workbooks?several=1&paper=a4&kids=${KIDS[1][0]},${KIDS[2][0]}`,
    world: "family parent",
    lands: `/family/${FAMILY_OF_THREE}/workbooks?paper=a4&students=${KIDS[1][1]}%2C${KIDS[2][1]}`,
  },
  // One of their own children opened as a roster layer: their page.
  {
    from: `/family/${FAMILY_OF_THREE}?open=student%3A${KIDS[1][1]}`,
    world: "family parent",
    lands: `/family/${FAMILY_OF_THREE}/kids/${KIDS[1][0]}`,
  },
  {
    from: `/family/${FAMILY_OF_THREE}/settings?open=student%3A${KIDS[2][1]}`,
    world: "family parent",
    lands: `/family/${FAMILY_OF_THREE}/kids/${KIDS[2][0]}`,
  },
  ...[
    ["workbooks", "child-workbooks"],
    ["time", "child-time"],
    ["reports", "child-reports"],
  ].map(([leaf, anchor]) => ({
    from: `/family/${FAMILY}/${leaf}`,
    world: "family parent" as const,
    lands: `/family/${FAMILY}/kids/${CHILD}#${anchor}`,
  })),
  { from: "/join/abc-def", world: "signed out", lands: "/join/ABC-DEF" },
  {
    from: "/join/abcdef?sso=declined",
    world: "signed out",
    lands: "/join/ABC-DEF?sso=declined",
  },
  {
    from: `/school/o/classes/c/workbooks/2026-11-02?set=3&student=${FAMILY}`,
    world: "adult",
    lands: "/school/o/classes/c/workbooks/2026-11-02",
    view: { set: 3, student: FAMILY },
  },
];

/** A router whose root asks the table first, as app/router.tsx's does. */
function routerAt(path: string) {
  const root = createRootRoute({
    beforeLoad: ({ location, preload }) =>
      preload ? undefined : followAlias(location),
  });
  const tree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/" }),
    createRoute({ getParentRoute: () => root, path: "$" }),
  ]);
  const router = createRouter({
    routeTree: tree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  let navigations = 0;
  router.subscribe("onBeforeNavigate", () => navigations++);
  return { router, hops: () => navigations - 1 };
}

const at = (href: string) => {
  const url = new URL(href, "https://amp.invalid");
  return {
    pathname: url.pathname,
    searchStr: url.search,
    search: Object.fromEntries(url.searchParams) as Record<string, unknown>,
    hash: url.hash.slice(1),
  };
};
/** An address's path, query (decoded, in order) and hash, for comparing. */
const shape = (href: string) => {
  const url = new URL(href, "https://amp.invalid");
  return {
    path: url.pathname,
    query: [...url.searchParams].sort(),
    hash: url.hash,
  };
};

/** The row an example's address is handled by, in its world. */
async function rowOf(example: Example): Promise<LegacyAlias | undefined> {
  enter(example.world, example.consent, example.me);
  try {
    return (await aliasTarget(at(example.from)))?.alias;
  } catch {
    // A row that calls the sign-in gate throws its hop: find it by trying
    // each matching row on its own.
    for (const alias of LEGACY_ALIASES)
      if (matchPattern(alias.from, at(example.from).pathname))
        try {
          if (await aliasTarget(at(example.from), [alias])) return alias;
        } catch (hop) {
          if (hop && typeof hop === "object" && "options" in hop) return alias;
        }
    return undefined;
  }
}

beforeEach(() => usePanelsStore.setState({ accounts: {} }));
afterEach(() => vi.clearAllMocks());

test("every row has an example that reaches it", async () => {
  const reached = new Set<LegacyAlias>();
  for (const example of EXAMPLES) {
    const row = await rowOf(example);
    if (row) reached.add(row);
  }
  expect(
    LEGACY_ALIASES.filter((alias) => !reached.has(alias)).map(
      (alias) => `${alias.from} (${alias.about})`,
    ),
  ).toEqual([]);
});

for (const example of EXAMPLES)
  test(`${example.world}: ${example.from} is one hop to ${example.lands}`, async () => {
    enter(example.world, example.consent, example.me);
    const { router, hops } = routerAt(example.from);
    await router.load();
    const { pathname, searchStr, hash } = router.state.location;
    const landed = `${pathname}${searchStr}${hash ? `#${hash}` : ""}`;
    expect(shape(landed)).toEqual(shape(example.lands));
    expect(hops()).toBe(1);
    // Never chained: where it lands is no row's, for the same person.
    state.consent = false;
    expect(await aliasTarget(at(landed)).catch(() => "a hop")).toBeNull();
    if (example.view)
      expect(
        useViewStore.getState().views[viewScope(SESSION.accountId, landed)],
      ).toEqual(example.view);
    if (example.panel)
      expect(
        usePanelsStore.getState().accounts.parent?.[example.panel.overlay] ??
          null,
      ).toBe(example.panel.id);
    if (example.layers)
      expect(
        (
          useLayerStore.getState().stacks[
            layerScope(
              pathname,
              state.parent || example.world === "adult"
                ? SESSION.accountId
                : undefined,
            )
          ] ?? []
        ).map((layer) => `${layer.kind}:${layer.id}`),
      ).toEqual(example.layers);
    if (example.sheet)
      expect(
        Object.values(
          (router.state.location.state ?? {}) as unknown as Record<
            string,
            unknown
          >,
        ),
      ).toContain(example.sheet);
  });

test("the server serves every row's old address (document-routes.ts)", async () => {
  const served = new Set<LegacyAlias>();
  for (const example of EXAMPLES) {
    const row = await rowOf(example);
    if (row && knownDocumentPath(at(example.from).pathname)) served.add(row);
  }
  expect(
    LEGACY_ALIASES.filter((alias) => !served.has(alias)).map(
      (alias) => alias.from,
    ),
  ).toEqual([]);
});

test("a lesson the catalog has stays at its own address", async () => {
  enter("adult");
  expect(await aliasTarget(at("/lessons/ratios"))).toBeNull();
});

test("patterns match whole addresses, a final $ the rest", () => {
  expect(
    matchPattern("/family/privacy/$panel", "/family/privacy/export"),
  ).toEqual({ panel: "export" });
  expect(matchPattern("/family/privacy/$panel", "/family/privacy")).toBeNull();
  expect(matchPattern("/family/privacy", "/family/privacy/")).toEqual({});
  expect(matchPattern("/account/billing/$", "/account/billing/a/b")).toEqual({
    _splat: "a/b",
  });
  expect(matchPattern("/account/billing/$", "/account/billing")).toBeNull();
  expect(matchPattern("/", "/")).toEqual({});
  expect(matchPattern("/$", "/")).toBeNull();
});

test("an older ?profile=&from= link is the mode: the profile is the current learner, the return kept", async () => {
  enter("adult", false, ADULT_ME);
  const { router } = routerAt(
    `/pathways?profile=${PROFILE}&from=%2Fschool%2F${SCHOOL}`,
  );
  await router.load();
  expect(router.state.location.href).toBe("/pathways");
  expect(currentLearner(SESSION.accountId)).toBe(PROFILE);
  expect(modeReturn(SESSION.accountId)).toBe(`/school/${SCHOOL}`);
});
