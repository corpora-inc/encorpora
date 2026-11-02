import type { SimilarTrianglesFigure, TemplateMetadata } from "./contracts";
import { chainFamily, decimalText, dispatch, gcd, pick } from "./chain-kit";
import { workModeAxisNoOrder } from "./structured-work-kit";
import { rowsWork, workSurface, type RowSpec } from "./structured-work-rows";
import { defineAxis } from "./variation/axes";

/**
 * Written work for multipart constructed responses that ask "show or explain
 * how you got your answer" about measurements: the unknown angle, scale
 * factor and sides of similar triangles, the actual length and area and a
 * second scale of a scale drawing, and numbers in scientific notation with
 * their quotient and product. Each part is a labeled exact step, graded on
 * the server; a written explanation in words is not scored.
 */

const capability = "structured-work-v1" as const;
export const mcasWrittenWorkTemplates: readonly TemplateMetadata[] = [
  {
    id: "similar-triangles-work",
    version: 1,
    title: "Show the work: angle, scale factor and sides of similar triangles",
    skillId: "dilations-similarity",
    gradeBand: "9–12",
    difficultyOffset: 0.3,
    requiredResponseCapability: capability,
    requiredFigureCapability: "geometry-figures-v1",
    description:
      "From two angles of one triangle, its three sides and one side of a similar triangle, find the matching angle, the scale factor and the two other sides, entering each step.",
  },
  {
    id: "scale-drawing-work",
    version: 1,
    title: "Show the work: lengths, areas and a new scale",
    skillId: "scale-drawings",
    gradeBand: "6–8",
    difficultyOffset: 0.3,
    requiredResponseCapability: capability,
    description:
      "From a scale drawing of a rectangle, find the actual length and area, find the scale of a second drawing from its length and the width of that drawing, entering each step.",
  },
  {
    id: "scientific-notation-work",
    version: 1,
    title: "Show the work: scientific notation, quotients and products",
    skillId: "scientific-notation",
    gradeBand: "6–8",
    difficultyOffset: 0.3,
    requiredResponseCapability: capability,
    description:
      "Write a large and a small number in scientific notation, find how many times greater one number in scientific notation is than another, and find a total in scientific notation, entering each step.",
  },
];

const task = (mode: "build" | "fill") =>
  mode === "build"
    ? "Enter each step."
    : "Some steps are filled in. Enter the others.";
const num = (value: string, unit?: string) =>
  ({
    caption: "Number",
    kind: "number" as const,
    value,
    ...(unit ? { unit } : {}),
  }) as const;

/* ------------------------------------------------------ similar triangles */

