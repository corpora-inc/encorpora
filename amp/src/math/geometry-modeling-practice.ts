import { article } from "./agreement";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { assemble, random } from "./distribution-practice";
import { scene } from "./scene/author";
import type { Element, Point, Scene } from "./scene/spec";

/** Geometry measurement and modeling (HSG.GMD, HSG.MG, HSG.SRT.B.4–5): contextual
 * solid volumes, density, model and measure choice, constrained design, Cavalieri's
 * principle, sections and solids of revolution, and similarity theorems. Every
 * case is a private exact model; only the prompt, figure and shuffled choices
 * reach the learner. */

const make = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
  scenes = false,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  requiredResponseCapability: "single-choice-v1",
  ...(scenes ? { requiredFigureCapability: "scenes-v1" as const } : {}),
  description,
});

export const geometryModelingTemplates: readonly TemplateMetadata[] = [
  make(
    "solid-volume-context",
    "Volumes of solids in context",
    "solid-volume-models",
    0.4,
    "Use cylinder, cone, pyramid, sphere and composite volumes to find a capacity in liters, a count of cones, a missing dimension or a rounded volume.",
  ),
  make(
    "density-context",
    "Density from area and volume",
    "density-modeling",
    0.3,
    "Find a population density, a mass or a volume from a density with consistent units, and compare the densities of two objects.",
  ),
  make(
    "geometric-model-choice",
    "Choose and use a geometric model",
    "geometric-modeling",
    0.2,
    "Pick the solid that models an object, pick the measure (area, perimeter, surface area or volume) a task needs, and compute it from the model.",
  ),
  make(
    "geometric-design-constraint",
    "Design under a constraint",
    "geometric-design",
    0.5,
    "Choose the best design under a fixed perimeter, fixed volume or fixed fence, and compute a cost from an area and a rate.",
  ),
  make(
    "cavalieri-volume-reasoning",
    "Equal cross-sections, equal volumes",
    "cavalieri-principle",
    0.6,
    "Use Cavalieri's principle to find the volume of an oblique or leaning solid and to decide which solids must have equal volume.",
    true,
  ),
  make(
    "section-revolution-solid",
    "Sections and solids of revolution",
    "sections-and-revolutions",
    0.4,
    "Name the cross-section of a curved solid, the solid made by rotating a rectangle, right triangle or semicircle about a line, and its volume.",
    true,
  ),
  make(
    "similarity-theorem-length",
    "Lengths from similarity theorems",
    "similarity-theorems",
    0.6,
    "Find a length with the side-splitter theorem or the geometric-mean relations for the altitude to the hypotenuse of a right triangle.",
    true,
  ),
];

// ------------------------------------------------------------------ helpers
type Random = (low: number, high: number) => number;
type Wrong = { label: string; feedback: string };
type Built = {
  prompt: string;
  hint: string;
  explanation: string[];
  correct: string;
  wrong: Wrong[];
  figure?: SemanticFigure;
};
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
function sample<T>(r: Random, items: readonly T[], count: number): T[] {
  const rest = [...items];
  const out: T[] = [];
  while (out.length < count && rest.length)
    out.push(rest.splice(r(0, rest.length - 1), 1)[0]!);
  return out;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** Reduced fraction in TeX; whole numbers stay plain. */
function fr(n: number, d = 1): string {
  const g = gcd(n, d) || 1;
  [n, d] = [n / g, d / g];
  if (d < 0) [n, d] = [-n, -d];
  return d === 1 ? `${n}` : `\\frac{${n}}{${d}}`;
}
/** A multiple of pi in TeX, e.g. 96\pi, \frac{256}{3}\pi, \pi. */
const piTex = (n: number, d = 1) => {
  const f = fr(n, d);
  return f === "1" ? "\\pi" : `${f}\\pi`;
};
const math = (tex: string) => `$${tex}$`;
/** A plain number, or a fraction in math mode. */
const fq = (n: number, d = 1) => {
  const f = fr(n, d);
  return f.includes("frac") ? math(f) : f;
};
const isSquare = (n: number) => Number.isInteger(Math.sqrt(n));
/** sqrt(n) as a plain integer when exact, else a radical in math mode. */
const rq = (n: number) =>
  isSquare(n) ? `${Math.sqrt(n)}` : math(`\\sqrt{${n}}`);
const tenths = (t: number) => (t / 10).toFixed(1).replace(/\.0$/, "");

function finish(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  b: Built,
): GeneratedProblem {
  const seen = new Set([b.correct]);
  const wrong = b.wrong.filter((w) => {
    if (seen.has(w.label) || /^\$?-/.test(w.label)) return false;
    seen.add(w.label);
    return true;
  });
  if (wrong.length < 3)
    throw new Error(`Insufficient distinct choices for ${meta.id}`);
  return assemble(meta, seed, r, {
    prompt: b.prompt,
    answer: "",
    hint: b.hint,
    explanation: b.explanation,
    ...(b.figure ? { figure: b.figure } : {}),
    choices: [
      { label: b.correct, correct: true },
      ...wrong
        .slice(0, 3)
        .map((w) => ({ label: w.label, feedback: w.feedback })),
    ],
  });
}

const solid = (
  kind: "cylinder" | "cone" | "sphere",
  unit: "cm" | "m",
  size: { radius?: number; diameter?: number; height?: number },
): SemanticFigure => ({
  kind: "curved-solid",
  unit,
  solid: kind,
  radius: size.radius ?? null,
  diameter: size.diameter ?? null,
  height: size.height ?? null,
});

// ------------------------------------------------------------- scene helpers
type Anchor =
  "above" | "below" | "below2" | "below3" | "left" | "right" | "center";
const placing: Record<
  Anchor,
  { align: [-1 | 0 | 1, -1 | 0 | 1]; offset: [number, number] }
> = {
  above: { align: [0, 1], offset: [0, -6] },
  below: { align: [0, -1], offset: [0, 6] },
  below2: { align: [0, -1], offset: [0, 26] },
  below3: { align: [0, -1], offset: [0, 46] },
  left: { align: [1, 0], offset: [-8, 0] },
  right: { align: [-1, 0], offset: [8, 0] },
  center: { align: [0, 0], offset: [0, 0] },
};
const label = (
  at: Point,
  text: string,
  where: Anchor,
  extra: { color?: "accent" | "warm"; derived?: boolean } = {},
): Element => ({
  type: "text",
  at,
  text,
  font: /^[A-Z0-9?]{1,3}$/.test(text) ? "math" : "sans",
  bold: true,
  halo: true,
  ...placing[where],
  ...extra,
});
const line = (
  from: Point,
  to: Point,
  extra: {
    dash?: "dash" | "dot";
    stroke?: "accent" | "warm";
    width?: number;
  } = {},
): Element => ({ type: "segment", from, to, ...extra });
const mid = (a: Point, b: Point): Point => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
];

// ================================================ 1. solid-volume-context
const TANKS: [number, number][] = [
  [10, 10],
  [10, 20],
  [10, 30],
  [10, 40],
  [10, 50],
  [5, 40],
  [5, 60],
  [20, 10],
  [20, 20],
  [20, 30],
];

