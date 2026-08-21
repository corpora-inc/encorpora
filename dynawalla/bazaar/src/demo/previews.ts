/**
 * Ten stub previews — one per quarter — so the bazaar is playable standalone.
 *
 * BZ-07 — the preview shows the game being played **correctly**: a ghost hand
 * solving, at half speed, looping on `period`. Not a title card, not a logo,
 * not a menu. A child must be able to tell what they would *do* in there
 * without entering.
 *
 * And note what these deliberately are **not**: they are not minaret-punk.
 * BZ-LAW-1 — the frame never colonises the preview. Ten games look like ten
 * different games; the place you walk through to reach them is one place. Each
 * of these owns its own ground, its own palette and its own type. That contrast
 * *is* the design.
 *
 * The real games in `dynawalla/games/*` replace these by implementing the same
 * `StallPreview` interface. Nothing else about the bazaar changes when they do.
 */

import type { PreviewFrame, StallPreview } from "../types.ts";

const TAU = Math.PI * 2;

/** The ghost hand: a soft pointer, at half speed, never a cursor arrow. */
function hand(g: CanvasRenderingContext2D, x: number, y: number, s: number, a = 0.5): void {
  g.save();
  g.globalAlpha = a;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.ellipse(x, y, s * 0.5, s * 0.66, -0.35, 0, TAU);
  g.fill();
  g.globalAlpha = a * 0.55;
  g.beginPath();
  g.ellipse(x + s * 0.36, y + s * 0.2, s * 0.2, s * 0.42, 0.2, 0, TAU);
  g.fill();
  g.restore();
}

const ease = (u: number): number => u * u * (3 - 2 * u);
const seg = (t: number, a: number, b: number): number =>
  Math.max(0, Math.min(1, (t - a) / (b - a)));

function ground(g: CanvasRenderingContext2D, o: PreviewFrame, fill: string): void {
  g.fillStyle = fill;
  g.fillRect(0, 0, o.width, o.height);
}

function label(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  px: number,
  color: string,
  align: CanvasTextAlign = "center",
): void {
  g.fillStyle = color;
  g.font = `600 ${px}px ui-rounded, system-ui, sans-serif`;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.fillText(text, x, y);
  g.textAlign = "left";
}

// ── 1. Weighers' Row — a balance you can see settle ────────────────────────
const weighers: StallPreview = {
  period: 6,
  render(g, o) {
    ground(g, o, "#26303a");
    const u = o.reducedMotion ? 1 : o.t / this.period;
    const w = o.width;
    const h = o.height;
    const cx = w / 2;
    const pivot = h * 0.42;
    const drop = ease(seg(u, 0.15, 0.55));
    const tilt = (1 - drop) * -0.22;

    g.strokeStyle = "#8fa6b8";
    g.lineWidth = Math.max(2, w * 0.014);
    g.beginPath();
    g.moveTo(cx, pivot);
    g.lineTo(cx, h * 0.86);
    g.stroke();

    g.save();
    g.translate(cx, pivot);
    g.rotate(tilt);
    g.strokeStyle = "#d9e6f0";
    g.beginPath();
    g.moveTo(-w * 0.32, 0);
    g.lineTo(w * 0.32, 0);
    g.stroke();
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * w * 0.32, 0);
      g.lineTo(side * w * 0.32, h * 0.1);
      g.stroke();
      g.fillStyle = "#4d6577";
      g.fillRect(side * w * 0.32 - w * 0.12, h * 0.1, w * 0.24, h * 0.03);
    }
    // Three on the left, four coming down on the right.
    g.fillStyle = "#f0c04a";
    for (let i = 0; i < 3; i++) {
      g.fillRect(-w * 0.32 - w * 0.09 + i * w * 0.062, h * 0.1 - h * 0.075, w * 0.05, h * 0.07);
    }
    const placed = Math.min(4, Math.floor(seg(u, 0.15, 0.55) * 5));
    g.fillStyle = "#7ad0c0";
    for (let i = 0; i < placed; i++) {
      g.fillRect(w * 0.32 - w * 0.11 + i * w * 0.055, h * 0.1 - h * 0.075, w * 0.045, h * 0.07);
    }
    g.restore();

    label(g, "3 + 4 = 7", cx, h * 0.13, Math.max(13, h * 0.11), "#e7f0f6");
    if (!o.reducedMotion && u > 0.12 && u < 0.6) {
      hand(g, cx + w * 0.3, pivot + h * 0.02 - (1 - ease(seg(u, 0.12, 0.5))) * h * 0.22, w * 0.07);
    }
  },
};

