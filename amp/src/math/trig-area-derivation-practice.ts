import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import {
  figureName,
  figurePoint,
  figureRightMark,
  figureScene,
  figureSegment,
  sceneFigure,
} from "./geometry-teaching-figures";
import {
  defineGenerate,
  entry,
  multiPartCapability,
  multiPartProblem,
  need,
  pick,
  shuffle,
  type Random,
  type Slot,
} from "./multi-part-support";
import {
  pointPlotScene,
  serializePlot,
  type LatticePoint,
  type PointPlotResponse,
} from "./point-plot";
import { triangle } from "./scene/author";
import type { Element, Point } from "./scene/spec";
import { defineAxis } from "./variation/axes";

/**
 * HSG.SRT.D.9: derive Area = ½ab sin C by drawing the height from a vertex
 * perpendicular to the line of the opposite side. Three types:
 *
 * - `trig-area-auxiliary-line` (point-plot): place the foot of that height on
 *   a lattice grid, inside the base (acute angle) or on its extension
 *   (obtuse angle).
 * - `trig-area-derivation-fill` (multi-part choice): fill each line of the
 *   derivation, acute or obtuse, symbolic or with numbers.
 * - `trig-area-derivation-reasoning` (single choice): choose the auxiliary
 *   line, find the first wrong line, supply a justification, judge the obtuse
 *   argument, and say why the third height does not use the given angle.
 *
 * Roles: the given sides meet at Z (the given angle). The height is drawn
 * from X, the far end of one given side, to line YZ. Its base YZ has the
 * length named by X's lowercase letter; its hypotenuse XZ has the length
 * named by Y's. Letters come from a set and Z is any of its three letters,
 * so no letter pattern answers an item.
 */

const band = "9–12" as const;
const skillId = "trigonometric-area";
export const trigAreaDerivationTemplates: readonly TemplateMetadata[] = [
  {
    id: "trig-area-auxiliary-line",
    version: 1,
    title: "Place the foot of the height for the area formula",
    skillId,
    gradeBand: band,
    difficultyOffset: 0.1,
    requiredResponseCapability: "point-plot-v1",
    description:
      "On a coordinate grid, plot the foot of the perpendicular from a vertex to the line of the opposite side: the height behind area $=\\frac12ab\\sin C$. The foot lies between the base's endpoints when the given angle is acute, and on the base's extension when it is obtuse.",
  },
  {
    id: "trig-area-derivation-fill",
    version: 1,
    title: "Complete the derivation of the area formula",
    skillId,
    gradeBand: band,
    difficultyOffset: 0.3,
    ...multiPartCapability,
    requiredFigureCapability: "scenes-v1",
    description:
      "Fill each line of the derivation of area $=\\frac12ab\\sin C$ from the height to one given side: the base, the sine ratio, the height and the area; for an obtuse angle, where the foot lies, the supplement and why its sine is $\\sin C$. Symbolic or numeric, with letters and the vertex of the height varied.",
  },
  {
    id: "trig-area-derivation-reasoning",
    version: 1,
    title: "Judge a derivation of the area formula",
    skillId,
    gradeBand: band,
    difficultyOffset: 0.4,
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "Reason about the derivation of area $=\\frac12ab\\sin C$: choose the auxiliary line that gives a height equal to a known side times $\\sin C$, find the first wrong line of a derivation, choose the justification of $h=b\\sin C$, choose the complete argument for an obtuse angle, and explain why the height from the given angle's vertex does not use that angle.",
  },
];

/* ------------------------------------------------------------ the model */

/** Letter sets; none uses D (the foot), h (the height) or m (measure). */
const LETTER_SETS = [
  ["A", "B", "C"],
  ["P", "Q", "R"],
  ["S", "T", "U"],
  ["X", "Y", "Z"],
] as const;
const ACUTE = [35, 40, 50, 55, 60, 65, 70, 75] as const;
const OBTUSE = [105, 110, 115, 120, 125, 130, 140, 145] as const;
const rad = (d: number) => (d * Math.PI) / 180;
const low = (letter: string) => letter.toLowerCase();

/** One triangle with its roles. `names` is the letter set in its order. */
export interface AreaTriangle {
  names: readonly [string, string, string];
  /** The vertex the height leaves, the other end of the base, and the
   * vertex of the given angle. */
  X: string;
  Y: string;
  Z: string;
  /** Lengths: base = |YZ|, hyp = |XZ|. */
  base: number;
  hyp: number;
  angle: number;
  obtuse: boolean;
}
/** The segment between two letters, written in the set's order. */
const seg = (t: { names: readonly string[] }, p: string, q: string) =>
  t.names.indexOf(p) < t.names.indexOf(q) ? `${p}${q}` : `${q}${p}`;
/** The lowercase name of the base (opposite X) and of the hypotenuse
 * (opposite Y), and the product of the two in alphabetical order. */
const sideNames = (t: { X: string; Y: string }) => {
  const b = low(t.X),
    h = low(t.Y);
  return { b, h, pair: [b, h].sort().join("") };
};
/** The third side |XY| and the angles at X and Y, in degrees. */
export function solveTriangle(t: AreaTriangle) {
  const c = Math.sqrt(
    t.base ** 2 + t.hyp ** 2 - 2 * t.base * t.hyp * Math.cos(rad(t.angle)),
  );
  const angX =
    (Math.acos((t.base ** 2 + c ** 2 - t.hyp ** 2) / (2 * t.base * c)) * 180) /
    Math.PI;
  return { c, angX, angY: 180 - t.angle - angX };
}

/** A triangle with integer given sides 5–14 (unequal), an angle that is a
 * multiple of 5° (never 45° or 135°, where sine and cosine have the same
 * size), the other two angles acute and unequal to the given one. */
function drawTriangle(r: Random, obtuse: boolean): AreaTriangle {
  const names = pick(r, LETTER_SETS);
  const zi = r(0, 2);
  const others = names.filter((_, i) => i !== zi);
  const [X, Y] = shuffle(r, [...others]) as [string, string];
  for (let attempt = 0; attempt < 60; attempt++) {
    const base = r(5, 14),
      hyp = r(5, 14);
    if (base === hyp) continue;
    const angle = pick(r, obtuse ? OBTUSE : ACUTE);
    const t: AreaTriangle = {
      names,
      X,
      Y,
      Z: names[zi]!,
      base,
      hyp,
      angle,
      obtuse,
    };
    const { c, angX, angY } = solveTriangle(t);
    if (angX >= 85 || angY >= 85 || angX < 12 || angY < 12) continue;
    if (Math.abs(angX - angle) < 4 || Math.abs(angY - angle) < 4) continue;
    if (Math.abs(c - base) < 0.3 || Math.abs(c - hyp) < 0.3) continue;
    return t;
  }
  throw new Error("Need a triangle with clear angles");
}

