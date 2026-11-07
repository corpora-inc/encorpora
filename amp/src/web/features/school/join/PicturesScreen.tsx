import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  normalizeJoinCode,
  schoolPictures,
  type SchoolPicture,
} from "../../../../schools/contracts";
import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { Loading } from "../../../ui/Loading";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { queryClient } from "../../../lib/query";
import {
  finishingSignIn,
  joinRosterOptions,
  signInWithPictures,
  useFinishSignIn,
  type JoinError,
} from "./api";
import { BackLink, JoinProblem } from "./ClassScreen";
import { JoinFrame } from "./JoinFrame";
import { Picture, pictureNames } from "./pictures";
import styles from "./Join.module.css";

const PICKS = 3;
type Stop = { message: string; until: number | null };

/** `/join/$code/$person`: three pictures. The first time they're chosen, and
 * confirmed; after that the same ones in order, which sign in on the third tap.
 * A wrong try shakes and clears. Tries left are never shown. */
export function PicturesScreen() {
  const params = useParams({ from: "/join/$code/$person" });
  const code = normalizeJoinCode(params.code);
  const router = useRouter();
  const finish = useFinishSignIn();
  const [stop, setStop] = useState<Stop | null>(null);
  const roster = useQuery({
    ...joinRosterOptions(code),
    // While stopped, a teacher's reset shows up here without a reload.
    refetchInterval: stop ? 5000 : false,
  });
  const student = roster.data?.students.find((s) => s.id === params.person);
  const firstTime = student ? !student.picturesSet : false;
  const [picks, setPicks] = useState<SchoolPicture[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [shake, setShake] = useState(0);
  const clearing = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(clearing.current), []);
  // The first problem's code is on its way before it's needed.
  useEffect(() => {
    void router
      .preloadRoute({ to: "/$", params: { _splat: "practice" } })
      .catch((error) => console.warn("Practice did not preload", error));
  }, [router]);
  // A stop ends by itself at the time the server gave.
  useEffect(() => {
    if (!stop?.until) return;
    const timer = setTimeout(
      () => setStop(null),
      Math.max(0, stop.until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [stop]);
  // The teacher reset these pictures: choose new ones now.
  const wasFirstTime = useRef(firstTime);
  useEffect(() => {
    if (firstTime && !wasFirstTime.current) {
      setStop(null);
      setPicks([]);
      setMessage("");
    }
    wasFirstTime.current = firstTime;
  }, [firstTime]);

  async function send(pictures: SchoolPicture[]) {
    setBusy(true);
    setMessage("");
    setCanRetry(false);
    try {
      await finish(
        await signInWithPictures({
          code,
          personId: params.person,
          pictures,
          set: firstTime,
        }),
      );
    } catch (error) {
      const failure = error as JoinError;
      setBusy(false);
      if (
        failure.code === "pictures_not_set" ||
        failure.code === "wrong_pictures"
      )
        void queryClient.invalidateQueries({
          queryKey: joinRosterOptions(code).queryKey,
        });
      if (failure.code === "pictures_not_set") {
        setPicks([]);
        return;
      }
      // The code changed under this screen: nothing here can work now, so
      // the roster's own failure takes over and shows the way back.
      if (failure.code === "class_not_found") {
        void queryClient.resetQueries({
          queryKey: joinRosterOptions(code).queryKey,
        });
        return;
      }
      if (
        failure.code === "student_locked" ||
        failure.code === "class_locked"
      ) {
        setShake((count) => count + 1);
        setPicks([]);
        setStop({
          message: failure.message,
          until: Date.now() + (failure.retryAfter ?? 60) * 1000,
        });
        return;
      }
      if (failure.code === "wrong_pictures") {
        setShake((count) => count + 1);
        setMessage(failure.message);
        clearing.current = setTimeout(() => setPicks([]), 450);
        return;
      }
      // The pictures may be right; nothing here says otherwise. Keep them.
      setMessage(failure.message);
      if (failure.retry) setCanRetry(true);
      else setPicks([]);
    }
  }
  function pick(picture: SchoolPicture) {
    if (busy || stop) return;
    clearTimeout(clearing.current);
    if (message) setMessage("");
    setCanRetry(false);
    // Tapping one already picked takes it, and the ones after it, back.
    const at = picks.indexOf(picture);
    const next =
      at >= 0
        ? picks.slice(0, at)
        : picks.length >= PICKS
          ? [picture]
          : [...picks, picture];
    setPicks(next);
    if (next.length === PICKS && !firstTime) void send(next);
  }

  if (finishingSignIn()) return <LoadingScreen />;
  if (roster.isError && !roster.data)
    return <JoinProblem message={roster.error.message} />;
  if (!roster.data) return <LoadingScreen />;
  if (!student) return <Navigate to="/join/$code" params={{ code }} replace />;
  const confirming = firstTime && picks.length === PICKS && !busy && !stop;
  const title = stop
    ? stop.message
    : confirming
      ? "Remember these 3"
      : firstTime
        ? "Pick 3 pictures you’ll remember"
        : "Pick your 3 pictures";
  return (
    <JoinFrame
      lead={
        <BackLink
          to="/join/$code"
          params={{ code }}
          label="Back to the names"
        />
      }
    >
      <div className={styles.pictures}>
        <div className={styles.prompt}>
          <p className={styles.who}>
            <Avatar name={student.name} size="fill" />
            <span>{student.name}</span>
          </p>
          <h1
            className={styles.title}
            data-stopped={stop ? true : undefined}
            aria-live="polite"
          >
            {title}
          </h1>
          <ol
            key={shake}
            className={styles.slots}
            data-shake={shake > 0 || undefined}
            aria-label={`${picks.length} of ${PICKS} pictures picked`}
          >
            {Array.from({ length: PICKS }, (_, index) => (
              <li key={index} className={styles.slot}>
                {picks[index] ? (
                  <Picture name={picks[index]} />
                ) : (
                  <span aria-hidden="true">{index + 1}</span>
                )}
              </li>
            ))}
          </ol>
          <div className={styles.message} aria-live="polite">
            {busy ? (
              <Loading inline />
            ) : (
              message && (
                <span className={styles.problem} role="alert">
                  {message}
                </span>
              )
            )}
          </div>
        </div>
        <div className={styles.pad}>
          <div
            className={styles.grid}
            data-resting={confirming || canRetry || !!stop || busy || undefined}
            inert={confirming || canRetry || undefined}
          >
            {schoolPictures.map((picture) => (
              <button
                key={picture}
                type="button"
                className={styles.pictureButton}
                aria-label={pictureNames[picture]}
                aria-pressed={picks.includes(picture)}
                disabled={!!stop || busy || confirming}
                onClick={() => pick(picture)}
              >
                <Picture name={picture} />
              </button>
            ))}
          </div>
          {(confirming || canRetry) && (
            <div className={styles.confirm}>
              <Button
                variant="primary"
                className={styles.bigButton}
                data-main
                onClick={() => void send(picks)}
              >
                {canRetry ? "Try again" : "These are mine"}
              </Button>
              {confirming && !canRetry && (
                <Button
                  variant="secondary"
                  className={styles.bigButton}
                  onClick={() => setPicks([])}
                >
                  Pick again
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </JoinFrame>
  );
}
