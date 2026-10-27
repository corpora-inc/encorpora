import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { gcd } from "./chain-kit";
import { retry, shifted, slopeTex, type R } from "./regents-geometry-kit";

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
  description,
});
export const segmentPartitionPointTemplate = meta(
  "geo-segment-partition-point",
  "Point that divides a segment in a ratio",
  "segment-division",
  0.45,
  "Choose the coordinate pair of the point that divides a directed segment in a ratio such as 1:4 or 5:4, with integer coordinates.",
);
export const circleGeneralFormTemplate = meta(
  "geo-circle-general-form",
  "Center and radius from the general form of a circle",
  "circle-equations",
  0.5,
  "Choose the center and radius of a circle written as an expanded equation, completing the square, including equations whose terms share a common factor.",
);
export const perpendicularPointSlopeTemplate = meta(
  "geo-line-point-slope-choice",
  "Point-slope equation of a parallel or perpendicular line",
  "slope-proofs",
  0.5,
  "Choose the point-slope equation of the line through a given point that is perpendicular or parallel to the line through two other points.",
);
export const linePairRelationshipTemplate = meta(
  "geo-line-pair-relationship",
  "Classify two lines as parallel, perpendicular, the same or neither",
  "slope-proofs",
  0.4,
  "Compare the slopes of a line written in slope-intercept form and a second line written in standard form to classify the pair.",
);
export const dilationLineImageTemplate = meta(
  "geo-dilation-line-image",
  "Equation of a line after a dilation centered at the origin",
  "dilation-properties",
  0.5,
  "Choose the equation of the image of a line that misses the center after a dilation, using that the slope stays and the intercept scales.",
);

const pairTex = (x: number, y: number) => `$(${x},\\ ${y})$`;
const sgn = (n: number) => (n < 0 ? "-" : "");

