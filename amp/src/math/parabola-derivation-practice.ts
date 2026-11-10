import type { SemanticFigure, TemplateMetadata } from "./contracts.js";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  type ChoiceOption,
} from "./chain-kit.js";
import { shuffle } from "./distribution-practice.js";
import {
  serializeMultiPart,
  type MultiPartBlank,
  type MultiPartChoiceResponse,
} from "./multi-part-choice.js";
import { graph } from "./scene/author.js";
import { defineAxis, type Random } from "./variation/axes.js";
import type { Surface } from "./variation/compose.js";

/**
 * HSG.GPE.A.2: derive the equation of a parabola from its focus and
 * directrix. Three types share one exact model: a focus F and a directrix
 * (horizontal y = c or vertical x = c). Every line of the derivation is
 * rendered from that model with the numbers substituted:
 *
 *   L1  √((x−a)² + (y−b)²) = |y − c|
 *   L2  (x−a)² + (y−b)² = (y−c)²
 *   L3  (x−a)² + y² − 2by + b² = y² − 2cy + c²
 *   L4  (x−a)² = 2(b−c)y + (c² − b²)
 *   L5  (x−a)² = 2(b−c)(y − (b+c)/2)
 *
 * For a vertical directrix the roles of x and y swap. Below, `f` is the
 * focus coordinate across the axis (a for a horizontal directrix), `F` the
 * coordinate along the axis (b), and `c` the directrix. Every one of f, F
 * and c is nonzero and F ≠ ±c, so each named distractor stays distinct:
 * F = 0 would make the uncancelled-sign line equal the right one, c = 0 the
 * difference-of-squares line, F = −c the flipped vertex.
 */

const parts = { requiredResponseCapability: "multi-part-choice-v1" as const };
const choice = { requiredResponseCapability: "single-choice-v1" as const };
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const senses = {
  vertex: "vertex-parabola",
  vertices: "vertex-parabola",
  focus: "focus",
};

export const parabolaDerivationTemplates: readonly TemplateMetadata[] = [
  {
    id: "parabola-derive-equation",
    version: 1,
    title: "Derive a parabola's equation, line by line",
    skillId: "parabola-locus",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    description:
      "From a numeric focus and directrix (horizontal or vertical), choose each line of the derivation: the equal-distance equation, both sides squared, the squares expanded and cancelled, and the factored standard form, or $p$ and the vertex read from it. Every wrong line is a named slip.",
    glossarySenses: senses,
    ...parts,
    ...scenes,
  },
  {
    id: "parabola-derivation-check",
    version: 1,
    title: "Check a derivation of a parabola's equation",
    skillId: "parabola-locus",
    gradeBand: "9–12",
    difficultyOffset: 0.6,
    description:
      "Read a five-line derivation from a focus and directrix. Either find the first incorrect line and name the mistake (later lines follow correctly from the wrong one), or choose the reasons for two marked steps of a correct derivation.",
    glossarySenses: senses,
    ...parts,
  },
  {
    id: "parabola-point-equidistance",
    version: 1,
    title: "Use the focus-directrix rule at one point",
    skillId: "parabola-locus",
    gradeBand: "9–12",
    difficultyOffset: 0.2,
    description:
      "Use the rule that a point on a parabola is as far from the focus as from the directrix: find a point's missing coordinate, or choose the correct and complete explanation of whether a given point is on the parabola.",
    glossarySenses: senses,
    ...choice,
    ...scenes,
  },
];
const meta = (id: string) =>
  parabolaDerivationTemplates.find((t) => t.id === id)!;

/* ------------------------------------------------------------- model */

export type Orientation = "horizontal" | "vertical";
export interface Setup {
  /** The directrix: horizontal y = c, or vertical x = c. */
  o: Orientation;
  /** Focus coordinate across the axis of symmetry. */
  f: number;
  /** Focus coordinate along the axis of symmetry. */
  F: number;
  c: number;
}
const other = (o: Orientation): Orientation =>
  o === "horizontal" ? "vertical" : "horizontal";
/** The variable along the axis of symmetry (the directrix's variable). */
const U = (s: Setup) => (s.o === "horizontal" ? "y" : "x");
/** The other variable, which is squared in the standard form. */
const W = (s: Setup) => (s.o === "horizontal" ? "x" : "y");
export const focusOf = (s: Setup): [number, number] =>
  s.o === "horizontal" ? [s.f, s.F] : [s.F, s.f];
export const pOf = (s: Setup) => (s.F - s.c) / 2;
export const kOf = (s: Setup) => (s.F + s.c) / 2;
const vertexOf = (s: Setup): [number, number] =>
  s.o === "horizontal" ? [s.f, kOf(s)] : [kOf(s), s.f];

const nonzero = (r: Random, max: number) => {
  const v = r(1, max);
  return r(0, 1) ? v : -v;
};
/** a, b, c in [−6, 6] as the spec draws them, all nonzero, F ≠ ±c; an even
 * gap |F − c| (integer p and vertex) three times in four. */
export function drawSetup(r: Random, o: Orientation): Setup {
  const even = r(1, 4) <= 3;
  for (;;) {
    const f = nonzero(r, 6),
      F = nonzero(r, 6),
      c = nonzero(r, 6);
    const gap = Math.abs(F - c);
    if (F === c || F === -c || gap > 8) continue;
    if ((gap % 2 === 0) !== even) continue;
    return { o, f, F, c };
  }
}

/* --------------------------------------------------------- rendering */

