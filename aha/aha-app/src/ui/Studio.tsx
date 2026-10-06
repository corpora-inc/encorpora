import React from "react";
import { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  CircleHelp,
  Compass,
  Download,
  Flag,
  House,
  Lightbulb,
  LogOut,
  MessageCircle,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Sprout,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
// Lazy: the Activity Spec renderer (and zod, through its validator helpers) loads only when an AI
// activity is shown, so local-practice startup does not pay for it.
const ActivityView = lazy(() => import("../activity/render").then(m => ({ default: m.ActivityView })));
// Activity Spec hints and explanations are Spec rich text (plain text + $TeX$), not Markdown. The
// renderer module is loaded with the activity, so help never opens on an empty placeholder.
type SpecRenderer = typeof import("../activity/render");
let specRenderer: SpecRenderer | undefined;
const loadSpecRenderer = () => import("../activity/render").then(m => (specRenderer = m));
import { burst, feel, hapticsEnabled, isMilestone, setHapticsEnabled, shake, streakLevel } from "./celebrate";
import { ReportProblem } from "./ReportProblem";
import { ModelChoice, ModelStats } from "./ModelSettings";
import { SafeMarkdown } from "./SafeMarkdown";
import { Visual } from "./Visual";
import type { StudioProps } from "./types";
import "katex/dist/katex.min.css";
import "./studio.css";
export type { StudioProps, StudioActivity, StudioVisual, StudioSpecActivity } from "./types";

type View = "home" | "focus" | "growth";
/** What the help drawer shows: a hint (for local practice this includes an unrequested worked
 * example, which is that task's hint), the worked explanation, or the explanation that comes with a
 * recorded miss (local practice). */
type Drawer = "hint" | "explain" | "feedback" | null;
type HelpKind = "hint" | "explain";
type Sheet = "ask" | "status" | "flag" | null;

/** Swipe-down (or tap) to dismiss, for a drawer or sheet grab handle. The handle is a gesture
 * affordance; every drawer and sheet also has a labeled close button and closes on Escape. */
function useSwipeDown(onClose: () => void) {
  const start = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const end = (y: number | null) => {
    if (start.current === null) return;
    const d = y === null ? 0 : Math.max(0, y - start.current);
    start.current = null;
    setDy(0);
    if (y !== null && (d > 48 || d < 6)) onClose();
  };
  return {
    handle: {
      "aria-hidden": true as const,
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => { start.current = e.clientY; e.currentTarget.setPointerCapture?.(e.pointerId); },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => { if (start.current !== null) setDy(Math.max(0, e.clientY - start.current)); },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => end(e.clientY),
      onPointerCancel: () => end(null),
    },
    style: dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined,
  };
}

/** Help drawer: rises from the answer dock over the lower part of the problem. It never moves the
 * problem, the answer field or Check, and it never covers the answer field. */
function HelpDrawer({ kind, onClose, children, footer }: { kind: Exclude<Drawer, null>; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const swipe = useSwipeDown(onClose);
  const label = kind === "hint" ? "Hint" : "How it works";
  // The drawer grows upward from the dock; cap it below the focus bar (a soft keyboard can leave
  // less room than the CSS cap of half the viewport).
  const ref = useRef<HTMLElement>(null);
  const [room, setRoom] = useState<number>();
  useLayoutEffect(() => {
    const fit = () => {
      const el = ref.current, bar = document.querySelector(".focus-bar");
      if (el && bar) setRoom(Math.max(120, Math.floor(el.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom - 8)));
    };
    fit();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", fit);
    window.addEventListener("resize", fit);
    // A toast arriving under the drawer lifts its bottom edge.
    const rail = ref.current?.parentElement, observer = rail ? new ResizeObserver(fit) : undefined;
    if (rail) observer?.observe(rail);
    return () => { vv?.removeEventListener("resize", fit); window.removeEventListener("resize", fit); observer?.disconnect(); };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("dialog[open]")) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <section ref={ref} className={`help-drawer help-panel is-${kind}${kind === "feedback" ? " is-feedback" : ""}`} role="region" aria-label={label}
      style={{ ...(room ? { maxHeight: `min(calc(var(--aha-vvh, 100dvh) * 0.5), 380px, ${room}px)` } : {}), ...swipe.style }}>
      <div className="drawer-grab" {...swipe.handle}><span /></div>
      <button type="button" className="icon-button help-close" aria-label={`Close ${label.toLowerCase()}`} onClick={onClose}><X size={20} /></button>
      <div className="help-text" aria-live="polite">{children}</div>
      {footer}
    </section>
  );
}

/** Three breathing dots, shown inside a fixed-size control while it waits. */
const WaitDots = () => <span className="btn-wait" aria-hidden="true"><i /><i /><i /></span>;

/** Icon-only control with an accessible name and a visible label on hover, focus or long-press. */
function IconButton({ label, icon, onClick, disabled, active, badge, expanded }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; badge?: boolean; expanded?: boolean;
}) {
  const [tip, setTip] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const pressed = useRef(false);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={`icon-tool${active ? " is-active" : ""}${tip ? " show-tip" : ""}`}
      aria-label={label}
      aria-expanded={expanded}
      data-tip={label}
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch") return;
        pressed.current = false;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          pressed.current = true;
          setTip(true);
          timer.current = window.setTimeout(() => setTip(false), 1600);
        }, 450);
      }}
      onPointerUp={() => { if (!pressed.current) window.clearTimeout(timer.current); }}
      onPointerCancel={() => window.clearTimeout(timer.current)}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        // A long-press reveals the label; it does not also trigger the action.
        if (pressed.current) { pressed.current = false; return; }
        onClick();
      }}
    >
      {icon}
      {badge && <span className="tool-badge" aria-hidden="true" />}
    </button>
  );
}

