import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { shuffle } from "./distribution-practice";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { formula } from "./polish";
import { graph } from "./scene/author";
import {
  gcd,
  n,
  rat,
  ratEq,
  qt,
  type Rational,
  termText,
  twoTerm,
} from "./algebra-one-kit";

export const interceptPointTemplate: TemplateMetadata = {
  id: "intercept-point-choice",
  version: 1,
  title: "Intercepts as points",
  skillId: "graph-solution-sets",
  gradeBand: "9–12",
  difficultyOffset: -0.1,
  requiredResponseCapability: "single-choice-v1",
  requiredFigureCapability: "scenes-v1",
  description:
    "From a graphed line or a rule (standard form or slope-intercept form, with fractional coefficients), choose the intercept on either axis as an ordered pair, the zero of the function, or the sum of the two nonzero intercept coordinates.",
};

/** Where the line is given and what the item asks for. */
const axes = {
  source: defineAxis("source", ["graph", "rule"] as const),
  ask: defineAxis("ask", [
    "y-intercept-point",
    "x-intercept-point",
    "zero-value",
    "intercept-sum",
  ] as const),
};
type Ask =
  "y-intercept-point" | "x-intercept-point" | "zero-value" | "intercept-sum";
type Form = "graph" | "standard" | "slope-intercept";

/** The line a x + b y = c with both intercepts off the origin. */
interface Model {
  form: Form;
  ask: Ask;
  a: number;
  b: number;
  c: number;
  /** x-intercept (c/a) and y-intercept (c/b). */
  xi: Rational;
  yi: Rational;
  /** Slope-intercept data: m = p/q and the constant term k. */
  p: number;
  q: number;
  k: number;
}

type R = (lo: number, hi: number) => number;
const nonzero = (r: R, lo: number, hi: number) => {
  const v = r(lo, hi - 1);
  return v >= 0 ? v + 1 : v;
};

function model(r: R, a: { source: "graph" | "rule"; ask: Ask }): Model {
  if (a.source === "graph") {
    const xi = nonzero(r, -7, 7),
      yi = nonzero(r, -7, 7);
    // The line through (xi, 0) and (0, yi): yi x + xi y = xi yi.
    return {
      form: "graph",
      ask: a.ask,
      a: yi,
      b: xi,
      c: xi * yi,
      xi: rat(xi),
      yi: rat(yi),
      p: 0,
      q: 1,
      k: 0,
    };
  }
  if (r(0, 1)) {
    const A = nonzero(r, -6, 6),
      B = nonzero(r, -6, 6),
      C = nonzero(r, -24, 24);
    const xi = rat(C, A),
      yi = rat(C, B);
    if (Math.abs(xi.n) > 14 || Math.abs(yi.n) > 14)
      throw new Error("Need three retries");
    // Keep the standard form in lowest terms with a positive x coefficient.
    const g = gcd(gcd(A, B), Math.abs(C));
    const s = A < 0 ? -1 : 1;
    return {
      form: "standard",
      ask: a.ask,
      a: (s * A) / g,
      b: (s * B) / g,
      c: (s * C) / g,
      xi,
      yi,
      p: 0,
      q: 1,
      k: 0,
    };
  }
  const q = pick(r, [2, 3, 4, 5]);
  const p = nonzero(r, -7, 7);
  if (gcd(p, q) !== 1) throw new Error("Need three retries");
  const k = nonzero(r, -9, 9);
  // y = (p/q) x + k  ->  -p x + q y = q k
  return {
    form: "slope-intercept",
    ask: a.ask,
    a: -p,
    b: q,
    c: q * k,
    xi: rat(-q * k, p),
    yi: rat(k),
    p,
    q,
    k,
  };
}

const pt = (x: Rational, y: Rational) => `(${qt(x)}, ${qt(y)})`;
const zero = rat(0);
/** A signed slope p/q as TeX: −\\tfrac{7}{2}. */
const sp = (p: number, q: number) =>
  p < 0 ? `\\left(${sf(p, q)}\\right)` : sf(p, q);
