import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppError } from "../lib/AppError";
import { Button, type ButtonVariant } from "./Button";
import styles from "./PrintButton.module.css";

/**
 * A print action that hands over a typeset PDF, never a browser print of the
 * page. While it downloads, the button shows the app's busy wave and keeps
 * its size. A failure floats under the button, over the page, so nothing
 * moves; it says what happened and what to do, and stays until dismissed or
 * the next try.
 */
export function PrintButton({
  children,
  variant = "secondary",
  className,
  download,
  disabled,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  /** The button's own class (the anchor around it is the component's). */
  className?: string;
  download: () => Promise<void>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const running = useRef(false);
  const id = useId();
  // The message hangs from the button's end; on a narrow screen it slides
  // back inside the viewport rather than off its edge.
  const callout = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = callout.current;
    if (!node) return;
    node.style.transform = "";
    const box = node.getBoundingClientRect();
    const margin = 16;
    const shift =
      Math.max(0, margin - box.left) -
      Math.max(0, box.right - (window.innerWidth - margin));
    if (shift) node.style.transform = `translateX(${shift}px)`;
  }, [message]);
  async function run() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage("");
    try {
      await download();
    } catch (error) {
      setMessage(
        error instanceof AppError
          ? error.message
          : "The PDF didn’t download. Try again.",
      );
      if (!(error instanceof AppError))
        console.error("AMP print failed", error);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <span className={styles.anchor}>
      <Button
        variant={variant}
        className={className}
        aria-busy={busy}
        disabled={disabled}
        aria-describedby={message ? id : undefined}
        onClick={() => void run()}
      >
        {children}
      </Button>
      {message && (
        <span ref={callout} className={styles.callout} role="alert" id={id}>
          <span>{message}</span>
          <button
            type="button"
            className={styles.dismiss}
            aria-label="Dismiss message"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </span>
      )}
    </span>
  );
}
