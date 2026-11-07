import { useRef } from "react";
import styles from "./SearchField.module.css";

/** A search box with its magnifier and a clear button. Typing never moves the
 * box or its text. Escape clears; the length is bounded so a long paste stays
 * within route limits. */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 80,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.field}>
      <svg className={styles.glass} viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" />
        <path d="m13.2 13.2 3.6 3.6" />
      </svg>
      <input
        ref={input}
        className={styles.input}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            event.stopPropagation();
            onChange("");
          }
        }}
      />
      {value && (
        <button
          type="button"
          className={styles.clear}
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5.5 5.5 9 9m0-9-9 9" />
          </svg>
        </button>
      )}
    </div>
  );
}
