import {
  useId,
  type ComponentPropsWithRef,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import styles from "./Controls.module.css";
/** A one-line field. `hint` is one quiet line under it (a rule, such as a
 * password's length); `action` sits on the label's line, at its right edge
 * (a switch to another way in). Neither is part of the field's name. */
export function TextField({
  label,
  error,
  hint,
  action,
  ...props
}: ComponentPropsWithRef<"input"> & {
  label: string;
  error?: string;
  hint?: string;
  action?: ReactNode;
}) {
  const id = useId();
  // The label element holds the hint and the action too: the name is the
  // label's own words.
  const named =
    (hint || action) && !props["aria-label"] && !props["aria-labelledby"]
      ? { "aria-labelledby": `${id}-label` }
      : {};
  const title = <span id={`${id}-label`}>{label}</span>;
  return (
    <label className={styles.field} htmlFor={id}>
      {action ? (
        <span className={styles.fieldHeading}>
          {title}
          {action}
        </span>
      ) : (
        title
      )}
      <input
        {...props}
        {...named}
        id={id}
        className={styles.input}
        aria-invalid={!!error}
        // A caller's own description (a help line elsewhere) is kept beside
        // the hint's and the error's.
        aria-describedby={[
          props["aria-describedby"],
          hint && `${id}-hint`,
          `${id}-error`,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {hint && (
        <span id={`${id}-hint`} className={styles.fieldHint}>
          {hint}
        </span>
      )}
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
