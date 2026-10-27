import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { shuffle } from "./distribution-practice";
import { graph, scene as sceneOf } from "./scene/author";
import { frac } from "./regents-kit";
import { retry, type R } from "./regents-geometry-kit";

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
  requiredResponseCapability: "single-choice-v1",
  requiredFigureCapability: "scenes-v1",
  description,
});
const noFigure = (t: TemplateMetadata): TemplateMetadata => {
  const { requiredFigureCapability: _omit, ...rest } = t;
  void _omit;
  return rest;
};

export const dilationCenterTemplate = meta(
  "geo-dilation-center",
  "Find the scale factor and center of a graphed dilation",
  "dilation-properties",
  0.5,
  "From a triangle and its dilated image drawn on a grid, choose the scale factor and the center of dilation, which is not the origin, among reciprocal factors and centers at the origin or at a vertex.",
);
export const dilationLineTemplate = noFigure(
  meta(
    "geo-dilation-line-center",
    "Equation of a line after a dilation about a stated center",
    "dilation-properties",
    0.55,
    "Choose the equation of the image of a line under a dilation whose center is on the line or off it and is not the origin, using that the image is parallel to the line and keeps the center fixed.",
  ),
);
export const motionChainTemplate = noFigure(
  meta(
    "geo-motion-chain",
    "Name the two motions that map one triangle to the next",
    "transformation-constructions",
    0.5,
    "Given the vertices of three congruent triangles, decide from orientation and side directions whether each step is a translation, a reflection or a rotation, and choose the pair in order.",
  ),
);
export const reflectionSideTemplate = meta(
  "geo-reflection-side",
  "Name the image of a side after two reflections",
  "transformation-constructions",
  0.5,
  "Reflect a quadrilateral over two stated lines in turn, then choose which segment between the labeled image vertices is the image of a named side.",
);
export const rigidStatementTemplate = noFigure(
  meta(
    "geo-rigid-statement",
    "Choose the statement that is true after a sequence of rigid motions",
    "transformation-invariants",
    0.4,
    "After a stated sequence of translations, reflections and rotations, choose the one statement that must be true: congruence, side lengths, angles and area, against parallelism, orientation or size.",
  ),
);

const pt = (x: number, y: number) => `(${x}, ${y})`;
const sg = (v: number) => (v < 0 ? `-${-v}` : `${v}`);
const plane = (lo: number, hi: number) =>
  graph({
    x: [lo, hi],
    y: [lo, hi],
    grid: 1,
    tick: 2,
    aspect: 1,
    axisNames: ["x", "y"],
  });

/* ------------------------------------------------------ dilation center */
type P = [number, number];
interface CenterModel {
  c: P;
  k: [number, number];
  tri: [P, P, P];
}
const dilate = (p: P, c: P, k: [number, number]): P => [
  c[0] + ((p[0] - c[0]) * k[0]) / k[1],
  c[1] + ((p[1] - c[1]) * k[0]) / k[1],
];
const cross = (a: P, b: P, c: P) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const kText = (k: [number, number]) =>
  k[1] === 1 ? String(k[0]) : `\\frac{${k[0]}}{${k[1]}}`;
