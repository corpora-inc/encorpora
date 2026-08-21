/**
 * The renderer.
 *
 * One Canvas2D context, no library, no per-frame gradient or shadow. The whole
 * scene is drawn in virtual units (1000 wide) inside one transform, so shake,
 * zoom punch and camera roll are three numbers on that transform rather than
 * anything the rest of the code has to know about.
 *
 * The play area's aspect is clamped, so a wide desktop window gets stone piers
 * down each side rather than a squashed wall — the window is always a window.
 * It is fitted inside the SAFE rect rather than the canvas, so the HUD clears
 * the notch and the home indicator; the gradient and the piers still bleed to
 * every edge, which is what `viewport-fit=cover` is for. `fx/hud.ts` owns that
 * arithmetic and the HUD's clearance of the host's two corners, because both
 * have to be assertable in a test rather than on a device.
 */
import type { Sim } from "../game/state.ts";
import { VW } from "../game/state.ts";
import { MOLTEN_AT, paddleHalf, tileX, tileY, TRAIL_LEN, wallLeft } from "../game/sim.ts";
import { DROP_SECONDS } from "../game/remix.ts";
import { TRACERY_BLEED } from "../game/wall.ts";
import { MASONRY_HP } from "../game/wall.ts";
import { ruleBanner } from "../game/rules.ts";
import { FORGE_TIMEOUT } from "../game/forge.ts";
import type { Rect } from "../../../../packs/shared/game-chrome/index.ts";
import { NO_INSETS, type Insets } from "../../../../packs/shared/game-chrome/index.ts";
import type { Camera } from "./camera.ts";
import { clamp01, easeOutCubic, easeOutQuint } from "./camera.ts";
import type { HudLayout, View } from "./hud.ts";
import { fitPlay, hudLayout, insetsFromArea } from "./hud.ts";
import type { Particles } from "./particles.ts";
import { Sprites, FONT, TILE_BLEED, roundRect } from "./sprites.ts";
import {
  BALL_CORE,
  BALL_GLOW,
  BG_BOTTOM,
  BG_TOP,
  CHARGE_HOT,
  DANGER,
  INK,
  JEWELS,
  LIGHT_WARM,
  POWER_LOOK,
  STONE,
  STONE_HI,
} from "./palette.ts";

export type Hud = {
  /** 0..1 pulse used by the charge bar when it is full. */
  chargePulse: number;
  dangerPulse: number;
  clearFlash: number;
  waveIntro: number;
};

