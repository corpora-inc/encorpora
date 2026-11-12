import { withArticle } from "./agreement";
import type { TemplateMetadata } from "./contracts";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  type ChoiceOption,
} from "./chain-kit";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
  type PartOption,
} from "./multi-part-choice";
import {
  figureOptionIds,
  figureOptionLetters,
  type FigureChoiceResponse,
} from "./figure-choice";
import { selectFamily, selectModel, selectTemplate, st } from "./select-kit";
import { f as fnOf, graph, scene as sceneOf } from "./scene/author";
import type { Element, Scene } from "./scene/spec";
import { defineAxis, type Random } from "./variation/axes";
import {
  cosTwelfths,
  pick,
  piPlain,
  piTex,
  shuffled,
  sinTwelfths,
} from "./unit-circle-extension-kit";

/**
 * HSF.TF.B.6: a trigonometric function on its whole domain repeats, so it
 * has no inverse function; restricting it to an interval on which it is
 * always increasing or always decreasing, and on which it still takes every
 * value of its range, lets the inverse be built. The types choose such an
 * interval (from graphs, from a list, or the convention behind arcsin,
 * arccos and arctan), build and evaluate the inverse of a function
 * restricted to a conventional or a different interval, and justify why the
 * restriction is needed. Interval endpoints are whole multiples of π/2 and
 * every value is exact.
 */

/** A TeX value in prose: a bare whole number stays text (a lone "$0$" reads
 * as money), anything else is set as math. */
const mx = (tex: string) => (/^\d+(\.\d+)?$/.test(tex) ? tex : `$${tex}$`);
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const base = {
  version: 1,
  skillId: "inverse-trigonometry",
  gradeBand: "9–12" as const,
};
export const trigInverseRestrictionTemplates: readonly TemplateMetadata[] = [
  {
    ...base,
    id: "trig-restriction-domain",
    title: "Choose a domain that makes a trigonometric function invertible",
    difficultyOffset: 0.45,
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
    description:
      "Choose an interval, other than the usual one, on which sine, cosine or tangent is always increasing or always decreasing and takes every value of its range, or name the interval that defines arcsin, arccos or arctan. Wrong choices are half a piece, a piece that turns or crosses an asymptote, a full period, and the inverse's own domain.",
  },
  {
    ...base,
    id: "trig-restriction-domain-graph",
    title: "Choose the graph piece that can be inverted",
    difficultyOffset: 0.35,
    requiredResponseCapability: "figure-choice-v1",
    ...scenes,
    description:
      "Four graphs of sine, cosine or tangent each highlight one interval. Choose the piece that is always increasing or always decreasing and takes every value of the function's range, among half a piece, a piece that turns or crosses an asymptote, and a full period.",
  },
  selectTemplate({
    ...base,
    figure: "scenes-v1",
    id: "trig-one-to-one-intervals",
    title: "Intervals on which sine or cosine is one-to-one",
    difficultyOffset: 0.3,
    description:
      "Select every interval on which the graph of sine or cosine is one-to-one, always rising or always falling, among intervals of length $\\pi$ that contain a turning point, a full period, and intervals that turn inside.",
  }),
  {
    ...base,
    id: "restricted-trig-inverse",
    title: "Build and use the inverse of a restricted trigonometric function",
    difficultyOffset: 0.55,
    requiredResponseCapability: "multi-part-choice-v1",
    ...scenes,
    description:
      "For sine, cosine or tangent restricted to a highlighted interval, usually not the conventional one, say whether it increases or decreases, give the domain and range of its inverse, and find the inverse's exact value at a special value. All four parts must be right.",
  },
  {
    ...base,
    id: "trig-inverse-why-restrict",
    title:
      "Why a trigonometric function must be restricted before it is inverted",
    difficultyOffset: 0.45,
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
    description:
      "Choose the correct reason a trigonometric function has no inverse on its whole domain, find the flaw in a claim that arcsin, arccos or arctan has two values, or choose the fact that justifies a step in building an inverse.",
  },
];
const meta = (id: string) =>
  trigInverseRestrictionTemplates.find((t) => t.id === id)!;

/* --------------------------------------------- functions and intervals */

export type Fn = "sin" | "cos" | "tan";
const FNS: readonly Fn[] = ["sin", "cos", "tan"];
export const fnName: Record<Fn, string> = {
  sin: "sine",
  cos: "cosine",
  tan: "tangent",
};
export const arcName: Record<Fn, string> = {
  sin: "\\arcsin",
  cos: "\\arccos",
  tan: "\\arctan",
};
export const evalFn = (fn: Fn, x: number) =>
  fn === "sin" ? Math.sin(x) : fn === "cos" ? Math.cos(x) : Math.tan(x);
const HALF = Math.PI / 2;
/** An interval with endpoints at whole multiples of π/2 (`lo` and `hi`
 * count halves of π). */
export interface Interval {
  lo: number;
  hi: number;
  loOpen: boolean;
  hiOpen: boolean;
}
const closed = (lo: number, hi: number): Interval => ({
  lo,
  hi,
  loOpen: false,
  hiOpen: false,
});
const open = (lo: number, hi: number): Interval => ({
  lo,
  hi,
  loOpen: true,
  hiOpen: true,
});
const endTex = (h: number) => piTex(h, 2);
export const intervalTex = (i: Interval) =>
  `\\left${i.loOpen ? "(" : "["}${endTex(i.lo)}, ${endTex(i.hi)}\\right${i.hiOpen ? ")" : "]"}`;
const intervalWords = (i: Interval) =>
  `from ${piPlain(i.lo, 2)} to ${piPlain(i.hi, 2)}${i.loOpen && i.hiOpen ? ", not including either end" : i.loOpen ? ", not including " + piPlain(i.lo, 2) : i.hiOpen ? ", not including " + piPlain(i.hi, 2) : ""}`;
const sameInterval = (a: Interval, b: Interval) =>
  a.lo === b.lo &&
  a.hi === b.hi &&
  a.loOpen === b.loOpen &&
  a.hiOpen === b.hiOpen;
/** The conventional restriction behind arcsin, arccos and arctan. */
export const CONVENTIONAL: Record<Fn, Interval> = {
  sin: closed(-1, 1),
  cos: closed(0, 2),
  tan: open(-1, 1),
};
/** The k-th interval on which f is monotonic and takes its whole range. */
export function goodInterval(fn: Fn, k: number): Interval {
  if (fn === "sin") return closed(2 * k - 1, 2 * k + 1);
  if (fn === "cos") return closed(2 * k, 2 * k + 2);
  return open(2 * k - 1, 2 * k + 1);
}
/** Half-π units of each function's drawing window. */
const WINDOW: Record<Fn, [number, number]> = {
  sin: [-4, 4],
  cos: [-4, 4],
  tan: [-3, 3],
};
/** Odd multiples of π/2: where tangent is undefined. */
const asymptotesIn = (fn: Fn, i: Interval) =>
  fn !== "tan"
    ? []
    : Array.from({ length: i.hi - i.lo + 1 }, (_, j) => i.lo + j).filter(
        (h) => h % 2 !== 0 && h > i.lo && h < i.hi,
      );
/** Turning points (critical points) strictly inside, in half-π units. */
const turnsIn = (fn: Fn, i: Interval) =>
  fn === "tan"
    ? []
    : Array.from({ length: i.hi - i.lo + 1 }, (_, j) => i.lo + j).filter(
        (h) =>
          h > i.lo && h < i.hi && (fn === "sin" ? h % 2 !== 0 : h % 2 === 0),
      );
