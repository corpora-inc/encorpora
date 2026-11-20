import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

/*
 * A teacher rostered at a school with no section yet (a Clever teacher before
 * their district shares a class) opens Classes to a plain empty state, never
 * a broken or blank screen. The school's chrome is stood in; the screen, its
 * queries and its router are the app's own.
 */
vi.mock("../OrgFrame", () => ({
  OrgFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

const { queryClient, sessionOptions } = await import("../../../lib/query");
const { orgOptions, classesOptions } = await import("../core-api");
const { yearsOptions } = await import("../org/org-api");
const { ClassesScreen } = await import("../ClassesScreen");

const ORG = "33333333-3333-4333-8333-333333333333";
const SESSION = { accountId: "amp|clever-teacher", token: "t" };

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

async function classes(can: string[]) {
  // Nothing reaches a server: every read is answered from the cache.
  vi.stubGlobal("fetch", () => new Promise<never>(() => {}));
  queryClient.setQueryData(sessionOptions.queryKey, SESSION);
  queryClient.setQueryData(orgOptions(SESSION, ORG).queryKey, {
    id: ORG,
    kind: "school",
    name: "Escuela Señora Núñez",
    can,
    personName: "Teo Vacío",
  } as never);
  queryClient.setQueryData(yearsOptions(SESSION, ORG).queryKey, [] as never);
  queryClient.setQueryData(classesOptions(SESSION, ORG).queryKey, [] as never);
  const root = createRootRoute({ component: Outlet });
  const route = createRoute({
    getParentRoute: () => root,
    path: "/school/$org/classes",
    component: ClassesScreen,
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({
      initialEntries: [`/school/${ORG}/classes`],
    }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

test("a teacher on no class is told who adds them", async () => {
  await classes(["classes.read"]);
  expect(
    await screen.findByRole("heading", { name: "You’re not on a class yet" }),
  ).toBeTruthy();
  expect(
    screen.getByText("Your school’s admin adds you to classes."),
  ).toBeTruthy();
});

test("a teacher who can make a class is offered one", async () => {
  await classes(["classes.read", "classes.create"]);
  expect(
    await screen.findByRole("heading", { name: "No classes yet" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add class" })).toBeTruthy();
});
