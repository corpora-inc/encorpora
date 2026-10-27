import { useState } from "react";
import styles from "./Navigation.module.css";

/** A fixed-length mask, so it reveals nothing about the address. */
const MASK = "••••••••••••";

/**
 * The signed-in address, hidden until asked for. Screen recordings of the menu
 * must never show it, so the real address is not rendered while hidden. The
 * drawer unmounts on close, so every opening starts hidden again.
 */
export function SignedInEmail({ email }: { email: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className={styles.emailRow}>
      {shown ? (
        <strong className={styles.email} data-email-shown>
          {email}
        </strong>
      ) : (
        <strong className={styles.email} aria-hidden="true">
          {MASK}
        </strong>
      )}
      <button
        type="button"
        className={styles.reveal}
        aria-pressed={shown}
        aria-label={shown ? "Hide email" : "Show email"}
        onClick={() => setShown((s) => !s)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="m4 4 16 16" />}
        </svg>
      </button>
    </div>
  );
}
