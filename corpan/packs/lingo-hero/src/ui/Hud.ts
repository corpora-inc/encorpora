import type { GameEventBus } from "../events";
import type { ProgressionApi } from "../progression";
import { GameMode, type ActiveLanguage } from "../types";

/** Shared with the audio stream — the single persisted mute preference key. */
const MUTE_STORAGE_KEY = "lingoHero.audio.muted";

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
  /**
   * #432 — true for the persistent ZERO-state placeholder (level shown before
   * any wave resolves). Styled slightly quieter than the earned live readout so
   * the row stays composed without overclaiming progress that hasn't happened.
   */
  placeholder?: boolean;
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
  /**
   * User opened the PAUSE sheet (or pressed the OS/gesture back). Game pauses
   * the loop + audio. Optional for older call sites.
   */
  onPause?: () => void;
  /** User dismissed the pause sheet (Resume). Game resumes the loop + audio. */
  onResume?: () => void;
  /** User toggled the single MUTE control. Game emits `muteChange` on the bus. */
  onSetMuted?: (muted: boolean) => void;
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

  private pauseBtn: HTMLElement;
  private muteBtn: HTMLElement;
  private pauseSheet: HTMLElement;

  private offFns: Array<() => void> = [];
  private lastMode: GameMode = GameMode.PRACTICE;
  private comboPulseTimer = 0;
  private flyoutTimer = 0;
  private feedbackTimer = 0;
  /** True while the pause sheet is open. */
  private pauseOpen = false;
  /** Persisted mute preference, mirrored into the in-sheet toggle's state. */
  private muted = false;
  /** Detach handle for the Android/gesture back (popstate) listener. */
  private offPopState?: () => void;
  /** Words seen this run + correct count (drive the in-run mastery readout). */
  private runSeen = 0;
  private runCorrect = 0;
  /**
   * #460 — fired AFTER the prompt has (re-)fitted to a final wrapped layout,
   * including the deferred rAF / font-swap re-fits. Game subscribes to recompute
   * the spawn play-top so falling tiles always clear the prompt's LAST line — no
   * matter WHO changed the prompt (loadRound, a direct setQuestion, resize, or
   * the font-ready reflow). Without this, a re-fit that grew the prompt taller
   * left the play-top stale and tiles spawned over the last line (the operator's
   * "doesn't show the whole prompt" at a narrow play column on iPad).
   */
  private onPromptFitCb?: () => void;

  constructor(
    container: HTMLElement,
    private bus: GameEventBus,
    private callbacks: HudCallbacks,
    private progression?: ProgressionApi
  ) {
    this.root = document.createElement("div");
    // Start on the menu: the in-game pause/mute chrome is hidden until a run
    // begins (gameStart removes `chrome-off`).
    this.root.className = "ui-layer chrome-off";
    this.root.innerHTML = `
      <!-- TOP-LEFT chrome (#462, supersedes the #426 auto-hide): ONE small,
           PERSISTENT pause control tucked in the corner. It is ALWAYS visible
           during play (low-opacity / unobtrusive, never auto-hidden, never
           tap-the-playfield-to-reveal — tapping the playfield IS gameplay). It
           opens the pause sheet (Resume / Mute / Exit). The OS/gesture back also
           opens it (Android). pointer-events:auto + stopPropagation, so a tap on
           it never leaks through to the canvas lanes (the 0.4.3 contract). It
           floats over the corner — the .top-bar no longer reserves a band for it,
           so the prompt + play area reclaim that vertical space. The mute toggle
           moved INTO the sheet (the OS volume / silent switch handles audio on
           mobile; a permanent mute pill wasted vertical space). The legacy
           #lh-exit id stays (inside the sheet) so the host/tests resolve "exit". -->
      <button class="lh-chrome-btn lh-pause-btn" id="lh-pause" type="button"
              aria-label="Pause" title="Pause" aria-haspopup="dialog" aria-expanded="false">
        <span aria-hidden="true">&#10073;&#10073;</span>
      </button>
      <div class="lh-pause-sheet" id="lh-pause-sheet" role="dialog"
           aria-label="Paused" aria-modal="true" hidden>
        <div class="lh-pause-card">
          <p class="lh-pause-title">Paused</p>
          <!-- #490: pause-sheet rows are TERMINAL actions (they act, they don't
               drill into a submenu), so they carry NO trailing drill-in chevron.
               That chevron glyph is reserved for the menu's drill-in buttons
               (Practice / Blitz / Retry / Main Menu). The terminal-action class
               drops the chevron affordance and keeps the row a flat, tappable
               action. -->
          <button class="menu-btn blitz terminal-action" id="lh-resume" type="button">
            <span class="btn-icon" aria-hidden="true">&#9654;</span>
            <span class="btn-labels"><span class="btn-title">Resume</span></span>
          </button>
          <button class="menu-btn secondary terminal-action lh-mute-btn" id="lh-mute" type="button"
                  aria-label="Mute audio" aria-pressed="false">
            <span class="btn-icon" aria-hidden="true">
              <span class="lh-mute-on">&#128266;</span>
              <span class="lh-mute-off">&#128263;</span>
            </span>
            <span class="btn-labels"><span class="btn-title lh-mute-label">Mute</span></span>
          </button>
          <button class="menu-btn secondary terminal-action" id="lh-exit" type="button" aria-label="Exit Lingo Hero">
            <span class="btn-icon" aria-hidden="true">&#8592;</span>
            <span class="btn-labels"><span class="btn-title">Exit</span></span>
          </button>
        </div>
      </div>
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
        <!-- BOTTOM STATS ROW (issue #443, evolves #426): SCORE | thin level meter |
             STREAK — two equal "fat" plates flanking a THIN center meter, the row
             spanning the FULL WIDTH of the 3 lanes. Premium + comfortable at
             iPad/landscape width (not a cramped center cluster), still tidy on a
             phone. It sits UNDER the hit-ring circles and respects the bottom safe
             area. pointer-events stay off the row. DOM order == visual order. -->
        <div class="lh-stats" id="lh-stats">
          <div class="stat score-box">
            <span class="stat-label">Score</span>
            <span class="stat-value" id="score">0</span>
            <span class="score-flyout" id="score-flyout" aria-hidden="true"></span>
          </div>
          <!-- (d) thin CENTER level / mastery meter (between the two plates) -->
          <div class="mastery-readout" id="mastery-readout" aria-live="polite" hidden></div>
          <div class="stat combo-box zero" id="combo-box">
            <span class="stat-label">Streak</span>
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

    this.pauseBtn = this.root.querySelector("#lh-pause")!;
    this.muteBtn = this.root.querySelector("#lh-mute")!;
    this.pauseSheet = this.root.querySelector("#lh-pause-sheet")!;
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

    // PAUSE control (top-left) → opens the small Resume/Exit sheet. Consolidating
    // the top-left into a pause (not a bare exit) means an accidental tap can't
    // dump a run mid-combo (issue #426). The sheet's Exit dispatches the host
    // `corpan:exit` (App.tsx dismisses the game); Resume closes the sheet.
    this.bindButton("#lh-pause", () => this.openPause());
    // #490: explicit pressed-state on the small corner pill. `:active` can be
    // unreliable for a low-opacity glyph inside the pointer-events overlay, so
    // toggle `.is-pressed` directly on press/release for a guaranteed-visible
    // tap acknowledgement (the CSS gives it an accent ring + lifted fill).
    this.bindPressedState("#lh-pause");
    this.bindButton("#lh-resume", () => this.closePause(true));
    this.bindButton("#lh-exit", () => this.doExit());
    // Tapping the sheet backdrop (outside the card) resumes — same as Resume.
    this.bindButton("#lh-pause-sheet", (e) => {
      if (e && e.target === this.pauseSheet) this.closePause(true);
    });

    // The single MUTE toggle — now INSIDE the pause sheet (Resume / Mute / Exit),
    // not a permanent HUD pill (#462). Reads the persisted preference for its
    // initial pressed state, then flips it live + persists on each tap.
    this.muted = this.readStoredMuted();
    this.reflectMute();
    this.bindButton("#lh-mute", () => this.toggleMute());

    // ANDROID hardware/gesture BACK: wire window 'popstate' to the SAME exit
    // path so Android users get a back-gesture exit in addition to the visible
    // pause control (iOS has no system back button → the visible control is the
    // accessible affordance). We push one history entry when the run starts so
    // the first back press lands here instead of leaving the SPA.
    this.installBackHandler();

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
    // AUTO-FIT: the prompt must ALWAYS show in full (issue #426). The phrase may
    // be a long sentence; CSS wraps it, but a big base font on a narrow phone can
    // still overflow the reserved header band. Shrink the font (down to a sane
    // floor) until the FULL text fits within the band at up to ~2 lines, so it is
    // never clipped at any length.
    this.fitPrompt();
  }

  /**
   * Auto-fit the prompt so the ENTIRE phrase is always visible — #441.
   *
   * The 0.4.3 version tried to JAM every phrase into <=2 lines and bottomed out
   * at a font floor; a long sentence then wrapped to a 3rd line that overflowed
   * the band (scrollHeight > clientHeight) — the exact iPad clip the operator
   * kept hitting. The model here is inverted and correct:
   *
   *   - The phrase WRAPS freely (CSS: white-space:normal / overflow-wrap:anywhere).
   *   - We give it a GENEROUS height budget (a fraction of the viewport, capped
   *     to a max line count that is large enough to never clip a real phrase).
   *   - We START at the CSS ceiling and only SHRINK the font when the wrapped
   *     text exceeds that budget OR a single unbreakable token overflows width,
   *     floored so it stays readable.
   *
   * Because layout must be settled to measure, we run once now and again on the
   * next frame (rAF) — the first call can fire before flex layout resolves
   * (which made the old fit silently no-op against a stale/zero width).
   */
  private fitPrompt(): void {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => this.fitPromptNow());
      // #460 — a SECOND deferred re-fit one more frame out. The vendored heavy
      // display face ("Russo One"/Lato-Heavy) can swap in AFTER the first fit
      // (notably on iOS WKWebView, where the woff2 lands a beat after first
      // paint). Its wider glyphs reflow the phrase to more lines than the
      // fallback measured; without re-measuring, the prompt keeps the stale
      // fallback size and the extra line spills the band. The extra frame
      // re-fits against the real glyph metrics so the FULL phrase stays visible.
      // (Game.ts also re-fits on document.fonts.ready for the definitive swap.)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => this.fitPromptNow())
      );
    }
    // Also run synchronously so callers/tests that measure immediately see a fit.
    this.fitPromptNow();
  }

  private fitPromptNow(): void {
    const el = this.questionBox;
    if (!el.textContent) return;
    // Reset to the CSS-driven size, then read it as our ceiling.
    el.style.fontSize = "";
    el.style.lineHeight = "";
    const ceiling = parseFloat(getComputedStyle(el).fontSize) || 24;
    const cssLineH = parseFloat(getComputedStyle(el).lineHeight) || ceiling * 1.16;
    const lineRatio = cssLineH / ceiling || 1.16;
    const FLOOR = 13; // px — never shrink below this (still readable)
    // Generous height budget: up to MAX_LINES of text, but never taller than a
    // fraction of the viewport. MAX_LINES is high enough that a normal sentence
    // never clips; the font only shrinks if a phrase is genuinely huge.
    const MAX_LINES = 4;
    const vh = window.innerHeight || 800;
    const budget = Math.min(MAX_LINES * ceiling * lineRatio, vh * 0.3);

    let size = ceiling;
    const apply = (s: number) => {
      el.style.fontSize = `${s}px`;
    };
    apply(size);
    // scrollHeight is the wrapped content height; scrollWidth>clientWidth means a
    // single token can't break (rare). Shrink until BOTH fit the budget/width.
    const fits = (): boolean =>
      el.scrollHeight <= budget + 1 && el.scrollWidth <= el.clientWidth + 1;
    let guard = 0;
    while (size > FLOOR && !fits() && guard < 40) {
      size = Math.max(FLOOR, size - 1);
      apply(size);
      guard++;
    }
    // #460 — the wrapped layout is now final for this fit pass. Tell Game so it
    // recomputes the spawn play-top against the prompt's settled height (the
    // prompt may have just grown taller from a font swap / narrower column).
    this.onPromptFitCb?.();
  }

  /**
   * #460 — register a callback fired after every prompt (re-)fit settles, so the
   * owner (Game) can recompute the spawn-clearance play-top against the prompt's
   * final wrapped height. Idempotent + cheap; called on each fit pass.
   */
  setOnPromptFit(cb: () => void): void {
    this.onPromptFitCb = cb;
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
      this.masteryEl.classList.remove("is-placeholder");
      return;
    }
    const bar =
      typeof readout.progress === "number"
        ? `<span class="mastery-bar"><span class="mastery-fill" style="width:${Math.max(
            0,
            Math.min(1, readout.progress)
          ) * 100}%"></span></span>`
        : "";
    // PHONE LABEL DENSITY (#445.3): the full "Lv N · c/s · pp%" label is cramped
    // at the narrowest widths. Carry BOTH the full label and a compact variant
    // (drop the c/s fraction → "Lv N · pp%"); CSS shows the compact one on a
    // phone and the full one on roomier widths. Both stay non-overlapping.
    const full = this.escape(readout.label);
    const compact = this.escape(this.compactMasteryLabel(readout.label));
    this.masteryEl.innerHTML =
      `<span class="mastery-label mastery-label-full">${full}</span>` +
      `<span class="mastery-label mastery-label-compact" aria-hidden="true">${compact}</span>` +
      bar;
    this.masteryEl.classList.toggle("is-placeholder", readout.placeholder === true);
    this.masteryEl.hidden = false;
  }

  /**
   * Compact a "Lv N · c/s · pp%" mastery label for narrow widths by dropping the
   * middle caught/seen fraction → "Lv N · pp%" (#445.3). Labels without that
   * shape pass through unchanged.
   */
  private compactMasteryLabel(label: string): string {
    const parts = label.split("·").map((p) => p.trim());
    if (parts.length === 3 && /^\d+\s*\/\s*\d+$/.test(parts[1])) {
      return `${parts[0]} · ${parts[2]}`;
    }
    return label;
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

  /** Re-fit the prompt to the current viewport (Game calls this on resize). */
  onResize(): void {
    this.fitPrompt();
  }

  /**
   * SPAWN CLEARANCE (#433 / #445.1): report the prompt block's bottom edge in
   * VIEWPORT px (relative to `containerTop`), and whether the prompt has wrapped
   * to 2+ lines, so Game can hold a SMALL clearance band below it — falling
   * tiles fade in just under the prompt instead of grazing/touching it. We
   * measure the whole prompt stack (foreign prompt + romanization + the
   * assembling strip) so the clearance tracks every line the header actually
   * shows. Returns 0/false when the prompt is empty (no clearance needed).
   *
   * The header stays a TRANSLUCENT overlay (#426 contract preserved): notes
   * still appear BEHIND/within the header band below the text — we only push
   * their entry a few px clear of the printed lines so the top reads cleanly.
   */
  getPromptClearance(containerTop: number): { bottom: number; wrapped: boolean } {
    const stack = this.root.querySelector<HTMLElement>(".prompt-stack");
    const qb = this.questionBox;
    if (!stack || !qb.textContent) return { bottom: 0, wrapped: false };
    const rect = stack.getBoundingClientRect();
    const bottom = Math.max(0, rect.bottom - containerTop);
    // Wrapped to 2+ lines when the question box is taller than ~1.6 line-heights.
    const cs = getComputedStyle(qb);
    const fontPx = parseFloat(cs.fontSize) || 20;
    const lineH = parseFloat(cs.lineHeight) || fontPx * 1.18;
    const wrapped = qb.getBoundingClientRect().height > lineH * 1.6;
    return { bottom, wrapped };
  }

  // -------------------------------------------------------------------------
  // TOP-LEFT CHROME: persistent pause control + sheet (Resume / Mute / Exit),
  // Android back. (#462 — supersedes the #426 auto-hide.)
  // -------------------------------------------------------------------------

  /** Open the pause sheet (Resume / Mute / Exit) and pause the game. */
  private openPause(): void {
    if (this.pauseOpen) return;
    this.pauseOpen = true;
    this.pauseSheet.hidden = false;
    this.pauseBtn.setAttribute("aria-expanded", "true");
    this.callbacks.onPause?.();
    // Move focus into the sheet for keyboard/AT users.
    const resume = this.pauseSheet.querySelector<HTMLElement>("#lh-resume");
    resume?.focus?.();
  }

  /** Close the pause sheet. `resume` true → resume gameplay (vs. on exit). */
  private closePause(resume: boolean): void {
    if (!this.pauseOpen) return;
    this.pauseOpen = false;
    this.pauseSheet.hidden = true;
    this.pauseBtn.setAttribute("aria-expanded", "false");
    if (resume) {
      this.callbacks.onResume?.();
    }
  }

  /** Exit the pack: close the sheet, then ask the host to dismiss the game. */
  private doExit(): void {
    this.closePause(false);
    window.dispatchEvent(new CustomEvent("corpan:exit"));
  }

  /** Toggle the single mute control: flip, persist, reflect, notify Game. */
  private toggleMute(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, this.muted ? "1" : "0");
    } catch {
      /* storage may be unavailable; the live toggle still works this session */
    }
    this.reflectMute();
    this.callbacks.onSetMuted?.(this.muted);
  }

  private readStoredMuted(): boolean {
    try {
      return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  /** Sync the in-sheet mute button's pressed state + label to `this.muted`. */
  private reflectMute(): void {
    this.muteBtn.setAttribute("aria-pressed", this.muted ? "true" : "false");
    this.muteBtn.setAttribute(
      "aria-label",
      this.muted ? "Unmute audio" : "Mute audio"
    );
    this.muteBtn.classList.toggle("is-muted", this.muted);
    const label = this.muteBtn.querySelector<HTMLElement>(".lh-mute-label");
    if (label) label.textContent = this.muted ? "Unmute" : "Mute";
  }

  /**
   * #462 — the pause control is now PERSISTENT (always visible during play, no
   * auto-fade, no tap-the-playfield-to-reveal). Game still calls this on lane
   * interaction; it is now a no-op (kept so older call sites compile) since the
   * control never hides during a run.
   */
  notifyInteraction(): void {
    /* no-op: the pause control is always visible during play (#462). */
  }

  /** True while the pause sheet is open (Game gates its own input on this). */
  isPaused(): boolean {
    return this.pauseOpen;
  }

  /**
   * Wire the Android hardware/gesture BACK button (and desktop browser back) to
   * the pause/exit path via History + popstate. We push a sentinel state on
   * gameStart; the first back press fires popstate (consumed here) instead of
   * navigating away. If a run is active we open the pause sheet (so back doesn't
   * instantly dump the run); a second back from the open sheet exits.
   */
  private installBackHandler(): void {
    if (typeof window === "undefined") return;
    const onPop = () => {
      // Only meaningful during gameplay; ignore on menu/game-over.
      if (this.hudPanel.classList.contains("hidden")) return;
      // Re-arm a sentinel so a subsequent back is caught again.
      this.armHistorySentinel();
      if (this.pauseOpen) {
        // Already paused → back means EXIT.
        this.doExit();
      } else {
        this.openPause();
      }
    };
    window.addEventListener("popstate", onPop);
    this.offPopState = () => window.removeEventListener("popstate", onPop);
  }

  /** Push one sentinel history entry so the next back press hits popstate. */
  private armHistorySentinel(): void {
    try {
      window.history.pushState({ lingoHero: true }, "");
    } catch {
      /* history may be unavailable (e.g. file:// sandboxes); degrade silently */
    }
  }

  dispose(): void {
    for (const off of this.offFns) off();
    this.offFns = [];
    if (this.comboPulseTimer) clearTimeout(this.comboPulseTimer);
    if (this.flyoutTimer) clearTimeout(this.flyoutTimer);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.offPopState?.();
    this.offPopState = undefined;
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
        // A run begins: reveal the persistent corner pause control, close any
        // pause sheet, and arm the Android-back sentinel for this run. The
        // control stays visible for the whole run (no auto-fade) — #462.
        this.root.classList.remove("chrome-off");
        this.closePause(false);
        this.armHistorySentinel();
      }),
      this.bus.on("menuShown", () => {
        this.menuScreen.classList.remove("hidden");
        this.hudPanel.classList.add("hidden");
        this.gameOverScreen.classList.add("hidden");
        this.hideFeedback();
        this.setMastery(null);
        // Off the playfield (menu): the pause control has no meaning here — hide
        // it entirely (the menu has its own affordances).
        this.closePause(false);
        this.root.classList.add("chrome-off");
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
        // Run ended: the game-over panel owns navigation (Retry / Main Menu),
        // so hide the in-game pause control here too.
        this.closePause(false);
        this.root.classList.add("chrome-off");
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
   * forward motion.
   *
   * PERSISTENT (#432): the level meter is shown at ALL times during play —
   * including the zero state, BEFORE the first wave resolves — so the bottom
   * row always reads as the intended 3-part HUD (Score | meter | Streak) and
   * never collapses to a lone centered SCORE plate. On the first wave (nothing
   * caught yet) we render the persisted LEVEL only, with the level-progress bar
   * fill, and no run fraction; once waves resolve we fold in this run's
   * accuracy + caught/seen tally.
   */
  private refreshMastery(): void {
    const snap = this.progression?.getSnapshot();
    const lvl = snap?.level ?? 1;
    const levelProgress =
      typeof snap?.levelProgress === "number" ? snap.levelProgress : 0;

    if (this.runSeen === 0) {
      // Zero state: persistent placeholder so the row is never sparse. Shows the
      // standing LEVEL + its progress bar; the compact phone format drops the
      // run fraction (there is none yet). Marked `placeholder` so styling can
      // read it slightly quieter than the live, earned readout.
      this.setMastery({
        label: `Lv ${lvl} · 0%`,
        progress: levelProgress,
        placeholder: true,
      });
      return;
    }
    const acc = Math.round((this.runCorrect / this.runSeen) * 100);
    // Prefer the persisted level bar for the fill (a true sense of progress);
    // fall back to this run's accuracy when progression isn't wired.
    const progress =
      typeof snap?.levelProgress === "number"
        ? snap.levelProgress
        : this.runCorrect / this.runSeen;
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

  private bindButton(selector: string, action: (e?: Event) => void): void {
    const btn = this.root.querySelector(selector);
    if (!btn) return;

    let handled = false;
    const handleEvent = (e: Event) => {
      if (handled) return;
      e.preventDefault();
      // stopPropagation is CRITICAL: these controls live in the ui overlay above
      // the canvas; without it a tap could bubble/leak into a lane (tap-through).
      e.stopPropagation();
      handled = true;
      setTimeout(() => (handled = false), 300);
      try {
        action(e);
      } catch (err) {
        console.error(`[Hud] Error in button action:`, err);
      }
    };

    btn.addEventListener("touchstart", handleEvent, { passive: false });
    btn.addEventListener("click", handleEvent);
  }

  /**
   * #490: toggle a `.is-pressed` class on press / release so a small control has
   * a reliable visible pressed state on touch (where CSS `:active` is flaky).
   * Pure visual feedback — the actual action stays wired via {@link bindButton}.
   */
  private bindPressedState(selector: string): void {
    const btn = this.root.querySelector(selector);
    if (!btn) return;
    const on = () => btn.classList.add("is-pressed");
    const off = () => btn.classList.remove("is-pressed");
    btn.addEventListener("touchstart", on, { passive: true });
    btn.addEventListener("pointerdown", on);
    for (const ev of ["touchend", "touchcancel", "pointerup", "pointercancel", "pointerleave"]) {
      btn.addEventListener(ev, off);
    }
  }
}
