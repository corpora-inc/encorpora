import { rgba, type Rgb, COLORS } from "./palette";

/**
 * Full-screen scene transitions: a directional energy wipe + flash used when
 * moving MENU <-> PLAYING <-> GAME_OVER. The HUD owns the DOM panels; this layer
 * adds the cinematic punch over the canvas so the swap never feels abrupt.
 */
type Kind = "in" | "out" | "flash";

interface Transition {
  kind: Kind;
  life: number;
  maxLife: number;
  color: Rgb;
}

export class Transitions {
  private active: Transition[] = [];

  /** Bright impact flash (e.g. game over). */
  flash(color: Rgb = COLORS.WHITE, dur = 0.45): void {
    this.active.push({ kind: "flash", life: dur, maxLife: dur, color });
    this.trim();
  }

  /** Energy wipe that sweeps in then clears (scene enter). */
  wipeIn(color: Rgb, dur = 0.6): void {
    this.active.push({ kind: "in", life: dur, maxLife: dur, color });
    this.trim();
  }

  /** Energy wipe that closes over the screen (scene exit). */
  wipeOut(color: Rgb, dur = 0.5): void {
    this.active.push({ kind: "out", life: dur, maxLife: dur, color });
    this.trim();
  }

  private trim(): void {
    if (this.active.length > 4) this.active.shift();
  }

  get busy(): boolean {
    return this.active.length > 0;
  }

  update(dt: number): void {
    const step = Math.min(dt, 0.05);
    for (let i = this.active.length - 1; i >= 0; i--) {
      this.active[i].life -= step;
      if (this.active[i].life <= 0) this.active.splice(i, 1);
    }
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.active.length) return;
    // Overscan so full-screen fills still cover the corners under screen-shake
    // (the effects layer may be drawn through a translated/rotated transform).
    const M = 40;
    ctx.save();
    for (const tr of this.active) {
      const t = tr.life / tr.maxLife; // 1 -> 0
      const p = 1 - t; // 0 -> 1
      if (tr.kind === "flash") {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = rgba(tr.color, t * t * 0.9);
        ctx.fillRect(-M, -M, w + M * 2, h + M * 2);
      } else if (tr.kind === "in") {
        // A bright bar sweeps top->bottom revealing the scene (curtain rising).
        const edge = easeInOutCubic(p) * h * 1.2;
        ctx.globalCompositeOperation = "source-over";
        const g = ctx.createLinearGradient(0, edge - h, 0, edge);
        g.addColorStop(0, rgba({ r: 6, g: 8, b: 14 }, 1));
        g.addColorStop(0.85, rgba({ r: 6, g: 8, b: 14 }, 1));
        g.addColorStop(1, rgba(tr.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-M, edge - h, w + M * 2, h);
        // Leading glow line.
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = rgba(tr.color, t * 0.8);
        ctx.fillRect(-M, edge - 4, w + M * 2, 8);
      } else {
        // out: curtain falls from top to cover screen.
        const edge = easeInOutCubic(p) * h * 1.05;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = rgba({ r: 6, g: 8, b: 14 }, 1);
        ctx.fillRect(-M, -M, w + M * 2, edge + M);
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = rgba(tr.color, t * 0.7 + 0.2);
        ctx.fillRect(-M, edge - 6, w + M * 2, 10);
      }
    }
    ctx.restore();
  }

  clear(): void {
    this.active.length = 0;
  }
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