const dilationAxes = {
  ask: defineAxis("ask", ["factor-and-center", "center-only"] as const),
};
export const dilationCenter = chainFamily({
  template: dilationCenterTemplate,
  axes: dilationAxes,
  model: (r: R): CenterModel => {
    const k = pick(r, [
      [2, 1],
      [3, 1],
      [1, 2],
      [1, 3],
      [3, 2],
    ] as Array<[number, number]>);
    const c: P = [r(-4, 4), r(-4, 4)];
    if (c[0] === 0 && c[1] === 0) retry();
    const tri = [0, 1, 2].map(() => {
      // Pre-image vertices keep the image on lattice points inside the window.
      const step = k[1];
      return [c[0] + step * r(-3, 3), c[1] + step * r(-3, 3)] as P;
    }) as [P, P, P];
    if (cross(tri[0], tri[1], tri[2]) === 0) retry();
    const images = tri.map((p) => dilate(p, c, k));
    const all = [...tri, ...images];
    if (
      all.some(
        (p) =>
          !Number.isInteger(p[0]) ||
          !Number.isInteger(p[1]) ||
          Math.abs(p[0]) > 8 ||
          Math.abs(p[1]) > 8,
      )
    )
      retry();
    if (tri.some((p) => p[0] === c[0] && p[1] === c[1])) retry();
    if (tri.some((p, i) => p[0] === images[i]![0] && p[1] === images[i]![1]))
      retry();
    return { c, k, tri };
  },
  variant: (m) => (m.k[0] > m.k[1] ? "enlargement" : "reduction"),
  render: (m, ax, r) => {
    const { c, k, tri } = m;
    const img = tri.map((p) => dilate(p, c, k)) as [P, P, P];
    const factorAndCenter = ax.ask === "factor-and-center";
    const label = (kk: [number, number], cc: P) =>
      factorAndCenter
        ? `Scale factor $${kText(kk)}$ and center $${pt(cc[0], cc[1])}$`
        : `Center $${pt(cc[0], cc[1])}$`;
    const inv: [number, number] = [k[1], k[0]];
    const options = [
      { label: label(k, c), correct: true as const },
      ...(factorAndCenter
        ? [
            {
              label: label(inv, c),
              feedback: `The image is ${k[0] > k[1] ? "larger" : "smaller"} than the original, so the factor is ${k[0] > k[1] ? "greater" : "less"} than 1. This choice has the reciprocal factor.`,
            },
          ]
        : []),
      {
        label: label(k, [0, 0]),
        feedback: `A dilation with its center at the origin would send $A=${pt(tri[0][0], tri[0][1])}$ to $(${frac(tri[0][0] * k[0], k[1])}, ${frac(tri[0][1] * k[0], k[1])})$, not to $A'=${pt(img[0][0], img[0][1])}$.`,
      },
      {
        label: label(k, tri[0]),
        feedback: `A center at $A$ would keep $A$ fixed, but $A$ and $A'$ are different points.`,
      },
      {
        label: label(k, [-c[0], -c[1]]),
        feedback: `The lines through corresponding points, such as $A$ and $A'$, meet at the center. They do not meet at ${pt(-c[0], -c[1])}.`,
      },
      {
        label: label(k, img[0]),
        feedback:
          "Only a point that stays fixed can be the center. $A'$ is the image of $A$, a different point.",
      },
    ];
    const surface = choiceSurface(r, {
      prompt: `Triangle $A'B'C'$ is the image of triangle $ABC$ under a dilation. ${factorAndCenter ? "Which choice gives the scale factor and the center of the dilation?" : "Which choice gives the center of the dilation, which has a scale factor of $" + kText(k) + "$?"}`,
      label: "Choose the dilation",
      options,
      hint: `Draw a line through $A=${pt(tri[0][0], tri[0][1])}$ and $A'=${pt(img[0][0], img[0][1])}$, and another through $B=${pt(tri[1][0], tri[1][1])}$ and $B'=${pt(img[1][0], img[1][1])}$. The center is where such lines cross.${factorAndCenter ? " Compare the length of $A'B'$ with $AB$ for the factor." : ""}`,
      explanation: [
        `A center of dilation, a point that stays fixed, lies on every line through a point and its image.`,
        `The lines through $A$ and $A'$ and through $B$ and $B'$ cross at ${pt(c[0], c[1])}.`,
        factorAndCenter
          ? `The distance from the center to $A'$ is $${kText(k)}$ times the distance to $A$, so the scale factor is $${kText(k)}$.`
          : `Check with the given factor: $${pt(c[0], c[1])}$ stays fixed and $A$ moves to $A'$ along a line through the center.`,
      ],
    });
    if (!surface) return null;
    const names = ["A", "B", "C"];
    let g = plane(-9, 9);
    const poly = (pts: P[], color: "accent" | "warm", dash?: "dash") => {
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % 3]!;
        g = g.segment(p, q, { color, ...(dash ? { dash } : {}) });
      });
    };
    poly(tri, "accent");
    poly(img, "warm", "dash");
    tri.forEach(
      (p, i) => (g = g.point(p[0], p[1], names[i], { color: "accent" })),
    );
    img.forEach(
      (p, i) => (g = g.point(p[0], p[1], `${names[i]}'`, { color: "warm" })),
    );
    return {
      ...surface,
      figure: {
        kind: "scene" as const,
        scene: sceneOf(g).build({ width: 300, maxHeight: 300 }),
      },
    };
  },
});