/** Modal bottom sheet (phone) / centered card (wider screens). */
function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const swipe = useSwipeDown(onClose);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-label={label} style={swipe.style} onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && (
        <div className="sheet-body">
          <div className="sheet-grab" {...swipe.handle}><span /></div>
          <button type="button" className="icon-button sheet-close" aria-label="Close" onClick={onClose}><X size={22} /></button>
          {children}
        </div>
      )}
    </dialog>
  );
}

const STATUS = { confident: "Remembered", growing: "Taking root", review: "Ready to revisit" } as const;
/** The focus loop is endless; its bar only marks a quiet lap of this many items. */
const LAP = 10;
/** "today", "yesterday", "3 days ago", in the device language. */
function when(at: string) {
  const day = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const days = Math.round((day(new Date()) - day(new Date(at))) / 86_400_000);
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-days, "day");
}
/** The last seven days, a dot for each day with practice, and the run of days in a row. */
function WeekStrip({ growth }: { growth: NonNullable<StudioProps["growth"]> }) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });
  const done = growth.week.filter(d => d.practiced).length;
  return (
    <div className="week-strip">
      <ol aria-label={`Practice in the last 7 days: ${done}`}>
        {growth.week.map(d => (
          <li key={d.date} className={`${d.practiced ? "is-done" : ""}${d.today ? " is-today" : ""}`}>
            <span aria-hidden="true">{weekday.format(new Date(`${d.date}T12:00`))}</span><i aria-hidden="true" />
          </li>
        ))}
      </ol>
      {growth.streak >= 2 && <span className="week-streak">{growth.streak} days in a row</span>}
    </div>
  );
}

