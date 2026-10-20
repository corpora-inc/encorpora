import {
  useId,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import styles from "./Controls.module.css";
export function TextField({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <input
        {...props}
        id={id}
        className={styles.input}
        aria-invalid={!!error}
        aria-describedby={`${id}-error`}
      />
      <span id={`${id}-error`} className={styles.fieldError} aria-live="polite">
        {error ?? ""}
      </span>
    </label>
  );
}
/** A multi-line field with a live character count against its limit. */
export function TextArea({
  label,
  maxLength,
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  maxLength: number;
  value: string;
}) {
  const id = useId();
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldHeading}>
        <span>{label}</span>
        <span className={styles.count} aria-hidden="true">
          {`${value.length}/${maxLength}`}
        </span>
      </span>
      <textarea
        {...props}
        id={id}
        value={value}
        maxLength={maxLength}
        className={`${styles.input} ${styles.textarea}`}
      />
    </label>
  );
}
