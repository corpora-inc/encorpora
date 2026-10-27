import {
  axisRecord,
  chooseAxes,
  defineAxis,
  legacyAxes,
  type AxisSet,
  type AxisValues,
} from "./variation/axes";
import type { FigureCapability, ProblemVariant } from "./contracts";

/**
 * Number-domain and surface axes for grade K-8 families whose released-item
 * gaps were only a different number domain (fractions, decimals, signs, a
 * rounded result) or a different form of the same task.
 *
 * Every axis lists the surface the family showed before the axis existed as
 * its `legacy` value, which reproduces the old output byte for byte (the
 * values draw from their own hash streams, never from the content stream).
 * `tests/number-domain-sweep.test.ts` freezes digests of the old output.
 */
const axisFor = <const V extends string>(
  id: string,
  values: readonly V[],
  legacy: NoInfer<V>,
  needs?: Partial<Record<NoInfer<V>, FigureCapability>>,
) => defineAxis(id, values, { legacy, ...(needs ? { needs } : {}) });

export const sweepAxes = {
  /** Scale a ratio: the target quantity is a whole multiple of the ratio's
   * second term (legacy) or not, so the scale factor and answer are decimals. */
  "ratio-missing": {
    "scale-factor": axisFor("scale-factor", ["whole", "decimal"], "whole"),
  },
  /** Geometric sequences: multiply by a whole ratio (legacy), divide by a
   * whole number each time, or state a unit-fraction common ratio. */
  "geometric-sequence": {
    "ratio-form": axisFor(
      "ratio-form",
      ["multiply-whole", "divide-whole", "unit-fraction"],
      "multiply-whole",
    ),
  },
  /** Divide decimals: positive (legacy) or with one negative operand. */
  "multidigit-decimal-quotient": {
    sign: axisFor(
      "sign",
      ["positive", "negative-dividend", "negative-divisor", "both-negative"],
      "positive",
    ),
  },
  /** Choose the table for a rule: add or multiply (legacy) or subtract. */
  "staar-table-rule-choice": {
    rule: axisFor("rule", ["add-or-multiply", "subtract"], "add-or-multiply"),
  },
  /** Rename between forms: the legacy four forms, or a hundredths decimal
   * written as a fraction in lowest terms. */
  "staar-rename-percent-fraction-decimal": {
    direction: axisFor(
      "direction",
      ["to-decimal-or-percent", "decimal-to-fraction"],
      "to-decimal-or-percent",
    ),
  },
  /** Circle area as a multiple of pi (legacy) or numeric with pi = 3.14. */
  "circle-area-coefficient": {
    "pi-form": axisFor(
      "pi-form",
      ["multiple-of-pi", "pi-3-14"],
      "multiple-of-pi",
    ),
  },
  /** Degrees in a turn: equal angles drawn around a point (legacy) or an
   * angle stated as a fraction of the full circle. */
  "turn-degrees": {
    "turn-form": axisFor(
      "turn-form",
      ["drawn-parts", "fraction-of-circle"],
      "drawn-parts",
    ),
  },
  /** Estimation by rounding: totals, products and quotients (legacy) or the
   * difference of two decimals. */
  "estimate-reasonableness": {
    operation: axisFor(
      "operation",
      ["total-product-quotient", "decimal-difference"],
      "total-product-quotient",
    ),
  },
  /** Equivalent expressions: integer coefficients (legacy) or a fractional
   * factor distributed over a binomial. */
  "equivalent-expressions-check": {
    coefficients: axisFor(
      "coefficients",
      ["integers", "fractional-factor"],
      "integers",
    ),
  },
  /** Direct variation: whole-number values (legacy) or mixed-number inputs
   * with a fractional constant of variation. */
  "variation-constant": {
    values: axisFor("values", ["whole", "fractional"], "whole"),
  },
  /** Hypotenuse of perpendicular legs: a scaled integer triple (legacy) or
   * legs whose hypotenuse is irrational and is rounded as the task says. */
  "right-triangle": {
    hypotenuse: axisFor(
      "hypotenuse",
      ["integer-triple", "nearest-whole", "nearest-tenth"],
      "integer-triple",
    ),
  },
  /** Exact distance between plotted points (legacy) or a decimal distance
   * rounded as the prompt says. */
  "coordinate-distance-exact": {
    "answer-form": axisFor(
      "answer-form",
      ["exact", "nearest-tenth", "nearest-hundredth"],
      "exact",
    ),
  },
  /** Missing leg: integer triple lengths (legacy) or lengths given to the
   * tenth with the leg rounded to the nearest tenth. */
  "right-triangle-missing-leg": {
    lengths: axisFor(
      "lengths",
      ["integer-triple", "tenths-nearest-tenth"],
      "integer-triple",
    ),
  },
  /* Figure surfaces: the same model drawn with a scene component instead of
   * described in words or a table. A value that needs a capability the
   * template does not declare shows its legacy surface to a client without
   * it. */
  /** Circle graph: the table of its sectors (legacy) or the drawn graph
   * with each sector labeled. */
  "circle-graph-read": {
    display: axisFor("display", ["sector-table", "drawn-graph"], "sector-table", {
      "drawn-graph": "scenes-v2",
    }),
  },
  /** Coins: pictures with the value printed on each (legacy) or drawn
   * without values, known by size, color and edge. */
  "coin-name-and-cent-value": {
    picture: axisFor("picture", ["value-printed", "features-only"], "value-printed", {
      "features-only": "scenes-v2",
    }),
  },
  /** Five prisms: edge lengths in words (legacy) or each drawn as unit
   * cubes to count. */
  "mcas-prism-range-select": {
    prisms: axisFor("prisms", ["edge-lengths", "unit-cubes"], "edge-lengths", {
      "unit-cubes": "scenes-v1",
    }),
  },
  /** A prism of fractional cubes: edge lengths stated (legacy) or the prism
   * drawn as cubes with one cube's edge given. */
  "mcas-cube-prism-statements": {
    prism: axisFor("prism", ["stated-edges", "drawn-cubes"], "stated-edges", {
      "drawn-cubes": "scenes-v1",
    }),
  },
  /** Count unit cubes: a rectangular prism (legacy) or a stepped solid. */
  "unit-cube-volume": {
    solid: axisFor("solid", ["prism", "steps"], "prism", {
      steps: "scenes-v2",
    }),
  },
  /** Measure a length: a centimeter strip in halves or quarters (legacy)
   * or an object on an inch ruler in halves, quarters or eighths. */
  "fractional-ruler-length": {
    ruler: axisFor("ruler", ["cm-strip", "inch-ruler"], "cm-strip", {
      "inch-ruler": "scenes-v2",
    }),
  },
} as const satisfies Record<string, AxisSet>;

