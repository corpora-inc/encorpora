const test = require("node:test");
const assert = require("node:assert/strict");
const { IapStore } = require("../store");
const { FakeDdb } = require("./fakeDdb");
const {
  resolveCode,
  recordPurchaseAttribution,
  creditRenewal,
  issueEntitlementToken,
} = require("../attribution");
const { signResolutionToken } = require("../tokens");
const { CODES, PARTNERS, LCCLT } = require("../registry_seed");
const {
  extractAppleFields,
  extractGoogleV2Fields,
} = require("../receipts");
const {
  appleInitialWithOffer,
  appleRenewalNoOffer,
  googleV2WithOffer,
  SUBJECT_ID,
  OBF_ACCOUNT_ID,
} = require("./fixtures");

const SECRET = "test-secret";

async function seededStore() {
  const store = new IapStore(new FakeDdb(), "t");
  for (const [code, body] of Object.entries(CODES)) {
    await store.putCodeEntry(code, body);
  }
  for (const [pid, body] of Object.entries(PARTNERS)) {
    await store.client.putItem({ TableName: "t", Item: { PK: `PARTNER#${pid}`, SK: "META", ...body } });
  }
  return store;
}

// --- /code/resolve --------------------------------------------------------

test("resolveCode: LCCLT on iOS → affiliate+offer + apple_offer_code + token", async () => {
  const store = await seededStore();
  const out = await resolveCode(store, SECRET, { code: "lcclt", subjectId: "s1", platform: "ios" });
  assert.equal(out.status, "ok");
  assert.equal(out.code, "LCCLT");
  assert.equal(out.kind, "affiliate+offer");
  assert.equal(out.purchaseAction.type, "apple_offer_code");
  assert.equal(out.partnerName, "Language Learning Club");
  assert.equal(out.discountLabel, "50% off first year");
  assert.ok(out.resolutionToken);
  assert.equal(out.expiresInSec, 300);
});

test("resolveCode: unknown code → affiliate/normal/unverified (still issues token)", async () => {
  const store = await seededStore();
  const out = await resolveCode(store, SECRET, { code: "WHATEVER", subjectId: "s1", platform: "android" });
  assert.equal(out.status, "ok");
  assert.equal(out.kind, "affiliate");
  assert.equal(out.verified, false);
  assert.equal(out.purchaseAction.type, "normal");
  assert.ok(out.resolutionToken);
});

test("resolveCode: blank/invalid format → invalid, no token", async () => {
  const store = await seededStore();
  assert.equal((await resolveCode(store, SECRET, { code: "", subjectId: "s1" })).status, "invalid");
  // normalize strips whitespace, so use a genuinely illegal char
  assert.equal((await resolveCode(store, SECRET, { code: "bad!char", subjectId: "s1" })).status, "invalid");
});

test("resolveCode: missing subjectId → invalid", async () => {
  const store = await seededStore();
  const out = await resolveCode(store, SECRET, { code: "LCCLT", platform: "ios" });
  assert.equal(out.status, "invalid");
});

test("resolveCode: NO FAIL-OPEN — store error throws (caller maps to error)", async () => {
  const broken = new IapStore({ getItem: async () => { throw new Error("ddb down"); } }, "t");
  await assert.rejects(
    () => resolveCode(broken, SECRET, { code: "LCCLT", subjectId: "s1", platform: "ios" }),
    /ddb down/
  );
});

// --- verify-purchase attribution write ------------------------------------

function appleCtx(overrides = {}) {
  const fields = extractAppleFields(appleInitialWithOffer);
  const token = signResolutionToken(SECRET, {
    code: "LCCLT",
    subjectId: SUBJECT_ID,
    kind: "affiliate+offer",
    registryVersion: 1,
  });
  return {
    subjectId: SUBJECT_ID,
    platform: "ios",
    affiliateCode: "LCCLT",
    resolutionToken: token,
    receiptFields: fields,
    registryEntry: LCCLT,
    offerApplied: true,
    ...overrides,
  };
}

test("recordPurchaseAttribution: verified LCCLT → locks, credits ledger once", async () => {
  const store = await seededStore();
  const attr = await recordPurchaseAttribution(store, SECRET, appleCtx());
  assert.equal(attr.verified, true);
  assert.equal(attr.partnerId, "language-learning-club");
  assert.equal(attr.locked, true);
  assert.equal(attr.discountApplied, true);
  assert.ok(attr.ledgerEventId);

  // ledger has exactly one initial event
  const month = require("../store").yyyymm(Date.now());
  const events = await store.queryLedgerMonth("language-learning-club", month);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "initial");
});

test("recordPurchaseAttribution: replay same txn → no double ledger credit", async () => {
  const store = await seededStore();
  await recordPurchaseAttribution(store, SECRET, appleCtx());
  const second = await recordPurchaseAttribution(store, SECRET, appleCtx());
  // second call: purchase already written → no new ledger event id
  assert.equal(second.ledgerEventId, undefined);
  const month = require("../store").yyyymm(Date.now());
  const events = await store.queryLedgerMonth("language-learning-club", month);
  assert.equal(events.length, 1);
});

