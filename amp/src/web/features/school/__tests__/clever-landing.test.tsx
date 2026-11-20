import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  type RouteComponent,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { orgsOptions } from "../api";
import { ChooserScreen } from "../ChooserScreen";
import { CleverProblemScreen } from "../clever/CleverProblemScreen";

/*
 * Where a Clever sign-in can leave someone with nothing to open: staff with
 * no school in AMP (none listed on their staff record), and a sign-in that stopped. Each says why
 * and what to do, never a broken screen or the adult sign-in form.
 */
const SESSION = { accountId: "amp|staff", token: "t" };

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

function at(path: string, pattern: string, component: RouteComponent) {
  vi.stubGlobal("fetch", () => new Promise<never>(() => {}));
  const root = createRootRoute({ component: Outlet });
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: pattern, component }),
      createRoute({ getParentRoute: () => root, path: "/sign-in" }),
      createRoute({ getParentRoute: () => root, path: "/school/start" }),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function noSchool(account: object) {
  queryClient.setQueryData(sessionOptions.queryKey, SESSION);
  queryClient.setQueryData(orgsOptions(SESSION).queryKey, [] as never);
  queryClient.setQueryData(meOptions(SESSION).queryKey, {
    signedIn: true,
    account: { id: SESSION.accountId, email: null, ...account },
    learners: [],
  } as never);
  at("/school", "/school", ChooserScreen);
}

test("Clever staff with no school in AMP are told their district decides", async () => {
  noSchool({ kind: "provider", districtName: "Certification ISD" });
  expect(
    await screen.findByRole("heading", { name: "No school in AMP yet" }),
  ).toBeTruthy();
  expect(
    screen.getByText(
      /Certification ISD shares schools with AMP through Clever/,
    ),
  ).toBeTruthy();
  // Never a second, parallel school beside the district's.
  expect(screen.queryByRole("link", { name: "Set up your class" })).toBeNull();
});

test("anyone else with no school is offered a class", async () => {
  noSchool({ emailVerified: true });
  expect(
    await screen.findByRole("heading", { name: "No school yet" }),
  ).toBeTruthy();
  expect(
    screen.getByText("A class starts your free 30-day pilot."),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Set up your class" })).toBeTruthy();
});

test("a student whose school isn't on AMP is told to ask their teacher", async () => {
  at("/clever/not-connected", "/clever/$reason", CleverProblemScreen);
  expect(
    await screen.findByRole("heading", {
      name: "Your school isn’t on AMP yet.",
    }),
  ).toBeTruthy();
  expect(screen.getByText("Ask your teacher.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Log in with Clever" })).toBeTruthy();
  // A child's screen: no adult sign-in form, no support address.
  expect(screen.queryByLabelText(/password/i)).toBeNull();
  expect(screen.queryByText("support@corpora.inc")).toBeNull();
});

test("each student cause asks for their teacher", async () => {
  for (const [cause, title] of [
    ["not-on-roster", "AMP can’t find your class yet."],
    ["disconnected", "Your school’s AMP is paused."],
  ]) {
    at(`/clever/${cause}`, "/clever/$reason", CleverProblemScreen);
    expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByText("Ask your teacher.")).toBeTruthy();
    cleanup();
  }
});

test("a provider failure tries again and names the way to reach us", async () => {
  // Any cause AMP doesn't name, an object's own keys included.
  at("/clever/constructor", "/clever/$reason", CleverProblemScreen);
  expect(
    await screen.findByRole("heading", {
      name: "Clever sign-in didn’t finish.",
    }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Log in with Clever" })).toBeTruthy();
  expect(screen.getByText("support@corpora.inc")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Sign in another way" }),
  ).toBeTruthy();
});
