import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  LiveRow,
  LiveSignal,
  LiveSnapshot,
  LiveStatus,
} from "../../../../../schools/live/contracts";
import { EntityLink } from "../../../../nav/links";
import { reportError } from "../../../../lib/report-error";
import { useSession } from "../../../../lib/session";
import { Button, buttonClass } from "../../../../ui/Button";
import { Toast } from "../../../../ui/Toast";
import {
  dropSignal,
  liveEndedKey,
  useResolveSignal,
  useStartSession,
  useStopSession,
  type EndedView,
} from "../../../live/api";
import { useServerNow } from "../../../live/clock";
import { CockpitFrame } from "../../../live/CockpitFrame";
import {
  answeringNow,
  hereNow,
  LiveRoster,
  liveStatuses,
  type StudentLink,
} from "../../../live/LiveRoster";
import { LiveTotals } from "../../../live/LiveTotals";
import { SessionControl } from "../../../live/SessionControl";
import { SignalStrip } from "../../../live/SignalStrip";
import { useLiveStale } from "../../../live/stream-health";
import { useLiveClass } from "../../../live/useLiveClass";
import { useResetPictures } from "../api";
import { useLiveLength, useLiveSort } from "./live-sort";

type Place = { org: string; class: string };

/** The words a screen gives the cockpit: a class's, a family's. */
export type CockpitWords = {
  /** The Start button: "Start class". */
  start: string;
  /** The first column: "Student". */
  nameHeader: string;
  /** The roster, for assistive technology: "Students in this session". */
  roster: string;
  /** What Stop's question says is kept (the control's own by default). */
  kept?: string;
  /** A status's word where the screen says it differently. */
  statusWords?: Partial<Record<LiveStatus, string>>;
};

/** A short list for a family (one to four children): rows of a tablet at
 * any width, in name order, the frame at its own height, and levels as
 * each child's own setting says. */
export type ShortList = {
  /** Whether this person's level is shown (their "Show grade level"). */
  levelShown: (personId: string) => boolean;
  /** At the end of a name's line on a phone (LiveRoster's `phoneAside`). */
  phoneAside?: (row: LiveRow) => ReactNode;
};

/** What this adult may do here, from the class's `can`. */
export type CockpitPermissions = {
  /** Answer a raised hand (`signal.resolve`). */
  resolve: boolean;
  /** Give a student new pictures (`signin.manage`). */
  resetPictures: boolean;
};

/** A student opens as the student layer over the page, as on the map. */
const studentLink: StudentLink = ({ personId, className, children }) => (
  <EntityLink entity={{ kind: "student", id: personId }} className={className}>
    {children}
  </EntityLink>
);

/** A short list's one order. */
const SHORT_SORT = {
  key: "name",
  direction: "ascending",
  version: 0,
} as const;

/** The totals hold still between seconds: only a changed figure redraws. */
const Totals = memo(LiveTotals);

/**
 * The desktop frame's height: from where it starts to the foot of the
 * window, so the whole cockpit is on screen at once and only the roster
 * scrolls, inside it. Measured before paint and on resize; everything
 * above it holds a fixed height, so the measure never changes under it.
 */
function useFillHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(240);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const at = Math.round(
        element.getBoundingClientRect().top + window.scrollY,
      );
      if (at > 0) setTop(at);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return { ref, height: `max(480px, calc(100dvh - ${top}px - 16px))` };
}

/**
 * A class's live session on its Today (#2465), from `useLiveClass`: at
 * rest the session control (Start, with its length) and the requests
 * strip; while a session runs the cockpit: the clock and Stop, the totals,
 * the requests and every student. A session that ends by its own time
 * stays on screen as it ended, with the way to its report. Stop asks
 * first, then opens the report.
 *
 * The one-second clock lives here, so each second redraws the cockpit's
 * time (the clock, "last active", statuses that turn quiet) and nothing
 * else on Today.
 */
