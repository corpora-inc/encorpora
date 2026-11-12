import { withArticle } from "./agreement";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { selectFamily, selectModel, selectTemplate, st } from "./select-kit";
import { defineAxis, type Random } from "./variation/axes";
import type { Statement } from "./variation/statement-set";

/**
 * HSN.Q.A.3: choose a level of accuracy appropriate to limitations on
 * measurement when reporting quantities.
 *
 * Every problem states its convention. A reading to the nearest u is within
 * u/2 of the true value; carrying that window through a calculation gives a
 * range [lo, hi], and the result is reported to the place value of the first
 * nonzero digit of hi − lo. Generation keeps only seeds where that place
 * equals the significant-figure rule (products, quotients and exact
 * conversions) or the decimal-place rule (sums and differences), where the
 * calculator value is not a rounding tie, and where the report needs no
 * placeholder zeros, so learners taught either rule get the same answer.
 * Options are text, never typed numbers: 58.3 and 58.30 differ here.
 */

export const measurementPrecisionTemplates: readonly TemplateMetadata[] = [
  {
    id: "justified-report-from-measurements",
    version: 1,
    title: "Report a computed quantity to the accuracy of its measurements",
    skillId: "units-and-precision",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    description:
      "Choose the report of a converted, summed, subtracted, multiplied or divided measurement that keeps exactly the accuracy the readings support, against the calculator display, one digit too many, a trailing zero, or an arithmetic slip. The rule for carrying each reading's range is stated.",
    requiredResponseCapability: "single-choice-v1",
    glossaryNoLink: ["place", "display", "step"],
  },
  selectTemplate({
    id: "measurement-report-meaning",
    title: "What a reported measurement does and does not tell you",
    skillId: "units-and-precision",
    gradeBand: "9–12",
    difficultyOffset: 0.2,
    description:
      "Select the justified statements about a tool's reading (its range of true values, a possible true value, exactness, a trailing zero) or about a written report (the place it was rounded to, its range, which display could have produced it).",
    glossaryNoLink: ["place", "display", "step"],
  }),
  {
    id: "precision-report-critique",
    version: 1,
    title: "Find the flaw in a reported measurement",
    skillId: "units-and-precision",
    gradeBand: "9–12",
    difficultyOffset: 0.5,
    description:
      "Choose the correct and complete critique of a report that keeps the calculator's digits after a product, throws away accuracy the tool gave, keeps the finer reading's decimals in a sum, or adds a trailing zero.",
    requiredResponseCapability: "single-choice-v1",
    glossaryNoLink: ["place", "display", "step"],
  },
];

/* --------------------------------------------------------- precision */

const EPS = 1e-9;
/** Decimal places of a resolution such as 0.01 (2) or 10 (0). */
export const placesOf = (u: number) => (String(u).split(".")[1] ?? "").length;
/** Exponent of the place value of a positive number's first nonzero digit. */
export const leadExponent = (v: number) => Math.floor(Math.log10(v) + EPS);
/** v rounded to the place 10^e, half up; text with the matching decimals. */
export function roundText(v: number, e: number): string {
  const dp = Math.max(0, -e);
  const n = Math.floor(v / 10 ** e + 0.5 + EPS);
  return e >= 0 ? String(n * 10 ** e) : (n / 10 ** dp).toFixed(dp);
}
/** True when v sits exactly halfway between two values at the place 10^e. */
export const isTie = (v: number, e: number) => {
  const x = v / 10 ** e;
  return Math.abs(x - Math.floor(x) - 0.5) < 1e-7;
};
/** The calculator display: six decimals, or the exact value when it is
 * shorter (trailing zeros dropped only then). */
export const display = (v: number) => {
  const six = v.toFixed(6);
  return Math.abs(v - Number(six)) < 1e-11
    ? six.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
    : six;
};
const decimals = (text: string) => (text.split(".")[1] ?? "").length;
/** Significant digits of a reading taken to the nearest u. */
export function sigFigs(value: number, u: number): number {
  return leadExponent(value) - Math.round(Math.log10(u)) + 1;
}
/** A reading to the nearest u: a multiple of u whose last digit is not 0. */
function reading(r: Random, lo: number, hi: number, u: number): number {
  const steps = r(Math.ceil(lo / u - EPS), Math.floor(hi / u + EPS));
  if (steps % 10 === 0) throw new Error("Need three retry: trailing zero");
  return Number((steps * u).toFixed(placesOf(u)));
}
const fixed = (v: number, u: number) => v.toFixed(placesOf(u));

export interface Precision {
  central: number;
  lo: number;
  hi: number;
  /** Exponent of the report's place value. */
  e: number;
  report: string;
  shown: string;
}
/** The interval rule, checked against the classroom rule. */
export function precisionOf(
  central: number,
  lo: number,
  hi: number,
  ruleExponent: number,
  /** The report names its place in words ("to the nearest 10 g"), so
   * placeholder zeros are not ambiguous. */
  placeStated = false,
): Precision {
  const e = leadExponent(hi - lo);
  if (e !== ruleExponent) throw new Error("Need three retry: rules disagree");
  if (e >= 1 && !placeStated)
    throw new Error("Need three retry: placeholder zeros");
  if (isTie(central, e)) throw new Error("Need three retry: tie");
  const report = roundText(central, e);
  // A whole-number report ending in 0 reads as a placeholder zero.
  if (e >= 0 && report.endsWith("0") && !placeStated)
    throw new Error("Need three retry: ambiguous zero");
  if (report !== roundText((lo + hi) / 2, e))
    throw new Error("Need three retry: midpoint rounds differently");
  if (leadExponent(Number(report)) > leadExponent(central))
    throw new Error("Need three retry: rounding gains a digit");
  const shown = display(central);
  if (decimals(shown) - Math.max(0, -e) < 2)
    throw new Error("Need three retry: nothing to decide");
  return { central, lo, hi, e, report, shown };
}
/** The significant-figure rule's place for a result with `sf` figures. */
const sigFigExponent = (v: number, sf: number) => leadExponent(v) - sf + 1;

/* ------------------------------------------- justified report (Type 1) */

type Kind = "convert" | "combine" | "product";
interface ReportModel {
  kind: Kind;
  context: string;
  /** Givens and the calculation, ending with the calculator display. */
  setup: string;
  quantity: string;
  unit: string;
  p: Precision;
  /** Each reading's window, in words, for the explanation. */
  windows: string[];
  carry: string;
  slip?: { value: number; feedback: string };
  readings: { text: string; half: string }[];
  rule: "sig-figs" | "decimal-places";
}

