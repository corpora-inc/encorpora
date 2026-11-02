import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  exactDecimal,
  sweepChoose,
  sweepVariant,
  type SweepAxes,
} from "./number-domain-axes";

export const circleMeasurementTemplates: readonly TemplateMetadata[] = [
  [
    "circle-circumference-coefficient",
    "Circle circumference",
    "circle-measurement",
    "Find an exact circumference from a radius or diameter.",
  ],
  [
    "circle-area-coefficient",
    "Circle area",
    "circle-measurement",
    "Find an exact circle area from a radius or diameter.",
  ],
  [
    "arc-length-coefficient",
    "Arc length",
    "arc-sector-measure",
    "Find an exact arc length from a radius or diameter and a central angle in degrees.",
  ],
  [
    "sector-area-coefficient",
    "Sector area",
    "arc-sector-measure",
    "Find an exact sector area from a radius or diameter and a central angle in degrees.",
  ],
].map(([id, title, skillId, description]) => ({
  id: id!,
  title: title!,
  skillId: skillId!,
  description: description!,
  version: 1,
  gradeBand: skillId === "circle-measurement" ? "6–8" : "9–12",
}));

type Q = { n: number; d: number };
function q(n: number, d = 1): Q {
  let a = Math.abs(n),
    b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
const multiply = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const divide = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const plain = (a: Q) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);
const tex = (a: Q) => (a.d === 1 ? String(a.n) : `\\frac{${a.n}}{${a.d}}`);
const pi = (a: Q) => (a.n === a.d ? "\\pi" : `${tex(a)}\\pi`);
function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return lo + (value % span);
  };
}
const angles = [
  30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330,
];

/** `piAxes` selects the pi form of the area family. Printed worksheets omit
 * it and keep the original exact-coefficient problems. */