const sf = (p: number, q: number) =>
  `${p < 0 ? "−" : ""}\\tfrac{${Math.abs(p)}}{${q}}`;
const num = (v: Rational) => qt(v);

const rule = (m: Model) =>
  m.form === "slope-intercept"
    ? `y = ${m.p < 0 ? "−" : ""}${Math.abs(m.p)}/${m.q}x${m.k < 0 ? " − " : " + "}${Math.abs(m.k)}`
    : `${twoTerm(m.a, m.b)} = ${n(m.c)}`;
const fnRule = (m: Model) =>
  `f(x) = ${m.p < 0 ? "−" : ""}${Math.abs(m.p)}/${m.q}x${m.k < 0 ? " − " : " + "}${Math.abs(m.k)}`;
/** The quotient c ÷ a written with its reduction: 12/5, 6/3 = 2. */
const quo = (top: number, bottom: number) => {
  const v = rat(top, bottom);
  const written = `${n(top)}/${bottom < 0 ? `(${n(bottom)})` : bottom}`;
  return v.d === 1 && Math.abs(bottom) === 1
    ? n(v.n)
    : v.n === top && v.d === bottom
      ? written
      : `${written} = ${qt(v)}`;
};

function scene(m: Model) {
  const xi = m.xi.n,
    yi = m.yi.n;
  return graph({
    id: "g",
    x: [-8, 8],
    y: [-8, 8],
    grid: 1,
    tick: 2,
    axisNames: ["x", "y"],
  })
    .line({
      through: [
        [xi, 0],
        [0, yi],
      ],
    })
    .scene({ title: "A line on a coordinate grid" });
}

