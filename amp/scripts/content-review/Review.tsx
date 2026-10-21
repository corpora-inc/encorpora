import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { PublicProblem, TemplateMetadata } from "../../src/math/contracts";
import type { ProblemLessonView } from "../../src/content/problem-lessons";
import { MathText, spokenMath } from "../../src/web/MathText";
import { Figure } from "../../src/web/Figure";
import { ProblemLesson } from "../../src/web/ProblemLesson";
import "../../src/web/style.css";
import "../../src/web/theme.css";
import "katex/dist/katex.min.css";
import "./review.css";

const featured = [
  "geometry-proof-step",
  "rational-equation-one-denominator",
  "rational-equation-check",
  "rational-expression-domain",
  "rational-expression-simplify",
];
type Selection = { template: string; seed: string };
function current(): Selection {
  const q = new URLSearchParams(location.search);
  return {
    template: q.get("template") ?? "rational-equation-check",
    seed: q.get("seed") ?? "review-1",
  };
}
function Review() {
  const [selected, setSelected] = useState(current);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState(selected);
  const [catalog, setCatalog] = useState<TemplateMetadata[]>([]);
  const [problem, setProblem] = useState<PublicProblem | null>(null);
  const [response, setResponse] = useState("");
  const [hint, setHint] = useState("");
  const [solution, setSolution] = useState<{
    answer: string;
    steps: string[];
  } | null>(null);
  const [lesson, setLesson] = useState<ProblemLessonView | null>(null);
  const [reference, setReference] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  async function api<T>(
    action: string,
    input = selected,
    answer = response,
  ): Promise<T> {
    const ticket = epoch.current;
    const res = await fetch("/__review/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, action, response: answer }),
    });
    const data = await res.json();
    if (ticket !== epoch.current) throw new Error("Obsolete selection");
    if (!res.ok) throw new Error(data.error ?? "Request failed. Try again.");
    return data;
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/__review/catalog", { signal: controller.signal })
      .then((r) => r.json())
      .then(setCatalog)
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("Could not load problem types. Reload this page.");
      });
    const back = () => {
      epoch.current++;
      setRevision((r) => r + 1);
      setSelected(current());
      setDraft(current());
    };
    addEventListener("popstate", back);
    return () => {
      controller.abort();
      removeEventListener("popstate", back);
    };
  }, []);
  useEffect(() => {
    const ticket = ++epoch.current;
    setProblem(null);
    setResponse("");
    setHint("");
    setSolution(null);
    setLesson(null);
    setReference(false);
    setFeedback("");
    setError("");
    setBusy(true);
    api<PublicProblem>("problem")
      .then((p) => {
        if (epoch.current === ticket) setProblem(p);
      })
      .catch((e) => {
        if (epoch.current === ticket) setError(e.message);
      })
      .finally(() => {
        if (epoch.current === ticket) setBusy(false);
      });
  }, [selected.template, selected.seed, revision]);
  function choose(next: Selection) {
    epoch.current++;
    setRevision((r) => r + 1);
    history.pushState(null, "", `/?${new URLSearchParams(next)}`);
    setSelected(next);
    setDraft(next);
  }
  async function run(work: () => Promise<void>) {
    const ticket = epoch.current;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      if (ticket === epoch.current)
        setError(e instanceof Error ? e.message : "Request failed. Try again.");
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  const meta = catalog.find((t) => t.id === selected.template);
  return (
    <main className="content-review">
      <header>
        <p>AMP · Local content review</p>
        <h1>One problem, all its teaching</h1>
        <p>
          Try an answer, inspect the hint, then read the lessons. This page does
          not record learner progress.
        </p>
        <a href="http://127.0.0.1:4310" target="_blank" rel="noreferrer">
          Open full AMP ↗
        </a>
      </header>
      <nav aria-label="Recent problem families" className="review-featured">
        {featured.map((id) => (
          <a
            key={id}
            aria-current={id === selected.template ? "page" : undefined}
            href={`/?${new URLSearchParams({ template: id, seed: selected.seed })}`}
            onClick={(e) => {
              e.preventDefault();
              choose({ template: id, seed: selected.seed });
            }}
          >
            {catalog.find((t) => t.id === id)?.title ?? id}
          </a>
        ))}
      </nav>
      <form
        className="review-controls"
        onSubmit={(e) => {
          e.preventDefault();
          choose(draft);
        }}
      >
        <label>
          Problem type
          <select
            value={draft.template}
            onChange={(e) => setDraft({ ...draft, template: e.target.value })}
          >
            {catalog.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} · {t.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Seed
          <input
            required
            maxLength={128}
            value={draft.seed}
            onChange={(e) => setDraft({ ...draft, seed: e.target.value })}
          />
        </label>
        <button disabled={busy}>Load</button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => choose({ ...selected, seed: crypto.randomUUID() })}
        >
          Another problem
        </button>
      </form>
      <p className="review-status" role="status" aria-live="polite">
        {error || (busy ? "Loading…" : feedback)}
      </p>
      {problem && (
        <>
          <section className="review-card" aria-labelledby="problem-title">
            <p>
              {meta?.gradeBand} · {problem.skillId}
            </p>
            <h2 id="problem-title">{meta?.title}</h2>
            <p className="review-prompt">
              <MathText text={problem.prompt} />
            </p>
            {problem.figure && <Figure figure={problem.figure} />}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await api<{
                    correct: boolean;
                    feedback: string | null;
                  }>("check");
                  setFeedback(
                    r.correct
                      ? "Correct."
                      : "Not yet. Try again or inspect the hint.",
                  );
                  if (r.feedback) setHint(r.feedback);
                });
              }}
            >
              {problem.response.kind === "choice" ? (
                <fieldset>
                  <legend>{problem.response.label}</legend>
                  {problem.response.options.map((o) => (
                    <label className="review-option" key={o.id}>
                      <input
                        type="radio"
                        disabled={busy}
                        aria-label={spokenMath(o.label)}
                        name="answer"
                        value={o.id}
                        checked={response === o.id}
                        onChange={() => {
                          setResponse(o.id);
                          setFeedback("");
                        }}
                      />
                      <span>
                        <MathText text={o.label} />
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <label>
                  Answer
                  <input
                    disabled={busy}
                    value={response}
                    onChange={(e) => {
                      setResponse(e.target.value);
                      setFeedback("");
                    }}
                    autoComplete="off"
                    placeholder="Integer, decimal or fraction"
                  />
                </label>
              )}
              <div className="review-actions">
                <button disabled={busy || !response.trim()}>
                  Check answer
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () =>
                      setHint((await api<{ hint: string }>("hint")).hint),
                    )
                  }
                >
                  Show hint
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => setSolution(await api("solution")))
                  }
                >
                  Show solution
                </button>
              </div>
            </form>
          </section>
          {hint && (
            <section
              className="review-card"
              aria-label="Hint or answer feedback"
            >
              <h2>Hint or answer feedback</h2>
              <p>
                <MathText text={hint} />
              </p>
            </section>
          )}
          {solution && (
            <section className="review-card" aria-label="Solution">
              <h2>Solution</h2>
              <ol>
                {solution.steps.map((s, i) => (
                  <li key={i}>
                    <MathText text={s} />
                  </li>
                ))}
              </ol>
              <p>
                <strong>Answer: </strong>
                <MathText text={solution.answer} />
              </p>
            </section>
          )}
          <div className="review-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => setLesson(await api("lesson")))
              }
            >
              Show in-practice lesson
            </button>
            <button
              className="secondary"
              onClick={() => setReference(!reference)}
            >
              Show full lesson
            </button>
          </div>
          {lesson && (
            <section className="review-card">
              <h2>{lesson.title}: in-practice lesson</h2>
              <ProblemLesson lesson={lesson} />
            </section>
          )}
          {reference && (
            <section className="review-card">
              <h2>Full reference lesson</h2>
              <p>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`/__review/reference?${new URLSearchParams(selected)}`}
                >
                  Open lesson in its own tab ↗
                </a>
              </p>
              <iframe
                title="Full reference lesson"
                src={`/__review/reference?${new URLSearchParams(selected)}`}
              />
            </section>
          )}
        </>
      )}
      <footer>
        Feedback: copy the address and name the part to change—problem, hint,
        solution, in-practice lesson, or full lesson.
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Review />);
