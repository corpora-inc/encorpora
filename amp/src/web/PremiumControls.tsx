import {
  Children,
  isValidElement,
  useId,
  useRef,
  useState,
  type SelectHTMLAttributes,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";

/** A bounded, keyboard-accessible picker shared by family and purchase forms. */
export function Select({
  children,
  value,
  onValueChange,
  disabled,
  hideEmpty = false,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  onValueChange?: (value: string) => void;
  hideEmpty?: boolean;
}) {
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const options = Children.toArray(children).filter(
    isValidElement,
  ) as ReactElement<{
    value: string | number;
    children: React.ReactNode;
    disabled?: boolean;
  }>[];
  const selected = options.find((o) => String(o.props.value) === String(value));
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  };
  const label = props["aria-label"] ?? props.name ?? "Choose an option";
  return (
    <>
      <button
        type="button"
        ref={trigger}
        data-value={String(value ?? "")}
        id={props.id}
        className={`premium-select ${props.className ?? ""}`}
        disabled={disabled}
        aria-label={label}
        aria-describedby={`${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => {
            dialog.current?.showModal();
            dialog.current
              ?.querySelector<HTMLElement>('[aria-selected="true"]')
              ?.focus();
          });
        }}
      >
        <span id={`${id}-value`}>{selected?.props.children ?? "Choose"}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className="premium-options"
            aria-label={String(label)}
            onCancel={close}
            onClick={(e) => {
              if (e.target === dialog.current) close();
            }}
          >
            <div className="premium-options-heading">
              <strong>{label}</strong>
              <button type="button" onClick={close} aria-label="Close options">
                ×
              </button>
            </div>
            <div
              role="listbox"
              id={id}
              aria-label={label}
              onKeyDown={(e) => {
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
                  return;
                e.preventDefault();
                const items = [
                  ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  ),
                ];
                const i = items.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                items[
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? items.length - 1
                      : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                        items.length
                ]?.focus();
              }}
            >
              {options
                .filter((o) => !hideEmpty || String(o.props.value) !== "")
                .map((o) => (
                  <button
                    type="button"
                    role="option"
                    data-value={String(o.props.value)}
                    aria-selected={String(o.props.value) === String(value)}
                    disabled={o.props.disabled}
                    key={String(o.props.value)}
                    onClick={() => {
                      onValueChange?.(String(o.props.value));
                      close();
                    }}
                  >
                    {o.props.children}
                  </button>
                ))}
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
export function BirthYearPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const year = new Date().getFullYear();
  return (
    <Select
      hideEmpty
      aria-label="Birth year"
      value={value}
      disabled={disabled}
      onValueChange={onChange}
    >
      <option value="">Choose birth year</option>
      {Array.from({ length: 16 }, (_, i) => year - 4 - i).map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
      <option value={year - 25}>Adult</option>
    </Select>
  );
}
