// iap_review_fixes.test.js — focused cases for the four reviewer-confirmed IAP
// verify-purchase correctness fixes (node:test, no live AWS):
//   1. Apple renewal-refund nets against the renewal credit (SK match).
//   2. Apple REVOKE/REFUND no longer extends Plus entitlement.
//   3. Dedupe row is committed AFTER side-effect work (transient post-work
//      failure leaves the event reprocessable).
//   4. Google push is rejected (fail-closed) when OIDC secrets are unset.
//
// The DynamoDB document client is mocked via codes.setDocClient; the Apple JWS
// verify step is swapped via v._setAppleVerifyForTest.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const codes = require("./codes");
const v = require("./verify_purchase");

// ---------------------------------------------------------------------------
// Mock DynamoDB document client (mirrors codes.test.js, plus a failPredicate
// hook so a single put can be made to throw — for the post-work-failure case).
// ---------------------------------------------------------------------------
function makeMockDoc({ failPut } = {}) {
  const store = new Map();
  const key = (it) => `${it.PK}|${it.SK}`;
  const sends = [];
  return {
    store,
    sends,
    async send(cmd) {
      const name = cmd.constructor.name;
      sends.push(name);
      const input = cmd.input;
      if (name === "GetCommand") {
        const it = store.get(`${input.Key.PK}|${input.Key.SK}`);
        return { Item: it ? { ...it } : undefined };
      }
      if (name === "PutCommand") {
        const it = input.Item;
        if (failPut && failPut(it)) {
          throw new Error("simulated DynamoDB put failure");
        }
        const existing = store.get(key(it));
        const cond = input.ConditionExpression || "";
        if (cond.includes("attribute_not_exists(PK)")) {
          if (existing) {
            const e = new Error("conditional failed");
            e.name = "ConditionalCheckFailedException";
            throw e;
          }
        }
        if (cond.includes("attribute_not_exists(SK)")) {
          if (existing) {
            if (cond.includes(":unverified") && existing.status === "unverified") {
              store.set(key(it), { ...it });
              return {};
            }
            const e = new Error("conditional failed");
            e.name = "ConditionalCheckFailedException";
            throw e;
          }
        }
        store.set(key(it), { ...it });
        return {};
      }
      if (name === "QueryCommand") {
        const items = [...store.values()];
        if (input.IndexName === "GSI1") {
          const h = input.ExpressionAttributeValues[":h"];
          return { Items: items.filter((it) => it.GSI1PK === h) };
        }
        const pk = input.ExpressionAttributeValues[":pk"];
        const skPrefix = input.ExpressionAttributeValues[":sk"];
        return {
          Items: items.filter(
            (it) => it.PK === pk && (!skPrefix || String(it.SK).startsWith(skPrefix))
          ),
        };
      }
      throw new Error("unhandled command " + name);
    },
  };
}

function freshDoc(opts) {
  const doc = makeMockDoc(opts);
  codes.setDocClient(doc);
  codes._resetRateLimit();
  return doc;
}

// Sum the price across all LEDGER rows for a partner (credits positive,
// reversals negative). Net == 0 means a refund fully offset its credit.
function ledgerNet(doc, partnerId) {
  let net = 0;
  for (const it of doc.store.values()) {
    if (typeof it.PK === "string" && it.PK.startsWith(`LEDGER#${partnerId}#`)) {
      if (typeof it.price === "number") net += it.price;
    }
  }
  return net;
}

// Build a signed Apple ASSN payload object as the handler expects post-verify:
// { notificationType, notificationUUID, data: { signedTransactionInfo } }.
// signedTransactionInfo is a 3-part JWS where part[1] is base64url(JSON(txn)).
function applePayload({ notificationType, uuid, txn }) {
  const body = Buffer.from(JSON.stringify(txn)).toString("base64url");
  return {
    notificationType,
    notificationUUID: uuid,
    data: { signedTransactionInfo: `h.${body}.s` },
  };
}

// Seed an ATTRIBUTION row so clawback/renewal find the partner.
async function seedAttribution(subjectId, partnerId, code) {
  await codes.putAttribution({
    PK: `SUBJECT#${subjectId}`,
    SK: "ATTRIBUTION",
    GSI1PK: "x",
    GSI1SK: "ATTRIBUTION",
    code: code ?? null,
    partnerId,
    status: "verified",
  });
}

const APPLE_SECRETS = { apple: { bundleId: "com.corpora.corpan", appAppleId: 123, rootCerts: ["x"] } };

// ===========================================================================
// FIX 1 — Apple renewal-refund nets to zero (SK match)
// ===========================================================================

