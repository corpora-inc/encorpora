import { useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Segmented.module.css";
export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  detail?: ReactNode;
  badge?: string;
};
/** A single-choice radio group drawn as equal, large segments. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Short choices (30/45/60 min, Letter/A4): content centred in equal
   * cells, one line each, with type that steps down on the narrowest
   * phones. */
  compact?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  function move(event: KeyboardEvent, index: number) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={`${styles.group} ${compact ? styles.compact : ""}`}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === current ? 0 : -1}
            disabled={disabled}
            className={styles.segment}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
          >
            <span className={styles.label}>{option.label}</span>
            {option.detail !== undefined && (
              <span className={styles.detail}>{option.detail}</span>
            )}
            {/* Badges keep one height across a group; a compact group with
                no badge draws no empty row. */}
            {(!compact || options.some((o) => o.badge)) && (
              <span className={styles.badge} aria-hidden={!option.badge}>
                {option.badge ?? "\u00a0"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
