import { expect, expectTypeOf, test } from "vitest";
import { qk } from "../keys";

test("an account's keys sit under its prefix, each with its own parts", () => {
  expect(qk.account("a-1")).toEqual(["account", "a-1"]);
  expect(qk.account("a-1", "receipts", null)).toEqual([
    "account",
    "a-1",
    "receipts",
    null,
  ]);
  expect(qk.account(null, "me")).toEqual(["account", null, "me"]);
  expectTypeOf(qk.account("a-1", "level-trend", "l-1")).toEqualTypeOf<
    readonly ["account", "a-1", "level-trend", string]
  >();
  // @ts-expect-error receipts name their page
  qk.account("a-1", "receipts");
  // @ts-expect-error every resource is named in AccountResources
  qk.account("a-1", "unnamed");
});

test("the money and approval keys keep their shapes", () => {
  expect(qk.account("a-1", "billing", "status", "l-1")).toEqual([
    "account",
    "a-1",
    "billing",
    "status",
    "l-1",
  ]);
  expect(qk.account("a-1", "funding-invoices", "email", "i-1")).toEqual([
    "account",
    "a-1",
    "funding-invoices",
    "email",
    "i-1",
  ]);
  expect(qk.account("a-1", "funding-invoice-history")).toEqual([
    "account",
    "a-1",
    "funding-invoice-history",
  ]);
  expect(qk.account("a-1", "active-funding-invoice", "i-1")).toEqual([
    "account",
    "a-1",
    "active-funding-invoice",
    "i-1",
  ]);
  expect(qk.account("a-1", "funding-records", "i-1")).toEqual([
    "account",
    "a-1",
    "funding-records",
    "i-1",
  ]);
  expect(qk.prices()).toEqual(["billing", "prices"]);
  expect(qk.fundingOffers()).toEqual(["funding", "invoice-offers"]);
  expect(qk.publicInvoiceOffers("az-esa")).toEqual([
    "public-invoice-offers",
    "az-esa",
  ]);
  expect(qk.familyApprovalLink("t")).toEqual(["family-approval-link", "t"]);
});