// ── 2. Money-changers' Arcade — place value, in coin ───────────────────────
const money: StallPreview = {
  period: 7,
  render(g, o) {
    ground(g, o, "#f6f1e4");
    const u = o.reducedMotion ? 1 : o.t / this.period;
    const w = o.width;
    const h = o.height;
    const cols = 3;
    const names = ["100", "10", "1"];
    const target = [2, 4, 5];
    for (let c = 0; c < cols; c++) {
      const cx = w * (0.22 + c * 0.28);
      g.strokeStyle = "#c9bda2";
      g.lineWidth = 2;
      g.strokeRect(cx - w * 0.1, h * 0.26, w * 0.2, h * 0.52);
      label(g, names[c]!, cx, h * 0.18, Math.max(11, h * 0.085), "#7a6a4c");
      const n = Math.floor(ease(seg(u, 0.1 + c * 0.22, 0.42 + c * 0.22)) * target[c]! + 0.001);
      for (let i = 0; i < n; i++) {
        const y = h * 0.74 - i * h * 0.075;
        g.fillStyle = c === 0 ? "#c98a2c" : c === 1 ? "#d8ab3f" : "#ecc861";
        g.beginPath();
        g.ellipse(cx, y, w * 0.075, h * 0.032, 0, 0, TAU);
        g.fill();
        g.strokeStyle = "#8a5f1d";
        g.lineWidth = 1;
        g.stroke();
      }
    }
    label(g, "245", w / 2, h * 0.9, Math.max(15, h * 0.13), "#3a3020");
    if (!o.reducedMotion && u < 0.9) {
      const c = Math.min(2, Math.floor(u * 3));
      hand(g, w * (0.22 + c * 0.28), h * (0.3 + 0.35 * ((u * 3) % 1)), w * 0.07, 0.4);
    }
  },
};

// ── 3. Tilers' Court — an array filling in ─────────────────────────────────
const tilers: StallPreview = {
  period: 6,
  render(g, o) {
    ground(g, o, "#123b3f");
    const u = o.reducedMotion ? 1 : o.t / this.period;
    const w = o.width;
    const h = o.height;
    const cols = 12;
    const rows = 8;
    const pad = w * 0.08;
    const cw = (w - pad * 2) / cols;
    const ch = (h * 0.62) / rows;
    const filled = Math.floor(ease(seg(u, 0.05, 0.8)) * cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const ix = j * cols + i;
        const x = pad + i * cw;
        const y = h * 0.24 + j * ch;
        g.fillStyle = ix < filled ? (ix % 3 === 0 ? "#2fa6a8" : "#e8b93f") : "#0d2b2e";
        g.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      }
    }
    label(g, `12 × 8 = ${filled >= cols * rows ? 96 : filled}`, w / 2, h * 0.14, Math.max(14, h * 0.11), "#eaf6f2");
    if (!o.reducedMotion && filled < cols * rows) {
      const i = filled % cols;
      const j = Math.floor(filled / cols);
      hand(g, pad + i * cw + cw / 2, h * 0.24 + j * ch + ch / 2, w * 0.06, 0.45);
    }
  },
};