/* ------------------------------------------------------ dilated line */
const lineAxes = {
  center: defineAxis("center", ["on-the-line", "off-the-line"] as const),
};
const eqn = (mn: number, md: number, bn: number, bd: number) => {
  const s = frac(mn, md);
  const slope = s === "1" ? "" : s === "-1" ? "-" : s;
  const b = frac(bn, bd);
  const bTex =
    bn === 0 ? "" : b.startsWith("-") ? ` - ${b.slice(1)}` : ` + ${b}`;
  return `$y = ${slope}x${bTex}$`;
};
export const dilationLine = chainFamily({
  template: dilationLineTemplate,
  axes: lineAxes,
  model: (r: R, ax) => {
    const m = pick(r, [-3, -2, -1, 1, 2, 3] as const);
    const b = (r(0, 1) ? 1 : -1) * r(1, 6);
    const k = pick(r, [
      [2, 1],
      [3, 1],
      [4, 1],
      [1, 2],
    ] as Array<[number, number]>);
    const cx = r(-4, 4);
    const cy =
      ax.center === "on-the-line"
        ? m * cx + b
        : m * cx + b + (r(0, 1) ? 1 : -1) * r(1, 4);
    if (Math.abs(cy) > 12) retry();
    return { m, b, k, c: [cx, cy] as P };
  },
  variant: (m) => `factor-${m.k[0]}-${m.k[1]}`,
  render: (m, ax, r) => {
    const [p, q] = m.k;
    const bn = (q - p) * (m.c[1] - m.m * m.c[0]) + p * m.b; // times 1/q
    const bd = q;
    const onLine = ax.center === "on-the-line";
    const bImg = bn / bd;
    if (
      !onLine &&
      (Math.abs(bImg - m.b) < 1e-9 || Math.abs(bImg - (p * m.b) / q) < 1e-9)
    )
      retry();
    const kText2 = kText(m.k);
    const options = [
      { label: eqn(m.m, 1, bn, bd), correct: true as const },
      {
        label: eqn(m.m * p, q, m.b * 1, 1),
        feedback:
          "A dilation keeps the direction of every line, so the image of a line is parallel to it and has the same slope. Multiplying the slope by the scale factor is not right.",
      },
      {
        label: eqn(m.m, 1, p * m.b, q),
        feedback: `Multiplying the intercept by the scale factor works only when the center is the origin. Here the center is ${pt(m.c[0], m.c[1])}.`,
      },
      {
        label: eqn(m.m * p, q, p * m.b, q),
        feedback:
          "The slope of the image equals the slope of the line, and the intercept is not simply multiplied by the factor.",
      },
      ...(!onLine
        ? [
            {
              label: eqn(m.m, 1, m.b, 1),
              feedback: `The line does not pass through the center ${pt(m.c[0], m.c[1])}, so its image is a different parallel line.`,
            },
          ]
        : []),
    ];
    return choiceSurface(r, {
      prompt: `The line $y = ${m.m === 1 ? "" : m.m === -1 ? "-" : m.m}x ${m.b < 0 ? "-" : "+"} ${Math.abs(m.b)}$ is dilated by a scale factor of $${kText2}$ centered at the point $${pt(m.c[0], m.c[1])}$. Which equation is the image of the line?`,
      label: "Choose the equation",
      options,
      hint: `Substitute the coordinates of the center ${pt(m.c[0], m.c[1])} into the line's equation to see whether the center is on the line. ${onLine ? "A line through the center is sent onto itself." : "If it is not, the image is parallel to the line: dilate one point of the line to find which parallel line."}`,
      explanation: onLine
        ? [
            `At $x=${m.c[0]}$ the line has $y=${m.m * m.c[0] + m.b}$, so the center ${pt(m.c[0], m.c[1])} is on the line.`,
            "Every point of the line lies on a ray from the center along the line, so the dilated points stay on the same line.",
            `The image is the same line: ${eqn(m.m, 1, bn, bd)}.`,
          ]
        : [
            `At $x=${m.c[0]}$ the line has $y=${m.m * m.c[0] + m.b}$, not ${m.c[1]}, so the center is off the line.`,
            "A dilation sends a line to a parallel line, so the slope stays the same.",
            `The point $(0, ${m.b})$ on the line is sent to $(${frac(m.c[0] * (q - p), q)}, ${frac(m.c[1] * (q - p) + p * m.b, q)})$, which is on the image.`,
            `The image is ${eqn(m.m, 1, bn, bd)}.`,
          ],
    });
  },
});

