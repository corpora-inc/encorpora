import {
  choice,
  clean,
  figures,
  math,
  numeric,
  parts,
  pick,
  shuffled,
  type Item,
  type Rng,
} from "./number-geometry-clause-kit";
import { scene } from "./scene/author";
import type { Element, Point, Scene, PathOp } from "./scene/spec";
const polar = (angle: number, r = 4): Point => [
  r * Math.cos((angle * Math.PI) / 180),
  r * Math.sin((angle * Math.PI) / 180),
];
const expr = (a: number, b: number) =>
  `${a === 1 ? "" : a}x${b < 0 ? `-${-b}` : b > 0 ? `+${b}` : ""}`;

function degreeCount(r: Rng): Item {
  const form = r(0, 3);
  let n =
    form === 2
      ? pick(r, [1, 30, 45, 60, 90, 120, 180])
      : form === 1
        ? r(1, 359)
        : r(11, 179);
  if (form === 0 && n % 10 === 0) n++;
  const elements: Element[] = [
    {
      type: "arc",
      center: [0, 0],
      r: 4,
      from: 0,
      to: n,
      fill: "accent-fill",
      stroke: "accent",
    },
    { type: "circle", center: [0, 0], r: 4 },
  ];
  if (form === 0) {
    const minor: PathOp[] = [],
      major: PathOp[] = [];
    for (let i = 0; i < 360; i++) {
      const from = polar(i, i % 10 === 0 ? 3.7 : 3.88),
        to = polar(i, 4);
      (i % 10 === 0 ? major : minor).push(["M", ...from], ["L", ...to]);
    }
    elements.push(
      { type: "path", d: minor, width: 0.6 },
      { type: "path", d: major, width: 1.5 },
    );
    for (const i of [0, 90, 180, 270])
      elements.push({ type: "text", at: polar(i, 4.6), text: String(i) });
  }
  return {
    prompt:
      form === 0
        ? "The circle is cut into 360 one-degree angles, with a heavy tick every 10°. How many degrees does the shaded angle turn through?"
        : form === 1
          ? `An angle turns through $${n}/360$ of a full circle. What is its measure in degrees?`
          : form === 2
            ? `A ${n}° angle is what fraction of a full circle?`
            : r(0, 1)
              ? `An angle consists of ${n} one-degree angles side by side, with no gaps or overlaps. What is its measure in degrees?`
              : `An angle measures ${n}°. How many one-degree angles does it turn through?`,
    ...(form === 2
      ? choice(r, math(`${n}/360`), [
          math(`${n}/180`),
          math(`${n}/90`),
          math(`${n}/100`),
        ])
      : numeric(n)),
    ...(form === 0
      ? {
          figure: {
            kind: "scene" as const,
            scene: scene(...elements).build({ width: 360, maxHeight: 360 }),
          },
        }
      : {}),
    hint:
      form === 0
        ? "Count tens from the heavy ticks, then ones. A complete turn contains 360 equal one-degree angles."
        : `A full turn contains 360 one-degree angles. Relate ${n} degrees to those equal parts.`,
    explanation: [
      `One degree is $1/360$ of a full turn. ${n} such units measure ${n} degrees.`,
      ...(form === 0
        ? [
            `Count ${Math.floor(n / 10)} groups of ten and ${n % 10} more: $${Math.floor(n / 10) * 10}+${n % 10}=${n}$.`,
          ]
        : []),
      `${n} degrees is $${n}/360$ of a full circle. The remaining ${360 - n} degrees complete the 360-degree turn.`,
    ],
  };
}
function complementary(r: Rng, numericOnly = false): Item {
  const x = r(3, 19),
    first = r(15, 75),
    second = 90 - first;
  if (numericOnly)
    return {
      prompt: `Ray $BD$ splits right angle $ABC$. Angle $ABD$ is ${first}°. What is the measure of $DBC$ in degrees?`,
      figure: {
        kind: "angle-rays",
        vertex: "B",
        points: ["C", "D", "A"],
        rays: [0, second, 90],
        marks: [
          { from: 0, to: 2, label: "90°", right: true },
          { from: 1, to: 2, label: `${first}°` },
          { from: 0, to: 1, label: "?" },
        ],
      },
      ...numeric(second),
      hint: `The square corner measures 90°. Subtract the known ${first}° part.`,
      explanation: [
        `The two parts fill a right angle, so they add to 90°.`,
        `$90-${first}=${second}$ degrees.`,
      ],
    };
  // Choose coefficients only when the generated offsets meet the brief.
  const pairs: [number, number][] = [];
  for (let a = 1; a <= 4; a++)
    for (let c = 1; c <= 4; c++) {
      const b = first - a * x,
        d = second - c * x;
      if (
        b >= -20 &&
        b <= 50 &&
        d >= -20 &&
        d <= 50 &&
        (a !== c || b !== d) &&
        (b !== 0 || d !== 0)
      )
        pairs.push([a, c]);
    }
  if (!pairs.length) return complementary(r, numericOnly);
  const [a, c] = pick(r, pairs),
    b = first - a * x,
    d = second - c * x,
    e1 = expr(a, b),
    e2 = expr(c, d),
    target = r(0, 2),
    answer = target === 0 ? x : target === 1 ? second : 90 + first;
  return {
    prompt:
      target === 2
        ? `Point $B$ lies on line $AC$. Ray $BE$ is perpendicular to $AC$, and $BD$ lies between $BE$ and $BC$. Angle $EBD$ measures $(${e1})$° and angle $DBC$ measures $(${e2})$°. Find angle $ABD$ in degrees.`
        : `Ray $BD$ splits right angle $ABC$. Angle $ABD$ measures $(${e1})$° and angle $DBC$ measures $(${e2})$°. ${target === 0 ? "Find the value of $x$." : "Find angle $DBC$ in degrees."}`,
    figure: {
      kind: "angle-rays",
      vertex: "B",
      points: target === 2 ? ["C", "D", "E", "A"] : ["C", "D", "A"],
      rays: target === 2 ? [0, second, 90, 180] : [0, second, 90],
      marks: [
        { from: 0, to: 2, label: "90°", right: true },
        { from: 1, to: 2, label: e1 },
        { from: 0, to: 1, label: e2 },
        ...(target === 2 ? [{ from: 1, to: 3, label: "?" }] : []),
      ],
    },
    ...numeric(answer),
    hint: `The square mark identifies 90°. Add the two expressions, $(${e1})+(${e2})$, to fill that right angle.`,
    explanation: [
      `The two complementary angles fill 90°: $(${e1})+(${e2})=90$.`,
      "The square mark identifies a 90° right angle. Finding $x$ is only an intermediate step when an angle is requested.",
      `Collect terms: $${a + c}x${b + d >= 0 ? "+" : ""}${b + d}=90$, so $${a + c}x=${90 - b - d}$ and $x=${x}$.`,
      `The parts measure ${first}° and ${second}°; their sum is 90°.`,
      target === 2
        ? `Angle $ABD$ includes the 90° angle $ABE$ and the ${first}° angle $EBD$: $90+${first}=${answer}$°.`
        : target === 1
          ? `Answer the requested angle: $DBC=${second}$°.`
          : `The requested value is $x=${x}$.`,
    ],
  };
}
function verticalAdjacent(r: Rng): Item {
  const x = r(2, 15);
  let a: number, c: number, angle: number, b: number, d: number;
  do {
    a = r(1, 4);
    c = r(1, 4);
    angle = r(20, 145);
    b = angle - a * x;
    d = angle - c * x;
  } while (a === c || angle === 90 || b < 0 || b > 90 || d < 0 || d > 90);
  const e1 = expr(a, b),
    e2 = expr(c, d),
    neighbor = pick(r, ["BPC", "APD"]),
    answer = 180 - angle;
  return {
    prompt: `Lines $AC$ and $BD$ cross at $P$. Angle $CPD$ measures $(${e1})$° and angle $APB$ measures $(${e2})$°. What is the measure of angle $${neighbor}$ in degrees?`,
    figure: {
      kind: "angle-rays",
      vertex: "P",
      points: ["C", "D", "A", "B"],
      rays: [0, angle, 180, 180 + angle],
      marks: [
        { from: 0, to: 1, label: e1 },
        { from: 2, to: 3, label: e2 },
        {
          from: neighbor === "BPC" ? 3 : 1,
          to: neighbor === "BPC" ? 0 : 2,
          label: "?",
        },
      ],
    },
    ...numeric(answer),
    hint: `The two expressions label angles across the crossing, so set $${e1}=${e2}$. Then find the neighboring angle.`,
    explanation: [
      `Angles $CPD$ and $APB$ are vertical angles, across the crossing, so $${e1}=${e2}$.`,
      `Subtract like terms: $${a - c}x=${d - b}$, giving $x=${x}$. Both across angles measure ${angle}°.`,
      `Angle $${neighbor}$ is adjacent to one of them on a straight line, so its measure is $180-${angle}=${answer}$°.`,
      `Check all four angles: $${angle}+${answer}+${angle}+${answer}=360$°.`,
      `Do not stop at $x=${x}$ or at angle $CPD=${angle}$°. The question requests its neighbor.`,
    ],
  };
}
function wholeAngle(r: Rng): Item {
  const a = pick(r, [15, 20, 25, 30, 35, 40]),
    b = pick(r, [20, 30, 40, 50]),
    sum = a + b;
  return {
    prompt: `A folding fan opens through ${a}° from ray $BA$ to $BD$, then another ${b}° from $BD$ to $BC$. Which equation finds the total angle $x$ in degrees?`,
    figure: {
      kind: "angle-rays",
      vertex: "B",
      points: ["A", "D", "C"],
      rays: [0, a, sum],
      marks: [
        { from: 0, to: 1, label: `${a}°` },
        { from: 1, to: 2, label: `${b}°` },
        { from: 0, to: 2, label: "x" },
      ],
    },
    ...choice(r, math(`x=${a}+${b}`), [
      math(`x=${b}-${a}`),
      math(`x=${sum}-${a}`),
      math(`x=${a}+${b}+180`),
    ]),
    hint: `The ${a}° and ${b}° parts do not overlap. Combine both to find the whole opening.`,
    explanation: [
      `The two adjacent parts fill the whole angle: $x=${a}+${b}=${sum}$°.`,
      `Subtracting finds a missing part when the whole is known. Here both parts are given and the whole is requested.`,
    ],
  };
}

