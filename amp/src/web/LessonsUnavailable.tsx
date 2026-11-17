import { useState } from "react";
import { Button } from "./ui/Button";
import styles from "./LessonsUnavailable.module.css";

/** The catalog failed: what happened, and the one action that recovers. */
export function LessonsUnavailable({
  retry,
}: {
  retry: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  // Still here after a retry means it failed too: the words say so, and the
  // changed alert is announced again.
  const [again, setAgain] = useState(false);
  return (
    <div className={styles.unavailable}>
      <p role="alert">
        <strong>
          {again ? "Lessons still didn’t load." : "Lessons didn’t load."}
        </strong>{" "}
        Check your connection, then try again.
      </p>
      <Button
        variant="primary"
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void retry().finally(() => {
            setBusy(false);
            setAgain(true);
          });
        }}
      >
        Try again
      </Button>
    </div>
  );
}
