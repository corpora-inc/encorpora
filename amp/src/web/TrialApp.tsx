import { useEffect, useRef, useState } from "react";
import type { PublicProblem, TemplateMetadata } from "../math/contracts";
import type { Outcome } from "../server/repository";
import type { ProblemLessonView } from "../content/problem-lessons";
import { calculatorAllowed } from "../math/calculator";
import { gradeNumber } from "../learning/frontier";
import type { GradeBand } from "../curriculum/types";
import { BirthYearPrompt, strandNames } from "./BirthYearPrompt";
import {
  FrontierMap,
  gradeName,
  type FrontierMap as FrontierData,
} from "./Home";
import {
  TrialTeaching,
  type TrialView,
  type TrialCatalog,
} from "./TrialTeaching";
import { PracticeWorkspace } from "./PracticeWorkspace";

/** The trial token lives on this device only; it holds no personal data. */
export const trialKey = "amp.trial";
export function storedTrial(): string | null {
  try {
    return localStorage.getItem(trialKey);
  } catch {
    return null;
  }
}
export function clearStoredTrial() {
  try {
    localStorage.removeItem(trialKey);
  } catch (error) {
    console.warn("Trial token not cleared", error);
  }
}

type Catalog = TrialCatalog;
type Batch = { problems: PublicProblem[]; trialRemaining?: number };
type Props = {
  catalog: Catalog | null;
  /** Practice owns the screen; the map and paywall are ordinary pages. */
  onImmersive: (immersive: boolean) => void;
  /** Starts parent sign-in; the trial is saved into the family afterwards. */
  signIn: () => void;
};

/** "Try free": anonymous adaptive placement, then the learner's grade-level
 * map and the paywall. Nothing here identifies a child. */
