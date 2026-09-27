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
  return (
    <div className="aha-studio">
      <a className="skip-link" href="#activity">
        Skip to learning
      </a>
      {props.mode === "preview" && (
        <div className="preview-banner">
          Browser preview · sample practice · progress stays in this preview
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
                {props.session.minutes ?? 12} minutes · at your pace
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
                    <h2>{a.title}</h2>
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
                            <small id={`${answerId}-help`}>
                              {a.answerKind === "fraction"
                                ? "You can write a fraction like 3/4."
                                : "Take your time. This is a place to figure things out."}
                            </small>
                          </>
                        )}
                      </div>
                      {props.feedback && (
                        <div
                          className={`feedback ${props.feedback.kind}`}
                          role="status"
                        >
                          <span>
                            {props.feedback.kind === "correct" ? (
                              <Check size={21} />
                            ) : (
                              <Lightbulb size={21} />
                            )}
                          </span>
                          <div>
                            <strong>{props.feedback.title}</strong>
                            <SafeMarkdown>
                              {props.feedback.message}
                            </SafeMarkdown>
                          </div>
                        </div>
                      )}
                      {props.hint && (
                        <div className="hint-box" role="status">
                          <Lightbulb size={20} />
                          <div>
                            <strong>A little nudge</strong>
                            <SafeMarkdown>{props.hint}</SafeMarkdown>
                          </div>
                        </div>
                      )}
                      <div className="activity-actions">
                        {readyNext ? (
                          <button
                            className="primary-button"
                            type="button"
                            disabled={props.busy}
                            onClick={props.onContinue}
                          >
                            {props.feedback?.kind === "retry"
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
                              ? "Thinking with you…"
                              : "Check my answer"}{" "}
                            <ArrowRight size={19} />
                          </button>
                        )}
                        <button
                          className="hint-button"
                          type="button"
                          disabled={
                            props.busy || props.feedback?.kind === "correct"
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
                    <h2>Your next “aha” is waiting.</h2>
                    <p>
                      We’ll start with a few questions to find a good place for
                      you. No grades. No pressure.
                    </p>
                    <button
                      className="primary-button"
                      disabled={props.busy}
                      onClick={props.onContinue}
                    >
                      {props.busy ? "Getting ready…" : "Let’s begin"}
                      <ArrowRight size={19} />
                    </button>
                  </div>
                )}
              </article>
              {props.error && (
                <div className="error-banner" role="alert">
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
                    Explain another way
                  </button>
                  <span>·</span>
                  <button
                    disabled={props.busy}
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
                  <p>There’s room for a little rabbit hole.</p>
                </div>
                <button
                  aria-label="Ask a curiosity question"
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
                        <p role="status">Thinking about that…</p>
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
                  : "Frontier AI, paid as you go."}
              </h3>
              <p>
                An adult account supplies AI access. Learner progress stays in
                this app. Selected mathematical learning context is sent to
                Free2Z and its model provider; learner names aren’t needed.
              </p>
              {props.account.balance && (
                <div className="balance-row">
                  <span>Available balance</span>
                  <strong>{props.account.balance}</strong>
                </div>
              )}
              {props.account.status && (
                <p className="account-status">{props.account.status}</p>
              )}
              <div className="settings-buttons">
                {props.account.connected ? (
                  <>
                    <button
                      className="secondary-button"
                      onClick={props.onSignOut}
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                    {props.account.purchaseAvailable && props.onTopUp && (
                      <button
                        className="primary-button"
                        onClick={props.onTopUp}
                      >
                        Add 2Z <ArrowUpRight size={16} />
                      </button>
                    )}
                  </>
                ) : (
                  <button className="primary-button" onClick={props.onSignIn}>
                    Connect Free2Z <ArrowUpRight size={17} />
                  </button>
                )}
              </div>
            </section>
            <section>
              <div className="eyebrow">LOCAL LEARNERS</div>
              <h3>A space for each curious mind.</h3>
              {props.learners?.map((l) => (
                <button
                  className="learner-choice"
                  key={l.id}
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
                    if (newName.trim()) {
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
                      value={newName}
                      maxLength={40}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="A nickname is enough"
                    />
                    <button
                      className="icon-button"
                      disabled={!newName.trim()}
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
                <button className="secondary-button" onClick={props.onExport}>
                  <Download size={16} /> Export backup
                </button>
                <button className="secondary-button" onClick={props.onImport}>
                  <Upload size={16} /> Restore backup
                </button>
              </div>
              <button
                className="danger-link"
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
