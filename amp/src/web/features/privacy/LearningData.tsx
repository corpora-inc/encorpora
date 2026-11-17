import type { FamilySummary } from "../../../family/contracts.js";
import pages from "../account/AccountPages.module.css";

export type ConsentStatus = FamilySummary["consent"]["status"];

/** Consent may be withdrawn while it is recorded (or in local development). */
export const canWithdraw = (status: ConsentStatus) =>
  status === "active" || status === "development";

/**
 * Where the family's consent stands, and what withdrawing does or what still
 * works without it. The account's Privacy → Learning permissions page and a
 * child's Consent sheet say the same words.
 */
export function ConsentSummary({ status }: { status: ConsentStatus }) {
  return (
    <>
      <p className={pages.rowTitle}>
        {status === "active"
          ? "Consent is active."
          : status === "withdrawn"
            ? "Consent is withdrawn. New learning activity is paused for children under 13."
            : status === "development"
              ? "Local development access. No verified consent record is present."
              : "Verified parent consent is not recorded."}
      </p>
      {canWithdraw(status) ? (
        <p className={pages.prose}>
          Withdrawing stops new learning activity for children under 13. It
          doesn’t delete existing records or cancel a plan’s renewal.
        </p>
      ) : (
        <p className={pages.prose}>
          Your billing controls and data export stay available. Pausing learning
          doesn’t cancel a paid plan.
        </p>
      )}
    </>
  );
}

/**
 * What deleting learning data removes and keeps, read before it is done: one
 * learner's (`learner`), or the whole family's. The account's deletion
 * review and a child's Delete learning data sheet say the same words.
 */
export function DeletionTerms({
  learner,
  className,
}: {
  learner: boolean;
  /** Each paragraph's class, where the words sit outside a dialog. */
  className?: string;
}) {
  return (
    <>
      <p className={className}>
        Saved problems, answers and the learner profile name will be removed
        from the live application. This cannot be undone. Download your family
        data first if you want to keep a copy.
      </p>
      <p className={className}>
        Payment records, including any student name on a verified invoice, and
        your parent sign-in remain.{" "}
        <strong>This does not cancel a subscription.</strong> Use billing
        management to check renewal.{" "}
        {learner
          ? "Other learners are not affected."
          : "Consent will be withdrawn for this account."}
      </p>
    </>
  );
}
