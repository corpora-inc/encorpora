import { useRef, type KeyboardEvent } from "react";
import {
  gradeShort,
  gradeTitle,
  profileGrades,
} from "../../../learning/practice-profiles";
import styles from "./Profiles.module.css";

/** Grades K to 12, one tap each: a radio group drawn as a grid of equal
 * cells, five or seven to a row on a phone and one row with room. Arrow keys
 * move along the grade axis. */
export function GradePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (grade: number) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = value ?? 0;
  const move = (event: KeyboardEvent, grade: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? profileGrades.length - 1
          : step === undefined
            ? null
            : (grade + step + profileGrades.length) % profileGrades.length;
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Grade"
      aria-disabled={disabled || undefined}
      className={styles.grades}
    >
      {profileGrades.map((grade) => (
        <button
          key={grade}
          ref={(node) => {
            refs.current[grade] = node;
          }}
          type="button"
          role="radio"
          aria-checked={grade === value}
          aria-label={gradeTitle(grade)}
          tabIndex={grade === current ? 0 : -1}
          disabled={disabled}
          className={styles.grade}
          data-grade={grade}
          onClick={() => onChange(grade)}
          onKeyDown={(event) => move(event, grade)}
        >
          {gradeShort(grade)}
        </button>
      ))}
    </div>
  );
}
