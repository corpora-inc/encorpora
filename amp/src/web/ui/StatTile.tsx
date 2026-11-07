import type { ReactNode } from "react";
import styles from "./StatTile.module.css";

/** A row of quiet facts: figures on the page itself, never a grid of cards. */
export function StatRow({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <dl className={styles.row} aria-label={label}>
      {children}
    </dl>
  );
}

/** One fact: its figure in tabular numbers, then what it counts. */
export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className={styles.tile}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
      {detail !== undefined && <dd className={styles.detail}>{detail}</dd>}
    </div>
  );
}
