import type { DocumentProfile } from "../src/billing/evidence/contracts.js";
import { config } from "./stripe-fixtures.js";
/** Synthetic identity for fixtures; never an operational merchant profile. */
export const syntheticDocumentProfile: DocumentProfile = {
  version: "synthetic-v1",
  reviewedAt: "2026-01-01T00:00:00.000Z",
  accountId: config.accountId,
  livemode: false,
  productId: config.productId,
  priceId: config.priceId,
  sku: config.sku,
  currency: "usd",
  unitAmountMinor: 12000,
  seller: {
    legalName: "Synthetic Éducation Company",
    address: ["100 Example Street", "Example City, NY 10000", "United States"],
    supportEmail: "support@example.test",
    supportUrl: "https://example.test/support",
    privacyUrl: "https://example.test/privacy",
  },
  product: {
    title: "AMP annual mathematics — test edition",
    description:
      "One learner’s annual mathematics access and downloadable learning materials.",
  },
};

import type { PaymentHistoryItem } from "../src/billing/evidence/contracts.js";
export const syntheticPaymentRecord: PaymentHistoryItem = {
  id: "2db17bfd-7171-485d-8b06-c1e01d753c21",
  createdAt: "2026-01-01T00:00:00.000Z",
  learnerReference: "learner-synthetic-reference",
  status: "verified",
  observedAt: "2026-10-17T09:00:00.000Z",
  successfulRefundMinor: 0,
  netPaidMinor: 12000,
  baseline: {
    invoiceReason: "subscription_create",
    invoiceId: "in_synthetic",
    chargeId: "ch_synthetic",
    subscriptionId: "sub_synthetic",
    checkoutId: "c98647ea-bde9-4053-8a87-ddb0ea86e528",
    paidAt: 1767225600,
    periodStart: 1767225600,
    periodEnd: 1798761600,
    preTaxMinor: 11111,
    tax: [{ amountMinor: 889, behavior: "inclusive" }],
    paidMinor: 12000,
    currency: "usd",
    profile: syntheticDocumentProfile,
  },
  observations: [
    {
      id: "0aa025d6-ad45-411c-bf74-3ca512de562a",
      observedAt: "2026-01-01T00:00:01.000Z",
      refunds: [],
    },
    {
      id: "52f5dbeb-8a6e-49c9-b690-9ae8bad25910",
      observedAt: "2026-10-16T09:00:00.000Z",
      refunds: [
        {
          id: "re_synthetic",
          chargeId: "ch_synthetic",
          amountMinor: 3000,
          currency: "usd",
          created: 1792141200,
          status: "succeeded",
        },
      ],
    },
    {
      id: "fc540ee1-2f72-46a5-bdc7-b3e1fa5203d8",
      observedAt: "2026-10-17T09:00:00.000Z",
      refunds: [
        {
          id: "re_synthetic",
          chargeId: "ch_synthetic",
          amountMinor: 3000,
          currency: "usd",
          created: 1792141200,
          status: "failed",
        },
      ],
    },
  ],
};
