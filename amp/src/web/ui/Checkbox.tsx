import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import styles from "./Checkbox.module.css";

/** The native control shared by settings, confirmations and answer choices.
 * Compose it inside a label, or provide an accessible name with aria-label. */
export const CheckboxControl = forwardRef<
  HTMLInputElement,
  Omit<ComponentPropsWithoutRef<"input">, "type">
>(function CheckboxControl({ className, ...props }, ref) {
  return (
    <span className={styles.control}>
      <input
        {...props}
        ref={ref}
        type="checkbox"
        className={[styles.input, className].filter(Boolean).join(" ")}
      />
      <span className={styles.box} aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
    </span>
  );
});

/** A full-width confirmation row using the shared native control. */
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
    <label className={styles.row}>
      <CheckboxControl
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.text}>{children}</span>
    </label>
  );
}
