import { product } from "../product";
import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { PublicProblem, TemplateMetadata } from "../math/contracts";
import type { Learner, Outcome } from "../server/repository";
import type { SkillProgress } from "../server/progress";
import type { Lesson } from "../content/lessons";
import { PracticeWorkspace, usePracticeViewport } from "./PracticeWorkspace";
import {
  accessSession,
  onSessionChanged,
  signIn,
  signOut,
  type AuthSession,
} from "./auth";
import "./style.css";
import "./practice.css";
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type Catalog = {
  templates: TemplateMetadata[];
  lessons: Lesson[];
  skills: { id: string; title: string; gradeBand: string; strand: string }[];
  mode: string;
};
function App() {
  const [token, setToken] = useState<string | null>(null),
    [accountId, setAccountId] = useState<string | null>(null),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [learners, setLearners] = useState<Learner[]>([]),
    [learner, setLearner] = useState<Learner | null>(null);
  const [tab, setTab] = useState<"practice" | "library" | "progress">(
      "practice",
    ),
    [family, setFamily] = useState(""),
    [problem, setProblem] = useState<PublicProblem | null>(null),
    [queue, setQueue] = useState<PublicProblem[]>([]),
    [lesson, setLesson] = useState<Lesson | null>(null),
    [readingLesson, setReadingLesson] = useState<Lesson | null>(null),
    [lessonSearch, setLessonSearch] = useState("");
  const readerHeading = useRef<HTMLHeadingElement>(null);
  const readerTrigger = useRef<HTMLButtonElement | null>(null);
  usePracticeViewport(!!learner);
  useEffect(() => {
    if (readingLesson && tab === "library")
      readerHeading.current?.focus({ preventScroll: true });
  }, [readingLesson, tab]);
  const authEpoch = useRef(0),
    tokenRef = useRef<string | null>(null),
    accountRef = useRef<string | null>(null);
  const learnerRef = useRef<string | undefined>(undefined);
  learnerRef.current = learner?.id;
  const [response, setResponse] = useState(""),
    [outcome, setOutcome] = useState<Outcome | null>(null),
    [hint, setHint] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<SkillProgress[]>([]),
    [name, setName] = useState(""),
    [pending, setPending] = useState<{
      requestId: string;
      response: string;
    } | null>(null);
  function updateAuth(session: AuthSession | null) {
    const next = session?.token ?? null,
      identity = session?.accountId ?? null;
    if (tokenRef.current === next && accountRef.current === identity) return;
    tokenRef.current = next;
    setToken(next);
    if (accountRef.current === identity) return;
    accountRef.current = identity;
    setAccountId(identity);
    authEpoch.current++;
    setName("");
    setLesson(null);
    setReadingLesson(null);
    setFamily("");
    setLearners([]);
    setLearner(null);
    setProgress([]);
    setProblem(null);
    setQueue([]);
    setOutcome(null);
    setHint("");
    setPending(null);
    setResponse("");
    setError("");
    setToken(next);
  }
  async function api<T>(path: string, body?: unknown): Promise<T> {
    const epoch = authEpoch.current;
    const result = await fetch(`/api/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await result.json();
    if (epoch !== authEpoch.current)
      throw new Error("Your account session changed.");
    if (!result.ok)
      throw new HttpError(result.status, data.error ?? "Request failed");
    return data;
  }
  async function action(run: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => onSessionChanged(updateAuth), []);
  useEffect(() => {
    void accessSession()
      .then(updateAuth)
      .catch((e) => setError(String(e)));
    void fetch("/api/v1/catalog")
      .then((r) => {
        if (!r.ok) throw new Error("The learning service is unavailable.");
        return r.json();
      })
      .then(setCatalog)
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (token)
      void action(async () => {
        const data = await api<{ learners: Learner[] }>("/learners");
        setLearners(data.learners);
        setLearner(data.learners[0] ?? null);
      });
  }, [accountId]);
  useEffect(() => {
    setProblem(null);
    setQueue([]);
    setOutcome(null);
    setPending(null);
    setProgress([]);
    if (learner)
      void refreshProgress().catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load progress"),
      );
  }, [learner?.id]);
  async function refreshProgress() {
    if (!learner) return;
    const data = await api<{ skills: SkillProgress[] }>(
      `/learners/${learner.id}/progress`,
    );
    if (learnerRef.current === learner.id) setProgress(data.skills);
  }
  function showProblem(p: PublicProblem) {
    setProblem(p);
    setResponse("");
    setOutcome(null);
    setHint("");
    setPending(null);
  }
  async function loadBatch() {
    if (!learner) return;
    const data = await api<{
      problems: PublicProblem[];
      lesson: Lesson | null;
    }>(`/learners/${learner.id}/batches`, {
      ...(family ? { templateId: family } : {}),
      count: family ? 1 : 3,
    });
    showProblem(data.problems[0]);
    setQueue(data.problems.slice(1));
    setLesson(data.lesson);
    setFamily("");
  }
  async function next() {
    if (outcome && !outcome.correct) {
      setQueue([]);
      await loadBatch();
    } else if (queue.length) {
      showProblem(queue[0]);
      setQueue(queue.slice(1));
    } else await loadBatch();
  }
  async function submit() {
    if (!learner || !problem) return;
    const attempt = pending ?? { requestId: crypto.randomUUID(), response };
    setPending(attempt);
    try {
      const result = await api<Outcome>(`/learners/${learner.id}/attempts`, {
        problemId: problem.id,
        ...attempt,
      });
      setOutcome(result);
      setPending(null);
      await refreshProgress();
    } catch (e) {
      if (e instanceof HttpError && e.status >= 400 && e.status < 500)
        setPending(null);
      throw e;
    }
  }
  async function download(kind: "lesson" | "workbook" | "solutions") {
    const publicationLesson = readingLesson ?? lesson;
    if (!learner || !publicationLesson || !token) return;
    const epoch = authEpoch.current;
    const result = await fetch(
      `/api/v1/learners/${learner.id}/publications/${publicationLesson.id}/${kind}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!result.ok)
      throw new Error((await result.json()).error ?? "Download unavailable");
    const blob = await result.blob();
    if (epoch !== authEpoch.current) return;
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${publicationLesson.id}-${kind}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const meta = catalog?.templates.find((t) => t.id === problem?.templateId);
  return (
    <div
      className={`shell ${learner ? "app-shell" : ""} ${learner && tab === "practice" && problem ? "practice-shell" : ""}`}
    >
      <header>
        <a className="brand" href="/" aria-label={`${product.name} home`}>
          <svg viewBox="0 0 64 32" aria-hidden="true">
            <path d="M0 16 C8 16 8 1 16 1 S24 31 32 31 S40 1 48 1 S56 16 64 16" />
          </svg>
          {product.name}
          <span>MATHEMATICS</span>
        </a>
        <div className="account">
          {token && learners.length > 0 && (
            <select
              aria-label="Learner"
              value={learner?.id ?? ""}
              disabled={busy}
              onChange={(e) =>
                setLearner(
                  learners.find((l) => l.id === e.target.value) ?? null,
                )
              }
            >
              {!learner && <option value="">Select a learner</option>}
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          {token && learners.length > 0 && (
            <details className="account-menu">
              <summary aria-label="Family menu">Family</summary>
              <div className="account-menu-content">
                {" "}
                {token && learners.length > 0 && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      setName("");
                      setLearner(null);
                    }}
                  >
                    Add learner
                  </button>
                )}
                {token && catalog?.mode !== "development" && (
                  <button
                    className="text-button"
                    onClick={() => void action(signOut)}
                  >
                    Sign out
                  </button>
                )}
              </div>
            </details>
          )}
        </div>
      </header>
      {!learner && (
        <div className="intro">
          <div>
            <p className="eyebrow">A LITTLE CURIOSITY. A NEW POSSIBILITY.</p>
            <h1>
              Your next <em>aha.</em>
            </h1>
            <p>Understand the idea. Find your rhythm. Go a little further.</p>
          </div>
          <div className="intro-note">
            <span className="pulse-dot" />
            Learning studio preview
            <br />
            <small>Explore selected skills across the math journey.</small>
          </div>
        </div>
      )}
      <nav aria-label="Learning sections">
        {(["practice", "library", "progress"] as const).map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {t === "practice"
              ? "Your practice"
              : t === "library"
                ? "Lesson library"
                : "Your progress"}
          </button>
        ))}
      </nav>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {!token ? (
        <section className="card welcome">
          <p className="eyebrow">ONE ACCOUNT. EVERY LEARNING DEVICE.</p>
          <h2>A place to grow in mathematics.</h2>
          <p>
            Sign in as a parent to manage your learners and continue their
            practice.
          </p>
          <button onClick={() => void action(signIn)} disabled={busy}>
            Parent sign in
          </button>
        </section>
      ) : !learner ? (
        <section className="card welcome">
          <h2>Who is learning today?</h2>
          <p>Use a first name or nickname to create a learner profile.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const l = await api<Learner>("/learners", { name });
                setLearners([...learners, l]);
                setLearner(l);
              });
            }}
          >
            <label>
              Learner name
              <input
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button disabled={busy}>Create learner</button>
          </form>
        </section>
      ) : tab === "practice" ? (
        problem ? (
          <PracticeWorkspace
            problem={problem}
            meta={meta}
            lesson={
              catalog?.lessons.find((entry) =>
                entry.templateIds.includes(problem.templateId),
              ) ?? lesson
            }
            response={response}
            setResponse={setResponse}
            outcome={outcome}
            hint={hint}
            busy={busy}
            pending={!!pending}
            submit={() => void action(submit)}
            next={() => void action(next)}
            requestHint={() =>
              void action(async () => {
                const data = await api<{ hint: string }>(
                  `/learners/${learner.id}/hints`,
                  { problemId: problem.id },
                );
                setHint(data.hint);
              })
            }
            changeTopic={() => {
              setProblem(null);
              setQueue([]);
              setOutcome(null);
              setPending(null);
              setFamily("");
            }}
          />
        ) : (
          <main className="session-start">
            <section className="session-invitation">
              <p className="eyebrow">YOUR OWN PATH THROUGH MATHEMATICS</p>
              <h1>
                A little of this.
                <br />
                <em>A new way to think.</em>
              </h1>
              <p>
                A mix of ideas, familiar ground, and fresh challenges. Your
                practice changes with you.
              </p>
              <button
                className="start-mix"
                disabled={busy}
                onClick={() => void action(loadBatch)}
              >
                {family ? "Try this idea" : "Start your mix"}
                <span aria-hidden="true"> ↗</span>
              </button>
              <details className="focus-picker">
                <summary>Looking for a particular idea?</summary>
                <label className="family-picker">
                  Choose your practice
                  <select
                    value={family}
                    onChange={(event) => setFamily(event.target.value)}
                  >
                    <option value="">A varied mix for me</option>
                    {catalog?.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title} · {template.gradeBand}
                      </option>
                    ))}
                  </select>
                </label>
                <p>Try one problem, then return to your mix.</p>
              </details>
            </section>
          </main>
        )
      ) : tab === "library" ? (
        <main>
          {!readingLesson && (
            <>
              <div className="section-heading">
                <h2>A library for curious minds.</h2>
                <p>Read, explore, and print a lesson to keep nearby.</p>
              </div>
              <label className="library-search">
                Find an idea
                <input
                  type="search"
                  value={lessonSearch}
                  onChange={(event) => setLessonSearch(event.target.value)}
                  placeholder="Fractions, shapes, equations…"
                />
              </label>
              <div className="library-grid">
                {catalog?.lessons
                  .filter((entry) =>
                    `${entry.title} ${entry.summary}`
                      .toLowerCase()
                      .includes(lessonSearch.toLowerCase()),
                  )
                  .map((l) => (
                    <article key={l.id} className="card lesson-card">
                      <p className="eyebrow">MINI-LESSON</p>
                      <h3>{l.title}</h3>
                      <p>{l.summary}</p>
                      <button
                        className="secondary"
                        onClick={(event) => {
                          readerTrigger.current = event.currentTarget;
                          setReadingLesson(l);
                        }}
                      >
                        Read lesson
                      </button>
                    </article>
                  ))}
              </div>
            </>
          )}
          {readingLesson && (
            <article className="card lesson-reader">
              <div className="card-top">
                <button
                  className="text-button"
                  onClick={() => {
                    setReadingLesson(null);
                    requestAnimationFrame(() =>
                      readerTrigger.current?.focus({ preventScroll: true }),
                    );
                  }}
                >
                  ← All lessons
                </button>
                <button className="text-button" onClick={() => window.print()}>
                  Print lesson
                </button>
              </div>
              <h2 ref={readerHeading} tabIndex={-1}>
                {readingLesson.title}
              </h2>
              <div className="downloads">
                {(["lesson", "workbook", "solutions"] as const).map((kind) => (
                  <button
                    className="secondary"
                    key={kind}
                    disabled={busy}
                    onClick={() => void action(() => download(kind))}
                  >
                    Download {kind} PDF
                  </button>
                ))}
              </div>
              {readingLesson.sections.map((s) => (
                <section key={s.title}>
                  <h3>{s.title}</h3>
                  {s.paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </section>
              ))}
              <section className="worked-example">
                <h3>Let’s try one together</h3>
                <p>{readingLesson.workedExample.prompt}</p>
                <ol>
                  {readingLesson.workedExample.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <strong>{readingLesson.workedExample.answer}</strong>
              </section>
              <h3>Things to watch for</h3>
              <ul>
                {readingLesson.pitfalls.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <h3>For the grown-up nearby</h3>
              <p>{readingLesson.parentGuide}</p>
            </article>
          )}
        </main>
      ) : (
        <main>
          <div className="section-heading">
            <h2>Small steps, visible growth.</h2>
            <p>
              These summaries describe practiced problem families, not
              whole-grade mastery.
            </p>
          </div>
          <div className="progress-list">
            {progress.map((s) => (
              <article className="card progress-card" key={s.skillId}>
                <div>
                  <h3>
                    {catalog?.templates.find((t) => t.skillId === s.skillId)
                      ?.title ?? s.skillId}
                  </h3>
                  <p>
                    {s.attempts} attempts · {s.independentCorrect} independently
                    correct
                  </p>
                </div>
                <span className={`status ${s.status}`}>
                  {s.status === "review-ready"
                    ? "Ready for review"
                    : s.status === "practicing"
                      ? "Building understanding"
                      : "Not explored yet"}
                </span>
              </article>
            ))}
          </div>
        </main>
      )}
      {!learner && (
        <footer>
          <span>
            {product.name} · A {product.company} learning studio
          </span>
          <span>
            {catalog?.mode === "development"
              ? "Local development · sample practice"
              : "Selected curriculum preview"}{" "}
            · English
          </span>
        </footer>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
