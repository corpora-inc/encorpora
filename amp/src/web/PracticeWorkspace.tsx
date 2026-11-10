import { CheckboxControl } from "./ui/Checkbox";
import { track } from "./lib/analytics";
import { ProblemLesson } from "./ProblemLesson";
import { Glossary } from "./ui/Glossary";
import type { HintedProblem } from "./lib/problem-hints";
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
import {
  joinAnswerLabels,
  parseSelection,
  responseAnswerLabels,
  serializeSelection,
} from "../math/selection-response";
import type { ProblemLessonView } from "../content/problem-lessons";
import { ChoiceFigure } from "./ChoiceFigure";
import { PointPlotAnswer, PointPlotInput, plotReview } from "./PointPlotInput";
import { pointPlotAnswerText } from "../math/point-plot";
import { linePlotBuildAnswerText } from "../math/line-plot-build";
import { LinePlotBuildAnswer, LinePlotBuildInput } from "./LinePlotBuildInput";
import { UnitSquareMarkingInput } from "./UnitSquareMarkingInput";
import { normalizeUnitSquareMarking } from "../math/unit-square-marking";
import { TrendLineFitInput, TrendLineFitAnswer } from "./TrendLineFitInput";
import {
  trendLineAnswerText,
  trendLineDiagnosis,
} from "../math/trend-line-fit";
import { shapeAnswerText, shapeFeedbackSummary } from "../math/shape-composer";
import { ShapeComposerInput, ShapeComposerAnswer } from "./ShapeComposerInput";
import {
  counterBuilderAnswerText,
  parseCounterBuilder,
} from "../math/counter-builder";
import {
  CounterBuilderInput,
  CounterBuilderAnswer,
} from "./CounterBuilderInput";
import {
  MultiPartChoiceAnswer,
  MultiPartChoiceInput,
  partsReview,
} from "./MultiPartChoiceInput";
import { multiPartAnswerText } from "../math/multi-part-choice";
import {
  FigureChoiceAnswer,
  FigureChoiceInput,
  figureReview,
} from "./FigureChoiceInput";
import { figureChoiceName } from "../math/figure-choice";
import {
  StructuredWorkAnswer,
  StructuredWorkInput,
  workSummary,
} from "./StructuredWorkInput";
import {
  structuredWorkAnswerText,
  structuredWorkRows,
} from "../math/structured-work";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useShellTools } from "./lib/shell-slots";
import type { PublicProblem, TemplateMetadata } from "../math/contracts";
import type { Outcome } from "../server/repository";
import type { Lesson } from "../content/lessons";
import { Figure } from "./Figure";
import { ScenePlayer } from "./scene/ScenePlayer";
import { visibleSteps, type Step } from "../math/scene/timeline";
import type { ProblemFlagInput } from "../feedback/problem-flags";
import { problemFlagBody } from "./problem-flag";
import { ReportProblemButton, type ReportResult } from "./ProblemFlag";
import {
  prepareFeedbackSound,
  playCorrectFeedback,
} from "./features/practice/feedback-preferences";
import { Loading } from "./ui/Loading";
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
  const titleId = useId();
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
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId} ref={heading} tabIndex={-1}>
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
  /** With the batch's hint, when it sent one (its term cards included). */
  problem: HintedProblem;
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
  /** Explicit difficulty recovery, offered only after a neutral skip. */
  easier?: () => void;
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
  satMathFocus?: boolean;
  /** A calm status in the toolbar, such as the free-practice meter. */
  status?: ReactNode;
  /** Global navigation supplied by browser routes; native keeps its home link. */
  navigation?: ReactNode;
  /** The app frame (app/AppShell.tsx) draws the bar: the topic and tools
   * sit in it beside the logo instead of in a row of the card. */
  toolbarInFrame?: boolean;
  /** A skill this answer just mastered, shown once with the feedback. */
  mastered?: string | null;
  /** Progress and optional one-problem branches; Next remains adaptive. */
  answerFeedback?: ReactNode;
  /** A compact offer in the feedback sheet, just before Next. */
  feedbackAside?: ReactNode;
  /** Leaves a chosen skill for adaptive mixed practice. Present only while
   * practice is focused on one skill, so the action always succeeds. */
  returnToMixed?: () => void;
  /** Sends "Report a problem" once this problem resolves. Absent: no flag. */
  reportProblem?: (body: ProblemFlagInput) => Promise<ReportResult>;
  /** The report offers its optional note (see `noteAllowed`). */
  reportNote?: boolean;
};

/** Phones too short to keep the keypad docked under the problem. Taller
 * phones, tablets and desktops answer inline with no extra tap. */