/* ------------------------------------------------------------ figures */

/** Points of the triangle: Z at the origin, Y along the base, X above,
 * scaled so the longest side is about 6 units; `flip` mirrors it. */
function trianglePoints(t: AreaTriangle, flip: boolean) {
  const { c } = solveTriangle(t);
  const k = 6 / Math.max(t.base, t.hyp, c);
  const s = flip ? -1 : 1;
  const Z: Point = [0, 0];
  const Y: Point = [s * t.base * k, 0];
  const X: Point = [
    s * t.hyp * k * Math.cos(rad(t.angle)),
    t.hyp * k * Math.sin(rad(t.angle)),
  ];
  const D: Point = [X[0], 0];
  return { X, Y, Z, D };
}

type Marks = {
  /** Side labels: names or lengths. */
  numeric: boolean;
  /** Draw the height from X to D (and the extension when obtuse). */
  height?: boolean;
  /** Draw the perpendicular from Z to XY (the third height). */
  third?: boolean;
  flip: boolean;
};
function areaFigure(t: AreaTriangle, m: Marks): SemanticFigure {
  const { X, Y, Z, D } = trianglePoints(t, m.flip);
  const { b, h } = sideNames(t);
  const baseLabel = m.numeric ? String(t.base) : b;
  // A foot inside the base would sit on the base's middle label: write the
  // label at the quarter of the base farther from the foot instead.
  const footInside = !!m.height && !t.obtuse;
  const along = Math.abs(D[0] - Z[0]) > Math.abs(D[0] - Y[0]) ? 0.25 : 0.75;
  // An acute angle's interior holds the height, which would cross a label
  // on the angle's bisector; that measure is written just outside the
  // vertex instead, beyond the base's end and above it. An obtuse angle's
  // interior is clear: the height and the extension lie outside it.
  const angleOutside = m.numeric && footInside;
  // Side i runs from vertex i to vertex i + 1: XY, YZ, ZX.
  const tri = triangle([X, Y, Z])
    .names(t.X, t.Y, t.Z)
    .side(1, footInside ? {} : { label: baseLabel })
    .side(2, { label: m.numeric ? String(t.hyp) : h })
    .angle(2, {
      mark: "arc",
      ...(m.numeric && !angleOutside ? { label: `${t.angle}°` } : {}),
    })
    .id("t");
  const extra: Element[] = [];
  if (angleOutside) {
    // Away from Y along the base line, and up toward the apex.
    const away = Y[0] > Z[0] ? -1 : 1;
    extra.push({
      type: "text",
      id: "al",
      at: Z,
      text: `${t.angle}°`,
      size: "sm",
      color: "accent",
      halo: true,
      align: [away < 0 ? 1 : -1, 1],
      offset: [away * 10, -8],
    });
  }
  if (footInside)
    extra.push({
      type: "text",
      id: "bl",
      at: [Z[0] + (Y[0] - Z[0]) * along, 0],
      text: baseLabel,
      font: "math",
      halo: true,
      align: [0, -1],
      offset: [0, 8],
    });
  if (m.height) {
    if (t.obtuse)
      extra.push(figureSegment("ext", Z, D, { dash: true, width: 1.75 }));
    extra.push(
      figureSegment("alt", X, D, { dash: true, stroke: "accent" }),
      figurePoint("d", D),
      figureName("dn", "D", D, [0, -1]),
      figureRightMark("rt", D, X, t.obtuse ? Z : Y, 0.32),
      {
        type: "text",
        id: "hl",
        at: [D[0], X[1] / 2],
        text: "h",
        font: "math",
        halo: true,
        align: [D[0] >= Z[0] ? -1 : 1, 0],
        offset: [D[0] >= Z[0] ? 8 : -8, 0],
      },
    );
  }
  if (m.third) {
    // Foot E of the perpendicular from Z to line XY.
    const ux = Y[0] - X[0],
      uy = Y[1] - X[1];
    const s = ((Z[0] - X[0]) * ux + (Z[1] - X[1]) * uy) / (ux * ux + uy * uy);
    const E: Point = [X[0] + s * ux, X[1] + s * uy];
    const out: Point = [E[0] - Z[0], E[1] - Z[1]];
    extra.push(
      figureSegment("alt", Z, E, { dash: true, stroke: "accent" }),
      figurePoint("e", E),
      figureName("en", "E", E, out),
      figureRightMark("rt", E, Z, Y, 0.32),
    );
  }
  const what = m.height
    ? `with the height from ${t.X} meeting line ${seg(t, t.Y, t.Z)} at D`
    : m.third
      ? `with the perpendicular from ${t.Z} meeting ${seg(t, t.X, t.Y)} at E`
      : `with the given angle at ${t.Z} marked`;
  return sceneFigure(
    figureScene(`Triangle ${t.names.join("")} ${what}`, [tri, ...extra]),
  );
}

/* ------------------------------------------------------------ problems */

type Opt = { label: string; correct?: true; feedback?: string };
function choiceProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  built: {
    prompt: string;
    options: Opt[];
    hint: string;
    explanation: string[];
    figure?: SemanticFigure;
    keepOrder?: boolean;
  },
): GeneratedProblem {
  const options = built.keepOrder ? built.options : shuffle(r, built.options);
  if (
    options.length !== 4 ||
    options.filter((o) => o.correct).length !== 1 ||
    new Set(options.map((o) => o.label)).size !== 4
  )
    throw new Error(`${meta.id}: four distinct options, one correct`);
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const shown = options.map((o, i) => {
    const id = `option-${"abcd"[i]}`;
    if (o.correct) answer = id;
    else choiceFeedback[id] = o.feedback!;
    return { id, label: o.label };
  });
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response: {
        kind: "choice",
        label: "Choose one answer",
        options: shown,
      },
      ...(built.figure ? { figure: built.figure } : {}),
    },
    answer,
    hint: built.hint,
    explanation: built.explanation,
    choiceFeedback,
  };
}

const m = (tex: string) => `$${tex}$`;
const deg = (n: number) => `${n}^\\circ`;

/* ---------------------------------------- 1. place the foot (point-plot) */

const footAxes = {
  angle: defineAxis("angle", ["acute", "obtuse"] as const),
  base: defineAxis("base", ["horizontal", "vertical"] as const),
};

/** Integer coordinates along the base (u) and across it (v). The base line
 * is v = k; the apex is h units off it. */
