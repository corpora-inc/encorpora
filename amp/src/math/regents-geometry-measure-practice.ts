import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, dispatch, numberSurface, pick } from "./chain-kit";
import { roundText } from "./regents-kit";
import {
  clearOfTie,
  cosD,
  retry,
  sinD,
  tanD,
  type R,
} from "./regents-geometry-kit";

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
  description,
});

export const arcLengthRoundedTemplate = meta(
  "geo-arc-length-rounded",
  "Arc length from a central angle, rounded",
  "arc-sector-measure",
  0.4,
  "Find the length of an arc cut by a central angle that is not a nice fraction of the circle, from a radius or a diameter, rounded to the stated place.",
);
export const trigLegDegreesTemplate = meta(
  "geo-trig-leg-degrees",
  "Leg of a right triangle from the hypotenuse and an angle in degrees",
  "right-triangle-trigonometry",
  0.4,
  "Use sine or cosine with a calculator in degree mode to find the leg opposite or adjacent to a given acute angle, rounded to the nearest tenth.",
);
export const sasTriangleAreaTemplate = meta(
  "geo-sas-triangle-area",
  "Triangle area from two sides and the included angle",
  "trigonometric-area",
  0.45,
  "Find the area of a triangle from two decimal side lengths and an acute or obtuse included angle with a calculator, rounded to the nearest tenth.",
);
export const ringAreaTemplate = meta(
  "geo-ring-area",
  "Area of a ring around a circle",
  "composite-measurement",
  0.4,
  "Subtract an inner circle from the larger circle formed by adding a uniform border to its radius, from a radius or a diameter, rounded to the nearest square unit.",
);
export const sphereDiameterTemplate = meta(
  "geo-sphere-diameter",
  "Radius or diameter of a sphere from its volume",
  "curved-solid-volume",
  0.5,
  "Solve the sphere volume formula for the radius from a volume given as a number, then report the radius or the diameter rounded to the nearest tenth.",
);
export const isoscelesTrigTemplate = meta(
  "geo-isosceles-trig",
  "Isosceles triangle measures from an altitude and an angle",
  "right-triangle-trigonometry",
  0.5,
  "Split an isosceles triangle into two right triangles to find its perimeter from the apex angle and altitude, or a base angle from the base and the height.",
);
export const volumeContextTemplate = meta(
  "geo-volume-context",
  "Weight, mass or trips from a solid's volume",
  "solid-volume-models",
  0.5,
  "Find a decimal volume of a cylinder, a prism with a pyramid, or a cone, then apply a density or load size and round to a whole weight, mass or number of trips.",
);

/* -------------------------------------------------------------- helpers */
const numeric = (
  prompt: string,
  answer: string,
  hint: string,
  explanation: string[],
  label: string,
) => numberSurface({ prompt, answer, hint, explanation, label });
const tex = (s: string | number) => `$${s}$`;

