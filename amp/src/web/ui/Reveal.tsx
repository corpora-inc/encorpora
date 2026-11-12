import type { ReactNode } from "react";
import styles from "./Reveal.module.css";

/**
 * Content that appears when what it depends on is switched on, and folds
 * away when it is switched off: a short height reveal, the only motion, and
 * only ever after the person's own choice. Closed, it is out of the tab
 * order and the accessibility tree (inert); its state is kept as it was.
 */
export function Reveal({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.reveal} data-open={open ? "" : undefined}>
      <div className={styles.inner} inert={!open}>
        {children}
      </div>
    </div>
  );
}
