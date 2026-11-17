import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { usePanelsStore } from "../../features/account/panels";
import { queryClient, sessionOptions } from "../../lib/query";
import { knownDocumentPath } from "../document-routes";
import {
  findAlias,
  followAlias,
  LEGACY_ALIASES,
  matchPattern,
  type LegacyAlias,
} from "../legacy-aliases";

/*
 * Every row of the legacy-alias table (app/legacy-aliases.ts) lands in ONE
 * hop on its right address, and that address is no row's: never chained.
 * The rows come from the table; a row without an example here fails, so a
 * new row brings its example with it.
 */

const FAMILY = "11111111-1111-4111-8111-111111111111";
const SESSION = { accountId: "parent", token: "test-token" };

/** Who opens the old address. */
type World = "family parent" | "adult" | "signed out";

const hub = vi.hoisted(() => ({ href: "" }));
vi.mock("../../features/spaces/settings-hub", () => ({
  loadSettingsHub: async (_session: unknown, overlay: string) =>
    `${hub.href}/${overlay}`,
}));
vi.mock("../../consent-entry", () => ({
  hasInitialConsentChallenge: () => consent.held,
}));
const consent = vi.hoisted(() => ({ held: false }));

function enter(world: World) {
  queryClient.clear();
  queryClient.setQueryData(
    sessionOptions.queryKey,
    world === "signed out" ? null : SESSION,
  );
  hub.href = world === "family parent" ? `/family/${FAMILY}/settings` : "/account";
}

type Example = {
  /** The old address. */
  from: string;
  world: World;
  /** Where it lands: its path and query, exactly. */
  lands: string;
  /** The panel store afterwards, where the row writes one. */
  panel?: { overlay: "privacy"; id: string | null };
  /** The consent email's proof is held (consent-entry.ts). */
  consent?: boolean;
};

const PRIVACY = `/family/${FAMILY}/settings/privacy`;
const EXAMPLES: Example[] = [
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
  { from: "/", world: "adult", consent: true, lands: "/consent" },
  ...(["export", "consent", "delete", "retention", "measurement"] as const)
    .flatMap((panel) => [
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
  // Not a panel: the overlay, nothing opened.
  {
    from: "/account/privacy/elsewhere",
    world: "adult",
    lands: "/account/privacy",
    panel: { overlay: "privacy", id: null },
  },
  // Signed out: sign in, then straight back to the old address.
  {
    from: "/family/privacy/export",
    world: "signed out",
    lands: "/sign-in?return=school&next=%2Ffamily%2Fprivacy%2Fexport",
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
    search: Object.fromEntries(url.searchParams),
  };
};
const rowOf = (example: Example): LegacyAlias | undefined => {
  consent.held = !!example.consent;
  return findAlias(at(example.from))?.alias;
};

beforeEach(() => usePanelsStore.setState({ accounts: {} }));
afterEach(() => {
  consent.held = false;
  vi.clearAllMocks();
});

for (const alias of LEGACY_ALIASES)
  test(`row ${alias.from} (${alias.about}) has an example`, () => {
    expect(EXAMPLES.some((example) => rowOf(example) === alias)).toBe(true);
  });

for (const example of EXAMPLES)
  test(`${example.world}: ${example.from} is one hop to ${example.lands}`, async () => {
    expect(rowOf(example), "the example is a row's").toBeDefined();
    enter(example.world);
    consent.held = !!example.consent;
    const { router, hops } = routerAt(example.from);
    await router.load();
    const { pathname, searchStr } = router.state.location;
    const landed = `${pathname}${searchStr}`;
    expect(new URL(landed, "https://amp.invalid")).toEqual(
      new URL(example.lands, "https://amp.invalid"),
    );
    expect(hops()).toBe(1);
    // Never chained: where it lands is no row's.
    consent.held = false;
    expect(findAlias(at(landed))).toBeNull();
    if (example.panel)
      expect(
        usePanelsStore.getState().accounts.parent?.[example.panel.overlay] ??
          null,
      ).toBe(example.panel.id);
  });

test("the server serves every row's old address (document-routes.ts)", () => {
  for (const alias of LEGACY_ALIASES)
    expect(
      EXAMPLES.some(
        (example) =>
          rowOf(example) === alias &&
          knownDocumentPath(at(example.from).pathname),
      ),
      alias.from,
    ).toBe(true);
});

test("patterns match whole addresses, a final $ the rest", () => {
  expect(matchPattern("/family/privacy/$panel", "/family/privacy/export")).toEqual({
    panel: "export",
  });
  expect(matchPattern("/family/privacy/$panel", "/family/privacy")).toBeNull();
  expect(matchPattern("/family/privacy", "/family/privacy/")).toEqual({});
  expect(matchPattern("/account/billing/$", "/account/billing/a/b")).toEqual({
    _splat: "a/b",
  });
  expect(matchPattern("/account/billing/$", "/account/billing")).toBeNull();
  expect(matchPattern("/", "/")).toEqual({});
});
