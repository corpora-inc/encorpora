import test from "node:test";
import assert from "node:assert/strict";
import {
  fundingOfferSchema,
  type FundingOffer,
  type FundingRequest,
} from "../src/funding-purchase/contracts.js";
import {
  annualTermEnd,
  fundedTermEnd,
} from "../src/funding-purchase/provision.js";
import { withMonthlyOffers } from "../src/funding-purchase/monthly-offers.js";
import {
  programAnnualPriceMinor,
  programMonthlyPriceMinor,
} from "../src/funding-purchase/program-prices.js";
import {
  classWalletConfigSchema,
  prepareClassWalletProvision,
} from "../src/funding-purchase/classwallet.js";
import { fundedTermText } from "../src/funding-purchase/quote-pdf.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";

/** The shape every live education-funds offer has: an annual named invoice
 * that the program reviews purchase by purchase. Synthetic values. */
const reviewed: FundingOffer = {
  ...testFundingOffer,
  id: "az-esa-annual-invoice",
  sku: "amp-math-annual-single",
  productTitle: "AMP Mathematics - annual learner license",
  productDescription:
    "Adaptive math practice, lessons and worksheets. One learner, one year.",
  subtotalMinor: 59900,
  route: "direct-pay",
  activationPolicy: "after-settlement",
  creditAgreementReference: undefined,
  documentPolicy: "named-student-invoice",
  purchaseReview: "individual-approval-required",
  approvals: {
    vendorReference: "private-vendor",
    routeReference: "private-route",
    paymentReference: "private-payment",
  },
};

test("an offer may run for one month under the one-month policy, never a mix", () => {
  const monthly = {
    ...reviewed,
    termMonths: 1,
    termPolicy: "one-month-from-verified-provisioning",
  };
  assert.equal(fundingOfferSchema.parse(monthly).termMonths, 1);
  assert.throws(() =>
    fundingOfferSchema.parse({
      ...monthly,
      termPolicy: "twelve-months-from-verified-provisioning",
    }),
  );
  assert.throws(() =>
    fundingOfferSchema.parse({
      ...reviewed,
      termPolicy: "one-month-from-verified-provisioning",
    }),
  );
  assert.throws(() => fundingOfferSchema.parse({ ...reviewed, termMonths: 6 }));
});

test("a one-month term ends on the same day next month, clamped to its last day", () => {
  assert.equal(
    fundedTermEnd("2026-11-12T15:00:00.000Z", 1),
    "2026-12-12T15:00:00.000Z",
  );
  assert.equal(
    fundedTermEnd("2026-01-31T10:00:00.000Z", 1),
    "2026-02-28T10:00:00.000Z",
  );
  assert.equal(
    fundedTermEnd("2026-12-31T00:00:00.000Z", 1),
    "2027-01-31T00:00:00.000Z",
  );
  assert.equal(
    fundedTermEnd("2024-02-29T09:12:13.456Z", 12),
    annualTermEnd("2024-02-29T09:12:13.456Z"),
  );
});

test("each funded program sells at the public prices: $599 a year, $59 a month", () => {
  for (const program of ["ar-efa", "az-esa", "nh-efa"]) {
    assert.equal(programAnnualPriceMinor[program], 59900);
    assert.equal(programMonthlyPriceMinor[program], 5900);
  }
});

test("a program's reviewed annual invoice gains a monthly invoice beside it", () => {
  const offers = withMonthlyOffers([reviewed]);
  assert.equal(offers.length, 2);
  assert.deepEqual(offers[0], reviewed);
  const monthly = fundingOfferSchema.parse(offers[1]);
  assert.equal(monthly.id, "az-esa-monthly-invoice");
  assert.equal(monthly.sku, "amp-math-monthly-single");
  assert.equal(monthly.termMonths, 1);
  assert.equal(monthly.termPolicy, "one-month-from-verified-provisioning");
  assert.equal(monthly.subtotalMinor, 5900);
  assert.equal(monthly.taxMinor, 0);
  assert.equal(
    monthly.productTitle,
    "AMP Mathematics - monthly learner license",
  );
  assert.match(monthly.productDescription, /One learner, one month\.$/);
  assert.doesNotMatch(monthly.productDescription, /year/i);
  // Everything else is the program's own reviewed offer.
  for (const key of [
    "revision",
    "programId",
    "channelReference",
    "route",
    "documentPolicy",
    "purchaseReview",
    "merchant",
    "instructions",
    "refundPolicy",
    "validUntil",
  ] as const)
    assert.deepEqual(monthly[key], reviewed[key]);
  // Deterministic: an invoice's snapshot still matches after a restart.
  assert.deepEqual(withMonthlyOffers([reviewed]), offers);
});

