import type { ReactNode } from "react";
import styles from "./LearnerRow.module.css";

/**
 * One learner's row, the same on a family's Today and a class's live roster:
 * their name (the caller's link, or plain text), a facts slot, an optional
 * status mark and an action. Presentational: everything arrives as props.
 *
 * Its height is fixed, so nothing in it moves when its numbers change: 64 px
 * on a phone (the name and action on one line, the facts under them), 56 px
 * from a tablet up (one line), and 44 px in the `dense` desktop grid. The
 * facts never wrap; the name breaks inside its own column.
 */
export function LearnerRow({
  name,
  facts,
  status,
  action,
  dense = false,
  as: Tag = "div",
  className,
  ...data
}: {
  name: ReactNode;
  facts?: ReactNode;
  /** A short mark beside the facts (a live roster's "Working"). */
  status?: ReactNode;
  action?: ReactNode;
  /** A desktop grid's 44 px row. */
  dense?: boolean;
  as?: "div" | "li";
  className?: string;
} & { [key: `data-${string}`]: string | undefined }) {
  return (
    <Tag
      className={[styles.row, dense ? styles.dense : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      data-learner-row=""
      {...data}
    >
      <span className={styles.name}>{name}</span>
      <span className={styles.facts}>{facts}</span>
      {status !== undefined && (
        <span className={styles.status}>{status}</span>
      )}
      <span className={styles.action}>{action}</span>
    </Tag>
  );
}