/* ------------------------------------------------------------ arc length */
const arcAxes = {
  given: defineAxis("given", ["radius", "diameter"] as const),
  place: defineAxis("place", ["whole", "tenth"] as const),
};
export const arcLengthRounded = chainFamily({
  template: arcLengthRoundedTemplate,
  axes: arcAxes,
  model: (r: R, a) => {
    const radius = r(4, 30);
    const angle = pick(r, [
      35, 40, 55, 70, 85, 100, 125, 140, 155, 200, 215, 250,
    ] as const);
    const value = (angle / 360) * 2 * Math.PI * radius;
    if (!clearOfTie(value, a.place === "whole" ? 0 : 1)) retry();
    return {
      radius,
      angle,
      value,
      unit: pick(r, ["centimeters", "inches", "meters"] as const),
    };
  },
  variant: (m) => (m.angle > 180 ? "major-arc" : "minor-arc"),
  render: (m, a) => {
    const places = a.place === "whole" ? 0 : 1;
    const answer = roundText(m.value, places);
    const circ = 2 * Math.PI * m.radius;
    const radiusText =
      a.given === "radius"
        ? `a radius of ${m.radius} ${m.unit}`
        : `a diameter of ${2 * m.radius} ${m.unit}`;
    return numeric(
      `A circle has ${radiusText}. A central angle of ${tex(`${m.angle}^\\circ`)} intercepts an arc. Find the arc length to the nearest ${places ? "tenth of a unit" : "whole unit"}.`,
      answer,
      `A full turn is 360°, so the ${m.angle}° angle cuts off ${tex(`\\frac{${m.angle}}{360}`)} of the circle. ${a.given === "diameter" ? `Start by halving the diameter ${2 * m.radius} to get the radius, the distance from the center to the circle.` : `Start with the circumference, the distance around the circle with radius ${m.radius}.`}`,
      [
        `A central angle has its vertex, its corner point, at the center of the circle. The arc it intercepts is the piece of the circle between its two sides.`,
        a.given === "diameter"
          ? `The radius is half the diameter, the distance across through the center: ${tex(`${2 * m.radius}\\div2=${m.radius}`)} ${m.unit}.`
          : `The radius, the distance from the center to the circle, is ${m.radius} ${m.unit}.`,
        `The circumference, the distance all the way around, is ${tex(`2\\pi r`)}. Here that is ${tex(`2\\pi(${m.radius})\\approx${roundText(circ, 3)}`)} ${m.unit}.`,
        `A full turn is 360°, so the arc is ${tex(`\\frac{${m.angle}}{360}`)} of the whole way around.`,
        `Multiply: ${tex(`\\frac{${m.angle}}{360}\\cdot${roundText(circ, 3)}\\approx${roundText(m.value, 3)}`)}. Round only at the end so the answer stays accurate.`,
        `The arc length is about ${answer} ${m.unit}, rounded to the nearest ${places ? "tenth" : "whole unit"}.`,
      ],
      `Arc length (${m.unit})`,
    );
  },
});

/* ------------------------------------------------------- trig leg degrees */
const legAxes = { leg: defineAxis("leg", ["opposite", "adjacent"] as const) };
export const trigLegDegrees = chainFamily({
  template: trigLegDegreesTemplate,
  axes: legAxes,
  model: (r: R) => {
    const angle = pick(r, [
      17, 22, 27, 31, 36, 41, 52, 58, 63, 68, 73,
    ] as const);
    const hyp = r(8, 45);
    return { angle, hyp, big: r(0, 1) === 1 };
  },
  variant: (m) => (m.angle < 45 ? "small-angle" : "large-angle"),
  render: (m, a) => {
    const opp = a.leg === "opposite";
    const value = opp ? m.hyp * sinD(m.angle) : m.hyp * cosD(m.angle);
    if (!clearOfTie(value, 1)) return null;
    const [A, B, C] = m.big ? ["P", "Q", "R"] : ["A", "B", "C"];
    const target = opp ? `${B}${C}` : `${A}${C}`;
    const fn = opp ? "\\sin" : "\\cos";
    const answer = roundText(value, 1);
    return numeric(
      `In right triangle ${tex(`${A}${B}${C}`)} the right angle is at ${tex(C)}, ${tex(`${A}${B}=${m.hyp}`)} and ${tex(`m\\angle ${A}=${m.angle}^\\circ`)}. Find ${tex(target)} to the nearest tenth. Use a calculator in degree mode.`,
      answer,
      `${tex(`${A}${B}=${m.hyp}`)} is the hypotenuse, the longest side, across from the right angle. Side ${tex(target)} is ${opp ? "opposite" : "adjacent to (touching)"} the ${m.angle}° angle at ${tex(A)}. Pick the ratio that uses that side and the hypotenuse.`,
      [
        `The right angle is at ${tex(C)}, so the side across from it, ${tex(`${A}${B}`)}, is the hypotenuse, the longest side.`,
        opp
          ? `${tex(target)} is the leg opposite ${tex(`\\angle ${A}`)}: it is the side across from that angle, not touching it.`
          : `${tex(target)} is the leg adjacent to ${tex(`\\angle ${A}`)}: it touches that angle and is not the hypotenuse.`,
        opp
          ? `The sine of an angle, written ${tex("\\sin")}, is opposite ÷ hypotenuse. So ${tex(`\\sin\\,${m.angle}^\\circ=\\frac{${target}}{${m.hyp}}`)}.`
          : `The cosine of an angle, written ${tex("\\cos")}, is adjacent ÷ hypotenuse. So ${tex(`\\cos\\,${m.angle}^\\circ=\\frac{${target}}{${m.hyp}}`)}.`,
        `Multiply both sides by ${m.hyp} to get the side alone: ${tex(`${target}=${m.hyp}\\cdot${fn}\\,${m.angle}^\\circ\\approx${roundText(value, 3)}`)}.`,
        `Side ${tex(target)} is about ${answer} units long, to the nearest tenth.`,
      ],
      "Length (nearest tenth)",
    );
  },
});