export function ClassCockpit({
  place,
  available,
  words,
  can,
  showGradeNumbers,
  link = studentLink,
  reportLink: givenReportLink,
  onStopped,
  short,
}: {
  place: Place;
  /** A session can be started here now (its students can practice, or a
   * demo). Without it, only a session already running, or one just ended,
   * shows. */
  available: boolean;
  words: CockpitWords;
  can: CockpitPermissions;
  /** Levels in the roster: staff see them. */
  showGradeNumbers: boolean;
  /** Where a student opens: by default the student layer. A family's Today
   * gives its own (a child's page). */
  link?: StudentLink;
  /** A stopped session's report, as a link: by default the class's
   * `sessions/<session>` under Time. */
  reportLink?: (sessionId: string, children: ReactNode) => ReactNode;
  /** After Stop: by default the class's report opens. Answer with the
   * move's promise: the cockpit holds its last frame until it is done. */
  onStopped?: (sessionId: string) => void | Promise<unknown>;
  /** A family's: see `ShortList`. */
  short?: ShortList;
}) {
  const session = useSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const live = useLiveClass(place);
  const ended = useQuery({
    queryKey: liveEndedKey(session, place),
    queryFn: () => null as EndedView | null,
    enabled: false,
    staleTime: Infinity,
  }).data;
  const snapshot = live.data;
  // Stop, pressed: the cockpit holds the session as it was, Stop still
  // busy, until the report has the screen. The session ending under it (the
  // read after Stop, or the stream's word) never shows the resting bar or
  // the "ended" bar for a frame on the way, and nothing below it jumps
  // (the round's rule: one frame, then the destination).
  const [leaving, setLeaving] = useState<LiveSnapshot | null>(null);
  const running = leaving?.session ?? snapshot?.session ?? null;
  // Only when nothing runs: a new session is shown live.
  const still = running ? null : (ended ?? null);
  const shown: LiveSnapshot | undefined =
    leaving ?? still?.snapshot ?? snapshot;
  const now = useServerNow(snapshot?.serverNow, still?.endedAt);
  const stale = useLiveStale(place.class);
  const [chosen, setSort] = useLiveSort(place);
  const sort = short ? SHORT_SORT : chosen;
  const [length, setLength] = useLiveLength(place);
  const start = useStartSession(place);
  const stop = useStopSession(place);
  const resolve = useResolveSignal(place);
  const reset = useResetPictures(session, place);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState("");
  const fill = useFillHeight();
  const statuses = useMemo(
    () =>
      shown?.session
        ? liveStatuses(shown.rows, {
            now,
            startedAt: shown.session.startedAt,
          })
        : new Map(),
    [shown, now],
  );
  if (!snapshot || (!available && !shown?.session)) return null;

  const settle = (signal: LiveSignal) =>
    setPending((held) => {
      const next = new Set(held);
      next.delete(signal.id);
      return next;
    });
  const act = (
    signal: LiveSignal,
    send: () => Promise<unknown>,
    doing: string,
  ) => {
    setPending((held) => new Set(held).add(signal.id));
    send()
      .then(() => dropSignal(client, session, place, signal.id))
      .catch((failure: unknown) =>
        setError(
          reportError(failure, {
            doing,
            fallback: `That didn’t go through for ${signal.name}. Try again.`,
          }),
        ),
      )
      .finally(() => settle(signal));
  };
  const onAcknowledge = can.resolve
    ? (signal: LiveSignal) =>
        act(
          signal,
          () => resolve.mutateAsync(signal.id),
          `answer ${signal.name}’s raised hand`,
        )
    : undefined;
  const onResetPictures = can.resetPictures
    ? (signal: LiveSignal) =>
        // The reset itself resolves the request on the server.
        act(
          signal,
          () => reset.mutateAsync(signal.personId),
          `give ${signal.name} new pictures`,
        )
    : undefined;
  const strip = (
    <SignalStrip
      signals={snapshot.signals}
      now={now}
      onAcknowledge={onAcknowledge}
      onResetPictures={onResetPictures}
      pending={pending}
    />
  );
  const done = () => client.setQueryData(liveEndedKey(session, place), null);
  const reportLink =
    givenReportLink ??
    ((id: string, children: ReactNode) => (
      <Link
        to="/school/$org/classes/$class/sessions/$session"
        params={{ ...place, session: id }}
        className={buttonClass("primary")}
      >
        {children}
      </Link>
    ));
  const control = (
    <SessionControl
      live={running}
      now={now}
      length={length}
      onLengthChange={setLength}
      onStart={(minutes) => {
        start.mutate(minutes === null ? {} : { minutes }, {
          onSuccess: done,
          onError: (failure) =>
            setError(
              reportError(failure, {
                doing: "start the session",
                fallback: "The session didn’t start. Try again.",
              }),
            ),
        });
      }}
      onStop={() => {
        if (!running || !snapshot.session) return;
        setLeaving(snapshot);
        stop
          .mutateAsync(running.id)
          .then((report) => {
            done();
            if (onStopped) return onStopped(report.session.id);
            return navigate({
              to: "/school/$org/classes/$class/sessions/$session",
              params: { ...place, session: report.session.id },
            });
          })
          // The report took the screen, and this cockpit with it: nothing
          // to put down. A Stop that failed is the live session again.
          .catch((failure: unknown) => {
            setLeaving(null);
            setError(
              reportError(failure, {
                doing: "stop the session",
                fallback: "The session didn’t stop. Try again.",
              }),
            );
          });
      }}
      starting={start.isPending}
      stopping={stop.isPending || leaving !== null}
      canManage={snapshot.can.manage}
      startLabel={words.start}
      stale={stale}
      keptWords={words.kept}
      ended={
        still?.snapshot.session
          ? {
              startedAt: still.snapshot.session.startedAt,
              endedAt: still.endedAt,
              actions: (
                <>
                  <Button variant="secondary" onClick={done}>
                    Done
                  </Button>
                  {reportLink(still.snapshot.session.id, "See the report")}
                </>
              ),
            }
          : null
      }
    />
  );
  const toast = <Toast message={error} onDismiss={() => setError("")} />;
  if (!shown?.session)
    return (
      <div ref={fill.ref} data-cockpit="resting">
        <CockpitFrame
          control={control}
          strip={strip}
          stickyTop="var(--shell-bar, 0px)"
        />
        {toast}
      </div>
    );
  return (
    <div ref={fill.ref} data-cockpit={still ? "ended" : "live"}>
      <CockpitFrame
        stickyTop="var(--shell-bar, 0px)"
        height={short ? undefined : fill.height}
        flow={!!short}
        control={control}
        totals={
          <Totals
            totals={shown.totals}
            hereNow={hereNow(statuses)}
            answeringNow={
              still
                ? 0
                : answeringNow(shown.rows, {
                    now,
                    startedAt: shown.session.startedAt,
                  })
            }
          />
        }
        strip={strip}
        roster={
          <LiveRoster
            rows={shown.rows}
            startedAt={shown.session.startedAt}
            now={now}
            rules={shown.rules}
            signals={snapshot.signals}
            sort={sort}
            onSortChange={setSort}
            showGradeNumbers={showGradeNumbers}
            link={link}
            label={words.roster}
            nameHeader={words.nameHeader}
            short={!!short}
            statusWords={words.statusWords}
            levelShown={short?.levelShown}
            phoneAside={short?.phoneAside}
          />
        }
      />
      {toast}
    </div>
  );
}
