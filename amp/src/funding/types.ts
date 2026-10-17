import type { OperatingStatus, PurchaseModel } from "./national-review.js";

/** Research evidence is not a determination that a purchase is eligible. */
export interface FundingSource {
  id: string;
  title: string;
  url: string;
  checkedOn: string;
  publisher: "program-authority" | "program-administrator" | "payment-platform";
}
export interface FundingFact {
  statement: string;
  sourceIds: readonly string[];
}
export type ApprovalStage =
  | { status: "not-applied" | "unknown" | "pending" | "rejected" }
  | {
      status: "approved";
      evidence: string;
      effectiveOn: string;
      expiresOn?: string;
    };
export interface FundingProgram {
  id: string;
  jurisdiction: string;
  name: string;
  kind:
    | "esa"
    | "special-education-grant"
    | "scholarship"
    | "family-tax-benefit"
    | "institutional";
  purchaseModel: PurchaseModel;
  operatingStatus: OperatingStatus;
  onboarding: FundingFact;
  researchStatus: "official-sources-reviewed" | "platform-discovered";
  priority: "first-wave" | "second-wave" | "research";
  administrator: string;
  platform:
    "ClassWallet" | "Step Up / MyScholarShop" | "Odyssey" | "unverified";
  facts: readonly FundingFact[];
  annualSubscription: "category-supported-term-unconfirmed" | "unconfirmed";
  purchasingRoutes: readonly (
    | "marketplace"
    | "direct-pay"
    | "reimbursement"
    | "family-payment"
    | "school-contract"
    | "provider-contract"
    | "institutional-contract"
  )[];
  /** Independent gates: none is inferred from another gate or from platform registration. */
  corpora: {
    vendor: ApprovalStage;
    sku: ApprovalStage;
    listing: ApprovalStage;
    payment: "not-configured" | "unverified" | "verified";
  };
  unknowns: readonly string[];
  nextAction: string;
}
export interface FundingJurisdiction {
  code: string;
  name: string;
  researchStatus: "not-researched" | "partial";
  /** Empty means no programs researched, never that no funding exists. */
  programIds: readonly string[];
  nextAction: string;
}
export interface FundingRegistry {
  version: 1;
  checkedOn: string;
  sources: readonly FundingSource[];
  jurisdictions: readonly FundingJurisdiction[];
  programs: readonly FundingProgram[];
}

/** Input preserved for the original research records; enrichment adds purchasing distinctions. */
export type BaseFundingRegistry = Omit<FundingRegistry, "programs"> & {
  programs: readonly Omit<
    FundingProgram,
    "purchaseModel" | "operatingStatus" | "onboarding"
  >[];
};