/** Exact value of sin or cos at h·π/2 as TeX: "1", "0", "-1". */
const atHalf = (fn: "sin" | "cos", h: number) =>
  (fn === "sin" ? sinTwelfths(6 * h) : cosTwelfths(6 * h)).tex;
/** Rising or falling on a monotonic piece. */
const direction = (fn: Fn, i: Interval): "increasing" | "decreasing" =>
  fn === "tan"
    ? "increasing"
    : evalFn(fn, i.hi * HALF) > evalFn(fn, i.lo * HALF)
      ? "increasing"
      : "decreasing";

/* --------------------------------------------------------- the graph */

const ASPECT: Record<Fn, number> = { sin: 2.8, cos: 2.8, tan: 1.4 };
const YMAX: Record<Fn, number> = { sin: 1.5, cos: 1.5, tan: 3 };
export interface GraphOptions {
  fn: Fn;
  window: [number, number];
  highlight?: Interval;
  /** The dashed horizontal line y = v. */
  level?: { v: number; tex: string };
  /** Marked points (x in radians) with optional labels. */
  marks?: { x: number; label?: string }[];
  /** Label every π/2 (1) or every π (2). */
  every: 1 | 2;
  width: number;
  maxHeight: number;
  title?: string;
  note?: string;
}
/** Sampled points of the highlighted piece, split at asymptotes and kept
 * inside the window, in scene units (y scaled by the aspect). */
function overlayPieces(fn: Fn, i: Interval): [number, number][][] {
  const k = ASPECT[fn],
    ymax = YMAX[fn];
  const cuts = [i.lo, ...asymptotesIn(fn, i), i.hi];
  const pieces: [number, number][][] = [];
  for (let c = 0; c + 1 < cuts.length; c++) {
    const a = cuts[c]! * HALF,
      b = cuts[c + 1]! * HALF;
    const n = 120;
    let piece: [number, number][] = [];
    for (let j = 0; j <= n; j++) {
      const x = a + ((b - a) * j) / n;
      const y = evalFn(fn, x);
      if (!Number.isFinite(y) || Math.abs(y) > ymax) {
        if (piece.length > 1) pieces.push(piece);
        piece = [];
        continue;
      }
      piece.push([Math.round(x * 1e5) / 1e5, Math.round(y * k * 1e5) / 1e5]);
    }
    if (piece.length > 1) pieces.push(piece);
  }
  return pieces;
}
export function trigGraphScene(o: GraphOptions): Scene {
  const { fn } = o;
  const k = ASPECT[fn],
    ymax = YMAX[fn];
  const [w0, w1] = o.window;
  const curveOf = () =>
    fn === "sin"
      ? fnOf.sin(1, 1)
      : fn === "cos"
        ? fnOf.cos(1, 1)
        : fnOf.tan(1, 1);
  let g = graph({
    x: [w0 * HALF, w1 * HALF],
    y: [-ymax, ymax],
    grid: [HALF, fn === "tan" ? 1 : 0.5],
    labels: "none",
    aspect: k,
    axisNames: ["x", "y"],
  }).curve(curveOf(), {
    color: o.highlight ? "muted" : "accent",
    ...(fn === "tan" ? { features: ["asymptotes" as const] } : {}),
  });
  if (o.highlight) {
    const i = o.highlight;
    g = g.curve(curveOf(), {
      domain: [i.lo * HALF, i.hi * HALF],
      ends: [i.loOpen ? "open" : "closed", i.hiOpen ? "open" : "closed"],
      color: "accent",
    });
  }
  if (o.level)
    g = g.line({ m: 0, b: o.level.v }, { dash: "dash", color: "warm" });
  for (const m of o.marks ?? [])
    g = g.point(m.x, o.level?.v ?? 0, m.label, { color: "warm" });
  // The wide band under the highlighted piece goes first, so the curve, its
  // endpoint dots and the marked crossings all draw on top of it.
  const els: Element[] = o.highlight
    ? overlayPieces(fn, o.highlight).map((points, j): Element => ({
        type: "polyline",
        id: `piece${j}`,
        points,
        stroke: "accent",
        width: 7,
        opacity: 0.35,
      }))
    : [];
  els.push(g.id("g").element());
  for (let h = w0; h <= w1; h++) {
    if (h === 0) continue;
    els.push({
      type: "tick",
      id: `xt${h < 0 ? "m" : ""}${Math.abs(h)}`,
      at: [h * HALF, 0],
      dir: [0, 1],
      length: 7,
      stroke: "ink",
    });
    // Labels sit below the window's bottom gridline, where the curve never
    // reaches, so no label hides a piece of the graph or an endpoint dot.
    if (h % o.every === 0)
      els.push({
        type: "text",
        id: `xl${h < 0 ? "m" : ""}${Math.abs(h)}`,
        at: [h * HALF, -ymax * k],
        text: piPlain(h, 2),
        font: "math",
        size: "sm",
        offset: [0, 5],
        align: [0, -1],
      });
  }
  for (const v of [1, -1]) {
    els.push({
      type: "tick",
      id: `yt${v < 0 ? "m" : ""}1`,
      at: [0, v * k],
      dir: [1, 0],
      length: 7,
      stroke: "ink",
    });
    // Likewise left of the window's left edge.
    els.push({
      type: "text",
      id: `yl${v < 0 ? "m" : ""}1`,
      at: [w0 * HALF, v * k],
      text: v < 0 ? "−1" : "1",
      font: "math",
      size: "sm",
      offset: [-5, 0],
      align: [1, 0],
    });
  }
  return sceneOf(...els).build({
    width: o.width,
    maxHeight: o.maxHeight,
    ...(o.title ? { title: o.title } : {}),
    ...(o.note ? { note: o.note } : {}),
  });
}
const MAIN = { width: 420, maxHeight: 320 } as const;
const CARD = { width: 264, maxHeight: 280 } as const;
const graphTitle = (fn: Fn, window: [number, number]) =>
  `Graph of y = ${fn} x for x from ${piPlain(window[0], 2)} to ${piPlain(window[1], 2)}, with gridlines every π/2.`;

/* -------------------------------------------- candidate intervals (A) */

export type PieceKind = "good" | "half" | "turning" | "period";
export interface Piece {
  kind: PieceKind;
  interval: Interval;
}
/** The good interval for k and the three misconception pieces, all inside
 * the function's window. */
