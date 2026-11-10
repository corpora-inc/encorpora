import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

/** A screen or block with nothing to show yet: what will appear here, and
 * the next step that works. `example` draws the real thing beside it with
 * made-up values, faded and marked as an example, so an empty screen still
 * shows what it is for. */
export function EmptyState({
  title,
  children,
  action,
  example,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  example?: ReactNode;
}) {
  const text = (
    <>
      <h2 className={styles.title}>{title}</h2>
      {children !== undefined && <div className={styles.body}>{children}</div>}
      {action !== undefined && <div className={styles.action}>{action}</div>}
    </>
  );
  if (example === undefined)
    return <section className={styles.empty}>{text}</section>;
  return (
    <section className={`${styles.empty} ${styles.withExample}`}>
      <div className={styles.text}>{text}</div>
      <figure className={styles.example}>
        <figcaption className={styles.exampleTag}>Example</figcaption>
        <div className={styles.exampleBody} aria-hidden="true" inert>
          {example}
        </div>
      </figure>
    </section>
  );
}
