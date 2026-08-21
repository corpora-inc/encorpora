/**
 * Anatomy of a stall, top to bottom. Every part is a real object with a job:
 *
 *   1. muqarnas hood      the thing that visibly holds up the lintel
 *   2. awning             striped cloth on two ribs, breathing
 *   3. sign board         walnut, cream lettering — name and worked specimen
 *   4. the aperture       the live preview; a cut opening with real jambs and
 *                         **nothing else touching it** (BZ-LAW-1)
 *   5. the sill / counter a stone shelf with 3–7 real objects from that game
 *   6. the automaton      brass, faceless, performing its own mathematics
 *   7. the shutter        mashrabiya on a roller, down at night, glow above
 *
 * The static parts are constructed once into a sprite. Only the awning and the
 * automaton are redrawn per frame — everything else is a blit.
 */

import { frand, mix as mixSeed, idle, clamp } from "../util/rng.ts";
import { alpha, over } from "../util/color.ts";
import { drawMuqarnas } from "../geometry/muqarnas.ts";
import { archPath } from "../geometry/arch.ts";
import { latticePanel, LATTICE_VARIANTS } from "../geometry/mashrabiya.ts";
import { patternPanel } from "../geometry/pattern.ts";
import { sprite, bucket } from "../world/sprites.ts";
import { lit, shade, type Ambient } from "../world/daylight.ts";
import type { Layout } from "../world/layout.ts";
import { STRIPES, SELVEDGE, WARDS, MATERIALS, type Semantic } from "../tokens/palette.ts";
import type { Quarter, StallState } from "../types.ts";
import { drawGoods } from "./goods.ts";
import { drawAutomaton } from "./automaton.ts";

export interface StallBox {
  w: number;
  h: number;
  apertureX: number;
  apertureY: number;
  apertureW: number;
  apertureH: number;
  sillY: number;
  signY: number;
  signH: number;
}

export function stallBox(lay: Layout): StallBox {
  const w = lay.M;
  const h = lay.stallH;
  const apertureW = lay.apertureW;
  const apertureH = lay.apertureH;
  return {
    w,
    h,
    apertureX: (w - apertureW) / 2,
    apertureY: lay.M * 0.46,
    apertureW,
    apertureH,
    sillY: lay.M * 0.46 + apertureH,
    signY: lay.M * 0.305,
    signH: lay.M * 0.155,
  };
}

export interface ChromeState {
  lay: Layout;
  sem: Semantic;
  am: Ambient;
  quarter: Quarter;
  state: StallState;
  seed: number;
  accretion: number;
  t: number;
  reduced: boolean;
  /** −1…1: where the automaton is looking. */
  look: number;
  /** 1 → 0 over 420 ms after a touch. */
  attention: number;
  /** 1 while this stall is the centred one. */
  centred: number;
}

export function drawStall(g: CanvasRenderingContext2D, s: ChromeState): void {
  const box = stallBox(s.lay);
  const key = [
    "stall",
    s.quarter.id,
    s.state,
    s.seed & 1023,
    Math.round(box.w),
    Math.round(box.h),
    bucket(s.am.night, 10),
    bucket(s.am.sunAlpha, 10),
    bucket(s.accretion, 8),
  ].join("|");
  const face = sprite(key, box.w, box.h, s.lay.dpr, (h) => drawStatic(h, s, box));
  g.drawImage(face, 0, 0, box.w, box.h);

  if (s.state !== "scaffold") {
    drawAwning(g, s, box);
    const sillTop = box.sillY;
    drawAutomaton(
      g,
      s.lay.M * 0.14,
      sillTop + s.lay.M * 0.125,
      s.lay.M * 0.29,
      s.quarter.craft,
      s.seed,
      s.t,
      {
        sem: s.sem,
        sunColor: s.am.sunColor,
        sunAlpha: s.am.sunAlpha,
        shadowAlpha: s.am.shadowAlpha,
        reduced: s.reduced,
      },
      s.look,
      s.attention,
    );
  } else {
    drawBuilders(g, s, box);
  }
}

// ── the static face ────────────────────────────────────────────────────────

