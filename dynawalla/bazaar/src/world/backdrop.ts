/**
 * The one canvas — or rather two, split exactly where the interaction model
 * needs the split:
 *
 *   back  L0 sky · L1 far skyline · L2 roofline · L5 floor · L3 vault soffit
 *   DOM   L4 stalls — real buttons, real focus, real accessible names
 *   fore  L3 lanterns and shafts · L6 traffic  (pointer-events: none, BZ-LAW-9)
 *
 * That split is what makes the 60 fps budget and the accessibility requirements
 * achievable at the same time: pixels on canvas, semantics in DOM.
 *
 * The light shafts are drawn on the *front* canvas so they fall across the
 * stalls as well as the floor. Volumetric light in front of the thing it lights
 * is the whole reason the street looks sunlit rather than lit-from-a-flat-file.
 */

import { frand, mix as mixSeed, idle, clamp } from "../util/rng.ts";
import { alpha, over } from "../util/color.ts";
import { archPath } from "../geometry/arch.ts";
import type { Ambient } from "./daylight.ts";
import { lit, shade } from "./daylight.ts";
import type { Semantic } from "../tokens/palette.ts";
import { MATERIALS, WARDS, type WardId } from "../tokens/palette.ts";
import type { Layout } from "./layout.ts";
import { ParallaxRig } from "./parallax.ts";
import { drawTower, drawDome, drawRoofBlock, applyHaze, type SkyContext } from "./skyline.ts";
import { drawMuqarnas } from "../geometry/muqarnas.ts";
import { drawArcadeBay, drawLightShaft, drawLantern, drawValve, type CanopyCtx } from "./canopy.ts";
import { drawFloor, drawStallShadow, drawSunPool, type FloorCtx, type Reflector } from "./floor.ts";
import {
  Crowd,
  drawCat,
  drawPigeon,
  drawPorter,
  drawSteam,
  drawCarpet,
  type LifeCtx,
} from "./life.ts";
import type { Street } from "./street.ts";
import type { Budget } from "../perf/tiers.ts";

/** Stars the Islamic Golden Age named and Europe kept. */
const STARS: readonly [string, number, number, number][] = [
  ["Aldebaran", 0.12, 0.34, 1.0],
  ["Altair", 0.31, 0.18, 0.95],
  ["Deneb", 0.44, 0.42, 0.8],
  ["Rigel", 0.58, 0.22, 0.9],
  ["Betelgeuse", 0.66, 0.52, 0.85],
  ["Fomalhaut", 0.79, 0.3, 0.75],
  ["Vega", 0.91, 0.46, 1.0],
];

export interface Touch {
  x: number;
  y: number;
  age: number;
}

export interface BackdropState {
  camX: number;
  t: number;
  dt: number;
  lay: Layout;
  sem: Semantic;
  am: Ambient;
  street: Street;
  ward: WardId;
  reduced: boolean;
  budget: Budget;
  seed: number;
  touch: Touch | null;
  ripples: { x: number; age: number }[];
  lanternKick: number;
  catWake: number;
  soundOpen: boolean;
  /** Screen-space slices of the stall row, for the water to reflect. */
  reflectors: Reflector[];
  /** Screen x of the shafts, published so the stalls can be lit by them. */
  onShafts?(xs: number[]): void;
}

export class Backdrop {
  private rig = new ParallaxRig();
  private crowdFar = new Crowd(18);
  private crowdNear = new Crowd(5);
  private bctx: CanvasRenderingContext2D | null;
  private fctx: CanvasRenderingContext2D | null;
  private lay: Layout | null = null;

  private back: HTMLCanvasElement;
  private fore: HTMLCanvasElement;

  constructor(back: HTMLCanvasElement, fore: HTMLCanvasElement) {
    this.back = back;
    this.fore = fore;
    this.bctx = back.getContext("2d", { alpha: false });
    this.fctx = fore.getContext("2d");
  }

  resize(lay: Layout, scale: number): void {
    this.lay = lay;
    for (const cv of [this.back, this.fore]) {
      cv.width = Math.max(1, Math.round(lay.w * scale));
      cv.height = Math.max(1, Math.round(lay.h * scale));
    }
    this.bctx = this.back.getContext("2d", { alpha: false });
    this.fctx = this.fore.getContext("2d");
    this.bctx?.setTransform(scale, 0, 0, scale, 0, 0);
    this.fctx?.setTransform(scale, 0, 0, scale, 0, 0);
    this.rig.setViewW(lay.w);
  }

