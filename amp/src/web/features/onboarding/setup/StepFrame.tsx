import type { ReactNode } from "react";
import { FlowSteps } from "../../../ui/FlowSteps";
import { Page } from "../../../ui/Page";
import { PageHeader } from "../../../ui/PageHeader";
import styles from "./Setup.module.css";

/** One step of a first run (docs/design/ia.md): where it sits in the setup
 * (the shared stepper, whose done steps link back to themselves), its
 * title, its content, and the step's action at the foot. There is no
 * in-page Back. The
 * reason the action waits keeps its line beneath it, so nothing moves. A
 * setup of one step shows no progress: there is nowhere else to be. */
export function StepFrame({
  steps,
  index,
  title,
  titleId,
  lede,
  children,
  next,
  hint = "",
  hintLines = 1,
  href,
}: {
  steps: readonly { id: string; label: string }[];
  index: number;
  title: string;
  titleId?: string;
  lede?: ReactNode;
  children: ReactNode;
  next?: ReactNode;
  hint?: string;
  /** Lines the reason keeps from the start, so a longer one moves nothing. */
  hintLines?: 1 | 2;
  /** A done step's address, from the flow's step map: the stepper links
   * back to it (there is no in-page Back). */
  href?: (id: string) => string;
}) {
  return (
    <Page>
      <FlowSteps steps={steps} current={index} href={href} label="Setup" />
      <PageHeader title={title} titleId={titleId} subtitle={lede} />
      <div className={styles.body}>{children}</div>
      <div className={styles.foot}>
        <div className={styles.actions}>{next}</div>
        <p
          className={styles.hint}
          data-lines={hintLines === 2 ? 2 : undefined}
          aria-live="polite"
        >
          {hint}
        </p>
      </div>
    </Page>
  );
}
