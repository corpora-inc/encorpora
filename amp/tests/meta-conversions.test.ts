import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  MetaConversions,
  MetaConversionError,
  META_PURCHASE_PERMISSION_VERSION,
  metaAdultEmailHash,
  metaPurchaseRequest,
  type MetaPurchase,
  type MetaDeliveryMode,
} from "../src/advertising/meta-conversions.js";

const now = new Date("2026-10-22T12:00:00.000Z");
const dataset = "123456789012345"; // Synthetic destination; never sent.
const token = "synthetic-token-not-a-credential";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function purchase(): MetaPurchase {
  return {
    eventId: `amp_meta_${"a".repeat(64)}`,
    occurredAt: "2026-10-21T12:00:00.000Z",
    amountMinor: 49900,
    currency: "USD",
    adultEmailSha256: hash("adult@example.test"),
    source: { actionSource: "other" },
    permission: {
      noticeVersion: META_PURCHASE_PERMISSION_VERSION,
      adultAttested: true,
      purpose: "measurement-and-ad-delivery",
      grantedAt: "2026-10-20T12:00:00.000Z",
      expiresAt: "2027-10-20T12:00:00.000Z",
    },
  };
}
const live = { kind: "live" } as const;
const testMode = { kind: "test", testEventCode: "TEST123" } as const;
function fail(code: string, outcome = "not_sent") {
  return (e: unknown) =>
    e instanceof MetaConversionError &&
    e.code === code &&
    e.outcome === outcome;
}
const accepted = () =>
  Response.json({
    events_received: 1,
    messages: [],
    fbtrace_id: "SyntheticTrace",
  });
function client(
  fetcher: typeof fetch,
  enabled = true,
  credential = async () => token,
  clock = () => now,
) {
  return new MetaConversions(
    { datasetId: dataset, enabled },
    credential,
    fetcher,
    clock,
  );
}

test("Meta email normalization matches its published vector and preserves Gmail dots/tags", () => {
  assert.equal(
    metaAdultEmailHash(" John_Smith@gmail.com "),
    "62a14e44f765419d10fea99367361a727c12365e2520f32218d505ed9aa0f62f",
  );
  assert.equal(
    metaAdultEmailHash(" Adult.Name+AMP@Gmail.com "),
    hash("adult.name+amp@gmail.com"),
  );
  for (const invalid of [
    "private invalid@x.test",
    "missing-at",
    "a\nb@example.test",
    null,
    {},
    123,
  ])
    assert.throws(
      () => metaAdultEmailHash(invalid as string),
      fail("invalid_email"),
    );
});

test("a purchase transmits only the adult commerce allowlist", () => {
  const p = purchase();
  assert.deepEqual(metaPurchaseRequest(p, live, now), {
    data: [
      {
        event_name: "Purchase",
        event_time: 1792584000,
        event_id: p.eventId,
        action_source: "other",
        user_data: { em: [p.adultEmailSha256] },
        custom_data: { value: 499, currency: "USD" },
      },
    ],
  });
  const request = metaPurchaseRequest(p, testMode, now);
  assert.equal(request.test_event_code, "TEST123");
  assert.equal(request.data[0]?.event_id, p.eventId);
  for (const field of [
    "learnerId",
    "grade",
    "age",
    "score",
    "lesson",
    "email",
    "client_ip_address",
    "fbp",
    "fbc",
    "external_id",
    "refund",
  ])
    assert.throws(
      () =>
        metaPurchaseRequest(
          { ...p, [field]: "private" } as MetaPurchase,
          live,
          now,
        ),
      fail("invalid_purchase"),
    );
});

test("website events require an actual allowed adult URL and user agent; other sources reject context", () => {
  const p = purchase();
  p.source = {
    actionSource: "website",
    eventSourceUrl: "https://amp.corpora.inc/purchase/annual",
    clientUserAgent: "Mozilla/5.0 SyntheticBrowser",
  };
  const event = metaPurchaseRequest(p, live, now).data[0]!;
  assert.equal(event.event_source_url, p.source.eventSourceUrl);
  assert.equal(event.user_data.client_user_agent, p.source.clientUserAgent);
  for (const source of [
    { actionSource: "website", eventSourceUrl: p.source.eventSourceUrl },
    { ...p.source, clientUserAgent: "  " },
    { ...p.source, clientUserAgent: "x\r\nAuthorization: secret" },
    {
      ...p.source,
      eventSourceUrl: p.source.eventSourceUrl + "?learner=private",
    },
    { ...p.source, eventSourceUrl: "https://amp.corpora.inc/practice" },
    {
      ...p.source,
      eventSourceUrl: "https://amp.corpora.inc.attacker.test/purchase/annual",
    },
    { actionSource: "other", clientUserAgent: "hidden" },
    { actionSource: "system_generated" },
    { actionSource: "physical_store" },
    { actionSource: "app" },
  ])
    assert.throws(
      () => metaPurchaseRequest({ ...p, source } as MetaPurchase, live, now),
      fail("invalid_purchase"),
    );
});