/* ------------------------------------------------------- segment partition */
const partAxes = {
  direction: defineAxis("direction", ["from-first", "from-second"] as const),
};
export const segmentPartitionPoint = chainFamily({
  template: segmentPartitionPointTemplate,
  axes: partAxes,
  model: (r: R) => {
    const [a, b] = pick(r, [
      [1, 4],
      [2, 3],
      [3, 2],
      [5, 4],
      [4, 5],
      [1, 2],
      [2, 1],
      [3, 4],
      [1, 3],
    ] as const);
    const s = a + b;
    const dx = s * pick(r, [-3, -2, -1, 1, 2, 3, 4] as const);
    const dy = s * pick(r, [-3, -2, -1, 1, 2, 3, 4] as const);
    const x1 = r(-8, 6);
    const y1 = r(-8, 6);
    return { a, b, x1, y1, x2: x1 + dx, y2: y1 + dy };
  },
  variant: (m) => `ratio-${m.a}-${m.b}`,
  render: (m, ax, r) => {
    // AP:PB = a:b either way; "from-second" states it as BP:PA = b:a.
    const s = m.a + m.b;
    const px = m.x1 + (m.a * (m.x2 - m.x1)) / s;
    const py = m.y1 + (m.a * (m.y2 - m.y1)) / s;
    if (!Number.isInteger(px) || !Number.isInteger(py)) retry();
    const dx = m.x2 - m.x1;
    const dy = m.y2 - m.y1;
    const label = (x: number, y: number) => pairTex(x, y);
    const tot = m.a + m.b;
    const first = ax.direction === "from-first";
    const ratioText = first ? `$AP:PB=${m.a}:${m.b}$` : `$BP:PA=${m.b}:${m.a}$`;
    const swapped = {
      x: m.x1 + (m.b * dx) / tot,
      y: m.y1 + (m.b * dy) / tot,
    };
    const whole = (v: number) => Number.isInteger(v);
    const extra = [
      {
        label: label(m.x1 + dx / 2, m.y1 + dy / 2),
        ok: whole(dx / 2) && whole(dy / 2),
        feedback:
          "This is the midpoint, which divides the segment in the ratio 1:1.",
      },
      {
        label: label(m.x1 + (m.a * dx) / m.b, m.y1 + (m.a * dy) / m.b),
        ok: whole((m.a * dx) / m.b) && whole((m.a * dy) / m.b),
        feedback: `The ratio ${m.a}:${m.b} splits the segment into ${tot} equal parts; use ${m.a}/${tot} of the way, not ${m.a}/${m.b}.`,
      },
      {
        label: label(py, px),
        ok: true,
        feedback:
          "Write the coordinates in the order $(x,\\ y)$; this pair has them swapped.",
      },
      {
        label: label(px, m.y1 + dy / 2),
        ok: whole(dy / 2),
        feedback:
          "Both coordinates must be found with the same fraction of the way along the segment.",
      },
    ]
      .filter((o) => o.ok)
      .map(({ label: l, feedback }) => ({ label: l, feedback }));
    return choiceSurface(r, {
      prompt: `Segment $\\overline{AB}$ has endpoints $A(${m.x1},\\ ${m.y1})$ and $B(${m.x2},\\ ${m.y2})$. Point $P$ lies on $\\overline{AB}$ so that ${ratioText}. What are the coordinates of $P$?`,
      options: [
        { label: label(px, py), correct: true },
        {
          label: label(swapped.x, swapped.y),
          feedback: `This point is ${m.b} of the ${tot} equal parts from $A$, which divides the segment in the ratio ${m.b}:${m.a} instead of ${m.a}:${m.b}.`,
        },
        ...extra,
      ],
      hint: first
        ? `Add the two numbers of the ratio ${m.a}:${m.b} to count ${tot} equal parts in all. $P$ is ${m.a} of them from $A(${m.x1},\\ ${m.y1})$; find the horizontal and vertical change from $A$ to $B$ first.`
        : `Add the two numbers of $BP:PA=${m.b}:${m.a}$ to count ${tot} equal parts in all, with ${m.b} of them between $B$ and $P$. Work out how far $P$ is from $A$ along the segment from $A(${m.x1},\\ ${m.y1})$ to $B$.`,
      explanation: [
        `The horizontal change from $A$ to $B$ is $${m.x2}-${sgn(m.x1) ? `(${m.x1})` : m.x1}=${dx}$ and the vertical change is $${m.y2}-${sgn(m.y1) ? `(${m.y1})` : m.y1}=${dy}$.`,
        `The ratio gives ${tot} equal parts, and $P$ is ${m.a} of them from $A$, so $P$ is $\\frac{${m.a}}{${tot}}$ of the way from $A$ to $B$.`,
        `$x=${m.x1}+\\frac{${m.a}}{${tot}}(${dx})=${px}$ and $y=${m.y1}+\\frac{${m.a}}{${tot}}(${dy})=${py}$, so $P=(${px},\\ ${py})$.`,
      ],
    });
  },
});

