import type { ConsentPolicy } from "../src/parent-consent/contracts.js";
/** Synthetic notice, never a live eligibility determination. */
export const consentFixture: ConsentPolicy = {
  enabled: true,
  confirmationDelayHours: 24,
  review: {
    reference: "fixture-review",
    expiresAt: "2099-01-01T00:00:00.000Z",
    noDisclosureUnder312_2: true,
    providerContractsReviewed: true,
    deploymentFlowsComplete: true,
  },
  notice: {
    version: "fixture-v1",
    operator: {
      name: "Fixture Operator",
      address: "Synthetic address",
      telephone: "+1 202 555 0100",
      email: "privacy@example.com",
    },
    privacyUrl: "https://example.com/privacy",
    parentAccountUrl: "https://example.com/",
    childData: [
      {
        category: "Learner nickname and math answers",
        purpose: "Adapt first-party lessons",
        retention: "Until parent deletion or documented inactivity limit",
      },
    ],
    processors: [
      {
        name: "Fixture hosting",
        service: "Database hosting",
        data: "Account-linked learning records",
        purpose: "Internal service operations only",
        retention: "Documented deletion and backup limits",
      },
    ],
    reviewAndDeletion:
      "Use the parent Privacy workspace to review, withdraw, export or delete learning data. Contact privacy@example.com for help.",
    pendingContactDays: 7,
    withdrawnEvidenceDays: 30,
    evidenceRetentionPurpose:
      "Resolve recent consent and withdrawal disputes without retaining contact addresses.",
  },
};
