import { useId, type KeyboardEvent } from "react";
import styles from "./Stepper.module.css";

/** A number picked in steps: minus, the value, plus. The value is a spin
 * button (arrows, Page keys, Home and End); the buttons stay in place and
 * read as inert at the limits, so holding focus on one never drops it. */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  hideLabel = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  hideLabel?: boolean;
}) {
  const labelId = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const set = (next: number) => {
    const clamped = clamp(next);
    if (clamped !== value) onChange(clamped);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = {
      ArrowUp: value + step,
      ArrowRight: value + step,
      ArrowDown: value - step,
      ArrowLeft: value - step,
      PageUp: value + step * 4,
      PageDown: value - step * 4,
      Home: min,
      End: max,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    set(next);
  };
  // Room for the widest value, so the buttons never move as it changes.
  const width = Math.max(format(min).length, format(max).length);
  return (
    <div className={styles.stepper} role="group" aria-labelledby={labelId}>
      <span
        id={labelId}
        className={hideLabel ? styles.hiddenLabel : styles.label}
      >
        {label}
      </span>
      <div className={styles.control}>
        <button
          type="button"
          className={styles.step}
          tabIndex={-1}
          aria-label={`Decrease ${label.toLowerCase()}`}
          aria-disabled={value <= min}
          onClick={() => set(value - step)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 8h9" />
          </svg>
        </button>
        <span
          className={styles.value}
          style={{ minWidth: `${width + 2}ch` }}
          role="spinbutton"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={format(value)}
          onKeyDown={onKeyDown}
        >
          {format(value)}
        </span>
        <button
          type="button"
          className={styles.step}
          tabIndex={-1}
          aria-label={`Increase ${label.toLowerCase()}`}
          aria-disabled={value >= max}
          onClick={() => set(value + step)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 8h9M8 3.5v9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
