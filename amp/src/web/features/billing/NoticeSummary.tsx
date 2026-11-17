import type { DirectNotice } from "../../../parent-consent/contracts";
import { Disclosure } from "../../ui/Disclosure";
import styles from "./Billing.module.css";

/**
 * The direct notice before checkout (16 CFR 312.4(b), (c)), laid out so a
 * parent can read it at a glance: two short lines that say who collects a
 * child's information, for what, and where to review or delete it, with the
 * online notice's link (312.4(c)(1)); then every required item of the notice
 * in "Privacy details" on the same screen, before the action, opening in
 * place: what is collected, why and for how long, the service providers,
 * the parent's choices, how the payment gives consent, and how to reach the
 * operator. The words are the policy's (`DirectNotice`), unchanged; only
 * their arrangement is ours, so the notice stays "clearly and understandably
 * written" (312.4(a)) instead of one paragraph above the payment button.
 */
export function NoticeSummary({ notice }: { notice: DirectNotice }) {
  return (
    <section className={styles.notice} aria-labelledby="parent-notice-title">
      <h2 id="parent-notice-title">Learning and privacy</h2>
      <p>
        {notice.operator.name} collects your child’s learning information to
        run practice. You can review or delete it at any time in Privacy
        settings.{" "}
        <a href={notice.privacyUrl} target="_blank" rel="noopener noreferrer">
          Privacy policy
        </a>
      </p>
      <Disclosure summary="Privacy details" className={styles.privacyDetails}>
        <h3>What we collect and why</h3>
        <ul className={styles.noticeList}>
          {notice.childData.map((entry, index) => (
            <li key={index}>
              <strong>{entry.category}</strong>
              <span>
                {entry.purpose}. Kept: {entry.retention}.
              </span>
            </li>
          ))}
        </ul>
        {notice.processors.length > 0 && (
          <>
            <h3>Service providers</h3>
            <ul className={styles.noticeList}>
              {notice.processors.map((entry, index) => (
                <li key={index}>
                  <strong>
                    {entry.name} ({entry.service})
                  </strong>
                  <span>
                    {entry.data}. {entry.purpose}. Kept: {entry.retention}.
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
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
        <h3>Who we are</h3>
        <p>
          {notice.operator.name}
          <br />
          {notice.operator.address}
          <br />
          {notice.operator.telephone} · {notice.operator.email}
        </p>
        <p>
          Notice version {notice.version}.{" "}
          <a href={notice.privacyUrl} target="_blank" rel="noopener noreferrer">
            Full privacy policy
          </a>
        </p>
      </Disclosure>
    </section>
  );
}
