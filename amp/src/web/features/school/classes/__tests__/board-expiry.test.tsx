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
import { presenceOptions, useStaffSession } from "../api";
import { useClassAccess } from "../../pilots/ClassAccess";
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
  failing = 0,
  refused = false,
  end,
  delayFirst = 0,
  alone = false,
}: {
  recheckIn: number;
  skew: number;
  after: "ended" | "open";
  /** Why practice ended, when the server says (CP-3 r7). */
  end?: "session" | "roster" | "coverage";
  /** Year reads after the moment that fail (503) before one answers. */
  failing?: number;
  /** Every year read from now on is refused (404): the reader lost the
   * class, long before its moment. */
  refused?: boolean;
  /** The first year read (none cached) takes this long to arrive; its
   * clock is read when it was asked. */
  delayFirst?: number;
  /** Only the class's access, without the board's own 4 s poll: a weeks
   * long wait is then weeks of the access timer alone. */
  alone?: boolean;
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
  // Every delay the page arms: a browser fires one past 2^31 − 1 ms
  // (24.8 days) at once.
  const delays: number[] = [];
  const faked = globalThis.setTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((
    run: () => void,
    ms?: number,
    ...rest: unknown[]
  ) => {
    delays.push(ms ?? 0);
    return faked(run, ms, ...rest);
  }) as typeof setTimeout);
  window.scrollTo = () => {};
  const start = performance.now();
  const serverNow = () => SERVER + (performance.now() - start);
  const recheckAt = SERVER + recheckIn;
  let reads = 0;
  // The board's reader loses the class: every read of it is refused; or
  // the service is down: every read of it fails.
  let revoked = false;
  let down = false;
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
      if (delayFirst && reads === 1) {
        const asked = serverNow();
        await new Promise((resolve) => setTimeout(resolve, delayFirst));
        return json({
          past: false,
          practice: "open",
          can: ["signin.read", "signin.manage"],
          recheckAt: new Date(recheckAt).toISOString(),
          serverNow: new Date(asked).toISOString(),
        });
      }
      if (refused)
        return new Response(JSON.stringify({ error: "not_found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      if (serverNow() >= recheckAt && failing > 0) {
        failing--;
        return new Response(
          JSON.stringify({ error: "school_service_unavailable" }),
          { status: 503, headers: { "content-type": "application/json" } },
        );
      }
      return json({
        past: false,
        practice: ended ? "ended" : "open",
        ...(ended && end ? { practiceEnd: end } : {}),
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
    if (down && (url.includes("/presence") || url.includes("/year")))
      return new Response(
        JSON.stringify({ error: "school_service_unavailable" }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    if (revoked && (url.includes("/presence") || url.includes("/year")))
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
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
  if (!delayFirst)
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
    component: alone ? Access : StartClassScreen,
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
    revoke: () => {
      revoked = true;
    },
    /** The service fails (503), or answers again for this reader. */
    serve: (state: "down" | "ok") => {
      down = state === "down";
      revoked = false;
    },
    /** The class is read again (a focus, a visibility change). */
    refresh: () =>
      act(async () => {
        await queryClient
          .refetchQueries({
            predicate: (query) =>
              query.queryKey.includes("presence") ||
              query.queryKey.includes("class-year"),
          })
          .catch(() => undefined);
      }),
    longest: () => Math.max(0, ...delays),
    code: () => screen.queryByRole("img", { name: /Class code A B C D E F/ }),
    advance: (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      }),
  };
}

/** The class's access alone: its code shows only while practice is open. */
function Access() {
  // Every class screen holds the session, as the board does.
  useStaffSession();
  const access = useClassAccess({ org: O, class: C });
  return access.closed ? null : (
    <span role="img" aria-label="Class code A B C D E F" />
  );
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
    const page = await board({
      recheckIn: days,
      skew: 0,
      after: "ended",
      alone: true,
    });
    // Days pass, a wake an hour at a time, asking nothing early.
    await page.advance(days - 60_000);
    expect(page.reads()).toBe(0);
    expect(page.longest()).toBeLessThanOrEqual(2 ** 31 - 1);
    expect(page.code()).toBeTruthy();
    await page.advance(120_000);
    expect(page.reads()).toBeGreaterThan(0);
    expect(page.code()).toBeNull();
  },
);

test("a recheck that fails says so with Try again, tries again soon, and recovers", async () => {
  const page = await board({
    recheckIn: 15_000,
    skew: 0,
    after: "open",
    failing: 2,
  });
  await page.advance(16_000);
  await page.advance(1_000);
  // Never an endless "Checking practice": it couldn't check, and says so.
  expect(screen.queryByText("Checking practice")).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Couldn’t check practice" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(page.code()).toBeNull();
  const afterFirst = page.reads();
  // Tried again in 5 s (fails), then 15 s (answers: open).
  await page.advance(5_500);
  expect(page.reads()).toBe(afterFirst + 1);
  await page.advance(16_000);
  await page.advance(1_000);
  expect(page.reads()).toBe(afterFirst + 2);
  expect(page.code()).toBeTruthy();
});

test("an answer that took a minute to arrive counts its age: the moment is not postponed", async () => {
  const page = await board({
    recheckIn: 15_000,
    skew: 0,
    after: "ended",
    delayFirst: 60_000,
  });
  // The answer arrives a minute after it was asked, its moment already
  // passed: the code never shows, and the class is asked again at once.
  await page.advance(60_500);
  expect(page.code()).toBeNull();
  await page.advance(1_000);
  expect(page.reads()).toBeGreaterThan(1);
  expect(
    screen.getByRole("heading", { name: "Practice has ended" }),
  ).toBeTruthy();
});

test("a refusal on any refresh revokes the cached open state, however far off its moment", async () => {
  const page = await board({
    recheckIn: 30 * 864e5,
    skew: 0,
    after: "open",
    refused: true,
  });
  expect(page.code()).toBeTruthy();
  // A refresh (focus, Try again, another screen) is refused: the cached
  // open answer and its far moment no longer stand.
  await act(async () => {
    await queryClient
      .refetchQueries({ queryKey: classYearOptions(auth, C).queryKey })
      .catch(() => undefined);
  });
  await page.advance(100);
  expect(page.code()).toBeNull();
  expect(screen.queryByText("Checking practice")).toBeNull();
});

test("a reader refused on the board's next poll loses its code and names at once (CP-3 r7)", async () => {
  const page = await board({ recheckIn: 30 * 864e5, skew: 0, after: "open" });
  expect(page.code()).toBeTruthy();
  expect(screen.getByText("Ana B.")).toBeTruthy();
  page.revoke();
  // The next 4 s poll is refused: no cached code, QR or name stays.
  await page.advance(4_500);
  await page.advance(100);
  expect(page.code()).toBeNull();
  expect(screen.queryByText("Ana B.")).toBeNull();
  expect(
    screen.getByRole("heading", { name: "This class isn’t open to you" }),
  ).toBeTruthy();
  expect(screen.queryByText(/Reconnecting/)).toBeNull();
});

test("a refusal stands through later failures: only a successful read brings the board back (CP-3 r8)", async () => {
  const page = await board({ recheckIn: 30 * 864e5, skew: 0, after: "open" });
  expect(page.code()).toBeTruthy();
  page.revoke();
  await page.advance(4_500);
  await page.advance(100);
  expect(page.code()).toBeNull();
  // The service fails; the screens read again: the refused code and
  // names stay gone (a 503 is no answer for this reader).
  page.serve("down");
  await page.refresh();
  await page.advance(100);
  expect(page.code()).toBeNull();
  expect(screen.queryByText("Ana B.")).toBeNull();
  expect(screen.queryByText(/Reconnecting/)).toBeNull();
  // A successful read for this session says otherwise: back.
  page.serve("ok");
  await page.refresh();
  await page.advance(100);
  await page.refresh();
  await page.advance(100);
  expect(page.code()).toBeTruthy();
});

test("a school year that's over offers no seats on the board (CP-3 r8)", async () => {
  await board({ recheckIn: 15_000, skew: 0, after: "ended", end: "session" });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(16_000);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });
  expect(
    screen.getByRole("heading", { name: "This class’s school year is over" }),
  ).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Request seats" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Request seats" })).toBeNull();
});
