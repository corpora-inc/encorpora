import { useEffect, useMemo, useState } from "react";
import type { LiveSignal } from "../../../../schools/live/contracts";
import { liveTotals } from "../../../../schools/live/status";
import { Button } from "../../../ui/Button";
import { CockpitFrame } from "../../live/CockpitFrame";
import { answeringNow, LiveRoster, liveStatuses } from "../../live/LiveRoster";
import { LiveTotals } from "../../live/LiveTotals";
import { RecentAnswers } from "../../live/RecentAnswers";
import type { StudentLink } from "../../live/RosterRow";
import { SessionControl, type SessionLength } from "../../live/SessionControl";
import { SignalStrip } from "../../live/SignalStrip";
import { SIGNAL_WORDS, SignalGlyph } from "../../live/SignalGlyph";
import { DEFAULT_LIVE_SORT, type LiveSort } from "../../live/sort";
import { StatusMark } from "../../live/StatusMark";
import { STATUS_ORDER, STATUS_WORDS } from "../../live/status-words";
import { clockText } from "../../live/format";
import { Section, Specimen, SpecimenFrame } from "../Gallery";
import {
  fixtureState,
  makeClass,
  makeScript,
  random,
  randomChange,
  SESSION_MS,
  session,
  stateAt,
  type CockpitState,
  type LiveStateId,
} from "./fixtures";
import styles from "./LiveGallery.module.css";

/** In the gallery a student opens nothing: the link only shows where the
 * screen's EntityLink goes. */
const galleryLink: StudentLink = ({ name, className, children }) => (
  <a
    className={className}
    href="#student"
    aria-label={`Open ${name}`}
    onClick={(event) => event.preventDefault()}
  >
    {children}
  </a>
);

/** What a screen does with the parts: the gallery's own composition, the
 * same one a class's Today makes. */
function Cockpit({
  state,
  running,
  minutes,
  onStart,
  onStop,
  onResolve,
  stickyTop = 0,
  height,
}: {
  state: CockpitState;
  running: boolean;
  minutes: SessionLength;
  onStart: (length: SessionLength) => void;
  onStop: () => void;
  onResolve: (signal: LiveSignal) => void;
  stickyTop?: number;
  height?: string;
}) {
  const [sort, setSort] = useState<LiveSort>(DEFAULT_LIVE_SORT);
  const [length, setLength] = useState<SessionLength>(minutes);
  const live = running ? session(minutes) : null;
  const statuses = useMemo(
    () =>
      live
        ? liveStatuses(state.rows, {
            now: state.now,
            startedAt: live.startedAt,
          })
        : new Map(),
    [state.rows, state.now, live?.startedAt],
  );
  const control = (
    <SessionControl
      live={live}
      now={state.now}
      length={length}
      onLengthChange={setLength}
      onStart={onStart}
      onStop={onStop}
      canManage
      startLabel="Start class"
    />
  );
  if (!live) return <CockpitFrame control={control} stickyTop={stickyTop} />;
  return (
    <CockpitFrame
      stickyTop={stickyTop}
      height={height}
      control={control}
      totals={
        <LiveTotals
          totals={liveTotals(state.rows)}
          answeringNow={answeringNow(statuses)}
        />
      }
      strip={
        <SignalStrip
          signals={state.signals}
          now={state.now}
          onAcknowledge={onResolve}
          onResetPictures={onResolve}
        />
      }
      roster={
        <LiveRoster
          rows={state.rows}
          startedAt={live.startedAt}
          now={state.now}
          signals={state.signals}
          sort={sort}
          onSortChange={setSort}
          showGradeNumbers
          link={galleryLink}
          label="Students in this session"
          nameHeader="Student"
        />
      }
    />
  );
}

declare global {
  interface Window {
    /** The zero-shift check's hook (scripts/verify-live-cockpit-ui.ts):
     * one random change per call, as a stream would bring it. */
    ampLiveFixture?: { change: (seed: number) => void; ready: true };
  }
}

/** One designed state, alone in its document. */
export function LiveStateSpecimen({ id }: { id: LiveStateId }) {
  const [state, setState] = useState(() => fixtureState(id));
  const [running, setRunning] = useState(id !== "resting");
  useEffect(() => {
    window.ampLiveFixture = {
      ready: true,
      change: (seed) =>
        setState((current) => ({
          ...current,
          ...randomChange(current, random(seed)),
        })),
    };
    return () => {
      delete window.ampLiveFixture;
    };
  }, []);
  return (
    <main className={styles.page}>
      <Heading />
      <Cockpit
        state={state}
        running={running}
        minutes={20}
        height="calc(100dvh - var(--live-page-top))"
        onStart={() => setRunning(true)}
        onStop={() => setRunning(false)}
        onResolve={(signal) =>
          setState((current) => ({
            ...current,
            signals: current.signals.filter((s) => s.id !== signal.id),
          }))
        }
      />
    </main>
  );
}

function Heading() {
  return (
    <header className={styles.heading}>
      <h1>Grade 5 Math B</h1>
      <p>Monday, November 30</p>
    </header>
  );
}

const SPEED = 20;

/** The scripted five minutes, replayed at 20× through the components:
 * Start begins it, and Play, Pause and Restart drive the clock. */