function volumeCase(
  r: Random,
  forced?: number,
): { variant: number; built: Built } {
  const variant = forced ?? r(0, 6);
  if (variant === 0) {
    const [rad, h] = pick(r, TANKS);
    const byDiameter = r(0, 1) === 1;
    const c = (rad * rad * h) / 1000;
    const size = byDiameter
      ? `a diameter of ${2 * rad} cm`
      : `a radius of ${rad} cm`;
    return {
      variant,
      built: {
        prompt: `A cylindrical tank has ${size} and a height of ${h} cm. One liter is 1000 cm³. How many liters does it hold? Give the capacity in terms of $\\pi$.`,
        hint: `Capacity is volume: $V=\\pi r^2h$ in cm³. ${byDiameter ? `The radius is half of the ${2 * rad} cm diameter. ` : ""}Find the volume with the ${h} cm height, then convert cm³ to liters.`,
        explanation: [
          `${byDiameter ? `The radius is ${2 * rad} ÷ 2 = ${rad} cm. ` : ""}The tank is a cylinder, so $V=\\pi r^2h=\\pi(${rad})^2(${h})=${piTex(rad * rad * h)}$ cm³.`,
          `One liter is 1000 cm³, so divide by 1000: $${piTex(rad * rad * h)}\\div1000=${piTex(c)}$ liters.`,
        ],
        correct: `${math(piTex(c))} L`,
        wrong: [
          {
            label: `${math(piTex(c * 10))} L`,
            feedback:
              "One liter is 1000 cm³, so convert by dividing by 1000, not by 100.",
          },
          {
            label: `${math(piTex(c, 10))} L`,
            feedback:
              "Dividing by 10 000 gives too few liters: 1000 cm³ make one liter.",
          },
          byDiameter
            ? {
                label: `${math(piTex(4 * c))} L`,
                feedback:
                  "The given length is the diameter. Halve it to get the radius before squaring.",
              }
            : {
                label: `${math(piTex(c, 3))} L`,
                feedback:
                  "A cylinder holds the full base area times the height. The factor one third belongs to a cone.",
              },
          {
            label: `${math(piTex(rad * rad * h))} L`,
            feedback:
              "That number is the volume in cm³. Convert it to liters by dividing by 1000.",
          },
        ],
        figure: solid("cylinder", "cm", {
          ...(byDiameter ? { diameter: 2 * rad } : { radius: rad }),
          height: h,
        }),
      },
    };
  }
  if (variant === 1) {
    const rad = pick(r, [3, 4, 5]);
    const h = pick(r, [6, 9, 12]);
    const a = pick(r, [2, 4]);
    const m = pick(r, [1, 2, 3]);
    const n = 3 * a * a * m;
    return {
      variant,
      built: {
        prompt: `A cone-shaped paper cup has a radius of ${rad} cm and a height of ${h} cm. A cylindrical jar has a radius of ${a * rad} cm and a height of ${m * h} cm. How many full cups of water does it take to fill the jar?`,
        hint: `Compare the two volumes. A cup holds one third of $\\pi r^2h$ for its ${rad} cm radius and ${h} cm height. The jar's radius is ${a} times the cup's and its height is ${m === 1 ? "the same as" : `${m} times`} the cup's, so find how the factors change the volume.`,
        explanation: [
          `Cup: $V=\\tfrac13\\pi(${rad})^2(${h})=${fr(rad * rad * h, 3)}\\pi$ cm³.`,
          `Jar: $V=\\pi(${a * rad})^2(${m * h})=${a * a * m * rad * rad * h}\\pi$ cm³. The radius is squared, so the ${a}× radius multiplies the volume by ${a * a}; the height ${m === 1 ? "is unchanged" : `multiplies it by ${m}`}.`,
          `Cups needed: $${a * a * m * rad * rad * h}\\pi\\div${fr(rad * rad * h, 3)}\\pi=${n}$.`,
        ],
        correct: `${n} cups`,
        wrong: [
          {
            label: `${a * a * m} cups`,
            feedback:
              "That treats a cup as a full cylinder. A cone holds only one third of the cylinder with the same base and height.",
          },
          {
            label: `${3 * a * m} cups`,
            feedback:
              "A radius that is larger by a factor multiplies the base area by the square of that factor.",
          },
          {
            label: `${2 * a * a * m} cups`,
            feedback:
              "A cone holds one third, not one half, of the cylinder with the same base and height.",
          },
          {
            label: `${3 * a * a} cups`,
            feedback: "The jar is also taller; include its height factor.",
          },
        ],
      },
    };
  }
  if (variant === 2) {
    const rad = pick(r, [4, 5, 6]);
    // The height never equals the radius, which the prompt already states.
    const h = pick(
      r,
      [6, 9, 12, 15].filter((candidate) => candidate !== rad),
    );
    const v = (rad * rad * h) / 3;
    return {
      variant,
      built: {
        prompt: `A conical pile of gravel has a base radius of ${rad} m and a volume of ${v}$\\pi$ cubic meters. How tall is the pile, in meters?`,
        hint: `Start from $V=\\tfrac13\\pi r^2h$ and substitute the ${rad} m radius and the given volume. Solve for $h$ by undoing the one third and the $r^2$.`,
        explanation: [
          `Cone volume: $V=\\tfrac13\\pi r^2h$. Substitute: $${v}\\pi=\\tfrac13\\pi(${rad})^2h=${fr(rad * rad, 3)}\\pi h$.`,
          `Divide by $\\pi$ and multiply by 3: $${3 * v}=${rad * rad}h$.`,
          `Divide by ${rad * rad}: $h=${fr(3 * v, rad * rad)}$ m.`,
        ],
        correct: `${fq(h)} m`,
        wrong: [
          {
            label: `${fq(v, rad * rad)} m`,
            feedback:
              "The volume is one third of base area times height, so multiply by 3 as well as dividing by the base area.",
          },
          {
            label: `${fq(3 * v, rad)} m`,
            feedback:
              "The radius is squared in the base area; divide by $r^2$.",
          },
          {
            label: `${fq(v, rad)} m`,
            feedback:
              "Undo both the one third and the square of the radius: $h=3V\\div(\\pi r^2)$.",
          },
          {
            label: `${fq(9 * v, rad * rad)} m`,
            feedback: "Multiply by 3 once to undo the one third, not twice.",
          },
        ],
        figure: solid("cone", "m", { radius: rad }),
      },
    };
  }
  if (variant === 3) {
    const rad = pick(r, [3, 4, 5, 6, 9]);
    const c = 4 * rad ** 3;
    return {
      variant,
      built: {
        prompt: `A spherical water tank has a diameter of ${2 * rad} m. How many cubic meters of water does it hold when full? Give the volume in terms of $\\pi$.`,
        hint: `The volume of a sphere is $V=\\tfrac43\\pi r^3$. The tank's ${2 * rad} m is a diameter, so halve it to get the radius before cubing.`,
        explanation: [
          `The radius is ${2 * rad} ÷ 2 = ${rad} m.`,
          `$V=\\tfrac43\\pi(${rad})^3=\\tfrac43\\pi(${rad ** 3})=${piTex(c, 3)}$.`,
          `The tank holds $${piTex(c, 3)}$ cubic meters.`,
        ],
        correct: `${math(piTex(c, 3))} cubic meters`,
        wrong: [
          {
            label: `${math(piTex(4 * (2 * rad) ** 3, 3))} cubic meters`,
            feedback:
              "The given length is the diameter. Halve it to get the radius before cubing.",
          },
          {
            label: `${math(piTex(c))} cubic meters`,
            feedback:
              "A sphere's volume is four thirds of $\\pi r^3$; include the factor one third.",
          },
          {
            label: `${math(piTex(2 * rad ** 3, 3))} cubic meters`,
            feedback:
              "Two thirds of $\\pi r^3$ is a hemisphere. A full sphere is twice that.",
          },
          {
            label: `${math(piTex(4 * rad * rad))} cubic meters`,
            feedback:
              "$4\\pi r^2$ is the surface area. Volume uses the cube of the radius.",
          },
        ],
        figure: solid("sphere", "m", { diameter: 2 * rad }),
      },
    };
  }
  if (variant === 4) {
    const rad = pick(r, [3, 6]);
    const h = r(4, 12);
    const cyl = rad * rad * h;
    const cap = (2 * rad ** 3) / 3;
    return {
      variant,
      built: {
        prompt: `A silo is a cylinder topped by a hemisphere with the same radius. The cylinder has a radius of ${rad} m and a height of ${h} m. How many cubic meters does the whole silo hold? Give the volume in terms of $\\pi$.`,
        hint: `Add two volumes: the cylinder, $\\pi r^2h$ with $r=${rad}$ and $h=${h}$, and the hemisphere, which is half of a sphere of radius ${rad}.`,
        explanation: [
          `Cylinder: $\\pi(${rad})^2(${h})=${cyl}\\pi$ cubic meters.`,
          `Hemisphere: half of $\\tfrac43\\pi(${rad})^3$, which is $\\tfrac23\\pi(${rad ** 3})=${cap}\\pi$ cubic meters.`,
          `Total: $${cyl}\\pi+${cap}\\pi=${cyl + cap}\\pi$ cubic meters.`,
        ],
        correct: `${math(piTex(cyl + cap))} cubic meters`,
        wrong: [
          {
            label: `${math(piTex(cyl + 2 * cap))} cubic meters`,
            feedback:
              "That adds a whole sphere. The top is only a hemisphere, half of a sphere.",
          },
          {
            label: `${math(piTex(cyl))} cubic meters`,
            feedback: "That is only the cylinder. Add the hemisphere on top.",
          },
          {
            label: `${math(piTex(cyl + 3 * cap, 3))} cubic meters`,
            feedback:
              "A cylinder holds its full base area times its height. The factor one third belongs to cones.",
          },
          {
            label: `${math(piTex(cyl + 2 * rad ** 3))} cubic meters`,
            feedback:
              "A hemisphere is $\\tfrac23\\pi r^3$. Keep the factor one third.",
          },
        ],
      },
    };
  }
  if (variant === 5) {
    const s = pick(r, [6, 9, 12]);
    const h = r(5, 14);
    const v = (s * s * h) / 3;
    return {
      variant,
      built: {
        prompt: `A glass pyramid has a square base with sides of ${s} m and a height of ${h} m. How many cubic meters of air does it enclose?`,
        hint: `A pyramid holds one third of the prism with the same base and height. Find the base area of the ${s} m square, then use the ${h} m height.`,
        explanation: [
          `The square base has area ${s} × ${s} = ${s * s} square meters.`,
          `The matching prism has volume ${s * s} × ${h} = ${s * s * h} cubic meters.`,
          `A pyramid holds one third of that: ${s * s * h} ÷ 3 = ${v} cubic meters.`,
        ],
        correct: `${v} cubic meters`,
        wrong: [
          {
            label: `${s * s * h} cubic meters`,
            feedback:
              "That is the volume of the prism with the same base and height. A pyramid is one third of it.",
          },
          {
            label: `${fq(s * h, 3)} cubic meters`,
            feedback: "The base is a square, so its area is side times side.",
          },
          {
            label: `${fq(s * s * h, 2)} cubic meters`,
            feedback: "A pyramid holds one third, not one half, of the prism.",
          },
          {
            label: `${fq(s * s * h, 9)} cubic meters`,
            feedback: "Divide by 3 once, not twice.",
          },
        ],
      },
    };
  }
  // Rounded cylinder volume with a unit conversion.
  let rad = pick(r, [6, 8, 10, 12]);
  let h = pick(r, [15, 20, 25, 30]);
  // Avoid a tie at exactly half a tenth of a liter.
  while ((314 * rad * rad * h) % 10000 === 5000) {
    rad = pick(r, [6, 8, 10, 12]);
    h = pick(r, [15, 20, 25, 30]);
  }
  const exactLiters = (314 * rad * rad * h) / 100000;
  const ans = exactLiters.toFixed(1);
  return {
    variant: 6,
    built: {
      prompt: `A cylindrical paint can has a radius of ${rad} cm and a height of ${h} cm. Use 3.14 for $\\pi$. How many liters does it hold, rounded to the nearest tenth of a liter? One liter is 1000 cm³.`,
      hint: `Find the volume with $V=\\pi r^2h$ using 3.14 for $\\pi$ and the ${rad} cm radius. Then convert cm³ to liters, and round only at the end.`,
      explanation: [
        `$V=3.14\\times${rad}^2\\times${h}=3.14\\times${rad * rad * h}=${(3.14 * rad * rad * h).toFixed(2).replace(/\.?0+$/, "")}$ cm³.`,
        `Divide by 1000 to convert to liters: ${exactLiters.toFixed(4).replace(/0+$/, "")} L.`,
        `Rounded to the nearest tenth, the can holds ${ans} L.`,
      ],
      correct: `${ans} L`,
      wrong: [
        {
          label: `${(exactLiters * 10).toFixed(1)} L`,
          feedback:
            "1000 cm³ make a liter. Dividing by 100 gives ten times too many.",
        },
        {
          label: `${(exactLiters / 10).toFixed(1)} L`,
          feedback:
            "Dividing by 10 000 gives ten times too few liters. Divide by 1000.",
        },
        {
          label: `${((314 * rad * h) / 100000).toFixed(1)} L`,
          feedback: "The radius is squared in $\\pi r^2h$.",
        },
        {
          label: `${((314 * rad * rad * h) / 100).toFixed(1)} L`,
          feedback: "That is the volume in cm³. Convert it to liters.",
        },
      ],
      figure: solid("cylinder", "cm", { radius: rad, height: h }),
    },
  };
}

