import { useEffect, useReducer } from "react";
import { useSessionOrNull } from "../../lib/session";
import { handIsUp, useHand } from "./hand";
import styles from "./RaiseHand.module.css";
import { useStudentLive } from "./useStudentLive";

/** How long "Your teacher saw it." stays. */
export const SAW_IT_MS = 5_000;

/**
 * A school student's raised hand, in the practice bar (#2464). Up means the
 * teacher has an open request; the teacher answering clears it by itself and
 * a note appears for a few seconds, in a fixed place that takes no room and
 * no focus. State is the student stream's (`useStudentLive`), so a refresh or
 * a second device shows the same hand. Nothing here counts or judges how
 * often a child asks. Not a school student (a parent's device): no button.
 */
export function RaiseHand() {
  const session = useSessionOrNull();
  if (!session?.token.startsWith("st_")) return null;
  return <Hand />;
}

function Hand() {
  const { signals, query } = useStudentLive();
  const { raise, lower } = useHand();
  const up = handIsUp(signals);
  const [, tick] = useReducer((n: number) => n + 1, 0);
  // A resolved hand the teacher saw, while it is fresh by the server's clock.
  const saw = up
    ? undefined
    : signals
        .filter((s) => s.kind === "hand" && s.resolution === "acknowledged")
        .map((s) => Date.parse(s.resolvedAt ?? ""))
        .filter((at) => Number.isFinite(at))
        .sort((a, b) => b - a)[0];
  const serverNow = query.data
    ? Date.parse(query.data.serverNow) + (Date.now() - query.dataUpdatedAt)
    : 0;
  const left = saw === undefined ? 0 : saw + SAW_IT_MS - serverNow;
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(tick, left);
    return () => clearTimeout(timer);
  }, [left]);
  return (
    <span className={styles.slot}>
      <button
        type="button"
        className={styles.hand}
        aria-label="Raise hand"
        aria-pressed={up}
        title={up ? "Your hand is up. Tap to lower it." : "Raise hand"}
        onClick={() => (up ? lower() : raise())}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4a1.5 1.5 0 0 1 3 0v5.5m0-3a1.5 1.5 0 0 1 3 0V13m0-4.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.7-2.3L4.4 15.6a1.6 1.6 0 0 1 2.5-2L8 15" />
        </svg>
      </button>
      {left > 0 && (
        <span className={styles.saw} role="status">
          Your teacher saw it.
        </span>
      )}
    </span>
  );
}
