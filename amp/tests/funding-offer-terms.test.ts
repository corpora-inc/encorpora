import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fundingOfferSchema } from "../src/funding-purchase/contracts.js";
import { loadFundingOffers } from "../src/funding-purchase/config.js";
import { withMonthlyOffers } from "../src/funding-purchase/monthly-offers.js";
import {
  fundingOfferMatchesSnapshot,
  withInvoiceDateTerms,
} from "../src/funding-purchase/offer-terms.js";
import { legacyInvoiceOffer as legacy } from "./funding-offer-terms.fixture.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";

test("the invoice-date transition preserves issued snapshots and is idempotent", () => {
  const before = structuredClone(legacy);
  const current = fundingOfferSchema.parse(withInvoiceDateTerms(legacy));
  assert.deepEqual(legacy, before);
  assert.equal(current.termPolicy, "twelve-months-from-invoice");
  assert.equal(current.revision, `${legacy.revision}-invoice-dates-v1`);
  assert.deepEqual(current, {
    ...legacy,
    revision: current.revision,
    termPolicy: current.termPolicy,
  });
  assert.deepEqual(withInvoiceDateTerms(current), current);
  assert.equal(fundingOfferMatchesSnapshot(current, legacy), true);
  assert.equal(fundingOfferMatchesSnapshot(current, current), true);
  assert.equal(fundingOfferMatchesSnapshot(legacy, current), false);
});

test("compatibility permits only the exact dated-term migration", () => {
  const current = withInvoiceDateTerms(legacy);
  for (const changed of [
    { id: "another-offer" },
    { revision: "unrelated-revision" },
    { subtotalMinor: legacy.subtotalMinor + 100 },
    { taxMinor: 100 },
    { enabled: false },
    { validUntil: "2030-01-01T00:00:00.000Z" },
    { merchant: { ...legacy.merchant, legalName: "Another merchant" } },
    { approvals: { ...legacy.approvals, vendorReference: "changed" } },
  ])
    assert.equal(
      fundingOfferMatchesSnapshot({ ...current, ...changed }, legacy),
      false,
      JSON.stringify(changed),
    );
  assert.deepEqual(withInvoiceDateTerms(testFundingOffer), testFundingOffer);
});

test("a new dated DirectPay offer requests individual review without rewriting its approved predecessor", () => {
  const { purchaseReview: _review, ...approvedBase } = legacy;
  const approved = fundingOfferSchema.parse({
    ...approvedBase,
    approvals: testFundingOffer.approvals,
  });
  const before = structuredClone(approved);
  const current = fundingOfferSchema.parse(withInvoiceDateTerms(approved));
  assert.equal(current.purchaseReview, "individual-approval-required");
  assert.equal(current.termPolicy, "twelve-months-from-invoice");
  assert.deepEqual(current.approvals, approved.approvals);
  assert.deepEqual(approved, before);
  assert.equal(fundingOfferMatchesSnapshot(current, approved), true);
  assert.equal(
    fundingOfferMatchesSnapshot(
      { ...current, subtotalMinor: current.subtotalMinor + 1 },
      approved,
    ),
    false,
  );
  assert.equal(
    fundingOfferMatchesSnapshot(
      {
        ...current,
        approvals: { ...current.approvals, annualTermReference: "changed" },
      },
      approved,
    ),
    false,
  );
});

test("long revision identifiers remain valid and distinguish different originals", () => {
  const a = withInvoiceDateTerms({ ...legacy, revision: "a".repeat(120) });
  const b = withInvoiceDateTerms({
    ...legacy,
    revision: `${"a".repeat(119)}b`,
  });
  assert.equal(a.revision.length, 120);
  fundingOfferSchema.parse(a);
  fundingOfferSchema.parse(b);
  assert.notEqual(a.revision, b.revision);
  assert.deepEqual(withInvoiceDateTerms(a), a);
  assert.equal(
    fundingOfferMatchesSnapshot(a, { ...legacy, revision: "a".repeat(120) }),
    true,
  );
});

test("monthly derivation preserves the invoice-date basis and matches old monthly invoices", () => {
  const oldMonthly = withMonthlyOffers([legacy])[1]!;
  const newMonthly = withMonthlyOffers([withInvoiceDateTerms(legacy)])[1]!;
  assert.equal(newMonthly.termMonths, 1);
  assert.equal(newMonthly.termPolicy, "one-month-from-invoice");
  assert.equal(newMonthly.subtotalMinor, 5900);
  assert.deepEqual(newMonthly, withInvoiceDateTerms(oldMonthly));
  assert.equal(fundingOfferMatchesSnapshot(newMonthly, oldMonthly), true);
});

test("the production loader offers dated terms from both legacy and explicit new configuration", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "amp-offer-terms-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "offers.json");
  await writeFile(path, JSON.stringify([legacy]));
  const current = await loadFundingOffers(path);
  assert.equal(current.length, 2);
  assert.deepEqual(
    current.map((offer) => offer.termPolicy),
    ["twelve-months-from-invoice", "one-month-from-invoice"],
  );
  assert.equal(new Set(current.map((offer) => offer.id)).size, 2);
  await writeFile(path, JSON.stringify(current));
  assert.deepEqual(await loadFundingOffers(path), current);
  await writeFile(path, JSON.stringify([current[0]]));
  assert.deepEqual(await loadFundingOffers(path), current);
});
