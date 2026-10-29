import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
vi.mock("../analytics", () => {
  const track = vi.fn();
  return {
    analyticsAllowed: vi.fn(() => true),
    track,
    captureAnalyticsTracker: () => track,
  };
});
import { analyticsAllowed, track } from "../analytics";
import { request } from "../api";
import { purchaseFetch } from "../purchase-analytics";
beforeEach(() => {
  vi.mocked(track).mockReset();
  vi.mocked(analyticsAllowed).mockReturnValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function outcomes() {
  return vi.mocked(track).mock.calls.map((call) => call[1]);
}
test("invoice success links start and result, excluding form contents", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }))),
  );
  expect(
    await request("/funding/invoices", z.object({ ok: z.boolean() }), {
      body: {
        parentEmail: "private@example.test",
        studentBillingName: "Private learner",
      },
    }),
  ).toEqual({ ok: true });
  const [start, end] = outcomes();
  expect(start).toMatchObject({ stage: "funded_invoice", outcome: "started" });
  expect(end).toEqual({ ...start, outcome: "succeeded" });
  expect(JSON.stringify(outcomes())).not.toMatch(/private|learner/i);
});
test.each([
  ["network", () => Promise.reject(new TypeError("Private failure"))],
  [
    "validation",
    () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "private_error" }), {
          status: 400,
        }),
      ),
  ],
  [
    "contract",
    () => Promise.resolve(new Response(JSON.stringify({ ok: "bad" }))),
  ],
] as const)("checkout records %s without raw errors", async (kind, fetcher) => {
  vi.stubGlobal("fetch", vi.fn(fetcher));
  await expect(
    request("/billing/enrollment/checkout", z.object({ ok: z.boolean() }), {
      body: {},
    }),
  ).rejects.toMatchObject({ kind });
  const [start, end] = outcomes();
  expect(end).toEqual({ ...start, outcome: "failed", failure: kind });
  expect(JSON.stringify(outcomes())).not.toMatch(/private/i);
});
test("aborted purchase is cancelled; polling and disabled analytics produce no events", async () => {
  const controller = new AbortController();
  controller.abort();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  await expect(
    request("/funding/invoices", z.unknown(), {
      body: {},
      signal: controller.signal,
    }),
  ).rejects.toBeDefined();
  expect(outcomes().at(-1)).toMatchObject({ outcome: "cancelled" });
  vi.mocked(track).mockClear();
  await request("/funding/invoices", z.unknown());
  expect(track).not.toHaveBeenCalled();
  vi.mocked(analyticsAllowed).mockReturnValue(false);
  await request("/funding/invoices", z.unknown(), { body: {} });
  expect(track).not.toHaveBeenCalled();
});
test("a broken analytics sink cannot break checkout", async () => {
  vi.mocked(track).mockImplementation(() => {
    throw new Error("measurement unavailable");
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response('{"ok":true}')),
  );
  expect(
    await request(
      "/billing/enrollment/checkout",
      z.object({ ok: z.boolean() }),
      { body: {} },
    ),
  ).toEqual({ ok: true });
});

test("signed-in funded requests and legacy checkout share the same outcome observer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 403 })),
  );
  const response = await purchaseFetch("/api/v1/funding/requests", {
    method: "POST",
    body: "private billing details",
  });
  expect(response.status).toBe(403);
  expect(outcomes().at(-1)).toMatchObject({
    stage: "funded_request",
    outcome: "failed",
    failure: "permission",
  });
  vi.mocked(track).mockClear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  await purchaseFetch("/api/v1/billing/checkout", {
    method: "POST",
    body: "private",
  });
  expect(outcomes().at(-1)).toMatchObject({
    stage: "card_checkout",
    outcome: "succeeded",
  });
  expect(JSON.stringify(outcomes())).not.toMatch(/private/i);
});

test("paid learning transport reports network, service and JSON failures", async () => {
  const { learningRequest } = await import("../../learning-transport");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("private raw failure")),
  );
  await expect(
    learningRequest("/learners/synthetic/batches", "synthetic", {}),
  ).rejects.toBeDefined();
  expect(outcomes().at(-1)).toMatchObject({
    operation: "problem",
    outcome: "failed",
    failure: "network",
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad-json")));
  const response = await learningRequest(
    "/learners/synthetic/attempts",
    "synthetic",
    {},
  );
  await expect(response.json()).rejects.toBeDefined();
  expect(outcomes().at(-1)).toMatchObject({
    operation: "answer",
    outcome: "failed",
    failure: "contract",
  });
  expect(JSON.stringify(outcomes())).not.toMatch(/private|synthetic/);
});