export interface FootModel {
  names: readonly [string, string, string];
  X: string;
  Y: string;
  Z: string;
  /** Along-base positions of Y, Z and X, and the base line and apex level. */
  uY: number;
  uZ: number;
  uX: number;
  k: number;
  vX: number;
  vertical: boolean;
  obtuse: boolean;
}
export const footPoint = (f: FootModel, u: number, v: number): LatticePoint =>
  f.vertical ? [v, u] : [u, v];

function footModel(r: Random, obtuse: boolean, vertical: boolean): FootModel {
  const names = pick(r, LETTER_SETS);
  const zi = r(0, 2);
  const [X, Y] = shuffle(
    r,
    names.filter((_, i) => i !== zi),
  ) as [string, string];
  const L = r(4, 8);
  const dir = r(0, 1) ? 1 : -1;
  let uY = 0,
    uZ = dir * L,
    uX: number;
  if (obtuse) uX = uZ + dir * r(1, 4);
  else {
    const inside = Array.from({ length: L - 1 }, (_, i) => uY + dir * (i + 1));
    uX = pick(
      r,
      inside.filter((u) => 2 * u !== uY + uZ),
    );
  }
  const h = r(3, 7);
  const up = r(0, 1) === 1;
  // Shift along the base so every position lies in 1..11.
  const lo = Math.min(uY, uZ, uX),
    hi = Math.max(uY, uZ, uX);
  need(hi - lo <= 10, "a base that fits the grid");
  const shift = r(1, 11 - (hi - lo)) - lo;
  uY += shift;
  uZ += shift;
  uX += shift;
  const k = up ? r(1, 11 - h) : r(1 + h, 11);
  return {
    names,
    X,
    Y,
    Z: names[zi]!,
    uY,
    uZ,
    uX,
    k,
    vX: up ? k + h : k - h,
    vertical,
    obtuse,
  };
}

const pt = ([x, y]: LatticePoint) => `(${x}, ${y})`;

function footProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  axes: { angle: "acute" | "obtuse"; base: "horizontal" | "vertical" },
): GeneratedProblem {
  const f = footModel(r, axes.angle === "obtuse", axes.base === "vertical");
  const P = {
    X: footPoint(f, f.uX, f.vX),
    Y: footPoint(f, f.uY, f.k),
    Z: footPoint(f, f.uZ, f.k),
  };
  const foot = footPoint(f, f.uX, f.k);
  const YZ = seg(f, f.Y, f.Z);
  const XZ = seg(f, f.X, f.Z);
  const { b, h: hy, pair } = sideNames(f);
  const response: PointPlotResponse = {
    kind: "point-plot",
    label: "Plot point $D$",
    grid: {
      xMin: 0,
      xMax: 12,
      yMin: 0,
      yMax: 12,
      step: 1,
      xLabel: "x",
      yLabel: "y",
    },
    pointCount: 1,
    ordered: true,
    pointLabels: ["D"],
    connect: "none",
    given: {
      vertices: (["X", "Y", "Z"] as const).map((role) => ({
        x: P[role][0],
        y: P[role][1],
        label: f[role],
      })),
      closed: true,
    },
  };
  const axis = f.vertical ? "x" : "y";
  const along = f.vertical ? "y" : "x";
  const lineWord = f.vertical ? "vertical" : "horizontal";
  const perpWord = f.vertical ? "horizontal" : "vertical";
  const height = Math.abs(f.vX - f.k),
    baseLen = Math.abs(f.uZ - f.uY);
  const area = (baseLen * height) / 2;
  const roleOf = (letter: string) =>
    letter === f.X ? P.X : letter === f.Y ? P.Y : P.Z;
  const vertexText = f.names.map((l) => `$${l}${pt(roleOf(l))}$`);
  const listed = `${vertexText[0]}, ${vertexText[1]} and ${vertexText[2]}`;
  const prompt = `In triangle $${f.names.join("")}$, sides $\\overline{${XZ}}$ and $\\overline{${YZ}}$ and the angle $${f.Z}$ between them are known. The formula area $=\\frac12${pair}\\sin ${f.Z}$ comes from the height drawn from $${f.X}$ perpendicular to line $${YZ}$. Plot its foot $D$, the point where it meets line $${YZ}$, extended if needed. The vertices are ${listed}.`;
  const hint = `Line $${YZ}$ is ${lineWord}: $${f.Y}$ and $${f.Z}$ both have $${axis}=${f.k}$. A height meets it at a right angle, so the height from $${f.X}${pt(P.X)}$ runs ${perpWord}ly. Where does that path cross line $${YZ}$?`;
  const where = f.obtuse
    ? `Angle $${f.Z}$ is obtuse, so $D$ lies beyond $${f.Z}$ on the extension of $\\overline{${YZ}}$, outside the triangle. In right triangle $${f.X}D${f.Z}$ the angle at $${f.Z}$ is $180^\\circ-${f.Z}$, and $\\sin(180^\\circ-${f.Z})=\\sin ${f.Z}$, so the height is still $${hy}\\sin ${f.Z}$.`
    : `Angles $${f.Y}$ and $${f.Z}$ are both acute, so $D$ lies between $${f.Y}$ and $${f.Z}$. Right triangle $${f.X}D${f.Z}$ contains angle $${f.Z}$ and has hypotenuse $\\overline{${XZ}}$, so the height is $${hy}\\sin ${f.Z}$.`;
  const explanation = [
    `The given sides meet at $${f.Z}$. The height must come from $${f.X}$, the far end of $\\overline{${XZ}}$, and meet line $${YZ}$ at a right angle. Then its right triangle has the known hypotenuse $\\overline{${XZ}}$ and angle $${f.Z}$ at one end.`,
    `Line $${YZ}$ is the ${lineWord} line $${axis}=${f.k}$, so the perpendicular from $${f.X}${pt(P.X)}$ is ${perpWord}. It keeps $${along}=${f.uX}$ and meets the line where $${axis}=${f.k}$: $D=${pt(foot)}$.`,
    where,
    `Check with the grid: the height is $${f.X}D=${height}$ and the base is $${YZ}=${baseLen}$, so the area is $\\frac12\\cdot${baseLen}\\cdot${height}=${area}$. Writing the height as $${hy}\\sin ${f.Z}$ turns $\\frac12\\cdot ${b}\\cdot h$ into $\\frac12${pair}\\sin ${f.Z}$.`,
  ];
  const answer = serializePlot([foot], true);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt,
      skillId: meta.skillId,
      response,
    },
    answer,
    hint,
    explanation,
    pointGrading: { mode: "exact" },
    walkthrough: pointPlotScene(response, {
      answer: [foot],
      title: "The foot of the height",
    }),
  };
}

