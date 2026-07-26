import { COLS, ROWS, idx } from "./core/rules.ts";
import { tierOf } from "./core/levels.ts";
import type { Game, TileView } from "./game.ts";
import { cellCenter, type Layout } from "./layout.ts";
import { clamp01, ease } from "./fx/camera.ts";
import { SpriteCache, chipPath } from "./fx/sprites.ts";
import {
  BG_DEEP,
  BG_MID,
  CHARGE,
  DANGER,
  HAIRLINE,
  HOT,
  KEYC,
  WELL_BACK,
  WELL_RIM,
  mix,
  rgb,
  shade,
  tierColor,
  type Rgb,
} from "./fx/palette.ts";

/**
 * The look: a magnetic containment well seen slightly from above.
 *
 * The 3D is real, not a drop shadow — every chip is an extruded octagonal prism
 * swept toward a vanishing point above the well, so chips at the edges show
 * their sides and chips in the middle stand straight up. The well's own walls
 * are drawn the same way. It costs two extra fills per chip and it is the
 * single thing that stops this reading as a flat puzzle grid.
 */

const DEPTH = 0.062;
const CUT = 0.22;

export type Pt = { x: number; y: number };

/**
 * A cut-cornered octagon. The corner cut is an ABSOLUTE length, not a fraction
 * of each axis — cutting 22% off a tall rectangle's height turns a well into a
 * lozenge, which is exactly what it did the first time.
 */
function octPts(x: number, y: number, w: number, h: number, cut: number): Pt[] {
  const hw = w / 2;
  const hh = h / 2;
  const k = Math.min(cut, Math.min(hw, hh) * 0.85);
  return [
    { x: x - hw + k, y: y - hh },
    { x: x + hw - k, y: y - hh },
    { x: x + hw, y: y - hh + k },
    { x: x + hw, y: y + hh - k },
    { x: x + hw - k, y: y + hh },
    { x: x - hw + k, y: y + hh },
    { x: x - hw, y: y + hh - k },
    { x: x - hw, y: y - hh + k },
  ];
}

function tracePath(g: CanvasRenderingContext2D, pts: Pt[]): void {
  g.beginPath();
  const f = pts[0] as Pt;
  g.moveTo(f.x, f.y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i] as Pt;
    g.lineTo(p.x, p.y);
  }
  g.closePath();
}

/**
 * The silhouette of a convex polygon swept by (ox, oy) — i.e. the side faces of
 * an extruded prism. Standard construction: walk the edges, find where the edge
 * normal flips relative to the sweep, and stitch the two chains.
 */
function sweptHull(g: CanvasRenderingContext2D, pts: Pt[], ox: number, oy: number): void {
  const n = pts.length;
  const facing: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i] as Pt;
    const b = pts[(i + 1) % n] as Pt;
    const nx = b.y - a.y;
    const ny = -(b.x - a.x);
    facing.push(nx * ox + ny * oy > 0);
  }
  let start = -1;
  for (let i = 0; i < n; i++) {
    if (facing[i] && !facing[(i - 1 + n) % n]) start = i;
  }
  if (start < 0) return;
  let count = 0;
  while (facing[(start + count) % n] && count < n) count++;
  g.beginPath();
  const first = pts[start] as Pt;
  g.moveTo(first.x, first.y);
  for (let i = 1; i <= count; i++) {
    const p = pts[(start + i) % n] as Pt;
    g.lineTo(p.x, p.y);
  }
  for (let i = count; i >= 0; i--) {
    const p = pts[(start + i) % n] as Pt;
    g.lineTo(p.x + ox, p.y + oy);
  }
  g.closePath();
  g.fill();
}

/** square-ish shapes: chips, the reactor orb, the replay button */
function octAt(x: number, y: number, w: number, h: number): Pt[] {
  return octPts(x, y, w, h, Math.min(w, h) * CUT);
}

export class Renderer {
  sprites = new SpriteCache();
  private plasma: HTMLCanvasElement | null = null;
  private wellTex: HTMLCanvasElement | null = null;
  private texKey = "";
  debug = false;

  private vpx = 0;
  private vpy = 0;

  resize(l: Layout): void {
    this.sprites.reset(l.dpr);
    const pw = Math.max(24, Math.round(l.w / 7));
    const ph = Math.max(24, Math.round(l.h / 7));
    if (!this.plasma) this.plasma = document.createElement("canvas");
    this.plasma.width = pw;
    this.plasma.height = ph;
    this.texKey = "";
  }

  private maxOff = 24;

  private offsetAt(x: number, y: number): { ox: number; oy: number } {
    const m = this.maxOff;
    const cl = (v: number) => (v > m ? m : v < -m ? -m : v);
    return { ox: cl((x - this.vpx) * DEPTH), oy: cl((y - this.vpy) * DEPTH) };
  }

