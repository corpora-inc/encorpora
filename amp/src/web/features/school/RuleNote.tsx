import type { ReactNode } from "react";
import { InfoPopover } from "../../ui/InfoPopover";
import styles from "./RuleNote.module.css";

/** "How this is decided": the one-sentence rule behind a flag, a tap away.
 * It opens over the page as the app's one popover (`popover-owner`), so
 * nothing below it moves. */
export function RuleNote({ children }: { children: ReactNode }) {
  return (
    <div className={styles.rule}>
      <InfoPopover
        title="How this is decided"
        label="How this is decided"
        details={<p className={styles.text}>{children}</p>}
      />
    </div>
  );
}
