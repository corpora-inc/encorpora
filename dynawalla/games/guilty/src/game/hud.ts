/**
 * Head-up display.
 *
 * The equation lives in the *world*, at the top of the trench, because the
 * husks are born out of it — that fan-out is the entire tutorial. Everything
 * else is deliberately tiny and in the corners: score, lives, and a focus bar
 * one pixel thick along the bottom edge. Nothing explains anything.
 */

import { project } from "../core/camera.ts";
import { EQUATION_Y, SHIP_Y } from "../core/config.ts";
import { C, rgba } from "../core/palette.ts";
import { drawGlow, drawGlyph, getGlyph } from "../render/bake.ts";
import { clamp, ease } from "../render/draw.ts";
import type { World } from "./world.ts";

const UI_FONT = `700 %SIZE%px system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
const font = (size: number): string => UI_FONT.replace("%SIZE%", String(Math.round(size)));

export function drawEquation(world: World): void {
  const q = world.question;
  if (!q) return;
  const { ctx, cam } = world;
  const age = world.time - world.askedAt;
  const pop = ease.outBack(clamp(age / 0.42, 0, 1));
  const bob = Math.sin(world.time * 1.3) * 1.6;
  const p = project(cam, 0, EQUATION_Y + bob, 0);
  const glyphMetrics = getGlyph(q.prompt, C.amber, 800);
  // A two-step prompt is three times the width of "8 + 5", so the type size
  // fits the *sprite* to the viewport rather than trusting a constant.
  const widthLimited = (world.w * 0.9 * 92) / glyphMetrics.w;
  const size = Math.min(world.h * 0.085, widthLimited) * (0.55 + pop * 0.45);

  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.amber, p.x, p.y, size * 2.2, 0.05 + (1 - clamp(age / 0.6, 0, 1)) * 0.14);
  // A hair of chromatic split while it lands — two cheap blits of one sprite.
  if (age < 0.3 && !world.reduced) {
    const k = (1 - age / 0.3) * size * 0.07;
    ctx.globalAlpha = 0.32;
    drawGlyph(ctx, getGlyph(q.prompt, C.hostile, 800), p.x - k, p.y, size);
    drawGlyph(ctx, getGlyph(q.prompt, C.plankton, 800), p.x + k, p.y, size);
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = "source-over";
  drawGlyph(ctx, glyphMetrics, p.x, p.y, size);
}

export function drawHud(world: World): void {
  const { ctx, w, h } = world;
  const pad = Math.max(14, Math.min(w, h) * 0.045);

  // Lives — small ship silhouettes, top left.
  for (let i = 0; i < world.lives; i++) {
    const x = pad + i * 20;
    const y = pad;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + 6.5, y + 6);
    ctx.lineTo(x, y + 2.5);
    ctx.lineTo(x - 6.5, y + 6);
    ctx.closePath();
    ctx.fillStyle = rgba(C.ship, 0.92);
    ctx.fill();
  }

  // Score — top right, warm, with a soft halo instead of a shadow pass.
  const scoreText = String(Math.round(world.displayScore));
  const size = Math.max(20, Math.min(w, h) * 0.052);
  ctx.font = font(size);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.amber, w - pad - ctx.measureText(scoreText).width / 2, pad, size * 1.5, 0.1);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = C.amber;
  ctx.fillText(scoreText, w - pad, pad);

  // Wave, small and quiet beneath the score.
  ctx.font = font(size * 0.42);
  ctx.fillStyle = rgba(C.cyan, 0.55);
  ctx.fillText(`WAVE ${world.wave}`, w - pad, pad + size * 0.85);

  // Combo, beside the ship, only once it means something.
  if (world.combo >= 2) {
    const p = project(world.cam, world.ship.x, SHIP_Y + 30, 0);
    const grow = 1 + Math.min(0.7, world.combo * 0.04);
    const cs = Math.max(16, Math.min(w, h) * 0.036) * grow;
    ctx.font = font(cs);
    ctx.textAlign = "center";
    ctx.fillStyle = rgba(C.cyan, 0.5 + Math.min(0.45, world.combo * 0.03));
    ctx.fillText(`×${world.combo}`, p.x, p.y);
  }

  drawFocusBar(world);
  drawBanner(world);
  if (world.showStats) drawStats(world);
  ctx.textAlign = "left";
}

function drawFocusBar(world: World): void {
  const { ctx, w, h } = world;
  const full = world.focus >= 1;
  const barH = full ? 5 : 3;
  const y = h - barH - 2;
  const half = (w * 0.5 - 12) * clamp(world.focus, 0, 1);
  ctx.fillStyle = rgba(full ? C.white : C.ship, full ? 0.55 + Math.sin(world.time * 8) * 0.3 : 0.42);
  ctx.fillRect(w / 2 - half, y, half * 2, barH);
  if (world.focusT > 0) {
    // Burning down: the bar drains from the middle out, in the focus colour.
    const t = clamp(world.focusT / 2.6, 0, 1);
    ctx.fillStyle = rgba(C.plankton, 0.7);
    ctx.fillRect(w / 2 - (w * 0.5 - 12) * t, y, (w - 24) * t, barH);
  }
}

function drawBanner(world: World): void {
  if (world.bannerT <= 0 || !world.banner) return;
  const { ctx, w, h } = world;
  const t = clamp(world.bannerT / 1.5, 0, 1);
  const pop = ease.outCubic(clamp((1.5 - world.bannerT) / 0.3, 0, 1));
  const size = Math.min(w * 0.1, h * 0.062) * (0.7 + pop * 0.3);
  // Low in the frame: the top third is where the problem and the husks live,
  // and a banner across them would hide the only thing that matters.
  const y = h * 0.66;
  ctx.globalAlpha = Math.min(1, t * 2) * 0.9;
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.cyan, w / 2, y, size * 3.4, 0.12);
  ctx.globalCompositeOperation = "source-over";
  ctx.font = font(size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = C.white;
  ctx.fillText(world.banner, w / 2, y);
  if (world.bannerSub) {
    ctx.font = font(size * 0.4);
    ctx.fillStyle = rgba(C.cyan, 0.75);
    ctx.fillText(world.bannerSub, w / 2, y + size * 0.85);
  }
  ctx.globalAlpha = 1;
}

export function drawTitle(world: World): void {
  const { ctx, w, h } = world;
  const t = clamp(world.phaseT / 0.9, 0, 1);
  const size = Math.min(w * 0.22, h * 0.16);
  const y = h * 0.4;
  ctx.globalAlpha = ease.outCubic(t);
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.amber, w / 2, y, size * 1.9, 0.09);
  ctx.globalCompositeOperation = "source-over";
  drawGlyph(ctx, getGlyph("GUILTY", C.amber, 900), w / 2, y, size * ease.outBack(clamp(t, 0, 1)));

  ctx.font = font(Math.max(13, size * 0.13));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(C.cyan, 0.5 + Math.sin(world.time * 3) * 0.28);
  ctx.fillText(world.touch ? "TAP TO BEGIN" : "PRESS ANY KEY", w / 2, y + size * 0.72);
  if (world.best > 0) {
    ctx.fillStyle = rgba(C.amber, 0.45);
    ctx.font = font(Math.max(11, size * 0.1));
    ctx.fillText(`BEST ${world.best}`, w / 2, y + size * 0.95);
  }
  ctx.globalAlpha = 1;
}

export function drawGameOver(world: World): void {
  const { ctx, w, h } = world;
  const t = clamp(world.phaseT / 0.8, 0, 1);
  ctx.fillStyle = rgba("#02060c", 0.55 * t);
  ctx.fillRect(0, 0, w, h);
  const size = Math.min(w * 0.16, h * 0.1);
  const y = h * 0.38;
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.hostile, w / 2, y, size * 2.4, 0.12 * t);
  ctx.globalCompositeOperation = "source-over";
  ctx.font = font(size * 0.62);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = t;
  ctx.fillStyle = rgba(C.hostile, 0.9);
  ctx.fillText("THE TRENCH TAKES YOU", w / 2, y);

  ctx.font = font(size * 1.1);
  ctx.fillStyle = C.amber;
  ctx.fillText(String(world.score), w / 2, y + size * 1.05);
  ctx.font = font(size * 0.3);
  ctx.fillStyle = rgba(C.cyan, 0.6);
  ctx.fillText(
    `BEST ${world.best}   ·   WAVE ${world.wave}   ·   BEST RUN ×${world.bestCombo}`,
    w / 2,
    y + size * 1.75,
  );
  ctx.fillStyle = rgba(C.white, 0.35 + Math.sin(world.time * 3) * 0.25);
  ctx.font = font(size * 0.32);
  ctx.fillText(world.touch ? "TAP TO DIVE AGAIN" : "PRESS ANY KEY", w / 2, y + size * 2.5);
  ctx.globalAlpha = 1;
}

/** Second wind: the run is over unless one more answer lands. */
export function drawSecondWind(world: World): void {
  const { ctx, w, h } = world;
  const t = clamp(world.phaseT / 0.6, 0, 1);
  ctx.fillStyle = rgba("#01040a", 0.42 * t);
  ctx.fillRect(0, 0, w, h);
  const size = Math.min(w * 0.1, h * 0.06);
  ctx.font = font(size * 0.5);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(C.hostile, 0.6 + Math.sin(world.time * 4) * 0.3);
  // Above the ship, under the action: the husks stay readable.
  ctx.fillText("ONE MORE", w / 2, h * 0.8);
}

function drawStats(world: World): void {
  const { ctx, h } = world;
  const s = frameStats(world);
  ctx.font = font(12);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(140,255,220,0.75)";
  ctx.fillText(
    `${s.fps.toFixed(1)} fps · present ${s.present.toFixed(2)}ms (p95 ${s.p95.toFixed(1)}) · cost ${s.cost.toFixed(2)}ms · p${s.particles} · q${world.quality.toFixed(2)}`,
    10,
    h - 10,
  );
}

/**
 * `present` is wall-clock between presented frames — what a player feels, and
 * meaningless in a backgrounded tab. `cost` is the time this game spends in
 * update+render, which is the number the frame budget is actually about.
 */
export function frameStats(world: World): {
  fps: number;
  present: number;
  p95: number;
  cost: number;
  particles: number;
} {
  const samples = [...world.fpsSamples].sort((a, b) => a - b);
  let sum = 0;
  for (const v of samples) sum += v;
  const present = samples.length ? sum / samples.length : 0;
  const p95 = samples.length ? (samples[Math.floor(samples.length * 0.95)] as number) : 0;
  let live = 0;
  for (const p of world.particles) if (p.active) live++;
  return {
    fps: present ? 1000 / present : 0,
    present,
    p95,
    cost: world.frameMs,
    particles: live,
  };
}