function drawStatic(g: CanvasRenderingContext2D, s: ChromeState, box: StallBox): void {
  const { sem, am, lay } = s;
  const ward = WARDS[s.quarter.ward];

  // The facade: stone, lit on the sun side, in shade on the other. The value
  // range across one wall is what stops a warm palette going to cream mush.
  g.fillStyle = lit(sem.ground, am, 0.35);
  g.fillRect(0, 0, box.w, box.h);
  g.fillStyle = shade(sem.ground, am, 0.85, sem.shadow);
  g.fillRect(box.w * 0.74, 0, box.w * 0.26, box.h);
  g.fillStyle = sem.litEdge;
  g.globalAlpha = 0.4;
  g.fillRect(0, 0, 1.5, box.h);
  g.globalAlpha = 1;
  // A mud-brick upper storey on some stalls: the street is not one material.
  if ((s.seed & 3) === 0) {
    g.fillStyle = over(MATERIALS["mudbrick-500"], am.sunColor, am.sunAlpha);
    g.fillRect(0, lay.M * 0.2, box.w, lay.M * 0.1);
  }
  // Ashlar coursing, so the wall is masonry and not a fill.
  g.strokeStyle = alpha(sem.cut, 0.32);
  g.lineWidth = 1;
  for (let y = box.h * 0.1; y < box.h; y += lay.M * 0.11) {
    g.beginPath();
    g.moveTo(0, Math.round(y) + 0.5);
    g.lineTo(box.w, Math.round(y) + 0.5);
    g.stroke();
  }

  // 1 — the muqarnas hood.
  drawMuqarnas(g, {
    x: 0,
    y: 0,
    width: box.w,
    height: lay.M * 0.15,
    tiers: 3,
    k0: 5,
    delta: s.quarter.fold === "hex6" || s.quarter.fold === "twelve12" ? 3 : 2,
    ground: sem.ground,
    sun: am.sunColor,
    sunAlpha: am.sunAlpha,
    shadow: sem.shadow,
    shadowAlpha: am.shadowAlpha,
    litEdge: sem.litEdge,
    cut: sem.cut,
  });

  // A tiled band under the hood in the ward's glaze — colour, never text.
  const bandY = lay.M * 0.15;
  const bandH = lay.M * 0.055;
  const band = patternPanel({
    width: box.w,
    height: bandH,
    fold: s.quarter.fold === "lattice" ? "khatem8" : s.quarter.fold,
    edge: Math.max(8, bandH * 0.95),
    ground: sem.ground,
    strap: sem.metal,
    glaze: ward.glaze,
    glazeDeep: ward.glazeDeep,
    dpr: lay.dpr,
  });
  g.drawImage(band, 0, bandY, box.w, bandH);
  g.fillStyle = sem.cut;
  g.fillRect(0, bandY + bandH - 1, box.w, 1);

  if (s.state === "scaffold") {
    drawScaffolding(g, s, box);
    return;
  }

  // 3 — the sign board, on two brass pins.
  const sx = box.w * 0.07;
  const sw = box.w * 0.86;
  g.fillStyle = sem.signBoard;
  g.fillRect(sx, box.signY, sw, box.signH);
  g.fillStyle = over(sem.signBoard, sem.litEdge, 0.22);
  g.fillRect(sx, box.signY, sw, 1.5);
  g.fillStyle = over(sem.signBoard, sem.shadow, 0.4);
  g.fillRect(sx, box.signY + box.signH - 1.5, sw, 1.5);
  g.fillStyle = sem.metal;
  for (const px of [sx + 7, sx + sw - 7]) {
    g.beginPath();
    g.arc(px, box.signY + 7, 3, 0, Math.PI * 2);
    g.fill();
  }
  // A brass plate set into the lower course of the board: the specimen is
  // engraved into it, so the figures sit on metal (6.6:1) rather than on the
  // dark timber the place name is painted on.
  const plateY = box.signY + box.signH * 0.36;
  const plateH = box.signH * 0.58;
  g.fillStyle = sem.metal;
  g.fillRect(sx + sw * 0.06, plateY, sw * 0.88, plateH);
  g.fillStyle = sem.metalLit;
  g.fillRect(sx + sw * 0.06, plateY, sw * 0.88, 1);
  g.fillStyle = sem.metalShade;
  g.fillRect(sx + sw * 0.06, plateY + plateH - 1, sw * 0.88, 1);

  // 4 — the aperture. A cut opening with real jambs: a lit edge on the sun
  // side, a cut line on the shade side, a 2 px chamfer, and nothing else.
  const ax = box.apertureX;
  const ay = box.apertureY;
  const aw = box.apertureW;
  const ah = box.apertureH;
  const j = lay.jamb;
  g.fillStyle = shade(sem.ground, am, 1.1, sem.shadow);
  g.fillRect(ax - j, ay - j, aw + j * 2, ah + j * 2);
  g.fillStyle = lit(sem.ground, am, 1.3);
  g.fillRect(ax - j, ay - j, j, ah + j * 2);
  g.fillStyle = sem.litEdge;
  g.fillRect(ax - j, ay - j, 1, ah + j * 2);
  g.fillRect(ax - j, ay - j, aw + j * 2, 1);
  g.fillStyle = sem.cut;
  g.fillRect(ax + aw + j - 2, ay - j, 2, ah + j * 2);
  // The hole itself: the preview canvas sits exactly here.
  g.fillStyle = sem.cut;
  g.fillRect(ax, ay, aw, ah);

  // A glazed dado at the foot of the wall, in the ward's colour. Every real
  // souk wall has one, and it is where the street gets its colour from.
  const dadoH = lay.M * 0.09;
  const dado = patternPanel({
    width: box.w,
    height: dadoH,
    fold: s.quarter.fold === "lattice" ? "hex6" : s.quarter.fold,
    edge: Math.max(9, dadoH * 0.8),
    ground: sem.ground,
    strap: sem.metalShade,
    glaze: ward.glaze,
    glazeDeep: ward.glazeDeep,
    dpr: lay.dpr,
  });
  g.drawImage(dado, 0, box.h - dadoH - lay.M * 0.02, box.w, dadoH);
  g.fillStyle = sem.cut;
  g.fillRect(0, box.h - dadoH - lay.M * 0.02, box.w, 1);
  g.fillStyle = sem.litEdge;
  g.globalAlpha = 0.4;
  g.fillRect(0, box.h - dadoH - lay.M * 0.02 + 1, box.w, 1);
  g.globalAlpha = 1;

  // 5 — the sill: a stone shelf that projects, with a lit top edge.
  const sy = box.sillY;
  const sh = box.h - sy;
  g.fillStyle = lit(sem.ground, am, 0.9);
  g.fillRect(-lay.M * 0.02, sy, box.w + lay.M * 0.04, lay.sillDepth * 0.4);
  g.fillStyle = sem.litEdge;
  g.fillRect(-lay.M * 0.02, sy, box.w + lay.M * 0.04, 1);
  g.fillStyle = shade(sem.ground, am, 1.2, sem.shadow);
  g.fillRect(-lay.M * 0.02, sy + lay.sillDepth * 0.4, box.w + lay.M * 0.04, Math.max(2, lay.sillDepth * 0.16));
  g.fillStyle = lit(sem.ground, am, 0.3);
  g.fillRect(0, sy + lay.sillDepth * 0.56, box.w, sh - lay.sillDepth * 0.56);

  // The goods, laid out on the counter.
  drawGoods(
    g,
    box.w * 0.31,
    sy + lay.M * 0.115,
    box.w * 0.66,
    lay.M * 0.2,
    s.quarter.craft,
    s.seed,
    { sem, sunColor: am.sunColor, sunAlpha: am.sunAlpha, shadowAlpha: am.shadowAlpha },
    s.accretion,
  );

  // 7 — the shutter, when the stall is shut. You can see the glow through the
  // open top of the screen and not make out what it is.
  if (s.state === "shut") {
    g.fillStyle = alpha(MATERIALS["lantern"], 0.5 * Math.max(0.25, am.lanternGain));
    g.fillRect(ax, ay, aw, ah);
    const variant = LATTICE_VARIANTS[s.seed % LATTICE_VARIANTS.length]!;
    const panel = latticePanel({
      width: aw,
      height: ah,
      variant,
      pitch: Math.max(11, aw / 11),
      wood: sem.timber,
      woodLit: sem.litEdge,
      woodCut: sem.cut,
      seed: s.seed,
      dpr: lay.dpr,
    });
    g.drawImage(panel, ax, ay, aw, ah);
    // The roller box the shutter came down from.
    g.fillStyle = over(sem.timber, sem.litEdge, 0.2);
    g.fillRect(ax - j, ay - j, aw + j * 2, j * 1.6);
  }
}

