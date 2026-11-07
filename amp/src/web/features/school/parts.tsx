import { useState, type ReactNode } from "react";
import { Select } from "../../ui/Select";
import styles from "./School.module.css";

/** A screen's title and its one line, with its main action beside them. */
export function PageHead({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.pageHead}>
      <div className={styles.pageTitle}>
        <h1>{title}</h1>
        {detail !== undefined && <p>{detail}</p>}
      </div>
      {action !== undefined && (
        <div className={styles.pageAction}>{action}</div>
      )}
    </div>
  );
}

/** The reserved line for what a form says back: an error next to its cause, or
 * a confirmation. It holds its height whether or not it has anything to say. */
export function FormNote({
  error,
  status,
}: {
  error?: string | null;
  status?: string | null;
}) {
  return (
    <p
      className={styles.note}
      data-tone={error ? "error" : "status"}
      role={error ? "alert" : "status"}
    >
      {error || status || ""}
    </p>
  );
}

export const gradeLabel = (grade: number | null | undefined) =>
  grade === null || grade === undefined
    ? "Not set"
    : grade === 0
      ? "K"
      : grade === 13
        ? "College"
        : String(grade);

/** Kindergarten through college-level, as the learning model has them. */
export function GradePicker({
  value,
  onChange,
  label = "Grade",
  allowEmpty = true,
}: {
  value: number | null;
  onChange: (grade: number | null) => void;
  label?: string;
  allowEmpty?: boolean;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <Select
        aria-label={label}
        value={value === null ? "" : String(value)}
        onValueChange={(next) => onChange(next === "" ? null : Number(next))}
      >
        {allowEmpty && <option value="">Not set</option>}
        <option value="0">Kindergarten</option>
        {Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => (
          <option key={grade} value={String(grade)}>
            Grade {grade}
          </option>
        ))}
        <option value="13">College level</option>
      </Select>
    </div>
  );
}

/** Copies, says so where the button is, and never moves. */
export function CopyButton({
  text,
  label,
  copied = "Copied",
  className,
}: {
  text: string;
  label: string;
  copied?: string;
  className?: string;
}) {
  const [done, setDone] = useState<"copied" | "failed" | null>(null);
  return (
    <button
      type="button"
      className={`${styles.copy} ${className ?? ""}`}
      data-done={done ?? undefined}
      onClick={() => {
        void navigator.clipboard
          .writeText(text)
          .then(() => setDone("copied"))
          .catch((error) => {
            console.error("The link could not be copied", error);
            setDone("failed");
          })
          .finally(() => {
            setTimeout(() => setDone(null), 2400);
          });
      }}
    >
      <span className={styles.copySizer} aria-hidden="true">
        {label.length > copied.length ? label : copied}
      </span>
      <span className={styles.copyText} aria-live="polite">
        {done === "copied"
          ? copied
          : done === "failed"
            ? "Press to retry"
            : label}
      </span>
    </button>
  );
}

export const roleNames: Record<string, string> = {
  admin: "Admin",
  teacher: "Teacher",
  aide: "Aide",
  viewer: "Viewer",
};
