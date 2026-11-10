import type { FillRole, InkRole } from "../roles";

/**
 * Everyday things a young child counts: fruit, toys, animals, vehicles, school
 * things, nature and food. Each is a flat drawing in a 100 by 100 box (y down):
 * a tint with an outline of its own hue, a few details, nothing decorative.
 * Paints are theme roles, so a drawing is right in light, dark and print.
 *
 * This module is plain data and geometry: no schema and no DOM. The scene
 * component (things.ts) and the lesson-film kit (film/things.ts) both draw
 * from it, so a thing looks the same in a problem and in a film.
 */
export const thingKinds = [
  // fruit
  "apple",
  "banana",
  "strawberry",
  "orange",
  // toys
  "ball",
  "block",
  "bear",
  "balloon",
  // animals
  "duck",
  "fish",
  "cat",
  "ladybug",
  // vehicles
  "car",
  "bus",
  "boat",
  // school things
  "pencil",
  "book",
  "backpack",
  // nature
  "flower",
  "leaf",
  "star",
  // food
  "cookie",
  "egg",
  "carrot",
] as const;
export type ThingKind = (typeof thingKinds)[number];
export const isThingKind = (value: unknown): value is ThingKind =>
  typeof value === "string" && (thingKinds as readonly string[]).includes(value);

/** One and many, as a child says them. */
export const thingNames: Record<ThingKind, [string, string]> = {
  apple: ["apple", "apples"],
  banana: ["banana", "bananas"],
  strawberry: ["strawberry", "strawberries"],
  orange: ["orange", "oranges"],
  ball: ["ball", "balls"],
  block: ["block", "blocks"],
  bear: ["teddy bear", "teddy bears"],
  balloon: ["balloon", "balloons"],
  duck: ["duck", "ducks"],
  fish: ["fish", "fish"],
  cat: ["cat", "cats"],
  ladybug: ["ladybug", "ladybugs"],
  car: ["car", "cars"],
  bus: ["bus", "buses"],
  boat: ["boat", "boats"],
  pencil: ["pencil", "pencils"],
  book: ["book", "books"],
  backpack: ["backpack", "backpacks"],
  flower: ["flower", "flowers"],
  leaf: ["leaf", "leaves"],
  star: ["star", "stars"],
  cookie: ["cookie", "cookies"],
  egg: ["egg", "eggs"],
  carrot: ["carrot", "carrots"],
};
export const thingName = (kind: ThingKind, count: number) =>
  thingNames[kind][count === 1 ? 0 : 1];

/**
 * One painted layer. `d` is SVG path data with absolute M, L, Q, C and Z only.
 * `w` is the stroke's weight: 1 is the outline, less is a detail.
 */
export type ThingLayer = {
  d: string;
  fill?: FillRole;
  stroke?: InkRole;
  w?: number;
};

const n = (v: number) => +v.toFixed(2);
/** An ellipse as four cubic curves. */
const oval = (cx: number, cy: number, rx: number, ry = rx) => {
  const kx = rx * 0.5523,
    ky = ry * 0.5523;
  return (
    `M${n(cx - rx)} ${n(cy)}` +
    `C${n(cx - rx)} ${n(cy - ky)} ${n(cx - kx)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)}` +
    `C${n(cx + kx)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - ky)} ${n(cx + rx)} ${n(cy)}` +
    `C${n(cx + rx)} ${n(cy + ky)} ${n(cx + kx)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)}` +
    `C${n(cx - kx)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + ky)} ${n(cx - rx)} ${n(cy)}Z`
  );
};
/** A rectangle with rounded corners. */
const box = (x: number, y: number, w: number, h: number, r: number) =>
  `M${n(x + r)} ${n(y)}L${n(x + w - r)} ${n(y)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}` +
  `L${n(x + w)} ${n(y + h - r)}Q${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}` +
  `L${n(x + r)} ${n(y + h)}Q${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - r)}` +
  `L${n(x)} ${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Z`;
const dots = (r: number, ...at: [number, number][]) =>
  at.map(([x, y]) => oval(x, y, r)).join("");
/** Five petals around a middle. */
const petals = (cx: number, cy: number, reach: number, r: number) =>
  [0, 1, 2, 3, 4]
    .map((k) => {
      const a = (-90 + 72 * k) * (Math.PI / 180);
      return oval(cx + reach * Math.cos(a), cy + reach * Math.sin(a), r);
    })
    .join("");
/** A five-pointed star, point up. */
const starPath = (cx: number, cy: number, outer: number, inner: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (-90 + 36 * i) * (Math.PI / 180),
      r = i % 2 ? inner : outer;
    return `${i ? "L" : "M"}${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`;
  }).join("") + "Z";