test("FIX1: Apple renewal refund nets against the renewal credit (reverse on txnId)", async () => {
  const doc = freshDoc();
  const subjectId = "subj-renewal";
  const partnerId = "demo";
  await seedAttribution(subjectId, partnerId);

  // The first transaction's id == original id; the renewal has its own txn id.
  const origId = "TXN-ORIGINAL-1";
  const renewalTxnId = "TXN-RENEWAL-2";

  // 1) Renewal credit is keyed on the renewal's OWN txn id.
  await codes.creditRenewal({
    partnerId, subjectId, platform: "apple",
    renewalTxnId, productId: "corpan.sub.monthly", price: 9.99, currency: "USD",
  });
  assert.equal(ledgerNet(doc, partnerId), 9.99, "renewal credit present");

  // 2) Apple sends REFUND for the RENEWAL transaction. Its transactionId is the
  //    renewal's own id; originalTransactionId is the subscription origin.
  v._setAppleVerifyForTest(async () =>
    applePayload({
      notificationType: "REFUND",
      uuid: "uuid-refund-renewal",
      txn: {
        transactionId: renewalTxnId,
        originalTransactionId: origId,
        appAccountToken: subjectId,
        productId: "corpan.sub.monthly",
        price: 9990, // milliunits → 9.99
        currency: "USD",
        environment: "Production",
        expiresDate: Date.now() + 86400000,
      },
    })
  );

  const res = await v.handleAppleNotification({ signedPayload: "p" }, APPLE_SECRETS);
  v._setAppleVerifyForTest(null);

  assert.equal(res.statusCode, 200);
  // The reversal must offset the renewal credit → net 0.
  assert.equal(ledgerNet(doc, partnerId), 0, "renewal refund nets to zero");
  // And the reversal row is keyed on the renewal txn id (not the original).
  assert.ok(
    [...doc.store.values()].some(
      (it) => it.SK === `EVENT#apple#${renewalTxnId}#reversal`
    ),
    "reversal keyed on renewal txn id"
  );
});

test("FIX1: Apple INITIAL-purchase refund still nets (txnId == origId for first txn)", async () => {
  const doc = freshDoc();
  const subjectId = "subj-initial";
  const partnerId = "demo";
  await seedAttribution(subjectId, partnerId);

  // For the first transaction, transactionId === originalTransactionId.
  const origId = "TXN-INITIAL-1";

  // Initial credit is keyed on origId (as attributeFromOffer does).
  await codes.putLedgerEvent({
    PK: `LEDGER#${partnerId}#${codes.yyyymm(new Date().toISOString())}`,
    SK: `EVENT#apple#${origId}`,
    kind: "initial", price: 9.99, currency: "USD",
  });
  assert.equal(ledgerNet(doc, partnerId), 9.99);

  v._setAppleVerifyForTest(async () =>
    applePayload({
      notificationType: "REFUND",
      uuid: "uuid-refund-initial",
      txn: {
        transactionId: origId, // first txn: id == original
        originalTransactionId: origId,
        appAccountToken: subjectId,
        productId: "corpan.sub.monthly",
        price: 9990,
        currency: "USD",
        environment: "Production",
        expiresDate: Date.now() + 86400000,
      },
    })
  );
  await v.handleAppleNotification({ signedPayload: "p" }, APPLE_SECRETS);
  v._setAppleVerifyForTest(null);

  assert.equal(ledgerNet(doc, partnerId), 0, "initial refund still nets to zero");
});

// ===========================================================================
// FIX 2 — Apple REVOKE/REFUND must NOT extend entitlement
// ===========================================================================

test("FIX2: Apple REVOKE does not write/extend a PURCHASE# entitlement row", async () => {
  const doc = freshDoc();
  const subjectId = "subj-revoke";
  await seedAttribution(subjectId, "demo");

  v._setAppleVerifyForTest(async () =>
    applePayload({
      notificationType: "REVOKE",
      uuid: "uuid-revoke",
      txn: {
        transactionId: "TXN-R-1",
        originalTransactionId: "TXN-R-1",
        appAccountToken: subjectId,
        productId: "corpan.sub.monthly",
        environment: "Production",
        expiresDate: Date.now() + 30 * 86400000, // still-future expiry
      },
    })
  );
  const res = await v.handleAppleNotification({ signedPayload: "p" }, APPLE_SECRETS);
  v._setAppleVerifyForTest(null);

  assert.equal(res.statusCode, 200);
  const purchaseRow = doc.store.get(`SUBJECT#${subjectId}|PURCHASE#apple#TXN-R-1`);
  assert.equal(purchaseRow, undefined, "no entitlement PURCHASE# row written on REVOKE");
});

