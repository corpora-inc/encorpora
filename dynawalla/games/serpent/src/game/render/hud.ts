/**
 * Screen-space chrome. Deliberately almost nothing.
 *
 * The real HUD is the arena floor — the condition is written in the water where
 * the player is already looking. Up here there is a depth, a score, a combo
 * gauge and a sound switch, and that is the entire text budget of the game.
 * Nothing narrates state that the world already shows.
 */

import { TAU, clamp, easeOutCubic } from "../num.ts";
import { COLORS, TUNE } from "../tuning.ts";
import { stickBoostPush, stickRadiusPx, type Pointer } from "../input.ts";
import type { World } from "../world.ts";
import { drawLabel, type LabelStyle } from "./glyphs.ts";
import type { View } from "./scene.ts";

export type HudOptions = {
  pointer: Pointer;
  usingTouch: boolean;
  soundOn: boolean;
  showDebug: boolean;
  fps: number;
  frameMs: number;
  worstMs: number;
};

const base: LabelStyle = {
  size: 16,
  fill: COLORS.ink,
  outline: "rgba(0,8,14,0.75)",
  outlineWidth: 3,
  weight: 800,
  tracking: 0,
};

const styled = (over: Partial<LabelStyle>): LabelStyle => ({ ...base, ...over });

export function drawHud(g: CanvasRenderingContext2D, view: View, w: World, o: HudOptions): void {
  const u = Math.min(view.w, view.h);
  const pad = Math.max(14, u * 0.045);
  const dpr = view.dpr;

  // --- depth, top left ----------------------------------------------------
  const depthSize = Math.max(24, u * 0.062);
  const dp = easeOutCubic(w.depthPulse);
  g.save();
  g.globalAlpha = 0.9;
  g.fillStyle = COLORS.rim;
  const tri = depthSize * 0.3;
  const tx = pad + tri * 0.6;
  const ty = pad + depthSize * 0.62;
  g.beginPath();
  g.moveTo(tx - tri * 0.62, ty - tri * 0.45);
  g.lineTo(tx + tri * 0.62, ty - tri * 0.45);
  g.lineTo(tx, ty + tri * 0.62);
  g.closePath();
  g.fill();
  g.restore();
  drawLabel(
    g,
    String(w.depth),
    styled({ size: depthSize, fill: dp > 0.02 ? "#ffffff" : COLORS.rim }),
    tx + tri * 1.6 + depthSize * 0.22,
    ty,
    dpr,
    1 + dp * 0.35,
    0.95,
  );

  const lengthSize = Math.max(11, u * 0.028);
  drawLabel(
    g,
    `${Math.round(w.serpent.targetSegments)}`,
    styled({ size: lengthSize, fill: "rgba(143,233,255,0.75)" }),
    tx + tri * 1.6 + depthSize * 0.22,
    ty + depthSize * 0.72,
    dpr,
    1,
    0.9,
  );

  // --- score, top centre --------------------------------------------------
  const scoreSize = Math.max(26, u * 0.075);
  const sp = easeOutCubic(w.scorePulse);
  drawLabel(
    g,
    String(w.score),
    styled({ size: scoreSize, fill: "#ffffff" }),
    view.cx,
    pad + scoreSize * 0.6,
    dpr,
    1 + sp * 0.12,
    0.97,
  );
  if (w.best > 0) {
    drawLabel(
      g,
      String(w.best),
      styled({ size: Math.max(10, u * 0.026), fill: "rgba(255,215,106,0.7)" }),
      view.cx,
      pad + scoreSize * 1.28,
      dpr,
      1,
      0.9,
    );
  }

  // --- combo gauge, top right ---------------------------------------------
  const gaugeR = Math.max(15, u * 0.042);
  const gx = view.w - pad - gaugeR;
  const gy = pad + gaugeR;
  const frac = w.combo / TUNE.comboMax;
  g.save();
  g.lineCap = "round";
  g.strokeStyle = "rgba(143,233,255,0.16)";
  g.lineWidth = Math.max(2.5, gaugeR * 0.2);
  g.beginPath();
  g.arc(gx, gy, gaugeR, 0, TAU);
  g.stroke();
  if (frac > 0) {
    g.strokeStyle = COLORS.good;
    g.globalAlpha = 0.9;
    g.lineWidth = Math.max(3, gaugeR * 0.26) * (1 + easeOutCubic(w.comboPulse) * 0.3);
    g.beginPath();
    g.arc(gx, gy, gaugeR, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    g.stroke();
  }
  g.restore();
  drawLabel(
    g,
    `${w.combo}`,
    styled({ size: gaugeR * 1.02, fill: w.combo > 0 ? COLORS.good : "rgba(143,233,255,0.35)" }),
    gx,
    gy,
    dpr,
    1 + easeOutCubic(w.comboPulse) * 0.2,
    1,
  );
  if (w.serpent.shield) {
    g.save();
    g.globalAlpha = 0.85;
    g.strokeStyle = COLORS.lantern;
    g.lineWidth = Math.max(2, gaugeR * 0.16);
    g.beginPath();
    g.arc(gx, gy, gaugeR * 1.5, 0, TAU);
    g.stroke();
    g.restore();
  }

  // --- sound switch, bottom right -----------------------------------------
  const sr = Math.max(13, u * 0.032);
  const sx = view.w - pad - sr;
  const sy = view.h - pad - sr;
  g.save();
  g.globalAlpha = o.soundOn ? 0.55 : 0.3;
  g.fillStyle = COLORS.ink;
  g.beginPath();
  g.moveTo(sx - sr * 0.5, sy - sr * 0.25);
  g.lineTo(sx - sr * 0.16, sy - sr * 0.25);
  g.lineTo(sx + sr * 0.24, sy - sr * 0.62);
  g.lineTo(sx + sr * 0.24, sy + sr * 0.62);
  g.lineTo(sx - sr * 0.16, sy + sr * 0.25);
  g.lineTo(sx - sr * 0.5, sy + sr * 0.25);
  g.closePath();
  g.fill();
  g.strokeStyle = COLORS.ink;
  g.lineWidth = Math.max(1.6, sr * 0.14);
  g.lineCap = "round";
  if (o.soundOn) {
    for (let i = 1; i <= 2; i++) {
      g.beginPath();
      g.arc(sx + sr * 0.28, sy, sr * (0.22 + i * 0.3), -0.9, 0.9);
      g.stroke();
    }
  } else {
    g.beginPath();
    g.moveTo(sx + sr * 0.5, sy - sr * 0.34);
    g.lineTo(sx + sr * 1.06, sy + sr * 0.34);
    g.moveTo(sx + sr * 1.06, sy - sr * 0.34);
    g.lineTo(sx + sr * 0.5, sy + sr * 0.34);
    g.stroke();
  }
  g.restore();

  // --- the thumb stick ----------------------------------------------------
  if (o.usingTouch && o.pointer.active) {
    const ax = o.pointer.anchorX;
    const ay = o.pointer.anchorY;
    const boosting = o.pointer.push >= stickBoostPush;
    g.save();
    g.globalAlpha = 0.22;
    g.strokeStyle = boosting ? COLORS.good : COLORS.plankton;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(ax, ay, stickRadiusPx, 0, TAU);
    g.stroke();
    g.globalAlpha = 0.13;
    g.beginPath();
    g.arc(ax, ay, stickRadiusPx * stickBoostPush, 0, TAU);
    g.stroke();
    g.globalAlpha = 0.5;
    g.fillStyle = boosting ? COLORS.good : COLORS.plankton;
    g.beginPath();
    g.arc(ax + o.pointer.dx, ay + o.pointer.dy, Math.max(9, stickRadiusPx * 0.16), 0, TAU);
    g.fill();
    g.restore();
  }

  // --- overlays -----------------------------------------------------------
  if (w.phase === "attract") drawAttract(g, view, w, o);
  else if (w.phase === "dead") drawGameOver(g, view, w, o);
  else if (w.paused) drawPaused(g, view);

  if (o.showDebug) drawDebug(g, view, w, o);
}

function scrim(g: CanvasRenderingContext2D, view: View, alpha: number): void {
  const grad = g.createRadialGradient(view.cx, view.cy, 0, view.cx, view.cy, Math.max(view.w, view.h) * 0.72);
  grad.addColorStop(0, `rgba(0,6,12,${alpha})`);
  grad.addColorStop(1, `rgba(0,2,6,${Math.min(0.94, alpha + 0.28)})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, view.w, view.h);
}

function drawAttract(g: CanvasRenderingContext2D, view: View, w: World, o: HudOptions): void {
  const u = Math.min(view.w, view.h);
  scrim(g, view, 0.42);
  const titleSize = Math.max(34, u * 0.13);
  drawLabel(
    g,
    "SERPENT",
    styled({ size: titleSize, fill: "#eafcff", tracking: titleSize * 0.16, outlineWidth: 6 }),
    view.cx,
    view.cy - u * 0.1,
    view.dpr,
    1,
    0.97,
  );
  const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(w.cam.t * 2.6));
  drawLabel(
    g,
    o.usingTouch ? "TAP TO DIVE" : "CLICK TO DIVE",
    styled({ size: Math.max(14, u * 0.036), fill: COLORS.rim, tracking: u * 0.008 }),
    view.cx,
    view.cy + u * 0.12,
    view.dpr,
    1,
    pulse,
  );
}

function drawGameOver(g: CanvasRenderingContext2D, view: View, w: World, o: HudOptions): void {
  const u = Math.min(view.w, view.h);
  const k = clamp(w.deathT / 0.7, 0, 1);
  scrim(g, view, 0.5 * k);
  const e = easeOutCubic(k);
  const bigSize = Math.max(40, u * 0.15);
  drawLabel(
    g,
    String(w.score),
    styled({ size: bigSize, fill: "#ffffff", outlineWidth: 5 }),
    view.cx,
    view.cy - u * 0.06,
    view.dpr,
    0.86 + e * 0.14,
    e,
  );
  drawLabel(
    g,
    `DEPTH ${w.depth}   BEST ${w.best}`,
    styled({ size: Math.max(12, u * 0.032), fill: "rgba(255,215,106,0.85)", tracking: u * 0.004 }),
    view.cx,
    view.cy + u * 0.045,
    view.dpr,
    1,
    e,
  );
  if (w.deathT > 0.55) {
    const pulse = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(w.cam.t * 2.8));
    drawLabel(
      g,
      o.usingTouch ? "TAP TO DIVE AGAIN" : "CLICK TO DIVE AGAIN",
      styled({ size: Math.max(13, u * 0.033), fill: COLORS.rim, tracking: u * 0.006 }),
      view.cx,
      view.cy + u * 0.15,
      view.dpr,
      1,
      pulse,
    );
  }
}

function drawPaused(g: CanvasRenderingContext2D, view: View): void {
  const u = Math.min(view.w, view.h);
  scrim(g, view, 0.5);
  drawLabel(
    g,
    "PAUSED",
    styled({ size: Math.max(22, u * 0.07), fill: "#eafcff", tracking: u * 0.012 }),
    view.cx,
    view.cy,
    view.dpr,
    1,
    0.95,
  );
}

function drawDebug(g: CanvasRenderingContext2D, view: View, w: World, o: HudOptions): void {
  const lines = [
    `${o.fps.toFixed(0)} fps   frame ${o.frameMs.toFixed(2)}ms   worst ${o.worstMs.toFixed(2)}ms`,
    `body ${w.serpent.bodyCount}   orbs ${w.orbs.length}   particles ${w.particles.count}   rings ${w.rings.count}`,
    `answer ${w.lastAnswerMs}ms   depth ${w.depth}   arena ${w.arenaR.toFixed(3)}   ${w.prompt}`,
  ];
  const size = Math.max(10, Math.min(view.w, view.h) * 0.022);
  let y = view.h - size * 3.6;
  for (const line of lines) {
    drawLabel(
      g,
      line,
      styled({ size, fill: "rgba(180,255,230,0.85)", weight: 600, outlineWidth: 3 }),
      view.w / 2,
      y,
      view.dpr,
      1,
      0.9,
    );
    y += size * 1.35;
  }
}
