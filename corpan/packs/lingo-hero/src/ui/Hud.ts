import type { GameEventBus } from "../events";
import type { ProgressionApi } from "../progression";
import { GameMode, type ActiveLanguage } from "../types";

/**
 * Payload for the post-answer FEEDBACK card (slot c). The shell-ui stream fills
 * this from `wave-resolved`. Foundation only renders the surface + exposes the
 * setter; the actual wiring (subscribe to wave-resolved → showFeedback) lives
 * in the ui stream so Foundation stays minimal.
 */
export interface FeedbackCardData {
  foreign: string;
  english: string;
  romanization?: string;
  correct: boolean;
  /** "correct" | "wrong" | "passed" — for nuanced copy/styling. */
  outcome?: "correct" | "wrong" | "passed";
}

/** Payload for the progress / mastery readout (slot d). */
export interface MasteryReadout {
  /** Free-form short label, e.g. "12 mastered · 3 due". */
  label: string;
  /** Optional 0..1 progress for a bar fill; omit to hide the bar. */
  progress?: number;
}

/**
 * Hud — OWNS the DOM overlay (menu / in-game HUD / game-over) for Lingo Hero.
 *
 * STREAM: ui. Foundation MOVED the original uiRoot.innerHTML + updateHUD +
 * showMenu + gameOver out of Game.ts into here. Game.ts just instantiates Hud
 * and provides button callbacks; everything else this class drives off the bus.
 *
 * This is the UIUX premium pass: a cohesive glass/neon design system, juicy
 * buttons, animated combo + score feedback, a progression-aware game-over
 * panel (XP/level/best-streak/high-score polled from ProgressionApi), RTL
 * mirroring, and accessible focus states. All visuals live in styles.css; this
 * class only owns the markup + bus wiring. It NEVER touches Game.ts.
 */
export interface HudCallbacks {
  /** User chose a mode on the menu (or "retry"). */
  onStartGame: (mode: GameMode) => void;
  /** User asked to return to the main menu. */
  onShowMenu: () => void;
  /**
   * User tapped the audio-REPLAY button (slot b): re-speak the current prompt.
   * Optional so older call sites that don't pass it still compile; the button
   * is wired only when present.
   */
  onReplayPrompt?: () => void;
}

export class Hud {
  private root: HTMLElement;
  private menuScreen: HTMLElement;
  private hudPanel: HTMLElement;
  private gameOverScreen: HTMLElement;
  private questionBox: HTMLElement;
  private romanizationEl: HTMLElement;
  private replayBtn: HTMLElement;
  private feedbackCard: HTMLElement;
  private masteryEl: HTMLElement;
  private scoreEl: HTMLElement;
  private comboEl: HTMLElement;
  private comboBox: HTMLElement;
  private scoreFlyout: HTMLElement;
  private finalScoreEl: HTMLElement;
  private newBestEl: HTMLElement;
  private goStreakEl: HTMLElement;
  private goLevelEl: HTMLElement;
  private goHighEl: HTMLElement;

  private offFns: Array<() => void> = [];
  private lastMode: GameMode = GameMode.PRACTICE;
  private comboPulseTimer = 0;
  private flyoutTimer = 0;
  private feedbackTimer = 0;

