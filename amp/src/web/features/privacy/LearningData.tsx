import type { FamilySummary } from "../../../family/contracts.js";
import pages from "../account/AccountPages.module.css";
import type { ConsentNoticeText } from "./consent-api";

export type ConsentStatus = FamilySummary["consent"]["status"];

/** Consent may be withdrawn while it is recorded (or in local development). */
export const canWithdraw = (status: ConsentStatus) =>
  status === "active" || status === "development";

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const on = (at: string | null | undefined) =>
  at ? ` on ${DAY.format(new Date(at))}` : "";

/**
 * Where the family's consent stands, plainly, and what withdrawing does
 * (it pauses new learning for children under 13, 16 CFR 312.6(a)(2)). The
 * account's Privacy → Learning permissions page and a child's Consent sheet
 * say the same words.
 */
export function ConsentSummary({
  status,
  recordedAt,
  withdrawnAt,
}: {
  status: ConsentStatus;
  recordedAt?: string | null;
  withdrawnAt?: string | null;
}) {
  return (
    <>
      <p className={pages.rowTitle} data-consent-status={status}>
        {status === "active"
          ? `Consent given${on(recordedAt)}.`
          : status === "withdrawn"
            ? `Consent withdrawn${on(withdrawnAt)}. New learning is paused for children under 13.`
            : status === "development"
              ? "Local development access. No verified consent record is present."
              : "Consent isn’t given yet."}
      </p>
      {canWithdraw(status) && (
        <p className={pages.prose}>
          Withdrawing pauses new learning for children under 13. It doesn’t
          delete their records or cancel a plan.
        </p>
      )}
    </>
  );
}

/**
 * The direct notice (16 CFR 312.4(c)): who collects what from a child, why,
 * for how long, and who processes it. The same text the email carries, read
 * in place before saying yes.
 */
export function ConsentNotice({ notice }: { notice: ConsentNoticeText }) {
  return (
    <>
      <p>
        <strong>{notice.operator.name}</strong>
        <br />
        {notice.operator.address}
        <br />
        {notice.operator.telephone}
        <br />
        {notice.operator.email}
      </p>
      <p>
        Notice {notice.version}. Your contact address is used to request
        permission before collecting child information.
      </p>
      <h3>Information and purposes</h3>
      {notice.childData.map((d, i) => (
        <p key={i}>
          <strong>{d.category}</strong>: {d.purpose}. Retention: {d.retention}.
        </p>
      ))}
      <h3>Internal service providers</h3>
      {notice.processors.map((d, i) => (
        <p key={i}>
          <strong>{d.name}</strong> ({d.service}): {d.data}. {d.purpose}.
          Retention: {d.retention}.
        </p>
      ))}
      <p>
        This method permits only the reviewed internal-use practices, not other
        disclosure of children’s personal information.
      </p>
      <p>{notice.reviewAndDeletion}</p>
      <p>
        You may withdraw at any time. Pending contact is deleted after{" "}
        {notice.pendingContactDays} days if consent is not completed. Evidence
        is kept while consent is active and for {notice.withdrawnEvidenceDays}{" "}
        days after withdrawal: {notice.evidenceRetentionPurpose}
      </p>
      <a href={notice.privacyUrl} target="_blank" rel="noopener noreferrer">
        Full privacy policy
      </a>
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