// ── 4. The Rope-walk — three fifths of forty ───────────────────────────────
const rope: StallPreview = {
  period: 7,
  render(g, o) {
    ground(g, o, "#efe3cd");
    const u = o.reducedMotion ? 1 : o.t / this.period;
    const w = o.width;
    const h = o.height;
    const x0 = w * 0.08;
    const x1 = w * 0.92;
    const y = h * 0.52;
    g.strokeStyle = "#9c8659";
    g.lineWidth = Math.max(8, h * 0.075);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    g.stroke();
    const parts = 5;
    const shown = ease(seg(u, 0.1, 0.7)) * 3;
    for (let i = 0; i < parts; i++) {
      const a = x0 + ((x1 - x0) * i) / parts;
      const b = x0 + ((x1 - x0) * (i + 1)) / parts;
      if (i < Math.floor(shown)) {
        g.strokeStyle = "#a33a2c";
        g.beginPath();
        g.moveTo(a, y);
        g.lineTo(b, y);
        g.stroke();
      }
      g.strokeStyle = "#4a3220";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(b, y - h * 0.11);
      g.lineTo(b, y + h * 0.11);
      g.stroke();
      g.lineWidth = Math.max(8, h * 0.075);
      label(g, String((i + 1) * 8), (a + b) / 2, y + h * 0.2, Math.max(10, h * 0.075), "#6b5940");
    }
    label(g, "⅗ of 40 = 24", w / 2, h * 0.16, Math.max(14, h * 0.11), "#2a2015");
    if (!o.reducedMotion && shown < 3) hand(g, x0 + ((x1 - x0) * shown) / parts, y - h * 0.16, w * 0.06, 0.4);
  },
};

// ── 5. Astrolabists' Gallery — an angle swept and read ─────────────────────
const astro: StallPreview = {
  period: 8,
  render(g, o) {
    ground(g, o, "#101a3a");
    const u = o.reducedMotion ? 1 : o.t / this.period;
    const w = o.width;
    const h = o.height;
    const cx = w / 2;
    const cy = h * 0.62;
    const r = Math.min(w, h) * 0.36;
    g.strokeStyle = "#5c8fe8";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.stroke();
    g.strokeStyle = "#2e58b0";
    g.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.lineTo(cx + Math.cos(a) * r * (i % 3 === 0 ? 0.84 : 0.92), cy + Math.sin(a) * r * (i % 3 === 0 ? 0.84 : 0.92));
      g.stroke();
    }
    const sweep = ease(seg(u, 0.1, 0.7)) * (TAU / 8);
    g.fillStyle = "rgba(232,185,63,0.28)";
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, r * 0.8, -Math.PI / 2, -Math.PI / 2 + sweep);
    g.closePath();
    g.fill();
    g.strokeStyle = "#e8ce79";
    g.lineWidth = Math.max(2, w * 0.012);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx, cy - r);
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.sin(sweep) * r, cy - Math.cos(sweep) * r);
    g.stroke();
    label(g, `${Math.round((sweep / TAU) * 360)}°`, cx + r * 0.42, cy - r * 0.5, Math.max(13, h * 0.1), "#f0e2c6");
    label(g, "360° ÷ 8 = 45°", cx, h * 0.13, Math.max(13, h * 0.1), "#a9c9e6");
    if (!o.reducedMotion && sweep < TAU / 8 - 0.01) {
      hand(g, cx + Math.sin(sweep) * r, cy - Math.cos(sweep) * r, w * 0.06, 0.45);
    }
  },
};

// ── 6. The Waterworks — two channels at three to two ───────────────────────
const water: StallPreview = {
  period: 6,
  render(g, o) {
    ground(g, o, "#dceaf0");
    const u = o.reducedMotion ? 1 : o.t / this.period;
    const w = o.width;
    const h = o.height;
    const fill = ease(seg(u, 0.08, 0.85));
    const tanks: [number, number][] = [
      [0.26, 9],
      [0.68, 6],
    ];
    for (const [fx, cap] of tanks) {
      const x = w * fx - w * 0.13;
      const tw = w * 0.26;
      const ty = h * 0.28;
      const th = h * 0.54;
      g.fillStyle = "#ffffff";
      g.fillRect(x, ty, tw, th);
      const level = th * (fill * (cap / 9));
      g.fillStyle = "#2c8fa6";
      g.fillRect(x, ty + th - level, tw, level);
      g.fillStyle = "#7fc6d8";
      g.fillRect(x, ty + th - level, tw, Math.min(4, level));
      g.strokeStyle = "#1d5b6b";
      g.lineWidth = 2;
      g.strokeRect(x, ty, tw, th);
      for (let i = 1; i < 9; i++) {
        g.beginPath();
        g.moveTo(x, ty + (th * i) / 9);
        g.lineTo(x + tw * 0.18, ty + (th * i) / 9);
        g.stroke();
      }
      label(g, String(Math.round(fill * cap)), x + tw / 2, ty - h * 0.07, Math.max(12, h * 0.09), "#134753");
    }
    label(g, "3 : 2", w / 2, h * 0.92, Math.max(14, h * 0.12), "#0d3540");
  },
};