/** A multiple of 1/2, written exactly: 3, -1.5. */
export function num(v: number): string {
  const twice = Math.round(v * 2);
  if (!Number.isFinite(v) || Math.abs(v * 2 - twice) > 1e-9)
    throw new Error(`Not a multiple of one half: ${v}`);
  return String(twice / 2);
}
/** v − h, bracketed: (x-3), (y+1.5); v itself when h is 0. */
const shift = (v: string, h: number) =>
  h === 0 ? v : h > 0 ? `(${v}-${num(h)})` : `(${v}+${num(-h)})`;
const sq = (v: string, h: number) => `${shift(v, h)}^2`;
const absd = (v: string, h: number) =>
  h === 0 ? `|${v}|` : h > 0 ? `|${v}-${num(h)}|` : `|${v}+${num(-h)}|`;
/** Terms in the order given, zero terms dropped: [[1,"y^2"],[-4,"y"],[4,""]]
 * → y^2-4y+4. */
export function poly(terms: [number, string][]): string {
  let out = "";
  for (const [k, mono] of terms) {
    if (k === 0) continue;
    const size = Math.abs(k);
    const body = mono ? (size === 1 ? mono : `${num(size)}${mono}`) : num(size);
    out += k < 0 ? `-${body}` : out ? `+${body}` : body;
  }
  return out || "0";
}
/** A term with its sign always shown: +4y, -4y. */
const signed = (k: number, mono: string) =>
  k < 0 ? poly([[k, mono]]) : `+${poly([[k, mono]])}`;
/** k times a bracket: 12(y+1), -6(x-0.5). */
const scaled = (k: number, inner: string) =>
  k === 1 ? inner : k === -1 ? `-${inner}` : `${num(k)}${inner}`;
const pt = ([x, y]: [number, number]) => `(${num(x)}, ${num(y)})`;
const directrixTex = (s: Setup) => `${U(s)}=${num(s.c)}`;
const givens = (s: Setup) =>
  `focus $F${pt(focusOf(s))}$ and directrix $${directrixTex(s)}$`;
/** "4-(-2)" or "4-2": a difference as written before it is worked out. */
const diff = (a: number, b: number) =>
  b < 0 ? `${num(a)}-(${num(b)})` : `${num(a)}-${num(b)}`;

const radicand = (s: Setup) => {
  const [fx, fy] = focusOf(s);
  return `${sq("x", fx)}+${sq("y", fy)}`;
};
const expandU = (s: Setup, h: number) =>
  poly([
    [1, `${U(s)}^2`],
    [-2 * h, U(s)],
    [h * h, ""],
  ]);
/** The five lines of the correct derivation (TeX, no dollars). */
export function correctChain(s: Setup): string[] {
  const { f, F, c } = s;
  const u = U(s),
    w = W(s);
  const expanded =
    s.o === "horizontal"
      ? `${sq("x", f)}+${expandU(s, F)}`
      : `${expandU(s, F)}+${sq("y", f)}`;
  return [
    `\\sqrt{${radicand(s)}}=${absd(u, c)}`,
    `${radicand(s)}=${sq(u, c)}`,
    `${expanded}=${expandU(s, c)}`,
    `${sq(w, f)}=${poly([
      [2 * (F - c), u],
      [c * c - F * F, ""],
    ])}`,
    `${sq(w, f)}=${scaled(2 * (F - c), shift(u, kOf(s)))}`,
  ];
}

const wrap = (tex: string) => `$${tex}$`;
const chainArray = (lines: string[]) =>
  `$\\begin{array}{rl}${lines
    .map((line, i) => `\\text{Line ${i + 1}:}&${line}`)
    .join("\\\\")}\\end{array}$`;

/** Option letters of a multi-part blank, in the order shown. */
const lettered = (labels: string[]) =>
  labels.map((label, i) => ({ id: "abcdef"[i]!, label }));

/** A blank whose options are the correct label first plus wrong labels,
 * shuffled; returns the blank and the correct option's id. */
function blank(
  r: Random,
  id: string,
  label: string,
  correct: string,
  wrong: string[],
): { blank: MultiPartBlank; key: string } {
  const all = [correct, ...wrong];
  if (new Set(all).size !== all.length)
    throw new Error("Need three retry: options repeat");
  const order = shuffle(r, [...all]);
  const options = lettered(order);
  return {
    blank: { id, label, options },
    key: options[order.indexOf(correct)]!.id,
  };
}

/** Graph window holding every listed coordinate, square so distances look
 * true. */
function window(...values: number[]) {
  const L = Math.ceil(Math.max(...values.map(Math.abs))) + 2;
  // Tick values only at the window's ends: the coordinates are in the
  // prompt, and interior tick labels would crowd the point labels near an
  // axis.
  return {
    x: [-L, L] as [number, number],
    y: [-L, L] as [number, number],
    tick: L > 9 ? 2 : 1,
    labels: "ends" as const,
  };
}
const directrixLine = (s: Setup) =>
  s.o === "horizontal" ? { m: 0, b: s.c } : { x: s.c };
/** Swap to (x, y) from (across, along) the axis. */
const toXY = (s: Setup, w: number, u: number): [number, number] =>
  s.o === "horizontal" ? [w, u] : [u, w];

/* ------------------------------------------------ derive the equation */

const derivedAxis = defineAxis(
  "orientation",
  ["horizontal", "vertical"] as const,
  { weights: [13, 7] },
);
const endingAxis = defineAxis("ending", ["equation", "values"] as const, {
  weights: [4, 1],
});

