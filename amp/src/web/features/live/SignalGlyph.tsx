import type { SignalKind } from "../../../schools/live/contracts";
import styles from "./SignalGlyph.module.css";

/** Each request's words: what it is, its action in full (for a screen
 * reader and the sheet), and the action's short label for a strip that
 * must fit a 320 px phone. */
export const SIGNAL_WORDS: Record<
  SignalKind,
  { what: string; action: string; short: string }
> = {
  hand: { what: "Hand raised", action: "Acknowledge", short: "Got it" },
  forgot_picture: {
    what: "Forgot picture",
    action: "Reset pictures",
    short: "Reset",
  },
};

/** A request's kind as a small drawing: a raised hand, or a picture card
 * with a question mark. Decorative: the words beside it name it. */
export function SignalGlyph({ kind }: { kind: SignalKind }) {
  return (
    <svg
      className={styles.glyph}
      data-kind={kind}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {kind === "hand" ? (
        <path d="M8.5 12.5V6a1.5 1.5 0 0 1 3 0v5.5M11.5 11V4.5a1.5 1.5 0 0 1 3 0V11M14.5 11V6a1.5 1.5 0 0 1 3 0v8.5c0 3.9-2.7 6.5-6.2 6.5-2.2 0-3.6-.9-4.9-2.6l-2.6-3.6a1.45 1.45 0 0 1 2.3-1.8l1.4 1.6" />
      ) : (
        <>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <path d="M9.6 10a2.4 2.4 0 1 1 3.4 2.2c-.6.3-1 .8-1 1.5v.3M12 16.6v.1" />
        </>
      )}
    </svg>
  );
}