// ── the awning ─────────────────────────────────────────────────────────────

function drawAwning(g: CanvasRenderingContext2D, s: ChromeState, box: StallBox): void {
  const { lay, sem, am } = s;
  const pair = STRIPES[s.quarter.stripe % STRIPES.length]!;
  const top = lay.M * 0.2;
  const drop = lay.M * 0.105;
  const w = box.w * 0.96;
  const x0 = box.w * 0.02;

  // Breathing: 2–4 px of skew, with a gust every 18–40 s pushing to 7 px.
  const base = s.reduced ? 0 : idle(s.t, s.seed, 3);
  const gustPhase = (s.t + frand(s.seed) * 30) % 29;
  const gust = s.reduced ? 0 : gustPhase < 0.9 ? Math.sin((gustPhase / 0.9) * Math.PI) * 4 : 0;
  const sway = base + gust;

  const n = 9;
  const stripeW = w / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * stripeW;
    const col = i % 2 === 0 ? pair.a : pair.b;
    g.fillStyle = over(col, am.sunColor, am.sunAlpha * (i % 2 ? 0.5 : 0.2));
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x + stripeW, top);
    g.lineTo(x + stripeW + sway, top + drop);
    g.lineTo(x + sway, top + drop);
    g.closePath();
    g.fill();
    // The selvedge: one brass hairline between every stripe, which is how a
    // real weft line looks and is what keeps the saffron/white pair legible.
    g.strokeStyle = SELVEDGE;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x + stripeW, top);
    g.lineTo(x + stripeW + sway, top + drop);
    g.stroke();
  }

  // The scalloped valance along the hem.
  g.fillStyle = over(pair.a, sem.shadow, am.shadowAlpha * 0.5);
  g.beginPath();
  g.moveTo(x0 + sway, top + drop);
  const scallops = 8;
  for (let i = 0; i < scallops; i++) {
    const sx = x0 + sway + (w * i) / scallops;
    g.quadraticCurveTo(sx + w / scallops / 2, top + drop + lay.M * 0.035, sx + w / scallops, top + drop);
  }
  g.lineTo(x0 + w + sway, top + drop);
  g.closePath();
  g.fill();

  // Two ribs, and the shadow the cloth throws onto the facade.
  g.strokeStyle = sem.metal;
  g.lineWidth = 2;
  for (const rx of [x0 + 2, x0 + w - 2]) {
    g.beginPath();
    g.moveTo(rx, top);
    g.lineTo(rx + sway, top + drop);
    g.stroke();
  }
  g.save();
  g.globalAlpha = am.shadowAlpha * 0.5;
  g.fillStyle = sem.shadow;
  g.fillRect(x0 + sway * 0.5, top + drop, w, lay.M * 0.03);
  g.restore();
}

