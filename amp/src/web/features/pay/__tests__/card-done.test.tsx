import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useLocation,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { queryClient, sessionOptions } from "../../../lib/query";
import { CardDone } from "../CardDone";
import { payState, usePayStore } from "../store";

/* Paying's Done puts the person back where paying started (the practice
   the pause was on), not on the screen the overlay was drawn over; with no
   record of where it started, it closes to that screen. */

const SESSION = { accountId: "amp|adult", token: "t" };
const LEARNER = { id: "own", name: "Avery", adult: true } as never;

afterEach(() => {
  cleanup();
  queryClient.clear();
  usePayStore.setState({ accounts: {} });
});

/** The overlay at its address; anywhere else, the screen behind. */
function Screen() {
  const pathname = useLocation({ select: (location) => location.pathname });
  return pathname.includes("/pay/") ? (
    <CardDone
      learner={LEARNER}
      outcome={{ state: "active" }}
      retry={() => undefined}
    />
  ) : (
    <p>{pathname}</p>
  );
}

function mount() {
  queryClient.setQueryData(sessionOptions.queryKey, () => SESSION);
  const root = createRootRoute();
  const screen_ = createRoute({
    getParentRoute: () => root,
    path: "$",
    component: Screen,
  });
  const router = createRouter({
    routeTree: root.addChildren([screen_]),
    history: createMemoryHistory({
      initialEntries: ["/account", "/account/pay/own/done"],
    }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

test("Done returns to the practice paying started from, and names nothing elsewhere", async () => {
  usePayStore.getState().open(SESSION.accountId, {
    learnerId: "own",
    returnTo: "/practice/own",
  });
  const router = mount();
  fireEvent.click(await screen.findByRole("button", { name: "Done" }));
  await expect.poll(() => router.state.location.pathname).toBe("/practice/own");
  expect(payState(SESSION.accountId).opener).toMatchObject({
    returnTo: "/practice/own",
    stage: "naming",
  });
});

test("with nothing recorded, Done closes to the screen behind", async () => {
  const router = mount();
  fireEvent.click(await screen.findByRole("button", { name: "Done" }));
  await expect.poll(() => router.state.location.pathname).toBe("/account");
});
