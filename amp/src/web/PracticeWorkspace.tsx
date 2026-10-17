import { ChoiceFigure } from "./ChoiceFigure";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PublicProblem, TemplateMetadata } from "../math/contracts";
import type { Outcome } from "../server/repository";
import type { Lesson } from "../content/lessons";
import { Figure } from "./Figure";

export function FocusDialog({
  title,
  children,
  close,
  returnFocus,
  className = "",
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  returnFocus?: HTMLElement | null;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const previous =
      returnFocus ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    dialog.current?.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      dialog.current?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`practice-dialog ${className}`}
      aria-labelledby="practice-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="dialog-heading">
        <h2 id="practice-dialog-title" ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <button
          className="dialog-close"
          onClick={close}
          aria-label="Close panel"
        >
          ×
        </button>
      </div>
      <div className="dialog-content">{children}</div>
    </dialog>
  );
}

export function usePracticeViewport(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      // Pinching must remain available; do not shrink the layout to a zoomed visual viewport.
      const unzoomed = !viewport || viewport.scale <= 1.01;
      root.style.setProperty(
        "--practice-height",
        `${unzoomed ? (viewport?.height ?? innerHeight) : innerHeight}px`,
      );
      root.style.setProperty(
        "--practice-top",
        `${unzoomed ? (viewport?.offsetTop ?? 0) : 0}px`,
      );
    };
    root.classList.add("practice-open");
    window.scrollTo({ top: 0, behavior: "instant" });
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      root.classList.remove("practice-open");
      root.style.removeProperty("--practice-height");
      root.style.removeProperty("--practice-top");
    };
  }, [active]);
}

type Props = {
  problem: PublicProblem;
  meta?: TemplateMetadata;
  lesson: Lesson | null;
  response: string;
  setResponse: (value: string) => void;
  outcome: Outcome | null;
  hint: string;
  pending: boolean;
  busy: boolean;
  submit: () => void;
  next: () => void;
  requestHint: () => void;
  requestLesson: () => Promise<void>;
  openBook?: () => void;
  changeTopic: () => void;
};

