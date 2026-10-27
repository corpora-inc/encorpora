import type { TemplateMetadata } from "./contracts";
import { chainFamily, decimalText, dispatch, pick } from "./chain-kit";
import { cosD, sinD, tanD } from "./regents-geometry-kit";
import { workModeAxisNoOrder } from "./structured-work-kit";
import { rowsWork, workSurface, type RowSpec } from "./structured-work-rows";
import { defineAxis } from "./variation/axes";

/**
 * Regents constructed responses whose rating guides credit the shown work:
 * each intermediate result of the solution is a labeled exact step, graded on
 * the server, and credit needs every step. A rounded intermediate is checked
 * both ways: the final answer is the same whether the learner carries the
 * rounded step or the full calculator value, so a correct path is never
 * penalized.
 */

const capability = "structured-work-v1" as const;
const meta = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  requiredResponseCapability: capability,
  description,
});
export const regentsShownWorkTemplates: readonly TemplateMetadata[] = [
  meta(
    "density-volume-steps",
    "Show the work: weight, mass or count from a solid's volume and a density",
    "solid-volume-models",
    0.5,
    "Find the volume of a cylinder, a pyramid or a prism with a pyramid on top, then apply a density to find a weight, a mass or how many pyramids a mass of clay makes, entering each step.",
  ),
  meta(
    "sas-area-steps",
    "Show the work: triangle area from two sides and the included angle",
    "trigonometric-area",
    0.5,
    "Find the area of a triangle from two sides and an acute or obtuse included angle by entering half the product of the sides, the sine of the angle and the area.",
  ),
  meta(
    "trig-leg-steps",
    "Show the work: a leg of a right triangle from the hypotenuse and an angle",
    "right-triangle-trigonometry",
    0.45,
    "Find the leg opposite or adjacent to a given acute angle from the hypotenuse by entering the sine or cosine of the angle and the length of the leg.",
  ),
  meta(
    "elevation-depression-steps",
    "Show the work: height from angles of elevation and depression",
    "right-triangle-trigonometry",
    0.6,
    "From one point, find the part of a height above eye level and the part below it with the tangent of each angle, then add them for the whole height.",
  ),
  meta(
    "isosceles-perimeter-steps",
    "Show the work: perimeter of an isosceles triangle from the apex angle and altitude",
    "right-triangle-trigonometry",
    0.6,
    "Halve the apex angle, find half the base and an equal side from the altitude with tangent and cosine, and add the three sides.",
  ),
  meta(
    "ring-area-steps",
    "Show the work: area of a ring around a circle",
    "composite-measurement",
    0.45,
    "Find the outer radius of a border around a circular pool, the difference of the squared radii and the area of the ring rounded to a whole unit.",
  ),
  meta(
    "parallelogram-angle-steps",
    "Show the work: an angle in a parallelogram with a perpendicular segment",
    "parallelogram-proofs",
    0.5,
    "Find the angle a perpendicular segment makes with a side of a parallelogram by finding the angle of the right triangle at the vertex and using its angle sum.",
  ),
  meta(
    "parallel-segment-steps",
    "Show the work: the length that makes a segment parallel to a side",
    "similarity-theorems",
    0.55,
    "Use the equal ratios a segment parallel to one side cuts from the other two sides to find the scale factor, a missing part and, when asked, the whole side.",
  ),
  meta(
    "two-radical-steps",
    "Show the work: an equation with two square roots and an extraneous solution",
    "radical-equations",
    0.8,
    "Square an equation with two square roots twice, enter the coefficients of the resulting quadratic, and find the solution that checks and the one that does not.",
  ),
  meta(
    "grouped-both-sides-steps",
    "Show the work: a linear equation with a grouped term and variables on both sides",
    "linear-equations",
    0.5,
    "Remove the parentheses, collect the variable terms on one side and the numbers on the other, and solve for the variable, entering each step.",
  ),
  meta(
    "exponential-time-steps",
    "Show the work: the time an exponential model takes to reach a target",
    "exponential-models",
    0.65,
    "Divide the target by the starting amount, take the natural logarithm of the ratio and of the growth factor, and divide to find the time to the nearest hundredth.",
  ),
];
const T = Object.fromEntries(
  regentsShownWorkTemplates.map((t) => [t.id, t]),
) as Record<string, TemplateMetadata>;

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
const retry = (): never => {
  throw new Error("Need three retry");
};
/** Canonical decimal text of x rounded half up to `places`. */
const dec = (x: number, places: number): string => {
  const f = 10 ** places;
  const scaled = Math.round(Math.abs(x) * f + 1e-9);
  const t = scaled / f;
  return `${x < 0 && scaled !== 0 ? "-" : ""}${t}`;
};
/** x is not within `margin` of a rounding tie at `places` decimals. */
const tieFree = (x: number, places: number, margin = 0.12): boolean => {
  const s = Math.abs(x) * 10 ** places;
  return Math.abs(s - Math.floor(s) - 0.5) > margin;
};
/** Both the full value and the value rebuilt from rounded steps round alike. */
const stable = (full: number, rebuilt: number, places: number): boolean =>
  tieFree(full, places) &&
  tieFree(rebuilt, places) &&
  dec(full, places) === dec(rebuilt, places);
const tex = (s: string | number) => `$${s}$`;
const fix = (a: number, p: number) => a.toFixed(p);

/* ------------------------------------------------ density and volume */