export const triangleConstructionBank = [
  [4, 0, 3, 3, 5],
  [6, 0, 8, 8, 10],
  [6, 3, 4, 5, 5],
  [8, 4, 3, 5, 5],
  [8, 0, 6, 6, 10],
  [9, 0, 12, 12, 15],
  [10, 5, 12, 13, 13],
  [12, 6, 8, 10, 10],
  [12, 0, 5, 5, 13],
  [14, 5, 12, 13, 15],
  [16, 8, 15, 17, 17],
  [15, 0, 8, 8, 17],
] as const;
export function constructTriangle(r: Rng): Item {
  const family = r(0, 2);
  let b: number, cx: number, cy: number, condition: string, steps: string[];
  if (family === 0) {
    const row = pick(r, triangleConstructionBank);
    [b, cx, cy] = row;
    condition = `$AC=${row[3]}$ units and $BC=${row[4]}$ units.`;
    steps = [
      `The distances must satisfy $AC^2=${row[3] ** 2}$ and $BC^2=${row[4] ** 2}$.`,
      `A circle about $A$ of radius ${row[3]} and one about $B$ of radius ${row[4]} intersect once above the base.`,
    ];
  } else if (family === 1) {
    b = r(3, 16);
    cy = r(3, 15);
    const atA = r(0, 1) === 0;
    cx = atA ? 0 : b;
    condition = `Angle $${atA ? "A" : "B"}$ is 90° and $${atA ? "AC" : "BC"}=${cy}$ units.`;
    steps = [
      `A 90° angle makes the requested side perpendicular to the horizontal base, so it runs vertically.`,
      `Measure ${cy} units upward from $${atA ? "A" : "B"}$.`,
    ];
  } else {
    const equal = r(0, 1) === 0;
    b = equal ? 2 * r(2, 8) : r(3, 15);
    cx = equal ? b / 2 : b;
    cy = cx;
    condition = equal
      ? "Angles $A$ and $B$ are each 45°."
      : "Angle $A$ is 45° and angle $B$ is 90°.";
    steps = [
      `A 45° ray rises one unit for each horizontal unit.`,
      equal
        ? "The two 45° rays meet over the midpoint of the base."
        : "The perpendicular at $B$ meets the 45° ray from $A$.",
    ];
  }
  const reflect = r(0, 1) === 1,
    ax = reflect ? b : 0,
    bx = reflect ? 0 : b,
    x = reflect ? b - cx : cx;
  return {
    prompt: `Segment $AB$ has endpoints $A(${ax},0)$ and $B(${bx},0)$ and length ${b} units. ${condition} Plot vertex $C$ above $AB$ to construct the triangle.`,
    response: {
      kind: "point-plot",
      label: "Plot $C$ above $AB$",
      grid: {
        xMin: 0,
        xMax: 16,
        yMin: 0,
        yMax: 16,
        step: 1,
        xLabel: "x",
        yLabel: "y",
      },
      pointCount: 1,
      ordered: true,
      pointLabels: ["C"],
      connect: "none",
      given: {
        vertices: [
          { x: ax, y: 0, label: "A" },
          { x: bx, y: 0, label: "B" },
        ],
        closed: false,
      },
    },
    pointGrading: { mode: "exact" },
    answer: JSON.stringify([[x, cy]]),
    hint: `Use the conditions at the named endpoints of the ${b}-unit base. The requested vertex must have a positive height.`,
    explanation: [
      ...steps,
      `The point is $C(${x},${cy})$.`,
      family === 0
        ? `Check both squared distances: $(${x}-${ax})^2+${cy}^2=${(x - ax) ** 2 + cy ** 2}$ and $(${x}-${bx})^2+${cy}^2=${(x - bx) ** 2 + cy ** 2}$.`
        : "Reflecting below the base gives the same shape, but this task requests the vertex above it.",
    ],
  };
}
function anglePanel(r: Rng, kind: number): { label: string; scene: Scene } {
  const rotation = r(0, 359),
    opening = r(20, 160),
    end1 = polar(rotation, 3.5),
    end2 = polar(rotation + opening, 2.5),
    origin: Point = [0, 0];
  const elements: Element[] =
    kind === 0
      ? [
          { type: "segment", from: origin, to: end1, arrow: "end" },
          { type: "segment", from: origin, to: end2, arrow: "end" },
          { type: "point", at: origin },
        ]
      : kind === 1
        ? [
            { type: "segment", from: [-3, 0], to: [-1, 2], arrow: "end" },
            { type: "segment", from: [1, 0], to: [3, 2], arrow: "end" },
          ]
        : kind === 2
          ? [
              { type: "segment", from: [-0.5, 0], to: [-3, 2], arrow: "end" },
              { type: "segment", from: [0.5, 0], to: [3, 2], arrow: "end" },
              { type: "point", at: [-0.5, 0] },
              { type: "point", at: [0.5, 0] },
            ]
          : [
              { type: "segment", from: origin, to: end1, arrow: "end" },
              { type: "point", at: [end1[0] / 2, end1[1] / 2] },
            ];
  return {
    label:
      kind === 0
        ? `Two rays share an endpoint and open ${opening} degrees, starting at direction ${rotation} degrees.`
        : kind === 1
          ? "Two separate parallel rays start at different points."
          : kind === 2
            ? "Two rays make a V-shaped opening with a visible gap between their endpoints."
            : "One ray has a point marked halfway along it.",
    scene: scene(...elements).build({ width: 250, maxHeight: 240 }),
  };
}
export function recognizeAngle(r: Rng): Item {
  const form = r(0, 2);
  if (form === 0) {
    const not = r(0, 3) === 0;
    const wrongPanels = not
      ? [anglePanel(r, 0), anglePanel(r, 0), anglePanel(r, 0)]
      : [anglePanel(r, 1), anglePanel(r, 2), anglePanel(r, 3)];
    if (new Set(wrongPanels.map((p) => p.label)).size !== wrongPanels.length)
      return recognizeAngle(r);
    return {
      prompt: `Which figure ${not ? "does not show" : "shows"} an angle formed by two rays with a common endpoint?`,
      ...figures(r, anglePanel(r, not ? pick(r, [1, 2, 3]) : 0), wrongPanels),
      hint: "Find where each ray starts. Two rays form an angle when they start at the very same point.",
      explanation: [
        "An angle consists of two rays with one shared endpoint, called the vertex. Different arm lengths and orientations do not change this definition.",
        not
          ? "The selected panel has no pair of rays with a shared endpoint."
          : "The selected panel has two rays leaving the same point; the other panels show separate starts or just one ray.",
      ],
    };
  }
  const letters = shuffled(r, ["R", "S", "T", "W", "X", "Y", "Z"]),
    [v, a, b] = letters as [string, string, string, ...string[]];
  if (form === 1) {
    const name = r(0, 1) === 0;
    return {
      prompt: name
        ? `Which name describes the angle formed by rays $${v}${a}$ and $${v}${b}$?`
        : `Which point is the vertex of $\\angle ${a}${v}${b}$?`,
      figure: {
        kind: "scene",
        scene: scene(
          { type: "segment", from: [0, 0], to: [4, 0], arrow: "end" },
          { type: "segment", from: [0, 0], to: [1, 3], arrow: "end" },
          { type: "segment", from: [-3, 1], to: [-3, 3], arrow: "end" },
          { type: "text", at: [0, -0.5], text: v },
          { type: "text", at: [3, -0.5], text: a },
          { type: "text", at: [1, 2.3], text: b },
        ).build(),
      },
      ...choice(
        r,
        name ? math(`\\angle ${a}${v}${b}`) : math(v),
        name
          ? [math(`\\angle ${v}${a}${b}`), math(`\\angle ${a}${b}${v}`)]
          : [math(a), math(b)],
      ),
      hint: `The shared endpoint of rays $${v}${a}$ and $${v}${b}$ belongs in the middle of the angle's name.`,
      explanation: [
        `Both rays begin at $${v}$, the vertex. Write this letter in the middle: $\\angle ${a}${v}${b}$.`,
        `Reversing the two outside letters names the same angle, but moving the vertex letter does not.`,
      ],
    };
  }
  const n = pick(r, [3, 4]),
    spacing = pick(r, [25, 30, 35, 40]),
    rays = Array.from({ length: n }, (_, i) => i * spacing),
    labels = ["A", "B", "C", "D"].slice(0, n),
    elements: Element[] = rays.flatMap((angle, i) => [
      { type: "segment", from: [0, 0], to: polar(angle), arrow: "end" },
      { type: "text", at: polar(angle, 4.5), text: labels[i]! },
    ]);
  elements.push({ type: "text", at: [-0.4, -0.4], text: "O" });
  const pairs: string[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) pairs.push(`${labels[i]}O${labels[j]}`);
  return {
    prompt: `${n} rays, ${labels.map((l) => `$O${l}$`).join(", ")}, share endpoint $O$ and lie in one half-plane. How many angles are formed by pairs of rays?`,
    figure: { kind: "scene", scene: scene(...elements).build() },
    ...numeric((n * (n - 1)) / 2),
    hint: `Count every pair of the ${n} rays, including pairs with another ray between them. Count each pair only once.`,
    explanation: [
      `The angles are ${pairs.map((x) => `$\\angle ${x}$`).join(", ")}: ${pairs.length} in total.`,
      `There are $${n}(${n}-1)/2=${pairs.length}$ unordered pairs. Counting only neighboring rays would miss larger angles.`,
    ],
  };
}

