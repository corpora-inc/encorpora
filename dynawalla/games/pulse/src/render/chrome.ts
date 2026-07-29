/**
 * Title, pause, the two corner buttons and the perf readout.
 *
 * All canvas, no DOM: one renderer means the chrome cannot drift away from the
 * game's register, and there is no second styling system to keep in sync.
 *
 * Copy budget: the word PULSE, and nothing else. A ring contracting on the beat is
 * how the title says "press", in every language.
 */

import type { Rect } from "../../../../packs/shared/game-chrome/index.ts";
import { clamp01, outCubic, outQuint } from "../juice/ease.ts";
import { glow } from "./glow.ts";
import { INK, type Ink } from "./palette.ts";
import { neon } from "./text.ts";

export type ChromeButton = "mute" | "pause";

const BTN = { size: 34, gap: 10, margin: 16 };
const BTN_COMPACT = { size: 30, gap: 8, margin: 12 };

function metrics(compact: boolean): typeof BTN {
  return compact ? BTN_COMPACT : BTN;
}

/**
 * Pause and mute, bottom-right.
 *
 * `area` is the safe rect and is REQUIRED, for the same reason it is required on
 * `computeLayout`: measured from the raw canvas these two buttons sit in the home
 * indicator's strip on every modern phone, where a swipe up is the system's gesture
 * and not ours. Optional, a caller that forgets it compiles and the bug only exists
 * on hardware. `hitButton` reads the same rect, so the touch target can never drift
 * away from the drawn square.
 */
export function buttonRect(
  i: number,
  area: Rect,
  compact: boolean,
): { x: number; y: number; s: number } {
  const m = metrics(compact);
  const s = m.size;
  const x = area.x + area.w - m.margin - s - i * (s + m.gap);
  const y = area.y + area.h - m.margin - s;
  return { x, y, s };
}

export function hitButton(x: number, y: number, area: Rect, compact: boolean): ChromeButton | null {
  for (let i = 0; i < 2; i++) {
    const r = buttonRect(i, area, compact);
    const pad = 6;
    if (x >= r.x - pad && x <= r.x + r.s + pad && y >= r.y - pad && y <= r.y + r.s + pad) {
      return i === 0 ? "pause" : "mute";
    }
  }
  return null;
}