/* ------------------------------------ 2. complete the derivation (slots) */

const fillAxes = {
  angle: defineAxis("angle", ["acute", "obtuse"] as const),
  givens: defineAxis("givens", ["symbolic", "numeric"] as const),
};

/** How a model's quantities read on one surface: letters, or numbers. */
function names(t: AreaTriangle, numeric: boolean) {
  const { b, h, pair } = sideNames(t);
  const Z = numeric ? deg(t.angle) : t.Z;
  const base = numeric ? String(t.base) : b;
  const hyp = numeric ? String(t.hyp) : h;
  return {
    b,
    h,
    pair,
    Z,
    base,
    hyp,
    /** ½ · base · hyp as written in a final line. */
    product: numeric ? `(${t.base})(${t.hyp})` : pair,
    hypSq: numeric ? `(${t.hyp})^2` : `${h}^2`,
    sin: `\\sin ${Z}`,
    cos: `\\cos ${Z}`,
    tan: `\\tan ${Z}`,
  };
}

function fillProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  axes: { angle: "acute" | "obtuse"; givens: "symbolic" | "numeric" },
): GeneratedProblem {
  const obtuse = axes.angle === "obtuse";
  const numeric = axes.givens === "numeric";
  const t = drawTriangle(r, obtuse);
  const n = names(t, numeric);
  const YZ = seg(t, t.Y, t.Z),
    XZ = seg(t, t.X, t.Z),
    XY = seg(t, t.X, t.Y);
  const XDZ = `${t.X}D${t.Z}`;
  const XZD = `${t.X}${t.Z}D`;
  const figure = areaFigure(t, { numeric, height: true, flip: r(0, 1) === 1 });
  const givenText = numeric
    ? `$${YZ}=${t.base}$, $${XZ}=${t.hyp}$ and $m\\angle ${t.Z}=${deg(t.angle)}$`
    : `sides $${n.b}=${YZ}$ and $${n.h}=${XZ}$ and the angle $${t.Z}$ between them`;
  const formula = `\\frac12${n.pair}\\sin ${t.Z}`;
  const value = (t.base * t.hyp * Math.sin(rad(t.angle))) / 2;
  const check = numeric
    ? ` With these numbers the area is $\\frac12${n.product}\\sin ${n.Z}\\approx ${value.toFixed(2)}$.`
    : "";
  let slots: Slot[];
  let explanation: string[];
  let hint: string;
  if (!obtuse) {
    const sideOpt = (s: string, len: number | null, name: string) =>
      numeric
        ? len === null
          ? `side $\\overline{${s}}$`
          : `side $\\overline{${s}}$, length $${len}$`
        : `$${name}$, side $\\overline{${s}}$`;
    slots = [
      {
        id: "base",
        label: `Line 1: $\\overline{${t.X}D}$ is the height $h$ to the base`,
        correct: sideOpt(YZ, t.base, n.b),
        wrong: [sideOpt(XZ, t.hyp, n.h), sideOpt(XY, null, low(t.Z))],
      },
      {
        id: "ratio",
        label: `Line 2: in right triangle $${XDZ}$, this ratio equals $\\frac{h}{${n.hyp}}$`,
        correct: m(n.sin),
        wrong: [m(n.cos), m(n.tan), m(`\\sin ${t.X}`)],
      },
      {
        id: "height",
        label: "Line 3: so the height $h$ equals",
        correct: m(`${n.hyp}${n.sin}`),
        wrong: [
          m(`${n.hyp}${n.cos}`),
          m(`${n.base}${n.sin}`),
          m(`${n.hyp}${n.tan}`),
        ],
      },
      {
        id: "area",
        label: "Line 4: the area, half the base times the height, equals",
        correct: m(`\\frac12${n.product}${n.sin}`),
        wrong: [
          m(`${n.product}${n.sin}`),
          m(`\\frac12${n.hypSq}${n.sin}`),
          m(`\\frac12${n.product}${n.cos}`),
        ],
      },
    ];
    hint = `Look at right triangle $${XDZ}$. Which side is its hypotenuse: $\\overline{${XZ}}=${n.hyp}$, the side the height starts from, or $\\overline{${YZ}}=${n.base}$, the side it lands on? Which side of it is opposite the angle at $${t.Z}$${numeric ? `, $${n.Z}$` : ""}?`;
    explanation = [
      `The height from $${t.X}$ meets $\\overline{${YZ}}$ at $D$ at a right angle, so $h=${t.X}D$ is the height to the base $\\overline{${YZ}}$, of length $${n.base}$. The side $\\overline{${XZ}}$ is the hypotenuse of the right triangle, not the base.`,
      `Right triangle $${XDZ}$ contains angle $${t.Z}$. The side opposite $${t.Z}$ is $h$ and the hypotenuse is $\\overline{${XZ}}=${n.hyp}$, so $\\sin ${n.Z}=\\frac{h}{${n.hyp}}$. Cosine would use the adjacent side $\\overline{D${t.Z}}$, tangent uses two legs, and angle $${t.X}$ of the whole triangle is not an angle of triangle $${XDZ}$.`,
      `Multiply both sides by $${n.hyp}$: $h=${n.hyp}\\sin ${n.Z}$. The hypotenuse is $${n.hyp}$, not $${n.base}$.`,
      `The area is half the base times the height: $\\frac12\\cdot ${n.base}\\cdot ${n.hyp}\\sin ${n.Z}=\\frac12${n.product}\\sin ${n.Z}$.${check} Dropping the $\\frac12$ gives a parallelogram, and using $\\overline{${XZ}}$ as the base pairs it with a height it was not drawn to.`,
      `So the area of a triangle is $${formula}$: half the product of two sides times the sine of the angle between them.`,
    ];
  } else {
    const supp = 180 - t.angle;
    slots = [
      {
        id: "foot",
        label: `Line 1: the perpendicular from $${t.X}$ meets line $${YZ}$ at $D$, which lies`,
        correct: `on the extension of $\\overline{${YZ}}$ beyond $${t.Z}$`,
        wrong: [
          `between $${t.Y}$ and $${t.Z}$`,
          `on the extension of $\\overline{${YZ}}$ beyond $${t.Y}$`,
        ],
      },
      {
        id: "supp",
        label: `Line 2: in right triangle $${XDZ}$, $m\\angle ${XZD}$ is`,
        correct: numeric ? m(deg(supp)) : m(`180^\\circ-${t.Z}`),
        wrong: numeric
          ? [m(deg(t.angle)), m(deg(t.angle - 90))]
          : [m(t.Z), m(`${t.Z}-90^\\circ`), m(`90^\\circ-${t.Z}`)],
      },
      {
        id: "height",
        label: `Line 3: $h=${n.hyp}\\sin(\\angle ${XZD})$, which equals`,
        correct: m(`${n.hyp}${n.sin}`),
        wrong: [
          m(`-${n.hyp}${n.sin}`),
          m(`${n.hyp}${n.cos}`),
          m(`${n.base}${n.sin}`),
        ],
      },
      {
        id: "reason",
        label: "Line 4: line 3 holds because",
        correct:
          "$\\sin(180^\\circ-\\theta)=\\sin\\theta$ for every angle $\\theta$",
        wrong: [
          `$\\angle ${t.Z}$ and $\\angle ${XZD}$ are both angles of triangle $${XDZ}$`,
          "sine is negative for obtuse angles, so take its absolute value",
          `the height bisects angle $${t.X}$`,
        ],
      },
    ];
    hint = `Angle $${t.Z}$ is obtuse, so where does the perpendicular from $${t.X}$ meet line $${YZ}$? In right triangle $${XDZ}$, how is $\\angle ${XZD}$ related to the triangle's angle at $${t.Z}$${numeric ? `, $${deg(t.angle)}$` : ""}?`;
    explanation = [
      `Angle $${t.Z}$ is obtuse, so the perpendicular from $${t.X}$ meets line $${YZ}$ outside the triangle, at $D$ beyond $${t.Z}$. It cannot land between $${t.Y}$ and $${t.Z}$, and it would land beyond $${t.Y}$ only if angle $${t.Y}$ were obtuse.`,
      `$\\angle ${XZD}$ and angle $${t.Z}$ together make the straight angle at $${t.Z}$ along line $${YZ}$, so $m\\angle ${XZD}=180^\\circ-${numeric ? deg(t.angle) : t.Z}${numeric ? `=${deg(supp)}` : ""}$. Angle $${t.Z}$ itself is obtuse, so it cannot be an angle of a right triangle.`,
      `In right triangle $${XDZ}$ the hypotenuse is $\\overline{${XZ}}=${n.hyp}$, so $h=${n.hyp}\\sin(\\angle ${XZD})=${n.hyp}\\sin(180^\\circ-${numeric ? deg(t.angle) : t.Z})=${n.hyp}\\sin ${n.Z}$. The height is a length, so it is positive, and $\\sin ${n.Z}$ is positive.`,
      `The step uses $\\sin(180^\\circ-\\theta)=\\sin\\theta$: supplementary angles have equal sines. The sine of an obtuse angle is positive, $\\angle ${t.Z}$ is not inside triangle $${XDZ}$, and the height runs outside the triangle, so it does not bisect angle $${t.X}$.`,
      `Then the area is $\\frac12\\cdot ${n.base}\\cdot h=\\frac12${n.product}\\sin ${n.Z}$, the same formula $${formula}$ as for an acute angle.${check}`,
    ];
  }
  return multiPartProblem(meta, seed, r, {
    prompt: `Triangle $${t.names.join("")}$ has ${givenText}. ${obtuse ? `Angle $${t.Z}$ is obtuse. ` : ""}The figure shows the height $h$ from $${t.X}$, with foot $D$. Complete each line of the derivation of area $=${formula}$.`,
    layout: "slots",
    label: "Choose the missing part of each line",
    slots,
    figure,
    hint,
    explanation,
  });
}