  draw(s: BackdropState): void {
    const b = this.bctx;
    const f = this.fctx;
    if (!b || !f || !this.lay) return;
    const { lay, sem, am } = s;
    const centre = s.camX + lay.w / 2;

    this.rig.setReduced(s.reduced);
    this.rig.update(centre, s.dt);

    const skyC: SkyContext = { sem, am, dpr: lay.dpr, depth: 5 };
    const midC: SkyContext = { sem, am, dpr: lay.dpr, depth: 3 };
    const canC: CanopyCtx = {
      sem,
      am,
      dpr: lay.dpr,
      lay,
      reduced: s.reduced,
      motes: s.budget.maxMotes,
    };
    const flC: FloorCtx = {
      sem,
      am,
      dpr: lay.dpr,
      lay,
      reduced: s.reduced,
      reflections: s.budget.reflections,
    };
    const lifeFar: LifeCtx = { sem, am, depth: 2, reduced: s.reduced };
    const lifeNear: LifeCtx = { sem, am, depth: 0, reduced: s.reduced };

    b.clearRect(0, 0, lay.w, lay.h);
    this.drawSky(b, s);

    // ── L1 far skyline ────────────────────────────────────────────────────
    const pFar = this.rig.projector("far", centre);
    if (s.budget.farParallax) {
      this.drawFarLayer(b, s, pFar, skyC);
      applyHaze(b, 0, 0, lay.w, lay.stallTop + lay.stallH * 0.4, skyC);
    }

    // ── L2 roofline across the street ─────────────────────────────────────
    const pMid = this.rig.projector("mid", centre);
    this.drawMidLayer(b, s, pMid, midC);

    // The far pavement, and the people on it.
    if (s.budget.fauna) {
      const pStreet = this.rig.projector("street", centre);
      this.crowdFar.setCount(lay.small ? 10 : 18);
      this.crowdFar.update(s.dt, centre, lay.w * 2.2);
      this.crowdFar.draw(
        b,
        (wx) => pStreet(wx) * 0.92 + lay.w * 0.04,
        lay.w,
        lay.floorY + lay.floorH * 0.2,
        lay.M * 0.3,
        lifeFar,
        s.t,
      );
    }
    applyHaze(b, 0, lay.skyH * 0.6, lay.w, lay.floorY - lay.skyH * 0.6, midC);

    // ── L5 floor ──────────────────────────────────────────────────────────
    drawFloor(b, s.camX, s.ward, s.seed, flC, s.t, s.reflectors, s.ripples);

    // The fabric between the stalls, and the gates at the ward boundaries.
    this.drawFurniture(b, s);

    // Stall shadows on the pavement.
    for (const st of s.street.visible(s.camX - lay.M, s.camX + lay.w + lay.M)) {
      if (st.kind !== "stall") continue;
      drawStallShadow(b, st.x - s.camX + lay.M * 0.08, st.width * 0.9, flC);
    }

    // ── L3 the arcade overhead, over the sky it is cut into ───────────────
    const shafts = this.drawCanopy(b, s, centre, canC);
    s.onShafts?.(shafts.map((sh) => sh.x));

    // ── the front canvas: light, lanterns, traffic ────────────────────────
    f.clearRect(0, 0, lay.w, lay.h);
    const lean = Math.tan((am.shaftAngle * Math.PI) / 180);
    for (const sh of shafts) {
      drawSunPool(b, sh.x + lean * (lay.floorY - sh.y), sh.w * 2.2, flC);
      drawLightShaft(f, sh.x, sh.y, sh.w, lay.floorY + lay.floorH * 0.5, sh.seed, canC, s.t, s.touch);
    }

    this.drawLanterns(f, s, centre, canC);
    if (s.budget.fauna) this.drawTraffic(f, s, centre, lifeNear);
    this.drawValveObject(f, s, canC);
  }

