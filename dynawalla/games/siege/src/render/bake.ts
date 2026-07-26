/**
 * The static half of the board, baked once into an offscreen canvas: columnar
 * basalt, the cooled crust of the channel, and the buildable slabs. One
 * drawImage per frame instead of two thousand path ops.
 */
import { BOARD } from "../game/constants.ts";
import type { PathData } from "../game/path.ts";
import type { Plot } from "../game/board.ts";
import { makeRng } from "../core/rng.ts";

export const BAKE_SIZE = 1400;

function channelPath(ctx: CanvasRenderingContext2D, path: PathData): void {
  ctx.beginPath();
  const p0 = path.pts[0];
  if (!p0) return;
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < path.pts.length; i++) {
    const p = path.pts[i];
    if (p) ctx.lineTo(p.x, p.y);
  }
}

export function bakeBoard(plots: readonly Plot[], path: PathData): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = BAKE_SIZE;
  cv.height = BAKE_SIZE;
  const ctx = cv.getContext("2d") as CanvasRenderingContext2D;
  const k = BAKE_SIZE / BOARD;
  ctx.scale(k, k);
  const rng = makeRng(0xba5a17);

  // -- ground --------------------------------------------------------------
  const g = ctx.createRadialGradient(BOARD * 0.5, BOARD * 0.42, 40, BOARD * 0.5, BOARD * 0.5, BOARD * 0.78);
  g.addColorStop(0, "#120d0f");
  g.addColorStop(0.62, "#0d090b");
  g.addColorStop(1, "#060405");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BOARD, BOARD);

  // -- columnar basalt: jittered hex cells ---------------------------------
  const R = 25;
  const dx = R * 1.732;
  const dy = R * 1.5;
  const tones = ["#100c0e", "#151013", "#0d090b", "#181114", "#0b0809"];
  ctx.lineWidth = 1.1;
  for (let row = -1; row * dy < BOARD + R; row++) {
    for (let col = -1; col * dx < BOARD + dx; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0) + rng.r(-3.5, 3.5);
      const cy = row * dy + rng.r(-3.5, 3.5);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const rr = R * rng.r(0.86, 1.02);
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = tones[rng.i(0, tones.length - 1)] as string;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.stroke();
      if (rng.chance(0.07)) {
        ctx.strokeStyle = "rgba(120,66,40,0.16)";
        ctx.stroke();
      }
    }
  }

  // -- cooling cracks bleeding heat ----------------------------------------
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 26; i++) {
    let x = rng.r(0, BOARD);
    let y = rng.r(0, BOARD);
    let a = rng.r(0, Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = rng.i(4, 11);
    for (let sgi = 0; sgi < segs; sgi++) {
      a += rng.r(-0.8, 0.8);
      const len = rng.r(18, 62);
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(190,72,22,${rng.r(0.05, 0.15).toFixed(3)})`;
    ctx.lineWidth = rng.r(1, 3.4);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";

  // -- the channel: a dark trench with a narrow molten bed ------------------
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const bands: [number, string][] = [
    [94, "#050303"], // the trench swallows light at its lip
    [78, "#120a09"],
    [60, "#1c0c09"],
    [42, "#2c0f06"],
    [24, "#4a1404"],
  ];
  for (const [w, col] of bands) {
    channelPath(ctx, path);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
  }

  // flow banding: striations along the current, so the bed reads as moving rock
  // rather than a lit tube
  {
    const q = { x: 0, y: 0 };
    const dd = { x: 0, y: 0 };
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = 0; i < 900; i++) {
      const s0 = rng.r(0, path.length);
      path.at(s0, q);
      path.dirAt(s0, dd);
      const nx = -dd.y;
      const ny = dd.x;
      const off = rng.r(-26, 26);
      const bright = 1 - Math.abs(off) / 26;
      const len = rng.r(8, 46);
      ctx.beginPath();
      ctx.moveTo(q.x + nx * off, q.y + ny * off);
      ctx.lineTo(q.x + nx * off + dd.x * len, q.y + ny * off + dd.y * len);
      ctx.strokeStyle = `rgba(255,${Math.round(120 + bright * 110)},${Math.round(28 + bright * 90)},${(0.05 + bright * 0.16).toFixed(3)})`;
      ctx.lineWidth = rng.r(1, 3.6);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // crust plates riding the surface — the reason it reads as rock, not neon
  const p = { x: 0, y: 0 };
  const d = { x: 0, y: 0 };
  for (let i = 0; i < 520; i++) {
    const s = rng.r(0, path.length);
    path.at(s, p);
    path.dirAt(s, d);
    const nx = -d.y;
    const ny = d.x;
    const off = rng.r(-34, 34);
    const cx = p.x + nx * off;
    const cy = p.y + ny * off;
    const w = rng.r(6, 18);
    const h = rng.r(4, 10);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(d.y, d.x) + rng.r(-0.5, 0.5));
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w * 0.2, -h / 2);
    ctx.lineTo(w / 2, -h * 0.3);
    ctx.lineTo(w * 0.3, h / 2);
    ctx.closePath();
    const near = Math.abs(off) / 34;
    ctx.fillStyle = `rgba(${12 + Math.round(near * 8)},${6 + Math.round(near * 4)},${6},${rng.r(0.7, 0.98).toFixed(2)})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,120,36,0.09)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // -- buildable slabs: machined sockets bolted into the rock ---------------
  const chamfer = (c: CanvasRenderingContext2D, h: number, cut: number): void => {
    c.beginPath();
    c.moveTo(-h + cut, -h);
    c.lineTo(h - cut, -h);
    c.lineTo(h, -h + cut);
    c.lineTo(h, h - cut);
    c.lineTo(h - cut, h);
    c.lineTo(-h + cut, h);
    c.lineTo(-h, h - cut);
    c.lineTo(-h, -h + cut);
    c.closePath();
  };

  for (const plot of plots) {
    ctx.save();
    ctx.translate(plot.x, plot.y);
    ctx.rotate(plot.rot);
    const h = plot.size / 2;
    const cut = h * 0.3;

    ctx.translate(3, 5);
    chamfer(ctx, h, cut);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fill();
    ctx.translate(-3, -5);

    chamfer(ctx, h, cut);
    const gg = ctx.createLinearGradient(-h, -h, h, h);
    gg.addColorStop(0, "#2b2024");
    gg.addColorStop(0.55, "#1b1417");
    gg.addColorStop(1, "#100b0d");
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // brushed metal grain
    ctx.save();
    chamfer(ctx, h, cut);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,200,150,0.035)";
    ctx.lineWidth = 1;
    for (let i = -14; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(-h, i * 4 + rng.r(-1, 1));
      ctx.lineTo(h, i * 4 + rng.r(-1, 1));
      ctx.stroke();
    }
    ctx.restore();

    // top bevel catches the light from the channel
    chamfer(ctx, h - 3, cut * 0.82);
    ctx.strokeStyle = "rgba(255,170,90,0.13)";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // recessed socket — where a tower will seat
    const sr = h * 0.44;
    ctx.beginPath();
    ctx.arc(0, 0, sr, 0, 6.284);
    ctx.fillStyle = "#0a0708";
    ctx.fill();
    const sg = ctx.createRadialGradient(0, sr * 0.3, 1, 0, 0, sr);
    sg.addColorStop(0, "rgba(255,120,40,0.16)");
    sg.addColorStop(1, "rgba(255,80,20,0)");
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,160,80,0.20)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, sr * 0.55, 0, 6.284);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // bolt heads
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const bx = sx * (h - cut * 0.62);
      const by = sy * (h - cut * 0.62);
      ctx.beginPath();
      ctx.arc(bx, by, 3.2, 0, 6.284);
      ctx.fillStyle = "#3a2c2c";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx - 0.7, by - 0.7, 1.5, 0, 6.284);
      ctx.fillStyle = "rgba(255,200,150,0.28)";
      ctx.fill();
    }
    ctx.restore();
  }

  // -- vignette so the fight sits in the middle of the eye -----------------
  const vg = ctx.createRadialGradient(BOARD / 2, BOARD / 2, BOARD * 0.36, BOARD / 2, BOARD / 2, BOARD * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.52)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, BOARD, BOARD);

  return cv;
}
