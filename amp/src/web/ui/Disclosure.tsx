import type { ReactNode } from "react";
import styles from "./Disclosure.module.css";

/** One optional part of a page, folded under its name: a full-width 48 px
 * row with the kit's chevron, turning as it opens. Native details, so it
 * opens from the keyboard and to find-in-page with no script. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className={styles.disclosure} open={defaultOpen || undefined}>
      <summary>
        <span>{summary}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