const scenarios = [
  {
    name: "ladder",
    unit: "ft",
    min: 10,
    max: 30,
    leg1: "base distance",
    leg2: "height",
    slant: "ladder",
  },
  {
    name: "screen",
    unit: "in",
    min: 20,
    max: 85,
    leg1: "width",
    leg2: "height",
    slant: "diagonal",
  },
  {
    name: "park",
    unit: "m",
    min: 30,
    max: 200,
    leg1: "length",
    leg2: "width",
    slant: "path",
  },
  {
    name: "ramp",
    unit: "ft",
    min: 3,
    max: 40,
    leg1: "run",
    leg2: "rise",
    slant: "ramp",
  },
  {
    name: "wire",
    unit: "m",
    min: 5,
    max: 60,
    leg1: "base distance",
    leg2: "height",
    slant: "wire",
  },
] as const;
const triples = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
] as const;
function triangleStory(r: Rng, missing: boolean): Item {
  const s = pick(r, scenarios),
    whole = r(0, 9) < 7;
  let a: number, b: number, c: number;
  if (whole) {
    const bank = triples
      .flatMap((t) =>
        Array.from(
          { length: 6 },
          (_, i) => t.map((x) => x * (i + 1)) as [number, number, number],
        ),
      )
      .filter((t) => t[2] >= s.min && t[2] <= s.max);
    [a, b, c] = pick(r, bank);
  } else if (missing) {
    do {
      c = r(s.min, Math.min(s.max, Math.max(30, s.min)));
      a = r(2, c - 1);
      b = Math.sqrt(c * c - a * a);
    } while (Number.isInteger(b) || (s.name === "ladder" && a >= b));
  } else {
    do {
      a = r(2, Math.min(28, s.max - 1));
      b = r(a + 1, Math.min(30, s.max));
      c = Math.hypot(a, b);
    } while (Number.isInteger(c) || c < s.min || c > s.max);
  }
  const saving = !missing && whole && s.name === "park" && r(0, 1) === 0;
  const target = missing ? b : saving ? a + b - c : c,
    value = whole ? target : Math.round(target * 10) / 10;
  const story = missing
    ? {
        ladder: `A ${c}-foot ladder leans against a vertical wall, with its base ${a} feet from the wall on level ground. How high up the wall does it reach`,
        screen: `A rectangular screen has diagonal ${c} inches and width ${a} inches. What is its height`,
        park: `A rectangular park has a straight corner-to-corner path ${c} meters long and one side ${a} meters long. What is the other side's length`,
        ramp: `A straight ramp is ${c} feet long and has horizontal run ${a} feet. What is its vertical rise`,
        wire: `A taut ${c}-meter wire runs from the top of a vertical pole to level ground ${a} meters from its base. How high is its attachment on the pole`,
      }[s.name]
    : {
        ladder: `A ladder reaches ${b} feet up a vertical wall, with its base ${a} feet away on level ground. How long is the ladder`,
        screen: `A rectangular screen is ${a} inches wide and ${b} inches high. What is its diagonal length`,
        park: `A rectangular park is ${a} meters by ${b} meters. ${saving ? "How much shorter is the straight path between opposite corners than walking along the two sides" : "How long is the straight path between opposite corners"}`,
        ramp: `A straight ramp has horizontal run ${a} feet and vertical rise ${b} feet. How long is the ramp surface`,
        wire: `A taut wire connects the top of a ${b}-meter vertical pole to level ground ${a} meters from its base. How long is the wire`,
      }[s.name];
  const unit = s.unit === "ft" ? "feet" : s.unit === "in" ? "inches" : "meters";
  const points: Point[] = [
      [0, 0],
      [a, 0],
      [a, b],
    ],
    elements: Element[] = [
      { type: "segment", from: points[0]!, to: points[1]!, stroke: "axis" },
      { type: "segment", from: points[1]!, to: points[2]!, stroke: "warm" },
      { type: "segment", from: points[0]!, to: points[2]!, stroke: "accent" },
      {
        type: "text",
        at: [a / 2, -b * 0.12],
        text: `${s.leg1}: ${a} ${s.unit}`,
        font: "sans",
        color: "axis",
      },
      {
        type: "text",
        at: [a * 1.2, b / 2],
        text: `${s.leg2}: ${missing ? "?" : b} ${s.unit}`,
        font: "sans",
        color: "warm",
      },
      {
        type: "text",
        at: [a * 0.35, b * 0.65],
        text: `${s.slant}: ${missing ? c : "?"} ${s.unit}`,
        font: "sans",
        color: "gold",
      },
      {
        type: "polyline",
        points: [
          [a - Math.min(a, b) * 0.12, 0],
          [a - Math.min(a, b) * 0.12, Math.min(a, b) * 0.12],
          [a, Math.min(a, b) * 0.12],
        ],
        stroke: "ink",
      },
    ];
  const round = (v: number) =>
    whole && Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
  const wrong = missing
    ? [a + c, c - a, Math.hypot(c, a), c * c - a * a]
    : saving
      ? [c, a + b, a * a + b * b]
      : [a + b, a * a + b * b, Math.abs(b - a)];
  const pool = [...new Set(wrong.map(round))].filter(
    (v) => Number(v) !== value,
  );
  const asChoice = r(0, 3) === 0;
  return {
    prompt: `${story}, in ${unit}${whole ? "" : " to the nearest tenth"}?`,
    figure: { kind: "scene", scene: scene(...elements).build() },
    ...(asChoice ? choice(r, String(value), pool) : numeric(value)),
    hint: `Identify the square corner. The ${s.slant} is across from it, so its square equals the sum of the two leg squares. Use ${missing ? `${c} and ${a}` : `${a} and ${b}`}.`,
    explanation: [
      `The ${s.leg1} and ${s.leg2} meet at a right angle. The ${s.slant}, across from that corner, is the hypotenuse.`,
      missing
        ? `$${a}^2+h^2=${c}^2$, so $h^2=${c * c}-${a * a}=${c * c - a * a}$.`
        : `$c^2=${a}^2+${b}^2=${a * a + b * b}$.`,
      missing
        ? `Take the positive square root: $h=\\sqrt{${c * c - a * a}}${whole ? "=" : "\\approx"}${value}$ ${unit}.`
        : `The diagonal is $c=\\sqrt{${a * a + b * b}}${whole ? "=" : "\\approx"}${whole ? c : Math.round(c * 10) / 10}$ ${unit}.`,
      ...(saving
        ? [
            `The two sides total ${a + b} ${unit}. The saving is $${a + b}-${c}=${value}$ ${unit}.`,
          ]
        : []),
      missing
        ? `The height is shorter than the ${c}-${s.unit} ${s.slant}, as it must be.`
        : `The slant exceeds either leg and is shorter than their combined length.`,
      ...(whole
        ? []
        : [
            "Keep the square root unrounded until the final step, then round once to the nearest tenth.",
          ]),
    ],
  };
}
function deriveCircle(r: Rng): Item {
  let h: number, k: number;
  do {
    h = r(-9, 9);
    k = r(-9, 9);
  } while (h === 0 && k === 0);
  const radical = r(0, 9) < 3;
  let n: number;
  if (radical) {
    do n = r(2, 50);
    while (Number.isInteger(Math.sqrt(n)));
  } else n = r(1, 12) ** 2;
  const radius = Math.sqrt(n),
    rt = radical ? `\\sqrt{${n}}` : String(radius),
    leg = (v: string, c: number) =>
      c === 0 ? v : `${v}${c > 0 ? "-" : "+"}${Math.abs(c)}`;
  const lx = leg("x", h),
    ly = leg("y", k),
    equation = `(${lx})^2+(${ly})^2=${n}`;
  const wrong = [
    `(${lx})^2+(${ly})^2=${rt}`,
    `(${leg("x", -h)})^2+(${leg("y", -k)})^2=${n}`,
    `(${lx})+(${ly})=${rt}`,
    `x^2+y^2=${n}`,
  ].filter((t) => t !== equation);
  const wrongLeg = (v: string, c: number) =>
    [
      leg(v, -c),
      v,
      `${v}-(${radius === Math.abs(c) ? String(radius + 1) : rt})`,
      `${v}+(${rt}+2)`,
    ].filter((t) => t !== leg(v, c));
  const short = r(0, 3) === 0,
    dx = (radius * 3) / 5,
    dy = (radius * 4) / 5,
    px = h + dx,
    py = k + dy;
  const elements: Element[] = [
    {
      type: "segment",
      from: [Math.min(-1, h - radius - 1), 0],
      to: [Math.max(1, h + radius + 1), 0],
      arrow: "both",
      stroke: "grid",
    },
    {
      type: "segment",
      from: [0, Math.min(-1, k - radius - 1)],
      to: [0, Math.max(1, k + radius + 1)],
      arrow: "both",
      stroke: "grid",
    },
    { type: "circle", center: [h, k], r: radius },
    { type: "point", at: [h, k] },
    { type: "point", at: [px, py] },
    {
      type: "text",
      at: [h - radius * 0.25, k - radius * 0.32],
      text: `C(${h}, ${k})`,
    },
    {
      type: "text",
      at: [px + radius * 0.18, py + radius * 0.24],
      text: "P(x, y)",
    },
    { type: "segment", from: [h, k], to: [px, k], stroke: "axis" },
    { type: "segment", from: [px, k], to: [px, py], stroke: "warm" },
    { type: "segment", from: [h, k], to: [px, py], stroke: "accent" },
    {
      type: "text",
      at: [h + dx / 2, k - radius * 0.1],
      text: "?",
      color: "axis",
    },
    {
      type: "text",
      at: [px + radius * 0.1, k + dy / 2],
      text: "?",
      color: "warm",
    },
    {
      type: "text",
      at: [h + dx * 0.3, k + dy * 0.65],
      text: radical ? `√${n}` : rt,
      color: "accent",
    },
    {
      type: "polyline",
      points: [
        [px - radius * 0.1, k],
        [px - radius * 0.1, k + radius * 0.1],
        [px, k + radius * 0.1],
      ],
    },
  ];
  return {
    prompt: short
      ? `A circle has center $C(${h},${k})$ and radius $${rt}$. Which equation describes it?`
      : `A circle has center $C(${h},${k})$ and radius $${rt}$. On it, $P(x,y)$ lies above and right of $C$. Name the right triangle's legs and the circle equation.`,
    figure: { kind: "scene", scene: scene(...elements).build() },
    ...(short
      ? choice(r, math(equation), wrong.map(math))
      : parts(r, [
          {
            label: "Horizontal leg",
            correct: math(lx),
            wrong: [...new Set(wrongLeg("x", h))].slice(0, 3).map(math),
          },
          {
            label: "Vertical leg",
            correct: math(ly),
            wrong: [...new Set(wrongLeg("y", k))].slice(0, 3).map(math),
          },
          {
            label: "Circle equation",
            correct: math(equation),
            wrong: wrong.map(math),
          },
        ])),
    hint: `The horizontal and vertical distances from center $(${h},${k})$ are differences of coordinates. The radius is the triangle's hypotenuse.`,
    explanation: [
      `The horizontal leg is $x-(${h})=${lx}$; the vertical leg is $y-(${k})=${ly}$. The signs come from subtracting the center coordinates.`,
      `Segment $CP$ is a radius, the hypotenuse. Squaring the leg lengths gives $(${lx})^2+(${ly})^2=(${rt})^2=${n}$.`,
      `The diagram's offsets are $3r/5$ and $4r/5$: their squared sum is $(9/25+16/25)r^2=r^2$.`,
      `For points in other directions the coordinate differences may be negative, but squaring gives the same distances. Thus this equation holds exactly for all points $${rt}$ units from the center.`,
    ],
  };
}
export function geometryClause(id: string, variant: string, r: Rng): Item {
  switch (id) {
    case "turn-degrees":
      return degreeCount(r);
    case "angle-equation":
      return variant === "vertical-then-adjacent"
        ? verticalAdjacent(r)
        : complementary(r);
    case "angle-pair-measure":
      return complementary(r, true);
    case "adjacent-angle-equation":
      return wholeAngle(r);
    case "right-triangle":
      return triangleStory(r, false);
    case "right-triangle-missing-leg":
      return triangleStory(r, true);
    case "circle-equation":
      return deriveCircle(r);
    default:
      throw new Error(`Unknown geometry clause ${id}`);
  }
}