export function TrialApp(props: Props) {
  const [token, setToken] = useState(storedTrial);
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [problem, setProblem] = useState<PublicProblem | null>(null);
  const [response, setResponse] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [progress, setProgress] = useState<TrialView | null>(null);
  const [frontier, setFrontier] = useState<FrontierData | null>(null);
  const upcoming = useRef<Promise<Batch | "complete"> | null>(null);
  const practicing = !!problem && !finished;
  useEffect(() => props.onImmersive(practicing), [practicing]);

  async function api<T>(path: string, body?: unknown, auth = token) {
    const response = await fetch(`/api/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: `Trial ${auth}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 402) throw new TrialComplete();
    if (response.status === 401 && auth) {
      clearStoredTrial();
      setToken(null);
      setLearnerId(null);
      setProblem(null);
      setFinished(false);
      setProgress(null);
    }
    if (!response.ok) throw new Error(data.error ?? "Please try again.");
    return data as T;
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (failure) {
      if (failure instanceof TrialComplete) {
        try {
          await finish(true);
        } catch (error) {
          setError(error instanceof Error ? error.message : "Try again.");
        }
      } else {
        console.error("Trial request failed", failure);
        setError(failure instanceof Error ? failure.message : "Try again.");
      }
    } finally {
      setBusy(false);
    }
  }
  async function finish(complete = false, id = learnerId) {
    setFinished(true);
    setFrontier(null);
    if (complete) setRemaining(0);
    setProblem(null);
    if (id) {
      const [map, stage] = await Promise.all([
        api<FrontierData>(`/learners/${id}/frontier`),
        api<TrialView>(`/learners/${id}/trial-progress`),
      ]);
      setFrontier(map);
      setProgress(stage);
      if (stage.phase === "complete")
        await api(`/learners/${id}/trial-paywall`, {});
    }
  }
  function request(id: string) {
    return api<Batch>(`/learners/${id}/batches`, {
      count: 1,
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities: ["measurement-models-v1"],
    }).catch((failure) => {
      if (failure instanceof TrialComplete) return "complete" as const;
      throw failure;
    });
  }
  function show(batch: Batch | "complete", id = learnerId) {
    if (batch === "complete") return finish(true, id);
    setProblem(batch.problems[0] ?? null);
    setRemaining(batch.trialRemaining ?? null);
    setResponse("");
    setOutcome(null);
    setHint("");
  }
  // Resume a trial already started on this device.
  useEffect(() => {
    if (!token || learnerId) return;
    void run(async () => {
      const { learners } = await api<{ learners: { id: string }[] }>(
        "/learners",
      );
      const id = learners[0]?.id;
      if (!id) return;
      setLearnerId(id);
      const stage = await api<TrialView>(`/learners/${id}/trial-progress`);
      setProgress(stage);
      await show(await request(id), id);
    });
  }, [token]);

  async function start(birthYear: number) {
    await run(async () => {
      const created = await api<{ token: string; learnerId: string }>(
        "/trials",
        { birthYear },
        null,
      );
      try {
        localStorage.setItem(trialKey, created.token);
      } catch (failure) {
        console.warn("Trial token not saved on this device", failure);
      }
      setToken(created.token);
      setLearnerId(created.learnerId);
      await show(
        await api<Batch>(
          `/learners/${created.learnerId}/batches`,
          {
            count: 1,
            responseCapabilities: ["single-choice-v1"],
            figureCapabilities: ["measurement-models-v1"],
          },
          created.token,
        ),
      );
    });
  }

  const strands = Object.keys(strandNames).filter((strand) =>
    props.catalog?.skills.some(
      (skill) =>
        skill.strand === strand &&
        props.catalog!.templates.some((t) => t.skillId === skill.id),
    ),
  );

  // The map appears only with the estimate, never from placeholder values.
  if (finished && !frontier)
    return (
      <main className="trial-result" aria-busy={!error}>
        {error && (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => void run(() => finish())}>Retry</button>
          </>
        )}
      </main>
    );
  if (finished)
    return (
      <main className="trial-result">
        <section className="home-hero">
          <div>
            <h1>
              {progress?.phase === "complete"
                ? "Your practice preview"
                : "Placement"}
            </h1>
            {frontier && frontier.overall.answered > 0 && (
              <p className="home-level">
                Estimated level: {gradeName(frontier.overall.level)}
              </p>
            )}
          </div>
          {progress?.phase === "placement" &&
            remaining !== null &&
            remaining > 0 && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setFinished(false);
                    await show(await request(learnerId!));
                  })
                }
              >
                Continue ({remaining} left)
              </button>
            )}
        </section>
        <details className="trial-placement-map">
          <summary>View placement map and uncertainty</summary>
          <FrontierMap
            name="the learner"
            frontier={frontier}
            strands={strands}
          />
          <p className="trial-note">
            The shaded ranges show uncertainty in the grade-level estimates.{" "}
            {progress?.placementAnswered ?? 0} placement answers sample a few
            problem types; they do not establish a grade placement or full
            curriculum mastery.
          </p>
        </details>
        {error && <p role="alert">{error}</p>}
        {progress?.phase === "unavailable" && (
          <section className="trial-teaching">
            <h2>Your placement is saved</h2>
            <p>
              AMP does not have a complete follow-up lesson and practice set for
              this starting point. You can review your placement map or save it
              in a parent account.
            </p>
            <button className="go-button" onClick={props.signIn}>
              Save placement in a parent account
            </button>
          </section>
        )}
        {progress &&
          progress.phase !== "placement" &&
          progress.phase !== "unavailable" && (
            <TrialTeaching
              progress={progress}
              frontier={frontier!}
              catalog={props.catalog}
              busy={busy}
              signIn={props.signIn}
              begin={() =>
                void run(async () => {
                  await api(`/learners/${learnerId}/trial-teaching`, {});
                  setProgress(
                    await api<TrialView>(
                      `/learners/${learnerId}/trial-progress`,
                    ),
                  );
                  setFinished(false);
                  await show(await request(learnerId!));
                })
              }
              printable={() => api(`/learners/${learnerId}/trial-printable`)}
            />
          )}
      </main>
    );
  if (!token || !learnerId)
    return (
      <BirthYearPrompt
        name="the learner"
        title="What year was the learner born?"
        birthYear={null}
        busy={busy}
        saveBirthYear={(year) => void start(year)}
      />
    );
  if (!problem)
    return (
      <main className="practice-start" aria-busy="true">
        {error && (
          <p className="answer-error" role="alert">
            {error}
          </p>
        )}
      </main>
    );
  const skill = props.catalog?.skills.find((s) => s.id === problem.skillId);
  return (
    <PracticeWorkspace
      key={problem.id}
      problem={problem}
      meta={props.catalog?.templates.find((t) => t.id === problem.templateId)}
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
      hint={hint}
      busy={busy}
      pending={false}
      error={error}
      clearError={() => setError("")}
      exit={() => void run(() => finish())}
      submit={() =>
        void run(async () => {
          const result = await api<Outcome>(`/learners/${learnerId}/attempts`, {
            problemId: problem.id,
            requestId: crypto.randomUUID(),
            response,
          });
          setOutcome(result);
          setRemaining((left) => (left === null ? null : left - 1));
          upcoming.current = request(learnerId);
          upcoming.current.catch(() => undefined);
        })
      }
      next={() =>
        void run(async () => {
          const ready = upcoming.current ?? request(learnerId);
          upcoming.current = null;
          await show(await ready);
        })
      }
      requestHint={() =>
        void run(async () => {
          const data = await api<{ hint: string }>(
            `/learners/${learnerId}/hints`,
            { problemId: problem.id },
          );
          setHint(data.hint);
        })
      }
      requestLesson={async () =>
        (
          await api<{ lesson: ProblemLessonView }>(
            `/learners/${learnerId}/lesson-support`,
            { problemId: problem.id },
          )
        ).lesson
      }
    />
  );
}

class TrialComplete extends Error {}
