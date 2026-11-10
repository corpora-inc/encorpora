import {
  blanks,
  choice,
  math as m,
  pick,
  picture,
  round,
  scene,
  type ClauseExtension,
  type ClauseSurface,
} from "./clause-kit";
import {
  figureAngleMark,
  figureName,
  figureRightMark,
  figureSegment,
} from "./geometry-teaching-figures";
import type { Element, Point } from "./scene/spec";
import { count } from "./agreement";
import type { Random } from "./variation/axes";

const slot = (label: string, correct: string, ...wrong: string[]) => ({
  label,
  correct,
  wrong,
});
const polar = (radius: number, deg: number, center: Point = [0, 0]): Point => [
  center[0] + radius * Math.cos((deg * Math.PI) / 180),
  center[1] + radius * Math.sin((deg * Math.PI) / 180),
];
const frac = (n: number, d: number) => {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = gcd(n, d);
  return d / g === 1 ? String(n / g) : `\\frac{${n / g}}{${d / g}}`;
};
const pi = (n: number, d = 1) => m(`${frac(n, d)}\\pi`);

function wedges(rng: Random): ClauseSurface {
  const r = rng(2, 12),
    mode = rng(0, 1),
    given = rng(0, 2),
    C = 2 * r,
    exact = mode === 0;
  const width = exact ? pi(r) : String(round(3.14 * r)),
    area = exact ? pi(r * r) : String(round(3.14 * r * r));
  const circumference = exact ? pi(C) : String(round(3.14 * C));
  const lead =
    given === 0
      ? `A circle has radius ${r} cm`
      : given === 1
        ? `A circle has diameter ${2 * r} cm`
        : `A circle has circumference ${circumference} cm`;
  const elements: Element[] = [
    { type: "circle", center: [0, 0], r: 1, stroke: "warm" },
  ];
  for (let i = 0; i < 16; i++)
    elements.push({
      type: "segment",
      from: [0, 0],
      to: polar(1, i * 22.5),
      stroke: "muted",
    });
  // Sixteen actual circular sectors, rotated alternately, with the rim on the two long edges.
  const half = Math.PI / 16,
    dx = Math.sin(half),
    h = Math.cos(half);
  for (let i = 0; i < 16; i++) {
    const up = i % 2 === 0,
      apex: Point = [2 + i * dx, up ? 0 : h];
    const arc: Point[] = Array.from({ length: 13 }, (_, j) =>
      polar(1, (up ? 78.75 : 258.75) + (j * 22.5) / 12, apex),
    );
    elements.push({
      type: "polygon",
      points: [apex, ...arc],
      stroke: "muted",
      fill: up ? "accent-fill" : "warm-fill",
    });
    elements.push({ type: "polyline", points: arc, stroke: "warm", width: 2 });
  }
  elements.push(
    { type: "segment", from: [0, 0], to: [1, 0], stroke: "accent", width: 2 },
    { type: "text", at: [0.5, -0.2], text: `r=${r}`, font: "math", size: "sm" },
    {
      type: "text",
      at: [5.4, 0.5],
      text: "height → r",
      font: "math",
      size: "sm",
    },
    {
      type: "text",
      at: [3.5, 1.35],
      text: "width → πr",
      font: "math",
      size: "sm",
    },
    { type: "text", at: [0, -1.3], text: "16 equal wedges", font: "sans" },
    {
      type: "text",
      at: [3.5, -0.4],
      text: "half the rim along each long edge",
      font: "sans",
      size: "sm",
    },
  );
  return blanks(
    rng,
    `${lead}. ${given === 2 ? "" : `Its circumference is ${circumference} cm. `}${exact ? "" : "Use 3.14 for $\\pi$. "}Many thin wedges are placed alternately point-up and point-down. Complete the rectangle argument.`,
    [
      slot(
        "Its limiting height is the circle's",
        given === 1 ? `half-diameter, ${r} cm` : `radius, ${r} cm`,
        `diameter, ${2 * r} cm`,
        "circumference",
      ),
      slot(
        "Its limiting width is",
        "half the circumference",
        "the circumference",
        "the diameter",
      ),
      slot(
        "Width in centimeters",
        width,
        exact ? pi(2 * r) : String(round(6.28 * r)),
        String(r),
        exact ? pi(r, 2) : String(round(1.57 * r)),
      ),
      slot(
        "Area in square centimeters",
        area,
        exact ? pi(2 * r * r) : String(round(6.28 * r * r)),
        String(r * r),
        exact ? pi(2 * r) : String(round(6.28 * r)),
      ),
    ],
    [
      "The rim is shared between the top and bottom: each long edge is half the circumference. As the wedges become thinner, the height approaches the radius.",
      `Area is half the distance around, times the radius: $\\tfrac12 C r=\\tfrac12(2\\pi r)r=\\pi r^2$.`,
      `Here the width is ${width} cm and the area is ${area} square centimeters.`,
      `Using 3.14 gives ${round(3.14 * r * r)}, a little more than three ${r}-by-${r} squares, ${3 * r * r}.`,
    ],
    `Split the circumference ${circumference} between the two long edges.`,
    picture(scene(elements, "Rearranging equal wedges")),
  );
}

