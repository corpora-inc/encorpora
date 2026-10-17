import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { normalizeFinancialEvidence } from "../src/billing/evidence/normalize.js";
import {
  parseDocumentProfile,
  evidenceDigest,
} from "../src/billing/evidence/profile.js";
import { config, remoteFixtures } from "./stripe-fixtures.js";
import { syntheticDocumentProfile } from "./payment-evidence-fixtures.js";
function invoice(overrides: Record<string, unknown> = {}): Stripe.Invoice {
  return {
    ...remoteFixtures().invoice,
    billing_reason: "subscription_create",
    amount_overpaid: 0,
    amount_shipping: 0,
    starting_balance: 0,
    ending_balance: 0,
    pre_payment_credit_notes_amount: 0,
    post_payment_credit_notes_amount: 0,
    latest_revision: null,
    from_invoice: null,
    total_excluding_tax: 12000,
    subtotal_excluding_tax: 12000,
    total_taxes: [],
    ...overrides,
  } as unknown as Stripe.Invoice;
}
function refund(overrides: Record<string, unknown> = {}): Stripe.Refund {
  return {
    id: "re_fixture",
    charge: "ch_fixture",
    currency: "usd",
    amount: 2500,
    created: 1700000000,
    status: "succeeded",
    ...overrides,
  } as Stripe.Refund;
}
test("payment document profiles bind reviewed seller/catalog facts and reject unsupported font text", () => {
  assert.deepEqual(
    parseDocumentProfile(syntheticDocumentProfile, config),
    syntheticDocumentProfile,
  );
  assert.throws(
    () =>
      parseDocumentProfile(
        { ...syntheticDocumentProfile, priceId: "price_other" },
        config,
      ),
    /does not match/,
  );
  assert.throws(
    () =>
      parseDocumentProfile(
        {
          ...syntheticDocumentProfile,
          seller: { ...syntheticDocumentProfile.seller, legalName: "测试" },
        },
        config,
      ),
    /font/,
  );
  assert.notEqual(
    evidenceDigest(syntheticDocumentProfile),
    evidenceDigest({
      ...syntheticDocumentProfile,
      product: { ...syntheticDocumentProfile.product, title: "Different" },
    }),
  );
  assert.equal(evidenceDigest({ a: 1, b: 2 }), evidenceDigest({ b: 2, a: 1 }));
});
test("financial amounts reconcile inclusive and exclusive taxes without price subtraction guesses", () => {
  assert.equal(
    normalizeFinancialEvidence(invoice(), "ch_fixture", []).kind,
    "verified",
  );
  const exclusive = normalizeFinancialEvidence(
    invoice({
      total: 12960,
      amount_paid: 12960,
      total_taxes: [{ amount: 960, tax_behavior: "exclusive" }],
    }),
    "ch_fixture",
    [],
  );
  assert.equal(exclusive.kind, "verified");
  const inclusive = normalizeFinancialEvidence(
    invoice({
      subtotal_excluding_tax: 11111,
      total_excluding_tax: 11111,
      total_taxes: [{ amount: 889, tax_behavior: "inclusive" }],
    }),
    "ch_fixture",
    [],
  );
  assert.equal(inclusive.kind, "verified");
  for (const change of [
    { total_excluding_tax: null },
    { total_taxes: [{ amount: 1, tax_behavior: "exclusive" }] },
    { post_payment_credit_notes_amount: 1 },
    { starting_balance: -1 },
    { currency: "jpy" },
    { amount_overpaid: 100 },
    { amount_shipping: 100 },
    { latest_revision: "in_revision" },
    { total_discount_amounts: [{ amount: 1 }] },
  ])
    assert.equal(
      normalizeFinancialEvidence(invoice(change), "ch_fixture", []).kind,
      "review",
    );
});
test("refund observations retain failed and pending facts without counting them as paid back", () => {
  for (const status of [
    "succeeded",
    "failed",
    "pending",
    "requires_action",
    "canceled",
  ]) {
    const actual = normalizeFinancialEvidence(invoice(), "ch_fixture", [
      refund({ status }),
    ]);
    assert.equal(actual.kind, "verified");
    if (actual.kind === "verified")
      assert.equal(actual.observation.refunds[0]!.status, status);
  }
  for (const refunds of [
    [refund(), refund()],
    [refund({ charge: "ch_foreign" })],
    [refund({ currency: "eur" })],
    [refund({ amount: 12001 })],
    [refund({ amount: -1 })],
    [refund({ status: null })],
  ])
    assert.equal(
      normalizeFinancialEvidence(invoice(), "ch_fixture", refunds).kind,
      "review",
    );
});