interface Conversion {
  id: string;
  from: string;
  to: string;
  lo: number;
  hi: number;
  u: number;
  factor: number;
  multiply: boolean;
  quantity: string;
  text: (m: string, shown: string) => string;
}
const conversions: Conversion[] = [
  {
    id: "cm-in",
    from: "cm",
    to: "in",
    lo: 90,
    hi: 250,
    u: 1,
    factor: 2.54,
    multiply: false,
    quantity: "table's length",
    text: (m, s) =>
      `A tape measure gives a table's length as $${m}$ cm, to the nearest centimeter. To change it to inches, Maya divides by $2.54$, the exact number of centimeters in an inch, and her calculator shows $${s}$.`,
  },
  {
    id: "in-cm",
    from: "in",
    to: "cm",
    lo: 24,
    hi: 240,
    u: 1,
    factor: 2.54,
    multiply: true,
    quantity: "board's length",
    text: (m, s) =>
      `A tape measure gives a board's length as $${m}$ in, to the nearest inch. To change it to centimeters, Leo multiplies by $2.54$, the exact number of centimeters in an inch, and his calculator shows $${s}$.`,
  },
  {
    id: "mi-km",
    from: "mi",
    to: "km",
    lo: 12,
    hi: 480,
    u: 0.1,
    factor: 1.609344,
    multiply: true,
    quantity: "drive's length",
    text: (m, s) =>
      `A car's trip meter shows a drive of $${m}$ mi, to the nearest tenth of a mile. To change it to kilometers, Ana multiplies by $1.609344$, the exact number of kilometers in a mile, and her calculator shows $${s}$.`,
  },
  {
    id: "km-mi",
    from: "km",
    to: "mi",
    lo: 10,
    hi: 16,
    u: 0.1,
    factor: 1.609344,
    multiply: false,
    quantity: "route's length",
    text: (m, s) =>
      `A running watch records a route of $${m}$ km, to the nearest tenth of a kilometer. To change it to miles, Sam divides by $1.609344$, the exact number of kilometers in a mile, and the calculator shows $${s}$.`,
  },
  {
    id: "lb-kg",
    from: "lb",
    to: "kg",
    lo: 90,
    hi: 260,
    u: 1,
    factor: 0.45359237,
    multiply: true,
    quantity: "mass",
    text: (m, s) =>
      `A bathroom scale shows Omar's mass as $${m}$ lb, to the nearest pound. To change it to kilograms, he multiplies by $0.45359237$, the exact number of kilograms in a pound, and his calculator shows $${s}$.`,
  },
  {
    id: "kg-lb",
    from: "kg",
    to: "lb",
    lo: 40,
    hi: 120,
    u: 0.1,
    factor: 0.45359237,
    multiply: false,
    quantity: "crate's mass",
    text: (m, s) =>
      `A floor scale shows a crate's mass as $${m}$ kg, to the nearest tenth of a kilogram. To change it to pounds, Mia divides by $0.45359237$, the exact number of kilograms in a pound, and her calculator shows $${s}$.`,
  },
  {
    id: "gal-l",
    from: "gal",
    to: "L",
    lo: 8,
    hi: 60,
    u: 0.1,
    factor: 3.785411784,
    multiply: true,
    quantity: "volume",
    text: (m, s) =>
      `A pump shows $${m}$ gal of water, to the nearest tenth of a gallon. To change it to liters, Kai multiplies by $3.785411784$, the exact number of liters in a US gallon, and his calculator shows $${s}$.`,
  },
  {
    id: "ft-m",
    from: "ft",
    to: "m",
    lo: 10,
    hi: 30,
    u: 0.1,
    factor: 0.3048,
    multiply: true,
    quantity: "room's length",
    text: (m, s) =>
      `A laser measure gives a room's length as $${m}$ ft, to the nearest tenth of a foot. To change it to meters, Ines multiplies by $0.3048$, the exact number of meters in a foot, and her calculator shows $${s}$.`,
  },
];

function convertModel(r: Random): ReportModel {
  const c = pick(r, conversions);
  const m = reading(r, c.lo, c.hi, c.u);
  const op = (v: number) => (c.multiply ? v * c.factor : v / c.factor);
  const central = op(m);
  const lo = op(m - c.u / 2),
    hi = op(m + c.u / 2);
  const sf = sigFigs(m, c.u);
  const p = precisionOf(central, lo, hi, sigFigExponent(central, sf));
  const slipValue = c.multiply ? m / c.factor : m * c.factor;
  const mText = fixed(m, c.u);
  const half = fixed(c.u / 2, c.u / 10);
  return {
    kind: "convert",
    context: c.id,
    setup: c.text(mText, p.shown),
    quantity: c.quantity,
    unit: c.to,
    p,
    readings: [
      {
        text: `${mText}\\ \\text{${c.from}}`,
        half: `${half}\\ \\text{${c.from}}`,
      },
    ],
    windows: [
      `a reading to the nearest $${fixed(c.u, c.u)}$ ${c.from} means the true value is anywhere from $${fixed(m - c.u / 2, c.u / 10)}$ to $${fixed(m + c.u / 2, c.u / 10)}$ ${c.from}: a window, not a point.`,
    ],
    carry: `${c.multiply ? "Multiply" : "Divide"} both ends by $${c.factor}$`,
    rule: "sig-figs",
    slip: {
      value: slipValue,
      feedback: `This ${c.multiply ? "divides" : "multiplies"} by $${c.factor}$ instead of ${c.multiply ? "multiplying" : "dividing"}: the conversion is upside down.`,
    },
  };
}

interface Combine {
  id: string;
  quantity: string;
  unit: string;
  /** Reading a (unit, step) and reading b (its own unit and step). */
  a: { lo: number; hi: number; u: number; unit: string };
  b: { lo: number; hi: number; u: number; unit: string; scale: number };
  subtract: boolean;
  text: (a: string, b: string, shown: string) => string;
  slip?: "units" | "sign";
}
const combines: Combine[] = [
  {
    id: "pack-mass",
    quantity: "total mass",
    unit: "kg",
    a: { lo: 5, hi: 12, u: 0.1, unit: "kg" },
    b: { lo: 150, hi: 900, u: 1, unit: "g", scale: 0.001 },
    subtract: false,
    slip: "units",
    text: (a, b, s) =>
      `A backpack weighs $${a}$ kg on a scale that reads to the nearest tenth of a kilogram. A lunch bag weighs $${b}$ g on a kitchen scale that reads to the nearest gram. Jo changes the grams to kilograms, adds, and gets $${s}$ kg.`,
  },
  {
    id: "rope-length",
    quantity: "total length",
    unit: "m",
    a: { lo: 3, hi: 9.9, u: 0.1, unit: "m" },
    b: { lo: 120, hi: 900, u: 1, unit: "mm", scale: 0.001 },
    subtract: false,
    slip: "units",
    text: (a, b, s) =>
      `A rope measures $${a}$ m with a tape marked in tenths of a meter. A second piece measures $${b}$ mm with a ruler marked in millimeters. Lee changes the millimeters to meters, adds, and gets $${s}$ m.`,
  },
  {
    id: "board-difference",
    quantity: "difference in length",
    unit: "m",
    a: { lo: 1.5, hi: 3, u: 0.1, unit: "m" },
    b: { lo: 600, hi: 1400, u: 1, unit: "mm", scale: 0.001 },
    subtract: true,
    slip: "sign",
    text: (a, b, s) =>
      `A board measures $${a}$ m with a tape marked in tenths of a meter. A shelf measures $${b}$ mm with a ruler marked in millimeters. Rosa changes the millimeters to meters and subtracts to find how much longer the board is: $${s}$ m.`,
  },
  {
    id: "relay-time",
    quantity: "total time",
    unit: "s",
    a: { lo: 12, hi: 60, u: 0.1, unit: "s" },
    b: { lo: 10, hi: 60, u: 0.001, unit: "s", scale: 1 },
    subtract: false,
    text: (a, b, s) =>
      `A hand stopwatch times the first leg of a relay as $${a}$ s, to the nearest tenth of a second. An electronic timer times the second leg as $${b}$ s, to the nearest thousandth. Their sum is $${s}$ s.`,
  },
];

