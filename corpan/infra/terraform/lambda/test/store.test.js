const test = require("node:test");
const assert = require("node:assert/strict");
const { IapStore, yyyymm } = require("../store");
const { FakeDdb } = require("./fakeDdb");

function makeStore() {
  return new IapStore(new FakeDdb(), "corpan-iap-test");
}

test("yyyymm formats UTC month", () => {
  assert.equal(yyyymm(Date.parse("2026-06-09T23:00:00Z")), "2026-06");
  assert.equal(yyyymm(Date.parse("2026-01-01T00:00:00Z")), "2026-01");
});

test("putPurchaseOnce is idempotent (no double-write on replay)", async () => {
  const store = makeStore();
  const a = await store.putPurchaseOnce("s1", "ios", "txn1", { productId: "p" });
  assert.equal(a.written, true);
  const b = await store.putPurchaseOnce("s1", "ios", "txn1", { productId: "p" });
  assert.equal(b.written, false);
  assert.ok(b.existing);
  assert.equal(b.existing.productId, "p");
});

test("lockAttribution: first-verified-touch wins, never changes partner", async () => {
  const store = makeStore();
  const first = await store.lockAttribution("s1", { code: "AAA", partnerId: "p1", verified: true });
  assert.equal(first.created, true);
  assert.equal(first.attribution.status, "verified");

  // A second different verified code must NOT overwrite the verified lock.
  const second = await store.lockAttribution("s1", { code: "BBB", partnerId: "p2", verified: true });
  assert.equal(second.changed, false);
  assert.equal(second.attribution.code, "AAA");
  assert.equal(second.attribution.partnerId, "p1");
});

test("lockAttribution: unverified can be upgraded to verified, never downgraded", async () => {
  const store = makeStore();
  const u = await store.lockAttribution("s2", { code: "FOO", partnerId: null, verified: false });
  assert.equal(u.attribution.status, "unverified");

  const up = await store.lockAttribution("s2", { code: "LCCLT", partnerId: "llc", verified: true });
  assert.equal(up.changed, true);
  assert.equal(up.attribution.status, "verified");
  assert.equal(up.attribution.partnerId, "llc");

  // Now an unverified touch must NOT downgrade.
  const down = await store.lockAttribution("s2", { code: "BAR", partnerId: null, verified: false });
  assert.equal(down.changed, false);
  assert.equal(down.attribution.status, "verified");
  assert.equal(down.attribution.partnerId, "llc");
});

test("creditLedgerOnce dedups by (partner, platform, txn)", async () => {
  const store = makeStore();
  const c1 = await store.creditLedgerOnce("p1", {
    platform: "ios",
    txnId: "txnA",
    subjectId: "s1",
    price: 1000,
    currency: "USD",
    kind: "initial",
    eventTimeMs: Date.parse("2026-06-09T00:00:00Z"),
  });
  assert.equal(c1.credited, true);

  const c2 = await store.creditLedgerOnce("p1", {
    platform: "ios",
    txnId: "txnA",
    subjectId: "s1",
    kind: "renewal",
    eventTimeMs: Date.parse("2026-06-09T00:00:00Z"),
  });
  assert.equal(c2.credited, false);
  assert.equal(c2.reason, "duplicate");
});

test("creditLedgerOnce: no partner → not credited", async () => {
  const store = makeStore();
  const c = await store.creditLedgerOnce(null, { platform: "ios", txnId: "x" });
  assert.equal(c.credited, false);
  assert.equal(c.reason, "no_partner");
});

test("queryLedgerMonth returns the month's events for a partner", async () => {
  const store = makeStore();
  const t = Date.parse("2026-06-09T00:00:00Z");
  await store.creditLedgerOnce("p1", { platform: "ios", txnId: "a", subjectId: "s1", kind: "initial", eventTimeMs: t });
  await store.creditLedgerOnce("p1", { platform: "android", txnId: "b", subjectId: "s2", kind: "renewal", eventTimeMs: t });
  const events = await store.queryLedgerMonth("p1", "2026-06");
  assert.equal(events.length, 2);
});

test("token map round-trips for renewal reverse-lookup", async () => {
  const store = makeStore();
  await store.putTokenMap("ios", "acct-key", { subjectId: "s1", partnerId: "p1", code: "LCCLT" });
  const m = await store.getTokenMap("ios", "acct-key");
  assert.equal(m.subjectId, "s1");
  assert.equal(m.partnerId, "p1");
});
