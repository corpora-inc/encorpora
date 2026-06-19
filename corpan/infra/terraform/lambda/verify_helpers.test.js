// verify_helpers.test.js — pure-helper unit tests (node:test). No live AWS/store
// calls: only the I/O-free helpers exported from verify_purchase.js.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const v = require("./verify_purchase");

// --- googleProductTypeFor: the regression that dropped every Android sub ------
test("googleProductTypeFor: subscription ids resolve to 'subs'", () => {
  // corpan.sub.annual MUST route to subscriptionsv2, never products.get
  // (products.get on a sub token => "The document type is not supported").
  assert.equal(v.googleProductTypeFor("corpan.sub.annual"), "subs");
  assert.equal(v.googleProductTypeFor("corpan.sub.monthly"), "subs");
});

test("googleProductTypeFor: one-time product ids resolve to 'inapp'", () => {
  assert.equal(v.googleProductTypeFor("corpan.book.monte_alban"), "inapp");
  assert.equal(v.googleProductTypeFor("some.random.product"), "inapp");
});

test("googleProductTypeFor: explicit client value always wins", () => {
  assert.equal(v.googleProductTypeFor("corpan.book.x", "subs"), "subs");
  assert.equal(v.googleProductTypeFor("corpan.sub.annual", "inapp"), "inapp");
});

test("googleProductTypeFor: missing/odd productId defaults to 'subs'", () => {
  // Subscriptions are the only live IAP flow; default safe.
  assert.equal(v.googleProductTypeFor(undefined), "subs");
  assert.equal(v.googleProductTypeFor(null), "subs");
  assert.equal(v.googleProductTypeFor(123), "subs");
});

// --- moneyToNumber: Google Play `Money` (units + nanos) ----------------------
test("moneyToNumber: units + nanos compose to a decimal", () => {
  assert.equal(v.moneyToNumber({ currencyCode: "USD", units: "4", nanos: 990000000 }), 4.99);
  assert.equal(v.moneyToNumber({ currencyCode: "USD", units: "24" }), 24);
  assert.equal(v.moneyToNumber({ currencyCode: "USD", units: "79", nanos: 990000000 }), 79.99);
});

test("moneyToNumber: zero, negative nanos, and absent input", () => {
  assert.equal(v.moneyToNumber({ units: "0", nanos: 0 }), 0);
  assert.equal(v.moneyToNumber({ units: "0", nanos: -500000000 }), -0.5);
  assert.equal(v.moneyToNumber(null), null);
  assert.equal(v.moneyToNumber(undefined), null);
  assert.equal(v.moneyToNumber({ currencyCode: "USD" }), null);
});

// --- milliunitsToNumber: Apple `price` (milliunits) --------------------------
test("milliunitsToNumber: 4990 -> 4.99, null stays null", () => {
  assert.equal(v.milliunitsToNumber(4990), 4.99);
  assert.equal(v.milliunitsToNumber(0), 0);
  assert.equal(v.milliunitsToNumber(null), null);
  assert.equal(v.milliunitsToNumber(undefined), null);
});
