import type { ReactNode } from "react";
import styles from "./ActionRow.module.css";

/**
 * A page's actions, on their own line under its title: the first is the
 * page's one primary action. They wrap whole, at word breaks, onto the next
 * line and never over the title; on a narrow line each line's buttons share
 * its width, so a lone wrapped button is as wide as the page. Place it in a
 * block or a one-column grid (it measures the width it is given).
 */
export function ActionRow({
  children,
  label,
}: {
  children: ReactNode;
  /** The group's accessible name, when the page has several. */
  label?: string;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.actions} role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
