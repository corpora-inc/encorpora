import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type {
  LiveRow,
  LiveSignal,
  LiveSnapshot,
} from "../../../../../../schools/live/contracts";
import { LIVE_RULES, liveTotals } from "../../../../../../schools/live/status";
import { queryClient, sessionOptions } from "../../../../../lib/query";
import { liveEndedKey, liveKey, type EndedView } from "../../../../live/api";
import { ClassCockpit, type CockpitPermissions } from "../ClassCockpit";

/* Today's live session, composed (#2465): what each state shows and who
 * may do what, and that the one-second clock redraws the cockpit only,
 * never what sits beside it on Today. The pixels (zero shift, one frame on
 * a cold load) are measured in a real browser by
 * scripts/verify-live-cockpit-screen-ui.ts. */

vi.mock("../../../../live/useLiveClass", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  return {
    useLiveClass: () =>
      useQuery({
        queryKey: liveKey(auth, place),
        queryFn: () => held,
        staleTime: Infinity,
      }),
  };
});
const start = vi.fn();
const stop = vi.fn();
const resolve = vi.fn();
const reset = vi.fn();
vi.mock("../../../../live/api", async (original) => ({
  ...(await original<typeof import("../../../../live/api")>()),
  useStartSession: () => ({ mutate: start, isPending: false }),
  useStopSession: () => ({ mutateAsync: stop, isPending: false }),
  useResolveSignal: () => ({ mutateAsync: resolve, isPending: false }),
}));
vi.mock("../../api", async (original) => ({
  ...(await original<typeof import("../../api")>()),
  useResetPictures: () => ({ mutateAsync: reset, isPending: false }),
}));

const auth = { accountId: "amp|teacher", token: "synthetic" };
const place = { org: "o", class: "22222222-2222-4222-8222-222222222222" };
const NOW = Date.parse("2026-11-30T14:05:00.000Z");
const iso = (ms: number) => new Date(NOW + ms).toISOString();
const person = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const row = (
  n: number,
  name: string,
  patch: Partial<LiveRow> = {},
): LiveRow => ({
  personId: person(n),
  name,
  problems: 0,
  correct: 0,
  independent: 0,
  assisted: 0,
  hints: 0,
  lessons: 0,
  examples: 0,
  videos: 0,
  skill: null,
  level: 5,
  recent: [],
  firstSeenAt: iso(-60_000),
  firstAnswerAt: null,
  lastAnswerAt: null,
  lastHelpAt: null,
  lastSeenAt: iso(-60_000),
  seenToday: true,
  ...patch,
});
const SESSION = "33333333-3333-4333-8333-333333333333";
const running = {
  id: SESSION,
  classId: place.class,
  startedAt: iso(-5 * 60_000),
  plannedEndAt: null,
  endsAt: iso(4 * 3_600_000),
  endedAt: null,
  endReason: null,
  startedBy: null,
  endedBy: null,
  rulesVersion: 1,
};
const hand: LiveSignal = {
  id: "44444444-4444-4444-8444-444444444444",
  personId: person(1),
  name: "Ana",
  kind: "hand",
  createdAt: iso(-30_000),
};
const picture: LiveSignal = {
  id: "55555555-5555-4555-8555-555555555555",
  personId: person(2),
  name: "Ben",
  kind: "forgot_picture",
  createdAt: iso(-20_000),
};
const rows = [
  row(1, "Ana", {
    problems: 4,
    correct: 3,
    independent: 3,
    recent: [
      { correct: true, assisted: false },
      { correct: true, assisted: false },
    ],
    lastAnswerAt: iso(-10_000),
  }),
  row(2, "Ben"),
];
const snapshot = (patch: Partial<LiveSnapshot> = {}): LiveSnapshot => ({
  serverNow: new Date(NOW).toISOString(),
  session: running,
  rules: LIVE_RULES,
  rows,
  totals: liveTotals(rows),
  signals: [],
  can: { manage: true },
  ...patch,
});
let held: LiveSnapshot;
const TEACHER: CockpitPermissions = { resolve: true, resetPictures: true };
const AIDE: CockpitPermissions = { resolve: true, resetPictures: false };
let besideRenders = 0;

beforeEach(() => {
  // The grid and the strip measure themselves; jsdom lays nothing out, so
  // the roster takes the window's width: a desktop's grid.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1280,
  });
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(NOW);
  besideRenders = 0;
  for (const spy of [start, stop, resolve, reset]) spy.mockReset();
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Today's feed, beside the cockpit: counts its own renders. */
function Beside() {
  besideRenders++;
  return <p>The feed</p>;
}