export function circleMeasurementPrintCase(
  id: string,
  seed: string,
  piAxes?: SweepAxes<"circle-area-coefficient">,
): {
  problem: GeneratedProblem;
  tags: string[];
  caseKey: string;
  angle: number | null;
} {
  const metadata = circleMeasurementTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown circle-measurement template ${id}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed),
    given = q(r(1, 24), r(1, 2)),
    isRadius = r(0, 1) === 0;
  if (piAxes?.["pi-form"] === "pi-3-14") {
    // A numeric area with pi taken as 3.14. A whole radius keeps the area to
    // two decimal places.
    const whole = r(2, 15);
    const shown = isRadius ? whole : 2 * whole;
    const dimension = isRadius ? "radius" : "diameter";
    const area = exactDecimal(314 * whole * whole, 100);
    return {
      tags: [dimension, "approximate"],
      caseKey: JSON.stringify([whole, "pi-3-14"]),
      angle: null,
      problem: {
        public: {
          id: createHash("sha256")
            .update(JSON.stringify([id, 1, seed]))
            .digest("hex"),
          templateId: id,
          templateVersion: 1,
          seed,
          skillId: metadata.skillId,
          prompt: `A circle has a ${dimension} of ${shown} cm. Use 3.14 for $\\pi$. What is its area, in square centimeters?`,
          response: { kind: "number", label: "Area in square centimeters" },
        },
        answer: area,
        hint: isRadius
          ? `The area is $A = \\pi r^2$, and the radius is ${shown} cm. Square the radius, then multiply by 3.14.`
          : `The area is $A = \\pi r^2$, and $r$ is half the diameter. Halve ${shown} cm first, square it, then multiply by 3.14.`,
        explanation: [
          `The radius is the distance from the center of a circle to its edge. The diameter goes all the way across, so it is two radii.`,
          isRadius
            ? `The given length is the radius: $r = ${whole}$ cm.`
            : `So the radius is half the diameter: $r = ${shown} \\div 2 = ${whole}$ cm.`,
          `A circle's area is $\\pi$ times the radius times itself: $A = \\pi r^2$. Here $\\pi$ (pi) is a fixed number, a little more than 3.`,
          `Square the radius, which means multiply it by itself: $${whole} \\times ${whole} = ${whole * whole}$.`,
          `Use 3.14 for $\\pi$: $A \\approx 3.14 \\times ${whole * whole} = ${area}$.`,
          `The area is about ${area} square centimeters.`,
        ],
        variant: sweepVariant("pi-3-14", piAxes),
      },
    };
  }
  const radius = isRadius ? given : divide(given, q(2)),
    diameter = multiply(radius, q(2));
  const isArc = id === "arc-length-coefficient",
    isSector = id === "sector-area-coefficient",
    isArea = id === "circle-area-coefficient" || isSector;
  const angle = isArc || isSector ? angles[r(0, angles.length - 1)]! : null;
  const full = isArea ? multiply(radius, radius) : diameter;
  const part = angle === null ? q(1) : q(angle, 360),
    coefficient = multiply(full, part);
  const dimension = isRadius ? "radius" : "diameter",
    unit = isArea ? "square centimeters" : "cm";
  const opening = `A circle has a ${dimension} of ${plain(given)} cm.`;
  const prompt =
    angle === null
      ? `${opening} Its ${isArea ? "area" : "circumference"} is $a\\pi$ ${unit}. What is $a$?`
      : isArc
        ? `${opening} An arc corresponds to a central angle of ${angle} degrees. Its length is $a\\pi$ cm. What is $a$?`
        : `${opening} A sector has a central angle of ${angle} degrees. Its area is $a\\pi$ square centimeters. What is $a$?`;
  const radiusStep = isRadius
    ? `The given length is the radius: $r = ${tex(radius)}$ cm.`
    : `A diameter is twice the radius. Divide by 2: $r = ${tex(given)} \\div 2 = ${tex(radius)}$ cm.`;
  const fullStep = isArea
    ? `Square the radius: $${tex(radius)} \\times ${tex(radius)} = ${tex(full)}$. The full circle has area $A = \\pi r^2 = ${pi(full)}$ square centimeters.`
    : `Twice the radius is $d = ${tex(diameter)}$ cm. The full circumference is $C = 2\\pi r = ${pi(full)}$ cm.`;
  let explanation: string[], hint: string;
  if (angle === null) {
    explanation = [
      isArea
        ? `The radius is the distance from the center to the edge. A circle's area is $\\pi r^2$: $\\pi$ times the radius times itself.`
        : `The circumference is the distance around a circle. It is always $\\pi$ (pi) times the diameter, the distance across.`,
      radiusStep,
      fullStep,
      `The answer is written as $a\\pi$, so $a$ is the number multiplying $\\pi$ (its coefficient).`,
      isArea
        ? `Check using half the circumference times the radius: $\\frac{1}{2} \\times ${pi(diameter)} \\times ${tex(radius)} = ${pi(full)}$ square centimeters.`
        : `Check: the circumference divided by the diameter should be $\\pi$, and $${pi(full)} \\div ${tex(diameter)} = \\pi$.`,
      `The ${isArea ? "area" : "circumference"} is $${pi(full)}$ ${unit}, so $a = ${tex(coefficient)}$.`,
    ];
    hint = isArea
      ? isRadius
        ? `The area is $A = \\pi r^2$, and the radius is ${plain(given)} cm. The coefficient $a$ is the number multiplying $\\pi$: square the radius.`
        : `The area is $A = \\pi r^2$, and $r$ is half the diameter. Halve ${plain(given)} cm first, then square it.`
      : isRadius
        ? `The circumference is $C = \\pi d$, where $d$ is the diameter. The radius is ${plain(given)} cm, so first find the diameter, twice the radius.`
        : `The circumference is $C = \\pi d$, and the diameter is ${plain(given)} cm. The coefficient $a$ is the number multiplying $\\pi$.`;
  } else {
    const comparison = angle < 180 ? "<" : angle === 180 ? "=" : ">";
    const half = divide(full, q(2));
    explanation = [
      radiusStep,
      `A full turn is 360 degrees. The ${isArc ? "arc" : "sector"} covers $\\frac{${angle}}{360} = ${tex(part)}$ of the full circle.`,
      fullStep,
      `Take that same fraction of the ${isArc ? "circumference" : "circle's area"}: $${tex(part)} \\times ${pi(full)} = ${pi(coefficient)}$ ${unit}.`,
      `The coefficient is the number multiplying $\\pi$, so $a = ${tex(coefficient)}$.`,
      `Check against half the circle: $${angle} ${comparison} 180$ and $${tex(coefficient)} ${comparison} ${tex(half)}$. Both comparisons agree because the measure scales with the central angle.`,
    ];
    hint = `Find what fraction of a full turn ${angle} degrees is. Then take that fraction of the full ${isArc ? "circumference" : "area"}, found from the ${dimension} of ${plain(given)} cm as a multiple of $\\pi$.`;
  }
  const tags = [
    dimension,
    given.d === 1 ? "integer-given" : "fraction-given",
    coefficient.d === 1 ? "integer-coefficient" : "fraction-coefficient",
  ];
  if (angle !== null)
    tags.push(
      angle < 90
        ? "acute"
        : angle === 90
          ? "right"
          : angle < 180
            ? "obtuse"
            : angle === 180
              ? "straight"
              : "reflex",
    );
  return {
    tags,
    caseKey: JSON.stringify([plain(radius), angle]),
    angle,
    problem: {
      public: {
        id: createHash("sha256")
          .update(JSON.stringify([id, 1, seed]))
          .digest("hex"),
        templateId: id,
        templateVersion: 1,
        seed,
        skillId: metadata.skillId,
        prompt,
        response: { kind: "fraction", label: "Exact coefficient $a$" },
      },
      answer: plain(coefficient),
      hint,
      explanation,
      ...(piAxes ? { variant: sweepVariant("multiple-of-pi", piAxes) } : {}),
    },
  };
}

export function generateCircleMeasurementProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return circleMeasurementPrintCase(
    id,
    seed,
    id === "circle-area-coefficient"
      ? sweepChoose("circle-area-coefficient", seed)
      : undefined,
  ).problem;
}