interface TriModel {
  direction: "enlarge" | "reduce";
  p: number; // second triangle's multiplier
  q: number; // first triangle's multiplier
  base: [number, number, number];
  angles: [number, number];
  known: number; // which second-triangle side is given
  unit: "cm" | "m" | "in" | "ft";
  names: readonly [string, string];
}
const triangleNames = [
  ["ABC", "DEF"],
  ["PQR", "STU"],
  ["JKL", "MNP"],
  ["ABC", "XYZ"],
] as const;
const factors: [number, number][] = [
  [2, 1],
  [3, 1],
  [4, 1],
  [3, 2],
  [5, 2],
  [4, 3],
  [5, 3],
];
const similar = chainFamily({
  template: mcasWrittenWorkTemplates[0]!,
  axes: {
    mode: workModeAxisNoOrder,
    direction: defineAxis("direction", ["enlarge", "reduce"] as const),
  },
  model: (r, axes): TriModel => {
    const base: [number, number, number] = [r(2, 7), r(2, 7), r(2, 7)];
    const [s0, s1, s2] = base;
    if (new Set(base).size < 3) throw new Error("Need three retry");
    if (s0 + s1 <= s2 || s0 + s2 <= s1 || s1 + s2 <= s0)
      throw new Error("Need three retry");
    const [a, b] = pick(r, factors);
    const alpha = r(3, 12) * 5;
    const beta = r(3, 12) * 5;
    if (alpha + beta >= 150 || alpha === beta)
      throw new Error("Need three retry");
    return {
      direction: axes.direction,
      p: axes.direction === "enlarge" ? a : b,
      q: axes.direction === "enlarge" ? b : a,
      base,
      angles: [alpha, beta],
      known: r(0, 2),
      unit: pick(r, ["cm", "m", "in", "ft"] as const),
      names: pick(r, triangleNames),
    };
  },
  render: (m, axes, r) => {
    const [first, second] = m.names;
    const first3 = m.base.map((s) => s * m.q) as [number, number, number];
    const second3 = m.base.map((s) => s * m.p) as [number, number, number];
    const side = (t: string, i: number) => `${t[i]}${t[(i + 1) % 3]}`;
    const [x, y] = [0, 1, 2].filter((i) => i !== m.known) as [number, number];
    const g = gcd(m.p, m.q);
    const factor = `${m.p / g}/${m.q / g}`;
    const factorTex =
      m.q / g === 1 ? `${m.p / g}` : `\\frac{${m.p / g}}{${m.q / g}}`;
    const [alpha, beta] = m.angles;
    const third = 180 - alpha - beta;
    const rows: RowSpec[] = [
      {
        label: `Measure of $\\angle ${second[2]}$, in degrees`,
        fields: [num(`${third}`, "°")],
      },
      {
        label: `Scale factor from triangle $${first}$ to triangle $${second}$`,
        fields: [num(factor)],
      },
      {
        label: `Length of $${side(second, x)}$, in ${m.unit}`,
        fields: [num(`${second3[x]}`)],
      },
      {
        label: `Length of $${side(second, y)}$, in ${m.unit}`,
        fields: [num(`${second3[y]}`)],
      },
    ];
    const built = rowsWork(rows, axes.mode, r, "Your work");
    const secondSides: SimilarTrianglesFigure["triangles"][number]["sides"] = [
      null,
      null,
      null,
    ];
    secondSides[m.known] = second3[m.known]!;
    secondSides[x] = "?";
    secondSides[y] = "?";
    const kn = m.known;
    return workSurface(built, {
      prompt: `Triangle $${first}$ is similar to triangle $${second}$, with ${[...first].map((v, i) => `$${v}$ corresponding to $${second[i]}$`).join(", ")}. In triangle $${first}$, $\\angle ${first[0]}=${alpha}^\\circ$ and $\\angle ${first[1]}=${beta}^\\circ$. The sides of triangle $${first}$ are $${side(first, 0)}=${first3[0]}$, $${side(first, 1)}=${first3[1]}$ and $${side(first, 2)}=${first3[2]}$ ${m.unit}, and $${side(second, kn)}=${second3[kn]}$ ${m.unit}. ${task(axes.mode)}`,
      hint: `Corresponding angles of similar triangles are equal, and the three angles of a triangle add to $180^\\circ$. The scale factor compares a side of triangle $${second}$ with its corresponding side $${side(first, kn)}$ of triangle $${first}$: ${second3[kn]} and ${first3[kn]} ${m.unit}.`,
      explanation: [
        `The angles of triangle $${first}$ add to $180^\\circ$, so $\\angle ${first[2]}=180-${alpha}-${beta}=${third}^\\circ$. Corresponding angles are equal, so $\\angle ${second[2]}=${third}^\\circ$.`,
        `Scale factor from $${first}$ to $${second}$: $\\frac{${side(second, kn)}}{${side(first, kn)}}=\\frac{${second3[kn]}}{${first3[kn]}}=${factorTex}$.`,
        `Each side of $${second}$ is $${factorTex}$ times its corresponding side: $${side(second, x)}=${first3[x]}\\times${factorTex}=${second3[x]}$ ${m.unit}.`,
        `$${side(second, y)}=${first3[y]}\\times${factorTex}=${second3[y]}$ ${m.unit}.`,
      ],
      figure: {
        kind: "similar-triangles",
        unit: m.unit,
        triangles: [
          {
            vertices: [first[0]!, first[1]!, first[2]!],
            sides: first3,
          },
          {
            vertices: [second[0]!, second[1]!, second[2]!],
            sides: secondSides,
          },
        ],
      },
    });
  },
  variant: (m) => m.direction,
});

/* ---------------------------------------------------------- scale drawing */