/* ------------------------------------------------------ motion chain */
type Motion = {
  kind: "translation" | "reflection" | "rotation";
  f: (p: P) => P;
};
function randomMotion(r: R, kind: Motion["kind"]): Motion {
  if (kind === "translation") {
    const dx = r(-6, 6);
    const dy = r(-6, 6);
    if (dx === 0 && dy === 0) retry();
    return { kind, f: ([x, y]) => [x + dx, y + dy] };
  }
  if (kind === "reflection") {
    const which = r(0, 3);
    return {
      kind,
      f: ([x, y]) =>
        which === 0
          ? [x, -y]
          : which === 1
            ? [-x, y]
            : which === 2
              ? [y, x]
              : [-y, -x],
    };
  }
  const which = r(0, 2);
  return {
    kind,
    f: ([x, y]) => (which === 0 ? [-y, x] : which === 1 ? [-x, -y] : [y, -x]),
  };
}
const kinds = ["translation", "reflection", "rotation"] as const;
const article = (k: string) => `a ${k}`;
export const motionChain = chainFamily({
  template: motionChainTemplate,
  axes: {
    first: defineAxis("first", [
      "translation",
      "reflection",
      "rotation",
    ] as const),
  },
  model: (r: R, ax) => {
    const second = pick(r, kinds);
    const m1 = randomMotion(r, ax.first);
    const m2 = randomMotion(r, second);
    const a = [r(-3, 3), r(-3, 3)] as P;
    const b = [r(-3, 3), r(-3, 3)] as P;
    const c = [r(-3, 3), r(-3, 3)] as P;
    const tri: [P, P, P] = [a, b, c];
    if (cross(a, b, c) === 0) retry();
    const side = (p: P, q: P) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    if (new Set([side(a, b), side(b, c), side(c, a)]).size < 3) retry();
    const t2 = tri.map((p) => m1.f(p)) as [P, P, P];
    const t3 = t2.map((p) => m2.f(p)) as [P, P, P];
    const out = [...tri, ...t2, ...t3];
    if (out.some((p) => Math.abs(p[0]) > 12 || Math.abs(p[1]) > 12)) retry();
    // A step that leaves the triangle where it was is not a distinct motion.
    const same = (u: P[], v: P[]) =>
      u.every((p, i) => p[0] === v[i]![0] && p[1] === v[i]![1]);
    if (same(tri, t2) || same(t2, t3)) retry();
    return { tri, t2, t3, kinds: [ax.first, second] as [string, string] };
  },
  variant: (m) => `${m.kinds[0]}-then-${m.kinds[1]}`,
  render: (m, _ax, r) => {
    const verts = (t: P[], names: string[]) =>
      t.map((p, i) => `$${names[i]}${pt(p[0], p[1])}$`).join(", ");
    const [k1, k2] = m.kinds;
    const pairs: Array<[string, string]> = [];
    for (const x of kinds) for (const y of kinds) pairs.push([x, y]);
    const wrong = shuffle(
      r,
      pairs.filter(([x, y]) => !(x === k1 && y === k2)),
    );
    // Always offer the reversed order when it differs.
    const rev = pairs.find(
      ([x, y]) => x === k2 && y === k1 && !(x === k1 && y === k2),
    );
    const picks = [
      ...(rev ? [rev] : []),
      ...wrong.filter((p) => p !== rev),
    ].slice(0, 5);
    const text = ([x, y]: [string, string]) =>
      `${article(x)[0]!.toUpperCase() + article(x).slice(1)} followed by ${article(y)}`;
    return choiceSurface(r, {
      prompt: `Triangle $ABC$ has vertices ${verts(m.tri, ["A", "B", "C"])}. Triangle $DEF$ has vertices ${verts(m.t2, ["D", "E", "F"])}. Triangle $GHI$ has vertices ${verts(m.t3, ["G", "H", "I"])}. Which sequence of rigid motions maps triangle $ABC$ onto triangle $DEF$ and then triangle $DEF$ onto triangle $GHI$?`,
      label: "Choose the sequence",
      options: [
        { label: text([k1, k2]), correct: true },
        ...picks.map((p) => ({
          label: text(p),
          feedback: `Compare the order of the labels around the triangle and the direction of the sides from one triangle to the next. These facts do not match ${article(p[0] !== k1 ? p[0] : p[1])} for the ${p[0] !== k1 ? "first" : "second"} step.`,
        })),
      ],
      hint: `Compare ${verts(m.tri, ["A", "B", "C"])} with ${verts(m.t2, ["D", "E", "F"])} one vertex at a time. If every vertex moves the same amount, the step is a translation. If the order of the labels around the triangle reverses, it is a reflection. Then do the same for the second step.`,
      explanation: [
        `A reflection reverses the order of the labels around the triangle. A translation moves every vertex by the same amount. A rotation keeps the order but turns the sides.`,
        `From $ABC$ to $DEF$ the step is ${article(k1)}, and from $DEF$ to $GHI$ it is ${article(k2)}.`,
        `The sequence is ${text([k1, k2]).toLowerCase()}.`,
      ],
    });
  },
});

