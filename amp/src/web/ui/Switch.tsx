import { useId, type ReactNode } from "react";
import styles from "./Switch.module.css";

/**
 * An on/off setting that takes effect at once: the whole row is the switch
 * (at least 44 px tall and as wide as its column), its label on the left and
 * a designed track on the right. For a choice that waits for a Save, use a
 * checkbox.
 */
export function Switch({
  checked,
  onChange,
  label,
  detail,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** One quiet line under the label. */
  detail?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      className={styles.row}
      aria-checked={checked}
      aria-label={label}
      aria-describedby={detail ? `${id}-detail` : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.text} aria-hidden="true">
        <span>{label}</span>
        {detail && <small className={styles.detail}>{detail}</small>}
      </span>
      {detail && (
        <span id={`${id}-detail`} className={styles.hidden}>
          {detail}
        </span>
      )}
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </button>
  );
}