  constructor(
    container: HTMLElement,
    private bus: GameEventBus,
    private callbacks: HudCallbacks,
    private progression?: ProgressionApi
  ) {
    this.root = document.createElement("div");
    this.root.className = "ui-layer";
    this.root.innerHTML = `
      <div class="menu-screen" id="menu" role="dialog" aria-label="Lingo Hero main menu">
        <div class="brand">
          <p class="brand-kicker">Rhythm · Language</p>
          <h1 class="logo-title">Lingo<span class="accent"> Hero</span></h1>
          <p class="brand-tagline">Feel the beat. Learn the words.</p>
        </div>
        <div class="menu-actions">
          <button class="menu-btn practice" id="btn-practice" type="button">
            <span class="btn-icon" aria-hidden="true">&#9835;</span>
            <span class="btn-labels">
              <span class="btn-title">Practice</span>
              <span class="btn-sub">Learn at your pace</span>
            </span>
            <span class="btn-chevron" aria-hidden="true">&#10095;</span>
          </button>
          <button class="menu-btn blitz" id="btn-blitz" type="button">
            <span class="btn-icon" aria-hidden="true">&#9889;</span>
            <span class="btn-labels">
              <span class="btn-title">Blitz Mode</span>
              <span class="btn-sub">Endless · chase the combo</span>
            </span>
            <span class="btn-chevron" aria-hidden="true">&#10095;</span>
          </button>
        </div>
      </div>

      <div class="hud hidden" id="hud">
        <div class="top-bar">
          <div class="prompt-stack">
            <div class="question-box" id="question-box" aria-live="polite"></div>
            <!-- (a) romanization line under the foreign prompt -->
            <div class="romanization-line" id="romanization-line" aria-live="polite" hidden></div>
          </div>
          <!-- (b) audio-replay button: re-speaks the current prompt -->
          <button class="replay-btn" id="replay-btn" type="button" aria-label="Replay audio" hidden>
            <span class="replay-icon" aria-hidden="true">&#128266;</span>
          </button>
        </div>
        <!-- (d) progress / mastery readout slot -->
        <div class="mastery-readout" id="mastery-readout" aria-live="polite" hidden></div>
        <div class="score-container">
          <div class="stat score-box">
            <span class="stat-label">Score</span>
            <span class="stat-value" id="score">0</span>
            <span class="score-flyout" id="score-flyout" aria-hidden="true"></span>
          </div>
          <div class="stat combo-box zero" id="combo-box">
            <span class="stat-label">Combo</span>
            <span class="combo-value"><span class="x">x</span><span id="combo">0</span></span>
          </div>
        </div>
        <!-- (c) post-answer FEEDBACK card surface (foreign <-> english + state) -->
        <div class="feedback-card" id="feedback-card" role="status" aria-live="polite" hidden></div>
      </div>

      <div class="game-over-screen hidden" id="game-over" role="dialog" aria-label="Game over">
        <div class="glass-panel">
          <p class="new-best hidden" id="new-best"><span aria-hidden="true">&#9733;</span> New Best!</p>
          <p class="go-eyebrow">Run Complete</p>
          <h2 class="go-title">Game Over</h2>
          <div class="go-score">
            <span class="stat-label">Final Score</span>
            <div class="final-score" id="final-score">0</div>
          </div>
          <div class="go-stats">
            <div class="go-stat"><span class="v" id="go-streak">0</span><span class="k">Best Streak</span></div>
            <div class="go-stat"><span class="v" id="go-level">1</span><span class="k">Level</span></div>
            <div class="go-stat"><span class="v" id="go-high">0</span><span class="k">High Score</span></div>
          </div>
          <div class="go-actions">
            <button class="menu-btn blitz" id="btn-retry" type="button">
              <span class="btn-icon" aria-hidden="true">&#8635;</span>
              <span class="btn-labels"><span class="btn-title">Retry</span></span>
              <span class="btn-chevron" aria-hidden="true">&#10095;</span>
            </button>
            <button class="menu-btn secondary" id="btn-menu" type="button">
              <span class="btn-icon" aria-hidden="true">&#9776;</span>
              <span class="btn-labels"><span class="btn-title">Main Menu</span></span>
              <span class="btn-chevron" aria-hidden="true">&#10095;</span>
            </button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(this.root);

    this.menuScreen = this.root.querySelector("#menu")!;
    this.hudPanel = this.root.querySelector("#hud")!;
    this.gameOverScreen = this.root.querySelector("#game-over")!;
    this.questionBox = this.root.querySelector("#question-box")!;
    this.romanizationEl = this.root.querySelector("#romanization-line")!;
    this.replayBtn = this.root.querySelector("#replay-btn")!;
    this.feedbackCard = this.root.querySelector("#feedback-card")!;
    this.masteryEl = this.root.querySelector("#mastery-readout")!;
    this.scoreEl = this.root.querySelector("#score")!;
    this.comboEl = this.root.querySelector("#combo")!;
    this.comboBox = this.root.querySelector("#combo-box")!;
    this.scoreFlyout = this.root.querySelector("#score-flyout")!;
    this.finalScoreEl = this.root.querySelector("#final-score")!;
    this.newBestEl = this.root.querySelector("#new-best")!;
    this.goStreakEl = this.root.querySelector("#go-streak")!;
    this.goLevelEl = this.root.querySelector("#go-level")!;
    this.goHighEl = this.root.querySelector("#go-high")!;

    this.bindButton("#btn-practice", () =>
      this.callbacks.onStartGame(GameMode.PRACTICE)
    );
    this.bindButton("#btn-blitz", () =>
      this.callbacks.onStartGame(GameMode.BLITZ)
    );
    this.bindButton("#btn-retry", () =>
      this.callbacks.onStartGame(this.lastMode)
    );
    this.bindButton("#btn-menu", () => this.callbacks.onShowMenu());

    // (b) Wire the audio-replay button only if the host provided a callback.
    if (this.callbacks.onReplayPrompt) {
      this.replayBtn.hidden = false;
      this.bindButton("#replay-btn", () => this.callbacks.onReplayPrompt!());
    }

    this.subscribe();
  }

  /** The prompt text shown in the in-game question box (foreign word). */
  setQuestion(text: string): void {
    this.questionBox.textContent = text;
    // re-trigger the pop animation each wave
    this.questionBox.style.animation = "none";
    // force reflow so the animation restarts
    void this.questionBox.offsetWidth;
    this.questionBox.style.animation = "";
  }

  /**
   * (a) ROMANIZATION SLOT — set the line shown under the foreign prompt.
   * Pass "" to clear/hide. Foundation no-op styling; the ui stream restyles.
   * Game.ts calls this each wave with the host romanization (may be empty).
   */
  setRomanization(text: string): void {
    const t = (text ?? "").trim();
    this.romanizationEl.textContent = t;
    this.romanizationEl.hidden = t.length === 0;
  }

  /**
   * (b) Programmatic show/hide of the replay button (e.g. hide between waves).
   * The button is auto-shown at construction iff an onReplayPrompt callback
   * was provided; this lets the ui stream toggle it without re-wiring.
   */
  setReplayEnabled(enabled: boolean): void {
    this.replayBtn.hidden = !enabled || !this.callbacks.onReplayPrompt;
  }

  /**
   * (c) FEEDBACK CARD SLOT — raise the post-answer card showing the
   * foreign↔english pairing, romanization, and correct/incorrect state. The
   * ui stream calls this from a `wave-resolved` subscription. `autoHideMs`
   * (default 0 = stay until next call / hideFeedback) auto-dismisses.
   * Foundation default render is a minimal, correct surface; the ui stream
   * may replace innerHTML entirely if it wants a richer card.
   */
  showFeedback(data: FeedbackCardData, autoHideMs = 0): void {
    const roman = data.romanization?.trim()
      ? `<div class="fb-roman">${this.escape(data.romanization)}</div>`
      : "";
    this.feedbackCard.className =
      "feedback-card " + (data.correct ? "is-correct" : "is-wrong");
    this.feedbackCard.dataset.outcome = data.outcome ?? (data.correct ? "correct" : "wrong");
    this.feedbackCard.innerHTML = `
      <div class="fb-foreign">${this.escape(data.foreign)}</div>
      ${roman}
      <div class="fb-arrow" aria-hidden="true">&#8595;</div>
      <div class="fb-english">${this.escape(data.english)}</div>
    `;
    this.feedbackCard.hidden = false;
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    if (autoHideMs > 0) {
      this.feedbackTimer = window.setTimeout(
        () => this.hideFeedback(),
        autoHideMs
      );
    }
  }

  /** (c) Hide/clear the feedback card. */
  hideFeedback(): void {
    this.feedbackCard.hidden = true;
    this.feedbackCard.innerHTML = "";
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
  }

  /**
   * (d) MASTERY READOUT SLOT — set the progress/mastery line. Pass null to
   * hide. The ui/learning stream feeds this from spaced-difficulty state.
   */
  setMastery(readout: MasteryReadout | null): void {
    if (!readout || !readout.label.trim()) {
      this.masteryEl.hidden = true;
      this.masteryEl.innerHTML = "";
      return;
    }
    const bar =
      typeof readout.progress === "number"
        ? `<span class="mastery-bar"><span class="mastery-fill" style="width:${Math.max(
            0,
            Math.min(1, readout.progress)
          ) * 100}%"></span></span>`
        : "";
    this.masteryEl.innerHTML = `<span class="mastery-label">${this.escape(
      readout.label
    )}</span>${bar}`;
    this.masteryEl.hidden = false;
  }

  /** Minimal HTML-escape for text fed into slot innerHTML. */
  private escape(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Apply the resolved active language to the HUD: sets dir=rtl/ltr and a
   * data-lang attribute the ui stream can hang per-language styling off.
   */
  applyLanguage(lang: ActiveLanguage): void {
    this.root.setAttribute("dir", lang.isRTL ? "rtl" : "ltr");
    this.root.setAttribute("data-lang", lang.code);
    this.root.setAttribute("data-text-size", lang.textSize);
  }

  dispose(): void {
    for (const off of this.offFns) off();
    this.offFns = [];
    if (this.comboPulseTimer) clearTimeout(this.comboPulseTimer);
    if (this.flyoutTimer) clearTimeout(this.flyoutTimer);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.root.remove();
  }

  private subscribe(): void {
    this.offFns.push(
      this.bus.on("gameStart", (e) => {
        this.lastMode = e.mode;
        this.applyLanguage(e.language);
        this.menuScreen.classList.add("hidden");
        this.gameOverScreen.classList.add("hidden");
        this.hudPanel.classList.remove("hidden");
        this.scoreEl.textContent = "0";
        this.comboEl.textContent = "0";
        this.comboBox.classList.add("zero");
        this.comboBox.classList.remove("pulse");
        // Reset transient learning slots for a fresh run.
        this.hideFeedback();
        this.setRomanization("");
      }),
      this.bus.on("menuShown", () => {
        this.menuScreen.classList.remove("hidden");
        this.hudPanel.classList.add("hidden");
        this.gameOverScreen.classList.add("hidden");
        this.hideFeedback();
      }),
      this.bus.on("scoreChange", (e) => {
        this.scoreEl.textContent = e.value.toLocaleString();
        if (e.delta !== 0) this.showScoreFlyout(e.delta);
      }),
      this.bus.on("comboChange", (e) => {
        this.comboEl.textContent = e.value.toString();
        this.comboBox.classList.toggle("zero", e.value === 0);
        if (e.value > e.previous) this.pulseCombo();
      }),
      this.bus.on("gameOver", (e) => {
        this.hudPanel.classList.add("hidden");
        this.gameOverScreen.classList.remove("hidden");
        this.finalScoreEl.textContent = e.finalScore.toLocaleString();
        this.populateGameOverStats(e.finalScore);
      })
    );
  }

  /** Brief scale-pulse on the combo number when it climbs. */
  private pulseCombo(): void {
    this.comboBox.classList.remove("pulse");
    void this.comboBox.offsetWidth; // reflow to restart animation
    this.comboBox.classList.add("pulse");
    if (this.comboPulseTimer) clearTimeout(this.comboPulseTimer);
    this.comboPulseTimer = window.setTimeout(
      () => this.comboBox.classList.remove("pulse"),
      400
    );
  }

  /** Floating +N / −N near the score on every scoring event. */
  private showScoreFlyout(delta: number): void {
    const gain = delta > 0;
    this.scoreFlyout.textContent = `${gain ? "+" : "−"}${Math.abs(delta)}`;
    this.scoreFlyout.classList.remove("show", "gain", "loss");
    void this.scoreFlyout.offsetWidth;
    this.scoreFlyout.classList.add("show", gain ? "gain" : "loss");
    if (this.flyoutTimer) clearTimeout(this.flyoutTimer);
    this.flyoutTimer = window.setTimeout(
      () => this.scoreFlyout.classList.remove("show"),
      720
    );
  }

  /** Poll progression for the celebration panel. Cheap + synchronous. */
  private populateGameOverStats(finalScore: number): void {
    const snap = this.progression?.getSnapshot();
    const bestStreak = snap?.bestStreak ?? 0;
    const level = snap?.level ?? 1;
    const highScore = snap?.highScore ?? 0;

    this.goStreakEl.textContent = bestStreak.toLocaleString();
    this.goLevelEl.textContent = level.toLocaleString();
    this.goHighEl.textContent = highScore.toLocaleString();

    // A new best when this run's score meets/exceeds the persisted high.
    const isNewBest = finalScore > 0 && finalScore >= highScore;
    this.newBestEl.classList.toggle("hidden", !isNewBest);
  }

  private bindButton(selector: string, action: () => void): void {
    const btn = this.root.querySelector(selector);
    if (!btn) return;

    let handled = false;
    const handleEvent = (e: Event) => {
      if (handled) return;
      e.preventDefault();
      e.stopPropagation();
      handled = true;
      setTimeout(() => (handled = false), 300);
      try {
        action();
      } catch (err) {
        console.error(`[Hud] Error in button action:`, err);
      }
    };

    btn.addEventListener("touchstart", handleEvent, { passive: false });
    btn.addEventListener("click", handleEvent);
  }
}
