import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
const GRADES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;
const gradeCell = (grade: number) =>
  grade === 0 ? "K" : grade === 13 ? "College" : String(grade);
const gradeName = (grade: number) =>
  grade === 0
    ? "Kindergarten"
    : grade === 13
      ? "College level"
      : `Grade ${grade}`;

/** Kindergarten to college, one tap each: a radio group drawn as a grid of
 * equal cells, five to a row, with College across two. Arrow keys move along
 * the grades. Where a grade is optional, tapping the chosen one clears it. */
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
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusable = value ?? 0;
  const move = (event: KeyboardEvent, at: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (step === undefined) return;
    event.preventDefault();
    const next = (at + step + GRADES.length) % GRADES.length;
    onChange(GRADES[next]!);
    refs.current[next]?.focus();
  };
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel} id={id}>
        {label}
        {allowEmpty && <span className={styles.optional}> (optional)</span>}
      </span>
      <div role="radiogroup" aria-labelledby={id} className={styles.grades}>
        {GRADES.map((grade, at) => (
          <button
            key={grade}
            ref={(node) => {
              refs.current[at] = node;
            }}
            type="button"
            role="radio"
            aria-checked={grade === value}
            aria-label={gradeName(grade)}
            tabIndex={grade === focusable ? 0 : -1}
            className={styles.grade}
            data-wide={grade === 13 || undefined}
            onClick={() =>
              onChange(allowEmpty && grade === value ? null : grade)
            }
            onKeyDown={(event) => move(event, at)}
          >
            {gradeCell(grade)}
          </button>
        ))}
      </div>
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