// ====================================================== 2. density-context
const MATERIALS: [string, number][] = [
  ["aluminum", 27],
  ["iron", 79],
  ["silver", 105],
  ["lead", 113],
];
function densityCase(
  r: Random,
  forced?: number,
): { variant: number; built: Built } {
  const variant = forced ?? r(0, 6);
  if (variant === 0) {
    const area = pick(r, [12, 15, 18, 24, 30, 36, 45, 60]);
    const d = r(20, 180);
    const pop = d * area;
    return {
      variant,
      built: {
        prompt: `A county has an area of ${area} square kilometers and a population of ${pop} people. What is its population density, in people per square kilometer?`,
        hint: `Density compares an amount to the space it occupies. Divide the number of people, ${pop}, by the area in square kilometers, ${area}.`,
        explanation: [
          "Population density is people per unit of area: population ÷ area.",
          `${pop} ÷ ${area} = ${d}.`,
          `The density is ${d} people per square kilometer.`,
        ],
        correct: `${d} people per km²`,
        wrong: [
          {
            label: `${pop * area} people per km²`,
            feedback:
              "Density divides the population by the area; it does not multiply them.",
          },
          {
            label: `${fq(area, pop)} people per km²`,
            feedback:
              "This divides area by population, which is square kilometers per person. Density puts people in the numerator.",
          },
          {
            label: `${pop - area} people per km²`,
            feedback: "Density is a quotient, not a difference.",
          },
        ],
      },
    };
  }
  if (variant === 1 || variant === 2) {
    const [name, dt] = pick(r, MATERIALS);
    const kg = variant === 2;
    const k = r(1, 8);
    const v = kg ? 1000 * k : 10 * r(2, 9);
    const gramsTenths = dt * v; // tenths of grams
    const grams = gramsTenths / 10;
    const massLabel = kg ? `${tenths(dt * k)} kg` : `${grams} g`;
    return {
      variant,
      built: {
        prompt: `A solid block of ${name} has a volume of ${v} cm³. The density of ${name} is ${tenths(dt)} g/cm³.${kg ? " What is the block's mass, in kilograms? (1 kg = 1000 g)" : " What is the block's mass, in grams?"}`,
        hint: `Density is mass per unit volume, so mass = density × volume. Multiply ${tenths(dt)} g/cm³ by ${v} cm³${kg ? ", then convert grams to kilograms" : ""}.`,
        explanation: [
          `Mass = density × volume = ${tenths(dt)} × ${v} = ${grams} g.`,
          ...(kg
            ? [
                `Divide by 1000 to convert to kilograms: ${grams} ÷ 1000 = ${tenths(dt * k)} kg.`,
              ]
            : [`The block's mass is ${grams} g.`]),
        ],
        correct: massLabel,
        wrong: kg
          ? [
              {
                label: `${grams} kg`,
                feedback:
                  "That number is in grams. Divide by 1000 to get kilograms.",
              },
              {
                label: `${tenths(dt * k * 10)} kg`,
                feedback:
                  "1 kg is 1000 g, so divide the grams by 1000, not 100.",
              },
              {
                label: `${tenths(dt + v * 10)} kg`,
                feedback: "Multiply density and volume; do not add them.",
              },
            ]
          : [
              {
                label: `${fq(v * 10, dt)} g`,
                feedback:
                  "Mass is density times volume; dividing finds volume from mass instead.",
              },
              {
                label: `${tenths(dt + v * 10)} g`,
                feedback: "Multiply density and volume; do not add them.",
              },
              {
                label: `${grams * 10} g`,
                feedback: `The density is ${tenths(dt)}, which has a decimal point. Place it correctly when multiplying.`,
              },
              {
                label: `${tenths(dt + v * 10)} g`,
                feedback: "Mass is a product, not a sum.",
              },
            ],
      },
    };
  }
  if (variant === 3) {
    const [name, dt] = pick(r, MATERIALS);
    const v = 10 * r(2, 9);
    const grams = (dt * v) / 10;
    return {
      variant,
      built: {
        prompt: `A sample of ${name} has a mass of ${grams} g. The density of ${name} is ${tenths(dt)} g/cm³. What is the sample's volume, in cm³?`,
        hint: `Density = mass ÷ volume, so volume = mass ÷ density. Divide ${grams} g by ${tenths(dt)} g/cm³.`,
        explanation: [
          "Density = mass ÷ volume, so volume = mass ÷ density.",
          `Volume = ${grams} ÷ ${tenths(dt)} = ${v} cm³.`,
        ],
        correct: `${v} cm³`,
        wrong: [
          {
            label: `${tenths(grams * dt)} cm³`,
            feedback:
              "Multiplying mass by density does not give a volume. Divide the mass by the density.",
          },
          {
            label: `${fq(dt, 10 * grams)} cm³`,
            feedback:
              "That divides density by mass. The mass is the larger amount here; divide it by the density.",
          },
          {
            label: `${tenths(grams * 10 - dt)} cm³`,
            feedback: "Volume comes from a quotient, not a difference.",
          },
          {
            label: `${v / 10} cm³`,
            feedback: `Check the decimal point: dividing by ${tenths(dt)} is the same as multiplying by 10 and dividing by ${dt}.`,
          },
        ],
      },
    };
  }
  if (variant === 4) {
    // Block A is denser but has less mass.
    let dA: number, dB: number, vA: number, vB: number;
    do {
      dA = r(4, 14);
      dB = r(2, dA - 1);
      vA = r(2, 6);
      vB = r(vA + 2, vA + 9);
    } while (dA * vA >= dB * vB);
    // x names the denser block (less mass); y names the more massive block.
    const [x, y] = r(0, 1) ? ["A", "B"] : ["B", "A"];
    const [dX, vX, dY, vY] = [dA, vA, dB, vB];
    const denserFirst = r(0, 1) === 1;
    const m = (d: number, v: number) => d * v;
    const describe = (n: string, d: number, v: number) =>
      `Block ${n} has a mass of ${m(d, v)} g and a volume of ${v} cm³.`;
    const statements = denserFirst
      ? `${describe(x, dX, vX)} ${describe(y, dY, vY)}`
      : `${describe(y, dY, vY)} ${describe(x, dX, vX)}`;
    return {
      variant,
      built: {
        prompt: `${statements} Which block is denser, and what is its density?`,
        hint: `Density is mass per unit volume. Divide each block's mass by its own volume (for Block ${y}, ${m(dY, vY)} g by ${vY} cm³), then compare the two quotients, not the two masses.`,
        explanation: [
          `Block ${x}: ${m(dX, vX)} ÷ ${vX} = ${dX} g/cm³.`,
          `Block ${y}: ${m(dY, vY)} ÷ ${vY} = ${dY} g/cm³.`,
          `Block ${x} has the greater density, ${dX} g/cm³, even though block ${y} has more mass.`,
        ],
        correct: `Block ${x}, ${dX} g/cm³`,
        wrong: [
          {
            label: `Block ${y}, ${dY} g/cm³`,
            feedback: `Block ${y} has more mass, but density compares mass with volume. Its density is lower.`,
          },
          {
            label: `Block ${y}, ${m(dY, vY)} g/cm³`,
            feedback:
              "A mass is not a density. Divide the mass by the volume first.",
          },
          {
            label: `Block ${x}, ${m(dX, vX)} g/cm³`,
            feedback:
              "That number is the block's mass. Density is mass divided by volume.",
          },
        ],
      },
    };
  }
  if (variant === 5) {
    const l = r(3, 9);
    const w = r(2, 8);
    const d = r(30, 120);
    const pop = d * l * w;
    return {
      variant,
      built: {
        prompt: `A rectangular nature reserve is ${l} km long and ${w} km wide, and ${pop} people live inside it. What is its population density, in people per square kilometer?`,
        hint: `Density needs the area of the reserve, not its length or its perimeter. Model the reserve as ${article(l)} ${l} km by ${w} km rectangle and find its area first.`,
        explanation: [
          `The area is ${l} × ${w} = ${l * w} km².`,
          `Density = population ÷ area = ${pop} ÷ ${l * w} = ${d} people per km².`,
        ],
        correct: `${d} people per km²`,
        wrong: [
          {
            label: `${fq(pop, 2 * (l + w))} people per km²`,
            feedback:
              "The perimeter measures the distance around the reserve. Density divides by its area.",
          },
          {
            label: `${fq(pop, l)} people per km²`,
            feedback:
              "Divide by the whole area, length times width, not by one side.",
          },
          {
            label: `${fq(pop, l + w)} people per km²`,
            feedback: "Adding the sides does not give an area; multiply them.",
          },
          {
            label: `${pop * l * w} people per km²`,
            feedback:
              "Density divides the population by the area; it does not multiply.",
          },
        ],
      },
    };
  }
  const rad = pick(r, [2, 3, 4, 5]);
  const len = pick(r, [10, 15, 20, 25]);
  return {
    variant: 6,
    built: {
      prompt: `A solid steel rod is a cylinder with a radius of ${rad} cm and a length of ${len} cm. Assume steel has a density of 8 g/cm³. What is the rod's mass, in grams? Give the mass in terms of $\\pi$.`,
      hint: `Mass = density × volume. Find the cylinder's volume with $V=\\pi r^2h$, using the ${rad} cm radius and the ${len} cm length, then multiply by 8 g/cm³.`,
      explanation: [
        `Volume: $V=\\pi(${rad})^2(${len})=${piTex(rad * rad * len)}$ cm³.`,
        `Mass = density × volume, so $m=8\\times${piTex(rad * rad * len)}=${piTex(8 * rad * rad * len)}$ g.`,
      ],
      correct: `${math(piTex(8 * rad * rad * len))} g`,
      wrong: [
        {
          label: `${math(piTex(8 * rad * len))} g`,
          feedback: "The radius is squared in the base area $\\pi r^2$.",
        },
        {
          label: `${math(piTex(rad * rad * len))} g`,
          feedback:
            "That is the volume in cm³. Multiply by the density to get grams.",
        },
        {
          label: `${math(piTex(8 * rad * rad * len, 3))} g`,
          feedback:
            "A cylinder uses the full base area times the length; one third belongs to a cone.",
        },
        {
          label: `${math(piTex(16 * rad * len))} g`,
          feedback:
            "$2\\pi rh$ is the curved surface area. The mass of a solid rod uses its volume.",
        },
      ],
    },
  };
}

