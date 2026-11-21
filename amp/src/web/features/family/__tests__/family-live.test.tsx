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
} from "../../../../schools/live/contracts";
import { LIVE_RULES, liveTotals } from "../../../../schools/live/status";
import { queryClient, sessionOptions } from "../../../lib/query";
import { liveKey } from "../../live/api";
import { FamilyLive } from "../FamilyLive";
import type { FamilyCockpitProps } from "../FamilyCockpit";
import { familyCockpit, loadFamilyCockpit } from "../cockpit-chunk";

/* A family's live session on its Today: at rest only the quiet Start (the
 * roster's code isn't loaded); running, the cockpit in a family's words with
 * a child's row opening the child's page; who may do what. The pixels (zero
 * shift, one frame on a cold load) are measured in a real browser by
 * scripts/verify-family-live-ui.ts. */

vi.mock("../../live/useLiveClass", async () => {
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
vi.mock("../../live/api", async (original) => ({
  ...(await original<typeof import("../../live/api")>()),
  useStartSession: () => ({ mutate: start, isPending: false }),
  useStopSession: () => ({ mutateAsync: stop, isPending: false }),
  useResolveSignal: () => ({ mutateAsync: resolve, isPending: false }),
}));
vi.mock("../../school/classes/api", async (original) => ({
  ...(await original<typeof import("../../school/classes/api")>()),
  useResetPictures: () => ({ mutateAsync: reset, isPending: false }),
}));

const auth = { accountId: "amp|parent", token: "synthetic" };
const family = "11111111-1111-4111-8111-111111111111";
const place = { org: "o", class: "22222222-2222-4222-8222-222222222222" };
const NOW = Date.parse("2026-11-30T14:05:00.000Z");
const iso = (ms: number) => new Date(NOW + ms).toISOString();
const person = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const learner = (n: number) => `99999999-0000-4000-8000-00000000000${n}`;
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
  level: 3.6,
  recent: [],
  firstSeenAt: null,
  firstAnswerAt: null,
  lastAnswerAt: null,
  lastHelpAt: null,
  lastSeenAt: null,
  seenToday: false,
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
  personId: person(2),
  name: "Wren",
  kind: "hand",
  createdAt: iso(-30_000),
};
const kids = [
  // On the parent's device, answering.
  row(1, "Pip", {
    problems: 4,
    correct: 3,
    independent: 3,
    recent: [
      { correct: true, assisted: false },
      { correct: false, assisted: false },
    ],
    skill: { id: "s1", title: "Adding fractions", strand: "Number" },
    firstSeenAt: iso(-200_000),
    lastAnswerAt: iso(-10_000),
    lastSeenAt: iso(-10_000),
    seenToday: true,
  }),
  // Own device: signed in, no answers yet.
  row(2, "Wren", {
    firstSeenAt: iso(-90_000),
    lastSeenAt: iso(-20_000),
    seenToday: true,
  }),
  // Not started.
  row(3, "Theo"),
];
const snapshot = (patch: Partial<LiveSnapshot> = {}): LiveSnapshot => ({
  serverNow: new Date(NOW).toISOString(),
  session: running,
  rules: LIVE_RULES,
  rows: kids,
  totals: liveTotals(kids),
  signals: [],
  can: { manage: true },
  ...patch,
});
let held: LiveSnapshot;
let router: ReturnType<typeof createRouter>;

const people = new Map(kids.map((kid, i) => [kid.personId, learner(i + 1)]));
const props = (
  patch: Partial<FamilyCockpitProps> = {},
): FamilyCockpitProps => ({
  family,
  place,
  can: { resolve: true, resetPictures: true },
  people,
  levelShown: new Map([
    [learner(1), true],
    [learner(2), false],
    [learner(3), false],
  ]),
  ...patch,
});

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  // A desktop's width: a family's list is still rows.
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1280,
  });
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(NOW);
  for (const spy of [start, stop, resolve, reset]) spy.mockReset();
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(data: LiveSnapshot, given: FamilyCockpitProps = props()) {
  // The route's loader brings the cockpit's chunk with a running session.
  if (data.session || data.signals.length > 0) await loadFamilyCockpit();
  held = data;
  queryClient.setQueryData(sessionOptions.queryKey, auth);
  queryClient.setQueryData(liveKey(auth, place), data);
  const root = createRootRoute();
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/$",
    component: () => (
      <main>
        <FamilyLive {...given} />
        <p>Beside</p>
      </main>
    ),
  });
  router = createRouter({
    routeTree: root.addChildren([leaf]),
    history: createMemoryHistory({ initialEntries: [`/family/${family}`] }),
  });
  await act(async () => {
    await router.load();
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByText("Beside");
}

/** The words a family never reads on its own screens. */
const FOREIGN = /\bstudents?\b|\bclass(?:es|room)?\b|\bteachers?\b/i;

test("at rest: one quiet Start practice, and none of the roster's code", async () => {
  await mount(snapshot({ session: null, rows: [] }));
  expect(document.querySelector('[data-family-live="rest"]')).toBeTruthy();
  expect(familyCockpit()).toBeNull();
  expect(document.querySelector("[data-live-roster]")).toBeNull();
  expect(document.querySelector("[data-live-totals]")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
  expect(start).toHaveBeenCalledWith({}, expect.anything());
  expect(document.body.textContent).not.toMatch(FOREIGN);
});

test("at rest, a parent who may not manage sees nothing to start", async () => {
  await mount(snapshot({ session: null, rows: [], can: { manage: false } }));
  expect(screen.queryByRole("button", { name: "Start practice" })).toBeNull();
  expect(document.querySelector("[data-family-live]")).toBeNull();
});

test("running: every child, in a family's words, a row opens the child's page", async () => {
  await mount(snapshot());
  await waitFor(() =>
    expect(document.querySelector('[data-cockpit="live"]')).toBeTruthy(),
  );
  expect(screen.getByRole("timer").textContent).toContain("5:00");
  expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
  expect(document.querySelectorAll("[data-live-row]").length).toBe(3);
  // A short list: rows at 1280, never the grid, and no sort control.
  expect(document.querySelector('[data-layout="tablet"]')).toBeTruthy();
  expect(document.querySelector("[role=grid]")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Sorted:/ })).toBeNull();
  expect(screen.queryByRole("group", { name: "Sort students" })).toBeNull();
  const links = [...document.querySelectorAll("a[data-child-link]")].map(
    (link) => link.getAttribute("href"),
  );
  // In name order: Pip, Theo, Wren.
  expect(links).toEqual(
    [1, 3, 2].map((n) => `/family/${family}/kids/${learner(n)}`),
  );
  // Not started is true for a child who hasn't opened anything yet.
  expect(screen.getByText("Not started")).toBeTruthy();
  expect(screen.queryByText("Not signed in")).toBeNull();
  expect(document.body.textContent).not.toMatch(FOREIGN);
});

