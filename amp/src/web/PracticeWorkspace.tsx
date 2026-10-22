import { ProblemLesson } from "./ProblemLesson";
import { MathText, spokenMath } from "./MathText";
import { Calculator, type CalculatorDismissal } from "./Calculator";
import {
  clearField,
  deleteBackward,
  insertText,
  toggleLeadingMinus,
  useKeypadCaret,
} from "./lib/keypadEdit";
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
import { ScenePlayer } from "./scene/ScenePlayer";
import { visibleSteps, type Step } from "../math/scene/timeline";
import type { ProblemFlagInput } from "../feedback/problem-flags";
import { problemFlagBody } from "./problem-flag";
import { ReportProblemButton, type ReportResult } from "./ProblemFlag";
type ReportSheet = typeof import("./ReportProblemSheet");
/** The report sheet uses the UI kit's stylesheets, so it loads in the
 * browser on demand (this module also loads under Node). */
const loadReportSheet = () => import("./ReportProblemSheet");

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
  /** The hint's figure cue for this problem's scene (see GeneratedProblem). */
  hintCue?: { problemId: string; steps: Step[] } | null;
  pending: boolean;
  busy: boolean;
  submit: () => void;
  next: () => void;
  requestHint: () => void;
  /** A neutral pass: shows the worked answer with no credit or penalty.
   * Absent where the route is unavailable (the native bridge). */
  skip?: () => void;
  /** This problem allows a calculator (computation is not the skill). */
  calculator?: boolean;
  /** A request error to show at the answer rather than at the top of the app. */
  error?: string;
  clearError?: () => void;
  /** Open the learner's level view (home, or the trial's map), where the
   * rest of the app is also reached. */
  exit: () => void;
  /** That view's URL, so the control is a real link (new tab, copy link). */
  exitHref: string;
  requestLesson: () => Promise<ProblemLessonView>;
  strand?: string;
  /** A calm status in the toolbar, such as the free-practice meter. */
  status?: ReactNode;
  /** A skill this answer just mastered, shown once with the feedback. */
  mastered?: string | null;
  /** Sends "Report a problem" once this problem resolves. Absent: no flag. */
  reportProblem?: (body: ProblemFlagInput) => Promise<ReportResult>;
  /** The report offers its optional note (see `noteAllowed`). */
  reportNote?: boolean;
};

/** Phones too short to keep the keypad docked under the problem. Taller
 * phones, tablets and desktops answer inline with no extra tap. */