// ================================================= 3. geometric-model-choice
const SHAPES = [
  ["cylinder", "two equal circular ends joined by a curved side"],
  ["cone", "one circular end that narrows evenly to a single point"],
  ["sphere", "the same distance from its center to every point on its surface"],
  ["rectangular prism", "six rectangular faces, with opposite faces equal"],
  ["triangular prism", "two triangular ends joined by three rectangular faces"],
] as const;
const OBJECTS: [string, string, number][] = [
  [
    "a tree trunk",
    "A tree trunk has about the same circular cross-section from the ground up to its first branch.",
    0,
  ],
  [
    "a party hat",
    "A paper party hat has a circular rim and narrows evenly to one point.",
    1,
  ],
  [
    "a basketball",
    "A basketball is the same distance from its center to every point on its surface.",
    2,
  ],
  [
    "a shoebox",
    "A closed shoebox has six rectangular faces, with opposite faces equal.",
    3,
  ],
  [
    "a pup tent",
    "A pup tent has two triangular ends joined by three rectangular panels.",
    4,
  ],
  [
    "a soup can",
    "A soup can has two equal circular ends joined by a curved side.",
    0,
  ],
];
const MEASURES = {
  area: "the flat region inside a figure",
  perimeter: "the distance around a figure",
  "surface area": "the total area of the outside faces of a solid",
  volume: "the amount of space inside a solid",
} as const;
type MeasureName = keyof typeof MEASURES;
const MEASURE_TASKS: [MeasureName, string][] = [
  [
    "area",
    "A lawn is a rectangle 12 m long and 8 m wide. You want to cover it with sod.",
  ],
  [
    "area",
    "The floor of a gym is a rectangle 28 m by 15 m. You want to paint the floor.",
  ],
  [
    "perimeter",
    "A garden is a rectangle 9 m long and 6 m wide. You want to put a fence around it.",
  ],
  [
    "perimeter",
    "A poster is a rectangle 90 cm by 60 cm. You want to glue ribbon along its edges.",
  ],
  [
    "surface area",
    "A storage box is 3 m long, 2 m wide and 2 m tall. You want to paint its outside faces.",
  ],
  [
    "surface area",
    "A gift box is 30 cm by 20 cm by 10 cm. You want to wrap all of its faces in paper.",
  ],
  [
    "volume",
    "An aquarium is 80 cm long, 40 cm wide and 50 cm tall. You want to know how much water fills it.",
  ],
  [
    "volume",
    "A planter box is 2 m long, 1 m wide and 0.5 m deep. You want to know how much soil fills it.",
  ],
];
const MEASURE_ORDER: MeasureName[] = [
  "area",
  "perimeter",
  "surface area",
  "volume",
];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function modelCase(
  r: Random,
  forced?: number,
): { variant: number; built: Built } {
  const variant = forced ?? r(0, 4);
  if (variant === 0) {
    const [obj, desc, k] = pick(r, OBJECTS);
    const [name, feature] = SHAPES[k]!;
    const others = sample(
      r,
      SHAPES.filter((_, i) => i !== k),
      3,
    );
    return {
      variant,
      built: {
        prompt: `${desc} Which solid is the best geometric model for ${obj}?`,
        hint: `Match the description of ${obj} to a solid: look at what its ends and its sides are like, and ignore small details.`,
        explanation: [
          desc,
          `A ${name} has ${feature}.`,
          `So ${obj} is best modeled by a ${name}.`,
        ],
        correct: cap(name),
        wrong: others.map(([shape, f]) => ({
          label: cap(shape),
          feedback: `A ${shape} has ${f}. That does not match the description of ${obj}.`,
        })),
      },
    };
  }
  if (variant === 1) {
    const [measure, task] = pick(r, MEASURE_TASKS);
    return {
      variant,
      built: {
        prompt: `${task} Which measure of the object do you need to find?`,
        hint: `Decide what the job covers or fills: a flat region, a path around the edge, the outside faces of a solid, or the space inside. Then match it to a measure of an object that is ${(task.match(/\d+(?:\.\d+)? (?:cm|m)\b/g) ?? []).join(" by ")}.`,
        explanation: [
          task,
          `This job needs ${MEASURES[measure]}.`,
          `That measure is ${measure}.`,
        ],
        correct: cap(measure),
        wrong: MEASURE_ORDER.filter((m) => m !== measure).map((m) => ({
          label: cap(m),
          feedback: `${cap(m)} is ${MEASURES[m]}. This job needs ${MEASURES[measure]}.`,
        })),
      },
    };
  }
  if (variant === 2) {
    const rad = pick(r, [3, 4, 5, 6]);
    const h = pick(r, [8, 10, 12, 14]);
    return {
      variant,
      built: {
        prompt: `A can of beans is modeled as a cylinder with a radius of ${rad} cm and a height of ${h} cm. Its paper label wraps once around the curved side with no overlap, and covers no part of the ends. What is the area of the label, in square centimeters? Give the area in terms of $\\pi$.`,
        hint: `The label covers only the curved side. Unroll it: it is a rectangle whose width is the distance around the can (the circumference of ${article(rad)} ${rad} cm radius circle) and whose height is ${h} cm.`,
        explanation: [
          `The circumference of the can is $2\\pi r=2\\pi(${rad})=${piTex(2 * rad)}$ cm.`,
          `Unrolled, the label is a rectangle $${piTex(2 * rad)}$ cm by ${h} cm.`,
          `Its area is $${piTex(2 * rad)}\\times${h}=${piTex(2 * rad * h)}$ cm².`,
        ],
        correct: `${math(piTex(2 * rad * h))} cm²`,
        wrong: [
          {
            label: `${math(piTex(rad * rad * h))} cm²`,
            feedback:
              "$\\pi r^2h$ is the volume. A label covers surface, so it needs an area.",
          },
          {
            label: `${math(piTex(2 * rad * h + 2 * rad * rad))} cm²`,
            feedback:
              "That is the area of the whole can, including both ends. The label covers only the curved side.",
          },
          {
            label: `${math(piTex(rad * h))} cm²`,
            feedback:
              "The label's width is the full circumference, $2\\pi r$, not $\\pi r$.",
          },
          {
            label: `${math(piTex(2 * rad * rad))} cm²`,
            feedback: "The height of the can is part of the label's area.",
          },
        ],
        figure: solid("cylinder", "cm", { radius: rad, height: h }),
      },
    };
  }
  if (variant === 3) {
    const b = pick(r, [2, 4, 6]);
    const t = pick(r, [2, 3]);
    const len = pick(r, [3, 4, 5]);
    const v = (b * t * len) / 2;
    return {
      variant,
      built: {
        prompt: `A pup tent is modeled as a triangular prism lying on one rectangular face. Each triangular end has a base of ${b} m and a height of ${t} m, and the tent is ${len} m long. How many cubic meters of space are inside the tent?`,
        hint: `A prism's volume is the area of one end times its length. Find the area of a triangular end from its ${b} m base and ${t} m height first.`,
        explanation: [
          `Area of a triangular end: $\\tfrac12 bh=\\tfrac12(${b})(${t})=${(b * t) / 2}$ square meters.`,
          `Volume = end area × length = ${(b * t) / 2} × ${len} = ${v} cubic meters.`,
        ],
        correct: `${v} cubic meters`,
        wrong: [
          {
            label: `${b * t * len} cubic meters`,
            feedback:
              "That treats the end as a rectangle. A triangle has half the area of the rectangle with the same base and height.",
          },
          {
            label: `${(b * t) / 2} cubic meters`,
            feedback:
              "That is only the area of one end. Multiply by the tent's length.",
          },
          {
            label: `${fq(b * t * len, 3)} cubic meters`,
            feedback:
              "One third belongs to pyramids and cones. A prism keeps its end area along the whole length.",
          },
          {
            label: `${fq((b + t) * len, 2)} cubic meters`,
            feedback:
              "The end's area is half of base times height, not half of base plus height.",
          },
        ],
      },
    };
  }
  const rad = pick(r, [5, 6, 7, 8, 9]);
  return {
    variant: 4,
    built: {
      prompt: `A soccer ball is modeled as a sphere with a diameter of ${2 * rad} cm. How many square centimeters of leather cover its surface? Give the area in terms of $\\pi$.`,
      hint: `The leather covers the surface, so use the surface area of a sphere, $4\\pi r^2$. The given ${2 * rad} cm is a diameter; halve it first.`,
      explanation: [
        `The radius is ${2 * rad} ÷ 2 = ${rad} cm.`,
        `$S=4\\pi r^2=4\\pi(${rad})^2=${piTex(4 * rad * rad)}$ cm².`,
      ],
      correct: `${math(piTex(4 * rad * rad))} cm²`,
      wrong: [
        {
          label: `${math(piTex(4 * rad ** 3, 3))} cm²`,
          feedback:
            "$\\tfrac43\\pi r^3$ is the volume. Leather covers the surface.",
        },
        {
          label: `${math(piTex(16 * rad * rad))} cm²`,
          feedback:
            "The given length is the diameter. Halve it to get the radius before squaring.",
        },
        {
          label: `${math(piTex(rad * rad))} cm²`,
          feedback:
            "$\\pi r^2$ is the area of a flat circle through the center, one quarter of the sphere's surface.",
        },
        {
          label: `${math(piTex(2 * rad * rad))} cm²`,
          feedback:
            "$2\\pi r^2$ is the curved surface of a hemisphere. A sphere has twice that.",
        },
      ],
      figure: solid("sphere", "cm", { diameter: 2 * rad }),
    },
  };
}

// ============================================= 4. geometric-design-constraint
function boxesWithVolume(v: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let l = 1; l * l * l <= v; l++)
    for (let w = l; l * w * w <= v; w++)
      if (v % (l * w) === 0) out.push([l, w, v / (l * w)]);
  return out;
}
const boxArea = ([l, w, h]: [number, number, number]) =>
  2 * (l * w + l * h + w * h);

