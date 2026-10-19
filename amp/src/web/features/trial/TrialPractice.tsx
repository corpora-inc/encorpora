import { useQuery } from "@tanstack/react-query";
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
  trialSessionOptions,
  type TrialOutcome,
  type TrialSession,
} from "./api";
import { track, trackSessionStart } from "./analytics";
import { FreeMeter } from "./FreeMeter";
import { gradeBand } from "./grade-band";
import { failureMessage, TrialFailure } from "./TrialFrame";

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

function Practice({ session }: { session: TrialSession }) {
  const navigate = useNavigate();
  const progress = useQuery(progressOptions(session));
  const catalog = useQuery(catalogOptions);
  const [problem, setProblem] = useState<PublicProblem | null>(null);
  const [response, setResponse] = useState("");
  const [outcome, setOutcome] = useState<TrialOutcome | null>(null);
  const [hintText, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answered, setAnswered] = useState<number | null>(null);
  const upcoming = useRef<Promise<Next> | null>(null);
  usePracticeViewport(true);
  useEffect(() => trackSessionStart(), []);

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
  function show(next: Next) {
    if (next === "complete") return leave("/try/plans");
    setProblem(next.problems[0] ?? null);
    setResponse("");
    setOutcome(null);
    setHint("");
  }
  // The first problem: from the planner, or the paywall if none are left.
  const first = () => void run(async () => show(await nextProblem(session)));
  useEffect(() => {
    if (limits && !problem && !done) first();
  }, [!!limits]);
  if (progress.error)
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
        busy={busy}
        pending={false}
        error={error}
        clearError={() => setError("")}
        status={
          <FreeMeter answered={answered} free={limits.free} variant="pill" />
        }
        mastered={outcome?.mastered?.title ?? null}
        exit={() => void run(() => leave("/try/map"))}
        submit={() =>
          void run(async () => {
            const result = await answer(session, {
              problemId: problem.id,
              requestId: crypto.randomUUID(),
              response,
            });
            const count = answered + 1;
            setOutcome(result);
            setAnswered(count);
            track(placing ? "placement_answer" : "practice_answer", {
              index: placing ? count : count - limits.placement,
            });
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
            show(await ready);
          })
        }
        requestHint={() =>
          void run(async () => {
            setHint((await hint(session, problem.id)).hint);
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