export const deriveEquation = chainFamily({
  template: meta("parabola-derive-equation"),
  axes: { orientation: derivedAxis, ending: endingAxis },
  model: (r, axes) => drawSetup(r, axes.orientation),
  variant: (s: Setup) => s.o,
  render: (s, axes, r): Surface | null => {
    const { f, F, c } = s;
    const u = U(s),
      w = W(s);
    const k = kOf(s),
      p = pOf(s);
    const L = correctChain(s);
    const [fx, fy] = focusOf(s);
    const rad = radicand(s);
    const pick3 = (pool: string[]) => shuffle(r, [...pool]).slice(0, 3);
    const line1 = blank(
      r,
      "line1",
      "Line 1: $PF$ equals the distance from $P$ to the directrix",
      wrap(L[0]!),
      pick3([
        wrap(`\\sqrt{${rad}}=${absd(w, c)}`),
        wrap(`\\sqrt{${sq("x", -fx)}+${sq("y", -fy)}}=${absd(u, c)}`),
        wrap(
          `\\sqrt{${s.o === "horizontal" ? `${sq("x", fx)}+${sq("y", c)}` : `${sq("x", c)}+${sq("y", fy)}`}}=${absd(u, F)}`,
        ),
        wrap(`${rad}=${absd(u, c)}`),
      ]),
    );
    const line2 = blank(r, "line2", "Line 2: square both sides", wrap(L[1]!), [
      wrap(`${rad}=${absd(u, c)}`),
      wrap(`${shift("x", fx)}+${shift("y", fy)}=${shift(u, c)}`),
      wrap(`${rad}=${u}^2-${num(c * c)}`),
    ]);
    const line3 = blank(
      r,
      "line3",
      `Line 3: expand, cancel $${u}^2$ and collect terms`,
      wrap(L[3]!),
      [
        wrap(
          `${sq(w, f)}=${poly([
            [2 * (F - c), u],
            [F * F - c * c, ""],
          ])}`,
        ),
        wrap(
          `${sq(w, f)}=${poly([
            [-2 * (F + c), u],
            [c * c - F * F, ""],
          ])}`,
        ),
        wrap(
          `${sq(w, f)}+2${u}^2=${poly([
            [2 * (F - c), u],
            [c * c - F * F, ""],
          ])}`,
        ),
      ],
    );
    const values = axes.ending === "values";
    const vertex = vertexOf(s);
    const read = (pp: number, v: [number, number]) =>
      `$p=${num(pp)}$, vertex $${pt(v)}$`;
    const form = s.o === "horizontal" ? "(x-h)^2=4p(y-k)" : "(y-k)^2=4p(x-h)";
    const line4 = values
      ? blank(
          r,
          "line4",
          `From Line 3: $p$ and the vertex $(h, k)$ in $${form}$`,
          read(p, vertex),
          pick3([
            read(2 * p, vertex),
            read(p, focusOf(s)),
            read(-p, vertex),
            read(p, s.o === "horizontal" ? [f, -k] : [-k, f]),
          ]),
        )
      : blank(
          r,
          "line4",
          `Line 4: factor into the form $${form}$`,
          wrap(L[4]!),
          pick3([
            wrap(`${sq(w, f)}=${scaled(4 * (F - c), shift(u, k))}`),
            wrap(`${sq(w, f)}=${scaled(-2 * (F - c), shift(u, k))}`),
            wrap(`${sq(w, f)}=${scaled(2 * (F - c), shift(u, F))}`),
            wrap(`${sq(w, f)}=${scaled(2 * (F - c), shift(u, -k))}`),
          ]),
        );
    const blanks = [line1, line2, line3, line4];
    const response: MultiPartChoiceResponse = {
      kind: "multi-part-choice",
      label: "Choose the correct line for each step",
      layout: "slots",
      blanks: blanks.map((b) => b.blank),
    };
    const answer = serializeMultiPart(
      response,
      Object.fromEntries(blanks.map((b) => [b.blank.id, b.key])),
    );
    // A sample point P on the curve, off the focus's level so PF slants.
    const t =
      [3, 4, 5, 6, 2].find(
        (x) =>
          x !== 2 * Math.abs(p) &&
          x * x <= 32 * Math.abs(p) &&
          x * x >= 2 * Math.abs(p),
      ) ?? 3;
    const tw = r(0, 1) ? t : -t;
    const Pu = k + (tw * tw) / (4 * p);
    const P = toXY(s, f + tw, Pu);
    const D = toXY(s, f + tw, c);
    const focus = focusOf(s);
    const g = window(...P, ...D, ...focus, c);
    const figure: SemanticFigure = {
      kind: "scene",
      scene: graph(g)
        .id("g")
        .line(directrixLine(s), { dash: "dash" })
        .point(focus[0], focus[1], "F", { color: "accent" })
        .point(P[0], P[1], "P")
        .point(D[0], D[1], "D", { color: "warm" })
        .segment(P, focus, { color: "accent" })
        .segment(P, D, { color: "warm" })
        .scene({
          title: `The focus F, the directrix ${directrixTex(s)} and a point P with its distances to both`,
        }),
    };
    const dropWord =
      s.o === "horizontal" ? "straight down or up" : "straight across";
    return {
      prompt: `A parabola has ${givens(s)}. Let $P(x, y)$ be any point on the parabola. Derive its equation by choosing each line. For each line, assume the lines before it are correct.`,
      response,
      answer,
      figure,
      hint: `The first line compares two lengths: $PF$, the slanted distance from $P$ to $F${pt(focus)}$, and the distance from $P$ to the line $${directrixTex(s)}$, measured ${dropWord}. Which coordinate of $P$ changes along that path?`,
      explanation: [
        `A point $P(x, y)$ is on the parabola exactly when its distance to the focus equals its distance to the directrix.`,
        `$PF$ is the hypotenuse of a right triangle with legs $${shift("x", fx).replace(/^\(|\)$/g, "")}$ and $${shift("y", fy).replace(/^\(|\)$/g, "")}$, so $PF=\\sqrt{${rad}}$. The distance to the line $${directrixTex(s)}$ is a straight drop: $${absd(u, c)}$. Line 1: $${L[0]}$.`,
        `Both sides are distances, so neither is negative, and squaring both sides keeps exactly the same points. It removes the root and the absolute value. Line 2: $${L[1]}$.`,
        `Expand $${sq(u, F)}$ and $${sq(u, c)}$: $${L[2]}$. The term $${u}^2$ is on both sides and cancels. Moving $${poly([[-2 * F, u]])}$ across makes it $${signed(2 * F, u)}$. Line 3: $${L[3]}$.`,
        values
          ? `Factor $${num(2 * (F - c))}$ out of the right side: $${L[4]}$. So $4p=${num(2 * (F - c))}$, $p=${num(p)}$, and the vertex is $${pt(vertex)}$, halfway between the focus and the directrix.`
          : `Factor $${num(2 * (F - c))}$ out of the right side. Line 4: $${L[4]}$. Here $4p=${num(2 * (F - c))}$, so $p=${num(p)}$, and the vertex $${pt(vertex)}$ is halfway between the focus and the directrix.`,
        `Check: the vertex is $${num(Math.abs(p))}$ from the focus and $${num(Math.abs(p))}$ from the directrix. The wrong lines measure the drop along the wrong axis, keep the sign in $(x+a)$, swap focus and directrix, square one side only, split the root, drop a middle term, leave a moved term's sign unchanged, use the whole gap as $p$, or put the vertex at the focus.`,
      ],
    };
  },
});

