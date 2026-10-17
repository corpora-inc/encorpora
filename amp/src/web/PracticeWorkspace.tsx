import { ProblemLesson } from "./ProblemLesson";
import { MathText } from "./MathText";
import { Calculator } from "./Calculator";
import { acceptedAnswer } from "../math/answer-format";
import { displayAnswer } from "../math/polish";
import type { ProblemLessonView } from "../content/problem-lessons";
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
  /** This problem allows a calculator (computation is not the skill). */
  calculator?: boolean;
  /** A request error to show at the answer rather than at the top of the app. */
  error?: string;
  clearError?: () => void;
  /** Leave immersive practice for home, lessons, progress and settings. */
  exit: () => void;
  requestLesson: () => Promise<ProblemLessonView>;
  strand?: string;
};

const keyboardKey = "amp.keyboard";
/** A per-device convenience; practice works the same without storage. */
function prefersDeviceKeyboard() {
  try {
    return localStorage.getItem(keyboardKey) === "device";
  } catch {
    return false;
  }
}
function rememberKeyboard(device: boolean) {
  try {
    localStorage.setItem(keyboardKey, device ? "device" : "keypad");
  } catch (error) {
    console.warn("Keyboard preference not saved", error);
  }
}

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
      : props.strand === "fractions"
        ? value
        : displayAnswer(value);
  const input = useRef<HTMLInputElement>(null);
  const prompt = useRef<HTMLHeadingElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<"hint" | "lesson" | null>(null);
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
  const [nativeKeyboard, setNativeKeyboard] = useState(prefersDeviceKeyboard);
  const [problemLessonView, setProblemLessonView] =
    useState<ProblemLessonView | null>(null);
  const [small, setSmall] = useState(
    () => matchMedia("(max-width: 650px), (pointer: coarse)").matches,
  );
  const previousOutcome = useRef<string | null>(outcome?.id ?? null);
  const [celebrate, setCelebrate] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [answerError, setAnswerError] = useState("");
  // Typing clears a message about the previous answer.
  useEffect(() => {
    setAnswerError("");
    props.clearError?.();
  }, [response]);
  const inputError = answerError || props.error || "";
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
    if (!outcome || previousOutcome.current === outcome.id) return;
    previousOutcome.current = outcome.id;
    input.current?.blur();
    setEntering(false);
    focusNext.current = true;
    const focus = window.setTimeout(() => {
      if (outcome.correct) setCelebrate(true);
    }, 0);
    const timeout = window.setTimeout(() => setCelebrate(false), 1100);
    return () => {
      window.clearTimeout(focus);
      window.clearTimeout(timeout);
    };
  }, [outcome?.id]);
  // Focus Next only after the answer dialog has closed and restored focus.
  const focusNext = useRef(false);
  useEffect(() => {
    if (!outcome || entering || !focusNext.current) return;
    focusNext.current = false;
    continueButton.current?.focus({ preventScroll: true });
  }, [outcome?.id, entering]);
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
            className="choice-submit"
            type="submit"
            disabled={busy || (!outcome && !response)}
          >
            {pending ? "Retry" : "Check"}
          </button>
        </form>
      );
    return (
      <>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (busy || !(outcome || response.trim())) return;
            if (outcome) return advance();
            // Catch a malformed answer at the input, without a request.
            if (!acceptedAnswer(response))
              return setAnswerError(
                "Enter a number, decimal, or fraction such as 3/4.",
              );
            props.submit();
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
              className="answer-action"
              type="submit"
              disabled={busy || (!outcome && !response.trim())}
            >
              {pending ? "Retry" : "Check"}
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
  function tools() {
    return (
      <div className="practice-tools">
        {outcome ? (
          outcome.correct &&
          !showWhy && (
            <button className="text-button" onClick={() => setShowWhy(true)}>
              See why
            </button>
          )
        ) : (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setPanel("hint");
              if (!hint) props.requestHint();
            }}
          >
            Hint
          </button>
        )}
        <button
          className="text-button"
          disabled={lessonLoading}
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
              const view = await props.requestLesson();
              if (current()) {
                setProblemLessonView(view);
                setPanel("lesson");
              }
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
          {lessonLoading ? "Opening…" : "Lesson"}
        </button>
        {small && !choice && !outcome && (
          <button
            className="text-button keyboard-choice"
            onClick={() => {
              setNativeKeyboard(!nativeKeyboard);
              rememberKeyboard(!nativeKeyboard);
              input.current?.blur();
              requestAnimationFrame(() =>
                input.current?.focus({ preventScroll: true }),
              );
            }}
          >
            {nativeKeyboard ? "Keypad" : "Keyboard"}
          </button>
        )}
      </div>
    );
  }
  return (
    <main className="practice-workspace" aria-label="Math practice">
      <section className="practice-surface">
        <div className="workspace-toolbar">
          <button
            className="workspace-exit"
            aria-label="Exit practice"
            title="Exit practice"
            onClick={props.exit}
          >
            ✕
          </button>
          <span className="workspace-topic" data-strand={props.strand}>
            {meta?.title ?? "Practice"}
          </span>
          {props.calculator ? (
            <button
              className="calculator-toggle"
              aria-label="Calculator"
              title="Calculator"
              aria-pressed={calculatorOpen}
              disabled={!!outcome}
              onClick={() => setCalculatorOpen(!calculatorOpen)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="3" width="14" height="18" rx="2.5" />
                <rect x="8" y="6" width="8" height="3.5" rx="0.8" />
                <path d="M8.5 13h1M12 13h1M15 13h.5M8.5 16.5h1M12 16.5h1M15 16.5h.5" />
              </svg>
            </button>
          ) : (
            <span className="no-calculator">No calculator</span>
          )}
        </div>
        <div
          className="problem-stage"
          tabIndex={0}
          aria-label="Problem workspace"
        >
          <div className="problem-content">
            <h2
              ref={prompt}
              tabIndex={-1}
              className="question"
              data-text={problem.prompt}
            >
              <MathText text={problem.prompt} />
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
          {inputError && !outcome && (
            <p className="answer-error" role="alert">
              {inputError}
            </p>
          )}
          <div
            className="answer-controls"
            style={outcome ? { visibility: "hidden" } : undefined}
          >
            {compact ? (
              <button
                className="compact-answer-action"
                disabled={busy}
                onClick={() => setEntering(true)}
              >
                {response
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
          </div>
          {/* Keeps its space under the feedback sheet so nothing moves. */}
          <div style={outcome ? { visibility: "hidden" } : undefined}>
            {tools()}
          </div>
        </div>
        {calculatorOpen && !outcome && (
          <Calculator
            close={() => setCalculatorOpen(false)}
            use={(value) => {
              setResponse(value);
              setCalculatorOpen(false);
            }}
          />
        )}
        {outcome && (
          <div
            className={`feedback solution-panel ${outcome.correct ? "correct" : "incorrect"}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="feedback-head">
              <span className="result-mark" aria-hidden="true">
                {outcome.correct ? "✓" : "✕"}
              </span>
              <span className="feedback-title">
                {outcome.correct ? (
                  "Correct"
                ) : (
                  <>
                    <span
                      className="solution-answer"
                      data-text={displayResponse(outcome.answer)}
                    >
                      Answer:{" "}
                      <strong>
                        <MathText text={displayResponse(outcome.answer)} />
                      </strong>
                    </span>
                    <small>
                      You entered {displayResponse(outcome.response)}
                    </small>
                  </>
                )}
              </span>
            </div>
            {outcome.assisted && (
              <p className="feedback-note">Practiced with support.</p>
            )}
            {(!outcome.correct || showWhy) && (
              <ol className="feedback-steps">
                {outcome.explanation.map((step, index) => (
                  <li key={index} data-text={step}>
                    <MathText text={step} />
                  </li>
                ))}
              </ol>
            )}
            <button
              className="next-action"
              ref={continueButton}
              onClick={() => {
                if (!busy) advance();
              }}
            >
              Next <span aria-hidden="true">→</span>
            </button>
            {tools()}
          </div>
        )}
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
          returnFocus={panel === "lesson" ? lessonTrigger.current : undefined}
          title={
            panel === "hint" ? "Hint" : (problemLessonView?.title ?? "Lesson")
          }
          close={() => setPanel(null)}
        >
          {panel === "hint" && (
            <>
              <p className="hint">
                {hint ? (
                  <MathText text={hint} />
                ) : busy ? (
                  "Finding your hint…"
                ) : (
                  "Your hint could not be loaded. Close this panel and try again."
                )}
              </p>
              <button onClick={() => setPanel(null)}>
                Back to the problem
              </button>
            </>
          )}
          {panel === "lesson" && problemLessonView && (
            <>
              <ProblemLesson lesson={problemLessonView} />
              <button className="lesson-return" onClick={() => setPanel(null)}>
                Back to the problem
              </button>
            </>
          )}
        </FocusDialog>
      )}
    </main>
  );
}
