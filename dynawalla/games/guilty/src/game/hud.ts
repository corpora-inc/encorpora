/**
 * Head-up display.
 *
 * The equation belongs at the top of the trench, because the husks are born out
 * of it — that fan-out is the entire tutorial. Everything else is deliberately
 * tiny and in the corners: score, lives, and a focus bar one pixel thick along
 * the bottom edge. Nothing explains anything.
 *
 * Every position here comes from `hudLayout.ts` rather than from `w`/`h`
 * directly, because `w`/`h` are the whole glass and this game's `cover`
 * viewport means the glass includes the notch, the home indicator and two 44px
 * squares the host paints its own controls into. The trench still uses the
 * whole glass; only the type moves.
 */

import { project } from "../core/camera.ts";
import { SHIP_Y } from "../core/config.ts";
import { C, rgba } from "../core/palette.ts";
import { drawGlow, drawGlyph, getGlyph } from "../render/bake.ts";
import { clamp, ease } from "../render/draw.ts";
import { gameOverLayout, type CardLine } from "./hudLayout.ts";
import type { World } from "./world.ts";

const UI_FONT = `700 %SIZE%px system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
const font = (size: number): string => UI_FONT.replace("%SIZE%", String(Math.round(size)));

/**
 * Sets the font to the largest size at or under `size` that fits `maxW`.
 *
 * Every line in this file that a child must READ goes through here. A phone in
 * portrait has a third of a laptop's width and these are whole sentences, not
 * numerals — a constant size means the rule of the game runs off the glass on
 * the device most likely to be a child's first one.
 */
function fitFont(ctx: CanvasRenderingContext2D, text: string, size: number, maxW: number): number {
  let px = size;
  ctx.font = font(px);
  const w = ctx.measureText(text).width;
  if (w > maxW && w > 0) {
    px = Math.max(9, size * (maxW / w));
    ctx.font = font(px);
  }
  return px;
}

export function drawEquation(world: World): void {
  const q = world.question;
  if (!q) return;
  const { ctx, hud } = world;
  const age = world.time - world.askedAt;
  const pop = ease.outBack(clamp(age / 0.42, 0, 1));
  const bob = Math.sin(world.time * 1.3) * 1.6;
  // The box, not the raw projection: the accusation is the one thing in this
  // game a child MUST read, and it is centred and wide, so on a phone it ran
  // under the exit control at one end and the how-to-play control at the other.
  // `hudLayout` keeps it in the channel between them and lets the trench behind
  // it carry on to the glass.
  const p = { x: hud.cx, y: hud.equation.y + hud.equation.h / 2 - bob * 1.2 };
  const glyphMetrics = getGlyph(q.prompt, C.amber, 800);
  // A two-step prompt is three times the width of "8 + 5", so the type size
  // fits the *sprite* to the box rather than trusting a constant.
  const widthLimited = (hud.equation.w * 92) / glyphMetrics.w;
  const size = Math.min(hud.equation.h / 1.35, widthLimited) * (0.55 + pop * 0.45);

  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.amber, p.x, p.y, size * 2.2, 0.05 + (1 - clamp(age / 0.6, 0, 1)) * 0.14);
  // A hair of chromatic split while it lands — two cheap blits of one sprite.
  if (age < 0.3 && !world.reduced) {
    const k = (1 - age / 0.3) * size * 0.07;
    // Explicitly ADDED, not inherited: `drawGlyph` now forces `source-over` by
    // default so the counter-ink rim it bakes can never be silently turned into
    // a no-op the way POLARITY's was. These two ghosts are the one place in the
    // game that wants the sprite to bloom rather than to read.
    ctx.globalAlpha = 0.32;
    drawGlyph(ctx, getGlyph(q.prompt, C.hostile, 800), p.x - k, p.y, size, 1, "lighter");
    drawGlyph(ctx, getGlyph(q.prompt, C.plankton, 800), p.x + k, p.y, size, 1, "lighter");
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = "source-over";
  drawGlyph(ctx, glyphMetrics, p.x, p.y, size);
}

export function drawHud(world: World): void {
  const { ctx, hud } = world;

  // Lives — small ship silhouettes, top left, clear of the host's exit control.
  for (let i = 0; i < world.lives; i++) {
    const x = hud.lives.x + 7 + i * 20;
    const y = hud.lives.y + hud.lives.h / 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + 6.5, y + 6);
    ctx.lineTo(x, y + 2.5);
    ctx.lineTo(x - 6.5, y + 6);
    ctx.closePath();
    ctx.fillStyle = rgba(C.ship, 0.92);
    ctx.fill();
  }

  // Score — top right, warm, with a soft halo instead of a shadow pass. Right
  // edge clear of the host's how-to-play control; a long score grows leftwards,
  // away from it.
  const scoreText = String(Math.round(world.displayScore));
  const size = hud.scoreSize;
  const scoreRight = hud.score.x + hud.score.w;
  const scoreY = hud.score.y + hud.score.h / 2;
  ctx.font = font(size);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.amber, scoreRight - ctx.measureText(scoreText).width / 2, scoreY, size * 1.5, 0.1);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = C.amber;
  ctx.fillText(scoreText, scoreRight, scoreY);

  // Wave, small and quiet beneath the score.
  ctx.font = font(size * 0.42);
  ctx.fillStyle = rgba(C.cyan, 0.55);
  ctx.fillText(`WAVE ${world.wave}`, scoreRight, hud.wave.y + hud.wave.h / 2);

  // Combo, beside the ship, only once it means something.
  if (world.combo >= 2) {
    const p = project(world.cam, world.ship.x, SHIP_Y + 30, 0);
    const grow = 1 + Math.min(0.7, world.combo * 0.04);
    const cs = Math.max(16, Math.min(hud.safe.w, hud.safe.h) * 0.036) * grow;
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
  const { ctx, hud } = world;
  const full = world.focus >= 1;
  const barH = full ? 5 : 3;
  // Above the home indicator, not under it. It is thin, but it is the only
  // thing that tells a child the slow-motion is charged.
  const y = hud.focusY - barH;
  const reach = hud.focusHalfW;
  const half = reach * clamp(world.focus, 0, 1);
  ctx.fillStyle = rgba(full ? C.white : C.ship, full ? 0.55 + Math.sin(world.time * 8) * 0.3 : 0.42);
  ctx.fillRect(hud.cx - half, y, half * 2, barH);
  if (world.focusT > 0) {
    // Burning down: the bar drains from the middle out, in the focus colour.
    const t = clamp(world.focusT / 2.6, 0, 1);
    ctx.fillStyle = rgba(C.plankton, 0.7);
    ctx.fillRect(hud.cx - reach * t, y, reach * 2 * t, barH);
  }
}

function drawBanner(world: World): void {
  if (world.bannerT <= 0 || !world.banner) return;
  const { ctx, hud } = world;
  const { w, h } = hud.safe;
  const t = clamp(world.bannerT / 1.5, 0, 1);
  const pop = ease.outCubic(clamp((1.5 - world.bannerT) / 0.3, 0, 1));
  const size = Math.min(w * 0.1, h * 0.062) * (0.7 + pop * 0.3);
  // Low in the frame: the top third is where the problem and the husks live,
  // and a banner across them would hide the only thing that matters.
  const y = hud.safe.y + h * 0.66;
  ctx.globalAlpha = Math.min(1, t * 2) * 0.9;
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.cyan, hud.cx, y, size * 3.4, 0.12);
  ctx.globalCompositeOperation = "source-over";
  ctx.font = font(size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = C.white;
  ctx.fillText(world.banner, hud.cx, y);
  if (world.bannerSub) {
    ctx.font = font(size * 0.4);
    ctx.fillStyle = rgba(C.cyan, 0.75);
    ctx.fillText(world.bannerSub, hud.cx, y + size * 0.85);
  }
  ctx.globalAlpha = 1;
}

/**
 * The rule, on the glass, while the trench is still waiting.
 *
 * Shown from the first frame of a run until the first shot, over a formation
 * that is not moving and cannot cost anything. GUILTY shipped with the rule
 * that makes it a maths game stated nowhere a player would find it, and the
 * word GUILTY is itself an inversion — the guilty shell is the one telling the
 * TRUTH — so it is spelled out here, where a child first meets it, in the same
 * breath as the only control they need.
 */
export function drawReady(world: World): void {
  const { ctx, hud } = world;
  const { w, h } = hud.safe;
  const maxW = w * 0.9;
  const y = hud.safe.y + h * 0.6;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const rule = "THE GUILTY SHELL IS THE ONE WITH THE RIGHT ANSWER";
  const ruleSize = fitFont(ctx, rule, Math.min(w * 0.05, h * 0.03), maxW);
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.amber, hud.cx, y, ruleSize * 6, 0.06);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = rgba(C.amber, 0.88);
  ctx.fillText(rule, hud.cx, y);

  const call = "SHOOT IT";
  const callSize = fitFont(ctx, call, Math.min(w * 0.075, h * 0.045), maxW);
  ctx.fillStyle = rgba(C.white, 0.9);
  ctx.fillText(call, hud.cx, y + ruleSize * 1.9);

  const how = world.touch ? "TAP TO FIRE" : "PRESS SPACE TO FIRE";
  fitFont(ctx, how, callSize * 0.62, maxW);
  ctx.fillStyle = rgba(C.cyan, 0.45 + Math.sin(world.time * 3) * 0.3);
  ctx.fillText(how, hud.cx, y + ruleSize * 1.9 + callSize * 1.4);

  const wait = "NOTHING MOVES UNTIL YOU DO";
  fitFont(ctx, wait, callSize * 0.44, maxW);
  ctx.fillStyle = rgba(C.cyan, 0.4);
  ctx.fillText(wait, hud.cx, y + ruleSize * 1.9 + callSize * 2.4);
  ctx.textAlign = "left";
}

/**
 * The completed sum, standing still, with no deadline on it.
 *
 * The accent colour, never red, and it never says WRONG. A child who has just
 * missed is the slowest reader in the session, so nothing here is on a timer:
 * `game.ts` freezes the trench while this is up and only a hand takes it down.
 */
export function drawReveal(world: World): void {
  if (world.revealPrompt === null || world.revealAnswer === null) return;
  const { ctx, hud } = world;
  const { w, h } = hud.safe;
  const t = clamp(world.revealAge / 0.26, 0, 1);
  const fade = ease.outCubic(t);

  // A scrim over the whole GLASS. The trench behind it is frozen; dimming it is
  // what says so, and a scrim that stopped at the safe area would draw a bright
  // band across the notch.
  ctx.fillStyle = rgba("#02060c", 0.62 * fade);
  ctx.fillRect(0, 0, world.w, world.h);

  const line = `${world.revealPrompt} = ${world.revealAnswer}`;
  const maxW = w * 0.88;
  const y = hud.cy;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = fade;

  const size = fitFont(ctx, line, Math.min(w * 0.16, h * 0.085), maxW);
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.amber, hud.cx, y, size * 2.6, 0.1 * fade);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = C.amber;
  ctx.fillText(line, hud.cx, y);

  // The way on, and only once the tap that ended the question can no longer be
  // the tap that dismisses this.
  if (world.revealSettle <= 0) {
    const go = world.touch ? "TAP WHEN YOU HAVE READ IT" : "PRESS SPACE WHEN YOU HAVE READ IT";
    fitFont(ctx, go, size * 0.3, maxW);
    ctx.fillStyle = rgba(C.cyan, 0.4 + Math.sin(world.time * 3) * 0.22);
    ctx.fillText(go, hud.cx, y + size * 1.1);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

export function drawTitle(world: World): void {
  const { ctx, hud } = world;
  const { w, h } = hud.safe;
  const t = clamp(world.phaseT / 0.9, 0, 1);
  const size = Math.min(w * 0.22, h * 0.16);
  const y = hud.safe.y + h * 0.4;
  ctx.globalAlpha = ease.outCubic(t);
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.amber, hud.cx, y, size * 1.9, 0.09);
  ctx.globalCompositeOperation = "source-over";
  drawGlyph(ctx, getGlyph("GUILTY", C.amber, 900), hud.cx, y, size * ease.outBack(clamp(t, 0, 1)));

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // The rule, before anything can cost anything. A child meets the word GUILTY
  // here and nowhere else, and it means the opposite of what they will guess.
  const rule = "SHOOT THE SHELL WITH THE RIGHT ANSWER ON IT";
  fitFont(ctx, rule, Math.max(12, size * 0.145), hud.safe.w * 0.9);
  ctx.fillStyle = rgba(C.amber, 0.78);
  ctx.fillText(rule, hud.cx, y + size * 0.62);

  ctx.font = font(Math.max(13, size * 0.13));
  ctx.fillStyle = rgba(C.cyan, 0.5 + Math.sin(world.time * 3) * 0.28);
  ctx.fillText(world.touch ? "TAP TO BEGIN" : "PRESS ANY KEY", hud.cx, y + size * 0.86);
  if (world.best > 0) {
    ctx.fillStyle = rgba(C.amber, 0.45);
    ctx.font = font(Math.max(11, size * 0.1));
    ctx.fillText(`BEST ${world.best}`, hud.cx, y + size * 1.07);
  }
  ctx.globalAlpha = 1;
}

export function drawGameOver(world: World): void {
  const { ctx, hud } = world;
  const t = clamp(world.phaseT / 0.8, 0, 1);
  // The dim covers the whole GLASS — a scrim that stopped at the safe area
  // would draw a bright band across the notch.
  ctx.fillStyle = rgba("#02060c", 0.55 * t);
  ctx.fillRect(0, 0, world.w, world.h);

  // Measured, not assumed. Every line here used to be sized from the viewport
  // and drawn without being measured, so the headline and the ledger both ran
  // off a phone. `gameOverLayout` fits them against the context's own metrics,
  // which is the same measurement the device makes.
  const card = gameOverLayout(
    hud,
    {
      headline: "THE TRENCH TAKES YOU",
      score: String(world.score),
      ledger: [`BEST ${world.best}`, `WAVE ${world.wave}`, `BEST RUN ×${world.bestCombo}`],
      prompt: world.touch ? "TAP TO DIVE AGAIN" : "PRESS ANY KEY",
    },
    (text, size) => {
      ctx.font = font(size);
      return ctx.measureText(text).width;
    },
  );
  // The card is headline, score, one to three ledger rows, prompt — the ledger
  // wraps on a narrow safe rectangle rather than shrinking past legibility.
  const headline = card.lines[0] as CardLine;
  const score = card.lines[1] as CardLine;
  const prompt = card.lines[card.lines.length - 1] as CardLine;
  const ledger = card.lines.slice(2, -1);

  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.hostile, hud.cx, headline.y, card.size * 2.4, 0.12 * t);
  ctx.globalCompositeOperation = "source-over";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = t;

  ctx.font = font(headline.size);
  ctx.fillStyle = rgba(C.hostile, 0.9);
  ctx.fillText(headline.text, hud.cx, headline.y);

  ctx.font = font(score.size);
  ctx.fillStyle = C.amber;
  ctx.fillText(score.text, hud.cx, score.y);

  ctx.fillStyle = rgba(C.cyan, 0.6);
  for (const row of ledger) {
    ctx.font = font(row.size);
    ctx.fillText(row.text, hud.cx, row.y);
  }

  ctx.font = font(prompt.size);
  ctx.fillStyle = rgba(C.white, 0.35 + Math.sin(world.time * 3) * 0.25);
  ctx.fillText(prompt.text, hud.cx, prompt.y);
  ctx.globalAlpha = 1;
}

/** Second wind: the run is over unless one more answer lands. */
export function drawSecondWind(world: World): void {
  const { ctx, hud } = world;
  const { w, h } = hud.safe;
  const t = clamp(world.phaseT / 0.6, 0, 1);
  ctx.fillStyle = rgba("#01040a", 0.42 * t);
  ctx.fillRect(0, 0, world.w, world.h);
  const size = Math.min(w * 0.1, h * 0.06);
  ctx.font = font(size * 0.5);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(C.hostile, 0.6 + Math.sin(world.time * 4) * 0.3);
  // Above the ship, under the action: the husks stay readable.
  const y = hud.safe.y + h * 0.8;
  ctx.fillText("ONE MORE", hud.cx, y);
  // What it MEANS, where it is met. Two words in a red pulse is a threat; the
  // line under it is the only thing that makes it a chance.
  const sub = "GET THIS ONE RIGHT AND YOU KEEP GOING";
  fitFont(ctx, sub, size * 0.24, w * 0.9);
  ctx.fillStyle = rgba(C.cyan, 0.6);
  ctx.fillText(sub, hud.cx, y + size * 0.46);
}

function drawStats(world: World): void {
  const { ctx, hud } = world;
  const s = frameStats(world);
  ctx.font = font(12);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(140,255,220,0.75)";
  ctx.fillText(
    `${s.fps.toFixed(1)} fps · present ${s.present.toFixed(2)}ms (p95 ${s.p95.toFixed(1)}) · cost ${s.cost.toFixed(2)}ms · p${s.particles} · q${world.quality.toFixed(2)}`,
    hud.safe.x + 10,
    hud.safe.y + hud.safe.h - 10,
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
