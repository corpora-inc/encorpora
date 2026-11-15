import type { ReactNode } from "react";
import styles from "./Disclosure.module.css";

/** One optional part of a page, folded under its name: a full-width 48 px
 * row with the kit's chevron, turning as it opens. Native details, so it
 * opens from the keyboard and to find-in-page with no script.
 *
 * With `open` and `onOpenChange`, the page holds whether it is open (a
 * remembered choice, or opened for something inside it). */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  className = "",
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <details
      className={`${styles.disclosure} ${className}`.trim()}
      open={(open ?? defaultOpen) || undefined}
      onToggle={
        onOpenChange
          ? (event) => {
              const now = event.currentTarget.open;
              if (now !== open) onOpenChange(now);
            }
          : undefined
      }
    >
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
