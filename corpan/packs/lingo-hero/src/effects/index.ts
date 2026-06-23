import type { GameEventBus } from "../events";
import type { LaneSystem } from "../LaneSystem";
import { GameMode, LaneIndex } from "../types";
import { ParticleSystem } from "./particles";
import { ScreenShake } from "./shake";
import { Background } from "./background";
import { Floaters } from "./floaters";
import { Transitions } from "./transitions";
import { laneRgb, COLORS, mix, type Rgb } from "./palette";
import {
  signalHit,
  signalMiss,
  signalCombo,
  resetBoardState,
} from "./boardState";

/**
 * VFX layer — particles, screen shake, hit bursts, combo flares, transitions,
 * living background. STREAM: effects. Driven entirely off the event bus + the
 * loop-driven `render(now)` hook Game already calls each frame (after the game
 * is drawn). We never touch Game.ts.
 *
 * Screen shake seam: Renderer does not reset the canvas transform per frame, so
 * we leave a small shake translate on the SAME DPR-scaled context at the end of
 * our render. Next frame Renderer draws into that shifted transform → the whole
 * playfield jolts, then settles as trauma decays. We re-capture the base
 * transform whenever the canvas size changes (resize re-scales the ctx).
 */
export interface EffectsHandle {
  render?: (now: number) => void;
  dispose: () => void;
}

const MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