interface ScaleModel {
  system: "feet-inches" | "meters-centimeters";
  rooms: { what: string; owner: string };
  lengthTenths: number; // first drawing length, tenths of a unit
  widthTenths: number;
  perUnit: number; // actual units for 1 unit of the first drawing
  perNew: number; // actual units for 1 unit of the new drawing
}
const rooms = [
  { what: "classroom floor", owner: "An architect" },
  { what: "gym floor", owner: "A surveyor" },
  { what: "community garden", owner: "A landscaper" },
  { what: "stage", owner: "A set designer" },
] as const;
const systems = {
  "feet-inches": {
    first: { short: "cm", long: "centimeters" },
    actual: {
      short: "ft",
      long: "feet",
      area: "square feet",
      areaShort: "sq ft",
    },
    next: { short: "in", long: "inches" },
  },
  "meters-centimeters": {
    first: { short: "in", long: "inches" },
    actual: {
      short: "m",
      long: "meters",
      area: "square meters",
      areaShort: "sq m",
    },
    next: { short: "cm", long: "centimeters" },
  },
} as const;
const one: Record<string, string> = {
  cm: "centimeter",
  in: "inch",
  ft: "foot",
  m: "meter",
};
const scaleDrawing = chainFamily({
  template: mcasWrittenWorkTemplates[1]!,
  axes: {
    mode: workModeAxisNoOrder,
    system: defineAxis("system", [
      "feet-inches",
      "meters-centimeters",
    ] as const),
  },
  model: (r, axes): ScaleModel => {
    const perUnit = pick(r, [2, 3, 4, 5, 6, 8]);
    // Drawing sizes in tenths that make the actual sizes whole numbers.
    const step = 10 / gcd(10, perUnit);
    const lengthTenths = step * r(Math.ceil(30 / step), Math.floor(90 / step));
    const widthTenths =
      step * r(Math.ceil(20 / step), Math.floor((lengthTenths - 5) / step));
    if (widthTenths < 20) throw new Error("Need three retry");
    const perNew =
      axes.system === "feet-inches"
        ? pick(r, [4, 5, 8, 10, 16, 20, 25])
        : pick(r, [2, 4, 5, 8, 10]);
    if (perNew === perUnit) throw new Error("Need three retry");
    const L = (lengthTenths * perUnit) / 10;
    const W = (widthTenths * perUnit) / 10;
    // No answer or given of 1, which would need singular unit words.
    if ([L / perNew, W / perNew, L, W].some((v) => v === 1))
      throw new Error("Need three retry");
    return {
      system: axes.system,
      rooms: pick(r, rooms),
      lengthTenths,
      widthTenths,
      perUnit,
      perNew,
    };
  },
  render: (m, axes, r) => {
    const u = systems[m.system];
    const length = decimalText(m.lengthTenths, 10);
    const width = decimalText(m.widthTenths, 10);
    const L = (m.lengthTenths * m.perUnit) / 10;
    const W = (m.widthTenths * m.perUnit) / 10;
    const newLength = decimalText(L, m.perNew);
    const newWidth = decimalText(W, m.perNew);
    const rows: RowSpec[] = [
      {
        label: `Actual length of the ${m.rooms.what}, in ${u.actual.long}`,
        fields: [num(`${L}`, u.actual.short)],
      },
      {
        label: `Actual area of the ${m.rooms.what}, in ${u.actual.area}`,
        fields: [num(`${L * W}`, u.actual.areaShort)],
      },
      {
        label: `Scale of the new drawing: 1 ${one[u.next.short]} stands for how many ${u.actual.long}`,
        fields: [num(`${m.perNew}`, u.actual.short)],
      },
      {
        label: `Width of the new drawing, in ${u.next.long}`,
        fields: [num(newWidth, u.next.short)],
      },
    ];
    const built = rowsWork(rows, axes.mode, r, "Your work");
    return workSurface(built, {
      prompt: `${m.rooms.owner} draws a scale drawing of a ${m.rooms.what}. The drawing is a rectangle ${length} ${u.first.long} long and ${width} ${u.first.long} wide. The scale is $1\\text{ ${u.first.short}}=${m.perUnit}\\text{ ${u.actual.short}}$. She makes a new drawing of the same ${m.rooms.what} that is ${newLength} ${u.next.long} long. ${task(axes.mode)}`,
      hint: `Every ${one[u.first.short]} of the drawing stands for ${m.perUnit} ${u.actual.long}, so the actual length is the drawing length times ${m.perUnit}. Area uses the actual length and width, not the drawing's. For the new scale, divide the actual length by the new drawing's length of ${newLength} ${u.next.short}.`,
      explanation: [
        `A scale drawing is a smaller copy. Its scale says what real length each unit on the drawing stands for: here 1 ${one[u.first.short]} stands for ${m.perUnit} ${u.actual.long}.`,
        `So multiply each drawing length by ${m.perUnit}. Length: $${length}\\times${m.perUnit}=${L}$ ${u.actual.long}. Width: $${width}\\times${m.perUnit}=${W}$ ${u.actual.long}.`,
        `Area is length times width, using the real sizes, not the drawing's: $${L}\\times${W}=${L * W}$ ${u.actual.area}.`,
        `The new drawing shows the same real length, ${L} ${u.actual.long}, in ${newLength} ${u.next.long}. Divide to find what 1 ${one[u.next.short]} stands for: $${L}\\div${newLength}=${m.perNew}$ ${u.actual.long}.`,
        `The real width is ${W} ${u.actual.long}, and each ${one[u.next.short]} stands for ${m.perNew}, so divide: $${W}\\div${m.perNew}=${newWidth}$.`,
        `The new drawing is ${newWidth} ${u.next.long} wide.`,
      ],
    });
  },
  variant: (m) => m.system,
});

