import { useEffect, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { useSessionOrNull } from "../../lib/session";
import { useShellDrawerActions } from "../../lib/shell-slots";
import { handIsUp, useHand } from "./hand";
import styles from "./RaiseHand.module.css";
import { useStudentLive } from "./useStudentLive";

/** How long "Your teacher saw it." stays. */
export const SAW_IT_MS = 5_000;

/** The adult who answers a hand, in the place's own word: a parent in a
 * family's class, a teacher in any other. The server says which of the
 * student's classes are a family's (`familyClasses`), the same fact the
 * pictures screen reads from its roster ("Ask your parent…"). */
export const adultOf = (
  classId: string | undefined,
  familyClasses: readonly string[] | undefined,
) => (classId && familyClasses?.includes(classId) ? "parent" : "teacher");

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
 * started or stopped on. Up means the adult has an open request; the
 * adult answering clears it by itself and a note appears for a few
 * seconds ("Your teacher saw it."; in a family, "Your parent saw it."), in
 * a fixed place that takes no room and no focus. State is the
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
  // Whether the hand is one of the open menu's rows: settled as the menu
  // opens, for as long as it is open (an open menu's rows never move). A
  // session that starts meanwhile takes the row out of sight in its place
  // (the bar has the hand from that moment); one that stops shows the row
  // the next time the menu opens.
  const [opened, setOpened] = useState({ menu, row: !inSession });
  if (opened.menu !== menu) setOpened({ menu, row: !inSession });
  const row = opened.menu === menu ? opened.row : !inSession;
  const up = handIsUp(signals);
  const toggle = () => (up ? lower() : raise());
  const [, tick] = useReducer((n: number) => n + 1, 0);
  // A resolved hand the adult saw, while it is fresh by the server's clock.
  const seen = up
    ? undefined
    : signals
        .filter((s) => s.kind === "hand" && s.resolution === "acknowledged")
        .map((s) => ({ at: Date.parse(s.resolvedAt ?? ""), in: s.classId }))
        .filter((s) => Number.isFinite(s.at))
        .sort((a, b) => b.at - a.at)[0];
  const saw = seen?.at;
  const serverNow = query.data
    ? Date.parse(query.data.serverNow) + (Date.now() - query.dataUpdatedAt)
    : 0;
  const left = saw === undefined ? 0 : saw + SAW_IT_MS - serverNow;
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(tick, left);
    return () => clearTimeout(timer);
  }, [left]);
  const sawIt = `Your ${adultOf(seen?.in, query.data?.familyClasses)} saw it.`;
  // The menu is open with the hand's row on view in it.
  const inRow = !!menu && row && !inSession;
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
        {/* The answer shows where the child is looking: with the hand's
            row on view in the open menu, there, where "Your hand is up"
            was; otherwise here. */}
        {left > 0 && !inRow && (
          <span className={styles.saw} role="status" data-hand-note="">
            {sawIt}
          </span>
        )}
      </span>
      {menu &&
        row &&
        createPortal(
          <MenuHand
            live={inSession}
            up={up}
            saw={left > 0 ? sawIt : ""}
            toggle={toggle}
          />,
          menu,
        )}
    </>
  );
}

/** The menu's row, while the menu is open and the hand is one of its rows
 * (settled as it opened, in `Hand`). Its end says the hand's state in one
 * place of one width: "Your hand is up", then, once the adult has seen it,
 * the answer for a few seconds ("Your teacher saw it."), then nothing. A
 * session that starts meanwhile takes the row out of sight in its place. */
function MenuHand({
  live,
  up,
  saw,
  toggle,
}: {
  live: boolean;
  up: boolean;
  /** The adult's answer while it is fresh, else "". */
  saw: string;
  toggle: () => void;
}) {
  const answered = !up && saw !== "";
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
      <span
        className={styles.rowState}
        {...(answered
          ? { role: "status", "data-hand-note": "menu" }
          : { "aria-hidden": true })}
      >
        {up ? "Your hand is up" : saw}
      </span>
    </button>
  );
}