function designCase(
  r: Random,
  forced?: number,
): { variant: number; built: Built } {
  const variant = forced ?? r(0, 3);
  if (variant === 0) {
    const perimeter = pick(r, [24, 32, 40, 48]);
    const half = perimeter / 2;
    const widths = sample(
      r,
      Array.from({ length: perimeter / 4 - 1 }, (_, i) => i + 2),
      4,
    ).sort((a, b) => a - b);
    const best = widths[widths.length - 1]!;
    const dims = (w: number) => `${half - w} m by ${w} m`;
    return {
      variant,
      built: {
        prompt: `You have ${perimeter} m of fencing to enclose a rectangular pen, and you will use all of it. Which of these whole-number dimensions encloses the greatest area?`,
        hint: `The fence is the perimeter, ${perimeter} m, so length plus width is ${half} m for every option. Find the area, length × width, of each option and compare.`,
        explanation: [
          `All of the fence is used, so length + width = ${perimeter} ÷ 2 = ${half} m for every option.`,
          ...widths.map(
            (w) => `${dims(w)}: area ${(half - w) * w} square meters.`,
          ),
          `The greatest area is ${(half - best) * best} square meters, from ${dims(best)}.`,
        ],
        correct: dims(best),
        wrong: widths.slice(0, -1).map((w) => ({
          label: dims(w),
          feedback: `This pen encloses ${(half - w) * w} square meters. Another option, with its sides closer in length, encloses more.`,
        })),
      },
    };
  }
  if (variant === 1) {
    const v = pick(r, [24, 36, 48, 60, 64, 72, 96, 120]);
    let options: [number, number, number][];
    let areas: number[];
    do {
      options = sample(r, boxesWithVolume(v), 4);
      areas = options.map(boxArea);
    } while (
      options.length < 4 ||
      areas.filter((a) => a === Math.min(...areas)).length !== 1
    );
    const best = Math.min(...areas);
    const name = (b: [number, number, number]) =>
      `${b[0]} × ${b[1]} × ${b[2]} cm`;
    const index = areas.indexOf(best);
    return {
      variant,
      built: {
        prompt: `A box must hold exactly ${v} cm³ and is made from cardboard, so the box that uses the least cardboard is cheapest. Which of these boxes (length × width × height) uses the least cardboard?`,
        hint: `The cardboard is the box's surface area: $2(lw+lh+wh)$. First check that each option has volume ${v} cm³, then compute each one's surface area.`,
        explanation: [
          `Every option has volume ${v} cm³, so compare their surface areas $2(lw+lh+wh)$.`,
          ...options.map((b, i) => `${name(b)}: ${areas[i]} cm².`),
          `The least cardboard is ${best} cm², used by the ${name(options[index]!)} box.`,
        ],
        correct: name(options[index]!),
        wrong: options
          .map((b, i) => ({
            label: name(b),
            feedback: `This box needs ${areas[i]} cm² of cardboard, more than the best option, ${best} cm².`,
            i,
          }))
          .filter((w) => w.i !== index),
      },
    };
  }
  if (variant === 2) {
    const wallW = r(6, 12);
    const wallH = r(3, 5);
    const winW = r(1, 3);
    const winH = r(1, 2);
    const rate = pick(r, [4, 5, 6, 8, 10, 12]);
    const painted = wallW * wallH - winW * winH;
    return {
      variant,
      built: {
        prompt: `A wall is ${wallW} m wide and ${wallH} m tall. A window ${winW} m wide and ${winH} m tall is not painted. Paint costs ${rate} dollars per square meter. How much does it cost to paint the rest of the wall?`,
        hint: `Cost = area to paint × price per square meter, ${rate} dollars here. The area to paint is the area of the ${wallW} m by ${wallH} m wall minus the area of the ${winW} m by ${winH} m window; find both rectangle areas first.`,
        explanation: [
          `Wall area: ${wallW} × ${wallH} = ${wallW * wallH} square meters. Window area: ${winW} × ${winH} = ${winW * winH} square meters.`,
          `Painted area: ${wallW * wallH} − ${winW * winH} = ${painted} square meters.`,
          `Cost: ${painted} × ${rate} = ${painted * rate} dollars.`,
        ],
        correct: `${painted * rate} dollars`,
        wrong: [
          {
            label: `${wallW * wallH * rate} dollars`,
            feedback:
              "That prices the whole wall. The window is not painted, so subtract its area first.",
          },
          {
            label: `${winW * winH * rate} dollars`,
            feedback:
              "That is the cost to paint only the window, which is the part that is not painted.",
          },
          {
            label: `${painted} dollars`,
            feedback:
              "That is the painted area in square meters. Multiply by the price per square meter.",
          },
          {
            label: `${(wallW - winW) * (wallH - winH) * rate} dollars`,
            feedback:
              "Subtract the window's area, width times height, not its width and height separately from the wall's sides.",
          },
          {
            label: `${2 * (wallW + wallH) * rate} dollars`,
            feedback:
              "Painting covers area. The perimeter measures only the distance around the wall.",
          },
        ],
      },
    };
  }
  const fence = pick(r, [24, 48]);
  const best = fence / 4;
  const square = fence / 3;
  const others = sample(
    r,
    Array.from({ length: fence / 2 - 2 }, (_, i) => i + 2).filter(
      (w) => w !== best && w !== square,
    ),
    2,
  );
  const widths = [best, square, ...others].sort((a, b) => a - b);
  const area = (w: number) => w * (fence - 2 * w);
  const name = (w: number) => `Width ${w} m, length ${fence - 2 * w} m`;
  return {
    variant: 3,
    built: {
      prompt: `A rectangular garden will be built against the straight wall of a barn, so fence is needed on only three sides: two sides of equal width and one side parallel to the barn. You have ${fence} m of fence and will use all of it. Which option encloses the greatest area?`,
      hint: `With width $w$, the two width sides use $2w$ of the ${fence} m, so the length parallel to the barn is $${fence}-2w$. Find the area $w(${fence}-2w)$ for each option and compare.`,
      explanation: [
        `For width $w$, the length is $${fence}-2w$ and the area is $w(${fence}-2w)$.`,
        ...widths.map((w) => `${name(w)}: area ${area(w)} square meters.`),
        `The greatest area is ${area(best)} square meters, with a width of ${best} m. The best garden is not a square, because only three sides need fence.`,
      ],
      correct: name(best),
      wrong: widths
        .filter((w) => w !== best)
        .map((w) => ({
          label: name(w),
          feedback: `This garden encloses ${area(w)} square meters. With fence on only three sides, another option encloses more.`,
        })),
    },
  };
}

// ============================================ 5. cavalieri-volume-reasoning
const OBLIQUE: [number, number, number][] = [
  [8, 6, 10],
  [12, 5, 13],
  [6, 8, 10],
  [12, 9, 15],
];
function obliqueScene(rad: number, h: number, shift: number, s: number): Scene {
  const w = 2 * rad;
  const bl: Point = [0, 0];
  const br: Point = [w, 0];
  const tl: Point = [shift, h];
  const tr: Point = [w + shift, h];
  return scene(
    { type: "polygon", points: [bl, br, tr, tl], fill: "none" },
    line(tl, [shift, 0], { dash: "dash", stroke: "accent" }),
    label(mid(bl, br), `diameter ${w} cm`, "below"),
    label([shift, h / 2], `${h} cm`, "left", { color: "accent" }),
    label(mid(br, tr), `${s} cm`, "right"),
  ).build({ title: "Side view of an oblique cylinder" });
}

function cavalieriCase(
  r: Random,
  forced?: number,
): { variant: number; built: Built } {
  const variant = forced ?? r(0, 3);
  if (variant === 0) {
    const [h, shift, s] = pick(r, OBLIQUE);
    const rad = r(Math.ceil(shift / 2), Math.ceil(shift / 2) + 3);
    const c = rad * rad * h;
    return {
      variant,
      built: {
        prompt: `An oblique (slanted) cylinder has circular bases of radius ${rad} cm. Its perpendicular height is ${h} cm and its slanted side is ${s} cm long, as in the side view. What is its volume, in cubic centimeters? Give the volume in terms of $\\pi$.`,
        hint: `Slide the slices of the oblique cylinder back into a straight stack: each horizontal slice is still a circle of radius ${rad} cm. By Cavalieri's principle the volume is the same as a right cylinder with that base and the perpendicular height.`,
        explanation: [
          `Every horizontal slice of the oblique cylinder is a circle of radius ${rad} cm, the same as every slice of a right cylinder with radius ${rad} cm and height ${h} cm.`,
          "Equal cross-sectional areas at every height mean equal volumes (Cavalieri's principle), so the volumes are equal.",
          `The slanted side is not a height. $V=\\pi r^2h=\\pi(${rad})^2(${h})=${piTex(c)}$ cm³.`,
        ],
        correct: `${math(piTex(c))} cm³`,
        wrong: [
          {
            label: `${math(piTex(rad * rad * s))} cm³`,
            feedback:
              "The slanted side is longer than the height. Volume uses the perpendicular height.",
          },
          {
            label: `${math(piTex(c, 3))} cm³`,
            feedback:
              "An oblique cylinder is not a cone. Its volume equals base area times perpendicular height.",
          },
          {
            label: `${math(piTex(rad * rad * s, 3))} cm³`,
            feedback:
              "Neither the slant length nor a factor of one third applies to a cylinder.",
          },
          {
            label: `${math(piTex(2 * rad * h))} cm³`,
            feedback:
              "$2\\pi rh$ is a curved surface area for a right cylinder, not a volume.",
          },
        ],
        figure: { kind: "scene", scene: obliqueScene(rad, h, shift, s) },
      },
    };
  }
  if (variant === 1) {
    const hgt = r(6, 15);
    const area = pick(r, [25, 36, 49, 64, 81]);
    const hgt2 = hgt + r(2, 5);
    const area2 = area + r(5, 12);
    const solids = sample(r, ["square prism", "cylinder"], 2);
    return {
      variant,
      built: {
        prompt: `Which pair of solids must have equal volumes?`,
        hint: `Cavalieri's principle needs two solids of the same height whose slices at every height have equal area. A prism or cylinder has the same slice at every height; ask whether the other solid in each pair does too.`,
        explanation: [
          "Cavalieri's principle: if two solids have the same height and every horizontal slice at the same height has equal area, their volumes are equal.",
          `A ${solids[0]} and a ${solids[1]} that are each ${hgt} cm tall with base area ${area} cm² have the same slice area, ${area} cm², at every height.`,
          "The other pairs differ in height, or in slice area at some height, so the principle does not apply.",
        ],
        correct: `A ${solids[0]} and a ${solids[1]}, each ${hgt} cm tall with base area ${area} cm²`,
        wrong: [
          {
            label: `A ${solids[0]} and a square pyramid, each ${hgt} cm tall with base area ${area} cm²`,
            feedback:
              "A pyramid's slices shrink toward the top, so its slices are smaller than the prism's. The volumes differ.",
          },
          {
            label: `A ${solids[0]} that is ${hgt} cm tall and a ${solids[1]} that is ${hgt2} cm tall, each with base area ${area} cm²`,
            feedback:
              "Cavalieri's principle requires the same height. The taller solid has more volume.",
          },
          {
            label: `A ${solids[0]} and a ${solids[1]}, each ${hgt} cm tall, with base areas ${area} cm² and ${area2} cm²`,
            feedback:
              "Slices of different area at the same height give different volumes.",
          },
        ],
      },
    };
  }
  if (variant === 2) {
    const n = r(10, 30);
    const l = pick(r, [8, 10, 12]);
    const w = pick(r, [5, 6]);
    const t = pick(r, [1, 2, 3]);
    return {
      variant,
      built: {
        prompt: `${n} identical foam sheets, each a rectangle ${l} cm by ${w} cm and ${t} cm thick, are stacked straight. The stack is then pushed sideways so that it leans, with each sheet sliding a little past the one below it. What is the volume of the leaning stack, in cubic centimeters?`,
        hint: `Sliding the sheets sideways changes the shape but not the area of any horizontal slice, which is always one sheet's ${l} cm by ${w} cm rectangle. Compare with the straight stack of ${n} sheets.`,
        explanation: [
          `Each horizontal slice of the leaning stack is ${article(l)} ${l} cm by ${w} cm rectangle, the same as in the straight stack.`,
          `By Cavalieri's principle the volumes are equal. One sheet has volume ${l} × ${w} × ${t} = ${l * w * t} cm³.`,
          `${n} sheets: ${n} × ${l * w * t} = ${n * l * w * t} cm³.`,
        ],
        correct: `${n * l * w * t} cm³`,
        wrong: [
          {
            label: `${(n * l * w * t) / 2} cm³`,
            feedback:
              "Leaning does not remove volume: no sheet is cut or squeezed.",
          },
          {
            label: `${l * w * t} cm³`,
            feedback:
              "That is the volume of a single sheet. The stack has all of them.",
          },
          {
            label: `${n * l * w} cm³`,
            feedback: "Include the thickness of each sheet.",
          },
          {
            label: `${n * (l + w + t)} cm³`,
            feedback:
              "Volume multiplies length, width and height; it is not a sum.",
          },
        ],
      },
    };
  }
  const ratio = pick(r, [
    [2, 1],
    [3, 1],
    [4, 1],
    [1, 2],
    [3, 2],
    [1, 3],
  ] as const);
  const [n, d] = ratio;
  // A multiple of 18 keeps every distractor, including the squared ratio 1/9, a clean number.
  const base = d === 3 ? 18 * r(3, 14) : 6 * r(8, 40);
  const ratioText = d === 1 ? `${n} times` : n === 1 ? `1/${d}` : `${n}/${d}`;
  const answer = (base * n) / d;
  return {
    variant: 3,
    built: {
      prompt: `Solids $X$ and $Y$ are both 10 cm tall. At every height, the horizontal slice of $X$ has area ${ratioText} the area of the slice of $Y$ at that height. Solid $Y$ has a volume of ${base} cm³. What is the volume of solid $X$?`,
      hint: `Think of each solid as a stack of thin slices of the same thickness. If every slice of $X$ has ${ratioText} the area of the matching slice of $Y$, compare the two totals.`,
      explanation: [
        `Both solids are cut into slices of the same thickness at the same heights.`,
        `Each slice of $X$ has ${ratioText} the area of the matching slice of $Y$, so each slice has ${ratioText} the volume, and the total is ${ratioText} as well.`,
        `Volume of $X$ = ${base} × ${n}${d === 1 ? "" : `/${d}`} = ${answer} cm³.`,
      ],
      correct: `${answer} cm³`,
      wrong: [
        {
          label: `${(base * d) / n} cm³`,
          feedback:
            "This inverts the ratio. Slices with more area give more volume.",
        },
        {
          label: `${(base * n * n) / (d * d)} cm³`,
          feedback:
            "Areas of slices scale volume by the same factor; squaring is for turning a length ratio into an area ratio.",
        },
        {
          label: `${base} cm³`,
          feedback:
            "Equal heights do not make the volumes equal. The slices have different areas.",
        },
      ],
    },
  };
}

