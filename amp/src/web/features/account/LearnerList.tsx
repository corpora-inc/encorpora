import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { FamilyLearner } from "../../../family/contracts.js";
import { adultStartNames } from "../../../learning/starting-point";
import { Chevron } from "./BillingList";
import styles from "./AccountPages.module.css";

/**
 * Account → Learners: the account's own practice first, then each child as
 * a row that opens their settings under it. One row's settings are open at a
 * time; with one child, theirs are open from the start. The own practice
 * opens its settings (`ownDetail`: where it starts) or, without them, /me.
 */
export function LearnerList({
  own,
  ownDetail,
  children,
  selectedId,
  onSelect,
  detail,
}: {
  own?: FamilyLearner;
  /** The own practice's settings, opened under its row. */
  ownDetail?: ReactNode;
  children: FamilyLearner[];
  selectedId?: string;
  onSelect: (id: string) => void;
  detail: (learner: FamilyLearner) => ReactNode;
}) {
  const live = children.filter((learner) => !learner.deletedAt);
  const rows = live.length + (own && ownDetail ? 1 : 0);
  const open =
    selectedId ||
    (live.length === 1 ? live[0]!.id : rows === 1 ? own?.id : undefined);
  const ownOpen = !!own && !!ownDetail && open === own.id;
  return (
    <ul className={styles.list} aria-label="Learners">
      {own && !ownDetail && (
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
      {own && ownDetail && (
        <li className={ownOpen ? undefined : styles.linkItem}>
          <button
            type="button"
            className={styles.linkRow}
            aria-expanded={ownOpen}
            aria-controls={`learner-${own.id}`}
            data-learner-row={own.id}
            data-own-practice
            onClick={() => onSelect(ownOpen && rows > 1 ? "" : own.id)}
          >
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Your practice</span>
              <span className={styles.rowMeta}>
                {own.start
                  ? `Starts at ${adultStartNames[own.start]}`
                  : "Your levels and record"}
              </span>
            </span>
            <svg
              className={`${styles.chevron} ${ownOpen ? styles.chevronOpen : ""}`}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
          {ownOpen && (
            <div className={styles.detail} id={`learner-${own.id}`}>
              {ownDetail}
            </div>
          )}
        </li>
      )}
      {live.map((learner) => {
        const expanded = open === learner.id;
        return (
          <li
            key={learner.id}
            className={expanded ? undefined : styles.linkItem}
          >
            <button
              type="button"
              className={styles.linkRow}
              aria-expanded={expanded}
              aria-controls={`learner-${learner.id}`}
              data-learner-row={learner.id}
              onClick={() =>
                onSelect(expanded && live.length > 1 ? "" : learner.id)
              }
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