/* ------------------------------------------------------ reflection side */
interface ReflectModel {
  quad: P[];
  lines: [number, number];
  perm: number[];
  side: number;
}
const lineNames = [
  "the $x$-axis",
  "the $y$-axis",
  "the line $y=x$",
  "the line $y=-x$",
];
const reflectBy = (which: number, [x, y]: P): P =>
  which === 0
    ? [x, -y]
    : which === 1
      ? [-x, y]
      : which === 2
        ? [y, x]
        : [-y, -x];
const angleOf = (p: P, c: P) => Math.atan2(p[1] - c[1], p[0] - c[0]);
export const reflectionSide = chainFamily({
  template: reflectionSideTemplate,
  axes: { pair: defineAxis("pair", ["axes", "diagonal-line"] as const) },
  model: (r: R, ax): ReflectModel => {
    const pts: P[] = [];
    while (pts.length < 4) {
      const p: P = [r(-5, 5), r(-5, 5)];
      if (
        !pts.some((q) => q[0] === p[0] && q[1] === p[1]) &&
        (p[0] !== 0 || p[1] !== 0)
      )
        pts.push(p);
    }
    const c: P = [
      pts.reduce((s, p) => s + p[0], 0) / 4,
      pts.reduce((s, p) => s + p[1], 0) / 4,
    ];
    const quad = [...pts].sort((p, q) => angleOf(p, c) - angleOf(q, c));
    // The quadrilateral must be convex so that it is clearly drawn.
    const turns = quad.map((p, i) =>
      cross(p, quad[(i + 1) % 4]!, quad[(i + 2) % 4]!),
    );
    if (!(turns.every((t) => t > 0) || turns.every((t) => t < 0))) retry();
    const a = ax.pair === "axes" ? r(0, 1) : 2 + r(0, 1);
    const b = ax.pair === "axes" ? 1 - a : 5 - a; // the other line of the same kind
    const lines: [number, number] =
      ax.pair === "axes"
        ? [a, b]
        : r(0, 1)
          ? [r(0, 1), 2 + r(0, 1)]
          : [2 + r(0, 1), r(0, 1)];
    const perm = shuffle(r, [0, 1, 2, 3]);
    return { quad, lines, perm, side: r(0, 3) };
  },
  variant: (m) => `lines-${m.lines[0]}-${m.lines[1]}`,
  render: (m, _ax, r) => {
    const names = ["A", "B", "C", "D"];
    const imgNames = ["E", "F", "G", "H"];
    const image = m.quad.map((p) =>
      reflectBy(m.lines[1], reflectBy(m.lines[0], p)),
    );
    // Image vertex i carries the label imgNames[perm[i]].
    const labelOf = (i: number) => imgNames[m.perm[i]!]!;
    const sideImage = (i: number) =>
      [labelOf(i), labelOf((i + 1) % 4)].sort().join("");
    const key = sideImage(m.side);
    const pairsOf = [0, 1, 2, 3].flatMap((i) => [[i, (i + 1) % 4] as const]);
    const others = pairsOf
      .filter(([i]) => i !== m.side)
      .map(([i]) => sideImage(i));
    const diagonals = [
      [0, 2],
      [1, 3],
    ].map(([i, j]) => [labelOf(i!), labelOf(j!)].sort().join(""));
    const wrong = [...others, ...diagonals].filter((v) => v !== key);
    const orig = `${names[m.side]}${names[(m.side + 1) % 4]}`;
    const surface = choiceSurface(r, {
      prompt: `Quadrilateral $ABCD$ is reflected over ${lineNames[m.lines[0]]} and the result is then reflected over ${lineNames[m.lines[1]]}. The final image has vertices $E$, $F$, $G$ and $H$ as shown. Which segment is the image of $\\overline{${orig}}$?`,
      label: "Choose the segment",
      options: [
        { label: `$\\overline{${key}}$`, correct: true },
        ...wrong.map((v) => ({
          label: `$\\overline{${v}}$`,
          feedback: `Follow the endpoints of $\\overline{${orig}}$ through both reflections: they land on the points labeled $${key[0]}$ and $${key[1]}$, not on $${v[0]}$ and $${v[1]}$.`,
        })),
      ],
      hint: `Reflect $${orig[0]}=${pt(m.quad[m.side]![0], m.quad[m.side]![1])}$ over ${lineNames[m.lines[0]]} and then over ${lineNames[m.lines[1]]}, and find which labeled point it lands on. Do the same for $${orig[1]}$.`,
      explanation: [
        `Reflecting over ${lineNames[m.lines[0]]} then over ${lineNames[m.lines[1]]} sends $${orig[0]}$ to the point labeled $${labelOf(m.side)}$ and $${orig[1]}$ to the point labeled $${labelOf((m.side + 1) % 4)}$.`,
        "A reflection keeps every segment's endpoints with it, so the image of a side joins the images of its endpoints.",
        `The image of $\\overline{${orig}}$ is $\\overline{${key}}$.`,
      ],
    });
    if (!surface) return null;
    let g = plane(-9, 9);
    const draw = (
      pts: P[],
      color: "accent" | "warm",
      ls: string[],
      dash?: "dash",
    ) => {
      pts.forEach((p, i) => {
        g = g.segment(p, pts[(i + 1) % 4]!, {
          color,
          ...(dash ? { dash } : {}),
        });
      });
      pts.forEach((p, i) => (g = g.point(p[0], p[1], ls[i], { color })));
    };
    draw(m.quad, "accent", names);
    draw(image, "warm", [0, 1, 2, 3].map(labelOf), "dash");
    return {
      ...surface,
      figure: {
        kind: "scene" as const,
        scene: sceneOf(g).build({ width: 300, maxHeight: 300 }),
      },
    };
  },
});

