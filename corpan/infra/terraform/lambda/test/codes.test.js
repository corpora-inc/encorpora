const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeCode,
  isCodeFormatValid,
  classifyCode,
  purchaseActionFor,
  isRegistryEntryActive,
  PURCHASE_ACTIONS,
} = require("../codes");
const { LCCLT } = require("../registry_seed");

test("normalizeCode upper-cases and strips all whitespace", () => {
  assert.equal(normalizeCode("  lc clt \n"), "LCCLT");
  assert.equal(normalizeCode("LcClT"), "LCCLT");
  assert.equal(normalizeCode(null), "");
  assert.equal(normalizeCode(undefined), "");
  assert.equal(normalizeCode(""), "");
});

test("isCodeFormatValid: letters/digits/dash/underscore 1..32", () => {
  assert.ok(isCodeFormatValid("LCCLT"));
  assert.ok(isCodeFormatValid("FALL-2026_X"));
  assert.ok(!isCodeFormatValid(""));
  assert.ok(!isCodeFormatValid("has space"));
  assert.ok(!isCodeFormatValid("emoji😀"));
  assert.ok(!isCodeFormatValid("x".repeat(33)));
});

test("purchaseActionFor maps kind+platform to the right action", () => {
  assert.equal(purchaseActionFor("appleOfferCode", "ios"), PURCHASE_ACTIONS.APPLE_OFFER_CODE);
  assert.equal(purchaseActionFor("appleOfferCode", "android"), PURCHASE_ACTIONS.NORMAL);
  assert.equal(purchaseActionFor("playPromo", "android"), PURCHASE_ACTIONS.GOOGLE_PROMO_CODE);
  assert.equal(purchaseActionFor("playOffer", "android"), PURCHASE_ACTIONS.ANDROID_SUBSCRIPTION_OFFER);
  assert.equal(purchaseActionFor("affiliate", "ios"), PURCHASE_ACTIONS.NORMAL);
  assert.equal(purchaseActionFor("affiliate+offer", "ios"), PURCHASE_ACTIONS.APPLE_OFFER_CODE);
  assert.equal(purchaseActionFor("affiliate+offer", "android"), PURCHASE_ACTIONS.ANDROID_SUBSCRIPTION_OFFER);
});

test("classifyCode: store-compatible LCCLT (affiliate+offer) on iOS → apple_offer_code, verified", () => {
  const d = classifyCode("LCCLT", LCCLT, "ios");
  assert.equal(d.kind, "affiliate+offer");
  assert.equal(d.verified, true);
  assert.equal(d.purchaseAction.type, PURCHASE_ACTIONS.APPLE_OFFER_CODE);
  assert.equal(d.partnerId, "language-learning-club");
  assert.equal(d.partnerName, "Language Learning Club");
  assert.equal(d.discountLabel, "50% off first year");
  assert.equal(d.appleOfferId, "lcclt-50");
});

test("classifyCode: LCCLT on Android → android_subscription_offer with offer descriptor", () => {
  const d = classifyCode("LCCLT", LCCLT, "android");
  assert.equal(d.purchaseAction.type, PURCHASE_ACTIONS.ANDROID_SUBSCRIPTION_OFFER);
  assert.deepEqual(d.offer, {
    playOfferId: "annual-lcclt",
    playBasePlanId: "annual",
    offerToken: null,
  });
});

test("classifyCode: affiliate-only → normal purchase, verified, no discount", () => {
  const entry = { kind: "affiliate", partnerId: "p1", displayName: "Partner One", status: "active" };
  const d = classifyCode("PARTNER1", entry, "ios");
  assert.equal(d.kind, "affiliate");
  assert.equal(d.verified, true);
  assert.equal(d.purchaseAction.type, PURCHASE_ACTIONS.NORMAL);
  assert.equal(d.partnerId, "p1");
  assert.equal(d.discountLabel, undefined);
});

test("classifyCode: unknown code → affiliate kind, NORMAL, UNVERIFIED, no partner", () => {
  const d = classifyCode("RANDOMTAG", null, "ios");
  assert.equal(d.kind, "affiliate");
  assert.equal(d.verified, false);
  assert.equal(d.purchaseAction.type, PURCHASE_ACTIONS.NORMAL);
  assert.equal(d.partnerId, null);
});

test("classifyCode: expired/paused KNOWN code → treated unverified, flagged inactiveKnown", () => {
  const expired = { ...LCCLT, validTo: new Date(Date.now() - 1000).toISOString() };
  const d = classifyCode("LCCLT", expired, "ios");
  assert.equal(d.verified, false);
  assert.equal(d.purchaseAction.type, PURCHASE_ACTIONS.NORMAL);
  assert.equal(d.inactiveKnown, true);

  const paused = { ...LCCLT, status: "paused" };
  const d2 = classifyCode("LCCLT", paused, "ios");
  assert.equal(d2.verified, false);
  assert.equal(d2.inactiveKnown, true);
});

test("isRegistryEntryActive respects status + validFrom/validTo window", () => {
  const now = Date.parse("2026-06-09T00:00:00Z");
  assert.ok(isRegistryEntryActive({ status: "active" }, now));
  assert.ok(!isRegistryEntryActive({ status: "paused" }, now));
  assert.ok(!isRegistryEntryActive({ validFrom: "2026-07-01T00:00:00Z" }, now));
  assert.ok(!isRegistryEntryActive({ validTo: "2026-01-01T00:00:00Z" }, now));
  assert.ok(isRegistryEntryActive({ validFrom: "2026-01-01T00:00:00Z", validTo: "2026-12-31T00:00:00Z" }, now));
});
