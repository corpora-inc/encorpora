import { useState, type ReactNode } from "react";
import styles from "./Changed.module.css";

/**
 * Marks a value that just changed, in place: a brief tint behind it
 * (`flash`) or a small settle (`pop`). Nothing changes size, and with
 * reduced motion nothing moves. The first paint is still; only a change
 * after it is marked.
 */
export function Changed({
  value,
  children,
  className = "",
  motion = "flash",
}: {
  /** What, when it changes, counts as a change. */
  value: string | number;
  children: ReactNode;
  className?: string;
  motion?: "flash" | "pop";
}) {
  const [seen, setSeen] = useState({ value, changes: 0 });
  if (seen.value !== value) setSeen({ value, changes: seen.changes + 1 });
  return (
    <span
      key={seen.changes}
      className={`${styles.changed} ${className}`}
      data-changed={seen.changes > 0 ? motion : undefined}
    >
      {children}
    </span>
  );
}