/* ---------------------------------------------------------- circle general */
const circleAxes = { form: defineAxis("form", ["monic", "scaled"] as const) };
export const circleGeneralForm = chainFamily({
  template: circleGeneralFormTemplate,
  axes: circleAxes,
  model: (r: R, a) => ({
    h: r(-7, 7),
    k: r(-7, 7),
    rad: r(2, 9),
    c: a.form === "scaled" ? pick(r, [2, 3, 4] as const) : 1,
  }),
  variant: (m) =>
    `${m.c === 1 ? "monic" : "scaled"}-${m.h * m.k < 0 ? "mixed" : "same"}-signs`,
  render: (m, _a, r) => {
    if (m.h === 0 && m.k === 0) return null;
    const D = -2 * m.h;
    const E = -2 * m.k;
    const F = m.h * m.h + m.k * m.k - m.rad * m.rad;
    const term = (coef: number, v: string) =>
      coef === 0
        ? ""
        : ` ${coef < 0 ? "-" : "+"} ${Math.abs(coef) === 1 ? "" : Math.abs(coef)}${v}`;
    const left = (c: number) =>
      `${c === 1 ? "" : c}x^2 + ${c === 1 ? "" : c}y^2${term(c * D, "x")}${term(c * E, "y")}${c * F === 0 ? "" : ` ${c * F < 0 ? "-" : "+"} ${Math.abs(c * F)}`} = 0`;
    const lab = (hx: number, ky: number, rr: number | string) =>
      `center $(${hx},\\ ${ky})$, radius $${rr}$`;
    const sq = m.rad * m.rad;
    const options = [
      { label: lab(m.h, m.k, m.rad), correct: true as const },
      {
        label: lab(-m.h, -m.k, m.rad),
        feedback: `The center takes the opposite sign of half the $x$ and $y$ coefficients: $x^2-2hx$ means the center has $x=h$.`,
      },
      {
        label: lab(m.h, m.k, sq),
        feedback: `${sq} is $r^2$. The completed-square equation gives $r^2$ on the right, so the radius is its square root.`,
      },
      {
        label:
          m.c === 1
            ? lab(2 * m.h, 2 * m.k, m.rad)
            : lab(m.c * m.h, m.c * m.k, m.rad),
        feedback:
          m.c === 1
            ? "The center is half the coefficient of each linear term, with the opposite sign, not the whole coefficient."
            : "Divide every term by the common factor first; otherwise the coordinates come out multiplied by that factor.",
      },
      {
        label: lab(m.h, m.k, Math.round(Math.sqrt(Math.abs(F)))),
        feedback:
          "The constant term is not $-r^2$. Complete the square so that $h^2+k^2$ is added to both sides too.",
      },
    ];
    return choiceSurface(r, {
      prompt: `A circle has the equation $${left(m.c)}$. What are its center and radius?`,
      options,
      hint: `${m.c === 1 ? "" : `Divide every term by ${m.c} first. `}The linear terms are ${m.c * D === 0 ? "" : `$${m.c * D}x$`}${m.c * D !== 0 && m.c * E !== 0 ? " and " : ""}${m.c * E === 0 ? "" : `$${m.c * E}y$`}. ${m.c * F === 0 ? "" : `The constant term is $${m.c * F}$. `}Group the $x$ terms and the $y$ terms, halve each linear coefficient${m.c === 1 ? "" : " (after dividing)"}, square each half, and add those squares to both sides.`,
      explanation: [
        ...(m.c === 1
          ? []
          : [
              `Divide every term by ${m.c}: $x^2+y^2${term(D, "x")}${term(E, "y")}${F === 0 ? "" : ` ${F < 0 ? "-" : "+"} ${Math.abs(F)}`}=0$.`,
            ]),
        `Move the constant and complete the squares: $(x^2${term(D, "x")} + ${m.h * m.h}) + (y^2${term(E, "y")} + ${m.k * m.k}) = ${-F} + ${m.h * m.h} + ${m.k * m.k}$.`,
        `$(${m.h === 0 ? "x" : `x${m.h > 0 ? " - " : " + "}${Math.abs(m.h)}`})^2 + (${m.k === 0 ? "y" : `y${m.k > 0 ? " - " : " + "}${Math.abs(m.k)}`})^2 = ${sq}$.`,
        `The center is $(${m.h},\\ ${m.k})$ and the radius is $\\sqrt{${sq}}=${m.rad}$.`,
      ],
    });
  },
});