/* --------------------------------------------------------- SAS area */
const sasAxes = { angle: defineAxis("angle", ["acute", "obtuse"] as const) };
export const sasTriangleArea = chainFamily({
  template: sasTriangleAreaTemplate,
  axes: sasAxes,
  model: (r: R, a) => {
    const s1 = r(40, 120) / 10;
    const s2 = r(40, 120) / 10;
    const angle = a.angle === "acute" ? r(25, 80) : r(100, 155);
    return { s1, s2, angle };
  },
  variant: (m) => (m.angle > 90 ? "obtuse" : "acute"),
  render: (m) => {
    const area = 0.5 * m.s1 * m.s2 * sinD(m.angle);
    if (!clearOfTie(area, 1)) return null;
    const answer = roundText(area, 1);
    return numeric(
      `Two sides of a triangle measure ${tex(m.s1.toFixed(1))} cm and ${tex(m.s2.toFixed(1))} cm, and the angle between them measures ${tex(`${m.angle}^\\circ`)}. Find the area of the triangle to the nearest tenth of a square centimeter. Use a calculator in degree mode.`,
      answer,
      `The ${m.angle}° angle sits between the sides ${tex(m.s1.toFixed(1))} cm and ${tex(m.s2.toFixed(1))} cm. Start by multiplying those two sides by the sine of that angle.`,
      [
        `The angle between two sides is called the included angle. Here it is ${m.angle}°, between the ${m.s1.toFixed(1)} cm and ${m.s2.toFixed(1)} cm sides.`,
        `Area is usually ${tex("\\frac12\\times\\text{base}\\times\\text{height}")}. The height is not given, but sine can find it.`,
        `The sine of an angle, written ${tex("\\sin")}, turns a slanted side into a height: height ${tex(`=${m.s2.toFixed(1)}\\sin ${m.angle}^\\circ`)}.`,
        `So the area is ${tex("\\frac12ab\\sin C")}, with ${tex("a")} and ${tex("b")} the two sides and ${tex("C")} the included angle.`,
        `Substitute: ${tex(`\\frac12(${m.s1.toFixed(1)})(${m.s2.toFixed(1)})\\sin ${m.angle}^\\circ\\approx${roundText(area, 3)}`)}.`,
        `The triangle's area is about ${answer} ${tex("\\text{cm}^2")}, to the nearest tenth of a square centimeter.`,
      ],
      "Area (square centimeters)",
    );
  },
});

