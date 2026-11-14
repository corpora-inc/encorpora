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
/** A multi-line field. Its count against the limit shows only once the text
 * nears it (four fifths), on the label's line, so nothing moves. */
export function TextArea({
  label,
  maxLength,
  value,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  maxLength: number;
  value: string;
  /** One quiet line under the field: who reads it, what to leave out. */
  hint?: string;
}) {
  const id = useId();
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldHeading}>
        <span>{label}</span>
        <span className={styles.count} aria-hidden="true">
          {value.length >= maxLength * 0.8
            ? `${value.length}/${maxLength}`
            : ""}
        </span>
      </span>
      <textarea
        {...props}
        id={id}
        value={value}
        maxLength={maxLength}
        className={`${styles.input} ${styles.textarea}`}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <span id={`${id}-hint`} className={styles.fieldHint}>
          {hint}
        </span>
      )}
    </label>
  );
}