test("recordPurchaseAttribution: missing/invalid resolutionToken → UNVERIFIED, no payout", async () => {
  const store = await seededStore();
  const attr = await recordPurchaseAttribution(store, SECRET, appleCtx({ resolutionToken: undefined }));
  assert.equal(attr.verified, false);
  assert.equal(attr.partnerId, null);
  // no ledger credit for unverified
  const month = require("../store").yyyymm(Date.now());
  const events = await store.queryLedgerMonth("language-learning-club", month);
  assert.equal(events.length, 0);
});

test("recordPurchaseAttribution: token bound to a DIFFERENT subject is rejected", async () => {
  const store = await seededStore();
  const wrongToken = signResolutionToken(SECRET, {
    code: "LCCLT",
    subjectId: "someone-else",
    kind: "affiliate+offer",
  });
  const attr = await recordPurchaseAttribution(store, SECRET, appleCtx({ resolutionToken: wrongToken }));
  assert.equal(attr.verified, false);
});

test("recordPurchaseAttribution: unknown free-text code → unverified ledger-less row", async () => {
  const store = await seededStore();
  const token = signResolutionToken(SECRET, { code: "ORGANIC", subjectId: SUBJECT_ID, kind: "affiliate" });
  const attr = await recordPurchaseAttribution(store, SECRET, appleCtx({
    affiliateCode: "ORGANIC",
    resolutionToken: token,
    registryEntry: null,
    offerApplied: false,
  }));
  assert.equal(attr.verified, false);
  assert.equal(attr.partnerId, null);
  const lock = await store.getAttribution(SUBJECT_ID);
  assert.equal(lock.status, "unverified");
  assert.equal(lock.code, "ORGANIC");
});

test("recordPurchaseAttribution: no code → records purchase + token map, no attribution", async () => {
  const store = await seededStore();
  const attr = await recordPurchaseAttribution(store, SECRET, appleCtx({
    affiliateCode: undefined,
    resolutionToken: undefined,
  }));
  assert.equal(attr, undefined);
  // token map written so a renewal can still find a (future) lock
  const map = await store.getTokenMap("ios", SUBJECT_ID);
  assert.ok(map);
});

// --- renewals -------------------------------------------------------------

test("creditRenewal (Apple): credits locked partner via appAccountToken", async () => {
  const store = await seededStore();
  // initial purchase locks LCCLT to SUBJECT_ID
  await recordPurchaseAttribution(store, SECRET, appleCtx());

  const renewFields = extractAppleFields(appleRenewalNoOffer);
  const credit = await creditRenewal(store, {
    platform: "ios",
    txnId: renewFields.transactionId,
    accountKey: renewFields.appAccountToken,
    productId: renewFields.productId,
    notificationType: "DID_RENEW",
    eventTimeMs: Date.now(),
  });
  assert.equal(credit.credited, true);

  const month = require("../store").yyyymm(Date.now());
  const events = await store.queryLedgerMonth("language-learning-club", month);
  // one initial + one renewal
  assert.equal(events.length, 2);
  assert.ok(events.some((e) => e.kind === "renewal"));
});

test("creditRenewal: redelivered renewal notification is deduped (exactly-once)", async () => {
  const store = await seededStore();
  await recordPurchaseAttribution(store, SECRET, appleCtx());
  const rf = extractAppleFields(appleRenewalNoOffer);
  const ev = {
    platform: "ios",
    txnId: rf.transactionId,
    accountKey: rf.appAccountToken,
    productId: rf.productId,
    notificationType: "DID_RENEW",
    eventTimeMs: Date.now(),
  };
  const c1 = await creditRenewal(store, ev);
  const c2 = await creditRenewal(store, ev);
  assert.equal(c1.credited, true);
  assert.equal(c2.credited, false);
});

test("creditRenewal (Google): credits via obfuscated account id token map", async () => {
  const store = await seededStore();
  // simulate an initial Android purchase locking the partner + token map
  const gFields = extractGoogleV2Fields(googleV2WithOffer);
  const token = signResolutionToken(SECRET, { code: "LCCLT", subjectId: SUBJECT_ID, kind: "affiliate+offer" });
  await recordPurchaseAttribution(store, SECRET, {
    subjectId: SUBJECT_ID,
    platform: "android",
    affiliateCode: "LCCLT",
    resolutionToken: token,
    receiptFields: gFields,
    registryEntry: LCCLT,
    offerApplied: true,
  });

  const credit = await creditRenewal(store, {
    platform: "android",
    txnId: "GPA.renewal-1",
    accountKey: OBF_ACCOUNT_ID,
    productId: "corpan.sub.annual",
    notificationType: "RTDN-2",
    eventTimeMs: Date.now(),
  });
  assert.equal(credit.credited, true);
});

test("creditRenewal: no attribution found → not credited", async () => {
  const store = await seededStore();
  const credit = await creditRenewal(store, {
    platform: "ios",
    txnId: "x",
    accountKey: "unknown-account",
  });
  assert.equal(credit.credited, false);
  assert.equal(credit.reason, "no_attribution");
});

// --- entitlement ----------------------------------------------------------

test("issueEntitlementToken returns a signed snapshot", () => {
  const out = issueEntitlementToken(SECRET, { subjectId: "s1", plus: true, expiresAt: "2027-01-01T00:00:00Z" });
  assert.equal(out.status, "ok");
  assert.equal(out.subjectId, "s1");
  assert.equal(out.plus, true);
  assert.ok(out.entitlementToken);
});