function combineModel(r: Random): ReportModel {
  const c = pick(r, combines);
  const a = reading(r, c.a.lo, c.a.hi, c.a.u);
  const b = reading(r, c.b.lo, c.b.hi, c.b.u);
  const bb = Number((b * c.b.scale).toFixed(placesOf(c.b.u * c.b.scale)));
  const ha = c.a.u / 2,
    hb = (c.b.u * c.b.scale) / 2;
  const central = c.subtract ? a - bb : a + bb;
  if (central < 0.3) throw new Error("Need three retry: too close");
  const lo = c.subtract ? a - ha - (bb + hb) : a - ha + (bb - hb);
  const hi = c.subtract ? a + ha - (bb - hb) : a + ha + (bb + hb);
  const coarsest = Math.max(c.a.u, c.b.u * c.b.scale);
  const p = precisionOf(central, lo, hi, leadExponent(coarsest));
  const aText = fixed(a, c.a.u),
    bText = fixed(b, c.b.u);
  const slip =
    c.slip === "units"
      ? {
          value: a + b,
          feedback: `This adds $${aText}$ ${c.a.unit} and $${bText}$ ${c.b.unit} as if they had the same unit. Change $${bText}$ ${c.b.unit} to ${c.unit === "kg" ? "kilograms" : "meters"} first.`,
        }
      : c.slip === "sign"
        ? {
            value: a + bb,
            feedback:
              "This adds the two lengths. How much longer one length is than another is their difference.",
          }
        : undefined;
  return {
    kind: "combine",
    context: c.id,
    setup: c.text(aText, bText, p.shown),
    quantity: c.quantity,
    unit: c.unit,
    p,
    readings: [
      {
        text: `${aText}\\ \\text{${c.a.unit}}`,
        half: `${fixed(ha, c.a.u / 10)}\\ \\text{${c.a.unit}}`,
      },
      {
        text: `${bText}\\ \\text{${c.b.unit}}`,
        half: `${fixed(c.b.u / 2, c.b.u / 10)}\\ \\text{${c.b.unit}}`,
      },
    ],
    windows: [
      `$${aText}$ ${c.a.unit} could be off by up to $${fixed(ha, c.a.u / 10)}$ ${c.a.unit}, and $${bText}$ ${c.b.unit} by up to $${fixed(c.b.u / 2, c.b.u / 10)}$ ${c.b.unit}, which is $${fixed(hb, (c.b.u * c.b.scale) / 10)}$ ${c.unit}.`,
    ],
    carry: `In ${withArticle(c.subtract ? "difference" : "sum")} the half-widths add: the result could be off by up to $${fixed(ha + hb, (c.b.u * c.b.scale) / 10)}$ ${c.unit}`,
    rule: "decimal-places",
    ...(slip ? { slip } : {}),
  };
}

interface ProductContext {
  id: string;
  quantity: string;
  unit: string;
  a: { lo: number; hi: number; u: number; unit: string };
  b: { lo: number; hi: number; u: number; unit: string };
  divide: boolean;
  range: [number, number];
  text: (a: string, b: string, shown: string) => string;
  slip: (a: number, b: number) => number;
  slipFeedback: string;
}
const products: ProductContext[] = [
  {
    id: "garden-area",
    quantity: "area",
    unit: "m^2",
    a: { lo: 1.2, hi: 9.9, u: 0.1, unit: "m" },
    b: { lo: 1.2, hi: 9.9, u: 0.1, unit: "m" },
    divide: false,
    range: [1, 99],
    text: (a, b, s) =>
      `A garden bed measures $${a}$ m by $${b}$ m with a tape marked in tenths of a meter. Its area on a calculator is $${a}\\times${b}=${s}$ square meters.`,
    slip: (a, b) => 2 * (a + b),
    slipFeedback:
      "This is the perimeter, the distance around the bed, not its area. The area is the product of the two sides.",
  },
  {
    id: "cart-speed",
    quantity: "speed",
    unit: "m/s",
    a: { lo: 25, hi: 400, u: 1, unit: "m" },
    b: { lo: 4, hi: 90, u: 0.1, unit: "s" },
    divide: true,
    range: [1, 40],
    text: (a, b, s) =>
      `A cyclist covers $${a}$ m, measured to the nearest meter, in $${b}$ s, timed to the nearest tenth of a second. Speed is distance divided by time, and the calculator shows $${s}$ meters per second.`,
    slip: (a, b) => b / a,
    slipFeedback:
      "This divides the time by the distance. Speed is distance divided by time.",
  },
  {
    id: "density",
    quantity: "density",
    unit: "g/mL",
    a: { lo: 20, hi: 900, u: 1, unit: "g" },
    b: { lo: 10, hi: 400, u: 1, unit: "mL" },
    divide: true,
    range: [0.2, 20],
    text: (a, b, s) =>
      `A stone has a mass of $${a}$ g, to the nearest gram, and a volume of $${b}$ mL, to the nearest milliliter. Density is mass divided by volume, and the calculator shows $${s}$ grams per milliliter.`,
    slip: (a, b) => b / a,
    slipFeedback:
      "This divides the volume by the mass. Density is mass divided by volume.",
  },
  {
    id: "fuel-economy",
    quantity: "fuel economy",
    unit: "mi/gal",
    a: { lo: 120, hi: 480, u: 1, unit: "mi" },
    b: { lo: 4, hi: 18, u: 0.1, unit: "gal" },
    divide: true,
    range: [8, 60],
    text: (a, b, s) =>
      `A car goes $${a}$ mi, to the nearest mile, on $${b}$ gal of fuel, to the nearest tenth of a gallon. Fuel economy is miles divided by gallons, and the calculator shows $${s}$ miles per gallon.`,
    slip: (a, b) => b / a,
    slipFeedback:
      "This divides the gallons by the miles. Miles per gallon is miles divided by gallons.",
  },
];