// =========================================== 6. section-revolution-solid
type Axis = "vertical" | "horizontal";
function rectScene(w: number, h: number, axis: Axis): Scene {
  const axisLine =
    axis === "vertical"
      ? line([0, -0.6], [0, h + 0.6], {
          dash: "dash",
          stroke: "accent",
          width: 2,
        })
      : line([-0.6, 0], [w + 0.6, 0], {
          dash: "dash",
          stroke: "accent",
          width: 2,
        });
  return scene(
    {
      type: "polygon",
      points: [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ],
      fill: "none",
    },
    axisLine,
    label([w / 2, 0], `${w} cm`, axis === "vertical" ? "below" : "above"),
    label([w, h / 2], `${h} cm`, "right"),
    label(
      axis === "vertical" ? [0, h + 0.6] : [w + 0.6, 0],
      "axis",
      axis === "vertical" ? "above" : "right",
      { color: "accent" },
    ),
  ).build({
    title: `Rectangle ${w} cm by ${h} cm and the line it rotates about`,
  });
}
function triangleScene(a: number, b: number, axis: Axis): Scene {
  // Legs a (vertical) and b (horizontal); the right angle is at the origin.
  const axisLine =
    axis === "vertical"
      ? line([0, -0.6], [0, a + 0.6], {
          dash: "dash",
          stroke: "accent",
          width: 2,
        })
      : line([-0.6, 0], [b + 0.6, 0], {
          dash: "dash",
          stroke: "accent",
          width: 2,
        });
  const k = 0.35;
  return scene(
    {
      type: "polygon",
      points: [
        [0, 0],
        [b, 0],
        [0, a],
      ],
      fill: "none",
    },
    {
      type: "polyline",
      points: [
        [k, 0],
        [k, k],
        [0, k],
      ],
    },
    axisLine,
    label([b / 2, 0], `${b} cm`, axis === "vertical" ? "below" : "above"),
    label([0, a / 2], `${a} cm`, axis === "vertical" ? "right" : "left"),
    label(
      axis === "vertical" ? [0, a + 0.6] : [b + 0.6, 0],
      "axis",
      axis === "vertical" ? "above" : "right",
      { color: "accent" },
    ),
  ).build({ title: "Right triangle and the line it rotates about" });
}
function semiScene(rad: number): Scene {
  return scene(
    { type: "arc", center: [0, 0], r: rad, from: 0, to: 180 },
    line([-rad - 0.8, 0], [rad + 0.8, 0], {
      dash: "dash",
      stroke: "accent",
      width: 2,
    }),
    label([rad / 2, 0], `radius ${rad} cm`, "below"),
    label([rad + 0.8, 0], "axis", "right", { color: "accent" }),
  ).build({ title: `Semicircle of radius ${rad} cm and its diameter` });
}
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [9, 12, 15],
];
const SECTIONS: [string, string, number][] = [
  ["A plane parallel to the base cuts a cone.", "Circle", 0],
  ["A plane parallel to the bases cuts a cylinder.", "Circle", 0],
  [
    "A plane contains the axis of a cylinder and is perpendicular to its bases.",
    "Rectangle",
    2,
  ],
  [
    "A plane contains the axis of a cone, so it passes through the apex and the center of the base.",
    "Triangle",
    3,
  ],
  [
    "A plane cuts a sphere at any location where it meets the sphere.",
    "Circle",
    0,
  ],
  [
    "A plane tilted to the axis cuts all the way across the curved side of a cylinder, meeting neither base.",
    "Ellipse",
    1,
  ],
];
const SECTION_SHAPES = ["Circle", "Ellipse", "Rectangle", "Triangle"];
const SECTION_NOTES: Record<string, string> = {
  Circle:
    "A circle appears when a plane is perpendicular to the axis of a cone or cylinder, or cuts a sphere anywhere.",
  Ellipse:
    "An ellipse appears when a plane tilted to the axis cuts all the way around the curved side of a cylinder or cone.",
  Rectangle:
    "A rectangle appears when a plane contains the axis of a cylinder, or is parallel to it.",
  Triangle:
    "A triangle appears when a plane contains the axis of a cone, passing through its apex.",
};