export type SweepId = keyof typeof sweepAxes;
export const isSweepId = (id: string): id is SweepId => id in sweepAxes;
export type SweepAxes<K extends SweepId> = AxisValues<(typeof sweepAxes)[K]>;

let legacyOnly = 0;
/**
 * Run `build` with every sweep family on its legacy surface. Published
 * editions are built this way: a given edition keeps the exact problems it
 * had before the axes existed (legacy axis values reproduce them byte for
 * byte), instead of re-selecting around the new surfaces. Synchronous only.
 */
export function withLegacySurfaces<T>(build: () => T): T {
  legacyOnly++;
  try {
    return build();
  } finally {
    legacyOnly--;
  }
}

/** Axis values for one instance, from the axes' own streams (or all legacy
 * inside `withLegacySurfaces`). */
export const sweepChoose = <K extends SweepId>(id: K, seed: string) =>
  (legacyOnly
    ? legacyAxes(sweepAxes[id] as AxisSet)
    : chooseAxes(id, seed, sweepAxes[id] as AxisSet)) as unknown as SweepAxes<K>;

/** The private variant record: the family's label and the axis values. */
export const sweepVariant = (
  id: string,
  axes: Readonly<Record<string, string>>,
): ProblemVariant => ({ id, axes: axisRecord(axes) });

/** Exact decimal text of n/d when it terminates within six places. */
export function exactDecimal(n: number, d: number): string {
  for (let places = 0; places <= 6; places++) {
    const scaled = (n * 10 ** places) / d;
    if (Number.isInteger(scaled)) {
      const sign = scaled < 0 ? "-" : "";
      const digits = String(Math.abs(scaled)).padStart(places + 1, "0");
      return places
        ? `${sign}${digits.slice(0, -places)}.${digits.slice(-places)}`
        : `${sign}${digits}`;
    }
  }
  throw new Error(`${n}/${d} does not terminate within six places`);
}

/**
 * Nearest integer to the square root of the integer `m`, with the exact
 * comparison a learner can follow: l = floor(sqrt(m)) and the midpoint
 * l + 1/2 decide, because (l + 1/2)^2 = l^2 + l + 1/4 is never an integer.
 */
export function nearestRoot(m: number): { lower: number; nearest: number } {
  if (!Number.isSafeInteger(m) || m < 1)
    throw new Error("Need a positive integer");
  let lower = Math.floor(Math.sqrt(m));
  while (lower * lower > m) lower--;
  while ((lower + 1) * (lower + 1) <= m) lower++;
  if (lower * lower === m) throw new Error(`${m} is a perfect square`);
  return { lower, nearest: m > lower * lower + lower ? lower + 1 : lower };
}
export const isPerfectSquare = (m: number): boolean =>
  Number.isInteger(Math.sqrt(m));

/**
 * Round the square root of an integer radicand to `places` decimal places and
 * explain it: the two candidates the root lies between, and the midpoint test.
 * `name` is the quantity's letter or word, written into the sentences.
 */
export function roundedRoot(
  radicand: number,
  places: 0 | 1 | 2,
  name: string,
): { answer: string; steps: string[]; unitWord: string } {
  const unit = 10 ** places;
  const { lower, nearest } = nearestRoot(radicand * unit * unit);
  const low = exactDecimal(lower, unit),
    high = exactDecimal(lower + 1, unit),
    mid = exactDecimal(2 * lower + 1, 2 * unit),
    midSquare = exactDecimal((2 * lower + 1) ** 2, 4 * unit * unit);
  const up = radicand * 4 * unit * unit > (2 * lower + 1) ** 2;
  const unitWord = ["whole number", "tenth", "hundredth"][places]!;
  const answer = exactDecimal(nearest, unit);
  return {
    answer,
    unitWord,
    steps: [
      `${radicand} is not a perfect square. $${low}^2 \\le ${radicand} < ${high}^2$, so ${name} is between ${low} and ${high}.`,
      `The midpoint is ${mid}, and $${mid}^2 = ${midSquare}$. Since ${radicand} is ${up ? "greater" : "less"} than ${midSquare}, ${name} is ${up ? "above" : "below"} ${mid}.`,
      `To the nearest ${unitWord}, ${name} is ${answer}.`,
    ],
  };
}
