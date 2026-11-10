import {
  axisRecord,
  chooseAxes,
  defineAxis,
  legacyAxes,
  versionGatedAxes,
  type AxisSet,
  type AxisValues,
} from "./variation/axes";
import type { FigureCapability, ProblemVariant } from "./contracts";
import { operationStoryValues } from "./story-kit/operations";

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
  weights?: readonly number[],
) =>
  defineAxis(id, values, {
    legacy,
    ...(needs ? { needs } : {}),
    ...(weights ? { weights } : {}),
  });

/** Story surface. The classic value is silent so a stored instance keeps its
 * variant id. Weights are tuned so book samples vary and the legacy surface
 * still appears often enough to replay. */
const storyWeight = (classic: number) =>
  [classic, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] as const;
/** A story dressing added in template version 2. Below that version the axis
 * stays on `classic`, the sentence the stored page used. */
const storyAxis = (id: string, classicWeight: number) =>
  defineAxis(id, operationStoryValues, {
    legacy: "classic",
    weights: storyWeight(classicWeight),
    silentLegacy: true,
    since: 2,
  });

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
   * difference of two decimals. Tenths of a milliliter stay reachable but
   * rare: that surface is grade-5 rounding. */
  "estimate-reasonableness": {
    operation: axisFor(
      "operation",
      ["total-product-quotient", "decimal-difference"],
      "total-product-quotient",
      undefined,
      [9, 1],
    ),
    telling21: storyAxis("telling21", 8),
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
    display: axisFor(
      "display",
      ["sector-table", "drawn-graph"],
      "sector-table",
      {
        "drawn-graph": "scenes-v2",
      },
    ),
  },
  /** Coins: pictures with the value printed on each (legacy) or drawn
   * without values, known by size, color and edge. */
  "coin-name-and-cent-value": {
    picture: axisFor(
      "picture",
      ["value-printed", "features-only"],
      "value-printed",
      {
        "features-only": "scenes-v2",
      },
    ),
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
  /** Count unit cubes: a rectangular prism (legacy) or a stepped solid.
   * Named cubic units and improvised counts. `cubic-units` is the stored
   * "cubic units" sentence and is silent. */
  "unit-cube-volume": {
    solid: axisFor("solid", ["prism", "steps"], "prism", {
      steps: "scenes-v2",
    }),
    units: {
      ...axisFor(
        "units",
        ["cubic-units", "cm", "in", "ft", "improvised"],
        "cubic-units",
        undefined,
        [4, 1, 1, 1, 1],
      ),
      silentLegacy: true,
      since: 2,
    },
  },
  /** Measure a length: a centimeter strip in halves or quarters (legacy)
   * or an object on an inch ruler in halves, quarters or eighths. */
  "fractional-ruler-length": {
    ruler: axisFor("ruler", ["cm-strip", "inch-ruler"], "cm-strip", {
      "inch-ruler": "scenes-v2",
    }),
  },
  /** Multiplicative comparison: the larger amount is unknown (legacy) or the
   * smaller amount is unknown. The legacy value is silent so a stored
   * instance keeps the variant id it had before this axis existed. */
  "comparison-amount": {
    unknown: {
      ...axisFor("unknown", ["larger", "smaller"], "larger"),
      silentLegacy: true,
      since: 2,
    },
    frame18: storyAxis("frame18", 11),
  },
  /** Remainder stories: totals at most 55 (legacy) or up to 9,999.
   * The legacy value is silent so a stored instance keeps its old variant id.
   * A second silent axis dresses the same model in a real situation. */
  "full-kits": {
    "number-domain": {
      ...axisFor(
        "number-domain",
        ["within-55", "up-to-9999"],
        "within-55",
        undefined,
        [3, 1],
      ),
      silentLegacy: true,
      since: 2,
    },
    story27: storyAxis("story27", 4),
  },
  "seats-needed": {
    "number-domain": {
      ...axisFor(
        "number-domain",
        ["within-55", "up-to-9999"],
        "within-55",
        undefined,
        [3, 1],
      ),
      silentLegacy: true,
      since: 2,
    },
    telling25: storyAxis("telling25", 4),
  },
  "kit-leftovers": {
    "number-domain": {
      ...axisFor(
        "number-domain",
        ["within-55", "up-to-9999"],
        "within-55",
        undefined,
        [3, 1],
      ),
      silentLegacy: true,
      since: 2,
    },
    scene25: storyAxis("scene25", 5),
  },
  /** A point estimate (legacy) or the two whole numbers a quotient lies between.
   * The legacy value is silent so a stored instance keeps its old variant id. */
  "compatible-number-estimate": {
    bounds: {
      ...axisFor("bounds", ["point", "between"], "point", undefined, [4, 1]),
      silentLegacy: true,
      since: 2,
    },
    cast5: storyAxis("cast5", 4),
  },
} as const satisfies Record<string, AxisSet>;

