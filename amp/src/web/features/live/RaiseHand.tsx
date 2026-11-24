import { useEffect, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { useSessionOrNull } from "../../lib/session";
import { useShellDrawerActions } from "../../lib/shell-slots";
import { handIsUp, useHand } from "./hand";
import styles from "./RaiseHand.module.css";
import { useStudentLive } from "./useStudentLive";

/** How long "Your teacher saw it." stays. */
export const SAW_IT_MS = 5_000;

const icon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4a1.5 1.5 0 0 1 3 0v5.5m0-3a1.5 1.5 0 0 1 3 0V13m0-4.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.7-2.3L4.4 15.6a1.6 1.6 0 0 1 2.5-2L8 15" />
  </svg>
);

/**
 * A school student's raised hand (#2464), in one place at a time. While a
 * session runs in one of their classes (a class's or a family's) it is a
 * button in the practice bar, beside the problem's own tools. With no
 * session running the bar holds nothing but the problem's tools, and the
 * hand is a row of the menu, under its destinations.
 *
 * The bar keeps the button's 44 px place either way, so a session starting
 * or stopping moves nothing. Which place that is, is settled as each problem
 * arrives (`problem`): the bar's end while a session runs, with the
 * calculator before it; with none running the calculator has the bar's end,
 * and the hand's kept place is before it, where nothing shows. So neither
 * ever stands a gap away from the edge for longer than the problem a session
 * started or stopped on. Up means the teacher has an open request; the
 * teacher answering clears it by itself and a note appears for a few
 * seconds, in a fixed place that takes no room and no focus. State is the
 * student stream's (`useStudentLive`), so a refresh or a second device shows
 * the same hand. Nothing here counts or judges how often a child asks. Not a
 * school student (a parent's device): no button.
 */
export function RaiseHand({ problem }: { problem?: string }) {
  const session = useSessionOrNull();
  if (!session?.token.startsWith("st_")) return null;
  return <Hand problem={problem} />;
}

function Hand({ problem }: { problem?: string }) {
  const { signals, inSession, query } = useStudentLive();
  // Whether a session ran as this problem arrived: where the hand's place
  // is for as long as the problem is on screen.
  const [arrived, setArrived] = useState({ problem, live: inSession });
  if (arrived.problem !== problem) setArrived({ problem, live: inSession });
  const atEnd = arrived.problem === problem ? arrived.live : inSession;
  const { raise, lower } = useHand();
  const menu = useShellDrawerActions();
  const up = handIsUp(signals);
  const toggle = () => (up ? lower() : raise());
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
    <>
      <span
        className={styles.slot}
        data-raise-hand-slot={inSession ? "live" : "rest"}
        data-at-end={atEnd ? "" : undefined}
      >
        {inSession ? (
          <button
            type="button"
            className={styles.hand}
            aria-label="Raise hand"
            aria-pressed={up}
            title={up ? "Your hand is up. Tap to lower it." : "Raise hand"}
            data-raise-hand="bar"
            onClick={toggle}
          >
            {icon}
          </button>
        ) : (
          // The button's footprint with nothing drawn: what shares the bar
          // (the calculator, Colorful's points) is where it will be when a
          // session starts.
          <span className={styles.held} aria-hidden="true">
            {icon}
          </span>
        )}
        {left > 0 && (
          <span className={styles.saw} role="status" data-hand-note="">
            Your teacher saw it.
          </span>
        )}
      </span>
      {menu &&
        createPortal(
          <MenuHand live={inSession} up={up} toggle={toggle} />,
          menu,
        )}
    </>
  );
}

/** The menu's row. It mounts as the menu opens, and whether the hand is one
 * of the menu's rows is settled then: an open menu's rows never move. A
 * session that starts meanwhile takes the row out of sight in its place (the
 * bar has the hand from that moment); one that stops shows the row the next
 * time the menu opens. */
function MenuHand({
  live,
  up,
  toggle,
}: {
  live: boolean;
  up: boolean;
  toggle: () => void;
}) {
  const [row] = useState(!live);
  if (!row) return null;
  return (
    <button
      type="button"
      className={styles.row}
      aria-label="Raise hand"
      aria-pressed={up}
      title={up ? "Your hand is up. Tap to lower it." : "Raise hand"}
      data-raise-hand="menu"
      data-away={live ? "" : undefined}
      onClick={toggle}
    >
      {icon}
      <span className={styles.rowLabel}>Raise hand</span>
      <span className={styles.rowState} aria-hidden="true">
        {up ? "Your hand is up" : ""}
      </span>
    </button>
  );
}