function revolutionCase(
  r: Random,
  forced?: number,
): { variant: number; built: Built } {
  const variant = forced ?? r(0, 5);
  const axis: Axis = r(0, 1) ? "vertical" : "horizontal";
  const cm = (n: number) => `${n} cm`;
  if (variant === 0) {
    let w: number, h: number;
    do {
      w = r(2, 9);
      h = r(2, 9);
    } while (w === h);
    // Axis along a side: that side is the height, the other is the radius.
    const [rad, ht] = axis === "vertical" ? [w, h] : [h, w];
    const label = (rr: number, hh: number, kind = "cylinder") =>
      `A ${kind} with radius ${cm(rr)} and height ${cm(hh)}`;
    return {
      variant,
      built: {
        prompt: `A rectangle ${w} cm wide and ${h} cm tall is rotated one full turn about the dashed line shown. Which solid does it sweep out?`,
        hint: `The rectangle's sides are ${cm(w)} and ${cm(h)}. Picture the side along the dashed line staying in place while the opposite side sweeps a circle around it. The length of the side on the line becomes one dimension of the solid; the side perpendicular to the line becomes the other.`,
        explanation: [
          `The dashed line contains a side of length ${cm(ht)}. That side stays fixed and becomes the height.`,
          `The perpendicular side of ${cm(rad)} sweeps out a circle, so it becomes the radius.`,
          `The solid is a cylinder with radius ${cm(rad)} and height ${cm(ht)}.`,
        ],
        correct: label(rad, ht),
        wrong: [
          {
            label: label(ht, rad),
            feedback:
              "The side on the dashed line becomes the height; the side perpendicular to it becomes the radius.",
          },
          {
            label: label(rad, ht, "cone"),
            feedback:
              "A rectangle sweeps out a cylinder. A cone comes from rotating a triangle.",
          },
          {
            label: `A cylinder with diameter ${cm(rad)} and height ${cm(ht)}`,
            feedback:
              "The side that sweeps the circle is the radius, not the diameter.",
          },
        ],
        figure: { kind: "scene", scene: rectScene(w, h, axis) },
      },
    };
  }
  if (variant === 1 || variant === 4) {
    const [p, q, hyp] = pick(r, TRIPLES);
    const [a, b] = r(0, 1) ? [p, q] : [q, p];
    // a is the vertical leg, b the horizontal leg; the axis contains one leg.
    const [axisLeg, radius] = axis === "vertical" ? [a, b] : [b, a];
    if (variant === 1)
      return {
        variant,
        built: {
          prompt: `A right triangle has legs of ${cm(a)} and ${cm(b)}. It is rotated one full turn about the dashed line, which contains one leg. Which solid does it sweep out?`,
          hint: `The legs are ${cm(a)} and ${cm(b)}. The leg on the dashed line stays fixed. The other leg is perpendicular to it and sweeps out a circle; the hypotenuse sweeps out the slanted side.`,
          explanation: [
            `The dashed line contains the leg of ${cm(axisLeg)}, which stays fixed and becomes the height.`,
            `The other leg, ${cm(radius)}, is perpendicular to it and sweeps out the circular base, so it is the radius.`,
            `The hypotenuse sweeps the slanted side. The solid is a cone with radius ${cm(radius)} and height ${cm(axisLeg)}.`,
          ],
          correct: `A cone with radius ${cm(radius)} and height ${cm(axisLeg)}`,
          wrong: [
            {
              label: `A cone with radius ${cm(axisLeg)} and height ${cm(radius)}`,
              feedback:
                "The leg on the dashed line is the height; the other leg is the radius.",
            },
            {
              label: `A cylinder with radius ${cm(radius)} and height ${cm(axisLeg)}`,
              feedback:
                "A triangle narrows to a point. Rotating it makes a cone; a rectangle makes a cylinder.",
            },
            {
              label: `A cone with radius ${cm(radius)} and height ${cm(hyp)}`,
              feedback:
                "The hypotenuse is the slant length of the cone, not its height.",
            },
          ],
          figure: { kind: "scene", scene: triangleScene(a, b, axis) },
        },
      };
    const v = (radius * radius * axisLeg) / 3;
    return {
      variant,
      built: {
        prompt: `A right triangle has legs of ${cm(a)} and ${cm(b)}. It is rotated one full turn about the dashed line, which contains one leg. What is the volume of the solid, in cubic centimeters? Give the volume in terms of $\\pi$.`,
        hint: `The solid is a cone from legs of ${cm(a)} and ${cm(b)}. The leg on the dashed line is its height and the other leg is its radius; use $V=\\tfrac13\\pi r^2h$.`,
        explanation: [
          `The leg on the dashed line, ${cm(axisLeg)}, is the height. The other leg, ${cm(radius)}, is the radius of the cone.`,
          `$V=\\tfrac13\\pi r^2h=\\tfrac13\\pi(${radius})^2(${axisLeg})=${piTex(v)}$ cm³.`,
        ],
        correct: `${math(piTex(v))} cm³`,
        wrong: [
          {
            label: `${math(piTex(radius * radius * axisLeg))} cm³`,
            feedback:
              "A cone holds one third of the cylinder with the same base and height.",
          },
          {
            label: `${math(piTex(axisLeg * axisLeg * radius, 3))} cm³`,
            feedback:
              "The radius is the leg perpendicular to the dashed line; the leg on it is the height.",
          },
          {
            label: `${math(piTex(radius * radius * hyp, 3))} cm³`,
            feedback:
              "The hypotenuse is the slant length. Use the perpendicular height, the leg on the dashed line.",
          },
        ],
        figure: { kind: "scene", scene: triangleScene(a, b, axis) },
      },
    };
  }
  if (variant === 2) {
    const rad = pick(r, [4, 5, 9]);
    const c = 4 * rad ** 3;
    return {
      variant,
      built: {
        prompt: `A semicircle with radius ${cm(rad)} is rotated one full turn about its diameter, the dashed line. What is the volume of the solid, in cubic centimeters? Give the volume in terms of $\\pi$.`,
        hint: `Rotating a semicircle about its diameter sweeps out a solid whose cross-sections are circles. Name the solid, then use its volume formula with the semicircle's radius of ${cm(rad)}.`,
        explanation: [
          `Every point of the semicircle is ${cm(rad)} from the center of the diameter, so the rotation sweeps out a sphere of radius ${cm(rad)}.`,
          `$V=\\tfrac43\\pi r^3=\\tfrac43\\pi(${rad})^3=${piTex(c, 3)}$ cm³.`,
        ],
        correct: `${math(piTex(c, 3))} cm³`,
        wrong: [
          {
            label: `${math(piTex(2 * rad ** 3, 3))} cm³`,
            feedback:
              "That is a hemisphere. Rotating the semicircle a full turn sweeps out the whole sphere.",
          },
          {
            label: `${math(piTex(4 * rad * rad))} cm³`,
            feedback:
              "$4\\pi r^2$ is the sphere's surface area. Volume uses the cube of the radius.",
          },
          {
            label: `${math(piTex(4 * (2 * rad) ** 3, 3))} cm³`,
            feedback:
              "The radius of the semicircle is the radius of the sphere; do not double it.",
          },
        ],
        figure: { kind: "scene", scene: semiScene(rad) },
      },
    };
  }
  if (variant === 3) {
    let w: number, h: number;
    do {
      w = r(2, 8);
      h = r(2, 8);
    } while (w === h);
    const [rad, ht] = axis === "vertical" ? [w, h] : [h, w];
    return {
      variant,
      built: {
        prompt: `A rectangle ${w} cm wide and ${h} cm tall is rotated one full turn about the dashed line. What is the volume of the solid, in cubic centimeters? Give the volume in terms of $\\pi$.`,
        hint: `The ${w} cm by ${h} cm rectangle makes a cylinder. The side on the dashed line is its height and the perpendicular side is its radius; use $V=\\pi r^2h$.`,
        explanation: [
          `The side on the dashed line, ${cm(ht)}, becomes the height; the perpendicular side, ${cm(rad)}, becomes the radius.`,
          `$V=\\pi r^2h=\\pi(${rad})^2(${ht})=${piTex(rad * rad * ht)}$ cm³.`,
        ],
        correct: `${math(piTex(rad * rad * ht))} cm³`,
        wrong: [
          {
            label: `${math(piTex(ht * ht * rad))} cm³`,
            feedback:
              "The side perpendicular to the dashed line is the radius; the side on it is the height.",
          },
          {
            label: `${math(piTex(rad * rad * ht, 3))} cm³`,
            feedback:
              "A rectangle makes a cylinder, which holds the full base area times the height. One third is for cones.",
          },
          {
            label: `${math(piTex(rad * ht))} cm³`,
            feedback: "The base area is $\\pi r^2$, so square the radius.",
          },
          {
            label: `${math(piTex(4 * rad * rad * ht))} cm³`,
            feedback:
              "The side perpendicular to the dashed line is the radius, not the diameter.",
          },
          {
            label: `${math(piTex(2 * rad * ht))} cm³`,
            feedback:
              "$2\\pi rh$ is the curved surface area. Volume is base area times height.",
          },
        ],
        figure: { kind: "scene", scene: rectScene(w, h, axis) },
      },
    };
  }
  const [text, shape] = (() => {
    const [t, s] = pick(r, SECTIONS);
    return [t, s];
  })();
  return {
    variant: 5,
    built: {
      prompt: `${text} What is the shape of the cross-section?`,
      hint: `Picture where the plane meets the surface of the solid. Ask whether the plane cuts across the axis, along the axis, or through the apex, and how the cut edge curves or runs straight.`,
      explanation: [
        text,
        SECTION_NOTES[shape]!,
        `So the cross-section is ${shape === "Ellipse" ? "an" : "a"} ${shape.toLowerCase()}.`,
      ],
      correct: shape,
      wrong: SECTION_SHAPES.filter((s) => s !== shape).map((s) => ({
        label: s,
        feedback: SECTION_NOTES[s]!,
      })),
    },
  };
}

// ===================================== 7. similarity-theorem-length
function altitudePairs(): {
  exact: [number, number][];
  leg: [number, number][];
} {
  const exact: [number, number][] = [];
  const leg: [number, number][] = [];
  for (let p = 1; p <= 16; p++)
    for (let q = 1; q <= 27; q++) {
      if (p / q > 1 / 1.5 && p === q) continue;
      if (Math.max(p, q) / Math.min(p, q) > 9) continue;
      if (isSquare(p * q) && p !== q) exact.push([p, q]);
      if (isSquare(p * (p + q)) && p + q <= 30) leg.push([p, q]);
    }
  return { exact, leg };
}
const PAIRS = altitudePairs();

type AltitudeLabels = {
  ad?: string;
  db?: string;
  ab?: string;
  cd?: string;
  ac?: string;
};
/** Right triangle ABC (right angle at C) with the altitude CD to AB. Only the
 * given lengths and the one asked for appear; "?" marks the unknown. */
function altitudeScene(p: number, q: number, labels: AltitudeLabels): Scene {
  const hyp = p + q;
  const h = Math.sqrt(p * q);
  const A: Point = [0, 0];
  const B: Point = [hyp, 0];
  const C: Point = [p, h];
  const D: Point = [p, 0];
  const k = 0.05 * hyp;
  const toward = (from: Point, to: Point): Point => {
    const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return [(to[0] - from[0]) / d, (to[1] - from[1]) / d];
  };
  const ua = toward(C, A);
  const ub = toward(C, B);
  const m = 1.4 * k;
  const pa: Point = [C[0] + ua[0] * m, C[1] + ua[1] * m];
  const pb: Point = [C[0] + ub[0] * m, C[1] + ub[1] * m];
  const text = (
    value: string | undefined,
    at: Point,
    where: Anchor,
    color?: "accent" | "warm",
  ): Element[] =>
    value === undefined
      ? []
      : [
          label(at, value, where, {
            ...(color ? { color } : {}),
            derived: value === "?",
          }),
        ];
  return scene(
    { type: "polygon", points: [A, B, C], fill: "none" },
    line(C, D, { dash: "dash", stroke: "accent", width: 2 }),
    {
      type: "polyline",
      points: [
        [p - k, 0],
        [p - k, k],
        [p, k],
      ],
    },
    {
      type: "polyline",
      points: [pa, [pa[0] + ub[0] * m, pa[1] + ub[1] * m], pb],
    },
    label(A, "A", "left"),
    label(B, "B", "right"),
    label(C, "C", "above"),
    label(D, "D", "below"),
    ...text(labels.ad, [p / 2, 0], "below2", "warm"),
    ...text(labels.db, [p + q / 2, 0], "below2", "warm"),
    ...text(labels.ab, [hyp / 2, 0], "below3", "warm"),
    ...text(labels.cd, mid(C, D), "right", "accent"),
    ...text(labels.ac, mid(A, C), "left", "warm"),
  ).build({
    title: "Right triangle ABC with altitude CD to the hypotenuse",
  });
}

function splitterScene(
  a: number,
  b: number,
  c: number,
  e: number,
  unknown: "EC" | "DB",
): Scene {
  const t = a / (a + b);
  const A: Point = [4, 9];
  const B: Point = [0, 0];
  const C: Point = [11, 0];
  const D: Point = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
  const E: Point = [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t];
  const text = (n: number, isUnknown: boolean) => (isUnknown ? "?" : String(n));
  return scene(
    { type: "polygon", points: [A, B, C], fill: "none" },
    line(D, E, { stroke: "accent", width: 2.5 }),
    label(A, "A", "above"),
    label(B, "B", "left"),
    label(C, "C", "right"),
    label(D, "D", "left"),
    label(E, "E", "right"),
    label(mid(A, D), String(a), "left", { color: "warm" }),
    label(mid(D, B), text(b, unknown === "DB"), "left", {
      color: "warm",
      derived: unknown === "DB",
    }),
    label(mid(A, E), String(c), "right", { color: "warm" }),
    label(mid(E, C), text(e, unknown === "EC"), "right", {
      color: "warm",
      derived: unknown === "EC",
    }),
  ).build({ title: "Triangle ABC with DE parallel to BC" });
}