/* ------------------------------------------------ check a derivation */

export type ErrorCode = "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8";
export const errorLine: Record<ErrorCode, number> = {
  E1: 1,
  E2: 1,
  E3: 2,
  E4: 2,
  E5: 3,
  E6: 4,
  E7: 5,
  E8: 5,
};
const errorWeights: [ErrorCode, number][] = [
  ["E1", 15],
  ["E2", 10],
  ["E3", 10],
  ["E4", 5],
  ["E5", 20],
  ["E6", 15],
  ["E7", 15],
  ["E8", 10],
];
const partner: Partial<Record<ErrorCode, ErrorCode>> = {
  E1: "E2",
  E2: "E1",
  E3: "E4",
  E4: "E3",
  E7: "E8",
  E8: "E7",
};
/** A line shows a number other than a line label's digits 1 to 5 (which
 * every derivation prompt prints), so quoting it names this problem. */
const ownNumber = (tex: string) =>
  (tex.match(/\d+(?:\.\d+)?/g) ?? []).some((t) => !/^[1-5]$/.test(t));
/** A multiple of 1/2 (the shift the E5 line factors to). */
const isHalf = (v: number) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;

/** The five lines with error `code` injected at its line; each later line
 * follows correctly from the wrong one. Null when the numbers cannot carry
 * this error cleanly (a degenerate line or an unwritable shift), or when a
 * carried-forward last line would happen to show the factor 4(F − c), so
 * that the "factor should be 4p" reason would also describe it. */
export function flawedChain(s: Setup, code: ErrorCode): string[] | null {
  const { f, F, c } = s;
  const u = U(s),
    w = W(s);
  const L = correctChain(s);
  const [fx, fy] = focusOf(s);
  const wholeGap = 4 * (F - c);
  switch (code) {
    case "E1": {
      // The drop measured along the wrong axis: the derivation of the
      // parabola with the same focus and the line w = c.
      if (f === c || f === -c || 2 * (f - c) === wholeGap) return null;
      return correctChain({ o: other(s.o), f: F, F: f, c });
    }
    case "E2":
      // Focus and directrix swapped.
      return correctChain({ o: s.o, f, F: c, c: F });
    case "E3":
      return [
        L[0]!,
        `${shift("x", fx)}+${shift("y", fy)}=${shift(u, c)}`,
        `${poly([
          [1, "x"],
          [-fx, ""],
          [1, "y"],
          [-fy, ""],
        ])}=${poly([
          [1, u],
          [-c, ""],
        ])}`,
        `${poly([
          [1, w],
          [-fx, ""],
          [-fy, ""],
        ])}=${num(-c)}`,
        `${w}=${num(fx + fy - c)}`,
      ];
    case "E4": {
      const right = absd(u, c);
      const xs = poly([
        [1, "x^2"],
        [-2 * fx, "x"],
        [fx * fx, ""],
      ]);
      const ys = poly([
        [1, "y^2"],
        [-2 * fy, "y"],
        [fy * fy, ""],
      ]);
      return [
        L[0]!,
        `${radicand(s)}=${right}`,
        s.o === "horizontal"
          ? `${sq("x", fx)}+${ys}=${right}`
          : `${xs}+${sq("y", fy)}=${right}`,
        `${xs}+${ys}=${right}`,
        `${poly([
          [1, "x^2"],
          [-2 * fx, "x"],
          [1, "y^2"],
          [-2 * fy, "y"],
        ])}=${right}-${num(fx * fx + fy * fy)}`,
      ];
    }
    case "E5": {
      const h = (F * F - c * c) / (2 * F);
      if (!isHalf(h) || 2 * F === wholeGap) return null;
      const left =
        s.o === "horizontal"
          ? `${sq("x", f)}+${expandU(s, F)}`
          : `${expandU(s, F)}+${sq("y", f)}`;
      return [
        L[0]!,
        L[1]!,
        `${left}=${poly([
          [1, `${u}^2`],
          [c * c, ""],
        ])}`,
        `${sq(w, f)}=${poly([
          [2 * F, u],
          [c * c - F * F, ""],
        ])}`,
        `${sq(w, f)}=${scaled(2 * F, shift(u, h))}`,
      ];
    }
    case "E6":
      if (-2 * (F + c) === wholeGap) return null;
      return [
        L[0]!,
        L[1]!,
        L[2]!,
        `${sq(w, f)}=${poly([
          [-2 * (F + c), u],
          [c * c - F * F, ""],
        ])}`,
        `${sq(w, f)}=${scaled(-2 * (F + c), shift(u, (c - F) / 2))}`,
      ];
    case "E7":
      return [
        ...L.slice(0, 4),
        `${sq(w, f)}=${scaled(4 * (F - c), shift(u, kOf(s)))}`,
      ];
    case "E8":
      return [
        ...L.slice(0, 4),
        `${sq(w, f)}=${scaled(2 * (F - c), shift(u, F + c))}`,
      ];
  }
}

