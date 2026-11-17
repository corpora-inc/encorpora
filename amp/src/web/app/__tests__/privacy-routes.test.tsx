import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { usePanelsStore } from "../../features/account/panels";
import { privacyRoutes } from "../privacy-routes";

/*
 * Privacy's older addresses (IA v2 §2.3): each is exactly one hop, straight
 * to the Privacy overlay over the account's settings hub, with the panel
 * its last part named open. The hub is the account's (settings-hub.ts),
 * mocked here as a family parent's or an adult's on their own.
 */

const FAMILY = "11111111-1111-4111-8111-111111111111";
const hub = vi.hoisted(() => ({ href: "" }));
vi.mock("../school-routes", () => ({
  staffScreen: async () => ({
    session: { accountId: "parent", token: "test-token" },
  }),
}));
vi.mock("../../features/spaces/settings-hub", () => ({
  loadSettingsHub: async (_session: unknown, overlay: string) =>
    `${hub.href}/${overlay}`,
}));

function routerAt(path: string) {
  const root = createRootRoute();
  const settings = createRoute({
    getParentRoute: () => root,
    path: "/family/$family/settings",
  });
  const account = createRoute({
    getParentRoute: () => root,
    path: "/account",
  });
  const tree = root.addChildren([
    settings.addChildren([
      createRoute({ getParentRoute: () => settings, path: "privacy" }),
    ]),
    // The overlay over /account (app/account-overlays.tsx), for anyone.
    account.addChildren([
      createRoute({ getParentRoute: () => account, path: "privacy" }),
    ]),
    ...(privacyRoutes(root) as unknown as []),
  ]);
  const router = createRouter({
    routeTree: tree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  let navigations = 0;
  router.subscribe("onBeforeNavigate", () => navigations++);
  return { router, hops: () => navigations - 1 };
}

beforeEach(() => usePanelsStore.setState({ accounts: {} }));
afterEach(() => vi.clearAllMocks());

const FAMILY_PRIVACY = `/family/${FAMILY}/settings/privacy`;
const ROWS = [
  ["/account/privacy/export", "export"],
  ["/account/privacy/consent", "consent"],
  ["/account/privacy/delete", "delete"],
  ["/account/privacy/retention", "retention"],
  ["/account/privacy/measurement", "measurement"],
  ["/family/privacy", null],
  ["/family/privacy/export", "export"],
  ["/family/privacy/consent", "consent"],
  ["/family/privacy/delete", "delete"],
  ["/family/privacy/retention", "retention"],
  ["/family/privacy/measurement", "measurement"],
  // Not a panel: the overlay, nothing opened.
  ["/account/privacy/elsewhere", null],
] as const;

for (const [from, panel] of ROWS)
  test(`a family parent: ${from} is one hop to Settings' Privacy${panel ? `, ${panel} open` : ""}`, async () => {
    hub.href = `/family/${FAMILY}/settings`;
    const { router, hops } = routerAt(from);
    await router.load();
    expect(router.state.location.pathname).toBe(FAMILY_PRIVACY);
    expect(hops()).toBe(1);
    expect(usePanelsStore.getState().accounts.parent?.privacy ?? null).toBe(
      panel,
    );
  });

for (const href of ["/account", `/family/${FAMILY}/settings`])
  test(`/account/privacy is the overlay itself for anyone, no hop (hub ${href})`, async () => {
    hub.href = href;
    const { router, hops } = routerAt("/account/privacy");
    await router.load();
    expect(router.state.location.pathname).toBe("/account/privacy");
    expect(hops()).toBe(0);
  });

for (const [from, panel] of ROWS)
  test(`an adult with no family: ${from} is one hop to /account/privacy`, async () => {
    hub.href = "/account";
    const { router, hops } = routerAt(from);
    await router.load();
    expect(router.state.location.pathname).toBe("/account/privacy");
    expect(hops()).toBe(1);
    expect(usePanelsStore.getState().accounts.parent?.privacy ?? null).toBe(
      panel,
    );
  });