test("levels follow each child's own setting, in grade words", async () => {
  await mount(snapshot());
  await waitFor(() =>
    expect(document.querySelectorAll("[data-live-row]").length).toBe(3),
  );
  const pip = document.querySelector(`[data-live-row="${person(1)}"]`)!;
  // 3.6 is Grade 4 as the class map says it, never the decimal.
  expect(pip.textContent).toContain("Gr 4");
  expect(pip.textContent).not.toContain("3.6");
  const wren = document.querySelector(`[data-live-row="${person(2)}"]`)!;
  expect(wren.textContent).not.toContain("Gr");
  expect(wren.textContent).not.toMatch(/\d\.\d/);
});

test("a raised hand: Got it for a parent who may answer; without, it shows", async () => {
  await mount(snapshot({ signals: [hand] }));
  try {
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /^Got it: Wren/ }),
      ).toBeTruthy(),
    );
  } catch (failure) {
    throw new Error(
      `${String(failure).slice(0, 80)} | strip: ${document.querySelector("[data-live-strip]")?.outerHTML.slice(0, 600)}`,
    );
  }
  resolve.mockResolvedValue({});
  fireEvent.click(screen.getByRole("button", { name: /^Got it: Wren/ }));
  expect(resolve).toHaveBeenCalledWith(hand.id);
  cleanup();
  queryClient.clear();
  await mount(
    snapshot({ signals: [hand] }),
    props({ can: { resolve: false, resetPictures: false } }),
  );
  await waitFor(() =>
    expect(document.querySelector(`[data-signal="${hand.id}"]`)).toBeTruthy(),
  );
  expect(screen.queryByRole("button", { name: /^Got it/ })).toBeNull();
});

test("a child asking at rest brings the cockpit, with the request", async () => {
  await mount(snapshot({ session: null, rows: [], signals: [hand] }));
  await waitFor(() =>
    expect(document.querySelector(`[data-signal="${hand.id}"]`)).toBeTruthy(),
  );
  expect(document.querySelector('[data-cockpit="resting"]')).toBeTruthy();
});

test("Stop asks first, then the family's report opens", async () => {
  stop.mockResolvedValue({ session: { ...running, id: SESSION } });
  await mount(snapshot());
  fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
  expect(stop).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Your kids keep their work");
  fireEvent.click(await screen.findByRole("button", { name: "Stop session" }));
  expect(stop).toHaveBeenCalledWith(SESSION);
  // (The clock is faked, so the poll is by hand.)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(router.state.location.pathname).toBe(
    `/family/${family}/sessions/${SESSION}`,
  );
});
