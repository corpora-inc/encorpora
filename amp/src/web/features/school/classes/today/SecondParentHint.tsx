import { useState } from "react";
import type { AuthSession } from "../../../../auth";
import { SecondParentInviteSheet } from "../../../second-parent/SecondParent";
import styles from "./Today.module.css";

const key = (accountId: string) => `amp.today.second-parent.${accountId}`;
export function secondParentHintDismissed(accountId: string) {
  try {
    return localStorage.getItem(key(accountId)) === "dismissed";
  } catch (error) {
    console.warn("The second-parent line’s state couldn’t be read", error);
    return false;
  }
}

/** One quiet line on the holder's Today until there's a second parent or
 * they dismiss it. The people themselves live on the People tab. */
export function SecondParentHint({
  session,
  onDismiss,
}: {
  session: AuthSession;
  onDismiss: () => void;
}) {
  const [inviting, setInviting] = useState(false);
  return (
    <p className={styles.hint}>
      <span>
        <button
          type="button"
          className={styles.hintAction}
          onClick={() => setInviting(true)}
        >
          Add a second parent
        </button>{" "}
        — both parents’ own practice is included.
      </span>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss"
        onClick={() => {
          try {
            localStorage.setItem(key(session.accountId), "dismissed");
          } catch (error) {
            console.warn("The second-parent line stays until reload", error);
          }
          onDismiss();
        }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 4 8 8m0-8-8 8" />
        </svg>
      </button>
      {inviting && (
        <SecondParentInviteSheet
          session={session}
          onClose={() => setInviting(false)}
        />
      )}
    </p>
  );
}
