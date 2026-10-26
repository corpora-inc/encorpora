import type { PurchaseMeasurement } from "../advertising/permission-contracts.js";
import { RETENTION } from "../privacy/retention-periods.js";
export interface FamilyLearner {
  id: string;
  name: string;
  birthYear?: number | null;
  satMathFocus?: boolean;
  deletedAt: string | null;
  access: {
    channel: string;
    status: string;
    startsAt: string;
    endsAt: string;
  }[];
  stripeLinked: boolean;
  /** Server-clock capability; absent on older/native providers. Authorization is still enforced on each request. */
  canPractice?: boolean;
}
export interface FamilySummary {
  purchaseMeasurement?: PurchaseMeasurement;
  metaPurchaseMeasurement?: PurchaseMeasurement;
  openaiPurchaseMeasurement?: PurchaseMeasurement;
  consent: {
    status: "active" | "withdrawn" | "not-recorded" | "development";
    policyVersion: string | null;
    recordedAt: string | null;
    withdrawnAt: string | null;
  };
  learners: FamilyLearner[];
  retained: {
    identity: string;
    financial: string;
    backups: string;
    privacyAuditDays: number;
  };
}
export interface DeletionReceipt {
  requestId: string;
  deletedLearners: number;
  retainedBillingReferences: number;
  billingManagementRequired: boolean;
  consentWithdrawn: boolean;
}
export class FamilyError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
export const retentionNotice: FamilySummary["retained"] = {
  identity:
    "Your parent sign-in account stays available for billing, exports and support. This action does not delete your identity-provider account.",
  financial:
    "Order, payment, license and refund records are retained separately for billing reconciliation. Deletion removes the learner profile name and learning history. A student name required on a verified financial invoice remains with that invoice. Deleting learning data does not cancel renewal.",
  backups:
    "This action removes learning records from the live application database. Backup deletion follows the deployment’s documented retention schedule; contact support for that schedule and any external copies.",
  privacyAuditDays: RETENTION.privacyAuditDays,
};