export type SweepId = keyof typeof sweepAxes;
export const isSweepId = (id: string): id is SweepId => id in sweepAxes;
export type SweepAxes<K extends SweepId> = AxisValues<(typeof sweepAxes)[K]>;

let legacyOnly = 0;
/** True while `withLegacySurfaces` is forcing every sweep family onto the
 * surface it had before axes existed. Clause variants honor the same gate. */
export const forcingLegacySurfaces = () => legacyOnly > 0;
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

/**
 * `estimate-reasonableness` changed the weights of an axis that already
 * existed. Stored version 1 still draws that axis with equal weights. The
 * story axis, new in version 2, is forced to classic below that version, and
 * that force is the signal to use the old weights. At version 2 the draw
 * keeps the rare decimal-difference weights.
 */
/** Decimal-difference containers. Not part of `sweepAxes`: version 2 always
 * uses the mixed list, and recording the draw would put the stored list back
 * into some current problems. Version 1 forces `milliliters` (jar, bottle,
 * pitcher) on this axis's own stream. */
const estimateMeasure = defineAxis(
  "measure",
  ["milliliters", "mixed"] as const,
  { legacy: "milliliters", silentLegacy: true, since: 2 },
);

function estimateAxes(seed: string): AxisSet {
  const spec = sweepAxes["estimate-reasonableness"];
  chooseAxes("estimate-reasonableness", seed, {
    telling21: spec.telling21,
    measure: estimateMeasure,
  });
  const stored = versionGatedAxes().some((axis) => axis.id === "telling21");
  if (!stored) return spec;
  return {
    ...spec,
    operation: defineAxis(
      "operation",
      ["total-product-quotient", "decimal-difference"] as const,
      { legacy: "total-product-quotient" },
    ),
  };
}

/** Axis values for one instance, from the axes' own streams (or all legacy
 * inside `withLegacySurfaces`). */
export const sweepChoose = <K extends SweepId>(id: K, seed: string) => {
  if (legacyOnly) return legacyAxes(sweepAxes[id] as AxisSet) as SweepAxes<K>;
  const spec = (
    id === "estimate-reasonableness" ? estimateAxes(seed) : sweepAxes[id]
  ) as AxisSet;
  return chooseAxes(id, seed, spec) as unknown as SweepAxes<K>;
};

/** The private variant record: the family's label and the axis values. */
export const sweepVariant = (
  id: string,
  axes: Readonly<Record<string, string>>,
): ProblemVariant => ({ id, axes: axisRecord(axes) });

/**
 * Variant saved on a sweep instance.
 *
 * A silent legacy axis value is omitted, matching `silentLegacy` in
 * `defineGenerate`. These families stored no variant before the axis
 * existed, so when every axis is that legacy value the instance still has
 * no variant. A newer value is recorded under the family's variant label.
 */
export function recordedSweepVariant(
  templateId: string,
  id: string,
  axes: Readonly<Record<string, string>>,
): ProblemVariant | undefined {
  const spec = isSweepId(templateId)
    ? (sweepAxes[templateId] as Readonly<
        Record<string, { legacy: string; silentLegacy?: boolean }>
      >)
    : undefined;
  const recorded: Record<string, string> = {};
  for (const [key, value] of Object.entries(axes)) {
    const axis = spec?.[key];
    if (axis?.silentLegacy && value === axis.legacy) continue;
    recorded[key] = value;
  }
  if (Object.keys(recorded).length === 0) return undefined;
  return sweepVariant(id, recorded);
}

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