/* ------------------------------------- 3. reasoning about the derivation */

const reasonAxes = {
  task: defineAxis(
    "task",
    [
      "choose-line",
      "find-flaw",
      "justify",
      "obtuse-complete",
      "third-height",
    ] as const,
    { weights: [2, 3, 1, 1, 1] },
  ),
};

/** The first wrong line of a derivation, by the slip that puts it there.
 * Acute derivations hold the first four; obtuse ones the rest. */
export const FLAWS = [
  "wrong-vertex",
  "cos-for-sin",
  "base-is-hypotenuse",
  "half-dropped",
  "foot-inside",
  "supplement-ignored",
  "supplement-sign",
  "obtuse-base",
] as const;
export type Flaw = (typeof FLAWS)[number];
export const flawLine: Record<Flaw, 1 | 2 | 3 | 4> = {
  "wrong-vertex": 1,
  "cos-for-sin": 2,
  "base-is-hypotenuse": 3,
  "half-dropped": 4,
  "foot-inside": 1,
  "supplement-ignored": 2,
  "supplement-sign": 3,
  "obtuse-base": 4,
};
const obtuseFlaw = (f: Flaw) => FLAWS.indexOf(f) >= 4;

/** The four lines of a derivation with the flaw's line replaced. */
export function derivationLines(t: AreaTriangle, flaw: Flaw): string[] {
  const { b, h } = sideNames(t);
  const { X, Y, Z } = t;
  const YZ = seg(t, Y, Z),
    XY = seg(t, X, Y);
  const XDZ = `${X}D${Z}`;
  const bh = [b, h].sort().join("");
  if (!obtuseFlaw(flaw)) {
    const lines = [
      `Draw the perpendicular from $${X}$ to $\\overline{${YZ}}$, meeting it at $D$, with $h=${X}D$. Right triangle $${XDZ}$ contains angle $${Z}$.`,
      `In right triangle $${XDZ}$, $\\sin ${Z}=\\frac{h}{${h}}$, so $h=${h}\\sin ${Z}$.`,
      `$h$ is the height to the base $\\overline{${YZ}}$, of length $${b}$.`,
      `The area is $\\frac12\\cdot ${b}\\cdot h=\\frac12${bh}\\sin ${Z}$.`,
    ];
    if (flaw === "wrong-vertex")
      lines[0] = `Draw the perpendicular from $${Z}$ to $\\overline{${XY}}$, meeting it at $D$, with $h=${Z}D$. Right triangle $${XDZ}$ contains angle $${Z}$.`;
    if (flaw === "cos-for-sin") {
      lines[1] = `In right triangle $${XDZ}$, $\\cos ${Z}=\\frac{h}{${h}}$, so $h=${h}\\cos ${Z}$.`;
      lines[3] = `The area is $\\frac12\\cdot ${b}\\cdot h=\\frac12${bh}\\cos ${Z}$.`;
    }
    if (flaw === "base-is-hypotenuse") {
      lines[2] = `$h$ is the height to the base $\\overline{${seg(t, X, Z)}}$, of length $${h}$.`;
      lines[3] = `The area is $\\frac12\\cdot ${h}\\cdot h=\\frac12${h}^2\\sin ${Z}$.`;
    }
    if (flaw === "half-dropped")
      lines[3] = `The area is $${b}\\cdot h=${bh}\\sin ${Z}$.`;
    return lines;
  }
  const lines = [
    `The perpendicular from $${X}$ meets line $${YZ}$ at $D$, beyond $${Z}$, with $h=${X}D$.`,
    `In right triangle $${XDZ}$, $m\\angle ${X}${Z}D=180^\\circ-${Z}$, so $h=${h}\\sin(180^\\circ-${Z})$.`,
    `Since $\\sin(180^\\circ-${Z})=\\sin ${Z}$, $h=${h}\\sin ${Z}$.`,
    `The area is $\\frac12\\cdot ${b}\\cdot h=\\frac12${bh}\\sin ${Z}$.`,
  ];
  if (flaw === "foot-inside")
    lines[0] = `The perpendicular from $${X}$ meets $\\overline{${YZ}}$ at $D$, between $${Y}$ and $${Z}$, with $h=${X}D$.`;
  if (flaw === "supplement-ignored")
    lines[1] = `In right triangle $${XDZ}$, $m\\angle ${X}${Z}D=${Z}$, so $h=${h}\\sin ${Z}$.`;
  if (flaw === "supplement-sign") {
    lines[2] = `Since $\\sin(180^\\circ-${Z})=-\\sin ${Z}$, $h=-${h}\\sin ${Z}$.`;
    lines[3] = `The area is $\\frac12\\cdot ${b}\\cdot h=-\\frac12${bh}\\sin ${Z}$.`;
  }
  if (flaw === "obtuse-base")
    lines[3] = `The area is $\\frac12\\cdot ${h}\\cdot h=\\frac12${h}^2\\sin ${Z}$.`;
  return lines;
}