// ── under construction ─────────────────────────────────────────────────────

/**
 * Past the last built quarter: scaffolding. Poles, ropes, a half-raised dome,
 * a counterweight crane. Not a "coming soon" card — that copy is banned and it
 * would be worse anyway. Scaffolding reads instantly, it is honest, and it is
 * beautiful. When a game ships, it comes down.
 */
function drawScaffolding(g: CanvasRenderingContext2D, s: ChromeState, box: StallBox): void {
  const { sem, am, lay } = s;
  // Bamboo, not bone: cream poles on a cream wall are invisible, and the whole
  // point of scaffolding is that it reads instantly.
  const pole = over(MATERIALS["bronze-700"], am.sunColor, am.sunAlpha * 1.4);
  const rope = over(MATERIALS["mudbrick-500"], sem.shadow, am.shadowAlpha * 0.9);

  // The half-raised dome behind the poles.
  g.fillStyle = shade(sem.ground, am, 0.8, sem.shadow);
  g.beginPath();
  g.moveTo(box.w * 0.2, box.h * 0.66);
  g.quadraticCurveTo(box.w * 0.5, box.h * 0.16, box.w * 0.8, box.h * 0.66);
  g.closePath();
  g.fill();
  g.strokeStyle = sem.cut;
  g.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    g.beginPath();
    g.moveTo(box.w * (0.2 + 0.15 * i), box.h * 0.66);
    g.quadraticCurveTo(box.w * 0.5, box.h * (0.3 + 0.05 * i), box.w * 0.5, box.h * 0.2);
    g.stroke();
  }

  // Poles and ledgers, lashed.
  g.strokeStyle = pole;
  g.lineWidth = Math.max(2.5, lay.M * 0.018);
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    const x = box.w * (0.12 + i * 0.25);
    g.moveTo(x, box.h * 0.2);
    g.lineTo(x + (i % 2 ? 5 : -5), box.h);
  }
  for (let j = 0; j < 4; j++) {
    const y = box.h * (0.28 + j * 0.19);
    g.moveTo(box.w * 0.08, y);
    g.lineTo(box.w * 0.92, y - 4);
  }
  g.stroke();

  // Lashings.
  g.strokeStyle = rope;
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const x = box.w * (0.12 + i * 0.25);
      const y = box.h * (0.28 + j * 0.19);
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.stroke();
    }
  }

  // The counterweight crane: a real machine, with a real counterweight.
  g.strokeStyle = sem.timber;
  g.lineWidth = Math.max(3, lay.M * 0.022);
  g.beginPath();
  g.moveTo(box.w * 0.62, box.h * 0.86);
  g.lineTo(box.w * 0.72, box.h * 0.12);
  g.lineTo(box.w * 0.34, box.h * 0.24);
  g.stroke();
  g.strokeStyle = rope;
  g.lineWidth = 1.5;
  const swing = s.reduced ? 0 : idle(s.t, s.seed, 6);
  g.beginPath();
  g.moveTo(box.w * 0.34, box.h * 0.24);
  g.lineTo(box.w * 0.34 + swing, box.h * 0.52);
  g.stroke();
  g.fillStyle = shade(sem.ground, am, 1.4, sem.shadow);
  g.fillRect(box.w * 0.29 + swing, box.h * 0.52, box.w * 0.1, box.h * 0.07);
  g.fillStyle = sem.timber;
  g.fillRect(box.w * 0.68, box.h * 0.16, box.w * 0.1, box.h * 0.08);
}

