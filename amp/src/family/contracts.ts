export interface FamilyLearner {
  id: string;
  name: string;
  birthYear?: number | null;
  deletedAt: string | null;
  access: {
    channel: string;
    status: string;
    startsAt: string;
    endsAt: string;
  }[];
  stripeLinked: boolean;
}
export interface FamilySummary {
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
    "Order, payment, license and refund references are retained separately for billing reconciliation. A deleted learner’s name and learning history are removed; an opaque billing reference may remain. Deleting learning data does not cancel renewal.",
  backups:
    "This action removes learning records from the live application database. Backup deletion follows the deployment’s documented retention schedule; contact support for that schedule and any external copies.",
  privacyAuditDays: 90,
};