// ── 7. Dyers' Lane — two fifths and one fifth ──────────────────────────────
const dyers: StallPreview = {
  period: 7,
  render(g, o) {
    ground(g, o, "#faf7f0");
    const u = o.reducedMotion ? 1 : o.t / this.period;
    const w = o.width;
    const h = o.height;
    const bw = w * 0.84;
    const x0 = w * 0.08;
    const rows: [number, string, number][] = [
      [0.3, "#23356b", 2],
      [0.5, "#a33a2c", 1],
    ];
    for (const [fy, col, n] of rows) {
      const y = h * fy;
      for (let i = 0; i < 5; i++) {
        const x = x0 + (bw * i) / 5;
        g.fillStyle = i < n ? col : "#e8e0d0";
        g.fillRect(x + 1, y, bw / 5 - 2, h * 0.12);
      }
      g.strokeStyle = "#3a3020";
      g.lineWidth = 1.5;
      g.strokeRect(x0, y, bw, h * 0.12);
    }
    const merged = ease(seg(u, 0.35, 0.85));
    const y = h * 0.72;
    for (let i = 0; i < 5; i++) {
      const x = x0 + (bw * i) / 5;
      const on = i < 3 * merged;
      g.fillStyle = on ? (i < 2 ? "#23356b" : "#a33a2c") : "#e8e0d0";
      g.fillRect(x + 1, y, bw / 5 - 2, h * 0.14);
    }
    g.strokeStyle = "#3a3020";
    g.lineWidth = 1.5;
    g.strokeRect(x0, y, bw, h * 0.14);
    label(g, "⅖ + ⅕ = ⅗", w / 2, h * 0.15, Math.max(14, h * 0.11), "#2a2015");
    if (!o.reducedMotion && merged < 1) hand(g, x0 + bw * 0.5, h * 0.62, w * 0.06, 0.35);
  },
};

// ── 8. Kite-makers' Yard — an angle taken off a straight line ──────────────
const kites: StallPreview = {
  period: 6,
  render(g, o) {
    ground(g, o, "#bcd9ea");
    const u = o.reducedMotion ? 1 : o.t / this.period;
    const w = o.width;
    const h = o.height;
    const cx = w / 2;
    const cy = h * 0.7;
    const r = Math.min(w, h) * 0.34;
    g.strokeStyle = "#37546b";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - r, cy);
    g.lineTo(cx + r, cy);
    g.stroke();
    const a = (55 * Math.PI) / 180 * ease(seg(u, 0.1, 0.7));
    g.fillStyle = "rgba(163,58,44,0.3)";
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, r * 0.5, Math.PI, Math.PI + a);
    g.closePath();
    g.fill();
    g.strokeStyle = "#a33a2c";
    g.lineWidth = Math.max(2, w * 0.012);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx - Math.cos(a) * r, cy + Math.sin(a) * r);
    g.stroke();
    // The kite that the angle is the corner of.
    g.fillStyle = "#e8b93f";
    g.beginPath();
    g.moveTo(cx, cy - r * 0.15);
    g.lineTo(cx + r * 0.42, cy - r * 0.62);
    g.lineTo(cx, cy - r * 1.25);
    g.lineTo(cx - r * 0.42, cy - r * 0.62);
    g.closePath();
    g.fill();
    g.strokeStyle = "#7a5a1c";
    g.lineWidth = 1.5;
    g.stroke();
    label(g, `${Math.round(180 - (a * 180) / Math.PI)}°`, cx + r * 0.42, cy - h * 0.05, Math.max(12, h * 0.1), "#16303f");
    label(g, "180° − 55° = 125°", cx, h * 0.12, Math.max(12, h * 0.095), "#16303f");
  },
};

