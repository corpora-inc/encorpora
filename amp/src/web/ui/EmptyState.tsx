import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

/** A screen or block with nothing to show yet: what will appear here, and
 * the next step that works. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={styles.empty}>
      <h2 className={styles.title}>{title}</h2>
      {children !== undefined && <div className={styles.body}>{children}</div>}
      {action !== undefined && <div className={styles.action}>{action}</div>}
    </section>
  );
}