test("no monthly invoice is invented without the program's review, price or a clean term", () => {
  const approved: FundingOffer = {
    ...reviewed,
    purchaseReview: undefined,
    approvals: { ...testFundingOffer.approvals },
  };
  assert.equal(withMonthlyOffers([approved]).length, 1);
  assert.equal(
    withMonthlyOffers([{ ...reviewed, programId: "ut-fits-all" }]).length,
    1,
  );
  assert.equal(withMonthlyOffers([{ ...reviewed, taxMinor: 1000 }]).length, 1);
  assert.equal(
    withMonthlyOffers([
      { ...reviewed, productDescription: "Twelve months of practice." },
    ]).length,
    1,
  );
  // An offers file that already sells a month keeps its own.
  const own = {
    ...reviewed,
    id: "az-esa-own-month",
    termMonths: 1 as const,
    termPolicy: "one-month-from-verified-provisioning" as const,
  };
  assert.deepEqual(withMonthlyOffers([reviewed, own]), [reviewed, own]);
});

const config = classWalletConfigSchema.parse({
  verificationReference: "synthetic-test",
  currency: "USD",
  grossColumn: "Payment Amount",
  netColumn: "Total",
  dateFormat: "canonical-utc-iso",
  settledStatus: "Settled",
  lastUpdateMeaning: "settlement-time-for-settled-rows",
  programs: [
    {
      organization: "Example Program",
      state: "XX",
      distribution: "Monthly",
      programId: reviewed.programId,
      channelReference: reviewed.channelReference,
    },
  ],
});
const monthlyRequest: FundingRequest = {
  id: "a9829b00-48b2-4eed-835a-91c76636dfd3",
  accountId: "adult",
  learnerId: "learner",
  idempotencyKey: "key",
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2026-01-31T00:00:00.000Z",
  status: "prepared",
  offer: withMonthlyOffers([reviewed])[1]!,
  orderId: null,
};
const row = {
  "Order ID": "provider-order",
  "Transaction ID": "transaction-one",
  "Invoice/Quote": monthlyRequest.id,
  Organization: "Example Program",
  State: "XX",
  "Distribution Name": "Monthly",
  "Payment Amount": "59.00",
  Fee: "0.00",
  Total: "59.00",
  Status: "Settled",
  "Payment Approval Date": "2026-01-02T00:00:00.000Z",
  "Last Update": "2026-01-03T00:00:00.000Z",
};
const license = (payload: ReturnType<typeof prepareClassWalletProvision>) => {
  const created = payload.events[0]!;
  if (created.type !== "order.created") throw new Error("creation first");
  return created.order.license;
};

test("a settled monthly ClassWallet invoice grants one month from activation", () => {
  const now = "2026-01-04T00:00:00.000Z";
  const payload = prepareClassWalletProvision(row, monthlyRequest, config, now);
  assert.deepEqual(
    { startsAt: license(payload).startsAt, endsAt: license(payload).endsAt },
    { startsAt: now, endsAt: "2026-02-04T00:00:00.000Z" },
  );
});

test("a month paid early starts when the current term ends, and keeps that start on retry", () => {
  const now = "2026-01-04T00:00:00.000Z",
    currentEnd = "2026-01-20T08:00:00.000Z";
  const payload = prepareClassWalletProvision(
    row,
    monthlyRequest,
    config,
    now,
    undefined,
    currentEnd,
  );
  assert.equal(license(payload).startsAt, currentEnd);
  assert.equal(license(payload).endsAt, "2026-02-20T08:00:00.000Z");
  const activated = payload.events.find((e) => e.type === "license.activated");
  assert.equal(activated?.occurredAt, now);
  const retry = prepareClassWalletProvision(
    row,
    monthlyRequest,
    config,
    "2026-01-05T00:00:00.000Z",
    payload,
    "2026-03-01T00:00:00.000Z",
  );
  assert.deepEqual(retry, payload);
  // A start before activation is never accepted.
  assert.throws(() =>
    prepareClassWalletProvision(
      row,
      monthlyRequest,
      config,
      now,
      undefined,
      "2026-01-01T00:00:00.000Z",
    ),
  );
});

test("the invoice states its own term", () => {
  assert.deepEqual(fundedTermText(reviewed), {
    access:
      "One learner, 12 months from the day access is activated. Exact start and end dates must be confirmed with the accepted order.",
    subtotal: "annual curriculum access",
  });
  assert.deepEqual(fundedTermText(monthlyRequest.offer), {
    access:
      "One learner, 1 month from the day access is activated, or from the end of the learner's current access if that is later. Exact start and end dates must be confirmed with the accepted order.",
    subtotal: "monthly curriculum access",
  });
});
