import { HostApi, StackConfig } from "./sdk/types";
import {
  GameState,
  GameMode,
  Note,
  LaneIndex,
  type ActiveLanguage,
  type WordIdentity,
} from "./types";
import { LaneSystem } from "./LaneSystem";
import { Renderer } from "./Renderer";
import { InputManager } from "./InputManager";
import { ContentManager, type Round } from "./ContentManager";
import { createEventBus, type GameEventBus } from "./events";
import { Hud } from "./ui/Hud";
import { initEffects, type EffectsHandle } from "./effects";
import { initAudioHaptics, type AudioHandle } from "./audio";
import { initProgression, type ProgressionApi } from "./progression";

const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);

/**
 * Game — "CATCH THE TRANSLATION".
 *
 * The player sees a phrase in the language they ALREADY KNOW (primary =
 * stack.languages[0], also the UI language). At round start its translation in
 * the TARGET (learning) language is laid out as a FALLING CHART: every word of
 * the translation becomes a note, IN ORDER, spaced in TIME (vertical gap = the
 * gap between their strum beats) — like a phrase of guitar-hero notes. They
 * fall continuously; the player catches each correct word at the strum line in
 * rhythm. Catching in order assembles the phrase + speaks each target word (the
 * learning).
 *
 * STREAK-DRIVEN DIFFICULTY (reset to relaxed on any fail):
 *   - Streak 0: words spaced FAR apart in time (generous) and ZERO decoys.
 *   - As the streak builds: COMPRESS the inter-word spacing toward natural
 *     speech tempo AND add DECOYS (wrong target-language words in OTHER lanes,
 *     interleaved with the correct sequence) — 0 -> 1 -> 2 decoys per sentence.
 *   - On FAIL (whiff / miss a correct word / catch a decoy → combo break):
 *     spacing resets to relaxed and decoys to 0 for the NEXT chart.
 *
 * COHERENCE CONTRACT: the correct words are a strict ordered sequence; the
 * player must catch the NEXT one (seqIndex === caughtCount). Catching it
 * advances the sequence; catching a decoy or letting the next correct word
 * sail past the strum is a miss.
 *
 * This file keeps the proven engine intact — delta-timed falling motion,
 * canvas-relative input (InputManager), forgiving hit detection (LaneSystem),
 * the typed event bus, and the effects/audio/hud/progression streams. Only the
 * CONTENT MODEL (phrase → time-spaced chart), the batch chart layout, the
 * catch-in-sequence input, and the assembling strip are new.
 */
