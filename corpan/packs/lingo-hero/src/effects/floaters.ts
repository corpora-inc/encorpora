import { rgba, type Rgb, COLORS } from "./palette";

/**
 * Transient overlay flourishes drawn in screen space: expanding shockwave rings
 * on hits, floating "+N" score popups, and big combo-milestone banners that
 * punch in, hold, and fade. All pooled-free but bounded by gameplay cadence
 * (a handful live at once), so plain arrays with splice are fine here.
 */

interface Shockwave {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: Rgb;
  maxR: number;
  width: number;
}

interface Popup {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: Rgb;
  size: number;
}

interface Banner {
  life: number;
  maxLife: number;
  text: string;
  sub: string;
  color: Rgb;
}

export class Floaters {
  private waves: Shockwave[] = [];
  private popups: Popup[] = [];
  private banners: Banner[] = [];

  shockwave(x: number, y: number, color: Rgb, scale = 1): void {
    this.waves.push({
      x,
      y,
      life: 0.55 * scale,
      maxLife: 0.55 * scale,
      color,
      maxR: 70 * scale,
      width: 6 * scale,
    });
    if (this.waves.length > 24) this.waves.shift();
  }

  popup(x: number, y: number, text: string, color: Rgb, size = 28): void {
    this.popups.push({
      x,
      y,
      vy: -70,
      life: 0.9,
      maxLife: 0.9,
      text,
      color,
      size,
    });
    if (this.popups.length > 16) this.popups.shift();
  }

  banner(text: string, sub: string, color: Rgb): void {
    this.banners.push({ life: 1.5, maxLife: 1.5, text, sub, color });
    if (this.banners.length > 3) this.banners.shift();
  }

  get hasBanner(): boolean {
    return this.banners.length > 0;
  }

  update(dt: number): void {
    const step = Math.min(dt, 0.05);
    for (let i = this.waves.length - 1; i >= 0; i--) {
      this.waves[i].life -= step;
      if (this.waves[i].life <= 0) this.waves.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= step;
      p.y += p.vy * step;
      p.vy *= Math.pow(0.9, step * 60);
      if (p.life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.banners.length - 1; i >= 0; i--) {
      this.banners[i].life -= step;
      if (this.banners[i].life <= 0) this.banners.splice(i, 1);
    }
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Shockwaves (additive).
    if (this.waves.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const wv of this.waves) {
        const t = wv.life / wv.maxLife; // 1 -> 0
        const p = 1 - t;
        const r = wv.maxR * easeOutCubic(p);
        const a = t * t;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(wv.color, a * 0.9);
        ctx.lineWidth = wv.width * t;
        ctx.stroke();
        // Inner soft core
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, r * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(COLORS.WHITE, a * 0.5);
        ctx.lineWidth = wv.width * 0.5 * t;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Score popups (normal compositing so text stays legible).
    if (this.popups.length) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of this.popups) {
        const t = p.life / p.maxLife;
        const a = t > 0.7 ? (1 - t) / 0.3 : t / 0.7; // fade in then out
        const pop = p.life > p.maxLife - 0.12 ? 1.4 - (p.maxLife - p.life) * 3 : 1;
        const size = p.size * Math.max(1, pop);
        ctx.font = `900 ${size}px 'Russo One', system-ui, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = rgba({ r: 0, g: 0, b: 0 }, a * 0.6);
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = rgba(p.color, a);
        ctx.shadowColor = rgba(p.color, a);
        ctx.shadowBlur = 12;
        ctx.fillText(p.text, p.x, p.y);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // Combo milestone banners (center screen, punchy).
    if (this.banners.length) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const cy = h * 0.36;
      for (const b of this.banners) {
        const t = b.life / b.maxLife; // 1 -> 0
        const inT = 1 - t; // 0 -> 1
        // Punch-in scale: overshoot then settle, then drift up + fade.
        let scale: number;
        let alpha: number;
        let yOff = 0;
        if (inT < 0.18) {
          const k = inT / 0.18;
          scale = 0.4 + easeOutBack(k) * 0.7;
          alpha = k;
        } else if (t < 0.3) {
          const k = t / 0.3;
          scale = 1.1;
          alpha = k;
          yOff = -(1 - k) * 30;
        } else {
          scale = 1.1;
          alpha = 1;
        }
        ctx.save();
        ctx.translate(w / 2, cy + yOff);
        ctx.scale(scale, scale);
        const big = `900 54px 'Russo One', system-ui, sans-serif`;
        ctx.font = big;
        ctx.lineWidth = 8;
        ctx.strokeStyle = rgba({ r: 0, g: 0, b: 0 }, alpha * 0.55);
        ctx.strokeText(b.text, 0, 0);
        ctx.fillStyle = rgba(b.color, alpha);
        ctx.shadowColor = rgba(b.color, alpha);
        ctx.shadowBlur = 24;
        ctx.fillText(b.text, 0, 0);
        ctx.shadowBlur = 0;
        if (b.sub) {
          ctx.font = `700 20px 'Russo One', system-ui, sans-serif`;
          ctx.fillStyle = rgba(COLORS.WHITE, alpha * 0.85);
          ctx.fillText(b.sub, 0, 40);
        }
        ctx.restore();
      }
      ctx.restore();
    }
  }

  clear(): void {
    this.waves.length = 0;
    this.popups.length = 0;
    this.banners.length = 0;
  }
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
