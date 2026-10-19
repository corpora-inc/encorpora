import { useId, type InputHTMLAttributes } from "react";
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