  draw(g: CanvasRenderingContext2D, game: Game, l: Layout, timeS: number): void {
    this.vpx = l.boardX + l.boardW / 2;
    this.vpy = l.boardY - l.cell * 5.5;
    this.maxOff = l.cell * 0.42;

    const cam = game.cam;
    g.setTransform(l.dpr, 0, 0, l.dpr, 0, 0);
    this.background(g, l, timeS, game);

    g.save();
    const z = 1 + cam.zoom * 0.02;
    g.translate(l.w / 2 + cam.x, l.h / 2 + cam.y);
    g.rotate(cam.rot);
    g.scale(z, z);
    g.translate(-l.w / 2, -l.h / 2);

    this.well(g, l, game, timeS);
    this.aimBeam(g, l, game, timeS);
    this.tiles(g, l, game, timeS);
    this.dying(g, l, game);
    game.parts.draw(g, this.sprites);
    game.rings.draw(g);
    this.cores(g, game);
    this.heldChip(g, l, game, timeS);
    game.pops.draw(g, this.sprites);
    g.restore();

    this.hud(g, l, game, timeS);
    this.overlays(g, l, game, timeS);

    const f = cam.flashAlpha();
    if (f) {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.fillStyle = rgb(f.c, f.a);
      g.fillRect(0, 0, l.w, l.h);
      g.restore();
    }

    if (this.debug) {
      const s = this.sprites.stats();
      this.sprites.drawText(
        g,
        `${Math.round(game.fps)}fps  p${game.parts.count}  s${s.chips + s.glows + s.texts}  ${game.phase}`,
        12,
        [140, 200, 255],
        l.w / 2,
        14,
        700,
        0.7,
      );
    }
  }

  /* ---------------- background ---------------- */

