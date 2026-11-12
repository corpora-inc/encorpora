import type { ReactNode } from "react";
import { Button } from "../../../ui/Button";
import styles from "./Experience.module.css";

/** A small closed or open padlock beside a lock. */
export function LockMark({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.lockMark}>
      <rect x="3" y="7" width="10" height="7" rx="1.6" />
      <path
        d={open ? "M5 7V4.8a3 3 0 0 1 5.6-1.4" : "M5 7V4.8a3 3 0 0 1 6 0V7"}
      />
    </svg>
  );
}

/**
 * Where a setting's value comes from, said only when it tells the reader
 * something, for every setting alike (the weekly target, what students see):
 *
 * - at AMP's own default, nothing;
 * - changed here, only a quiet way back ("Use 60 min");
 * - on a class, a value it takes from above ("Set by Brightwater"), or one
 *   locked above ("Locked by Brightwater").
 *
 * It sits on the control's row, after it; `children` is any further action
 * (a school's "Lock for everyone below").
 */
export function SettingMeta({
  scope,
  own,
  setBy,
  lockedAbove,
  reset,
  disabled,
  children,
}: {
  scope: "class" | "org";
  /** The value was chosen here. */
  own: boolean;
  /** Who chose the value this one follows, when it is not AMP's default. */
  setBy: string | null;
  /** Locked by a place above this one. */
  lockedAbove: string | null;
  /** The way back to the value this one would follow. */
  reset?: { label: string; onClick: () => void };
  disabled?: boolean;
  children?: ReactNode;
}) {
  const said = lockedAbove
    ? `Locked by ${lockedAbove}`
    : scope === "class" && !own && setBy
      ? `Set by ${setBy}`
      : null;
  return (
    <div className={styles.rowMeta}>
      {said && (
        <span className={styles.who} data-locked={lockedAbove ? "" : undefined}>
          {lockedAbove && <LockMark />}
          {said}
        </span>
      )}
      {reset && (
        <Button variant="quiet" disabled={disabled} onClick={reset.onClick}>
          {reset.label}
        </Button>
      )}
      {children}
    </div>
  );
}
