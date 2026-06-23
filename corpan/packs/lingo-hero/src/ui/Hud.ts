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
   * User tapped the foreign PROMPT itself to hear it again: re-speak the current
   * prompt. There is NO separate speaker/replay button (the design mandate is a
   * single, unambiguous audio control — the mute toggle). The prompt is the
   * "hear again" affordance. Optional so older call sites still compile.
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
  private cueEl: HTMLElement;
  private phraseStrip: HTMLElement;
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
            <!-- The foreign prompt IS the "hear again" control — tap it to replay.
                 There is no separate speaker button (single audio control = mute). -->
            <button class="question-box" id="question-box" type="button" aria-live="polite" aria-label="Replay prompt"></button>
            <!-- (a) romanization line under the foreign prompt -->
            <div class="romanization-line" id="romanization-line" aria-live="polite" hidden></div>
            <!-- one-line cue so the round reads as intentional -->
            <div class="lh-cue" id="lh-cue" aria-hidden="true">Tap the matching word</div>
          </div>
        </div>
        <!-- phrase-assembly progress strip: "Thank ___ ___" -> "Thank you ___" ... -->
        <div class="phrase-strip" id="phrase-strip" aria-live="polite" hidden></div>
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
    this.cueEl = this.root.querySelector("#lh-cue")!;
    this.phraseStrip = this.root.querySelector("#phrase-strip")!;
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

    // Tapping the foreign PROMPT re-speaks it (the single "hear again"
    // affordance — there is no separate speaker button). Wired only if a
    // callback was provided.
    if (this.callbacks.onReplayPrompt) {
      this.bindButton("#question-box", () => this.callbacks.onReplayPrompt!());
    }

    this.subscribe();
  }

  /**
   * The bottom edge (in CSS px, relative to the game container) of the in-game
   * HUD band — i.e. the lowest of the visible top-anchored HUD chrome (score /
   * combo chips, which sit below the prompt + cue + phrase strip). Falling cards
   * and lane FX must start BELOW this so they never collide with or draw under
   * the HUD. Returns 0 when the HUD isn't visible (menu / game-over).
   */
  getHudBottom(): number {
    if (this.hudPanel.classList.contains("hidden")) return 0;
    const hostRect = this.root.getBoundingClientRect();
    // The score/combo strip is the lowest persistent top-band element. Measure
    // its bottom relative to the container; the feedback card + phrase strip are
    // either transient or sit above it.
    const ref = this.scoreEl.closest(".score-container") ?? this.hudPanel;
    const r = (ref as HTMLElement).getBoundingClientRect();
    return Math.max(0, r.bottom - hostRect.top);
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
   * PHRASE-ASSEMBLY STRIP — show the English answer being assembled word by
   * word: collected words read as solid chips, the NEXT word is highlighted as
   * the active blank, and remaining words are dim blanks. `collected` is the
   * count of words already placed (== the current beat index). Pass an empty
   * `words` array to clear/hide the strip.
   */
  setPhraseProgress(words: string[], collected: number): void {
    if (!words || words.length === 0) {
      this.phraseStrip.hidden = true;
      this.phraseStrip.innerHTML = "";
      return;
    }
    const html = words
      .map((w, i) => {
        if (i < collected) {
          return `<span class="ps-word is-done">${this.escape(w)}</span>`;
        }
        const cls = i === collected ? "ps-word is-active" : "ps-word is-blank";
        // Blank width hints at the word length without revealing it.
        const fill = "_".repeat(Math.max(2, Math.min(8, w.length)));
        return `<span class="${cls}" aria-hidden="true">${fill}</span>`;
      })
      .join(" ");
    this.phraseStrip.innerHTML = html;
    this.phraseStrip.hidden = false;
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
    `;
    this.feedbackCard.hidden = false;
    // Restart the entrance animation each reveal.
    this.feedbackCard.classList.remove("is-in");
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
        // Reset transient learning slots + run tally for a fresh run.
        this.hideFeedback();
        this.setRomanization("");
        this.setPhraseProgress([], 0);
        this.cueEl.classList.remove("is-dim");
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
        this.setPhraseProgress([], 0);
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
      // Fade the "Tap the matching word" cue once the player is clearly going —
      // it's a teaching aid, not permanent chrome.
      this.bus.on("noteHit", () => {
        this.cueEl.classList.add("is-dim");
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
        this.showFeedback(
          {
            foreign: e.word.foreign,
            english: e.word.english,
            romanization: e.word.romanization,
            correct: e.correct,
            outcome: e.outcome,
          },
          // Correct answers flash by; misses linger so the meaning sinks in.
          e.correct ? 1400 : 2600
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
