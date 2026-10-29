import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { startEngagement } from "../engagement";
import {
  flush,
  resetAnalyticsForTests,
  trafficKey,
  setAnalyticsSession,
} from "../analytics";
let visible = true;
let focused = true;
const beacon = vi.fn((_url: string, _body: RequestInit) =>
  Promise.resolve(new Response(null, { status: 202 })),
);
async function events() {
  const batches = await Promise.all(
    beacon.mock.calls
      .filter(([url]) => url === "/api/v1/events")
      .map(async (c) => JSON.parse(c[1].body as string)),
  );
  return [
    ...new Map(batches.flatMap((b) => b.events).map((e) => [e.id, e])).values(),
  ];
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  resetAnalyticsForTests();
  beacon.mockClear();
  visible = focused = true;
  Object.defineProperty(document, "visibilityState", {
    get: () => (visible ? "visible" : "hidden"),
    configurable: true,
  });
  vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
  vi.stubGlobal("fetch", beacon);
  window.history.replaceState(
    {},
    "",
    "/try/practice?utm_source=google&utm_campaign=test",
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
test("deep entry context and internal marker accompany initial page, SPA transition, hidden flush", async () => {
  localStorage.setItem(trafficKey, "internal");
  const tracker = startEngagement();
  await vi.advanceTimersByTimeAsync(10000);
  window.history.pushState({}, "", "/invoice/arizona-esa?private=discard");
  tracker.navigate("/invoice/arizona-esa?private=discard");
  await vi.advanceTimersByTimeAsync(5000);
  focused = visible = false;
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(30000);
  tracker.stop();
  flush();
  const batches = await Promise.all(
    beacon.mock.calls
      .filter(([url]) => url === "/api/v1/events")
      .map(async (c) => JSON.parse(c[1].body as string)),
  );
  expect(
    batches.every(
      (b) => b.context.utmSource === "google" && b.traffic === "internal",
    ),
  ).toBe(true);
  const pages = (await events())
    .filter((e) => e.event === "page_engagement")
    .map((e) => e.props);
  expect(
    pages.some((p) => p.screen === "practice" && p.activeMs === 10000),
  ).toBe(true);
  expect(pages.some((p) => p.screen === "invoice" && p.activeMs === 5000)).toBe(
    true,
  );
  expect(
    Math.max(
      ...pages.filter((p) => p.screen === "invoice").map((p) => p.activeMs),
    ),
  ).toBe(5000);
  expect(new Set(pages.map((p) => p.sessionId)).size).toBe(1);
  expect(new Set(pages.map((p) => p.pageId)).size).toBe(2);
  expect(JSON.stringify(batches)).not.toContain("private=");
});
test("engagement stops increasing after idle and resumes with interaction", async () => {
  const tracker = startEngagement();
  await vi.advanceTimersByTimeAsync(90000);
  flush();
  let pages = (await events()).filter((e) => e.event === "page_engagement");
  expect(pages.at(-1).props.activeMs).toBe(60000);
  window.dispatchEvent(new Event("pointerdown"));
  await vi.advanceTimersByTimeAsync(15000);
  tracker.stop();
  pages = (await events()).filter((e) => e.event === "page_engagement");
  expect(pages.at(-1).props.activeMs).toBe(75000);
});

test("a hidden tab does not emit heartbeat traffic or create pages at midnight", async () => {
  vi.setSystemTime(new Date("2026-10-24T23:59:55Z"));
  const tracker = startEngagement();
  await vi.advanceTimersByTimeAsync(1000);
  focused = visible = false;
  document.dispatchEvent(new Event("visibilitychange"));
  const count = (await events()).length;
  await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
  flush();
  expect((await events()).length).toBe(count);
  tracker.stop();
  expect((await events()).length).toBe(count);
});

test("account changes reset the page clock before recording the next account", async () => {
  setAnalyticsSession({ accountId: "amp|first", token: "first" });
  const tracker = startEngagement();
  await vi.advanceTimersByTimeAsync(10000);
  setAnalyticsSession({ accountId: "amp|second", token: "second" });
  await vi.advanceTimersByTimeAsync(5000);
  tracker.stop();
  flush(true);
  const batches = beacon.mock.calls
    .filter(([url]) => url === "/api/v1/events")
    .map(([, r]) => JSON.parse(r.body as string));
  const second = batches
    .filter((b) => b.accountScope === "amp|second")
    .flatMap((b) => b.events)
    .filter((e) => e.event === "page_engagement");
  expect(second.length).toBeGreaterThan(0);
  expect(Math.max(...second.map((e) => e.props.visibleMs))).toBeLessThanOrEqual(
    5000,
  );
});
