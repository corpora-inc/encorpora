import assert from "node:assert/strict";
import test from "node:test";
import {
  GoogleConversionError,
  GoogleDataManager,
  googleAdultEmailHash,
  googlePurchaseRequest,
  googleRestatementRequest,
  type GooglePurchase,
  type GoogleIngestionReceipt,
} from "../src/advertising/google-data-manager.js";

const config = {
  conversionCustomerId: "1234567890",
  loginCustomerId: "2345678901",
  conversionActionId: "987654321",
};
const now = new Date("2026-10-21T12:00:00.000Z");
const purchase: GooglePurchase = {
  transactionId: `amp_${"1".repeat(64)}`,
  occurredAt: "2026-10-21T11:00:00.000Z",
  amountMinor: 49900,
  currency: "USD",
  adultEmailSha256: "2".repeat(64),
  permission: {
    adultAttested: true,
    adUserData: true,
    adPersonalization: false,
    grantedAt: "2026-10-20T00:00:00.000Z",
    expiresAt: "2026-11-20T00:00:00.000Z",
  },
};
function harness(responses: Array<Response | Error>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let tokenCalls = 0;
  const client = new GoogleDataManager(
    config,
    async () => {
      tokenCalls++;
      return "fixture-access-token";
    },
    async (url, init) => {
      calls.push({ url: String(url), init: init! });
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      if (response instanceof Error) throw response;
      return response;
    },
  );
  return { client, calls, tokenCalls: () => tokenCalls };
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const fail = (code: string, outcome?: string) => (error: unknown) => {
  assert.ok(error instanceof GoogleConversionError);
  assert.equal(error.code, code);
  if (outcome) assert.equal(error.outcome, outcome);
  assert.doesNotMatch(
    JSON.stringify(error) + error.message,
    /fixture-access|private|@|child-name/,
  );
  return true;
};

test("Google email hashing follows published formatting examples", () => {
  assert.equal(
    googleAdultEmailHash(" John.Smith@EXAMPLE.COM "),
    "8e621e3d0368631d263d07a351fa8d34fba0d17c15fbcdec11a5f58008d022a0",
  );
  assert.equal(
    googleAdultEmailHash(" C.l.o.u.d.y.SanFrancisco+shopping@GMAIL.com "),
    googleAdultEmailHash("cloudysanfrancisco@gmail.com"),
  );
  assert.equal(
    googleAdultEmailHash(" Jo hn.Smith@EXAMPLE.COM "),
    googleAdultEmailHash("John.Smith@example.com"),
  );
  assert.notEqual(
    googleAdultEmailHash("user.name+nyc@example.com"),
    googleAdultEmailHash("username@example.com"),
  );
  assert.notEqual(
    googleAdultEmailHash("test@gmail.com"),
    googleAdultEmailHash("test@googlemail.com"),
  );
  for (const bad of [
    "child-name",
    "test@@example.com",
    "@example.com",
    "bad\u0000@example.com",
  ])
    assert.throws(
      () => googleAdultEmailHash(bad),
      fail("invalid_email", "not_sent"),
    );
});

test("wire payload uses Data Manager fields, one destination, exact USD cents and denied personalization", () => {
  assert.deepEqual(googlePurchaseRequest(config, purchase, undefined, now), {
    destinations: [
      {
        operatingAccount: {
          accountType: "GOOGLE_ADS",
          accountId: "1234567890",
        },
        loginAccount: { accountType: "GOOGLE_ADS", accountId: "2345678901" },
        productDestinationId: "987654321",
      },
    ],
    encoding: "HEX",
    validateOnly: true,
    events: [
      {
        transactionId: purchase.transactionId,
        eventTimestamp: purchase.occurredAt,
        eventSource: "WEB",
        conversionValue: 499,
        currency: "USD",
        userData: { userIdentifiers: [{ emailAddress: "2".repeat(64) }] },
        consent: {
          adUserData: "CONSENT_GRANTED",
          adPersonalization: "CONSENT_DENIED",
        },
      },
    ],
  });
  assert.equal(
    googlePurchaseRequest(
      config,
      { ...purchase, amountMinor: 12345 },
      "ingest",
      now,
    ).events[0]!.conversionValue,
    123.45,
  );
  const direct = googlePurchaseRequest(
    {
      conversionCustomerId: config.conversionCustomerId,
      conversionActionId: config.conversionActionId,
    },
    purchase,
    "validate",
    now,
  );
  assert.equal("loginAccount" in direct.destinations[0]!, false);
});

test("untrusted extra fields, raw identity, arbitrary identifiers and unsupported values never reach credentials or network", async () => {
  const h = harness([]);
  for (const patch of [
    { learnerId: "child-name" },
    { email: "private@example.test" },
    { gclid: "private" },
    { assessment: { score: 90 } },
    { eventSourceUrl: "https://example.test/child-name" },
    { transactionId: "parent@example.test" },
    { adultEmailSha256: "private@example.test" },
    { amountMinor: 0 },
    { amountMinor: -1 },
    { amountMinor: 1.25 },
    { amountMinor: NaN },
    { amountMinor: 100000001 },
    { currency: "EUR" },
    { occurredAt: "2026-02-30T00:00:00.000Z" },
  ])
    await assert.rejects(
      h.client.purchase(
        { ...purchase, ...patch } as GooglePurchase,
        "ingest",
        now,
      ),
      fail("invalid_purchase", "not_sent"),
    );
  for (const patch of [
    { adultAttested: false },
    { adUserData: false },
    { adPersonalization: true },
    { revokedAt: now.toISOString() },
  ])
    await assert.rejects(
      h.client.purchase(
        {
          ...purchase,
          permission: { ...purchase.permission, ...patch },
        } as GooglePurchase,
        "ingest",
        now,
      ),
      fail("invalid_purchase", "not_sent"),
    );
  assert.equal(h.tokenCalls(), 0);
  assert.equal(h.calls.length, 0);
});

test("future/old events, post-purchase permission and expired permission cannot be delivered", async () => {
  const h = harness([]);
  for (const occurredAt of [
    "2026-10-21T12:00:00.001Z",
    "2026-01-01T00:00:00.000Z",
  ])
    await assert.rejects(
      h.client.purchase({ ...purchase, occurredAt }, "ingest", now),
      fail("event_outside_delivery_window"),
    );
  for (const patch of [
    { grantedAt: "2026-10-21T11:00:00.001Z" },
    { expiresAt: now.toISOString() },
    { expiresAt: purchase.permission.grantedAt },
  ])
    await assert.rejects(
      h.client.purchase(
        { ...purchase, permission: { ...purchase.permission, ...patch } },
        "ingest",
        now,
      ),
      fail("permission_not_current"),
    );
  assert.equal(h.calls.length, 0);
});

test("validation is the default and successful HTTP acceptance is distinct from processing", async () => {
  const h = harness([
    json({}),
    json({
      requestId: "request-123",
      fieldWarnings: [{ description: "private raw value" }],
    }),
  ]);
  assert.deepEqual(await h.client.purchase(purchase, undefined, now), {
    kind: "validated",
    fieldWarningCount: 0,
  });
  const accepted = await h.client.purchase(purchase, "ingest", now);
  assert.deepEqual(accepted, {
    kind: "accepted",
    requestId: "request-123",
    destinationFingerprint: h.client.destinationFingerprint,
    submittedRecords: 1,
    fieldWarningCount: 1,
  });
  assert.equal(h.calls.length, 2);
  for (const { url, init } of h.calls) {
    assert.equal(url, "https://datamanager.googleapis.com/v1/events:ingest");
    assert.equal(init.redirect, "error");
    assert.equal(init.credentials, "omit");
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal);
    assert.equal(
      new Headers(init.headers).get("Authorization"),
      "Bearer fixture-access-token",
    );
    assert.doesNotMatch(url, /fixture-access/);
  }
  assert.equal(JSON.parse(h.calls[0]!.init.body as string).validateOnly, true);
  assert.equal(JSON.parse(h.calls[1]!.init.body as string).validateOnly, false);
});

