import test from "node:test";
import assert from "node:assert/strict";
import {
  fundingOfferSchema,
  presentOffer,
} from "../src/funding-purchase/contracts.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";
const {
  skuReference: _sku,
  annualTermReference: _term,
  ...vendorEvidence
} = testFundingOffer.approvals;
const review = {
  ...testFundingOffer,
  purchaseReview: "individual-approval-required",
  route: "direct-pay",
  documentPolicy: "named-student-invoice",
  activationPolicy: "after-settlement",
  approvals: vendorEvidence,
};
test("a named vendor invoice can start individual review without claiming prior product or term approval", () => {
  const parsed = fundingOfferSchema.parse(review);
  assert.equal(parsed.approvals.skuReference, undefined);
  assert.equal(parsed.approvals.annualTermReference, undefined);
  assert.equal(
    presentOffer(parsed).purchaseReview,
    "individual-approval-required",
  );
  assert.ok(!("approvals" in presentOffer(parsed)));
});
test("individual-review invoices cannot enable marketplace checkout, credit access or omit vendor evidence", () => {
  for (const patch of [
    { route: "marketplace" },
    { activationPolicy: "after-approval" },
    { documentPolicy: "opaque-student-reference-accepted" },
    { approvals: { ...vendorEvidence, vendorReference: "" } },
  ])
    assert.throws(() => fundingOfferSchema.parse({ ...review, ...patch }));
  assert.throws(() =>
    fundingOfferSchema.parse({ ...review, purchaseReview: undefined }),
  );
  assert.doesNotThrow(() => fundingOfferSchema.parse(testFundingOffer));
});