export function Studio(props: StudioProps) {
  const [view, setView] = useState<View>("home");
  const [settings, setSettings] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>(null);
  /** Help the learner asked for; it opens once the host has saved the assistance. */
  const [pendingHelp, setPendingHelp] = useState<HelpKind | null>(null);
  /** Local practice: help text received per kind for the current task. */
  const [helpTexts, setHelpTexts] = useState<{ hint?: string; explain?: string }>({});
  /** Activity Spec: how many of its hints the learner has revealed, and whether the explanation was. */
  const [revealed, setRevealed] = useState(0);
  const [explainSeen, setExplainSeen] = useState(false);
  /** The learner asked for the next item (Next, Try something harder, Set it aside). */
  const [advancing, setAdvancing] = useState(false);
  const [dismissedError, setDismissedError] = useState<string>();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [newName, setNewName] = useState("");
  const [startGrade, setStartGrade] = useState(3);
  const [deleting, setDeleting] = useState(false);
  const promptRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  /** The learner pressed Check: only then does an outcome celebrate (never a restored one). */
  const armed = useRef(false);
  const streak = useRef(0);
  const [streakShown, setStreakShown] = useState(0);
  const [haptics, setHaptics] = useState(() => hapticsEnabled());
  const feedbackRegion = useRef<HTMLDivElement>(null);
  const settingsReturn = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const studioRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const seenHint = useRef<string | undefined>(undefined);
  const answerId = useId();
  const titleId = useId();
  const a = props.spec ? undefined : props.activity;
  const spec = props.spec;
  const taskId = spec ? (spec.id ?? spec.spec.id) : a?.id;
  const hasTask = !!taskId;
  const specHints = spec?.spec.hints ?? [];
  const specGraded = !!spec?.result && !spec.result.invalid;
  const [renderer, setRenderer] = useState(specRenderer);
  useEffect(() => { if (spec && !renderer) void loadSpecRenderer().then(setRenderer); }, [!!spec]);
  useEffect(() => {
    setAnswer("");
    setDrawer(null);
    setPendingHelp(null);
    setHelpTexts({});
    setRevealed(0);
    setExplainSeen(false);
    setAdvancing(false);
    if (sheet === "flag") setSheet(null);
  }, [taskId]);
  useEffect(() => { if (!props.busy) setAdvancing(false); }, [props.busy]);
  // Waiting shows only after a moment, so a quick save never flashes dots or a veil.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!props.busy) { setSlow(false); return; }
    const t = window.setTimeout(() => setSlow(true), 400);
    return () => window.clearTimeout(t);
  }, [props.busy]);
  useEffect(() => { if (!props.error) setDismissedError(undefined); }, [props.error]);
  useEffect(() => {
    if (taskId && view === "focus") promptRef.current?.focus({ preventScroll: true });
  }, [taskId, view]);
  useEffect(() => {
    if (!props.feedback) return;
    // The answer's feedback takes the learner's attention; open help folds away (the icon reopens it).
    if (props.feedback.kind !== "info") setDrawer(null);
    if (props.feedback.kind !== "nudge") feedbackRegion.current?.focus({ preventScroll: true });
  }, [props.feedback?.kind, props.feedback?.title, props.feedback?.message]);
  // A nudge hands the answer straight back for a quick fix once the controls are enabled again;
  // the line itself is a live status. Choice and symbol answers focus their current or first option.
  useEffect(() => {
    if (props.feedback?.kind !== "nudge" || props.busy) return;
    const field = document.getElementById(answerId) as HTMLElement | null;
    const option = document.querySelector<HTMLElement>(`input[name="${answerId}"]:checked, input[name="${answerId}"], .focus-dock .answer-symbols button[aria-pressed="true"], .focus-dock .answer-symbols button`);
    (field ?? option ?? feedbackRegion.current)?.focus({ preventScroll: true });
  }, [props.feedback?.kind, props.feedback?.title, props.busy]);
  // Requested help opens once the host has finished saving it as assistance (busy is over), so
  // the learner never sees help that the durable record does not count. Activity Spec help comes
  // from the spec itself, so a repeated or re-opened request always has content; local practice
  // help is the host's hint text.
  useEffect(() => {
    if (!pendingHelp || props.busy) return;
    const kind = pendingHelp;
    setPendingHelp(null);
    if (props.error) return;
    if (spec) {
      if (kind === "hint") setRevealed(r => Math.min(specHints.length, r + 1));
      else setExplainSeen(true);
    } else {
      if (!props.hint) return;
      setHelpTexts(t => ({ ...t, [kind]: props.hint }));
    }
    setDrawer(kind);
  }, [pendingHelp, props.busy, props.hint, props.error]);
  // Help the learner did not ask for. Local practice: a worked example (or a restored hint) opens
  // the drawer once; dismissing it keeps it closed. Activity Spec: a restored hint or explanation
  // only marks what was already revealed.
  useEffect(() => {
    if (!props.hint || !hasTask) return;
    if (spec) {
      const i = specHints.indexOf(props.hint);
      if (i >= 0) setRevealed(r => Math.max(r, i + 1));
      else if (props.hint === spec.spec.explanation) setExplainSeen(true);
      return;
    }
    if (props.busy || pendingHelp || view !== "focus") return;
    if ([helpTexts.hint, helpTexts.explain].includes(props.hint)) return;
    const key = `${taskId}|${props.hint}`;
    if (key === seenHint.current) return;
    seenHint.current = key;
    // The host's unrequested text (a worked example or a restored hint) is this task's hint, so the
    // Hint icon reopens it without asking, and counting, again.
    setHelpTexts(t => ({ ...t, hint: props.hint }));
    setDrawer("hint");
  }, [props.hint, props.busy, pendingHelp, taskId, view, hasTask]);
  useEffect(() => {
    if (props.curiosity && view === "focus") setSheet("ask");
  }, [!!props.curiosity, props.curiosity?.answer, view]);
  useEffect(() => {
    if (settings) dialog.current?.showModal();
    else dialog.current?.close();
  }, [settings]);
  // Size the focus view to the visible viewport so the answer dock stays above a soft keyboard,
  // whether or not the WebView resizes its layout viewport.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => document.documentElement.style.setProperty("--aha-vvh", `${Math.round(vv.height)}px`);
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);
  // Settings must end above the docked bottom nav (#885). The nav's height follows its text (the
  // Android WebView scales text with the system font size) plus the gesture-bar inset, so measure it.
  const navShown = view !== "focus";
  useEffect(() => {
    const nav = navRef.current, root = studioRef.current;
    if (!navShown || !nav || !root) return;
    const update = () => root.style.setProperty("--aha-nav-measured", `${Math.ceil(nav.getBoundingClientRect().height)}px`);
    update();
    const observer = new ResizeObserver(update);
    // border-box: an inset-only change (gesture vs 3-button navigation) resizes padding, not content.
    observer.observe(nav, { box: "border-box" });
    return () => { observer.disconnect(); root.style.removeProperty("--aha-nav-measured"); };
  }, [navShown]);
  const openSettings = () => {
    const opener = document.activeElement as HTMLElement | null;
    settingsReturn.current = opener?.closest(".sheet") ? document.querySelector<HTMLElement>(".status-dot") : opener;
    setSheet(null);
    setSettings(true);
  };
  const closeSettings = () => {
    setSettings(false);
    setDeleting(false);
    settingsReturn.current?.focus?.();
  };
  const closeAsk = () => {
    // An answer still in flight stays visible; closing then would hide a paid reply.
    if (props.curiosity && !props.curiosity.answer && props.busy) return;
    if (props.curiosity) props.onCloseCuriosity();
    setSheet(null);
  };
  const completed = Math.max(0, props.session.completed);
  const readyNext = props.activityAnswered || props.feedback?.kind === "correct" || specGraded;
  // The loop never ends. The bar fills over a lap of LAP items; the answer that completes a lap
  // fills it and glows once, then the next item starts a fresh lap. Nothing waits on it.
  const lap = completed % LAP;
  const lapDone = completed > 0 && lap === 0 && readyNext;
  const lapValue = lapDone ? LAP : lap;
  const learningVisible = view === "focus" && !settings && !sheet && !props.curiosity && hasTask && !readyNext;
  useEffect(() => {
    props.onLearningVisibleChange?.(learningVisible);
    return () => props.onLearningVisibleChange?.(false);
  }, [learningVisible, props.onLearningVisibleChange]);

  const enterFocus = () => {
    setView("focus");
    if (!hasTask && !props.busy) props.onContinue();
  };
  const statusText = props.mode === "preview"
    ? "Browser preview · sample practice · progress stays in this preview"
    : props.practiceStatus ?? (props.account.aiReady ? "AI tutoring" : "Local practice");
  const ai = props.practiceMode === "ai";
  const progress = (lapValue / LAP) * 100;
  const growth = props.growth;

  // ---------- focus mode pieces ----------
  // Stable stage: the bar, the problem region and the answer dock (tools row, answer, Check) keep
  // their geometry for the whole item. Feedback, help, loading and errors are overlays.
  const closeDrawer = () => setDrawer(null);
  const helpReady = (kind: HelpKind) =>
    spec ? (kind === "hint" ? revealed > 0 : explainSeen || specGraded) : !!helpTexts[kind];
  const askForHelp = (kind: HelpKind) => {
    if (props.busy || pendingHelp) return;
    setPendingHelp(kind);
    props.onSupport(kind);
  };
  /** A help icon toggles its drawer. Help already shown for this item reopens without a new request. */
  const toggleHelp = (kind: HelpKind) => {
    if (drawer === kind) return setDrawer(null);
    if (helpReady(kind)) return setDrawer(kind);
    askForHelp(kind);
  };
  const showHow = () => {
    if (!spec && props.feedback?.kind === "retry" && props.feedback.message) return setDrawer(drawer === "feedback" ? null : "feedback");
    toggleHelp("explain");
  };
  const advance = (go: () => void) => { setAdvancing(true); setDrawer(null); go(); };
  const moreHints = spec && drawer === "hint" && !specGraded && revealed < specHints.length;
  const drawerBody = (() => {
    if (!drawer || !hasTask) return null;
    if (drawer === "feedback") return props.feedback?.message ? <SafeMarkdown>{props.feedback.message}</SafeMarkdown> : null;
    if (spec) {
      const Rich = renderer?.RichText;
      if (!Rich) return null;
      if (drawer === "hint") return revealed ? specHints.slice(0, revealed).map((h, i) => <Rich key={i} as="p" text={h} className="help-step" />) : null;
      if (drawer === "explain") return spec.spec.explanation.trim() ? <Rich as="p" text={spec.spec.explanation} className="help-step" /> : null;
      return null;
    }
    const text = helpTexts[drawer];
    return text ? <SafeMarkdown>{text}</SafeMarkdown> : null;
  })();
  const helpDrawer = drawer && drawerBody ? (
    <HelpDrawer key={drawer} kind={drawer} onClose={closeDrawer}
      footer={moreHints ? (
        <button type="button" className="text-button another-hint" disabled={props.busy} onClick={() => askForHelp("hint")}>
          <Lightbulb size={17} aria-hidden="true" /> Another hint
        </button>
      ) : undefined}>
      {drawerBody}
    </HelpDrawer>
  ) : null;
  // Errors float at the top of the stage until dismissed or the next action clears them.
  const errorToast = props.error && !settings && props.error !== dismissedError ? (
    <div className="stage-alert error-banner" role="alert">
      <CircleHelp size={20} aria-hidden="true" /><span>{props.error}</span>
      <button type="button" className="icon-button alert-close" aria-label="Dismiss" onClick={() => setDismissedError(props.error)}><X size={18} /></button>
    </div>
  ) : null;
  const hintDisabled = props.busy || readyNext || (!!spec && !specHints.length);
  const explainDisabled = props.busy || (!!spec && !spec.spec.explanation.trim());
  const tools = hasTask ? (
    <div className="focus-tools" role="toolbar" aria-label="Help options">
      <IconButton label="Hint" icon={<Lightbulb size={22} />} disabled={hintDisabled}
        active={drawer === "hint"} expanded={drawer === "hint"}
        onClick={() => toggleHelp("hint")} />
      <IconButton label="Show me how" icon={<BookOpen size={22} />} disabled={explainDisabled}
        active={drawer === "explain" || drawer === "feedback"} expanded={drawer === "explain" || drawer === "feedback"}
        badge={(props.feedback?.kind === "retry" || (!!spec && !!spec.result && !spec.result.correct && !spec.result.invalid)) && drawer !== "feedback" && drawer !== "explain"}
        onClick={showHow} />
      <IconButton label="Try something harder" icon={<TrendingUp size={22} />} disabled={props.busy} onClick={() => advance(() => props.onSupport("harder"))} />
      <IconButton label="Something seems off" icon={<Flag size={21} />} disabled={props.busy} onClick={() => setSheet("flag")} />
      <IconButton label="Ask a question" icon={<MessageCircle size={22} />} disabled={props.busy}
        expanded={sheet === "ask"} onClick={() => setSheet("ask")} />
    </div>
  ) : null;
  // Check and Next share one slot at one size; while waiting, the label gives way to dots.
  const nextButton = (
    <button ref={nextRef} className={`primary-button dock-primary${props.busy && slow ? " is-busy" : ""}`} type="button" disabled={props.busy} onClick={() => advance(props.onContinue)}>
      <span className="btn-label">Next <ArrowRight size={20} aria-hidden="true" /></span><WaitDots />
    </button>
  );
  const stopButton = props.busy && props.onCancel ? (
    <button type="button" className="secondary-button veil-stop" onClick={props.onCancel}>Stop AI request</button>
  ) : null;
  // Moving to the next item: a shimmer veils the finished problem. No status text row appears.
  const veil = advancing && props.busy && slow && hasTask ? (
    <div className="stage-veil">
      <span className="veil-skeleton" aria-hidden="true"><i /><i /><i /></span>
      {stopButton}
    </div>
  ) : null;
  // The answer's feedback floats just above the dock, a toast that never moves the dock.
  const outcome = !hasTask ? undefined : spec
    ? spec.result && { kind: spec.result.invalid ? "info" : spec.result.correct ? "correct" : "retry", title: spec.result.invalid ?? (spec.result.correct ? "Yes, that’s it." : "Not quite yet.") }
    : props.feedback && { kind: props.feedback.kind, title: props.feedback.title };
  const seeHow = !outcome ? null
    : spec ? (outcome.kind === "retry" && drawer !== "explain" ? () => setDrawer("explain") : null)
    : props.feedback?.kind === "retry" && props.feedback.message && drawer !== "feedback" ? () => setDrawer("feedback")
    : props.feedback?.kind === "nudge" && drawer !== "explain" ? () => toggleHelp("explain")
    : null;
  // The answer's moment, once per checked answer: a burst around Next (in Check's slot), a springy
  // check and a light haptic for correct, escalating a little at three and five in a row; a gentle
  // shake of the answer field and a soft haptic for a miss. All overlays; nothing waits on them.
  const outcomeKey = outcome ? `${taskId}|${outcome.kind}|${outcome.title}` : undefined;
  useEffect(() => {
    if (!outcome || !armed.current) return;
    armed.current = false;
    if (outcome.kind === "correct") {
      const run = streak.current += 1;
      setStreakShown(run);
      burst(nextRef.current, streakLevel(run));
      void feel(isMilestone(run) ? "milestone" : "correct");
    } else if (outcome.kind === "retry" || outcome.kind === "nudge") {
      streak.current = 0;
      setStreakShown(0);
      shake(studioRef.current?.querySelector(".focus-dock .answer-input-wrap, .focus-dock .answer-symbols, .ax-dock .ax-response, .choices label.chosen, .ax-choice.is-checked") ?? null);
      void feel("wrong");
    }
  }, [outcomeKey]);
  const level = outcome?.kind === "correct" ? streakLevel(streakShown) : 0;
  const milestone = outcome?.kind === "correct" && isMilestone(streakShown);
  // Moving on retires the finished item's toast at once; the veil takes over if the wait is long.
  const toast = outcome && !advancing ? (
    <div key={`${taskId}|${outcome.kind}|${outcome.title}`} className={`stage-toast feedback-line ${outcome.kind}${level ? ` streak-${level}` : ""}`} role="status" tabIndex={-1} ref={feedbackRegion}>
      {outcome.kind === "correct" ? <span className="celebrate" aria-hidden="true"><Check size={20} /></span> : <Lightbulb size={20} aria-hidden="true" />}
      <strong>{outcome.title}</strong>{milestone && <span className="streak-note">{streakShown} in a row</span>}
      {seeHow && <button type="button" className="text-button see-how" disabled={props.busy} onClick={seeHow}>See how</button>}
    </div>
  ) : null;
  const busyStatus = <p className="sr-only" role="status">{props.busy ? (props.busyLabel ?? "Working on it…") : ""}</p>;
  const promptSize = a ? (a.prompt.length <= 22 ? "xl" : a.prompt.length <= 70 ? "l" : "m") : "m";
  const symbols = a?.answerKind === "comparison" ? ["<", "=", ">"] : [];
  const symbolName = (s: string) => s === "<" ? "Less than" : s === ">" ? "Greater than" : "Equal to";
  const submitLocal = () => { if (!props.busy && answer.trim() && !readyNext) { armed.current = true; props.onSubmit(answer.trim()); } };

  const focusStage = spec ? (
    <div className="focus-stage is-spec" aria-busy={props.busy}>
      <div className="stage-focus-target" ref={promptRef} tabIndex={-1} role="group" aria-label="Problem" />
      <Suspense fallback={<div className="stage-wait"><span className="wait-dots" aria-hidden="true"><i /><i /><i /></span></div>}>
      <ActivityView
        key={taskId}
        spec={spec.spec}
        compact
        theme="auto"
        result={spec.result}
        initialResponse={spec.initialResponse}
        disabled={props.busy}
        onSubmit={(response) => { armed.current = true; spec.onSubmit(response); }}
        dockTop={tools}
        overlay={<>{toast}{helpDrawer}</>}
        stageOverlay={veil}
        next={nextButton}
      />
      </Suspense>
      {errorToast}
    </div>
  ) : a ? (
    <form className={`focus-stage${a.answerKind === "choice" && a.choices?.length ? " has-choices" : ""}`} aria-busy={props.busy} onSubmit={(e) => { e.preventDefault(); submitLocal(); }}>
      <div className="stage-area">
        <div className="stage-scroll" data-stage-content="">
          <div className={`stage-prompt prompt-${promptSize}`} ref={promptRef} tabIndex={-1}>
            <SafeMarkdown>{a.prompt}</SafeMarkdown>
          </div>
          {a.visual && <Visual key={a.id} spec={a.visual} />}
          {a.answerKind === "choice" && a.choices?.length ? (
            <fieldset className="choices">
              <legend className="sr-only">Your answer</legend>
              {a.choices.map((choice, i) => (
                <label key={choice.id} className={answer === choice.id ? "chosen" : ""}>
                  <input type="radio" name={answerId} value={choice.id} checked={answer === choice.id}
                    disabled={props.busy || readyNext} onChange={() => setAnswer(choice.id)} />
                  <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
                  <SafeMarkdown>{choice.label}</SafeMarkdown>
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
        {veil}
      </div>
      <div className="focus-dock">
        <div className="stage-overlay-rail">{toast}{helpDrawer}</div>
        {tools}
        <div className="dock-row">
          {a.answerKind !== "choice" && (
            symbols.length ? (
              <div className="answer-symbols" role="group" aria-label="Your answer" data-stage-content="">
                {symbols.map(s => (
                  <button key={s} type="button" disabled={props.busy || readyNext} aria-label={symbolName(s)}
                    aria-pressed={answer === s} onClick={() => setAnswer(s)}>{s}</button>
                ))}
              </div>
            ) : (
              <div className="answer-input-wrap" data-stage-content="">
                {a.signed && (
                  <button type="button" className="sign-key" disabled={props.busy || readyNext}
                    aria-label="Change positive or negative sign" aria-pressed={answer.startsWith("-")}
                    onClick={() => setAnswer(answer.startsWith("-") ? answer.slice(1) : `-${answer}`)}>−</button>
                )}
                <input
                  id={answerId}
                  aria-label="Your answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  inputMode={a.answerKind === "number" ? "decimal" : "text"}
                  placeholder={a.answerKind === "fraction" ? "Like 3/4" : "Your answer"}
                  disabled={props.busy || readyNext}
                  maxLength={160}
                />
              </div>
            )
          )}
          {readyNext ? nextButton : (
            <button className={`primary-button dock-primary${props.busy && slow ? " is-busy" : ""}`} type="submit" disabled={props.busy || !answer.trim()}>
              <span className="btn-label">Check</span><WaitDots />
            </button>
          )}
        </div>
      </div>
      {errorToast}
    </form>
  ) : (
    <div className="focus-stage is-empty" aria-busy={props.busy}>
      <div className="stage-scroll">
        {props.busy ? (
          <div className="stage-wait"><span className="wait-dots" aria-hidden="true"><i /><i /><i /></span>{stopButton}</div>
        ) : (
          <div className="stage-message">
            {props.feedback ? (
              <div className={`feedback-line ${props.feedback.kind}`} role="status" tabIndex={-1} ref={feedbackRegion}>
                <Lightbulb size={20} aria-hidden="true" /><strong>{props.feedback.title}</strong>
              </div>
            ) : (
              <p className="stage-invite">Your next “aha” is waiting.</p>
            )}
            {props.hint && <div className="hint-note"><SafeMarkdown>{props.hint}</SafeMarkdown></div>}
          </div>
        )}
      </div>
      <div className="focus-dock">
        <div className="dock-row">{nextButton}</div>
      </div>
      {errorToast}
    </div>
  );

  const focus = (
    <div className="focus-view">
      <header className="focus-bar">
        <div className="focus-bar-inner">
          <IconButton label="Home" icon={<House size={22} />} onClick={() => { setDrawer(null); setView("home"); }} />
          <div className={`focus-progress${lapDone ? " is-milestone" : ""}`} role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={LAP}
            aria-valuenow={lapValue}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <button type="button" className={`status-dot ${ai ? "is-ai" : "is-local"}`} aria-label={statusText}
            aria-haspopup="dialog" onClick={() => setSheet("status")}>
            {ai ? <Sparkles size={16} aria-hidden="true" /> : <span aria-hidden="true" />}
          </button>
        </div>
      </header>
      <main id="activity" className="focus-main">{focusStage}</main>
      {busyStatus}
    </div>
  );

  // ---------- home / growth ----------
  const nav = (
    <nav className="home-nav" aria-label="Main" ref={navRef}>
      <button type="button" className={view === "home" ? "active" : ""} aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}>
        <Compass size={21} aria-hidden="true" /> Studio
      </button>
      <button type="button" className={view === "growth" ? "active" : ""} aria-current={view === "growth" ? "page" : undefined} onClick={() => setView("growth")}>
        <Sprout size={21} aria-hidden="true" /> Growth
      </button>
      <button type="button" onClick={openSettings}>
        <Settings size={21} aria-hidden="true" /> Settings
      </button>
    </nav>
  );
  const home = (
    <div className="home-view">
      <header className="home-header">
        <a className="wordmark" href="#" aria-label="AHA home" onClick={(e) => { e.preventDefault(); setView("home"); }}>
          ¡AHA!<span className="wordmark-dot" />
        </a>
        <button type="button" className="profile-button" onClick={openSettings} aria-label={`${props.learnerName || "Learner"}: open settings`}>
          <span className="avatar">{props.learnerName.slice(0, 1).toUpperCase() || "A"}</span>
          <span className="profile-name">{props.learnerName}</span>
        </button>
      </header>
      {nav}
      <main id="activity" className="home-main" key={view}>
        {view === "home" ? (
          <section className="home-hero" aria-labelledby={`${titleId}-home`}>
            <h1 id={`${titleId}-home`}>Big ideas.<br />Little discoveries.</h1>
            <div className="home-today">
              <div className="home-session">
                <div className="home-meter" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={LAP} aria-valuenow={lapValue}>
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>
              {growth && <WeekStrip growth={growth} />}
              {growth?.recent[0] && (
                <p className="home-recent"><Sprout size={18} aria-hidden="true" /><span>{growth.recent[0].title}</span></p>
              )}
            </div>
            {props.error && <div className="error-banner" role={settings ? undefined : "alert"}><CircleHelp size={20} aria-hidden="true" /><span>{props.error}</span></div>}
            <button type="button" className="primary-button home-start" disabled={props.busy && !hasTask} onClick={enterFocus}>
              {props.busy && !hasTask ? (props.busyLabel ?? "Getting ready…") : hasTask ? "Continue" : "Let’s begin"}
              <ArrowRight size={20} aria-hidden="true" />
            </button>
            {props.mode === "preview" && <p className="home-note">{statusText}</p>}
          </section>
        ) : (
          <section className="progress-page" aria-labelledby={`${titleId}-growth`}>
            <div className="progress-heading">
              <h1 id={`${titleId}-growth`}>Growth</h1>
              {growth && <WeekStrip growth={growth} />}
            </div>
            {growth?.areas.length ? (
              <div className="growth-layout">
                <div className="progress-grid">
                  {growth.areas.map(area => (
                    <article key={area.id} className="growth-area">
                      <h2>{area.label}</h2>
                      <ul>
                        {area.skills.map(skill => (
                          <li key={skill.id}>
                            <span className={`growth-mark ${skill.status}`} aria-hidden="true" />
                            <span className="growth-skill">{skill.title}</span>
                            <span className="sr-only">{STATUS[skill.status]}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
                <aside className="growth-side">
                  <ul className="growth-key" aria-label="Key">
                    {(["confident", "growing", "review"] as const).map(k => (
                      <li key={k}><span className={`growth-mark ${k}`} aria-hidden="true" />{STATUS[k]}</li>
                    ))}
                  </ul>
                  {!!growth.recent.length && (
                    <section className="growth-recent" aria-labelledby={`${titleId}-recent`}>
                      <h2 id={`${titleId}-recent`}>Recent discoveries</h2>
                      <ol>
                        {growth.recent.map(r => (
                          <li key={r.skillId}>
                            <span className="growth-skill">{r.title}</span>
                            <span className="growth-when">{r.area} · {when(r.at)}</span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                </aside>
              </div>
            ) : (
              <p className="empty-progress">Your first discovery is a great place to start.</p>
            )}
            <button type="button" className="primary-button growth-back" onClick={enterFocus}>
              Back to exploring <ArrowRight size={18} aria-hidden="true" />
            </button>
          </section>
        )}
        <p className="quiet-note"><ShieldCheck size={16} aria-hidden="true" /> Your learning, saved on this device.</p>
      </main>
    </div>
  );

  return (
    <div className={`aha-studio view-${view}`} ref={studioRef}>
      {view === "focus" ? focus : home}
      <Sheet open={sheet === "status"} onClose={() => setSheet(null)} label="Practice status">
        <div className={`status-sheet ${ai ? "is-ai" : "is-local"}`}>
          <span className="status-sheet-icon" aria-hidden="true">{ai ? <Sparkles size={22} /> : <ShieldCheck size={22} />}</span>
          <p>{statusText}</p>
        </div>
        {ai && props.authoringModel && <p className="status-model">Written by {props.authoringModel}</p>}
        <button type="button" className="secondary-button" onClick={openSettings}><Settings size={17} aria-hidden="true" /> Settings</button>
      </Sheet>
      <Sheet open={sheet === "flag"} onClose={() => setSheet(null)} label="Something seems off">
        <p className="sheet-title">Something seems off?</p>
        <p className="sheet-text">We’ll set this problem aside. It won’t count.</p>
        <div className="sheet-actions">
          <button type="button" className="primary-button" disabled={props.busy} onClick={() => { setSheet(null); advance(() => props.onSupport("dispute")); }}>Set it aside</button>
          <button type="button" className="secondary-button" onClick={() => setSheet(null)}>Keep going</button>
        </div>
      </Sheet>
      <Sheet open={sheet === "ask" && view === "focus" && !settings} onClose={closeAsk} label="Ask a question">
        {props.curiosity ? (
          <section className="curiosity-conversation" aria-label="Curiosity conversation">
            <p className="curiosity-question">{props.curiosity.question}</p>
            {props.curiosity.answer ? (
              <SafeMarkdown>{props.curiosity.answer}</SafeMarkdown>
            ) : (
              <>
                <p role="status">{props.busy ? "Thinking about that…" : "That answer could not finish. No new paid request will start automatically."}</p>
                {props.busy && props.onCancel && <button type="button" className="text-button" onClick={props.onCancel}>Stop AI request</button>}
              </>
            )}
            <button type="button" className="text-button" onClick={closeAsk}>
              <ChevronLeft size={16} aria-hidden="true" /> Back to the problem
            </button>
          </section>
        ) : (
          <section className="curiosity-conversation">
            <form onSubmit={(e) => {
              e.preventDefault();
              if (question.trim() && !props.busy) { props.onCuriosity(question.trim()); setQuestion(""); }
            }}>
              <label htmlFor="curiosity-question" className="sheet-title">What are you wondering?</label>
              <div className="curiosity-input">
                <input id="curiosity-question" value={question} maxLength={400} onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What could I use this for?" />
                <button className="icon-button" disabled={!question.trim() || props.busy} aria-label="Ask question">
                  <ArrowUpRight size={22} />
                </button>
              </div>
            </form>
            <button type="button" className="suggestion" disabled={props.busy}
              onClick={() => props.onCuriosity("Where would I use this in real life?")}>
              Where would I use this in real life? ↗
            </button>
          </section>
        )}
      </Sheet>
      <dialog
        ref={dialog}
        className="settings-dialog"
        aria-labelledby={titleId}
        onCancel={closeSettings}
        onClick={(e) => { if (e.target === dialog.current) closeSettings(); }}
      >
        <div className="dialog-header">
          <h2 id={titleId}>Settings</h2>
          <button className="icon-button" aria-label="Close settings" onClick={closeSettings}><X size={23} /></button>
        </div>
        <div className="settings-body">
          <section>
            <h3>{props.account.connected ? (props.account.label ?? "Connected to Free2Z") : "AI tutoring with Free2Z"}</h3>
            <p>
              A Free2Z account supplies AI access. Progress stays in this app. Selected mathematical
              learning context is sent to Free2Z and its model provider; names aren’t needed.
            </p>
            <span className={`connection-pill ${props.account.connected && props.account.aiReady ? "ready" : "local"}`}>
              {props.account.connected ? props.account.aiReady ? "AI ready" : "Connected · AI not ready" : "Local practice"}
            </span>
            {props.account.connected && !props.account.aiReady && <p className="account-status">Local practice continues in this account while AI tutoring is unavailable.</p>}
            {props.error && <div className="error-banner" role="alert"><CircleHelp size={20} aria-hidden="true" /><span>{props.error}</span></div>}
            {props.busy && <p className="account-status" role="status">{props.busyLabel ?? "Working on it…"}</p>}
            {(props.account.connected || props.account.balance !== undefined) && (
              <dl className="balance-row">
                <div><dt>Available balance</dt><dd>{props.account.balance ?? "Not checked yet"}</dd></div>
                {props.account.budget && <div><dt>App budget</dt><dd>{props.account.budget}</dd></div>}
                {props.account.budgetLeft && <div><dt>Budget left</dt><dd>{props.account.budgetLeft}</dd></div>}
                {props.account.batchCost && <div><dt>Each batch of activities</dt><dd>{props.account.batchCost}</dd></div>}
              </dl>
            )}
            {props.account.connected && props.modelMenu && <ModelChoice menu={props.modelMenu} busy={props.busy} onChoose={props.onChooseModel} />}
            {props.account.status && <p className="account-status">{props.account.status}</p>}
            {!props.account.connected && props.account.signInAvailable === false && !props.account.status && (
              <p className="account-status">AI connection is unavailable in this build. You can keep learning with local practice.</p>
            )}
            <div className="settings-buttons">
              {/* Account-only actions exist only once connected; disconnected shows Connect alone. */}
              {/* A 403 budget refusal links to the app's Free2Z budget (free2z.cash/account/apps). */}
              {props.account.connected && !props.account.aiReady && props.account.refusal === "raise_budget" && props.onManageAccount && (
                <button className="primary-button" disabled={props.busy} onClick={props.onManageAccount}>Raise app budget in Free2Z <ArrowUpRight size={16} /></button>
              )}
              {props.account.connected && props.onManageAccount && <button className="secondary-button" disabled={props.busy} onClick={props.onManageAccount}>Manage allowance or balance <ArrowUpRight size={16} /></button>}
              {props.account.connected && props.onRefreshAccount && <button className="secondary-button" disabled={props.busy} onClick={props.onRefreshAccount}>Refresh connection</button>}
              {props.busy && props.onCancel && <button className="secondary-button" onClick={props.onCancel}>Stop AI request</button>}
              {props.account.connected ? (
                <>
                  <button className="secondary-button" disabled={props.busy} onClick={props.onSignOut}><LogOut size={16} /> Sign out</button>
                  {props.onRecoverUsage && <button className="secondary-button" disabled={props.busy} onClick={props.onRecoverUsage}>Check pending AI usage</button>}
                  {props.pendingUsage?.map((op) => (
                    <div key={op.operationId}>
                      <p>
                        Interrupted request from {new Date(op.createdAt).toLocaleString()}. Recovery can complete the
                        original paid request; it does not create a replacement.
                      </p>
                      {op.canRecover && props.onRecoverRequest ? (
                        <button className="secondary-button" disabled={props.busy} onClick={() => props.onRecoverRequest?.(op.operationId)}>Recover original request</button>
                      ) : (
                        <p>Recovery window expired. Keep this usage record for support.</p>
                      )}
                    </div>
                  ))}
                  {props.account.purchaseAvailable && props.onTopUp && (
                    <button className="primary-button" disabled={props.busy} onClick={props.onTopUp}>Add 2Z <ArrowUpRight size={16} /></button>
                  )}
                </>
              ) : (
                <button className="primary-button" disabled={props.busy || props.account.signInAvailable === false} onClick={props.onSignIn}>
                  Connect Free2Z <ArrowUpRight size={17} />
                </button>
              )}
            </div>
            {!!props.savedAnswers?.length && <div className="pending-usage" role="status">
              <strong>Saved AI answers</strong>
              <p>These answers are already saved. Restoring them does not start a new paid request.</p>
              {props.savedAnswers.map(saved => <div key={saved.operationId}>
                <p>{saved.learnerName}</p>
                <button className="secondary-button" disabled={props.busy || !saved.canRestore} onClick={() => props.onRestoreAnswer?.(saved.operationId)}>Restore saved answer</button>
                <button className="text-button" disabled={props.busy} onClick={() => props.onDiscardAnswer?.(saved.operationId)}>Set this answer aside</button>
              </div>)}
            </div>}
            <button className="text-button" onClick={closeSettings}>
              <ChevronLeft size={16} /> Back to learning
            </button>
          </section>
          <section>
            <h3>Learners</h3>
            {props.learners?.map((l) => (
              <button className="learner-choice" key={l.id} disabled={props.busy || !props.onSelectLearner}
                onClick={() => { props.onSelectLearner?.(l.id); closeSettings(); setView("home"); }}>
                <span className="avatar">{l.name.slice(0, 1).toUpperCase()}</span>
                {l.name}
                <ArrowRight size={16} />
              </button>
            ))}
            {props.onCreateLearner && (
              <form className="new-learner" onSubmit={(e) => {
                e.preventDefault();
                if (newName.trim() && !props.busy) { props.onCreateLearner?.(newName.trim(), startGrade); setNewName(""); setView("home"); }
              }}>
                <label htmlFor="start-grade">Starting point (we’ll adjust from here)</label>
                <select id="start-grade" disabled={props.busy} value={startGrade} onChange={(e) => setStartGrade(Number(e.target.value))}>
                  {Array.from({ length: 9 }, (_, grade) => (
                    <option key={grade} value={grade}>{grade === 0 ? "Kindergarten" : `Grade ${grade}`}</option>
                  ))}
                </select>
                <label htmlFor="new-learner-name">Name for a new learner</label>
                <div className="curiosity-input">
                  <input id="new-learner-name" disabled={props.busy} value={newName} maxLength={40}
                    onChange={(e) => setNewName(e.target.value)} placeholder="A nickname is enough" />
                  <button className="icon-button" disabled={props.busy || !newName.trim()} aria-label="Create learner"><Plus size={22} /></button>
                </div>
              </form>
            )}
          </section>
          <section>
            <h3>Your data stays on this device</h3>
            <p>
              There’s no automatic Corpora sync. Removing this app may remove progress. Your device’s
              system backup settings may also apply. Export a backup to keep a separate copy.
            </p>
            <div className="settings-buttons">
              <button className="secondary-button" disabled={props.busy} onClick={props.onExport}><Download size={16} /> Export backup</button>
              <button className="secondary-button" disabled={props.busy} onClick={props.onImport}><Upload size={16} /> Restore backup</button>
            </div>
            <button className="danger-link" disabled={props.busy} onClick={() => setDeleting(!deleting)}>
              Delete this learner’s local progress
            </button>
            {deleting && (
              <div className="delete-confirm">
                <p>
                  Permanently delete <strong>{props.learnerName}’s</strong> progress on this device? This does not
                  delete Free2Z records. Export a backup first to keep a copy.
                </p>
                <button className="danger-button" disabled={props.busy} onClick={() => { props.onDeleteLearner(); setDeleting(false); }}>Delete local learner</button>
                <button className="text-button" onClick={() => setDeleting(false)}>Keep learner</button>
              </div>
            )}
          </section>
          <section>
            <label className="setting-switch">
              <span>Haptics</span>
              <input type="checkbox" role="switch" checked={haptics}
                onChange={(e) => { setHaptics(e.target.checked); setHapticsEnabled(e.target.checked); }} />
            </label>
          </section>
          <section>
            <h3>Something not working?</h3>
            <p>A report lists the app version, device type, recent errors, and AI model counts. It doesn’t include names, answers, or account details.</p>
            {props.loadModelStats && <ModelStats load={props.loadModelStats} />}
            <ReportProblem signedIn={props.account.connected} aiReady={!!props.account.aiReady} loadModelStats={props.loadModelStats} />
          </section>
        </div>
      </dialog>
    </div>
  );
}
