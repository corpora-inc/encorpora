import { useRef, type KeyboardEvent } from "react";
import styles from "./OptionList.module.css";

export type Option<V extends string> = {
  value: V;
  label: string;
  detail: string;
};

/**
 * One choice among a few, each a full-width row with its name and one line
 * of what it means: the words always fit their own row, at any width. A
 * radio group with one tab stop; the arrow keys, Home and End move the
 * choice. `value` null with `unknown` says the saved choice isn't known,
 * so no row claims it.
 */
export function OptionList<V extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: readonly Option<V>[];
  value: V | null;
  onChange: (value: V) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = options.findIndex((option) => option.value === value);
  const stop = chosen >= 0 ? chosen : 0;
  const move = (event: KeyboardEvent, at: number) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[
      event.key
    ];
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : step === undefined
            ? null
            : (at + step + options.length) % options.length;
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(options[next]!.value);
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={styles.list}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={index === stop ? 0 : -1}
          disabled={disabled}
          className={styles.option}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => move(event, index)}
        >
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.text}>
            <span className={styles.label}>{option.label}</span>
            <span className={styles.detail}>{option.detail}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
