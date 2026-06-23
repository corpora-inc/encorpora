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
   * User tapped to CONTINUE past the phrase-complete result linger (advance to
   * the next phrase immediately instead of waiting out the dwell). Optional so
   * older call sites still compile.
   */
  onContinue?: () => void;
}

export class Hud {
  private root: HTMLElement;
  private menuScreen: HTMLElement;
  private hudPanel: HTMLElement;
  private gameOverScreen: HTMLElement;
  private questionBox: HTMLElement;
  private romanizationEl: HTMLElement;
  private assembledEl: HTMLElement;
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
  /** Words seen this run + correct count (drive the in-run mastery readout). */
  private runSeen = 0;
  private runCorrect = 0;

  constructor(
    container: HTMLElement,
    private bus: GameEventBus,
    private callbacks: HudCallbacks,
    private progression?: ProgressionApi
  ) {
    this.root = document.createElement("div");
    this.root.className = "ui-layer";
    this.root.innerHTML = `
      <button class="lh-exit-btn" id="lh-exit" type="button" aria-label="Exit Lingo Hero" title="Exit">
        <span aria-hidden="true">&#8592;</span>
      </button>
      <div class="menu-screen" id="menu" role="dialog" aria-label="Lingo Hero main menu">
        <div class="brand">
          <p class="brand-kicker">Rhythm · Language</p>
          <h1 class="logo-title">Lingo<span class="accent"> Hero</span></h1>
          <p class="brand-tagline">Catch the translation, word by word.</p>
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
        <!-- Transparent / translucent OVERLAY header: full screen width, minimal
             height (just prompt + building pills). No title. Falling notes spawn
             at the very top and are seen behind it. pointer-events:none so it
             never blocks taps on the lanes underneath. -->
        <div class="top-bar">
          <div class="prompt-stack">
            <!-- The PROMPT in the language you already know. Display only — it
                 wraps/auto-fits so a long phrase is never cut off. -->
            <div class="question-box" id="question-box" aria-live="polite"></div>
            <!-- (a) romanization line under the prompt -->
            <div class="romanization-line" id="romanization-line" aria-live="polite" hidden></div>
            <!-- The target-phrase strip that ASSEMBLES as words are caught. -->
            <div class="lh-assemble" id="lh-assemble" aria-live="polite" hidden></div>
          </div>
        </div>
        <!-- STATS STRIP — moved OUT of the central play area so SCORE / COMBO /
             progress never flank the falling-note lanes. On tall screens it
             docks BELOW the hit-ring circles (near the bottom); on short
             screens it collapses to a slim row at the very top. -->
        <div class="lh-stats" id="lh-stats">
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
    this.assembledEl = this.root.querySelector("#lh-assemble")!;
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

    // Exit the pack entirely: the Corpán host listens for `corpan:exit` (App.tsx)
    // and dismisses the game. Persistent (menu + gameplay) so there's always a
    // way out besides the OS back button.
    this.bindButton("#lh-exit", () =>
      window.dispatchEvent(new CustomEvent("corpan:exit"))
    );

    // The held result card is itself a tap-to-continue surface (it sits in the
    // pointer-events:none overlay but takes pointer-events:auto while held).
    if (this.callbacks.onContinue) {
      this.bindButton("#feedback-card", () => this.callbacks.onContinue!());
    }

    this.subscribe();
  }

  /** The prompt text shown in the in-game question box (foreign word). */
  setQuestion(text: string): void {
    this.questionBox.textContent = text;
    // A new wave begins: clear any lingering meaning-reveal card so it never
    // overlaps the fresh prompt (the auto-hide timer may still be pending).
    this.hideFeedback();
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
   * Render the ASSEMBLING target-phrase strip: `words` are the target words
   * caught so far (in order); `total` is the full word count so empty slots can
   * show as placeholders. Pass an empty array to reset to all-placeholders.
   * RTL targets render right-to-left.
   */
  setAssembled(words: string[], total: number, isRTL = false): void {
    const n = Math.max(total, words.length);
    if (n === 0) {
      this.assembledEl.hidden = true;
      this.assembledEl.innerHTML = "";
      return;
    }
    this.assembledEl.dir = isRTL ? "rtl" : "ltr";
    const chips: string[] = [];
    for (let i = 0; i < n; i++) {
      if (i < words.length) {
        chips.push(
          `<span class="lh-chip filled" dir="auto">${this.escape(words[i])}</span>`
        );
      } else {
        chips.push(`<span class="lh-chip empty" aria-hidden="true"></span>`);
      }
    }
    this.assembledEl.innerHTML = chips.join("");
    this.assembledEl.hidden = false;
    // Pop the most-recently-revealed chip.
    const last = this.assembledEl.querySelector(".lh-chip.filled:last-of-type");
    if (last) {
      last.classList.remove("just-in");
      void (last as HTMLElement).offsetWidth;
      last.classList.add("just-in");
    }
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
    const outcome = data.outcome ?? (data.correct ? "correct" : "wrong");
    const roman = data.romanization?.trim()
      ? `<div class="fb-roman">${this.escape(data.romanization)}</div>`
      : "";

    // RTL-aware, outcome-nuanced verdict copy. "passed" (the prompt fell by)
    // reads differently from a tapped-wrong distractor — both reveal meaning.
    const verdict =
      outcome === "correct"
        ? { icon: "&#10003;", label: "Nailed it" }
        : outcome === "passed"
          ? { icon: "&#8987;", label: "Missed it" }
          : { icon: "&#10005;", label: "Not quite" };

    this.feedbackCard.className =
      "feedback-card " + (data.correct ? "is-correct" : "is-wrong");
    this.feedbackCard.dataset.outcome = outcome;
    this.feedbackCard.innerHTML = `
      <div class="fb-verdict">
        <span class="fb-verdict-icon" aria-hidden="true">${verdict.icon}</span>
        <span class="fb-verdict-label">${verdict.label}</span>
      </div>
      <div class="fb-pair">
        <div class="fb-foreign" dir="auto">${this.escape(data.foreign)}</div>
        ${roman}
        <div class="fb-arrow" aria-hidden="true">&#8595;</div>
        <div class="fb-english" dir="auto">${this.escape(data.english)}</div>
      </div>
      <div class="fb-continue" hidden>Tap to continue</div>
    `;
    this.feedbackCard.hidden = false;
    // Restart the entrance animation each reveal.
    this.feedbackCard.classList.remove("is-in", "is-held");
    void this.feedbackCard.offsetWidth;
    this.feedbackCard.classList.add("is-in");

    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    if (autoHideMs > 0) {
      this.feedbackTimer = window.setTimeout(
        () => this.hideFeedback(),
        autoHideMs
      );
    }
  }

  /**
   * HOLD the just-shown result card for `dwellMs` so the player can READ the
   * full assembled target phrase + its meaning before the next phrase loads (a
   * key learning beat). Cancels any auto-hide from showFeedback and reveals the
   * "Tap to continue" affordance. The card stays up until the next setQuestion()
   * (new round) clears it — Game also auto-advances when the dwell elapses, so
   * the player is never stuck. We do NOT hide on a timer here: the card lingers
   * visibly through the whole dwell and the new round's setQuestion() removes it.
   */
  holdResult(dwellMs: number): void {
    if (this.feedbackCard.hidden) return;
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = 0;
    }
    this.feedbackCard.classList.add("is-held");
    const hint = this.feedbackCard.querySelector<HTMLElement>(".fb-continue");
    if (hint) {
      // Reveal the tap-to-continue cue shortly into the dwell, so the player
      // reads the result first, then sees they can advance early.
      const reveal = Math.min(900, Math.max(300, dwellMs * 0.3));
      window.setTimeout(() => {
        if (!this.feedbackCard.hidden && hint.isConnected) hint.hidden = false;
      }, reveal);
    }
  }

  /** (c) Hide/clear the feedback card. */
  hideFeedback(): void {
    this.feedbackCard.hidden = true;
    this.feedbackCard.innerHTML = "";
    this.feedbackCard.classList.remove("is-held");
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
        // Reset transient learning slots + run tally for a fresh run.
        this.hideFeedback();
        this.setRomanization("");
        this.setAssembled([], 0);
        this.runSeen = 0;
        this.runCorrect = 0;
        this.refreshMastery();
      }),
      this.bus.on("menuShown", () => {
        this.menuScreen.classList.remove("hidden");
        this.hudPanel.classList.add("hidden");
        this.gameOverScreen.classList.add("hidden");
        this.hideFeedback();
        this.setMastery(null);
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
      }),
      // (c) LEARNING SURFACE — the single, reliable per-wave verdict hook.
      // Raise the meaning-reveal feedback card and advance the run mastery
      // tally. This is the ui-stream wiring the foundation deliberately left
      // to us (Game.ts only emits; it never calls showFeedback/setMastery).
      this.bus.on("wave-resolved", (e) => {
        this.runSeen += 1;
        if (e.correct) this.runCorrect += 1;
        // No auto-hide: Game.holdResult() controls the LINGER dwell so the
        // player can read the assembled phrase + meaning; the next round's
        // setQuestion() clears the card.
        this.showFeedback(
          {
            foreign: e.word.foreign,
            english: e.word.english,
            romanization: e.word.romanization,
            correct: e.correct,
            outcome: e.outcome,
          },
          0
        );
        this.refreshMastery();
      })
    );
  }

  /**
   * (d) Recompute + push the in-run mastery readout. Blends this run's live
   * accuracy with the persisted level progress so the player always feels
   * forward motion. Hidden on the very first wave (nothing to show yet).
   */
  private refreshMastery(): void {
    if (this.runSeen === 0) {
      this.setMastery(null);
      return;
    }
    const snap = this.progression?.getSnapshot();
    const acc = Math.round((this.runCorrect / this.runSeen) * 100);
    // Prefer the persisted level bar for the fill (a true sense of progress);
    // fall back to this run's accuracy when progression isn't wired.
    const progress =
      typeof snap?.levelProgress === "number"
        ? snap.levelProgress
        : this.runCorrect / this.runSeen;
    const lvl = snap?.level ?? 1;
    this.setMastery({
      label: `Lv ${lvl} · ${this.runCorrect}/${this.runSeen} · ${acc}%`,
      progress,
    });
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
