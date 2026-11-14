import type { ReactNode } from "react";
import { Wave } from "./Loading";
import styles from "./RowList.module.css";

/** A list of full-width rows to choose from, hairlines between them. */
export function RowList({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <ul className={styles.list} aria-label={label}>
      {children}
    </ul>
  );
}

/**
 * One choice in a RowList: a name, a quiet line under it, and a chevron. The
 * whole row is the target (64 px). While its action runs, the wave takes the
 * chevron's place and the other rows wait.
 */
export function RowButton({
  title,
  meta,
  busy = false,
  disabled = false,
  onClick,
  ...data
}: {
  title: string;
  meta?: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
} & { [key: `data-${string}`]: string | undefined }) {
  return (
    <li className={styles.item}>
      <button
        type="button"
        className={styles.row}
        aria-busy={busy || undefined}
        disabled={disabled || busy}
        onClick={onClick}
        {...data}
      >
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          {meta && <span className={styles.meta}>{meta}</span>}
        </span>
        {busy ? (
          <span className={styles.wait}>
            <Wave />
          </span>
        ) : (
          <svg
            className={styles.chevron}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        )}
      </button>
    </li>
  );
}
