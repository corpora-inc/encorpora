import { HostApi, StackConfig } from "./sdk/types";
import {
  GameState,
  GameMode,
  Note,
  LaneIndex,
  type ActiveLanguage,
} from "./types";
import { LaneSystem } from "./LaneSystem";
import { Renderer } from "./Renderer";
import { InputManager } from "./InputManager";
import { ContentManager } from "./ContentManager";
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
  private speed: number = 3;

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
    this.inputManager = new InputManager(container, (x) => this.getLaneFromX(x));
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
      },
      this.progression
    );
    this.hud.applyLanguage(this.activeLanguage);
    this.effects = initEffects(
      this.canvas.getContext("2d")!,
      this.bus,
      this.laneSystem
    );

    // Initial resize (DPI) + responsive handler
    this.handleResize(container);
    window.addEventListener("resize", () => this.handleResize(container));

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

  private getLaneFromX(x: number): LaneIndex | null {
    const width = this.canvas.clientWidth;
    const third = width / 3;
    if (x < third) return LaneIndex.Left;
    else if (x < third * 2) return LaneIndex.Center;
    else return LaneIndex.Right;
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
    this.speed = Math.max(2, height * 0.005);
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

  private async spawnWave() {
    this.isWaveActive = true;

    try {
      const { target, distractors } = await this.contentManager.getWaveContent();

      const indices = [0, 1, 2].sort(() => Math.random() - 0.5);
      const t0 = target.translations[0];

      let speakText = ""; // RAW text fed to TTS
      let speakLang = "";
      let visualText = ""; // English answer shown on the target note

      // Prefer the user's resolved active language; fall back to any non-English.
      const foreign =
        target.translations.find(
          (t) => t.language_code === this.activeLanguage.code
        ) ?? target.translations.find((t) => t.language_code !== "en");

      if (foreign) {
        // DISPLAY is cleaned; AUDIO speaks the raw entry text (decoupled).
        this.currentQuestionText = this.cleanDisplay(foreign.text);
        speakText = foreign.text;
        speakLang = foreign.language_code;

        const enTrans =
          target.translations.find((t) => t.language_code === "en")?.text ||
          "???";
        visualText = this.cleanDisplay(enTrans);
      } else {
        this.currentQuestionText = this.cleanDisplay(t0?.text || "?");
        speakText = t0?.text || "";
        speakLang = t0?.language_code || "en";
        visualText = this.cleanDisplay(t0?.text || "");
      }

      this.hud.setQuestion(this.currentQuestionText);

      const targetNote: Note = {
        id: `note-${Date.now()}-t`,
        lane: indices[0],
        y: -100,
        text: visualText,
        isTarget: true,
        hit: false,
        missed: false,
        spawnTime: Date.now(),
      };

      // Speak the RAW foreign text at the host-configured rate.
      this.contentManager.speak(speakText, speakLang, this.activeLanguage.rate);

      const distractorNotes = distractors.map((d, i) => {
        const dNative = d.translations.find((t) => t.language_code === "en");
        const dText = dNative
          ? this.cleanDisplay(dNative.text)
          : this.cleanDisplay(d.translations[0]?.text || "???");

        return {
          id: `note-${Date.now()}-d-${i}`,
          lane: indices[i + 1],
          y: -100,
          text: dText,
          isTarget: false,
          hit: false,
          missed: false,
          spawnTime: Date.now(),
        };
      });

      this.notes.push(targetNote, ...distractorNotes);
    } catch (e) {
      console.error("Failed to spawn wave", e);
      this.isWaveActive = false;
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

  private handleInput(lane: LaneIndex) {
    this.lanePressTimes[lane] = performance.now();

    if (this.state !== GameState.PLAYING) return;

    const hitNote = this.laneSystem.checkHit(lane, this.notes);
    const strumY = this.laneSystem.getStrumLineY();
    const laneX = this.laneSystem.getLaneX(lane);

    if (hitNote) {
      if (hitNote.isTarget) {
        hitNote.hit = true;
        hitNote.hitTime = performance.now();
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
        });

        if (this.mode === GameMode.PRACTICE) {
          this.notes.forEach((n) => {
            if (!n.hit && !n.isTarget) n.hit = true;
          });
          this.isWaveActive = false;
          this.nextWaveTime = performance.now() + 1000;
        }
      } else {
        hitNote.hit = true;
        this.setCombo(0);
        this.setScore(Math.max(0, this.score - 50));
        this.bus.emit("noteMiss", {
          lane,
          x: laneX,
          y: strumY,
          reason: "wrong",
          mode: this.mode,
        });
      }
    } else {
      this.setCombo(0);
      this.bus.emit("noteMiss", {
        lane,
        x: laneX,
        y: strumY,
        reason: "wrong",
        mode: this.mode,
      });
    }
  }

  private loop(timestamp: number) {
    if (!this.isRunning) return;

    if (this.state === GameState.PLAYING) {
      // 1. Spawning
      if (this.mode === GameMode.PRACTICE) {
        if (!this.isWaveActive && timestamp > this.nextWaveTime) {
          this.spawnWave();
        }
      } else {
        if (timestamp > this.nextWaveTime) {
          const minTimeGap = 150 / this.speed;
          this.spawnWave();
          const dynamicInterval = Math.max(1200, 2500 - this.score * 5);
          const finalInterval = Math.max(dynamicInterval, minTimeGap * 16);
          this.nextWaveTime = timestamp + finalInterval;
        }
      }

      // 2. Physics / Movement
      const boundsHeight = this.canvas.clientHeight;
      const strumY = this.laneSystem.getStrumLineY();

      this.notes.forEach((note) => {
        note.y += this.speed;

        if (note.y > boundsHeight + 100) {
          note.missed = true;
        }

        if (
          note.isTarget &&
          note.y > strumY + 50 &&
          !note.hit &&
          !note.missed
        ) {
          this.setCombo(0);
          this.bus.emit("noteMiss", {
            lane: note.lane,
            x: this.laneSystem.getLaneX(note.lane),
            y: strumY,
            reason: "passed",
            mode: this.mode,
          });

          if (this.mode === GameMode.PRACTICE) {
            this.isWaveActive = false;
            this.nextWaveTime = timestamp + 1000;
          }
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
    this.inputManager.dispose();
    this.effects.dispose();
    this.audio.dispose();
    this.progression.dispose();
    this.hud.dispose();
    this.bus.clear();
    this.canvas.remove();
  }
}