export function piecesFor(fn: Fn, k: number): Piece[] {
  const good = goodInterval(fn, k);
  const [w0, w1] = WINDOW[fn];
  let half: Interval, turning: Interval, period: Interval;
  if (fn === "tan") {
    half = { lo: 2 * k, hi: 2 * k + 1, loOpen: false, hiOpen: true };
    turning = 2 * k + 2 <= w1 ? open(2 * k, 2 * k + 2) : open(2 * k - 2, 2 * k);
    period =
      2 * k + 3 <= w1 ? open(2 * k - 1, 2 * k + 3) : open(2 * k - 3, 2 * k + 1);
  } else if (fn === "sin") {
    half = closed(2 * k, 2 * k + 1);
    turning = closed(2 * k, 2 * k + 2);
    period =
      2 * k + 3 <= w1
        ? closed(2 * k - 1, 2 * k + 3)
        : closed(2 * k - 3, 2 * k + 1);
  } else {
    half = closed(2 * k, 2 * k + 1);
    turning =
      2 * k - 1 >= w0
        ? closed(2 * k - 1, 2 * k + 1)
        : closed(2 * k + 1, 2 * k + 3);
    period =
      2 * k + 4 <= w1 ? closed(2 * k, 2 * k + 4) : closed(2 * k - 2, 2 * k + 2);
  }
  return [
    { kind: "good", interval: good },
    { kind: "half", interval: half },
    { kind: "turning", interval: turning },
    { kind: "period", interval: period },
  ];
}
const KS: Record<Fn, readonly number[]> = {
  sin: [-1, 0, 1],
  cos: [-2, -1, 0, 1],
  tan: [-1, 0, 1],
};
/** Values f takes at the ends of a sine or cosine piece, as TeX. */
const ends = (fn: "sin" | "cos", i: Interval) =>
  [atHalf(fn, i.lo), atHalf(fn, i.hi)] as const;
/** Why a piece fails or works, naming its own numbers. */
export function pieceWhy(fn: Fn, p: Piece): string {
  const i = p.interval;
  const I = `${mx(intervalTex(i))}`;
  const name = fnName[fn];
  if (fn === "tan") {
    const asym = asymptotesIn(fn, i)
      .map((h) => `$x = ${endTex(h)}$`)
      .join(" and ");
    switch (p.kind) {
      case "good":
        return `On ${I} tangent is always increasing, and it runs from very negative values near $x = ${endTex(i.lo)}$ to very large values near $x = ${endTex(i.hi)}$. It takes every real number exactly once.`;
      case "half":
        return `On ${I} tangent is always increasing, but it only takes values from 0 upward. The inverse would be undefined at every negative number.`;
      case "turning":
        return `${I} contains ${asym}, where tangent is undefined. Tangent jumps there from very large to very negative values, so it is not always increasing, and it never takes the value 0.`;
      case "period":
        return `${I} contains ${asym}, where tangent is undefined, and the two branches on it take every value twice.`;
    }
  }
  const [a, b] = ends(fn, i);
  const turn = turnsIn(fn, i)
    .map((h) => `$x = ${endTex(h)}$`)
    .join(" and ");
  switch (p.kind) {
    case "good":
      return `On ${I} ${name} is always ${direction(fn, i)}: it runs from ${mx(a)} to ${mx(b)} without turning, so it takes every value from $-1$ to $1$ exactly once.`;
    case "half":
      return `On ${I} ${name} is always ${direction(fn, i)}, but it only runs from ${mx(a)} to ${mx(b)}. The inverse would be undefined for the other half of the range.`;
    case "turning":
      return `On ${I} ${name} turns at ${turn}: it runs from ${mx(a)} to ${mx(atHalf(fn, turnsIn(fn, i)[0]!))} and back to ${mx(b)}, so a horizontal line crosses this piece twice.`;
    case "period":
      return `${I} is a full period: ${name} turns at ${turn} and takes most values twice, so a horizontal line crosses it more than once.`;
  }
}

/* ----------------------------- trig-restriction-domain (choice: A3, A4) */

const restrictionAxis = defineAxis("family", [
  "another-interval",
  "convention",
]);
interface RestrictionModel {
  family: "another-interval" | "convention";
  fn: Fn;
  k: number;
}
const misconception: Record<Exclude<PieceKind, "good">, string> = {
  half: "is half a piece",
  turning: "turns or crosses an asymptote",
  period: "is a full period",
};
export const restrictionFamily = chainFamily({
  template: meta("trig-restriction-domain"),
  axes: { family: restrictionAxis },
  model: (r, axes): RestrictionModel => {
    const fn = pick(r, FNS);
    return {
      family: axes.family,
      fn,
      k: pick(
        r,
        KS[fn].filter((k) => k !== 0),
      ),
    };
  },
  variant: (m) => `${m.family}-${m.fn}`,
  render: (m, _axes, r) => {
    const { fn } = m;
    const name = fnName[fn];
    const figure = {
      kind: "scene" as const,
      scene: trigGraphScene({
        fn,
        window: WINDOW[fn],
        every: fn === "tan" ? 1 : 2,
        ...MAIN,
        title: graphTitle(fn, WINDOW[fn]),
      }),
    };
    if (m.family === "another-interval") {
      const pieces = piecesFor(fn, m.k);
      const good = pieces[0]!;
      const range =
        fn === "tan" ? "every real number" : "every value from $-1$ to $1$";
      const surface = choiceSurface(r, {
        prompt: `The graph shows $y = \\${fn} x$. Which interval could be a restricted domain for ${name}, so that the restricted function has an inverse function defined at ${range}?`,
        options: pieces.map((p): ChoiceOption =>
          p.kind === "good"
            ? { label: `${mx(intervalTex(p.interval))}`, correct: true }
            : {
                label: `${mx(intervalTex(p.interval))}`,
                feedback: `This interval ${misconception[p.kind]}. ${pieceWhy(fn, p)}`,
              },
        ),
        hint: `Slide a horizontal line over the graph of $y = \\${fn} x$ on each interval. On the one you want it never crosses twice, and the piece reaches ${fn === "tan" ? "both very large and very negative values" : "both $y = 1$ and $y = -1$"}.`,
        explanation: [
          `${name[0]!.toUpperCase()}${name.slice(1)} repeats, so on its whole domain many inputs share each output. No inverse function exists until the domain is restricted.`,
          "A restricted domain works when the function is always increasing or always decreasing on it, so no output repeats, and it still takes every value of its range, so the inverse is defined everywhere it should be.",
          pieceWhy(fn, good),
          ...pieces
            .slice(1)
            .map(
              (p) => `${mx(intervalTex(p.interval))} fails: ${pieceWhy(fn, p)}`,
            ),
          `So ${mx(intervalTex(good.interval))} works, even though it is not the usual interval ${mx(intervalTex(CONVENTIONAL[fn]))}.`,
        ],
      });
      return surface ? { ...surface, figure } : null;
    }
    const arc = arcName[fn];
    const conv = CONVENTIONAL[fn];
    const options: ChoiceOption[] =
      fn === "tan"
        ? [
            { label: `${mx(intervalTex(conv))}`, correct: true },
            {
              label: `${mx(intervalTex(closed(-1, 1)))}`,
              feedback:
                "The ends $\\pm\\frac{\\pi}{2}$ are not in tangent's domain: tangent is undefined there. The interval must be open.",
            },
            {
              label: `${mx(intervalTex(closed(0, 4)))}`,
              feedback:
                "This crosses the asymptotes at $\\frac{\\pi}{2}$ and $\\frac{3\\pi}{2}$, where tangent is undefined, and it repeats every value.",
            },
            {
              label: "$(-\\infty, \\infty)$",
              feedback:
                "All real numbers are the domain of $\\arctan$, the inputs it accepts. The restricted domain of tangent is where the outputs of $\\arctan$ come from.",
            },
          ]
        : [
            { label: `${mx(intervalTex(conv))}`, correct: true },
            {
              label: `${mx(intervalTex(CONVENTIONAL[fn === "sin" ? "cos" : "sin"]))}`,
              feedback: `This is the interval for ${mx(arcName[fn === "sin" ? "cos" : "sin"])}. On it ${name} ${fn === "sin" ? "rises and then falls" : "rises and then falls"}, so it is not one-to-one.`,
            },
            {
              label: `${mx(intervalTex(closed(0, 4)))}`,
              feedback: `$[0, 2\\pi]$ is a full period: ${name} takes most values twice on it.`,
            },
            {
              label: "$[-1, 1]$",
              feedback: `$[-1, 1]$ is the domain of ${mx(arc)}, the inputs it accepts. The restricted domain of ${name} is where the outputs of ${mx(arc)} come from.`,
            },
          ];
    const surface = choiceSurface(r, {
      prompt: `The function $${arc} x$ is defined as the inverse of $\\${fn} x$ restricted to which domain?`,
      options,
      hint: `${mx(arc)} must give exactly one angle for each value it accepts. On which choice does the graph of $y = \\${fn} x$ never turn, never break, and still reach every value of ${name}'s range?`,
      explanation: [
        `By convention, ${mx(arc)} undoes ${name} restricted to ${mx(intervalTex(conv))}.`,
        pieceWhy(fn, { kind: "good", interval: conv }),
        `So $${arc} v$ is the one angle in ${mx(intervalTex(conv))} whose ${name} is $v$.`,
        ...options
          .filter((o) => !o.correct)
          .map((o) => `${o.label}: wrong. ${o.feedback}`),
      ],
    });
    return surface ? { ...surface, figure } : null;
  },
});

