import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, expect, test, vi } from "vitest";
import { queryClient, sessionOptions } from "../../../../lib/query";
import { orgOptions } from "../../api";
import { classYearOptions } from "../../org/org-api";
import { pilotOptions } from "../../pilots/api";
import { presenceOptions } from "../api";
import { StartClassScreen } from "../StartClassScreen";

/* CP-3 r3 H1 and r4: a board left open on the wall while the class reaches
 * a moment that can change practice (`recheckAt`) withholds its code at
 * that moment, in the server's time, and asks the server again; the answer
 * decides. The device's own clock, set wrong either way, changes nothing,
 * and a deadline weeks away is never lost. */
const O = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
const auth = { accountId: "amp|teacher", token: "synthetic" };
/** The server's clock when the page first read the class. */
const SERVER = new Date("2026-11-14T15:00:00Z").getTime();

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Mounts the board with the class open until `recheckIn` from now (server
 * time), the device clock off by `skew`; the server after that moment
 * answers `after`. Returns how many times the class was read again. */
async function board({
  recheckIn,
  skew,
  after,
}: {
  recheckIn: number;
  skew: number;
  after: "ended" | "open";
}) {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
      "performance",
    ],
  });
  // The device's wall clock, wrong by `skew`.
  vi.setSystemTime(SERVER + skew);
  window.scrollTo = () => {};
  const start = performance.now();
  const serverNow = () => SERVER + (performance.now() - start);
  const recheckAt = SERVER + recheckIn;
  let reads = 0;
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    const ended = serverNow() >= recheckAt && after === "ended";
    if (url.includes("/year")) {
      reads++;
      return json({
        past: false,
        practice: ended ? "ended" : "open",
        can: ["signin.read", "signin.manage"],
        recheckAt: ended
          ? null
          : new Date(
              serverNow() >= recheckAt ? recheckAt + 864e5 : recheckAt,
            ).toISOString(),
        serverNow: new Date(serverNow()).toISOString(),
      });
    }
    if (url.includes("/pilot"))
      return json({
        status: ended ? "expired" : "grace",
        startedAt: new Date(SERVER - 40 * 864e5).toISOString(),
        endsAt: new Date(SERVER - 864e5).toISOString(),
        graceEndsAt: new Date(recheckAt).toISOString(),
        eligible: !ended,
        authorized: true,
        coverage: { students: 1, paid: 0, covered: ended ? 0 : 1 },
      });
    if (url.includes("/presence"))
      return json({
        class: {
          id: C,
          name: "Grade 4 Math",
          joinCode: ended ? "" : "ABCDEF",
          codeAvailable: !ended,
          practice: ended ? "ended" : "open",
        },
        canManage: true,
        students: [{ id: O, name: "Ana B.", here: false }],
      });
    return json({});
  });
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
    can: ["signin.read", "signin.manage"],
    recheckAt: new Date(recheckAt).toISOString(),
    serverNow: new Date(SERVER).toISOString(),
    receivedAt: start,
  });
  queryClient.setQueryData(pilotOptions(auth, C).queryKey, {
    status: "grace",
    startedAt: new Date(SERVER - 40 * 864e5).toISOString(),
    endsAt: new Date(SERVER - 864e5).toISOString(),
    graceEndsAt: new Date(recheckAt).toISOString(),
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
  return {
    reads: () => reads,
    code: () => screen.queryByRole("img", { name: /Class code A B C D E F/ }),
    advance: (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      }),
  };
}

for (const [name, skew] of [
  ["right", 0],
  ["a minute fast", 60_000],
  ["a minute slow", -60_000],
] as const)
  test(`the device clock ${name}: the board stays open until the server's moment, then closes on its word`, async () => {
    const page = await board({ recheckIn: 15_000, skew, after: "ended" });
    // Open, whatever the device clock says.
    expect(page.code()).toBeTruthy();
    await page.advance(10_000);
    expect(page.code()).toBeTruthy();
    // The server's moment passes: the code goes, and the class is asked.
    await page.advance(6_000);
    expect(page.code()).toBeNull();
    expect(page.reads()).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Practice has ended" }),
    ).toBeTruthy();
  });

test("a moment that leaves practice open: the code comes back on the server's word", async () => {
  const page = await board({ recheckIn: 15_000, skew: 0, after: "open" });
  await page.advance(16_000);
  await page.advance(1_000);
  expect(page.reads()).toBeGreaterThan(0);
  expect(page.code()).toBeTruthy();
});

test(
  "a moment weeks away is never lost: hourly wakes carry it, and it closes then",
  { timeout: 120_000 },
  async () => {
    const days = 30 * 864e5;
    const page = await board({ recheckIn: days, skew: 0, after: "ended" });
    // Days pass, a wake an hour at a time, asking nothing early.
    await page.advance(days - 60_000);
    expect(page.reads()).toBe(0);
    expect(page.code()).toBeTruthy();
    await page.advance(120_000);
    expect(page.reads()).toBeGreaterThan(0);
    expect(page.code()).toBeNull();
  },
);