test("the permission must be Meta-specific, adult, current, and granted before purchase", () => {
  const p = purchase();
  for (const permission of [
    { ...p.permission, noticeVersion: "google-adult-purchase-v2" },
    { ...p.permission, adultAttested: false },
    { ...p.permission, purpose: "measurement-only" },
    { ...p.permission, grantedAt: "2026-10-21T12:00:00.001Z" },
    { ...p.permission, expiresAt: now.toISOString() },
  ])
    assert.throws(
      () =>
        metaPurchaseRequest({ ...p, permission } as MetaPurchase, live, now),
      (e) => e instanceof MetaConversionError && e.outcome === "not_sent",
    );
  assert.throws(
    () => metaPurchaseRequest(p, live, new Date(NaN)),
    fail("invalid_clock"),
  );
});

test("seven-day delivery window uses actual event time, including second rounding", () => {
  const p = purchase();
  p.permission.grantedAt = "2026-10-01T12:00:00.000Z";
  p.occurredAt = "2026-10-15T12:00:00.000Z";
  assert.doesNotThrow(() => metaPurchaseRequest(p, live, now));
  p.occurredAt = "2026-10-15T11:59:59.999Z";
  assert.throws(
    () => metaPurchaseRequest(p, live, now),
    fail("event_outside_delivery_window"),
  );
  p.occurredAt = "2026-10-15T12:00:00.999Z";
  assert.throws(
    () => metaPurchaseRequest(p, live, new Date(+now + 500)),
    fail("event_outside_delivery_window"),
  );
  p.occurredAt = "2026-10-22T12:00:00.001Z";
  assert.throws(
    () => metaPurchaseRequest(p, live, now),
    fail("event_outside_delivery_window"),
  );
  p.occurredAt = "2026-02-30T00:00:00.000Z";
  assert.throws(
    () => metaPurchaseRequest(p, live, now),
    fail("invalid_purchase"),
  );
});

test("zero/refund values and arbitrary event references cannot become purchases", () => {
  for (const amountMinor of [0, -49900, 1.5, 100_000_001, NaN, Infinity])
    assert.throws(
      () => metaPurchaseRequest({ ...purchase(), amountMinor }, live, now),
      fail("invalid_purchase"),
    );
  for (const eventId of [
    "invoice-private",
    "amp_meta_" + "a".repeat(63),
    "amp_meta_" + "A".repeat(64),
  ])
    assert.throws(
      () => metaPurchaseRequest({ ...purchase(), eventId }, live, now),
      fail("invalid_purchase"),
    );
});

test("default preview has no credentials or network, and omits identifiers", async () => {
  let calls = 0;
  const c = new MetaConversions(
    { datasetId: dataset },
    async () => {
      calls++;
      throw Error();
    },
    async () => {
      calls++;
      throw Error();
    },
    () => now,
  );
  const result = await c.purchase(purchase());
  assert.deepEqual(result, {
    kind: "preview",
    submitted: false,
    eventName: "Purchase",
    actionSource: "other",
    amountMinor: 49900,
    currency: "USD",
    includesBrowserContext: false,
  });
  assert.equal(calls, 0);
  for (const mode of [live, testMode])
    await assert.rejects(
      c.purchase(purchase(), mode),
      fail("delivery_disabled"),
    );
  assert.equal(calls, 0);
  assert.throws(
    () =>
      new MetaConversions(
        { datasetId: "../other?token=secret" },
        async () => token,
      ),
    fail("invalid_destination"),
  );
});

test("explicit live and test submits once to fixed HTTPS host, keeps token out of URL/body", async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const c = client(async (url, options) => {
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("authorization"), `Bearer ${token}`);
    assert.equal(options?.redirect, "error");
    assert.equal(options?.credentials, "omit");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.method, "POST");
    assert.ok(options?.signal);
    assert.equal(
      String(url),
      `https://graph.facebook.com/v26.0/${dataset}/events`,
    );
    assert.ok(!String(options?.body).includes(token));
    requests.push({
      url: String(url),
      body: JSON.parse(String(options?.body)),
    });
    return Response.json({
      events_received: 1,
      messages: ["private provider detail"],
      fbtrace_id: "Trace_1",
      id: dataset,
      num_processed_entries: 1,
    });
  });
  for (const mode of [live, testMode]) {
    const receipt = await c.purchase(purchase(), mode);
    assert.equal(receipt.kind, "accepted");
    if (receipt.kind !== "accepted") throw Error();
    assert.equal(receipt.mode, mode.kind);
    assert.equal(receipt.messageCount, 1);
    assert.equal(receipt.eventsReceived, 1);
    assert.ok(!JSON.stringify(receipt).includes("private provider detail"));
    assert.ok(!JSON.stringify(receipt).includes(purchase().adultEmailSha256));
  }
  assert.equal(requests.length, 2);
  assert.equal(requests[0]!.body.test_event_code, undefined);
  assert.equal(requests[1]!.body.test_event_code, "TEST123");
});

