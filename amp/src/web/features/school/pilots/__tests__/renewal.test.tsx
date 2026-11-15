import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, expect, test, vi } from "vitest";
import { SessionUnconfirmedError } from "../../../../lib/request-transport";
import { queryClient, sessionOptions } from "../../../../lib/query";
import { pilotApi } from "../api";
import { StartPracticeButton } from "../ClassAccess";

/* A same-account renewal refuses every write until its /me confirms
 * (lib/request-transport.ts). Starting practice says so calmly, keeps its
 * button, and starts on the next press once confirmed: nothing is lost. */
vi.mock("../api", async (actual) => {
  const real = (await actual()) as typeof import("../api");
  return {
    ...real,
    pilotApi: { ...real.pilotApi, activate: vi.fn() },
  };
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});
const O = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";

test("Start practice during a renewal: a calm wait, then it starts on the next press", async () => {
  const auth = { accountId: "amp|teacher", token: "synthetic" };
  queryClient.setQueryData(sessionOptions.queryKey, auth);
  const activate = vi.mocked(pilotApi.activate);
  activate.mockRejectedValueOnce(new SessionUnconfirmedError());
  activate.mockResolvedValueOnce({} as never);
  const pilot = { authorized: true } as never;
  const root = createRootRoute();
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/school/$org/classes/$class/today",
    component: () => (
      <StartPracticeButton place={{ org: O, class: C }} pilot={pilot} />
    ),
  });
  const router = createRouter({
    routeTree: root.addChildren([leaf]),
    history: createMemoryHistory({
      initialEntries: [`/school/${O}/classes/${C}/today`],
    }),
  });
  await router.load();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 25)));
  const start = screen.getByRole("button", { name: "Start practice" });
  await act(async () => {
    fireEvent.click(start);
  });
  await screen.findByText("One moment, confirming your sign-in");
  // The button stays, ready for the next press.
  expect(
    screen
      .getByRole("button", { name: "Start practice" })
      .hasAttribute("disabled"),
  ).toBe(false);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
  });
  expect(activate).toHaveBeenCalledTimes(2);
});