/** Each code's mistake, stated for this problem's numbers. */
export function reasonText(s: Setup, code: ErrorCode): string {
  const { f, F, c } = s;
  const u = U(s),
    w = W(s);
  const swappedFocus: [number, number] = s.o === "horizontal" ? [f, c] : [c, f];
  const gap = 2 * (F - c);
  switch (code) {
    case "E1":
      return `The drop to $${directrixTex(s)}$ was written $${absd(w, c)}$; it is $${absd(u, c)}$.`;
    case "E2":
      return `Focus and directrix were swapped: the root holds $${pt(swappedFocus)}$, not $${pt(focusOf(s))}$.`;
    case "E3":
      return "The root was split term by term, but $\\sqrt{A+B}\\ne\\sqrt{A}+\\sqrt{B}$.";
    case "E4":
      return `Only the left side was squared; $${absd(u, c)}$ must be squared too.`;
    case "E5":
      return `$${sq(u, c)}$ was written $${poly([
        [1, `${u}^2`],
        [c * c, ""],
      ])}$; the middle term $${poly([[-2 * c, u]])}$ is missing.`;
    case "E6":
      return `$${poly([[-2 * F, u]])}$ was moved across without its sign changing to $${signed(2 * F, u)}$.`;
    case "E7":
      return `The factor $${num(2 * gap)}$ should be $4p=${num(gap)}$: $|p|$ is half the focus-directrix gap.`;
    case "E8":
      return `Taking $${num(gap)}$ out of $${poly([
        [gap, u],
        [c * c - F * F, ""],
      ])}$ leaves $${poly([
        [1, u],
        [-kOf(s), ""],
      ])}$, not $${poly([
        [1, u],
        [-(F + c), ""],
      ])}$.`;
  }
}

/** What line `i` (1-based) of the correct derivation does. */
const stepWord = (s: Setup, i: number) => {
  const u = U(s);
  return [
    "sets the distance to the focus equal to the distance to the directrix",
    "squares both sides",
    `expands $${sq(u, s.F)}$ and $${sq(u, s.c)}$`,
    `cancels $${u}^2$ and collects the terms`,
    `factors $${num(2 * (s.F - s.c))}$ out of the right side`,
  ][i - 1]!;
};

/** Justifications for the transition into line i (0: why line 1 holds). */
function justification(s: Setup, i: number): string {
  const u = U(s);
  return [
    "Every point on a parabola is as far from the focus as from the directrix.",
    "Square both sides; both are non-negative, so no points are gained or lost.",
    `Expand $${sq(u, s.F)}$ and $${sq(u, s.c)}$.`,
    `Subtract $${u}^2$ from both sides, then collect the $${u}$-terms and numbers.`,
    `Factor $${num(2 * (s.F - s.c))}$ out of the right side; $${num(2 * (s.F - s.c))}$ is $4p$.`,
  ][i]!;
}
function wrongJustifications(s: Setup): string[] {
  return [
    "Take the square root of both sides.",
    `Divide both sides by $${num(2 * (s.F - s.c))}$.`,
    `Substitute the vertex $${pt(vertexOf(s))}$ for $(x, y)$.`,
  ];
}

const checkVariantAxis = defineAxis("task", ["flaw", "justify"] as const, {
  weights: [3, 2],
});

type CheckModel =
  | { kind: "flaw"; s: Setup; code: ErrorCode; lines: string[] }
  | { kind: "justify"; s: Setup; steps: [number, number] };