/* ------------------------------------------------------------- ring area */
const ringAxes = {
  given: defineAxis("given", ["radius", "diameter"] as const),
};
export const ringArea = chainFamily({
  template: ringAreaTemplate,
  axes: ringAxes,
  model: (r: R) => ({
    inner: r(4, 20),
    border: r(2, 6),
    unit: pick(r, ["feet", "meters"] as const),
  }),
  variant: (m) => (m.border * 2 > m.inner ? "wide-border" : "narrow-border"),
  render: (m, a) => {
    const outer = m.inner + m.border;
    const area = Math.PI * (outer * outer - m.inner * m.inner);
    if (!clearOfTie(area, 0)) return null;
    const answer = roundText(area, 0);
    const u = m.unit === "feet" ? "ft" : "m";
    const pool =
      a.given === "radius"
        ? `A circular pool has a radius of ${m.inner} ${m.unit}`
        : `A circular pool has a diameter of ${2 * m.inner} ${m.unit}`;
    return numeric(
      `${pool}. A walkway ${m.border} ${m.unit} wide surrounds it. Find the area of the walkway to the nearest square ${m.unit === "feet" ? "foot" : "meter"}.`,
      answer,
      `The walkway is the large circle minus the pool. ${a.given === "diameter" ? `Halve ${2 * m.inner} to get the pool's radius, the distance from its center to its edge. Then add the ${m.border}-wide walkway to` : `Add the walkway width ${m.border} to the pool radius ${m.inner}, the distance from the center to the edge, to`} get the radius of the large circle.`,
      [
        a.given === "diameter"
          ? `The radius is the distance from the center to the edge, half the diameter: ${tex(`${2 * m.inner}\\div2=${m.inner}`)} ${m.unit}.`
          : `The pool's radius, the distance from its center to its edge, is ${m.inner} ${m.unit}.`,
        `The walkway adds ${m.border} ${m.unit} all around. So the outer circle's radius is ${tex(`${m.inner}+${m.border}=${outer}`)} ${m.unit}.`,
        `A circle's area is ${tex("\\pi r^2")}, where ${tex("r")} is the radius. The walkway is the big circle with the pool cut out.`,
        `Subtract the areas: ${tex(`\\pi(${outer})^2-\\pi(${m.inner})^2=\\pi(${outer * outer}-${m.inner * m.inner})=${outer * outer - m.inner * m.inner}\\pi\\approx${roundText(area, 3)}`)}.`,
        `The walkway covers about ${answer} ${tex(`\\text{${u}}^2`)}, to the nearest square ${m.unit === "feet" ? "foot" : "meter"}.`,
      ],
      `Area (square ${m.unit})`,
    );
  },
});

const uw = (u: string) =>
  (u === "cm"
    ? ["centimeter", "centimeters"]
    : u === "in"
      ? ["inch", "inches"]
      : ["meter", "meters"]) as [string, string];
/* --------------------------------------------------------- sphere diameter */
const sphereAxes = { ask: defineAxis("ask", ["diameter", "radius"] as const) };
export const sphereDiameter = chainFamily({
  template: sphereDiameterTemplate,
  axes: sphereAxes,
  model: (r: R) => ({
    volume: r(150, 9000),
    unit: pick(r, ["cm", "in", "m"] as const),
  }),
  variant: (m) => (m.volume > 2000 ? "large-sphere" : "small-sphere"),
  render: (m, a) => {
    const radius = Math.cbrt((3 * m.volume) / (4 * Math.PI));
    const value = a.ask === "diameter" ? 2 * radius : radius;
    if (!clearOfTie(value, 1)) return null;
    const answer = roundText(value, 1);
    return numeric(
      `A sphere has a volume of ${tex(`${m.volume}\\ \\text{${m.unit}}^3`)}. Find its ${a.ask} to the nearest tenth of ${/^[aeiou]/.test(uw(m.unit)[0]) ? "an" : "a"} ${uw(m.unit)[0]}.`,
      answer,
      `A sphere's volume is ${tex("\\frac43\\pi r^3")}, where ${tex("r")} is the radius. Set ${tex(`\\frac43\\pi r^3=${m.volume}`)} and get ${tex("r^3")} alone before taking a cube root.${a.ask === "diameter" ? " The question asks for the diameter, which is twice the radius." : ""}`,
      [
        `A sphere's volume is ${tex("\\frac43\\pi r^3")}. The radius ${tex("r")} is the distance from the center to the surface.`,
        `Set the formula equal to the given volume: ${tex(`\\frac43\\pi r^3=${m.volume}`)}.`,
        `Undo the ${tex("\\frac43\\pi")} by multiplying by 3 and dividing by ${tex("4\\pi")}: ${tex(`r^3=\\frac{3(${m.volume})}{4\\pi}\\approx${roundText((3 * m.volume) / (4 * Math.PI), 3)}`)}.`,
        `A cube root undoes cubing; it finds the number that, used three times as a factor, gives ${roundText((3 * m.volume) / (4 * Math.PI), 3)}: ${tex(`r=\\sqrt[3]{${roundText((3 * m.volume) / (4 * Math.PI), 3)}}\\approx${roundText(radius, 3)}`)} ${uw(m.unit)[1]}.`,
        a.ask === "diameter"
          ? `The diameter, the distance straight through the center, is twice the radius: ${tex(`2r\\approx${roundText(2 * radius, 3)}`)}. The sphere's diameter is about ${answer} ${uw(m.unit)[1]}, to the nearest tenth.`
          : `The sphere's radius is about ${answer} ${uw(m.unit)[1]}, to the nearest tenth.`,
      ],
      `${a.ask === "diameter" ? "Diameter" : "Radius"} (${uw(m.unit)[1]})`,
    );
  },
});