/** Two builder-automata, working. The stall is never dead. */
function drawBuilders(g: CanvasRenderingContext2D, s: ChromeState, box: StallBox): void {
  const c = {
    sem: s.sem,
    sunColor: s.am.sunColor,
    sunAlpha: s.am.sunAlpha,
    shadowAlpha: s.am.shadowAlpha,
    reduced: s.reduced,
  };
  drawAutomaton(g, box.w * 0.2, box.h * 0.98, s.lay.M * 0.24, "tessera", s.seed, s.t, c, 0, 0);
  drawAutomaton(g, box.w * 0.78, box.h * 0.88, s.lay.M * 0.2, "rope", s.seed ^ 0x1f, s.t + 1.7, c, 0, 0);
}

/**
 * The lit-shaft response on a stall: when a shaft of light falls across it, the
 * facade brightens. Drawn on the stall canvas so the light reads as landing on
 * the stone rather than floating in front of it.
 */
export function drawStallLight(
  g: CanvasRenderingContext2D,
  am: Ambient,
  box: StallBox,
  shaftDx: number,
): void {
  const k = clamp(1 - Math.abs(shaftDx) / (box.w * 0.9), 0, 1);
  if (k <= 0.01 || am.sunAlpha < 0.02) return;
  g.save();
  g.globalCompositeOperation = "lighter";
  g.fillStyle = alpha(am.sunColor, am.sunAlpha * 0.35 * k * (1 - am.night));
  g.fillRect(0, 0, box.w, box.h);
  g.restore();
}

/** A niche cut into the facade — used by the interstitial fabric. */
export function drawNiche(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sem: Semantic,
  am: Ambient,
): void {
  g.fillStyle = shade(sem.ground, am, 1.4, sem.shadow);
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
}

export const stallSeedFor = (id: string, seed: number): number => mixSeed(seed, id.length * 131);