/* ------------------------------------------------------ point-slope choice */
const psAxes = {
  relation: defineAxis("relation", ["perpendicular", "parallel"] as const),
};
export const linePointSlope = chainFamily({
  template: perpendicularPointSlopeTemplate,
  axes: psAxes,
  model: (r: R) => {
    for (;;) {
      const dx = r(2, 5) * (r(0, 1) ? 1 : -1);
      const dy = r(1, 6) * (r(0, 1) ? 1 : -1);
      if (Math.abs(dx) === Math.abs(dy)) continue;
      const px = r(-6, 6);
      const py = r(-6, 6);
      return { px, py, dx, dy, qx: r(-6, 6), qy: r(-6, 6) };
    }
  },
  variant: (m) => (m.dy / m.dx > 0 ? "positive-slope" : "negative-slope"),
  render: (m, a, r) => {
    const g = gcd(m.dx, m.dy) || 1;
    const num = m.dy / g;
    const den = m.dx / g;
    const perp = a.relation === "perpendicular";
    // slope of the new line = n/d
    const [sn, sd] = perp ? [-den, num] : [num, den];
    const mk = (n: number, d: number, sx: number, sy: number) =>
      `$${shifted("y", sy)} = ${slopeTex(n, d)}(${shifted("x", sx)})$`;
    const x2 = m.px + m.dx;
    const y2 = m.py + m.dy;
    return choiceSurface(r, {
      prompt: `A line passes through $(${m.px},\\ ${m.py})$ and $(${x2},\\ ${y2})$. Which equation represents the line through $(${m.qx},\\ ${m.qy})$ that is ${a.relation} to it?`,
      options: [
        { label: mk(sn, sd, m.qx, m.qy), correct: true },
        {
          label: mk(perp ? num : -num, perp ? den : den, m.qx, m.qy),
          feedback: perp
            ? "This keeps the slope of the given line, so it is parallel, not perpendicular."
            : "This negates the slope, which is not the slope of a parallel line.",
        },
        {
          label: mk(den, num, m.qx, m.qy),
          feedback: perp
            ? "A perpendicular slope is the opposite reciprocal; flipping the fraction without changing the sign is not enough."
            : "Parallel lines have equal slopes; this option flips the fraction, which is not the same slope.",
        },
        {
          label: mk(sn, sd, -m.qx, -m.qy),
          feedback:
            "In $y-y_1=m(x-x_1)$ the coordinates of the point are subtracted, so a negative coordinate becomes a plus sign. This option has the signs of the point reversed.",
        },
        {
          label: mk(sn, sd, m.px, m.py),
          feedback: `The new line must pass through $(${m.qx},\\ ${m.qy})$, not through a point of the given line.`,
        },
      ],
      hint: `Find the slope of the line through $(${m.px},\\ ${m.py})$ and $(${x2},\\ ${y2})$ as rise over run. Decide what slope the ${a.relation} line needs, then put the point $(${m.qx},\\ ${m.qy})$ into $y-y_1=m(x-x_1)$.`,
      explanation: [
        `The given slope is $\\frac{${y2}-${m.py < 0 ? `(${m.py})` : m.py}}{${x2}-${m.px < 0 ? `(${m.px})` : m.px}}=${slopeTex(num, den)}$.`,
        perp
          ? `A perpendicular line has the opposite reciprocal slope, $${slopeTex(sn, sd)}$.`
          : `A parallel line has the same slope, $${slopeTex(sn, sd)}$.`,
        `With the point $(${m.qx},\\ ${m.qy})$, point-slope form $y-y_1=m(x-x_1)$ gives ${mk(sn, sd, m.qx, m.qy)}.`,
      ],
    });
  },
});

