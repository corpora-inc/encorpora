import assert from "node:assert/strict";
import test from "node:test";
import {
  fundingOfferSchema,
  type FundingOffer,
  type FundingRequest,
} from "../src/funding-purchase/contracts.js";
import {
  prepareClassWalletProvision,
  type ClassWalletConfig,
} from "../src/funding-purchase/classwallet.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";

const config: ClassWalletConfig = {
  verificationReference: "synthetic-only",
  currency: "USD",
  grossColumn: "Payment Amount",
  netColumn: "Total",
  dateFormat: "canonical-utc-iso",
  settledStatus: "Settled",
  lastUpdateMeaning: "settlement-time-for-settled-rows",
  programs: [
    {
      organization: "Fixture",
      state: "XX",
      distribution: "Fixture",
      programId: testFundingOffer.programId,
      channelReference: testFundingOffer.channelReference,
    },
  ],
};
function offer(months: 1 | 12): FundingOffer {
  return fundingOfferSchema.parse({
    ...testFundingOffer,
    termMonths: months,
    termPolicy:
      months === 1 ? "one-month-from-invoice" : "twelve-months-from-invoice",
    route: "direct-pay",
    documentPolicy: "named-student-invoice",
    purchaseReview: "individual-approval-required",
    activationPolicy: "after-settlement",
  });
}
function request(createdAt: string, months: 1 | 12): FundingRequest {
  return {
    id: "a9829b00-48b2-4eed-835a-91c76636dfd3",
    accountId: "owner",
    learnerId: "child",
    idempotencyKey: "synthetic",
    createdAt,
    expiresAt: "2030-01-01T00:00:00.000Z",
    status: "prepared",
    offer: offer(months),
    orderId: null,
  };
}
function payment(invoice: FundingRequest, at: string) {
  const gross = (
    (invoice.offer.subtotalMinor + invoice.offer.taxMinor) /
    100
  ).toFixed(2);
  return {
    "Order ID": "synthetic",
    "Transaction ID": "synthetic",
    "Invoice/Quote": invoice.id,
    Organization: "Fixture",
    State: "XX",
    "Distribution Name": "Fixture",
    "Payment Amount": gross,
    Fee: "0.00",
    Total: gross,
    Status: "Settled",
    "Payment Approval Date": at,
    "Last Update": at,
  };
}
function license(payload: ReturnType<typeof prepareClassWalletProvision>) {
  const first = payload.events[0]!;
  assert.equal(first.type, "order.created");
  assert.ok(first.type === "order.created");
  return first.order.license;
}

test("new invoice term policies are explicit, month-matched and restricted to DirectPay invoices", () => {
  assert.equal(offer(1).termPolicy, "one-month-from-invoice");
  assert.equal(offer(12).termPolicy, "twelve-months-from-invoice");
  assert.throws(() =>
    fundingOfferSchema.parse({ ...offer(1), termMonths: 12 }),
  );
  assert.throws(() =>
    fundingOfferSchema.parse({ ...offer(12), termMonths: 1 }),
  );
  assert.throws(() =>
    fundingOfferSchema.parse({
      ...offer(12),
      route: "marketplace",
      purchaseReview: undefined,
    }),
  );
  assert.throws(() =>
    fundingOfferSchema.parse({
      ...offer(12),
      documentPolicy: "opaque-student-reference-accepted",
    }),
  );
  assert.equal(
    fundingOfferSchema.parse(testFundingOffer).termPolicy,
    "twelve-months-from-verified-provisioning",
  );
});

test("monthly and annual ClassWallet periods use invoice dates, including month ends and leap years", () => {
  for (const [start, months, end] of [
    ["2026-01-31T10:00:00.000Z", 1, "2026-02-28T10:00:00.000Z"],
    ["2024-01-31T10:00:00.000Z", 1, "2024-02-29T10:00:00.000Z"],
    ["2024-02-29T09:12:13.456Z", 12, "2025-02-28T09:12:13.456Z"],
    ["2026-12-31T10:00:00.000Z", 1, "2027-01-31T10:00:00.000Z"],
  ] as const) {
    const invoice = request(start, months);
    const paid = new Date(Date.parse(start) + 86400000).toISOString();
    const activated = new Date(Date.parse(start) + 7 * 86400000).toISOString();
    const payload = prepareClassWalletProvision(
      payment(invoice, paid),
      invoice,
      config,
      activated,
      undefined,
      "2029-01-01T00:00:00.000Z",
    );
    assert.deepEqual(license(payload), {
      accountId: "owner",
      learnerId: "child",
      sku: invoice.offer.sku,
      startsAt: start,
      endsAt: end,
    });
    assert.equal(
      payload.events.find((event) => event.type === "license.activated")
        ?.occurredAt,
      activated,
    );
    const retry = prepareClassWalletProvision(
      { ...payment(invoice, paid), "Last Update": "2029-01-01T00:00:00.000Z" },
      invoice,
      config,
      "2029-01-01T00:00:00.000Z",
      payload,
      "2029-12-01T00:00:00.000Z",
    );
    assert.deepEqual(
      retry,
      payload,
      "A paid invoice never gains another term on retry",
    );
  }
});

test("a payment after the invoiced month records settlement without fabricating activation", () => {
  const invoice = request("2026-01-01T00:00:00.000Z", 1);
  const row = payment(invoice, "2026-02-10T00:00:00.000Z");
  const payload = prepareClassWalletProvision(
    row,
    invoice,
    config,
    "2026-02-11T00:00:00.000Z",
  );
  assert.equal(payload.events.length, 4);
  assert.ok(
    !payload.events.some((event) => event.type === "license.activated"),
  );
  assert.equal(
    payload.events.find((event) => event.type === "order.settled")?.occurredAt,
    row["Last Update"],
  );
  assert.equal(license(payload).startsAt, invoice.createdAt);
  assert.equal(license(payload).endsAt, "2026-02-01T00:00:00.000Z");
  assert.deepEqual(
    prepareClassWalletProvision(
      row,
      invoice,
      config,
      "2026-03-11T00:00:00.000Z",
      payload,
    ),
    payload,
  );
  const moved = structuredClone(payload);
  license(moved).startsAt = "2026-01-02T00:00:00.000Z";
  assert.throws(
    () =>
      prepareClassWalletProvision(
        row,
        invoice,
        config,
        "2026-03-11T00:00:00.000Z",
        moved,
      ),
    /invoice_term_mismatch/,
  );
});