/* --------------------------------------------------- isosceles trig */
const isoAxes = {
  ask: defineAxis("ask", ["perimeter", "base-angle"] as const),
};
export const isoscelesTrig = chainFamily({
  template: isoscelesTrigTemplate,
  axes: isoAxes,
  model: (r: R) => ({
    apex: 2 * r(15, 55),
    height: r(6, 30),
    width: 2 * r(6, 18),
    roofHeight: r(3, 14),
  }),
  variant: (m) => (m.apex > 60 ? "wide-apex" : "narrow-apex"),
  render: (m, a) => {
    if (a.ask === "perimeter") {
      const half = m.apex / 2;
      const base = 2 * m.height * tanD(half);
      const leg = m.height / cosD(half);
      const p = base + 2 * leg;
      if (!clearOfTie(p, 1)) return null;
      const answer = roundText(p, 1);
      return numeric(
        `An isosceles triangle has an apex angle of ${tex(`${m.apex}^\\circ`)}. The altitude from the apex to the base is ${tex(m.height)} cm long. Find the perimeter of the triangle to the nearest tenth of a centimeter. Use a calculator in degree mode.`,
        answer,
        `The altitude, the height line from the apex (top corner) straight down to the base, splits the ${m.apex}° angle in half and cuts the base in half. Work in one right triangle with leg ${m.height} and angle ${tex(`${half}^\\circ`)}.`,
        [
          `An isosceles triangle has two equal sides. The apex is the corner where those two sides meet.`,
          `The altitude is the height line from the apex, meeting the base at a right angle. In an isosceles triangle it cuts the apex angle and the base exactly in half.`,
          `That makes two matching right triangles. Each has a ${tex(`${half}^\\circ`)} angle at the apex and a leg of ${tex(m.height)} cm next to it.`,
          `The tangent of an angle is the opposite side divided by the adjacent side. The half-base is opposite the ${half}° angle: ${tex(`${m.height}\\tan ${half}^\\circ\\approx${roundText(base / 2, 3)}`)} cm.`,
          `Cosine is adjacent ÷ hypotenuse. Each equal side is a hypotenuse, so it is ${tex(`\\frac{${m.height}}{\\cos ${half}^\\circ}\\approx${roundText(leg, 3)}`)} cm.`,
          `The perimeter is the distance around: the full base plus the two equal sides. ${tex(`${roundText(base, 3)}+2(${roundText(leg, 3)})\\approx${roundText(p, 3)}`)}.`,
          `The triangle's perimeter is about ${answer} cm, to the nearest tenth.`,
        ],
        "Perimeter (centimeters)",
      );
    }
    const angle = (Math.atan(m.roofHeight / (m.width / 2)) * 180) / Math.PI;
    if (!clearOfTie(angle, 0)) return null;
    const answer = roundText(angle, 0);
    return numeric(
      `The end of a roof is an isosceles triangle. Its base is ${tex(m.width)} feet wide and its peak is ${tex(m.roofHeight)} feet above the base. Find the measure of a base angle to the nearest degree. Use a calculator in degree mode.`,
      answer,
      `Draw the height from the peak straight down. It cuts the ${m.width}-foot base into two equal halves and makes a right triangle with legs ${m.roofHeight} and half of ${m.width}.`,
      [
        `An isosceles triangle has two equal sides, so the height from the peak lands at the middle of the base.`,
        `That makes a right triangle. Its legs, the two sides that form the right angle, are ${tex(m.roofHeight)} ft and ${tex(`${m.width}\\div2=${m.width / 2}`)} ft.`,
        `Call the base angle ${tex("\\theta")} (theta). The ${m.roofHeight} ft leg is opposite it, across from it. The ${m.width / 2} ft leg is adjacent, touching it.`,
        `The tangent of an angle is the opposite side divided by the adjacent side, so ${tex(`\\tan\\theta=\\frac{${m.roofHeight}}{${m.width / 2}}`)}.`,
        `The inverse tangent, ${tex("\\tan^{-1}")}, goes backward from the ratio to the angle: ${tex(`\\theta=\\tan^{-1}\\left(\\frac{${m.roofHeight}}{${m.width / 2}}\\right)\\approx${roundText(angle, 3)}^\\circ`)}.`,
        `Each base angle of the roof measures about ${answer} degrees, to the nearest degree.`,
      ],
      "Base angle (degrees)",
    );
  },
});

