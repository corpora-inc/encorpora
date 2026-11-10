import { useId, useRef, useState } from "react";
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
  children: string;
  variant?: ButtonVariant;
  className?: string;
  download: () => Promise<void>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const running = useRef(false);
  const id = useId();
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
    <span className={`${styles.anchor} ${className ?? ""}`}>
      <Button
        variant={variant}
        aria-busy={busy}
        disabled={disabled}
        aria-describedby={message ? id : undefined}
        onClick={() => void run()}
      >
        {children}
      </Button>
      {message && (
        <span className={styles.callout} role="alert" id={id}>
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