  /**
   * §4.7 — off the street. There is no navigation bar; everything else is a
   * turning. A street with no side alleys is a corridor, so the fabric between
   * the stalls is generated: doorways, stairs, alley mouths, crates, vines, a
   * fountain, a water crossing, a niche.
   */
  private drawFurniture(g: CanvasRenderingContext2D, s: BackdropState): void {
    const { lay, sem, am } = s;
    const top = lay.stallTop;
    const h = lay.floorY - top;
    for (const f of s.street.visible(s.camX - lay.M, s.camX + lay.w + lay.M)) {
      const x = f.x - s.camX;
      if (f.kind === "gate") {
        drawGate(g, x, f.width, lay, sem, am, f.ward, f.quarter.name.en);
        continue;
      }
      if (f.kind !== "interstitial") continue;
      const w = f.width;
      // The party wall between two shops, lit on the sun side, with the same
      // glazed dado the shopfronts carry.
      g.fillStyle = lit(sem.ground, am, 0.28);
      g.fillRect(x, top, w, h);
      g.fillStyle = shade(sem.ground, am, 0.8, sem.shadow);
      g.fillRect(x + w * 0.7, top, w * 0.3, h);
      g.fillStyle = sem.cut;
      g.fillRect(x, top, 1, h);
      g.fillRect(x + w - 1, top, 1, h);
      const band = WARDS[f.quarter.ward];
      const dh = Math.max(8, h * 0.07);
      g.fillStyle = band.glaze;
      g.fillRect(x + 1, lay.floorY - dh, w - 2, dh);
      g.fillStyle = band.glazeDeep;
      for (let i = 0; i * 11 < w; i++) g.fillRect(x + 1 + i * 11, lay.floorY - dh, 4, dh);
      g.fillStyle = sem.cut;
      g.fillRect(x + 1, lay.floorY - dh, w - 2, 1);
      // A wall bracket with a small lamp: a party wall is never blank.
      g.strokeStyle = sem.metal;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + w * 0.5, top + h * 0.1);
      g.lineTo(x + w * 0.5, top + h * 0.17);
      g.stroke();
      g.fillStyle = am.lanternGain > 0.2 ? sem.metalLit : sem.metal;
      g.beginPath();
      g.moveTo(x + w * 0.42, top + h * 0.17);
      g.lineTo(x + w * 0.58, top + h * 0.17);
      g.lineTo(x + w * 0.53, top + h * 0.25);
      g.lineTo(x + w * 0.47, top + h * 0.25);
      g.closePath();
      g.fill();

      switch (f.type) {
        case "doorway":
        case "alley-mouth": {
          const dw = w * 0.62;
          const dx = x + (w - dw) / 2;
          const dh = h * (f.type === "alley-mouth" ? 0.82 : 0.6);
          g.fillStyle = shade(sem.ground, am, f.type === "alley-mouth" ? 1.8 : 1.3, sem.shadow);
          g.beginPath();
          g.moveTo(dx, top + h);
          g.lineTo(dx, top + h - dh * 0.55);
          archPath(g, dx + dw / 2, top + h - dh * 0.55, dw, "equilateral");
          g.lineTo(dx + dw, top + h);
          g.closePath();
          g.fill();
          g.strokeStyle = sem.litEdge;
          g.lineWidth = 1;
          g.stroke();
          if (f.type === "alley-mouth") {
            // Something is lit, a long way down the alley.
            g.fillStyle = alpha(MATERIALS["lantern"], 0.35 * Math.max(0.25, am.lanternGain));
            g.fillRect(dx + dw * 0.36, top + h - dh * 0.3, dw * 0.28, dh * 0.3);
          }
          break;
        }
        case "stair": {
          const steps = 6;
          for (let i = 0; i < steps; i++) {
            const sy = top + h - ((i + 1) * h * 0.42) / steps;
            g.fillStyle = i % 2 ? lit(sem.ground, am, 0.8) : sem.ground;
            g.fillRect(x + w * 0.1 + i * w * 0.06, sy, w * 0.8 - i * w * 0.06, h * 0.42 / steps);
            g.fillStyle = sem.litEdge;
            g.fillRect(x + w * 0.1 + i * w * 0.06, sy, w * 0.8 - i * w * 0.06, 1);
          }
          break;
        }
        case "crates": {
          for (let i = 0; i < 4; i++) {
            const sd = mixSeed(f.seed, i);
            const cw = w * (0.28 + frand(sd) * 0.2);
            const ch = h * (0.09 + frand(mixSeed(sd, 1)) * 0.07);
            const cx2 = x + w * (0.12 + frand(mixSeed(sd, 2)) * 0.6);
            const cy = top + h - ch * (1 + (i % 2));
            g.fillStyle = over(MATERIALS["bronze-700"], am.sunColor, am.sunAlpha);
            g.fillRect(cx2, cy, cw, ch);
            g.fillStyle = sem.cut;
            g.strokeRect(cx2 + 0.5, cy + 0.5, cw - 1, ch - 1);
          }
          break;
        }
        case "niche": {
          const nw = w * 0.44;
          drawNicheInto(g, x + (w - nw) / 2, top + h * 0.3, nw, h * 0.45, sem, am);
          break;
        }
        case "vine": {
          g.strokeStyle = MATERIALS["sabz-700"];
          g.lineWidth = 2;
          g.beginPath();
          for (let i = 0; i <= 20; i++) {
            const u = i / 20;
            const vx = x + w * (0.5 + Math.sin(u * 7 + f.seed) * 0.28);
            const vy = top + h * 0.06 + u * h * 0.8;
            if (i === 0) g.moveTo(vx, vy);
            else g.lineTo(vx, vy);
          }
          g.stroke();
          g.fillStyle = over(MATERIALS["sabz-700"], am.sunColor, am.sunAlpha * 1.4);
          for (let i = 0; i < 14; i++) {
            const u = i / 14;
            const vx = x + w * (0.5 + Math.sin(u * 7 + f.seed) * 0.28);
            const vy = top + h * 0.06 + u * h * 0.8;
            g.beginPath();
            g.ellipse(vx + (i % 2 ? 6 : -6), vy, 5, 3, i % 2 ? 0.6 : -0.6, 0, Math.PI * 2);
            g.fill();
          }
          break;
        }
        case "fountain": {
          const fw = w * 0.7;
          const fx = x + (w - fw) / 2;
          const fy = top + h - h * 0.3;
          g.fillStyle = lit(sem.ground, am, 0.9);
          g.fillRect(fx, fy, fw, h * 0.3);
          g.fillStyle = sem.water;
          g.beginPath();
          g.ellipse(fx + fw / 2, fy, fw / 2, h * 0.035, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = sem.litEdge;
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(fx + fw / 2, fy - h * 0.16);
          g.lineTo(fx + fw / 2, fy);
          g.stroke();
          g.fillStyle = sem.metal;
          g.beginPath();
          g.arc(fx + fw / 2, fy - h * 0.18, Math.max(3, w * 0.04), 0, Math.PI * 2);
          g.fill();
          break;
        }
        case "water-crossing": {
          g.fillStyle = sem.water;
          g.fillRect(x + w * 0.2, top + h * 0.72, w * 0.6, h * 0.28);
          g.fillStyle = lit(sem.ground, am, 1.1);
          g.fillRect(x + w * 0.1, top + h * 0.68, w * 0.8, h * 0.06);
          g.fillStyle = sem.litEdge;
          g.fillRect(x + w * 0.1, top + h * 0.68, w * 0.8, 1);
          break;
        }
        default:
          break;
      }
    }
  }

