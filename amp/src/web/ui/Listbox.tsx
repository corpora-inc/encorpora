import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";
import styles from "./Listbox.module.css";

export type ListboxOption = {
  value: string;
  label: string;
  /** A second, quieter line, e.g. where the choice's progress is kept. */
  detail?: string;
};

/**
 * A choice's label over its detail; read aloud as "label, detail". A long
 * label wraps between words only, never inside one (hyphens included).
 */
function OptionText({ option, id }: { option: ListboxOption; id?: string }) {
  return (
    <span id={id} className={styles.text}>
      <span className={styles.label}>
        {option.label.split(" ").map((word, index) => (
          <Fragment key={index}>
            {index > 0 && " "}
            <span className={styles.word} data-word>
              {word}
            </span>
          </Fragment>
        ))}
      </span>
      {option.detail && (
        <span className={styles.detail}>
          <span className={styles.srOnly}>, </span>
          {option.detail}
        </span>
      )}
    </span>
  );
}

/**
 * A single-choice listbox drawn as stacked rows. Focus stays on the list and
 * `aria-activedescendant` names the active row: arrows, Home and End move it,
 * Enter or Space chooses it, and a click chooses a row directly. Like a native
 * select, `onChange` runs only when the choice differs from `value`.
 */
export function Listbox({
  label,
  options,
  value,
  onChange,
  onDismiss,
  onSettle,
  id,
  listRef,
  className,
}: {
  label: string;
  options: ListboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Escape. Omitted, Escape is left to the surrounding surface. */
  onDismiss?: () => void;
  /** Any choice, including the current one; runs before `onChange`. */
  onSettle?: () => void;
  id?: string;
  listRef?: Ref<HTMLDivElement>;
  className?: string;
}) {
  const fallbackId = useId();
  const base = id ?? fallbackId;
  const selected = options.findIndex((option) => option.value === value);
  const [active, setActive] = useState(Math.max(0, selected));
  const current = Math.min(active, options.length - 1);
  const choose = (index: number) => {
    const option = options[index];
    onSettle?.();
    if (option && option.value !== value) onChange(option.value);
  };
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = options.length - 1;
    const next =
      event.key === "ArrowDown"
        ? Math.min(last, current + 1)
        : event.key === "ArrowUp"
          ? Math.max(0, current - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next !== null) {
      event.preventDefault();
      setActive(next);
      document
        .getElementById(`${base}-${next}`)
        ?.scrollIntoView?.({ block: "nearest" });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(current);
    } else if (event.key === "Escape" && onDismiss) {
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
    }
  }
  return (
    <div
      ref={listRef}
      id={base}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${base}-${current}`}
      className={`${styles.list} ${className ?? ""}`}
      onKeyDown={onKeyDown}
      onFocus={() => setActive(Math.max(0, selected))}
    >
      {options.map((option, index) => (
        <div
          key={option.value}
          id={`${base}-${index}`}
          role="option"
          aria-selected={option.value === value}
          data-value={option.value}
          data-active={index === current || undefined}
          className={styles.option}
          onPointerMove={() => setActive(index)}
          onClick={() => choose(index)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.mark}>
            <path d="m5 10.5 3.2 3L15 6.5" />
          </svg>
          <OptionText option={option} />
        </div>
      ))}
    </div>
  );
}

/**
 * A button that discloses a Listbox laid over the content below it, so
 * opening, closing and choosing never move the page. Escape, a tap outside
 * and choosing close it; Escape and choosing return focus to the button.
 */
export function ListboxDisclosure({
  label,
  options,
  value,
  onChange,
  placeholder = "Choose",
}: {
  label: string;
  options: ListboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const dismiss = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    // A surrounding modal (the navigation drawer) listens for Escape on the
    // document in the capture phase. The window sees the key first, so Escape
    // closes only this list.
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      dismiss();
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);
  return (
    <div className={styles.disclosure} ref={root}>
      <span id={`${id}-label`} className={styles.srOnly}>
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-labelledby={`${id}-label ${id}-value`}
        data-value={value ?? ""}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <OptionText
          id={`${id}-value`}
          option={selected ?? { value: "", label: placeholder }}
        />
        <svg viewBox="0 0 12 12" aria-hidden="true" className={styles.chevron}>
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>
      {open && (
        <div className={styles.popover}>
          <Listbox
            id={`${id}-list`}
            listRef={list}
            label={label}
            options={options}
            value={value}
            onDismiss={dismiss}
            onSettle={dismiss}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

/**
 * One choice among several: two or three options sit in view as rows, more
 * fold behind a button. A single option needs no control at all; callers show
 * it as text.
 */
export function ChoicePicker(props: {
  label: string;
  options: ListboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  /** The most options shown in view before they fold behind a button. */
  inlineLimit?: number;
}) {
  const { inlineLimit = 3, placeholder, ...rest } = props;
  return props.options.length <= inlineLimit ? (
    <Listbox {...rest} />
  ) : (
    <ListboxDisclosure {...rest} placeholder={placeholder} />
  );
}
