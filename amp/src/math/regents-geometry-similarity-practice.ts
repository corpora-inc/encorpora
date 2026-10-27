import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  numberSurface,
  pick,
} from "./chain-kit";
import { shuffle } from "./distribution-practice";
import { table } from "./scene/author";
import { roundText } from "./regents-kit";
import { clearOfTie, retry, tanD, type R } from "./regents-geometry-kit";

const choiceMeta = (
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
  requiredResponseCapability: "single-choice-v1",
  description,
});
const numMeta = (
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

export const altitudeRatioTemplate = choiceMeta(
  "geo-altitude-ratio",
  "Choose the trigonometric ratio that uses the altitude's triangle",
  "right-triangle-trigonometry",
  0.5,
  "In a right triangle with the altitude to the hypotenuse drawn, choose the one true equation for a sine, cosine or tangent of an acute angle, written with sides of the smaller right triangles.",
);
export const parallelPerimeterTemplate = numMeta(
  "geo-parallel-perimeter",
  "Perimeter of a triangle from a segment parallel to a side",
  "similarity-theorems",
  0.5,
  "A segment parallel to one side of a triangle cuts two sides. Use the similar small triangle, given from lengths of the cut sides, to find the perimeter of the whole triangle.",
);
export const parallelStatementTemplate = choiceMeta(
  "geo-parallel-statement",
  "Choose the statement that is not always true for triangles made by parallel segments",
  "similarity-theorems",
  0.4,
  "For two triangles formed by parallel segments, nested or crossing, choose the one statement that does not always hold, among similarity, angle congruences and a proportion.",
);
export const equalLegsTemplate = choiceMeta(
  "geo-equal-legs-radical",
  "Side of a similar isosceles right triangle with a radical",
  "special-right-triangles",
  0.45,
  "A right triangle has equal legs. A similar triangle gives a leg or the hypotenuse, and the other side is a whole number or a multiple of a square root of 2.",
);
export const elevationDepressionTemplate = numMeta(
  "geo-elevation-depression",
  "Height from an angle of elevation and an angle of depression",
  "right-triangle-trigonometry",
  0.55,
  "From a point at a stated horizontal distance, an angle of elevation to the top and an angle of depression to the base give two right triangles whose heights add, rounded to the stated place.",
);
export const densityRankTemplate = {
  ...choiceMeta(
    "geo-density-rank",
    "Rank regions by population density",
    "density-modeling",
    0.4,
    "From a table of populations and land areas of four regions, rank them by density, populations per square mile, among rankings by population, by area or in reverse order.",
  ),
  requiredFigureCapability: "scenes-v1" as const,
};

/* ------------------------------------------------------ altitude ratio */
type Seg = "AC" | "BC" | "AB" | "CD" | "AD" | "BD";
const segs: Seg[] = ["AC", "BC", "AB", "CD", "AD", "BD"];
const sub: Seg[] = ["CD", "AD", "BD"];
function lengths(p: number, q: number): Record<Seg, number> {
  const ab = Math.hypot(p, q);
  return {
    AC: p,
    BC: q,
    AB: ab,
    CD: (p * q) / ab,
    AD: (p * p) / ab,
    BD: (q * q) / ab,
  };
}
const trig = (fn: string, angle: "A" | "B", L: Record<Seg, number>) => {
  const opp = angle === "A" ? L.BC : L.AC;
  const adj = angle === "A" ? L.AC : L.BC;
  return fn === "sin" ? opp / L.AB : fn === "cos" ? adj / L.AB : opp / adj;
};
export const altitudeRatio = chainFamily({
  template: altitudeRatioTemplate,
  axes: {
    fn: defineAxis("fn", ["sin", "cos", "tan"] as const),
    angle: defineAxis("angle", ["a", "b"] as const),
  },
  model: (r: R, ax) => {
    const p = r(3, 12);
    const q = r(3, 12);
    if (p === q) retry();
    return {
      p,
      q,
      fn: ax.fn,
      angle: ax.angle === "a" ? ("A" as const) : ("B" as const),
    };
  },
  variant: (m) => `${m.fn}-${m.angle}`,
  render: (m, _ax, r) => {
    const L = lengths(m.p, m.q);
    const target = trig(m.fn, m.angle, L);
    const pairs: Array<[Seg, Seg]> = [];
    for (const u of segs) for (const v of segs) if (u !== v) pairs.push([u, v]);
    const uses = (pr: [Seg, Seg]) => sub.includes(pr[0]) || sub.includes(pr[1]);
    const isTrue = (pr: [Seg, Seg]) =>
      Math.abs(L[pr[0]] / L[pr[1]] - target) < 1e-9;
    const trues = pairs.filter((pr) => isTrue(pr) && uses(pr));
    const falses = pairs.filter(
      (pr) => Math.abs(L[pr[0]] / L[pr[1]] - target) > 1e-6 && uses(pr),
    );
    if (!trues.length) retry();
    const good = pick(r, trues);
    const bad = shuffle(r, [...falses]).slice(0, 3);
    const tex = (pr: [Seg, Seg]) =>
      `$\\${m.fn} ${m.angle} = \\frac{${pr[0]}}{${pr[1]}}$`;
    const fnWord =
      m.fn === "sin" ? "sine" : m.fn === "cos" ? "cosine" : "tangent";
    return choiceSurface(r, {
      prompt: `In right triangle $ABC$, the right angle is at $C$, $AC=${m.p}$ and $BC=${m.q}$. Altitude $\\overline{CD}$ is drawn to hypotenuse $\\overline{AB}$. Which equation is true?`,
      label: "Choose the equation",
      options: [
        { label: tex(good), correct: true },
        ...bad.map((pr) => ({
          label: tex(pr),
          feedback: `$\\frac{${pr[0]}}{${pr[1]}}$ is about ${roundText(L[pr[0]] / L[pr[1]], 3)}, but $\\${m.fn} ${m.angle}$ is about ${roundText(target, 3)}. The ratio uses the wrong sides for the ${fnWord} of angle $${m.angle}$.`,
        })),
      ],
      hint: `With $AC=${m.p}$ and $BC=${m.q}$, angle $${m.angle}$ is an angle of the small triangles $ACD$ and $BCD$ as well as of $ABC$. In the triangle that contains angle $${m.angle}$ and the altitude, mark the side opposite angle $${m.angle}$, the side adjacent to it and the hypotenuse.`,
      explanation: [
        `Angle $${m.angle}$ belongs to the whole triangle and to the small right triangle $${m.angle === "A" ? "ACD" : "BCD"}$ that has the altitude as a side.`,
        `In triangle $${m.angle === "A" ? "ACD" : "BCD"}$ the ${fnWord} of angle $${m.angle}$ is opposite over hypotenuse, adjacent over hypotenuse, or opposite over adjacent, using that triangle's own sides.`,
        `The true equation is ${tex(good)}.`,
      ],
    });
  },
});

/* ------------------------------------------------------ parallel perimeter */
export const parallelPerimeter = chainFamily({
  template: parallelPerimeterTemplate,
  axes: { given: defineAxis("given", ["cut-part", "whole-side"] as const) },
  model: (r: R) => {
    const [mm, nn] = pick(r, [
      [2, 5],
      [3, 5],
      [3, 4],
      [2, 3],
      [4, 5],
      [3, 7],
      [4, 7],
      [5, 7],
    ] as Array<[number, number]>);
    return { m: mm, n: nn, u: r(1, 4), v: r(1, 4), w: r(1, 4) };
  },
  variant: (m) => `ratio-${m.m}-${m.n}`,
  render: (m, ax) => {
    const { m: mm, n: nn, u, v, w } = m;
    const AD = mm * u;
    const AB = nn * u;
    const DB = AB - AD;
    const DE = mm * w;
    const BC = nn * w;
    const AE = mm * v;
    const AC = nn * v;
    const perimeter = AB + BC + AC;
    const len = (name: string, n: number) => `$${name}=${n}\\ \\text{cm}$`;
    const given =
      ax.given === "cut-part"
        ? `${len("AD", AD)}, ${len("DB", DB)}`
        : `${len("AD", AD)} and ${len("AB", AB)}`;
    const scale = `$\\frac{${AB}}{${AD}}$`;
    return numberSurface({
      prompt: `In triangle $ABC$, point $D$ is on $\\overline{AB}$ and point $E$ is on $\\overline{AC}$, with $\\overline{DE}\\parallel\\overline{BC}$. ${given.replace(" and ", ", ")}, ${len("DE", DE)} and ${len("AE", AE)}. What is the perimeter of triangle $ABC$ in centimeters?`,
      answer: String(perimeter),
      label: "Perimeter in centimeters",
      hint: `Since $\\overline{DE}\\parallel\\overline{BC}$, triangle $ADE$ is similar to triangle $ABC$. Find the whole side $AB$ from $AD=${AD}$ and the rest of the side, then compare $AB$ with $AD$ to find the scale factor.`,
      explanation: [
        `Parallel lines make equal alternate or corresponding angles, and angle $A$ is shared, so triangle $ADE$ is similar to triangle $ABC$.`,
        `$AB=${AB}$ cm, so the scale factor from $ADE$ to $ABC$ is ${scale}.`,
        `$BC=${DE}\\cdot${scale}=${BC}$ cm and $AC=${AE}\\cdot${scale}=${AC}$ cm.`,
        `The perimeter is $${AB}+${BC}+${AC}=${perimeter}$ cm.`,
      ],
    });
  },
});

/* ------------------------------------------------------ parallel statement */
const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
export const parallelStatement = chainFamily({
  template: parallelStatementTemplate,
  axes: { figure: defineAxis("figure", ["crossing", "nested"] as const) },
  model: (r: R) => ({ names: shuffle(r, [...letters]).slice(0, 5) }),
  variant: (m) => m.names.slice(0, 2).join(""),
  render: (m, ax, r) => {
    const [a, b, c, d, e] = m.names as [string, string, string, string, string];
    if (ax.figure === "crossing") {
      // Segments AB and CD cross at E; AC is parallel to BD.
      const tri1 = `${a}${e}${c}`;
      const tri2 = `${b}${e}${d}`;
      return choiceSurface(r, {
        prompt: `Segments $\\overline{${a}${b}}$ and $\\overline{${c}${d}}$ intersect at $${e}$, and $\\overline{${a}${c}}\\parallel\\overline{${b}${d}}$. Which statement is not always true?`,
        label: "Choose the statement",
        options: [
          {
            label: `$\\triangle ${tri1}\\cong\\triangle ${tri2}$`,
            correct: true,
          },
          {
            label: `$\\triangle ${tri1}\\sim\\triangle ${tri2}$`,
            feedback: `The parallel lines give $\\angle ${c}${a}${e}\\cong\\angle ${d}${b}${e}$ and the vertical angles at $${e}$ are congruent, so the triangles are similar by AA. This is always true.`,
          },
          {
            label: `$\\angle ${c}${a}${e}\\cong\\angle ${d}${b}${e}$`,
            feedback: `These are alternate interior angles of parallel lines $\\overline{${a}${c}}$ and $\\overline{${b}${d}}$ cut by $\\overline{${a}${b}}$, so this is always true.`,
          },
          {
            label: `$\\angle ${a}${e}${c}\\cong\\angle ${b}${e}${d}$`,
            feedback: `These are vertical angles, so they are always congruent.`,
          },
        ],
        hint: `Parallel lines $\\overline{${a}${c}}$ and $\\overline{${b}${d}}$ give equal alternate interior angles, and angles at $${e}$ across from each other are equal. Ask which statement needs the sides to be equal as well, not only the angles.`,
        explanation: [
          `Alternate interior angles and vertical angles give two pairs of congruent angles, so $\\triangle ${tri1}\\sim\\triangle ${tri2}$.`,
          "Similar triangles have the same shape but not always the same size, so a congruence statement needs a pair of equal corresponding sides, which is not given.",
          `The statement $\\triangle ${tri1}\\cong\\triangle ${tri2}$ is not always true.`,
        ],
      });
    }
    // D on AB, E on AC (renamed): DE is parallel to BC.
    const tri1 = `${a}${d}${e}`;
    const tri2 = `${a}${b}${c}`;
    return choiceSurface(r, {
      prompt: `In triangle $${a}${b}${c}$, point $${d}$ is on $\\overline{${a}${b}}$ and point $${e}$ is on $\\overline{${a}${c}}$, with $\\overline{${d}${e}}\\parallel\\overline{${b}${c}}$. Which statement is not always true?`,
      label: "Choose the statement",
      options: [
        { label: `$${d}${e}=${b}${c}$`, correct: true },
        {
          label: `$\\triangle ${tri1}\\sim\\triangle ${tri2}$`,
          feedback: `Angle $${a}$ is shared and the parallel lines give $\\angle ${a}${d}${e}\\cong\\angle ${a}${b}${c}$, so the triangles are similar. This is always true.`,
        },
        {
          label: `$\\angle ${a}${d}${e}\\cong\\angle ${a}${b}${c}$`,
          feedback: `These are corresponding angles of the parallel lines $\\overline{${d}${e}}$ and $\\overline{${b}${c}}$ cut by $\\overline{${a}${b}}$, so this is always true.`,
        },
        {
          label: `$\\frac{${a}${d}}{${a}${b}}=\\frac{${a}${e}}{${a}${c}}$`,
          feedback: `Corresponding sides of similar triangles are in proportion, so this is always true.`,
        },
      ],
      hint: `Because $\\overline{${d}${e}}\\parallel\\overline{${b}${c}}$, the angles at $${d}$ and $${b}$ are corresponding angles and angle $${a}$ is shared. Ask which statement says the two triangles have the same size, rather than the same shape.`,
      explanation: [
        `Corresponding angles and the shared angle at $${a}$ give $\\triangle ${tri1}\\sim\\triangle ${tri2}$, so corresponding sides are proportional.`,
        `The small triangle is generally smaller, so $\\overline{${d}${e}}$ is usually shorter than $\\overline{${b}${c}}$. They are equal only if $\\overline{${d}${e}}$ coincides with $\\overline{${b}${c}}$.`,
        `The statement $${d}${e}=${b}${c}$ is not always true.`,
      ],
    });
  },
});

/* ------------------------------------------------------ equal legs */
export const equalLegs = chainFamily({
  template: equalLegsTemplate,
  axes: { ask: defineAxis("ask", ["find-hypotenuse", "find-leg"] as const) },
  model: (r: R, ax) => {
    const a = r(2, 9);
    const b = ax.ask === "find-hypotenuse" ? r(3, 15) : 2 * r(2, 8);
    if (ax.ask === "find-hypotenuse" && b === a) retry();
    return { a, b };
  },
  variant: (m) => (m.b > m.a ? "enlargement" : "reduction"),
  render: (m, ax, r) => {
    const rad = (k: number) => `${k === 1 ? "" : k}\\sqrt{2}`;
    if (ax.ask === "find-hypotenuse") {
      return choiceSurface(r, {
        prompt: `In right triangle $ABC$, $AC=BC=${m.a}$ and the right angle is at $C$. Triangle $DEF$ is similar to triangle $ABC$, with the right angle at $F$ and $DF=${m.b}$. What is the length of $\\overline{DE}$?`,
        label: "Choose the length",
        options: [
          { label: `$${rad(m.b)}$`, correct: true },
          {
            label: `$${m.b}$`,
            feedback:
              "The side $\\overline{DE}$ is the hypotenuse, which is longer than a leg. It is not equal to the leg $DF$.",
          },
          {
            label: `$${2 * m.b}$`,
            feedback:
              "The hypotenuse of a right triangle with equal legs is the leg times $\\sqrt{2}$, not twice the leg.",
          },
          {
            label: `$${m.b}\\sqrt{3}$`,
            feedback:
              "The factor $\\sqrt{3}$ belongs to a 30-60-90 triangle. Equal legs make a 45-45-90 triangle, with hypotenuse leg times $\\sqrt{2}$.",
          },
          {
            label: `$${rad(m.a)}$`,
            feedback: `This is the hypotenuse $AB$ of the first triangle. $\\overline{DE}$ is in the larger or smaller similar triangle, with $DF=${m.b}$.`,
          },
        ],
        hint: `Triangle $DEF$ has the same shape as $ABC$, so its legs are equal too: $DF=${m.b}$. By the Pythagorean theorem, with equal legs $${m.b}$, the hypotenuse squared is $${m.b}^2+${m.b}^2$.`,
        explanation: [
          `Similar triangles keep the shape, so triangle $DEF$ also has equal legs: $DF=EF=${m.b}$.`,
          `$DE^2=${m.b}^2+${m.b}^2=${2 * m.b * m.b}$, so $DE=${m.b}\\sqrt{2}$.`,
          "In general the hypotenuse of a 45-45-90 triangle is the leg times $\\sqrt{2}$.",
        ],
      });
    }
    const e = m.b / 2;
    return choiceSurface(r, {
      prompt: `In right triangle $ABC$, $AC=BC=${m.a}$ and the right angle is at $C$. Triangle $DEF$ is similar to triangle $ABC$, with the right angle at $F$ and $DE=${m.b}$. What is the length of $\\overline{DF}$?`,
      label: "Choose the length",
      options: [
        { label: `$${rad(e)}$`, correct: true },
        {
          label: `$${rad(m.b)}$`,
          feedback: `That multiplies the hypotenuse by $\\sqrt{2}$. A leg is shorter than the hypotenuse, so divide by $\\sqrt{2}$.`,
        },
        {
          label: `$${e}$`,
          feedback:
            "A leg is not half of the hypotenuse in a 45-45-90 triangle. That is true for a 30-60-90 triangle.",
        },
        {
          label: `$${m.b}$`,
          feedback:
            "The leg $DF$ is shorter than the hypotenuse $DE$, so it cannot equal it.",
        },
        {
          label: `$${m.a}$`,
          feedback: `$${m.a}$ is a leg of the first triangle. $DF$ is a leg of the similar triangle with hypotenuse $${m.b}$.`,
        },
      ],
      hint: `Triangle $DEF$ has equal legs too, so $2\\cdot DF^2=DE^2$ with $DE=${m.b}$. Solve for $DF$ and write the result with $\\sqrt{2}$.`,
      explanation: [
        `Similar triangles keep the shape, so $DF=EF$ in triangle $DEF$.`,
        `$2\\cdot DF^2=${m.b}^2=${m.b * m.b}$, so $DF^2=${(m.b * m.b) / 2}$ and $DF=${e}\\sqrt{2}$.`,
        "A leg of a 45-45-90 triangle is the hypotenuse divided by $\\sqrt{2}$.",
      ],
    });
  },
});

/* ------------------------------------------------------ elevation and depression */
export const elevationDepression = chainFamily({
  template: elevationDepressionTemplate,
  axes: { place: defineAxis("place", ["whole", "tenth"] as const) },
  model: (r: R) => ({
    up: r(20, 58),
    down: r(15, 48),
    d: 5 * r(12, 60),
    thing: r(0, 2),
  }),
  variant: (m) => (m.up > m.down ? "higher-top" : "deeper-base"),
  render: (m, ax) => {
    const h = m.d * (tanD(m.up) + tanD(m.down));
    const places = ax.place === "whole" ? 0 : 1;
    if (!clearOfTie(h, places)) retry();
    const thing = ["cliff", "tower", "building"][m.thing]!;
    const unit = ax.place === "whole" ? "foot" : "tenth of a foot";
    return numberSurface({
      prompt: `A lookout is $${m.d}$ feet from a ${thing}, measured along level ground. From the lookout, the angle of elevation to the top of the ${thing} is $${m.up}^\\circ$ and the angle of depression to its base is $${m.down}^\\circ$. What is the height of the ${thing}, to the nearest ${unit}?`,
      answer: roundText(h, places),
      label: "Height in feet",
      hint: `Draw a horizontal line through the point. The ${thing}'s height is split into a part above that line and a part below it. Use $\\tan ${m.up}^\\circ$ with $${m.d}$ for the upper part and $\\tan ${m.down}^\\circ$ with $${m.d}$ for the lower part.`,
      explanation: [
        `Above the horizontal line: $${m.d}\\tan ${m.up}^\\circ\\approx${roundText(m.d * tanD(m.up), 2)}$ feet.`,
        `Below the horizontal line: $${m.d}\\tan ${m.down}^\\circ\\approx${roundText(m.d * tanD(m.down), 2)}$ feet.`,
        `The total height is about ${roundText(h, places)} feet.`,
      ],
    });
  },
});

/* ------------------------------------------------------ density rank */
const regionNames = [
  "Alder",
  "Birch",
  "Cedar",
  "Dunes",
  "Elm",
  "Fir",
  "Grove",
  "Heath",
];
export const densityRank = chainFamily({
  template: densityRankTemplate,
  axes: {
    order: defineAxis("order", ["greatest-first", "least-first"] as const),
  },
  model: (r: R) => {
    const names = shuffle(r, [...regionNames]).slice(0, 4);
    const rows = names.map((name) => ({
      name,
      pop: 1000 * r(80, 4800),
      area: 100 * r(40, 600),
    }));
    const dens = rows.map((x) => x.pop / x.area).sort((p, q) => p - q);
    // Densities and also populations and areas are well separated.
    for (let i = 1; i < 4; i++) if (dens[i]! / dens[i - 1]! < 1.12) retry();
    const pops = rows.map((x) => x.pop);
    const areas = rows.map((x) => x.area);
    if (new Set(pops).size < 4 || new Set(areas).size < 4) retry();
    return { rows };
  },
  variant: (m) => m.rows[0]!.name,
  render: (m, ax, r) => {
    const byDensity = [...m.rows].sort(
      (p, q) => q.pop / q.area - p.pop / p.area,
    );
    const greatest = ax.order === "greatest-first";
    const dense = greatest ? byDensity : [...byDensity].reverse();
    const text = (list: typeof m.rows) => list.map((x) => x.name).join(", ");
    const byPop = [...m.rows].sort((p, q) =>
      greatest ? q.pop - p.pop : p.pop - q.pop,
    );
    const byArea = [...m.rows].sort((p, q) =>
      greatest ? p.area - q.area : q.area - p.area,
    );
    const reversed = [...dense].reverse();
    const group = (n: number) =>
      String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const scene = table({
      id: "t",
      columns: ["Population", "Area (sq mi)"],
      corner: "County",
      rows: m.rows.map((x) => ({
        label: x.name,
        cells: [group(x.pop), group(x.area)],
      })),
    }).scene({});
    const surface = choiceSurface(r, {
      prompt: `The table shows the population and the land area of four counties. Population density is the number of people per square mile. Which list ranks the counties from ${greatest ? "greatest to least" : "least to greatest"} population density?`,
      label: "Choose the ranking",
      options: [
        { label: text(dense), correct: true },
        {
          label: text(byPop),
          feedback: `This ranks by population alone. Density divides the population by the area, so a large population on a large area may be less dense.`,
        },
        {
          label: text(byArea),
          feedback:
            "This ranks by area. A small area is not always dense; the number of people matters too.",
        },
        {
          label: text(reversed),
          feedback: `This is the reverse order. The ranking asked for starts with the ${greatest ? "most" : "least"} dense county.`,
        },
      ],
      hint: `Divide each population by its area, for example ${group(m.rows[0]!.pop)} people by ${group(m.rows[0]!.area)} square miles for ${m.rows[0]!.name}, then order the four quotients.`,
      explanation: [
        ...byDensity.map(
          (x) =>
            `${x.name}: ${group(x.pop)} ÷ ${group(x.area)} ≈ ${roundText(x.pop / x.area, 1)} people per square mile.`,
        ),
        `From ${greatest ? "greatest to least" : "least to greatest"}: ${text(dense)}.`,
      ],
    });
    return surface && { ...surface, figure: { kind: "scene" as const, scene } };
  },
});

export const regentsGeometrySimilarityTemplates = [
  altitudeRatioTemplate,
  parallelPerimeterTemplate,
  parallelStatementTemplate,
  equalLegsTemplate,
  elevationDepressionTemplate,
  densityRankTemplate,
];
export const regentsGeometrySimilarityGenerate = dispatch(
  regentsGeometrySimilarityTemplates,
  {
    "geo-altitude-ratio": (s) => altitudeRatio.generate(s).problem,
    "geo-parallel-perimeter": (s) => parallelPerimeter.generate(s).problem,
    "geo-parallel-statement": (s) => parallelStatement.generate(s).problem,
    "geo-equal-legs-radical": (s) => equalLegs.generate(s).problem,
    "geo-elevation-depression": (s) => elevationDepression.generate(s).problem,
    "geo-density-rank": (s) => densityRank.generate(s).problem,
  },
);