export function PracticeWorkspace(props: Props) {
  const {
    problem,
    meta,
    lesson,
    response,
    setResponse,
    outcome,
    hint,
    busy,
    pending,
  } = props;
  const alive = useRef(true);
  const currentProblem = useRef(problem.id);
  currentProblem.current = problem.id;
  const lessonTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const choice = problem.response.kind === "choice";
  const displayResponse = (value: string) =>
    problem.response.kind === "choice"
      ? (problem.response.options.find((option) => option.id === value)
          ?.label ?? "Unavailable answer")
      : value;
  const input = useRef<HTMLInputElement>(null);
  const prompt = useRef<HTMLHeadingElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<"hint" | "explanation" | "lesson" | null>(
    null,
  );
  const [entering, setEntering] = useState(false);
  const [lessonLoading, setLessonLoading] = useState(false);
  const lessonRequest = useRef(0);
  function advance() {
    lessonRequest.current++;
    setLessonLoading(false);
    setPanel(null);
    props.next();
  }
  const [lessonError, setLessonError] = useState("");
  const [compact, setCompact] = useState(
    () => matchMedia("(max-width: 650px) and (max-height: 780px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 650px) and (max-height: 780px)");
    const changed = () => setCompact(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const [nativeKeyboard, setNativeKeyboard] = useState(false);
  const [small, setSmall] = useState(
    () => matchMedia("(max-width: 650px), (pointer: coarse)").matches,
  );
  const previousOutcome = useRef<string | null>(outcome?.id ?? null);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    const media = matchMedia("(max-width: 650px), (pointer: coarse)");
    const changed = () => setSmall(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useLayoutEffect(() => {
    setPanel(null);
    setEntering(false);
    setLessonError("");
    setCelebrate(false);
    // Returning from a book remounts this workspace with an existing result.
    // Only a newly received result should open feedback or replay celebration.
    previousOutcome.current = outcome?.id ?? null;
    if (small || choice) prompt.current?.focus({ preventScroll: true });
    else input.current?.focus({ preventScroll: true });
  }, [problem.id]);
  useEffect(() => {
    if (!outcome || busy || previousOutcome.current === outcome.id) return;
    previousOutcome.current = outcome.id;
    input.current?.blur();
    setEntering(false);
    // Wait for the answer panel to unmount and the enabled Continue target to render.
    const focus = window.setTimeout(() => {
      continueButton.current?.focus({ preventScroll: true });
      if (!outcome.correct) setPanel("explanation");
      else setCelebrate(true);
    }, 0);
    const timeout = window.setTimeout(() => setCelebrate(false), 1100);
    return () => {
      window.clearTimeout(focus);
      window.clearTimeout(timeout);
    };
  }, [outcome?.id, busy]);
  const locked = busy || pending || !!outcome;
  const keypad = small && !nativeKeyboard && !choice;
  function key(value: string) {
    if (locked) return;
    const start = input.current?.selectionStart ?? response.length;
    const end = input.current?.selectionEnd ?? start;
    let next = response;
    let caret = start;
    if (value === "clear") {
      next = "";
      caret = 0;
    } else if (value === "sign") {
      next = response.startsWith("-") ? response.slice(1) : `-${response}`;
      caret = Math.max(0, start + (response.startsWith("-") ? -1 : 1));
    } else if (value === "backspace") {
      const from = start === end ? Math.max(0, start - 1) : start;
      next = response.slice(0, from) + response.slice(end);
      caret = from;
    } else {
      next = response.slice(0, start) + value + response.slice(end);
      caret = start + value.length;
    }
    if (next.length > 100) return;
    setResponse(next);
    requestAnimationFrame(() => {
      input.current?.focus({ preventScroll: true });
      input.current?.setSelectionRange(caret, caret);
    });
  }
  function answerControls() {
    if (problem.response.kind === "choice")
      return (
        <form
          className="choice-form"
          data-choice-count={problem.response.options.length}
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && (outcome || response))
              outcome ? advance() : props.submit();
          }}
        >
          <fieldset disabled={locked}>
            <legend>{problem.response.label}</legend>
            <div className="choice-options">
              {problem.response.options.map((option, index) => (
                <label
                  key={option.id}
                  className={`choice-option ${response === option.id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={`answer-${problem.id}`}
                    value={option.id}
                    checked={response === option.id}
                    onChange={() => setResponse(option.id)}
                  />
                  <span className="choice-letter" aria-hidden="true">
                    {"ABCD"[index]}
                  </span>
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            ref={compact ? undefined : continueButton}
            className="choice-submit"
            type="submit"
            disabled={busy || (!outcome && !response)}
          >
            {outcome ? "Continue →" : pending ? "Retry" : "Check answer"}
          </button>
        </form>
      );
    return (
      <>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && (outcome || response.trim()))
              outcome ? advance() : props.submit();
          }}
        >
          <label htmlFor="answer">{problem.response.label}</label>
          <div className="workspace-answer-row">
            <input
              id="answer"
              ref={input}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode={
                keypad
                  ? "none"
                  : problem.response.kind === "fraction"
                    ? "text"
                    : "decimal"
              }
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              readOnly={locked}
              aria-describedby="answer-format"
              placeholder={
                problem.response.kind === "fraction"
                  ? "For example, 3/4"
                  : "Your answer"
              }
              maxLength={100}
            />
            <button
              ref={compact ? undefined : continueButton}
              className="answer-action"
              type="submit"
              disabled={busy || (!outcome && !response.trim())}
            >
              {outcome ? "Continue" : pending ? "Retry" : "Check answer"}
              <span aria-hidden="true">{outcome ? " →" : " ↵"}</span>
            </button>
          </div>
          <span id="answer-format" className="sr-only">
            Enter a number, decimal or fraction. Negative answers use a minus
            sign.
          </span>
        </form>
        {keypad && (
          <div className="math-keypad" aria-label="Math keypad">
            {[
              "7",
              "8",
              "9",
              "backspace",
              "4",
              "5",
              "6",
              "clear",
              "1",
              "2",
              "3",
              "sign",
              "0",
              ".",
              "/",
            ].map((value) => (
              <button
                type="button"
                key={value}
                disabled={locked}
                className={value === "0" ? "zero-key" : ""}
                aria-label={
                  value === "backspace"
                    ? "Delete last character"
                    : value === "clear"
                      ? "Clear answer"
                      : value === "sign"
                        ? "Change positive or negative sign"
                        : value === "/"
                          ? "Fraction slash"
                          : value === "."
                            ? "Decimal point"
                            : value
                }
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => key(value)}
              >
                {value === "backspace"
                  ? "⌫"
                  : value === "clear"
                    ? "Clear"
                    : value === "sign"
                      ? "±"
                      : value}
              </button>
            ))}
          </div>
        )}
      </>
    );
  }
  return (
    <main className="practice-workspace" aria-label="Math practice">
      <section className="practice-surface">
        <div className="workspace-toolbar">
          <div>
            <span className="eyebrow">
              {meta?.gradeBand ?? "MATH PRACTICE"}
            </span>
            <span className="workspace-topic">{meta?.title ?? "Practice"}</span>
          </div>
          <button
            className="text-button"
            onClick={props.changeTopic}
            disabled={busy}
          >
            Change topic
          </button>
        </div>
        <div
          className="problem-stage"
          tabIndex={0}
          aria-label="Problem workspace"
        >
          <div className="problem-content">
            <h2 ref={prompt} tabIndex={-1} className="question">
              {problem.prompt}
            </h2>
            {problem.figure &&
              (choice ? (
                <ChoiceFigure figure={problem.figure} />
              ) : (
                <Figure figure={problem.figure} />
              ))}
          </div>
          {celebrate && (
            <div className="practice-celebration" aria-hidden="true">
              <span>✓</span>
            </div>
          )}
        </div>
        <div className="answer-dock">
          <div
            className="answer-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {outcome ? (
              <>
                <span
                  className={`result-mark ${outcome.correct ? "correct" : ""}`}
                  aria-hidden="true"
                >
                  {outcome.correct ? "✓" : "↗"}
                </span>
                <span>
                  {outcome.correct
                    ? "You’ve got it."
                    : "A chance to understand."}
                  {outcome.assisted && <small>Practiced with support.</small>}
                </span>
              </>
            ) : (
              <span>
                {pending
                  ? "Your answer is saved for retry."
                  : busy
                    ? "Checking…"
                    : "Take your time."}
              </span>
            )}
          </div>
          {compact ? (
            <button
              className="compact-answer-action"
              ref={continueButton}
              disabled={busy}
              onClick={() => (outcome ? advance() : setEntering(true))}
            >
              {outcome
                ? "Continue →"
                : response
                  ? choice
                    ? "Review your choice"
                    : `Your answer: ${response} · Edit`
                  : choice
                    ? "Choose an answer"
                    : "Enter your answer"}
            </button>
          ) : (
            answerControls()
          )}
          <div className="practice-tools">
            {outcome ? (
              <button
                className="text-button"
                onClick={() => setPanel("explanation")}
              >
                See why
              </button>
            ) : (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setPanel("hint");
                  if (!hint) props.requestHint();
                }}
              >
                A little help
              </button>
            )}
            {props.openBook ? (
              <button
                className="text-button"
                disabled={busy}
                data-book-trigger
                onClick={props.openBook}
              >
                Explore the idea
              </button>
            ) : (
              lesson && (
                <button
                  className="text-button"
                  disabled={busy || lessonLoading}
                  onClick={async (event) => {
                    lessonTrigger.current = event.currentTarget;
                    const requestedProblem = problem.id;
                    const request = ++lessonRequest.current;
                    const current = () =>
                      alive.current &&
                      lessonRequest.current === request &&
                      currentProblem.current === requestedProblem;
                    setLessonLoading(true);
                    setLessonError("");
                    try {
                      await props.requestLesson();
                      if (current()) setPanel("lesson");
                    } catch {
                      if (current())
                        setLessonError(
                          "The lesson could not be opened. Please try again.",
                        );
                    } finally {
                      if (current()) setLessonLoading(false);
                    }
                  }}
                >
                  {lessonLoading ? "Opening…" : "The idea"}
                </button>
              )
            )}
            {small && !choice && (
              <button
                className="text-button keyboard-choice"
                onClick={() => {
                  setNativeKeyboard(!nativeKeyboard);
                  input.current?.blur();
                  requestAnimationFrame(() =>
                    input.current?.focus({ preventScroll: true }),
                  );
                }}
              >
                {nativeKeyboard ? "Math keypad" : "Device keyboard"}
              </button>
            )}
          </div>
        </div>
      </section>
      {lessonError && (
        <p className="workspace-error" role="alert">
          {lessonError}
        </p>
      )}
      {compact && entering && !panel && (
        <FocusDialog
          className={choice ? "choice-entry-dialog" : ""}
          title="Your answer"
          close={() => setEntering(false)}
        >
          <p className="answer-prompt-summary">{problem.prompt}</p>
          {choice && problem.figure && (
            <div className="choice-model">
              <ChoiceFigure figure={problem.figure} />
            </div>
          )}
          <div className="answer-dock compact-entry">{answerControls()}</div>
        </FocusDialog>
      )}
      {panel && (
        <FocusDialog
          returnFocus={
            panel === "lesson"
              ? lessonTrigger.current
              : panel === "explanation"
                ? continueButton.current
                : undefined
          }
          title={
            panel === "hint"
              ? "A little help"
              : panel === "lesson"
                ? (lesson?.title ?? "The idea")
                : outcome?.correct
                  ? "Why it works"
                  : "Let’s work through it."
          }
          close={() => setPanel(null)}
        >
          {panel === "hint" && (
            <>
              <p className="hint">
                {hint ||
                  (busy
                    ? "Finding your hint…"
                    : "Your hint could not be loaded. Close this panel and try again.")}
              </p>
              <button onClick={() => setPanel(null)}>
                Back to the problem
              </button>
            </>
          )}
          {panel === "explanation" && outcome && (
            <div className="solution-panel">
              <p className="solution-prompt">{problem.prompt}</p>
              <p>
                Your answer:{" "}
                <strong>{displayResponse(outcome.response)}</strong>
              </p>
              <p className="solution-answer">
                Answer: <strong>{displayResponse(outcome.answer)}</strong>
              </p>
              <ol>
                {outcome.explanation.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              {outcome.assisted && (
                <p>
                  Practiced with support. Independent practice will come next.
                </p>
              )}
              <button
                disabled={busy}
                onClick={() => {
                  advance();
                }}
              >
                Next problem <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
          {panel === "lesson" && lesson && (
            <div className="workspace-lesson">
              <p>{lesson.summary}</p>
              {lesson.sections.map((section) => (
                <section key={section.title}>
                  <h3>{section.title}</h3>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </section>
              ))}
              <section className="worked-example">
                <h3>Let’s try one together</h3>
                <p>{lesson.workedExample.prompt}</p>
                <ol>
                  {lesson.workedExample.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <strong>{lesson.workedExample.answer}</strong>
              </section>
              <button onClick={() => setPanel(null)}>
                Back to the problem
              </button>
            </div>
          )}
        </FocusDialog>
      )}
    </main>
  );
}