export function LivePlaySpecimen() {
  const students = useMemo(() => makeClass(14), []);
  const script = useMemo(() => makeScript(students), [students]);
  const [running, setRunning] = useState(false);
  const [minutes, setMinutes] = useState<SessionLength>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [resolved, setResolved] = useState<ReadonlySet<string>>(new Set());
  // The replay's clock: an outside timer the gallery reads, never state
  // copied from props.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = window.setInterval(() => {
      const now = performance.now();
      const step = (now - last) * SPEED;
      last = now;
      setT((current) => {
        const next = Math.min(SESSION_MS, current + step);
        if (next >= SESSION_MS) setPlaying(false);
        return next;
      });
    }, 100);
    return () => window.clearInterval(tick);
  }, [playing]);
  const state = stateAt(students, script, t, resolved);
  return (
    <main className={styles.page} data-play="">
      <div className={styles.player} role="group" aria-label="Scripted session">
        <span className={styles.playerTitle}>
          Scripted session, {SPEED}× speed
        </span>
        <Button
          variant="secondary"
          disabled={!running || t >= SESSION_MS}
          onClick={() => setPlaying((on) => !on)}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            setT(0);
            setResolved(new Set());
            setRunning(true);
            setPlaying(true);
          }}
        >
          Restart
        </Button>
        <span className={styles.playerClock}>
          {clockText(t)} / {clockText(SESSION_MS)}
        </span>
      </div>
      <Cockpit
        state={state}
        running={running}
        minutes={minutes}
        height="calc(100dvh - var(--live-page-top))"
        onStart={(length) => {
          setMinutes(length);
          setT(0);
          setResolved(new Set());
          setRunning(true);
          setPlaying(true);
        }}
        onStop={() => {
          setRunning(false);
          setPlaying(false);
        }}
        onResolve={(signal) =>
          setResolved((done) => new Set([...done, signal.id]))
        }
      />
    </main>
  );
}

export const liveSpecimens = {
  "live-play": () => <LivePlaySpecimen />,
  "live-resting": () => <LiveStateSpecimen id="resting" />,
  "live-started": () => <LiveStateSpecimen id="started" />,
  "live-half": () => <LiveStateSpecimen id="half" />,
  "live-busy": () => <LiveStateSpecimen id="busy" />,
  "live-edges": () => <LiveStateSpecimen id="edges" />,
  "live-class-35": () => <LiveStateSpecimen id="class-35" />,
};

export const liveContents = {
  group: "Live",
  sections: [
    { id: "live-marks", title: "Status marks" },
    { id: "live-cockpit", title: "Live cockpit" },
  ],
};

/** The gallery's Live sections: the marks, then the cockpit in each state. */
export function LiveSections() {
  return (
    <>
      <Section
        id="live-marks"
        title="Status marks"
        source={[
          "features/live/StatusMark.tsx",
          "features/live/status-words.ts",
          "features/live/RecentAnswers.tsx",
          "features/live/SignalGlyph.tsx",
        ]}
        note="Shape and color both carry each status. The words describe what is happening, never the child."
      >
        <Specimen label="Each status, at both sizes">
          <ul className={styles.key}>
            {STATUS_ORDER.map((status) => (
              <li key={status}>
                <StatusMark status={status} size="large" decorative />
                <StatusMark status={status} decorative />
                <span>
                  <strong>{STATUS_WORDS[status].word}</strong>
                  <span className={styles.means}>
                    {STATUS_WORDS[status].means}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Specimen>
        <Specimen label="Last five answers">
          <ul className={styles.key}>
            {[
              { label: "None yet", recent: [] },
              {
                label: "Two right",
                recent: [
                  { correct: true, assisted: false },
                  { correct: true, assisted: false },
                ],
              },
              {
                label: "Mixed",
                recent: [
                  { correct: true, assisted: false },
                  { correct: false, assisted: false },
                  { correct: true, assisted: true },
                  { correct: false, assisted: true },
                  { correct: true, assisted: false },
                ],
              },
              {
                label: "Three wrong",
                recent: Array.from({ length: 3 }, () => ({
                  correct: false,
                  assisted: false,
                })),
              },
            ].map((item) => (
              <li key={item.label}>
                <RecentAnswers
                  recent={item.recent}
                  answered={item.recent.length}
                />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </Specimen>
        <Specimen label="Requests">
          <ul className={styles.key}>
            {(["hand", "forgot_picture"] as const).map((kind) => (
              <li key={kind}>
                <SignalGlyph kind={kind} />
                <span>
                  <strong>{SIGNAL_WORDS[kind].what}</strong>
                  <span className={styles.means}>
                    {SIGNAL_WORDS[kind].action}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Specimen>
      </Section>
      <Section
        id="live-cockpit"
        title="Live cockpit"
        source={[
          "features/live/CockpitFrame.tsx",
          "features/live/SessionControl.tsx",
          "features/live/LiveTotals.tsx",
          "features/live/SignalStrip.tsx",
          "features/live/LiveRoster.tsx",
        ]}
        note="Press Start (or Play) to replay a scripted five minutes at 20× speed. Rows never reorder by themselves: tap a sort to reorder."
      >
        <SpecimenFrame specimen="live-play" label="Scripted session" />
        <SpecimenFrame
          specimen="live-resting"
          label="No session running"
          height={260}
        />
        <SpecimenFrame
          specimen="live-started"
          label="Just started: nobody signed in"
        />
        <SpecimenFrame
          specimen="live-half"
          label="Half the class not signed in"
        />
        <SpecimenFrame specimen="live-busy" label="Everyone working" />
        <SpecimenFrame
          specimen="live-edges"
          label="Long names, 0 answers with 6 hints, 100% over 40, many requests"
        />
        <SpecimenFrame specimen="live-class-35" label="A class of 35" />
      </Section>
    </>
  );
}