export const compactAnswerQuery = "(max-width: 650px) and (max-height: 640px)";
/** The two-column practice layout of practice-tablet.css. */
const sideBySideQuery =
  "(orientation: landscape) and (min-width: 900px) and (min-height: 500px)";

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
  useEffect(() => {
    let frame = 0,
      sent = false;
    const visible = () => {
      if (document.visibilityState !== "visible" || sent) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (sent || document.visibilityState !== "visible") return;
          sent = true;
          const trial = location.pathname.startsWith("/try/");
          track("problem_rendered", { mode: trial ? "trial" : "practice" });
          if (trial) track("trial_problem_view");
        });
      });
    };
    visible();
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [problem.id]);
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
  const choice =
    problem.response.kind === "choice" ||
    problem.response.kind === "multi-select";
  const multiResponse =
    problem.response.kind === "multi-select" ? problem.response : null;
  // Point plots answer on the grid in the problem itself; the dock holds
  // only the readout and Check, so they never use the answer dialog.
  const plot = problem.response.kind === "point-plot" ? problem.response : null;
  const lineBuild =
    problem.response.kind === "line-plot-build" ? problem.response : null;
  const marking =
    problem.response.kind === "unit-square-marking" ? problem.response : null;
  const [markReset, setMarkReset] = useState(0);
  const counters =
    problem.response.kind === "counter-builder" ? problem.response : null;
  const trend =
    problem.response.kind === "trend-line-fit" ? problem.response : null;
  const shapes =
    problem.response.kind === "shape-composer" ? problem.response : null;
  const [shapeStep, setShapeStep] = useState({ id: problem.id, index: 0 });
  const shapeStage = shapeStep.id === problem.id ? shapeStep.index : 0;
  const setShapeStage = (index: number) =>
    setShapeStep({ id: problem.id, index });
  // Multi-part choices answer in the problem too: blanks, slots or a table.
  const parts =
    problem.response.kind === "multi-part-choice" ? problem.response : null;
  // Figure choices answer on their cards in the problem; the dock holds the
  // selection readout and Check.
  const figures =
    problem.response.kind === "figure-choice" ? problem.response : null;
  // Structured work is built in the problem: steps or proof lines, with
  // the keypad over the dock; the dock holds progress, Clear and Check.
  const work =
    problem.response.kind === "structured-work" ? problem.response : null;
  const selectedIds = multiResponse
    ? (parseSelection(response) ?? []).filter((id) =>
        multiResponse.options.some((option) => option.id === id),
      )
    : [];
  // The learner's own scene, when its walkthrough (or a hint cue) can play.
  const hintScene =
    problem.figure?.kind === "scene" &&
    (props.hintCue?.problemId === problem.id ||
      visibleSteps(problem.figure.scene.steps ?? [], "hint").length)
      ? problem.figure.scene
      : null;
  const displayResponse = (value: string) => {
    if (problem.response.kind === "line-plot-build")
      return linePlotBuildAnswerText(problem.response, value);
    if (problem.response.kind === "counter-builder")
      return counterBuilderAnswerText(problem.response, value);
    if (trend) return trendLineAnswerText(trend, value);
    if (problem.response.kind === "shape-composer")
      return shapeAnswerText(problem.response, value);
    if (problem.response.kind === "point-plot") {
      try {
        return pointPlotAnswerText(problem.response, value);
      } catch {
        return "No points placed";
      }
    }
    if (problem.response.kind === "multi-part-choice")
      return multiPartAnswerText(problem.response, value);
    if (problem.response.kind === "figure-choice")
      return figureChoiceName(problem.response, value) ?? "Unavailable answer";
    if (problem.response.kind === "structured-work")
      return structuredWorkAnswerText(problem.response, value);
    if (problem.response.kind === "multi-select") {
      const labels = responseAnswerLabels(problem.response, value);
      return labels ? joinAnswerLabels(labels) : "Unavailable selection";
    }
    if (problem.response.kind === "choice")
      return (
        problem.response.options.find((option) => option.id === value)?.label ??
        "Unavailable answer"
      );
    return props.strand === "fractions" ? value : displayAnswer(value);
  };
  const input = useRef<HTMLInputElement>(null);
  const prompt = useRef<HTMLHeadingElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<"hint" | "lesson" | null>(null);
  const [entering, setEntering] = useState(false);
  const [lessonLoading, setLessonLoading] = useState(false);
  // Which control is waiting: only the one that was pressed shows the wave.
  const [skipping, setSkipping] = useState(false);
  useEffect(() => {
    if (!busy) setSkipping(false);
  }, [busy]);
  const lessonRequest = useRef(0);
  function advance() {
    lessonRequest.current++;
    setLessonLoading(false);
    setPanel(null);
    props.next();
  }
  const [lessonError, setLessonError] = useState("");
  // Diagram questions need room above a six-statement answer sheet. Below the
  // side-by-side workspace width, keep that sheet behind a clear answer action.
  const answerLayoutQuery =
    (multiResponse && problem.figure) || marking
      ? "(max-width: 899px)"
      : compactAnswerQuery;
  const [compactQuery, setCompact] = useState(
    () => matchMedia(answerLayoutQuery).matches,
  );
  const compact =
    compactQuery &&
    !plot &&
    !trend &&
    !lineBuild &&
    !parts &&
    !figures &&
    !work &&
    !counters &&
    !shapes;
  // Side by side (practice-tablet.css), the feedback sheet has its own
  // column; stacked, it covers the dock only, so a plotted answer's grid and
  // its feedback overlay stay in view and the explanation opens on request.
  const shortLinePlotQuery =
    "(orientation: landscape) and (min-width: 560px) and (max-height: 499px)";
  const [shortLinePlot, setShortLinePlot] = useState(
    () => !!lineBuild && matchMedia(shortLinePlotQuery).matches,
  );
  const [sideBySide, setSideBySide] = useState(
    () => matchMedia(sideBySideQuery).matches || shortLinePlot,
  );
  useEffect(() => {
    const media = matchMedia(sideBySideQuery);
    const short = matchMedia(shortLinePlotQuery);
    const changed = () => {
      const compactPlot = !!lineBuild && short.matches;
      setShortLinePlot(compactPlot);
      setSideBySide(media.matches || compactPlot);
    };
    changed();
    media.addEventListener("change", changed);
    short.addEventListener("change", changed);
    return () => {
      media.removeEventListener("change", changed);
      short.removeEventListener("change", changed);
    };
  }, [!!lineBuild]);
  const editorInDock = sideBySide && (!!work || !!figures);
  const trendCompact = !!trend && !sideBySide;
  const counterCompact = !!counters && !sideBySide;
  const counterKey =
    counters && outcome ? parseCounterBuilder(counters, outcome.answer) : null;
  const scrollFeedback = editorInDock || shortLinePlot;
  const deferSteps =
    scrollFeedback ||
    ((!!plot ||
      !!lineBuild ||
      !!trend ||
      !!parts ||
      !!figures ||
      !!work ||
      !!marking ||
      !!counters ||
      !!shapes) &&
      !sideBySide);
  // Side by side, the sheet has the answer column's full height, so the
  // worked explanation is part of every result rather than a "See why" away.
  const fullColumn = sideBySide && !scrollFeedback;
  useEffect(() => {
    const media = matchMedia(answerLayoutQuery);
    const changed = () => setCompact(media.matches);
    changed();
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, [answerLayoutQuery]);
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
    if (
      choice ||
      plot ||
      lineBuild ||
      trend ||
      parts ||
      figures ||
      work ||
      marking ||
      counters ||
      shapes
    )
      prompt.current?.focus({ preventScroll: true });
    else input.current?.focus({ preventScroll: true });
  }, [problem.id]);
  useEffect(() => {
    if (!outcome || previousOutcome.current === outcome.id) return;
    previousOutcome.current = outcome.id;
    input.current?.blur();
    setEntering(false);
    focusNext.current = true;
    if (outcome.correct && !outcome.skipped)
      playCorrectFeedback(!!props.mastered);
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
    // `--question-room`: the space below the question, so a phone's sheet
    // can rise over the figure but never over the question's words.
    const measure = () => {
      const bottom = host.getBoundingClientRect().bottom;
      host.style.setProperty(
        "--dock-height",
        `${Math.ceil(bottom - area.getBoundingClientRect().top)}px`,
      );
      const question = host.querySelector(".problem-stage .question");
      if (question)
        host.style.setProperty(
          "--question-room",
          `${Math.floor(bottom - question.getBoundingClientRect().bottom - 8)}px`,
        );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    observer.observe(host);
    const question = host.querySelector(".problem-stage .question");
    if (question) observer.observe(question);
    return () => observer.disconnect();
  }, []);
  // Stacked, the feedback sheet can rise above the dock it replaces. The
  // stage's scroll range then extends by that overlap (an out-of-flow
  // spacer: nothing in the problem moves), and an answer drawn in the
  // problem itself (plotted points, marked parts, steps) scrolls into view
  // above the sheet instead of staying hidden under it.
  const sheet = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const reviewInProblem = !!(
    plot ||
    lineBuild ||
    trend ||
    parts ||
    figures ||
    work ||
    shapes
  );
  useLayoutEffect(() => {
    const host = stage.current;
    const cover = sheet.current;
    const room = spacer.current;
    if (!host || !room) return;
    room.style.height = "0px";
    // A line plot's measurements are in its prompt. Start review there even
    // when editing a tall plot scrolled it away; the spacer below keeps the
    // counts reachable above the feedback sheet by scrolling.
    if (outcome && lineBuild) host.scrollTo({ top: 0, behavior: "instant" });
    host.style.removeProperty("--shape-review-height");
    if (!outcome || !cover || sideBySide) return;
    // Layout offsets, not client rects: the sheet's entrance transform
    // must not shorten the overlap. A fixed sheet (very short screens)
    // has no shared offset parent, so it is measured on screen.
    const overlap = () =>
      Math.max(
        0,
        Math.ceil(
          cover.offsetParent && cover.offsetParent === host.offsetParent
            ? host.offsetTop + host.offsetHeight - cover.offsetTop
            : host.getBoundingClientRect().bottom -
                cover.getBoundingClientRect().top,
        ),
      );
    const content = host.querySelector<HTMLElement>(".problem-content");
    // The problem may shrink below its own content (a flex item at
    // min-height 0), so its end is where that content ends.
    const end = () =>
      content
        ? content.offsetTop +
          Math.max(content.offsetHeight, content.scrollHeight)
        : 0;
    const update = () => {
      // Keep the prompt and the entire shape above the review sheet. Scrolling
      // to the bottom of a full-size board hides the prompt under the header.
      const board =
        shapes && content?.querySelector<HTMLElement>(".shape-board");
      if (board && content) {
        const otherContent = content.scrollHeight - board.offsetHeight;
        host.style.setProperty(
          "--shape-review-height",
          `${Math.max(144, host.clientHeight - overlap() - otherContent - 16)}px`,
        );
        host.scrollTop = 0;
      }
      room.style.top = `${end()}px`;
      room.style.height = `${overlap()}px`;
    };
    update();
    if (counters) host.scrollTop = 0;
    if (
      reviewInProblem &&
      !lineBuild &&
      !trend &&
      !shapes &&
      !outcome.correct
    ) {
      const hidden = end() - host.scrollTop - (host.clientHeight - overlap());
      if (hidden > 0)
        host.scrollBy({
          top: hidden + 8,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
    }
    // A fixed sheet is measured on screen: again once its entrance ends.
    cover.addEventListener("animationend", update);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(cover);
    observer?.observe(host);
    if (content) observer?.observe(content);
    return () => {
      cover.removeEventListener("animationend", update);
      observer?.disconnect();
    };
  }, [outcome?.id, sideBySide]);
  const locked = busy || pending || !!outcome;
  // Check shows the wave for an answer on its way, not for a skip or a hint.
  const sending = busy && !skipping && !(panel === "hint" && !hint);
  // AMP's keypad is always present for typed answers; touch devices never
  // raise the system keyboard, and a physical keyboard still types.
  const keypad =
    !choice &&
    !plot &&
    !lineBuild &&
    !trend &&
    !parts &&
    !figures &&
    !work &&
    !counters &&
    !shapes;
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
  function answerContext() {
    return (
      <>
        <p className="answer-prompt-summary">
          <MathText text={problem.prompt} />
        </p>
        {choice && problem.figure && (
          <div className="choice-model">
            <ChoiceFigure
              figure={problem.figure}
              maxHeight={
                problem.templateId === "relation-point-removal"
                  ? 160
                  : undefined
              }
            />
          </div>
        )}
      </>
    );
  }
  function submitAnswer() {
    if (marking) setMarkReset((value) => value + 1);
    prepareFeedbackSound();
    props.submit();
  }
  function answerControls(includeContext = false) {
    if (trend)
      return (
        <TrendLineFitAnswer
          response={trend}
          value={outcome ? outcome.response : response}
          onChange={setResponse}
          locked={locked}
          sending={sending}
          submit={submitAnswer}
        />
      );
    if (counters)
      return (
        <CounterBuilderAnswer
          response={counters}
          value={outcome ? outcome.response : response}
          onChange={setResponse}
          locked={locked}
          sending={sending}
          submit={submitAnswer}
        />
      );
    if (problem.response.kind === "line-plot-build")
      return (
        <LinePlotBuildAnswer
          response={problem.response}
          value={outcome ? outcome.response : response}
          onChange={setResponse}
          locked={locked}
          busy={busy}
          sending={sending}
          resolved={!!outcome}
          submit={submitAnswer}
        />
      );
    if (shapes)
      return (
        <ShapeComposerAnswer
          response={shapes}
          value={outcome ? outcome.response : response}
          onChange={setResponse}
          locked={locked}
          sending={sending}
          submit={submitAnswer}
          stageIndex={Math.min(shapeStage, shapes.stages.length - 1)}
          setStage={setShapeStage}
        />
      );
    if (problem.response.kind === "point-plot")
      return (
        <PointPlotAnswer
          response={problem.response}
          value={outcome ? outcome.response : response}
          onChange={setResponse}
          locked={locked}
          busy={busy}
          sending={sending}
          resolved={!!outcome}
          submit={submitAnswer}
        />
      );
    if (problem.response.kind === "multi-part-choice")
      return (
        <MultiPartChoiceAnswer
          response={problem.response}
          value={outcome ? outcome.response : response}
          onChange={setResponse}
          locked={locked}
          busy={busy}
          sending={sending}
          resolved={!!outcome}
          submit={props.submit}
        />
      );
    if (problem.response.kind === "structured-work")
      return (
        <StructuredWorkAnswer
          response={problem.response}
          value={outcome ? outcome.response : response}
          onChange={setResponse}
          locked={locked}
          busy={busy}
          sending={sending}
          resolved={!!outcome}
          submit={submitAnswer}
        />
      );
    if (problem.response.kind === "figure-choice")
      return (
        <FigureChoiceAnswer
          response={problem.response}
          value={outcome ? outcome.response : response}
          busy={busy}
          sending={sending}
          resolved={!!outcome}
          submit={props.submit}
        />
      );
    if (problem.response.kind === "multi-select") {
      const selected = selectedIds;
      const complete = selected.length === problem.response.selectionCount;
      const optionFields = (
        <fieldset disabled={locked}>
          <legend>
            <MathText text={problem.response.label} />
          </legend>
          <div className="choice-options">
            {problem.response.options.map((option, index) => (
              <label
                key={option.id}
                className={`choice-option ${selected.includes(option.id) ? "selected" : ""}`}
              >
                <CheckboxControl
                  name={`answer-${problem.id}`}
                  value={option.id}
                  aria-label={spokenMath(option.label)}
                  checked={selected.includes(option.id)}
                  onChange={() =>
                    setResponse(
                      serializeSelection(
                        selected.includes(option.id)
                          ? selected.filter((id) => id !== option.id)
                          : [...selected, option.id],
                      ),
                    )
                  }
                />
                <span className="choice-letter" aria-hidden="true">
                  {"ABCDEFGH"[index]}
                </span>
                <span className="choice-content">
                  <MathText text={option.label} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      );
      return (
        <form
          className="choice-form multi-select-form"
          data-choice-count={problem.response.options.length}
          onSubmit={(event) => {
            event.preventDefault();
            if (busy || (!outcome && !complete)) return;
            outcome ? advance() : submitAnswer();
          }}
        >
          {includeContext ? (
            <div className="multi-select-context-scroll">
              <details className="multi-select-question">
                <summary>Problem and diagram</summary>
                {answerContext()}
              </details>
              {optionFields}
            </div>
          ) : (
            optionFields
          )}
          <p className="selection-count" role="status" aria-live="polite">
            {selected.length} of {problem.response.selectionCount} selected
          </p>
          <button
            className="choice-submit"
            type="submit"
            disabled={busy || (!outcome && !complete)}
            aria-busy={sending}
          >
            Check
          </button>
        </form>
      );
    }
    if (problem.response.kind === "choice")
      return (
        <form
          className="choice-form"
          data-choice-count={problem.response.options.length}
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && (outcome || response))
              outcome ? advance() : submitAnswer();
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
                  <span className="choice-content">
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
            aria-busy={sending}
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
            if (
              marking
                ? normalizeUnitSquareMarking(response) === null
                : !acceptedAnswer(response)
            )
              return setAnswerError(
                marking
                  ? "Enter a whole number of square units, such as 12."
                  : "Enter a number, decimal, or fraction such as 3/4.",
              );
            submitAnswer();
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
              aria-busy={sending}
            >
              {/* One label always. A lost connection is explained beside the field,
                and Check resends the same answer. */}
              Check
            </button>
          </div>
          <span id="answer-format" className="sr-only">
            {marking
              ? "Enter a whole number of square units."
              : "Enter a number, decimal or fraction. Negative answers use a minus sign."}
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
  function responseEditor() {
    return (
      <>
        {work && (
          <StructuredWorkInput
            key={problem.id}
            problemId={problem.id}
            response={work}
            value={outcome ? outcome.response : response}
            onChange={setResponse}
            locked={locked}
            marks={outcome && !outcome.skipped ? (outcome.parts ?? null) : null}
            small={small}
          />
        )}

        {figures && (
          <FigureChoiceInput
            problemId={problem.id}
            response={figures}
            value={outcome ? outcome.response : response}
            onChange={setResponse}
            locked={locked}
            review={
              outcome
                ? figureReview(figures, outcome.answer, outcome.response)
                : null
            }
          />
        )}
      </>
    );
  }
  function dockControls() {
    return (
      <>
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
              {compactAnswerLabel}
            </button>
          ) : (
            answerControls()
          )}
        </div>
        {/* Keeps its space under the feedback sheet so nothing moves. */}
        <div style={outcome ? { visibility: "hidden" } : undefined}>
          {tools()}
        </div>
      </>
    );
  }
  function progressFeedback() {
    return (
      <>
        {props.answerFeedback}
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
      </>
    );
  }
  function feedbackDetails() {
    if (!outcome) return null;
    return (
      <>
        <div
          className="feedback-head"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          // A long answer may scroll inside the head; keyboards reach it.
          tabIndex={longAnswer ? 0 : undefined}
        >
          <span className="result-mark" aria-hidden="true">
            {outcome.correct ? "✓" : skipped ? "→" : "✕"}
          </span>
          <span className="feedback-title">
            {skipped ? (
              <>
                {shapes
                  ? "One way to fill the outline."
                  : answerLine(outcome.answer)}
                <small>Skipped. Your progress is unchanged.</small>
              </>
            ) : outcome.correct ? (
              <>
                Correct
                {support && <small>{capitalize(support)}</small>}
              </>
            ) : shapes ? (
              shapeFeedbackSummary(shapes, outcome.response)
            ) : (
              <>
                {answerLine(outcome.answer)}
                {work ? (
                  // Each step is marked in the problem; the work stays
                  // readable for screen readers.
                  <small>
                    {workSummary(work, outcome.parts)}
                    <span className="sr-only">
                      . Your last line:{" "}
                      {spokenMath(displayResponse(outcome.response))}
                    </span>
                    {support && `, ${support}`}
                  </small>
                ) : parts ? (
                  // Each part is marked in the problem; the sentence
                  // stays for screen readers.
                  <small>
                    {partsSummary(parts, outcome)}
                    <span className="sr-only">
                      . You chose:{" "}
                      {spokenMath(displayResponse(outcome.response))}
                    </span>
                    {support && `, ${support}`}
                  </small>
                ) : counters && counterKey ? (
                  <small>
                    {counters.canRemove
                      ? `${counterKey.groups[0]} at the start; cross out ${counterKey.removed}.`
                      : `Show groups of ${counterKey.groups[0]} and ${counterKey.groups[1]}.`}
                    <span className="sr-only">
                      {" "}
                      You entered {displayResponse(outcome.response)}.
                    </span>
                    {support && ` ${capitalize(support)}.`}
                  </small>
                ) : plot || lineBuild || trend ? (
                  // The grid shows the learner's points beside the
                  // correct ones; the sentence stays for screen readers.
                  <small>
                    <span className="sr-only">
                      You placed {spokenMath(displayResponse(outcome.response))}
                      {support ? ", " : "."}
                    </span>
                    {support && capitalize(support)}
                  </small>
                ) : (
                  <small>
                    {problem.response.kind === "multi-select"
                      ? "You selected "
                      : figures || problem.response.kind === "choice"
                        ? "You chose "
                        : "You entered "}
                    <MathText text={displayResponse(outcome.response)} />
                    {support && `, ${support}`}
                  </small>
                )}
              </>
            )}
          </span>
        </div>
        {stepsInline && (
          <Glossary payload={outcome} texts={outcome.explanation}>
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
          </Glossary>
        )}
        {!editorInDock &&
          !counterCompact &&
          !trendCompact &&
          progressFeedback()}
      </>
    );
  }
  function tools(feedback = false) {
    return (
      <div className="practice-tools">
        {outcome ? (
          !stepsInline && (
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
        {outcome?.skipped && props.easier && (
          <button
            className="text-button"
            disabled={busy || pending}
            onClick={props.easier}
          >
            Try easier
          </button>
        )}
        {!outcome && props.skip && (
          <button
            className="text-button skip-action"
            disabled={busy}
            aria-busy={busy && skipping}
            aria-label="Skip this problem and see its answer"
            onClick={() => {
              setSkipping(true);
              props.skip?.();
            }}
          >
            Skip
          </button>
        )}
        <button
          className="text-button"
          disabled={lessonLoading}
          aria-busy={lessonLoading}
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
            } catch (failure) {
              console.error("AMP lesson failed to open:", failure);
              if (current())
                setLessonError(
                  "The lesson could not be opened. Check your connection and try again.",
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
  /** The worked explanation shows in the sheet itself: a miss explains
   * itself unless its answer is marked in the problem, a full answer column
   * always has room, and "See why" adds it anywhere else. Beside an editor,
   * See why opens a panel instead. */
  const stepsInline =
    !!outcome &&
    !scrollFeedback &&
    !counterCompact &&
    !trendCompact &&
    ((!outcome.correct && !deferSteps) || showWhy || fullColumn);
  const longAnswer =
    !!outcome &&
    !outcome.correct &&
    ((!!work && skipped) ||
      (!plot &&
        !lineBuild &&
        !trend &&
        !shapes &&
        !(work && !skipped) &&
        !(parts && (skipped || parts.layout === "table")) &&
        displayResponse(outcome.answer).length > 24));
  /** The worked answer in the feedback title. A plotted answer is drawn on
   * the grid above the sheet, so the sheet names where to look and keeps the
   * coordinates for screen readers; the explanation lists them in full. */
  const answerLine = (raw: string) =>
    counters && counterKey ? (
      <span className="solution-answer">
        Answer:{" "}
        <MathText
          text={`$${counterKey.sentence[0]} ${counterKey.sentence[1]} ${counterKey.sentence[2]} = ${counterKey.sentence[3]}$`}
        />
      </span>
    ) : plot ||
      lineBuild ||
      trend ||
      (work && !skipped) ||
      (parts && (skipped || parts.layout === "table")) ? (
      <span
        className="solution-answer plot-answer"
        data-text={displayResponse(raw)}
      >
        {lineBuild
          ? "Correct counts are below the plot"
          : work
            ? `Each ${work.layout === "proof" ? "line" : "step"} is marked`
            : parts
              ? skipped
                ? "The answer is filled in"
                : "Each row’s answer is ringed"
              : trend
                ? (!skipped &&
                    outcome &&
                    trendLineDiagnosis(trend, outcome.response)) ||
                  "One good fit is dashed"
                : plot?.connect === "line"
                  ? "The answer is dashed"
                  : "The answer is circled"}
        <span className="sr-only">
          . Answer: {spokenMath(displayResponse(raw))}
        </span>
      </span>
    ) : work && skipped ? (
      // Skipped work fills no row: every found value is listed, one per
      // line, as the steps would read.
      <span
        className="solution-answer"
        data-text={displayResponse(raw)}
        data-long=""
      >
        Answer
        <ol className="solution-rows">
          {structuredWorkRows(work, raw).map((row, index) => (
            <li key={index}>
              <MathText text={row} />
            </li>
          ))}
        </ol>
      </span>
    ) : (
      <span
        className="solution-answer"
        data-text={displayResponse(raw)}
        // A statement, a selection or worked lines read at body size, so
        // the sheet keeps room for progress, connections and Next.
        data-long={displayResponse(raw).length > 24 ? "" : undefined}
      >
        Answer:{" "}
        <strong>
          <MathText text={displayResponse(raw)} />
        </strong>
      </span>
    );
  const compactAnswerLabel =
    problem.response.kind === "multi-select"
      ? selectedIds.length
        ? `Review ${selectedIds.length} of ${problem.response.selectionCount} selected`
        : `Select ${problem.response.selectionCount} statements`
      : response
        ? choice
          ? "Review your choice"
          : `Your answer: ${response} · Edit`
        : choice
          ? "Choose an answer"
          : "Enter your answer";
  const frameTools = useShellTools();
  const topic = (
    <span className="workspace-topic-text">
      {props.satMathFocus ? "SAT Math · " : ""}
      {meta?.title ?? "Practice"}
    </span>
  );
  const toolbarContents = (
    <>
      {props.navigation ?? (
        <a
          className="workspace-level"
          href={props.exitHref}
          aria-label="Your progress"
          title="Your progress"
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
            Your progress
          </span>
        </a>
      )}
      <span
        className="workspace-topic"
        data-strand={props.strand}
        title={meta?.title ?? "Practice"}
      >
        {topic}
      </span>
      {props.status && <span className="workspace-status">{props.status}</span>}
      {/* Plotted answers are placed, not typed: the calculator's Use
              key has nothing to fill, and lattice arithmetic needs none. */}
      {props.calculator &&
      !plot &&
      !lineBuild &&
      !trend &&
      !parts &&
      !figures &&
      !work &&
      !shapes ? (
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
    </>
  );
  return (
    <main className="practice-workspace" aria-label="Math practice">
      <section
        className="practice-surface"
        data-line-plot-landscape={shortLinePlot || undefined}
        ref={surface}
        data-counter-compact={counterCompact || undefined}
      >
        {props.toolbarInFrame ? (
          frameTools &&
          createPortal(
            <div className="workspace-toolbar" data-in-frame>
              {toolbarContents}
            </div>,
            frameTools,
          )
        ) : (
          <div className="workspace-toolbar">{toolbarContents}</div>
        )}
        {props.toolbarInFrame && (
          <div
            className="workspace-topic practice-topic"
            data-strand={props.strand}
          >
            {topic}
          </div>
        )}
        <div
          className="problem-stage"
          data-shape-review={shapes && outcome && !sideBySide ? "" : undefined}
          ref={stage}
          tabIndex={0}
          aria-label="Problem workspace"
        >
          <div
            className="problem-content"
            data-template={problem.templateId}
            data-problem-id={problem.id}
          >
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
              !marking &&
              (choice ||
              plot ||
              trend ||
              lineBuild ||
              parts ||
              figures ||
              work ? (
                <ChoiceFigure
                  figure={problem.figure}
                  maxHeight={lineBuild ? 900 : undefined}
                />
              ) : (
                <Figure
                  figure={problem.figure}
                  compactMaxHeight={
                    problem.templateId === "perpendicular-slopes"
                      ? 260
                      : undefined
                  }
                />
              ))}
            {marking && (
              <UnitSquareMarkingInput
                key={problem.id}
                response={marking}
                locked={locked}
                resolved={!!outcome}
                resetKey={markReset}
              />
            )}
            {parts && (
              <MultiPartChoiceInput
                response={parts}
                // A skip is neutral: the worked answer fills the parts, with
                // no miss marks on blanks the learner never chose.
                value={
                  outcome
                    ? outcome.skipped
                      ? outcome.answer
                      : outcome.response
                    : response
                }
                onChange={setResponse}
                locked={locked}
                review={
                  outcome && !outcome.skipped
                    ? partsReview(parts, outcome.answer, outcome.response)
                    : null
                }
              />
            )}
            {!sideBySide && work && responseEditor()}
            {counters && (
              <CounterBuilderInput
                key={problem.id}
                response={counters}
                value={
                  outcome
                    ? outcome.skipped
                      ? outcome.answer
                      : outcome.response
                    : response
                }
                onChange={setResponse}
                locked={locked}
                resolved={!!outcome}
                skipped={outcome?.skipped}
              />
            )}
            {shapes && (
              <ShapeComposerInput
                key={`${problem.id}:${shapeStage}`}
                response={shapes}
                value={
                  outcome
                    ? outcome.skipped
                      ? outcome.answer
                      : outcome.response
                    : response
                }
                onChange={setResponse}
                locked={locked}
                resolved={!!outcome}
                stageIndex={Math.min(shapeStage, shapes.stages.length - 1)}
                setStage={setShapeStage}
                answer={outcome?.answer}
                skipped={outcome?.skipped}
              />
            )}
            {!sideBySide && figures && responseEditor()}
            {trend && (
              <TrendLineFitInput
                key={problem.id}
                response={trend}
                value={outcome ? outcome.response : response}
                onChange={setResponse}
                locked={locked}
                answer={outcome?.answer}
              />
            )}
            {lineBuild && (
              <LinePlotBuildInput
                key={problem.id}
                response={lineBuild}
                value={
                  outcome
                    ? outcome.skipped
                      ? outcome.answer
                      : outcome.response
                    : response
                }
                onChange={setResponse}
                locked={locked}
                answer={outcome?.answer}
                skipped={outcome?.skipped}
              />
            )}
            {plot && (
              <PointPlotInput
                response={plot}
                value={outcome ? outcome.response : response}
                onChange={setResponse}
                locked={locked}
                review={
                  outcome
                    ? plotReview(plot, outcome.answer, outcome.correct)
                    : null
                }
              />
            )}
          </div>
          <div className="feedback-spacer" ref={spacer} aria-hidden="true" />
          {celebrate && !trend && (
            <div className="practice-celebration" aria-hidden="true">
              <span>✓</span>
            </div>
          )}
        </div>
        <div
          className={`answer-dock${sideBySide && (work || figures) ? " editor-dock" : ""}`}
          ref={dock}
        >
          {sideBySide && (work || figures) && (
            <section
              className="answer-editor"
              tabIndex={0}
              aria-label={work ? "Your work" : "Your choices"}
            >
              {responseEditor()}
            </section>
          )}
          {editorInDock ? (
            <div className="editor-footer">{dockControls()}</div>
          ) : (
            dockControls()
          )}
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
            ref={sheet}
            className={`feedback solution-panel ${outcome.correct ? "correct" : skipped ? "skipped" : "incorrect"}`}
            role="region"
            aria-label="Answer feedback"
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
            {scrollFeedback ? (
              <div
                className="feedback-details"
                tabIndex={0}
                aria-label="Feedback details"
              >
                {feedbackDetails()}
              </div>
            ) : (
              feedbackDetails()
            )}
            {props.feedbackAside}
            <div className="next-row">
              {props.returnToMixed && (
                <button
                  className="mixed-action"
                  disabled={busy || pending}
                  onClick={props.returnToMixed}
                >
                  Mixed practice
                </button>
              )}
              <button
                className="next-action"
                ref={continueButton}
                aria-busy={busy}
                onClick={() => {
                  if (!busy) advance();
                }}
              >
                Next <span aria-hidden="true">→</span>
              </button>
            </div>
            {tools(true)}
          </div>
        )}
      </section>
      {outcome &&
        (scrollFeedback || counterCompact || trendCompact) &&
        showWhy && (
          <FocusDialog title="Explanation" close={() => setShowWhy(false)}>
            {progressFeedback()}
            <Glossary payload={outcome} texts={outcome.explanation}>
              <ol className="feedback-steps" aria-label="Explanation">
                {outcome.explanation.map((step, index) => (
                  <li key={index}>
                    <MathText text={step} />
                  </li>
                ))}
              </ol>
            </Glossary>
          </FocusDialog>
        )}
      {outcome && props.error && (
        <div className="feedback-navigation-error" role="alert">
          <span>{props.error}</span>
          <button onClick={props.clearError} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {lessonError && !(outcome && props.error) && (
        <div className="feedback-navigation-error" role="alert">
          <span>{lessonError}</span>
          <button onClick={() => setLessonError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {compact && entering && !panel && (
        <FocusDialog
          className={
            multiResponse
              ? "choice-entry-dialog multi-select-entry-dialog"
              : choice
                ? "choice-entry-dialog"
                : ""
          }
          title="Your answer"
          close={() => setEntering(false)}
        >
          {!(multiResponse && problem.figure) && answerContext()}
          <div className="answer-dock compact-entry">
            {answerControls(!!(multiResponse && problem.figure))}
          </div>
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
          className={panel === "hint" ? "hint-dialog" : ""}
          returnFocus={panel === "lesson" ? lessonTrigger.current : undefined}
          title={
            panel === "hint" ? "Hint" : (problemLessonView?.title ?? "Lesson")
          }
          close={() => setPanel(null)}
        >
          {panel === "hint" && (
            <>
              <Glossary
                payload={
                  hint && problem.hintSupport?.hint === hint
                    ? problem.hintSupport
                    : null
                }
                texts={[hint]}
              >
                <p className="hint">
                  {hint ? (
                    <MathText text={hint} />
                  ) : busy ? (
                    <Loading inline>Finding your hint…</Loading>
                  ) : (
                    "Your hint could not be loaded. Close this panel and try again."
                  )}
                </p>
              </Glossary>
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
              <button className="lesson-return" onClick={() => setPanel(null)}>
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
/** "2 of 3 parts correct", from the marks the problem shows. */
function partsSummary(
  response: Extract<PublicProblem["response"], { kind: "multi-part-choice" }>,
  outcome: Outcome,
) {
  const marks = partsReview(response, outcome.answer, outcome.response);
  if (!marks) return "Your choices are marked above";
  return `${marks.filter((m) => m.correct).length} of ${marks.length} parts correct`;
}
function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
