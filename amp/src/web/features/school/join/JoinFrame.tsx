import type { ReactNode } from "react";
// The reset for the legacy global element rules, under `data-dense`.
import "../SchoolFrame.module.css";
import { FlowSteps } from "../../../ui/FlowSteps";
import { Page, type PageWidth } from "../../../ui/Page";
import { WaveMark } from "../../../ui/NavigationSheet";
import styles from "./Join.module.css";

/** Joining a class, step by step, each at its own address: the code
 * (`/join`), the name (`/join/<code>`), the pictures (`/join/<code>/<you>`). */
export const JOIN_STEPS = [
  { id: "code", label: "Code" },
  { id: "name", label: "Name" },
  { id: "pictures", label: "Pictures" },
] as const;
export type JoinStep = (typeof JOIN_STEPS)[number]["id"];

/** Every sign-in screen: where the child is in joining (the shared stepper,
 * whose done steps are the only way back: no in-page Back), the mark, and
 * the screen on its Page. */
export function JoinFrame({
  step,
  code,
  width = "standard",
  children,
}: {
  /** The screen's column (ui/Page): standard for a code or a card, wide
   * for a class's names and the pictures. */
  width?: PageWidth;
  /** The step of joining this screen is, if it is one. */
  step?: JoinStep;
  /** The class code, once there is one: the name step's address. */
  code?: string;
  children: ReactNode;
}) {
  const at = JOIN_STEPS.findIndex((entry) => entry.id === step);
  return (
    <div className={styles.page} data-dense>
      <header className={styles.top}>
        {at >= 0 && (
          <div className={styles.steps}>
            <FlowSteps
              steps={JOIN_STEPS}
              current={at}
              label="Joining"
              href={(id) => (id === "name" && code ? `/join/${code}` : "/join")}
            />
          </div>
        )}
        <span className={styles.brand}>
          <WaveMark />
          <span>AMP</span>
        </span>
      </header>
      <Page width={width} className={styles.main}>
        {children}
      </Page>
    </div>
  );
}
