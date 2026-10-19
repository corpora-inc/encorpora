import { useState } from "react";
import type { DirectNotice } from "../../../parent-consent/contracts";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import styles from "./Billing.module.css";

/** The direct notice in two lines, with the complete notice one tap away. */
export function NoticeSummary({ notice }: { notice: DirectNotice }) {
  const [open, setOpen] = useState(false);
  // "Learner nickname" reads as "learner nickname" mid-sentence; acronyms stay.
  const categories = notice.childData.map(({ category }) =>
    /^[A-Z][a-z]/.test(category)
      ? category[0]!.toLowerCase() + category.slice(1)
      : category,
  );
  return (
    <section className={styles.notice} aria-labelledby="parent-notice-title">
      <h2 id="parent-notice-title">Parent notice</h2>
      <p>
        {notice.operator.name} collects{" "}
        {categories.length > 2
          ? `${categories.slice(0, 2).join("; ")}; and more`
          : categories.join("; ")}{" "}
        to run practice. Your first payment confirms you are the parent.
      </p>
      <Button
        variant="quiet"
        className={styles.read}
        onClick={() => setOpen(true)}
      >
        Read the full notice
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Parent notice">
        <p>
          <strong>{notice.operator.name}</strong>
          <br />
          {notice.operator.address}
          <br />
          {notice.operator.telephone} · {notice.operator.email}
        </p>
        <p>Notice version {notice.version}.</p>
        <h3>What we keep and why</h3>
        {notice.childData.map((entry, index) => (
          <p key={index}>
            <strong>{entry.category}</strong>: {entry.purpose}. Kept:{" "}
            {entry.retention}.
          </p>
        ))}
        {notice.processors.length > 0 && <h3>Service providers</h3>}
        {notice.processors.map((entry, index) => (
          <p key={index}>
            <strong>{entry.name}</strong> ({entry.service}): {entry.data}.{" "}
            {entry.purpose}. Kept: {entry.retention}.
          </p>
        ))}
        <h3>Your choices</h3>
        <p>{notice.reviewAndDeletion}</p>
        <p>
          You can withdraw consent at any time. Consent evidence is kept while
          consent is active and for {notice.withdrawnEvidenceDays} days after
          withdrawal: {notice.evidenceRetentionPurpose}
        </p>
        <h3>How payment confirms consent</h3>
        <p>
          Your card or Link payment for the first subscription period verifies
          that you are the parent. No learner details are collected until that
          payment is verified. Refunds and cancellation do not withdraw consent;
          withdraw it from Family › Privacy.
        </p>
        <p>
          <a href={notice.privacyUrl} target="_blank" rel="noopener noreferrer">
            Full privacy policy
          </a>
        </p>
      </Dialog>
    </section>
  );
}
