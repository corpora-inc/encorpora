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
import { afterEach, expect, test } from "vitest";
import { meOptions, queryClient, sessionOptions } from "../../../../lib/query";
import { orgsOptions } from "../../api";
import { SchoolStartScreen } from "../SchoolStartScreen";

afterEach(() => {
  cleanup();
  queryClient.clear();
});
const O = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";

/* Founder ruling 2026-11-15: a teacher starts a class with nothing in the
 * way. No confirmation email first, no role to type: the class, the name the
 * account already has, and one tick. */
test("a teacher whose email isn't confirmed sets up a class at once, with the name prefilled and no role", async () => {
  const auth = {
    accountId: "amp|teacher",
    token: "synthetic",
    name: "Rosa Lindqvist",
  };
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
  expect(screen.queryByRole("button", { name: "Send another email" })).toBe(
    null,
  );
  expect(screen.queryByLabelText("Your role")).toBe(null);
  expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe(
    "Rosa Lindqvist",
  );
  const create = screen.getByRole("button", { name: "Create class" });
  expect(create.hasAttribute("disabled")).toBe(true);
  await act(async () => {
    fireEvent.change(screen.getByLabelText("School name"), {
      target: { value: "Birchwood Elementary" },
    });
    fireEvent.change(screen.getByLabelText("Class name"), {
      target: { value: "Grade 4 Math" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
  });
  expect(
    screen
      .getByRole("button", { name: "Create class" })
      .hasAttribute("disabled"),
  ).toBe(false);
});