function tangentAngles(rng: Random): ClauseSurface {
  const theta = pick(
      rng,
      Array.from({ length: 61 }, (_, i) => 40 + i * 2).filter(
        (n) => ![60, 90, 120, 144].includes(n),
      ),
    ),
    phi = 180 - theta,
    kind = rng(0, 3);
  const [o, a, b, p, c] = pick(rng, ["OABPC", "QDETR", "MJKLN"] as const).split(
    "",
  );
  const O: Point = [0, 0],
    A = polar(2, theta / 2),
    B = polar(2, -theta / 2),
    P: Point = [2 / Math.cos((theta * Math.PI) / 360), 0],
    C: Point = [-2, 0];
  const elements: Element[] = [
    { type: "circle", center: O, r: 2 },
    ...[
      [O, A],
      [O, B],
      [A, P],
      [B, P],
    ].map(([from, to], i) => figureSegment(`s${i}`, from!, to!)),
    figureRightMark("ra", A, O, P, 0.18),
    figureRightMark("rb", B, O, P, 0.18),
  ];
  const names: [string, Point][] = [
    [o!, O],
    [a!, A],
    [b!, B],
    [p!, P],
  ];
  if (kind === 1) {
    elements.push(figureSegment("ca", C, A), figureSegment("cb", C, B));
    names.push([c!, C]);
  }
  for (const [name, pt] of names)
    elements.push(figureName(`n${name}`, name, pt, pt === O ? [-1, -1] : pt));
  elements.push(
    ...figureAngleMark("asked", kind === 1 ? C : P, A, B, { r: 0.35 }),
  );
  const explain = [
    `Each radius is perpendicular to its tangent. In quadrilateral $${o}${a}${p}${b}$, the two right angles use $180^\\circ$ of its $360^\\circ$.`,
    `Therefore $m\\angle ${a}${p}${b}+m\\angle ${a}${o}${b}=180^\\circ$. Here $${phi}+${theta}=180$.`,
    `An inscribed angle on the same minor arc is half the central angle: $${theta}/2=${theta / 2}$.`,
    "As the outside point moves farther away, the tangent angle approaches 0° and the central angle approaches 180°. Their sum stays 180°.",
  ];
  const lead = `Tangents from $${p}$ touch circle $${o}$ at $${a}$ and $${b}$. `;
  if (kind === 3)
    return choice(
      rng,
      lead +
        "Which equation always connects the circumscribed angle and the central angle on the minor arc?",
      m(`m\\angle ${a}${p}${b}+m\\angle ${a}${o}${b}=180^\\circ`),
      [
        m(`m\\angle ${a}${p}${b}=m\\angle ${a}${o}${b}`),
        m(`m\\angle ${a}${p}${b}=\\tfrac12m\\angle ${a}${o}${b}`),
        m(`m\\angle ${a}${p}${b}=2m\\angle ${a}${o}${b}`),
      ],
      explain,
      "The two radius–tangent corners are each 90°.",
      picture(scene(elements)),
    );
  const answer = kind === 0 ? phi : kind === 1 ? theta / 2 : theta;
  const wrong =
    kind === 0
      ? [theta, theta / 2, phi / 2, 360 - theta]
      : kind === 1
        ? [phi, phi / 2, theta, 180 - theta / 2]
        : [phi, theta / 2, 360 - theta];
  return choice(
    rng,
    lead +
      (kind === 0
        ? `$m\\angle ${a}${o}${b}=${theta}^\\circ$. Find the circumscribed angle $m\\angle ${a}${p}${b}$.`
        : `$m\\angle ${a}${p}${b}=${phi}^\\circ$. ${kind === 1 ? `$${c}$ is on the major arc $${a}${b}$. Find $m\\angle ${a}${c}${b}$.` : `Find the measure of minor arc $${a}${b}$.`}`),
    m(`${answer}^\\circ`),
    wrong.filter((x) => x !== answer).map((x) => m(`${x}^\\circ`)),
    explain,
    `Subtract the known ${kind === 0 ? theta : phi}° angle from 180° to connect the central and tangent angles.`,
    picture(scene(elements)),
  );
}

