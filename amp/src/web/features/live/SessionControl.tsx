import { useState, type ReactNode } from "react";
import type { LiveSession } from "../../../schools/live/contracts";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Segmented } from "../../ui/Segmented";
import { Stepper } from "../../ui/Stepper";
import { clockText } from "./format";
import styles from "./SessionControl.module.css";

/** A session's planned lengths, in minutes; `null` is no set length. */
export const SESSION_LENGTHS = [null, 10, 15, 20, 30] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];

const lengthWord = (minutes: SessionLength) =>
  minutes === null ? "No limit" : `${minutes} min`;

/** Where the clock stands: counting down to a planned end, else up. */
export function sessionClock(session: LiveSession, now: number) {
  const elapsed = Math.max(0, now - Date.parse(session.startedAt));
  if (session.plannedEndAt === null)
    return {
      text: clockText(elapsed),
      detail: "elapsed",
      plan: "",
      ending: false,
    };
  const left = Math.max(0, Date.parse(session.plannedEndAt) - now);
  return {
    text: clockText(left),
    detail: "left",
    plan: ` of ${Math.round(
      (Date.parse(session.plannedEndAt) - Date.parse(session.startedAt)) /
        60_000,
    )} min`,
    ending: left <= 60_000,
  };
}

export type SessionControlProps = {
  /** The running session, or null at rest. */
  live: LiveSession | null;
  now: number;
  /** The length chosen for the next start. */
  length: SessionLength;
  onLengthChange: (length: SessionLength) => void;
  onStart: (length: SessionLength) => void;
  onStop: () => void;
  starting?: boolean;
  stopping?: boolean;
  /** Whether this adult may start and stop (`can.manage`). */
  canManage: boolean;
  /** The start button's words: "Start class", "Start practice". */
  startLabel: string;
  /** The live numbers may be old (the device is offline, or nothing has
   * come for a while): the live mark says "Offline" in its place. */
  stale?: boolean;
  /** A session that ended while the adult watched, shown in the same bar:
   * when it started and ended, and the screen's own ways on (its report,
   * Done). Only while nothing runs. */
  ended?: {
    startedAt: string;
    endedAt: number;
    actions: ReactNode;
  } | null;
};

const timeOfDay = (at: number) =>
  new Date(at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * The session's one control, a fixed bar (56 px on a phone). At rest: Start,
 * with an optional length (no limit, 10, 15, 20 or 30 minutes). Running: a
 * live mark, the clock (counting down to a planned end, else up, in
 * tabular figures) and Stop, which asks first in the app's own dialog.
 */
export function SessionControl(props: SessionControlProps) {
  const { live, canManage, ended } = props;
  return (
    <div
      className={styles.bar}
      data-live-control=""
      data-state={live ? "live" : ended ? "ended" : "resting"}
    >
      {live ? (
        <Running {...props} live={live} />
      ) : ended ? (
        <Ended {...ended} />
      ) : canManage ? (
        <Resting {...props} />
      ) : (
        <p className={styles.quiet}>No session running</p>
      )}
    </div>
  );
}

/** A session that has ended: the mark, when, how long, and the ways on. */
function Ended({
  startedAt,
  endedAt,
  actions,
}: NonNullable<SessionControlProps["ended"]>) {
  const minutes = Math.max(
    0,
    Math.round((endedAt - Date.parse(startedAt)) / 60_000),
  );
  return (
    <>
      <span className={styles.ended}>Ended</span>
      <span className={styles.endedWhen}>
        <span className={styles.endedTime}>{timeOfDay(endedAt)}</span>
        <span className={styles.detail}>
          {minutes < 1 ? "under a minute" : `${minutes} min`}
        </span>
      </span>
      <span className={styles.endedActions}>{actions}</span>
    </>
  );
}

function Resting({
  length,
  onLengthChange,
  onStart,
  starting = false,
  startLabel,
}: SessionControlProps) {
  const index = Math.max(0, SESSION_LENGTHS.indexOf(length));
  return (
    <>
      <Button
        variant="primary"
        className={styles.start}
        aria-busy={starting || undefined}
        disabled={starting}
        onClick={() => onStart(length)}
      >
        <span>{startLabel}</span>
      </Button>
      {/* Wide: every length at once. Narrow: a stepper through them. */}
      <div className={styles.lengthWide}>
        <Segmented
          label="Session length"
          options={SESSION_LENGTHS.map((minutes) => ({
            value: String(minutes),
            label: minutes === null ? "No limit" : `${minutes} min`,
          }))}
          value={String(length)}
          onChange={(value) =>
            onLengthChange(
              value === "null" ? null : (Number(value) as SessionLength),
            )
          }
          compact
          dense
        />
      </div>
      <div className={styles.lengthNarrow}>
        <Stepper
          label="Session length"
          hideLabel
          value={index}
          min={0}
          max={SESSION_LENGTHS.length - 1}
          format={(at) => lengthWord(SESSION_LENGTHS[at] ?? null)}
          onChange={(at) => onLengthChange(SESSION_LENGTHS[at] ?? null)}
        />
      </div>
    </>
  );
}

function Running({
  live: session,
  now,
  onStop,
  stopping = false,
  canManage,
  stale = false,
}: SessionControlProps & { live: LiveSession }) {
  const [asking, setAsking] = useState(false);
  const clock = sessionClock(session, now);
  const minutes = Math.floor(
    Math.max(0, now - Date.parse(session.startedAt)) / 60_000,
  );
  return (
    <>
      {/* Both words hold the mark's width, so neither moves the clock. */}
      <span className={styles.live} data-stale={stale || undefined}>
        <span className={styles.pulse} aria-hidden="true" />
        <span className={styles.liveWords}>
          <span aria-hidden={stale || undefined}>Live</span>
          <span aria-hidden={!stale || undefined}>Offline</span>
        </span>
      </span>
      <span
        className={styles.clock}
        data-ending={clock.ending || undefined}
        role="timer"
        aria-label={`Session clock, ${clock.text} ${clock.detail}${clock.plan}`}
      >
        <span className={styles.time}>{clock.text}</span>
        <span className={styles.detail}>
          {clock.detail}
          <span className={styles.plan}>{clock.plan}</span>
        </span>
      </span>
      {canManage && (
        <Button
          variant="secondary"
          className={styles.stop}
          aria-busy={stopping || undefined}
          disabled={stopping}
          onClick={() => setAsking(true)}
        >
          <span>Stop</span>
        </Button>
      )}
      <Dialog open={asking} onOpenChange={setAsking} title="Stop the session?">
        <div className={styles.confirm}>
          <p>
            {minutes < 1
              ? "It has run for less than a minute."
              : `It has run for ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`}{" "}
            Students keep their work, and the session’s report is kept.
          </p>
          <div className={styles.confirmActions}>
            <Button variant="secondary" onClick={() => setAsking(false)}>
              Keep going
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setAsking(false);
                onStop();
              }}
            >
              Stop session
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
