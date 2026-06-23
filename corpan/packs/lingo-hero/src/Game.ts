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
 * stack.languages[0], also the UI language). Its translation in the TARGET
 * (learning) language falls down the three lanes WORD BY WORD, IN ORDER. The
 * player catches each correct next word as it crosses the strum line; on catch
 * the target word is SPOKEN (so they hear the pronunciation) and revealed in an
 * assembling target-phrase strip. Reconstructing + hearing the translation,
 * prompted by the known phrase, IS the learning.
 *
 * Difficulty ramps with the combo: at first ONLY correct words fall (pure
 * rhythm catch); as the player heats up, DISTRACTOR target words fall in the
 * OTHER lanes and must be dodged.
 *
 * COHERENCE CONTRACT: at any instant exactly ONE catchable card carries the
 * next correct token of the target translation. Catching it advances the
 * sequence; tapping a distractor or letting the correct word pass is a miss.
 *
 * This file keeps the proven engine intact — delta-timed falling motion,
 * canvas-relative input (InputManager), forgiving hit detection (LaneSystem),
 * the typed event bus, and the effects/audio/hud/progression streams. Only the
 * CONTENT MODEL (phrase → ordered words), spawn cadence, catch-in-sequence
 * input, and the assembling strip are new.
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
  // Seconds a word takes to fall from spawn to the strum line. Higher = slower
  // & easier — THE primary playability knob, delta-timed so it is frame-rate
  // independent on high-refresh phones.
  private readonly NOTE_TRAVEL_SECONDS = 6;
  private speed: number = 200;
  private lastTimestamp: number = 0;

  private isRunning: boolean = false;
  private fontsReady: boolean = false;

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
  /** True while a correct-word card for the current step is in flight. */
  private stepActive: boolean = false;
  /** True iff EVERY word this round has been caught cleanly (no pass / wrong). */
  private roundAllCaught: boolean = true;
  /** performance.now() after which the next round/step may spawn. */
  private nextSpawnTime: number = 0;
  /** Fires the round's once-per-round verdict exactly once. */
  private roundResolved: boolean = false;
  /** True while startRound() is awaiting content, so the loop can't double-load. */
  private loadingRound: boolean = false;
  /** Identity of the round (whole target translation) for the learning ABI. */
  private currentWord: WordIdentity | null = null;
  /** Monotonic counter so note ids are unique even within the same ms. */
  private noteSeq: number = 0;

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
        onReplayPrompt: () => this.replayPrompt(),
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

  /**
   * Resolve the resolved active TARGET (learning) language + the player's
   * primary (known/UI) language from the host stack. primary = languages[0];
   * target = the first non-primary language (with the single-language
   * fallbacks the ContentManager uses). `code` is the TARGET language — the one
   * whose words fall and get spoken.
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
   * Re-speak the CURRENT prompt. "Hear again" = tap the prompt (the Hud wires
   * the prompt box to this). We speak the TARGET translation (the thing being
   * learned), not the primary phrase the player already knows. No-op between
   * rounds. Speaks RAW text per the TTS contract.
   */
  replayPrompt(): void {
    if (!this.round || !this.round.targetText) return;
    this.contentManager.speak(
      this.round.targetText,
      this.round.targetLang,
      this.activeLanguage.rate
    );
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
    this.speed = (height * 0.8 + 100) / this.NOTE_TRAVEL_SECONDS;
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
    this.notes = [];
    this.round = null;
    this.roundWords = [];
    this.caughtCount = 0;
    this.assembled = [];
    this.stepActive = false;
    this.nextSpawnTime = 0;

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
  // ROUND lifecycle: load a phrase, then spawn its words one step at a time.
  // -------------------------------------------------------------------------

  /** Load a fresh round from content + reset per-round state, then spawn step 0. */
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
    this.stepActive = false;
    this.roundResolved = false;
    this.roundAllCaught = true;

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

    this.spawnStep();
  }

  /**
   * Number of DISTRACTOR cards to put in the OTHER lanes for the current step.
   * Difficulty ramp tied to the combo (gentle, gradual):
   *   combo < 3   → 0 (Level 1: only the correct word falls — pure rhythm)
   *   combo 3..6  → 1 distractor (probabilistically, easing in)
   *   combo >= 7  → up to 2 distractors (dodge to catch the right one)
   * Never exceeds the 2 free lanes, and never exceeds the available pool.
   */
  private distractorCountForStep(): number {
    const pool = this.round?.distractorWords.length ?? 0;
    if (pool === 0) return 0;
    const c = this.combo;
    if (c < 3) return 0;
    if (c < 7) {
      // Ease in: ~60% chance of a single distractor in this band.
      return Math.random() < 0.6 ? Math.min(1, pool) : 0;
    }
    // Hot: usually 1, sometimes 2 (fill both free lanes).
    const want = Math.random() < 0.45 ? 2 : 1;
    return Math.min(want, 2, pool);
  }

  /**
   * Spawn the next correct word (the catchable target) + 0..2 distractors in
   * the OTHER lanes per the difficulty ramp. Exactly one catchable target card
   * is in flight at a time (coherence contract).
   */
  private spawnStep() {
    if (!this.round) return;
    if (this.caughtCount >= this.roundWords.length) return;

    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5) as LaneIndex[];
    const targetLane = lanes[0];
    const seqIndex = this.caughtCount;
    const targetWord = this.roundWords[seqIndex];

    const targetNote: Note = {
      id: `note-${Date.now()}-${this.noteSeq++}-t`,
      lane: targetLane,
      y: -120,
      text: targetWord,
      isTarget: true,
      seqIndex,
      hit: false,
      missed: false,
      spawnTime: Date.now(),
    };

    const notes: Note[] = [targetNote];

    // Distractors: real target-language words NOT in this sequence, in the
    // OTHER lanes. Drawn fresh each step so the foils vary.
    const dCount = this.distractorCountForStep();
    if (dCount > 0 && this.round.distractorWords.length) {
      const pool = [...this.round.distractorWords].sort(
        () => Math.random() - 0.5
      );
      for (let i = 0; i < dCount && i < lanes.length - 1; i++) {
        const w = pool[i % pool.length];
        if (!w) continue;
        notes.push({
          id: `note-${Date.now()}-${this.noteSeq++}-d${i}`,
          lane: lanes[i + 1],
          y: -120,
          text: w,
          isTarget: false,
          seqIndex: -1,
          hit: false,
          missed: false,
          spawnTime: Date.now(),
        });
      }
    }

    this.notes.push(...notes);
    this.stepActive = true;
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
   * Reveal the next word in the assembling target strip + advance the step.
   * `caught` true = the player caught it (score/combo handled by the caller);
   * false = it passed or the player missed it (we still reveal it so the phrase
   * stays coherent and teaching continues). Spawns the next step or, when the
   * sequence is complete, resolves the round.
   */
  private advanceStep(caught: boolean) {
    if (!this.round) return;
    // The sequence is already complete — never advance past the last word.
    // (Step cadence makes this single-call-per-step in practice, but guard the
    // invariant so caughtCount can't overshoot roundWords.length and corrupt
    // the assembling strip / spawn state.) (adversarial-review, PR #390)
    if (this.caughtCount >= this.roundWords.length) {
      this.stepActive = false;
      return;
    }
    const idx = this.caughtCount;
    this.assembled.push(this.roundWords[idx]);
    this.hud.setAssembled(
      this.assembled,
      this.roundWords.length,
      this.activeLanguage.isRTL
    );
    this.caughtCount += 1;
    this.stepActive = false;

    if (this.caughtCount >= this.roundWords.length) {
      // Sequence complete — resolve the round and queue the next one.
      this.resolveRound(this.roundAllCaught ? "correct" : "wrong");
      this.nextSpawnTime = performance.now() + 1100;
      void caught;
    } else {
      // Brief beat between words so the catch reads as deliberate, not a stream.
      this.nextSpawnTime = performance.now() + 320;
    }
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
    if (this.state !== GameState.PLAYING) return;

    const hitNote = this.laneSystem.checkHit(lane, this.notes);
    const strumY = this.laneSystem.getStrumLineY();
    const laneX = this.laneSystem.getLaneX(lane);

    const word: WordIdentity = this.currentWord ?? {
      entryId: -1,
      foreign: this.round?.targetText ?? "",
      english: "",
      lang: this.activeLanguage.code,
    };

    if (hitNote && hitNote.isTarget) {
      // CAUGHT the correct next word.
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
      // Tapped a DISTRACTOR — miss/penalty, combo breaks. The correct word
      // keeps falling; the player can still catch it.
      hitNote.hit = true;
      this.roundAllCaught = false;
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
      // Empty lane tap. Only a *genuine* whiffed catch breaks the combo: there
      // must be a live catchable target in flight (un-hit, un-missed) for the
      // tap to count as a real gameplay error. Taps during the dead air between
      // steps (no target on the board) are a no-op, so an accidental press in a
      // gap doesn't punish the player. (adversarial-review, PR #390)
      const liveTarget = this.notes.some(
        (n) => n.isTarget && !n.hit && !n.missed
      );
      if (!liveTarget) return;
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

  private loop(timestamp: number) {
    if (!this.isRunning) return;

    const dt = this.lastTimestamp
      ? Math.min(0.05, (timestamp - this.lastTimestamp) / 1000)
      : 0;
    this.lastTimestamp = timestamp;

    if (this.state === GameState.PLAYING) {
      // 1. SPAWNING — step / round cadence.
      if (!this.round) {
        // No active round (post-resolve gap): start the next one when due.
        if (timestamp > this.nextSpawnTime) {
          this.startRound();
        }
      } else if (
        this.roundResolved &&
        this.notes.every((n) => n.hit || n.missed)
      ) {
        // Round resolved + board cleared: queue the next round.
        if (timestamp > this.nextSpawnTime) {
          this.round = null;
          this.startRound();
        }
      } else if (
        !this.stepActive &&
        !this.roundResolved &&
        this.caughtCount < this.roundWords.length &&
        timestamp > this.nextSpawnTime
      ) {
        this.spawnStep();
      }

      // 2. PHYSICS — delta-timed falling motion (the hero).
      const boundsHeight = this.canvas.clientHeight;
      const strumY = this.laneSystem.getStrumLineY();
      const passLine = strumY + this.laneSystem.getNoteRadius() * 2.2;

      this.notes.forEach((note) => {
        note.y += this.speed * dt;

        if (note.y > boundsHeight + 120) note.missed = true;

        if (note.isTarget && note.y > passLine && !note.hit && !note.missed) {
          // The correct word sailed past the strum unhit → a miss. Combo
          // breaks and the same point penalty as a wrong (distractor) catch
          // applies, so missing the real answer is never lower-risk than
          // whiffing a foil (symmetric miss contract). We reveal the word
          // anyway (assembling strip) and advance so the phrase stays coherent
          // and the player keeps learning. (adversarial-review, PR #390)
          note.missed = true;
          this.roundAllCaught = false;
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
        }
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
    this.inputManager.dispose();
    this.effects.dispose();
    this.audio.dispose();
    this.progression.dispose();
    this.hud.dispose();
    this.bus.clear();
    this.canvas.remove();
  }
}