test("input validation, disabled mode and missing credentials fail before HTTP", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return accepted();
  };
  for (const mode of [
    { kind: "preview", testEventCode: "TEST123" },
    { kind: "live", testEventCode: "TEST123" },
    { kind: "test" },
    { kind: "test", testEventCode: "../private" },
  ])
    await assert.rejects(
      client(fetcher).purchase(purchase(), mode as MetaDeliveryMode),
      fail("invalid_mode"),
    );
  for (const value of [null, {}, "bad\nsecret", ""]) {
    await assert.rejects(
      client(fetcher, true, async () => value as string).purchase(
        purchase(),
        live,
      ),
      fail("credentials_unavailable"),
    );
  }
  const c = client(fetcher, true, async () => {
    throw Error("private token contents");
  });
  await assert.rejects(
    c.purchase(purchase(), live),
    (e) => fail("credentials_unavailable")(e) && !String(e).includes("private"),
  );
  assert.equal(calls, 0);
});

test("permission/window are rechecked after slow credentials and caller mutation cannot change snapshot", async () => {
  let current = now;
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return accepted();
  };
  const p = purchase();
  await assert.rejects(
    client(
      fetcher,
      true,
      async () => {
        current = new Date(p.permission.expiresAt);
        return token;
      },
      () => current,
    ).purchase(p, live),
    (e) => e instanceof MetaConversionError && e.outcome === "not_sent",
  );
  assert.equal(calls, 0);
  current = now;
  const c = client(
    async (_url, options) => {
      const data = JSON.parse(String(options?.body)).data[0];
      assert.equal(data.custom_data.value, 499);
      assert.equal(data.user_data.em[0], hash("adult@example.test"));
      return accepted();
    },
    true,
    async () => {
      p.amountMinor = 4900;
      p.adultEmailSha256 = hash("changed@example.test");
      return token;
    },
  );
  await c.purchase(p, live);
});

test("HTTP failures never retry or echo provider data, ambiguous responses stay unknown", async () => {
  for (const status of [400, 401, 403, 408, 429, 500, 502]) {
    let calls = 0;
    const c = client(async () => {
      calls++;
      return new Response("private provider message", { status });
    });
    await assert.rejects(
      c.purchase(purchase(), live),
      (e) =>
        fail(
          "provider_rejected",
          status >= 500 || [408, 429].includes(status) ? "unknown" : "rejected",
        )(e) && !String(e).includes("private"),
    );
    assert.equal(calls, 1);
  }
  await assert.rejects(
    client(async () => {
      throw Error("token private");
    }).purchase(purchase(), live),
    fail("transport_or_response_failed", "unknown"),
  );
  for (const payload of [
    { events_received: 0 },
    { events_received: 2 },
    { events_received: "1" },
    { events_received: 1, error: { message: "secret" } },
    { events_received: 1, fbtrace_id: "private@email.test" },
    { events_received: 1, id: "987654321098765" },
    { events_received: 1, num_processed_entries: 0 },
  ])
    await assert.rejects(
      client(async () => Response.json(payload)).purchase(purchase(), live),
      fail("invalid_provider_response", "unknown"),
    );
  await assert.rejects(
    client(async () => new Response("not json")).purchase(purchase(), live),
    fail("transport_or_response_failed", "unknown"),
  );
  await assert.rejects(
    client(async () => new Response("x".repeat(65537))).purchase(
      purchase(),
      live,
    ),
    fail("transport_or_response_failed", "unknown"),
  );
});

test("hung credentials time out without sending", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const c = client(
    async () => {
      calls++;
      return accepted();
    },
    true,
    () => new Promise(() => {}),
  );
  const rejected = assert.rejects(
    c.purchase(purchase(), live),
    fail("credentials_unavailable"),
  );
  await Promise.resolve();
  t.mock.timers.tick(10_001);
  await rejected;
  assert.equal(calls, 0);
});

test("hung HTTP bodies time out unknown and cancel the stream", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let cancelled = false;
  const c = client(
    async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
      ),
  );
  const rejected = assert.rejects(
    c.purchase(purchase(), live),
    fail("transport_or_response_failed", "unknown"),
  );
  // Drain credential and HTTP promise continuations before advancing fake time.
  for (let i = 0; i < 20; i++) await Promise.resolve();
  t.mock.timers.tick(10_001);
  await rejected;
  assert.equal(cancelled, true);
});