/** The drawings. Layers paint in order, the last on top. */
export const thingArt: Record<ThingKind, ThingLayer[]> = {
  apple: [
    {
      d: "M50 31C42 22 21 24 19 47C17 69 34 91 44 91C47 91 48 89 50 89C52 89 53 91 56 91C66 91 83 69 81 47C79 24 58 22 50 31Z",
      fill: "warm-fill",
      stroke: "warm",
    },
    { d: "M50 31C50 23 52 17 56 12", stroke: "gold" },
    {
      d: "M56 21C61 11 73 9 79 13C75 23 64 26 56 21Z",
      fill: "accent-fill",
      stroke: "accent",
      w: 0.8,
    },
  ],
  banana: [
    {
      d: "M63 14L79 11C87 48 64 87 21 90C13 90 10 83 16 78C42 68 57 47 62 24Z",
      fill: "gold-fill",
      stroke: "gold",
    },
    { d: "M62 13L79 10L81 21L62 24Z", fill: "gold", stroke: "gold", w: 0.6 },
    { d: "M72 24C69 53 51 75 22 84", stroke: "gold", w: 0.6 },
  ],
  strawberry: [
    {
      d: "M50 93C30 81 13 59 17 41C20 28 36 26 50 33C64 26 80 28 83 41C87 59 70 81 50 93Z",
      fill: "warm-fill",
      stroke: "warm",
    },
    {
      d: dots(2.6, [36, 50], [51, 47], [65, 51], [43, 63], [58, 64], [50, 78]),
      fill: "warm",
    },
    {
      d: "M50 35C44 31 33 31 26 24C35 22 43 22 48 26C47 20 48 13 50 9C52 13 53 20 52 26C57 22 65 22 74 24C67 31 56 31 50 35Z",
      fill: "accent-fill",
      stroke: "accent",
      w: 0.8,
    },
  ],
  orange: [
    { d: oval(50, 55, 35), fill: "gold-fill", stroke: "gold" },
    { d: dots(1.9, [38, 50], [59, 63], [44, 72], [66, 46]), fill: "gold" },
    {
      d: "M50 21C54 10 67 7 74 11C70 22 59 26 50 21Z",
      fill: "accent-fill",
      stroke: "accent",
      w: 0.8,
    },
  ],
  ball: [
    { d: oval(50, 50, 38), fill: "accent-fill" },
    {
      d: "M15.5 34C38 45 62 45 84.5 34C87.5 41 88.5 50 87.1 58C62 69 38 69 12.9 58C11.5 50 12.5 41 15.5 34Z",
      fill: "accent",
    },
    { d: oval(50, 50, 38), stroke: "accent" },
  ],
  block: [
    { d: "M50 12L84 30L50 48L16 30Z", fill: "accent-fill" },
    { d: "M16 30L50 48L50 88L16 70Z", fill: "accent-strong" },
    { d: "M84 30L84 70L50 88L50 48Z", fill: "accent" },
    {
      d: "M50 12L84 30L84 70L50 88L16 70L16 30ZM16 30L50 48L84 30M50 48L50 88",
      stroke: "accent",
    },
  ],
  bear: [
    { d: oval(27, 28, 13) + oval(73, 28, 13), fill: "gold-fill", stroke: "gold" },
    { d: oval(27, 28, 5.5) + oval(73, 28, 5.5), fill: "gold" },
    { d: oval(50, 55, 34), fill: "gold-fill", stroke: "gold" },
    { d: oval(50, 66, 15, 12), fill: "paper", stroke: "gold", w: 0.7 },
    { d: oval(38, 49, 3.6) + oval(62, 49, 3.6) + oval(50, 61, 5, 3.6), fill: "ink" },
    { d: "M50 64L50 70", stroke: "ink", w: 0.6 },
  ],
  balloon: [
    { d: oval(50, 40, 28, 32), fill: "warm-fill", stroke: "warm" },
    { d: "M50 72L44 80L56 80Z", fill: "warm", stroke: "warm", w: 0.6 },
    { d: "M50 80C45 85 56 89 50 95", stroke: "warm", w: 0.6 },
  ],
  duck: [
    { d: "M79 33L94 38L79 45Z", fill: "warm", stroke: "warm", w: 0.6 },
    { d: oval(61, 35, 19), fill: "gold-fill", stroke: "gold" },
    {
      d: "M9 51C7 73 24 89 48 89C71 89 87 79 87 64C87 55 80 53 75 57C66 63 51 61 44 54C34 59 19 60 9 51Z",
      fill: "gold-fill",
      stroke: "gold",
    },
    { d: "M36 68C42 62 55 64 58 72C52 79 40 77 36 68Z", stroke: "gold", w: 0.7 },
    { d: oval(66, 31, 3), fill: "ink" },
  ],
  fish: [
    {
      d: "M27 50L8 31C13 44 13 56 8 69Z",
      fill: "accent-fill",
      stroke: "accent",
    },
    {
      d: "M22 50C32 29 61 25 90 50C61 75 32 71 22 50Z",
      fill: "accent-fill",
      stroke: "accent",
    },
    { d: "M57 37C53 45 53 55 57 63", stroke: "accent", w: 0.6 },
    { d: oval(70, 44, 3.2), fill: "ink" },
  ],
  cat: [
    {
      d: "M20 47L21 17L40 30C46 28 54 28 60 30L79 17L80 47C84 67 70 85 50 85C30 85 16 67 20 47Z",
      fill: "warm-fill",
      stroke: "warm",
    },
    { d: "M30 63L14 59M30 67L14 70M70 63L86 59M70 67L86 70", stroke: "warm", w: 0.5 },
    { d: oval(38, 52, 3.4) + oval(62, 52, 3.4), fill: "ink" },
    { d: "M45.5 61L54.5 61L50 66.5Z", fill: "warm", stroke: "warm", w: 0.5 },
    { d: "M50 66.5C50 72 44 73 42 69M50 66.5C50 72 56 73 58 69", stroke: "warm", w: 0.6 },
  ],
  ladybug: [
    { d: "M44 21C42 13 38 11 34 11M56 21C58 13 62 11 66 11", stroke: "warm", w: 0.6 },
    { d: oval(50, 57, 32), fill: "warm-fill", stroke: "warm" },
    { d: "M31 32C34 16 66 16 69 32C58 26 42 26 31 32Z", fill: "warm", stroke: "warm", w: 0.6 },
    { d: "M50 28L50 89", stroke: "warm", w: 0.7 },
    {
      d: dots(5.2, [36, 47], [64, 47], [33, 64], [67, 64]) + dots(4.2, [42, 79], [58, 79]),
      fill: "warm",
    },
  ],
  car: [
    {
      d: "M8 62C8 52 10 48 18 47L28 46L38 28C39 26 41 25 44 25L64 25C67 25 69 26 70 28L80 46C88 47 92 50 92 58L92 64C92 67 90 68 88 68L12 68C9 68 8 66 8 62Z",
      fill: "warm-fill",
      stroke: "warm",
    },
    {
      d: "M43 31L52 31L52 45L35 45ZM57 31L66 31L74 45L57 45Z",
      fill: "paper",
      stroke: "warm",
      w: 0.6,
    },
    { d: oval(28, 70, 10) + oval(72, 70, 10), fill: "warm", stroke: "warm", w: 0.6 },
    { d: oval(28, 70, 3.6) + oval(72, 70, 3.6), fill: "paper" },
  ],
  bus: [
    { d: box(8, 24, 84, 46, 9), fill: "gold-fill", stroke: "gold" },
    {
      d: box(16, 32, 13, 14, 2.5) + box(33, 32, 13, 14, 2.5) + box(50, 32, 13, 14, 2.5) + box(67, 32, 17, 14, 2.5),
      fill: "paper",
      stroke: "gold",
      w: 0.6,
    },
    { d: "M8 55L92 55", stroke: "gold", w: 0.6 },
    { d: oval(28, 72, 9) + oval(72, 72, 9), fill: "gold", stroke: "gold", w: 0.6 },
    { d: oval(28, 72, 3.2) + oval(72, 72, 3.2), fill: "paper" },
  ],
  boat: [
    { d: "M50 66L50 11", stroke: "warm", w: 0.8 },
    { d: "M55 15L86 58L55 58Z", fill: "accent-fill", stroke: "accent" },
    { d: "M45 27L45 58L21 58Z", fill: "accent-fill", stroke: "accent" },
    {
      d: "M11 66L89 66C85 80 73 87 50 87C29 87 16 80 11 66Z",
      fill: "warm-fill",
      stroke: "warm",
    },
  ],
  pencil: [
    { d: "M22.4 66.2L63.5 25.1L74.9 36.5L33.8 77.6Z", fill: "gold-fill", stroke: "gold" },
    { d: "M14 86L22.4 66.2L33.8 77.6Z", fill: "paper", stroke: "gold" },
    { d: "M14 86L17.2 78.4L21.6 82.8Z", fill: "ink", stroke: "ink", w: 0.5 },
    { d: "M63.5 25.1L69.1 19.5L80.5 30.9L74.9 36.5Z", fill: "paper", stroke: "gold" },
    {
      d: "M69.1 19.5L74.6 14C78 10.6 82.4 10.6 85.9 14.1C89.4 17.6 89.4 22 86 25.4L80.5 30.9Z",
      fill: "warm-fill",
      stroke: "warm",
    },
  ],
  book: [
    {
      d: "M50 27C40 19 24 18 11 22L11 79C24 75 40 76 50 84C60 76 76 75 89 79L89 22C76 18 60 19 50 27Z",
      fill: "accent-fill",
      stroke: "accent",
    },
    { d: "M50 27L50 84", stroke: "accent", w: 0.8 },
    {
      d: "M20 36C27 34 35 35 42 38M20 47C27 45 35 46 42 49M20 58C27 56 35 57 42 60M58 38C65 35 73 34 80 36M58 49C65 46 73 45 80 47M58 60C65 57 73 56 80 58",
      stroke: "accent",
      w: 0.5,
    },
  ],
  backpack: [
    { d: "M39 22C39 8 61 8 61 22", stroke: "accent" },
    {
      d: "M23 42C23 27 33 21 50 21C67 21 77 27 77 42L79 80C79 86 75 89 70 89L30 89C25 89 21 86 21 80Z",
      fill: "accent-fill",
      stroke: "accent",
    },
    { d: "M23 45L77 45", stroke: "accent", w: 0.6 },
    { d: box(32, 57, 36, 22, 5), fill: "accent-strong", stroke: "accent", w: 0.7 },
    { d: "M32 65L68 65", stroke: "accent", w: 0.5 },
  ],
  flower: [
    { d: petals(50, 50, 22, 15.5), fill: "warm-fill", stroke: "warm" },
    { d: oval(50, 50, 11.5), fill: "gold-fill", stroke: "gold" },
  ],
  leaf: [
    { d: "M19 81L10 90", stroke: "accent" },
    {
      d: "M19 81C14 50 35 19 84 15C86 56 61 85 19 81Z",
      fill: "accent-fill",
      stroke: "accent",
    },
    { d: "M19 81C37 62 57 42 73 26", stroke: "accent", w: 0.7 },
    { d: "M40 60L44 45M40 60L57 62M55 45L58 32M55 45L70 46", stroke: "accent", w: 0.5 },
  ],
  star: [{ d: starPath(50, 54, 41, 18), fill: "gold-fill", stroke: "gold" }],
  cookie: [
    { d: oval(50, 50, 38), fill: "gold-fill", stroke: "gold" },
    {
      d: dots(5.2, [36, 36], [66, 52], [45, 60]) + dots(4.2, [60, 31], [57, 74], [29, 58]),
      fill: "warm",
    },
  ],
  egg: [
    {
      d: "M50 9C68 9 82 40 82 60C82 79 68 91 50 91C32 91 18 79 18 60C18 40 32 9 50 9Z",
      fill: "gold-strong",
      stroke: "gold",
    },
  ],
  carrot: [
    {
      d: "M55 30C52 20 55 10 61 5C66 13 65 24 59 31ZM59 32C63 22 73 15 84 15C84 26 74 35 62 36ZM53 30C46 24 43 15 45 8C52 12 56 21 56 29Z",
      fill: "accent-fill",
      stroke: "accent",
      w: 0.7,
    },
    {
      d: "M40 27C48 20 63 28 67 41C63 61 40 81 15 91C17 66 28 43 40 27Z",
      fill: "warm-fill",
      stroke: "warm",
    },
    { d: "M45 44L53 49M36 58L44 62M29 72L35 75", stroke: "warm", w: 0.5 },
  ],
};

