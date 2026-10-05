import React from "react";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
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
import { ReportProblem } from "./ReportProblem";
import { ModelChoice, ModelStats } from "./ModelSettings";
import { SafeMarkdown } from "./SafeMarkdown";
import { Visual } from "./Visual";
import type { StudioProps } from "./types";
import "katex/dist/katex.min.css";
import "./studio.css";
export type { StudioProps, StudioActivity, StudioVisual, StudioSpecActivity } from "./types";

type View = "home" | "focus" | "growth";
type Panel = "help" | "feedback" | null;
type Sheet = "ask" | "status" | "flag" | null;

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
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-label={label} onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && (
        <div className="sheet-body">
          <button type="button" className="icon-button sheet-close" aria-label="Close" onClick={onClose}><X size={22} /></button>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Studio(props: StudioProps) {
  const [view, setView] = useState<View>("home");
  const [settings, setSettings] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [newName, setNewName] = useState("");
  const [startGrade, setStartGrade] = useState(3);
  const [deleting, setDeleting] = useState(false);
  const promptRef = useRef<HTMLDivElement>(null);
  const feedbackRegion = useRef<HTMLDivElement>(null);
  const settingsReturn = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const studioRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const seenHint = useRef<string | undefined>(undefined);
  const hintAsks = useRef(0);
  const answerId = useId();
  const titleId = useId();
  const a = props.spec ? undefined : props.activity;
  const spec = props.spec;
  const taskId = spec ? (spec.id ?? spec.spec.id) : a?.id;
  const hasTask = !!taskId;
  useEffect(() => {
    setAnswer("");
    setPanel(null);
    hintAsks.current = 0;
    if (sheet === "flag") setSheet(null);
  }, [taskId]);
  useEffect(() => {
    if (taskId && view === "focus") promptRef.current?.focus({ preventScroll: true });
  }, [taskId, view]);
  useEffect(() => {
    if (!props.feedback) return;
    // The answer's feedback takes the learner's attention; an open nudge folds away (the icon reopens it).
    if (props.feedback.kind !== "info") setPanel(null);
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
  // A new nudge, explanation or worked example opens the help panel once; dismissing it keeps it closed.
  useEffect(() => {
    const key = props.hint ? `${taskId}|${props.hint}` : undefined;
    if (!key) { setPanel(p => p === "help" ? null : p); seenHint.current = undefined; return; }
    if (view === "focus" && hasTask && key !== seenHint.current) { seenHint.current = key; setPanel("help"); }
  }, [props.hint, taskId, view, hasTask]);
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
  const target = Math.max(1, props.session.target);
  const specGraded = !!spec?.result && !spec.result.invalid;
  const readyNext = props.activityAnswered || props.feedback?.kind === "correct" || specGraded;
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
  const progress = Math.min(100, (completed / target) * 100);

  // ---------- focus mode pieces ----------
  const help = (panel === "help" && props.hint) || (panel === "feedback" && props.feedback?.message);
  const helpPanel = help ? (
    <section className={`help-panel${panel === "feedback" ? " is-feedback" : ""}`} aria-label={panel === "feedback" ? "How it works" : "Help"} role="region">
      <button type="button" className="icon-button help-close" aria-label="Close help" onClick={() => setPanel(null)}><X size={20} /></button>
      <div className="help-text" aria-live="polite"><SafeMarkdown>{panel === "feedback" ? props.feedback!.message : props.hint!}</SafeMarkdown></div>
    </section>
  ) : null;
  const errorLine = props.error && !settings ? (
    <div className="error-banner" role="alert"><CircleHelp size={20} aria-hidden="true" /><span>{props.error}</span></div>
  ) : null;
  // Local tasks have one hint, so the icon toggles its panel. A spec may hold several: while the
  // panel is open, each tap asks for the next one until they run out.
  const hintTap = () => {
    const more = !!spec && hintAsks.current < (spec.spec.hints?.length ?? 0);
    if (panel === "help" && !more) return setPanel(null);
    if (props.hint && panel !== "help") return setPanel("help");
    hintAsks.current++;
    props.onSupport("hint");
  };
  const tools = hasTask ? (
    <div className="focus-tools" role="toolbar" aria-label="Help options">
      <IconButton label="Hint" icon={<Lightbulb size={22} />} disabled={props.busy || readyNext}
        active={panel === "help"} expanded={panel === "help"}
        onClick={hintTap} />
      <IconButton label="Show me how" icon={<BookOpen size={22} />} disabled={props.busy}
        badge={props.feedback?.kind === "retry" && panel !== "feedback"}
        onClick={() => props.feedback?.kind === "retry" && props.feedback.message ? setPanel("feedback") : props.onSupport("explain")} />
      <IconButton label="Try something harder" icon={<TrendingUp size={22} />} disabled={props.busy} onClick={() => props.onSupport("harder")} />
      <IconButton label="Something seems off" icon={<Flag size={21} />} disabled={props.busy} onClick={() => setSheet("flag")} />
      <IconButton label="Ask a question" icon={<MessageCircle size={22} />} disabled={props.busy}
        expanded={sheet === "ask"} onClick={() => setSheet("ask")} />
    </div>
  ) : null;
  const nextButton = (
    <button className="primary-button dock-primary" type="button" disabled={props.busy} onClick={props.onContinue}>
      {props.busy ? (props.busyLabel ?? "Working on it…") : "Next"} <ArrowRight size={20} aria-hidden="true" />
    </button>
  );
  const stopButton = props.busy && props.onCancel ? (
    <button type="button" className="text-button stop-button" onClick={props.onCancel}>Stop AI request</button>
  ) : null;
  const feedbackLine = props.feedback && hasTask && !spec ? (
    <div className={`feedback-line ${props.feedback.kind}`} role="status" tabIndex={-1} ref={feedbackRegion}>
      {props.session.complete && readyNext
        ? <><Sprout size={22} aria-hidden="true" /><strong>A good place to pause.</strong></>
        : <>{props.feedback.kind === "correct" ? <span className="celebrate" aria-hidden="true"><Check size={20} /></span> : <Lightbulb size={20} aria-hidden="true" />}
          <strong>{props.feedback.title}</strong></>}
      {props.feedback.kind === "retry" && props.feedback.message && panel !== "feedback" && (
        <button type="button" className="text-button see-how" onClick={() => setPanel("feedback")}>See how</button>
      )}
      {props.feedback.kind === "nudge" && panel !== "help" && (
        <button type="button" className="text-button see-how" disabled={props.busy} onClick={() => { setPanel("help"); props.onSupport("explain"); }}>See how</button>
      )}
    </div>
  ) : null;
  const promptSize = a ? (a.prompt.length <= 22 ? "xl" : a.prompt.length <= 70 ? "l" : "m") : "m";
  const symbols = a?.answerKind === "comparison" ? ["<", "=", ">"] : [];
  const symbolName = (s: string) => s === "<" ? "Less than" : s === ">" ? "Greater than" : "Equal to";
  const submitLocal = () => { if (!props.busy && answer.trim() && !readyNext) props.onSubmit(answer.trim()); };

  const focusStage = spec ? (
    <div className="focus-stage is-spec" aria-busy={props.busy}>
      <div className="stage-focus-target" ref={promptRef} tabIndex={-1} role="group" aria-label="Problem" />
      <Suspense fallback={<p className="stage-loading">Getting your activity ready…</p>}>
      <ActivityView
        key={taskId}
        spec={spec.spec}
        compact
        result={spec.result}
        initialResponse={spec.initialResponse}
        disabled={props.busy}
        onSubmit={spec.onSubmit}
        dockTop={<>{errorLine}{helpPanel}{tools}</>}
        next={nextButton}
      />
      </Suspense>
      {stopButton}
    </div>
  ) : a ? (
    <form className="focus-stage" aria-busy={props.busy} onSubmit={(e) => { e.preventDefault(); submitLocal(); }}>
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
      <div className="focus-dock">
        {errorLine}
        {helpPanel}
        {tools}
        {feedbackLine}
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
            <button className="primary-button dock-primary" type="submit" disabled={props.busy || !answer.trim()}>
              {props.busy ? (props.busyLabel ?? "Working on it…") : "Check"}
            </button>
          )}
        </div>
        {stopButton}
      </div>
    </form>
  ) : (
    <div className="focus-stage is-empty" aria-busy={props.busy}>
      <div className="stage-scroll">
        {props.busy ? (
          <div className="stage-wait" role="status"><span className="wait-dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="sr-only">{props.busyLabel ?? "Getting ready…"}</span></div>
        ) : (
          <div className="stage-message">
            {props.feedback ? (
              <div className={`feedback-line ${props.feedback.kind}`} role="status" tabIndex={-1} ref={feedbackRegion}>
                <Lightbulb size={20} aria-hidden="true" /><strong>{props.feedback.title}</strong>
              </div>
            ) : (
              <p className="stage-invite">{props.session.complete ? "A good place to pause." : "Your next “aha” is waiting."}</p>
            )}
            {props.hint && <div className="hint-note"><SafeMarkdown>{props.hint}</SafeMarkdown></div>}
          </div>
        )}
      </div>
      <div className="focus-dock">
        {errorLine}
        {!props.busy && <div className="dock-row">{nextButton}</div>}
        {stopButton}
      </div>
    </div>
  );

  const focus = (
    <div className="focus-view">
      <header className="focus-bar">
        <div className="focus-bar-inner">
          <IconButton label="Home" icon={<House size={22} />} onClick={() => { setPanel(null); setView("home"); }} />
          <div className="focus-progress" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={target}
            aria-valuenow={Math.min(completed, target)}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <button type="button" className={`status-dot ${ai ? "is-ai" : "is-local"}`} aria-label={statusText}
            aria-haspopup="dialog" onClick={() => setSheet("status")}>
            {ai ? <Sparkles size={16} aria-hidden="true" /> : <span aria-hidden="true" />}
          </button>
        </div>
      </header>
      <main id="activity" className="focus-main">{focusStage}</main>
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
            <p className="home-lede">A little curiosity goes a long way.</p>
            <div className="home-session">
              <div className="home-meter" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(completed, target)}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <span className="home-count">{completed} / {target}</span>
            </div>
            {props.session.complete && <p className="home-summary">{props.session.summary}</p>}
            {props.error && <div className="error-banner" role={settings ? undefined : "alert"}><CircleHelp size={20} aria-hidden="true" /><span>{props.error}</span></div>}
            <button type="button" className="primary-button home-start" disabled={props.busy && !hasTask} onClick={enterFocus}>
              {props.busy && !hasTask ? (props.busyLabel ?? "Getting ready…") : hasTask ? "Continue" : props.session.complete ? "Keep exploring" : "Let’s begin"}
              <ArrowRight size={20} aria-hidden="true" />
            </button>
            {props.mode === "preview" && <p className="home-note">{statusText}</p>}
          </section>
        ) : (
          <section className="progress-page">
            <div className="progress-heading">
              <h1>Look how you’re growing.</h1>
              <p>Understanding, fluency and remembering are different kinds of growth. There’s room for all three.</p>
            </div>
            {props.progress.length ? (
              <div className="progress-grid">
                {props.progress.map((p, i) => (
                  <article key={i}>
                    <span className={`status-pill ${p.status}`}>
                      {p.status === "confident" ? "Showing confidence" : p.status === "review" ? "Ready to revisit" : "Taking root"}
                    </span>
                    <h3>{p.label}</h3>
                    <p>{p.detail}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-progress">Your first discovery is a great place to start. There’s no whole-grade percentage to chase.</p>
            )}
            <button type="button" className="primary-button" onClick={enterFocus}>
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
          <button type="button" className="primary-button" disabled={props.busy} onClick={() => { setSheet(null); props.onSupport("dispute"); }}>Set it aside</button>
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
              <p role="status">{props.busy ? "Thinking about that…" : "That answer could not finish. No new paid request will start automatically."}</p>
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
            <h3>Something not working?</h3>
            <p>A report lists the app version, device type, and recent errors. It doesn’t include names, answers, or account details.</p>
            {props.loadModelStats && <ModelStats load={props.loadModelStats} />}
            <ReportProblem signedIn={props.account.connected} aiReady={!!props.account.aiReady} loadModelStats={props.loadModelStats} />
          </section>
        </div>
      </dialog>
    </div>
  );
}
