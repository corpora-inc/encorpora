// iap_reliability_entitlement.test.js — P1 backend fixes (node:test, no live AWS,
// no real network):
//
//   P1-A: store notification handlers must NOT ACK (200) on a transient failure.
//     (1) a thrown side-effect write → non-2xx (500) AND the event is NOT marked
//         processed (so redelivery reprocesses).
//     (2) Google verifyGoogle returning verified:false (transient Play outage) →
//         non-2xx, NO entitlement/clawback writes, event NOT marked.
//
//   P1-B: /verify-purchase signs premium downloads on ENTITLEMENT to the ZIP, not
//     merely on "verified".
//     (a) verified subscription with subscriptionActive:false → 403, no signedUrl.
//     (b) verified ACTIVE Plus → signedUrl issued (all-access).
//     (c) one-time receipt for product X requesting product Y's ZIP → 403/deny.
//     (d) one-time receipt for product X requesting X's own ZIP → signed.
//
// The DynamoDB doc client is mocked via codes.setDocClient; the Apple JWS verify
// is swapped via v._setAppleVerifyForTest; the catalog fetch is injected via
// v._setCatalogFetchForTest (NO real network).

const { test } = require("node:test");
const assert = require("node:assert/strict");
const codes = require("./codes");
const v = require("./verify_purchase");
const { google } = require("googleapis");