test("network errors and ambiguous provider replies are sanitized and never automatically retried", async () => {
  for (const [response, code, outcome] of [
    [
      new Error("private@example.test fixture-access-token"),
      "transport_failed",
      "unknown",
    ],
    [
      json({ error: "private@example.test" }, 400),
      "provider_rejected",
      "rejected",
    ],
    [
      json({ error: "private@example.test" }, 503),
      "provider_rejected",
      "unknown",
    ],
    [
      new Response("private@example.test"),
      "invalid_provider_response",
      "unknown",
    ],
    [json({}), "invalid_provider_response", "unknown"],
    [
      json({ requestId: "private@example.test" }),
      "invalid_provider_response",
      "unknown",
    ],
    [new Response("a".repeat(65537)), "invalid_provider_response", "unknown"],
  ] as const) {
    const h = harness([response]);
    await assert.rejects(
      h.client.purchase(purchase, "ingest", now),
      fail(code, outcome),
    );
    assert.equal(h.calls.length, 1);
  }
});

test("credential failures cannot expose their cause or make an HTTP request", async () => {
  let sent = false;
  const client = new GoogleDataManager(
    config,
    async () => {
      throw new Error("private@example.test fixture-access-token");
    },
    async () => {
      sent = true;
      throw new Error();
    },
  );
  await assert.rejects(
    client.purchase(purchase, "ingest", now),
    fail("credentials_unavailable", "not_sent"),
  );
  assert.equal(sent, false);
});

