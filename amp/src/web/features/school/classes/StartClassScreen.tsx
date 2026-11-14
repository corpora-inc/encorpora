import { useCloseClick } from "../../../nav/links";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Avatar } from "../../../ui/Avatar";
import { Button, buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { publicOrigin } from "../../../app/route-head";
import { QrCode } from "../../../ui/QrCode";
import { CodeTiles } from "../join/CodeTiles";
// The reset for the legacy global element rules, under `data-dense`.
import "../SchoolFrame.module.css";
import { presenceOptions, useStaffSession } from "./api";
import styles from "./Start.module.css";
import {
  ClosedSignIn,
  practiceClosed,
  useClassAccess,
} from "../pilots/ClassAccess";

const POLL_MS = 4000;
/** Sized to the room: fewer students, bigger names. */
const tier = (count: number) =>
  count <= 12 ? "s" : count <= 24 ? "m" : count <= 35 ? "l" : "xl";
/** What to type. Locally this still reads as the real address, on film too. */
const joinHost = () =>
  import.meta.env.DEV ? new URL(publicOrigin).host : location.host;

/** A projector left on through the lesson stays on. */
function useKeepAwake() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let done = false;
    const acquire = async () => {
      try {
        const next = await (
          navigator as unknown as {
            wakeLock?: {
              request: (type: "screen") => Promise<typeof lock>;
            };
          }
        ).wakeLock?.request("screen");
        if (done) void next?.release();
        else lock = next ?? null;
      } catch (error) {
        console.warn("The screen may sleep during Start class", error);
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", visible);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", visible);
      void lock?.release();
    };
  }, []);
}

function ExpandMark({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={styles.mark} aria-hidden="true">
      <path
        d={
          on
            ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
            : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        }
      />
    </svg>
  );
}

/** `.../start`: the board on the wall. A huge code, a big QR, and every name,
 * lighting up as each student arrives. Nothing here ever moves: names hold
 * their places, and the count and wave change in place. */
export function StartClassScreen() {
  const params = useParams({ from: "/school/$org/classes/$class/start" });
  const session = useStaffSession();
  const presence = useQuery({
    ...presenceOptions(session, { org: params.org, class: params.class }),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    placeholderData: keepPreviousData,
  });
  // The code reaches students only while practice runs (R14).
  const access = useClassAccess({ org: params.org, class: params.class });
  useKeepAwake();
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const changed = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const failing = presence.isError && !!presence.data;
  const logged = useRef(false);
  useEffect(() => {
    if (failing && !logged.current)
      console.error("Start class stopped updating", presence.error);
    logged.current = failing;
  }, [failing, presence.error]);

  // Back to where the board was opened: Today, the map, the roster.
  const closeClick = useCloseClick(
    `/school/${params.org}/classes/${params.class}`,
  );
  const exit = (
    <Link
      to="/school/$org/classes/$class"
      params={params}
      className={buttonClass("secondary", styles.exit)}
      onClick={closeClick}
    >
      Exit
    </Link>
  );
  if (presence.isError && !presence.data)
    return (
      <main className={styles.problem} data-dense>
        <EmptyState title="The board didn’t load" action={exit}>
          {presence.error.message}
        </EmptyState>
      </main>
    );
  if (!presence.data || access.pending) return <LoadingScreen />;
  if (practiceClosed(access.view))
    return (
      <main className={styles.problem} data-dense>
        <ClosedSignIn
          place={{ org: params.org, class: params.class }}
          also={exit}
        />
      </main>
    );
  const { class: info, students } = presence.data;
  const here = students.filter((student) => student.here).length;
  const joinUrl = `${location.origin}/join/${info.joinCode}`;
  return (
    <main className={styles.board} data-dense>
      <header className={styles.bar}>
        <h1 className={styles.className}>{info.name}</h1>
        <div className={styles.controls}>
          {document.fullscreenEnabled && (
            <Button
              variant="quiet"
              className={styles.iconButton}
              aria-label={fullscreen ? "Leave full screen" : "Full screen"}
              onClick={() => {
                const change = fullscreen
                  ? document.exitFullscreen()
                  : document.documentElement.requestFullscreen();
                void change.catch((error) =>
                  console.warn("Full screen did not change", error),
                );
              }}
            >
              <ExpandMark on={fullscreen} />
            </Button>
          )}
          {exit}
        </div>
      </header>
      <section className={styles.hero}>
        <div className={styles.how}>
          <p
            className={styles.code}
            role="img"
            aria-label={`Class code ${[...info.joinCode].join(" ")}`}
          >
            <CodeTiles code={info.joinCode} solid />
          </p>
          <p className={styles.instruction}>
            Go to <strong>{joinHost()}/join</strong> and type this code.
          </p>
        </div>
        <QrCode
          className={styles.qr}
          value={joinUrl}
          label="QR code that opens this class's sign-in"
        />
      </section>
      <div className={styles.progress}>
        <div className={styles.wave} aria-hidden="true">
          <span
            className={styles.waveFill}
            style={{
              transform: `scaleX(${students.length ? here / students.length : 0})`,
            }}
          />
        </div>
        <p className={styles.count} aria-live="polite">
          <strong>{here}</strong> of {students.length} here
        </p>
      </div>
      {students.length ? (
        <div className={styles.namesArea}>
          <ul
            className={styles.names}
            data-tier={tier(students.length)}
            style={{ "--count": students.length } as CSSProperties}
          >
            {students.map((student) => (
              <li
                key={student.id}
                className={styles.name}
                data-here={student.here || undefined}
              >
                <Avatar name={student.name} size="fill" />
                <span className={styles.nameText}>{student.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.empty}>
          Names appear here once students are added to this class.
        </p>
      )}
      <p className={styles.stale} role="status" data-on={failing || undefined}>
        {failing ? "Reconnecting to AMP" : ""}
      </p>
    </main>
  );
}
