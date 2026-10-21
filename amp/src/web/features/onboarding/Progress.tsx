import styles from "./Start.module.css";
const labels = ["Plan", "Payment", "Learner", "Starting point"] as const;
/** First-run position: plan → payment → learner → starting point. */
export function Progress({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div
      className={styles.progress}
      role="group"
      aria-label={`Step ${step} of ${labels.length}: ${labels[step - 1]}`}
    >
      <span aria-hidden="true">{labels[step - 1]}</span>
      <span aria-hidden="true">
        Step {step} of {labels.length}
      </span>
    </div>
  );
}
