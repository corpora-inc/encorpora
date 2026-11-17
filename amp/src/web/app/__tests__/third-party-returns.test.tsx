import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { familyPlacesOptions } from "../../features/family/api";
import { usePayStore } from "../../features/pay/store";
import { meOptions, queryClient, sessionOptions } from "../../lib/query";
import {
  homeReturn,
  resumeStripeReturn,
  stripeReturn,
  useReturnNotices,
} from "../third-party-returns";

/*
 * Stripe Checkout's returns (billing/stripe/gateway.ts), each resolved by
 * the router in one hop before any screen loads (so LegacyApp never
 * captures one while signed in):
 *
 *   /?billing=processing|canceled&purchase=<id>              a learner's
 *   /start/purchase?billing=processing|canceled&purchase=<id> an enrollment
 *   /?billing=account                                         the portal
 */

const LEARNER = "55555555-5555-4555-8555-555555555555";
const PURCHASE = "66666666-6666-4666-8666-666666666666";
const SESSION = { accountId: "parent", token: "test-token" };
const BASE = `/family/f/kids/${LEARNER}/pay`;

const server = vi.hoisted(() => ({ learner: "" as string | null }));
vi.mock("../../features/pay/api", () => ({
  purchaseLearner: async () => server.learner,
}));

function routerAt(path: string) {
  const root = createRootRoute({
    beforeLoad: ({ preload }) => (preload ? undefined : resumeStripeReturn()),
  });
  const tree = root.addChildren([
    createRoute({
      getParentRoute: () => root,
      path: "/",
      beforeLoad: ({ location }) => homeReturn(location),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/start/purchase",
      beforeLoad: async ({ location }) =>
        stripeReturn(
          location,
          "enrollment",
          await queryClient.ensureQueryData(sessionOptions),
        ),
    }),
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

function signedIn(checkout?: "learner" | "enrollment", base: string = BASE) {
  server.learner = LEARNER;
  sessionStorage.clear();
  useReturnNotices.setState({ accounts: {} });
  queryClient.clear();
  queryClient.setQueryData(sessionOptions.queryKey, SESSION);
  usePayStore.setState({ accounts: {} });
  if (checkout)
    usePayStore.getState().checkoutOpened(SESSION.accountId, {
      learnerId: LEARNER,
      kind: checkout,
      base,
    });
}

/** A family's holder: their settings hub is the family's Settings. */
function inFamily(learners: { id: string; adult: boolean }[] = []) {
  queryClient.setQueryData(familyPlacesOptions(SESSION).queryKey, {
    families: [{ familyId: "f", orgId: "f", role: "holder" }],
  } as never);
  queryClient.setQueryData(meOptions(SESSION).queryKey, {
    signedIn: true,
    account: { id: SESSION.accountId, kind: "adult" },
    learners: learners.filter((entry) => !entry.adult),
    familyClass: { orgId: "f" },
    family: { learners },
  } as never);
}

beforeEach(() => signedIn());

const CASES: [string, "learner" | "enrollment" | undefined, string][] = [
  [`/?billing=processing&purchase=${PURCHASE}`, "learner", `${BASE}/done`],
  // Left Stripe without paying: the plan again, over the same screen.
  [`/?billing=canceled&purchase=${PURCHASE}`, "learner", BASE],
  // The billing portal's return: Billing.
  ["/?billing=account", undefined, "/account/billing"],
  [
    `/start/purchase?billing=processing&purchase=${PURCHASE}`,
    "enrollment",
    `${BASE}/done`,
  ],
  [`/start/purchase?billing=canceled&purchase=${PURCHASE}`, "enrollment", BASE],
];

for (const [from, checkout, lands] of CASES)
  test(`${from} is one hop to ${lands}`, async () => {
    signedIn(checkout);
    const { router, hops } = routerAt(from);
    await router.load();
    expect(router.state.location.href).toBe(lands);
    expect(hops()).toBe(1);
  });

// Every place Checkout opens from (features/pay/address.ts): leaving Stripe
// (its back link) and paying both land on the overlay it was opened from,
// over the same screen, never `/account`.
const ENTRIES = {
  "the child's page": `/family/f/kids/${LEARNER}/pay`,
  Today: `/family/f/pay/${LEARNER}`,
  // Billing's "Continue with AMP" opens this same overlay over Settings.
  Settings: `/family/f/settings/pay/${LEARNER}`,
  // An adult without a family: the account's own hub.
  "the account": `/account/pay/${LEARNER}`,
};
for (const [entry, base] of Object.entries(ENTRIES))
  for (const kind of ["learner", "enrollment"] as const)
    for (const state of ["canceled", "processing"] as const)
      test(`a ${kind} checkout from ${entry}, ${state}, returns over the same screen`, async () => {
        signedIn(kind, base);
        const from =
          kind === "learner"
            ? `/?billing=${state}&purchase=${PURCHASE}`
            : `/start/purchase?billing=${state}&purchase=${PURCHASE}`;
        const { router, hops } = routerAt(from);
        await router.load();
        expect(router.state.location.href).toBe(
          state === "canceled" ? base : `${base}/done`,
        );
        expect(hops()).toBe(1);
      });

test("a practice profile's checkout starts the adult's own learner: the same screen, for them", async () => {
  const OWN = "77777777-7777-4777-8777-777777777777";
  const PROFILE = "88888888-8888-4888-8888-888888888888";
  signedIn("learner", `/family/f/settings/pay/${PROFILE}`);
  usePayStore.getState().checkoutOpened(SESSION.accountId, {
    learnerId: PROFILE,
    kind: "learner",
    base: `/family/f/settings/pay/${PROFILE}`,
  });
  server.learner = OWN;
  const { router } = routerAt(`/?billing=canceled&purchase=${PURCHASE}`);
  await router.load();
  expect(router.state.location.href).toBe(`/family/f/settings/pay/${OWN}`);
});

test("opened in another tab, a family's adult returns over the family's Settings, never /account", async () => {
  const OWN = "77777777-7777-4777-8777-777777777777";
  inFamily([{ id: OWN, adult: true }]);
  server.learner = OWN;
  const { router } = routerAt(`/?billing=canceled&purchase=${PURCHASE}`);
  await router.load();
  expect(router.state.location.href).toBe(`/family/f/settings/pay/${OWN}`);
});

test("opened in another tab, a child returns over their own page", async () => {
  inFamily([{ id: LEARNER, adult: false }]);
  const { router } = routerAt(`/?billing=canceled&purchase=${PURCHASE}`);
  await router.load();
  expect(router.state.location.href).toBe(`/family/f/kids/${LEARNER}/pay`);
});

test("a family's billing portal and unplaced returns open Billing in the family's Settings", async () => {
  // The portal's return, even with a checkout open in this tab.
  signedIn("learner");
  inFamily();
  const portal = routerAt("/?billing=account");
  await portal.router.load();
  expect(portal.router.state.location.href).toBe("/family/f/settings/billing");
  server.learner = null;
  usePayStore.setState({ accounts: {} });
  const unplaced = routerAt(`/?billing=processing&purchase=${PURCHASE}`);
  await unplaced.router.load();
  expect(unplaced.router.state.location.href).toBe(
    "/family/f/settings/billing",
  );
  expect(unplaced.hops()).toBe(1);
});

test("an enrollment return this tab didn't open stays on its step", async () => {
  const from = `/start/purchase?billing=processing&purchase=${PURCHASE}`;
  const { router, hops } = routerAt(from);
  await router.load();
  expect(router.state.location.pathname).toBe("/start/purchase");
  expect(hops()).toBe(0);
});

test("signed out, a learner's return signs in, then resumes in one hop", async () => {
  signedIn("learner");
  queryClient.setQueryData(sessionOptions.queryKey, null);
  const { router, hops } = routerAt(
    `/?billing=processing&purchase=${PURCHASE}`,
  );
  await router.load();
  expect(router.state.location.pathname).toBe("/sign-in");
  expect(hops()).toBe(1);
  // Signed in, the sign-in screen goes to the account's place: the kept
  // return takes that navigation to the confirmation instead, once.
  queryClient.setQueryData(sessionOptions.queryKey, SESSION);
  await router.navigate({ href: "/family/f" });
  expect(router.state.location.href).toBe(`${BASE}/done`);
  expect(hops()).toBe(3);
  await router.navigate({ href: "/family/f" });
  expect(router.state.location.href).toBe("/family/f");
});

test("a learner return the server can't place opens Billing, saying so", async () => {
  server.learner = null;
  const { router, hops } = routerAt(
    `/?billing=processing&purchase=${PURCHASE}`,
  );
  await router.load();
  expect(router.state.location.href).toBe("/account/billing");
  expect(hops()).toBe(1);
  expect(useReturnNotices.getState().accounts[SESSION.accountId]).toBe(
    "purchase-unmatched",
  );
});

test("a provider's sign-in and a linked provider each hop once", async () => {
  const security = routerAt("/?security");
  await security.router.load();
  expect(security.router.state.location.pathname).toBe("/account/security");
  expect(security.hops()).toBe(1);
});

test("an older sign-up link's arrival is dropped in one hop; the gate's way back stays", async () => {
  const { arrivalReturn, signInReturn } =
    await import("../third-party-returns");
  const hop = (
    pathname: string,
    search: Record<string, unknown>,
    hash = "",
  ) => {
    try {
      (search.error ? signInReturn : arrivalReturn)({
        pathname,
        searchStr: `?${new URLSearchParams(search as Record<string, string>)}`,
        search,
        hash,
      });
      return null;
    } catch (thrown) {
      return (thrown as { options: Record<string, unknown> }).options;
    }
  };
  expect(
    hop("/sign-up", { entry: "pitch-try", return: "free-practice" }),
  ).toMatchObject({ to: "/sign-up", search: {}, replace: true });
  // A handed-off Google start keeps its fragment.
  expect(
    hop(
      "/sign-up",
      { entry: "pitch-buy", utm_source: "google" },
      "continue-with-google",
    ),
  ).toMatchObject({ to: "/sign-up", search: {}, hash: "continue-with-google" });
  expect(
    hop("/sign-in", { return: "access", program: "ar-efa" }),
  ).toMatchObject({ to: "/sign-in", search: { return: "access" } });
  // A failure is kept and its arrival dropped in the same hop.
  expect(
    hop("/sign-up", { error: "access_denied", entry: "pitch-try" }),
  ).toMatchObject({ to: "/sign-up", search: {} });
  // Nothing to drop: the screen's own address stays.
  expect(hop("/sign-in", { return: "access" })).toBeNull();
  expect(hop("/sign-up", {})).toBeNull();
});

test("in an app's own browser, an arrival stays on the address its Open in browser opens", async () => {
  const { arrivalReturn } = await import("../third-party-returns");
  const agent = vi
    .spyOn(navigator, "userAgent", "get")
    .mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone16,2; iOS 18_1; en_US; en; scale=3.00; 1290x2796; 667412305)",
    );
  try {
    expect(
      arrivalReturn({
        pathname: "/sign-up",
        searchStr: "?entry=pitch-try",
        search: { entry: "pitch-try" },
      }),
    ).toBeUndefined();
  } finally {
    agent.mockRestore();
  }
});
