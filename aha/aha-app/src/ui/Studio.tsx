import React from "react";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  Compass,
  Download,
  Leaf,
  Lightbulb,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { SafeMarkdown } from "./SafeMarkdown";
import { Visual } from "./Visual";
import type { StudioProps } from "./types";
import "katex/dist/katex.min.css";
import "./studio.css";
export type { StudioProps, StudioActivity, StudioVisual } from "./types";

type Tab = "learn" | "progress";
export function Studio(props: StudioProps) {
  const [tab, setTab] = useState<Tab>("learn");
  const [settings, setSettings] = useState(false);
  const [adult, setAdult] = useState(false);
  const [gate, setGate] = useState("");
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [newName, setNewName] = useState("");
  const [startGrade, setStartGrade] = useState(3);
  const [deleting, setDeleting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const taskHeading = useRef<HTMLHeadingElement>(null);
  const feedbackRegion = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const answerId = useId();
  const titleId = useId();
  const a = props.activity;
  useEffect(() => {
    setAnswer("");
    setAsking(false);
  }, [a?.id]);
  useEffect(() => {
    if (a?.id) taskHeading.current?.focus({ preventScroll: true });
  }, [a?.id]);
  useEffect(() => {
    if (props.feedback) feedbackRegion.current?.focus({ preventScroll: true });
  }, [props.feedback?.kind, props.feedback?.title, props.feedback?.message]);
  useEffect(() => {
    if (settings) dialog.current?.showModal();
    else dialog.current?.close();
  }, [settings]);
  const closeSettings = () => {
    setSettings(false);
    setAdult(false);
    setGate("");
    setDeleting(false);
    settingsButton.current?.focus();
  };
  const completed = Math.max(0, props.session.completed);
  const target = Math.max(1, props.session.target);
  const readyNext =
    props.activityAnswered || props.feedback?.kind === "correct";
  const learningVisible =
    tab === "learn" &&
    !settings &&
    !asking &&
    !props.curiosity &&
    !!a &&
    !readyNext;
  useEffect(() => {
    props.onLearningVisibleChange?.(learningVisible);
    return () => props.onLearningVisibleChange?.(false);
  }, [learningVisible, props.onLearningVisibleChange]);
  const feedbackContent = props.feedback && (
    <div className={`feedback ${props.feedback.kind}`} role="status" tabIndex={-1} ref={feedbackRegion}>
      <span aria-hidden="true">{props.feedback.kind === "correct" ? <Check size={21} /> : <Lightbulb size={21} />}</span>
      <div><strong>{props.feedback.title}</strong><SafeMarkdown>{props.feedback.message}</SafeMarkdown></div>
    </div>
  );
  const hintContent = props.hint && (
    <div className="hint-box" role="status">
      <Lightbulb size={20} aria-hidden="true" />
      <div><strong>{props.feedback?.kind === "correct" ? "A closer look" : "A little nudge"}</strong><SafeMarkdown>{props.hint}</SafeMarkdown></div>
    </div>
  );
  return (
    <div className={`aha-studio${a && tab === "learn" ? " has-activity" : ""}`}>
      <a className="skip-link" href="#activity">
        Skip to learning
      </a>
      {props.mode === "preview" && (
        <div className="preview-banner">
          Browser preview · sample practice · progress stays in this preview
        </div>
      )}
      {props.practiceStatus && (
        <div className="preview-banner" role="status">
          {props.practiceStatus}
        </div>
      )}
      <header className="studio-header">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("learn");
          }}
          aria-label="AHA home"
        >
          ¡AHA!
          <span className="wordmark-dot" />
        </a>
        <nav className="desktop-nav" aria-label="Main">
          <button
            className={tab === "learn" ? "active" : ""}
            onClick={() => setTab("learn")}
          >
            <Compass size={17} /> Your studio
          </button>
          <button
            className={tab === "progress" ? "active" : ""}
            onClick={() => setTab("progress")}
          >
            <Sprout size={17} /> Your growth
          </button>
        </nav>
        <button
          ref={settingsButton}
          className="profile-button"
          onClick={() => setSettings(true)}
          aria-label="Open learner and grown-up settings"
        >
          <span className="avatar">
            {props.learnerName.slice(0, 1).toUpperCase() || "A"}
          </span>
          <span>{props.learnerName || "Your studio"}</span>
          <ChevronDown size={15} />
        </button>
      </header>
      <main id="activity" className="studio-main">
        <div className="page-intro">
          <div>
            <div className="eyebrow">
              <Sun size={15} /> A LITTLE CURIOSITY. A BIG DISCOVERY.
            </div>
            <h1>
              {tab === "learn"
                ? "Let’s make it click."
                : "Look how you’re growing."}
            </h1>
            <p>
              {tab === "learn"
                ? "One good question can take you somewhere new."
                : "Small discoveries become things you know."}
            </p>
          </div>
          <div className="session-badge">
            <span className="session-icon">
              <Leaf size={22} />
            </span>
            <span>
              <strong>Your daily exploration</strong>
              <small>
                {props.session.minutes ? `${props.session.minutes} minutes · ` : ""}At your pace
              </small>
            </span>
          </div>
        </div>
        {tab === "learn" ? (
          <div className="learning-layout">
            <section className="lesson-column" aria-label="Learning activity">
              <div className="session-track">
                <span>
                  <span className="live-dot" />{" "}
                  {a?.skill ?? "Your next discovery"}
                </span>
                <span>
                  {completed} of {target} discoveries
                </span>
              </div>
              <div
                className="session-meter"
                role="progressbar"
                aria-label="Session discoveries"
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={Math.min(completed, target)}
              >
                <span
                  style={{
                    width: `${Math.min(100, (completed / target) * 100)}%`,
                  }}
                />
              </div>
              {props.busy && props.onCancel && (
                <button className="secondary-button" onClick={props.onCancel}>
                  Stop AI request
                </button>
              )}
              <article className="activity-card" aria-busy={props.busy}>
                <div className="activity-topline">
                  <span className="lesson-tag">
                    <Sparkles size={13} /> LET’S EXPLORE
                  </span>
                  <span className="activity-count">
                    {String(completed + 1).padStart(2, "0")}
                  </span>
                </div>
                {a ? (
                  <>
                    <h2 ref={taskHeading} tabIndex={-1}>{a.title}</h2>
                    <div className="activity-prompt">
                      <SafeMarkdown>{a.prompt}</SafeMarkdown>
                    </div>
                    {a.visual && <Visual key={a.id} spec={a.visual} />}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!props.busy && answer.trim() && !readyNext)
                          props.onSubmit(answer.trim());
                      }}
                    >
                      <div className="answer-area">
                        {a.answerKind === "choice" && a.choices?.length ? (
                          <fieldset className="choices">
                            <legend>Your answer</legend>
                            {a.choices.map((choice, i) => (
                              <label
                                key={choice.id}
                                className={answer === choice.id ? "chosen" : ""}
                              >
                                <input
                                  type="radio"
                                  name={answerId}
                                  value={choice.id}
                                  checked={answer === choice.id}
                                  disabled={props.busy || readyNext}
                                  onChange={() => setAnswer(choice.id)}
                                />
                                <span className="choice-letter">
                                  {String.fromCharCode(65 + i)}
                                </span>
                                <SafeMarkdown>{choice.label}</SafeMarkdown>
                              </label>
                            ))}
                          </fieldset>
                        ) : (
                          <>
                            <label htmlFor={answerId}>Your answer</label>
                            <div className="answer-input-wrap">
                              <input
                                ref={input}
                                id={answerId}
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                inputMode={
                                  a.answerKind === "number" ? "decimal" : "text"
                                }
                                placeholder={
                                  a.answerKind === "fraction"
                                    ? "e.g. 3/4"
                                    : "Think it through…"
                                }
                                disabled={props.busy || readyNext}
                                maxLength={160}
                                aria-describedby={`${answerId}-help`}
                              />
                              <span aria-hidden="true">↵</span>
                            </div>
                            {(a.answerKind === "comparison" || a.answerKind === "number") && (
                              <div className="answer-symbols" role="group" aria-label="Answer symbols">
                                {(a.answerKind === "comparison" ? ["<", "=", ">"] : ["−"]).map(symbol => (
                                  <button key={symbol} type="button" disabled={props.busy || readyNext}
                                    aria-label={symbol === "<" ? "Less than" : symbol === ">" ? "Greater than" : symbol === "=" ? "Equal to" : "Change positive or negative sign"}
                                    aria-pressed={symbol === "−" ? answer.startsWith("-") : answer === symbol}
                                    onClick={() => setAnswer(symbol === "−" ? answer.startsWith("-") ? answer.slice(1) : `-${answer}` : symbol)}>{symbol}</button>
                                ))}
                              </div>
                            )}
                            <small id={`${answerId}-help`}>
                              {a.answerKind === "comparison" ? "Choose less than (<), equal to (=), or greater than (>)." : a.answerKind === "fraction"
                                ? "You can write a fraction like 3/4."
                                : "Take your time. This is a place to figure things out."}
                            </small>
                          </>
                        )}
                      </div>
                      {feedbackContent}
                      {hintContent}
                      {props.session.complete && readyNext && (
                        <section className="session-finish" aria-label="Exploration complete">
                          <Sprout size={24} aria-hidden="true" />
                          <div><h3>A good place to pause.</h3><p>{props.session.summary ?? "You’ve made time for your thinking today. Take a break, or keep exploring when you’re ready."}</p></div>
                        </section>
                      )}
                      <div className="activity-actions">
                        {readyNext ? (
                          <button
                            className="primary-button"
                            type="button"
                            disabled={props.busy}
                            onClick={props.onContinue}
                          >
                            {props.session.complete
                              ? "Keep exploring"
                              : props.feedback?.kind === "retry"
                              ? "Try a fresh one"
                              : "Next discovery"}{" "}
                            <ArrowRight size={19} />
                          </button>
                        ) : (
                          <button
                            className="primary-button"
                            type="submit"
                            disabled={props.busy || !answer.trim()}
                          >
                            {props.busy
                              ? (props.busyLabel ?? "Working on it…")
                              : "Check my answer"}{" "}
                            <ArrowRight size={19} />
                          </button>
                        )}
                        <button
                          className="hint-button"
                          type="button"
                          disabled={
                            props.busy || readyNext
                          }
                          onClick={() => props.onSupport("hint")}
                        >
                          <Lightbulb size={17} /> A little hint
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="welcome-state">
                    <div className="welcome-art">
                      <span>✳</span>
                      <span>+</span>
                      <span>?</span>
                    </div>
                    {feedbackContent}
                    {hintContent}
                    <h2>{props.session.complete ? "A little stronger, every time." : props.feedback ? "Let’s try a different discovery." : "Your next “aha” is waiting."}</h2>
                    <p>
                      {props.session.complete
                        ? (props.session.summary ?? "You’ve made time for your thinking. It’s okay to pause here, or keep exploring.")
                        : props.feedback ? "We’ll leave that one behind and find a fresh example."
                        : "We’ll start with a few questions to find a good place for you. No grades. No pressure."}
                    </p>
                    <button
                      className="primary-button"
                      disabled={props.busy}
                      onClick={props.onContinue}
                    >
                      {props.busy ? (props.busyLabel ?? "Getting ready…") : props.session.complete ? "Keep exploring" : props.feedback ? "Try another example" : "Let’s begin"}
                      <ArrowRight size={19} />
                    </button>
                  </div>
                )}
              </article>
              {props.error && (
                <div className="error-banner" role={settings ? undefined : "alert"}>
                  <CircleHelp size={20} />
                  <span>{props.error}</span>
                </div>
              )}
              {a && (
                <div className="support-row">
                  <button
                    disabled={props.busy}
                    onClick={() => props.onSupport("explain")}
                  >
                    {readyNext ? "Show me how it works" : "Explain another way"}
                  </button>
                  <span>·</span>
                  <button
                    disabled={props.busy || readyNext}
                    onClick={() => props.onSupport("stuck")}
                  >
                    I’m stuck
                  </button>
                  <span>·</span>
                  <button
                    disabled={props.busy}
                    onClick={() => props.onSupport("harder")}
                  >
                    Try something harder
                  </button>
                  <button
                    className="dispute-button"
                    disabled={props.busy}
                    onClick={() => props.onSupport("dispute")}
                  >
                    Something seems off
                  </button>
                </div>
              )}
              <div className="curiosity-card">
                <div className="curiosity-icon">
                  <MessageCircle size={21} />
                </div>
                <div>
                  <strong>Wondering about something?</strong>
                  <p>{a ? "There’s room for a little rabbit hole." : "Start a discovery, then bring your questions."}</p>
                </div>
                <button
                  aria-label="Ask a curiosity question"
                  disabled={!a || props.busy}
                  aria-expanded={asking || !!props.curiosity}
                  onClick={() => setAsking(!asking)}
                >
                  <Plus size={22} />
                </button>
              </div>
              {(asking || props.curiosity) && (
                <section
                  className="curiosity-conversation"
                  aria-label="Curiosity conversation"
                >
                  {props.curiosity ? (
                    <>
                      <div className="eyebrow">YOUR QUESTION</div>
                      <p>{props.curiosity.question}</p>
                      {props.curiosity.answer ? (
                        <SafeMarkdown>{props.curiosity.answer}</SafeMarkdown>
                      ) : (
                        <p role="status">{props.busy ? "Thinking about that…" : "That answer could not finish. You can return to your discovery; no new paid request will start automatically."}</p>
                      )}
                      <button
                        className="text-button"
                        onClick={() => {
                          props.onCloseCuriosity();
                          setAsking(false);
                        }}
                      >
                        <ChevronLeft size={16} /> Back to our discovery
                      </button>
                    </>
                  ) : (
                    <>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (question.trim() && !props.busy) {
                            props.onCuriosity(question.trim());
                            setQuestion("");
                          }
                        }}
                      >
                        <label htmlFor="curiosity-question">
                          What are you wondering?
                        </label>
                        <div className="curiosity-input">
                          <input
                            id="curiosity-question"
                            value={question}
                            maxLength={400}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="What could I use this for?"
                          />
                          <button
                            className="icon-button"
                            disabled={!question.trim() || props.busy}
                            aria-label="Ask question"
                          >
                            <ArrowUpRight size={22} />
                          </button>
                        </div>
                      </form>
                      <button
                        className="suggestion"
                        disabled={props.busy}
                        onClick={() =>
                          props.onCuriosity(
                            "Where would I use this in real life?",
                          )
                        }
                      >
                        Where would I use this in real life? ↗
                      </button>
                    </>
                  )}
                </section>
              )}
            </section>
            <aside className="studio-sidebar">
              <div className="discovery-note">
                <div className="orbit-art" aria-hidden="true">
                  <div className="orbit-ring" />
                  <div className="orbit-center">
                    a<span>ha!</span>
                  </div>
                  <span className="orbit-plus">+</span>
                  <span className="orbit-star">✳</span>
                  <span className="orbit-dot" />
                </div>
                <div className="eyebrow">THINK. TRY. DISCOVER.</div>
                <h3>
                  Good things start
                  <br />
                  with “I wonder…”
                </h3>
                <p>
                  You don’t have to know it yet.
                  <br />
                  That’s what we’re here for.
                </p>
              </div>
              <div className="growth-preview">
                <div className="aside-heading">
                  <Sprout size={18} />
                  <h3>Taking root</h3>
                </div>
                {props.progress.length ? (
                  props.progress.slice(0, 3).map((p, i) => (
                    <div className="growth-item" key={i}>
                      <span className={`growth-dot ${p.status}`} />
                      <div>
                        <strong>{p.label}</strong>
                        <small>{p.detail}</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>
                    Your discoveries will grow here as we learn what you know.
                  </p>
                )}
                <button
                  className="text-button"
                  onClick={() => setTab("progress")}
                >
                  See your growth <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="quiet-note">
                <ShieldCheck size={16} />
                <span>Your learning, saved on this device.</span>
              </div>
            </aside>
          </div>
        ) : (
          <section className="progress-page">
            <div className="progress-heading">
              <Sprout size={29} />
              <h2>A little stronger, every time.</h2>
              <p>
                Understanding, fluency, and remembering are different kinds of
                growth. We keep room for all three.
              </p>
            </div>
            {props.progress.length ? (
              <div className="progress-grid">
                {props.progress.map((p, i) => (
                  <article key={i}>
                    <span className={`status-pill ${p.status}`}>
                      {p.status === "confident"
                        ? "Showing confidence"
                        : p.status === "review"
                          ? "Ready to revisit"
                          : "Taking root"}
                    </span>
                    <h3>{p.label}</h3>
                    <p>{p.detail}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-progress">
                Your first discovery is a great place to start. There’s no
                whole-grade percentage to chase.
              </p>
            )}
            <button className="primary-button" onClick={() => setTab("learn")}>
              Back to exploring <ArrowRight size={18} />
            </button>
          </section>
        )}
        <footer className="studio-footer">
          <span className="footer-mark">¡AHA!</span>
          <span>Big ideas. Little discoveries.</span>
          <span className="footer-local">
            <BookOpen size={13} /> A math studio for curious minds
          </span>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label="Main">
        <button
          className={tab === "learn" ? "active" : ""}
          onClick={() => setTab("learn")}
        >
          <Compass size={21} />
          Studio
        </button>
        <button
          className={tab === "progress" ? "active" : ""}
          onClick={() => setTab("progress")}
        >
          <Sprout size={21} />
          Growth
        </button>
        <button onClick={() => setSettings(true)}>
          <Settings2 size={21} />
          Grown-ups
        </button>
      </nav>
      <dialog
        ref={dialog}
        className="settings-dialog"
        aria-labelledby={titleId}
        onCancel={closeSettings}
        onClick={(e) => {
          if (e.target === dialog.current) closeSettings();
        }}
      >
        <div className="dialog-header">
          <h2 id={titleId}>
            {adult ? "Your family’s studio" : "For the grown-ups"}
          </h2>
          <button
            className="icon-button"
            aria-label="Close settings"
            onClick={closeSettings}
          >
            <X size={23} />
          </button>
        </div>
        {!adult ? (
          <div className="adult-gate">
            <div className="gate-icon">
              <LockKeyhole size={28} />
            </div>
            <p>
              Account and progress settings are for a grown-up. Please ask yours
              to join you.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (gate.trim() === "grown-up") setAdult(true);
              }}
            >
              <label htmlFor="adult-gate">
                Type <strong>grown-up</strong> to continue
              </label>
              <input
                id="adult-gate"
                value={gate}
                onChange={(e) => setGate(e.target.value)}
                autoCapitalize="off"
                autoComplete="off"
              />
              <button
                className="primary-button"
                disabled={gate.trim() !== "grown-up"}
              >
                Open grown-up settings <ArrowRight size={18} />
              </button>
            </form>
            <small>
              This is a pause for adult involvement, not a security lock.
            </small>
          </div>
        ) : (
          <div className="settings-body">
            <section>
              <div className="eyebrow">FREE2Z ACCOUNT</div>
              <h3>
                {props.account.connected
                  ? (props.account.label ?? "Connected to Free2Z")
                  : "Your Free2Z connection"}
              </h3>
              <p>
                An adult account supplies AI access. Learner progress stays in
                this app. Selected mathematical learning context is sent to
                Free2Z and its model provider; learner names aren’t needed.
              </p>
              <span className={`connection-pill ${props.account.connected && props.account.aiReady ? "ready" : "local"}`}>
                {props.account.connected ? props.account.aiReady ? "AI ready" : "Connected · AI not ready" : "Local practice"}
              </span>
              {props.account.connected && !props.account.aiReady && <p className="account-status">Local practice continues in this account while AI tutoring is unavailable.</p>}
              {props.error && <div className="error-banner" role="alert"><CircleHelp size={20} aria-hidden="true" /><span>{props.error}</span></div>}
              {props.busy && <p className="account-status" role="status">{props.busyLabel ?? "Working on it…"}</p>}
              {(props.account.connected || props.account.balance !== undefined) && (
                <div className="balance-row">
                  <span>Available balance</span>
                  <strong>{props.account.balance ?? "Not checked yet"}</strong>
                </div>
              )}
              {props.account.status && (
                <p className="account-status">{props.account.status}</p>
              )}
              {!props.account.connected && props.account.signInAvailable === false && !props.account.status && (
                <p className="account-status">AI connection is unavailable in this build. You can keep learning with local practice.</p>
              )}
              <div className="settings-buttons">
                {props.onManageAccount && <button className="secondary-button" disabled={props.busy} onClick={props.onManageAccount}>Manage allowance or balance <ArrowUpRight size={16} /></button>}
                {props.onRefreshAccount && <button className="secondary-button" disabled={props.busy} onClick={props.onRefreshAccount}>Refresh connection</button>}
                {props.busy && props.onCancel && (
                  <button className="secondary-button" onClick={props.onCancel}>
                    Stop AI request
                  </button>
                )}
                {props.account.connected ? (
                  <>
                    <button
                      className="secondary-button"
                      disabled={props.busy}
                      onClick={props.onSignOut}
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                    {props.onRecoverUsage && (
                      <button
                        className="secondary-button"
                        disabled={props.busy}
                        onClick={props.onRecoverUsage}
                      >
                        Check pending AI usage
                      </button>
                    )}
                    {props.pendingUsage?.map((op) => (
                      <div key={op.operationId}>
                        <p>
                          Interrupted request from{" "}
                          {new Date(op.createdAt).toLocaleString()}. Recovery
                          can complete the original paid request; it does not
                          create a replacement.
                        </p>
                        {op.canRecover && props.onRecoverRequest ? (
                          <button
                            className="secondary-button"
                            disabled={props.busy}
                            onClick={() =>
                              props.onRecoverRequest?.(op.operationId)
                            }
                          >
                            Recover original request
                          </button>
                        ) : (
                          <p>
                            Recovery window expired. Keep this usage record for
                            support.
                          </p>
                        )}
                      </div>
                    ))}
                    {props.account.purchaseAvailable && props.onTopUp && (
                      <button
                        className="primary-button"
                        disabled={props.busy}
                        onClick={props.onTopUp}
                      >
                        Add 2Z <ArrowUpRight size={16} />
                      </button>
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
              <button className="text-button" onClick={() => { closeSettings(); setTab("learn"); }}>
                <ChevronLeft size={16} /> Back to learning
              </button>
            </section>
            <section>
              <div className="eyebrow">LOCAL LEARNERS</div>
              <h3>A space for each curious mind.</h3>
              {props.learners?.map((l) => (
                <button
                  className="learner-choice"
                  key={l.id}
                  disabled={props.busy || !props.onSelectLearner}
                  onClick={() => {
                    props.onSelectLearner?.(l.id);
                    closeSettings();
                  }}
                >
                  <span className="avatar">
                    {l.name.slice(0, 1).toUpperCase()}
                  </span>
                  {l.name}
                  <ArrowRight size={16} />
                </button>
              ))}
              {props.onCreateLearner && (
                <form
                  className="new-learner"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newName.trim() && !props.busy) {
                      props.onCreateLearner?.(newName.trim(), startGrade);
                      setNewName("");
                    }
                  }}
                >
                  <label htmlFor="start-grade">
                    Starting point (we’ll adjust from here)
                  </label>
                  <select
                    id="start-grade"
                    disabled={props.busy}
                    value={startGrade}
                    onChange={(e) => setStartGrade(Number(e.target.value))}
                  >
                    {Array.from({ length: 9 }, (_, grade) => (
                      <option key={grade} value={grade}>
                        {grade === 0 ? "Kindergarten" : `Grade ${grade}`}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="new-learner-name">
                    Nickname for a new learner
                  </label>
                  <div className="curiosity-input">
                    <input
                      id="new-learner-name"
                      disabled={props.busy}
                      value={newName}
                      maxLength={40}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="A nickname is enough"
                    />
                    <button
                      className="icon-button"
                      disabled={props.busy || !newName.trim()}
                      aria-label="Create learner"
                    >
                      <Plus size={22} />
                    </button>
                  </div>
                </form>
              )}
            </section>
            <section>
              <div className="eyebrow">YOUR DATA, YOUR DEVICE</div>
              <h3>Keep your discoveries safe.</h3>
              <p>
                There’s no automatic Corpora sync. Removing this app may remove
                progress. Your device’s system backup settings may also apply.
                Export a backup to keep a separate copy.
              </p>
              <div className="settings-buttons">
                <button className="secondary-button" disabled={props.busy} onClick={props.onExport}>
                  <Download size={16} /> Export backup
                </button>
                <button className="secondary-button" disabled={props.busy} onClick={props.onImport}>
                  <Upload size={16} /> Restore backup
                </button>
              </div>
              <button
                className="danger-link"
                disabled={props.busy}
                onClick={() => setDeleting(!deleting)}
              >
                Delete this learner’s local progress
              </button>
              {deleting && (
                <div className="delete-confirm">
                  <p>
                    Permanently delete <strong>{props.learnerName}’s</strong>{" "}
                    progress on this device? This does not delete Free2Z
                    records. Export a backup first if you want to keep it.
                  </p>
                  <button
                    className="danger-button"
                    disabled={props.busy}
                    onClick={() => {
                      props.onDeleteLearner();
                      setDeleting(false);
                    }}
                  >
                    Delete local learner
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setDeleting(false)}
                  >
                    Keep learner
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </dialog>
    </div>
  );
}
