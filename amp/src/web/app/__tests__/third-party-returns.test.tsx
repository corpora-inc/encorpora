import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { usePayStore } from "../../features/pay/store";
import { queryClient, sessionOptions } from "../../lib/query";
import { homeReturn, stripeReturn } from "../third-party-returns";

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

vi.mock("../../features/pay/api", () => ({
  purchaseLearner: async () => LEARNER,
}));

function routerAt(path: string) {
  const root = createRootRoute();
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

function signedIn(checkout?: "learner" | "enrollment") {
  queryClient.clear();
  queryClient.setQueryData(sessionOptions.queryKey, SESSION);
  usePayStore.setState({ accounts: {} });
  if (checkout)
    usePayStore.getState().checkoutOpened(SESSION.accountId, {
      learnerId: LEARNER,
      kind: checkout,
      base: BASE,
    });
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

test("an enrollment return this tab didn't open stays on its step", async () => {
  const from = `/start/purchase?billing=processing&purchase=${PURCHASE}`;
  const { router, hops } = routerAt(from);
  await router.load();
  expect(router.state.location.pathname).toBe("/start/purchase");
  expect(hops()).toBe(0);
});

test("signed out, a return stays at its address for sign-in", async () => {
  queryClient.setQueryData(sessionOptions.queryKey, null);
  const { router, hops } = routerAt(`/?billing=processing&purchase=${PURCHASE}`);
  await router.load();
  expect(router.state.location.searchStr).toContain("billing=processing");
  expect(hops()).toBe(0);
});

test("a provider's sign-in and a linked provider each hop once", async () => {
  const security = routerAt("/?security");
  await security.router.load();
  expect(security.router.state.location.pathname).toBe("/account/security");
  expect(security.hops()).toBe(1);
});