type SolidKind = "cylinder-weight" | "pyramid-count" | "prism-pyramid-mass";
interface DensityModel {
  kind: SolidKind;
  d: number;
  h: number;
  density: number;
  mass: number;
  densityTenths: number;
  side: number;
  prismH: number;
  pyrH: number;
  gramTenths: number;
}
const density = chainFamily({
  template: T["density-volume-steps"]!,
  axes: {
    mode: workModeAxisNoOrder,
    solid: defineAxis("solid", [
      "cylinder-weight",
      "pyramid-count",
      "prism-pyramid-mass",
    ] as const),
  },
  model: (r, axes): DensityModel => {
    const m: DensityModel = {
      kind: axes.solid,
      d: r(10, 24) / 2,
      h: r(8, 30) / 2,
      density: r(60, 140),
      mass: pick(r, [20, 25, 30, 40, 45, 50, 60, 75]),
      densityTenths: r(16, 24),
      side: pick(r, [6, 8, 10, 12]),
      prismH: r(4, 12),
      pyrH: pick(r, [6, 9, 12, 15]),
      gramTenths: r(20, 90),
    };
    if (m.kind === "prism-pyramid-mass") {
      m.side = r(3, 9);
      m.pyrH = pick(r, [3, 6, 9, 12]);
      const mass =
        m.side * m.side * (m.prismH + m.pyrH / 3) * (m.gramTenths / 10);
      if (Math.abs((mass % 1) - 0.5) < 1e-6) retry();
    }
    if (m.kind === "pyramid-count") {
      const vol = (m.side * m.side * m.pyrH) / 3;
      const each = vol * m.densityTenths; // tenths of a gram
      const exact = (m.mass * 10000) / each;
      if (exact < 3 || (exact % 1 < 0.1 && exact % 1 > 0) || exact % 1 > 0.9)
        retry();
    }
    return m;
  },
  render: (m, axes, r) => {
    const rows: RowSpec[] = [];
    let prompt = "";
    let hint = "";
    let explanation: string[] = [];
    if (m.kind === "cylinder-weight") {
      const rad = m.d / 2;
      const vol = Math.PI * rad * rad * m.h;
      const volR = Number(dec(vol, 3));
      const w = vol * m.density;
      if (!stable(w, volR * m.density, 0)) retry();
      rows.push(
        {
          label: "The radius of the bucket in feet",
          fields: [num(`${rad}`, "ft")],
        },
        {
          label: "The volume in cubic feet, rounded to the nearest thousandth",
          fields: [num(dec(vol, 3), "ft³")],
        },
        {
          label:
            "The weight of the soil in pounds, rounded to the nearest pound",
          fields: [num(dec(w, 0), "lb")],
        },
      );
      prompt = `A cylindrical bucket has an inside diameter of ${tex(m.d)} feet and a height of ${tex(m.h)} feet. It is filled to the top with soil that weighs ${tex(m.density)} pounds per cubic foot. Find the weight of the soil to the nearest pound. ${task(axes.mode)}`;
      hint = `The radius is half of the ${m.d}-foot diameter. Use $V=\\pi r^2h$ with the height ${m.h} feet, then multiply the volume in cubic feet by ${m.density} pounds per cubic foot.`;
      explanation = [
        `The radius is ${tex(`${m.d}\\div2=${rad}`)} feet.`,
        `${tex(`V=\\pi(${rad})^2(${m.h})\\approx${dec(vol, 3)}\\ \\text{ft}^3`)}.`,
        `${tex(`${dec(vol, 3)}\\times${m.density}\\approx${dec(w, 1)}`)}, so the soil weighs ${dec(w, 0)} pounds.`,
      ];
    } else if (m.kind === "pyramid-count") {
      const vol = (m.side * m.side * m.pyrH) / 3;
      const each = (vol * m.densityTenths) / 10;
      const grams = m.mass * 1000;
      const count = Math.floor((m.mass * 10000) / (vol * m.densityTenths));
      rows.push(
        {
          label: "The volume of one pyramid in cubic centimeters",
          fields: [num(`${vol}`, "cm³")],
        },
        {
          label: "The mass of one pyramid in grams",
          fields: [num(dec(each, 1), "g")],
        },
        {
          label: "The mass of the clay in grams",
          fields: [num(`${grams}`, "g")],
        },
        {
          label: "The number of whole pyramids",
          fields: [num(`${count}`)],
        },
      );
      prompt = `A sculptor has ${m.mass} kilograms of clay with a density of ${tex(m.densityTenths / 10)} grams per cubic centimeter. Each pyramid has a square base with side ${tex(m.side)} centimeters and a height of ${tex(m.pyrH)} centimeters. How many whole pyramids can be made? ${task(axes.mode)}`;
      hint = `One pyramid has volume one third of its base area times its height, with base side ${m.side} and height ${m.pyrH}. Multiply that volume by the density for its mass, and change ${m.mass} kilograms to grams before dividing. Leftover clay cannot make a whole pyramid.`;
      explanation = [
        `${tex(`V=\\frac13(${m.side})^2(${m.pyrH})=${vol}`)} cubic centimeters.`,
        `One pyramid has mass ${tex(`${vol}\\times${m.densityTenths / 10}=${dec(each, 1)}`)} grams. The clay is ${tex(`${m.mass}\\times1000=${grams}`)} grams.`,
        `${tex(`${grams}\\div${dec(each, 1)}\\approx${dec(grams / each, 2)}`)}, and only whole pyramids count, so ${count} pyramids can be made.`,
      ];
    } else {
      const base = m.side * m.side;
      const prism = base * m.prismH;
      const pyr = (base * m.pyrH) / 3;
      const total = prism + pyr;
      const mass = (total * m.gramTenths) / 10;
      rows.push(
        {
          label: "The volume of the prism in cubic centimeters",
          fields: [num(`${prism}`, "cm³")],
        },
        {
          label: "The volume of the pyramid in cubic centimeters",
          fields: [num(`${pyr}`, "cm³")],
        },
        {
          label: "The volume of the whole trophy in cubic centimeters",
          fields: [num(`${total}`, "cm³")],
        },
        {
          label: "The mass of the trophy in grams, rounded to the nearest gram",
          fields: [num(dec(mass, 0), "g")],
        },
      );
      prompt = `A solid trophy is a square prism with a square pyramid on top. The prism and the pyramid have the same base, a square with side ${tex(m.side)} centimeters. The prism is ${tex(m.prismH)} centimeters tall and the pyramid is ${tex(m.pyrH)} centimeters tall. The metal has a density of ${tex(fix(m.gramTenths / 10, 1))} grams per cubic centimeter. Find the mass of the trophy to the nearest gram. ${task(axes.mode)}`;
      hint = `Find two volumes that share the ${m.side} by ${m.side} base: the prism of height ${m.prismH} and the pyramid of height ${m.pyrH}, which is one third of a prism with the same base and height. Add the volumes before you use the density.`;
      explanation = [
        `Prism: ${tex(`${m.side}\\cdot${m.side}\\cdot${m.prismH}=${prism}`)} cubic centimeters. Pyramid: ${tex(`\\frac13(${base})(${m.pyrH})=${pyr}`)} cubic centimeters.`,
        `Total volume: ${tex(`${prism}+${pyr}=${total}`)} cubic centimeters.`,
        `Mass: ${tex(`${total}\\times${fix(m.gramTenths / 10, 1)}=${dec(mass, 2)}`)}, which is ${dec(mass, 0)} grams.`,
      ];
    }
    return workSurface(rowsWork(rows, axes.mode, r, "Your work"), {
      prompt,
      hint,
      explanation,
    });
  },
  variant: (m) => m.kind,
});

