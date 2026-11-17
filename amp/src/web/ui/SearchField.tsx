import { useRef, type KeyboardEvent, type Ref } from "react";
import styles from "./SearchField.module.css";

/** A search box with its magnifier and a clear button. Typing never moves the
 * box or its text. Escape clears (or does what `onEscape` says); the length
 * is bounded so a long paste stays within route limits. The whole box is a
 * label: a tap on the magnifier focuses the field. */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 80,
  searchbox = false,
  className,
  inputRef,
  onFocus,
  onBlur,
  onEnter,
  onEscape,
  onKeyDown,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  /** A search over the whole product (role `searchbox`), not a list filter. */
  searchbox?: boolean;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
  onFocus?: () => void;
  onBlur?: () => void;
  onEnter?: () => void;
  /** Escape's job here, in place of clearing the text. */
  onEscape?: () => void;
  /** Other keys (arrows into results), after Enter and Escape. */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const own = useRef<HTMLInputElement>(null);
  return (
    <label className={`${styles.field} ${className ?? ""}`}>
      <svg className={styles.glass} viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" />
        <path d="m13.2 13.2 3.6 3.6" />
      </svg>
      <input
        ref={(node) => {
          own.current = node;
          if (typeof inputRef === "function") inputRef(node);
          else if (inputRef) inputRef.current = node;
        }}
        className={styles.input}
        type="text"
        role={searchbox ? "searchbox" : undefined}
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") onEnter?.();
          else if (event.key === "Escape" && onEscape) {
            event.preventDefault();
            onEscape();
            return;
          } else if (event.key === "Escape" && value) {
            event.preventDefault();
            event.stopPropagation();
            onChange("");
            return;
          }
          onKeyDown?.(event);
        }}
      />
      {/* Its place is kept while there is nothing to clear, so the first
          key never narrows the field (premium rule 1). */}
      <button
        type="button"
        className={styles.clear}
        aria-label={`Clear ${label.toLowerCase()}`}
        aria-hidden={value ? undefined : true}
        tabIndex={value ? undefined : -1}
        disabled={!value}
        data-empty={value ? undefined : ""}
        onClick={() => {
          onChange("");
          own.current?.focus();
        }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5.5 5.5 9 9m0-9-9 9" />
        </svg>
      </button>
    </label>
  );
}