export function drawButtons(
  ctx: CanvasRenderingContext2D,
  area: Rect,
  compact: boolean,
  muted: boolean,
  paused: boolean,
): void {
  const draw = (i: number, fn: (x: number, y: number, s: number) => void, ink: Ink, on: boolean): void => {
    const r = buttonRect(i, area, compact);
    const c = INK[ink];
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${on ? 0.5 : 0.24})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.s, r.s);
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${on ? 0.9 : 0.45})`;
    ctx.lineWidth = 1.8;
    fn(r.x, r.y, r.s);
  };

  draw(
    0,
    (x, y, s) => {
      const cx = x + s / 2;
      const cy = y + s / 2;
      ctx.beginPath();
      if (paused) {
        ctx.moveTo(cx - s * 0.14, cy - s * 0.2);
        ctx.lineTo(cx + s * 0.22, cy);
        ctx.lineTo(cx - s * 0.14, cy + s * 0.2);
        ctx.closePath();
      } else {
        ctx.moveTo(cx - s * 0.14, cy - s * 0.2);
        ctx.lineTo(cx - s * 0.14, cy + s * 0.2);
        ctx.moveTo(cx + s * 0.14, cy - s * 0.2);
        ctx.lineTo(cx + s * 0.14, cy + s * 0.2);
      }
      ctx.stroke();
    },
    "cyan",
    true,
  );

  draw(
    1,
    (x, y, s) => {
      const cx = x + s / 2;
      const cy = y + s / 2;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.24, cy - s * 0.1);
      ctx.lineTo(cx - s * 0.12, cy - s * 0.1);
      ctx.lineTo(cx + s * 0.02, cy - s * 0.24);
      ctx.lineTo(cx + s * 0.02, cy + s * 0.24);
      ctx.lineTo(cx - s * 0.12, cy + s * 0.1);
      ctx.lineTo(cx - s * 0.24, cy + s * 0.1);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      if (muted) {
        ctx.moveTo(cx + s * 0.12, cy - s * 0.12);
        ctx.lineTo(cx + s * 0.28, cy + s * 0.12);
        ctx.moveTo(cx + s * 0.28, cy - s * 0.12);
        ctx.lineTo(cx + s * 0.12, cy + s * 0.12);
      } else {
        ctx.arc(cx + s * 0.04, cy, s * 0.18, -0.9, 0.9);
        ctx.moveTo(cx + s * 0.04 + s * 0.29 * Math.cos(0.9), cy + s * 0.29 * Math.sin(-0.9));
        ctx.arc(cx + s * 0.04, cy, s * 0.29, -0.9, 0.9);
      }
      ctx.stroke();
    },
    muted ? "rose" : "cyan",
    !muted,
  );
}

/** The title: the word, a live scope, and rings contracting on an 84 BPM pulse. */
export function drawTitle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  area: Rect,
  t: number,
  best: number,
  compact: boolean,
): void {
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h * 0.44;
  const bpm = 84;
  const beat = (t * bpm) / 60;
  const frac = beat - Math.floor(beat);
  const pulse = Math.pow(1 - frac, 2.6);

  ctx.globalCompositeOperation = "lighter";

  // Idle scope: a procedural waveform so the display looks alive before audio can
  // legally start.
  ctx.beginPath();
  for (let i = 0; i <= 240; i++) {
    const x = (i / 240) * w;
    const p = i / 240;
    const y =
      area.y +
      area.h * 0.78 +
      Math.sin(p * 26 + t * 2.1) * area.h * 0.02 * (0.4 + pulse) +
      Math.sin(p * 61 - t * 3.4) * area.h * 0.012 +
      Math.sin(p * 7 + t * 0.9) * area.h * 0.02;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = `rgba(90,240,255,${(0.22 + pulse * 0.2).toFixed(3)})`;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Contracting rings — the universal "press".
  for (let k = 0; k < 3; k++) {
    const ph = (beat + k * 0.33) % 1;
    const r = (compact ? 120 : 190) * (1 - outCubic(ph)) + 26;
    const a = (1 - ph) * 0.62;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(168,140,255,${a.toFixed(3)})`;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
  glow(ctx, "violet", cx, cy, (compact ? 90 : 140) * (0.7 + pulse * 0.4), 0.3 + pulse * 0.28);

  const size = compact ? 52 : Math.min(120, w * 0.13);
  ctx.save();
  ctx.translate(cx, cy);
  const s = 1 + pulse * 0.035;
  ctx.scale(s, s);
  neon(ctx, "PULSE", 0, 0, size, "white", { alpha: 0.98, bloom: 1.6 });
  ctx.restore();

  if (best > 0) {
    neon(ctx, best.toLocaleString("en-US"), cx, cy + size * 0.92, compact ? 15 : 20, "cyan", {
      alpha: 0.5,
      mono: true,
    });
  }
}

export function drawPause(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  area: Rect,
  k: number,
): void {
  ctx.globalCompositeOperation = "source-over";
  // The scrim covers the whole frame — a background may bleed under the notch,
  // and should. The glyph is centred on the safe rect instead.
  ctx.fillStyle = `rgba(4,5,10,${(0.72 * k).toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  const s = Math.min(64, w * 0.08);
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const g = outQuint(clamp01(k));
  ctx.strokeStyle = `rgba(235,245,255,${(0.85 * k).toFixed(3)})`;
  ctx.lineWidth = s * 0.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.28, cy - s * 0.4 * g);
  ctx.lineTo(cx - s * 0.28, cy + s * 0.4 * g);
  ctx.moveTo(cx + s * 0.28, cy - s * 0.4 * g);
  ctx.lineTo(cx + s * 0.28, cy + s * 0.4 * g);
  ctx.stroke();
}

export type PerfStats = {
  fps: number;
  frameMs: number;
  p95Ms: number;
  drawMs: number;
  particles: number;
  notes: number;
  latencyMs: number;
  calibrationMs: number;
};

export function drawPerf(ctx: CanvasRenderingContext2D, area: Rect, s: PerfStats): void {
  const lines = [
    `${s.fps.toFixed(1)} fps`,
    `frame ${s.frameMs.toFixed(2)} ms  p95 ${s.p95Ms.toFixed(2)}`,
    `draw ${s.drawMs.toFixed(2)} ms`,
    `parts ${s.particles}  notes ${s.notes}`,
    `latency ${(s.latencyMs * 1000).toFixed(1)} ms  cal ${s.calibrationMs.toFixed(0)} ms`,
  ];
  // Developer overlay (`?perf`), tucked under the host's help button rather
  // than behind it.
  const right = area.x + area.w;
  const top = area.y + 64;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(right - 214, top, 206, 12 + lines.length * 15);
  ctx.globalCompositeOperation = "lighter";
  let y = top + 16;
  for (const l of lines) {
    neon(ctx, l, right - 202, y, 12, s.fps < 55 ? "rose" : "lime", {
      align: "left",
      mono: true,
      alpha: 0.9,
      bloom: 0,
    });
    y += 15;
  }
}
