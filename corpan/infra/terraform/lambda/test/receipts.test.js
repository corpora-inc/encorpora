const test = require("node:test");
const assert = require("node:assert/strict");
const {
  decodeJws,
  extractAppleFields,
  appleOfferMatches,
  extractGoogleV2Fields,
  googleV2Active,
  googleOfferMatches,
} = require("../receipts");
const {
  jwsFromPayload,
  appleInitialWithOffer,
  appleRenewalNoOffer,
  appleInitialPlain,
  googleV2WithOffer,
  googleV2NoOffer,
  OBF_ACCOUNT_ID,
  SUBJECT_ID,
} = require("./fixtures");
const { LCCLT } = require("../registry_seed");

test("decodeJws reads the payload segment", () => {
  const jws = jwsFromPayload({ hello: "world" });
  assert.deepEqual(decodeJws(jws), { hello: "world" });
});

test("extractAppleFields pulls appAccountToken + offer fields from initial txn", () => {
  const f = extractAppleFields(appleInitialWithOffer);
  assert.equal(f.appAccountToken, SUBJECT_ID);
  assert.equal(f.offerType, 3);
  assert.equal(f.offerIdentifier, "lcclt-50");
  assert.equal(f.offerDiscountType, "PAY_UP_FRONT");
  assert.equal(f.price, 29990);
  assert.equal(f.currency, "USD");
  assert.equal(f.productId, "corpan.sub.annual");
});

test("extractAppleFields: renewal has NO offer fields but keeps appAccountToken", () => {
  const f = extractAppleFields(appleRenewalNoOffer);
  assert.equal(f.offerType, null);
  assert.equal(f.offerIdentifier, null);
  assert.equal(f.appAccountToken, SUBJECT_ID);
  assert.equal(f.originalTransactionId, "2000000111111111");
});

test("extractAppleFields: plain buy has no appAccountToken/offer", () => {
  const f = extractAppleFields(appleInitialPlain);
  assert.equal(f.appAccountToken, null);
  assert.equal(f.offerType, null);
});

test("appleOfferMatches: applied + matches registry offer id", () => {
  const f = extractAppleFields(appleInitialWithOffer);
  const r = appleOfferMatches(f, LCCLT);
  assert.equal(r.applied, true);
  assert.equal(r.matches, true);
});

test("appleOfferMatches: no offer present → not applied", () => {
  const f = extractAppleFields(appleInitialPlain);
  const r = appleOfferMatches(f, LCCLT);
  assert.equal(r.applied, false);
});

test("extractGoogleV2Fields: offer details + obfuscated account id", () => {
  const f = extractGoogleV2Fields(googleV2WithOffer);
  assert.equal(f.obfuscatedExternalAccountId, OBF_ACCOUNT_ID);
  assert.equal(f.offerId, "annual-lcclt");
  assert.equal(f.basePlanId, "annual");
  assert.equal(f.productId, "corpan.sub.annual");
  assert.equal(f.latestOrderId, "GPA.0000-1111-2222-33333");
});

test("googleV2Active maps subscriptionState", () => {
  assert.deepEqual(googleV2Active({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE" }), {
    active: true,
    inGrace: false,
  });
  assert.deepEqual(googleV2Active({ subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" }), {
    active: true,
    inGrace: true,
  });
  assert.deepEqual(googleV2Active({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" }), {
    active: false,
    inGrace: false,
  });
});

test("googleOfferMatches: with vs without offer", () => {
  const withF = extractGoogleV2Fields(googleV2WithOffer);
  assert.deepEqual(googleOfferMatches(withF, LCCLT), { applied: true, matches: true });

  const noF = extractGoogleV2Fields(googleV2NoOffer);
  assert.deepEqual(googleOfferMatches(noF, LCCLT), { applied: false, matches: false });
});

test("extractGoogleV2Fields tolerates v1-shaped fallback (no lineItems/account)", () => {
  const f = extractGoogleV2Fields({ productId: "corpan.sub.annual" });
  assert.equal(f.obfuscatedExternalAccountId, null);
  assert.equal(f.offerId, null);
  assert.equal(f.productId, "corpan.sub.annual");
});
