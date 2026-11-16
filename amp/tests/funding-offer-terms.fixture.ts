import { fundingOfferSchema } from "../src/funding-purchase/contracts.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";
const { creditAgreementReference: _credit, ...baseOffer } = testFundingOffer;

export const legacyInvoiceOffer = fundingOfferSchema.parse({
  ...baseOffer,
  id: "fixture-annual-invoice",
  productTitle: "Fixture annual learner license",
  productDescription: "One learner, one year of synthetic test access.",
  subtotalMinor: 59900,
  route: "direct-pay",
  activationPolicy: "after-settlement",
  documentPolicy: "named-student-invoice",
  purchaseReview: "individual-approval-required",
  refundPolicy: "none",
  approvals: {
    vendorReference: "private-vendor",
    routeReference: "private-route",
    paymentReference: "private-payment",
  },
});
