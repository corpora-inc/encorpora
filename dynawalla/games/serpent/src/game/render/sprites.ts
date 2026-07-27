/**
 * Every soft-edged thing in the game is a pre-rendered sprite.
 *
 * Building a radial gradient costs roughly as much as filling one, so doing it
 * per particle per frame is the classic way to lose a Canvas2D frame budget.
 * These are built once at start-up and then it is `drawImage` all the way down:
 * a particle, a body glow, a god ray and a shockwave are all the same call.
 */

export type Sprite = HTMLCanvasElement | OffscreenCanvas;

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(w: number, h: number): { c: Sprite; g: Ctx2D } {
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(w, h);
    const g = c.getContext("2d");
    if (!g) throw new Error("no 2d context");
    return { c, g };
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("no 2d context");
  return { c, g };
}

export type RGB = readonly [number, number, number];

export const PALETTE: RGB[] = [
  [255, 215, 106], // good  — gold
  [196, 107, 255], // bad   — violet
  [79, 240, 214], // serpent — teal
  [232, 250, 255], // white
  [143, 233, 255], // plankton
  [255, 122, 92], // hot   — rim heat
];

const rgba = (c: RGB, a: number): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export type SpriteSet = {
  glow: Sprite[];
  mote: Sprite[];
  shard: Sprite[];
  bubble: Sprite;
  ray: Sprite;
  bell: Sprite;
  hunter: Sprite;
  softRing: Sprite[];
};

const GLOW_SIZE = 128;
const MOTE_SIZE = 64;

