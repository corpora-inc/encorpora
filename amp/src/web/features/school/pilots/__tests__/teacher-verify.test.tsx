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
import { accountClient } from "../../../../account-client";
import { meOptions, queryClient, sessionOptions } from "../../../../lib/query";
import { orgsOptions } from "../../api";
import { SchoolStartScreen } from "../SchoolStartScreen";

vi.mock("../../../../account-client", () => ({
  accountClient: {
    sendVerificationEmail: vi.fn(async () => ({
      data: { status: true },
      error: null,
    })),
  },
}));
afterEach(() => {
  cleanup();
  queryClient.clear();
});
const O = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";

test("CP-2 r3 M4: a teacher's confirmation email comes back to setup, with its way back", async () => {
  const auth = { accountId: "amp|teacher", token: "synthetic" };
  const from = `/school/${O}/classes/${C}/today?view=week`;
  window.scrollTo = () => {};
  queryClient.setQueryData(sessionOptions.queryKey, auth);
  queryClient.setQueryData(meOptions(auth).queryKey, {
    signedIn: true,
    account: {
      id: auth.accountId,
      email: "teacher@example.test",
      emailVerified: false,
      confirmationRequired: true,
    },
    family: { learners: [] },
    learners: [],
  } as never);
  queryClient.setQueryData(orgsOptions(auth).queryKey, []);
  const root = createRootRoute();
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/school/start",
    component: SchoolStartScreen,
    validateSearch: (search: Record<string, unknown>) => search,
  });
  const router = createRouter({
    routeTree: root.addChildren([leaf]),
    history: createMemoryHistory({
      initialEntries: [`/school/start?from=${encodeURIComponent(from)}`],
    }),
  });
  await router.load();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 25)));
  expect(
    screen.getByRole("link", { name: "Cancel" }).getAttribute("href"),
  ).toBe(from);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send another email" }));
  });
  const sent = vi
    .mocked(accountClient.sendVerificationEmail)
    .mock.calls.at(-1)?.[0];
  expect(sent?.callbackURL).toBe(
    `/school/start?from=${encodeURIComponent(from)}`,
  );
});
