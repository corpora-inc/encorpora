import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { accountClient } from "../../account-client";
import { meOptions, sessionOptions } from "../../lib/query";
import type { AuthSession } from "../../auth";
import styles from "./Trial.module.css";

/** Guidance stays alongside the problem; exploring never requires a tutorial. */
export function useTrialWelcome(showGuide: boolean) {
  const [dismissed, setDismissed] = useState(false);
  const session = useQuery(sessionOptions);
  const verification = useVerificationReminder(session.data ?? null);
  return (
    <aside className={styles.welcome} aria-label="Free practice guidance">
      {showGuide && !dismissed && (
        <div>
          <div className={styles.welcomeRow}>
            <p>Try a few problems and watch AMP adapt.</p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss practice guidance"
            >
              ×
            </button>
          </div>
          <details>
            <summary>Skip to explore without changing your level</summary>
            <p>
              Skip shows the solution without changing your assessed level.
              Correct answers support harder work; mistakes help AMP find an
              easier starting point. Your answers assess you, not someone else.
            </p>
          </details>
        </div>
      )}
      {verification}
    </aside>
  );
}

function useVerificationReminder(session: AuthSession | null) {
  const me = useQuery({
    ...meOptions(session ?? { token: "", accountId: "" }),
    enabled: !!session,
  });
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const account = me.data?.signedIn ? me.data.account : null;
  if (dismissed || !account?.confirmationRequired || !account.email)
    return null;
  return (
    <div className={styles.welcomeRow}>
      <span role="status">
        {message || "Confirm your email for reminders."}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await accountClient.sendVerificationEmail({
              email: account.email!,
              callbackURL: "/try",
            });
            if (result.error) throw new Error("verification_failed");
            setMessage("Email sent. Check your inbox.");
          } catch {
            console.warn("Trial verification resend failed");
            setMessage("Email could not be sent. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sending…" : "Resend"}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss email reminder"
      >
        ×
      </button>
    </div>
  );
}