/* ------------------------------------------------------ SAS area */

const sasArea = chainFamily({
  template: T["sas-area-steps"]!,
  axes: {
    mode: workModeAxisNoOrder,
    angle: defineAxis("angle", ["acute", "obtuse"] as const),
  },
  model: (r, axes) => {
    const a = r(40, 120);
    const b = r(40, 120);
    const angle = axes.angle === "acute" ? r(25, 80) : r(100, 155);
    const half = (a * b) / 200;
    const sin = sinD(angle);
    const sinR = Number(dec(sin, 4));
    if (!stable(half * sin, half * sinR, 1)) retry();
    return { a, b, angle };
  },
  render: (m, axes, r) => {
    const half = (m.a * m.b) / 200;
    const sin = sinD(m.angle);
    const area = half * sin;
    const rows: RowSpec[] = [
      {
        label: "Half the product of the two sides",
        fields: [num(decimalText(m.a * m.b, 200))],
      },
      {
        label: `$\\sin ${m.angle}^\\circ$, rounded to the nearest ten-thousandth`,
        fields: [num(dec(sin, 4))],
      },
      {
        label: "The area in square centimeters, rounded to the nearest tenth",
        fields: [num(dec(area, 1), "cm²")],
      },
    ];
    return workSurface(rowsWork(rows, axes.mode, r, "Your work"), {
      prompt: `Two sides of a triangle measure ${tex(fix(m.a / 10, 1))} cm and ${tex(fix(m.b / 10, 1))} cm, and the angle between them measures ${tex(`${m.angle}^\\circ`)}. Find the area of the triangle to the nearest tenth of a square centimeter. Use a calculator in degree mode. ${task(axes.mode)}`,
      hint: `The ${m.angle}° angle is between the sides ${fix(m.a / 10, 1)} and ${fix(m.b / 10, 1)}, so use $\\frac12ab\\sin C$ with that angle. ${m.angle > 90 ? "The sine of an obtuse angle is positive; read it from the calculator in degree mode." : "Find the sine in degree mode."}`,
      explanation: [
        `The area is ${tex("\\frac12ab\\sin C")} with the angle between the two sides.`,
        `${tex(`\\frac12(${fix(m.a / 10, 1)})(${fix(m.b / 10, 1)})=${decimalText(m.a * m.b, 200)}`)} and ${tex(`\\sin ${m.angle}^\\circ\\approx${dec(sin, 4)}`)}.`,
        `${tex(`${decimalText(m.a * m.b, 200)}\\times${dec(sin, 4)}\\approx${dec(area, 2)}`)}, so the area is ${dec(area, 1)} square centimeters.`,
      ],
    });
  },
  variant: (m) => (m.angle > 90 ? "obtuse" : "acute"),
});

/* ------------------------------------------------------- trig leg */

const trigLeg = chainFamily({
  template: T["trig-leg-steps"]!,
  axes: {
    mode: workModeAxisNoOrder,
    leg: defineAxis("leg", ["opposite", "adjacent"] as const),
  },
  model: (r, axes) => {
    const angle = pick(r, [
      17, 22, 27, 31, 36, 41, 52, 58, 63, 68, 73,
    ] as const);
    const hyp = r(8, 45);
    const ratio = axes.leg === "opposite" ? sinD(angle) : cosD(angle);
    if (!stable(hyp * ratio, hyp * Number(dec(ratio, 4)), 1)) retry();
    return { angle, hyp, opp: axes.leg === "opposite" };
  },
  render: (m, axes, r) => {
    const ratio = m.opp ? sinD(m.angle) : cosD(m.angle);
    const leg = m.hyp * ratio;
    const fn = m.opp ? "sin" : "cos";
    const rows: RowSpec[] = [
      {
        label: `$\\${fn}\\,${m.angle}^\\circ$, rounded to the nearest ten-thousandth`,
        fields: [num(dec(ratio, 4))],
      },
      {
        label: `The length of $${m.opp ? "BC" : "AC"}$, rounded to the nearest tenth`,
        fields: [num(dec(leg, 1))],
      },
    ];
    const target = m.opp ? "BC" : "AC";
    return workSurface(rowsWork(rows, axes.mode, r, "Your work"), {
      prompt: `In right triangle $ABC$ the right angle is at $C$, $AB=${m.hyp}$ and $m\\angle A=${m.angle}^\\circ$. Find $${target}$ to the nearest tenth. Use a calculator in degree mode. ${task(axes.mode)}`,
      hint: `$AB=${m.hyp}$ is the hypotenuse. Side $${target}$ is ${m.opp ? "opposite" : "adjacent to"} the ${m.angle}° angle at $A$, so choose the ratio that links that side to the hypotenuse and solve for $${target}$.`,
      explanation: [
        `$${target}$ is the leg ${m.opp ? "opposite" : "adjacent to"} $\\angle A$, so $\\${fn}\\,${m.angle}^\\circ=\\frac{${target}}{${m.hyp}}$.`,
        `$\\${fn}\\,${m.angle}^\\circ\\approx${dec(ratio, 4)}$.`,
        `$${target}=${m.hyp}\\cdot${dec(ratio, 4)}\\approx${dec(leg, 2)}$, which is ${dec(leg, 1)} to the nearest tenth.`,
      ],
    });
  },
  variant: (m) => (m.opp ? "opposite-leg" : "adjacent-leg"),
});

