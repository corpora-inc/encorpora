import test from "node:test";
import assert from "node:assert/strict";
import {
  classWalletConfigSchema,
  classWalletHeaders,
  parseClassWalletReport,
  prepareClassWalletProvision,
  classWalletMoney,
} from "../src/funding-purchase/classwallet.js";
import { testFundingOffer as offer } from "./funding-purchase.fixture.js";
import type { FundingRequest } from "../src/funding-purchase/contracts.js";
import { emptyCommerceState, reduceCommerce } from "../src/commerce/ledger.js";
const request: FundingRequest = {
  id: "a9829b00-48b2-4eed-835a-91c76636dfd3",
  accountId: "parent",
  learnerId: "learner",
  idempotencyKey: "key",
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2026-01-31T00:00:00.000Z",
  status: "prepared",
  offer,
  orderId: null,
};
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
      distribution: "Annual",
      programId: offer.programId,
      channelReference: offer.channelReference,
    },
  ],
});
const row = {
  "Order ID": "provider-order",
  "Transaction ID": "transaction-one",
  "Invoice/Quote": request.id,
  Organization: "Example Program",
  State: "XX",
  "Distribution Name": "Annual",
  "Payment Amount": "123.00",
  Fee: "3.00",
  Total: "120.00",
  Status: "Settled",
  "Payment Approval Date": "2026-01-02T00:00:00.000Z",
  "Last Update": "2026-01-03T00:00:00.000Z",
};
const now = "2026-01-04T00:00:00.000Z";
test("observed empty report and quoted names parse without losing invoice columns", () => {
  assert.deepEqual(
    parseClassWalletReport(classWalletHeaders.join(",") + "\n\n"),
    [],
  );
  const values = classWalletHeaders.map((k) =>
    k === "User Name"
      ? '"Name, With Comma"'
      : (row[k as keyof typeof row] ?? ""),
  );
  assert.equal(
    parseClassWalletReport(
      classWalletHeaders.join(",") + "\r\n" + values.join(","),
    )[0]["Invoice/Quote"],
    request.id,
  );
  for (const input of [
    "bad,headers",
    classWalletHeaders.join(",") + '\n"unterminated',
    classWalletHeaders.join(",") + '\n"closed"junk',
  ])
    assert.throws(() => parseClassWalletReport(input));
});
test("settled report grants exactly the invoiced learner and gross value", () => {
  const payload = prepareClassWalletProvision(row, request, config, now);
  const state = payload.events.reduce(reduceCommerce, emptyCommerceState());
  assert.equal(state.grants.length, 1);
  assert.equal(state.grants[0].learnerId, request.learnerId);
  assert.equal(state.grants[0].startsAt, now);
  assert.equal(state.orders[0].amountMinor, 12300);
});
test("re-export after Last Update changes reuses committed events without extending access", () => {
  const original = prepareClassWalletProvision(row, request, config, now);
  assert.deepEqual(
    prepareClassWalletProvision(
      { ...row, "Last Update": "2026-01-05T00:00:00.000Z" },
      request,
      config,
      "2026-01-06T00:00:00.000Z",
      original,
    ),
    original,
  );
});
test("unverified payment states, program, invoice, fee accounting and dates fail closed", () => {
  for (const patch of [
    { Status: "Processing" },
    { Organization: "Different" },
    { "Invoice/Quote": "parent-name" },
    { Total: "123.00" },
    { Fee: "-3.00" },
    { "Payment Amount": "$123.00" },
    { "Last Update": "01/03/2026" },
    { "Last Update": "2027-01-01T00:00:00.000Z" },
  ])
    assert.throws(() =>
      prepareClassWalletProvision({ ...row, ...patch }, request, config, now),
    );
  for (const amount of ["1e2", "123", "001.00", "1,000.00", "NaN"])
    assert.throws(() => classWalletMoney(amount));
});
test("one transaction cannot create separate orders for different invoices or programs", () => {
  const first = prepareClassWalletProvision(row, request, config, now);
  const other = {
    ...request,
    id: "b9829b00-48b2-4eed-835a-91c76636dfd3",
    learnerId: "other",
  };
  const second = prepareClassWalletProvision(
    { ...row, "Invoice/Quote": other.id },
    other,
    config,
    now,
  );
  assert.equal(first.events[0].orderId, second.events[0].orderId);
  const state = first.events.reduce(reduceCommerce, emptyCommerceState());
  assert.throws(() => second.events.reduce(reduceCommerce, state));
});