export class Renderer {
  ctx: CanvasRenderingContext2D;
  sprites = new Sprites();
  dpr = 1;
  scale = 1;
  playX = 0;
  playY = 0;
  playW = 0;
  playH = 0;
  vh = 1400;
  private cssW = 0;
  private cssH = 0;
  private lightSprite: HTMLCanvasElement | null = null;
  private shaftSprite: HTMLCanvasElement | null = null;
  private backdrop: HTMLCanvasElement | null = null;
  private fontCache = new Map<string, string>();
  private t = 0;
  private view: View = fitPlay(360, 640, { x: 0, y: 0, w: 360, h: 640 });
  private insets: Insets = { ...NO_INSETS };
  // The HUD layout only changes on a resize or a new rule, so it is computed
  // then rather than sixty times a second.
  private layout: HudLayout | null = null;
  private layoutBanner = "";

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("mosaic: 2d context unavailable");
    this.ctx = ctx;
  }

  /**
   * Size the canvas and fit the window inside `area`.
   *
   * `area` is the SAFE rect — `safeRect(cssW, cssH)` — and it is required, not
   * defaulted. Made optional, a caller that forgets it compiles and quietly
   * draws the score under the notch, discoverable only on a device that has one.
   *
   * @returns the virtual playfield height the sim should use.
   */
  resize(cssW: number, cssH: number, area: Rect, dprCap = 2): number {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = Math.min(dprCap, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    this.insets = insetsFromArea(cssW, cssH, area);
    const view = fitPlay(cssW, cssH, area);
    this.view = view;
    this.playX = view.playX;
    this.playY = view.playY;
    this.playW = view.playW;
    this.playH = view.playH;
    this.scale = view.scale;
    this.vh = view.vh;
    this.layout = null;
    this.lightSprite = null;
    this.shaftSprite = null;
    this.backdrop = null;
    return this.vh;
  }

  private font(weight: number, size: number): string {
    const key = `${weight}|${size}`;
    let f = this.fontCache.get(key);
    if (!f) {
      f = `${weight} ${size}px ${FONT}`;
      this.fontCache.set(key, f);
    }
    return f;
  }

  private text(
    s: string,
    x: number,
    y: number,
    size: number,
    weight: number,
    colour: string,
    align: CanvasTextAlign = "center",
  ): void {
    const g = this.ctx;
    g.font = this.font(weight, size);
    g.textAlign = align;
    g.textBaseline = "middle";
    g.fillStyle = colour;
    g.fillText(s, x, y);
  }

  /** Screen (CSS px) -> virtual playfield coordinates. */
  toVirtual(clientX: number, clientY: number, rect: DOMRect): { x: number; y: number } {
    const px = clientX - rect.left - this.playX;
    const py = clientY - rect.top - this.playY;
    return { x: px / this.scale, y: py / this.scale };
  }

  draw(sim: Sim, cam: Camera, p: Particles, hud: Hud, dtReal: number): void {
    const g = this.ctx;
    this.t += dtReal;
    this.sprites.build(sim.cellW, sim.cellH, this.dpr);
    if (!this.lightSprite) this.lightSprite = makeLight(this.dpr);
    if (!this.shaftSprite) this.shaftSprite = makeShaft(this.dpr);

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;

    // Room.
    const bg = g.createLinearGradient(0, 0, 0, this.cssH);
    bg.addColorStop(0, BG_TOP);
    bg.addColorStop(1, BG_BOTTOM);
    g.fillStyle = bg;
    g.fillRect(0, 0, this.cssW, this.cssH);
    this.drawPiers();

    const total = Math.max(1, sim.wave.guiltyTotal);
    const clearedFrac = clamp01(sim.broken / total);

    // The world, under the camera: shake, zoom punch, camera roll.
    this.enter(cam);

    if (!this.backdrop) this.backdrop = this.makeBackdrop();
    g.drawImage(this.backdrop, 0, 0, VW, this.vh);
    this.drawLight(clearedFrac, hud.clearFlash);
    p.drawMotes(g, clearedFrac);
    this.drawTracery(sim);
    p.drawSettled(g);
    this.drawTiles(sim, clearedFrac);
    this.drawDanger(sim, hud.dangerPulse);
    p.drawShards(g);
    this.drawBolts(sim);
    this.drawTrails(sim, cam);
    this.drawBalls(sim);
    this.drawPaddle(sim, hud.chargePulse);
    p.drawRings(g);
    p.drawSparks(g);
    p.drawFloaters(g, FONT);
    g.restore();

    // The HUD is chrome, not scenery. It now carries a promise — it clears the
    // host's two 44px corners — and a promise a zoom punch breaks for 100ms is
    // not one: at 1.17x zoom about the centre, a plate resting 78 units from the
    // top of a 1775-unit window travels about 66 units further up, which is
    // straight back under the exit chevron. So it is drawn in the play rect
    // without the camera. The world still shakes; the score no longer does.
    this.enter(null);
    this.drawHud(sim, hud, clearedFrac);
    g.restore();

    // The forge and the game-over card dim everything under them, so they are
    // drawn last and stay with the camera.
    if (sim.forge || sim.phase === "gameover") {
      this.enter(cam);
      if (sim.forge) this.drawForge(sim);
      if (sim.phase === "gameover") this.drawGameOver(sim);
      g.restore();
    }

    // Flash, budgeted in `Camera`.
    if (cam.flash > 0.002) {
      const [r, gg, b] = cam.flashHue;
      g.globalCompositeOperation = "lighter";
      g.fillStyle = `rgba(${r},${gg},${b},${cam.flash})`;
      g.fillRect(0, 0, this.cssW, this.cssH);
      g.globalCompositeOperation = "source-over";
    }
  }

  /**
   * Enter the play rect. With a camera, the world's transform; without one, the
   * same frame held still, which is where the HUD is drawn.
   *
   * Balanced by the caller's `g.restore()`.
   */
  private enter(cam: Camera | null): void {
    const g = this.ctx;
    g.save();
    if (cam) {
      g.translate(this.playX + cam.offX * this.scale, this.playY + cam.offY * this.scale);
      g.scale(this.scale, this.scale);
      g.translate(VW / 2, this.vh / 2);
      g.scale(cam.zoom, cam.zoom);
      g.rotate(cam.rot);
      g.translate(-VW / 2, -this.vh / 2);
    } else {
      g.translate(this.playX, this.playY);
      g.scale(this.scale, this.scale);
    }
    g.beginPath();
    g.rect(-4, -4, VW + 8, this.vh + 8);
    g.clip();
  }

  // -- layers ---------------------------------------------------------------

  /**
   * Stone around the window.
   *
   * The leftover is no longer symmetric: the play rect is fitted inside the SAFE
   * rect, so a left notch inset makes the left pier wider than the right one and
   * a top inset makes the top band taller than the bottom. Each band is drawn
   * from its own measured width, so the stone still reaches every edge of the
   * canvas — full bleed under the notch is exactly what `cover` is for.
   */
  private drawPiers(): void {
    const g = this.ctx;
    const rightX = this.playX + this.playW;
    const rightW = this.cssW - rightX;
    const piers: Array<[number, number]> = [];
    if (this.playX > 1) piers.push([0, this.playX]);
    if (rightW > 1) piers.push([rightX, rightW]);
    if (piers.length) {
      for (const [x, w] of piers) {
        const grad = g.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, "#08071a");
        grad.addColorStop(0.5, STONE);
        grad.addColorStop(1, "#08071a");
        g.fillStyle = grad;
        g.fillRect(x, 0, w, this.cssH);
      }
      g.fillStyle = STONE_HI;
      g.globalAlpha = 0.35;
      const step = Math.max(48, this.cssH / 14);
      for (let y = 0; y < this.cssH; y += step) {
        for (const [x, w] of piers) g.fillRect(x, y, w, 1.5);
      }
      g.globalAlpha = 1;
    }
    const bottomY = this.playY + this.playH;
    const bottomH = this.cssH - bottomY;
    if (this.playY > 1 || bottomH > 1) {
      g.fillStyle = "#0a0918";
      if (this.playY > 1) g.fillRect(0, 0, this.cssW, this.playY);
      if (bottomH > 1) g.fillRect(0, bottomY, this.cssW, bottomH);
    }
  }

  /**
   * The nave: a rose window, a vault, a stone floor. Drawn once per resize into
   * an offscreen canvas and blitted, so all this architecture costs one
   * `drawImage` a frame. Nothing here moves; the light on top of it does.
   */
  private makeBackdrop(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    const W = VW;
    const H = this.vh;
    const px = Math.min(2, this.dpr);
    c.width = Math.round(W * px);
    c.height = Math.round(H * px);
    const g = c.getContext("2d")!;
    g.scale(px, px);

    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#100d28");
    grad.addColorStop(0.45, "#0a0820");
    grad.addColorStop(1, "#050411");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H * 0.36;

    // The great rose: a disc of burning glass behind everything. The wall and
    // its tracery are read as SILHOUETTE against this, which is what a real
    // window looks like from inside a dark nave and what stops the scene
    // reading as shapes floating on black.
    const rose = g.createRadialGradient(cx, cy, 0, cx, cy, W * 1.05);
    rose.addColorStop(0, "rgba(255,232,186,0.62)");
    rose.addColorStop(0.24, "rgba(255,180,120,0.4)");
    rose.addColorStop(0.5, "rgba(190,110,220,0.2)");
    rose.addColorStop(0.78, "rgba(90,60,190,0.09)");
    rose.addColorStop(1, "rgba(40,26,110,0)");
    g.fillStyle = rose;
    g.fillRect(0, 0, W, H);

    // Stone tracery, cut out of that light.
    g.strokeStyle = "rgba(14,10,32,0.72)";
    for (const r of [W * 0.19, W * 0.3, W * 0.43, W * 0.56, W * 0.69]) {
      g.lineWidth = r > W * 0.5 ? 16 : 11;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.lineWidth = 10;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * W * 0.19, cy + Math.sin(a) * W * 0.19);
      g.lineTo(cx + Math.cos(a) * W * 0.69, cy + Math.sin(a) * W * 0.69);
      g.stroke();
    }
    // Cusped foils around the inner ring — the detail that says "cathedral".
    g.lineWidth = 9;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26;
      const rr = W * 0.245;
      g.beginPath();
      g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, W * 0.05, 0, Math.PI * 2);
      g.stroke();
    }
    // A warm edge on the stone where the light wraps it.
    g.strokeStyle = "rgba(255,200,140,0.16)";
    g.lineWidth = 2;
    for (const r of [W * 0.19, W * 0.3, W * 0.43, W * 0.56, W * 0.69]) {
      g.beginPath();
      g.arc(cx, cy, r + 6, 0, Math.PI * 2);
      g.stroke();
    }

    // The vault: a pointed arch springing from the piers, in heavy stone.
    g.strokeStyle = "rgba(11,8,26,0.8)";
    g.lineWidth = 26;
    g.beginPath();
    g.moveTo(W * 0.02, H * 0.66);
    g.quadraticCurveTo(W * 0.5, -H * 0.26, W * 0.98, H * 0.66);
    g.stroke();
    g.strokeStyle = "rgba(255,205,150,0.11)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(W * 0.02, H * 0.66);
    g.quadraticCurveTo(W * 0.5, -H * 0.26, W * 0.98, H * 0.66);
    g.stroke();
    // Piers down each side of the nave.
    g.fillStyle = "rgba(10,7,24,0.85)";
    g.fillRect(0, H * 0.2, W * 0.035, H);
    g.fillRect(W * 0.965, H * 0.2, W * 0.035, H);

    // Floor: courses in perspective, converging on the window.
    const floorY = H * 0.74;
    const fg = g.createLinearGradient(0, floorY, 0, H);
    fg.addColorStop(0, "rgba(24,20,52,0)");
    fg.addColorStop(0.35, "rgba(26,22,56,0.55)");
    fg.addColorStop(1, "rgba(14,11,34,0.9)");
    g.fillStyle = fg;
    g.fillRect(0, floorY, W, H - floorY);
    g.strokeStyle = "rgba(170,155,240,0.07)";
    g.lineWidth = 2;
    for (let i = -6; i <= 6; i++) {
      g.beginPath();
      g.moveTo(cx + i * W * 0.055, floorY);
      g.lineTo(cx + i * W * 0.34, H + 20);
      g.stroke();
    }
    for (let k = 1; k <= 5; k++) {
      const y = floorY + (H - floorY) * Math.pow(k / 5, 1.9);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }

    // Vignette, so the eye goes to the glass and stays there.
    const vg = g.createRadialGradient(cx, cy, W * 0.24, cx, H * 0.5, W * 1.0);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.7)");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    return c;
  }

  /**
   * The light behind the glass. Its strength IS the fraction cleared — the more
   * of the window is gone, the more of the room is lit. No number required.
   */
  private drawLight(cleared: number, clearFlash: number): void {
    const g = this.ctx;
    const cx = VW / 2;
    const cy = this.vh * 0.34;
    const e = easeOutCubic(cleared);
    const a = 0.2 + e * 0.55 + clearFlash * 0.45;
    const r = VW * (0.66 + cleared * 0.4 + clearFlash * 0.34);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = a;
    g.drawImage(this.lightSprite!, cx - r, cy - r, r * 2, r * 2);

    // Shafts, thrown DOWN and OUT into the nave — light comes through a window,
    // it does not radiate in a star. Soft-edged and fading along their length,
    // because a hard-edged triangle reads as a polygon, not as air full of dust.
    const rays = 7;
    const len = this.vh * 1.2;
    for (let i = 0; i < rays; i++) {
      const f = (i + 0.5) / rays - 0.5;
      const ang = f * 0.92 + Math.sin(this.t * 0.13 + i) * 0.035;
      const w = VW * (0.17 + Math.sin(this.t * 0.19 + i * 1.7) * 0.02);
      g.globalAlpha = (0.09 + cleared * 0.15 + clearFlash * 0.26) * (1 - Math.abs(f) * 0.55);
      g.save();
      g.translate(cx + f * VW * 0.3, cy);
      g.rotate(ang);
      g.drawImage(this.shaftSprite!, -w / 2, -len * 0.06, w, len);
      g.restore();
    }

    // The pool the window throws on the floor.
    const poolR = VW * (0.36 + cleared * 0.26);
    g.globalAlpha = 0.1 + e * 0.3 + clearFlash * 0.3;
    g.save();
    g.translate(cx, this.vh * 0.92);
    g.scale(1, 0.26);
    g.drawImage(this.lightSprite!, -poolR, -poolR, poolR * 2, poolR * 2);
    g.restore();

    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  /** The stone frame the window sits in. */
  private drawTracery(sim: Sim): void {
    const g = this.ctx;
    // 16 + 5 for the outer rect + half of its 6-unit stroke = TRACERY_BLEED.
    // `MAX_SWAY_CELLS` is chosen against that sum; keep them together.
    const x = wallLeft(sim) - (TRACERY_BLEED - 8);
    const y = sim.wallY + sim.descent - (TRACERY_BLEED - 8);
    const w = sim.wave.cols * sim.cellW + (TRACERY_BLEED - 8) * 2;
    const h = sim.wave.rows * sim.cellH + (TRACERY_BLEED - 8) * 2;
    g.strokeStyle = "rgba(120,110,180,0.16)";
    g.lineWidth = 2;
    roundRect(g, x, y, w, h, 18);
    g.stroke();
    g.strokeStyle = "rgba(255,225,180,0.07)";
    g.lineWidth = 6;
    roundRect(g, x - 5, y - 5, w + 10, h + 10, 22);
    g.stroke();
  }

  private drawTiles(sim: Sim, cleared: number): void {
    const g = this.ctx;
    const { cellW, cellH } = sim;
    const numSize = Math.min(cellH * 0.56, cellW * 0.38);

    for (const t of sim.wave.tiles) {
      if (!t.alive) continue;
      const x = tileX(sim, t.col);
      // A re-glazed pane falls the last two cells into its slot and fades up as
      // it comes, so it is unmistakably arriving rather than having always been
      // there — and it is not solid until it has landed (see `tileAt`).
      const fall = t.drop > 0 ? t.drop / DROP_SECONDS : 0;
      const y = tileY(sim, t.row) - fall * fall * cellH * 2.6;
      const pane = 1 - fall * 0.75;
      if (fall > 0) g.globalAlpha = pane;
      // Glass variants live at 0, 3 and 4; star at 1; crystal at 2.
      const cut = (t.col + t.row * 2) % 3;
      const kindIndex = t.kind === "star" ? 1 : t.kind === "crystal" ? 2 : cut === 0 ? 0 : cut + 2;
      const sprite = this.sprites.tiles[t.colour]?.[kindIndex];
      if (sprite) {
        g.drawImage(
          sprite,
          x - TILE_BLEED,
          y - TILE_BLEED,
          cellW + TILE_BLEED * 2,
          cellH + TILE_BLEED * 2,
        );
      }

      // Numerals: dark leading on lit glass. Sized to fit the longest face.
      const size = numSize * (t.face.width > 4 ? 0.74 : t.face.width > 3 ? 0.86 : 1);
      this.text(t.face.text, x + cellW / 2, y + cellH / 2 + 1, size, 800, INK);
      g.globalAlpha = 0.28 * pane;
      this.text(t.face.text, x + cellW / 2, y + cellH / 2 - 1.6, size, 800, "#ffffff");
      g.globalAlpha = 1;

      // Masonry remembers what it has taken. Cracks are the only warning that
      // a stone is about to go, and they are the same information as the
      // sound, so neither has to be trusted alone.
      if (!t.guilty && t.hp < MASONRY_HP) {
        const wear = (MASONRY_HP - t.hp) / MASONRY_HP;
        g.strokeStyle = `rgba(8,5,18,${0.35 + wear * 0.45})`;
        g.lineWidth = 1 + wear * 1.6;
        g.beginPath();
        const cx = x + cellW / 2;
        const cy = y + cellH / 2;
        for (let k = 0; k < 2 + Math.round(wear * 3); k++) {
          const a = (k * 2.399 + t.col * 0.7 + t.row * 1.3) % (Math.PI * 2);
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(a) * cellW * 0.42, cy + Math.sin(a) * cellH * 0.42);
        }
        g.stroke();
        g.globalAlpha = wear * 0.3;
        g.fillStyle = "#06040f";
        roundRect(g, x + 2, y + 2, cellW - 4, cellH - 4, 6);
        g.fill();
        g.globalAlpha = 1;
      }

      if (t.hit > 0) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = t.hit * 0.55;
        g.fillStyle = "#ffffff";
        roundRect(g, x + 2, y + 2, cellW - 4, cellH - 4, 6);
        g.fill();
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }
      // Stone that has just caught light. The one thing on the wall that
      // changed while you were looking somewhere else, so it says so loudly.
      if (t.kindle > 0) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = t.kindle * 0.7;
        g.fillStyle = LIGHT_WARM;
        roundRect(g, x + 1, y + 1, cellW - 2, cellH - 2, 6);
        g.fill();
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }

      if (t.warm > 0 && t.guilty) {
        // The glass answers heat. Confirmation only — it never fires far
        // enough ahead of the ball to plan a shot with.
        const glow = this.sprites.glows[t.colour];
        if (glow) {
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = t.warm * 0.3;
          const r = Math.max(cellW, cellH) * 1.15;
          g.drawImage(glow, x + cellW / 2 - r, y + cellH / 2 - r, r * 2, r * 2);
          g.globalAlpha = 1;
          g.globalCompositeOperation = "source-over";
        }
      }
    }

    // A wash of light over the whole window as it opens up.
    if (cleared > 0.02) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = cleared * 0.06;
      g.fillStyle = LIGHT_WARM;
      g.fillRect(wallLeft(sim), sim.wallY + sim.descent, sim.wave.cols * cellW, sim.wave.rows * cellH);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
  }

  private drawDanger(sim: Sim, pulse: number): void {
    if (pulse <= 0.01) return;
    const g = this.ctx;
    const y = sim.paddleY - 96;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = pulse * 0.5;
    g.strokeStyle = DANGER;
    g.lineWidth = 3;
    g.setLineDash([26, 20]);
    g.lineDashOffset = -this.t * 60;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(VW, y);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  private drawTrails(sim: Sim, cam: Camera): void {
    const g = this.ctx;
    if (cam.reduced) return;
    const molten = sim.combo >= MOLTEN_AT;
    const trailColour = molten ? "#dff4ff" : BALL_GLOW;
    g.globalCompositeOperation = "lighter";
    for (const b of sim.balls) {
      if (!b.alive) continue;
      const n = Math.min(TRAIL_LEN, b.trailN);
      if (n < 3) continue;
      for (let i = 1; i < n; i++) {
        const i0 = (b.trailN - i - 1 + TRAIL_LEN * 2) % TRAIL_LEN;
        const i1 = (b.trailN - i + TRAIL_LEN * 2) % TRAIL_LEN;
        const x0 = b.trail[i0 * 2]!;
        const y0 = b.trail[i0 * 2 + 1]!;
        const x1 = b.trail[i1 * 2]!;
        const y1 = b.trail[i1 * 2 + 1]!;
        if (Math.abs(x1 - x0) > VW * 0.5 || Math.abs(y1 - y0) > this.vh * 0.5) continue;
        const f = 1 - i / n;
        g.strokeStyle = trailColour;
        g.globalAlpha = f * f * (molten ? 0.6 : 0.34);
        g.lineWidth = b.r * (molten ? 1.9 : 1.15) * f * f;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  private drawBalls(sim: Sim): void {
    const g = this.ctx;
    const molten = sim.combo >= MOLTEN_AT;
    for (const b of sim.balls) {
      if (!b.alive) continue;
      const halo = this.sprites.ballHalo;
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = molten ? 1 : 0.85;
      const R = b.r * (molten ? 8.4 + Math.sin(this.t * 22) * 0.7 : 5.4);
      g.drawImage(halo, b.x - R, b.y - R, R * 2, R * 2);
      if (molten) {
        g.globalAlpha = 0.75;
        g.drawImage(halo, b.x - R * 0.5, b.y - R * 0.5, R, R);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";

      // Squash along the impact normal: the ball deforms into the thing it hit.
      const s = b.squash;
      g.save();
      g.translate(b.x, b.y);
      if (s > 0.01) {
        const a = Math.atan2(b.sqy, b.sqx);
        g.rotate(a);
        g.scale(1 - 0.42 * s, 1 + 0.34 * s);
      }
      g.fillStyle = BALL_CORE;
      g.beginPath();
      g.arc(0, 0, b.r * (molten ? 1.22 : 1), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = molten ? "rgba(190,235,255,0.95)" : "rgba(255,214,140,0.9)";
      g.beginPath();
      g.arc(0, 0, b.r * 0.62, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  private drawBolts(sim: Sim): void {
    const g = this.ctx;
    if (!sim.bolts.length) return;
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = "#ff9db0";
    g.lineWidth = 5;
    g.lineCap = "round";
    g.beginPath();
    for (const b of sim.bolts) {
      if (!b.alive) continue;
      g.moveTo(b.x, b.y);
      g.lineTo(b.x, b.y + 34);
    }
    g.stroke();
    g.strokeStyle = "#ffffff";
    g.lineWidth = 1.8;
    g.beginPath();
    for (const b of sim.bolts) {
      if (!b.alive) continue;
      g.moveTo(b.x, b.y + 3);
      g.lineTo(b.x, b.y + 26);
    }
    g.stroke();
    g.globalCompositeOperation = "source-over";
  }

  private drawPaddle(sim: Sim, chargePulse: number): void {
    const g = this.ctx;
    const wide = sim.powers.wide > 0;
    const sprite = wide ? this.sprites.paddleWide : this.sprites.paddleBody;
    const half = paddleHalf(sim);
    const w = half * 2;
    const h = sim.paddleH;
    const squash = sim.paddleSquash;

    g.save();
    g.translate(sim.paddleX, sim.paddleY);
    g.scale(1 + squash * 0.13, 1 - squash * 0.34);
    if (sprite) g.drawImage(sprite, -half - 8, -h / 2 - 8, w + 16, h + 16);

    if (chargePulse > 0.01) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = chargePulse * 0.75;
      g.fillStyle = CHARGE_HOT;
      roundRect(g, -half, -h / 2, w, h, h / 2.6);
      g.fill();
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    g.restore();

    // Aim line while serving: a real choice, shown as a real ray.
    if (sim.phase === "serve") {
      const b = sim.balls[0];
      if (b) {
        g.globalCompositeOperation = "lighter";
        g.strokeStyle = BALL_GLOW;
        g.lineWidth = 3;
        g.setLineDash([12, 16]);
        g.lineDashOffset = -this.t * 90;
        g.globalAlpha = 0.65;
        g.beginPath();
        g.moveTo(b.x, b.y);
        g.lineTo(b.x + Math.cos(sim.aim) * 210, b.y + Math.sin(sim.aim) * 210);
        g.stroke();
        g.setLineDash([]);
        const tipX = b.x + Math.cos(sim.aim) * 226;
        const tipY = b.y + Math.sin(sim.aim) * 226;
        g.fillStyle = BALL_GLOW;
        g.beginPath();
        g.arc(tipX, tipY, 6, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }
    }
  }

  // -- hud ------------------------------------------------------------------

  private drawHud(sim: Sim, hud: Hud, cleared: number): void {
    const g = this.ctx;

    // THE RULE. The only instruction the game has.
    const banner = ruleBanner(sim.rule);
    // Where all of this goes is `fx/hud.ts`'s answer, not a column of constants
    // here: it has to clear the host's two corners, and that is arithmetic a
    // test can check at every viewport.
    if (!this.layout || this.layoutBanner !== banner) {
      this.layoutBanner = banner;
      this.layout = hudLayout(this.view, this.insets, banner);
    }
    const L = this.layout;

    const introT = clamp01(hud.waveIntro);
    const pop = 1 + easeOutQuint(1 - introT) * 0 + introT * 0.22;
    g.save();
    g.translate(L.banner.cx, L.banner.cy);
    g.scale(pop, pop);
    const plateW = L.banner.plateW;
    roundRect(g, -plateW / 2, -50, plateW, 100, 16);
    g.fillStyle = "rgba(10,8,26,0.72)";
    g.fill();
    g.strokeStyle = "rgba(255,224,170,0.28)";
    g.lineWidth = 2;
    roundRect(g, -plateW / 2, -50, plateW, 100, 16);
    g.stroke();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.5 + introT * 0.5;
    this.text(banner, 0, 2, 62, 800, "#ffeccb");
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    this.text(banner, 0, 2, 62, 800, "#fff6e4");
    g.restore();

    // Fraction cleared, as a fraction, with the same value drawn as an arc.
    const fx = L.dial.cx;
    const fy = L.dial.cy;
    const fr = L.dial.r;
    g.strokeStyle = "rgba(255,255,255,0.13)";
    g.lineWidth = 6;
    g.beginPath();
    g.arc(fx, fy, fr, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = CHARGE_HOT;
    g.lineWidth = 6;
    g.lineCap = "round";
    g.beginPath();
    g.arc(fx, fy, fr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cleared);
    g.stroke();
    this.text(`${sim.broken}`, fx, fy - 10, 26, 800, "#fff6e4");
    g.strokeStyle = "rgba(255,246,228,0.5)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(fx - 15, fy + 3);
    g.lineTo(fx + 15, fy + 3);
    g.stroke();
    this.text(`${sim.wave.guiltyTotal}`, fx, fy + 16, 22, 700, "rgba(255,246,228,0.75)");

    // Score.
    const rx = L.right.x;
    this.text(String(sim.score), rx, L.right.scoreY, 40, 800, "#fff6e4", "right");
    this.text(
      `${sim.wave.index + 1}`,
      rx,
      L.right.waveY,
      22,
      700,
      "rgba(255,236,203,0.55)",
      "right",
    );
    // The chain. It is the thing that decides whether the ball catches fire, so
    // it is drawn at a size that says so, and it burns white once it has.
    if (sim.combo > 1) {
      const t = clamp01(sim.comboTimer / 2.1);
      const molten = sim.combo >= MOLTEN_AT;
      const size = 34 + Math.min(30, sim.combo * 2.6);
      const colour = molten ? "#eaf8ff" : JEWELS[sim.combo % JEWELS.length]!.glow;
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = (0.3 + t * 0.5) * (molten ? 1 : 0.7);
      this.text(`×${sim.combo}`, rx, L.right.comboY, size * 1.08, 800, colour, "right");
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 0.45 + t * 0.55;
      this.text(`×${sim.combo}`, rx, L.right.comboY, size, 800, colour, "right");
      g.globalAlpha = 1;
    }

    // Beads: how many balls are left, as objects rather than a number.
    for (let i = 0; i < sim.beads; i++) {
      const x = L.beads.x + i * L.beads.step;
      const y = L.beads.y;
      g.fillStyle = BALL_GLOW;
      g.globalAlpha = 0.9;
      g.beginPath();
      g.arc(x, y, L.beads.r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    // Charge: a seam of light along the bottom of the window.
    const cw = L.charge.w;
    const cx = L.charge.x;
    const cy = L.charge.y;
    const ch = L.charge.h;
    const frac = clamp01(sim.charge / sim.chargeMax);
    g.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(g, cx, cy - ch / 2, cw, ch, ch / 2);
    g.fill();
    if (frac > 0) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.6 + hud.chargePulse * 0.4;
      g.fillStyle = CHARGE_HOT;
      roundRect(g, cx, cy - ch / 2, cw * frac, ch, ch / 2);
      g.fill();
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }

    // Active powers, bottom right, as glyphs with a draining ring.
    let px = VW - 46;
    const py = this.vh - 62;
    if (sim.powers.laserShots > 0) {
      this.powerChip(px, py, "laser", sim.powers.laserShots / 24, String(sim.powers.laserShots));
      px -= 74;
    }
    if (sim.powers.wide > 0) {
      this.powerChip(px, py, "wide", sim.powers.wide / 30, null);
      px -= 74;
    }
    if (sim.powers.slow > 0) {
      this.powerChip(px, py, "slow", sim.powers.slow / 20, null);
    }
  }

  private powerChip(x: number, y: number, kind: string, frac: number, label: string | null): void {
    const g = this.ctx;
    const look = POWER_LOOK[kind]!;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.22;
    g.fillStyle = look.glow;
    g.beginPath();
    g.arc(x, y, 26, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.strokeStyle = look.glow;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(frac));
    g.stroke();
    drawPowerGlyph(g, kind, x, y, 15, look.glow);
    if (label) this.text(label, x, y + 33, 17, 800, look.glow);
  }

  // -- the forge ------------------------------------------------------------

  private drawForge(sim: Sim): void {
    const forge = sim.forge!;
    const g = this.ctx;
    const open = clamp01(forge.age / 0.22);

    g.globalAlpha = open * 0.86;
    g.fillStyle = "#05040f";
    g.fillRect(0, 0, VW, this.vh);
    g.globalAlpha = 1;

    // The prompt, burning in.
    const py = this.vh * 0.45;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.4 * open;
    this.text(forge.prompt, VW / 2, py, 104, 800, "#ffd98a");
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    this.text(forge.prompt, VW / 2, py, 100, 800, "#fff6e4");

    // Time left, as a ring under the prompt. No numbers counting down at anyone.
    if (forge.resolving <= 0) {
      const left = clamp01(1 - forge.age / FORGE_TIMEOUT);
      g.strokeStyle = "rgba(255,246,228,0.16)";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(VW / 2 - 150, py + 76);
      g.lineTo(VW / 2 + 150, py + 76);
      g.stroke();
      g.strokeStyle = left > 0.25 ? "#ffd98a" : DANGER;
      g.beginPath();
      g.moveTo(VW / 2 - 150 * left, py + 76);
      g.lineTo(VW / 2 + 150 * left, py + 76);
      g.stroke();
    }

    for (const s of forge.shards) {
      const look = POWER_LOOK[s.power]!;
      const pop = s.pop;
      const dim = s.state === 2 || s.state === -1;
      const win = s.state === 1;
      const scale = (win ? 1 + pop * 0.5 : dim ? 1 - pop * 0.35 : 1) * (0.6 + 0.4 * clamp01(forge.age / 0.2));

      g.save();
      g.translate(s.x, s.y);
      g.scale(scale, scale);
      // A dimmed rune fades DOWN and stays down. It used to fade back to full
      // as `pop` decayed, which meant that a second after a miss the wall of
      // runes looked untouched again and the held reveal read as noise.
      g.globalAlpha = dim ? 1 - clamp01((1 - pop) * 2) * 0.74 : 1;

      // A glass plate cut as a hexagon, in its power's colour.
      g.beginPath();
      const w = 92;
      const h = 68;
      g.moveTo(-w, 0);
      g.lineTo(-w * 0.66, -h);
      g.lineTo(w * 0.66, -h);
      g.lineTo(w, 0);
      g.lineTo(w * 0.66, h);
      g.lineTo(-w * 0.66, h);
      g.closePath();
      g.fillStyle = look.glow;
      g.fill();
      g.strokeStyle = win ? "#ffffff" : "rgba(0,0,0,0.55)";
      g.lineWidth = win ? 6 : 3;
      g.stroke();

      if (win) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = pop * 0.85;
        g.fillStyle = "#ffffff";
        g.fill();
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }

      this.text(s.text, 0, -8, 46, 800, look.ink);
      drawPowerGlyph(g, s.power, 0, 40, 15, look.ink);
      g.restore();
    }
  }

  private drawGameOver(sim: Sim): void {
    const g = this.ctx;
    g.fillStyle = "rgba(4,3,14,0.78)";
    g.fillRect(0, 0, VW, this.vh);
    this.text(String(sim.score), VW / 2, this.vh * 0.36, 120, 800, "#fff6e4");

    // Waves cleared and best chain, as glyph rows rather than a results table.
    const y = this.vh * 0.48;
    for (let i = 0; i < Math.min(12, sim.cleared); i++) {
      g.fillStyle = JEWELS[i % JEWELS.length]!.glass;
      roundRect(g, VW / 2 - Math.min(12, sim.cleared) * 15 + i * 30, y, 22, 22, 5);
      g.fill();
    }

    const pulse = 0.6 + Math.sin(this.t * 4) * 0.25;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = pulse * 0.5;
    g.fillStyle = BALL_GLOW;
    g.beginPath();
    g.arc(VW / 2, this.vh * 0.68, 64, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#0a0818";
    g.beginPath();
    g.arc(VW / 2, this.vh * 0.68, 52, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff6e4";
    g.beginPath();
    g.moveTo(VW / 2 - 16, this.vh * 0.68 - 22);
    g.lineTo(VW / 2 + 26, this.vh * 0.68);
    g.lineTo(VW / 2 - 16, this.vh * 0.68 + 22);
    g.closePath();
    g.fill();
  }
}

/** Power identity, drawn. No icon font, no emoji, no words. */
function drawPowerGlyph(
  g: CanvasRenderingContext2D,
  kind: string,
  x: number,
  y: number,
  r: number,
  colour: string,
): void {
  g.save();
  g.translate(x, y);
  g.fillStyle = colour;
  g.strokeStyle = colour;
  g.lineWidth = 3;
  switch (kind) {
    case "multi":
      for (const [dx, dy] of [
        [-r * 0.85, r * 0.35],
        [0, -r * 0.55],
        [r * 0.85, r * 0.35],
      ] as [number, number][]) {
        g.beginPath();
        g.arc(dx, dy, r * 0.42, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "laser":
      for (const dx of [-r * 0.55, r * 0.55]) {
        g.beginPath();
        g.moveTo(dx, -r);
        g.lineTo(dx, r);
        g.stroke();
      }
      break;
    case "wide":
      g.beginPath();
      g.moveTo(-r, 0);
      g.lineTo(r, 0);
      g.stroke();
      g.beginPath();
      g.moveTo(-r, 0);
      g.lineTo(-r * 0.45, -r * 0.5);
      g.lineTo(-r * 0.45, r * 0.5);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(r, 0);
      g.lineTo(r * 0.45, -r * 0.5);
      g.lineTo(r * 0.45, r * 0.5);
      g.closePath();
      g.fill();
      break;
    case "slow":
      g.beginPath();
      g.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -r * 0.6);
      g.moveTo(0, 0);
      g.lineTo(r * 0.45, 0);
      g.stroke();
      break;
  }
  g.restore();
}

/** A soft wedge of light: wide at the bottom, fading at the edges and the tip. */
function makeShaft(dpr: number): HTMLCanvasElement {
  const w = 192;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  const across = g.createLinearGradient(0, 0, w, 0);
  across.addColorStop(0, "rgba(255,226,180,0)");
  across.addColorStop(0.5, "rgba(255,232,196,1)");
  across.addColorStop(1, "rgba(255,226,180,0)");
  g.fillStyle = across;
  // A tapering trapezoid, so the shaft opens as it falls.
  g.beginPath();
  g.moveTo(w * 0.38, 0);
  g.lineTo(w * 0.62, 0);
  g.lineTo(w, h);
  g.lineTo(0, h);
  g.closePath();
  g.save();
  g.clip();
  g.fillRect(0, 0, w, h);
  g.restore();
  // Fade along the length.
  const down = g.createLinearGradient(0, 0, 0, h);
  down.addColorStop(0, "rgba(0,0,0,0)");
  down.addColorStop(0.42, "rgba(0,0,0,0.25)");
  down.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = down;
  g.fillRect(0, 0, w, h);
  return c;
}

function makeLight(dpr: number): HTMLCanvasElement {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,238,205,1)");
  grad.addColorStop(0.35, "rgba(255,210,150,0.42)");
  grad.addColorStop(0.72, "rgba(180,140,255,0.12)");
  grad.addColorStop(1, "rgba(120,90,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}