/* ---------------------------------------- elevation and depression */

const things = ["cliff", "tower", "building"] as const;
const elevation = chainFamily({
  template: T["elevation-depression-steps"]!,
  axes: { mode: workModeAxisNoOrder },
  model: (r) => {
    const up = r(20, 58);
    const down = r(15, 48);
    const d = 5 * r(12, 60);
    const upR = Number(dec(d * tanD(up), 3));
    const downR = Number(dec(d * tanD(down), 3));
    const h = d * (tanD(up) + tanD(down));
    if (!stable(h, upR + downR, 0)) retry();
    return { up, down, d, thing: pick(r, things) };
  },
  render: (m, axes, r) => {
    const upPart = m.d * tanD(m.up);
    const downPart = m.d * tanD(m.down);
    const h = upPart + downPart;
    const rows: RowSpec[] = [
      {
        label: `The height above the horizontal line, rounded to the nearest thousandth`,
        fields: [num(dec(upPart, 3), "ft")],
      },
      {
        label: `The height below the horizontal line, rounded to the nearest thousandth`,
        fields: [num(dec(downPart, 3), "ft")],
      },
      {
        label: `The height of the ${m.thing} in feet, rounded to the nearest foot`,
        fields: [num(dec(h, 0), "ft")],
      },
    ];
    return workSurface(rowsWork(rows, axes.mode, r, "Your work"), {
      prompt: `A lookout is ${tex(m.d)} feet from a ${m.thing}, measured along level ground. From the lookout, the angle of elevation to the top of the ${m.thing} is ${tex(`${m.up}^\\circ`)} and the angle of depression to its base is ${tex(`${m.down}^\\circ`)}. What is the height of the ${m.thing}, to the nearest foot? ${task(axes.mode)}`,
      hint: `A horizontal line through the lookout splits the ${m.thing} into a part above it and a part below it. Each part is the opposite side of a right triangle whose adjacent side is the ${m.d} feet along the ground, so use the tangent of ${m.up}° for the upper part and of ${m.down}° for the lower part.`,
      explanation: [
        `Above: ${tex(`${m.d}\\tan ${m.up}^\\circ\\approx${dec(upPart, 3)}`)} feet.`,
        `Below: ${tex(`${m.d}\\tan ${m.down}^\\circ\\approx${dec(downPart, 3)}`)} feet.`,
        `Total: ${tex(`${dec(upPart, 3)}+${dec(downPart, 3)}=${dec(upPart + downPart, 3)}`)}, so the ${m.thing} is ${dec(h, 0)} feet tall.`,
      ],
    });
  },
  variant: (m) => (m.up > m.down ? "higher-top" : "deeper-base"),
});

/* ------------------------------------------------ isosceles perimeter */

const isosceles = chainFamily({
  template: T["isosceles-perimeter-steps"]!,
  axes: { mode: workModeAxisNoOrder },
  model: (r) => {
    const apex = 2 * r(15, 55);
    const h = r(6, 30);
    const half = apex / 2;
    const hb = h * tanD(half);
    const leg = h / cosD(half);
    const p = 2 * hb + 2 * leg;
    const rebuilt = 2 * Number(dec(hb, 3)) + 2 * Number(dec(leg, 3));
    if (!stable(p, rebuilt, 1)) retry();
    return { apex, h };
  },
  render: (m, axes, r) => {
    const half = m.apex / 2;
    const hb = m.h * tanD(half);
    const leg = m.h / cosD(half);
    const p = 2 * hb + 2 * leg;
    const rows: RowSpec[] = [
      {
        label: "Half the apex angle in degrees",
        fields: [num(`${half}`, "°")],
      },
      {
        label: "Half the base, rounded to the nearest thousandth",
        fields: [num(dec(hb, 3), "cm")],
      },
      {
        label: "One of the equal sides, rounded to the nearest thousandth",
        fields: [num(dec(leg, 3), "cm")],
      },
      {
        label: "The perimeter in centimeters, rounded to the nearest tenth",
        fields: [num(dec(p, 1), "cm")],
      },
    ];
    return workSurface(rowsWork(rows, axes.mode, r, "Your work"), {
      prompt: `An isosceles triangle has an apex angle of ${tex(`${m.apex}^\\circ`)}. The altitude from the apex to the base is ${tex(m.h)} cm long. Find the perimeter of the triangle to the nearest tenth of a centimeter. Use a calculator in degree mode. ${task(axes.mode)}`,
      hint: `The altitude from the apex halves the ${m.apex}° angle and the base, making two right triangles with a leg of ${m.h} cm. In one of them use the tangent for the leg along the base and the cosine for the hypotenuse, then add all three sides of the original triangle.`,
      explanation: [
        `The altitude gives right triangles with an angle of ${tex(`${half}^\\circ`)} at the apex and a leg of ${tex(m.h)} cm.`,
        `Half the base: ${tex(`${m.h}\\tan ${half}^\\circ\\approx${dec(hb, 3)}`)}. Equal side: ${tex(`\\frac{${m.h}}{\\cos ${half}^\\circ}\\approx${dec(leg, 3)}`)}.`,
        `Perimeter: ${tex(`2(${dec(hb, 3)})+2(${dec(leg, 3)})=${dec(2 * Number(dec(hb, 3)) + 2 * Number(dec(leg, 3)), 3)}`)}, which is ${dec(p, 1)} cm to the nearest tenth.`,
      ],
    });
  },
  variant: (m) => (m.apex > 60 ? "wide-apex" : "narrow-apex"),
});