function diagnostic(
  status: string,
  count?: string,
  extra: Record<string, unknown> = {},
) {
  return {
    requestStatusPerDestination: [
      {
        destination: googlePurchaseRequest(config, purchase, "validate", now)
          .destinations[0],
        requestStatus: status,
        ...(count ? { eventsIngestionStatus: { recordCount: count } } : {}),
        ...extra,
      },
    ],
  };
}
function receipt(client: GoogleDataManager): GoogleIngestionReceipt {
  return {
    kind: "accepted",
    requestId: "request+with/slash=",
    destinationFingerprint: client.destinationFingerprint,
    submittedRecords: 1,
    fieldWarningCount: 0,
  };
}
test("diagnostics bind to the accepted destination, preserve warnings and distinguish processing from completion", async () => {
  const h = harness([
    json(diagnostic("PROCESSING")),
    json(
      diagnostic("SUCCESS", "1", {
        warningInfo: {
          warningCounts: [
            {
              reason: "PROCESSING_WARNING_REASON_UNSPECIFIED",
              recordCount: "1",
            },
          ],
        },
      }),
    ),
    json(
      diagnostic("FAILED", "1", {
        errorInfo: {
          errorCounts: [
            { reason: "PROCESSING_ERROR_REASON_UNSPECIFIED", recordCount: "1" },
          ],
        },
      }),
    ),
  ]);
  const r = receipt(h.client);
  assert.deepEqual(await h.client.status(r), {
    status: "PROCESSING",
    recordCount: null,
    errors: [],
    warnings: [],
    fieldWarningCount: 0,
  });
  assert.deepEqual((await h.client.status(r)).warnings, [
    { reason: "PROCESSING_WARNING_REASON_UNSPECIFIED", recordCount: "1" },
  ]);
  assert.equal((await h.client.status(r)).status, "FAILED");
  assert.equal(
    h.calls[0]!.url,
    "https://datamanager.googleapis.com/v1/requestStatus:retrieve?requestId=request%2Bwith%2Fslash%3D",
  );
  assert.equal(h.calls[0]!.init.method, "GET");
  assert.equal(h.calls[0]!.init.body, undefined);
});
test("wrong destinations, empty/extra results, wrong counts and unsafe diagnostics cannot certify completion", async () => {
  const wrong = diagnostic("SUCCESS", "1");
  wrong.requestStatusPerDestination[0]!.destination = {
    ...wrong.requestStatusPerDestination[0]!.destination!,
    productDestinationId: "9999",
  };
  for (const [payload, code] of [
    [wrong, "diagnostic_destination_mismatch"],
    [diagnostic("SUCCESS", "2"), "diagnostic_record_count_mismatch"],
    [diagnostic("SUCCESS"), "diagnostic_record_count_mismatch"],
    [{ requestStatusPerDestination: [] }, "invalid_diagnostics"],
    [
      {
        requestStatusPerDestination: [
          ...diagnostic("SUCCESS", "1").requestStatusPerDestination,
          ...diagnostic("SUCCESS", "1").requestStatusPerDestination,
        ],
      },
      "invalid_diagnostics",
    ],
    [
      diagnostic("SUCCESS", "1", {
        warningInfo: {
          warningCounts: [{ reason: "private@example.test", recordCount: "1" }],
        },
      }),
      "invalid_diagnostics",
    ],
  ] as const) {
    const h = harness([json(payload)]);
    await assert.rejects(
      h.client.status(receipt(h.client)),
      fail(code, "unknown"),
    );
  }
  const h = harness([]);
  await assert.rejects(
    h.client.status({ ...receipt(h.client), destinationFingerprint: "other" }),
    fail("invalid_receipt", "not_sent"),
  );
  assert.equal(h.calls.length, 0);
});

test("validation cannot disguise an error-shaped 200 response as success", async () => {
  const h = harness([json({ error: { message: "private@example.test" } })]);
  await assert.rejects(
    h.client.purchase(purchase, "validate", now),
    fail("invalid_provider_response", "unknown"),
  );
});

test("zero is restricted to explicit restatement with original event identity and permission checks", () => {
  const zero = { ...purchase, amountMinor: 0 };
  assert.throws(() => googlePurchaseRequest(config, zero, "ingest", now));
  const event = googleRestatementRequest(config, zero, "ingest", now)
    .events[0]!;
  assert.equal(event.conversionValue, 0);
  assert.equal(event.transactionId, purchase.transactionId);
  assert.deepEqual(
    event.userData,
    googlePurchaseRequest(config, purchase, "ingest", now).events[0]!.userData,
  );
  assert.throws(() =>
    googleRestatementRequest(
      config,
      { ...zero, amountMinor: -1 },
      "ingest",
      now,
    ),
  );
  assert.throws(() =>
    googleRestatementRequest(
      config,
      {
        ...zero,
        permission: {
          ...zero.permission,
          expiresAt: zero.permission.grantedAt,
        },
      },
      "ingest",
      now,
    ),
  );
});