export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private laneSystem: LaneSystem;
  private inputManager: InputManager;
  private resizeObserver?: ResizeObserver;
  private contentManager: ContentManager;

  private bus: GameEventBus;
  private hud: Hud;
  private effects: EffectsHandle;
  private audio: AudioHandle;
  private progression: ProgressionApi;

  private state: GameState = GameState.MENU;
  private mode: GameMode = GameMode.PRACTICE;

  private notes: Note[] = [];
  private score: number = 0;
  private combo: number = 0;
  /**
   * How many DECOYS the player has correctly DODGED this run (a wrong card
   * crossed the strum line un-caught — the right play, issue #429). Introspected
   * by the e2e harness via window.__lingoHero to prove the dodge reward fires.
   */
  private decoyDodges: number = 0;
  // Seconds a word takes to fall from spawn to the strum line. Higher = slower
  // & easier — THE primary playability knob, delta-timed so it is frame-rate
  // independent on high-refresh phones.
  private readonly NOTE_TRAVEL_SECONDS = 6;
  private speed: number = 200;
  private lastTimestamp: number = 0;

  private isRunning: boolean = false;
  private fontsReady: boolean = false;

  // ---- Backgrounding pause/resume (anti-brick) ----------------------------
  /** True while the game is paused because the app/tab is backgrounded. */
  private paused: boolean = false;
  /** performance.now() when we paused, to measure paused duration on resume. */
  private pausedAt: number = 0;
  /** Detach handles for the visibility / blur / pagehide listeners. */
  private visibilityHandlers: Array<() => void> = [];

  // ---- Result LINGER (phrase-complete celebration dwell) ------------------
  /**
   * When a phrase completes, the round enters a LINGER: the result card is held
   * so the player can READ the full assembled target phrase + its meaning and
   * let it sink in (a key learning beat). The next phrase only loads after the
   * dwell elapses OR the player taps to continue. `nextSpawnTime` is the
   * earliest auto-advance time; `lingering` gates the tap-to-continue affordance.
   */
  private lingering: boolean = false;
  /** Detach handle for the document-level tap-to-continue listener. */
  private offContinueTap?: () => void;

  // Host language context
  private stackConfig: StackConfig;
  private activeLanguage: ActiveLanguage;
  private offStackConfigChange?: () => void;

  // ---- Round ("Catch the Translation") state ------------------------------
  private round: Round | null = null;
  /** Display tokens of the target translation, in catch order. */
  private roundWords: string[] = [];
  /** How many correct words have been caught (or auto-resolved) this round. */
  private caughtCount: number = 0;
  /** The words revealed in the assembling strip so far. */
  private assembled: string[] = [];
  /** True iff EVERY word this round has been caught cleanly (no pass / wrong). */
  private roundAllCaught: boolean = true;
  /** performance.now() after which the next round may load (post-resolve gap). */
  private nextSpawnTime: number = 0;
  /** Fires the round's once-per-round verdict exactly once. */
  private roundResolved: boolean = false;
  /** True while startRound() is awaiting content, so the loop can't double-load. */
  private loadingRound: boolean = false;
  /** Identity of the round (whole target translation) for the learning ABI. */
  private currentWord: WordIdentity | null = null;
  /** Monotonic counter so note ids are unique even within the same ms. */
  private noteSeq: number = 0;

  // ---- Streak-driven chart difficulty -------------------------------------
  /**
   * The "difficulty streak" — how many CHARTS in a row the player has caught
   * cleanly (every correct word, no decoy taps). It drives spacing compression
   * + the decoy ramp, and RESETS to 0 on any fail. Distinct from the scoring
   * combo (which is per-word): a single whiffed word resets both, but the
   * difficulty streak only climbs at the granularity of whole clean charts so
   * the ramp feels deliberate.
   */
  private chartStreak: number = 0;
  /** Tracks, within the current chart, whether the player has failed anything. */
  private chartClean: boolean = true;
  /**
   * Seconds between consecutive correct-word strum beats for the CURRENT chart,
   * chosen at layout time from the streak (relaxed -> natural-speech tempo).
   */
  private beatGap: number = 1.6;

  // Track lane activation for visuals.
  private lanePressTimes: number[] = [0, 0, 0];

  constructor(
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: { stackConfig?: StackConfig }
  ) {
    this.stackConfig = initialState?.stackConfig ?? hostApi.getStackConfig();

    this.canvas = document.createElement("canvas");
    container.appendChild(this.canvas);

    this.laneSystem = new LaneSystem(0, 0);
    this.renderer = new Renderer(this.canvas, this.laneSystem);
    this.contentManager = new ContentManager(hostApi);

    // Resolve languages now that the ContentManager (which owns the resolution
    // policy) exists; then subscribe to live stack-config changes.
    this.activeLanguage = this.resolveActiveLanguage(this.stackConfig);
    if (hostApi.onStackConfigChange) {
      this.offStackConfigChange = hostApi.onStackConfigChange((next) => {
        this.stackConfig = next;
        this.activeLanguage = this.resolveActiveLanguage(next);
        this.hud?.applyLanguage(this.activeLanguage);
      });
    }

    this.inputManager = new InputManager(container, this.canvas, (x) =>
      this.getLaneFromX(x)
    );
    this.inputManager.onInput((lane) => this.handleInput(lane));

    this.bus = createEventBus();
    this.progression = initProgression(this.bus, hostApi);
    this.audio = initAudioHaptics(this.bus);
    this.hud = new Hud(
      container,
      this.bus,
      {
        onStartGame: (mode) => this.startGame(mode),
        onShowMenu: () => this.showMenu(),
        // Result-linger tap-to-continue: advance immediately past the dwell.
        onContinue: () => this.continueFromResult(),
        // Pause sheet (issue #426): pause/resume the loop + audio together.
        onPause: () => this.pause("manual"),
        onResume: () => this.resume(),
        // Single mute control → flip the audio stream live (+ already persisted
        // by the Hud). Game is the only bus emitter, so it forwards the toggle.
        onSetMuted: (muted) => this.bus.emit("muteChange", { muted }),
      },
      this.progression
    );
    this.hud.applyLanguage(this.activeLanguage);
    this.effects = initEffects(
      this.canvas.getContext("2d")!,
      this.bus,
      this.laneSystem
    );

    this.handleResize(container);
    window.addEventListener("resize", () => this.handleResize(container));
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() =>
        this.handleResize(container)
      );
      this.resizeObserver.observe(container);
    }

    this.installVisibilityHandlers();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        this.fontsReady = true;
      });
    } else {
      this.fontsReady = true;
    }

    this.isRunning = true;
    requestAnimationFrame((t) => this.loop(t));
  }

  // -------------------------------------------------------------------------
  // BACKGROUNDING (anti-brick). The rAF loop pauses when the tab is hidden but
  // WebAudio keeps running; on return the game would be desynced (notes stop,
  // strip half-filled, chart dead). We listen on the Page Visibility API plus
  // window blur / pagehide and PAUSE the loop + audio on hidden, then RESUME
  // cleanly on visible — rebasing the delta-time + chart-time baseline so the
  // chart picks up exactly where it paused (nothing teleports).
  // -------------------------------------------------------------------------
  private installVisibilityHandlers() {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.hidden) this.pause("hidden");
      else this.resume();
    };
    const onBlur = () => this.pause("blur");
    const onFocus = () => this.resume();
    const onPageHide = () => this.pause("pagehide");
    const onPageShow = () => this.resume();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    this.visibilityHandlers.push(
      () => document.removeEventListener("visibilitychange", onVisibility),
      () => window.removeEventListener("blur", onBlur),
      () => window.removeEventListener("focus", onFocus),
      () => window.removeEventListener("pagehide", onPageHide),
      () => window.removeEventListener("pageshow", onPageShow)
    );
  }

  /** Pause the game loop + audio. Idempotent. */
  pause(reason: "hidden" | "blur" | "pagehide" | "manual" = "manual") {
    if (this.paused) return;
    this.paused = true;
    this.pausedAt = performance.now();
    this.bus.emit("gamePaused", { reason });
  }

  /**
   * Resume after a pause. CRITICAL: rebase every timing baseline so nothing
   * teleports. The chart is timed off performance.now() via each note's
   * strumTime; while paused real time advanced but the chart should not have, so
   * we shift every live note's strumTime forward by the paused duration. We also
   * push the linger auto-advance deadline forward and reset the delta-time
   * baseline so the first post-resume frame has dt≈0.
   */
  resume() {
    if (!this.paused) return;
    this.paused = false;
    const now = performance.now();
    const pausedMs = Math.max(0, now - this.pausedAt);

    // Shift the whole chart timeline forward by the time we were paused so each
    // note resumes from exactly where it was (no teleport / no missed backlog).
    for (const note of this.notes) {
      if (typeof note.strumTime === "number") note.strumTime += pausedMs;
    }
    // Keep the post-resolve gap + linger auto-advance honest across the pause.
    if (this.nextSpawnTime > 0) this.nextSpawnTime += pausedMs;

    // Reset the delta-time baseline so the loop's first frame doesn't integrate
    // the whole paused gap (the legacy non-strum fall path would teleport).
    this.lastTimestamp = 0;

    this.bus.emit("gameResumed", { pausedMs });
  }

  /**
   * Resolve the INITIAL active TARGET (learning) language + the player's primary
   * (known/UI) language from the host stack, for HUD/RTL setup before the first
   * round loads. `code` is the TARGET language — the one whose words fall and get
   * spoken. With a ≥2-language stack the TARGET actually ROTATES per round
   * (chosen in ContentManager.getRound); `startRound` re-syncs `activeLanguage`
   * to the round's real target each round. With a 1-language stack this resolves
   * to READING mode (target === primary). This method only seeds sane defaults.
   */
  private resolveActiveLanguage(cfg: StackConfig): ActiveLanguage {
    const { primary, target } = this.contentManager.resolveLanguages(
      cfg.languages ?? []
    );
    return {
      code: target,
      primary,
      isRTL: RTL_LANGS.has(target),
      rate: typeof cfg.rate === "number" ? cfg.rate : 1,
      textSize: cfg.textSize ?? "medium",
      showRomanization: cfg.showRomanization ?? false,
    };
  }

  getActiveLanguage(): ActiveLanguage {
    return this.activeLanguage;
  }

  /**
   * Test/diagnostic introspection for the iOS audio-unlock wiring (issue #428).
   * The e2e harness asserts the AudioContext is NOT running before any gesture
   * and flips to "running" after a simulated tap — proving the unlock wiring
   * fires on a gesture (real iOS audio OUTPUT cannot be verified headlessly).
   */
  audioContextState(): AudioContextState | null {
    return this.audio.contextState();
  }

  /** True once a user gesture has unlocked the AudioContext (issue #428). */
  audioUnlocked(): boolean {
    return this.audio.isUnlocked();
  }

  private getLaneFromX(x: number): LaneIndex | null {
    return this.laneSystem.laneAtX(x);
  }

  private handleResize(container: HTMLElement) {
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    const ctx = this.canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);

    this.laneSystem.resize(width, height);
    this.speed = (height * this.laneSystem.getStrumRatio() + 100) / this.NOTE_TRAVEL_SECONDS;

    // Re-fit the prompt to the new viewport so a long phrase stays fully visible
    // after rotation / resize (issue #426). Hud may not exist yet on the very
    // first constructor-time resize; guard for that.
    this.hud?.onResize();

    // The lane now runs FULL HEIGHT to the very top edge: notes spawn at the top
    // and are seen THROUGH the translucent header as they enter (the header is a
    // transparent overlay, not a reserved band). So the play-area top is 0 — no
    // HUD-band reservation, no clip. The header text stays readable above the
    // notes and never blocks taps on the lanes behind it (pointer-events:none).
    this.laneSystem.setPlayTop(0);
  }

  private showMenu() {
    this.state = GameState.MENU;
    this.bus.emit("menuShown", { lastScore: this.score });
  }

  private async startGame(mode: GameMode) {
    // Prime TTS on the user gesture (important for mobile web).
    this.contentManager.speak(" ", this.activeLanguage.primary, this.activeLanguage.rate);

    this.state = GameState.PLAYING;
    this.mode = mode;
    this.score = 0;
    this.combo = 0;
    this.decoyDodges = 0;
    this.notes = [];
    this.round = null;
    this.roundWords = [];
    this.caughtCount = 0;
    this.assembled = [];
    this.nextSpawnTime = 0;
    this.chartStreak = 0;
    this.chartClean = true;
    this.lingering = false;
    this.clearContinueTap();

    this.bus.emit("gameStart", { mode, language: this.activeLanguage });
    this.bus.emit("scoreChange", { value: 0, delta: 0 });
    this.bus.emit("comboChange", { value: 0, previous: 0 });

    try {
      await this.startRound();
    } catch (e) {
      console.error("Failed initial round", e);
    }
  }

  gameOver() {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.GAME_OVER;
    this.bus.emit("gameOver", { finalScore: this.score, mode: this.mode });
  }

  /**
   * Clean a phrase for DISPLAY at the prompt. Strips parenthetical glosses and,
   * for long comma-listed glosses, keeps the first sense. The TARGET words are
   * NOT cleaned this way (they fall verbatim so the assembled translation is
   * faithful), only the primary-language prompt label.
   */
  private cleanPrompt(text: string): string {
    let clean = text.replace(/\s*\(.*?\)\s*/g, "").trim();
    if (clean.length > 28 && clean.includes(",")) {
      clean = clean.split(",")[0].trim();
    }
    if (clean.length > 0 && /^[a-z]/.test(clean)) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return clean;
  }

  // -------------------------------------------------------------------------
  // ROUND lifecycle: load a phrase, then lay out the WHOLE translation as a
  // time-spaced falling CHART (true Guitar-Hero timing). Difficulty (spacing +
  // decoys) is chosen from the streak at layout time and reset on any fail.
  // -------------------------------------------------------------------------

  /** Load a fresh round from content + reset per-round state, then build the chart. */
  private async startRound() {
    // Guard against the loop firing a second load while the first is in flight.
    if (this.loadingRound) return;
    this.loadingRound = true;
    let round: Round;
    try {
      round = await this.contentManager.getRound(this.stackConfig.languages ?? []);
      // Guard: a round must have at least one target word — retry once.
      if (!round.targetWords.length) {
        round = await this.contentManager.getRound(
          this.stackConfig.languages ?? []
        );
      }
    } catch (e) {
      console.error("Failed to load round", e);
      this.loadingRound = false;
      return;
    }
    this.loadingRound = false;
    if (!round.targetWords.length) return;

    this.round = round;
    this.roundWords = round.targetWords;
    this.caughtCount = 0;
    this.assembled = [];
    this.roundResolved = false;
    this.roundAllCaught = true;
    this.chartClean = true;

    // Re-sync the active TARGET language to THIS round's actual target. In a
    // ≥2-language stack the target rotates randomly per round (issue #407), so
    // the language whose words fall + get spoken must follow the round, not the
    // one-time mount-time resolution. RTL + the HUD direction follow too. (In
    // reading mode round.targetLang === primary, so this is a no-op.)
    if (round.targetLang && round.targetLang !== this.activeLanguage.code) {
      this.activeLanguage = {
        ...this.activeLanguage,
        code: round.targetLang,
        isRTL: RTL_LANGS.has(round.targetLang),
      };
      this.hud.applyLanguage(this.activeLanguage);
    }

    this.currentWord = {
      entryId: round.entryId,
      foreign: round.targetText,
      english: this.cleanPrompt(round.promptText),
      romanization: round.romanization,
      lang: round.targetLang,
    };

    this.hud.setQuestion(this.cleanPrompt(round.promptText));
    this.hud.setRomanization(round.romanization ?? "");
    this.hud.setAssembled([], this.roundWords.length, this.activeLanguage.isRTL);

    this.buildChart();
  }

  /**
   * Inter-word beat spacing (seconds between consecutive CORRECT strum beats)
   * for the given difficulty streak. Streak 0 is relaxed/generous; it compresses
   * toward a natural-speech tempo floor as the streak climbs.
   */
  private beatGapForStreak(streak: number): number {
    const RELAXED = 1.7; // generous gap at streak 0
    const TIGHT = 0.85; // natural-speech-ish floor
    // Reach the floor by ~streak 6; smooth ramp in between.
    const t = Math.min(1, streak / 6);
    return RELAXED + (TIGHT - RELAXED) * t;
  }

  /**
   * Number of DECOYS to interleave across the whole chart for the given streak:
   *   streak 0    → 0 (only the correct words fall, in order — relaxed start)
   *   streak 1..2 → 1 decoy in the sentence
   *   streak >= 3 → 2 decoys in the sentence
   * Capped by the available decoy pool.
   */
  private decoyCountForStreak(streak: number): number {
    const pool = this.round?.distractorWords.length ?? 0;
    if (pool === 0 || streak <= 0) return 0;
    const want = streak >= 3 ? 2 : 1;
    return Math.min(want, pool);
  }

  /**
   * Lay out the ENTIRE target translation as a falling chart: each correct word
   * is a note whose strum beat is `beatGap` after the previous one, in order.
   * Decoys (per the streak ramp) are inserted at the midpoints BETWEEN correct
   * beats, placed in a lane OTHER than the surrounding correct words so they
   * read as dodge-me foils interleaved with the sequence. Notes derive their y
   * each frame from (strumTime - now), so the whole chart is timed up front.
   */
  private buildChart() {
    if (!this.round) return;
    const words = this.roundWords;
    if (!words.length) return;

    // Choose difficulty for THIS chart from the streak (reset on prior fail).
    this.beatGap = this.beatGapForStreak(this.chartStreak);
    const decoys = this.decoyCountForStreak(this.chartStreak);

    const now = performance.now();
    // Lead-in so the first word doesn't strum the instant the chart loads — give
    // the player the full travel time plus a small beat to read the prompt.
    const leadIn = now + this.NOTE_TRAVEL_SECONDS * 1000 + 450;
    const gapMs = this.beatGap * 1000;

    // Correct-word lanes: vary lane per word so the chart weaves across all
    // three lanes (avoid a static single-lane column), never repeating the
    // immediately previous lane.
    const correctLanes: LaneIndex[] = [];
    let prevLane = -1;
    for (let i = 0; i < words.length; i++) {
      let lane = Math.floor(Math.random() * 3);
      if (lane === prevLane) lane = (lane + 1) % 3;
      correctLanes.push(lane as LaneIndex);
      prevLane = lane;
    }

    const notes: Note[] = [];
    for (let i = 0; i < words.length; i++) {
      const strumTime = leadIn + i * gapMs;
      notes.push(
        this.makeNote(words[i], correctLanes[i], true, i, strumTime)
      );
    }

    // Interleave decoys: pick distinct gaps between correct beats, drop a foil
    // at the midpoint of each chosen gap, in a lane different from BOTH adjacent
    // correct words so it never collides with the catchable sequence.
    if (decoys > 0 && words.length >= 2) {
      const pool = [...this.round.distractorWords].sort(
        () => Math.random() - 0.5
      );
      const gapIdx = Array.from({ length: words.length - 1 }, (_, k) => k).sort(
        () => Math.random() - 0.5
      );
      const slots = Math.min(decoys, gapIdx.length, pool.length);
      for (let s = 0; s < slots; s++) {
        const g = gapIdx[s];
        const word = pool[s];
        if (!word) continue;
        const strumTime = leadIn + (g + 0.5) * gapMs;
        const taken = new Set([correctLanes[g], correctLanes[g + 1]]);
        let lane = 0;
        while (taken.has(lane as LaneIndex) && lane < 2) lane++;
        notes.push(this.makeNote(word, lane as LaneIndex, false, -1, strumTime));
      }
    }

    this.notes.push(...notes);
  }

  /** Build a single chart note seeded above the screen; physics drives its y. */
  private makeNote(
    text: string,
    lane: LaneIndex,
    isTarget: boolean,
    seqIndex: number,
    strumTime: number
  ): Note {
    return {
      id: `note-${Date.now()}-${this.noteSeq++}-${isTarget ? "t" : "d"}`,
      lane,
      y: -160,
      text,
      isTarget,
      seqIndex,
      hit: false,
      missed: false,
      spawnTime: Date.now(),
      strumTime,
    };
  }

  private setScore(value: number) {
    const v = Math.max(0, Math.round(value));
    const delta = v - this.score;
    this.score = v;
    if (delta !== 0) this.bus.emit("scoreChange", { value: v, delta });
  }

  private setCombo(value: number) {
    const previous = this.combo;
    if (value === previous) return;
    this.combo = value;
    this.bus.emit("comboChange", { value, previous });
  }

  /**
   * Advance the catch sequence by exactly one correct word: reveal it in the
   * assembling strip and bump caughtCount. `caught` true = the player caught it
   * (score/combo handled by the caller); false = the correct word sailed past
   * (we still reveal it so the assembled phrase stays coherent and teaching
   * continues). When the last correct word is consumed, resolves the round.
   *
   * Unlike the old one-at-a-time model this NEVER spawns — the whole chart is
   * already in flight (buildChart). advanceStep only tracks SEQUENCE progress.
   */
  private advanceStep(caught: boolean) {
    if (!this.round) return;
    // The sequence is already complete — never advance past the last word, so
    // caughtCount can't overshoot roundWords.length or corrupt the assembling
    // strip.
    if (this.caughtCount >= this.roundWords.length) return;

    const idx = this.caughtCount;
    this.assembled.push(this.roundWords[idx]);
    this.hud.setAssembled(
      this.assembled,
      this.roundWords.length,
      this.activeLanguage.isRTL
    );
    this.caughtCount = Math.min(this.caughtCount + 1, this.roundWords.length);

    if (this.caughtCount >= this.roundWords.length) {
      // Sequence complete — resolve the round and enter the result LINGER.
      this.resolveRound(this.roundAllCaught ? "correct" : "wrong");
      // STREAK: a fully-clean chart bumps the difficulty streak (tighter +
      // more decoys next time); any fail this chart resets it to relaxed.
      this.chartStreak = this.chartClean ? this.chartStreak + 1 : 0;
      this.enterResultLinger();
      void caught;
    }
  }

  /**
   * Phrase complete → HOLD the result so the player can read the full assembled
   * target phrase + its meaning and let it sink in (a key learning beat). Fires
   * the celebration burst (scaled by performance) and arms a tap-to-continue
   * that also auto-advances after the dwell. The next round only loads once the
   * linger ends (loop gates on `lingering`).
   */
  private enterResultLinger() {
    this.lingering = true;

    // Celebrate: bigger for a clean, high-combo phrase. The effects stream
    // turns this into fireworks scaled by combo + clean-ness.
    this.bus.emit("result-celebrate", {
      clean: this.roundAllCaught && this.chartClean,
      combo: this.combo,
      wordCount: this.roundWords.length,
    });

    // Rotate music + pick up pace at the transition.
    const snap = this.progression.getSnapshot?.();
    this.bus.emit("roundAdvance", {
      level: snap?.level ?? 1,
      streak: this.chartStreak,
    });

    // Dwell: long enough to READ the result. Scale a little with phrase length
    // (more words = more to read) and clamp to a sane window. A clean phrase
    // lands a touch longer so the celebration breathes.
    const base = 2600;
    const perWord = 220;
    const bonus = this.roundAllCaught ? 600 : 0;
    const dwell = Math.min(5200, base + this.roundWords.length * perWord + bonus);
    this.nextSpawnTime = performance.now() + dwell;

    // Tell the Hud to HOLD the result card for the dwell + show tap-to-continue.
    this.hud.holdResult(dwell);

    // Arm a tap-to-continue anywhere: advances immediately past the dwell. We
    // listen on the document (capture) so a tap on the canvas/lanes also works,
    // but ignore the very first frame so the completing catch's own tap doesn't
    // instantly skip the linger.
    this.clearContinueTap();
    const armedAt = performance.now();
    const onTap = () => {
      if (performance.now() - armedAt < 220) return; // debounce the catch tap
      this.continueFromResult();
    };
    const opts = { capture: true } as AddEventListenerOptions;
    window.addEventListener("pointerdown", onTap, opts);
    window.addEventListener("keydown", onTap, opts);
    this.offContinueTap = () => {
      window.removeEventListener("pointerdown", onTap, opts);
      window.removeEventListener("keydown", onTap, opts);
    };
  }

  /** Advance past the result linger NOW (tap-to-continue or dwell elapsed). */
  private continueFromResult() {
    if (!this.lingering) return;
    this.lingering = false;
    this.clearContinueTap();
    this.hud.hideFeedback();
    // Let the loop load the next round on its next tick (board may still be
    // clearing); make the gap immediate now that the player has read it.
    this.nextSpawnTime = performance.now();
  }

  /** Detach the tap-to-continue listener if armed. */
  private clearContinueTap() {
    this.offContinueTap?.();
    this.offContinueTap = undefined;
  }

  /**
   * NO-BRICK fallback: the chart is exhausted (all notes hit/passed/gone) but
   * the phrase never resolved. Reveal any words still missing from the
   * assembling strip (so the learning phrase stays complete), mark the chart
   * failed, and resolve + linger exactly like a normal completion — so the
   * round always ends and the next one can load. Idempotent via roundResolved.
   */
  private resolveExhaustedChart() {
    if (this.roundResolved) return;
    // Fill in any remaining words so the assembled phrase + result card are
    // complete and coherent (the player still gets the teaching).
    while (this.caughtCount < this.roundWords.length) {
      this.assembled.push(this.roundWords[this.caughtCount]);
      this.caughtCount++;
    }
    this.hud.setAssembled(
      this.assembled,
      this.roundWords.length,
      this.activeLanguage.isRTL
    );
    this.failChart();
    this.resolveRound("passed");
    this.chartStreak = 0; // a chart that ran out unresolved resets the ramp
    this.enterResultLinger();
  }

  /** Record a fail this chart: resets the difficulty streak for the next chart. */
  private failChart() {
    this.chartClean = false;
    this.roundAllCaught = false;
  }

  /**
   * Emit the single authoritative "wave-resolved" event for the round (the Hud
   * shows the meaning-reveal card off this; the learning stream records the
   * outcome). Fires at most once per round.
   */
  private resolveRound(outcome: "correct" | "wrong" | "passed") {
    if (this.roundResolved || !this.currentWord) return;
    this.roundResolved = true;
    this.bus.emit("wave-resolved", {
      word: this.currentWord,
      outcome,
      correct: outcome === "correct",
      combo: this.combo,
      mode: this.mode,
    });
  }

  private handleInput(lane: LaneIndex) {
    this.lanePressTimes[lane] = performance.now();
    // Any lane interaction briefly resurfaces the auto-faded top-left chrome
    // (pause/mute) so the player always has a reliable way to reach the exit.
    this.hud?.notifyInteraction();
    if (this.state !== GameState.PLAYING) return;
    // While backgrounded-paused or holding the result linger, lane taps don't
    // play (a tap during the linger is consumed by tap-to-continue instead).
    if (this.paused || this.lingering) return;

    const hitNote = this.laneSystem.checkHit(lane, this.notes);
    const strumY = this.laneSystem.getStrumLineY();
    const laneX = this.laneSystem.getLaneX(lane);

    const word: WordIdentity = this.currentWord ?? {
      entryId: -1,
      foreign: this.round?.targetText ?? "",
      english: "",
      lang: this.activeLanguage.code,
    };

    if (hitNote && hitNote.isTarget && hitNote.seqIndex === this.caughtCount) {
      // CAUGHT the correct NEXT word in the sequence.
      hitNote.hit = true;
      hitNote.hitTime = performance.now();
      const points = 100 + this.combo * 10;
      this.setScore(this.score + points);
      this.setCombo(this.combo + 1);

      // SPEAK the caught TARGET word so the player hears its pronunciation.
      this.contentManager.speak(
        hitNote.text,
        this.activeLanguage.code,
        this.activeLanguage.rate
      );

      this.bus.emit("noteHit", {
        lane,
        x: laneX,
        y: strumY,
        combo: this.combo,
        points,
        mode: this.mode,
        word,
      });

      this.advanceStep(true);
    } else if (hitNote && !hitNote.isTarget) {
      // Caught a DECOY — miss/penalty, combo breaks + difficulty streak resets.
      // The correct words keep falling; the player can still catch them.
      hitNote.hit = true;
      this.failChart();
      this.setCombo(0);
      this.setScore(this.score - 40);
      this.bus.emit("noteMiss", {
        lane,
        x: laneX,
        y: strumY,
        reason: "wrong",
        mode: this.mode,
        word,
      });
    } else {
      // Empty lane tap (or a tap that grabbed a not-yet-due correct note — we
      // ignore those so the player isn't punished for tapping early on a future
      // word). Only a *genuine* whiffed catch breaks the combo: the NEXT correct
      // word must be live (un-hit, un-missed) for the tap to count as a real
      // gameplay error. Taps during dead air are a no-op.
      const liveNext = this.notes.some(
        (n) => n.isTarget && n.seqIndex === this.caughtCount && !n.hit && !n.missed
      );
      if (!liveNext) return;
      this.failChart();
      this.setCombo(0);
      this.bus.emit("noteMiss", {
        lane,
        x: laneX,
        y: strumY,
        reason: "wrong",
        mode: this.mode,
        word,
      });
    }
  }

  /**
   * REWARD a correctly-dodged DECOY (issue #429): the player let a distractor
   * card sail past the strum line un-caught — the right play. We award points
   * (scaled BELOW a correct catch so dodging can never out-score catching the
   * real words), KEEP and gently boost the combo (a clean dodge sustains the
   * streak rather than just not breaking it), and fire a small celebration via
   * the bus (effects burst + a positive SFX). A dodge does NOT mark the chart
   * unclean — avoiding a foil is correct, so the difficulty streak keeps
   * climbing. Only ever called for a genuine decoy note (isTarget === false).
   */
  private rewardDecoyDodge(lane: LaneIndex) {
    if (this.state !== GameState.PLAYING) return;
    this.decoyDodges++;
    // Points: a catch is 100 + combo*10; a dodge is deliberately smaller so a
    // run of dodges can't beat actually catching the translation.
    const points = 40 + this.combo * 4;
    this.setScore(this.score + points);
    // A clean dodge sustains/boosts the streak (combo +1) — it should FEEL like
    // a win, not merely a non-loss — but never breaks it.
    this.setCombo(this.combo + 1);

    const x = this.laneSystem.getLaneX(lane);
    const y = this.laneSystem.getStrumLineY();
    this.bus.emit("decoy-dodged", {
      lane,
      x,
      y,
      combo: this.combo,
      points,
      mode: this.mode,
    });
  }

  private loop(timestamp: number) {
    if (!this.isRunning) return;

    // PAUSED (backgrounded): freeze the simulation entirely. We keep requesting
    // frames + re-rendering the last frame so the resume is instant and the
    // canvas doesn't go black, but advance NOTHING — physics, round cadence, and
    // time baselines are all held. resume() rebases lastTimestamp + the chart so
    // nothing teleports. This is the anti-brick guarantee paired with the audio
    // suspend: the loop and the audio are frozen together.
    if (this.paused) {
      if (this.fontsReady) {
        this.renderer.clear();
        this.renderer.drawLanes([]);
        this.renderer.drawNotes(this.notes);
      }
      requestAnimationFrame((t) => this.loop(t));
      return;
    }

    const dt = this.lastTimestamp
      ? Math.min(0.05, (timestamp - this.lastTimestamp) / 1000)
      : 0;
    this.lastTimestamp = timestamp;

    if (this.state === GameState.PLAYING) {
      // 0. RESULT LINGER auto-advance — the result card is HELD for the dwell so
      //    the player can read it. When the dwell elapses we end the linger
      //    (same path as a tap-to-continue), so the next phrase loads. This is
      //    what makes the linger a DWELL, not a permanent stop.
      if (this.lingering && timestamp > this.nextSpawnTime) {
        this.continueFromResult();
      }

      // 1. ROUND CADENCE — the whole chart is laid out by buildChart(); the loop
      //    only gates loading the NEXT round after the current one resolves +
      //    clears. No per-word spawning. While the result LINGER is held we do
      //    NOT load the next round (the player is reading the result card).
      if (!this.round) {
        // No active round (post-resolve gap): start the next one when due.
        if (!this.lingering && timestamp > this.nextSpawnTime) {
          this.startRound();
        }
      } else if (
        this.roundResolved &&
        this.notes.every((n) => n.hit || n.missed)
      ) {
        // Round resolved + board cleared: queue the next round once the linger
        // dwell has elapsed (or the player tapped to continue, which sets
        // nextSpawnTime to now and clears `lingering`).
        if (!this.lingering && timestamp > this.nextSpawnTime) {
          this.round = null;
          this.startRound();
        }
      } else if (!this.roundResolved && this.round) {
        // NO-BRICK WATCHDOG — if the chart is EXHAUSTED (every note has been hit
        // or has passed/missed) but the phrase never resolved, force-resolve so
        // the player is never left stuck with empty lanes + a half-filled strip
        // + no result. This catches any edge the per-note pass-line advance
        // might miss (e.g. a note removed before its pass-line frame fired).
        const exhausted =
          this.notes.length === 0 || this.notes.every((n) => n.hit || n.missed);
        if (exhausted) this.resolveExhaustedChart();
      }

      // 2. PHYSICS — delta-timed falling motion (the hero). Chart notes derive
      //    their y from their strum BEAT: y = strumY - (strumTime - now)*speed,
      //    so the whole phrase falls on its pre-laid timeline. Notes without a
      //    strumTime (legacy/defensive) fall by the old delta integration.
      const now = performance.now();
      const boundsHeight = this.canvas.clientHeight;
      const strumY = this.laneSystem.getStrumLineY();
      const passLine = strumY + this.laneSystem.getNoteRadius() * 2.2;

      this.notes.forEach((note) => {
        if (note.hit) return;
        if (typeof note.strumTime === "number") {
          note.y = strumY - ((note.strumTime - now) / 1000) * this.speed;
        } else {
          note.y += this.speed * dt;
        }

        // Handle the strum pass-line FIRST (catch / dodge / miss verdicts), then
        // fall through to the off-screen retire. Ordering matters: if a fast
        // frame jumped the note past both lines at once, the bottom-bounds retire
        // must not pre-empt the dodge reward / miss for a note crossing the strum.
        if (note.y > passLine && !note.hit && !note.missed) {
          if (note.isTarget && note.seqIndex === this.caughtCount) {
            // The NEXT correct word sailed past the strum unhit → a miss. Combo
            // breaks + difficulty streak resets, same penalty as catching a
            // decoy (symmetric miss). We reveal the word anyway (assembling
            // strip) and advance so the phrase stays coherent and the player
            // keeps learning.
            note.missed = true;
            this.failChart();
            this.setCombo(0);
            this.setScore(this.score - 40);
            this.bus.emit("noteMiss", {
              lane: note.lane,
              x: this.laneSystem.getLaneX(note.lane),
              y: strumY,
              reason: "passed",
              mode: this.mode,
              word:
                this.currentWord ?? {
                  entryId: -1,
                  foreign: this.round?.targetText ?? "",
                  english: note.text,
                  lang: this.activeLanguage.code,
                },
            });
            this.advanceStep(false);
          } else if (!note.isTarget) {
            // DECOY DODGED (issue #429): a distractor card crossed the strum
            // line UN-caught — exactly the right play. Reward it: points, a
            // combo boost, and a small celebration (juice). Distinct from a
            // missed correct word (handled above, still a miss) and from a
            // consumed/out-of-sequence target (retired silently below).
            note.missed = true;
            this.rewardDecoyDodge(note.lane);
          } else {
            // An already-consumed / out-of-sequence TARGET note falling past the
            // line is simply retired — no penalty and no reward (it was already
            // caught earlier in the sequence, or is a future word the player has
            // not reached). Only a genuine decoy earns the dodge reward.
            note.missed = true;
          }
        }

        // Off-screen retire fallback: anything that somehow fell well past the
        // bottom edge without being resolved above is marked missed so it can be
        // filtered out (defensive; the pass-line handling above is the norm).
        if (note.y > boundsHeight + 120 && !note.hit) note.missed = true;
      });

      this.notes = this.notes.filter(
        (n) => !(n.missed && n.y > strumY) && !(n.hit && n.y > boundsHeight)
      );
    }

    if (this.fontsReady) {
      this.renderer.clear();

      const now = performance.now();
      const activeLanes: number[] = [];
      this.lanePressTimes.forEach((t, i) => {
        if (now - t < 150) activeLanes.push(i);
      });

      this.renderer.drawLanes(activeLanes);
      this.renderer.drawNotes(this.notes);

      this.effects.render?.(now);
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  dispose() {
    this.isRunning = false;
    this.offStackConfigChange?.();
    this.resizeObserver?.disconnect();
    for (const off of this.visibilityHandlers) off();
    this.visibilityHandlers = [];
    this.clearContinueTap();
    this.inputManager.dispose();
    this.effects.dispose();
    this.audio.dispose();
    this.progression.dispose();
    this.hud.dispose();
    this.bus.clear();
    this.canvas.remove();
  }
}