export const derivationCheck = chainFamily({
  template: meta("parabola-derivation-check"),
  axes: { orientation: derivedAxis, task: checkVariantAxis },
  model: (r, axes): CheckModel => {
    if (axes.task === "justify") {
      const s = drawSetup(r, axes.orientation);
      // Two distinct transitions, 0 (why line 1 holds) through 4, uniform.
      const first = r(0, 4);
      let second = r(0, 3);
      if (second >= first) second++;
      const steps = [first, second].sort((a, b) => a - b) as [number, number];
      return { kind: "justify", s, steps };
    }
    let roll = r(1, 100);
    let code: ErrorCode = "E5";
    for (const [c, w] of errorWeights) {
      if (roll <= w) {
        code = c;
        break;
      }
      roll -= w;
    }
    // Keep the drawn error; redraw the numbers until they carry it cleanly,
    // so every code keeps its weight.
    for (let tries = 0; tries < 60; tries++) {
      const s = drawSetup(r, axes.orientation);
      const lines = flawedChain(s, code);
      if (lines) return { kind: "flaw", s, code, lines };
    }
    throw new Error("Need three retry: error not writable here");
  },
  variant: (m: CheckModel) =>
    m.kind === "flaw"
      ? `flaw-${m.code.toLowerCase()}`
      : `justify-${m.steps.join("")}`,
  render: (m, _axes, r): Surface | null => {
    const s = m.s;
    const L = correctChain(s);
    if (m.kind === "flaw") {
      const e = errorLine[m.code];
      const lineBlank: MultiPartBlank = {
        id: "line",
        label: "The first incorrect line",
        options: lettered([1, 2, 3, 4, 5].map((i) => `Line ${i}`)),
      };
      const pool = errorWeights
        .map(([c]) => c)
        .filter((c) => c !== m.code && c !== partner[m.code]);
      const others = [
        ...(partner[m.code] ? [partner[m.code]!] : []),
        ...shuffle(r, pool),
      ].slice(0, 3);
      const why = blank(
        r,
        "mistake",
        "The mistake",
        reasonText(s, m.code),
        others.map((c) => reasonText(s, c)),
      );
      const response: MultiPartChoiceResponse = {
        kind: "multi-part-choice",
        label: "Choose the line and the mistake",
        layout: "slots",
        blanks: [lineBlank, why.blank],
      };
      const answer = serializeMultiPart(response, {
        line: "abcde"[e - 1]!,
        mistake: why.key,
      });
      // The hint points at one other line to check by example: never the
      // wrong line, and one that shows a number of this problem's own.
      const sample =
        [3, 4, 5, 2].find((i) => i !== e && ownNumber(m.lines[i - 1]!)) ??
        [3, 4, 5, 2].find((i) => i !== e)!;
      const checked = Array.from(
        { length: e - 1 },
        (_, i) =>
          `Line ${i + 1} is correct: it ${stepWord(s, i + 1)}, $${L[i]}$.`,
      );
      return {
        prompt: `Jonah derives the equation of the parabola with ${givens(s)}. His work contains one mistake.\n${chainArray(m.lines)}\nWhich line is the first incorrect line, and what is the mistake?`,
        response,
        answer,
        hint: `Check each line against the one before it, starting with Line 1: the slant to $F${pt(focusOf(s))}$ and the drop to $${directrixTex(s)}$. For example, does Line ${sample}, $${m.lines[sample - 1]}$, follow from Line ${sample - 1}? Redo each step yourself from the line above it and compare.`,
        explanation: [
          "Walk the lines in order, redoing each step from the line above it, and stop at the first line that does not follow.",
          ...checked,
          `Line ${e} should be $${L[e - 1]}$, but Jonah wrote $${m.lines[e - 1]}$. ${reasonText(s, m.code)}`,
          ...(e < 5
            ? [
                `The lines after it follow correctly from the wrong line, so they carry the mistake forward. From the correct Line ${e}, the derivation ends at $${L[4]}$.`,
              ]
            : [`The correct last line is $${L[4]}$.`]),
        ],
      };
    }
    const [i, j] = m.steps;
    const shown = [3, 4, 5, 2].find((x) => ownNumber(L[x - 1]!)) ?? 3;
    const right = [justification(s, i), justification(s, j)];
    const wrongPool = shuffle(r, [
      ...[0, 1, 2, 3, 4]
        .filter((x) => x !== i && x !== j)
        .map((x) => justification(s, x)),
      ...wrongJustifications(s),
    ]).slice(0, 3);
    const order = shuffle(r, [...right, ...wrongPool]);
    const options = lettered(order);
    const stepLabel = (x: number) =>
      x === 0 ? "Why Line 1 is true" : `From Line ${x} to Line ${x + 1}`;
    const response: MultiPartChoiceResponse = {
      kind: "multi-part-choice",
      label: "Choose the reason for each marked step",
      layout: "slots",
      blanks: [
        { id: "first", label: stepLabel(i), options },
        { id: "second", label: stepLabel(j), options },
      ],
    };
    const answer = serializeMultiPart(response, {
      first: options[order.indexOf(right[0]!)]!.id,
      second: options[order.indexOf(right[1]!)]!.id,
    });
    const said = (x: number) =>
      x === 0
        ? `Line 1 is true because every point on a parabola is as far from the focus as from the directrix: the left side is the distance to $F${pt(focusOf(s))}$ and the right side is the distance to $${directrixTex(s)}$.`
        : x === 1
          ? "From Line 1 to Line 2 both sides are squared. Both are distances, so neither is negative, and squaring keeps exactly the same points."
          : x === 2
            ? `From Line 2 to Line 3 the squares $${sq(U(s), s.F)}$ and $${sq(U(s), s.c)}$ are expanded; nothing is moved yet.`
            : x === 3
              ? `From Line 3 to Line 4, $${U(s)}^2$ is subtracted from both sides, and the $${U(s)}$-terms and numbers are collected on the right.`
              : `From Line 4 to Line 5, $${num(2 * (s.F - s.c))}$ is factored out of the right side. That coefficient is $4p$, and the bracket shows the vertex.`;
    return {
      prompt: `A student derives the equation of the parabola with ${givens(s)}. Every line is correct.\n${chainArray(L)}\nChoose the reason for each marked step.`,
      response,
      answer,
      hint: `For each marked step, compare the two lines: what happened to the left side, and what happened to the right? Line ${shown} reads $${L[shown - 1]}$; compare it with the line before or after it in the same way.`,
      explanation: [
        "A reason names the one operation that turns the earlier line into the later one, or the fact that makes the first line true.",
        said(i),
        said(j),
        "Taking a square root, dividing both sides by the coefficient, or substituting the vertex happens at no step of this derivation.",
      ],
    };
  },
});

/* ------------------------------------------- the rule at one point */

const pointTaskAxis = defineAxis("task", ["coordinate", "check"] as const);
const pointOrientationAxis = defineAxis(
  "orientation",
  ["horizontal", "vertical"] as const,
  { weights: [13, 7] },
);

interface CoordinateModel {
  kind: "coordinate";
  s: Setup;
  /** The given coordinate's offset from the focus, across the axis. */
  t: number;
  /** The missing coordinate. */
  value: number;
}
interface CheckPointModel {
  kind: "check";
  s: Setup;
  t: number;
  /** Offset along the axis from the focus. */
  dz: number;
  on: boolean;
}
type PointModel = CoordinateModel | CheckPointModel;

const isSquare = (n: number) => Number.isInteger(Math.sqrt(n));