/* ----------------------------------------------------------- ring */

const ring = chainFamily({
  template: T["ring-area-steps"]!,
  axes: {
    mode: workModeAxisNoOrder,
    given: defineAxis("given", ["radius", "diameter"] as const),
  },
  model: (r, axes) => {
    const inner = r(4, 20);
    const border = r(2, 6);
    const outer = inner + border;
    if (!tieFree(Math.PI * (outer * outer - inner * inner), 0)) retry();
    return {
      inner,
      border,
      diameter: axes.given === "diameter",
      unit: pick(r, ["feet", "meters"] as const),
    };
  },
  render: (m, axes, r) => {
    const outer = m.inner + m.border;
    const k = outer * outer - m.inner * m.inner;
    const area = Math.PI * k;
    const u = m.unit === "feet" ? "ft" : "m";
    const rows: RowSpec[] = [
      {
        label: "The radius of the circle formed by the pool and the walkway",
        fields: [num(`${outer}`, u)],
      },
      {
        label: "The number that multiplies $\\pi$ in the walkway's area",
        fields: [num(`${k}`)],
      },
      {
        label: `The area of the walkway, rounded to the nearest square ${m.unit === "feet" ? "foot" : "meter"}`,
        fields: [num(dec(area, 0), `${u}²`)],
      },
    ];
    const pool = m.diameter
      ? `A circular pool has a diameter of ${tex(2 * m.inner)} ${m.unit}`
      : `A circular pool has a radius of ${tex(m.inner)} ${m.unit}`;
    return workSurface(rowsWork(rows, axes.mode, r, "Your work"), {
      prompt: `${pool}. A walkway ${tex(m.border)} ${m.unit} wide surrounds it. Find the area of the walkway to the nearest square ${m.unit === "feet" ? "foot" : "meter"}. ${task(axes.mode)}`,
      hint: `The walkway is the large circle that includes it minus the pool. ${m.diameter ? `Halve the ${2 * m.inner}-${m.unit === "feet" ? "foot" : "meter"} diameter to get the pool's radius, then add the walkway's width of ${m.border}` : `Add the walkway's width of ${m.border} to the pool's radius of ${m.inner}`} to get the radius of the large circle. Subtract the two squared radii before multiplying by $\\pi$.`,
      explanation: [
        `The large circle has radius ${tex(`${m.inner}+${m.border}=${outer}`)} ${m.unit}.`,
        `${tex(`\\pi(${outer})^2-\\pi(${m.inner})^2=\\pi(${outer * outer}-${m.inner * m.inner})=${k}\\pi`)}.`,
        `${tex(`${k}\\pi\\approx${dec(area, 2)}`)}, so the walkway's area is ${dec(area, 0)} square ${m.unit}.`,
      ],
    });
  },
  variant: (m) => (m.diameter ? "from-diameter" : "from-radius"),
});

/* -------------------------------------------------- parallelogram */

type ParKind = "obtuse-outside" | "acute-inside" | "obtuse-at-d";
const parallelogram = chainFamily({
  template: T["parallelogram-angle-steps"]!,
  axes: {
    mode: workModeAxisNoOrder,
    figure: defineAxis("figure", [
      "obtuse-outside",
      "acute-inside",
      "obtuse-at-d",
    ] as const),
  },
  model: (r, axes) => ({
    kind: axes.figure as ParKind,
    angle: axes.figure === "acute-inside" ? r(40, 80) : r(100, 155),
  }),
  render: (m, axes, r) => {
    const outside = m.kind !== "acute-inside";
    const adjacent = outside ? 180 - m.angle : m.angle;
    const ans = 90 - adjacent;
    const atD = m.kind === "obtuse-at-d";
    const v = atD ? "D" : "B";
    const side = atD ? "DC" : "BC";
    const given = atD ? "ADC" : "ABC";
    const first = atD ? "ADE" : "ABE";
    const target = atD ? "DAE" : "BAE";
    const rows: RowSpec[] = [
      {
        label: `$m\\angle ${first}$ in degrees`,
        fields: [num(`${adjacent}`, "°")],
      },
      {
        label: `$m\\angle ${target}$ in degrees`,
        fields: [num(`${ans}`, "°")],
      },
    ];
    const placement = outside
      ? `Point $E$ is on line $${side}$ so that $${v}$ is between $E$ and $C$, and $\\overline{AE}\\perp\\overline{${side}}$.`
      : `Point $E$ is on side $${side}$ with $\\overline{AE}\\perp\\overline{${side}}$.`;
    return workSurface(rowsWork(rows, axes.mode, r, "Your work"), {
      prompt: `In parallelogram $ABCD$, $m\\angle ${given}=${m.angle}^\\circ$. ${placement} Find $m\\angle ${target}$. ${task(axes.mode)}`,
      hint: outside
        ? `With $m\\angle ${given}=${m.angle}^\\circ$, the angles $\\angle ${given}$ and $\\angle ${first}$ lie on the straight line through $E$, $${v}$ and $C$. Find $\\angle ${first}$ first, then use the right angle at $E$ in the triangle.`
        : `With $m\\angle ${given}=${m.angle}^\\circ$ and point $E$ on side $${side}$, $\\angle ${first}$ is the same angle as $\\angle ${given}$. Then use the right angle at $E$ and the angle sum of the triangle.`,
      explanation: [
        outside
          ? `$E$, $${v}$ and $C$ are on one line, so $\\angle ${first}$ and $\\angle ${given}$ are supplementary: $180-${m.angle}=${adjacent}$.`
          : `$E$ is on side $${side}$, so $\\angle ${first}$ is $\\angle ${given}$: ${adjacent} degrees.`,
        `The triangle has a right angle at $E$, so its other two angles add to 90.`,
        `$m\\angle ${target}=90-${adjacent}=${ans}$.`,
      ],
    });
  },
  variant: (m) => m.kind,
});

