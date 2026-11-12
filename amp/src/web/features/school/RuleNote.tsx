import type { ReactNode } from "react";
import styles from "./RuleNote.module.css";

/** "How this is decided": the one-sentence rule behind a flag, closed until
 * asked for. Opening it pushes only what's below it in its own item. */
export function RuleNote({ children }: { children: ReactNode }) {
  return (
    <details className={styles.rule}>
      <summary>How this is decided</summary>
      <p>{children}</p>
    </details>
  );
}