export const compactAnswerQuery = "(max-width: 650px) and (max-height: 640px)";

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
  // The learner's own scene, when its walkthrough (or a hint cue) can play.
  const hintScene =
    problem.figure?.kind === "scene" &&
    (props.hintCue?.problemId === problem.id ||
      visibleSteps(problem.figure.scene.steps ?? [], "hint").length)
      ? problem.figure.scene
      : null;
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
    () => matchMedia(compactAnswerQuery).matches,
  );
  useEffect(() => {
    const media = matchMedia(compactAnswerQuery);
    const changed = () => setCompact(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const [problemLessonView, setProblemLessonView] =
    useState<ProblemLessonView | null>(null);
  const [small, setSmall] = useState(
    () => matchMedia("(max-width: 650px), (pointer: coarse)").matches,
  );
  const previousOutcome = useRef<string | null>(outcome?.id ?? null);
  const [celebrate, setCelebrate] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  // A lesson opened before answering counts as support for this attempt.
  const [lessonBeforeAnswer, setLessonBeforeAnswer] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [reportToast, setReportToast] = useState("");
  const [reportSheet, setReportSheet] = useState<ReportSheet | null>(null);
  // Fetched as the result appears, so the flag opens its sheet at once.
  async function loadSheet() {
    try {
      const sheet = await loadReportSheet();
      if (alive.current) setReportSheet(() => sheet);
      return sheet;
    } catch (failure) {
      console.error("AMP report sheet failed to load:", failure);
      return null;
    }
  }
  useEffect(() => {
    if (outcome && props.reportProblem && !reportSheet) void loadSheet();
  }, [outcome?.id]);
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
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Each problem starts at its prompt's first line, wherever the last one
    // was scrolled to.
    if (stage.current) stage.current.scrollTop = 0;
    setPanel(null);
    setEntering(false);
    setLessonError("");
    setCelebrate(false);
    // Returning from a book remounts this workspace with an existing result.
    // Only a newly received result should open feedback or replay celebration.
    previousOutcome.current = outcome?.id ?? null;
    // Typed answers start in the answer field. On touch it suppresses the
    // system keyboard (inputMode none), so AMP's keypad stays in charge; the
    // field announces the question through aria-describedby.
    if (choice) prompt.current?.focus({ preventScroll: true });
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
  // Feedback takes the answer area's place at (at least) its size, so the
  // problem above never moves and the sheet's top edge never jumps.
  const surface = useRef<HTMLElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const area = dock.current;
    const host = surface.current;
    if (!area || !host || typeof ResizeObserver === "undefined") return;
    const measure = () =>
      host.style.setProperty(
        "--dock-height",
        `${Math.ceil(host.getBoundingClientRect().bottom - area.getBoundingClientRect().top)}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  const locked = busy || pending || !!outcome;
  // AMP's keypad is always present for typed answers; touch devices never
  // raise the system keyboard, and a physical keyboard still types.
  const keypad = !choice;
  const caret = useKeypadCaret(input);
  function key(value: string) {
    if (locked) return;
    const field = caret.read(response);
    const edit =
      value === "clear"
        ? clearField()
        : value === "sign"
          ? toggleLeadingMinus(field)
          : value === "backspace"
            ? deleteBackward(field)
            : insertText(field, value);
    if (edit.value.length > 100) return;
    caret.commit(edit, setResponse);
  }
  const calculatorToggle = useRef<HTMLButtonElement>(null);
  function closeCalculator(via: CalculatorDismissal) {
    setCalculatorOpen(false);
    // A tap outside leaves no keyboard focus ring on the toggle.
    calculatorToggle.current?.focus({
      preventScroll: true,
      focusVisible: via === "keyboard",
    } as FocusOptions);
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
            <legend>
              <MathText text={problem.response.label} />
            </legend>
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
                    aria-label={spokenMath(option.label)}
                    checked={response === option.id}
                    onChange={() => setResponse(option.id)}
                  />
                  <span className="choice-letter" aria-hidden="true">
                    {"ABCD"[index]}
                  </span>
                  <span>
                    <MathText text={option.label} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            className="choice-submit"
            type="submit"
            disabled={busy || (!outcome && !response)}
            aria-busy={busy}
          >
            {/* One label always. A lost connection is explained beside the field,
                and Check resends the same answer. */}
            Check
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
          <label htmlFor="answer">
            <MathText text={problem.response.label} />
          </label>
          <div className="workspace-answer-row">
            <input
              id="answer"
              ref={input}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode={
                small
                  ? "none"
                  : problem.response.kind === "fraction"
                    ? "text"
                    : "decimal"
              }
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              readOnly={locked}
              aria-label={spokenMath(problem.response.label)}
              aria-describedby="problem-prompt answer-format"
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
              aria-busy={busy}
            >
              {/* One label always. A lost connection is explained beside the field,
                and Check resends the same answer. */}
              Check
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
                    ? "Delete"
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
  function tools(feedback = false) {
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
            disabled={busy || props.pending}
            onClick={() => {
              setPanel("hint");
              if (!hint) props.requestHint();
            }}
          >
            Hint
          </button>
        )}
        {!outcome && props.skip && (
          <button
            className="text-button skip-action"
            disabled={busy}
            aria-label="Skip this problem and see its answer"
            onClick={() => props.skip?.()}
          >
            Skip
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
                if (!outcome) setLessonBeforeAnswer(true);
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
        {feedback && props.reportProblem && (
          <ReportProblemButton
            reported={reported}
            open={async () => {
              if (reportSheet || (await loadSheet())) setReportOpen(true);
              else
                setLessonError(
                  "Reporting couldn’t open. Check your connection and try again.",
                );
            }}
          />
        )}
      </div>
    );
  }
  // Name only the support this attempt actually used. A support flag the
  // workspace did not see (a lesson opened from Progress) stays general.
  const support = !outcome?.assisted
    ? ""
    : hint && lessonBeforeAnswer
      ? "with a hint and the lesson"
      : hint
        ? "with a hint"
        : lessonBeforeAnswer
          ? "with the lesson"
          : "with a hint or lesson";
  const skipped = !!outcome?.skipped;
  return (
    <main className="practice-workspace" aria-label="Math practice">
      <section className="practice-surface" ref={surface}>
        <div className="workspace-toolbar">
          <a
            className="workspace-level"
            href={props.exitHref}
            aria-label="Your level"
            title="Your level"
            onClick={(event) => {
              // A modified click opens the view in a new tab as usual.
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              props.exit();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 19.5h14" />
              <path d="M7.5 16v-3M12 16V9.5M16.5 16V5.5" />
            </svg>
            <span className="workspace-level-label" aria-hidden="true">
              Your level
            </span>
          </a>
          <span
            className="workspace-topic"
            data-strand={props.strand}
            title={meta?.title ?? "Practice"}
          >
            <span className="workspace-topic-text">
              {meta?.title ?? "Practice"}
            </span>
          </span>
          {props.status}
          {props.calculator ? (
            <button
              ref={calculatorToggle}
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
            <span
              className="no-calculator"
              role="img"
              aria-label="No calculator"
              title="No calculator"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="3" width="14" height="18" rx="2.5" />
                <rect x="8" y="6" width="8" height="3.5" rx="0.8" />
                <path d="M8.5 13h1M12 13h1M15 13h.5M8.5 16.5h1M12 16.5h1M15 16.5h.5" />
                <path className="strike" d="M4 21L20 3" />
              </svg>
            </span>
          )}
        </div>
        <div
          className="problem-stage"
          ref={stage}
          tabIndex={0}
          aria-label="Problem workspace"
        >
          <div className="problem-content">
            <h2
              id="problem-prompt"
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
        <div className="answer-dock" ref={dock}>
          <div
            className="answer-controls"
            style={outcome ? { visibility: "hidden" } : undefined}
          >
            {/* Floats just above the answer it explains, in either layout. */}
            {inputError && !outcome && (
              <p className="answer-error" role="alert">
                {inputError}
              </p>
            )}
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
            close={closeCalculator}
            use={(value) => {
              setCalculatorOpen(false);
              caret.commit({ value, caret: value.length }, setResponse);
            }}
          />
        )}
        {outcome && (
          <div
            className={`feedback solution-panel ${outcome.correct ? "correct" : skipped ? "skipped" : "incorrect"}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {outcome.correct && (
              <svg
                className="feedback-wave"
                viewBox="0 0 320 32"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  pathLength="1"
                  d="M0 16 Q10 0 20 16 T40 16 T60 16 T80 16 T100 16 T120 16 T140 16 T160 16 T180 16 T200 16 T220 16 T240 16 T260 16 T280 16 T300 16 T320 16"
                />
              </svg>
            )}
            <div className="feedback-head">
              <span className="result-mark" aria-hidden="true">
                {outcome.correct ? "✓" : skipped ? "→" : "✕"}
              </span>
              <span className="feedback-title">
                {skipped ? (
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
                    <small>Skipped. Your progress is unchanged.</small>
                  </>
                ) : outcome.correct ? (
                  <>
                    Correct
                    {support && <small>{capitalize(support)}</small>}
                  </>
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
                      You entered{" "}
                      <MathText text={displayResponse(outcome.response)} />
                      {support && `, ${support}`}
                    </small>
                  </>
                )}
              </span>
            </div>
            {props.mastered && (
              <p className="mastery-moment">
                <span className="mastery-mark" aria-hidden="true">
                  ★
                </span>
                <span>
                  <strong>Skill mastered</strong>
                  <span>{props.mastered}</span>
                </span>
              </p>
            )}
            {(!outcome.correct || showWhy) && (
              <ol
                className="feedback-steps"
                // It scrolls when long, so keyboards must be able to reach it.
                tabIndex={0}
                aria-label="Explanation"
              >
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
            {tools(true)}
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
          <p className="answer-prompt-summary">
            <MathText text={problem.prompt} />
          </p>
          {choice && problem.figure && (
            <div className="choice-model">
              <ChoiceFigure figure={problem.figure} />
            </div>
          )}
          <div className="answer-dock compact-entry">{answerControls()}</div>
        </FocusDialog>
      )}
      {reportOpen && reportSheet && outcome && props.reportProblem && (
        <FocusDialog
          className="report-dialog"
          title="Report a problem"
          close={() => setReportOpen(false)}
        >
          <reportSheet.ReportProblemForm
            allowNote={!!props.reportNote}
            send={async (report, requestId) =>
              props.reportProblem!(
                await problemFlagBody(
                  problem.id,
                  requestId,
                  report,
                  // A skip resolves a problem without an attempt.
                  skipped,
                ),
              )
            }
            done={(result) => {
              setReported(true);
              setReportOpen(false);
              setReportToast(
                result === "already"
                  ? "This problem was already reported. Thank you."
                  : "Thank you. Your report was sent.",
              );
            }}
          />
        </FocusDialog>
      )}
      {reportSheet && (
        <reportSheet.Toast
          tone="status"
          message={reportToast}
          onDismiss={() => setReportToast("")}
        />
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
              {hintScene && (
                <ScenePlayer
                  scene={hintScene}
                  mode="hint"
                  cue={
                    props.hintCue?.problemId === problem.id
                      ? props.hintCue.steps
                      : undefined
                  }
                />
              )}
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
function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