/* ------------------------------------------------ parallel segment */

const parallelSegment = chainFamily({
  template: T["parallel-segment-steps"]!,
  axes: {
    mode: workModeAxisNoOrder,
    ask: defineAxis("ask", ["parallel-length", "whole-side"] as const),
  },
  model: (r, axes) => ({
    a: r(2, 8),
    b: r(2, 9),
    k: r(2, 5),
    whole: axes.ask === "whole-side",
  }),
  render: (m, axes, r) => {
    const ae = m.a * m.k;
    const ec = m.b * m.k;
    const rows: RowSpec[] = [
      {
        label: "The ratio $AE\\div AD$, the scale factor",
        fields: [num(`${m.k}`)],
      },
      { label: "The length of $\\overline{EC}$", fields: [num(`${ec}`)] },
      ...(m.whole
        ? [
            {
              label: "The length of $\\overline{AC}$",
              fields: [num(`${ae + ec}`)],
            } satisfies RowSpec,
          ]
        : []),
    ];
    const base = `In triangle $ABC$, point $D$ is on $\\overline{AB}$ and point $E$ is on $\\overline{AC}$, with $AD=${m.a}$, $DB=${m.b}$ and $AE=${ae}$.`;
    return workSurface(rowsWork(rows, axes.mode, r, "Your work"), {
      prompt: m.whole
        ? `${base} $\\overline{DE}\\parallel\\overline{BC}$. Find the length of $\\overline{AC}$. ${task(axes.mode)}`
        : `${base} What must the length of $\\overline{EC}$ be so that $\\overline{DE}\\parallel\\overline{BC}$? ${task(axes.mode)}`,
      hint: `A segment parallel to $\\overline{BC}$ cuts $\\overline{AB}$ and $\\overline{AC}$ in the same ratio, so $AE$ is $AD=${m.a}$ scaled by some factor and $EC$ is $DB=${m.b}$ scaled by the same factor.${m.whole ? " The whole side is $AE$ plus $EC$." : ""}`,
      explanation: [
        `$\\overline{DE}\\parallel\\overline{BC}$ exactly when $\\frac{AE}{AD}=\\frac{EC}{DB}$. Here $\\frac{${ae}}{${m.a}}=${m.k}$.`,
        `$EC=${m.k}\\cdot${m.b}=${ec}$.`,
        ...(m.whole ? [`$AC=AE+EC=${ae}+${ec}=${ae + ec}$.`] : []),
      ],
    });
  },
  variant: (m) => (m.whole ? "whole-side" : "parallel-length"),
});

/* --------------------------------------------------- two radicals */

interface RadCase {
  p: number;
  a: number;
  b: number;
  c: number;
  good: number;
  bad: number;
}
const radicalCases: RadCase[] = (() => {
  const out: RadCase[] = [];
  const isSquare = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));
  for (const p of [2, 3, 4])
    for (let a = -4; a <= 12; a++)
      for (let b = -4; b <= 12; b++)
        for (const c of [1, 2, 3]) {
          const K = a - b - c * c;
          const A = (p - 1) ** 2;
          const B = 2 * (p - 1) * K - 4 * c * c;
          const C = K * K - 4 * c * c * b;
          const disc = B * B - 4 * A * C;
          if (disc <= 0 || !isSquare(disc)) continue;
          const s = Math.sqrt(disc);
          const x1 = (-B - s) / (2 * A);
          const x2 = (-B + s) / (2 * A);
          if (!Number.isInteger(x1) || !Number.isInteger(x2)) continue;
          const ok = (x: number) =>
            isSquare(p * x + a) &&
            isSquare(x + b) &&
            Math.sqrt(p * x + a) - Math.sqrt(x + b) === c;
          const g = [x1, x2].filter(ok);
          if (g.length !== 1) continue;
          const good = g[0]!;
          const bad = good === x1 ? x2 : x1;
          // The rejected candidate must make a radicand negative or fail the
          // equation, and every number stays small.
          if (Math.abs(good) > 60 || Math.abs(bad) > 60 || good < -b) continue;
          out.push({ p, a, b, c, good, bad });
        }
  return out;
})();
const poly = (lead: number, k: number) => {
  const l = lead === 1 ? "x" : `${lead}x`;
  return k === 0 ? l : k > 0 ? `${l}+${k}` : `${l}-${-k}`;
};
const twoRadical = chainFamily({
  template: T["two-radical-steps"]!,
  axes: {
    mode: workModeAxisNoOrder,
    arrangement: defineAxis("arrangement", [
      "difference",
      "radical-isolated",
    ] as const),
  },
  model: (r) => {
    if (!radicalCases.length) throw new Error("No radical cases");
    return radicalCases[r(0, radicalCases.length - 1)]!;
  },
  render: (m, axes, r) => {
    const R1 = poly(m.p, m.a);
    const R2 = poly(1, m.b);
    const K = m.a - m.b - m.c * m.c;
    const A = (m.p - 1) ** 2;
    const B = 2 * (m.p - 1) * K - 4 * m.c * m.c;
    const C = K * K - 4 * m.c * m.c * m.b;
    const eq =
      axes.arrangement === "difference"
        ? `\\sqrt{${R1}}-\\sqrt{${R2}}=${m.c}`
        : `\\sqrt{${R1}}=\\sqrt{${R2}}+${m.c}`;
    const rows: RowSpec[] = [
      {
        label: "The coefficient of $x^2$",
        fields: [num(`${A}`)],
      },
      { label: "The coefficient of $x$", fields: [num(`${B}`)] },
      { label: "The constant term", fields: [num(`${C}`)] },
      {
        label: "The solution that satisfies the original equation",
        fields: [num(`${m.good}`)],
      },
      {
        label: "The extraneous solution",
        fields: [num(`${m.bad}`)],
      },
    ];
    const lin = poly(m.p - 1, K);
    return workSurface(rowsWork(rows, axes.mode, r, "Your work"), {
      prompt: `Solve $${eq}$ for $x$. Square to remove the radicals, collect every term on the left with $x^2$ first and no common factor divided out, and enter the quadratic's coefficients. Then enter the solution that satisfies the equation and the extraneous one. ${task(axes.mode)}`,
      hint: `Write $\\sqrt{${R1}}=\\sqrt{${R2}}+${m.c}$ and square both sides: the right side keeps one radical. Isolate that radical, square again, and collect the terms. Test each solution in the original equation.`,
      explanation: [
        `Square both sides of $\\sqrt{${R1}}=${m.c}+\\sqrt{${R2}}$: $${R1}=${m.c * m.c}+${2 * m.c}\\sqrt{${R2}}+${R2}$, so $${lin}=${2 * m.c}\\sqrt{${R2}}$.`,
        `Square again: $(${lin})^2=${4 * m.c * m.c}(${R2})$, which collects to $${A === 1 ? "" : A}x^2${B < 0 ? "-" : "+"}${Math.abs(B) === 1 ? "" : Math.abs(B)}x${C === 0 ? "" : `${C < 0 ? "-" : "+"}${Math.abs(C)}`}=0$.`,
        `The solutions are $x=${m.good}$ and $x=${m.bad}$. At $x=${m.good}$ both radicands are perfect squares and the difference is ${m.c}, so it works. At $x=${m.bad}$ the equation is false or a radicand is negative, so it is extraneous.`,
      ],
    });
  },
  variant: (m) =>
    m.p === 2
      ? "double-radicand"
      : m.p === 3
        ? "triple-radicand"
        : "quadruple-radicand",
});

