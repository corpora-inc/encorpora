/**
 * The shell, mounted whole: Providers → RouterProvider → AppShell, with the
 * real router, query client, session retirement, learning view and screens.
 * Only the network (`lib/api` request), the session events (`auth`) and
 * screens beside the point (the drawer, the legacy host) are stood in for.
 * After CP-2 round 3 (Astra): a navigation still loading or abandoned
 * changes nobody; a new session for the same account never shows the old
 * one's answers or actions, and an old loader can't write into it.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../AppShell";
import { Providers } from "../providers";
import { useSettledMatch, useSpace } from "../../features/spaces/useSpace";
import { useLearningView } from "../../lib/learning-view";
import { meOptions, queryClient, sessionOptions } from "../../lib/query";
import { useLearnerStore } from "../../learner-store";
import { forgetRetiredSessions } from "../../lib/session-generation";
import {
  classesOptions,
  orgOptions,
  staffOptions,
} from "../../features/school/api";
import { classYearOptions } from "../../features/school/org/org-api";
import { pilotOptions } from "../../features/school/pilots/api";

const h = vi.hoisted(() => ({
  changed: null as null | ((session: unknown) => void),
  request: vi.fn(),
  renders: [] as Record<string, unknown>[],
}));
vi.mock("../../auth", async (original) => ({
  ...(await original<object>()),
  onSessionChanged: (callback: (session: unknown) => void) => {
    h.changed = callback;
    return () => {};
  },
}));
vi.mock("../../lib/api", async (original) => {
  const actual = await original<Record<string, unknown>>();
  // The real session checks around sending, where this build has them.
  const around =
    (actual.requestWith as
      | (<T>(send: () => Promise<T>, options: object) => Promise<T>)
      | undefined) ?? ((send: () => Promise<unknown>) => send());
  return {
    ...actual,
    // The network: answers the test decides.
    request: (path: string, schema: unknown, options: { token?: string }) =>
      around(() => h.request(path, schema, options), options),
  };
});
vi.mock("../../features/navigation/ShellDrawer", () => ({
  default: () => null,
}));
vi.mock("../LegacyApp", () => ({ LegacyApp: () => null }));
vi.mock("../../ui/Toast", () => ({
  Toast: ({ message }: { message: string }) => (
    <div data-testid="toast">{message}</div>
  ),
}));

const O = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
const classPath = `/school/${O}/classes/${C}/today`;
const auth = { accountId: "amp|mounted", token: "old" };
const kid = (id: string) => ({
  id,
  name: id,
  entitlement: { active: true },
});
const me = {
  signedIn: true,
  account: { id: auth.accountId, email: null, emailVerified: true },
  learners: [kid("pip"), kid("wren")],
  family: {
    learners: [
      { ...kid("pip"), canPractice: true },
      { ...kid("wren"), canPractice: true },
    ],
  },
  adultPractice: {
    eligible: true,
    learner: { id: "adult", name: "Adult", active: true },
  },
  practiceProfiles: [],
  staffOf: [],
};
const org = {
  id: O,
  kind: "school",
  name: "School",
  roles: ["admin"],
  can: ["org.read", "classes.read", "staff.read", "staff.manage"],
  timezone: "UTC",
  parentId: null,
};
const year = {
  past: false,
  orgId: O,
  path: [O],
  name: "Class",
  can: ["classes.read", "students.read", "signin.read"],
};
const pause = () => new Promise((resolve) => setTimeout(resolve, 25));
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const never = () => new Promise(() => {});

function Learning() {
  const view = useLearningView({ records: false });
  const space = useSpace(useSettledMatch());
  const selected = useLearnerStore((state) => state.learnerId);
  const row = {
    selected,
    learner: view.learner?.id,
    frame:
      space && "learner" in space ? (space.learner?.id ?? null) : undefined,
  };
  h.renders.push(row);
  return <div data-testid="learning">{JSON.stringify(row)}</div>;
}

async function mount(
  initial: string,
  component: () => React.ReactNode,
  loader?: (input: {
    location: { search: Record<string, unknown> };
  }) => unknown,
  path = "/$",
) {
  const root = createRootRoute({
    component: () => (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
  });
  const leaf = createRoute({
    getParentRoute: () => root,
    path,
    component,
    loader: loader as never,
    validateSearch: (search: Record<string, unknown>) => search,
  });
  const router = createRouter({
    routeTree: root.addChildren([leaf as never]),
    history: createMemoryHistory({ initialEntries: [initial] }),
    defaultPendingMs: 100_000,
  });
  await router.load();
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  await act(pause);
  return router;
}

beforeEach(() => {
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
  h.renders = [];
  h.request.mockReset().mockImplementation(never);
  queryClient.setQueryData(sessionOptions.queryKey, auth);
  queryClient.setQueryData(meOptions(auth).queryKey, me as never);
  useLearnerStore.getState().select("wren");
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
});

test("CP-2 r3 H2: a navigation still loading, or abandoned, changes nobody", async () => {
  const gate = deferred();
  let started = false;
  const router = await mount(
    "/overview?learner=wren",
    Learning,
    async ({ location }) => {
      if (location.search.learner === "pip") {
        started = true;
        await gate.promise;
      }
    },
  );
  expect(screen.getByTestId("learning").textContent).toContain(
    '"learner":"wren"',
  );
  let navigation!: Promise<unknown>;
  await act(async () => {
    navigation = router.navigate({
      to: "/$",
      params: { _splat: "practice" },
      search: { learner: "pip" },
    } as never);
    void router.load();
    await pause();
  });
  expect(started).toBe(true);
  // Pending: the shell, the content and the device's choice are all Wren's.
  expect(h.renders.at(-1)).toEqual({
    selected: "wren",
    learner: "wren",
    frame: "wren",
  });
  expect(useLearnerStore.getState().learnerId).toBe("wren");
  // Abandoned: another navigation replaces it; still nobody changed.
  await act(async () => {
    await router.navigate({
      to: "/$",
      params: { _splat: "overview" },
      search: { learner: "wren" },
    } as never);
    await pause();
  });
  expect(useLearnerStore.getState().learnerId).toBe("wren");
  gate.resolve(undefined);
  await act(async () => {
    await navigation.catch(() => undefined);
    await pause();
  });
  expect(useLearnerStore.getState().learnerId).toBe("wren");
  // Committed: the shell then makes Pip the choice.
  await act(async () => {
    await router.navigate({
      to: "/$",
      params: { _splat: "practice" },
      search: { learner: "pip" },
    } as never);
    await pause();
  });
  expect(useLearnerStore.getState().learnerId).toBe("pip");
  expect(h.renders.at(-1)).toMatchObject({ learner: "pip", frame: "pip" });
});

test("H2: the named learner removed while open keeps the screen out, choosing nobody", async () => {
  await mount("/overview?learner=pip", Learning);
  expect(screen.getByTestId("learning")).toBeTruthy();
  await act(async () => {
    queryClient.setQueryData(meOptions(auth).queryKey, {
      ...me,
      learners: [kid("wren")],
      family: { learners: [kid("wren")] },
    } as never);
    await pause();
  });
  expect(screen.queryByTestId("learning")).toBeNull();
  expect(document.querySelector("[data-space-blocked]")).toBeTruthy();
  expect(useLearnerStore.getState().learnerId).toBe("pip");
});

function seedSchool() {
  queryClient.setQueryData(meOptions(auth).queryKey, me as never);
  queryClient.setQueryData(orgOptions(auth, O).queryKey, org as never);
  queryClient.setQueryData(classesOptions(auth, O).queryKey, []);
  queryClient.setQueryData(classYearOptions(auth, C).queryKey, year as never);
  queryClient.setQueryData(pilotOptions(auth, C).queryKey, {
    coverage: { covered: 3 },
  } as never);
}
function Content() {
  const session = useQuery(sessionOptions).data!;
  const read = useQuery({ ...orgOptions(session, O), refetchOnMount: false });
  const [local] = useState("old screen state");
  return (
    <div data-testid="content">
      {local}|{read.data?.name ?? "loading"}
    </div>
  );
}

test("CP-2 r3 M1: a new session whose account didn't load shows nothing of the old one", async () => {
  seedSchool();
  await mount(classPath, Content);
  expect(screen.getByRole("link", { name: "Start class" })).toBeTruthy();
  const old = deferred();
  const late = queryClient
    .fetchQuery({
      queryKey: orgOptions(auth, O).queryKey,
      staleTime: 0,
      queryFn: () => old.promise,
    })
    .catch(() => null);
  const replacement = deferred();
  h.request.mockImplementation((path: string) =>
    path === "/me" ? replacement.promise : never(),
  );
  await act(async () => {
    h.changed!({ ...auth, token: "new" });
    await pause();
  });
  await act(async () => {
    old.resolve({ ...org, name: "OLD LATE RESPONSE" });
    await late;
    replacement.reject(new Error("replacement /me offline"));
    await pause();
  });
  // The old session's late answer was never written. Same-account renewal
  // keeps the account's earlier answers; the unconfirmed session shows none.
  const kept = queryClient.getQueryData(orgOptions(auth, O).queryKey) as
    { name: string } | undefined;
  expect(kept?.name).not.toBe("OLD LATE RESPONSE");
  expect(screen.queryByRole("link", { name: "Start class" })).toBeNull();
  expect(screen.queryByText(/old screen state/)).toBeNull();
  expect(screen.queryByText(/OLD LATE RESPONSE/)).toBeNull();
});

test("CP-2 r3 M1: the real staff screen's management form goes with the old session", async () => {
  const { StaffScreen } = await import("../../features/school/StaffScreen");
  seedSchool();
  queryClient.setQueryData(staffOptions(auth, O).queryKey, [] as never);
  await mount(
    `/school/${O}/staff`,
    StaffScreen,
    undefined,
    "/school/$org/staff",
  );
  expect(screen.getByRole("heading", { name: "Invite someone" })).toBeTruthy();
  const replacement = deferred();
  h.request.mockImplementation((path: string) =>
    path === "/me" ? replacement.promise : never(),
  );
  await act(async () => {
    h.changed!({ ...auth, token: "new" });
    await pause();
  });
  await act(async () => {
    replacement.reject(new Error("offline"));
    await pause();
  });
  expect(screen.queryByRole("heading", { name: "Invite someone" })).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull();
});

test("CP-2 r4 N4: a routine renewal for the same account keeps the staff form's draft", async () => {
  const { StaffScreen } = await import("../../features/school/StaffScreen");
  seedSchool();
  queryClient.setQueryData(staffOptions(auth, O).queryKey, [] as never);
  const router = await mount(
    `/school/${O}/staff`,
    StaffScreen,
    undefined,
    "/school/$org/staff",
  );
  const email = () =>
    screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement;
  fireEvent.change(email(), { target: { value: "colleague@example.test" } });
  h.request.mockImplementation(async (url: string) =>
    url === "/me"
      ? me
      : url === `/school/orgs/${O}`
        ? { org }
        : url.includes("/classes")
          ? { classes: [] }
          : url.endsWith("/staff")
            ? { staff: [] }
            : {},
  );
  await act(async () => {
    h.changed!({ ...auth, token: "new" });
    await pause();
  });
  expect(router.state.location.pathname).toBe(`/school/${O}/staff`);
  expect(email().value).toBe("colleague@example.test");
});

test("CP-2 r4 M1: cancelling the session check during a renewal leaves the old token retired", async () => {
  const { isRetired } = await import("../../lib/session-generation");
  await mount("/account/security", () => <div>Account</div>);
  const gate = deferred();
  const checking = queryClient
    .fetchQuery({
      ...sessionOptions,
      staleTime: 0,
      queryFn: () => gate.promise as never,
    })
    .catch(() => null);
  await act(async () => {
    h.changed!({ ...auth, token: "new" });
    await pause();
  });
  await checking;
  const calls: string[] = [];
  h.request.mockImplementation(async (url: string) => {
    calls.push(url);
    return {};
  });
  const { request } = await import("../../lib/api");
  const { z } = await import("zod");
  await expect(
    request("/probe", z.unknown(), { token: auth.token }),
  ).rejects.toMatchObject({ code: "session_replaced" });
  expect(isRetired(auth.token)).toBe(true);
  expect(calls).toEqual([]);
});

test("CP-2 r3 M1: an old loader that resumes after a new session neither asks nor writes", async () => {
  await mount("/account/security", () => <div>Account</div>);
  const { preloadLearningView } = await import("../../lib/learning-view");
  const calls: { url: string; token?: string }[] = [];
  h.request.mockImplementation(
    async (url: string, _schema: unknown, options: { token?: string }) => {
      calls.push({ url, token: options?.token });
      return url === "/me"
        ? me
        : url === "/catalog"
          ? { skills: [] }
          : { marker: `answer from ${options?.token}` };
    },
  );
  const original = queryClient.ensureQueryData.bind(queryClient);
  let changed = false;
  vi.spyOn(queryClient, "ensureQueryData").mockImplementation(((options: {
    queryKey: unknown[];
  }) => {
    const got = original(options as never);
    if (options.queryKey[2] === "me" && !changed) {
      changed = true;
      queueMicrotask(() => h.changed!({ ...auth, token: "new" }));
    }
    return got;
  }) as never);
  await act(async () => {
    await preloadLearningView({
      pathname: "/pathways",
      search: { learner: "pip" },
    });
    await pause();
  });
  expect(
    calls.filter((call) => call.token === "old" && call.url !== "/me"),
  ).toEqual([]);
  expect(
    queryClient.getQueryData(["account", auth.accountId, "pathways", "pip"]),
  ).toBeUndefined();
});