/* ------------------------- trig-restriction-domain-graph (figure, A1) */

export const graphChoiceFamily = chainFamily({
  template: meta("trig-restriction-domain-graph"),
  axes: { fn: defineAxis("fn", ["sin", "cos", "tan"]) },
  model: (r, axes) => ({ fn: axes.fn as Fn, k: pick(r, KS[axes.fn as Fn]) }),
  variant: (m) => `${m.fn}-${m.k === 0 ? "usual" : "other"}`,
  render: (m, _axes, r) => {
    const { fn, k } = m;
    const name = fnName[fn];
    const cards = shuffled(r, piecesFor(fn, k));
    const label = (p: Piece) =>
      `Graph of y = ${fn} x from ${piPlain(WINDOW[fn][0], 2)} to ${piPlain(WINDOW[fn][1], 2)}, with the piece ${intervalWords(p.interval)} highlighted.`;
    const response: FigureChoiceResponse = {
      kind: "figure-choice",
      label: "Choose the graph",
      noun: "Graph",
      options: cards.map((p, i) => ({
        id: figureOptionIds[i]!,
        label: label(p),
        scene: trigGraphScene({
          fn,
          window: WINDOW[fn],
          highlight: p.interval,
          every: 2,
          ...CARD,
        }),
      })),
    };
    const at = cards.findIndex((p) => p.kind === "good");
    const nameOf = (i: number) => `Graph ${figureOptionLetters[i]}`;
    const choiceFeedback: Record<string, string> = {};
    cards.forEach((p, i) => {
      if (p.kind !== "good")
        choiceFeedback[figureOptionIds[i]!] =
          `${nameOf(i)}'s piece ${misconception[p.kind]}. ${pieceWhy(fn, p)}`;
    });
    return {
      prompt: `Each graph shows $y = \\${fn} x$ with one piece highlighted. Which piece is always increasing or always decreasing and takes every value of ${name}'s range, so it can be used to build an inverse function?`,
      response,
      answer: figureOptionIds[at]!,
      choiceFeedback,
      hint: `Slide a horizontal line up and down each highlighted piece of $y = \\${fn} x$. Does it ever cross the piece twice? Does the piece reach ${fn === "tan" ? "both very large and very negative values" : "both $y = 1$ and $y = -1$"}?`,
      explanation: [
        `${name[0]!.toUpperCase()}${name.slice(1)} repeats, so on its whole domain it has no inverse function. A piece can be inverted when it never turns, so no output repeats, and it reaches every value of the range.`,
        `${nameOf(at)}: ${pieceWhy(fn, cards[at]!)}`,
        ...cards.flatMap((p, i) =>
          p.kind === "good" ? [] : [`${nameOf(i)}: ${pieceWhy(fn, p)}`],
        ),
        `${nameOf(at)} highlights the piece ${mx(intervalTex(cards[at]!.interval))}, which can be used to build the inverse.`,
      ],
    };
  },
});

/* ------------------------------- trig-one-to-one-intervals (select, A2) */

const ONE_TO_ONE: Record<"sin" | "cos", { yes: Interval[]; no: Interval[] }> = {
  sin: {
    yes: [
      closed(-1, 1),
      closed(1, 3),
      closed(0, 1),
      closed(-2, -1),
      closed(-3, -1),
      closed(2, 3),
    ],
    no: [
      closed(0, 2),
      closed(-2, 0),
      closed(0, 4),
      closed(-1, 2),
      closed(2, 4),
      closed(-4, -2),
    ],
  },
  cos: {
    yes: [
      closed(0, 2),
      closed(-2, 0),
      closed(2, 4),
      closed(0, 1),
      closed(1, 2),
      closed(-4, -2),
    ],
    no: [
      closed(-1, 1),
      closed(1, 3),
      closed(0, 4),
      closed(-2, 1),
      closed(-3, -1),
      closed(-4, 0),
    ],
  },
};
export const oneToOneFamily = selectFamily(
  meta("trig-one-to-one-intervals"),
  (r) => {
    const fn = pick(r, ["sin", "cos"] as const);
    const k = r(2, 3);
    const name = fnName[fn];
    const why = (i: Interval, yes: boolean) => {
      const [a, b] = ends(fn, i);
      if (yes)
        return `There is no turning point inside: ${name} only ${direction(fn, i) === "increasing" ? "rises" : "falls"}, from ${mx(a)} to ${mx(b)}, so no output repeats.`;
      const turns = turnsIn(fn, i);
      return `${name[0]!.toUpperCase()}${name.slice(1)} turns at ${turns.map((h) => `$x = ${endTex(h)}$`).join(" and ")}, inside the interval, so some outputs repeat.`;
    };
    const set = ONE_TO_ONE[fn];
    return selectModel({
      variant: `${fn}-${k}`,
      pool: [
        ...set.yes.map((i) => st(`${mx(intervalTex(i))}`, true, why(i, true))),
        ...set.no.map((i) => st(`${mx(intervalTex(i))}`, false, why(i, false))),
      ],
      total: 6,
      k,
      one: "interval",
      context: `The graph shows $y = \\${fn} x$.`,
      ask: (n) =>
        `On which ${n} of these intervals is ${name} one-to-one, always increasing or always decreasing?`,
      hint: `On the graph of $y = \\${fn} x$, find where it turns: its highest and lowest points. Exactly ${k} of the intervals have no turning point strictly inside them.`,
      figure: {
        kind: "scene",
        scene: trigGraphScene({
          fn,
          window: WINDOW[fn],
          every: 2,
          ...MAIN,
          title: graphTitle(fn, WINDOW[fn]),
        }),
      },
      lead: [
        "A function is one-to-one on an interval when no two inputs there give the same output. That happens when it is always increasing or always decreasing there.",
        `${name[0]!.toUpperCase()}${name.slice(1)} turns only at its highest and lowest points, at $x = ${fn === "sin" ? "\\frac{\\pi}{2}" : "0"}$ and every $\\pi$ from there. So an interval works exactly when no such point lies strictly inside it.`,
      ],
    });
  },
);