function productModel(r: Random): ReportModel {
  const c = pick(r, products);
  const a = reading(r, c.a.lo, c.a.hi, c.a.u);
  const b = reading(r, c.b.lo, c.b.hi, c.b.u);
  const ha = c.a.u / 2,
    hb = c.b.u / 2;
  const central = c.divide ? a / b : a * b;
  if (central < c.range[0] || central > c.range[1])
    throw new Error("Need three retry: out of range");
  const lo = c.divide ? (a - ha) / (b + hb) : (a - ha) * (b - hb);
  const hi = c.divide ? (a + ha) / (b - hb) : (a + ha) * (b + hb);
  const sf = Math.min(sigFigs(a, c.a.u), sigFigs(b, c.b.u));
  const p = precisionOf(central, lo, hi, sigFigExponent(central, sf));
  const aText = fixed(a, c.a.u),
    bText = fixed(b, c.b.u);
  return {
    kind: "product",
    context: c.id,
    setup: c.text(aText, bText, p.shown),
    quantity: c.quantity,
    unit: c.unit,
    p,
    readings: [
      {
        text: `${aText}\\ \\text{${c.a.unit}}`,
        half: `${fixed(ha, c.a.u / 10)}\\ \\text{${c.a.unit}}`,
      },
      {
        text: `${bText}\\ \\text{${c.b.unit}}`,
        half: `${fixed(hb, c.b.u / 10)}\\ \\text{${c.b.unit}}`,
      },
    ],
    windows: [
      `$${aText}$ ${c.a.unit} could be anywhere from $${fixed(a - ha, c.a.u / 10)}$ to $${fixed(a + ha, c.a.u / 10)}$, and $${bText}$ ${c.b.unit} from $${fixed(b - hb, c.b.u / 10)}$ to $${fixed(b + hb, c.b.u / 10)}$.`,
    ],
    carry: c.divide
      ? "The smallest result divides the smallest top value by the largest bottom value, and the largest result the reverse"
      : "The smallest area uses both smallest sides and the largest area both largest sides",
    rule: "sig-figs",
    slip: { value: c.slip(a, b), feedback: c.slipFeedback },
  };
}

const unitText = (u: string) =>
  u === "m^2" ? "\\ \\text{m}^2" : `\\ \\text{${u}}`;
const opt = (v: string, unit: string) => `$${v}${unitText(unit)}$`;
const placeName = (e: number) =>
  ({ 0: "ones", [-1]: "tenths", [-2]: "hundredths", [-3]: "thousandths" })[e] ??
  `$10^{${e}}$`;
/** lo/hi/width shown with two more decimals than the report. */
const shownBound = (v: number, e: number) => v.toFixed(Math.max(0, -e) + 2);

const RULE =
  "Use this rule: a reading to the nearest step is within half a step of the true value, and a result is reported to the place value of the first nonzero digit of the width of its range of possible values.";

const reportAxis = defineAxis(
  "variant",
  ["convert", "combine", "product"] as const,
  { weights: [1, 1, 1] },
);

function reportCase(m: ReportModel, r: Random) {
  const { p } = m;
  const finer = roundText(p.central, p.e - 1);
  const zero = `${p.report}${p.report.includes(".") ? "0" : ".0"}`;
  const width = p.hi - p.lo;
  const widthText = shownBound(width, p.e);
  if (leadExponent(Number(widthText)) !== p.e)
    throw new Error("Need three retry: shown width misleads");
  const useSlip = m.slip !== undefined && r(0, 1) === 1;
  const slipText = m.slip ? roundText(Math.abs(m.slip.value), p.e) : "";
  const options: ChoiceOption[] = [
    { label: opt(p.report, m.unit), correct: true },
    {
      label: opt(p.shown, m.unit),
      feedback: `This copies the calculator. The readings only fix the result to within a range $${widthText}$ wide, so the digits after the ${placeName(p.e)} place are not supported.`,
    },
    {
      label: opt(finer, m.unit),
      feedback: `This keeps one digit too many. The range is $${widthText}$ wide, so even the ${placeName(p.e)} digit is uncertain and the next place is not known at all.`,
    },
    useSlip
      ? {
          label: opt(slipText, m.unit),
          feedback: `${m.slip!.feedback} The right value is about $${p.report}$.`,
        }
      : {
          label: opt(zero, m.unit),
          feedback: `A zero on the end is a claim: $${zero}$ says the next place is known to be 0, but the readings do not fix that place.`,
        },
  ];
  if (new Set(options.map((o) => o.label)).size < 4)
    throw new Error("Need three retry: options collide");
  if (useSlip && slipText === p.report)
    throw new Error("Need three retry: slip equals report");
  const first = m.readings[0]!;
  const ruleLine =
    m.rule === "sig-figs"
      ? "The significant-figure rule taught in science gives the same place here."
      : "The decimal-place rule for sums and differences, the coarsest place among the readings, gives the same place here.";
  return {
    prompt: `${m.setup} ${RULE} Which report of the ${m.quantity} is appropriate to the accuracy of the ${m.kind === "convert" ? "measurement" : "measurements"}?`,
    hint: `A reading of $${first.text}$ could be off by up to $${first.half}$ either way. Work out the result for the smallest and largest possible readings: which place value does the width of that range reach?`,
    explanation: [
      `What the measurement guarantees: ${m.windows.join(" ")}`,
      `Carry the window. ${m.carry}: the ${m.quantity} is from $${shownBound(p.lo, p.e)}$ to $${shownBound(p.hi, p.e)}$, a range $${widthText}$ wide.`,
      `The first nonzero digit of $${widthText}$ is in the ${placeName(p.e)} place, so the ${placeName(p.e)} digit is the last one to report. Rounding $${p.shown}$ there gives ${opt(p.report, m.unit)}. ${ruleLine}`,
      `Rule out the others: the calculator display claims digits the readings never fixed, $${finer}$ keeps one digit too many, and ${useSlip ? `$${slipText}$ comes from a slip in the calculation` : `$${zero}$ claims the next digit is known to be 0`}.`,
      `Check: every value from $${shownBound(p.lo, p.e)}$ to $${shownBound(p.hi, p.e)}$ is about $${p.report}$. The report says what the measurement knows and nothing more.`,
    ],
    options,
  };
}

