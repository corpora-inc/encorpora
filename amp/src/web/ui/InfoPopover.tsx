import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePopover } from "./popover-owner";
import styles from "./InfoPopover.module.css";

/**
 * A figure's short reading, with its details a tap away: the line stays on
 * the page, and "Details" opens the numbers behind it over the content,
 * never moving it. The details are the app's one open popover
 * (`popover-owner`): a tap outside, a scroll, Escape or Back close them, and
 * so does the button again. Opening moves focus into them, so a screen reader
 * reads them; Escape returns focus to the button.
 */
export function InfoPopover({
  children,
  details,
  title,
  label = "Details",
}: {
  /** The reading that stays on the page, if any. */
  children?: ReactNode;
  /** The button's words. */
  label?: string;
  /** What opens. */
  details: ReactNode;
  /** Names the details for assistive technology. */
  title: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ x: number; y: number } | null>(null);
  usePopover(open, {
    contains: (node) => !!root.current?.contains(node),
    anchor: () => root.current,
    close: (reason) => {
      // Escape, or focus inside: back to the button, never the page's top.
      if (
        reason === "escape" ||
        panel.current?.contains(document.activeElement)
      )
        trigger.current?.focus({ preventScroll: true });
      setOpen(false);
    },
  });
  // Placed before paint, under the button or over it, wherever it fits.
  useLayoutEffect(() => {
    const element = panel.current;
    const button = trigger.current;
    if (!open || !element || !button) return setPlace(null);
    const gap = 8;
    const edge = 8;
    const box = button.getBoundingClientRect();
    const line = root.current!.getBoundingClientRect();
    const { width, height } = element.getBoundingClientRect();
    const x = Math.min(
      innerWidth - edge - width,
      Math.max(edge, Math.min(line.left, box.right - width)),
    );
    const below = box.bottom + gap;
    const above = box.top - gap - height;
    const y =
      below + height <= innerHeight - edge
        ? below
        : above >= edge
          ? above
          : Math.max(edge, innerHeight - edge - height);
    setPlace({ x, y });
  }, [open]);
  // Once placed (a hidden element takes no focus), focus moves in.
  const placed = place !== null;
  useEffect(() => {
    if (open && placed) panel.current?.focus({ preventScroll: true });
  }, [open, placed]);
  return (
    <div
      ref={root}
      className={styles.root}
      onBlur={(event) => {
        if (open && !root.current?.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      {children != null && <div className={styles.reading}>{children}</div>}
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((was) => !was)}
      >
        <svg
          className={styles.icon}
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="10" cy="10" r="8.25" />
          <path d="M10 9v5" />
          <circle cx="10" cy="6.25" r="0.6" className={styles.dot} />
        </svg>
        {label}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={title}
          tabIndex={-1}
          className={styles.panel}
          data-tip-open=""
          style={{
            left: place?.x ?? 0,
            top: place?.y ?? 0,
            visibility: place ? undefined : "hidden",
          }}
        >
          {details}
        </div>
      )}
    </div>
  );
}