/* ---------------------------------------------------------- volume context */
const volAxes = {
  solid: defineAxis("solid", [
    "cylinder-weight",
    "prism-pyramid-mass",
    "cone-trips",
  ] as const),
};
export const volumeContext = chainFamily({
  template: volumeContextTemplate,
  axes: volAxes,
  model: (r: R) => ({
    d: r(10, 24) / 2,
    h: r(8, 30) / 2,
    density: r(60, 140),
    side: r(3, 9),
    prismH: r(4, 12),
    pyrH: r(3, 10),
    gram: r(20, 90) / 10,
    coneR: r(5, 14),
    coneH: r(4, 10),
    load: r(6, 20),
  }),
  variant: (m) => (m.d > 8 ? "wide" : "narrow"),
  render: (m, a) => {
    if (a.solid === "cylinder-weight") {
      const rad = m.d / 2;
      const vol = Math.PI * rad * rad * m.h;
      const w = vol * m.density;
      if (!clearOfTie(w, 0)) return null;
      const answer = roundText(w, 0);
      return numeric(
        `A cylindrical bucket has an inside diameter of ${tex(m.d)} feet and a height of ${tex(m.h)} feet. It is filled to the top with soil that weighs ${tex(m.density)} pounds per cubic foot. Find the weight of the soil to the nearest pound.`,
        answer,
        `Halve the diameter ${m.d} to get the radius, the distance from the center to the side. Then find the volume ${tex("\\pi r^2h")} in cubic feet.`,
        [
          `The radius is half the diameter: ${tex(`${m.d}\\div2=${rad}`)} ft.`,
          `A cylinder's volume is ${tex("\\pi r^2h")}: the circle's area ${tex("\\pi r^2")} times the height ${tex("h")}. Here ${tex(`\\pi(${rad})^2(${m.h})\\approx${roundText(vol, 3)}\\ \\text{ft}^3`)}.`,
          `Each cubic foot of soil weighs ${m.density} pounds, so multiply: ${tex(`${roundText(vol, 3)}\\times${m.density}\\approx${roundText(w, 2)}`)} pounds.`,
          `The soil weighs about ${answer} pounds, to the nearest pound.`,
        ],
        "Weight (pounds)",
      );
    }
    if (a.solid === "prism-pyramid-mass") {
      const v = m.side * m.side * m.prismH + (m.side * m.side * m.pyrH) / 3;
      const mass = v * m.gram;
      if (!clearOfTie(mass, 0)) return null;
      const answer = roundText(mass, 0);
      return numeric(
        `A solid trophy is a square prism with a square pyramid on top. The base of the prism is ${tex(`${m.side}\\ \\text{cm}`)} by ${tex(`${m.side}\\ \\text{cm}`)} and the prism is ${tex(m.prismH)} cm tall. The pyramid has the same base and is ${tex(m.pyrH)} cm tall. The trophy is made of metal with a density of ${tex(m.gram.toFixed(1))} grams per cubic centimeter. Find the mass of the trophy to the nearest gram.`,
        answer,
        `Find two volumes with the base ${m.side} by ${m.side}: the prism of height ${m.prismH} and the pyramid of height ${m.pyrH}, which is one third of a prism with the same base and height. Add them before using the density.`,
        [
          `A prism's volume is base area × height. The square base has area ${tex(`${m.side}\\cdot${m.side}=${m.side * m.side}\\ \\text{cm}^2`)}.`,
          `Prism: ${tex(`${m.side * m.side}\\cdot${m.prismH}=${m.side * m.side * m.prismH}\\ \\text{cm}^3`)}.`,
          `A pyramid holds one third of a prism with the same base and height. Pyramid: ${tex(`\\frac13(${m.side * m.side})(${m.pyrH})=${roundText((m.side * m.side * m.pyrH) / 3, 3)}\\ \\text{cm}^3`)}.`,
          `Add the two parts: the total volume is ${tex(`${roundText(v, 3)}\\ \\text{cm}^3`)}.`,
          `Density is mass per unit of volume: each cubic centimeter has ${m.gram.toFixed(1)} grams. Mass ${tex(`=${roundText(v, 3)}\\times${m.gram.toFixed(1)}\\approx${roundText(mass, 2)}`)} grams.`,
          `The trophy's mass is about ${answer} grams, to the nearest gram.`,
        ],
        "Mass (grams)",
      );
    }
    const v = (Math.PI * m.coneR * m.coneR * m.coneH) / 3;
    const trips = v / m.load;
    const frac = trips - Math.floor(trips);
    if (frac < 0.08 || frac > 0.92) return null;
    const answer = String(Math.ceil(trips));
    return numeric(
      `A pile of sand is a cone with a radius of ${tex(m.coneR)} feet and a height of ${tex(m.coneH)} feet. A wagon carries ${tex(m.load)} cubic feet of sand per trip. What is the fewest number of trips needed to carry all of the sand?`,
      answer,
      `Find the volume of the cone, ${tex("\\frac13\\pi r^2h")}, with radius ${m.coneR} and height ${m.coneH}. Then divide by ${m.load} cubic feet per trip and decide what to do with the leftover part of a trip.`,
      [
        `A cone holds one third of a cylinder with the same base and height, so its volume is ${tex("\\frac13\\pi r^2h")}.`,
        `Here ${tex(`\\frac13\\pi(${m.coneR})^2(${m.coneH})\\approx${roundText(v, 2)}\\ \\text{ft}^3`)} of sand.`,
        `Each trip moves ${m.load} cubic feet, so divide: ${tex(`${roundText(v, 2)}\\div${m.load}\\approx${roundText(trips, 2)}`)} trips.`,
        `The leftover sand still needs its own trip, so round up, not to the nearest whole number.`,
        `The fewest number of trips is ${answer}.`,
      ],
      "Number of trips",
    );
  },
});

export const regentsGeometryMeasureTemplates = [
  arcLengthRoundedTemplate,
  trigLegDegreesTemplate,
  sasTriangleAreaTemplate,
  ringAreaTemplate,
  sphereDiameterTemplate,
  isoscelesTrigTemplate,
  volumeContextTemplate,
];
export const regentsGeometryMeasureGenerate = dispatch(
  regentsGeometryMeasureTemplates,
  {
    "geo-arc-length-rounded": (s) => arcLengthRounded.generate(s).problem,
    "geo-trig-leg-degrees": (s) => trigLegDegrees.generate(s).problem,
    "geo-sas-triangle-area": (s) => sasTriangleArea.generate(s).problem,
    "geo-ring-area": (s) => ringArea.generate(s).problem,
    "geo-sphere-diameter": (s) => sphereDiameter.generate(s).problem,
    "geo-isosceles-trig": (s) => isoscelesTrig.generate(s).problem,
    "geo-volume-context": (s) => volumeContext.generate(s).problem,
  },
);