/* ---------------------------------------------------- line pair relationship */
const pairAxes = {
  kind: defineAxis("kind", [
    "parallel",
    "perpendicular",
    "same",
    "neither",
  ] as const),
};
export const linePairRelationship = chainFamily({
  template: linePairRelationshipTemplate,
  axes: pairAxes,
  model: (r: R) => {
    for (;;) {
      const p = r(1, 5) * (r(0, 1) ? 1 : -1);
      const q = r(1, 5);
      if (gcd(p, q) !== 1 || Math.abs(p) === q) continue;
      return { p, q, b: r(-9, 9), c: r(-12, 12) };
    }
  },
  variant: (m) => (m.q === 1 ? "integer-slope" : "fractional-slope"),
  render: (m, a, r) => {
    // line 1: y = (p/q)x + b. Line 2 in standard form Ax + By = C.
    const eq1 = `y = ${slopeTex(m.p, m.q)}x ${m.b < 0 ? "-" : "+"} ${Math.abs(m.b)}`;
    let A: number;
    let B: number;
    let C: number;
    if (a.kind === "parallel")
      [A, B, C] = [m.p, -m.q, m.c === -m.q * m.b ? m.c + 1 : m.c];
    else if (a.kind === "same") [A, B, C] = [m.p, -m.q, -m.q * m.b];
    else if (a.kind === "perpendicular") [A, B, C] = [m.q, m.p, m.c];
    else [A, B, C] = r(0, 1) ? [m.p, m.q, m.c] : [m.q, -m.p, m.c];
    // scale the second equation so that it does not look like a copy.
    const k = pick(r, [1, 2, 3] as const);
    [A, B, C] = [A * k, B * k, C * k];
    const term = (coef: number, v: string, first: boolean) => {
      const mag = Math.abs(coef) === 1 ? "" : Math.abs(coef);
      return first
        ? `${coef < 0 ? "-" : ""}${mag}${v}`
        : ` ${coef < 0 ? "-" : "+"} ${mag}${v}`;
    };
    const eq2 = `${term(A, "x", true)}${term(B, "y", false)} = ${C}`;
    const s1 = [m.p, m.q] as const;
    const s2 = [-A, B] as const;
    const t1 = slopeTex(s1[0], s1[1]);
    const t2 = slopeTex(s2[0], s2[1]);
    const labels = {
      parallel: "parallel",
      perpendicular: "perpendicular",
      same: "the same line",
      neither: "neither parallel nor perpendicular",
    } as const;
    const why = {
      parallel: `The slopes $${t1}$ and $${t2}$ are equal, but the $y$-intercepts differ, so the lines never meet.`,
      same: `The slopes are equal and the second equation reduces to the first, so every point of one line is on the other.`,
      perpendicular: `The slopes $${t1}$ and $${t2}$ multiply to $-1$.`,
      neither: `The slopes $${t1}$ and $${t2}$ are neither equal nor opposite reciprocals.`,
    } as const;
    const keys = ["parallel", "perpendicular", "same", "neither"] as const;
    const feedbackFor = (kind: (typeof keys)[number]) => {
      if (kind === "same" && a.kind === "parallel")
        return "The slopes are equal but the $y$-intercepts differ, so these are two different lines.";
      if (kind === "parallel" && a.kind === "same")
        return "Equal slopes alone do not make a pair of distinct parallel lines: here the second equation reduces to the first, so the lines coincide.";
      if (kind === "parallel")
        return `Parallel lines have equal slopes, but the slopes here are $${t1}$ and $${t2}$.`;
      if (kind === "perpendicular")
        return `Perpendicular lines have slopes whose product is $-1$; $${t1}$ and $${t2}$ do not multiply to $-1$.`;
      if (kind === "same")
        return `The same line needs equal slopes and equal intercepts; the slopes here are $${t1}$ and $${t2}$.`;
      return `The slopes $${t1}$ and $${t2}$ are related (equal or opposite reciprocals), so the pair is not unrelated.`;
    };
    return choiceSurface(r, {
      prompt: `Line $\\ell$ has the equation $${eq1}$ and line $m$ has the equation $${eq2}$. Which statement describes lines $\\ell$ and $m$?`,
      options: keys.map((kind) => ({
        label: labels[kind],
        ...(kind === a.kind
          ? { correct: true as const }
          : { feedback: feedbackFor(kind) }),
      })),
      hint: `Rewrite $${eq2}$ as $y=mx+b$ by solving for $y$, then compare its slope with the slope in $${eq1}$. Check whether the two slopes are equal, and whether their product is $-1$.`,
      explanation: [
        `For $\\ell$, the slope is $${t1}$ and the $y$-intercept is $${m.b}$.`,
        `Solving $${eq2}$ for $y$ gives the slope $${t2}$.`,
        why[a.kind],
        `The lines are ${labels[a.kind]}.`,
      ],
    });
  },
});

