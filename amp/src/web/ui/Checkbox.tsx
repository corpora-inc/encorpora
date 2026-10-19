import type { ReactNode } from "react";
import styles from "./Checkbox.module.css";
/** A large, labelled confirmation control (a designed checkbox). */
export function Checkbox({
  checked,
  onChange,
  disabled = false,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      className={styles.row}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.box} aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
      <span className={styles.text}>{children}</span>
    </button>
  );
}
