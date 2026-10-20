import styles from "./Chips.module.css";
export type ChipOption<T extends string> = { value: T; label: string };
/** A multiple-choice group of large toggle chips. Each label stays on one
 * line; chips wrap as whole chips. */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: ChipOption<T>[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={styles.group}>
      {options.map((option) => {
        const pressed = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            className={styles.chip}
            onClick={() =>
              onChange(
                pressed
                  ? value.filter((entry) => entry !== option.value)
                  : options
                      .map((entry) => entry.value)
                      .filter(
                        (entry) =>
                          entry === option.value || value.includes(entry),
                      ),
              )
            }
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.mark}>
              <circle className={styles.ring} cx="8" cy="8" r="6.5" />
              <path className={styles.check} d="M3.5 8.5l3 3 6-7" />
            </svg>
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
