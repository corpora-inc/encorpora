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
          "This is the midpoint, the point halfway along, which splits the segment 1:1. The ratio here has unequal parts, so $P$ is not in the middle.",
      },
      {
        label: label(m.x1 + (m.a * dx) / m.b, m.y1 + (m.a * dy) / m.b),
        ok: whole((m.a * dx) / m.b) && whole((m.a * dy) / m.b),
        feedback: `This uses the fraction $\\frac{${m.a}}{${m.b}}$, one part of the ratio over the other. The ratio ${m.a}:${m.b} makes ${tot} equal parts in all, so $P$ is $\\frac{${m.a}}{${tot}}$ of the way, not $\\frac{${m.a}}{${m.b}}$.`,
      },
      {
        label: label(py, px),
        ok: true,
        feedback:
          "The coordinates are swapped. A point is written $(x,\\ y)$: the across value first, then the up-and-down value.",
      },
      {
        label: label(px, m.y1 + dy / 2),
        ok: whole(dy / 2),
        feedback:
          "This uses the right fraction for $x$ but stops halfway for $y$. Both coordinates move the same fraction of the way along the segment.",
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
          feedback: `This point is ${m.b} of the ${tot} equal parts from $A$, so it splits the segment ${m.b}:${m.a}, the ratio reversed. Count the parts from $A$: $AP$ gets ${m.a} of them.`,
        },
        ...extra,
      ],
      hint: first
        ? `Add the two numbers of the ratio ${m.a}:${m.b} to count ${tot} equal parts in all. $P$ is ${m.a} of them from $A(${m.x1},\\ ${m.y1})$; find the horizontal and vertical change from $A$ to $B$ first.`
        : `Add the two numbers of $BP:PA=${m.b}:${m.a}$ to count ${tot} equal parts in all, with ${m.b} of them between $B$ and $P$. Work out how far $P$ is from $A$ along the segment from $A(${m.x1},\\ ${m.y1})$ to $B$.`,
      explanation: [
        first
          ? `The ratio $AP:PB=${m.a}:${m.b}$ means: cut the segment into ${m.a}+${m.b}=${tot} equal parts. $AP$ takes ${m.a} of them and $PB$ takes ${m.b}.`
          : `The ratio $BP:PA=${m.b}:${m.a}$ means: cut the segment into ${m.b}+${m.a}=${tot} equal parts. $BP$ takes ${m.b} of them, so $AP$ takes the other ${m.a}.`,
        `So $P$ is $\\frac{${m.a}}{${tot}}$ of the way from $A$ to $B$.`,
        `Find how far you travel from $A$ to $B$. Across: $${m.x2}-${sgn(m.x1) ? `(${m.x1})` : m.x1}=${dx}$. Up or down: $${m.y2}-${sgn(m.y1) ? `(${m.y1})` : m.y1}=${dy}$.`,
        `Start at $A$ and go $\\frac{${m.a}}{${tot}}$ of each change, because $P$ is that fraction of the way along.`,
        `$x=${m.x1}+\\frac{${m.a}}{${tot}}(${dx})=${px}$ and $y=${m.y1}+\\frac{${m.a}}{${tot}}(${dy})=${py}$.`,
        `The coordinates of $P$ are $(${px},\\ ${py})$.`,
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
        feedback: `The signs are flipped. $(x-h)^2$ expands to $x^2-2hx+h^2$, so a term $-2hx$ means the center's $x$-coordinate is $+h$. Each center coordinate has the opposite sign of its linear term.`,
      },
      {
        label: lab(m.h, m.k, sq),
        feedback: `${sq} is the radius squared, $r^2$, the number on the right of $(x-h)^2+(y-k)^2=r^2$. Take its square root to get the radius.`,
      },
      {
        label:
          m.c === 1
            ? lab(2 * m.h, 2 * m.k, m.rad)
            : lab(m.c * m.h, m.c * m.k, m.rad),
        feedback:
          m.c === 1
            ? "This uses the whole coefficient (the number in front of $x$ or $y$). Completing the square halves it: $x^2-2hx$ comes from $(x-h)^2$, so take half, with the opposite sign."
            : "The equation was not divided by the common factor first. Every term must be divided so $x^2$ and $y^2$ have coefficient 1; otherwise the center comes out multiplied by that factor.",
      },
      {
        label: lab(m.h, m.k, Math.round(Math.sqrt(Math.abs(F)))),
        feedback:
          "This treats the constant term as $-r^2$. Completing the square adds $h^2$ and $k^2$ to both sides, and they change the right side too.",
      },
    ];
    return choiceSurface(r, {
      prompt: `A circle has the equation $${left(m.c)}$. What are its center and radius?`,
      options,
      hint: `${m.c === 1 ? "" : `Divide every term by ${m.c} first, so $x^2$ and $y^2$ stand alone. `}The linear terms, the ones with just $x$ or just $y$, are ${m.c * D === 0 ? "" : `$${m.c * D}x$`}${m.c * D !== 0 && m.c * E !== 0 ? " and " : ""}${m.c * E === 0 ? "" : `$${m.c * E}y$`}. ${m.c * F === 0 ? "" : `The constant term is $${m.c * F}$. `}Group the $x$ terms and the $y$ terms. Halve each linear coefficient, the number in front, square each half, and add those squares to both sides.`,
      explanation: [
        ...(m.c === 1
          ? []
          : [
              `Divide every term by ${m.c}: $x^2+y^2${term(D, "x")}${term(E, "y")}${F === 0 ? "" : ` ${F < 0 ? "-" : "+"} ${Math.abs(F)}`}=0$.`,
            ]),
        `The goal is center-radius form, $(x-h)^2+(y-k)^2=r^2$. In it, $(h,\\ k)$ is the center and $r$ is the radius, the distance from the center to the circle.`,
        `Completing the square turns $x^2-2hx$ into a perfect square by adding $h^2$: half the $x$-coefficient, squared. Do the same for $y$.`,
        `Here that adds ${m.h * m.h} and ${m.k * m.k}. Add them to both sides so the equation stays balanced, and move the constant to the right: $(x^2${term(D, "x")} + ${m.h * m.h}) + (y^2${term(E, "y")} + ${m.k * m.k}) = ${-F} + ${m.h * m.h} + ${m.k * m.k}$.`,
        `Write each group as a square: $(${m.h === 0 ? "x" : `x${m.h > 0 ? " - " : " + "}${Math.abs(m.h)}`})^2 + (${m.k === 0 ? "y" : `y${m.k > 0 ? " - " : " + "}${Math.abs(m.k)}`})^2 = ${sq}$.`,
        `Read the center with the opposite signs of the numbers inside the squares: $(${m.h},\\ ${m.k})$. The right side is $r^2$, so $r=\\sqrt{${sq}}=${m.rad}$.`,
        `The circle's center is $(${m.h},\\ ${m.k})$ and its radius is ${m.rad}.`,
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
  model: (r: R, a) => {
    for (;;) {
      const dx = r(2, 5) * (r(0, 1) ? 1 : -1);
      const dy = r(1, 6) * (r(0, 1) ? 1 : -1);
      if (Math.abs(dx) === Math.abs(dy)) continue;
      const px = r(-6, 6);
      const py = r(-6, 6);
      const qx = r(-6, 6);
      const qy = r(-6, 6);
      // The correct line has slope sn/sd through (qx, qy). Two options must never
      // describe that same line: the sign-reversed point lies on it when the line
      // passes through the origin, and the given line's point lies on it when
      // (qx, qy) is on a parallel/perpendicular line through that point.
      const [sn, sd] = a.relation === "perpendicular" ? [-dx, dy] : [dy, dx];
      if (qy * sd === sn * qx) continue;
      if ((qy - py) * sd === sn * (qx - px)) continue;
      return { px, py, dx, dy, qx, qy };
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
            ? "This keeps the given line's slope, which makes a parallel line. A perpendicular line needs the opposite reciprocal: flip the fraction and change the sign."
            : "This changes the sign of the slope. Parallel lines point the same way, so they have exactly the same slope.",
        },
        {
          label: mk(den, num, m.qx, m.qy),
          feedback: perp
            ? "This flips the fraction but keeps the sign. A perpendicular slope is the opposite reciprocal: flip the fraction and change the sign."
            : "This flips the fraction. Parallel lines have exactly the same slope, so keep the fraction as it is.",
        },
        {
          label: mk(sn, sd, -m.qx, -m.qy),
          feedback:
            "This has the point's signs reversed. In $y-y_1=m(x-x_1)$ the point's coordinates are subtracted, so $x_1=3$ shows as $x-3$ and $x_1=-3$ shows as $x+3$.",
        },
        {
          label: mk(sn, sd, m.px, m.py),
          feedback: `This uses a point of the given line. The new line must pass through $(${m.qx},\\ ${m.qy})$, so that is the point to put in $y-y_1=m(x-x_1)$.`,
        },
      ],
      hint: `Find the slope, the steepness, of the line through $(${m.px},\\ ${m.py})$ and $(${x2},\\ ${y2})$ as rise over run: change in $y$ ÷ change in $x$. Then decide what slope a ${a.relation} line needs.`,
      explanation: [
        `The slope of a line is its steepness: rise over run, the change in $y$ divided by the change in $x$.`,
        `The given line's slope is $\\frac{${y2}-${m.py < 0 ? `(${m.py})` : m.py}}{${x2}-${m.px < 0 ? `(${m.px})` : m.px}}=${slopeTex(num, den)}$.`,
        perp
          ? `Perpendicular lines meet at a right angle. Their slopes are opposite reciprocals: flip the fraction and change the sign. So the new slope is $${slopeTex(sn, sd)}$.`
          : `Parallel lines never meet, so they rise at the same rate. The new slope is the same, $${slopeTex(sn, sd)}$.`,
        `Point-slope form, $y-y_1=m(x-x_1)$, writes a line from its slope $m$ and one point $(x_1,\\ y_1)$ on it.`,
        `Put in $m=${slopeTex(sn, sd)}$ and the point $(${m.qx},\\ ${m.qy})$. Subtracting a negative coordinate shows as a plus sign.`,
        `The equation of the ${a.relation} line is ${mk(sn, sd, m.qx, m.qy)}.`,
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
      parallel: `The slopes $${t1}$ and $${t2}$ are equal, so the lines rise at the same rate. Their $y$-intercepts differ, so they never meet.`,
      same: `The slopes are equal and so are the $y$-intercepts: the second equation is the first one multiplied through. Every point of one line is on the other.`,
      perpendicular: `The slopes $${t1}$ and $${t2}$ multiply to $-1$. Slopes that are opposite reciprocals (flipped, with the sign changed) make a right angle.`,
      neither: `The slopes $${t1}$ and $${t2}$ are not equal, so the lines are not parallel. They are not opposite reciprocals either: their product is not $-1$.`,
    } as const;
    const keys = ["parallel", "perpendicular", "same", "neither"] as const;
    const feedbackFor = (kind: (typeof keys)[number]) => {
      if (kind === "same" && a.kind === "parallel")
        return "The slopes are equal, but the $y$-intercepts, where each line crosses the $y$-axis, differ. So these are two different lines that never meet.";
      if (kind === "parallel" && a.kind === "same")
        return "The slopes are equal, but so are the $y$-intercepts. Dividing the second equation through gives the first, so the lines lie on top of each other.";
      if (kind === "parallel")
        return `Parallel lines have equal slopes, but the slopes here are $${t1}$ and $${t2}$. Solve the second equation for $y$ to read its slope.`;
      if (kind === "perpendicular")
        return `Perpendicular lines have opposite reciprocal slopes, which multiply to $-1$. Here $${t1}$ and $${t2}$ do not multiply to $-1$.`;
      if (kind === "same")
        return `The same line needs equal slopes and equal $y$-intercepts. The slopes here are $${t1}$ and $${t2}$, which differ.`;
      return `Compare the slopes $${t1}$ and $${t2}$ carefully. Equal slopes or slopes that multiply to $-1$ mean the lines are related, so "neither" does not fit.`;
    };
    return choiceSurface(r, {
      prompt: `Line $\\ell$ has the equation $${eq1}$ and line $m$ has the equation $${eq2}$. Which statement describes lines $\\ell$ and $m$?`,
      options: keys.map((kind) => ({
        label: labels[kind],
        ...(kind === a.kind
          ? { correct: true as const }
          : { feedback: feedbackFor(kind) }),
      })),
      hint: `Rewrite $${eq2}$ as $y=mx+b$ by getting $y$ alone, so you can read its slope $m$. Then compare that slope with the slope in $${eq1}$.`,
      explanation: [
        `In $y=mx+b$, the number $m$ multiplying $x$ is the slope, the steepness. The number $b$ is the $y$-intercept, where the line crosses the $y$-axis.`,
        `For $\\ell$, the slope is $${t1}$ and the $y$-intercept is $${m.b}$.`,
        `Get $y$ alone in $${eq2}$: move the $x$ term to the other side, then divide by the number multiplying $y$. The slope of $m$ is $${t2}$.`,
        why[a.kind],
        `Lines $\\ell$ and $m$ are ${labels[a.kind]}.`,
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
              "This leaves the line unchanged. A dilation moves every point except its center, so a line that misses the origin moves. Its $y$-intercept point is scaled too.",
          },
          {
            slope: m.m * m.k,
            icept: img,
            feedback:
              "This multiplies the slope by the scale factor. A dilation changes size, not direction, so the image line is parallel and keeps the same slope.",
          },
          {
            slope: m.m,
            icept: enlarge ? m.b + m.k : m.b - m.k,
            feedback:
              "This adds or subtracts the scale factor. A dilation multiplies every distance from the center by the scale factor, so multiply the intercept.",
          },
          {
            slope: m.m,
            icept: enlarge ? m.b * m.k * m.k : m.b / (m.k * m.k),
            feedback:
              "This multiplies by the scale factor twice, as if squaring it. Distances from the center are multiplied by the scale factor just once.",
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
      hint: `The point $(0,\\ ${m.b})$ lies on $\\ell$. A dilation multiplies its distance from the origin by the scale factor $${scaleText}$. Find where that point lands.`,
      explanation: [
        `A dilation resizes a figure from a fixed point, the center. Every point moves along a line from the center, and its distance from the center is multiplied by the scale factor.`,
        `The line crosses the $y$-axis at $(0,\\ ${m.b})$, its $y$-intercept. Multiply its distance from the origin by $${scaleText}$: it moves to $(0,\\ ${img})$.`,
        `A dilation changes sizes but not directions, so the image of a line is parallel to it. The slope, the steepness, stays $${m.m}$.`,
        `A line with slope $${m.m}$ through $(0,\\ ${img})$ has $y$-intercept ${img}.`,
        `The image of $\\ell$ is ${eq(m.m, img)}.`,
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