test("FIX2: Apple DID_RENEW (live) DOES extend entitlement (regression guard)", async () => {
  const doc = freshDoc();
  const subjectId = "subj-renew-live";

  v._setAppleVerifyForTest(async () =>
    applePayload({
      notificationType: "DID_RENEW",
      uuid: "uuid-renew-live",
      txn: {
        transactionId: "TXN-LIVE-2",
        originalTransactionId: "TXN-LIVE-1",
        appAccountToken: subjectId,
        productId: "corpan.sub.monthly",
        environment: "Production",
        expiresDate: Date.now() + 30 * 86400000,
      },
    })
  );
  await v.handleAppleNotification({ signedPayload: "p" }, APPLE_SECRETS);
  v._setAppleVerifyForTest(null);

  const purchaseRow = doc.store.get(`SUBJECT#${subjectId}|PURCHASE#apple#TXN-LIVE-2`);
  assert.ok(purchaseRow, "live renewal still extends entitlement");
});

// ===========================================================================
// FIX 3 — Dedupe committed AFTER work; post-work failure stays reprocessable
// ===========================================================================

test("FIX3: a thrown post-work dedupe write leaves the event reprocessable (Apple)", async () => {
  // Make the DEDUPE# put throw — simulating a transient failure AT the mark
  // step, after the entitlement work already succeeded.
  const doc = freshDoc({ failPut: (it) => String(it.PK).startsWith("DEDUPE#") });
  const subjectId = "subj-repro";

  v._setAppleVerifyForTest(async () =>
    applePayload({
      notificationType: "DID_RENEW",
      uuid: "uuid-repro",
      txn: {
        transactionId: "TXN-REPRO-1",
        originalTransactionId: "TXN-REPRO-0",
        appAccountToken: subjectId,
        productId: "corpan.sub.monthly",
        environment: "Production",
        expiresDate: Date.now() + 30 * 86400000,
      },
    })
  );
  const res = await v.handleAppleNotification({ signedPayload: "p" }, APPLE_SECRETS);
  v._setAppleVerifyForTest(null);

  assert.equal(res.statusCode, 200, "still returns 200 to Apple");
  // The dedupe row was NOT committed (the mark threw) → event is reprocessable.
  assert.equal(doc.store.get("DEDUPE#apple#uuid-repro|SEEN"), undefined, "dedupe NOT set");
  // But the side-effect work DID happen.
  assert.ok(doc.store.get(`SUBJECT#${subjectId}|PURCHASE#apple#TXN-REPRO-1`), "work happened");
});

test("FIX3: a successful Apple notification DOES commit the dedupe row + skips replays", async () => {
  const doc = freshDoc();
  const subjectId = "subj-dedupe-ok";
  const mk = () =>
    applePayload({
      notificationType: "DID_RENEW",
      uuid: "uuid-once",
      txn: {
        transactionId: "TXN-ONCE-1",
        originalTransactionId: "TXN-ONCE-0",
        appAccountToken: subjectId,
        productId: "corpan.sub.monthly",
        environment: "Production",
        expiresDate: Date.now() + 30 * 86400000,
      },
    });
  v._setAppleVerifyForTest(async () => mk());

  const r1 = await v.handleAppleNotification({ signedPayload: "p" }, APPLE_SECRETS);
  assert.equal(JSON.parse(r1.body).duplicate, undefined, "first delivery processed");
  assert.ok(doc.store.get("DEDUPE#apple#uuid-once|SEEN"), "dedupe committed after work");

  const r2 = await v.handleAppleNotification({ signedPayload: "p" }, APPLE_SECRETS);
  v._setAppleVerifyForTest(null);
  assert.equal(JSON.parse(r2.body).duplicate, true, "replay short-circuited");
});

// ===========================================================================
// FIX 4 — Google push fail-closed when OIDC secrets are unset
// ===========================================================================

test("FIX4: Google notification rejected (403) when OIDC not configured", async () => {
  const doc = freshDoc();
  // No google.pubsubAudience / pubsubServiceAccount → must reject, not process.
  const secrets = { google: {} };
  const body = {
    message: { data: Buffer.from(JSON.stringify({ testNotification: {} })).toString("base64"), messageId: "m1" },
  };
  const res = await v.handleGoogleNotification(body, secrets, "Bearer whatever");
  assert.equal(res.statusCode, 403, "fail-closed");
  // Body must NOT be processed, and no dedupe id burned.
  assert.equal(doc.store.get("DEDUPE#google#m1|SEEN"), undefined, "no dedupe burned on reject");
});

test("FIX4: Google notification with OIDC configured still runs OIDC validation (401 on bad token)", async () => {
  freshDoc();
  // Audience configured but the bearer token is bogus → verifyPubSubOidc fails
  // → 401 (NOT processed). This proves the reject path is the OIDC check, not
  // the unconfigured short-circuit.
  const secrets = { google: { pubsubAudience: "aud", pubsubServiceAccount: "svc@x.iam" } };
  const body = {
    message: { data: Buffer.from(JSON.stringify({ testNotification: {} })).toString("base64"), messageId: "m2" },
  };
  const res = await v.handleGoogleNotification(body, secrets, "Bearer not-a-real-jwt");
  assert.equal(res.statusCode, 401, "configured-but-invalid token → 401");
});
