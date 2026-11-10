import type { FamilyLearner } from "../../../family/contracts.js";
import { licenseChannel, licenseSummary } from "../../family-access";
import { Button } from "../../ui/Button";
import styles from "./AccountPages.module.css";

const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

/** What one learner holds, in one line: a plan and its dates, or the free
 * problems and workbooks left. */
export function holding(learner: FamilyLearner, consentActive: boolean) {
  if (learner.deletedAt) return "Learning data deleted. Billing records kept.";
  const access = licenseSummary(learner.access);
  if (access.kind !== "none" && access.license) {
    const plan = licenseChannel(access.license.channel);
    const when =
      access.kind === "scheduled"
        ? `starts ${date(access.license.startsAt)}`
        : `through ${date(access.license.endsAt)}`;
    return `${plan}, ${when}`;
  }
  const free = learner.freeAllowance;
  if (!free) return consentActive ? "No plan" : "Free problems";
  const problems = free.problems.remaining
    ? `${free.problems.remaining} of ${free.problems.total} free problems left`
    : "Free problems used";
  const workbooks = free.workbooks.available
    ? `${plural(free.workbooks.available, "free workbook")} left`
    : "free workbooks used";
  return `${problems} · ${workbooks}`;
}

/**
 * Account → Billing: one row for each learner the account pays for, its own
 * practice first, with what it holds and the one action that works now:
 * Continue with AMP without a plan, Manage plan for a card subscription.
 * Purchases and records follow as a row of their own.
 */
export function BillingList({
  learners,
  consentActive,
  busy,
  onContinue,
  onManage,
  onHistory,
  onRecords,
  recordsRef,
}: {
  learners: FamilyLearner[];
  consentActive: boolean;
  busy: boolean;
  onContinue: (learner: FamilyLearner) => void;
  onManage: () => void;
  onHistory: (learner: FamilyLearner, trigger: HTMLElement) => void;
  onRecords: () => void;
  recordsRef?: React.Ref<HTMLButtonElement>;
}) {
  const shown = learners
    .filter(
      (learner) =>
        !learner.simulation && (!learner.deletedAt || learner.access.length),
    )
    .sort((a, b) => Number(!!b.adult) - Number(!!a.adult));
  return (
    <>
      {!shown.length && (
        <p className={styles.lede}>
          Nothing is billed yet. A plan shows here once you continue with AMP
          for a learner.
        </p>
      )}
      <ul className={styles.list} aria-label="What each learner holds">
        {shown.map((learner, index) => {
          const access = licenseSummary(learner.access);
          const paused =
            access.kind === "active" &&
            !(learner.learningAllowed ?? consentActive);
          return (
            <li key={learner.id} className={styles.row}>
              <div className={styles.rowText}>
                <h2 className={styles.rowTitle}>
                  {learner.deletedAt
                    ? `Deleted learner ${index + 1}`
                    : learner.adult
                      ? "Your practice"
                      : learner.name}
                </h2>
                <p className={styles.rowMeta}>
                  {holding(learner, consentActive)}
                </p>
                {paused && (
                  <p className={`${styles.rowMeta} ${styles.paused}`}>
                    Learning is paused until consent is given.
                  </p>
                )}
              </div>
              <div className={styles.rowActions}>
                {!!learner.access.length && (
                  <Button
                    variant="quiet"
                    disabled={busy}
                    onClick={(event) => onHistory(learner, event.currentTarget)}
                  >
                    History
                  </Button>
                )}
                {learner.stripeLinked && access.kind !== "none" ? (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    aria-busy={busy || undefined}
                    aria-label={`Manage the plan for ${learner.adult ? "your practice" : learner.name}`}
                    onClick={onManage}
                  >
                    Manage plan
                  </Button>
                ) : (
                  !learner.deletedAt &&
                  access.kind === "none" && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      data-continue-with-amp={learner.id}
                      onClick={() => onContinue(learner)}
                    >
                      Continue with AMP
                    </Button>
                  )
                )}
              </div>
            </li>
          );
        })}
        <li className={styles.linkItem}>
          <button
            ref={recordsRef}
            type="button"
            className={styles.linkRow}
            data-purchase-options
            onClick={onRecords}
          >
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Purchases and records</span>
              <span className={styles.rowMeta}>
                Receipts, refunds and other ways to pay
              </span>
            </span>
            <Chevron />
          </button>
        </li>
      </ul>
    </>
  );
}

export function Chevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** The way back from a step inside an Account tab, above its heading. */
export function BackRow({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.back}>
      <Button variant="quiet" align="start" onClick={onClick}>
        <svg className={styles.chevron} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 6-6 6 6 6" />
        </svg>
        {children}
      </Button>
    </div>
  );
}
