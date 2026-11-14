import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { queryClient, sessionOptions } from "../../../../lib/query";
import { orgOptions } from "../../api";
import { classYearOptions } from "../../org/org-api";
import { pilotOptions } from "../../pilots/api";
import { presenceOptions } from "../api";
import { StartClassScreen } from "../StartClassScreen";

/* CP-3 r3 H1: a board left open on the wall while practice reaches its
 * known end closes the moment the clock passes it, before any read: the
 * code goes, the explanation is the class's (Practice has ended), and the
 * class is read again to confirm. */
const O = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
const auth = { accountId: "amp|teacher", token: "synthetic" };
const START = new Date("2026-11-14T15:00:00Z").getTime();
const END = START + 15_000;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.setSystemTime(START);
  window.scrollTo = () => {};
  // Every read after the deadline answers as the server would.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    if (url.includes("/year"))
      return json({ past: false, practice: "ended", can: ["signin.read"] });
    if (url.includes("/pilot"))
      return json({
        status: "expired",
        startedAt: new Date(START - 40 * 864e5).toISOString(),
        endsAt: new Date(START - 864e5).toISOString(),
        graceEndsAt: new Date(END).toISOString(),
        eligible: false,
        authorized: true,
        coverage: { students: 1, paid: 0, covered: 0 },
      });
    if (url.includes("/presence"))
      return json({
        class: {
          id: C,
          name: "Grade 4 Math",
          joinCode: "",
          codeAvailable: false,
          practice: "ended",
        },
        canManage: true,
        students: [],
      });
    return json({});
  });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("a mounted board closes at practice's known end, and says it ended", async () => {
  queryClient.setQueryData(sessionOptions.queryKey, auth);
  queryClient.setQueryData(orgOptions(auth, O).queryKey, {
    id: O,
    kind: "school",
    name: "Birchwood Elementary",
    parentId: null,
    timezone: "UTC",
    roles: ["teacher"],
    teaches: [C],
    can: ["org.read", "classes.read"],
  } as never);
  queryClient.setQueryData(classYearOptions(auth, C).queryKey, {
    past: false,
    practice: "open",
    practiceUntil: new Date(END).toISOString(),
    can: ["signin.read", "signin.manage"],
  });
  queryClient.setQueryData(pilotOptions(auth, C).queryKey, {
    status: "grace",
    startedAt: new Date(START - 40 * 864e5).toISOString(),
    endsAt: new Date(START - 864e5).toISOString(),
    graceEndsAt: new Date(END).toISOString(),
    eligible: true,
    authorized: true,
    coverage: { students: 1, paid: 0, covered: 1 },
  } as never);
  queryClient.setQueryData(
    presenceOptions(auth, { org: O, class: C }).queryKey,
    {
      class: {
        id: C,
        name: "Grade 4 Math",
        joinCode: "ABCDEF",
        codeAvailable: true,
        practice: "open",
      },
      canManage: true,
      students: [{ id: O, name: "Ana B.", here: false }],
    },
  );
  const root = createRootRoute();
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/school/$org/classes/$class/start",
    component: StartClassScreen,
  });
  const router = createRouter({
    routeTree: root.addChildren([leaf]),
    history: createMemoryHistory({
      initialEntries: [`/school/${O}/classes/${C}/start`],
    }),
  });
  await act(async () => {
    await router.load();
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  // Before the end: the code is on the wall.
  expect(
    screen.getByRole("img", { name: /Class code A B C D E F/ }),
  ).toBeTruthy();
  // The clock passes the end, with the board still mounted.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(END - START + 500);
  });
  expect(screen.queryByRole("img", { name: /Class code/ })).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Practice has ended" }),
  ).toBeTruthy();
  // And the class was read again to confirm.
  expect(
    vi
      .mocked(globalThis.fetch)
      .mock.calls.some(([input]) =>
        String(input instanceof Request ? input.url : input).includes(
          `/classes/${C}/year`,
        ),
      ),
  ).toBe(true);
});