/* ------------------------------------------------------ scientific notation */

interface Sci {
  m: number; // digits as an integer, no trailing zeros except a lone digit
  e: number; // value = m × 10^e
}
/** Normalize an integer mantissa and exponent to c × 10^n, 1 ≤ c < 10. */
function normalize(m: number, e: number): { c: string; n: number } {
  const digits = String(m).replace(/0+$/, "") || "0";
  const trailing = String(m).length - digits.length;
  const n = e + trailing + digits.length - 1;
  return {
    c: digits.length === 1 ? digits : `${digits[0]}.${digits.slice(1)}`,
    n,
  };
}
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const texNum = (n: string) => n.replace(/,/g, "{,}");
const standard = (s: Sci) =>
  s.e >= 0
    ? (s.m * 10 ** s.e).toLocaleString("en-US")
    : `0.${"0".repeat(-s.e - String(s.m).length)}${s.m}`;
const sciTex = (s: Sci) => {
  const { c, n } = normalize(s.m, s.e);
  return `${c}\\times10^{${n}}`;
};

const contexts = [
  {
    big: "A blue whale weighs",
    bigName: "blue whale",
    small: "A thread snake weighs",
    smallName: "thread snake",
    cmp1: "an elephant",
    cmp2: "a tiger",
    many: "tigers living in the wild",
    unit: "pounds",
    qty: "weight",
    heavy: "heavy",
    plural: "weights",
  },
  {
    big: "A cargo container holds a load with a mass of",
    bigName: "cargo container's load",
    small: "A grain of sand has a mass of",
    smallName: "grain of sand",
    cmp1: "a brick",
    cmp2: "a marble",
    many: "marbles in a crate",
    unit: "grams",
    qty: "mass",
    heavy: "massive",
    plural: "masses",
  },
] as const;
interface SciModel {
  context: (typeof contexts)[number];
  big: Sci;
  small: Sci;
  first: Sci;
  second: Sci;
  count: number;
}
const sciNotation = chainFamily({
  template: mcasWrittenWorkTemplates[2]!,
  axes: {
    mode: workModeAxisNoOrder,
    context: defineAxis("context", ["animals", "objects"] as const),
  },
  model: (r, axes): SciModel => {
    const context = contexts[axes.context === "animals" ? 0 : 1]!;
    // Big: m × 10^e with 4 to 7 digits in all.
    const big: Sci = {
      m: pick(r, [1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 25, 36]),
      e: r(3, 6),
    };
    const small: Sci = { m: pick(r, [1, 2, 3, 4, 5, 6, 7, 8, 9]), e: -r(2, 5) };
    // Ratio of first to second is a terminating decimal greater than 1.
    const second: Sci = {
      m: pick(r, [25, 5, 625, 125, 2, 4, 8, 16]),
      e: r(0, 2),
    };
    const first: Sci = { m: pick(r, [1, 2, 4, 5, 8]), e: second.e + r(2, 4) };
    const count = pick(r, [3200, 1600, 400, 800, 250, 4000]);
    const ratioNum = first.m * 10 ** first.e;
    const ratioDen = second.m * 10 ** second.e;
    if (ratioNum <= ratioDen) throw new Error("Need three retry");
    try {
      decimalText(ratioNum, ratioDen);
    } catch {
      throw new Error("Need three retry");
    }
    if (count * second.m * 10 ** second.e > 9e9)
      throw new Error("Need three retry");
    return { context, big, small, first, second, count };
  },
  render: (m, axes, r) => {
    const c = m.context;
    const big = normalize(m.big.m, m.big.e);
    const small = normalize(m.small.m, m.small.e);
    const ratio = decimalText(
      m.first.m * 10 ** m.first.e,
      m.second.m * 10 ** m.second.e,
    );
    const totalValue = m.count * m.second.m;
    const total = normalize(totalValue, m.second.e);
    // The unit after the coefficient reads "3 × 10^ 5" across the two fields.
    const sciField = (value: string, caption: string, unit?: string) => ({
      caption,
      kind: "number" as const,
      value,
      maxLength: 8,
      ...(unit ? { unit } : {}),
    });
    const rows: RowSpec[] = [
      {
        label: `${cap(c.qty)} of the ${c.bigName} in scientific notation, $a\\times10^{n}$ ${c.unit}`,
        fields: [
          sciField(big.c, "Coefficient a", "× 10^"),
          sciField(`${big.n}`, "Power n"),
        ],
      },
      {
        label: `${cap(c.qty)} of the ${c.smallName} in scientific notation, $a\\times10^{n}$ ${c.unit}`,
        fields: [
          sciField(small.c, "Coefficient a", "× 10^"),
          sciField(`${small.n}`, "Power n"),
        ],
      },
      {
        label: `How many times as ${c.heavy} ${c.cmp1} is as ${c.cmp2}`,
        fields: [num(ratio)],
      },
      {
        label: `Total ${c.qty} of the ${c.many} in scientific notation, $a\\times10^{n}$ ${c.unit}`,
        fields: [
          sciField(total.c, "Coefficient a", "× 10^"),
          sciField(`${total.n}`, "Power n"),
        ],
      },
    ];
    const built = rowsWork(rows, axes.mode, r, "Your work");
    const count = m.count.toLocaleString("en-US");
    return workSurface(built, {
      prompt: `${c.big} ${standard(m.big)} ${c.unit}. ${c.small} ${standard(m.small)} ${c.unit}. The average ${c.qty} of ${c.cmp1} is $${sciTex(m.first)}$ ${c.unit} and of ${c.cmp2} is $${sciTex(m.second)}$ ${c.unit}. A count finds ${count} ${c.many}; use the average ${c.qty} of ${c.cmp2} for each one. Write each ${c.qty} as $a\\times10^{n}$ with $1\\le a<10$. ${task(axes.mode)}`,
      hint: `For ${standard(m.big)}, count how many places the decimal point moves to leave one nonzero digit in front. Moving it left gives a positive power of 10; for ${standard(m.small)} it moves right, so the power is negative. To compare ${c.cmp1} with ${c.cmp2}, divide their ${c.plural}.`,
      explanation: [
        `Scientific notation writes a number as $a\\times10^{n}$, with $a$ at least 1 and less than 10. The power $n$ counts how many places the decimal point moves.`,
        `Large numbers get a positive power and tiny numbers a negative one: $${texNum(standard(m.big))}=${sciTex(m.big)}$, and $${standard(m.small)}=${sciTex(m.small)}$.`,
        `"How many times as ${c.heavy}" asks how many copies of one fit into the other, so divide: $\\frac{${sciTex(m.first)}}{${sciTex(m.second)}}=\\frac{${m.first.m * 10 ** m.first.e}}{${m.second.m * 10 ** m.second.e}}=${ratio}$.`,
        `Use the average ${c.qty} for each of the ${c.many}, so multiply: $${texNum(count)}\\times${standard(m.second)}=${texNum(standard({ m: totalValue, e: m.second.e }))}$.`,
        `In scientific notation, the total ${c.qty} is $${sciTex({ m: totalValue, e: m.second.e })}$ ${c.unit}.`,
      ],
    });
  },
  variant: (m) => (m.context === contexts[0] ? "animals" : "objects"),
});

export const mcasWrittenWorkGenerate = dispatch(mcasWrittenWorkTemplates, {
  "similar-triangles-work": (seed) => similar.generate(seed).problem,
  "scale-drawing-work": (seed) => scaleDrawing.generate(seed).problem,
  "scientific-notation-work": (seed) => sciNotation.generate(seed).problem,
});
export const mcasWrittenWorkCases = {
  "similar-triangles-work": similar.generate,
  "scale-drawing-work": scaleDrawing.generate,
  "scientific-notation-work": sciNotation.generate,
};