export const pointEquidistance = chainFamily({
  template: meta("parabola-point-equidistance"),
  axes: { orientation: pointOrientationAxis, task: pointTaskAxis },
  model: (r, axes): PointModel => {
    const s = drawSetup(r, axes.orientation);
    const { f, F, c } = s;
    if (axes.task === "coordinate") {
      const t = nonzero(r, 8);
      const value = (t * t + F * F - c * c) / (2 * (F - c));
      if (!isHalf(value) || Math.abs(value) > 20 || Math.abs(f + t) > 20)
        throw new Error("Need three retry: coordinate not exact");
      return { kind: "coordinate", s, t, value };
    }
    const on = r(0, 1) === 1;
    const found: [number, number][] = [];
    for (let t = -12; t <= 12; t++)
      for (let dz = -12; dz <= 12; dz++) {
        if (!t || !dz || !isSquare(t * t + dz * dz)) continue;
        if (Math.abs(f + t) > 14 || Math.abs(F + dz) > 14) continue;
        const h = Math.sqrt(t * t + dz * dz);
        const d = Math.abs(F + dz - c);
        if (on ? d === h : d !== h && Math.abs(d - h) <= 5) found.push([t, dz]);
      }
    if (!found.length) throw new Error("Need three retry: no lattice point");
    const [t, dz] = found[r(0, found.length - 1)]!;
    return { kind: "check", s, t, dz, on };
  },
  variant: (m: PointModel) =>
    m.kind === "coordinate" ? "coordinate" : m.on ? "check-on" : "check-off",
  render: (m, _axes, r): Surface | null => {
    const s = m.s;
    const { f, F, c } = s;
    const u = U(s),
      w = W(s);
    const focus = focusOf(s);
    const k = kOf(s);
    if (m.kind === "coordinate") {
      const given = f + m.t;
      const value = m.value;
      const P = (z: string) =>
        s.o === "horizontal"
          ? `P(${num(given)}, ${z})`
          : `P(${z}, ${num(given)})`;
      // Each slip's value, from its own wrong arithmetic; kept only when it is
      // a multiple of one half (like every right answer) and not the answer.
      const slips: [number, string][] = [
        [
          (m.t + F * F - c * c) / (2 * (F - c)),
          `This uses $${num(m.t)}$ where the squared leg $(${num(m.t)})^2=${num(m.t * m.t)}$ belongs.`,
        ],
        [
          k,
          `That is the vertex's $${u}$-coordinate: it leaves out the leg $(${num(m.t)})^2$. On this parabola only the vertex has $${u}=${num(k)}$.`,
        ],
        [
          2 * value,
          `This divides by $${num(F - c)}$, but once $${u}^2$ cancels and the terms are collected, the coefficient of $${u}$ is $${num(2 * (F - c))}$.`,
        ],
        [
          -value,
          "The sign is reversed. Check it: the point must be as far from the focus as from the directrix.",
        ],
        [
          (m.t * m.t + c * c - F * F) / (2 * (F - c)),
          `The numbers $${num(F * F)}$ and $${num(c * c)}$ changed sides without changing sign.`,
        ],
        [
          c + Math.sign(F - c) * Math.abs(m.t),
          `This makes the distance to the directrix equal to the leg $${num(Math.abs(m.t))}$ alone; $PF$ also has a leg along the axis.`,
        ],
      ];
      const pool: ChoiceOption[] = slips
        .filter(([v]) => isHalf(v) && Math.abs(v) <= 20 && v !== value)
        .map(([v, feedback]) => ({ label: `$${u}=${num(v)}$`, feedback }));
      const surface = choiceSurface(r, {
        prompt: `A parabola has ${givens(s)}. The point $${P(u)}$ is on the parabola. Find $${u}$.`,
        options: [
          { label: `$${u}=${num(value)}$`, correct: true },
          ...shuffle(r, pool),
        ],
        hint: `On the parabola, $PF$ equals the distance from $P$ to the line $${directrixTex(s)}$. Write $PF$ with the legs $${diff(given, f)}$ and $${poly(
          [
            [1, u],
            [-F, ""],
          ],
        )}$, set it equal to $${absd(u, c)}$, and square both sides.`,
        explanation: [
          "A point is on the parabola exactly when it is as far from the focus as from the directrix.",
          `Distance to $F$: $\\sqrt{(${diff(given, f)})^2+${sq(u, F)}}$. Distance to the directrix: $${absd(u, c)}$.`,
          `Set them equal and square both sides: $${num(m.t * m.t)}+${sq(u, F)}=${sq(u, c)}$.`,
          `Expand: $${num(m.t * m.t)}+${expandU(s, F)}=${expandU(s, c)}$. Cancel $${u}^2$ and collect: $${poly([[2 * (F - c), u]])}=${num(m.t * m.t + F * F - c * c)}$, so $${u}=${num(value)}$.`,
          `Check: $PF=\\sqrt{${num(m.t * m.t)}+(${diff(value, F)})^2}=${num(Math.abs(value - c))}$ and the distance to the directrix is $|${diff(value, c)}|=${num(Math.abs(value - c))}$.`,
        ],
      });
      if (!surface) return null;
      const line = s.o === "horizontal" ? { x: given } : { m: 0, b: given };
      return {
        ...surface,
        figure: {
          kind: "scene",
          scene: graph(window(...focus, c, given, k))
            .id("g")
            .line(directrixLine(s), { dash: "dash" })
            .line(line, { dash: "dot" })
            .point(focus[0], focus[1], "F", { color: "accent" })
            .scene({
              title: `The focus F, the directrix ${directrixTex(s)} and the line ${w}=${num(given)} that P lies on`,
            }),
        },
      };
    }
    // Is Q on the parabola?
    const { t, dz, on } = m;
    const Qw = f + t,
      Qu = F + dz;
    const Q = toXY(s, Qw, Qu);
    const h = Math.sqrt(t * t + dz * dz);
    const d = Math.abs(Qu - c);
    const at = Math.abs(t),
      along = Math.abs(dz);
    const qf = `$QF=\\sqrt{${at}^2+${along}^2}=${h}$`;
    const drop = (from: number, value: number) =>
      `$|${diff(from, c)}|=${num(value)}$`;
    const verdict = (equal: boolean) => (equal ? "Yes" : "No");
    const close = (equal: boolean) =>
      equal ? "The two are equal." : "The two differ.";
    const options: ChoiceOption[] = [
      {
        label: `${verdict(on)}: ${qf}, and $Q$ is ${drop(Qu, d)} from $${directrixTex(s)}$. ${close(on)}`,
        correct: true,
      },
    ];
    const pool: ChoiceOption[] = [];
    // Drop measured from the focus's level, not from Q.
    const fd = Math.abs(F - c);
    if (fd !== d)
      pool.push({
        label: `${verdict(fd === h)}: ${qf}, and $Q$ is ${drop(F, fd)} from $${directrixTex(s)}$. ${close(fd === h)}`,
        feedback: `This measures the drop from the focus's level, $${num(F)}$, not from $Q$'s, $${num(Qu)}$.`,
      });
    // Distance to the vertex in place of the directrix.
    const qv2 = t * t + (Qu - k) * (Qu - k);
    const qvTex = () =>
      isSquare(qv2) ? num(Math.sqrt(qv2)) : `\\sqrt{${num(qv2)}}`;
    // Only with a whole-number vertex, so the distance stays readable.
    if (Number.isInteger(k) && Math.abs(Math.sqrt(qv2) - d) > 1e-9)
      pool.push({
        label: `${verdict(Math.abs(Math.sqrt(qv2) - h) < 1e-9)}: ${qf}, and $Q$ is $${qvTex()}$ from the vertex $${pt(vertexOf(s))}$.`,
        feedback:
          "The rule compares the distance to the focus with the distance to the directrix line, not to the vertex.",
      });
    // Legs added instead of combined by Pythagoras.
    const sum = at + along;
    pool.push({
      label: `${verdict(sum === d)}: $QF=${at}+${along}=${sum}$, and $Q$ is ${drop(Qu, d)} from $${directrixTex(s)}$. ${close(sum === d)}`,
      feedback: `$QF$ is the hypotenuse of the right triangle with legs $${at}$ and $${along}$: $\\sqrt{${at}^2+${along}^2}=${h}$, not their sum.`,
    });
    const root = at + along;
    const rootTex = isSquare(root) ? num(Math.sqrt(root)) : `\\sqrt{${root}}`;
    pool.push({
      label: `${verdict(false)}: $QF=\\sqrt{${at}+${along}}=${rootTex}$, and $Q$ is ${drop(Qu, d)} from $${directrixTex(s)}$.`,
      feedback: `Square the legs before adding: $QF=\\sqrt{${at}^2+${along}^2}=${h}$.`,
    });
    // Correct verdict, one distance only: incomplete.
    pool.push({
      label: `${verdict(on)}: ${qf}.`,
      feedback: `The verdict needs both distances: $QF$ and the distance from $Q$ to $${directrixTex(s)}$, compared.`,
    });
    if (isSquare(root) && Math.sqrt(root) === d) return null;
    const surface = choiceSurface(r, {
      prompt: `A parabola has ${givens(s)}. Is $Q${pt(Q)}$ on the parabola? Choose the explanation that is correct and complete.`,
      options: [...options, ...shuffle(r, pool)],
      hint: `Draw the right triangle from $Q${pt(Q)}$ to $F${pt(focus)}$ for $QF$. The distance from $Q$ to the line $${directrixTex(s)}$ is a straight ${s.o === "horizontal" ? "vertical" : "horizontal"} drop. Compare the two lengths.`,
      explanation: [
        "A point is on the parabola exactly when its distance to the focus equals its distance to the directrix.",
        `From $Q$ to $F$ the legs are $|${diff(Qw, f)}|=${at}$ and $|${diff(Qu, F)}|=${along}$, so $QF=\\sqrt{${at}^2+${along}^2}=${h}$.`,
        `The distance from $Q$ to the line $${directrixTex(s)}$ is $|${diff(Qu, c)}|=${num(d)}$.`,
        on
          ? `The two distances are equal, so $Q$ is on the parabola.`
          : `$${h}\\ne${num(d)}$, so $Q$ is not on the parabola.`,
        "Adding the legs, measuring the drop from the focus or to the vertex, or stopping after one distance does not test the rule.",
      ],
    });
    if (!surface) return null;
    const foot = toXY(s, Qw, c);
    return {
      ...surface,
      figure: {
        kind: "scene",
        scene: graph(window(...focus, ...Q, c))
          .id("g")
          .line(directrixLine(s), { dash: "dash" })
          .point(focus[0], focus[1], "F", { color: "accent" })
          .point(Q[0], Q[1], "Q")
          .segment(Q, focus, { color: "accent" })
          .segment(Q, foot, { color: "warm" })
          .scene({
            title: `The focus F, the directrix ${directrixTex(s)} and the point Q with its distances to both`,
          }),
      },
    };
  },
});

export const parabolaDerivationGenerate = dispatch(
  parabolaDerivationTemplates,
  {
    "parabola-derive-equation": (seed) => deriveEquation.generate(seed).problem,
    "parabola-derivation-check": (seed) =>
      derivationCheck.generate(seed).problem,
    "parabola-point-equidistance": (seed) =>
      pointEquidistance.generate(seed).problem,
  },
);