  // ── L0 ──────────────────────────────────────────────────────────────────
  private drawSky(g: CanvasRenderingContext2D, s: BackdropState): void {
    const { lay, sem, am } = s;
    const horizon = lay.stallTop + lay.stallH * 0.5;
    const grad = g.createLinearGradient(0, 0, 0, horizon);
    grad.addColorStop(0, sem.skyHigh);
    grad.addColorStop(1, over(sem.skyLow, am.sunColor, am.sunAlpha * 0.7));
    g.fillStyle = grad;
    g.fillRect(0, 0, lay.w, horizon);
    g.fillStyle = over(sem.skyLow, am.sunColor, am.sunAlpha * 0.7);
    g.fillRect(0, horizon, lay.w, lay.h - horizon);

    // Stars, and the observatory instruments do point at them.
    if (am.night > 0.25) {
      g.save();
      g.globalAlpha = clamp((am.night - 0.25) / 0.5, 0, 1);
      for (const [name, fx, fy, mag] of STARS) {
        const x = fx * lay.w;
        const y = fy * lay.skyH;
        const tw = s.reduced ? 1 : 1 + idle(s.t, mixSeed(name.length, 3), 0.12);
        g.fillStyle = alpha(MATERIALS["glass-clear"], 0.55 * mag * tw);
        g.beginPath();
        g.arc(x, y, 1.1 + mag * 0.9, 0, Math.PI * 2);
        g.fill();
      }
      // A scatter of lesser stars.
      for (let i = 0; i < 60; i++) {
        const sd = mixSeed(i, 0x77aa);
        g.fillStyle = alpha(MATERIALS["glass-clear"], 0.1 + frand(mixSeed(sd, 1)) * 0.3);
        g.fillRect(frand(sd) * lay.w, frand(mixSeed(sd, 2)) * lay.skyH * 1.1, 1, 1);
      }
      g.restore();
    }

    // The low sun, at golden hour. A disc, not a lens flare.
    if (am.gild > 0.1 && am.night < 0.6) {
      const sx = lay.w * 0.78;
      const sy = lay.skyH * (1.05 - am.gild * 0.2);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.fillStyle = alpha(am.sunColor, 0.22 * am.gild);
      g.beginPath();
      g.arc(sx, sy, lay.M * 0.34, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = alpha("#fff3d6", 0.5 * am.gild);
      g.beginPath();
      g.arc(sx, sy, lay.M * 0.09, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  // ── L1 ──────────────────────────────────────────────────────────────────
  private drawFarLayer(
    g: CanvasRenderingContext2D,
    s: BackdropState,
    project: (wx: number) => number,
    c: SkyContext,
  ): void {
    const { lay } = s;
    const base = lay.skyH + lay.canopyH * 0.95;
    const span = lay.M * 6;
    const centre = s.camX + lay.w / 2;
    const first = Math.floor((centre - (lay.w / 2 / 0.08 + span)) / span);
    const last = Math.ceil((centre + (lay.w / 2 / 0.08 + span)) / span);

    for (let k = first; k <= last; k++) {
      const wx = k * span;
      const x = project(wx);
      if (x < -lay.M || x > lay.w + lay.M) continue;
      const sd = mixSeed(s.seed, k * 977);
      const r = frand(sd);
      const wardIx = Math.abs(k) % 5;
      const wardId = (["lapis", "turquoise", "madder", "hemp", "aubergine"] as WardId[])[wardIx]!;
      if (r < 0.32) {
        drawTower(
          g,
          x,
          base,
          lay.M * 0.15,
          lay.skyH * (1.05 + frand(mixSeed(sd, 1)) * 0.95),
          wardId,
          (["meridian", "vane", "signal", "gear", "armillary"] as const)[Math.abs(k) % 5]!,
          (["girih5", "khatem8", "hex6", "twelve12", "lattice"] as const)[Math.abs(k * 3) % 5]!,
          sd,
          c,
          s.t,
        );
      } else if (r < 0.5) {
        drawDome(g, x, base, lay.M * (0.22 + frand(mixSeed(sd, 2)) * 0.16), wardId, sd, c);
      } else {
        drawRoofBlock(
          g,
          x - lay.M * 0.28,
          base,
          lay.M * (0.4 + frand(mixSeed(sd, 3)) * 0.5),
          lay.skyH * (0.24 + frand(mixSeed(sd, 4)) * 0.5),
          sd,
          c,
          false,
        );
      }
    }

    // The next ward's tower, tied to its gate, so you can always see somewhere
    // you have not been.
    for (const f of s.street.features) {
      if (f.kind !== "gate") continue;
      const x = project(f.x);
      if (x < -lay.M || x > lay.w + lay.M) continue;
      drawTower(
        g,
        x,
        base,
        lay.M * 0.22,
        lay.skyH * 1.6,
        f.ward,
        f.quarter.finial,
        f.quarter.fold,
        f.seed,
        c,
        s.t,
      );
    }
  }

  // ── L2 ──────────────────────────────────────────────────────────────────
  private drawMidLayer(
    g: CanvasRenderingContext2D,
    s: BackdropState,
    project: (wx: number) => number,
    c: SkyContext,
  ): void {
    const { lay, sem, am } = s;
    const base = lay.stallTop + lay.stallH * 0.5;
    const span = lay.M * 1.55;
    const centre = s.camX + lay.w / 2;
    const reach = lay.w / 2 / 0.22 + span * 2;
    const first = Math.floor((centre - reach) / span);
    const last = Math.ceil((centre + reach) / span);

    const tops: { x: number; y: number }[] = [];
    for (let k = first; k <= last; k++) {
      const wx = k * span;
      const x = project(wx);
      if (x < -lay.M * 1.4 || x > lay.w + lay.M * 1.4) continue;
      const sd = mixSeed(s.seed ^ 0x2f, k * 613);
      const w = lay.M * (0.4 + frand(sd) * 0.3);
      const h = lay.stallH * 0.5 + lay.canopyH * (0.3 + frand(mixSeed(sd, 1)) * 0.75);
      drawRoofBlock(g, x, base, w, h, sd, c, true);
      tops.push({ x: x + w * 0.5, y: base - h });
    }

    // Laundry lines and cables between the roofs. Nothing says "people live
    // here" faster than a rope with washing on it.
    g.strokeStyle = over(sem.groundShade, sem.haze, (am.hazeAlpha * c.depth) / 6);
    g.lineWidth = 1;
    for (let i = 1; i < tops.length; i++) {
      const a = tops[i - 1]!;
      const bpt = tops[i]!;
      if (Math.abs(bpt.x - a.x) > lay.M * 1.3) continue;
      const sag = Math.min(26, Math.abs(bpt.x - a.x) * 0.16);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.quadraticCurveTo((a.x + bpt.x) / 2, Math.max(a.y, bpt.y) + sag, bpt.x, bpt.y);
      g.stroke();
      if (i % 2 === 0) {
        const n = 4;
        for (let j = 1; j < n; j++) {
          const u = j / n;
          const lx = a.x + (bpt.x - a.x) * u;
          const ly =
            (1 - u) * (1 - u) * a.y +
            2 * (1 - u) * u * (Math.max(a.y, bpt.y) + sag) +
            u * u * bpt.y;
          const sd = mixSeed(i * 31 + j, 0x5b);
          g.fillStyle = over(
            [MATERIALS["bone-100"], MATERIALS["saffron-400"], MATERIALS["madder-600"], MATERIALS["turquoise-500"]][
              Math.floor(frand(sd) * 4)
            ]!,
            sem.haze,
            (am.hazeAlpha * c.depth) / 6,
          );
          const cw = lay.M * 0.05;
          const ch = lay.M * (0.07 + frand(mixSeed(sd, 1)) * 0.05);
          const sway = s.reduced ? 0 : idle(s.t, sd, 0.06);
          g.save();
          g.translate(lx, ly);
          g.rotate(sway);
          g.fillRect(-cw / 2, 0, cw, ch);
          g.restore();
        }
      }
      // Pigeons on the wire.
      if (s.budget.fauna && i % 3 === 0) {
        const px = (a.x + bpt.x) / 2;
        const py = Math.max(a.y, bpt.y) + sag - 3;
        drawPigeon(g, px, py, lay.M * 0.03, 0, { sem, am, depth: c.depth, reduced: s.reduced }, s.t, i);
      }
    }
  }

  // ── L3 ──────────────────────────────────────────────────────────────────
  private drawCanopy(
    g: CanvasRenderingContext2D,
    s: BackdropState,
    centre: number,
    c: CanopyCtx,
  ): { x: number; y: number; w: number; seed: number }[] {
    const { lay } = s;
    const project = this.rig.projector("canopy", centre);
    const span = lay.M * 0.72;
    const reach = lay.w / 2 / 0.55 + span * 2;
    const first = Math.floor((centre - reach) / span);
    const last = Math.ceil((centre + reach) / span);
    const shafts: { x: number; y: number; w: number; seed: number }[] = [];
    const bandH = lay.skyH * 0.62;
    const fold = s.street.nearestStall(s.camX + lay.w / 2)?.quarter.fold ?? "girih5";

    for (let k = first; k <= last; k++) {
      const wx = k * span;
      const x = project(wx);
      const w = span;
      if (x + w < -20 || x - w > lay.w + 20) continue;
      const sd = mixSeed(s.seed ^ 0x91, k * 409);
      drawArcadeBay(g, x - w / 2, w, 0, bandH, s.ward, fold, sd, c);
      if ((k & 1) === 0) shafts.push({ x, y: bandH * 0.9, w: w * 0.3, seed: sd });
    }
    return shafts;
  }

  private drawLanterns(
    g: CanvasRenderingContext2D,
    s: BackdropState,
    centre: number,
    c: CanopyCtx,
  ): void {
    const { lay } = s;
    const project = this.rig.projector("canopy", centre);
    const span = lay.M * 0.36;
    const reach = lay.w / 2 / 0.55 + span * 2;
    const first = Math.floor((centre - reach) / span);
    const last = Math.ceil((centre + reach) / span);
    const top = lay.skyH * 0.58;
    for (let k = first; k <= last; k++) {
      const x = project(k * span);
      if (x < -60 || x > lay.w + 60) continue;
      const sd = mixSeed(s.seed ^ 0x33, k * 271);
      if (frand(sd) > 0.62) continue;
      drawLantern(g, x, top, lay.M * (0.055 + frand(mixSeed(sd, 1)) * 0.035), sd, c, s.t, s.lanternKick);
    }
  }

  // ── L6 ──────────────────────────────────────────────────────────────────
  private drawTraffic(
    g: CanvasRenderingContext2D,
    s: BackdropState,
    centre: number,
    c: LifeCtx,
  ): void {
    const { lay } = s;
    const project = this.rig.projector("fore", centre);
    const streetP = this.rig.projector("street", centre);

    // The near pavement.
    this.crowdNear.setCount(lay.small ? 2 : 4);
    this.crowdNear.update(s.dt, centre, lay.w * 1.8);
    this.crowdNear.draw(g, project, lay.w, lay.h - lay.floorH * 0.02, lay.M * 0.34, c, s.t);

    // Cats sleep on the sills of the interstitials; one per screen.
    for (const f of s.street.visible(s.camX - lay.M, s.camX + lay.w + lay.M)) {
      if (f.kind !== "interstitial") continue;
      const x = streetP(f.x + f.width / 2);
      if (f.type === "cat") {
        drawCat(g, x, lay.floorY + lay.floorH * 0.34, lay.M * 0.14, s.catWake, c, s.t, f.seed);
      } else if (f.type === "porter") {
        drawPorter(g, project(f.x + f.width / 2), lay.h - lay.floorH * 0.1, lay.M * 0.3, c, s.t);
      } else if (f.type === "fountain") {
        drawSteam(g, x, lay.floorY - lay.M * 0.1, f.seed, c, s.t);
      }
    }

    // A carpet drifts across, high up, every so often. It is the loading state
    // for a game and the fast-travel affordance between wards, so it belongs to
    // the world rather than to a spinner.
    const period = 34;
    const u = ((s.t % period) / period) * 1.4 - 0.2;
    if (u > -0.15 && u < 1.15) {
      drawCarpet(
        g,
        u * (lay.w + lay.M * 2) - lay.M,
        lay.stallTop + lay.stallH * 0.1 + Math.sin(u * 6) * 16,
        lay.M * 0.7,
        c,
        s.t,
        3,
      );
    }
  }

  private drawValveObject(g: CanvasRenderingContext2D, s: BackdropState, c: CanopyCtx): void {
    const { lay } = s;
    drawValve(g, lay.w - lay.M * 0.13, lay.skyH * 0.5, Math.max(9, lay.M * 0.032), s.soundOpen, c);
  }
}

/** A niche cut into a party wall. */
function drawNicheInto(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sem: Semantic,
  am: Ambient,
): void {
  g.fillStyle = shade(sem.ground, am, 1.5, sem.shadow);
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x, y + h * 0.45);
  archPath(g, x + w / 2, y + h * 0.45, w, "drop");
  g.lineTo(x + w, y + h);
  g.closePath();
  g.fill();
  g.strokeStyle = sem.litEdge;
  g.lineWidth = 1;
  g.stroke();
  // A pot in the niche, because an empty niche is a hole.
  g.fillStyle = over(MATERIALS["terracotta-600"], am.sunColor, am.sunAlpha);
  g.beginPath();
  g.ellipse(x + w / 2, y + h * 0.86, w * 0.2, h * 0.14, 0, 0, Math.PI * 2);
  g.fill();
}

/** A ward gate: ablaq voussoirs, an odd count so a keystone exists. */
export function drawGate(
  g: CanvasRenderingContext2D,
  x: number,
  w: number,
  lay: Layout,
  sem: Semantic,
  am: Ambient,
  ward: WardId,
  name: string,
): void {
  const top = lay.stallTop - lay.canopyH * 0.2;
  const base = lay.floorY;
  const h = base - top;
  const openW = w * 0.72;
  const cx = x + w / 2;

  g.fillStyle = lit(sem.ground, am, 0.6);
  g.fillRect(x, top, w, h);
  g.fillStyle = sem.cut;
  g.fillRect(x, top, 1, h);
  g.fillRect(x + w - 1, top, 1, h);

  // The opening, and what you see through it: the next ward, hazed.
  const springY = top + h * 0.52;
  g.save();
  g.beginPath();
  g.moveTo(cx - openW / 2, base);
  g.lineTo(cx - openW / 2, springY);
  archPath(g, cx, springY, openW, "equilateral");
  g.lineTo(cx + openW / 2, base);
  g.closePath();
  // Through the gate: the next ward, one haze step further away. A gate you
  // cannot see through is a wall with a shape cut in it.
  g.fillStyle = over(shade(sem.ground, am, 1.1, sem.shadow), sem.haze, am.hazeAlpha * 0.4);
  g.fill();
  // A receding vista: three hazed courses of the next ward's street, each one
  // step further off, and a bright slot of pavement at the end.
  for (let i = 0; i < 3; i++) {
    const k = (i + 1) / 4;
    g.fillStyle = over(lit(sem.ground, am, 0.4), sem.haze, am.hazeAlpha * (0.3 + i * 0.22));
    g.fillRect(cx - openW * (0.5 - k * 0.16), springY + h * (0.1 + i * 0.09), openW * (1 - k * 0.32), h * 0.09);
  }
  g.fillStyle = over(lit(sem.ground, am, 1.6), sem.haze, am.hazeAlpha * 0.8);
  g.fillRect(cx - openW * 0.34, base - h * 0.14, openW * 0.68, h * 0.14);
  g.restore();

  // Ablaq voussoirs: alternating courses of light and dark stone, an ODD count
  // so a keystone exists. A ring, struck from the springing line — the arch
  // ring is the structure, and a filled fan would be a decoration of one.
  const n = 11;
  const ri = openW / 2;
  const ro = openW / 2 + w * 0.075;
  g.save();
  g.beginPath();
  g.moveTo(cx - ro, base);
  g.lineTo(cx - ro, springY);
  archPath(g, cx, springY, ro * 2, "equilateral");
  g.lineTo(cx + ro, base);
  g.closePath();
  g.clip();
  g.beginPath();
  g.moveTo(cx - ri, base);
  g.lineTo(cx - ri, springY);
  archPath(g, cx, springY, openW, "equilateral");
  g.lineTo(cx + ri, base);
  g.closePath();
  const ring = new Path2D();
  ring.rect(cx - ro - 2, springY - ro * 2, ro * 2 + 4, ro * 2 + (base - springY));
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (Math.PI * i) / n;
    const a1 = Math.PI + (Math.PI * (i + 1)) / n;
    g.fillStyle = i % 2 === 0 ? MATERIALS["sandstone-50"] : MATERIALS["manganese-900"];
    g.beginPath();
    g.moveTo(cx + ri * Math.cos(a0), springY + ri * Math.sin(a0));
    g.arc(cx, springY, ri, a0, a1);
    g.lineTo(cx + ro * Math.cos(a1), springY + ro * Math.sin(a1));
    g.arc(cx, springY, ro, a1, a0, true);
    g.closePath();
    g.fill();
  }
  void ring;
  g.restore();

  // A muqarnas hood in the tympanum — the gate is carrying the lintel, and
  // this is what carries it.
  drawMuqarnas(g, {
    x: cx - openW * 0.45,
    y: springY - openW * 0.3,
    width: openW * 0.9,
    height: openW * 0.19,
    tiers: 5,
    k0: 4,
    ground: sem.ground,
    sun: am.sunColor,
    sunAlpha: am.sunAlpha,
    shadow: sem.shadow,
    shadowAlpha: am.shadowAlpha,
    litEdge: sem.litEdge,
    cut: sem.cut,
  });

  // The ward's colour, once, as a tiled band above; and the name cut into the
  // lintel — on stone, never on glaze (BZ-LAW-7).
  const band = WARDS[ward];
  g.fillStyle = band.glaze;
  g.fillRect(x + w * 0.08, top + h * 0.1, w * 0.84, h * 0.05);
  g.fillStyle = band.glazeDeep;
  for (let i = 0; i * 10 < w * 0.84; i++) g.fillRect(x + w * 0.08 + i * 10, top + h * 0.1, 3, h * 0.05);

  g.fillStyle = lit(sem.ground, am, 1.4);
  g.fillRect(x + w * 0.05, top + h * 0.17, w * 0.9, h * 0.075);
  g.fillStyle = sem.litEdge;
  g.fillRect(x + w * 0.05, top + h * 0.17, w * 0.9, 1);
  g.fillStyle = sem.cut;
  g.fillRect(x + w * 0.05, top + h * 0.245 - 1, w * 0.9, 1);
  g.font = `${Math.round(h * 0.042)}px "Iowan Old Style", Palatino, serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  // Cut into stone: one lit offset up-left, one cut offset down-right.
  g.fillStyle = sem.litEdge;
  g.fillText(name, cx - 1, top + h * 0.206 - 1, w * 0.84);
  g.fillStyle = sem.cut;
  g.fillText(name, cx + 1, top + h * 0.206 + 1, w * 0.84);
  g.fillStyle = sem.inkMuted;
  g.fillText(name, cx, top + h * 0.206, w * 0.84);
  g.textAlign = "left";
}
