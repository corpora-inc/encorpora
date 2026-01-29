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
  private speed: number = 3; 
  
  private lastTime: number = 0;
  private isRunning: boolean = false;
  
  private isWaveActive: boolean = false;
  private nextWaveTime: number = 0;
  
  private uiRoot: HTMLElement;
  private menuScreen: HTMLElement;
  private hud: HTMLElement;
  private gameOverScreen: HTMLElement;
  
  // Current active question
  private currentQuestionText: string = "";
  
  // Track lane activation for visuals
  private lanePressTimes: number[] = [0, 0, 0];

  constructor(container: HTMLElement, hostApi: HostApi) {
    this.canvas = document.createElement("canvas");
    container.appendChild(this.canvas);
    
    // UI Setup
    this.uiRoot = document.createElement("div");
    this.uiRoot.className = "ui-layer";
    this.uiRoot.innerHTML = `
      <div class="menu-screen" id="menu">
        <h1 class="logo-title">Lingo Hero</h1>
        <button class="menu-btn" id="btn-practice">Practice</button>
        <button class="menu-btn blitz" id="btn-blitz">Blitz Mode</button>
      </div>
      <div class="hud hidden" id="hud">
        <div class="top-bar">
             <div class="question-box" id="question-box"></div>
        </div>
        <div class="score-container">
            <div class="score-box">Score: <span id="score">0</span></div>
            <div class="combo-box">x<span id="combo">0</span></div>
        </div>
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
    
    this.menuScreen = this.uiRoot.querySelector("#menu")!;
    this.hud = this.uiRoot.querySelector("#hud")!;
    this.gameOverScreen = this.uiRoot.querySelector("#game-over")!;

    this.laneSystem = new LaneSystem(0, 0); // Will resize immediately
    this.renderer = new Renderer(this.canvas, this.laneSystem);
    this.contentManager = new ContentManager(hostApi);
    this.inputManager = new InputManager(container, (x) => this.getLaneFromX(x));
    
    this.inputManager.onInput((lane) => this.handleInput(lane));
    
    // Improved Button Binding with Touch Support
    this.bindButton("#btn-practice", () => this.startGame(GameMode.PRACTICE));
    this.bindButton("#btn-blitz", () => this.startGame(GameMode.BLITZ));
    this.bindButton("#btn-retry", () => this.startGame(this.mode));
    this.bindButton("#btn-menu", () => this.showMenu());
    
    // Initial Resize to handle DPI properly
    this.handleResize(container);
    window.addEventListener("resize", () => this.handleResize(container));

    this.lastTime = performance.now();
    this.isRunning = true;
    requestAnimationFrame((t) => this.loop(t));
  }

  private bindButton(selector: string, action: () => void) {
    const btn = this.uiRoot.querySelector(selector);
    if (!btn) return;

    // Use a flag to prevent double-firing (touch + click)
    let handled = false;

    const handleEvent = (e: Event) => {
        if (handled) return;
        e.preventDefault();
        e.stopPropagation();
        handled = true;
        setTimeout(() => handled = false, 300); // Debounce
        
        console.log(`[Game] Button clicked: ${selector}`);
        try {
            action();
        } catch (err) {
            console.error(`[Game] Error in button action:`, err);
        }
    };

    btn.addEventListener("touchstart", handleEvent, { passive: false });
    btn.addEventListener("click", handleEvent);
  }

  private handleResize(container: HTMLElement) {
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Set canvas internal resolution to match screen DPI
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    
    // Set CSS size to match container
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Scale context for drawing
    const ctx = this.canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);

    // Tell systems about logical size (CSS pixels)
    this.laneSystem.resize(width, height);
    
    // Ensure speed scales with height (approx 1% of screen height per frame?)
    // Base speed 3 was for approx 600px height. 
    this.speed = Math.max(2, height * 0.005);
  }

  private getLaneFromX(x: number): LaneIndex | null {
    const width = this.canvas.clientWidth;
    // Simple full-screen touch zones for better mobile experience
    // Divide screen into 3 equal columns
    const third = width / 3;
    
    if (x < third) return LaneIndex.Left;
    else if (x < third * 2) return LaneIndex.Center;
    else return LaneIndex.Right;
  }

  private showMenu() {
    this.state = GameState.MENU;
    this.menuScreen.classList.remove("hidden");
    this.hud.classList.add("hidden");
    this.gameOverScreen.classList.add("hidden");
  }

  private async startGame(mode: GameMode) {
    console.log(`[Game] Starting game in mode: ${mode}`);
    
    // Prime TTS on user gesture (important for mobile web)
    // We speak a tiny silence to unlock the synthesis engine
    this.contentManager.speak(" ", "en");

    this.state = GameState.PLAYING;
    this.mode = mode;
    this.score = 0;
    this.combo = 0;
    this.notes = [];
    this.isWaveActive = false;
    this.nextWaveTime = 0; 
    this.currentQuestionText = "";

    this.updateHUD();
    
    this.menuScreen.classList.add("hidden");
    this.gameOverScreen.classList.add("hidden");
    this.hud.classList.remove("hidden");

    // Pre-fetch first wave immediately to verify content works
    try {
        await this.spawnWave();
    } catch (e) {
        console.error("Failed initial spawn", e);
    }
  }

  private gameOver() {
    this.state = GameState.GAME_OVER;
    this.hud.classList.add("hidden");
    this.gameOverScreen.classList.remove("hidden");
    this.uiRoot.querySelector("#final-score")!.textContent = this.score.toString();
  }

  // Helper to clean text: remove parentheses, trim, title case
  private cleanText(text: string): string {
    // Remove content in parentheses e.g. "Cat (animal)" -> "Cat"
    let clean = text.replace(/\s*\(.*?\)\s*/g, "");
    
    // Trim
    clean = clean.trim();
    
    // Title Case (simple)
    if (clean.length > 0) {
        clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    
    // Try to pick first word if it looks like a definition "To run" -> "Run"? 
    // Maybe risky. But user asked for words.
    // If text is very long (> 20 chars) and contains comma, split?
    if (clean.length > 20 && clean.includes(",")) {
        clean = clean.split(",")[0].trim();
    }
    
    return clean;
  }

  private async spawnWave() {
    this.isWaveActive = true;
    
    try {
      const { target, distractors } = await this.contentManager.getWaveContent();
      
      const indices = [0, 1, 2].sort(() => Math.random() - 0.5);
      
      const t0 = target.translations[0];
      
      let audioText = "";
      let audioLang = "";
      let visualText = "";
      
      const foreign = target.translations.find(t => t.language_code !== "en");
      
      if (foreign) {
          this.currentQuestionText = this.cleanText(foreign.text);
          audioText = this.currentQuestionText; // Use clean text for audio too
          audioLang = foreign.language_code;
          
          // Target Note has ENGLISH answer
          const enTrans = target.translations.find(t => t.language_code === "en")?.text || "???";
          visualText = this.cleanText(enTrans);
      } else {
          // Fallback
          this.currentQuestionText = this.cleanText(t0?.text || "?");
          audioText = this.currentQuestionText;
          audioLang = t0?.language_code || "en";
          visualText = this.cleanText(t0?.text || "");
      }

      // Update Question Box
      const qBox = this.uiRoot.querySelector("#question-box");
      if (qBox) qBox.textContent = this.currentQuestionText;

      const targetNote: Note = {
        id: `note-${Date.now()}-t`,
        lane: indices[0],
        y: -100, 
        text: visualText, 
        isTarget: true,
        hit: false,
        missed: false,
        spawnTime: Date.now()
      };
      
      this.contentManager.speak(audioText, audioLang);

      const distractorNotes = distractors.map((d, i) => {
          // Distractors should be in same language as Target Answer (English)
          let dText = "???";
          const dNative = d.translations.find(t => t.language_code === "en");
          
          if (dNative) {
               dText = this.cleanText(dNative.text); 
          } else {
              dText = this.cleanText(d.translations[0]?.text || "???");
          }
          
          return {
            id: `note-${Date.now()}-d-${i}`,
            lane: indices[i + 1],
            y: -100,
            text: dText,
            isTarget: false,
            hit: false,
            missed: false,
            spawnTime: Date.now()
          };
      });

      this.notes.push(targetNote, ...distractorNotes);

    } catch (e) {
      console.error("Failed to spawn wave", e);
      this.isWaveActive = false;
    }
  }

  private handleInput(lane: LaneIndex) {
    // Record press time for visual animation regardless of game state
    this.lanePressTimes[lane] = performance.now();
    
    if (this.state !== GameState.PLAYING) return;

    const hitNote = this.laneSystem.checkHit(lane, this.notes);

    if (hitNote) {
      if (hitNote.isTarget) {
        hitNote.hit = true;
        hitNote.hitTime = performance.now();
        this.score += 100 + (this.combo * 10);
        this.combo++;
        
        if (this.mode === GameMode.PRACTICE) {
           this.notes.forEach(n => {
               if (!n.hit && !n.isTarget) n.hit = true; 
           });
           this.isWaveActive = false;
           this.nextWaveTime = performance.now() + 1000;
           // Clear question text on hit?
           // const qBox = this.uiRoot.querySelector("#question-box");
           // if (qBox) qBox.textContent = "";
        }
      } else {
        hitNote.hit = true; 
        this.combo = 0;
        this.score = Math.max(0, this.score - 50);
      }
    } else {
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
          // Blitz mode
          if (timestamp > this.nextWaveTime) {
              const minTimeGap = 150 / this.speed; 
              
              this.spawnWave();
              
              let dynamicInterval = Math.max(1200, 2500 - (this.score * 5));
              const finalInterval = Math.max(dynamicInterval, minTimeGap * 16);
              
              this.nextWaveTime = timestamp + finalInterval;
          }
      }

      // 2. Physics / Movement 
      const boundsHeight = this.canvas.clientHeight; 
      const strumY = this.laneSystem.getStrumLineY();
      
      this.notes.forEach(note => {
        note.y += this.speed;
        
        if (note.y > boundsHeight + 100) {
            note.missed = true;
        }
        
        if (note.isTarget && note.y > strumY + 50 && !note.hit && !note.missed) {
             this.combo = 0;
             this.updateHUD();
             
             if (this.mode === GameMode.PRACTICE) {
                 this.isWaveActive = false; 
                 this.nextWaveTime = timestamp + 1000;
             }
        }
      });
      
      this.notes = this.notes.filter(n => !n.missed && !(n.hit && n.y > boundsHeight));
    }

    this.renderer.clear();
    
    // Determine active lanes for visual feedback (e.g. pressed within last 150ms)
    const now = performance.now();
    const activeLanes: number[] = [];
    this.lanePressTimes.forEach((t, i) => {
        if (now - t < 150) activeLanes.push(i);
    });
    
    this.renderer.drawLanes(activeLanes);
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