/* --------------------------------------- restricted-trig-inverse (B) */

type Special = { tex: string; value: number; t: number };
const SIN_VALUES: readonly Special[] = [
  { tex: "-1", value: -1, t: -6 },
  { tex: "-\\frac{\\sqrt{3}}{2}", value: -Math.sqrt(3) / 2, t: -4 },
  { tex: "-\\frac{\\sqrt{2}}{2}", value: -Math.SQRT2 / 2, t: -3 },
  { tex: "-\\frac{1}{2}", value: -0.5, t: -2 },
  { tex: "0", value: 0, t: 0 },
  { tex: "\\frac{1}{2}", value: 0.5, t: 2 },
  { tex: "\\frac{\\sqrt{2}}{2}", value: Math.SQRT2 / 2, t: 3 },
  { tex: "\\frac{\\sqrt{3}}{2}", value: Math.sqrt(3) / 2, t: 4 },
  { tex: "1", value: 1, t: 6 },
];
const TAN_VALUES: readonly Special[] = [
  { tex: "-\\sqrt{3}", value: -Math.sqrt(3), t: -4 },
  { tex: "-1", value: -1, t: -3 },
  { tex: "-\\frac{\\sqrt{3}}{3}", value: -Math.sqrt(3) / 3, t: -2 },
  { tex: "0", value: 0, t: 0 },
  { tex: "\\frac{\\sqrt{3}}{3}", value: Math.sqrt(3) / 3, t: 2 },
  { tex: "1", value: 1, t: 3 },
  { tex: "\\sqrt{3}", value: Math.sqrt(3), t: 4 },
];
/** The conventional inverse value arcf(v), in twelfths of π. */
export const principal = (fn: Fn, v: Special) => (fn === "cos" ? 6 - v.t : v.t);
/** The one x in D = goodInterval(fn, k) with f(x) = v, in twelfths of π. */
export function solutionIn(fn: Fn, k: number, v: Special): number {
  const t0 = principal(fn, v);
  if (fn === "tan" || k % 2 === 0) return t0 + 12 * k;
  return fn === "sin" ? 12 - t0 + 12 * (k - 1) : 24 - t0 + 12 * (k - 1);
}
/** Every solution of f(x) = v in [0, 2π), in twelfths of π. */
export function solutionsOnTurn(fn: Fn, v: Special): number[] {
  const t0 = principal(fn, v);
  const m = (t: number) => ((t % 24) + 24) % 24;
  const raw =
    fn === "sin" ? [t0, 12 - t0] : fn === "cos" ? [t0, -t0] : [t0, t0 + 12];
  return [...new Set(raw.map(m))].sort((a, b) => a - b);
}
const tw = (t: number) => piTex(t, 12);
/** A special value's TeX as figure text: "\\frac{\\sqrt{3}}{2}" → "√3/2". */
const plainTex = (tex: string) =>
  tex
    .replace(/\\frac\{([^}]*)\}\{(\d+)\}/, "$1/$2")
    .replace(/\\sqrt\{(\d)\}/g, "√$1")
    .replace("-", "−");
const negTex = (tex: string) =>
  tex === "0" ? "0" : tex.startsWith("-") ? tex.slice(1) : `-${tex}`;