function cyclicProof(rng: Random): ClauseSurface {
  const labels = pick(rng, ["ABCD", "PQRS", "WXYZ"] as const),
    shift = rng(0, 1),
    L = [...labels.slice(shift), ...labels.slice(0, shift)],
    [a, b, c, d] = L;
  const arc = `${b}${c}${d}`,
    other = `${d}${a}${b}`,
    numeric = rng(0, 1) === 0,
    measure = 10 * rng(10, 26);
  // B at 0°, D at measure°. A is on the complementary arc; C is on BCD.
  const angles = [(measure + 360) / 2, 0, measure / 2, measure];
  const pts = angles.map((deg) => polar(2, deg));
  const els: Element[] = [
    { type: "circle", center: [0, 0], r: 2 },
    { type: "polygon", points: pts },
    {
      type: "arc",
      center: [0, 0],
      r: 2.04,
      from: 0,
      to: measure,
      stroke: "warm",
      width: 3,
    },
    {
      type: "arc",
      center: [0, 0],
      r: 2.04,
      from: measure,
      to: 360,
      stroke: "accent",
      width: 3,
    },
  ];
  pts.forEach((pt, i) => els.push(figureName(`v${i}`, L[i]!, pt, pt)));
  return blanks(
    rng,
    `Prove that opposite angles $${a}$ and $${c}$ of the inscribed quadrilateral $${L.join("")}$ add to 180°. ${numeric ? `Arcs $${arc}$ and $${other}$ measure ${measure}° and ${360 - measure}°. ` : ""}Complete the proof.`,
    [
      slot(
        `Angle $${a}$ intercepts arc`,
        m(arc),
        m(`${b}${a}${d}`),
        m(`${b}${c}`),
      ),
      slot(
        `Why is $m\\angle ${a}=\\tfrac12 m\\widehat{${arc}}$?`,
        "An inscribed angle is half its intercepted arc.",
        "A central angle equals its intercepted arc.",
        "Opposite angles of a parallelogram are equal.",
      ),
      slot(
        `Angle $${c}$ intercepts arc`,
        m(other),
        m(`${d}${c}${b}`),
        m(`${a}${b}`),
      ),
      slot(
        "Sum of the two intercepted arcs",
        "$360^\\circ$",
        "$180^\\circ$",
        "$90^\\circ$",
      ),
      slot(
        "Reason for the arc sum",
        "The two arcs make the whole circle, without overlap.",
        "The opposite angles are supplementary.",
        "The two radii are equal.",
      ),
      slot(
        numeric
          ? `The two angles, then their sum`
          : "Half the sum of the two arcs",
        numeric
          ? m(`${measure / 2}^\\circ, ${180 - measure / 2}^\\circ; 180^\\circ`)
          : "$180^\\circ$",
        numeric
          ? m(`${measure}^\\circ, ${360 - measure}^\\circ; 360^\\circ`)
          : "$360^\\circ$",
        numeric
          ? m(`${measure / 4}^\\circ, ${90 - measure / 4}^\\circ; 90^\\circ`)
          : "$90^\\circ$",
      ),
    ],
    [
      `Angle $${a}$ intercepts arc $${arc}$, which does not contain $${a}$. Angle $${c}$ intercepts arc $${other}$, which does not contain $${c}$.`,
      `Each angle is half its intercepted arc. Those arcs together cover exactly one circle: $m\\angle ${a}+m\\angle ${c}=\\tfrac12(360^\\circ)=180^\\circ$.`,
      ...(numeric
        ? [`Numerically, $${measure / 2}+${180 - measure / 2}=180$.`]
        : []),
    ],
    `For angle $${a}$, follow the arc between its two ray endpoints that does not contain $${a}$. ${numeric ? `Start with the arc measuring ${measure}°.` : "Relate both intercepted arcs to the target sum of 180°."}`,
    picture({
      ...scene(els),
      note: `Quadrilateral ${L.join("")} has all four vertices on a circle. Arcs ${arc} and ${other} together form the circle.${numeric ? ` Their measures are ${measure}° and ${360 - measure}°.` : ""}`,
    }),
  );
}

