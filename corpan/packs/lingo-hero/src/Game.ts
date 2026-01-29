import { HostApi } from "./sdk/types";
import { GameState, GameMode, Note, LaneIndex } from "./types";
import { LaneSystem } from "./LaneSystem";
import { Renderer } from "./Renderer";
import { InputManager } from "./InputManager";
import { ContentManager } from "./ContentManager";

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private laneSystem: LaneSystem;
  private inputManager: InputManager;
  private contentManager: ContentManager;
  
  private state: GameState = GameState.MENU;
  private mode: GameMode = GameMode.PRACTICE;
  
  private notes: Note[] = [];
  private score: number = 0;
  private combo: number = 0;
  private speed: number = 3; // pixels per frame
  
  private lastTime: number = 0;
  private isRunning: boolean = false;
  
  // Wave Logic
  private isWaveActive: boolean = false;
  private nextWaveTime: number = 0;
  
  // UI Elements
  private uiRoot: HTMLElement;
  private menuScreen: HTMLElement;
  private hud: HTMLElement;
  private gameOverScreen: HTMLElement;

  constructor(container: HTMLElement, hostApi: HostApi) {
    // 1. Setup Canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    container.appendChild(this.canvas);
    
    // 2. Setup UI container
    this.uiRoot = document.createElement("div");
    this.uiRoot.className = "ui-layer";
    this.uiRoot.innerHTML = `
      <div class="menu-screen" id="menu">
        <h1 class="logo-title">Lingo Hero</h1>
        <button class="menu-btn" id="btn-practice">Practice</button>
        <button class="menu-btn blitz" id="btn-blitz">Blitz Mode</button>
      </div>
      <div class="hud hidden" id="hud">
        <div class="score-box">Score: <span id="score">0</span></div>
        <div class="combo-box">x<span id="combo">0</span> <span class="streak-text">Streak</span></div>
      </div>
      <div class="game-over-screen hidden" id="game-over">
        <div class="glass-panel">
          <h2>Game Over</h2>
          <p class="score-box">Final Score: <span id="final-score">0</span></p>
          <button class="menu-btn" id="btn-retry">Retry</button>
          <button class="menu-btn" id="btn-menu">Main Menu</button>
        </div>
      </div>
    `;
    container.appendChild(this.uiRoot);
    
    // UI Refs
    this.menuScreen = this.uiRoot.querySelector("#menu")!;
    this.hud = this.uiRoot.querySelector("#hud")!;
    this.gameOverScreen = this.uiRoot.querySelector("#game-over")!;

    // 3. Systems
    this.laneSystem = new LaneSystem(this.canvas.width, this.canvas.height);
    this.renderer = new Renderer(this.canvas, this.laneSystem);
    this.contentManager = new ContentManager(hostApi);
    this.inputManager = new InputManager(container, (x) => this.getLaneFromX(x));
    
    // 4. Input Binding
    this.inputManager.onInput((lane) => this.handleInput(lane));
    
    // 5. UI Binding
    this.uiRoot.querySelector("#btn-practice")?.addEventListener("click", () => this.startGame(GameMode.PRACTICE));
    this.uiRoot.querySelector("#btn-blitz")?.addEventListener("click", () => this.startGame(GameMode.BLITZ));
    this.uiRoot.querySelector("#btn-retry")?.addEventListener("click", () => this.startGame(this.mode));
    this.uiRoot.querySelector("#btn-menu")?.addEventListener("click", () => this.showMenu());
    
    // Handle resize
    window.addEventListener("resize", () => {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
      this.laneSystem.resize(this.canvas.width, this.canvas.height);
    });

    // Start Loop
    this.lastTime = performance.now();
    this.isRunning = true;
    requestAnimationFrame((t) => this.loop(t));
  }

  private getLaneFromX(x: number): LaneIndex | null {
    // Simple mapping: 0-33%, 33-66%, 66-100% of screen width OR specifically within lane bounds
    // Let's use lane bounds for accuracy if clicked outside
    for (let i = 0; i < 3; i++) {
        const bounds = this.laneSystem.getLaneBounds(i);
        // Be generous with touch target
        if (x >= bounds.x - 20 && x <= bounds.x + bounds.width + 20) {
            return i;
        }
    }
    return null;
  }

  private showMenu() {
    this.state = GameState.MENU;
    this.menuScreen.classList.remove("hidden");
    this.hud.classList.add("hidden");
    this.gameOverScreen.classList.add("hidden");
  }

  private startGame(mode: GameMode) {
    this.state = GameState.PLAYING;
    this.mode = mode;
    this.score = 0;
    this.combo = 0;
    this.speed = mode === GameMode.BLITZ ? 3 : 2; // Slower for practice
    this.notes = [];
    this.isWaveActive = false;
    this.nextWaveTime = 0; // Immediate start

    this.updateHUD();
    
    this.menuScreen.classList.add("hidden");
    this.gameOverScreen.classList.add("hidden");
    this.hud.classList.remove("hidden");
  }

  private gameOver() {
    this.state = GameState.GAME_OVER;
    this.hud.classList.add("hidden");
    this.gameOverScreen.classList.remove("hidden");
    this.uiRoot.querySelector("#final-score")!.textContent = this.score.toString();
  }

  private async spawnWave() {
    this.isWaveActive = true;
    
    try {
      const { target, distractors } = await this.contentManager.getWaveContent();
      
      // We have 3 items total. Shuffle them into lanes 0, 1, 2.
      const indices = [0, 1, 2].sort(() => Math.random() - 0.5);
      
      // Target Note
      const targetNote: Note = {
        id: `note-${Date.now()}-t`,
        lane: indices[0],
        y: -50, // Start above screen
        text: target.translations[0]?.text || "???", // Show target language text
        isTarget: true,
        hit: false,
        missed: false,
        spawnTime: Date.now()
      };
      
      // Speak the prompt (Source language usually, but depends on game design)
      // "Press the word related to the word which the system speaks"
      // If system speaks "Hola" (ES), and text options are "Hello", "Bye", "Cat" (EN) -> Match translation.
      // If system speaks "Hola" (ES), and options are "Hola", "Adios", "Gato" (ES text) -> Match audio to text.
      // Let's assume: Audio is Target Lang, Text is Target Lang (Dictation) OR Audio is Native, Text is Target.
      
      // Let's go with: Audio = Target Language ("Hola"), Text = Target Language ("Hola"). Simple recognition.
      // Or: Audio = Native ("Hello"), Text = Target ("Hola"). Translation.
      
      // User prompt said: "sounds a word and the user should touch that word" -> implied Audio Match.
      // Let's use Target Language for both Audio and Text.
      const lang = target.translations[0]?.language_code || "en";
      const word = target.translations[0]?.text || "";
      this.contentManager.speak(word, lang);

      // Distractors
      const distractorNotes = distractors.map((d, i) => ({
        id: `note-${Date.now()}-d-${i}`,
        lane: indices[i + 1],
        y: -50,
        text: d.translations[0]?.text || "???",
        isTarget: false,
        hit: false,
        missed: false,
        spawnTime: Date.now()
      }));

      this.notes.push(targetNote, ...distractorNotes);

    } catch (e) {
      console.error("Failed to spawn wave", e);
    }
  }

  private handleInput(lane: LaneIndex) {
    if (this.state !== GameState.PLAYING) return;

    const hitNote = this.laneSystem.checkHit(lane, this.notes);

    if (hitNote) {
      if (hitNote.isTarget) {
        // Correct!
        hitNote.hit = true;
        this.score += 100 + (this.combo * 10);
        this.combo++;
        // Remove distractors in this wave (visual cleanup)
        // Actually, let them fall or fade out?
        // Let's mark them as processed so they don't count as misses later?
        // In Practice mode, wave ends. In Blitz, they keep falling.
        
        if (this.mode === GameMode.PRACTICE) {
           this.notes.forEach(n => {
               if (!n.hit && !n.isTarget) n.hit = true; // "Clear" them essentially
           });
           this.isWaveActive = false;
           this.nextWaveTime = performance.now() + 1000; // 1s pause
        }
      } else {
        // Wrong note!
        hitNote.hit = true; // Mark as hit (but it was wrong)
        this.combo = 0;
        this.score = Math.max(0, this.score - 50);
        // Visual shake?
      }
    } else {
      // Miss click (empty lane or bad timing)
      this.combo = 0;
    }
    
    this.updateHUD();
  }

  private updateHUD() {
    this.uiRoot.querySelector("#score")!.textContent = this.score.toString();
    this.uiRoot.querySelector("#combo")!.textContent = this.combo.toString();
  }

  private loop(timestamp: number) {
    if (!this.isRunning) return;
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (this.state === GameState.PLAYING) {
      // 1. Spawning
      if (this.mode === GameMode.PRACTICE) {
         if (!this.isWaveActive && timestamp > this.nextWaveTime) {
             this.spawnWave();
         }
      } else {
          // Blitz mode: spawn every X ms
          if (timestamp > this.nextWaveTime) {
              this.spawnWave();
              // Faster as score goes up?
              const interval = Math.max(1000, 2500 - (this.score * 2));
              this.nextWaveTime = timestamp + interval;
          }
      }

      // 2. Physics / Movement
      const strumY = this.laneSystem.getStrumLineY();
      
      this.notes.forEach(note => {
        note.y += this.speed;
        
        // Miss detection
        if (note.y > this.canvas.height + 50) {
            note.missed = true;
        }
        
        // Specific miss logic for Targets
        if (note.isTarget && note.y > strumY + 50 && !note.hit && !note.missed) {
             // Target passed the line without being hit -> MISS
             this.combo = 0;
             this.updateHUD();
             
             if (this.mode === GameMode.PRACTICE) {
                 this.isWaveActive = false; // Next wave
                 this.nextWaveTime = timestamp + 1000;
             }
        }
      });
      
      // Cleanup
      this.notes = this.notes.filter(n => !n.missed && !(n.hit && n.y > this.canvas.height));
    }

    // 3. Render
    this.renderer.clear();
    this.renderer.drawLanes();
    this.renderer.drawNotes(this.notes);

    requestAnimationFrame((t) => this.loop(t));
  }

  dispose() {
    this.isRunning = false;
    this.inputManager.dispose();
    this.canvas.remove();
    this.uiRoot.remove();
  }
}