export type ThingOp =
  | ["M" | "L", number, number]
  | ["Q", number, number, number, number]
  | ["C", number, number, number, number, number, number]
  | ["Z"];
const ARITY = { M: 2, L: 2, Q: 4, C: 6, Z: 0 } as const;
/** Path data as operations, for a renderer that maps the points itself. */
export function thingOps(d: string): ThingOp[] {
  const out: ThingOp[] = [];
  for (const m of d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    const c = m[1] as keyof typeof ARITY;
    const v = (m[2]!.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    if (v.length !== ARITY[c] || v.some((x) => !Number.isFinite(x)))
      throw new Error(`Malformed thing path near "${m[0].slice(0, 24)}"`);
    out.push([c, ...v] as ThingOp);
  }
  if (!out.length || out[0]![0] !== "M") throw new Error("A thing path starts with M");
  return out;
}

/** Outline width in pixels for a thing drawn `size` pixels across. */
export const thingStroke = (size: number, weight = 1) =>
  Math.max(0.75, Math.min(7, size * 0.042 * weight));

// ------------------------------------------------------------------ arrangements
/**
 * Where things sit. Units are one thing's width; x runs right and y runs DOWN
 * from the arrangement's top-left corner. `slots` are centres, in counting
 * order: left to right, then the next row.
 */
export type Arrangement = {
  slots: [number, number][];
  w: number;
  h: number;
  /** Outlined cells behind the slots: a five- or ten-frame. [x, y, w, h]. */
  cells?: [number, number, number, number][];
};
/** A slot's width: the thing and the air around it. */
export const THING_PITCH = 1.2;
/** A frame's cell: wider, so the thing sits inside its box. */
export const FRAME_CELL = 1.4;

/** Stable 32-bit hash of a seed string (FNV-1a). */
function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return h;
}
/** A deterministic stream of numbers in [0, 1) from a seed (mulberry32). */
export function seededRandom(seed: string) {
  let a = hash(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rowOf(count: number, perRow = count): Arrangement {
  const cols = Math.max(1, Math.min(perRow, count)),
    rows = Math.max(1, Math.ceil(count / cols));
  return {
    slots: Array.from({ length: count }, (_, i): [number, number] => [
      ((i % cols) + 0.5) * THING_PITCH,
      (Math.floor(i / cols) + 0.5) * THING_PITCH,
    ]),
    w: cols * THING_PITCH,
    h: rows * THING_PITCH,
  };
}

/** Columns of a scatter: a little wider than it is tall. */
export const scatterColumns = (count: number) =>
  Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * 1.6))));