function buildGlow(c: RGB): Sprite {
  const { c: cv, g } = makeCanvas(GLOW_SIZE, GLOW_SIZE);
  const r = GLOW_SIZE / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, rgba(c, 0.95));
  grad.addColorStop(0.12, rgba(c, 0.62));
  grad.addColorStop(0.32, rgba(c, 0.24));
  grad.addColorStop(0.62, rgba(c, 0.06));
  grad.addColorStop(1, rgba(c, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  return cv;
}

function buildMote(c: RGB): Sprite {
  const { c: cv, g } = makeCanvas(MOTE_SIZE, MOTE_SIZE);
  const r = MOTE_SIZE / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.16, rgba(c, 0.95));
  grad.addColorStop(0.44, rgba(c, 0.28));
  grad.addColorStop(1, rgba(c, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, MOTE_SIZE, MOTE_SIZE);
  return cv;
}

function buildShard(c: RGB): Sprite {
  const { c: cv, g } = makeCanvas(MOTE_SIZE, MOTE_SIZE);
  const r = MOTE_SIZE / 2;
  g.translate(r, r);
  const grad = g.createLinearGradient(-r, 0, r, 0);
  grad.addColorStop(0, rgba(c, 0));
  grad.addColorStop(0.42, rgba(c, 0.9));
  grad.addColorStop(0.55, "rgba(255,255,255,0.95)");
  grad.addColorStop(1, rgba(c, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(-r, 0);
  g.lineTo(0, -r * 0.24);
  g.lineTo(r, 0);
  g.lineTo(0, r * 0.24);
  g.closePath();
  g.fill();
  return cv;
}

function buildBubble(): Sprite {
  const { c: cv, g } = makeCanvas(MOTE_SIZE, MOTE_SIZE);
  const r = MOTE_SIZE / 2;
  g.strokeStyle = "rgba(180,240,255,0.6)";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(r, r, r * 0.62, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(220,250,255,0.85)";
  g.beginPath();
  g.arc(r * 0.72, r * 0.68, r * 0.14, 0, Math.PI * 2);
  g.fill();
  return cv;
}

function buildRay(): Sprite {
  const W = 220;
  const H = 700;
  const { c: cv, g } = makeCanvas(W, H);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(150,235,255,0.30)");
  grad.addColorStop(0.35, "rgba(120,220,255,0.12)");
  grad.addColorStop(1, "rgba(90,200,255,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(W * 0.42, 0);
  g.lineTo(W * 0.58, 0);
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.closePath();
  g.fill();
  // Soften the hard sides by feathering with a horizontal mask.
  g.globalCompositeOperation = "destination-in";
  const mask = g.createLinearGradient(0, 0, W, 0);
  mask.addColorStop(0, "rgba(0,0,0,0)");
  mask.addColorStop(0.5, "rgba(0,0,0,1)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = mask;
  g.fillRect(0, 0, W, H);
  return cv;
}

/**
 * The plankton bell. Deliberately identical whatever the orb is worth — the
 * number on it is the only thing that tells you anything, which is the game.
 */
function buildBell(): Sprite {
  const S = 200;
  const { c: cv, g } = makeCanvas(S, S);
  const r = S / 2;
  g.translate(r, r);

  // Outer bioluminescence — the halo that makes it a creature in water.
  const halo = g.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
  halo.addColorStop(0, "rgba(96,214,255,0.5)");
  halo.addColorStop(0.45, "rgba(58,168,224,0.2)");
  halo.addColorStop(1, "rgba(30,110,180,0)");
  g.fillStyle = halo;
  g.fillRect(-r, -r, S, S);

  // tendrils
  g.strokeStyle = "rgba(150,235,255,0.6)";
  g.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i - 2) * 0.3;
    g.lineWidth = 4.6 - Math.abs(i - 2) * 0.8;
    g.beginPath();
    g.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
    g.quadraticCurveTo(
      Math.cos(a) * r * 0.66 + (i - 2) * 9,
      Math.sin(a) * r * 0.66,
      Math.cos(a) * r * 0.94 + (i - 2) * 15,
      Math.sin(a) * r * 0.9,
    );
    g.stroke();
  }

  // The bell itself: opaque enough to be an object, lit from the top.
  const body = g.createRadialGradient(0, -r * 0.2, r * 0.04, 0, 0, r * 0.62);
  body.addColorStop(0, "rgba(214,250,255,0.98)");
  body.addColorStop(0.35, "rgba(120,214,244,0.93)");
  body.addColorStop(0.7, "rgba(36,132,182,0.9)");
  body.addColorStop(0.95, "rgba(14,72,116,0.86)");
  body.addColorStop(1, "rgba(10,54,92,0.3)");
  g.fillStyle = body;
  g.beginPath();
  g.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  g.fill();

  // A darker chamber in the middle so the numeral always has contrast to sit on.
  const core = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.46);
  core.addColorStop(0, "rgba(4,20,34,0.82)");
  core.addColorStop(0.72, "rgba(5,26,44,0.6)");
  core.addColorStop(1, "rgba(8,40,66,0)");
  g.fillStyle = core;
  g.beginPath();
  g.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = "rgba(190,248,255,0.95)";
  g.lineWidth = 3.6;
  g.beginPath();
  g.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = "rgba(120,222,255,0.4)";
  g.lineWidth = 1.8;
  g.beginPath();
  g.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  g.stroke();

  return cv;
}

/** The hunter: a different animal. It can be carrying the value you want. */
function buildHunter(): Sprite {
  const S = 210;
  const { c: cv, g } = makeCanvas(S, S);
  const r = S / 2;
  g.translate(r, r);

  const halo = g.createRadialGradient(0, 0, r * 0.36, 0, 0, r);
  halo.addColorStop(0, "rgba(255,132,96,0.42)");
  halo.addColorStop(0.5, "rgba(190,64,72,0.16)");
  halo.addColorStop(1, "rgba(90,20,40,0)");
  g.fillStyle = halo;
  g.fillRect(-r, -r, S, S);

  g.strokeStyle = "rgba(255,164,124,0.72)";
  g.lineWidth = 3.4;
  g.lineCap = "round";
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const len = r * (0.68 + (i % 2) * 0.24);
    g.beginPath();
    g.moveTo(Math.cos(a) * r * 0.44, Math.sin(a) * r * 0.44);
    g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    g.stroke();
  }

  const body = g.createRadialGradient(0, -r * 0.16, r * 0.04, 0, 0, r * 0.58);
  body.addColorStop(0, "rgba(255,226,206,0.98)");
  body.addColorStop(0.36, "rgba(238,124,92,0.94)");
  body.addColorStop(0.78, "rgba(126,38,54,0.9)");
  body.addColorStop(1, "rgba(58,14,34,0.5)");
  g.fillStyle = body;
  g.beginPath();
  g.arc(0, 0, r * 0.58, 0, Math.PI * 2);
  g.fill();

  const core = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.46);
  core.addColorStop(0, "rgba(18,4,10,0.85)");
  core.addColorStop(0.74, "rgba(30,8,16,0.6)");
  core.addColorStop(1, "rgba(40,10,20,0)");
  g.fillStyle = core;
  g.beginPath();
  g.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = "rgba(255,196,168,0.95)";
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rr = r * (i % 2 === 0 ? 0.58 : 0.48);
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.stroke();

  return cv;
}

function buildSoftRing(c: RGB): Sprite {
  const S = 160;
  const { c: cv, g } = makeCanvas(S, S);
  const r = S / 2;
  const grad = g.createRadialGradient(r, r, r * 0.62, r, r, r);
  grad.addColorStop(0, rgba(c, 0));
  grad.addColorStop(0.55, rgba(c, 0.55));
  grad.addColorStop(0.8, rgba(c, 0.95));
  grad.addColorStop(1, rgba(c, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return cv;
}

let cache: SpriteSet | null = null;

export function sprites(): SpriteSet {
  if (cache) return cache;
  cache = {
    glow: PALETTE.map(buildGlow),
    mote: PALETTE.map(buildMote),
    shard: PALETTE.map(buildShard),
    bubble: buildBubble(),
    ray: buildRay(),
    bell: buildBell(),
    hunter: buildHunter(),
    softRing: PALETTE.map(buildSoftRing),
  };
  return cache;
}

export const GLOW_PX = GLOW_SIZE;
export const MOTE_PX = MOTE_SIZE;
