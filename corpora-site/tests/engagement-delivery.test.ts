import assert from "node:assert/strict";
import test from "node:test";
import { createMarketingDelivery } from "../src/engagement-delivery.js";
const payload = JSON.stringify({
  visitorId: "visitor",
  context: { referrer: "direct", device: "phone" },
  traffic: "external",
  events: [
    {
      id: "envelope",
      sessionId: "document",
      at: 42,
      event: "site_action",
      props: {
        eventId: "action",
        action: "invoice_open",
        screen: "marketing_az",
      },
    },
    {
      id: "envelope-two",
      sessionId: "document",
      at: 43,
      event: "page_engagement",
      props: {
        pageId: "page",
        sessionId: "document",
        screen: "marketing_az",
        ordinal: 0,
        visibleMs: 1000,
        activeMs: 1000,
      },
    },
  ],
});
test("an older collector gets one compatible retry without losing idempotency or context", async () => {
  const requests: RequestInit[] = [];
  const deliver = createMarketingDelivery((async (_url, options) => {
    requests.push(options!);
    return new Response(null, { status: requests.length === 1 ? 400 : 202 });
  }) as typeof fetch);
  assert.equal((await deliver("/site-events", payload)).status, 202);
  assert.equal(requests.length, 2);
  const old = JSON.parse(requests[1].body as string);
  assert.equal(old.events[0].id, undefined);
  assert.equal(old.events[0].sessionId, undefined);
  assert.equal(old.events[0].props.eventId, "action");
  assert.equal(old.events[1].props.pageId, "page");
  assert.equal(old.events[1].props.sessionId, "document");
  assert.equal(old.events[0].at, 42);
  assert.deepEqual(old.context, JSON.parse(payload).context);
  await deliver("/site-events", payload);
  assert.equal(requests.length, 3);
  assert.deepEqual(JSON.parse(requests[2].body as string), old);
  assert.equal(requests[2].keepalive, true);
  assert.equal(requests[2].credentials, "omit");
});
test("a current collector gets one request and transient failures retain the new format", async () => {
  for (const status of [202, 429, 503]) {
    const requests: RequestInit[] = [];
    const deliver = createMarketingDelivery((async (_url, options) => {
      requests.push(options!);
      return new Response(null, { status });
    }) as typeof fetch);
    assert.equal((await deliver("/site-events", payload)).status, status);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body, payload);
  }
});
test("validation errors have at most one compatibility retry", async () => {
  let calls = 0;
  const deliver = createMarketingDelivery((async () => {
    calls++;
    return new Response(null, { status: 400 });
  }) as typeof fetch);
  assert.equal((await deliver("/site-events", payload)).status, 400);
  assert.equal(calls, 2);
});

test("concurrent rejected new-format batches each receive their own compatible retry", async () => {
  const resolve: ((response: Response) => void)[] = [];
  const requests: RequestInit[] = [];
  const deliver = createMarketingDelivery((async (_url, options) => {
    requests.push(options!);
    return requests.length <= 2
      ? new Promise<Response>((done) => resolve.push(done))
      : new Response(null, { status: 202 });
  }) as typeof fetch);
  const a = deliver("/site-events", payload),
    b = deliver("/site-events", payload);
  resolve[0](new Response(null, { status: 400 }));
  await a;
  resolve[1](new Response(null, { status: 400 }));
  await b;
  assert.equal(requests.length, 4);
  for (const request of requests.slice(2))
    assert.equal(JSON.parse(request.body as string).events[0].id, undefined);
});
