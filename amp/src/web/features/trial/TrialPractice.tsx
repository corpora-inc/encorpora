import { useQuery } from "@tanstack/react-query";
import type { Step } from "../../../math/scene/timeline";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { GradeBand } from "../../../curriculum/types";
import { gradeNumber } from "../../../learning/frontier";
import { calculatorAllowed } from "../../../math/calculator";
import type { PublicProblem } from "../../../math/contracts";
import { AppError } from "../../lib/AppError";
import { queryClient } from "../../lib/query";
import {
  PracticeWorkspace,
  usePracticeViewport,
} from "../../PracticeWorkspace";
import {
  answer,
  catalogOptions,
  forgetTrial,
  hint,
  invalidateProgress,
  lessonSupport,
  nextProblem,
  progressOptions,
  reportProblem,
  skip,
  trialSessionOptions,
  type TrialOutcome,
  type TrialProgress,
  type TrialSession,
} from "./api";
import { track, trackSessionStart } from "./analytics";
import { FreeMeter } from "./FreeMeter";
import { gradeBand } from "./grade-band";
import { failureMessage, TrialFailure } from "./TrialFrame";
import { nativeRuntime } from "../../native-runtime";
import { SKIP_USES_FREE_PROBLEM } from "../../../learning/skip";
import { levelCheckDue } from "../../../learning/level-check";
import { LevelCheck } from "./LevelCheck";
import { approximateAge } from "./level-copy";
import { strandOrder } from "./strands";

/** `/try/practice`: placement, then adaptive practice, full screen. The
 * existing workspace, planner, lessons and hints; only the meter is new. */
export function TrialPractice() {
  const session = useQuery(trialSessionOptions);
  if (session.error)
    return (
      <TrialFailure error={session.error} retry={() => session.refetch()} />
    );
  if (session.isPending) return <PracticeSkeleton />;
  if (!session.data) return <Navigate to="/try" replace />;
  return <Practice key={session.data.learnerId} session={session.data} />;
}

type Next = Awaited<ReturnType<typeof nextProblem>>;

/** The unanswered problem and its draft answer, kept while the learner
 * checks their level, so back returns to the same problem. Memory only: a
 * refresh asks the planner again. */
let open: {
  learnerId: string;
  problem: PublicProblem;
  response: string;
} | null = null;

