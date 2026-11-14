import { useId, type ReactNode } from "react";
import styles from "./Switch.module.css";

/**
 * An on/off setting that takes effect at once: a designed switch beside its
 * label, the whole row a 44 px target. For a choice that waits for a Save,
 * use a checkbox.
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
    <div className={styles.row}>
      <span className={styles.text}>
        <span id={`${id}-label`}>{label}</span>
        {detail && (
          <small id={`${id}-detail`} className={styles.detail}>
            {detail}
          </small>
        )}
      </span>
      <button
        type="button"
        role="switch"
        className={styles.switch}
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={detail ? `${id}-detail` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} aria-hidden="true" />
      </button>
    </div>
  );
}