const valuesOf = (fn: Fn) => (fn === "tan" ? TAN_VALUES : SIN_VALUES);
const B_KS: Record<Fn, readonly number[]> = {
  sin: [-1, 0, 1, 2],
  cos: [-1, 0, 1],
  tan: [-1, 1],
};
const fnAxis = defineAxis("fn", ["sin", "cos", "tan"], { weights: [2, 2, 1] });
const branchAxis = defineAxis("branch", ["usual", "other"], {
  weights: [3, 7],
});
interface InverseModel {
  fn: Fn;
  k: number;
  v: Special;
  x: number;
  wrong: { t: number; why: string }[];
}
export const inverseFamily = chainFamily({
  template: meta("restricted-trig-inverse"),
  axes: { fn: fnAxis, branch: branchAxis },
  model: (r, axes): InverseModel => {
    const fn = axes.fn as Fn;
    const ks = B_KS[fn].filter((k) =>
      axes.branch === "usual" ? k === 0 : k !== 0,
    );
    // Tangent has no usual branch among its drawn choices; it keeps k ≠ 0.
    const k = pick(r, ks.length ? ks : B_KS[fn]);
    const values = valuesOf(fn).filter(
      (v) => k !== 0 || (v.value !== 0 && Math.abs(v.value) !== 1),
    );
    const v = pick(r, values);
    const x = solutionIn(fn, k, v);
    const t0 = principal(fn, v);
    const candidates: { t: number; why: string }[] = [];
    if (k !== 0)
      candidates.push({
        t: t0,
        why: `is $${arcName[fn]} ${v.tex}$, the value for the usual interval ${mx(intervalTex(CONVENTIONAL[fn]))}. Here the restriction is $D$, so the answer must lie in $D$`,
      });
    for (const s of solutionsOnTurn(fn, v))
      candidates.push({
        t: s,
        why: `solves $\\${fn} x = ${v.tex}$ but is not in $D$`,
      });
    const shift = pick(r, [24, -24]);
    candidates.push({
      t: x + shift,
      why: `differs from the answer by a full turn, so it has the same ${fnName[fn]}, but it is not in $D$, the range of the inverse`,
    });
    // cos(−x) = v and, when v = 0, sin(−x) = tan(−x) = 0 = v: then −x is
    // another solution, outside D. Otherwise f(−x) = −v ≠ v.
    const solves = fn === "cos" || v.value === 0;
    candidates.push({
      t: -x,
      why: solves
        ? `is the opposite of the answer; it also solves $\\${fn} x = ${v.tex}$ but is not in $D$`
        : `is the opposite of the answer: $\\${fn}\\left(${tw(-x)}\\right) = ${negTex(v.tex)}$, not ${mx(v.tex)}`,
    });
    const seen = new Set([x]);
    const wrong = candidates.filter((c) => {
      if (seen.has(c.t)) return false;
      seen.add(c.t);
      return true;
    });
    if (wrong.length < 3 || (k !== 0 && t0 === x))
      throw new Error("Need three retry: inverse distractors");
    return { fn, k, v, x, wrong: wrong.slice(0, 3) };
  },
  variant: (m) => `${m.fn}-${m.k === 0 ? "usual" : "other"}`,
  render: (m, _axes, r) => {
    const { fn, k, v, x } = m;
    const name = fnName[fn];
    const D = goodInterval(fn, k);
    const Dt = intervalTex(D);
    const dir = direction(fn, D);
    const window: [number, number] =
      fn === "tan" ? WINDOW.tan : D.hi > 4 ? [-3, 5] : [-4, 4];
    const range =
      fn === "tan"
        ? { tex: "(-\\infty, \\infty)", words: "every real number" }
        : { tex: "[-1, 1]", words: "every value from $-1$ to $1$" };
    const conv = CONVENTIONAL[fn];
    const rangeWrong = sameInterval(conv, D)
      ? CONVENTIONAL[fn === "sin" ? "cos" : "sin"]
      : conv;
    const parts = <T extends { label: string; correct?: true }>(items: T[]) => {
      const order = shuffled(r, items);
      const options: PartOption[] = order.map((o, i) => ({
        id: "abcdef"[i]!,
        label: o.label,
      }));
      return {
        options,
        key: options[order.findIndex((o) => o.correct)]!.id,
      };
    };
    const p1 = parts([
      {
        label: "increasing",
        ...(dir === "increasing" ? { correct: true as const } : {}),
      },
      {
        label: "decreasing",
        ...(dir === "decreasing" ? { correct: true as const } : {}),
      },
      { label: "neither increasing nor decreasing" },
    ]);
    const windowTex = `\\left[${endTex(window[0])}, ${endTex(window[1])}\\right]`;
    const p2 = parts([
      { label: `${mx(range.tex)}`, correct: true as const },
      { label: `${mx(Dt)}` },
      { label: fn === "tan" ? "$[0, \\infty)$" : "$[0, 1]$" },
      { label: `${mx(windowTex)}` },
    ]);
    const p3 = parts([
      { label: `${mx(Dt)}`, correct: true as const },
      { label: `${mx(intervalTex(rangeWrong))}` },
      { label: `${mx(range.tex)}` },
      { label: "$[0, 2\\pi)$" },
    ]);
    const p4 = parts([
      { label: `${mx(tw(x))}`, correct: true as const },
      ...m.wrong.map((w) => ({ label: `${mx(tw(w.t))}` })),
    ]);
    const vArg =
      v.tex.startsWith("-") || v.tex.includes("frac") || v.tex.includes("sqrt")
        ? `\\left(${v.tex}\\right)`
        : `(${v.tex})`;
    const response: MultiPartChoiceResponse = {
      kind: "multi-part-choice",
      label: "Choose an option for each part",
      layout: "slots",
      blanks: [
        { id: "trend", label: "On $D$, $g$ is", options: p1.options },
        { id: "domain", label: "Domain of $g^{-1}$", options: p2.options },
        { id: "range", label: "Range of $g^{-1}$", options: p3.options },
        { id: "value", label: `$g^{-1}${vArg}$`, options: p4.options },
      ],
    };
    // Crossings of y = v inside the window, in twelfths.
    const crossings: number[] = [];
    for (let t = window[0] * 6; t <= window[1] * 6; t++) {
      const y = evalFn(fn, (t * Math.PI) / 12);
      if (Number.isFinite(y) && Math.abs(y - v.value) < 1e-9) crossings.push(t);
    }
    const lo = fn === "tan" ? null : ends(fn as "sin" | "cos", D);
    const t0 = principal(fn, v);
    const sols = solutionsOnTurn(fn, v);
    return {
      prompt: `Let $g(x) = \\${fn} x$ for $x$ in $D = ${Dt}$ only. The graph shows $y = \\${fn} x$ with $D$ highlighted and the dashed line $y = ${v.tex}$. The inverse function $g^{-1}$ sends each output of $g$ back to its input. Complete each statement.`,
      response,
      answer: serializeMultiPart(response, {
        trend: p1.key,
        domain: p2.key,
        range: p3.key,
        value: p4.key,
      }),
      hint: `The inverse can only give back inputs in $D = ${Dt}$. Find every $x$ with $\\${fn} x = ${v.tex}$, then keep the one inside $D$.`,
      explanation: [
        fn === "tan"
          ? `On $D$ the graph only rises, from very negative values near $x = ${endTex(D.lo)}$ to very large values near $x = ${endTex(D.hi)}$, so $g$ is increasing and one-to-one. That is what lets us define $g^{-1}$.`
          : `On $D$ the graph only ${dir === "increasing" ? "rises" : "falls"}: $\\${fn}\\left(${endTex(D.lo)}\\right) = ${lo![0]}$ and $\\${fn}\\left(${endTex(D.hi)}\\right) = ${lo![1]}$. So $g$ is ${dir} and one-to-one, which is what lets us define $g^{-1}$.`,
        `$g^{-1}$ reverses $g$: its domain is the range of $g$, ${mx(range.tex)}, and its range is the domain of $g$, $D = ${Dt}$.`,
        `$g^{-1}\\left(${v.tex}\\right)$ is the one $x$ in $D$ with $\\${fn} x = ${v.tex}$. The usual value is $${arcName[fn]} ${v.tex} = ${tw(t0)}$. On one turn, $[0, 2\\pi)$, the solutions are ${sols.map((s) => `${mx(tw(s))}`).join(" and ")}; adding or taking away ${fn === "tan" ? "multiples of $\\pi$" : "full turns of $2\\pi$"} gives the rest. Only ${mx(tw(x))} lies in $D$.`,
        `Check: $\\${fn}\\left(${tw(x)}\\right) = ${v.tex}$ and ${mx(tw(x))} is in ${mx(Dt)}.`,
        ...m.wrong.map((w) => `${mx(tw(w.t))} ${w.why}.`),
        k === 0
          ? `Here $D$ is the usual interval, so $g^{-1}$ is ${mx(arcName[fn])} itself.`
          : `Note: $${arcName[fn]} ${v.tex} = ${tw(t0)}$ answers the usual restriction ${mx(intervalTex(conv))}. With the restriction $D$ the answer is different.`,
        `Wrong choices for the domain and range: ${mx(Dt)} and ${mx(range.tex)} swap the domain and range; ${fn === "tan" ? "$[0, \\infty)$" : "$[0, 1]$"} is only part of the range; ${mx(windowTex)} is just the drawing window; ${mx(intervalTex(rangeWrong))} is ${sameInterval(conv, D) ? "another function's usual interval" : "the usual interval, not this restriction"}; $[0, 2\\pi)$ is one turn, on which ${name} repeats values.`,
      ],
      figure: {
        kind: "scene" as const,
        scene: trigGraphScene({
          fn,
          window,
          highlight: D,
          level: { v: v.value, tex: plainTex(v.tex) },
          marks: crossings.map((t) => ({ x: (t * Math.PI) / 12 })),
          every: fn === "tan" ? 1 : 2,
          ...MAIN,
          title: graphTitle(fn, window),
          note: `The piece ${intervalWords(D)} is highlighted; on it the graph ${dir === "increasing" ? "rises" : "falls"}. A dashed horizontal line marks y = ${plainTex(v.tex)}, with dots where it crosses the graph.`,
        }),
      },
    };
  },
});

/* -------------------------------- trig-inverse-why-restrict (C1–C3) */

export type Tag =
  | "correct"
  | "range-not-invertibility"
  | "vertical-line-test"
  | "onto-vs-one-to-one"
  | "wrong-conventional-interval"
  | "multivalued-inverse"
  | "denies-true-fact"
  | "shorter-than-period"
  | "increasing-reversed"
  | "gaps-not-the-reason"
  | "undefined-endpoints";
type Tagged = ChoiceOption & { tag: Tag };
const whyAxis = defineAxis("family", [
  "no-inverse",
  "two-values",
  "justify-step",
]);
interface WhyModel {
  family: "no-inverse" | "two-values" | "justify-step";
  fn: Fn;
  v: Special;
  shift: boolean;
  step: "one-to-one" | "domain";
  interval: Interval;
}
/** Positive values with two inputs per turn (1 is a single peak for sine
 * and cosine, but not for tangent). */
const POSITIVE = (fn: Fn) =>
  valuesOf(fn).filter((v) => v.value > 0 && (fn === "tan" || v.value !== 1));
/** A second input with the same output as arcf(v), in twelfths. */
const partner = (fn: Fn, t0: number) =>
  fn === "sin" ? 12 - t0 : fn === "cos" ? -t0 : t0 + 12;