function Practice({ session }: { session: TrialSession }) {
  const navigate = useNavigate();
  const progress = useQuery(progressOptions(session));
  const catalog = useQuery(catalogOptions);
  const kept = open?.learnerId === session.learnerId ? open : null;
  const [problem, setProblem] = useState<PublicProblem | null>(
    kept?.problem ?? null,
  );
  const [response, setResponse] = useState(kept?.response ?? "");
  const [outcome, setOutcome] = useState<TrialOutcome | null>(null);
  const [hintText, setHint] = useState("");
  const [hintCue, setHintCue] = useState<{
    problemId: string;
    steps: Step[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answered, setAnswered] = useState<number | null>(null);
  const upcoming = useRef<Promise<Next> | null>(null);
  // An answer whose response was lost retries with the same request id, so
  // the server returns the recorded result instead of "already answered".
  const unsent = useRef<{
    problemId: string;
    requestId: string;
    response: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  // The level check: fetched when its problem is used, shown with the next
  // problem, so it never interrupts an answer or its feedback.
  const due = useRef<{
    count: number;
    snapshot: Promise<TrialProgress>;
  } | null>(null);
  const [check, setCheck] = useState<TrialProgress | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  usePracticeViewport(true);
  useEffect(() => trackSessionStart(), []);
  // An answer in flight is not kept: its retry identity lives here only.
  useEffect(() => {
    open =
      problem && !outcome && !pending
        ? { learnerId: session.learnerId, problem, response }
        : null;
  }, [problem, outcome, response, pending]);

  const limits = progress.data;
  // The server's count seeds the meter once; answers then advance it here.
  useEffect(() => {
    if (limits && answered === null) setAnswered(limits.totals.answered);
  }, [limits, answered]);
  // Measured here, not from a background refetch, so the last answer's
  // feedback is always shown before the paywall.
  const done =
    !!limits && answered !== null && answered >= limits.free && !outcome;

  function ended(failure: unknown) {
    // The trial expired or was saved into a family: start over cleanly.
    if (failure instanceof AppError && failure.kind === "authentication") {
      forgetTrial();
      void navigate({ to: "/try", replace: true });
      return true;
    }
    return false;
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (failure) {
      if (!ended(failure))
        setError(failureMessage(failure, "That didn’t go through. Try again."));
    } finally {
      setBusy(false);
    }
  }
  /** Leaves practice with fresh totals in the cache, so the map and the
   * paywall paint final numbers once instead of updating in place. */
  async function leave(to: "/try/map" | "/try/plans") {
    await queryClient
      .fetchQuery({ ...progressOptions(session), staleTime: 0 })
      .catch(() => invalidateProgress(session));
    await navigate(
      to === "/try/plans"
        ? { to, search: { reason: "limit" as const } }
        : { to },
    );
  }
  /** A level check after this many problems used, when one is due. */
  function schedule(count: number, free: { free: number; placement: number }) {
    due.current = levelCheckDue(count, free)
      ? {
          count,
          snapshot: queryClient.fetchQuery({
            ...progressOptions(session),
            staleTime: 0,
          }),
        }
      : null;
    due.current?.snapshot.catch(() => undefined);
  }
  function show(next: Next) {
    if (next === "complete") return leave("/try/plans");
    setProblem(next.problems[0] ?? null);
    setResponse("");
    setOutcome(null);
    setHint("");
  }
  // The first problem: from the planner, or the paywall if none are left.
  // Only once the count is known, so an exhausted trial navigates once.
  const first = () => void run(async () => show(await nextProblem(session)));
  const counted = answered !== null;
  useEffect(() => {
    if (limits && counted && !problem && !done) first();
  }, [counted]);
  useEffect(() => {
    if (progress.error) ended(progress.error);
  }, [progress.error]);
  // A failed background refresh never replaces the open problem.
  if (progress.error && !limits)
    return (
      <TrialFailure error={progress.error} retry={() => progress.refetch()} />
    );
  if (done)
    return <Navigate to="/try/plans" search={{ reason: "limit" }} replace />;
  if (!limits || !problem || answered === null)
    return <PracticeSkeleton error={error} retry={first} />;

  const skill = catalog.data?.skills.find((s) => s.id === problem.skillId);
  const placing = answered < limits.placement;
  const placed = answered === limits.placement;
  return (
    <div className="shell app-shell practice-shell immersive">
      {check && (
        <LevelCheck
          progress={check}
          strands={strandOrder(catalog.data)}
          age={approximateAge(session.birthYear)}
          open={checkOpen}
          onContinue={() => setCheckOpen(false)}
          onMap={() => setCheckOpen(false)}
        />
      )}
      <PracticeWorkspace
        key={problem.id}
        problem={problem}
        meta={catalog.data?.templates.find((t) => t.id === problem.templateId)}
        strand={skill?.strand}
        calculator={calculatorAllowed(
          { id: problem.templateId },
          skill?.strand,
          gradeNumber[skill?.gradeBand as GradeBand] ?? 0,
        )}
        lesson={null}
        response={response}
        setResponse={setResponse}
        outcome={outcome}
        hint={hintText}
        hintCue={hintCue}
        busy={busy}
        pending={pending}
        error={error}
        clearError={() => setError("")}
        status={
          <FreeMeter answered={answered} free={limits.free} variant="pill" />
        }
        mastered={outcome?.mastered?.title ?? null}
        reportProblem={
          nativeRuntime ? undefined : (body) => reportProblem(session, body)
        }
        exit={() => void run(() => leave("/try/map"))}
        exitHref="/try/map"
        submit={() =>
          void run(async () => {
            const attempt =
              unsent.current?.problemId === problem.id &&
              unsent.current.response === response
                ? unsent.current
                : {
                    problemId: problem.id,
                    requestId: crypto.randomUUID(),
                    response,
                  };
            unsent.current = attempt;
            setPending(true);
            let result: TrialOutcome;
            try {
              result = await answer(session, attempt);
            } catch (failure) {
              // Only a lost or failed delivery keeps the same request to retry.
              if (
                !(failure instanceof AppError) ||
                !["network", "unavailable"].includes(failure.kind)
              ) {
                unsent.current = null;
                setPending(false);
              }
              throw failure;
            }
            unsent.current = null;
            setPending(false);
            const count = answered + 1;
            setOutcome(result);
            setAnswered(count);
            track(placing ? "placement_answer" : "practice_answer", {
              index: placing ? count : count - limits.placement,
            });
            schedule(count, limits);
            if (result.mastered) track("mastery");
            // Fetch the next problem while the feedback is read. Placement's
            // end and the limit lead to the map and the paywall instead.
            upcoming.current =
              count === limits.placement || count >= limits.free
                ? null
                : nextProblem(session);
            upcoming.current?.catch(() => undefined);
          })
        }
        next={() =>
          void run(async () => {
            if (answered >= limits.free) return leave("/try/plans");
            if (placed) {
              // Placement just finished: record the band, then the map.
              const fresh = await queryClient.fetchQuery({
                ...progressOptions(session),
                staleTime: 0,
              });
              track("placement_done", {
                gradeBand: gradeBand(fresh.frontier.current.overall.level),
              });
              await navigate({ to: "/try/map" });
              return;
            }
            const ready = upcoming.current ?? nextProblem(session);
            upcoming.current = null;
            const level = due.current;
            due.current = null;
            // A level check that failed to load is skipped, never an error.
            const [next, snapshot] = await Promise.all([
              ready,
              level?.snapshot.catch((failure: unknown) => {
                console.warn("Level check not loaded", failure);
                return null;
              }),
            ]);
            show(next);
            if (level && snapshot && next !== "complete") {
              setCheck(snapshot);
              setCheckOpen(true);
              track("level_check_view", { index: level.count });
            }
          })
        }
        skip={
          nativeRuntime
            ? undefined
            : () =>
                void run(async () => {
                  const result = await skip(session, problem.id);
                  const count = SKIP_USES_FREE_PROBLEM
                    ? answered + 1
                    : answered;
                  setOutcome(result);
                  setAnswered(count);
                  track("practice_skip");
                  schedule(count, limits);
                  upcoming.current =
                    count === limits.placement || count >= limits.free
                      ? null
                      : nextProblem(session);
                  upcoming.current?.catch(() => undefined);
                })
        }
        requestHint={() =>
          void run(async () => {
            const data = await hint(session, problem.id);
            setHint(data.hint);
            setHintCue(
              data.cue ? { problemId: problem.id, steps: data.cue } : null,
            );
            track("hint_use");
          })
        }
        requestLesson={async () => {
          try {
            const { lesson } = await lessonSupport(session, problem.id);
            track("lesson_open");
            return lesson;
          } catch (failure) {
            ended(failure);
            throw failure;
          }
        }}
      />
    </div>
  );
}

/** The workspace's frame while the first problem loads: nothing moves when
 * it arrives. A failure shows inline with a retry. */
function PracticeSkeleton({
  error = "",
  retry,
}: {
  error?: string;
  retry?: () => void;
}) {
  usePracticeViewport(true);
  return (
    <div className="shell app-shell practice-shell immersive">
      <main
        className="practice-workspace"
        aria-busy={!error}
        aria-label="Math practice"
      >
        <section className="practice-surface">
          <div className="workspace-toolbar" />
          <div className="problem-stage">
            {error && (
              <p className="answer-error" role="alert">
                {error}{" "}
                {retry && (
                  <button className="text-button" onClick={retry}>
                    Try again
                  </button>
                )}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