export function initEffects(
  ctx: CanvasRenderingContext2D,
  bus: GameEventBus,
  laneSystem: LaneSystem
): EffectsHandle {
  const particles = new ParticleSystem(520);
  const shake = new ScreenShake(24, 0.04);
  const background = new Background(96);
  const floaters = new Floaters();
  const transitions = new Transitions();

  const canvas = ctx.canvas;

  // Base (DPR-scaled, un-shaken) transform — re-read on size change.
  let baseTransform: DOMMatrix = ctx.getTransform();
  let lastW = canvas.width;
  let lastH = canvas.height;

  let lastNow = performance.now();
  let combo = 0;

  // Note-trail bookkeeping: pulse the strum line + emit motes around it while
  // a combo is hot. Purely cosmetic; reads geometry from laneSystem.
  let strumPulse = 0; // 0..1 decaying glow on the strum bar
  let strumPulseLane: LaneIndex = LaneIndex.Center;
  let ambientAccum = 0;

  // ---- Bus subscriptions -------------------------------------------------
  const offs: Array<() => void> = [];

  offs.push(
    bus.on("noteHit", (e) => {
      const color = laneRgb(e.lane);
      combo = e.combo;
      // Feed the Renderer's escalation/lane-flash seam (no Game.ts coupling).
      signalHit(e.lane, e.combo, performance.now());

      // Core burst: bright sparks + shards fanning up from the strum line.
      particles.burst(e.x, e.y, {
        count: 16 + Math.min(28, e.combo * 2),
        speedMin: 120,
        speedMax: 420 + Math.min(360, e.combo * 18),
        sizeMin: 1.6,
        sizeMax: 4.5,
        lifeMin: 0.35,
        lifeMax: 0.8,
        gravity: 520,
        drag: 0.86,
        spread: Math.PI * 1.5,
        angle: -Math.PI / 2,
        color,
        glow: 1.1,
      });
      // White-hot center pop.
      particles.burst(e.x, e.y, {
        count: 10,
        speedMin: 40,
        speedMax: 180,
        sizeMin: 1.2,
        sizeMax: 3,
        lifeMin: 0.18,
        lifeMax: 0.4,
        drag: 0.8,
        spread: Math.PI * 2,
        color: COLORS.WHITE,
        glow: 1.3,
      });
      // Shard confetti scales with combo.
      if (e.combo >= 3) {
        particles.burst(e.x, e.y, {
          count: 6 + Math.min(18, e.combo),
          speedMin: 160,
          speedMax: 460,
          sizeMin: 2,
          sizeMax: 5,
          lifeMin: 0.5,
          lifeMax: 1.0,
          gravity: 680,
          drag: 0.9,
          spread: Math.PI * 1.2,
          angle: -Math.PI / 2,
          shape: "shard",
          color: e.combo >= 10 ? COLORS.GOLD : color,
          glow: 1,
        });
      }

      floaters.shockwave(e.x, e.y, color, 1 + Math.min(0.8, e.combo * 0.04));
      const pts = e.points * Math.max(1, Math.round(1 + e.combo * 0.1));
      floaters.popup(
        e.x,
        e.y - laneSystem.getNoteRadius(),
        `+${pts}`,
        e.combo >= 10 ? COLORS.GOLD : COLORS.WHITE,
        24 + Math.min(20, e.combo)
      );

      // Feedback: light kick on every hit, beefier on streak.
      shake.add(0.06 + Math.min(0.14, e.combo * 0.006));

      strumPulse = 1;
      strumPulseLane = e.lane;
      background.setHue(mix(color, COLORS.WHITE, 0.15));
      background.pulse(0.18 + Math.min(0.4, e.combo * 0.02));
    })
  );

  offs.push(
    bus.on("noteMiss", (e) => {
      combo = 0;
      signalMiss(e.reason === "passed" ? 1 : 0.55, performance.now());
      const x = e.x;
      const y = e.y;
      const red = COLORS.RED;
      // Downward, gravity-light puff of red shards (a "fumble").
      particles.burst(x, y, {
        count: e.reason === "passed" ? 18 : 12,
        speedMin: 60,
        speedMax: 260,
        sizeMin: 1.5,
        sizeMax: 4,
        lifeMin: 0.3,
        lifeMax: 0.7,
        gravity: 380,
        drag: 0.9,
        spread: Math.PI * 1.6,
        angle: Math.PI / 2,
        color: red,
        glow: 0.9,
      });
      floaters.shockwave(x, y, red, 0.9);
      floaters.popup(x, y - 12, e.reason === "passed" ? "MISS" : "X", red, 26);
      // Bigger jolt when the target sails past than a wrong tap.
      shake.add(e.reason === "passed" ? 0.55 : 0.32);
      background.pulse(0.25);
      background.setHue({ r: 200, g: 60, b: 70 });
    })
  );

  // DECOY DODGED — issue #429. The player correctly let a distractor sail past.
  // A small, JUICY celebration that reads clearly as POSITIVE and distinct from
  // both the catch burst (white/lane) and the miss puff (red): a tight mint/lime
  // upward sparkle + a quick gold glint + a "DODGED +N" popup + a soft shockwave.
  // Deliberately smaller + lower-trauma than a catch so it rewards without
  // obscuring the falling cards or stealing the catch's thunder.
  offs.push(
    bus.on("decoy-dodged", (e) => {
      combo = e.combo;
      const mint: Rgb = { r: 120, g: 255, b: 180 }; // fresh "correct avoidance" green
      // Feed the lane-flash seam so the lane the foil dropped down pulses too
      // (a soft positive acknowledgement on the right lane).
      signalHit(e.lane, e.combo, performance.now());

      // Upward mint sparkle fan — the foil whooshing harmlessly by.
      particles.burst(e.x, e.y, {
        count: 12,
        speedMin: 90,
        speedMax: 300,
        sizeMin: 1.4,
        sizeMax: 3.6,
        lifeMin: 0.3,
        lifeMax: 0.7,
        gravity: 360,
        drag: 0.88,
        spread: Math.PI * 1.1,
        angle: -Math.PI / 2,
        color: mint,
        glow: 1.05,
      });
      // A few gold glints for that "nice!" pop.
      particles.burst(e.x, e.y, {
        count: 6,
        speedMin: 60,
        speedMax: 200,
        sizeMin: 1.6,
        sizeMax: 3.6,
        lifeMin: 0.35,
        lifeMax: 0.7,
        drag: 0.85,
        spread: Math.PI * 2,
        shape: "star",
        color: COLORS.GOLD,
        glow: 1.15,
      });
      floaters.shockwave(e.x, e.y, mint, 0.85);
      floaters.popup(
        e.x,
        e.y - laneSystem.getNoteRadius(),
        `DODGED +${e.points}`,
        mint,
        22
      );
      // A light, happy kick — smaller than a catch so it stays secondary.
      shake.add(0.1);
      background.setHue(mix(mint, COLORS.WHITE, 0.2));
      background.pulse(0.16);
    })
  );

  offs.push(
    bus.on("comboChange", (e) => {
      combo = e.value;
      signalCombo(e.value);
      // Detect milestone crossings (value rose past a threshold).
      if (e.value > e.previous) {
        for (const m of MILESTONES) {
          if (e.previous < m && e.value >= m) {
            celebrateMilestone(m);
          }
        }
      }
    })
  );

  offs.push(
    bus.on("gameStart", (e) => {
      combo = 0;
      resetBoardState();
      particles.clear();
      floaters.clear();
      shake.reset();
      background.reset();
      const tint: Rgb = e.mode === GameMode.BLITZ
        ? { r: 255, g: 90, b: 60 }
        : { r: 70, g: 180, b: 255 };
      background.setHue(tint);
      transitions.wipeIn(tint, 0.6);
      shake.add(0.25);
    })
  );

  offs.push(
    bus.on("gameOver", (e) => {
      const big = e.finalScore > 0;
      transitions.flash(COLORS.WHITE, 0.5);
      transitions.wipeOut({ r: 120, g: 90, b: 255 }, 0.6);
      shake.add(0.8);
      // Celebratory fountain from the bottom-center.
      const w = cssW();
      const h = cssH();
      if (big) {
        for (let i = 0; i < 5; i++) {
          particles.burst(w * (0.3 + i * 0.1), h, {
            count: 22,
            speedMin: 300,
            speedMax: 760,
            sizeMin: 2,
            sizeMax: 5,
            lifeMin: 0.8,
            lifeMax: 1.6,
            gravity: 900,
            drag: 0.92,
            spread: Math.PI * 0.5,
            angle: -Math.PI / 2,
            shape: i % 2 === 0 ? "star" : "shard",
            color: i % 2 === 0 ? COLORS.GOLD : laneRgb(i % 3),
            glow: 1.1,
          });
        }
      }
      combo = 0;
      resetBoardState();
      background.reset();
    })
  );

  // PHRASE-COMPLETE CELEBRATION — a satisfying fireworks burst when a phrase
  // resolves, scaled by performance (bigger for a clean, high-combo phrase).
  // Premium, not gaudy: a few timed shells rising + bursting in lane/gold hues.
  offs.push(
    bus.on("result-celebrate", (e) => {
      const w = cssW();
      const h = cssH();
      // Scale the show by combo + clean-ness. A clean, hot phrase earns more
      // shells and a touch more reach; a scrappy finish still pops, modestly.
      const heat = Math.min(1, e.combo / 16);
      const shells = e.clean ? 3 + Math.round(heat * 3) : 2 + Math.round(heat * 2);
      const reach = 360 + heat * 320;
      const gold = COLORS.GOLD;

      transitions.flash(e.clean ? COLORS.WHITE : { r: 180, g: 220, b: 255 }, 0.32);
      shake.add(e.clean ? 0.4 + heat * 0.3 : 0.28);
      background.pulse(0.5 + heat * 0.4);
      background.setHue(e.clean ? gold : mix(gold, COLORS.WHITE, 0.4));

      // Timed firework shells across the upper playfield. Stagger via a tiny
      // recursive scheduler so they don't all bloom on the same frame.
      let fired = 0;
      const fireOne = () => {
        if (fired >= shells) return;
        const fx = w * (0.18 + Math.random() * 0.64);
        const fy = h * (0.26 + Math.random() * 0.32);
        const hue = fired % 2 === 0 ? gold : laneRgb(fired % 3);
        // Radial shell burst.
        particles.burst(fx, fy, {
          count: 22 + Math.round(heat * 18),
          speedMin: 120,
          speedMax: reach,
          sizeMin: 1.8,
          sizeMax: 4.6,
          lifeMin: 0.6,
          lifeMax: 1.3,
          gravity: 420,
          drag: 0.9,
          spread: Math.PI * 2,
          shape: fired % 2 === 0 ? "star" : "shard",
          color: hue,
          glow: 1.2,
        });
        // White-hot core flash.
        particles.burst(fx, fy, {
          count: 10,
          speedMin: 30,
          speedMax: 150,
          sizeMin: 1.2,
          sizeMax: 3,
          lifeMin: 0.2,
          lifeMax: 0.45,
          drag: 0.82,
          spread: Math.PI * 2,
          color: COLORS.WHITE,
          glow: 1.3,
        });
        floaters.shockwave(fx, fy, hue, 1.1 + heat * 0.5);
        fired++;
        if (fired < shells) window.setTimeout(fireOne, 150 + Math.random() * 160);
      };
      fireOne();
    })
  );

  offs.push(
    bus.on("menuShown", () => {
      combo = 0;
      resetBoardState();
      particles.clear();
      floaters.clear();
      shake.reset();
      background.reset();
      background.setHue({ r: 90, g: 150, b: 255 });
      transitions.wipeIn({ r: 90, g: 150, b: 255 }, 0.5);
    })
  );

  function celebrateMilestone(m: number): void {
    const gold = COLORS.GOLD;
    const w = cssW();
    const label =
      m >= 100 ? "GODLIKE!" :
      m >= 50 ? "UNSTOPPABLE!" :
      m >= 30 ? "ON FIRE!" :
      m >= 20 ? "BLAZING!" :
      m >= 15 ? "AMAZING!" :
      m >= 10 ? "GREAT!" : "COMBO!";
    floaters.banner(`${m}x`, label, gold);
    // Twin side fountains of stars.
    const h = cssH();
    for (const sx of [w * 0.12, w * 0.88]) {
      particles.burst(sx, h * 0.55, {
        count: 18,
        speedMin: 200,
        speedMax: 560,
        sizeMin: 2,
        sizeMax: 5,
        lifeMin: 0.7,
        lifeMax: 1.4,
        gravity: 700,
        drag: 0.92,
        spread: Math.PI * 0.7,
        angle: -Math.PI / 2,
        shape: "star",
        color: gold,
        glow: 1.2,
      });
    }
    shake.add(Math.min(0.7, 0.3 + m * 0.01));
    background.pulse(0.7);
    background.setHue(gold);
  }

  // ---- Geometry helpers (CSS px) ----------------------------------------
  function cssW(): number {
    const s = parseFloat(canvas.style.width);
    return Number.isFinite(s) && s > 0 ? s : canvas.clientWidth || canvas.width;
  }
  function cssH(): number {
    const s = parseFloat(canvas.style.height);
    return Number.isFinite(s) && s > 0 ? s : canvas.clientHeight || canvas.height;
  }

  // ---- Per-frame paint ---------------------------------------------------
  function render(now: number): void {
    let dt = (now - lastNow) / 1000;
    lastNow = now;
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > 0.1) dt = 0.1; // clamp big hitches

    const w = cssW();
    const h = cssH();

    // Re-capture the base transform if the canvas was resized (ctx.scale on
    // resize would otherwise corrupt our shake math).
    if (canvas.width !== lastW || canvas.height !== lastH) {
      lastW = canvas.width;
      lastH = canvas.height;
      // Reset any lingering shake transform, then snapshot the fresh DPR scale.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = w > 0 ? canvas.width / w : window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseTransform = ctx.getTransform();
    }

    // ---- update simulations ----
    shake.update(dt);
    background.setEnergy(Math.min(1, combo / 25));
    background.update(dt);
    particles.update(dt);
    floaters.update(dt);
    transitions.update(dt);

    // Ambient combo embers rising along the strum line when a streak is hot.
    if (combo >= 5) {
      ambientAccum += dt * (combo * 1.2);
      while (ambientAccum > 1) {
        ambientAccum -= 1;
        const lane = (Math.floor(Math.random() * 3) as LaneIndex);
        const lx = laneSystem.getLaneX(lane) + (Math.random() - 0.5) * laneSystem.getNoteRadius();
        const sy = laneSystem.getStrumLineY() + (Math.random() - 0.5) * 6;
        particles.emit(
          lx,
          sy,
          (Math.random() - 0.5) * 30,
          -40 - Math.random() * 60,
          1 + Math.random() * 1.6,
          0.5 + Math.random() * 0.5,
          mix(laneRgb(lane), COLORS.GOLD, Math.min(0.6, combo / 60)),
          "spark"
        );
      }
    }
    if (strumPulse > 0) strumPulse = Math.max(0, strumPulse - dt * 2.4);

    // ---- apply shake transform (persists into next Renderer frame) ----
    // setTransform takes absolute matrix values; multiply base by shake offset.
    const ox = shake.offsetX;
    const oy = shake.offsetY;
    const ang = shake.angle;
    if (shake.active) {
      const m = baseTransform.translate(w / 2 + ox, h / 2 + oy).rotate((ang * 180) / Math.PI);
      const m2 = m.translate(-w / 2, -h / 2);
      ctx.setTransform(m2);
    } else {
      ctx.setTransform(baseTransform);
    }

    // ---- draw effects under the (possibly shaken) transform ----
    background.render(ctx, w, h, laneSystem);

    // Strum-line energy bloom on the lane of the last hit.
    if (strumPulse > 0.01) {
      drawStrumBloom(ctx, laneSystem, strumPulseLane, strumPulse);
    }

    particles.render(ctx);
    floaters.render(ctx, w, h);
    transitions.render(ctx, w, h);
  }

  function dispose(): void {
    for (const off of offs) off();
    offs.length = 0;
    particles.clear();
    floaters.clear();
    transitions.clear();
    // Leave the context in the clean base transform so teardown/remount is sane.
    try {
      ctx.setTransform(baseTransform);
    } catch {
      /* canvas may already be detached */
    }
  }

  return { render, dispose };
}

function drawStrumBloom(
  ctx: CanvasRenderingContext2D,
  lanes: LaneSystem,
  lane: LaneIndex,
  intensity: number
): void {
  const x = lanes.getLaneX(lane);
  const y = lanes.getStrumLineY();
  const r = lanes.getNoteRadius();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const color = laneRgb(lane);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  g.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${0.6 * intensity})`);
  g.addColorStop(0.4, `rgba(${color.r},${color.g},${color.b},${0.22 * intensity})`);
  g.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  // Crisp bright ring snapping outward.
  ctx.strokeStyle = `rgba(255,255,255,${0.5 * intensity})`;
  ctx.lineWidth = 3 * intensity;
  ctx.beginPath();
  ctx.arc(x, y, r * (1 + (1 - intensity) * 1.4), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