const reportFamily = chainFamily({
  template: measurementPrecisionTemplates[0]!,
  axes: { variant: reportAxis },
  model: (r, a): ReportModel =>
    a.variant === "convert"
      ? convertModel(r)
      : a.variant === "combine"
        ? combineModel(r)
        : productModel(r),
  render: (m, _a, r) => {
    const c = reportCase(m, r);
    return choiceSurface(r, c);
  },
  variant: (m) => `${m.kind}-${m.context}`,
});

/* ------------------------------------------- report meaning (Type 2) */

interface Tool {
  id: string;
  tool: string;
  what: string;
  u: number;
  unit: string;
  lo: number;
  hi: number;
}
const tools: Tool[] = [
  {
    id: "calipers",
    tool: "Digital calipers",
    what: "a bolt's length",
    u: 0.01,
    unit: "mm",
    lo: 10,
    hi: 30,
  },
  {
    id: "kitchen-scale",
    tool: "A kitchen scale",
    what: "a bag of flour's mass",
    u: 1,
    unit: "g",
    lo: 120,
    hi: 950,
  },
  {
    id: "bathroom-scale",
    tool: "A bathroom scale",
    what: "a person's mass",
    u: 0.1,
    unit: "kg",
    lo: 40,
    hi: 99,
  },
  {
    id: "thermometer",
    tool: "A thermometer",
    what: "a bath's temperature",
    u: 0.5,
    unit: "°C",
    lo: 30,
    hi: 42,
  },
  {
    id: "cylinder",
    tool: "A graduated cylinder",
    what: "a liquid's volume",
    u: 2,
    unit: "mL",
    lo: 20,
    hi: 98,
  },
  {
    id: "postal-scale",
    tool: "A postal scale",
    what: "a parcel's mass",
    u: 5,
    unit: "g",
    lo: 105,
    hi: 495,
  },
  {
    id: "truck-scale",
    tool: "A truck scale",
    what: "a load's mass",
    u: 10,
    unit: "kg",
    lo: 1210,
    hi: 4990,
  },
  {
    id: "gps",
    tool: "A GPS app",
    what: "a hike's length",
    u: 100,
    unit: "m",
    lo: 1100,
    hi: 9900,
  },
];
const tenthsOf = (u: number) => 10 ** -(placesOf(u) + 1);
const q = (v: number, u: number) => v.toFixed(placesOf(u));
const qq = (v: number, u: number) => v.toFixed(placesOf(u) + 1);
/** The reading with one more 0 written on the end. */
const padded = (text: string) =>
  text.includes(".") ? `${text}0` : `${text}.0`;

function toolModel(r: Random) {
  const t = pick(r, tools);
  const steps = r(Math.ceil(t.lo / t.u), Math.floor(t.hi / t.u));
  if (t.u === 10 && steps % 10 === 0) throw new Error("Need three retry");
  if (t.u === 100 && steps % 10 === 0) throw new Error("Need three retry");
  if ((t.u === 0.01 || t.u === 0.1 || t.u === 1) && steps % 10 === 0)
    throw new Error("Need three retry: trailing zero");
  const R = steps * t.u;
  const Rt = q(R, t.u);
  const half = t.u / 2;
  const fine = tenthsOf(t.u);
  // A value strictly inside and one strictly between half a step and a step
  // away, each with one more decimal than the step and a nonzero last digit.
  const inside = (): number => {
    const k = r(1, Math.round(half / fine) - 1);
    if (k % 10 === 0) throw new Error("Need three retry");
    return R + (r(0, 1) ? k : -k) * fine;
  };
  const outside = (): number => {
    const k = r(Math.round(half / fine) + 1, Math.round(t.u / fine) - 1);
    if (k % 10 === 0) throw new Error("Need three retry");
    return R + (r(0, 1) ? k : -k) * fine;
  };
  const X = inside(),
    Y = outside();
  const u = t.unit;
  const edge = (v: number) => v.toFixed(placesOf(half));
  const range = `from $${edge(R - half)}$ ${u} up to, but not including, $${edge(R + half)}$ ${u}`;
  const fiveTrue = r(0, 1) === 1;
  const pool: Statement[] = [
    st(
      `The true value is at least $${edge(R - half)}$ ${u} and less than $${edge(R + half)}$ ${u}.`,
      true,
      `Every true value ${range} shows $${Rt}$ ${u}, and no other value does.`,
    ),
    st(
      `The true value could be $${qq(X, t.u)}$ ${u}.`,
      true,
      `$${qq(X, t.u)}$ is inside the window, so it would show $${Rt}$.`,
    ),
    st(
      `The true value is exactly $${Rt}$ ${u}.`,
      false,
      `The reading only says the true value is ${range}; it could be any value in that window.`,
    ),
    st(
      `The true value could be $${qq(Y, t.u)}$ ${u}.`,
      false,
      `$${qq(Y, t.u)}$ is more than half a step, $${q(half, fine)}$ ${u}, from $${Rt}$, so the display would show $${q(Y > R ? R + t.u : R - t.u, t.u)}$ instead.`,
    ),
    fiveTrue
      ? st(
          `Writing the reading as $${padded(Rt)}$ ${u} would claim more accuracy than the tool has.`,
          true,
          `$${padded(Rt)}$ claims the next place is known to be 0, but the tool reads only to the nearest $${q(t.u, t.u)}$ ${u}.`,
        )
      : st(
          `Writing the reading as $${padded(Rt)}$ ${u} claims the same accuracy as $${Rt}$ ${u}.`,
          false,
          `A zero on the end is a claim: $${padded(Rt)}$ says the next place is known, which the tool does not show.`,
        ),
    st(
      `The true value could be as high as $${q(R + t.u, t.u)}$ ${u}.`,
      false,
      `A true value of $${q(R + t.u, t.u)}$ would show $${q(R + t.u, t.u)}$, not $${Rt}$: the window ends half a step above the reading.`,
    ),
    st(
      `The true value is at least $${Rt}$ ${u}.`,
      false,
      `The true value could also be a little below $${Rt}$: the window starts half a step below the reading.`,
    ),
  ];
  const k = fiveTrue ? pick(r, [2, 3]) : 2;
  return selectModel({
    variant: `tool-${t.id}`,
    pool,
    total: 5,
    k,
    context: `${t.tool} reads to the nearest $${q(t.u, t.u)}$ ${u}: it shows the multiple of $${q(t.u, t.u)}$ nearest the true value, and a value exactly halfway shows the larger one. It shows ${t.what} as $${Rt}$ ${u}. In a written report, every digit after the decimal point claims that its place is known.`,
    ask: (n) => `Select the ${n} statements that are justified.`,
    hint: `The display reads $${Rt}$ and steps by $${q(t.u, t.u)}$ ${u}. Mark the range of true values that would show this reading, then test each statement against every value in that range.`,
    lead: [
      `The reading is the middle of a window as wide as one step: from half a step below $${Rt}$ to half a step above, so ${range}.`,
    ],
    tail: [
      "A measurement never shows a value exactly: it fixes a window, and the tool's step sets the window's width.",
    ],
  });
}

