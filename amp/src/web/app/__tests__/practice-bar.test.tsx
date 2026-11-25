/**
 * A problem's bar holds only the problem's tools (founder, 2026-11-23): on
 * practice a school session's name and Sign out are the menu's, one tap
 * away; on every other screen they are at the bar's end, as before (shared
 * school computers: who is signed in, and the way out, always in view).
 * The shell is mounted whole, as app/__tests__/shell-mounted.test.tsx does.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { AppShell } from "../AppShell";
import { Providers } from "../providers";
import { meOptions, queryClient, sessionOptions } from "../../lib/query";
import { forgetRetiredSessions } from "../../lib/session-generation";

vi.mock("../../auth", async (original) => ({
  ...(await original<object>()),
  onSessionChanged: () => () => {},
}));
vi.mock("../../lib/api", async (original) => ({
  ...(await original<object>()),
  // The network: nothing answers; what the bar shows is already in hand.
  request: () => new Promise(() => {}),
}));
vi.mock("../../features/navigation/ShellDrawer", () => ({
  default: () => null,
}));
vi.mock("../LegacyApp", () => ({ LegacyApp: () => null }));

const LEARNER = "33333333-3333-4333-8333-333333333333";
const student = { accountId: "school:student", token: "st_fixture" };
const staff = { accountId: "amp|staff", token: "t" };
const studentMe = {
  signedIn: true,
  consent: { status: "none", method: null },
  account: { id: student.accountId, kind: "student", email: null },
  learners: [{ id: LEARNER, name: "Angelo Sawayn", birthYear: 2015 }],
  family: { learners: [] },
  school: {
    orgId: "o",
    orgName: "Fixture Academy",
    className: "Period 1",
    standings: false,
  },
  practiceProfiles: [],
  staffOf: [],
};
const staffMe = {
  signedIn: true,
  consent: { status: "none", method: null },
  account: {
    id: staff.accountId,
    kind: "provider",
    email: null,
    emailVerified: false,
    displayName: "Haley Hahn",
  },
  learners: [],
  family: { learners: [] },
  adultPractice: {
    eligible: true,
    learner: { id: LEARNER, name: "Haley Hahn", active: true },
  },
  practiceProfiles: [],
  staffOf: [],
};

async function open(
  session: { accountId: string; token: string },
  me: object,
  path: string,
) {
  queryClient.setQueryData(sessionOptions.queryKey, session);
  queryClient.setQueryData(meOptions(session).queryKey, me as never);
  const root = createRootRoute({
    component: () => (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
  });
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/$",
    component: () => <main data-testid="screen" />,
  });
  const router = createRouter({
    routeTree: root.addChildren([leaf as never]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  await act(() => vi.advanceTimersByTimeAsync(0));
  return router;
}
const bar = () => document.querySelector("header[data-app-bar]")!;
const mark = () => bar().querySelector("[data-session-mark]");
const signOut = () => bar().querySelector("[data-session-sign-out]");

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  window.scrollTo = () => {};
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as never;
  queryClient.clear();
  forgetRetiredSessions();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

test("a student's practice bar holds no name and no Sign out", async () => {
  sessionStorage.setItem("amp.student", JSON.stringify(student));
  await open(student, studentMe, `/practice/${LEARNER}`);
  expect(bar().getAttribute("data-bar")).toBe("practice");
  expect(bar().getAttribute("data-space")).toBe("student");
  expect(mark()).toBeNull();
  expect(signOut()).toBeNull();
  expect(bar().querySelector("[data-student-sign-out]")).toBeNull();
  expect(bar().textContent).not.toContain("Angelo Sawayn");
  expect(bar().textContent).not.toContain("Sign out");
});

test("a student's other screens keep Sign out, with their name, at the bar's end", async () => {
  sessionStorage.setItem("amp.student", JSON.stringify(student));
  await open(student, studentMe, "/overview");
  expect(bar().getAttribute("data-bar")).not.toBe("practice");
  expect(mark()?.getAttribute("data-session-mark")).toBe("student");
  expect(signOut()?.getAttribute("aria-label")).toBe("Sign out Angelo Sawayn");
  expect(bar().textContent).toContain("Angelo Sawayn");
});

test("a handed device's practice bar holds no family icon; its other screens do", async () => {
  sessionStorage.setItem("amp.student", JSON.stringify(student));
  sessionStorage.setItem("amp.student.handed", "1");
  const router = await open(student, studentMe, `/practice/${LEARNER}`);
  expect(bar().querySelector("[data-handed-home]")).toBeNull();
  await act(async () => {
    await router.navigate({
      to: "/$",
      params: { _splat: "overview" },
    } as never);
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(bar().querySelectorAll("[data-handed-home]")).toHaveLength(1);
});

test("staff signed in through their school: named with Sign out everywhere but on a problem", async () => {
  const router = await open(staff, staffMe, `/practice/${LEARNER}`);
  expect(bar().getAttribute("data-bar")).toBe("practice");
  expect(mark()).toBeNull();
  expect(bar().textContent).not.toContain("Haley Hahn");
  await act(async () => {
    await router.navigate({ to: "/$", params: { _splat: "me" } } as never);
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(bar().getAttribute("data-bar")).not.toBe("practice");
  expect(mark()?.getAttribute("data-session-mark")).toBe("provider");
  expect(signOut()?.getAttribute("aria-label")).toBe("Sign out Haley Hahn");
});
