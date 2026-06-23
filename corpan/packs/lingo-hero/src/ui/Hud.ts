import type { GameEventBus } from "../events";
import type { ProgressionApi } from "../progression";
import { GameMode, type ActiveLanguage } from "../types";

/**
 * Hud — OWNS the DOM overlay (menu / in-game HUD / game-over) for Lingo Hero.
 *
 * STREAM: ui. Foundation MOVED the original uiRoot.innerHTML + updateHUD +
 * showMenu + gameOver out of Game.ts into here. Game.ts just instantiates Hud
 * and provides button callbacks; everything else this class drives off the bus.
 *
 * The ui stream may freely restyle/expand this markup (transitions, level-up
 * banners, streak chips, celebration) WITHOUT touching Game.ts — it subscribes
 * to scoreChange/comboChange/gameStart/menuShown/gameOver and may poll the
 * ProgressionApi for XP/level/multiplier.
 */
export interface HudCallbacks {
  /** User chose a mode on the menu (or "retry"). */
  onStartGame: (mode: GameMode) => void;
  /** User asked to return to the main menu. */
  onShowMenu: () => void;
}

export class Hud {
  private root: HTMLElement;
  private menuScreen: HTMLElement;
  private hudPanel: HTMLElement;
  private gameOverScreen: HTMLElement;
  private questionBox: HTMLElement;
  private scoreEl: HTMLElement;
  private comboEl: HTMLElement;
  private finalScoreEl: HTMLElement;

  private offFns: Array<() => void> = [];
  private lastMode: GameMode = GameMode.PRACTICE;

  constructor(
    container: HTMLElement,
    private bus: GameEventBus,
    private callbacks: HudCallbacks,
    private progression?: ProgressionApi
  ) {
    this.root = document.createElement("div");
    this.root.className = "ui-layer";
    this.root.innerHTML = `
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
    container.appendChild(this.root);

    this.menuScreen = this.root.querySelector("#menu")!;
    this.hudPanel = this.root.querySelector("#hud")!;
    this.gameOverScreen = this.root.querySelector("#game-over")!;
    this.questionBox = this.root.querySelector("#question-box")!;
    this.scoreEl = this.root.querySelector("#score")!;
    this.comboEl = this.root.querySelector("#combo")!;
    this.finalScoreEl = this.root.querySelector("#final-score")!;

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

    this.subscribe();
  }

  /** The prompt text shown in the in-game question box (foreign word). */
  setQuestion(text: string): void {
    this.questionBox.textContent = text;
  }

  /**
   * Apply the resolved active language to the HUD: sets dir=rtl/ltr and a
   * data-lang attribute the ui stream can hang per-language styling off.
   */
  applyLanguage(lang: ActiveLanguage): void {
    this.root.setAttribute("dir", lang.isRTL ? "rtl" : "ltr");
    this.root.setAttribute("data-lang", lang.code);
  }

  dispose(): void {
    for (const off of this.offFns) off();
    this.offFns = [];
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
      }),
      this.bus.on("menuShown", () => {
        this.menuScreen.classList.remove("hidden");
        this.hudPanel.classList.add("hidden");
        this.gameOverScreen.classList.add("hidden");
      }),
      this.bus.on("scoreChange", (e) => {
        this.scoreEl.textContent = e.value.toString();
      }),
      this.bus.on("comboChange", (e) => {
        this.comboEl.textContent = e.value.toString();
      }),
      this.bus.on("gameOver", (e) => {
        this.hudPanel.classList.add("hidden");
        this.gameOverScreen.classList.remove("hidden");
        this.finalScoreEl.textContent = e.finalScore.toString();
        // ui stream may surface progression stats here:
        void this.progression;
      })
    );
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