interface Report {
  id: string;
  what: string;
  unit: string;
  /** Exponent of the report's last place. */
  e: number;
  lo: number;
  hi: number;
  /** The report states its place in words (whole hundreds). */
  stated?: string;
}
const reports: Report[] = [
  {
    id: "length",
    what: "a shelf's length",
    unit: "m",
    e: -2,
    lo: 1.05,
    hi: 3.95,
  },
  { id: "time", what: "a sprint time", unit: "s", e: -1, lo: 10.1, hi: 15.9 },
  {
    id: "mass",
    what: "a sample's mass",
    unit: "kg",
    e: -3,
    lo: 0.105,
    hi: 0.995,
  },
  {
    id: "distance",
    what: "a flight's length",
    unit: "km",
    e: 2,
    lo: 1100,
    hi: 9900,
    stated: "to the nearest hundred kilometers",
  },
];
const placeWord = (e: number) => (e === 2 ? "hundreds" : placeName(e));
const stepText = (e: number) =>
  e >= 0 ? String(10 ** e) : (10 ** e).toFixed(-e);

function reportMeaningModel(r: Random) {
  const rep = pick(r, reports);
  const step = 10 ** rep.e;
  const n = r(Math.ceil(rep.lo / step), Math.floor(rep.hi / step));
  // Lengths and masses end in 0 about half the time: the trailing zero is
  // the point of the lesson.
  const steps = rep.e < 0 && r(0, 1) ? n - (n % 10) : n;
  if (steps % 10 === 0 && rep.e >= 0) throw new Error("Need three retry");
  if (steps * step < rep.lo) throw new Error("Need three retry");
  const v = steps * step;
  const text = rep.e >= 0 ? String(v) : v.toFixed(-rep.e);
  const u = rep.unit;
  const half = step / 2;
  const fine = (x: number) => (rep.e >= 0 ? String(x) : x.toFixed(-rep.e + 1));
  const L = fine(v - half),
    U = fine(v + half);
  const coarser = stepText(rep.e + 1);
  const shown = rep.stated ? `$${text}$ ${u}, ${rep.stated}` : `$${text}$ ${u}`;
  const trimmed =
    text.includes(".") && text.endsWith("0")
      ? text.slice(0, -1).replace(/\.$/, "")
      : null;
  const near = rep.e >= 0 ? String(v + step) : (v + step).toFixed(-rep.e);
  const pool: Statement[] = [
    st(
      `The measurement was rounded to the nearest $${stepText(rep.e)}$ ${u}.`,
      true,
      rep.stated
        ? `The report says it was rounded ${rep.stated}, a step of $${stepText(rep.e)}$ ${u}.`
        : `The last reported digit is in the ${placeWord(rep.e)} place, which names the step $${stepText(rep.e)}$ ${u}.`,
    ),
    st(
      `The true value is at least $${L}$ ${u} and less than $${U}$ ${u}.`,
      true,
      `Values from $${L}$ up to, but not including, $${U}$ round to $${text}$.`,
    ),
    trimmed
      ? st(
          `$${text}$ ${u} and $${trimmed}$ ${u} report the same accuracy.`,
          false,
          `$${text}$ fixes the ${placeWord(rep.e)} digit as 0; $${trimmed}$ stops one place earlier, so it reports less accuracy.`,
        )
      : rep.e >= 0
        ? st(
            `$${text}$ ${u} to the nearest hundred and $${text}$ ${u} to the nearest ten report the same accuracy.`,
            false,
            "To the nearest ten fixes one more digit than to the nearest hundred, so it reports more accuracy.",
          )
        : st(
            `$${text}$ ${u} and $${padded(text)}$ ${u} report the same accuracy.`,
            false,
            `$${padded(text)}$ claims one more digit, a 0, that $${text}$ does not fix.`,
          ),
    st(
      `The true value is exactly $${text}$ ${u}.`,
      false,
      `A report gives a window, here from $${L}$ to just under $${U}$, not an exact value.`,
    ),
    st(
      `A display that reads only to the nearest $${coarser}$ ${u} could have produced this report.`,
      false,
      rep.stated
        ? `Such a display rounds to the nearest $${coarser}$ ${u}, so it could not report $${text}$ ${u} ${rep.stated}.`
        : `Such a display never shows ${withArticle(placeWord(rep.e))} digit, so it could not report $${text}$ to the ${placeWord(rep.e)}.`,
    ),
    st(
      `The true value could be $${near}$ ${u}.`,
      false,
      `$${near}$ would itself round to $${near}$, not to $${text}$.`,
    ),
    st(
      `The true value is less than $${text}$ ${u}.`,
      false,
      `The true value could also be a little above $${text}$: the window runs up to just under $${U}$.`,
    ),
  ];
  return selectModel({
    variant: `report-${rep.id}`,
    pool,
    total: pick(r, [4, 5]),
    k: 2,
    context: rep.stated
      ? `A lab notebook reports ${rep.what} as ${shown}. By the usual rule, a report's last digit is the place the measurement was rounded to, and a value exactly halfway rounds up. This report states its place in words instead of by its last digit.`
      : `A lab notebook reports ${rep.what} as ${shown}. By the usual rule, a report's last digit is the place the measurement was rounded to, and a value exactly halfway rounds up.`,
    ask: (k) => `Select the ${k} statements that are justified.`,
    hint: rep.stated
      ? `The report gives $${text}$ ${u} ${rep.stated}. Which true values round to it, and which displays could report it that way?`
      : `The report $${text}$ ends in the ${placeWord(rep.e)} place. Which true values round to it, and which displays could show that digit?`,
    lead: [
      rep.stated
        ? `The report says $${text}$ ${u} was rounded to the nearest $${stepText(rep.e)}$ ${u}: the true value is in a window from $${L}$ to just under $${U}$.`
        : `The last digit of $${text}$ is in the ${placeWord(rep.e)} place, so the measurement was rounded to the nearest $${stepText(rep.e)}$ ${u}: the true value is in a window from $${L}$ to just under $${U}$.`,
    ],
    tail: [
      "A report's stated place, or else its last digit, tells you its tool's step. A trailing zero after a decimal point is part of that claim.",
    ],
  });
}

const meaningAxis = defineAxis("variant", ["tool", "report"] as const);
const meaningFamily = selectFamily(
  measurementPrecisionTemplates[1]!,
  (r, a) => (a.variant === "tool" ? toolModel(r) : reportMeaningModel(r)),
  { variant: meaningAxis },
);

/* --------------------------------------------- critique (Type 3) */

const critiqueAxis = defineAxis("variant", [
  "overstated-product",
  "understated",
  "mismatched-sum",
  "trailing-zero",
] as const);