function surface(m: Model, r: R) {
  const graphed = m.form === "graph";
  const eq = graphed ? "" : formula(rule(m));
  const fn = m.form === "slope-intercept" ? formula(fnRule(m)) : "";
  const slopeWord = graphed
    ? m.xi.n * m.yi.n < 0
      ? "rises from left to right"
      : "falls from left to right"
    : "";
  // Only the direction of the line is stated, never a coordinate.
  const sides = graphed ? `The line ${slopeWord}.` : "";

  const wrongPoints = (
    candidates: [Rational, Rational, string][],
    right: string,
  ) =>
    shuffle(
      r,
      candidates.map(([x, y, feedback]) => ({
        label: pt(x, y),
        feedback,
      })),
    ).filter((o) => o.label !== right);
  const neg = (v: Rational) => rat(-v.n, v.d);

  const xiW = num(m.xi),
    yiW = num(m.yi);
  const xPoint = pt(m.xi, zero),
    yPoint = pt(zero, m.yi);

  if (m.ask === "y-intercept-point") {
    const options = [
      { label: yPoint, correct: true as const },
      ...wrongPoints(
        [
          [
            m.yi,
            zero,
            `${pt(m.yi, zero)} has the coordinates in the wrong order. An ordered pair lists $x$ first, and a point on the $y$-axis has $x = 0$.`,
          ],
          [
            m.xi,
            zero,
            `${xPoint} is the $x$-intercept, where the line crosses the $x$-axis. The $y$-intercept is where $x = 0$.`,
          ],
          [
            zero,
            neg(m.yi),
            `${pt(zero, neg(m.yi))} has the right form but the wrong sign. Check the sign of $y$ where the line meets the $y$-axis.`,
          ],
          [
            zero,
            m.xi,
            `${pt(zero, m.xi)} puts the $x$-intercept value on the $y$-axis. The $y$-value is found by setting $x = 0$, not $y = 0$.`,
          ],
          ...(m.form === "slope-intercept"
            ? ([
                [
                  zero,
                  rat(m.p, m.q),
                  `${pt(zero, rat(m.p, m.q))} uses the slope as the intercept. In $y = mx + b$ the constant $b$ is the $y$-intercept, and $m$ is the slope.`,
                ],
              ] as [Rational, Rational, string][])
            : []),
        ].filter(
          ([x, y]) =>
            !(ratEq(x as Rational, zero) && ratEq(y as Rational, m.yi)),
        ) as [Rational, Rational, string][],
        yPoint,
      ),
    ];
    const steps = graphed
      ? [
          `The $y$-intercept is the point where the line meets the $y$-axis, so its $x$-coordinate is 0.`,
          `Reading the graph, the line crosses the $y$-axis at $y = ${n(m.yi.n)}$.`,
          `Write $x$ first: ${yPoint}.`,
        ]
      : m.form === "slope-intercept"
        ? [
            `On the $y$-axis $x = 0$. Substitute $x = 0$ into ${eq}: $y = ${n(m.k)}$.`,
            `Write $x$ first: ${yPoint}.`,
          ]
        : [
            `On the $y$-axis $x = 0$. Substitute $x = 0$ into ${eq}: $${termText(m.b, "y")} = ${n(m.c)}$.`,
            `$y = ${quo(m.c, m.b)}$, so the $y$-intercept is ${yPoint}.`,
          ];
    return choiceSurface(r, {
      prompt: graphed
        ? "The graph shows a line. Which ordered pair is its $y$-intercept?"
        : `A line has the equation ${eq}. Which ordered pair is its $y$-intercept?`,
      options,
      hint: graphed
        ? `${sides} The $y$-intercept lies on the vertical axis, so look for where the line meets it and read the $y$-value there.`
        : `The $y$-intercept lies on the $y$-axis, where $x = 0$. Put $x = 0$ into ${eq} and solve for $y$.`,
      explanation: steps,
      label: "Choose the point",
    });
  }

  if (m.ask === "x-intercept-point") {
    const options = [
      { label: xPoint, correct: true as const },
      ...wrongPoints(
        [
          [
            zero,
            m.xi,
            `${pt(zero, m.xi)} has the coordinates in the wrong order. An ordered pair lists $x$ first, and a point on the $x$-axis has $y = 0$.`,
          ],
          [
            zero,
            m.yi,
            `${yPoint} is the $y$-intercept, where the line crosses the $y$-axis. The $x$-intercept is where $y = 0$.`,
          ],
          [
            neg(m.xi),
            zero,
            `${pt(neg(m.xi), zero)} has the right form but the wrong sign. Check the sign of $x$ where the line meets the $x$-axis.`,
          ],
          [
            m.yi,
            zero,
            `${pt(m.yi, zero)} puts the $y$-intercept value on the $x$-axis. The $x$-value is found by setting $y = 0$, not $x = 0$.`,
          ],
          ...(m.form === "slope-intercept"
            ? ([
                [
                  rat(-m.k),
                  zero,
                  `${pt(rat(-m.k), zero)} stops at $-b$. Also divide by the slope: $0 = mx + b$ gives $x = -b \\div m$.`,
                ],
              ] as [Rational, Rational, string][])
            : []),
        ].filter(
          ([x, y]) =>
            !(ratEq(x as Rational, m.xi) && ratEq(y as Rational, zero)),
        ) as [Rational, Rational, string][],
        xPoint,
      ),
    ];
    const steps = graphed
      ? [
          `The $x$-intercept is the point where the line meets the $x$-axis, so its $y$-coordinate is 0.`,
          `Reading the graph, the line crosses the $x$-axis at $x = ${n(m.xi.n)}$.`,
          `Write $x$ first: ${xPoint}.`,
        ]
      : m.form === "slope-intercept"
        ? [
            `On the $x$-axis $y = 0$. Substitute: $0 = ${sf(m.p, m.q)}x ${m.k < 0 ? "−" : "+"} ${Math.abs(m.k)}$.`,
            `So $${sf(m.p, m.q)}x = ${n(-m.k)}$, and $x = ${n(-m.k)} \\div ${sp(m.p, m.q)} = ${qt(m.xi)}$.`,
            `Write $x$ first: ${xPoint}.`,
          ]
        : [
            `On the $x$-axis $y = 0$. Substitute $y = 0$ into ${eq}: $${termText(m.a, "x")} = ${n(m.c)}$.`,
            `$x = ${quo(m.c, m.a)}$, so the $x$-intercept is ${xPoint}.`,
          ];
    return choiceSurface(r, {
      prompt: graphed
        ? "The graph shows a line. Which ordered pair is its $x$-intercept?"
        : `A line has the equation ${eq}. Which ordered pair is its $x$-intercept?`,
      options,
      hint: graphed
        ? `${sides} The $x$-intercept lies on the horizontal axis, so look for where the line meets it and read the $x$-value there.`
        : `The $x$-intercept lies on the $x$-axis, where $y = 0$. Put $y = 0$ into ${eq} and solve for $x$.`,
      explanation: steps,
      label: "Choose the point",
    });
  }

  if (m.ask === "zero-value") {
    const v = m.xi;
    const wrong: [Rational, string][] = [
      [
        m.yi,
        `${yiW} is the $y$-intercept, the value of the function at $x = 0$. A zero is an input that makes the output 0.`,
      ],
      [
        neg(v),
        `${num(neg(v))} has the opposite sign. Check which side of the origin the line meets the $x$-axis.`,
      ],
      [
        neg(m.yi),
        `${num(neg(m.yi))} is not an input that makes the output 0. A zero is where the graph meets the $x$-axis.`,
      ],
      ...(m.form === "slope-intercept"
        ? ([
            [
              rat(-m.k),
              `${num(rat(-m.k))} is only $-b$. Divide by the slope as well: $0 = mx + b$ gives $x = -b \\div m$.`,
            ],
          ] as [Rational, string][])
        : m.form === "standard"
          ? ([
              [
                rat(m.c),
                `${n(m.c)} is the constant on the right of the equation, not the value of $x$ when $y = 0$.`,
              ],
            ] as [Rational, string][])
          : []),
    ].filter(([w]) => !ratEq(w as Rational, v)) as [Rational, string][];
    const options = [
      { label: num(v), correct: true as const },
      ...shuffle(
        r,
        wrong.map(([w, feedback]) => ({ label: num(w), feedback })),
      ),
    ];
    const steps = graphed
      ? [
          `A zero of $f$ is an input $x$ with $f(x) = 0$, which is a point on the $x$-axis.`,
          `The graph meets the $x$-axis at $x = ${n(v.n)}$, so the zero is ${num(v)}.`,
        ]
      : m.form === "slope-intercept"
        ? [
            `A zero of $f$ is an input $x$ with $f(x) = 0$. Solve $0 = ${sf(m.p, m.q)}x ${m.k < 0 ? "−" : "+"} ${Math.abs(m.k)}$.`,
            `$${sf(m.p, m.q)}x = ${n(-m.k)}$, so $x = ${n(-m.k)} \\div ${sp(m.p, m.q)} = ${num(v)}$.`,
          ]
        : [
            `A zero of $f$ is an input $x$ with $f(x) = 0$, so set $y = 0$ in ${eq}: $${termText(m.a, "x")} = ${n(m.c)}$.`,
            `$x = ${quo(m.c, m.a)}$, so the zero is ${num(v)}.`,
          ];
    return choiceSurface(r, {
      prompt: graphed
        ? "The graph shows a linear function $f$. For which value of $x$ is $f(x) = 0$?"
        : m.form === "slope-intercept"
          ? `The function $f$ is given by ${fn}. For which value of $x$ is $f(x) = 0$?`
          : `The line ${eq} is the graph of a linear function $f$. What is the zero of $f$?`,
      options,
      hint: graphed
        ? `${sides} A zero is an input where the output is 0, so find where the line meets the horizontal axis.`
        : m.form === "slope-intercept"
          ? `Set $f(x) = 0$ in ${fn} and solve for $x$: move ${n(m.k)} to the other side, then divide by the slope.`
          : `The output is 0 where $y = 0$. Put $y = 0$ into ${eq} and solve for $x$.`,
      explanation: steps,
      label: "Choose the zero",
    });
  }

  // intercept-sum
  const sum = rat(m.xi.n * m.yi.d + m.yi.n * m.xi.d, m.xi.d * m.yi.d);
  const diff = rat(m.xi.n * m.yi.d - m.yi.n * m.xi.d, m.xi.d * m.yi.d);
  const wrongSums: [Rational, string][] = [
    [
      diff,
      `${num(diff)} subtracts the coordinates. The question asks for their sum, keeping each sign.`,
    ],
    [
      neg(sum),
      `${num(neg(sum))} has the opposite sign. Add the coordinates with their own signs: ${xiW} and ${yiW}.`,
    ],
    [
      m.xi,
      `${xiW} is only the $x$-intercept coordinate. The sum needs the $y$-intercept coordinate as well.`,
    ],
    [
      m.yi,
      `${yiW} is only the $y$-intercept coordinate. The sum needs the $x$-intercept coordinate as well.`,
    ],
    [
      rat(
        Math.abs(m.xi.n) * m.yi.d + Math.abs(m.yi.n) * m.xi.d,
        m.xi.d * m.yi.d,
      ),
      "Adding the sizes of the coordinates ignores their signs. A negative coordinate lowers the sum.",
    ],
  ].filter(([w]) => !ratEq(w as Rational, sum)) as [Rational, string][];
  const options = [
    { label: num(sum), correct: true as const },
    ...shuffle(
      r,
      wrongSums.map(([w, feedback]) => ({ label: num(w), feedback })),
    ),
  ];
  const lead = graphed
    ? [
        `Reading the graph: the line crosses the $x$-axis at ${xPoint} and the $y$-axis at ${yPoint}.`,
      ]
    : m.form === "slope-intercept"
      ? [
          `Set $x = 0$: $y = ${n(m.k)}$, so the $y$-intercept is ${yPoint}.`,
          `Set $y = 0$: $x = ${n(-m.k)} \\div ${sp(m.p, m.q)} = ${num(m.xi)}$, so the $x$-intercept is ${xPoint}.`,
        ]
      : [
          `Set $x = 0$: $${termText(m.b, "y")} = ${n(m.c)}$, so $y = ${quo(m.c, m.b)}$ and the $y$-intercept is ${yPoint}.`,
          `Set $y = 0$: $${termText(m.a, "x")} = ${n(m.c)}$, so $x = ${quo(m.c, m.a)}$ and the $x$-intercept is ${xPoint}.`,
        ];
  return choiceSurface(r, {
    prompt: graphed
      ? "The graph shows a line that crosses the $x$-axis at point $P$ and the $y$-axis at point $Q$. What is the sum of the nonzero coordinate of $P$ and the nonzero coordinate of $Q$?"
      : `A line has the equation ${m.form === "slope-intercept" ? formula(rule(m)) : eq}. It crosses the $x$-axis at point $P$ and the $y$-axis at point $Q$. What is the sum of the nonzero coordinate of $P$ and the nonzero coordinate of $Q$?`,
    options,
    hint: graphed
      ? `${sides} Find the one nonzero coordinate of each crossing point, then add them with their signs.`
      : `Find each crossing point of ${eq || formula(rule(m))}: set $y = 0$ for $P$ and $x = 0$ for $Q$. Each has one coordinate that is not 0.`,
    explanation: [
      ...lead,
      `The nonzero coordinates are ${xiW} and ${yiW}.`,
      `Their sum is ${xiW} + ${m.yi.n < 0 ? `(${yiW})` : yiW} = ${num(sum)}.`,
    ],
    label: "Choose the sum",
  });
}

export const interceptPointFamily = chainFamily({
  template: interceptPointTemplate,
  axes,
  model,
  variant: (m) => `${m.form}-${m.ask}`,
  render: (m, _axes, r) => {
    const s = surface(m, r);
    if (!s) return null;
    return m.form === "graph"
      ? { ...s, figure: { kind: "scene" as const, scene: scene(m) } }
      : s;
  },
});

export const interceptPointTemplates = [interceptPointTemplate] as const;
export const interceptPointGenerate = dispatch(interceptPointTemplates, {
  "intercept-point-choice": (seed) =>
    interceptPointFamily.generate(seed).problem,
});
