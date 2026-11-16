import type { DirectNotice } from "../../../parent-consent/contracts";
import styles from "./Billing.module.css";

/** Direct notice before checkout; full details expand within the page. */
export function NoticeSummary({ notice }: { notice: DirectNotice }) {
  // "Learner nickname" reads as "learner nickname" mid-sentence; acronyms stay.
  const categories = notice.childData.map(({ category }) =>
    /^[A-Z][a-z]/.test(category)
      ? category[0]!.toLowerCase() + category.slice(1)
      : category,
  );
  return (
    <section className={styles.notice} aria-labelledby="parent-notice-title">
      <h2 id="parent-notice-title">Learning and privacy</h2>
      <p>
        {notice.operator.name} collects {categories.join("; ")} to run practice.
        You can review or delete your child’s information in Privacy settings.{" "}
        <a href={notice.privacyUrl} target="_blank" rel="noopener noreferrer">
          Privacy policy
        </a>
        .
      </p>
      <details className={styles.privacyDetails}>
        <summary>Privacy details</summary>
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
          parent permission to save learning activity. You can change this
          permission in Account › Privacy.
        </p>
        <p>
          <a href={notice.privacyUrl} target="_blank" rel="noopener noreferrer">
            Full privacy policy
          </a>
        </p>
      </details>
    </section>
  );
}