interface CritiqueCase {
  id: string;
  prompt: string;
  hint: string;
  explanation: string[];
  options: ChoiceOption[];
}

function overstated(r: Random): CritiqueCase {
  const a = reading(r, 1.2, 9.9, 0.1),
    b = reading(r, 1.2, 9.9, 0.1);
  const central = a * b;
  const lo = (a - 0.05) * (b - 0.05),
    hi = (a + 0.05) * (b + 0.05);
  const p = precisionOf(central, lo, hi, sigFigExponent(central, 2));
  const at = (v: number) => roundText(v, p.e - 1);
  const whole = roundText(central, 0);
  const tens = roundText(central, 1);
  const finer = roundText(central, p.e - 1);
  const A = a.toFixed(1),
    B = b.toFixed(1);
  const options: ChoiceOption[] = [
    {
      label: `Each side can be off by $0.05$ m, so the area is from $${at(lo)}$ to $${at(hi)}$ m²; report $${p.report}$ m².`,
      correct: true,
    },
    {
      label: `It is right: $${A}\\times${B}$ is exactly $${p.shown}$, and arithmetic on exact numbers stays exact.`,
      feedback: `The arithmetic is exact, but the sides are not: each could be off by $0.05$ m, so the area is only known to be from $${at(lo)}$ to $${at(hi)}$ m².`,
    },
    {
      label: `Keep $${p.shown}$ m²: rounding would throw away information that the two measurements gave us.`,
      feedback: `The digits past the ${placeName(p.e)} place were never measured; they come from multiplying. The range is from $${at(lo)}$ to $${at(hi)}$ m².`,
    },
    whole !== p.report
      ? {
          label: `Measurements are never exact, so the area should be rounded to a whole number: $${whole}$ m².`,
          feedback: `This throws away the ${placeName(p.e)} digit, which the range from $${at(lo)}$ to $${at(hi)}$ m² does support.`,
        }
      : tens !== p.report
        ? {
            label: `Measurements are never exact, so the area should be rounded to the nearest ten: $${tens}$ m².`,
            feedback: `This throws away the ones digit, which the range from $${at(lo)}$ to $${at(hi)}$ m² does support.`,
          }
        : {
            label: `Report $${finer}$ m²: the sides were measured to the tenths, so the area keeps the tenths too.`,
            feedback: `The range from $${at(lo)}$ to $${at(hi)}$ m² is too wide to fix that many digits.`,
          },
  ];
  return {
    id: "overstated-product",
    prompt: `Nia measures a garden bed as $${A}$ m by $${B}$ m with a tape marked in tenths of a meter, and reports its area as $${p.shown}$ m². ${RULE} Which statement about this report is correct and complete?`,
    hint: `Each side, $${A}$ m and $${B}$ m, could be off by up to half a tenth. Multiply the smallest sides and the largest sides: how wide is the range of areas, and which place does the report claim?`,
    explanation: [
      `The tape fixes each side to within $0.05$ m: from $${(a - 0.05).toFixed(2)}$ to $${(a + 0.05).toFixed(2)}$ m and from $${(b - 0.05).toFixed(2)}$ to $${(b + 0.05).toFixed(2)}$ m.`,
      `Multiply smallest with smallest and largest with largest: the area is from $${shownBound(lo, p.e)}$ to $${shownBound(hi, p.e)}$ m², a range $${shownBound(hi - lo, p.e)}$ wide.`,
      `That width's first nonzero digit is in the ${placeName(p.e)} place, so report $${p.report}$ m². The report $${p.shown}$ claims digits the tape cannot fix: it is overstated.`,
      "Exact arithmetic is not exact measurement, and rounding to the justified place discards only digits that were never measured.",
    ],
    options,
  };
}

const understatements = [
  {
    id: "calipers",
    tool: "digital calipers that read to the nearest $0.01$ mm",
    what: "a bolt's length",
    u: 0.01,
    unit: "mm",
    lo: 10.01,
    hi: 29.99,
    vague: (v: number) => `about $${Math.round(v / 10)}$ cm`,
    habit: (v: number) => ({
      value: v.toFixed(1),
      rule: "every measurement report should keep exactly one decimal place",
    }),
  },
  {
    id: "thermometer",
    tool: "a thermometer that reads to the nearest $0.1$ °C",
    what: "a patient's temperature",
    u: 0.1,
    unit: "°C",
    lo: 36.1,
    hi: 39.9,
    vague: (v: number) => `about $${Math.round(v / 10) * 10}$ °C`,
    habit: (v: number) => ({
      value: v.toFixed(0),
      rule: "a body temperature is always reported to the nearest whole degree",
    }),
  },
  {
    id: "scale",
    tool: "a digital scale that reads to the nearest gram",
    what: "a melon's mass",
    u: 1,
    unit: "g",
    lo: 410,
    hi: 590,
    vague: () => "about half a kilogram",
    habit: (v: number) => ({
      value: (Math.round(v / 10) * 10).toFixed(0),
      rule: "a mass this size is always reported to the nearest $10$ g",
    }),
  },
];

function understated(r: Random): CritiqueCase {
  const c = pick(r, understatements);
  const v = reading(r, c.lo, c.hi, c.u);
  const t = q(v, c.u);
  const halfStep = q(c.u / 2, c.u / 10);
  const habit = c.habit(v);
  if (habit.value === t) throw new Error("Need three retry");
  const options: ChoiceOption[] = [
    {
      label: `The tool fixes it to within $${halfStep}$ ${c.unit}, so "${c.vague(v)}" throws accuracy away. Report $${t}$ ${c.unit}.`,
      correct: true,
    },
    {
      label: `The report is fine: rounding to a whole unit is always the safest way to report a measurement.`,
      feedback: `A report should keep the accuracy the tool gives. "${c.vague(v)}" would also describe readings far from $${t}$ ${c.unit}.`,
    },
    {
      label: `Report $${habit.value}$ ${c.unit} instead: ${habit.rule}.`,
      feedback: `No fixed habit decides the place for every report. This tool reads to the nearest $${q(c.u, c.u)}$ ${c.unit}, so the report keeps that place.`,
    },
    {
      label: `Report $${padded(t)}$ ${c.unit} instead: an extra zero on the end shows everyone how precise the tool is.`,
      feedback: `$${padded(t)}$ claims one more digit than the tool reads. A zero on the end is a claim, not a badge.`,
    },
  ];
  return {
    id: `understated-${c.id}`,
    prompt: `Using ${c.tool}, Theo measures ${c.what} as $${t}$ ${c.unit} and reports it as "${c.vague(v)}." A good report gives a measurement to the place its tool reads, no finer and no coarser. Which statement about this report is correct and complete?`,
    hint: `The tool showed $${t}$ ${c.unit}. Compare the window that reading fixes with the window "${c.vague(v)}" allows: which is wider?`,
    explanation: [
      `The tool reads to the nearest $${q(c.u, c.u)}$ ${c.unit}, so $${t}$ ${c.unit} fixes the value to within $${halfStep}$ ${c.unit}.`,
      `The report "${c.vague(v)}" allows a window far wider than that: it is understated, throwing away accuracy the measurement supports.`,
      `The appropriate report is $${t}$ ${c.unit}: every digit the tool shows, and no more.`,
      "The tool decides the place, not a habit: a whole unit, a fixed number of decimals, or an added zero would each claim less or more than the tool gives.",
    ],
    options,
  };
}

