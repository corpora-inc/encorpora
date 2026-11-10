import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { FamilyLearner } from "../../../family/contracts.js";
import { Chevron } from "./BillingList";
import styles from "./AccountPages.module.css";

/**
 * Account → Learners: the account's own practice first (it opens /me), then
 * each child as a row that opens their settings under it. One child's
 * settings are open at a time; with one child, they are open from the start.
 */
export function LearnerList({
  own,
  children,
  selectedId,
  onSelect,
  detail,
}: {
  own?: FamilyLearner;
  children: FamilyLearner[];
  selectedId?: string;
  onSelect: (id: string) => void;
  detail: (learner: FamilyLearner) => ReactNode;
}) {
  const live = children.filter((learner) => !learner.deletedAt);
  const open = live.length === 1 ? live[0]!.id : selectedId;
  return (
    <ul className={styles.list} aria-label="Learners">
      {own && (
        <li className={styles.linkItem}>
          <Link to="/me" className={styles.linkRow}>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Your practice</span>
              <span className={styles.rowMeta}>Your levels and record</span>
            </span>
            <Chevron />
          </Link>
        </li>
      )}
      {live.map((learner) => {
        const expanded = open === learner.id;
        return (
          <li key={learner.id} className={expanded ? undefined : styles.linkItem}>
            <button
              type="button"
              className={styles.linkRow}
              aria-expanded={expanded}
              aria-controls={`learner-${learner.id}`}
              data-learner-row={learner.id}
              onClick={() => onSelect(expanded && live.length > 1 ? "" : learner.id)}
            >
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{learner.name}</span>
                <span className={styles.rowMeta}>
                  {[
                    learner.birthYear ? `Born ${learner.birthYear}` : null,
                    learner.namePending ? "A picture name for now" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Settings"}
                </span>
              </span>
              <svg
                className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
            {expanded && (
              <div className={styles.detail} id={`learner-${learner.id}`}>
                {detail(learner)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