/** Why a line is right, or what its slip is, for the explanation. */
function lineVerdict(t: AreaTriangle, flaw: Flaw, line: number): string {
  const { b, h } = sideNames(t);
  const { X, Y, Z } = t;
  const YZ = seg(t, Y, Z),
    XZ = seg(t, X, Z);
  const XDZ = `${X}D${Z}`;
  const wrong = flawLine[flaw] === line;
  if (!obtuseFlaw(flaw))
    switch (line) {
      case 1:
        return wrong
          ? `Line 1 is the first error. The perpendicular from $${Z}$ makes right triangles that hold only parts of angle $${Z}$, so triangle $${XDZ}$ does not contain angle $${Z}$. Its height is $${h}\\sin ${X}$, not a multiple of $\\sin ${Z}$.`
          : `Line 1 is correct: the perpendicular from $${X}$ lands between $${Y}$ and $${Z}$ because both of those angles are acute, so right triangle $${XDZ}$ contains all of angle $${Z}$.`;
      case 2:
        return wrong
          ? `Line 2 is the first error. In triangle $${XDZ}$ the side $h$ is opposite angle $${Z}$, so $\\sin ${Z}=\\frac{h}{${h}}$; cosine would use the adjacent side $\\overline{D${Z}}$.`
          : `Line 2 is correct: $h$ is opposite angle $${Z}$ and $\\overline{${XZ}}=${h}$ is the hypotenuse, so $\\sin ${Z}=\\frac{h}{${h}}$.`;
      case 3:
        return wrong
          ? `Line 3 is the first error. The height $h$ was drawn to $\\overline{${YZ}}$, not to $\\overline{${XZ}}$; $\\overline{${XZ}}$ is the hypotenuse of the right triangle.`
          : `Line 3 is correct: $h$ meets $\\overline{${YZ}}$ at a right angle, so it is the height to that base, of length $${b}$.`;
      default:
        return wrong
          ? flaw === "half-dropped"
            ? `Line 4 is the first error: a triangle's area is half the base times the height, so the $\\frac12$ is missing.`
            : `Line 4 is the first error.`
          : `Line 4 follows from the lines above it: half the base times the height.`;
    }
  switch (line) {
    case 1:
      return wrong
        ? `Line 1 is the first error. Angle $${Z}$ is obtuse, so the perpendicular from $${X}$ meets line $${YZ}$ outside the triangle, beyond $${Z}$, not between $${Y}$ and $${Z}$.`
        : `Line 1 is correct: angle $${Z}$ is obtuse, so the foot $D$ lies beyond $${Z}$.`;
    case 2:
      return wrong
        ? `Line 2 is the first error. Angle $${Z}$ is obtuse, so it cannot be an angle of a right triangle; the angle at $${Z}$ in triangle $${XDZ}$ is its supplement, $180^\\circ-${Z}$. The result $h=${h}\\sin ${Z}$ happens to be right, but this line does not show it.`
        : `Line 2 is correct: $\\angle ${X}${Z}D$ and angle $${Z}$ form a straight angle, so $m\\angle ${X}${Z}D=180^\\circ-${Z}$.`;
    case 3:
      return wrong
        ? `Line 3 is the first error. Supplementary angles have equal sines, $\\sin(180^\\circ-${Z})=\\sin ${Z}$, and a height cannot be negative.`
        : `Line 3 is correct: supplementary angles have equal sines.`;
    default:
      return wrong
        ? `Line 4 is the first error. The height $h$ was drawn to line $${YZ}$, so the base that goes with it is $\\overline{${YZ}}$, of length $${b}$, not $${h}$.`
        : `Line 4 follows from the lines above it: half the base times the height.`;
  }
}

function reasonProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  axes: { task: (typeof reasonAxes.task.values)[number] },
): GeneratedProblem {
  const task = axes.task;
  const flaw: Flaw | null = task === "find-flaw" ? pick(r, FLAWS) : null;
  const obtuse =
    task === "obtuse-complete" ||
    (flaw !== null && obtuseFlaw(flaw)) ||
    (task === "choose-line" && r(0, 1) === 1);
  const t = drawTriangle(r, obtuse);
  const flip = r(0, 1) === 1;
  const { b, h, pair } = sideNames(t);
  const { X, Y, Z } = t;
  const name = t.names.join("");
  const YZ = seg(t, Y, Z),
    XZ = seg(t, X, Z),
    XY = seg(t, X, Y);
  const XDZ = `${X}D${Z}`;
  const formula = `\\frac12${pair}\\sin ${Z}`;
  const known = `In triangle $${name}$, sides $${b}=${YZ}$ and $${h}=${XZ}$ and the angle $${Z}$ between them are known.`;

  if (task === "choose-line") {
    const options: Opt[] = obtuse
      ? [
          {
            label: `From $${X}$, perpendicular to line $${YZ}$, meeting it beyond $${Z}$`,
            correct: true,
          },
          {
            label: `From $${X}$, perpendicular to $\\overline{${YZ}}$, meeting it between $${Y}$ and $${Z}$`,
            feedback: `Angle $${Z}$ is obtuse, so a perpendicular from $${X}$ cannot land between $${Y}$ and $${Z}$: it meets line $${YZ}$ beyond $${Z}$.`,
          },
          {
            label: `From $${Z}$, perpendicular to $\\overline{${XY}}$`,
            feedback: `That height is $${h}\\sin ${X}$: its right triangles hold angles $${X}$ and $${Y}$ and only parts of angle $${Z}$.`,
          },
          {
            label: `From $${X}$ to the midpoint of $\\overline{${YZ}}$`,
            feedback:
              "A segment to the midpoint is a median. It does not meet the side at a right angle, so it is not a height.",
          },
        ]
      : [
          {
            label: `From $${X}$, perpendicular to $\\overline{${YZ}}$`,
            correct: true,
          },
          {
            label: `From $${Z}$, perpendicular to $\\overline{${XY}}$`,
            feedback: `That height is $${h}\\sin ${X}$: its right triangles hold angles $${X}$ and $${Y}$ and only parts of angle $${Z}$.`,
          },
          {
            label: `From $${X}$ to the midpoint of $\\overline{${YZ}}$`,
            feedback:
              "A segment to the midpoint is a median. It does not meet the side at a right angle, so it is not a height.",
          },
          {
            label: `From $${X}$, perpendicular to $\\overline{${XY}}$, until it meets line $${YZ}$`,
            feedback: `That segment is perpendicular to the side it starts on. A height runs from a vertex to the line of the opposite side, at a right angle to that line.`,
          },
        ];
    return choiceProblem(meta, seed, r, {
      prompt: `${known} Which auxiliary line gives a height of the triangle equal to a known side times $\\sin ${Z}$?`,
      options,
      figure: areaFigure(t, { numeric: false, flip }),
      hint: `You know $${b}$, $${h}$ and angle $${Z}$. Which segment would be the hypotenuse of a right triangle with an angle of $${Z}$${obtuse ? " (or its supplement)" : ""} at one end?`,
      explanation: [
        `A height runs from a vertex to the line of the opposite side and meets it at a right angle.`,
        `The height from $${X}$ to line $${YZ}$ makes right triangle $${XDZ}$ with hypotenuse $\\overline{${XZ}}=${h}$ and the angle at $${Z}$ ${obtuse ? `equal to $180^\\circ-${Z}$` : `equal to angle $${Z}$`}. So $h=${h}\\sin ${Z}$${obtuse ? ", because $\\sin(180^\\circ-" + Z + ")=\\sin " + Z + "$" : ""}.`,
        obtuse
          ? `Angle $${Z}$ is obtuse, so the foot $D$ lies beyond $${Z}$ on the extension of $\\overline{${YZ}}$, outside the triangle.`
          : `Angles $${Y}$ and $${Z}$ are acute, so the foot lies between $${Y}$ and $${Z}$.`,
        `The height from $${Z}$ gives $${h}\\sin ${X}$, a median is not a height, and a segment perpendicular to the side it starts on is not a height either.`,
        `With base $${b}$ the area is $\\frac12\\cdot ${b}\\cdot ${h}\\sin ${Z}=${formula}$.`,
      ],
    });
  }

  if (flaw) {
    const lines = derivationLines(t, flaw);
    const bad = flawLine[flaw];
    const work = lines.map((l, i) => `Line ${i + 1}: ${l}`).join(" ");
    const options: Opt[] = [1, 2, 3, 4].map((k) =>
      k === bad
        ? { label: `Line ${k}`, correct: true as const }
        : {
            label: `Line ${k}`,
            feedback:
              k < bad
                ? lineVerdict(t, flaw, k)
                : `Line ${k} comes after the first mistake. Find the earliest line that is false or does not follow from the lines above it.`,
          },
    );
    return choiceProblem(meta, seed, r, {
      prompt: `${known}${obtuse ? ` Angle $${Z}$ is obtuse.` : ""} A student derives the area. ${work} In which line does the derivation first go wrong?`,
      options,
      keepOrder: true,
      figure: areaFigure(t, { numeric: false, flip }),
      hint: obtuse
        ? `Angle $${Z}$ is obtuse. Where must the perpendicular from $${X}$ land, and what is the angle at $${Z}$ inside right triangle $${XDZ}$? Check Lines 1 to 4 in order against that.`
        : `Find the right triangle that contains angle $${Z}$. Name its hypotenuse and the side opposite $${Z}$, then check Lines 1 to 4 in order against them.`,
      explanation: [
        `Check each line in order; the first one that is false or does not follow is the error.`,
        ...[1, 2, 3, 4]
          .filter((k) => k <= bad)
          .map((k) => lineVerdict(t, flaw, k)),
        `A correct derivation: the height from $${X}$ to line $${YZ}$ is $h=${h}\\sin ${Z}$${obtuse ? ` (using $\\sin(180^\\circ-${Z})=\\sin ${Z}$)` : ""}, and the area is $\\frac12\\cdot ${b}\\cdot h=${formula}$.`,
      ],
    });
  }

  if (task === "justify") {
    return choiceProblem(meta, seed, r, {
      prompt: `In triangle $${name}$, the perpendicular from $${X}$ meets $\\overline{${YZ}}$ at $D$, and $h=${X}D$. Which statement justifies the step $h=${h}\\sin ${Z}$?`,
      options: [
        {
          label: `In right triangle $${XDZ}$, $\\sin ${Z}=\\frac{\\text{opposite}}{\\text{hypotenuse}}=\\frac{h}{${h}}$.`,
          correct: true,
        },
        {
          label: `In right triangle $${XDZ}$, $\\cos ${Z}=\\frac{h}{${h}}$.`,
          feedback: `Cosine is the adjacent side over the hypotenuse. The side $h$ is opposite angle $${Z}$, so the ratio is $\\sin ${Z}$.`,
        },
        {
          label: `$\\sin ${Z}=\\frac{h}{${b}}$, because $h$ is drawn to side $\\overline{${YZ}}$ of length $${b}$.`,
          feedback: `$\\overline{${YZ}}$ is the side the height lands on, and it is not a side of right triangle $${XDZ}$. That triangle's hypotenuse is $\\overline{${XZ}}=${h}$.`,
        },
        {
          label:
            "A height always equals a side times the sine of the included angle, by definition.",
          feedback:
            "That assumes what the step is meant to show. The relation comes from the sine ratio in a right triangle.",
        },
      ],
      figure: areaFigure(t, { numeric: false, height: true, flip }),
      hint: `In right triangle $${XDZ}$, which side is opposite angle $${Z}$, and which is the hypotenuse: $\\overline{${XZ}}$ or $\\overline{${YZ}}$?`,
      explanation: [
        `Triangle $${XDZ}$ has a right angle at $D$ and contains angle $${Z}$, because both angles $${Y}$ and $${Z}$ are acute and $D$ lies between them.`,
        `In it, $h$ is the side opposite angle $${Z}$ and $\\overline{${XZ}}=${h}$ is the hypotenuse, so $\\sin ${Z}=\\frac{h}{${h}}$.`,
        `Multiplying by $${h}$ gives $h=${h}\\sin ${Z}$. Cosine would use the adjacent side $\\overline{D${Z}}$, the side $\\overline{${YZ}}$ is not in the right triangle's ratio, and calling the result a definition assumes it.`,
      ],
    });
  }

  if (task === "obtuse-complete") {
    return choiceProblem(meta, seed, r, {
      prompt: `In triangle $${name}$, angle $${Z}$ is obtuse. The perpendicular from $${X}$ meets line $${YZ}$ at $D$, beyond $${Z}$, with $h=${X}D$. Which explanation correctly and completely shows that the area is $${formula}$?`,
      options: [
        {
          label: `$m\\angle ${X}${Z}D=180^\\circ-${Z}$ and $\\sin(180^\\circ-${Z})=\\sin ${Z}$, so $h=${h}\\sin ${Z}$ and the area is $\\frac12${b}h$.`,
          correct: true,
        },
        {
          label: `Right triangle $${XDZ}$ gives $h=${h}\\sin ${Z}$, so the area is $\\frac12${b}h=${formula}$.`,
          feedback: `The result is right, but the reason is missing. Angle $${Z}$ is not an angle of triangle $${XDZ}$: that triangle gives $h=${h}\\sin(180^\\circ-${Z})$, and the argument must say why that equals $${h}\\sin ${Z}$.`,
        },
        {
          label: `Since $${Z}$ is obtuse, $\\sin ${Z}$ is negative; use $|\\sin ${Z}|$ so the area is positive.`,
          feedback: `The sine of an obtuse angle is positive: $\\sin ${Z}=\\sin(180^\\circ-${Z})$, the sine of an acute angle.`,
        },
        {
          label: `The formula holds only for acute $${Z}$; for obtuse $${Z}$ use $\\frac12${pair}\\sin(180^\\circ-${Z})$.`,
          feedback: `The formula holds for obtuse angles too: $\\sin(180^\\circ-${Z})=\\sin ${Z}$, so both expressions are the same number.`,
        },
      ],
      figure: areaFigure(t, { numeric: false, height: true, flip }),
      hint: `What is the angle at $${Z}$ inside right triangle $${XDZ}$, and how does its sine compare with $\\sin ${Z}$?`,
      explanation: [
        `The angle at $${Z}$ inside right triangle $${XDZ}$ is $\\angle ${X}${Z}D$. With angle $${Z}$ it makes a straight angle, so $m\\angle ${X}${Z}D=180^\\circ-${Z}$.`,
        `In that right triangle, $h=${h}\\sin(180^\\circ-${Z})$. Supplementary angles have equal sines, so $h=${h}\\sin ${Z}$.`,
        `The area is $\\frac12\\cdot ${b}\\cdot h=${formula}$. An argument that writes $h=${h}\\sin ${Z}$ straight from triangle $${XDZ}$ skips the step that angle $${Z}$ is not in that triangle; the sine of an obtuse angle is positive; and the formula does not fail for obtuse angles.`,
      ],
    });
  }

  // The third height: from the vertex of the given angle.
  return choiceProblem(meta, seed, r, {
    prompt: `${known} A student draws the perpendicular from $${Z}$ to $\\overline{${XY}}$, meeting it at $E$. Why does it not lead directly to the area $${formula}$?`,
    options: [
      {
        label: `Its right triangles contain angles $${X}$ and $${Y}$ but only parts of angle $${Z}$, so its height is $${h}\\sin ${X}$.`,
        correct: true,
      },
      {
        label:
          "A perpendicular cannot be drawn from the vertex of the given angle.",
        feedback: `A perpendicular can be drawn from any vertex to the line of the opposite side, including from $${Z}$.`,
      },
      {
        label: "It gives a different area, so the formula would be wrong.",
        feedback:
          "Every height of a triangle gives the same area with its own base. This one just does not use angle $" +
          Z +
          "$.",
      },
      {
        label: `The perpendicular from $${Z}$ always falls outside the triangle.`,
        feedback: `Here angles $${X}$ and $${Y}$ are acute, so the perpendicular from $${Z}$ lands between $${X}$ and $${Y}$, inside the triangle.`,
      },
    ],
    figure: areaFigure(t, { numeric: false, third: true, flip }),
    hint: `Look at the two right triangles that $\\overline{${Z}E}$ makes. Which angles of triangle $${name}$ does each one contain?`,
    explanation: [
      `The perpendicular from $${Z}$ splits angle $${Z}$ into two parts and makes right triangles $${X}E${Z}$ and $${Y}E${Z}$.`,
      `Right triangle $${X}E${Z}$ contains angle $${X}$ and has hypotenuse $\\overline{${XZ}}=${h}$, so $${Z}E=${h}\\sin ${X}$. That height is written with angle $${X}$, not angle $${Z}$.`,
      `It gives the same area, $\\frac12\\cdot ${XY}\\cdot ${h}\\sin ${X}$, but not in terms of the known sides and angle $${Z}$. The height from $${X}$ to line $${YZ}$ does that: $h=${h}\\sin ${Z}$, so the area is $${formula}$.`,
    ],
  });
}

export const trigAreaDerivationGenerate = defineGenerate(
  trigAreaDerivationTemplates,
  {
    "trig-area-auxiliary-line": entry(footAxes, ({ meta, seed, r, axes }) =>
      footProblem(meta, seed, r, axes),
    ),
    "trig-area-derivation-fill": entry(fillAxes, ({ meta, seed, r, axes }) =>
      fillProblem(meta, seed, r, axes),
    ),
    "trig-area-derivation-reasoning": entry(
      reasonAxes,
      ({ meta, seed, r, axes }) => reasonProblem(meta, seed, r, axes),
    ),
  },
);