function mismatched(r: Random): CritiqueCase {
  const big = reading(r, 120, 890, 10);
  const small = reading(r, 0.5, 9.99, 0.01);
  const central = big + small;
  const lo = big - 5 + small - 0.005,
    hi = big + 5 + small + 0.005;
  const p = precisionOf(central, lo, hi, 1, true);
  const ones = roundText(central, 0),
    tenth = roundText(central, -1);
  if (ones === p.report)
    throw new Error("Need three retry: ones equals report");
  const B = String(big),
    S = small.toFixed(2);
  const options: ChoiceOption[] = [
    {
      label: `The $10$ g scale fixes the total only to about $${Math.round(lo)}$ to $${Math.round(hi)}$ g, so report $${p.report}$ g, to the nearest $10$ g.`,
      correct: true,
    },
    {
      label: `$${p.shown}$ g is right: a total is simply the exact sum of the two readings, so every digit counts.`,
      feedback: `The sum is exact arithmetic on inexact readings: the $${B}$ g reading alone could be off by $5$ g.`,
    },
    {
      label: `Report $${ones}$ g instead: grams are the unit of the total, so the nearest gram is the place to stop.`,
      feedback:
        "The unit does not choose the place; the tool does. The coarser scale fixes only the tens.",
    },
    {
      label: `Report $${tenth}$ g instead: the balance reads hundredths, so keeping one decimal place is still safe.`,
      feedback:
        "In a sum, the coarser reading controls the accuracy. The finer balance cannot fix digits the coarse scale leaves open.",
    },
  ];
  return {
    id: "mismatched-sum",
    prompt: `A bowl weighs $${B}$ g on a scale that reads to the nearest $10$ g. A spice packet weighs $${S}$ g on a balance that reads to the nearest $0.01$ g. Pat reports the total as $${p.shown}$ g. ${RULE} Which statement about this report is correct and complete?`,
    hint: `The bowl's reading, $${B}$ g, could be off by up to $5$ g, and the packet's by far less. Add the two half-steps: which place does that uncertainty reach?`,
    explanation: [
      `The scale fixes $${B}$ g to within $5$ g; the balance fixes $${S}$ g to within $0.005$ g.`,
      `In a sum the half-widths add, so the total is from $${shownBound(lo, -1)}$ to $${shownBound(hi, -1)}$ g, a range about $10$ g wide.`,
      `The width's first nonzero digit is in the tens place, so report $${p.report}$ g, to the nearest $10$ g. The decimal-place rule for sums, the coarsest place among the readings, agrees.`,
      "The coarser scale controls a sum: the unit does not choose the place, and the finer balance cannot add digits the scale leaves open.",
    ],
    options,
  };
}

function trailing(r: Random): CritiqueCase {
  const v = reading(r, 10.1, 29.9, 0.1);
  const t = v.toFixed(1),
    z = v.toFixed(2);
  const options: ChoiceOption[] = [
    {
      label: `$${z}$ kg claims $${(v - 0.005).toFixed(3)}$ to $${(v + 0.005).toFixed(3)}$ kg, but the scale fixes only $${(v - 0.05).toFixed(2)}$ to $${(v + 0.05).toFixed(2)}$ kg. Report $${t}$ kg.`,
      correct: true,
    },
    {
      label: `$${z}$ and $${t}$ are the same number, so the report is fine as written: a zero on the end changes nothing.`,
      feedback: `As numbers they are equal, but as reports they are not: $${z}$ claims the hundredths digit is known to be 0.`,
    },
    {
      label: `$${z}$ is the better report here, because writing more digits always makes a report more accurate.`,
      feedback:
        "Digits are claims. A report is accurate when it claims exactly what the tool fixed.",
    },
    {
      label: `Report $${Math.round(v)}$ kg instead: a scale is never exact, so the decimal part should be dropped from it.`,
      feedback: `This throws away the tenths digit, which the scale does read: $${t}$ kg is fixed to within $0.05$ kg.`,
    },
  ];
  return {
    id: "trailing-zero",
    prompt: `A luggage scale reads to the nearest $0.1$ kg and shows $${t}$ kg for a suitcase. Kim reports the mass as $${z}$ kg. A good report gives a measurement to the place its tool reads, no finer and no coarser. Which statement about this report is correct and complete?`,
    hint: `Ask what window the scale's reading of $${t}$ kg guarantees, then what window the report $${z}$ kg claims. Are they the same width?`,
    explanation: [
      `The scale fixes $${t}$ kg to within $0.05$ kg: from $${(v - 0.05).toFixed(2)}$ to $${(v + 0.05).toFixed(2)}$ kg.`,
      `The report $${z}$ kg claims a window only $0.01$ kg wide, from $${(v - 0.005).toFixed(3)}$ to $${(v + 0.005).toFixed(3)}$ kg: ten times narrower than the scale can fix. It is overstated.`,
      `The appropriate report is $${t}$ kg.`,
      "A zero on the end is a claim. More digits are not more accuracy, and dropping the tenths would throw away a digit the scale does read.",
    ],
    options,
  };
}

const critiqueFamily = chainFamily({
  template: measurementPrecisionTemplates[2]!,
  axes: { variant: critiqueAxis },
  model: (r, a): CritiqueCase =>
    a.variant === "overstated-product"
      ? overstated(r)
      : a.variant === "understated"
        ? understated(r)
        : a.variant === "mismatched-sum"
          ? mismatched(r)
          : trailing(r),
  render: (m, _a, r) => choiceSurface(r, m),
  variant: (m) => m.id,
});

export const measurementPrecisionCase = {
  report: reportFamily.generate,
  meaning: meaningFamily.generate,
  critique: critiqueFamily.generate,
};

export const measurementPrecisionGenerate = dispatch(
  measurementPrecisionTemplates,
  {
    "justified-report-from-measurements": (seed: string): GeneratedProblem =>
      reportFamily.generate(seed).problem,
    "measurement-report-meaning": (seed: string): GeneratedProblem =>
      meaningFamily.generate(seed).problem,
    "precision-report-critique": (seed: string): GeneratedProblem =>
      critiqueFamily.generate(seed).problem,
  },
);
