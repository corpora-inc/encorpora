import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Profiler, type ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";

/*
 * The drawer of a teacher who is also a parent settles: once its data is
 * there it renders a bounded number of times and its place switcher stays
 * one element (verify-school-places-ui, verify-school-setup-ui
 * teacherWhoIsAParent found the trigger replaced without end). Every hook is
 * the app's own; only the router is stood in, at a fixed address.
 */
const FAMILY = "11111111-1111-4111-8111-111111111111";
const CLASS = "22222222-2222-4222-8222-222222222222";
const SCHOOL = "33333333-3333-4333-8333-333333333333";
const ROOM = "44444444-4444-4444-8444-444444444444";

const at = vi.hoisted(() => ({ pathname: "/", space: "" }));
vi.mock("@tanstack/react-router", async (original) => {
  const actual = await original<typeof import("@tanstack/react-router")>();
  const location = () => ({
    pathname: at.pathname,
    search: {},
    searchStr: "",
    href: at.pathname,
    hash: "",
  });
  const state = () => ({
    location: location(),
    resolvedLocation: location(),
    matches: [
      {
        status: "success",
        pathname: at.pathname,
        search: {},
        params: {},
        staticData: at.space ? { space: at.space } : {},
      },
    ],
  });
  return {
    ...actual,
    useLocation: (options?: { select?: (l: unknown) => unknown }) =>
      options?.select ? options.select(location()) : location(),
    useRouterState: (options?: { select?: (s: unknown) => unknown }) =>
      options?.select ? options.select(state()) : state(),
    useNavigate: () => () => Promise.resolve(),
    useRouter: () => ({
      preloadRoute: () => Promise.resolve(),
      subscribe: () => () => {},
    }),
    Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  };
});

const { queryClient, meOptions, sessionOptions } = await import(
  "../../../lib/query"
);
const { placesOptions } = await import("../../spaces/places");
const { familyPlacesOptions, familyOptions } = await import("../../family/api");
const { selectLearner } = await import("../../../learner-store");
const { default: DrawerContents } = await import("../DrawerContents");
const { AppShell } = await import("../../../app/AppShell");
const { useShellSlots } = await import("../../../lib/shell-slots");

const session = { accountId: "amp|ines", token: "t" };
const kid = (id: string, name: string) => ({
  id,
  name,
  birthYear: 2016,
  entitlement: { active: true, plan: null, endsAt: null },
});
const me = {
  signedIn: true,
  account: { id: session.accountId, email: null, emailVerified: true },
  learners: [kid("pip", "Pip"), kid("wren", "Wren")],
  family: {
    learners: [
      { id: "pip", canPractice: true },
      { id: "wren", canPractice: true },
    ],
  },
  familyClass: {
    orgId: FAMILY,
    classId: CLASS,
    className: "Vega family",
    notice: false,
  },
  staffOf: [{ orgId: SCHOOL, orgName: "Birch Road School", role: "admin" }],
  adultPractice: { eligible: true, learner: null },
} as unknown as SignedInMe;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
      }) as unknown as MediaQueryList,
  );
  // Nothing reaches a server: every read is answered from the cache.
  vi.stubGlobal("fetch", () => new Promise<never>(() => {}));
  queryClient.setQueryData(sessionOptions.queryKey, session);
  queryClient.setQueryData(meOptions(session).queryKey, me as never);
  queryClient.setQueryData(placesOptions(session).queryKey, {
    orgs: [
      {
        id: SCHOOL,
        kind: "school",
        name: "Birch Road School",
        parentId: null,
        roles: ["admin"],
        lone: false,
      },
    ],
    schools: [],
    classes: [
      {
        id: ROOM,
        orgId: SCHOOL,
        orgName: "Birch Road School",
        name: "Grade 4 Math",
        role: "teacher",
      },
    ],
    more: false,
  } as never);
  queryClient.setQueryData(familyPlacesOptions(session).queryKey, {
    families: [
      {
        familyId: FAMILY,
        displayName: "Vega family",
        classId: CLASS,
        orgId: FAMILY,
        role: "holder",
        teachingPlace: null,
        capabilities: { readFamily: true, readTeaching: true },
      },
    ],
    next: null,
  } as never);
  queryClient.setQueryData(familyOptions(session, FAMILY).queryKey, {
    familyId: FAMILY,
    displayName: "Vega family",
    role: "holder",
    teachingPlace: null,
    capabilities: {},
    children: [],
    today: { date: "2026-11-17", tasks: [], week: {} },
  } as never);
  selectLearner("pip", session.accountId);
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

async function settles(pathname: string) {
  at.pathname = pathname;
  let commits = 0;
  render(
    <QueryClientProvider client={queryClient}>
      <Profiler id="drawer" onRender={() => commits++}>
        <DrawerContents close={() => {}} />
      </Profiler>
    </QueryClientProvider>,
  );
  const trigger = await screen.findByRole("button", {
    name: /: switch place$/,
  });
  // Let every effect, store write and cached read run its course.
  await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
  const settled = commits;
  await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
  // The same trigger, still in the page, and nothing renders on its own.
  expect(trigger.isConnected).toBe(true);
  expect(commits - settled).toBe(0);
  expect(settled).toBeLessThan(20);
}

async function frameSettles(pathname: string, space: string) {
  at.pathname = pathname;
  at.space = space;
  let commits = 0;
  render(
    <QueryClientProvider client={queryClient}>
      <Profiler id="frame" onRender={() => commits++}>
        <AppShell>
          <main />
        </AppShell>
      </Profiler>
    </QueryClientProvider>,
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
  act(() => useShellSlots.getState().setDrawerOpen(true));
  const trigger = await screen.findByRole("button", {
    name: /: switch place$/,
  });
  await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
  const settled = commits;
  await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
  expect(trigger.isConnected).toBe(true);
  expect(commits - settled).toBe(0);
}

test("the frame on a school page", async () => {
  await frameSettles(`/school/${SCHOOL}`, "school");
});

test("the frame on the family's Today", async () => {
  await frameSettles(`/family/${FAMILY}`, "family");
});

test("on a school page", async () => {
  await settles(`/school/${SCHOOL}`);
});

test("on the family's Today", async () => {
  await settles(`/family/${FAMILY}`);
});