/* ------------------------------------------- grouped, both sides */

const grouped = chainFamily({
  template: T["grouped-both-sides-steps"]!,
  axes: {
    mode: workModeAxisNoOrder,
    side: defineAxis("side", ["grouped-left", "grouped-right"] as const),
  },
  model: (r, axes) => {
    const p = r(2, 6);
    const q = pick(r, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
    const rr = pick(r, [-4, -3, -2, -1, 1, 2, 3, 4]);
    const s = r(-3, 6);
    const net = p + rr - s;
    if (net === 0) retry();
    const x0 = pick(r, [-8, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 8]);
    const t = net * x0 + p * q;
    if (Math.abs(t) > 40 || t === 0) retry();
    return { p, q, r: rr, s, t, x0, left: axes.side === "grouped-left" };
  },
  render: (m, axes, r) => {
    const net = m.p + m.r - m.s;
    const k = m.t - m.p * m.q;
    const sign = (v: number) => (v < 0 ? `-${-v}` : `+${v}`);
    const term = (c: number, first: boolean) =>
      `${c < 0 ? "-" : first ? "" : "+"}${Math.abs(c) === 1 ? "" : Math.abs(c)}x`;
    const groupedSide = `${m.p}(x${sign(m.q)})${m.r < 0 ? "-" : "+"}${Math.abs(m.r) === 1 ? "" : Math.abs(m.r)}x`;
    const otherSide = `${m.s === 0 ? "" : term(m.s, true)}${m.s === 0 ? m.t : sign(m.t)}`;
    const eq = m.left
      ? `${groupedSide}=${otherSide}`
      : `${otherSide}=${groupedSide}`;
    const lead = m.p + m.r;
    const removed =
      lead === 0 ? `${m.p * m.q}` : `${term(lead, true)}${sign(m.p * m.q)}`;
    const rows: RowSpec[] = [
      {
        label:
          "The grouped side with the parentheses removed and like terms combined",
        fields: [
          {
            caption: "Expression",
            kind: "expression",
            value: removed,
            match: "identity",
            variables: ["x"],
            expanded: true,
            maxLength: 24,
          },
        ],
      },
      {
        label:
          "The coefficient of $x$ on the side that had the parentheses, after the $x$ terms are moved there",
        fields: [num(`${net}`)],
      },
      {
        label:
          "The number on the other side, after the plain numbers are moved there",
        fields: [num(`${k}`)],
      },
      { label: "The solution $x$", fields: [num(`${m.x0}`)] },
    ];
    return workSurface(rowsWork(rows, axes.mode, r, "Your work"), {
      prompt: `Solve $${eq}$ for $x$. Move the $x$ terms to the side that has the parentheses and the plain numbers to the other side. ${task(axes.mode)}`,
      hint: `Multiply ${m.p} by each term inside $${m.p}(x${sign(m.q)})$ first, then combine the result with the $${term(m.r, true)}$ term on that side. Then move the $x$ terms to one side and the plain numbers to the other, keeping each sign, and divide by the coefficient of $x$.`,
      explanation: [
        `Distribute ${m.p}: $${m.p}(x${sign(m.q)})=${m.p}x${sign(m.p * m.q)}$, so the grouped side is $${term(m.p + m.r, true)}${sign(m.p * m.q)}$.`,
        `Move the $x$ terms to the side with the parentheses and the plain numbers to the other side: $${net}x=${k}$.`,
        `Divide by ${net}: $x=${m.x0}$. Check by substituting ${m.x0} into both sides of the original equation.`,
      ],
    });
  },
  variant: (m) => (m.left ? "grouped-left" : "grouped-right"),
});

/* --------------------------------------------- exponential time */

const settings = [
  { lead: "The size of a crowd", unit: "minutes", thing: "N" },
  { lead: "The number of bacteria in a culture", unit: "hours", thing: "N" },
  { lead: "The population of a town", unit: "years", thing: "N" },
] as const;
const expTime = chainFamily({
  template: T["exponential-time-steps"]!,
  axes: {
    mode: workModeAxisNoOrder,
    form: defineAxis("form", ["base-b", "natural-rate"] as const),
  },
  model: (r, axes) => {
    const start = pick(r, [40, 50, 80, 100, 200, 250, 400]);
    const mult = r(3, 16) / 2;
    const target = start * mult;
    if (!Number.isInteger(target)) retry();
    const ratio = target / start;
    const natural = axes.form === "natural-rate";
    const base = natural ? r(2, 12) / 100 : r(110, 180) / 100;
    const lnR = Math.log(ratio);
    const lnB = natural ? base : Math.log(base);
    const t = lnR / lnB;
    const rebuilt =
      Number(dec(lnR, 4)) / (natural ? base : Number(dec(lnB, 4)));
    if (t > 60 || t < 1.5 || !stable(t, rebuilt, 2)) retry();
    // The answer never equals a number the hint names.
    if (!natural && dec(t, 2) === fix(base, 2)) retry();
    return { start, target, ratio, base, natural, s: pick(r, settings) };
  },
  render: (m, axes, r) => {
    const lnR = Math.log(m.ratio);
    const lnB = m.natural ? m.base : Math.log(m.base);
    const t = lnR / lnB;
    const rule = m.natural
      ? `N(t)=${m.start}e^{${m.base}t}`
      : `N(t)=${m.start}\\cdot${fix(m.base, 2)}^{t}`;
    const rows: RowSpec[] = [
      {
        label: `The target divided by the starting amount`,
        fields: [num(String(m.ratio))],
      },
      {
        label: `The natural logarithm of that ratio, rounded to the nearest ten-thousandth`,
        fields: [num(dec(lnR, 4))],
      },
      ...(m.natural
        ? []
        : [
            {
              label: `The natural logarithm of ${fix(m.base, 2)}, rounded to the nearest ten-thousandth`,
              fields: [num(dec(lnB, 4))],
            } satisfies RowSpec,
          ]),
      {
        label: `The time in ${m.s.unit}, rounded to the nearest hundredth`,
        fields: [num(dec(t, 2), m.s.unit)],
      },
    ];
    return workSurface(rowsWork(rows, axes.mode, r, "Your work"), {
      prompt: `${m.s.lead} is modeled by $${rule}$, where $t$ is in ${m.s.unit}. After how many ${m.s.unit} does the model reach ${m.target}? Round to the nearest hundredth. ${task(axes.mode)}`,
      hint: `Set the model equal to ${m.target} and divide both sides by ${m.start}, so the exponential part is alone. Then take the natural logarithm of both sides to bring $t$ down${m.natural ? `, and divide by ${m.base}` : `, and divide by the logarithm of ${fix(m.base, 2)}`}.`,
      explanation: [
        `Set the model equal to ${m.target}: $${m.start}${m.natural ? `e^{${m.base}t}` : `\\cdot${fix(m.base, 2)}^{t}`}=${m.target}$. Divide by ${m.start}: $${m.natural ? `e^{${m.base}t}` : `${fix(m.base, 2)}^{t}`}=${m.ratio}$.`,
        m.natural
          ? `Take natural logarithms: $${m.base}t=\\ln ${m.ratio}\\approx${dec(lnR, 4)}$.`
          : `Take natural logarithms: $t\\ln ${fix(m.base, 2)}=\\ln ${m.ratio}$, with $\\ln ${m.ratio}\\approx${dec(lnR, 4)}$ and $\\ln ${fix(m.base, 2)}\\approx${dec(lnB, 4)}$.`,
        `$t\\approx\\frac{${dec(lnR, 4)}}{${m.natural ? m.base : dec(lnB, 4)}}\\approx${dec(t, 3)}$, which is ${dec(t, 2)} ${m.s.unit}.`,
      ],
    });
  },
  variant: (m) => (m.natural ? "natural-rate" : "base-b"),
});

export const regentsShownWorkGenerate = dispatch(regentsShownWorkTemplates, {
  "density-volume-steps": (seed) => density.generate(seed).problem,
  "sas-area-steps": (seed) => sasArea.generate(seed).problem,
  "trig-leg-steps": (seed) => trigLeg.generate(seed).problem,
  "elevation-depression-steps": (seed) => elevation.generate(seed).problem,
  "isosceles-perimeter-steps": (seed) => isosceles.generate(seed).problem,
  "ring-area-steps": (seed) => ring.generate(seed).problem,
  "parallelogram-angle-steps": (seed) => parallelogram.generate(seed).problem,
  "parallel-segment-steps": (seed) => parallelSegment.generate(seed).problem,
  "two-radical-steps": (seed) => twoRadical.generate(seed).problem,
  "grouped-both-sides-steps": (seed) => grouped.generate(seed).problem,
  "exponential-time-steps": (seed) => expTime.generate(seed).problem,
});
export const regentsShownWorkCases = {
  "density-volume-steps": density.generate,
  "sas-area-steps": sasArea.generate,
  "trig-leg-steps": trigLeg.generate,
  "elevation-depression-steps": elevation.generate,
  "isosceles-perimeter-steps": isosceles.generate,
  "ring-area-steps": ring.generate,
  "parallelogram-angle-steps": parallelogram.generate,
  "parallel-segment-steps": parallelSegment.generate,
  "two-radical-steps": twoRadical.generate,
  "grouped-both-sides-steps": grouped.generate,
  "exponential-time-steps": expTime.generate,
};