  private background(g: CanvasRenderingContext2D, l: Layout, t: number, game: Game): void {
    const grad = g.createLinearGradient(0, 0, 0, l.h);
    grad.addColorStop(0, rgb(BG_MID));
    grad.addColorStop(0.55, rgb(BG_DEEP));
    grad.addColorStop(1, rgb(shade(BG_MID, 0.7)));
    g.fillStyle = grad;
    g.fillRect(0, 0, l.w, l.h);

    // plasma: three slow blobs on a tiny canvas, upscaled. Blur for free.
    const p = this.plasma;
    if (p) {
      const pg = p.getContext("2d") as CanvasRenderingContext2D;
      pg.clearRect(0, 0, p.width, p.height);
      pg.globalCompositeOperation = "lighter";
      const blobs: [Rgb, number, number, number][] = [
        [[30, 90, 200], 0.5 + Math.sin(t * 0.17) * 0.34, 0.34 + Math.cos(t * 0.13) * 0.22, 0.62],
        [[120, 40, 190], 0.42 + Math.cos(t * 0.11) * 0.36, 0.7 + Math.sin(t * 0.19) * 0.2, 0.55],
        [
          game.danger > 0.62 ? DANGER : ([20, 150, 170] as Rgb),
          0.5 + Math.sin(t * 0.23 + 2) * 0.3,
          0.5 + Math.cos(t * 0.09 + 1) * 0.3,
          0.45 + game.danger * 0.3,
        ],
      ];
      for (const [c, bx, by, br] of blobs) {
        const cx = bx * p.width;
        const cy = by * p.height;
        const r = br * p.width;
        const rg = pg.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.55)`);
        rg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
        pg.fillStyle = rg;
        pg.fillRect(0, 0, p.width, p.height);
      }
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.5;
      g.imageSmoothingEnabled = true;
      g.drawImage(p, 0, 0, l.w, l.h);
      g.restore();
    }

    // a faint scan grid, drawn live because it is only a few dozen strokes
    g.save();
    g.strokeStyle = rgb(HAIRLINE, 0.34);
    g.lineWidth = 1;
    const step = Math.max(46, l.cell);
    g.beginPath();
    for (let x = (t * 6) % step; x < l.w; x += step) {
      g.moveTo(x, 0);
      g.lineTo(x, l.h);
    }
    for (let y = 0; y < l.h; y += step) {
      g.moveTo(0, y);
      g.lineTo(l.w, y);
    }
    g.stroke();
    g.restore();
  }

  /* ---------------- the well ---------------- */

  private well(g: CanvasRenderingContext2D, l: Layout, game: Game, t: number): void {
    const key = `${l.w}x${l.h}x${l.cell}x${l.boardX}x${l.boardY}`;
    if (!this.wellTex || this.texKey !== key) {
      this.wellTex = document.createElement("canvas");
      this.wellTex.width = Math.max(1, Math.round(l.boardW * l.dpr));
      this.wellTex.height = Math.max(1, Math.round(l.boardH * l.dpr));
      const wg = this.wellTex.getContext("2d") as CanvasRenderingContext2D;
      wg.scale(l.dpr, l.dpr);
      const bg = wg.createLinearGradient(0, 0, 0, l.boardH);
      bg.addColorStop(0, rgb(shade(WELL_BACK, 0.55)));
      bg.addColorStop(1, rgb(WELL_BACK));
      wg.fillStyle = bg;
      wg.fillRect(0, 0, l.boardW, l.boardH);
      wg.strokeStyle = rgb(HAIRLINE, 0.85);
      wg.lineWidth = 1;
      wg.beginPath();
      for (let c = 1; c < COLS; c++) {
        wg.moveTo(c * l.cell, 0);
        wg.lineTo(c * l.cell, l.boardH);
      }
      for (let r = 1; r < ROWS; r++) {
        wg.moveTo(0, r * l.cell);
        wg.lineTo(l.boardW, r * l.cell);
      }
      wg.stroke();
      // socket rings, so empty cells read as machined seats
      wg.strokeStyle = rgb(HAIRLINE, 0.6);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          tracePath(wg, octAt((c + 0.5) * l.cell, (r + 0.5) * l.cell, l.cell * 0.62, l.cell * 0.62));
          wg.stroke();
        }
      }
      this.texKey = key;
    }

    // outer prism walls — swept away from the vanishing point, so the well
    // reads as a slab of machined metal you are looking down into
    const wcx = l.wellX + l.wellW / 2;
    const wcy = l.wellY + l.wellH / 2;
    const cut = l.cell * 0.62;
    const outer = octPts(wcx, wcy, l.wellW, l.wellH, cut);
    g.fillStyle = rgb(shade(WELL_RIM, 0.34));
    sweptHull(g, outer, 0, l.cell * 0.34);
    g.fillStyle = rgb(shade(WELL_RIM, 0.5));
    sweptHull(g, outer, (wcx - this.vpx) * 0.02, l.cell * 0.16);

    g.save();
    tracePath(g, outer);
    g.fillStyle = rgb(shade(WELL_BACK, 0.6));
    g.fill();
    g.clip();
    g.drawImage(this.wellTex, l.boardX, l.boardY, l.boardW, l.boardH);
    g.restore();

    // danger: a hazard band you cannot miss, plus a hatch so the warning is
    // never carried by red alone
    const dz = game.danger;
    if (dz > 0.42) {
      const k = clamp01((dz - 0.42) / 0.45);
      const a = k * (0.34 + Math.sin(t * 7) * 0.12);
      g.save();
      // everything in here is machinery inside the well and must stay in it
      g.beginPath();
      g.rect(l.boardX, l.boardY, l.boardW, l.cell * 3);
      g.clip();
      g.globalCompositeOperation = "lighter";
      const hg = g.createLinearGradient(0, l.boardY, 0, l.boardY + l.cell * 3);
      hg.addColorStop(0, rgb(DANGER, a));
      hg.addColorStop(1, rgb(DANGER, 0));
      g.fillStyle = hg;
      g.fillRect(l.boardX, l.boardY, l.boardW, l.cell * 3);

      // diagonal hazard hatching across the top two rows
      g.globalAlpha = k * 0.5;
      g.strokeStyle = rgb(DANGER, 0.9);
      g.lineWidth = Math.max(2, l.cell * 0.07);
      const band = l.cell * 1.35;
      const step = l.cell * 0.5;
      g.beginPath();
      for (let x = -band; x < l.boardW + band; x += step) {
        g.moveTo(l.boardX + x, l.boardY);
        g.lineTo(l.boardX + x + band, l.boardY + band);
      }
      g.stroke();
      g.globalAlpha = 1;
      g.restore();
    }

    // rim
    g.lineWidth = Math.max(2, l.cell * 0.06);
    const hot = clamp01((dz - 0.55) * 2.4) * (0.6 + Math.sin(t * 6.5) * 0.4);
    g.strokeStyle = rgb(mix(WELL_RIM, DANGER, hot), 0.95);
    if (hot > 0.15) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const gl = this.sprites.glow(DANGER, 128);
      g.globalAlpha = hot * 0.35;
      g.drawImage(
        gl as CanvasImageSource,
        l.wellX - l.cell,
        l.wellY - l.cell,
        l.wellW + l.cell * 2,
        l.wellH + l.cell * 2,
      );
      g.restore();
    }
    tracePath(g, outer);
    g.stroke();
  }

  /* ---------------- aim ---------------- */

  private rail(g: CanvasRenderingContext2D, l: Layout, game: Game): void {
    const y = l.headY + l.cell * 0.66;
    g.save();
    g.strokeStyle = rgb(WELL_RIM, 0.75);
    g.lineWidth = Math.max(1.5, l.cell * 0.05);
    g.beginPath();
    g.moveTo(l.boardX - l.cell * 0.2, y);
    g.lineTo(l.boardX + l.boardW + l.cell * 0.2, y);
    g.stroke();
    g.lineWidth = Math.max(1, l.cell * 0.03);
    for (let c = 0; c < COLS; c++) {
      const x = l.boardX + (c + 0.5) * l.cell;
      const on = c === game.heldCol;
      g.strokeStyle = rgb(on ? HOT : WELL_RIM, on ? 0.9 : 0.5);
      g.beginPath();
      g.moveTo(x, y - l.cell * (on ? 0.16 : 0.09));
      g.lineTo(x, y + l.cell * (on ? 0.16 : 0.09));
      g.stroke();
    }
    g.restore();
  }

  private aimBeam(g: CanvasRenderingContext2D, l: Layout, game: Game, t: number): void {
    if (game.phase !== "aim" && game.phase !== "drop") return;
    this.rail(g, l, game);
    const land = game.previewLanding;
    const col = game.heldCol;
    const x = l.boardX + (col + 0.5) * l.cell;
    const bottom = land ? cellCenter(l, land.r, land.c).y : l.boardY + l.boardH;
    const tint = game.previewCells.length > 0 ? HOT : ([90, 170, 255] as Rgb);

    g.save();
    g.globalCompositeOperation = "lighter";
    const bg = g.createLinearGradient(0, l.boardY, 0, bottom);
    // Quiet until it means something: the beam is a faint cyan guide, and it
    // turns hot the instant the landing would fuse. That contrast is the whole
    // tutorial — nobody has to be told the rule, they see it light up.
    const live = game.previewCells.length > 0;
    bg.addColorStop(0, rgb(tint, 0.01));
    bg.addColorStop(1, rgb(tint, live ? 0.5 : 0.13));
    g.fillStyle = bg;
    g.fillRect(x - l.cell * 0.46, l.boardY, l.cell * 0.92, bottom - l.boardY);
    // bright guide edges
    g.strokeStyle = rgb(tint, live ? 0.6 : 0.13);
    g.lineWidth = Math.max(1, l.cell * 0.03);
    g.beginPath();
    g.moveTo(x - l.cell * 0.46, l.boardY);
    g.lineTo(x - l.cell * 0.46, bottom);
    g.moveTo(x + l.cell * 0.46, l.boardY);
    g.lineTo(x + l.cell * 0.46, bottom);
    g.stroke();

    // chevrons falling down the beam
    const n = 4;
    for (let i = 0; i < n; i++) {
      const p = ((t * 1.35 + i / n) % 1) as number;
      const y = l.boardY + p * (bottom - l.boardY);
      const a = (1 - p) * (live ? 0.85 : 0.4);
      g.strokeStyle = rgb(tint, a);
      g.lineWidth = Math.max(1.5, l.cell * 0.05);
      g.beginPath();
      g.moveTo(x - l.cell * 0.22, y - l.cell * 0.1);
      g.lineTo(x, y + l.cell * 0.1);
      g.lineTo(x + l.cell * 0.22, y - l.cell * 0.1);
      g.stroke();
    }
    g.restore();

    if (land) {
      const c = cellCenter(l, land.r, land.c);
      const pulse = 0.86 + Math.sin(t * 8) * 0.05;
      const pts = octAt(c.x, c.y, l.cell * pulse, l.cell * pulse);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = rgb(tint, live ? 0.85 : 0.42);
      g.lineWidth = Math.max(1.5, l.cell * (live ? 0.06 : 0.04));
      g.setLineDash([l.cell * 0.16, l.cell * 0.12]);
      g.lineDashOffset = -t * 40;
      tracePath(g, pts);
      g.stroke();
      g.restore();
    }
  }

  /* ---------------- chips ---------------- */

  private chip(
    g: CanvasRenderingContext2D,
    l: Layout,
    x: number,
    y: number,
    size: number,
    value: number,
    key: number,
    face: { kind: "num" } | { kind: "expr"; text: string },
    hot: number,
    sx: number,
    sy: number,
    alpha = 1,
  ): void {
    const tier = tierOf(value, key);
    const c = tierColor(tier);
    const w = size * sx;
    const h = size * sy;
    // The prism depth is a property of the chip, not of the screen: a 30px
    // instrument chip must not grow the same 28px tail as a chip in the well.
    const raw = this.offsetAt(x, y);
    const lim = size * 0.17;
    const mag = Math.hypot(raw.ox, raw.oy);
    const k = mag > lim ? lim / mag : 1;
    const ox = raw.ox * k;
    const oy = raw.oy * k + size * 0.05;

    g.globalAlpha = alpha;

    // side faces
    const pts = octAt(x, y, w, h);
    g.fillStyle = rgb(shade(c, hot > 0.05 ? 0.5 : 0.3));
    sweptHull(g, pts, ox, oy);

    // under-glow
    g.save();
    g.globalCompositeOperation = "lighter";
    const gl = this.sprites.glow(c, 64);
    const gs = size * (1.75 + hot * 0.7);
    g.globalAlpha = alpha * (0.42 + hot * 0.45);
    g.drawImage(gl as CanvasImageSource, x - gs / 2, y - gs / 2, gs, gs);
    g.restore();

    // top face
    g.globalAlpha = alpha;
    const spr = this.sprites.chip(c, size, hot > 0.35);
    g.drawImage(spr as CanvasImageSource, x - w / 2, y - h / 2, w, h);

    // numeral / expression
    const label = face.kind === "num" ? String(value) : face.text;
    const ideal = face.kind === "num" ? size * 0.5 : size * 0.3;
    let px = Math.max(8, Math.round(ideal));
    const maxW = size * 0.82;
    const measured = this.sprites.measure(label, px);
    if (measured > maxW) px = Math.max(7, Math.round((px * maxW) / measured));
    const textColor = hot > 0.35 ? HOT : mix([235, 245, 255], c, 0.25);
    this.sprites.drawText(g, label, px, textColor, x, y - h * 0.005, 800, alpha);

    if (face.kind === "expr") {
      // a hairline under an expression face: this chip is worth what it says
      g.strokeStyle = rgb(c, alpha * 0.55);
      g.lineWidth = Math.max(1, l.cell * 0.02);
      g.beginPath();
      g.moveTo(x - w * 0.22, y + h * 0.3);
      g.lineTo(x + w * 0.22, y + h * 0.3);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  private tiles(g: CanvasRenderingContext2D, l: Layout, game: Game, t: number): void {
    const key = game.level.key;
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < COLS; c++) {
        const cell = game.board[idx(r, c)];
        if (!cell) continue;
        const v = game.tiles.get(cell.id);
        if (!v) continue;
        this.drawTile(g, l, v, key, t);
      }
    }
  }

  private drawTile(g: CanvasRenderingContext2D, l: Layout, v: TileView, key: number, t: number): void {
    const x = l.boardX + (v.px + 0.5) * l.cell;
    const y = l.boardY + (v.py + 0.5) * l.cell;
    const born = clamp01((t * 1000 - v.landedAt) / 180);
    const pop = v.landedAt > 0 ? 0.9 + ease.outBack(born) * 0.1 : 1;
    const hot = v.hot;
    const size = l.cell * 0.9 * pop;
    this.chip(
      g,
      l,
      x,
      y,
      size,
      v.value,
      key,
      v.face,
      hot,
      1 + v.q,
      1 - v.q,
      1,
    );
  }

  private heldChip(g: CanvasRenderingContext2D, l: Layout, game: Game, t: number): void {
    const h = game.held;
    if (!h || game.phase === "resonance" || game.phase === "breach") return;
    const x = l.boardX + (h.px + 0.5) * l.cell;
    const y = game.phase === "drop" ? l.boardY + (h.py + 0.5) * l.cell : l.headY;

    // trail while falling
    if (game.phase === "drop") {
      for (let i = 4; i >= 1; i--) {
        const ty = y - i * l.cell * 0.28;
        if (ty < l.boardY - l.cell) continue;
        this.chip(g, l, x, ty, l.cell * 0.9, h.value, game.level.key, h.face, 0, 1, 1, 0.1 * (5 - i) * 0.4);
      }
    }

    const breathe = game.phase === "aim" ? 1 + Math.sin(t * 4.5) * 0.018 : 1;
    this.chip(
      g,
      l,
      x,
      y,
      l.cell * 0.98 * breathe,
      h.value,
      game.level.key,
      h.face,
      game.previewCells.length > 0 ? 1 : 0.15,
      1 + h.q,
      1 - h.q,
    );

    if (game.phase === "aim") {
      // the fuse timer: a ring that closes on the held chip. No numerals, no
      // countdown text — it is a shape, so it never reflows the layout.
      const p = game.aimRatio();
      const rr = l.cell * 0.78;
      g.save();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = rgb(p > 0.75 ? DANGER : CHARGE, 0.28 + p * 0.5);
      g.lineWidth = Math.max(2, l.cell * 0.07);
      g.lineCap = "round";
      g.beginPath();
      g.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + (1 - p) * Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }

  private dying(g: CanvasRenderingContext2D, l: Layout, game: Game): void {
    for (const d of game.dying) {
      if (d.t < 0) continue;
      const p = clamp01(d.t / d.dur);
      const c = tierColor(d.tier);
      const x = l.boardX + (d.c + 0.5) * l.cell;
      const y = l.boardY + (d.r + 0.5) * l.cell;
      const s =
        d.kind === "fuse"
          ? l.cell * 0.9 * (1 + ease.outQuint(p) * 0.9) * (1 - ease.inQuad(p))
          : l.cell * 0.9 * (1 - ease.outCubic(p));
      if (s <= 0.5) continue;
      g.save();
      g.globalCompositeOperation = "lighter";
      const gl = this.sprites.glow(p > 0.4 ? HOT : c, 64);
      const gs = l.cell * (2 + p * 2.4);
      g.globalAlpha = (1 - p) * 0.9;
      g.drawImage(gl as CanvasImageSource, x - gs / 2, y - gs / 2, gs, gs);
      g.restore();
      this.chip(g, l, x, y, s, d.value, game.level.key, { kind: "num" }, 1, 1, 1, (1 - p) ** 0.6);
    }
  }

  private cores(g: CanvasRenderingContext2D, game: Game): void {
    if (game.cores.length === 0) return;
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const c of game.cores) {
      if (!c.alive) continue;
      const p = game.corePos(c);
      const size = 42 * p.s;
      const gl = this.sprites.glow(c.color, 64);
      g.globalAlpha = 0.95;
      g.drawImage(gl as CanvasImageSource, p.x - size, p.y - size, size * 2, size * 2);
      this.sprites.drawText(g, String(c.value), Math.max(11, 22 * p.s), HOT, p.x, p.y, 900, 1);
    }
    g.restore();
    g.globalAlpha = 1;
  }

  /* ---------------- instruments ---------------- */

  private hud(g: CanvasRenderingContext2D, l: Layout, game: Game, t: number): void {
    const big = Math.max(24, Math.min(58, l.cell * 0.86));
    const small = Math.max(10, Math.min(16, l.cell * 0.26));

    // score
    const sx = l.scoreX;
    const shown = Math.round(game.shownScore);
    if (l.scoreAlign === "left") {
      const w = this.sprites.measure(String(shown), big);
      this.sprites.drawText(g, String(shown), big, HOT, sx + w / 2, l.scoreY, 900);
      const bw = this.sprites.measure(`BEST ${game.best}`, small);
      this.sprites.drawText(
        g,
        `BEST ${game.best}`,
        small,
        game.newBest ? KEYC : ([120, 145, 200] as Rgb),
        sx + bw / 2,
        l.scoreY + big * 0.62,
        700,
      );
    } else {
      this.sprites.drawText(g, String(shown), big, HOT, sx, l.scoreY, 900);
      this.sprites.drawText(
        g,
        `BEST ${game.best}`,
        small,
        game.newBest ? KEYC : ([120, 145, 200] as Rgb),
        sx,
        l.scoreY + big * 0.62,
        700,
      );
    }

    // chain readout, only while it means something
    if (game.chainShown >= 2 && game.chainShownT < 1.1) {
      const a = 1 - clamp01(game.chainShownT / 1.1);
      const cs = big * (0.7 + (1 - a) * 0.1);
      const cx = l.landscape ? l.scoreX : l.scoreX + this.sprites.measure(String(shown), big) / 2;
      this.sprites.drawText(
        g,
        `${game.chainShown}${"×"} CHAIN`,
        cs * 0.42,
        HOT,
        cx,
        l.scoreY - big * 0.62,
        900,
        a,
      );
    }

    this.reactor(g, l, game, t);

    // level
    const lv = `${game.levelN}`;
    const lvSize = Math.max(14, Math.min(26, l.cell * 0.42));
    const lx = l.landscape ? l.levelX : l.levelX - this.sprites.measure(lv, lvSize) / 2 - 12;
    this.sprites.drawText(g, "LV", lvSize * 0.6, [120, 145, 200], lx - lvSize * 0.85, l.levelY, 800);
    this.sprites.drawText(g, lv, lvSize, KEYC, lx, l.levelY, 900);

    // incoming chips
    const inc = game.peekUpcoming(3);
    for (let i = 0; i < inc.length; i++) {
      const v = inc[i] as number;
      const x = l.incomingVertical ? l.incomingX : l.incomingX + i * l.incomingStep;
      const y = l.incomingVertical ? l.incomingY + i * l.incomingStep : l.incomingY;
      const s = l.chipSize * (i === 0 ? 1 : 0.82);
      g.globalAlpha = 1 - i * 0.24;
      this.chip(g, l, x, y, s, v, game.level.key, { kind: "num" }, 0, 1, 1, 1 - i * 0.24);
      g.globalAlpha = 1;
    }

    this.soundButton(g, l, game);
  }

  private reactor(g: CanvasRenderingContext2D, l: Layout, game: Game, t: number): void {
    const x = l.keyX;
    const y = l.keyY;
    const r = l.keyR;
    const ready = game.charge >= 8;
    const pulse = ready ? 1 + Math.sin(game.chargeReadyPulse * 9) * 0.05 : 1;

    g.save();
    g.globalCompositeOperation = "lighter";
    const gl = this.sprites.glow(ready ? CHARGE : KEYC, 128);
    const gs = r * (3.4 + (ready ? 0.9 : 0)) * pulse;
    g.globalAlpha = 0.5 + (ready ? 0.3 : 0);
    g.drawImage(gl as CanvasImageSource, x - gs / 2, y - gs / 2, gs, gs);
    g.restore();

    // level progress arc (outer)
    g.save();
    g.lineCap = "round";
    g.strokeStyle = rgb([40, 56, 100], 0.9);
    g.lineWidth = Math.max(3, r * 0.13);
    g.beginPath();
    g.arc(x, y, r * 1.34, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = rgb(KEYC, 0.95);
    g.beginPath();
    g.arc(x, y, r * 1.34, -Math.PI / 2, -Math.PI / 2 + game.levelProgress() * Math.PI * 2);
    g.stroke();

    // charge arc (inner)
    g.strokeStyle = rgb([26, 60, 60], 0.9);
    g.lineWidth = Math.max(2, r * 0.1);
    g.beginPath();
    g.arc(x, y, r * 1.12, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = rgb(CHARGE, ready ? 1 : 0.85);
    g.beginPath();
    g.arc(x, y, r * 1.12, -Math.PI / 2, -Math.PI / 2 + game.chargeRatio() * Math.PI * 2);
    g.stroke();
    g.restore();

    // the KEY itself
    const morph = game.keyMorph;
    const scale = (1 + morph * 0.35) * pulse;
    const pts = octAt(x, y, r * 1.62 * scale, r * 1.62 * scale);
    g.fillStyle = rgb(shade(KEYC, 0.24));
    sweptHull(g, pts, 0, r * 0.16);
    tracePath(g, pts);
    const fill = g.createLinearGradient(0, y - r, 0, y + r);
    fill.addColorStop(0, rgb(shade(KEYC, 0.42)));
    fill.addColorStop(1, rgb(shade(KEYC, 0.14)));
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = rgb(ready ? CHARGE : KEYC, 1);
    g.lineWidth = Math.max(2, r * 0.09);
    g.stroke();

    const label = String(game.level.key);
    let px = Math.round(r * 0.92);
    const mw = this.sprites.measure(label, px);
    if (mw > r * 1.32) px = Math.round((px * r * 1.32) / mw);
    this.sprites.drawText(g, label, px, ready ? CHARGE : HOT, x, y + r * 0.02, 900);
    void t;
  }

  private soundButton(g: CanvasRenderingContext2D, l: Layout, game: Game): void {
    const { soundX: x, soundY: y, soundR: r } = l;
    g.save();
    g.strokeStyle = rgb([90, 115, 170], 0.75);
    g.lineWidth = 1.5;
    chipPath(g, x - r, y - r, r * 2, r * 2, r * 0.4);
    g.stroke();
    g.strokeStyle = rgb(game.soundOn ? CHARGE : ([110, 125, 160] as Rgb), 1);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - r * 0.42, y - r * 0.22);
    g.lineTo(x - r * 0.16, y - r * 0.22);
    g.lineTo(x + r * 0.1, y - r * 0.5);
    g.lineTo(x + r * 0.1, y + r * 0.5);
    g.lineTo(x - r * 0.16, y + r * 0.22);
    g.lineTo(x - r * 0.42, y + r * 0.22);
    g.closePath();
    g.stroke();
    if (game.soundOn) {
      g.beginPath();
      g.arc(x + r * 0.2, y, r * 0.28, -0.9, 0.9);
      g.stroke();
      g.beginPath();
      g.arc(x + r * 0.2, y, r * 0.5, -0.9, 0.9);
      g.stroke();
    } else {
      g.beginPath();
      g.moveTo(x + r * 0.24, y - r * 0.26);
      g.lineTo(x + r * 0.6, y + r * 0.26);
      g.moveTo(x + r * 0.6, y - r * 0.26);
      g.lineTo(x + r * 0.24, y + r * 0.26);
      g.stroke();
    }
    g.restore();
  }

  /* ---------------- overlays ---------------- */

  private overlays(g: CanvasRenderingContext2D, l: Layout, game: Game, t: number): void {
    if (game.phase === "boot") {
      const p = clamp01(game.pt / 1.3);
      const a = p < 0.62 ? 1 : 1 - (p - 0.62) / 0.38;
      const s = Math.min(l.w * 0.24, l.h * 0.16) * (0.9 + ease.outBack(clamp01(p * 2.6)) * 0.1);
      g.save();
      g.globalCompositeOperation = "lighter";
      this.sprites.drawText(g, "FUSE", s, HOT, l.w / 2, l.h * 0.42, 900, a);
      g.restore();
    }

    if (game.phase === "levelup") {
      const p = clamp01(game.pt / 1.45);
      const a = p < 0.55 ? ease.outCubic(clamp01(p * 4)) : 1 - (p - 0.55) / 0.45;
      const s = Math.max(16, Math.min(34, l.cell * 0.52));
      this.sprites.drawText(g, `LEVEL ${game.levelN}`, s, KEYC, l.w / 2, l.boardY + l.boardH * 0.26, 900, a);
    }

    if (game.phase === "resonance") this.resonance(g, l, game, t);
    if (game.phase === "breach") this.breach(g, l, game);
  }

  private resonance(g: CanvasRenderingContext2D, l: Layout, game: Game, t: number): void {
    const r = game.res;
    const inT = clamp01(game.pt / 0.32);
    g.save();
    g.fillStyle = `rgba(2,3,10,${0.66 * inT})`;
    g.fillRect(0, 0, l.w, l.h);
    g.restore();

    // redraw the chips above the dim, pulsing, so they read as the answer bank
    const pulse = 0.5 + Math.sin(t * 6) * 0.5;
    for (let rr = ROWS - 1; rr >= 0; rr--) {
      for (let c = 0; c < COLS; c++) {
        const cell = game.board[idx(rr, c)];
        if (!cell) continue;
        const v = game.tiles.get(cell.id);
        if (!v) continue;
        const isPick = r.pickedCell && r.pickedCell.r === rr && r.pickedCell.c === c;
        const hot = isPick ? 1 : pulse * 0.35;
        const x = l.boardX + (v.px + 0.5) * l.cell;
        const y = l.boardY + (v.py + 0.5) * l.cell;
        this.chip(g, l, x, y, l.cell * 0.9, v.value, game.level.key, v.face, hot, 1 + v.q, 1 - v.q);
      }
    }

    const accent = r.rescue ? DANGER : CHARGE;
    const panelY = l.boardY + l.cell * 1.9;
    const scale = ease.outBack(inT);
    const size = Math.max(28, Math.min(78, l.cell * 1.25));
    const q = r.question;
    const prompt = q ? q.prompt : "";
    let px = size;
    const maxW = Math.min(l.w * 0.78, l.boardW * 1.5);
    const mw = this.sprites.measure(prompt, px);
    if (mw > maxW) px = Math.round((px * maxW) / mw);
    const pw = Math.max(this.sprites.measure(prompt, px) + px * 1.5, l.boardW * 0.98);
    const ph = px * 2.35;

    g.save();
    g.translate(l.w / 2, panelY);
    g.scale(scale, scale);

    // backing plate: the prompt must stay legible over a full well
    g.save();
    g.globalCompositeOperation = "lighter";
    const gl = this.sprites.glow(accent, 128);
    g.globalAlpha = 0.5;
    g.drawImage(gl as CanvasImageSource, -pw * 0.75, -ph * 1.1, pw * 1.5, ph * 2.2);
    g.restore();
    tracePath(g, octPts(0, 0, pw, ph, px * 0.42));
    g.fillStyle = "rgba(4,7,18,0.94)";
    g.fill();
    g.strokeStyle = rgb(accent, 0.95);
    g.lineWidth = Math.max(2, px * 0.06);
    g.stroke();

    this.sprites.drawText(g, prompt, px, HOT, 0, -ph * 0.12, 900);
    this.sprites.drawText(g, "= ?", px * 0.62, accent, 0, ph * 0.29, 900, 0.95);
    g.restore();

    // time bar under the plate — a shape, never a numeric countdown
    if (r.result === "none") {
      const p = 1 - clamp01(r.t / r.limit);
      const bw = pw * scale;
      const by = panelY + (ph * scale) / 2 + px * 0.4;
      g.save();
      g.fillStyle = rgb([30, 44, 82], 0.9);
      g.fillRect(l.w / 2 - bw / 2, by, bw, Math.max(4, px * 0.11));
      g.globalCompositeOperation = "lighter";
      g.fillStyle = rgb(p < 0.28 ? DANGER : accent, 1);
      g.fillRect(l.w / 2 - bw / 2, by, bw * p, Math.max(4, px * 0.11));
      g.restore();
    } else {
      const a = clamp01(1 - r.resultT);
      const txt = r.result === "hit" ? String(r.target) : String(r.target);
      const col = r.result === "hit" ? HOT : DANGER;
      const s = Math.max(30, l.cell * 1.2) * (1 + (1 - a) * 0.3);
      this.sprites.drawText(g, txt, s, col, l.w / 2, l.boardY + l.boardH * 0.5, 900, a);
    }
  }

  private breach(g: CanvasRenderingContext2D, l: Layout, game: Game): void {
    const p = clamp01(game.pt / 1.5);
    g.save();
    g.fillStyle = `rgba(3,4,12,${0.72 * clamp01(game.pt / 0.5)})`;
    g.fillRect(0, 0, l.w, l.h);
    g.restore();

    const cy = l.h * 0.4;
    const a = clamp01((game.pt - 0.35) / 0.5);
    if (a <= 0) return;

    const big = Math.max(44, Math.min(112, l.cell * 1.9));
    this.sprites.drawText(g, String(game.score), big, HOT, l.w / 2, cy, 900, a);
    this.sprites.drawText(
      g,
      game.newBest ? `NEW BEST` : `BEST ${game.best}`,
      Math.max(12, big * 0.2),
      game.newBest ? KEYC : ([120, 145, 200] as Rgb),
      l.w / 2,
      cy + big * 0.62,
      800,
      a,
    );

    // replay button
    const br = Math.max(30, Math.min(56, l.cell * 0.95));
    const by = cy + big * 0.62 + br * 1.9;
    const bob = 1 + Math.sin(game.pt * 3.4) * 0.03;
    g.save();
    g.globalAlpha = a;
    g.globalCompositeOperation = "lighter";
    const gl = this.sprites.glow(KEYC, 128);
    g.drawImage(gl as CanvasImageSource, l.w / 2 - br * 2, by - br * 2, br * 4, br * 4);
    g.restore();

    g.save();
    g.globalAlpha = a;
    tracePath(g, octAt(l.w / 2, by, br * 2 * bob, br * 2 * bob));
    g.fillStyle = rgb(shade(KEYC, 0.16));
    g.fill();
    g.strokeStyle = rgb(KEYC, 1);
    g.lineWidth = Math.max(2, br * 0.08);
    g.stroke();

    // circular replay arrow, with the head tangent to the arc it ends on
    const rr = br * 0.55;
    const a0 = -Math.PI * 0.62;
    const a1 = Math.PI * 1.15;
    g.strokeStyle = rgb(HOT, 1);
    g.lineWidth = Math.max(2.5, br * 0.12);
    g.lineCap = "round";
    g.beginPath();
    g.arc(l.w / 2, by, rr, a0, a1);
    g.stroke();
    const ax = l.w / 2 + Math.cos(a0) * rr;
    const ay = by + Math.sin(a0) * rr;
    const tan = a0 - Math.PI / 2; // direction of travel at the head
    const hw = br * 0.24;
    g.beginPath();
    g.moveTo(ax + Math.cos(tan) * hw * 1.5, ay + Math.sin(tan) * hw * 1.5);
    g.lineTo(ax + Math.cos(tan + 2.4) * hw, ay + Math.sin(tan + 2.4) * hw);
    g.lineTo(ax + Math.cos(tan - 2.4) * hw, ay + Math.sin(tan - 2.4) * hw);
    g.closePath();
    g.fillStyle = rgb(HOT, 1);
    g.fill();
    g.restore();
    void p;
  }
}