/* ------------------------------------------------------ dilation line image */
const dilAxes = {
  factor: defineAxis("factor", ["enlarge", "reduce"] as const),
};
export const dilationLineImage = chainFamily({
  template: dilationLineImageTemplate,
  axes: dilAxes,
  model: (r: R, a) => {
    const m = r(-5, 5);
    const k =
      a.factor === "enlarge"
        ? pick(r, [2, 3, 4] as const)
        : pick(r, [2, 3] as const);
    const b = a.factor === "enlarge" ? r(-6, 6) : k * r(-4, 4);
    return { m, b, k };
  },
  variant: (m) => (m.b === 0 ? "through-center" : "misses-center"),
  render: (m, a, r) => {
    if (m.b === 0) return null;
    const enlarge = a.factor === "enlarge";
    const img = enlarge ? m.k * m.b : m.b / m.k;
    const eq = (slope: number, icept: number) => {
      const lead = slope === 1 ? "x" : slope === -1 ? "-x" : `${slope}x`;
      if (slope === 0) return `$y = ${icept}$`;
      return icept === 0
        ? `$y = ${lead}$`
        : `$y = ${lead} ${icept < 0 ? "-" : "+"} ${Math.abs(icept)}$`;
    };
    const scaleText = enlarge ? `${m.k}` : `\\frac{1}{${m.k}}`;
    return choiceSurface(r, {
      prompt: `Line $\\ell$ has the equation $${eq(m.m, m.b).slice(1, -1)}$. It is dilated by a scale factor of $${scaleText}$ centered at the origin. Which equation represents the image of $\\ell$?`,
      options: [
        { label: eq(m.m, img), correct: true },
        ...[
          {
            slope: m.m,
            icept: m.b,
            feedback:
              "A dilation centered at the origin moves a line that misses the center. Its $y$-intercept is a point of the line and is scaled.",
          },
          {
            slope: m.m * m.k,
            icept: img,
            feedback:
              "A dilation keeps the slope of a line: the image of a line is parallel to the line.",
          },
          {
            slope: m.m,
            icept: enlarge ? m.b + m.k : m.b - m.k,
            feedback:
              "The intercept is multiplied by the scale factor; adding or subtracting it does not model a dilation.",
          },
          {
            slope: m.m,
            icept: enlarge ? m.b * m.k * m.k : m.b / (m.k * m.k),
            feedback:
              "Distances from the center are multiplied by the scale factor once, not squared.",
          },
          {
            slope: m.m,
            icept: enlarge ? m.b / m.k : m.b * m.k,
            feedback: `A scale factor ${enlarge ? "greater than 1 moves points farther from the center, so the intercept grows" : "less than 1 moves points closer to the center, so the intercept shrinks"}.`,
          },
        ]
          .filter((o) => Number.isInteger(o.icept) && Number.isInteger(o.slope))
          .map((o) => ({ label: eq(o.slope, o.icept), feedback: o.feedback })),
      ],
      hint: `The point $(0,\\ ${m.b})$ lies on $\\ell$. Multiply its distance from the origin by the scale factor $${scaleText}$ to find where the image crosses the $y$-axis, and decide what happens to the slope $${m.m}$.`,
      explanation: [
        `The $y$-intercept point $(0,\\ ${m.b})$ moves to $(0,\\ ${img})$, because every distance from the origin is multiplied by $${scaleText}$.`,
        `A dilation maps a line to a parallel line, so the slope stays $${m.m}$.`,
        `The image is ${eq(m.m, img)}.`,
      ],
    });
  },
});

export const regentsGeometryCoordinateTemplates = [
  segmentPartitionPointTemplate,
  circleGeneralFormTemplate,
  perpendicularPointSlopeTemplate,
  linePairRelationshipTemplate,
  dilationLineImageTemplate,
];
export const regentsGeometryCoordinateGenerate = dispatch(
  regentsGeometryCoordinateTemplates,
  {
    "geo-segment-partition-point": (s) =>
      segmentPartitionPoint.generate(s).problem,
    "geo-circle-general-form": (s) => circleGeneralForm.generate(s).problem,
    "geo-line-point-slope-choice": (s) => linePointSlope.generate(s).problem,
    "geo-line-pair-relationship": (s) =>
      linePairRelationship.generate(s).problem,
    "geo-dilation-line-image": (s) => dilationLineImage.generate(s).problem,
  },
);
