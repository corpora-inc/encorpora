import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  flush,
  analyticsVisitorHeaders,
  landingProps,
  referrerCategory,
  resetAnalyticsForTests,
  track,
  trackSessionStart,
  visitorId,
  visitorKey,
  setAnalyticsSession,
  captureAnalyticsTracker,
  trackClientError,
  initializeAnalyticsContext,
} from "../analytics";
import { eventBatchSchema } from "../../../analytics/events";

const beacon = vi.fn((_url: string, _body: RequestInit) =>
  Promise.resolve(new Response(null, { status: 202 })),
);
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetAnalyticsForTests();
  beacon.mockClear();
  vi.stubGlobal("fetch", beacon);
});
afterEach(() => vi.restoreAllMocks());

async function sentBatches() {
  return Promise.all(
    beacon.mock.calls
      .filter(([url]) => url === "/api/v1/events")
      .map(async ([url, blob]) => {
        expect(url).toBe("/api/v1/events");
        return eventBatchSchema.parse(JSON.parse(blob.body as string));
      }),
  );
}

test("keeps one random first-party visitor ID", () => {
  const id = visitorId();
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(localStorage.getItem(visitorKey)).toBe(id);
  expect(visitorId()).toBe(id);
});

test("buffers events and sends one valid acknowledged batch", async () => {
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

test("does not send a stored trial credential with diagnostics", async () => {
  localStorage.setItem("amp.trial", "a".repeat(43));
  track("map_view");
  flush();
  const [batch] = await sentBatches();
  expect(batch.trial).toBeUndefined();
});

test("drops invalid props instead of throwing into the UI", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(() =>
    track("paywall_view", { reason: "nope" } as never),
  ).not.toThrow();
  flush();
  expect(beacon).not.toHaveBeenCalled();
});

test("uses acknowledged keepalive delivery", async () => {
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

test("a webview that refuses keepalive still receives every batch", async () => {
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    if (init.keepalive) throw new TypeError("keepalive is not supported");
    return Promise.resolve(new Response(null, { status: 202 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  track("plan_view");
  expect(() => flush()).not.toThrow();
  await settle();
  track("try_click");
  expect(() => flush(true)).not.toThrow();
  await settle();
  const sent = fetchMock.mock.calls
    .filter(([, init]) => !init.keepalive)
    .flatMap(
      ([, init]) =>
        eventBatchSchema.parse(JSON.parse(init.body as string)).events,
    )
    .map((e) => e.event);
  expect(sent).toEqual(["plan_view", "try_click"]);
});

test("records the first three of each error, tagged with the browser", async () => {
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 355.0.0.29.82",
  });
  const error = {
    kind: "error",
    source: "app",
    asset: "index-ABCdef12.js",
    line: 1,
    column: 2,
    screen: "pitch",
  } as const;
  for (let i = 0; i < 42; i++) trackClientError(error);
  trackClientError({ ...error, column: 3 });
  trackClientError({ kind: "error", source: "external", screen: "pitch" });
  flush();
  const errors = (await sentBatches())
    .flatMap((b) => b.events)
    .filter((e) => e.event === "client_error")
    .map((e) => e.props as Record<string, unknown>);
  expect(errors.map((e) => [e.source, e.column])).toEqual([
    ["app", 2],
    ["app", 2],
    ["app", 2],
    ["app", 3],
    ["external", undefined],
  ]);
  expect(new Set(errors.map((e) => e.browser))).toEqual(
    new Set(["inapp-instagram"]),
  );
  // A new page load starts counting again.
  resetAnalyticsForTests();
  trackClientError(error);
  flush();
  expect((await sentBatches()).at(-1)!.events.map((e) => e.event)).toEqual([
    "client_error",
  ]);
});

test("the landing names the browser; the first-touch context shared with corpora.inc does not", async () => {
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 trill_370404 BytedanceWebview/d8a21c6",
  });
  expect(landingProps().browser).toBe("inapp-tiktok");
  initializeAnalyticsContext();
  track("landing_view", landingProps());
  flush();
  const [batch] = await sentBatches();
  expect(batch.context).not.toHaveProperty("browser");
  expect(batch.events[0].props).toMatchObject({ browser: "inapp-tiktok" });
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

test("privacy opt-out suppresses session storage and payment attribution headers", () => {
  Object.defineProperty(navigator, "doNotTrack", {
    value: "1",
    configurable: true,
  });
  trackSessionStart();
  expect(analyticsVisitorHeaders()).toEqual({});
  expect(localStorage.getItem(visitorKey)).toBeNull();
  expect(beacon).not.toHaveBeenCalled();
  Object.defineProperty(navigator, "doNotTrack", {
    value: undefined,
    configurable: true,
  });
});

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 10));
};
test("retries 503 with identical IDs and restores pending events after reload", async () => {
  beacon.mockResolvedValueOnce(new Response(null, { status: 503 }));
  track("plan_view");
  flush();
  await settle();
  const first = (await sentBatches())[0];
  resetAnalyticsForTests();
  flush();
  await settle();
  const second = (await sentBatches())[1];
  expect(second.events[0].id).toBe(first.events[0].id);
  expect(second.events[0].sessionId).toBe(first.events[0].sessionId);
  expect(sessionStorage.getItem("amp.analytics.pending.v2")).toBe("[]");
});
test("scopes signed-in events but leaves pre-signup events anonymous", async () => {
  track("try_click");
  setAnalyticsSession({ accountId: "amp|parent-a", token: "synthetic-token" });
  flush();
  await settle();
  flush();
  await settle();
  const batches = await sentBatches();
  expect(batches[0].accountScope).toBeUndefined();
  expect(batches[1].accountScope).toBe("amp|parent-a");
  expect(
    beacon.mock.calls.filter(([url]) => url === "/api/v1/events")[1][1].headers,
  ).toMatchObject({
    Authorization: "Bearer synthetic-token",
  });
  expect(sessionStorage.getItem("amp.analytics.pending.v2")).not.toContain(
    "synthetic-token",
  );
});
test("stale request completions cannot label a different account", async () => {
  setAnalyticsSession({ accountId: "amp|a", token: "a" });
  flush();
  await settle();
  const captured = captureAnalyticsTracker();
  setAnalyticsSession({ accountId: "amp|b", token: "b" });
  flush();
  await settle();
  captured("map_view");
  flush();
  await settle();
  expect(
    (await sentBatches())
      .flatMap((b) => b.events)
      .filter((e) => e.event === "map_view"),
  ).toEqual([]);
});
test("unload dispatches new events even while a prior request is pending", async () => {
  let complete!: (r: Response) => void;
  beacon.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  track("plan_view");
  flush();
  track("checkout_start", { interval: "year" });
  flush(true);
  expect(beacon).toHaveBeenCalledTimes(2);
  expect(
    (await sentBatches())[1].events.some((e) => e.event === "checkout_start"),
  ).toBe(true);
  complete(new Response(null, { status: 202 }));
  await settle();
});