async function mount(
  data: LiveSnapshot,
  options: { can?: CockpitPermissions; available?: boolean } = {},
) {
  held = data;
  queryClient.setQueryData(sessionOptions.queryKey, auth);
  queryClient.setQueryData(liveKey(auth, place), data);
  const root = createRootRoute();
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => (
      <main>
        <ClassCockpit
          place={place}
          available={options.available ?? true}
          words={{
            start: "Start class",
            nameHeader: "Student",
            roster: "Students in this session",
          }}
          can={options.can ?? TEACHER}
          showGradeNumbers
        />
        <Beside />
      </main>
    ),
  });
  const router = createRouter({
    routeTree: root.addChildren([leaf]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await act(async () => {
    await router.load();
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByText("The feed");
}

test("at rest: Start with its length, and the requests strip, quiet", async () => {
  await mount(snapshot({ session: null, rows: [] }));
  expect(screen.getByRole("button", { name: "Start class" })).toBeTruthy();
  expect(document.querySelector('[data-cockpit="resting"]')).toBeTruthy();
  expect(document.querySelector("[data-live-strip][data-empty]")).toBeTruthy();
  expect(document.querySelector("[data-live-roster]")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Start class" }));
  expect(start).toHaveBeenCalledWith({}, expect.anything());
});

test("at rest, an aide watches: no Start", async () => {
  await mount(snapshot({ session: null, rows: [], can: { manage: false } }), {
    can: AIDE,
  });
  expect(screen.queryByRole("button", { name: "Start class" })).toBeNull();
  expect(screen.getByText("No session running")).toBeTruthy();
});

test("nowhere to start and nothing running: nothing at all", async () => {
  await mount(snapshot({ session: null, rows: [] }), { available: false });
  expect(document.querySelector("[data-cockpit]")).toBeNull();
});

test("live: the clock, Stop, the totals and every student", async () => {
  await mount(snapshot({ signals: [hand, picture] }));
  expect(document.querySelector('[data-cockpit="live"]')).toBeTruthy();
  expect(screen.getByRole("timer").textContent).toContain("5:00");
  expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
  expect(document.querySelector("[data-live-totals]")).toBeTruthy();
  expect(document.querySelectorAll("[data-live-row]").length).toBe(2);
  // Students open as the student layer (EntityLink).
  expect(
    document.querySelector('[data-live-row] a[data-entity="student"]'),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Got it: Ana/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Reset: Ben/ })).toBeTruthy();
});

test("an aide: no Stop; answers a hand; a picture waits for the teacher", async () => {
  await mount(snapshot({ signals: [hand, picture], can: { manage: false } }), {
    can: AIDE,
  });
  expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  expect(screen.getByRole("button", { name: /^Got it: Ana/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Reset: Ben/ })).toBeNull();
  // Ben's request still shows, without a button.
  expect(document.querySelector(`[data-signal="${picture.id}"]`)).toBeTruthy();
});

test("Got it and Reset: pending, then gone; a failure says so", async () => {
  await mount(snapshot({ signals: [hand, picture] }));
  let answer: () => void = () => {};
  resolve.mockReturnValue(new Promise<void>((done) => (answer = done)));
  fireEvent.click(screen.getByRole("button", { name: /^Got it: Ana/ }));
  expect(resolve).toHaveBeenCalledWith(hand.id);
  const button = screen.getByRole("button", { name: /^Got it: Ana/ });
  expect(button.getAttribute("aria-busy")).toBe("true");
  await act(async () => answer());
  await waitFor(() =>
    expect(document.querySelector(`[data-signal="${hand.id}"]`)).toBeNull(),
  );
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  reset.mockRejectedValue(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: /^Reset: Ben/ }));
  expect(reset).toHaveBeenCalledWith(picture.personId);
  await screen.findByRole("alert");
  // Logged, never silent.
  expect(error).toHaveBeenCalled();
  // Still there, to try again.
  expect(document.querySelector(`[data-signal="${picture.id}"]`)).toBeTruthy();
});

test("Stop asks first, then the report opens", async () => {
  stop.mockResolvedValue({ session: { ...running, id: SESSION } });
  await mount(snapshot());
  fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  expect(stop).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "Stop session" }));
  expect(stop).toHaveBeenCalledWith(SESSION);
});

test("ended on its own: still and whole, with the report a tap away", async () => {
  const ended: EndedView = {
    snapshot: snapshot(),
    endedAt: Date.parse(iso(-30_000)),
  };
  queryClient.setQueryData(liveEndedKey(auth, place), ended);
  await mount(snapshot({ session: null, rows: [] }));
  expect(document.querySelector('[data-cockpit="ended"]')).toBeTruthy();
  expect(screen.getByText("Ended")).toBeTruthy();
  const link = screen.getByRole("link", { name: "See the report" });
  expect(link.getAttribute("href")).toContain(`/sessions/${SESSION}`);
  // The same rows, as they ended.
  expect(document.querySelectorAll("[data-live-row]").length).toBe(2);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() =>
    expect(document.querySelector('[data-cockpit="resting"]')).toBeTruthy(),
  );
});

test("the clock redraws the cockpit, never what is beside it", async () => {
  await mount(snapshot());
  const before = besideRenders;
  const timer = screen.getByRole("timer");
  expect(timer.textContent).toContain("5:00");
  await act(async () => {
    vi.advanceTimersByTime(3000);
  });
  expect(screen.getByRole("timer").textContent).toContain("5:03");
  expect(besideRenders).toBe(before);
});