// ── 9. Clockmakers' Terrace — a gear ratio is a fraction ───────────────────
const clocks: StallPreview = {
  period: 8,
  render(g, o) {
    ground(g, o, "#1a1611");
    const u = o.reducedMotion ? 0 : o.t;
    const w = o.width;
    const h = o.height;
    const mod = Math.min(w, h) * 0.014;
    const a = u * 0.55;
    const pairs: [number, number, number, number][] = [
      [24, w * 0.34, h * 0.56, a],
      [18, w * 0.34 + mod * 21, h * 0.56, -a * (24 / 18)],
    ];
    for (const [teeth, x, y, ang] of pairs) {
      const r = (mod * teeth) / 2;
      g.fillStyle = "#c9a227";
      g.beginPath();
      for (let k = 0; k < teeth; k++) {
        const t0 = ang + (k / teeth) * TAU;
        const t1 = ang + ((k + 0.5) / teeth) * TAU;
        g.lineTo(x + r * Math.cos(t0), y + r * Math.sin(t0));
        g.lineTo(x + r * 1.13 * Math.cos(t1), y + r * 1.13 * Math.sin(t1));
      }
      g.closePath();
      g.fill();
      g.fillStyle = "#1a1611";
      g.beginPath();
      g.arc(x, y, r * 0.28, 0, TAU);
      g.fill();
      g.strokeStyle = "#8f6e1e";
      g.lineWidth = Math.max(2, r * 0.16);
      g.beginPath();
      for (let k = 0; k < 5; k++) {
        const t0 = ang + (k / 5) * TAU;
        g.moveTo(x + r * 0.28 * Math.cos(t0), y + r * 0.28 * Math.sin(t0));
        g.lineTo(x + r * 0.8 * Math.cos(t0), y + r * 0.8 * Math.sin(t0));
      }
      g.stroke();
      label(g, String(teeth), x, y + r + h * 0.09, Math.max(11, h * 0.085), "#e8ce79");
    }
    label(g, "24 : 18 = 4 : 3", w / 2, h * 0.13, Math.max(13, h * 0.1), "#f0e2c6");
  },
};

// ── 10. Millers' Yard — forty-seven into fives, two over ───────────────────
const millers: StallPreview = {
  period: 7,
  render(g, o) {
    ground(g, o, "#3a2c1e");
    const u = o.reducedMotion ? 1 : o.t / this.period;
    const w = o.width;
    const h = o.height;
    const total = 47;
    const per = 5;
    const done = Math.floor(ease(seg(u, 0.05, 0.85)) * total);
    const sacks = Math.floor(done / per);
    const rem = done % per;
    for (let s = 0; s < 9; s++) {
      const x = w * (0.12 + (s % 5) * 0.19);
      const y = h * (0.42 + Math.floor(s / 5) * 0.3);
      g.fillStyle = s < sacks ? "#e6dcc4" : "#4c3b28";
      g.beginPath();
      g.ellipse(x, y, w * 0.062, h * 0.075, 0, 0, TAU);
      g.fill();
      if (s < sacks) {
        g.strokeStyle = "#8a7048";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x - w * 0.04, y - h * 0.02);
        g.lineTo(x + w * 0.04, y - h * 0.02);
        g.stroke();
      }
    }
    for (let i = 0; i < rem; i++) {
      g.fillStyle = "#e8b93f";
      g.beginPath();
      g.arc(w * 0.5 + (i - 2) * w * 0.045, h * 0.9, w * 0.016, 0, TAU);
      g.fill();
    }
    label(g, `47 ÷ 5 = ${sacks} r ${rem}`, w / 2, h * 0.16, Math.max(13, h * 0.105), "#f2e7d2");
  },
};

export const DEMO_PREVIEWS: Record<string, StallPreview> = {
  weighers,
  "money-changers": money,
  tilers,
  "rope-walk": rope,
  astrolabists: astro,
  waterworks: water,
  dyers,
  "kite-makers": kites,
  clockmakers: clocks,
  millers,
};

export const DEMO_TITLES: Record<string, string> = {
  weighers: "Steelyard",
  "money-changers": "Counting House",
  tilers: "Tessera",
  "rope-walk": "Fathom",
  astrolabists: "Alidade",
  waterworks: "Qanat",
  dyers: "Vat",
  "kite-makers": "Sarband",
  clockmakers: "Escapement",
  millers: "Quern",
};