/** Everything a why-restrict problem shows, before its options are
 * shuffled: the options carry their misconception tags. */
export function whyParts(m: WhyModel) {
  {
    const { fn, v } = m;
    const name = fnName[fn];
    const Name = `${name[0]!.toUpperCase()}${name.slice(1)}`;
    const t0 = principal(fn, v);
    const b = m.family === "two-values" && m.shift ? t0 + 24 : partner(fn, t0);
    const window = WINDOW[fn];
    let options: Tagged[] = [];
    let prompt = "";
    let hint = "";
    let explanation: string[] = [];
    let highlight: Interval | undefined;
    let marks: { x: number; label?: string }[] = [];
    if (m.family === "no-inverse") {
      prompt = `${
        fn === "tan"
          ? "Why does $y = \\tan x$, on its whole domain (every real number except the odd multiples of $\\frac{\\pi}{2}$), not have an inverse function?"
          : `Why does $y = \\${fn} x$, with every real number as its domain, not have an inverse function?`
      } In the graph, the dashed line $y = ${v.tex}$ crosses the curve at $a = ${tw(t0)}$ and at $b = ${tw(b)}$.`;
      options = [
        {
          label: `Inputs share outputs: $\\${fn} a = \\${fn} b$ with $a \\ne b$, so a reverse would send one output to two inputs.`,
          correct: true,
          tag: "correct",
        },
        fn === "tan"
          ? {
              label:
                "Its outputs can be any real number, so there are too many to reverse.",
              feedback:
                "A function with every real number as output can still have an inverse; $y = x^3$ does. What matters is whether outputs repeat.",
              tag: "range-not-invertibility",
            }
          : {
              label: "Its outputs are only between $-1$ and $1$.",
              feedback:
                "A limited range only limits the inputs the inverse accepts. What matters is whether outputs repeat.",
              tag: "range-not-invertibility",
            },
        {
          label:
            "It is increasing on some intervals, so it cannot be reversed.",
          feedback:
            "Being increasing is what makes reversing possible: an always-increasing function never repeats an output.",
          tag: "increasing-reversed",
        },
        fn === "tan"
          ? {
              label:
                "It is undefined at $x = \\frac{\\pi}{2}$, and a function with gaps never has an inverse.",
              feedback:
                "Gaps do not stop an inverse: tangent on $\\left(-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right)$ has one. The trouble is that values repeat.",
              tag: "gaps-not-the-reason",
            }
          : {
              label: "It is not defined for every real number.",
              feedback: `${Name} is defined for every real number. The trouble is that its values repeat.`,
              tag: "denies-true-fact",
            },
      ];
      hint = `Look at the dashed line $y = ${v.tex}$ on the graph. How many inputs give that one output, and what would an inverse have to send ${mx(v.tex)} to?`;
      marks = [
        { x: (t0 * Math.PI) / 12, label: "a" },
        { x: (b * Math.PI) / 12, label: "b" },
      ];
      explanation = [
        "An inverse function must send each output back to exactly one input. That is possible only if no two inputs share an output.",
        `${Name} repeats: the dashed line $y = ${v.tex}$ crosses the graph at $a = ${tw(t0)}$ and at $b = ${tw(b)}$, and at many more points.`,
        `A reverse of ${name} would have to send ${mx(v.tex)} to $a$ and to $b$ at once, which is not a function.`,
        `So the domain must be restricted to an interval where ${name} never repeats an output, such as ${mx(intervalTex(CONVENTIONAL[fn]))}, the interval behind ${mx(arcName[fn])}.`,
        ...options
          .filter((o) => !o.correct)
          .map((o) => `${o.label.replace(/\.$/, "")}: wrong. ${o.feedback}`),
      ];
    } else if (m.family === "two-values") {
      const arc = arcName[fn];
      const conv = CONVENTIONAL[fn];
      const other = CONVENTIONAL[fn === "sin" ? "cos" : "sin"];
      const arg = (t: number) =>
        tw(t).startsWith("-") ? `\\left(${tw(t)}\\right)` : tw(t);
      prompt = `A student writes: “$\\${fn} a = \\${fn} b = v$, where $a = ${tw(t0)}$, $b = ${tw(b)}$ and $v = ${v.tex}$. Therefore $${arc} v$ equals both $a$ and $b$.” Which statement identifies the flaw?`;
      options = [
        {
          label: `${mx(arc)} inverts ${name} on ${mx(intervalTex(conv))}; $b$ is outside it, so $${arc} v = a$ only.`,
          correct: true,
          tag: "correct",
        },
        {
          label: `$\\${fn} b$ is not actually equal to $v$.`,
          feedback: `It is: $\\${fn}${arg(b)} = ${v.tex}$. The flaw is not the arithmetic.`,
          tag: "denies-true-fact",
        },
        {
          label: "There is no flaw: an inverse can have two outputs.",
          feedback:
            "An inverse function gives exactly one output for each input. That is why the restriction is needed.",
          tag: "multivalued-inverse",
        },
        m.shift
          ? {
              label: `$${arc} v = b$, not $a$, because the larger angle is the inverse's value.`,
              feedback: `The value must lie in ${mx(intervalTex(conv))}; ${mx(tw(b))} is a full turn past ${mx(tw(t0))} and outside it.`,
              tag: "wrong-conventional-interval",
            }
          : fn === "tan"
            ? {
                label: `$${arc} v = b$, not $a$, because $b$ is positive.`,
                feedback: `Both are positive. The value must lie in ${mx(intervalTex(conv))}, and ${mx(tw(b))} does not.`,
                tag: "wrong-conventional-interval",
              }
            : {
                label: `$${arc} v = b$, not $a$, because $b$ is in ${mx(intervalTex(other))}.`,
                feedback: `${mx(intervalTex(other))} is the interval for ${mx(arcName[fn === "sin" ? "cos" : "sin"])}. The interval for ${mx(arc)} is ${mx(intervalTex(conv))}.`,
                tag: "wrong-conventional-interval",
              },
      ];
      hint = `Which interval is ${mx(arc)} built on? Check whether ${mx(tw(t0))} and ${mx(tw(b))} lie in it.`;
      marks = [
        { x: (t0 * Math.PI) / 12, label: "a" },
        ...(Math.abs(b) <= Math.abs(window[1]) * 6
          ? [{ x: (b * Math.PI) / 12, label: "b" }]
          : []),
      ];
      explanation = [
        "An inverse function gives exactly one output for each input.",
        `Both equations are true: the dashed line $y = ${v.tex}$ crosses the graph at ${mx(tw(t0))} and at ${mx(tw(b))}.`,
        `But ${mx(arc)} is the inverse of ${name} restricted to ${mx(intervalTex(conv))}, where ${name} is one-to-one. Its value is the one input in that interval: $${arc} ${v.tex} = ${tw(t0)}$. The number ${mx(tw(b))} is outside it.`,
        ...options
          .filter((o) => !o.correct)
          .map((o) => `${o.label.replace(/\.$/, "")}: wrong. ${o.feedback}`),
      ];
    } else {
      const I = m.interval;
      highlight = I;
      const It = intervalTex(I);
      const usual = sameInterval(I, CONVENTIONAL[fn]);
      const dir = direction(fn, I);
      const sym = `$\\${fn} x$`;
      const range = fn === "tan" ? "(-\\infty, \\infty)" : "[-1, 1]";
      const fromTo =
        fn === "tan"
          ? "every real number"
          : `every value from ${mx(ends(fn, I)[0])} to ${mx(ends(fn, I)[1])}`;
      const monotone: Tagged = {
        label: `${sym} is ${dir} on $I$: if $a < b$ in $I$, then $\\${fn} ${withArticle(dir === "increasing" ? "<" : ">")} \\${fn} b$, so no output repeats.`,
        tag: "correct",
      };
      const onto: Tagged = {
        label: `${sym} takes ${fromTo} on $I$.`,
        tag: "onto-vs-one-to-one",
      };
      const vertical: Tagged = {
        label: `${sym} passes the vertical line test on $I$.`,
        feedback:
          m.step === "one-to-one"
            ? "Every function passes the vertical line test. One-to-one needs the horizontal line test: no horizontal line crosses twice."
            : "Every function passes the vertical line test. It says nothing about which outputs are reached.",
        tag: "vertical-line-test",
      };
      const fourth: Tagged =
        fn === "tan"
          ? {
              label: `${sym} is defined at both ends of $I$.`,
              feedback: `Tangent is undefined at both ends, ${mx(endTex(I.lo))} and ${mx(endTex(I.hi))}; that is why the interval is open.`,
              tag: "undefined-endpoints",
            }
          : {
              label: `$I$ is shorter than one period of ${sym}, which is $2\\pi$.`,
              feedback:
                m.step === "one-to-one"
                  ? `Being shorter than a period does not prevent repeats: ${name} on ${mx(intervalTex(fn === "sin" ? closed(0, 2) : closed(-1, 1)))} is also shorter than $2\\pi$, but it is not one-to-one.`
                  : `Being shorter than a period says nothing about which values are reached: ${name} on ${mx(intervalTex(closed(0, 1)))} is shorter than $2\\pi$ and reaches only the values from ${mx(ends(fn, closed(0, 1))[0])} to ${mx(ends(fn, closed(0, 1))[1])}.`,
              tag: "shorter-than-period",
            };
      const build = usual
        ? `To build ${mx(arcName[fn])}, we restrict ${sym} to $I = ${It}$.`
        : `To build an inverse, we restrict ${sym} to $I = ${It}$.`;
      if (m.step === "one-to-one") {
        prompt = `${build} One step says: “On $I$, ${sym} is one-to-one.” Which fact justifies this step?`;
        options = [
          { ...monotone, correct: true },
          {
            ...onto,
            feedback: `True, but taking every value says nothing about repeats: ${fn === "tan" ? "on two neighboring branches tangent takes every value too, each one twice" : `on a full period ${name} takes every value too, most of them twice`}. It justifies the inverse's domain, not one-to-one.`,
          },
          vertical,
          fourth,
        ];
        hint = `One-to-one means no two inputs in ${mx(It)} give the same output. Which fact rules out a repeat for ${sym}?`;
      } else {
        prompt = `${build} One step says: “So the inverse has domain ${mx(range)}.” Which fact justifies this step?`;
        options = [
          {
            ...onto,
            label: `${sym} takes ${fromTo} on $I$, so every number in ${mx(range)} is an output.`,
            correct: true,
            tag: "correct",
          },
          {
            ...monotone,
            label: `${sym} is ${dir} on $I$, so no two inputs there share an output.`,
            feedback:
              "True, but that justifies one-to-one. The inverse's domain is the set of outputs, so the step needs which values are reached.",
            tag: "onto-vs-one-to-one",
          },
          vertical,
          fourth,
        ];
        hint = `The inverse accepts exactly the outputs of ${sym} on ${mx(It)}. Which fact says which outputs those are?`;
      }
      explanation = [
        "An inverse needs two things from the restricted function: no output repeats (one-to-one), and its outputs are the inverse's domain.",
        fn === "tan"
          ? `On ${mx(It)} tangent is always increasing, from very negative values near $x = ${endTex(I.lo)}$ to very large values near $x = ${endTex(I.hi)}$. So no output repeats, and every real number is an output.`
          : `On ${mx(It)} ${name} is always ${dir}, from $\\${fn}\\left(${endTex(I.lo)}\\right) = ${ends(fn, I)[0]}$ to $\\${fn}\\left(${endTex(I.hi)}\\right) = ${ends(fn, I)[1]}$. So no output repeats, and every value from $-1$ to $1$ is an output.`,
        m.step === "one-to-one"
          ? "The step claims one-to-one, so its reason must rule out repeats: always increasing or always decreasing does."
          : `The step claims the inverse's domain, ${mx(range)}, so its reason must say which outputs are reached.`,
        ...options
          .filter((o) => !o.correct)
          .map((o) => `${o.label.replace(/\.$/, "")}: wrong. ${o.feedback}`),
      ];
    }
    return { prompt, options, hint, explanation, highlight, marks, window };
  }
}
export const whyFamily = chainFamily({
  template: meta("trig-inverse-why-restrict"),
  axes: { family: whyAxis },
  model: (r, axes): WhyModel => {
    const fn = pick(r, FNS);
    const conventional = r(0, 9) < 6;
    const k = conventional
      ? 0
      : pick(
          r,
          KS[fn].filter((x) => x !== 0),
        );
    return {
      family: axes.family,
      fn,
      v: pick(r, POSITIVE(fn)),
      shift: r(0, 9) < 3,
      step: r(0, 1) ? "one-to-one" : "domain",
      interval: goodInterval(fn, k),
    };
  },
  variant: (m) =>
    m.family === "justify-step"
      ? `${m.family}-${m.step}-${m.fn}`
      : `${m.family}-${m.fn}`,
  render: (m, _axes, r) => {
    const { fn, v } = m;
    const { prompt, options, hint, explanation, highlight, marks, window } =
      whyParts(m);
    const surface = choiceSurface(r, {
      prompt,
      options,
      hint,
      explanation,
    });
    if (!surface) return null;
    const level = m.family === "justify-step" ? undefined : v;
    const plainV = plainTex(v.tex);
    return {
      ...surface,
      figure: {
        kind: "scene" as const,
        scene: trigGraphScene({
          fn,
          window,
          every: fn === "tan" ? 1 : 2,
          ...(highlight ? { highlight } : {}),
          ...(level ? { level: { v: level.value, tex: plainV } } : {}),
          marks,
          ...MAIN,
          title: graphTitle(fn, window),
          ...(highlight
            ? {
                note: `The piece ${intervalWords(highlight)} is highlighted.`,
              }
            : {
                note: `A dashed horizontal line marks y = ${plainV}; the points a and b mark two places where it crosses the graph.`,
              }),
        }),
      },
    };
  },
});

/* ------------------------------------------------------------ dispatch */

export const trigInverseRestrictionGenerate = dispatch(
  trigInverseRestrictionTemplates,
  {
    "trig-restriction-domain": (seed) =>
      restrictionFamily.generate(seed).problem,
    "trig-restriction-domain-graph": (seed) =>
      graphChoiceFamily.generate(seed).problem,
    "trig-one-to-one-intervals": (seed) =>
      oneToOneFamily.generate(seed).problem,
    "restricted-trig-inverse": (seed) => inverseFamily.generate(seed).problem,
    "trig-inverse-why-restrict": (seed) => whyFamily.generate(seed).problem,
  },
);
