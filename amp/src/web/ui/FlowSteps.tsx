import { Link } from "@tanstack/react-router";
import styles from "./FlowSteps.module.css";

/**
 * Where a step flow stands (a parent's setup, the pay steps): "Step 2 of 3"
 * and a bar per step, filled up to the current one, with each step's name
 * from 560 px. A step already done is a link to its own address, the only
 * way back inside a flow (there is no in-page Back); the current step is
 * marked for assistive technology; the steps ahead are inert. Next stays
 * the step's own primary action. A flow of one step shows nothing.
 */
export function FlowSteps({
  steps,
  current,
  href,
  label = "Steps",
}: {
  steps: readonly { id: string; label: string }[];
  current: number;
  /** A done step's address, from the flow's own step map. */
  href?: (id: string) => string;
  label?: string;
}) {
  if (steps.length < 2) return null;
  return (
    <nav className={styles.steps} aria-label={label}>
      <p className={styles.count}>
        Step {current + 1} of {steps.length}
      </p>
      <ol>
        {steps.map((step, at) => {
          const state = at < current ? "done" : at === current ? "now" : "next";
          const content = (
            <>
              <span className={styles.bar} aria-hidden="true" />
              <span className={styles.name}>{step.label}</span>
            </>
          );
          return (
            <li key={step.id} data-state={state}>
              {state === "done" && href ? (
                <Link to={href(step.id) as never} className={styles.step}>
                  {content}
                </Link>
              ) : (
                <span
                  className={styles.step}
                  aria-current={state === "now" ? "step" : undefined}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