function similarityCase(
  r: Random,
  forced?: number,
): { variant: number; built: Built } {
  const variant = forced ?? r(0, 3);
  if (variant === 0) {
    const [p, q] = pick(r, PAIRS.exact);
    const h = Math.sqrt(p * q);
    return {
      variant,
      built: {
        prompt: `In right triangle $ABC$, the right angle is at $C$ and $CD$ is the altitude to the hypotenuse $AB$. $AD = ${p}$ and $DB = ${q}$. What is the length of $CD$?`,
        hint: `The altitude splits the triangle into two triangles similar to each other. In them, $CD$ is the long leg of one triangle and the short leg of the other: use the proportion $AD : CD = CD : DB$ with $AD = ${p}$ and $DB = ${q}$.`,
        explanation: [
          "Triangles $ADC$ and $CDB$ are similar: each has a right angle at $D$ and shares an acute angle with triangle $ABC$.",
          `Matching sides give $\\frac{AD}{CD}=\\frac{CD}{DB}$, so $CD^2=AD\\cdot DB=${p}\\cdot${q}=${p * q}$.`,
          `$CD=\\sqrt{${p * q}}=${h}$.`,
        ],
        correct: `${h}`,
        wrong: [
          {
            label: fq(p + q, 2),
            feedback:
              "The altitude is the geometric mean of the two segments, not their average: $CD^2=AD\\cdot DB$.",
          },
          {
            label: `${p * q}`,
            feedback:
              "$CD^2=AD\\cdot DB$, so take the square root of the product.",
          },
          {
            label: `${p + q}`,
            feedback:
              "That is the length of the hypotenuse $AB$, not of the altitude.",
          },
          {
            label: fq(p * q, p + q),
            feedback:
              "Use the similar-triangle proportion $AD : CD = CD : DB$, which gives $CD^2=AD\\cdot DB$.",
          },
        ],
        figure: {
          kind: "scene",
          scene: altitudeScene(p, q, { ad: String(p), db: String(q), cd: "?" }),
        },
      },
    };
  }
  if (variant === 1) {
    const [p, q] = pick(r, PAIRS.leg);
    const leg = Math.sqrt(p * (p + q));
    return {
      variant,
      built: {
        prompt: `In right triangle $ABC$, the right angle is at $C$ and $CD$ is the altitude to the hypotenuse $AB$. $AD = ${p}$ and $DB = ${q}$. What is the length of leg $AC$?`,
        hint: `Triangle $ACD$ is similar to the whole triangle $ABC$: they share angle $A$ and each has a right angle. Match $AC$ with $AB$ and $AD$ with $AC$ to set up a proportion, with $AD = ${p}$ and $DB = ${q}$.`,
        explanation: [
          "Triangles $ACD$ and $ABC$ are similar: they share angle $A$ and each has a right angle (at $D$ and at $C$).",
          `Matching sides give $\\frac{AC}{AB}=\\frac{AD}{AC}$, so $AC^2=AD\\cdot AB$.`,
          `$AB=${p}+${q}=${p + q}$, so $AC^2=${p}\\cdot${p + q}=${p * (p + q)}$ and $AC=${leg}$.`,
        ],
        correct: `${leg}`,
        wrong: [
          {
            label: rq(p * q),
            feedback:
              "That is the altitude $CD$. A leg is the geometric mean of the hypotenuse and the segment next to it: $AC^2=AD\\cdot AB$.",
          },
          {
            label: `${p + q}`,
            feedback:
              "That is the hypotenuse $AB$, which is longer than either leg.",
          },
          {
            label: `${p * (p + q)}`,
            feedback: "That is $AC^2$. Take the square root.",
          },
          {
            label: rq(q * (p + q)),
            feedback:
              "That is the other leg, $BC$. $AC$ goes with the segment $AD$.",
          },
        ],
        figure: {
          kind: "scene",
          scene: altitudeScene(p, q, { ad: String(p), db: String(q), ac: "?" }),
        },
      },
    };
  }
  if (variant === 2) {
    let a: number, b: number, e: number, c: number;
    do {
      a = r(2, 8);
      b = r(2, 9);
      const step = b / gcd(a, b);
      e = step * r(1, 3);
      c = (a * e) / b;
    } while (a === b || e > 12 || c > 14);
    const askEC = r(0, 1) === 1;
    const unknown = askEC ? "EC" : "DB";
    const ans = askEC ? e : b;
    return {
      variant,
      built: {
        prompt: `In triangle $ABC$, $D$ is on $AB$ and $E$ is on $AC$, and $DE$ is parallel to $BC$, as shown. ${askEC ? `$AD = ${a}$, $DB = ${b}$ and $AE = ${c}$.` : `$AD = ${a}$, $AE = ${c}$ and $EC = ${e}$.`} What is the length of $${unknown}$?`,
        hint: `A line parallel to one side of a triangle cuts the other two sides in the same ratio. Write $AD : DB = AE : EC$ with the three lengths you know (${askEC ? `${a}, ${b} and ${c}` : `${a}, ${c} and ${e}`}) and solve for $${unknown}$.`,
        explanation: [
          "Because $DE$ ∥ $BC$, triangle $ADE$ is similar to triangle $ABC$, and $DE$ divides sides $AB$ and $AC$ proportionally.",
          `$\\frac{AD}{DB}=\\frac{AE}{EC}$, so $\\frac{${a}}{${askEC ? b : "DB"}}=\\frac{${c}}{${askEC ? "EC" : e}}$.`,
          askEC
            ? `Cross-multiply: $${a}\\cdot EC=${b}\\cdot${c}$, so $EC=\\frac{${b * c}}{${a}}=${e}$.`
            : `Cross-multiply: $${c}\\cdot DB=${a}\\cdot${e}$, so $DB=\\frac{${a * e}}{${c}}=${b}$.`,
        ],
        correct: `${ans}`,
        wrong: askEC
          ? [
              {
                label: fq(a * c, b),
                feedback:
                  "The ratio is inverted. $AD$ matches $AE$ and $DB$ matches $EC$.",
              },
              {
                label: `${((a + b) * c) / a}`,
                feedback:
                  "That is the whole side $AC$. The question asks for the part $EC$.",
              },
              {
                label: `${b + c - a}`,
                feedback:
                  "The sides are in proportion; the differences are not equal.",
              },
              {
                label: fq(a * b, c),
                feedback: "Set up $AD : DB = AE : EC$ and solve for $EC$.",
              },
              {
                label: `${c}`,
                feedback:
                  "The ratios $AD : DB$ and $AE : EC$ are equal, but the lengths $AE$ and $EC$ need not be.",
              },
              {
                label: `${b * c}`,
                feedback:
                  "Cross-multiplying gives $a\\cdot EC=b\\cdot c$. Divide by $AD$ as well.",
              },
            ]
          : [
              {
                label: fq(c * e, a),
                feedback:
                  "The ratio is inverted. $AD$ matches $AE$ and $DB$ matches $EC$.",
              },
              {
                label: `${((c + e) * a) / c}`,
                feedback:
                  "That is the whole side $AB$. The question asks for the part $DB$.",
              },
              {
                label: `${a + e - c}`,
                feedback:
                  "The sides are in proportion; the differences are not equal.",
              },
              {
                label: fq(a * c, e),
                feedback: "Set up $AD : DB = AE : EC$ and solve for $DB$.",
              },
              {
                label: `${a}`,
                feedback:
                  "The ratios $AD : DB$ and $AE : EC$ are equal, but the lengths $AD$ and $DB$ need not be.",
              },
              {
                label: `${a * e}`,
                feedback:
                  "Cross-multiplying gives $AE\\cdot DB=AD\\cdot EC$. Divide by $AE$ as well.",
              },
            ],
        figure: { kind: "scene", scene: splitterScene(a, b, c, e, unknown) },
      },
    };
  }
  const [p, q] = pick(r, PAIRS.leg);
  const leg = Math.sqrt(p * (p + q));
  return {
    variant: 3,
    built: {
      prompt: `In right triangle $ABC$, the right angle is at $C$ and $CD$ is the altitude to the hypotenuse $AB$. $AC = ${leg}$ and $AB = ${p + q}$. What is the length of $AD$?`,
      hint: `Triangle $ACD$ is similar to triangle $ABC$ (they share angle $A$ and each has a right angle). The leg $AC = ${leg}$ is the geometric mean of $AD$ and $AB = ${p + q}$.`,
      explanation: [
        "Triangles $ACD$ and $ABC$ are similar, so $\\frac{AC}{AB}=\\frac{AD}{AC}$ and $AC^2=AD\\cdot AB$.",
        `$${leg}^2=AD\\cdot${p + q}$, so $AD=${leg * leg}\\div${p + q}=${p}$.`,
      ],
      correct: `${p}`,
      wrong: [
        {
          label: `${p + q - leg}`,
          feedback:
            "The relation is $AC^2=AD\\cdot AB$, not a difference of lengths.",
        },
        {
          label: rq(leg * (p + q)),
          feedback:
            "That takes a square root of the product of the known lengths. The relation is $AC^2=AD\\cdot AB$, so divide $AC^2$ by $AB$.",
        },
        {
          label: fq((p + q) * (p + q), leg),
          feedback:
            "The proportion is inverted: $AC^2=AD\\cdot AB$ gives $AD=AC^2\\div AB$.",
        },
        {
          label: `${q}`,
          feedback:
            "That is the other segment, $DB$. $AD$ is the segment next to $A$.",
        },
      ],
      figure: {
        kind: "scene",
        scene: altitudeScene(p, q, {
          ad: "?",
          ac: String(leg),
          ab: String(p + q),
        }),
      },
    },
  };
}

// ----------------------------------------------------------------- dispatch
type Builder = (
  r: Random,
  forced?: number,
) => { variant: number; built: Built };
const builders: Record<string, Builder> = {
  "solid-volume-context": volumeCase,
  "density-context": densityCase,
  "geometric-model-choice": modelCase,
  "geometric-design-constraint": designCase,
  "cavalieri-volume-reasoning": cavalieriCase,
  "section-revolution-solid": revolutionCase,
  "similarity-theorem-length": similarityCase,
};
export const geometryModelingVariantCounts: Record<string, number> = {
  "solid-volume-context": 7,
  "density-context": 7,
  "geometric-model-choice": 5,
  "geometric-design-constraint": 4,
  "cavalieri-volume-reasoning": 4,
  "section-revolution-solid": 6,
  "similarity-theorem-length": 4,
};

/** Private exact model: the variant and the problem. `forced` picks a variant. */
export function geometryModelingCase(
  id: string,
  seed: string,
  forced?: number,
): { variant: number; problem: GeneratedProblem } {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = geometryModelingTemplates.find((t) => t.id === id);
  const build = builders[id];
  if (!meta || !build)
    throw new Error(`Unknown geometry modeling template ${id}`);
  const r = random(id, seed);
  const { variant, built } = build(r, forced);
  return { variant, problem: finish(meta, seed, r, built) };
}

export const generateGeometryModelingProblem = (
  id: string,
  seed: string,
): GeneratedProblem => geometryModelingCase(id, seed).problem;
