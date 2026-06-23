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
import { ContentManager, tokenizeWords, normalizeWord } from "./ContentManager";
import { createEventBus, type GameEventBus } from "./events";
import { Hud } from "./ui/Hud";
import { initEffects, type EffectsHandle } from "./effects";
import { initAudioHaptics, type AudioHandle } from "./audio";
import { initProgression, type ProgressionApi } from "./progression";

const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);

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
  // Seconds a note takes to fall from spawn to the strum line. Higher = slower &
  // easier — THE primary playability knob. (Was effectively ~1.3–2.7s AND
  // frame-rate-dependent, which made it unplayable on high-refresh phones.)
  private readonly NOTE_TRAVEL_SECONDS = 7;
  // Note fall speed in PIXELS PER SECOND, derived from NOTE_TRAVEL_SECONDS on
  // resize and applied with delta-time in the loop (frame-rate independent).
  private speed: number = 200;
  private lastTimestamp: number = 0;

  private isRunning: boolean = false;
  private fontsReady: boolean = false;

  private isWaveActive: boolean = false;
  private nextWaveTime: number = 0;

  // Host language context
  private stackConfig: StackConfig;
  private activeLanguage: ActiveLanguage;
  private offStackConfigChange?: () => void;

  // Current active question (foreign prompt, display label)
  private currentQuestionText: string = "";

  // ---- WORD LANES phrase state -------------------------------------------
  // The current phrase's identity (entry). One PHRASE == one "wave" for the
  // learning/effects/audio bus ABI: noteHit/noteMiss fire per beat, but
  // wave-resolved fires exactly once per phrase with the final verdict.
  private currentWord: WordIdentity | null = null;
  // Guards "wave-resolved" so it fires exactly once per phrase.
  private waveResolved: boolean = false;
  // The RAW foreign text + lang for the current prompt (for audio replay).
  private currentSpeakText: string = "";
  private currentSpeakLang: string = "";

  // The English answer split into the WORDS the player must collect, in order.
  private phraseWords: string[] = [];
  // Single-word distractor pool for THIS phrase (distinct from phraseWords).
  private distractorPool: string[] = [];
  // Index of the next word the player must tap (0..phraseWords.length).
  private beatIndex: number = 0;
  // Tracks whether the current phrase was completed without any wrong/missed
  // beat — drives the once-per-phrase wave-resolved verdict.
  private phraseClean: boolean = true;

  // Track lane activation for visuals
  private lanePressTimes: number[] = [0, 0, 0];

  constructor(
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: { stackConfig?: StackConfig }
  ) {
    // Resolve host stack config (prefer explicit initialState, else query host).
    this.stackConfig =
      initialState?.stackConfig ?? hostApi.getStackConfig();
    this.activeLanguage = this.resolveActiveLanguage(this.stackConfig);

    // Subscribe to live stack-config changes so language/rate/textSize update.
    if (hostApi.onStackConfigChange) {
      this.offStackConfigChange = hostApi.onStackConfigChange((next) => {
        this.stackConfig = next;
        this.activeLanguage = this.resolveActiveLanguage(next);
        this.hud?.applyLanguage(this.activeLanguage);
      });
    }

    this.canvas = document.createElement("canvas");
    container.appendChild(this.canvas);

    // Core systems
    this.laneSystem = new LaneSystem(0, 0); // resized immediately below
    this.renderer = new Renderer(this.canvas, this.laneSystem);
    this.contentManager = new ContentManager(hostApi);
    this.inputManager = new InputManager(container, this.canvas, (x) =>
      this.getLaneFromX(x)
    );
    this.inputManager.onInput((lane) => this.handleInput(lane));

    // Event bus + stream modules (no-op stubs the streams fill in).
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

    // Initial resize (DPI) + responsive handler. A ResizeObserver tracks the
    // ACTUAL container size — critical in the app, where the game can mount
    // before the host's container has its final size (a window 'resize' may
    // never fire), which would otherwise leave the lane geometry stale.
    this.handleResize(container);
    window.addEventListener("resize", () => this.handleResize(container));
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.handleResize(container));
      this.resizeObserver.observe(container);
    }

    // Gate the first canvas draw on fonts so 'Russo One' is loaded before paint.
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
   * Resolve the active target language from the host stack config.
   * Picks the first non-English entry the user configured; falls back to the
   * first language, then to "es". Carries rate/textSize/romanization through.
   */
  private resolveActiveLanguage(cfg: StackConfig): ActiveLanguage {
    const langs = cfg.languages ?? [];
    const code = langs.find((l) => l !== "en") ?? langs[0] ?? "es";
    return {
      code,
      isRTL: RTL_LANGS.has(code),
      rate: typeof cfg.rate === "number" ? cfg.rate : 1,
      textSize: cfg.textSize ?? "medium",
      showRomanization: cfg.showRomanization ?? false,
    };
  }

  /** The resolved active target language (for the UI stream). */
  getActiveLanguage(): ActiveLanguage {
    return this.activeLanguage;
  }

  /**
   * Re-speak the CURRENT prompt's RAW foreign text at the host rate. Wired to
   * the Hud audio-replay button (callback). No-op if no wave is active yet.
   * Speaks RAW text (not display-cleaned) per the TTS contract.
   */
  replayPrompt(): void {
    if (!this.currentSpeakText) return;
    this.contentManager.speak(
      this.currentSpeakText,
      this.currentSpeakLang || this.activeLanguage.code,
      this.activeLanguage.rate
    );
  }

  private getLaneFromX(x: number): LaneIndex | null {
    // Use the SAME lane geometry the renderer draws with (centered, capped at
    // 600px). The old naive width/3 split didn't account for the side margins,
    // so on wide layouts the lane you tapped wasn't the lane you saw.
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
    // Sync the play-field top to the live HUD layout (below the header + chips)
    // so cards spawn and fall inside the field, never over the HUD.
    this.syncPlayFieldTop();
    // px/sec so a note covers the play-field span (playFieldTop→strum) in
    // NOTE_TRAVEL_SECONDS, independent of canvas size and device refresh rate.
    this.speed = this.computeSpeed();
  }

  /**
   * Measure the HUD's bottom edge and push it to the lane system as the top of
   * the play field. Cards spawn just above this line and fall to the strum,
   * so they never overlap the prompt/cue/phrase-strip/score band. No-op when
   * the HUD isn't laid out yet (returns 0 → keeps the proportional fallback).
   */
  private syncPlayFieldTop(): void {
    const hudBottom = this.hud?.getHudBottom() ?? 0;
    if (hudBottom > 0) {
      // A small breathing gutter below the HUD before the fall region begins.
      this.laneSystem.setPlayFieldTop(hudBottom + 12);
    }
  }

  /** Fall speed (px/sec) so a card travels from its spawn center to the strum
   *  line in NOTE_TRAVEL_SECONDS, independent of canvas size + refresh rate. */
  private computeSpeed(): number {
    const cardHalfH = this.laneSystem.getNoteRadius() * 1.55 * 0.5;
    const span =
      this.laneSystem.getStrumLineY() -
      (this.laneSystem.getPlayFieldTop() + cardHalfH);
    return Math.max(60, span) / this.NOTE_TRAVEL_SECONDS;
  }

  /** The y a freshly spawned card's CENTER starts at: positioned so the card's
   *  TOP edge sits at the play-field top — the whole card (and its word) is
   *  inside the field from frame one, never clipped and never over the HUD. The
   *  card is `noteRadius * 1.55` tall (see Renderer), so half that is its top
   *  inset from center. */
  private spawnY(): number {
    const cardHalfH = this.laneSystem.getNoteRadius() * 1.55 * 0.5;
    return this.laneSystem.getPlayFieldTop() + cardHalfH;
  }

  private showMenu() {
    this.state = GameState.MENU;
    this.bus.emit("menuShown", { lastScore: this.score });
  }

  private async startGame(mode: GameMode) {
    // Prime TTS on user gesture (important for mobile web).
    this.contentManager.speak(" ", "en", this.activeLanguage.rate);

    this.state = GameState.PLAYING;
    this.mode = mode;
    this.score = 0;
    this.combo = 0;
    this.notes = [];
    this.isWaveActive = false;
    this.nextWaveTime = 0;
    this.currentQuestionText = "";
    this.phraseWords = [];
    this.distractorPool = [];
    this.beatIndex = 0;

    this.bus.emit("gameStart", { mode, language: this.activeLanguage });
    // Reset HUD counters via the bus contract.
    this.bus.emit("scoreChange", { value: 0, delta: 0 });
    this.bus.emit("comboChange", { value: 0, previous: 0 });

    try {
      await this.spawnWave();
    } catch (e) {
      console.error("Failed initial spawn", e);
    }
  }

  /**
   * End the current run: flips to GAME_OVER and emits the gameOver event (the
   * Hud shows the game-over panel off this). No mode currently triggers it
   * automatically (endless play); exposed so a future game-over condition or
   * the integrator can call it. The bus event is the contract streams react to.
   */
  gameOver() {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.GAME_OVER;
    this.bus.emit("gameOver", { finalScore: this.score, mode: this.mode });
  }

  /**
   * Clean text for DISPLAY ONLY. Strips parenthetical glosses and trims; for
   * long comma-listed glosses keep the first sense. Title-casing is applied
   * ONLY to Latin-script ASCII text (never to foreign scripts). The RAW entry
   * text is what gets spoken — see spawnWave / contentManager.speak.
   */
  private cleanDisplay(text: string): string {
    let clean = text.replace(/\s*\(.*?\)\s*/g, "").trim();

    if (clean.length > 20 && clean.includes(",")) {
      clean = clean.split(",")[0].trim();
    }

    // Title-case the first letter only for ASCII Latin text. Non-Latin scripts
    // (ar/he/zh/ja/ko/ru/…) must be left untouched.
    if (clean.length > 0 && /^[a-z]/.test(clean)) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    return clean;
  }

  /**
   * Load the NEXT phrase: fetch one entry's foreign prompt + its English split
   * into the words to collect, plus a single-word distractor pool. Shows the
   * foreign prompt at the top, speaks the RAW foreign text, primes the
   * progress strip, and spawns the FIRST beat. One phrase == one wave for the
   * bus ABI (wave-resolved fires once per phrase).
   */
  private async spawnWave() {
    this.isWaveActive = true;
    this.waveResolved = false;
    this.phraseClean = true;
    this.beatIndex = 0;
    this.notes = [];

    try {
      const phrase = await this.contentManager.getPhrase(
        this.activeLanguage.code
      );

      // DISPLAY is cleaned; AUDIO speaks the RAW foreign text (decoupled).
      this.currentQuestionText = this.cleanDisplay(phrase.foreign);
      this.currentSpeakText = phrase.foreign;
      this.currentSpeakLang = phrase.foreignLang;

      const englishDisplay = this.cleanDisplay(phrase.english);
      this.phraseWords = tokenizeWords(phrase.english);
      if (this.phraseWords.length === 0) {
        // Degenerate entry (no English words) — skip to the next phrase.
        this.isWaveActive = false;
        this.nextWaveTime = performance.now() + 200;
        return;
      }
      this.distractorPool = phrase.distractorWords;

      // Phrase identity for the learning ABI (one outcome per phrase).
      this.currentWord = {
        entryId: phrase.entryId,
        foreign: phrase.foreign,
        english: englishDisplay,
        romanization: phrase.romanization,
        lang: phrase.foreignLang,
      };

      this.hud.setQuestion(this.currentQuestionText);
      this.hud.setRomanization(phrase.romanization ?? "");
      // Prime the assembly strip with all blanks.
      this.hud.setPhraseProgress(this.phraseWords, 0);
      // The HUD just grew (prompt + romanization + phrase strip) — re-measure
      // the play-field top and recompute speed BEFORE spawning the first beat so
      // the cards start below the (now taller) HUD band.
      this.syncPlayFieldTop();
      this.speed = this.computeSpeed();

      // Speak the RAW foreign prompt once at the start of the phrase.
      this.contentManager.speak(
        phrase.foreign,
        phrase.foreignLang,
        this.activeLanguage.rate
      );

      this.spawnBeat();
    } catch (e) {
      console.error("Failed to spawn phrase", e);
      this.isWaveActive = false;
    }
  }

  /**
   * Spawn ONE beat: the correct NEXT word in a random lane + single-word
   * distractors (distinct from the correct word) in the other lanes. Every
   * note is a single, short word so the cards are uniform and never overflow.
   */
  private spawnBeat() {
    const correctWord = this.phraseWords[this.beatIndex];
    if (correctWord === undefined) return;

    const indices = [0, 1, 2].sort(() => Math.random() - 0.5);
    const used = new Set<string>([normalizeWord(correctWord)]);
    const now = Date.now();
    // Re-sync the field top (the phrase strip can change the HUD height between
    // beats) and recompute the fall speed for the current span.
    this.syncPlayFieldTop();
    this.speed = this.computeSpeed();
    const spawnY = this.spawnY();

    const targetNote: Note = {
      id: `beat-${now}-${this.beatIndex}-t`,
      lane: indices[0],
      y: spawnY,
      text: correctWord,
      isTarget: true,
      hit: false,
      missed: false,
      spawnTime: now,
    };

    const notes: Note[] = [targetNote];

    // Distractors: pull distinct single words, never equal to the correct word
    // (or to each other / another visible word) so the right answer is on
    // exactly one lane. Fall back to other phrase words if the pool is thin.
    const fallback = this.phraseWords.filter(
      (w) => normalizeWord(w) !== normalizeWord(correctWord)
    );
    const candidates = shuffle([...this.distractorPool]).concat(
      shuffle(fallback)
    );
    let ci = 0;
    for (let slot = 1; slot <= 2; slot++) {
      let word = "";
      while (ci < candidates.length) {
        const c = candidates[ci++];
        const key = normalizeWord(c);
        if (!key || used.has(key)) continue;
        used.add(key);
        word = c;
        break;
      }
      if (!word) continue; // not enough distinct words — leave the lane empty
      notes.push({
        id: `beat-${now}-${this.beatIndex}-d${slot}`,
        lane: indices[slot],
        y: spawnY,
        text: word,
        isTarget: false,
        hit: false,
        missed: false,
        spawnTime: now,
      });
    }

    this.notes.push(...notes);
  }

  /**
   * A beat was answered correctly: assemble the word into the strip, advance,
   * and either spawn the next beat or complete the phrase.
   */
  private advanceBeat() {
    this.beatIndex += 1;
    this.hud.setPhraseProgress(this.phraseWords, this.beatIndex);

    if (this.beatIndex >= this.phraseWords.length) {
      // PHRASE COMPLETE — brief celebration, then resolve + queue the next.
      this.resolveWave(this.phraseClean ? "correct" : "wrong");
      this.isWaveActive = false;
      // Practice + Blitz alike: a short celebratory gap before the next phrase.
      this.nextWaveTime = performance.now() + 1100;
    } else {
      this.spawnBeat();
    }
  }

  private setScore(value: number) {
    const delta = value - this.score;
    this.score = value;
    if (delta !== 0) this.bus.emit("scoreChange", { value, delta });
  }

  private setCombo(value: number) {
    const previous = this.combo;
    if (value === previous) return;
    this.combo = value;
    this.bus.emit("comboChange", { value, previous });
  }

  /**
   * Emit the single, authoritative "wave-resolved" event for the current wave.
   * Fires at most once per wave (guarded by `waveResolved`) so the learning
   * stream records exactly one outcome and the UI raises one feedback card.
   * Distractor taps before resolution don't resolve the wave (the player can
   * still hit the target), so only target-hit / target-passed call this.
   */
  private resolveWave(outcome: "correct" | "wrong" | "passed") {
    if (this.waveResolved || !this.currentWord) return;
    this.waveResolved = true;
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
    // Ignore taps during the celebration gap (no active beat).
    if (!this.isWaveActive) return;

    const hitNote = this.laneSystem.checkHit(lane, this.notes);
    const strumY = this.laneSystem.getStrumLineY();
    const laneX = this.laneSystem.getLaneX(lane);

    // The phrase's identity (always set during an active phrase). Fall back to
    // a synthetic identity so the strongly-typed event always carries a word.
    const word: WordIdentity = this.currentWord ?? {
      entryId: -1,
      foreign: this.currentSpeakText,
      english: "",
      lang: this.currentSpeakLang || this.activeLanguage.code,
    };

    if (hitNote && hitNote.isTarget) {
      // CORRECT next word — collect it, advance the beat.
      hitNote.hit = true;
      hitNote.hitTime = performance.now();
      // Clear the distractors of this beat so they don't keep falling.
      this.notes.forEach((n) => {
        if (!n.hit && !n.isTarget) n.hit = true;
      });
      const points = 100 + this.combo * 10;
      this.setScore(this.score + points);
      this.setCombo(this.combo + 1);
      this.bus.emit("noteHit", {
        lane,
        x: laneX,
        y: strumY,
        combo: this.combo,
        points,
        mode: this.mode,
        word,
      });
      // Speak the collected English word for reinforcement.
      this.contentManager.speak(hitNote.text, "en", this.activeLanguage.rate);
      this.advanceBeat();
    } else {
      // WRONG word OR empty tap — combo break, the beat re-presents (forgiving).
      // Mark this whole beat's notes consumed; respawn the same beat fresh.
      this.phraseClean = false;
      this.notes.forEach((n) => {
        if (!n.hit) n.hit = true;
      });
      this.setCombo(0);
      this.setScore(Math.max(0, this.score - 50));
      this.bus.emit("noteMiss", {
        lane,
        x: laneX,
        y: strumY,
        reason: "wrong",
        mode: this.mode,
        word,
      });
      // Re-present the SAME beat so the player can still get this word.
      this.spawnBeat();
    }
  }

  private loop(timestamp: number) {
    if (!this.isRunning) return;

    // Frame-rate-independent timestep (clamped so a backgrounded tab resuming
    // can't teleport notes through the strum line).
    const dt = this.lastTimestamp
      ? Math.min(0.05, (timestamp - this.lastTimestamp) / 1000)
      : 0;
    this.lastTimestamp = timestamp;

    if (this.state === GameState.PLAYING) {
      // 1. Spawning — between phrases (celebration gap or initial), queue the
      //    next phrase. Same forgiving cadence in Practice and Blitz: the phrase
      //    advances beat-by-beat on taps, not on a timer.
      if (!this.isWaveActive && timestamp > this.nextWaveTime) {
        this.spawnWave();
      }

      // 2. Physics / Movement
      const boundsHeight = this.canvas.clientHeight;
      const strumY = this.laneSystem.getStrumLineY();

      this.notes.forEach((note) => {
        note.y += this.speed * dt;

        if (note.y > boundsHeight + 100) {
          note.missed = true;
        }

        // The CORRECT word sailed past the strum line without a tap: combo
        // break + re-present the SAME beat (forgiving — the word can be retried).
        if (
          note.isTarget &&
          note.y > strumY + this.laneSystem.getNoteRadius() * 2.2 &&
          !note.hit &&
          !note.missed &&
          this.isWaveActive
        ) {
          this.phraseClean = false;
          this.setCombo(0);
          const passedWord: WordIdentity = this.currentWord ?? {
            entryId: -1,
            foreign: this.currentSpeakText,
            english: note.text,
            lang: this.currentSpeakLang || this.activeLanguage.code,
          };
          this.bus.emit("noteMiss", {
            lane: note.lane,
            x: this.laneSystem.getLaneX(note.lane),
            y: strumY,
            reason: "passed",
            mode: this.mode,
            word: passedWord,
          });
          // Consume this beat's notes and re-present the same beat.
          this.notes.forEach((n) => {
            if (!n.hit) n.missed = true;
          });
          this.spawnBeat();
        }
      });

      this.notes = this.notes.filter(
        (n) => !n.missed && !(n.hit && n.y > boundsHeight)
      );
    }

    // Gate first paint on fonts being ready (avoid FOUT in canvas text).
    if (this.fontsReady) {
      this.renderer.clear();

      const now = performance.now();
      const activeLanes: number[] = [];
      this.lanePressTimes.forEach((t, i) => {
        if (now - t < 150) activeLanes.push(i);
      });

      this.renderer.drawLanes(activeLanes);
      this.renderer.drawNotes(this.notes);

      // Optional effects-stream paint hook (no-op until effects stream fills it).
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

/** In-place Fisher–Yates shuffle; returns the same array for chaining. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