function arcSimilarity(rng: Random): ClauseSurface {
  const r1 = rng(2, 10),
    twiceK = pick(rng, [3, 4, 5, 6, 8]),
    k = twiceK / 2,
    r2 = k * r1,
    s1 = pick(rng, [2, 2.5, 4]),
    s2 = k * s1,
    theta = ((s1 / r1) * 180) / Math.PI;
  const els: Element[] = [
    { type: "circle", center: [0, 0], r: r1 },
    { type: "circle", center: [0, 0], r: r2 },
    { type: "segment", from: [0, 0], to: polar(r2, 0) },
    { type: "segment", from: [0, 0], to: polar(r2, theta) },
    {
      type: "arc",
      center: [0, 0],
      r: r1,
      from: 0,
      to: theta,
      stroke: "warm",
      width: 3,
    },
    {
      type: "arc",
      center: [0, 0],
      r: r2,
      from: 0,
      to: theta,
      stroke: "warm",
      width: 3,
    },
    { type: "text", at: polar(r1, -12), text: `r_1=${r1}`, font: "math" },
    { type: "text", at: polar(r2, -12), text: `r_2=${r2}`, font: "math" },
    {
      type: "text",
      at: polar(r1 + 0.5, theta / 2),
      text: `s_1=${s1}`,
      font: "math",
    },
    { type: "text", at: polar(r2 + 0.8, theta / 2), text: "s_2", font: "math" },
  ];
  return blanks(
    rng,
    `Concentric circles have radii $r_1=${r1}$ and $r_2=${r2}$. The same central angle $\\theta$ cuts arc $s_1=${s1}$ from the first circle. Complete the dilation argument showing why arc length divided by radius is unchanged.`,
    [
      slot(
        "Scale factor from circle 1 to circle 2",
        m(`${r2}/${r1}=${k}`),
        m(`${r1}/${r2}`),
        m(`${k * k}`),
      ),
      slot(
        "Image of the angle under dilation",
        "$\\theta$",
        "$k\\theta$",
        "$\\theta/k$",
      ),
      slot(
        "Length of the image arc",
        m(`${k}\\cdot${s1}=${s2}`),
        String(s1),
        String(k * k * s1),
      ),
      slot(
        "Cancel the common length scale",
        "$s_2/r_2=(ks_1)/(kr_1)=s_1/r_1$",
        "$s_2/r_2=s_1/r_2$",
        "$s_2/r_2=ks_1/r_1$",
      ),
      slot(
        "The ratio depends only on",
        "the angle",
        "the radius",
        "the chosen circle",
      ),
      slot(
        "This ratio measures the angle in",
        "radians",
        "degrees",
        "length units",
      ),
    ],
    [
      `The dilation factor is $k=${r2}/${r1}=${k}$. It keeps angles unchanged and multiplies every length by ${k}.`,
      `Thus $s_2=${k}\\cdot${s1}=${s2}$ and $r_2=${k}\\cdot${r1}=${r2}$.`,
      `$s_2/r_2=${s2}/${r2}=${s1}/${r1}=s_1/r_1$. The common ratio is the radian measure of the angle.`,
    ],
    `To map radius ${r1} to radius ${r2}, divide image length by original length.`,
    picture(scene(els)),
  );
}