const SCATTER_CELL = 1.5;
/** Things never come closer than this, in thing widths. */
export const SCATTER_GAP = 0.14;
/**
 * A tidy scatter: one thing in each cell of a loose grid, nudged by the seed.
 * A nudge is at most half of the cell's spare room less the gap, so two
 * things can never touch, whatever the seed. A short last row is spread over
 * its columns. The same seed always gives the same picture.
 */
export function scatterOf(count: number, seed = "things", perRow?: number): Arrangement {
  const cols = Math.max(1, Math.min(count, perRow ?? scatterColumns(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const rand = seededRandom(`${seed}:${count}:${cols}`);
  const nudge = (SCATTER_CELL - 1 - SCATTER_GAP) / 2;
  const slots: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = r === rows - 1 ? count - cols * (rows - 1) : cols;
    // a short row takes distinct columns, picked by the seed
    const columns = Array.from({ length: cols }, (_, c) => c);
    for (let k = cols; k > inRow; k--) columns.splice(Math.floor(rand() * k), 1);
    for (const c of columns)
      slots.push([
        (c + 0.5) * SCATTER_CELL + (rand() * 2 - 1) * nudge,
        (r + 0.5) * SCATTER_CELL + (rand() * 2 - 1) * nudge,
      ]);
  }
  return { slots, w: cols * SCATTER_CELL, h: rows * SCATTER_CELL };
}

/** Several sets side by side, each in rows of `perRow`, with air between them. */
export function groupsOf(counts: number[], perRow = 5): Arrangement & { starts: number[] } {
  const slots: [number, number][] = [],
    starts: number[] = [];
  let x = 0,
    h = 0;
  counts.forEach((count, g) => {
    const part = rowOf(count, perRow);
    if (g) x += THING_PITCH * 0.9;
    starts.push(slots.length);
    for (const [sx, sy] of part.slots) slots.push([x + sx, sy]);
    x += part.w;
    h = Math.max(h, part.h);
  });
  return { slots, w: x, h, starts };
}

/**
 * Five- or ten-frames: rows of five boxes. A ten-frame is two rows; a second
 * frame sits under the first with a gap, as the app's ten-frames do.
 */
export function framesOf(size: 5 | 10, frames: 1 | 2 = 1): Arrangement {
  const rowsPer = size / 5,
    gap = 0.4 * FRAME_CELL;
  const slots: [number, number][] = [],
    cells: [number, number, number, number][] = [];
  for (let f = 0; f < frames; f++)
    for (let i = 0; i < size; i++) {
      const x = (i % 5) * FRAME_CELL,
        y = f * (rowsPer * FRAME_CELL + gap) + Math.floor(i / 5) * FRAME_CELL;
      cells.push([x, y, FRAME_CELL, FRAME_CELL]);
      slots.push([x + FRAME_CELL / 2, y + FRAME_CELL / 2]);
    }
  return {
    slots,
    cells,
    w: 5 * FRAME_CELL,
    h: frames * rowsPer * FRAME_CELL + (frames - 1) * gap,
  };
}
