import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  flush,
  landingProps,
  referrerCategory,
  resetAnalyticsForTests,
  track,
  trackSessionStart,
  visitorId,
  visitorKey,
} from "../analytics";
import { eventBatchSchema } from "../../../analytics/events";

const beacon = vi.fn((_url: string, _body: Blob) => true);
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetAnalyticsForTests();
  beacon.mockClear();
  Object.defineProperty(navigator, "sendBeacon", {
    value: beacon,
    configurable: true,
  });
});
afterEach(() => vi.restoreAllMocks());

async function sentBatches() {
  return Promise.all(
    beacon.mock.calls.map(async ([url, blob]) => {
      expect(url).toBe("/api/v1/events");
      return eventBatchSchema.parse(JSON.parse(await blob.text()));
    }),
  );
}

test("keeps one random first-party visitor ID", () => {
  const id = visitorId();
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(localStorage.getItem(visitorKey)).toBe(id);
  expect(visitorId()).toBe(id);
});

test("buffers events and sends one valid batch by beacon", async () => {
  track("try_click");
  track("placement_answer", { index: 0 });
  track("paywall_view", { reason: "limit" });
  expect(beacon).not.toHaveBeenCalled();
  flush();
  const [batch] = await sentBatches();
  expect(batch.visitorId).toBe(visitorId());
  expect(batch.events.map((e) => e.event)).toEqual([
    "try_click",
    "placement_answer",
    "paywall_view",
  ]);
});

test("links the stored trial without storing anything else", async () => {
  localStorage.setItem("amp.trial", "a".repeat(43));
  track("map_view");
  flush();
  const [batch] = await sentBatches();
  expect(batch.trial).toBe("a".repeat(43));
});

test("drops invalid props instead of throwing into the UI", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(() =>
    track("paywall_view", { reason: "nope" } as never),
  ).not.toThrow();
  flush();
  expect(beacon).not.toHaveBeenCalled();
});

test("falls back to keepalive fetch when the beacon is refused", async () => {
  beacon.mockReturnValueOnce(false);
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);
  track("plan_view");
  flush();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/events",
    expect.objectContaining({ keepalive: true, method: "POST" }),
  );
});

test("sends a full batch without waiting", () => {
  for (let i = 0; i < 25; i++) track("practice_answer", { index: i });
  expect(beacon).toHaveBeenCalledTimes(1);
});

test("counts a session once per tab", async () => {
  trackSessionStart();
  trackSessionStart();
  flush();
  const [batch] = await sentBatches();
  expect(batch.events).toHaveLength(1);
  expect(batch.events[0]).toMatchObject({
    event: "session_start",
    props: { daysSinceFirstVisit: 0 },
  });
});

test("reduces the landing context to categories", () => {
  expect(
    landingProps(
      {
        search: "?utm_source=Newsletter&utm_campaign=fall%20launch",
        hostname: "amp.example",
      },
      "https://www.google.com/search?q=private",
    ),
  ).toMatchObject({ utmSource: "newsletter", referrer: "search" });
  expect(referrerCategory("", "amp.example")).toBe("direct");
  expect(referrerCategory("https://amp.example/x", "amp.example")).toBe(
    "internal",
  );
  expect(referrerCategory("https://t.co/abc", "amp.example")).toBe("social");
});
