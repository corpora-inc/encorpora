import {
  useId,
  type ComponentPropsWithRef,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import styles from "./Controls.module.css";
import { useFieldValidation, type FieldMessages } from "./field-validation";
/** The classes of a field that is one cell of a caller's grid (the rows of
 * children a parent adds): its own box, label line, label, input and note,
 * so the grid lays out every cell alike. */
export type TextFieldCell = {
  root: string;
  head: string;
  label: string;
  input: string;
  note: string;
};

/** A one-line field. `hint` is one quiet line under it (a rule, such as a
 * password's length); `action` sits on the label's line, at its right edge
 * (a switch to another way in, a row's Remove). Neither is part of the
 * field's name. `cell` draws it as one cell of a grid, in the grid's
 * classes.
 *
 * Its native rules (`required`, `type="email"`, `minLength`, `pattern`) are
 * checked the one way every form checks them (ui/field-validation.ts): on
 * leaving the field and on submit, said in the field's reserved line, never
 * in a browser bubble. `messages` words a rule for this field; `error` (a
 * server's answer) wins over the field's own. */
export function TextField({
  label,
  error,
  hint,
  action,
  cell,
  messages,
  ref,
  onChange,
  onBlur,
  onInvalid,
  ...props
}: ComponentPropsWithRef<"input"> & {
  label: string;
  error?: string;
  hint?: string;
  action?: ReactNode;
  cell?: TextFieldCell;
  messages?: FieldMessages;
}) {
  const id = useId();
  const validation = useFieldValidation({
    label,
    error,
    messages,
    value: props.value,
    ref,
    onChange,
    onBlur,
    onInvalid,
  });
  const message = validation.message;
  const invalid = props["aria-invalid"] ?? !!message;
  const note = (className: string) => (
    <span id={`${id}-error`} className={className} aria-live="polite">
      {message && (
        <>
          <ErrorMark />
          <span>{message}</span>
        </>
      )}
    </span>
  );
  if (cell)
    return (
      <div className={cell.root}>
        <span className={cell.head}>
          <label htmlFor={id} className={cell.label}>
            {label}
          </label>
          {action}
        </span>
        <input
          {...props}
          {...validation.props}
          id={id}
          className={cell.input}
          aria-invalid={invalid}
          aria-describedby={`${id}-error`}
        />
        {note(`${cell.note} ${styles.noteMark}`)}
      </div>
    );
  // The label element holds the hint, the action and the message too: the
  // name is the label's own words, never "Email Finish the address…".
  const named =
    !props["aria-label"] && !props["aria-labelledby"]
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
        {...validation.props}
        id={id}
        className={styles.input}
        aria-invalid={invalid}
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
      {note(styles.fieldError!)}
    </label>
  );
}
/** The mark beside a field's message: a small drawn alert, in the message's
 * color, so the message reads as an error at a glance without its color. */
function ErrorMark() {
  return (
    <svg
      className={styles.errorMark}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.75" />
      <path d="M8 4.75v3.75" />
      <circle className={styles.errorDot} cx="8" cy="11.1" r="0.9" />
    </svg>
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
