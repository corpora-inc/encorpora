import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AppShell } from "../../../app/AppShell";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { useShellSlots } from "../../../lib/shell-slots";

/*
 * The app frame's drawer and navigation (app/AppShell.tsx). Going to another
 * screen closes the drawer as the navigation starts; a drawer opened while
 * that screen still loads stays open when it arrives. Closing it on arrival
 * took the menu from under a person who had just opened it
 * (verify-school-places-ui: `/` opening the school, the switcher's trigger
 * left in a closing drawer).
 */
vi.mock("../ShellDrawer", () => ({ default: () => null }));

const session = { accountId: "amp|ines", token: "t" };
const flush = () => vi.advanceTimersByTimeAsync(0);
let gate: { promise: Promise<void>; open: () => void };
const newGate = () => {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => (open = resolve));
  gate = { promise, open };
};

async function mount() {
  const root = createRootRoute({
    component: () => (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
  });
  const screen = (path: string, loader?: () => Promise<void>) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: () => <main>{path}</main>,
      loader,
    });
  const router = createRouter({
    routeTree: root.addChildren([
      screen("/family"),
      screen("/school", () => gate.promise),
    ]),
    history: createMemoryHistory({ initialEntries: ["/family"] }),
    defaultPendingMs: 100_000,
  });
  await router.load();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await act(flush);
  // The shell itself rendered (no route error in its place).
  expect(view.container.querySelector("main")?.textContent).toBe("/family");
  return router;
}

const open = () => useShellSlots.getState().drawerOpen;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", () => new Promise<never>(() => {}));
  window.scrollTo = () => {};
  queryClient.setQueryData(sessionOptions.queryKey, session);
  queryClient.setQueryData(meOptions(session).queryKey, {
    signedIn: true,
    account: { id: session.accountId, email: null, emailVerified: true },
    learners: [],
    family: { learners: [] },
    consent: { status: "none" },
    staffOf: [],
  } as never);
  useShellSlots.getState().setDrawerOpen(false);
  newGate();
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
  vi.clearAllTimers();
  vi.useRealTimers();
});

test("going to another screen closes the drawer as it starts", async () => {
  const router = await mount();
  act(() => useShellSlots.getState().setDrawerOpen(true));
  await act(async () => {
    void router.navigate({ to: "/school" } as never);
    await flush();
  });
  expect(open()).toBe(false);
  await act(async () => {
    gate.open();
    await flush();
  });
  expect(router.state.location.pathname).toBe("/school");
  expect(open()).toBe(false);
});

test("a drawer opened while the next screen loads stays open when it arrives", async () => {
  const router = await mount();
  await act(async () => {
    void router.navigate({ to: "/school" } as never);
    await flush();
  });
  // The address is the school's; its screen is still loading.
  act(() => useShellSlots.getState().setDrawerOpen(true));
  await act(async () => {
    gate.open();
    await flush();
  });
  expect(router.state.resolvedLocation?.pathname).toBe("/school");
  expect(open()).toBe(true);
});