/* ------------------------------------------------------ rigid statement */
const motionWords = ["a translation", "a reflection", "a rotation"];
export const rigidStatement = chainFamily({
  template: rigidStatementTemplate,
  axes: {
    parity: defineAxis("parity", [
      "odd-reflections",
      "even-reflections",
    ] as const),
  },
  model: (r: R, ax) => {
    const n = r(2, 4);
    const reflections =
      ax.parity === "odd-reflections"
        ? pick(r, [1, 3] as const)
        : pick(r, [0, 2] as const);
    const seq: string[] = [];
    let left = reflections;
    for (let i = 0; i < n; i++) {
      const needReflection = left > 0 && (n - i <= left || r(0, 1) === 1);
      if (needReflection) {
        seq.push(motionWords[1]!);
        left--;
      } else seq.push(motionWords[r(0, 1) === 0 ? 0 : 2]!);
    }
    if (left > 0) retry();
    return { seq, reflections };
  },
  variant: (m) => `reflections-${m.reflections}`,
  render: (m, _ax, r) => {
    const even = m.reflections % 2 === 0;
    const listText = m.seq.join(", then ");
    const true1 = [
      "Triangle $A'B'C'$ is congruent to triangle $ABC$.",
      "Every side of $A'B'C'$ has the same length as its corresponding side of $ABC$.",
      "Every angle of $A'B'C'$ has the same measure as its corresponding angle of $ABC$.",
      "The area of $A'B'C'$ equals the area of $ABC$.",
    ];
    const key = pick(r, true1);
    const fals: Array<[string, string]> = [
      [
        "Each side of $A'B'C'$ is parallel to its corresponding side of $ABC$.",
        "Rigid motions keep lengths and angles, but a rotation or a reflection turns sides, so corresponding sides need not be parallel.",
      ],
      [
        even
          ? "The vertices of $A'B'C'$ appear in the opposite order, clockwise instead of counterclockwise, from those of $ABC$."
          : "The vertices of $A'B'C'$ appear in the same order, clockwise or counterclockwise, as those of $ABC$.",
        even
          ? `Reflections number ${m.reflections}, an even number, and they cancel in pairs, so the order of the vertices is unchanged.`
          : `Reflections number ${m.reflections}, an odd number, and they reverse the order of the vertices.`,
      ],
      [
        "Triangle $A'B'C'$ is larger than triangle $ABC$.",
        "Rigid motions never change size. They keep every length.",
      ],
      [
        "Each vertex of $A'B'C'$ has the same coordinates as the corresponding vertex of $ABC$.",
        "A rigid motion may move every point, so the coordinates can change.",
      ],
      [
        "Triangle $A'B'C'$ is similar to $ABC$ but not congruent to it.",
        "Rigid motions keep every length, so the image is congruent, not merely similar.",
      ],
    ];
    return choiceSurface(r, {
      prompt: `Triangle $ABC$ is mapped to triangle $A'B'C'$ by ${m.seq.length} rigid motions: ${listText}. Which statement must be true?`,
      label: "Choose the statement",
      options: [
        { label: key, correct: true },
        ...fals.map(([label, feedback]) => ({ label, feedback })),
      ],
      hint: `Rigid motions ${m.seq.length === 1 ? "" : "such as "}${listText} each keep distances and angles. Ask what is kept by all ${m.seq.length} motions together, and test each statement against a reflection.`,
      explanation: [
        "A translation, a reflection and a rotation each keep every distance and every angle measure, so any sequence of them does too.",
        `Lengths, angles and area stay the same, so the image is congruent to the original. Parallelism of sides, the order of the vertices and the coordinates can change${even ? "" : ", and the odd number of reflections reverses the order of the vertices"}.`,
        `The statement that must be true is: ${key}`,
      ],
    });
  },
});

export const regentsGeometryMotionTemplates = [
  dilationCenterTemplate,
  dilationLineTemplate,
  motionChainTemplate,
  reflectionSideTemplate,
  rigidStatementTemplate,
];
export const regentsGeometryMotionGenerate = dispatch(
  regentsGeometryMotionTemplates,
  {
    "geo-dilation-center": (s) => dilationCenter.generate(s).problem,
    "geo-dilation-line-center": (s) => dilationLine.generate(s).problem,
    "geo-motion-chain": (s) => motionChain.generate(s).problem,
    "geo-reflection-side": (s) => reflectionSide.generate(s).problem,
    "geo-rigid-statement": (s) => rigidStatement.generate(s).problem,
  },
);