// ---------------------------------------------------------------------------
// Mock DynamoDB doc client (mirrors iap_review_fixes.test.js).
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
        if (failPut && failPut(it)) throw new Error("simulated DynamoDB put failure");
        const existing = store.get(key(it));
        const cond = input.ConditionExpression || "";
        if (cond.includes("attribute_not_exists(PK)") && existing) {
          const e = new Error("conditional failed");
          e.name = "ConditionalCheckFailedException";
          throw e;
        }
        if (cond.includes("attribute_not_exists(SK)") && existing) {
          if (cond.includes(":unverified") && existing.status === "unverified") {
            store.set(key(it), { ...it });
            return {};
          }
          const e = new Error("conditional failed");
          e.name = "ConditionalCheckFailedException";
          throw e;
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

// Count entitlement / ledger writes (any non-DEDUPE PUT into the store).
function countSideEffectRows(doc) {
  let n = 0;
  for (const k of doc.store.keys()) if (!String(k).startsWith("DEDUPE#")) n++;
  return n;
}

const OIDC_SECRETS_BASE = {
  pubsubAudience: "aud",
  pubsubServiceAccount: "svc@x.iam",
};

// Build a base64 Pub/Sub message body from a decoded RTDN object.
function pubsubBody(decoded, messageId) {
  return {
    message: {
      data: Buffer.from(JSON.stringify(decoded)).toString("base64"),
      messageId,
    },
  };
}

// Swap google.androidpublisher with a fake; returns a restore fn.
function withFakeAndroidPublisher(impl) {
  const orig = google.androidpublisher;
  google.androidpublisher = impl;
  return () => { google.androidpublisher = orig; };
}

// Stub verifyPubSubOidc by configuring secrets + supplying a token; but the real
// OIDC verify would reject a fake token. Instead we stub google.auth.OAuth2's
// verifyIdToken so the handler's OIDC check passes (so we can reach the body).
function withOidcPass(restoreList) {
  const origOAuth2 = google.auth.OAuth2;
  google.auth.OAuth2 = function () {
    return {
      verifyIdToken: async () => ({
        getPayload: () => ({ email: "svc@x.iam", email_verified: true }),
      }),
    };
  };
  restoreList.push(() => { google.auth.OAuth2 = origOAuth2; });
}

// ===========================================================================
// P1-A (1) — thrown side-effect write → non-2xx + event NOT marked (Google)
// ===========================================================================

test("P1-A(1): Google handler returns 500 (not 200) on a thrown side-effect write; event NOT marked", async () => {
  // Make the post-work DEDUPE# mark put throw (markEventProcessed is the write
  // that propagates to the handler — recordEntitlementPurchase/creditRenewal/
  // reverseCredit each swallow internally), after a successful authoritative
  // verify + entitlement work. The handler must NOT ACK (200) and must NOT mark
  // the dedupe row → Pub/Sub redelivers and reprocesses.
  const doc = freshDoc({ failPut: (it) => String(it.PK).startsWith("DEDUPE#") });
  const restores = [];
  withOidcPass(restores);
  const restorePub = withFakeAndroidPublisher(() => ({
    purchases: {
      subscriptionsv2: {
        get: async () => ({
          data: {
            subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
            lineItems: [{
              productId: "corpan.sub.monthly",
              expiryTime: new Date(Date.now() + 30 * 86400000).toISOString(),
              latestSuccessfulOrderId: "ORDER-1",
            }],
            externalAccountIdentifiers: { obfuscatedExternalAccountId: "obf-x" },
            acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
          },
        }),
      },
    },
  }));
  // Seed a subject so recordEntitlementPurchase is attempted (needs subjectId).
  await codes.putAttribution({
    PK: "SUBJECT#subj-a1", SK: "ATTRIBUTION", GSI1PK: "obf-x", GSI1SK: "ATTRIBUTION",
    code: null, partnerId: "demo", status: "verified", subjectId: "subj-a1",
  });

  try {
    const secrets = {
      google: { ...OIDC_SECRETS_BASE, serviceAccountJson: { client_email: "x@y", private_key: "k", project_id: "p" } },
    };
    const decoded = {
      packageName: "com.corpora.corpan",
      subscriptionNotification: { notificationType: 2, purchaseToken: "T1", subscriptionId: "corpan.sub.monthly" },
    };
    const res = await v.handleGoogleNotification(pubsubBody(decoded, "msg-a1"), secrets, "Bearer tok");
    assert.equal(res.statusCode, 500, "non-2xx so Pub/Sub redelivers");
    assert.equal(doc.store.get("DEDUPE#google#msg-a1|SEEN"), undefined, "event NOT marked processed");
    // The side-effect work DID happen (entitlement extended) — redelivery is
    // safe because all writes are idempotent conditional puts.
    assert.ok(doc.store.get("SUBJECT#subj-a1|PURCHASE#android#ORDER-1"), "entitlement work happened");
  } finally {
    restorePub();
    restores.forEach((r) => r());
  }
});

// ===========================================================================
// P1-A (2) — Google verifyGoogle returns verified:false → non-2xx, no work,
// event NOT marked.
// ===========================================================================

test("P1-A(2): Google verifyGoogle unverified (transient Play outage) → 500, no writes, NOT marked", async () => {
  const doc = freshDoc();
  const restores = [];
  withOidcPass(restores);
  // androidpublisher throws → verifyGoogle catches → { verified:false }.
  const restorePub = withFakeAndroidPublisher(() => ({
    purchases: {
      subscriptionsv2: { get: async () => { throw new Error("Play API 503"); } },
    },
  }));
  try {
    const secrets = {
      google: { ...OIDC_SECRETS_BASE, serviceAccountJson: { client_email: "x@y", private_key: "k", project_id: "p" } },
    };
    const decoded = {
      packageName: "com.corpora.corpan",
      subscriptionNotification: { notificationType: 4, purchaseToken: "T2", subscriptionId: "corpan.sub.monthly" },
    };
    const res = await v.handleGoogleNotification(pubsubBody(decoded, "msg-a2"), secrets, "Bearer tok");
    assert.equal(res.statusCode, 500, "unverified re-fetch → retryable non-2xx");
    assert.equal(countSideEffectRows(doc), 0, "no entitlement/clawback writes on unverified");
    assert.equal(doc.store.get("DEDUPE#google#msg-a2|SEEN"), undefined, "event NOT marked");
  } finally {
    restorePub();
    restores.forEach((r) => r());
  }
});

test("P1-A(2b): Google voided re-fetch unverified → 500, no reversal, NOT marked", async () => {
  const doc = freshDoc();
  const restores = [];
  withOidcPass(restores);
  const restorePub = withFakeAndroidPublisher(() => ({
    purchases: {
      subscriptionsv2: { get: async () => { throw new Error("Play API 503"); } },
    },
  }));
  try {
    const secrets = {
      google: { ...OIDC_SECRETS_BASE, serviceAccountJson: { client_email: "x@y", private_key: "k", project_id: "p" } },
    };
    const decoded = {
      packageName: "com.corpora.corpan",
      voidedPurchaseNotification: { purchaseToken: "TV", orderId: "ORD-V", subscriptionId: "corpan.sub.monthly", refundType: 1 },
    };
    const res = await v.handleGoogleNotification(pubsubBody(decoded, "msg-a2b"), secrets, "Bearer tok");
    assert.equal(res.statusCode, 500, "voided unverified re-fetch → retryable non-2xx");
    assert.equal(countSideEffectRows(doc), 0, "no reversal writes on unverified");
    assert.equal(doc.store.get("DEDUPE#google#msg-a2b|SEEN"), undefined, "event NOT marked");
  } finally {
    restorePub();
    restores.forEach((r) => r());
  }
});

// ===========================================================================
// P1-B — signed download gated on entitlement to THAT ZIP.
// ===========================================================================

// A fixture catalog with two premium narrations bound to two distinct one-time
// products. Injected so no real network call happens.
const FIXTURE_CATALOG = {
  narrations: [
    {
      id: "pack-X",
      purchase: { type: "iap", productId: "corpan.book.X" },
      full: { url: "https://cdn.example.com/narrations/premium/pack-X-1.0.0.zip" },
    },
    {
      id: "pack-Y",
      purchase: { type: "iap", productId: "corpan.book.Y" },
      full: { url: "https://cdn.example.com/narrations/premium/pack-Y-1.0.0.zip" },
    },
  ],
};

const CF_SECRETS = {
  cloudfront: { signingPrivateKey: TEST_PEM() },
};

// A throwaway RSA-ish PEM isn't needed: generateSignedDownloadUrl only runs when
// CLOUDFRONT_DOMAIN + KEY_PAIR_ID env are set. We set them + a valid test key so
// signing succeeds (the cloudfront-signer needs a real RSA private key).
function TEST_PEM() {
  const { generateKeyPairSync } = require("node:crypto");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs1", format: "pem" }).toString();
}

function withCfEnv(fn) {
  const prev = { d: process.env.CLOUDFRONT_DOMAIN, k: process.env.CLOUDFRONT_KEY_PAIR_ID };
  process.env.CLOUDFRONT_DOMAIN = "cdn.example.com";
  process.env.CLOUDFRONT_KEY_PAIR_ID = "K123";
  return fn().finally(() => {
    if (prev.d === undefined) delete process.env.CLOUDFRONT_DOMAIN; else process.env.CLOUDFRONT_DOMAIN = prev.d;
    if (prev.k === undefined) delete process.env.CLOUDFRONT_KEY_PAIR_ID; else process.env.CLOUDFRONT_KEY_PAIR_ID = prev.k;
  });
}

// --- (a) verified subscription, subscriptionActive:false → 403, no signedUrl ---
test("P1-B(a): verified sub but inactive (expired) → 403, no signedUrl", async () => {
  freshDoc();
  const restorePub = withFakeAndroidPublisher(() => ({
    purchases: {
      subscriptionsv2: {
        get: async () => ({
          data: {
            subscriptionState: "SUBSCRIPTION_STATE_EXPIRED",
            lineItems: [{
              productId: "corpan.sub.monthly",
              expiryTime: new Date(Date.now() - 86400000).toISOString(), // expired
              latestSuccessfulOrderId: "ORDER-EXP",
            }],
            externalAccountIdentifiers: { obfuscatedExternalAccountId: "obf-e" },
            acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
          },
        }),
      },
    },
  }));
  try {
    const secrets = {
      ...CF_SECRETS,
      google: { serviceAccountJson: { client_email: "x@y", private_key: "k", project_id: "p" }, packageName: "com.corpora.corpan" },
    };
    const res = await withCfEnv(() => v.handleVerifyPurchase({
      platform: "android",
      productId: "corpan.plus",
      productType: "subs",
      packId: "pack-X",
      downloadPath: "narrations/premium/pack-X-1.0.0.zip",
      purchaseToken: "TOK",
    }, secrets));
    assert.equal(res.statusCode, 403, "inactive sub denied");
    assert.equal(JSON.parse(res.body).signedUrl, undefined, "no signedUrl");
  } finally {
    restorePub();
  }
});

// --- (b) verified ACTIVE Plus → signedUrl issued (all-access) ---
test("P1-B(b): verified active Plus → signedUrl issued for any premium ZIP", async () => {
  freshDoc();
  const restorePub = withFakeAndroidPublisher(() => ({
    purchases: {
      subscriptionsv2: {
        get: async () => ({
          data: {
            subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
            lineItems: [{
              productId: "corpan.sub.annual",
              expiryTime: new Date(Date.now() + 30 * 86400000).toISOString(),
              latestSuccessfulOrderId: "ORDER-ACT",
            }],
            externalAccountIdentifiers: { obfuscatedExternalAccountId: "obf-a" },
            acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
          },
        }),
      },
    },
  }));
  try {
    const secrets = {
      ...CF_SECRETS,
      google: { serviceAccountJson: { client_email: "x@y", private_key: "k", project_id: "p" }, packageName: "com.corpora.corpan" },
    };
    const res = await withCfEnv(() => v.handleVerifyPurchase({
      platform: "android",
      productId: "corpan.plus",
      productType: "subs",
      packId: "pack-Y",
      downloadPath: "narrations/premium/pack-Y-1.0.0.zip",
      purchaseToken: "TOK",
    }, secrets));
    assert.equal(res.statusCode, 200);
    assert.ok(JSON.parse(res.body).signedUrl, "active Plus gets a signed URL");
  } finally {
    restorePub();
  }
});

// Inject a verifyApple that returns a verified one-time receipt for `productId`.
function appleVerifiesAs(productId) {
  v._setVerifyForTest({
    apple: async (b) => ({
      verified: true,
      transactionId: b.transactionId || "TXN",
      originalTransactionId: b.transactionId || "TXN",
      productId,
      isSubscription: false,
      subscriptionActive: false,
      environment: "Production",
    }),
  });
}

// --- (c) one-time receipt for X requesting Y's ZIP → 403 deny ---
test("P1-B(c): one-time receipt for product X requesting product Y's ZIP → 403", async () => {
  freshDoc();
  v._setCatalogFetchForTest(async () => FIXTURE_CATALOG);
  // Apple receipt verifies as product X.
  appleVerifiesAs("corpan.book.X");
  try {
    const secrets = { ...CF_SECRETS, apple: { key_id: "k", issuer_id: "i", privateKey: "p", bundleId: "com.corpora.corpan" } };
    const res = await withCfEnv(() => v.handleVerifyPurchase({
      platform: "ios",
      productId: "corpan.book.X",
      productType: "inapp",
      transactionId: "TXN-X",
      packId: "pack-Y", // requesting a DIFFERENT pack
      downloadPath: "narrations/premium/pack-Y-1.0.0.zip",
      receipt: "r",
    }, secrets));
    assert.equal(res.statusCode, 403, "cross-product download denied");
    assert.equal(JSON.parse(res.body).signedUrl, undefined, "no signedUrl");
  } finally {
    v._setCatalogFetchForTest(null);
    v._setVerifyForTest({});
  }
});

// --- (d) one-time receipt for X requesting X's own ZIP → signed ---
test("P1-B(d): one-time receipt for product X requesting X's own ZIP → signed", async () => {
  freshDoc();
  v._setCatalogFetchForTest(async () => FIXTURE_CATALOG);
  appleVerifiesAs("corpan.book.X");
  try {
    const secrets = { ...CF_SECRETS, apple: { key_id: "k", issuer_id: "i", privateKey: "p", bundleId: "com.corpora.corpan" } };
    const res = await withCfEnv(() => v.handleVerifyPurchase({
      platform: "ios",
      productId: "corpan.book.X",
      productType: "inapp",
      transactionId: "TXN-X",
      packId: "pack-X",
      downloadPath: "narrations/premium/pack-X-1.0.0.zip",
      receipt: "r",
    }, secrets));
    assert.equal(res.statusCode, 200);
    assert.ok(JSON.parse(res.body).signedUrl, "owner of X gets X's signed URL");
  } finally {
    v._setCatalogFetchForTest(null);
    v._setVerifyForTest({});
  }
});

test("P1-B(e): one-time download denied when catalog unavailable (fail closed)", async () => {
  freshDoc();
  v._setCatalogFetchForTest(async () => { throw new Error("catalog 503"); });
  appleVerifiesAs("corpan.book.X");
  try {
    const secrets = { ...CF_SECRETS, apple: { key_id: "k", issuer_id: "i", privateKey: "p", bundleId: "com.corpora.corpan" } };
    const res = await withCfEnv(() => v.handleVerifyPurchase({
      platform: "ios",
      productId: "corpan.book.X",
      productType: "inapp",
      transactionId: "TXN-X",
      packId: "pack-X",
      downloadPath: "narrations/premium/pack-X-1.0.0.zip",
      receipt: "r",
    }, secrets));
    assert.equal(res.statusCode, 403, "fail closed when catalog cannot be fetched");
  } finally {
    v._setCatalogFetchForTest(null);
    v._setVerifyForTest({});
  }
});
