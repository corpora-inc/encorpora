import type { FamilySummary } from "../../../family/contracts.js";
import styles from "./Privacy.module.css";

/**
 * Data retention: what stays after a deletion, and for how long, in the
 * server's own words (`me.family.retained`, src/family/contracts.ts).
 *
 * Requirement: an operator keeps a child's information only as long as
 * reasonably necessary and says how long (COPPA, 16 CFR 312.10), and a
 * business discloses how long it keeps each category (CCPA, Cal. Civ. Code
 * 1798.100(a)(3)).
 */
export function RetentionNote({
  retained,
}: {
  retained: FamilySummary["retained"];
}) {
  return (
    <div className={styles.panel} data-privacy-panel-body="retention">
      <p className={styles.prose}>{retained.identity}</p>
      <p className={styles.prose}>{retained.financial}</p>
      <p className={styles.prose}>{retained.backups}</p>
      <p className={styles.prose}>
        Privacy action records hold no learner names or answers and expire
        after {retained.privacyAuditDays} days.
      </p>
    </div>
  );
}