function sectorFormula(rng: Random): ClauseSurface {
  const r = rng(2, 12),
    mode = rng(0, 2),
    den = pick(rng, [6, 4, 3, 2, 1]),
    degrees = mode === 0 ? 15 * rng(2, 22) : 180 / den,
    plain = pick(rng, [0.5, 1, 1.5, 2, 3]);
  const thetaText =
    mode === 0
      ? m(`${degrees}^\\circ`)
      : mode === 1
        ? m(`\\pi/${den}`)
        : count(plain, "radian");
  const thetaDeg = mode === 2 ? (plain * 180) / Math.PI : degrees;
  const answer =
    mode === 0
      ? pi(r * r * degrees, 360)
      : mode === 1
        ? pi(r * r, 2 * den)
        : String((r * r * plain) / 2);
  const parts = [
    slot(
      "Fraction of a full turn",
      mode === 0 ? "$\\theta/360$" : "$\\theta/(2\\pi)$",
      mode === 0 ? "$\\theta/180$" : "$\\theta/\\pi$",
      mode === 0 ? "$\\theta/(2\\pi)$" : "$\\theta/360$",
    ),
    slot("Area of the whole disk", "$\\pi r^2$", "$2\\pi r$", "$r^2$"),
    slot(
      "Multiply fraction of turn by disk area",
      mode === 0 ? "$(\\theta/360)\\pi r^2$" : "$\\tfrac12 r^2\\theta$",
      "$r^2\\theta$",
      "$\\tfrac12 r\\theta$",
    ),
  ];
  if (mode !== 0)
    parts.push(
      slot(
        "Use arc length $s=r\\theta$ to rewrite area",
        "$\\tfrac12 sr$",
        "$sr$",
        "$\\tfrac12 s^2$",
      ),
    );
  parts.push(
    slot(
      `Check: radius ${r}, angle ${thetaText}${mode === 1 ? " radians" : ""}`,
      answer,
      mode === 2
        ? String(r * r * plain)
        : mode === 0
          ? pi(r * r * degrees, 180)
          : pi(r * r, den),
      mode === 2 ? String((r * plain) / 2) : pi(r * r),
    ),
  );
  return blanks(
    rng,
    `A sector is part of a disk cut by a central angle. Derive its area formula with $\\theta$ measured in ${mode === 0 ? "degrees" : "radians"}, then check it for radius ${r} and angle ${thetaText}${mode === 1 ? " radians" : ""}.`,
    parts,
    [
      mode === 0
        ? "A full turn is 360°. The angle's fraction of a turn is $\\theta/360$, so multiply that fraction by $\\pi r^2$."
        : "A full turn is $2\\pi$ radians. Multiply the fraction $\\theta/(2\\pi)$ by the whole disk's area $\\pi r^2$.",
      mode === 0
        ? "$A=(\\theta/360)\\pi r^2$."
        : "$A=\\tfrac12 r^2\\theta=\\tfrac12 sr$. At $\\theta=2\\pi$, this becomes the whole disk's area $\\pi r^2$.",
      `For this check, the area is ${answer} square units.`,
    ],
    `Compare the angle ${thetaText} with one full turn in the same unit.`,
    picture(
      scene([
        { type: "circle", center: [0, 0], r: 2 },
        {
          type: "arc",
          center: [0, 0],
          r: 2,
          from: 0,
          to: thetaDeg,
          fill: "gold-fill",
          stroke: "warm",
          width: 2,
        },
        { type: "segment", from: [0, 0], to: [2, 0] },
        { type: "segment", from: [0, 0], to: polar(2, thetaDeg) },
        { type: "text", at: [1, -0.2], text: `r=${r}`, font: "math" },
      ]),
    ),
  );
}

export const circleClauseExtensions: Record<string, ClauseExtension> = {
  "circle-estimate-blanks": {
    variants: ["wedge-rectangle"],
    build: wedges,
    capability: "multi-part-choice-v1",
  },
  "circle-angles": {
    variants: ["circumscribed-angle"],
    build: tangentAngles,
    capability: "single-choice-v1",
  },
  "triangle-circle-centers": {
    variants: ["cyclic-quad-proof"],
    build: cyclicProof,
    capability: "multi-part-choice-v1",
  },
  "arc-sector-derivation": {
    variants: ["similarity-derivation", "sector-formula-derivation"],
    build: (r, v) =>
      v === "similarity-derivation" ? arcSimilarity(r) : sectorFormula(r),
    capability: "multi-part-choice-v1",
  },
};
