import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { LiveSession } from "../../../../schools/live/contracts";
import { standing } from "../../../lib/AppError";
import { reportError } from "../../../lib/report-error";
import { useSession } from "../../../lib/session";
import bar from "../../../ui/AppBar.module.css";
import { Toast } from "../../../ui/Toast";
import { liveOptions, useStartSession } from "../../live/api";
import { useSecond } from "../../live/clock";
import { sessionClock } from "../../live/SessionControl";
import { classYearOptions } from "../org/org-api";
import type { ClassSessionActionProps } from "./session-action-slot";
import { useLiveLength } from "./today/live-sort";
import styles from "./ClassSessionAction.module.css";

/**
 * The bar's action in a class (#2465). Start class starts a live session
 * (with the length chosen on Today) and lands on Today, where the cockpit
 * is. While a session runs, every other tab's bar says so, with its clock,
 * and leads back to it. On Today itself the page's own session control is
 * the action, so the bar's slot is held empty. Both words always take the
 * slot's room, so the tabs beside it never move.
 */
export function ClassSessionAction({
  org,
  classId,
  today,
}: ClassSessionActionProps) {
  const place = { org, class: classId };
  const session = useSession();
  const navigate = useNavigate();
  const can =
    standing(
      useQuery({
        ...classYearOptions(session, classId),
        refetchOnMount: false,
      }),
    )?.can ?? [];
  const live = useQuery({
    ...liveOptions(session, place),
    enabled: can.includes("session.read"),
    // Away from Today there is no stream: a quiet look now and then, so a
    // session started or stopped elsewhere shows here too.
    refetchInterval: today ? false : 60_000,
    refetchOnWindowFocus: !today,
  });
  const [length] = useLiveLength(place);
  const start = useStartSession(place);
  const [error, setError] = useState("");
  const running = live.data?.session ?? null;
  const manage = can.includes("session.manage");
  const state = today ? "held" : running ? "live" : manage ? "start" : "held";
  const toToday = () =>
    navigate({ to: "/school/$org/classes/$class/today", params: place });
  return (
    <>
      <span
        className={styles.slot}
        data-class-action=""
        data-session-action={state}
        style={{ visibility: state === "held" ? "hidden" : undefined }}
        aria-hidden={state === "held" || undefined}
      >
        {state === "live" && running ? (
          <Link
            to="/school/$org/classes/$class/today"
            params={place}
            className={`${bar.actionLink} ${styles.action}`}
            data-shell-action
          >
            <Running live={running} />
          </Link>
        ) : (
          <button
            type="button"
            className={`${bar.actionLink} ${styles.action}`}
            data-shell-action
            aria-label="Start class"
            aria-busy={start.isPending || undefined}
            disabled={state !== "start" || start.isPending}
            tabIndex={state === "start" ? undefined : -1}
            onClick={() =>
              start.mutate(length === null ? {} : { minutes: length }, {
                onSuccess: () => void toToday(),
                onError: (failure) =>
                  setError(
                    reportError(failure, {
                      doing: "start the session",
                      fallback: "The session didn’t start. Try again.",
                    }),
                  ),
              })
            }
          >
            <Words live={false} />
          </button>
        )}
      </span>
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}

/** Both labels, one over the other: the slot is as wide as the wider. */
function Words({ live, clock = "0:00" }: { live: boolean; clock?: string }) {
  return (
    <span className={styles.words}>
      <span className={styles.word} data-shown={!live || undefined}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" />
        </svg>
        <span className={bar.actionLabel}>Start class</span>
      </span>
      <span className={styles.word} data-shown={live || undefined}>
        <span className={styles.pulse} aria-hidden="true" />
        <span className={bar.actionLabel}>
          Live <span className={styles.clock}>{clock}</span>
        </span>
      </span>
    </span>
  );
}

/** A running session's clock, ticking here only. */
function Running({ live }: { live: LiveSession }) {
  const now = useSecond();
  const clock = sessionClock(live, now);
  return (
    <>
      <span className={styles.srOnly}>
        Live session, {clock.text} {clock.detail}
      </span>
      <span aria-hidden="true">
        <Words live clock={clock.text} />
      </span>
    </>
  );
}
