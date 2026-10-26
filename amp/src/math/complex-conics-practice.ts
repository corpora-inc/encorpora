import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { assemble, random, type Random } from "./distribution-practice";
import { graph } from "./scene/author";
import type { Scene } from "./scene/spec";

/**
 * Complex plane, polar coordinates, parametric motion and conics. Each template
 * is a deliberately varied single-choice family; the case model is private and
 * only the prompt and shuffled labels reach the learner.
 */
const meta = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
  figure = false,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  requiredResponseCapability: "single-choice-v1",
  ...(figure ? { requiredFigureCapability: "scenes-v1" as const } : {}),
  description,
});

export const complexConicsTemplates: readonly TemplateMetadata[] = [
  meta(
    "complex-plane-forms",
    "Complex plane, modulus and polar form",
    "complex-plane",
    0.5,
    "Read a point as $a+bi$, find a modulus, add as vectors, and convert between $a+bi$ and $r(\\cos\\theta+i\\sin\\theta)$ for special angles.",
    true,
  ),
  meta(
    "complex-conjugate-division",
    "Conjugates and complex division",
    "complex-conjugates",
    0.6,
    "Use the conjugate: write $z\\bar{z}=|z|^2$, find conjugates, and divide complex numbers into exact standard form.",
  ),
  meta(
    "complex-distance-midpoint",
    "Distance and midpoint of complex numbers",
    "complex-distance",
    0.45,
    "Find |z − w|, the midpoint (z + w)/2, a missing endpoint, and the circle |z − w| = r.",
  ),
  meta(
    "complex-quadratic-factors",
    "Factor and solve over the complex numbers",
    "complex-factorization",
    0.55,
    "Factor $x^2+k^2$ as $(x+ki)(x-ki)$, solve quadratics with negative discriminant in $a\\pm bi$ form, and rebuild a quadratic from conjugate roots.",
  ),
  meta(
    "polynomial-root-count",
    "Count the roots of a polynomial",
    "fundamental-theorem-algebra",
    0.7,
    "Count complex roots with multiplicity from degree, and use conjugate pairs to bound or locate nonreal roots of real polynomials.",
  ),
  meta(
    "polar-cartesian-conversion",
    "Polar and Cartesian coordinates",
    "polar-coordinates",
    0.5,
    "Convert between polar and Cartesian coordinates at special angles, including negative $r$, and recognize equivalent polar names.",
  ),
  meta(
    "parametric-linear-motion",
    "Linear parametric motion",
    "parametric-models",
    0.55,
    "Evaluate position from $x(t)$, $y(t)$, eliminate the parameter, find speed and timing, and read direction from signs.",
  ),
  meta(
    "conic-standard-form",
    "Conic sections from equations",
    "conic-sections",
    0.6,
    "Identify circles, ellipses, parabolas and hyperbolas from equations, read centers and vertices, and complete squares in general form.",
  ),
  meta(
    "parabola-focus-directrix",
    "Parabolas from focus and directrix",
    "parabola-locus",
    0.6,
    "Use the vertex as the midpoint of focus and directrix, the distance $p$, and $(x - h)^2 = 4p(y - k)$ in both directions.",
  ),
];
const byId = new Map(complexConicsTemplates.map((t) => [t.id, t]));

// ---------------------------------------------------------------- formatting
type Term = { neg: boolean; body: string };
const T = (neg: boolean, body: string): Term => ({ neg, body });
const isZero = (t: Term) => t.body === "0";
const tInt = (n: number): Term => T(n < 0, String(Math.abs(n)));
const signed = (t: Term) => (t.neg && !isZero(t) ? "-" : "") + t.body;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** Reduced fraction n/d as a term (d may be negative). */
function tFrac(n: number, d: number): Term {
  const g = gcd(n, d) || 1;
  let [a, b] = [n / g, d / g];
  if (b < 0) [a, b] = [-a, -b];
  return T(
    a < 0,
    b === 1 ? String(Math.abs(a)) : `\\frac{${Math.abs(a)}}{${b}}`,
  );
}
/** m·√rad (rad = 1 means a plain integer). */
function tRad(m: number, rad: number): Term {
  if (m === 0) return T(false, "0");
  const a = Math.abs(m);
  const body =
    rad === 1 ? String(a) : a === 1 ? `\\sqrt{${rad}}` : `${a}\\sqrt{${rad}}`;
  return T(m < 0, body);
}
function simplifyRoot(n: number) {
  let k = 1;
  let m = n;
  for (let f = 2; f * f <= m; f++)
    while (m % (f * f) === 0) {
      m /= f * f;
      k *= f;
    }
  return { k, m };
}
/** Positive √n in simplest radical form, as a term. */
function sqrtTerm(n: number): Term {
  const { k, m } = simplifyRoot(n);
  return tRad(k, m);
}
const sqrtTex = (n: number) => signed(sqrtTerm(n));
/** a + bi from real and imaginary terms (b's magnitude is the coefficient of i). */
function cx(re: Term, im: Term): string {
  const imag = (t: Term) => (t.body === "1" ? "i" : `${t.body}i`);
  if (isZero(im)) return signed(re);
  if (isZero(re)) return (im.neg ? "-" : "") + imag(im);
  return `${signed(re)} ${im.neg ? "-" : "+"} ${imag(im)}`;
}
const cxInt = (a: number, b: number) => cx(tInt(a), tInt(b));
const pt = (x: Term | number, y: Term | number) =>
  `(${signed(typeof x === "number" ? tInt(x) : x)}, ${signed(typeof y === "number" ? tInt(y) : y)})`;
const M = (s: string) => `$${s}$`;
const shift = (v: string, h: number) =>
  h === 0 ? v : `${v}${h > 0 ? "-" : "+"}${Math.abs(h)}`;
const sq = (v: string, h: number) =>
  h === 0 ? `${v}^2` : `(${shift(v, h)})^2`;
/** c0 + c1·v, constant first: "2+3t", "-1-t", "3t". */
function constFirst(c0: number, c1: number, v: string) {
  const lin = `${Math.abs(c1) === 1 ? "" : Math.abs(c1)}${v}`;
  if (c0 === 0) return `${c1 < 0 ? "-" : ""}${lin}`;
  return `${c0}${c1 < 0 ? "-" : "+"}${lin}`;
}
/** x^2 + bx + c as TeX. */
function monic(b: number, c: number) {
  return `x^2${b === 0 ? "" : `${b < 0 ? "-" : "+"}${Math.abs(b) === 1 ? "" : Math.abs(b)}x`}${c === 0 ? "" : `${c < 0 ? "-" : "+"}${Math.abs(c)}`}`;
}
const piTex = (deg: number) => {
  const d = deg;
  if (d === 0) return "0";
  const g = gcd(d, 180);
  const [n, m] = [d / g, 180 / g];
  if (m === 1) return n === 1 ? "\\pi" : `${n}\\pi`;
  return n === 1 ? `\\frac{\\pi}{${m}}` : `\\frac{${n}\\pi}{${m}}`;
};
const polarTex = (r: number, deg: number) =>
  `${r}(\\cos ${piTex(deg)}+i\\sin ${piTex(deg)})`;
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const nonzero = (r: Random, max: number) => r(1, max) * (r(0, 1) ? 1 : -1);
const mod360 = (d: number) => ((d % 360) + 360) % 360;

// --------------------------------------------------------------- trig values
type RR = { k: number; rad: number }; // k/2 · √rad
const REF: Record<number, [RR, RR]> = {
  0: [
    { k: 2, rad: 1 },
    { k: 0, rad: 1 },
  ],
  30: [
    { k: 1, rad: 3 },
    { k: 1, rad: 1 },
  ],
  45: [
    { k: 1, rad: 2 },
    { k: 1, rad: 2 },
  ],
  60: [
    { k: 1, rad: 1 },
    { k: 1, rad: 3 },
  ],
  90: [
    { k: 0, rad: 1 },
    { k: 2, rad: 1 },
  ],
};
function trig(deg: number) {
  const d = mod360(deg);
  const rho = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
  const [c, s] = REF[rho]!;
  const cs = d > 90 && d < 270 ? -1 : 1;
  const ss = d > 180 ? -1 : 1;
  return { c: { k: c.k * cs, rad: c.rad }, s: { k: s.k * ss, rad: s.rad } };
}
/** cos or sin value k/2·√rad as TeX. */
function trigTex({ k, rad }: RR) {
  if (k === 0) return "0";
  const s = k < 0 ? "-" : "";
  const a = Math.abs(k);
  if (rad === 1) return a === 2 ? `${s}1` : `${s}\\frac{1}{2}`;
  return `${s}\\frac{\\sqrt{${rad}}}{2}`;
}
const scaled = (r: number, t: RR) => tRad(t.k * (r / 2), t.rad);
const ANGLES = [
  0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330,
] as const;
const OBLIQUE = ANGLES.filter((a) => a % 90 !== 0);
/** r·(cos, sin) at a special angle, for even r. */
const rect = (r: number, deg: number) => {
  const t = trig(deg);
  return { x: scaled(r, t.c), y: scaled(r, t.s) };
};

// ---------------------------------------------------------------- case model
type Wrong = [label: string, feedback: string];
type Spec = {
  variant: number;
  prompt: string;
  hint: string;
  explanation: string[];
  correct: string;
  wrong: Wrong[];
  figure?: Scene;
};
export type ComplexConicsCase = {
  variant: number;
  correct: string;
  problem: GeneratedProblem;
};
function finish(
  template: TemplateMetadata,
  seed: string,
  r: Random,
  spec: Spec,
): ComplexConicsCase {
  const seen = new Set([spec.correct]);
  const wrong = spec.wrong.filter(([label]) => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
  if (wrong.length < 3)
    throw new Error(
      `Insufficient distinct choices: ${template.id} variant ${spec.variant}: ${spec.correct} | ${spec.wrong.map((w) => w[0]).join(" | ")}`,
    );
  const problem = assemble(template, seed, r, {
    prompt: spec.prompt,
    answer: "",
    hint: spec.hint,
    explanation: spec.explanation,
    ...(spec.figure
      ? { figure: { kind: "scene" as const, scene: spec.figure } }
      : {}),
    choices: [
      { label: spec.correct, correct: true },
      ...wrong.slice(0, 3).map(([label, feedback]) => ({ label, feedback })),
    ],
  });
  return { variant: spec.variant, correct: spec.correct, problem };
}

// ------------------------------------------------------------- complex plane
function planeCase(r: Random): Spec {
  const variant = r(0, 4);
  const distinct = () => {
    let a: number, b: number;
    do {
      a = nonzero(r, 6);
      b = nonzero(r, 6);
    } while (Math.abs(a) === Math.abs(b));
    return [a, b] as const;
  };
  const window = (...values: number[]) => {
    const L = Math.max(...values.map(Math.abs)) + 2;
    return graph({ x: [-L, L], y: [-L, L], tick: L > 9 ? 2 : 1 });
  };
  if (variant === 0) {
    const [a, b] = distinct();
    return {
      variant,
      prompt: `The point $P$ in the complex plane represents a complex number $z$. The horizontal axis shows real parts and the vertical axis shows imaginary parts. Write $z$ in the form $a+bi$.`,
      hint: `Read how far $P$ is across the real axis first, then how far up or down it is. The across distance is the real part.`,
      explanation: [
        `The real part is the horizontal coordinate of $P$: $${a}$.`,
        `The imaginary part is the vertical coordinate: $${b}$.`,
        `So $z=${cxInt(a, b)}$.`,
      ],
      correct: M(cxInt(a, b)),
      wrong: [
        [
          M(cxInt(b, a)),
          "The real part is the horizontal coordinate, not the vertical one.",
        ],
        [
          M(cxInt(-a, b)),
          "Check the direction of the real part: right of the vertical axis is positive, left is negative.",
        ],
        [
          M(cxInt(a, -b)),
          "Check the direction of the imaginary part: above the horizontal axis is positive, below is negative.",
        ],
        [
          M(cxInt(-a, -b)),
          "Read both signs from the side of the axes the point lies on.",
        ],
      ],
      figure: window(a, b).id("g").point(a, b, "P").scene({
        title:
          "Point P in the complex plane (real axis across, imaginary axis up)",
      }),
    };
  }
  if (variant === 1) {
    const triple = r(0, 1) === 0;
    let a: number, b: number;
    if (triple) {
      const [p, q] = pick(r, [
        [3, 4],
        [4, 3],
        [5, 12],
        [12, 5],
        [6, 8],
        [8, 6],
      ] as const);
      a = p * (r(0, 1) ? 1 : -1);
      b = q * (r(0, 1) ? 1 : -1);
    } else [a, b] = distinct();
    const n = a * a + b * b;
    return {
      variant,
      prompt: `The modulus $|z|$ of a complex number is its distance from 0 in the complex plane. Find $|${cxInt(a, b)}|$ in simplest exact form.`,
      hint: `The point for ${M(cxInt(a, b))} is ${Math.abs(a)} across and ${Math.abs(b)} up or down from 0. Use the Pythagorean theorem on that right triangle.`,
      explanation: [
        `The point is ${Math.abs(a)} units horizontally and ${Math.abs(b)} units vertically from 0.`,
        `$|z|=\\sqrt{(${a})^2+(${b})^2}=\\sqrt{${a * a}+${b * b}}=\\sqrt{${n}}$.`,
        `In simplest form $|z|=${sqrtTex(n)}$.`,
      ],
      correct: M(sqrtTex(n)),
      wrong: [
        [
          M(String(Math.abs(a) + Math.abs(b))),
          "The modulus is a straight-line distance, not the sum of the two legs. Square, add, then take the root.",
        ],
        [
          M(String(n)),
          "That is $|z|^2$. Take the square root to get the distance.",
        ],
        [
          M(sqrtTex(Math.abs(a * a - b * b))),
          "Add the squares of the two parts; do not subtract them.",
        ],
        [
          M(sqrtTex(Math.abs(a) + Math.abs(b))),
          "Square each part before adding, then take the root.",
        ],
        [
          M(String(Math.max(Math.abs(a), Math.abs(b)))),
          "The distance includes both the real and imaginary parts.",
        ],
      ],
    };
  }
  if (variant === 2) {
    let a: number, b: number, c: number, d: number;
    do {
      a = nonzero(r, 4);
      b = nonzero(r, 4);
      c = nonzero(r, 4);
      d = nonzero(r, 4);
    } while (
      a + c === 0 ||
      b + d === 0 ||
      new Set(
        [
          cxInt(a - c, b - d),
          cxInt(a + d, b + c),
          cxInt(a * c, b * d),
          cxInt(a + c, 0),
          cxInt(b + d, a + c),
        ].filter((label) => label !== cxInt(a + c, b + d)),
      ).size < 3
    );
    return {
      variant,
      prompt: `The points $P$ and $Q$ represent the complex numbers $z$ and $w$. The horizontal axis shows real parts and the vertical axis shows imaginary parts. Adding complex numbers adds their arrows from 0. Choose $z+w$.`,
      hint: `Read $z$ from $P$ and $w$ from $Q$ as arrows from 0, then add the two real parts together and the two imaginary parts together.`,
      explanation: [
        `$P$ is $z=${cxInt(a, b)}$ and $Q$ is $w=${cxInt(c, d)}$.`,
        `Add real parts: $${a}+(${c})=${a + c}$. Add imaginary parts: $${b}+(${d})=${b + d}$.`,
        `$z+w=${cxInt(a + c, b + d)}$, the far corner of the parallelogram built on the two arrows.`,
      ],
      correct: M(cxInt(a + c, b + d)),
      wrong: [
        [
          M(cxInt(a - c, b - d)),
          "That is $z-w$. Adding the arrows adds both parts.",
        ],
        [
          M(cxInt(a + d, b + c)),
          "Add real part to real part and imaginary part to imaginary part.",
        ],
        [
          M(cxInt(a * c, b * d)),
          "Adding is not multiplying. Add each pair of matching parts.",
        ],
        [M(cxInt(a + c, 0)), "Include the imaginary parts too."],
        [
          M(cxInt(b + d, a + c)),
          "The real part comes from the horizontal coordinates.",
        ],
      ],
      figure: window(a, b, c, d)
        .id("g")
        .point(a, b, "P")
        .point(c, d, "Q")
        .segment([0, 0], [a, b])
        .segment([0, 0], [c, d])
        .scene({ title: "Points P and Q in the complex plane" }),
    };
  }
  const r0 = pick(r, [2, 4, 6] as const);
  const deg = pick(r, OBLIQUE);
  const t = trig(deg);
  const x = scaled(r0, t.c);
  const y = scaled(r0, t.s);
  if (variant === 3) {
    const sw = [y, x] as const;
    return {
      variant,
      prompt: `Write $${polarTex(r0, deg)}$ in the form $a+bi$, using exact values.`,
      hint: `Here $r=${r0}$ and $\\theta=${piTex(deg)}$. Find $\\cos\\theta$ and $\\sin\\theta$ on the unit circle, check their signs for the quadrant, then multiply each by ${r0}.`,
      explanation: [
        `For $\\theta=${piTex(deg)}$, $\\cos\\theta=${trigTex(t.c)}$ and $\\sin\\theta=${trigTex(t.s)}$.`,
        `Multiply by $r=${r0}$: real part $${signed(x)}$ and imaginary part $${signed(y)}$.`,
        `$${polarTex(r0, deg)}=${cx(x, y)}$.`,
      ],
      correct: M(cx(x, y)),
      wrong: [
        [
          M(cx(...sw)),
          "The real part uses cosine and the imaginary part uses sine. They are swapped here.",
        ],
        [
          M(cx(T(!x.neg, x.body), y)),
          "Check the sign of cosine in this quadrant.",
        ],
        [
          M(cx(x, T(!y.neg, y.body))),
          "Check the sign of sine in this quadrant.",
        ],
        [
          M(cx(T(false, x.body), T(false, y.body))),
          "The signs of cosine and sine depend on the quadrant of the angle.",
        ],
        [
          M(cx(T(!x.neg, x.body), T(!y.neg, y.body))),
          "Check the signs of both cosine and sine in this quadrant.",
        ],
      ],
    };
  }
  const R = pick(r, [2, 4, 6] as const);
  const lock = rect(R, deg);
  const alt = (d: number) => M(polarTex(R, mod360(d)));
  const rho = (() => {
    const d = mod360(deg);
    return d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
  })();
  return {
    variant: 4,
    prompt: `Write $${cx(lock.x, lock.y)}$ in polar form $r(\\cos\\theta+i\\sin\\theta)$ with $r>0$ and $0\\le\\theta<2\\pi$.`,
    hint: `First find $r=\\sqrt{a^2+b^2}$ for the real part $${signed(lock.x)}$ and imaginary part $${signed(lock.y)}$. Then choose the angle whose cosine and sine have the same signs as those parts.`,
    explanation: [
      `$r=\\sqrt{(${signed(lock.x)})^2+(${signed(lock.y)})^2}=${R}$.`,
      `Divide each part by $r$: $\\cos\\theta=${trigTex(trig(deg).c)}$ and $\\sin\\theta=${trigTex(trig(deg).s)}$. These are the cosine and sine of the angle with reference angle $${piTex(rho)}$ in the quadrant with those signs.`,
      `$\\theta=${piTex(deg)}$, so the polar form is $${polarTex(R, deg)}$.`,
    ],
    correct: M(polarTex(R, deg)),
    wrong: [
      [
        alt(rho),
        "The reference angle ignores the quadrant. Use the signs of the real and imaginary parts to place $\\theta$.",
      ],
      [
        alt(deg + 180),
        "That angle points the opposite way. Both $\\cos\\theta$ and $\\sin\\theta$ would have the opposite signs.",
      ],
      [alt(360 - deg), "That angle reverses the sign of the imaginary part."],
      [alt(180 - deg), "That angle reverses the sign of the real part."],
      [alt(90 - deg), "Cosine and sine are swapped for that angle."],
    ],
  };
}

// ---------------------------------------------------------------- conjugates
function conjugateCase(r: Random): Spec {
  const variant = r(0, 4);
  const pair = () => {
    let c: number, d: number;
    do {
      c = nonzero(r, 4);
      d = nonzero(r, 4);
    } while (Math.abs(c) === Math.abs(d));
    return [c, d] as const;
  };
  const quotient = (n: number, m: number, den: number) =>
    M(cx(tFrac(n, den), tFrac(m, den)));
  if (variant === 0) {
    const [a, b] = pair();
    const n = a * a + b * b;
    return {
      variant,
      prompt: `The conjugate of $z=${cxInt(a, b)}$ is $\\bar z=${cxInt(a, -b)}$, with the sign of the imaginary part reversed. Find $z\\bar z$.`,
      hint: `Multiply $(${cxInt(a, b)})(${cxInt(a, -b)})$ term by term. Look at what happens to the two terms containing $i$ and to the product $(bi)(-bi)$.`,
      explanation: [
        `Multiply: $(${a})(${a})=${a * a}$, and the two cross terms $${a}\\cdot(${-b}i)$ and $${b}i\\cdot${a}$ cancel.`,
        `$(${b}i)(${-b}i)=${-b * b}i^2=${b * b}$ because $i^2=-1$.`,
        `$z\\bar z=${a * a}+${b * b}=${n}$, which equals $|z|^2$.`,
      ],
      correct: M(String(n)),
      wrong: [
        [
          M(String(a * a - b * b)),
          "The product of the two $i$ terms is $-b^2i^2=+b^2$, so it adds to $a^2$.",
        ],
        [
          M(String((a + b) ** 2)),
          "The cross terms cancel; there is no $2ab$ term.",
        ],
        [
          M(String(-n)),
          "$i^2=-1$ turns $-b^2i^2$ into $+b^2$, so the result is positive.",
        ],
        [
          M(String((a - b) ** 2)),
          "The cross terms cancel. Only $a^2+b^2$ remains.",
        ],
      ],
    };
  }
  if (variant === 1) {
    const [c, d] = pair();
    const N = c * c + d * d;
    return {
      variant,
      prompt: `Write $\\dfrac{1}{${cxInt(c, d)}}$ in the form $a+bi$ with exact real numbers $a$ and $b$.`,
      hint: `Multiply the top and bottom by the conjugate of ${M(cxInt(c, d))}. The bottom becomes a real number.`,
      explanation: [
        `The conjugate of $${cxInt(c, d)}$ is $${cxInt(c, -d)}$. Multiply top and bottom by it.`,
        `Bottom: $(${cxInt(c, d)})(${cxInt(c, -d)})=${c * c}+${d * d}=${N}$. Top: $${cxInt(c, -d)}$.`,
        `$\\dfrac{1}{${cxInt(c, d)}}=${cx(tFrac(c, N), tFrac(-d, N))}$.`,
      ],
      correct: quotient(c, -d, N),
      wrong: [
        [
          quotient(c, d, N),
          "The numerator is the conjugate, $c-di$, so the imaginary part changes sign.",
        ],
        [M(cxInt(c, -d)), "Divide by $c^2+d^2$ as well; the bottom is not 1."],
        [
          M(cx(tFrac(1, c), tFrac(1, d))),
          "Do not invert the parts separately. Multiply by the conjugate to make the denominator real.",
        ],
        [
          quotient(c, -d, c * c - d * d),
          "The denominator is $c^2+d^2$, not $c^2-d^2$, because $-d^2i^2=+d^2$.",
        ],
      ],
    };
  }
  if (variant === 4) {
    const a = nonzero(r, 7);
    const b = nonzero(r, 7);
    const shape = r(0, 2);
    const [re, im] = shape === 0 ? [0, b] : shape === 1 ? [a, 0] : [a, b];
    return {
      variant,
      prompt: `Find the conjugate of $${cxInt(re, im)}$, the number with the sign of the imaginary part reversed.`,
      hint: `The conjugate of $${cxInt(re, im)}$ keeps the real part and changes only the sign of the imaginary part. A part that is 0 stays 0.`,
      explanation: [
        `Real part: $${re}$. Imaginary part: $${im}$.`,
        `Reverse only the imaginary part: $${-im}$ (it is 0 when there is no $i$ term).`,
        `The conjugate is $${cxInt(re, -im)}$.`,
      ],
      correct: M(cxInt(re, -im)),
      wrong: [
        [
          M(cxInt(-re, im)),
          "The conjugate reverses the imaginary part, not the real part.",
        ],
        [M(cxInt(-re, -im)), "Reverse only the imaginary part."],
        [
          M(cxInt(re, im)),
          "A number equals its conjugate only when its imaginary part is 0.",
        ],
        [M(cxInt(im, re)), "The real part stays in the real position."],
        [M(cxInt(re, -im + 1)), "Reverse the sign without changing the size."],
      ],
    };
  }
  // General quotient, and a quotient that divides exactly.
  const [c, d] = pair();
  const N = c * c + d * d;
  let a: number, b: number;
  if (variant === 3) {
    let x: number, y: number;
    do {
      x = nonzero(r, 4);
      y = nonzero(r, 4);
    } while (x === c && y === -d);
    a = x * c - y * d;
    b = x * d + y * c;
    const wrong = [
      [
        M(cxInt(N * x, N * y)),
        "Divide by $c^2+d^2$ as well after multiplying by the conjugate.",
      ],
      [
        quotient(a * c - b * d, a * d + b * c, N),
        "Multiply by the conjugate $c-di$, not by $c+di$.",
      ],
      [
        M(cx(tFrac(a, c), tFrac(b, d))),
        "Do not divide each part by a different part. Multiply by the conjugate.",
      ],
      [
        quotient(a * c + b * d, a * d - b * c, N),
        "Check the sign of the imaginary part: it is $bc-ad$.",
      ],
    ] as Wrong[];
    return quotientSpec(variant, a, b, c, d, N, M(cxInt(x, y)), wrong);
  }
  do {
    a = nonzero(r, 5);
    b = nonzero(r, 5);
  } while (false);
  const wrong = [
    [
      M(cxInt(a * c + b * d, b * c - a * d)),
      "Divide by $c^2+d^2$ as well after multiplying by the conjugate.",
    ],
    [
      quotient(a * c - b * d, a * d + b * c, N),
      "Multiply by the conjugate $c-di$, not by $c+di$.",
    ],
    [
      quotient(a * c + b * d, a * d - b * c, N),
      "The imaginary part of the numerator is $bc-ad$.",
    ],
    [
      quotient(a * c + b * d, b * c - a * d, c * c - d * d),
      "The denominator is $c^2+d^2$, not $c^2-d^2$.",
    ],
  ] as Wrong[];
  return quotientSpec(
    variant,
    a,
    b,
    c,
    d,
    N,
    quotient(a * c + b * d, b * c - a * d, N),
    wrong,
  );
}
function quotientSpec(
  variant: number,
  a: number,
  b: number,
  c: number,
  d: number,
  N: number,
  correct: string,
  wrong: Wrong[],
): Spec {
  const re = a * c + b * d;
  const im = b * c - a * d;
  return {
    variant,
    prompt: `Divide $\\dfrac{${cxInt(a, b)}}{${cxInt(c, d)}}$ and write the exact quotient in the form $x+yi$.`,
    hint: `Multiply the top and bottom by the conjugate of the denominator, $${cxInt(c, -d)}$. The bottom then becomes a real number.`,
    explanation: [
      `Multiply top and bottom by $${cxInt(c, -d)}$.`,
      `Bottom: $(${cxInt(c, d)})(${cxInt(c, -d)})=${c * c}+${d * d}=${N}$.`,
      `Top: $(${cxInt(a, b)})(${cxInt(c, -d)})=${re}+${im}i$ after using $i^2=-1$.`,
      `Divide both parts by ${N}: $${cx(tFrac(re, N), tFrac(im, N))}$.`,
    ],
    correct,
    wrong,
  };
}

// ------------------------------------------------------------------ distance
function distanceCase(r: Random): Spec {
  const variant = r(0, 4);
  const lab = (a: number, b: number) => cxInt(a, b);
  const difference = () => {
    let dx: number, dy: number;
    do {
      dx = nonzero(r, 7);
      dy = nonzero(r, 7);
    } while (Math.abs(dx) === Math.abs(dy));
    return [dx, dy] as const;
  };
  if (variant <= 1) {
    let dx: number, dy: number;
    if (variant === 0) {
      const [p, q] = pick(r, [
        [3, 4],
        [4, 3],
        [5, 12],
        [12, 5],
        [6, 8],
        [8, 6],
      ] as const);
      dx = p * (r(0, 1) ? 1 : -1);
      dy = q * (r(0, 1) ? 1 : -1);
    } else [dx, dy] = difference();
    const a = r(-5, 5);
    const b = r(-5, 5);
    const c = a + dx;
    const d = b + dy;
    const n = dx * dx + dy * dy;
    return {
      variant,
      prompt: `Let $z=${lab(a, b)}$ and $w=${lab(c, d)}$. The distance between them in the complex plane is $|z-w|$. Find it in simplest exact form.`,
      hint: `Subtract first: find $z-w$ for $z=${lab(a, b)}$ and $w=${lab(c, d)}$ by subtracting real parts and subtracting imaginary parts. Then find the modulus of that difference.`,
      explanation: [
        `$z-w=(${a}-(${c}))+(${b}-(${d}))i=${lab(a - c, b - d)}$.`,
        `$|z-w|=\\sqrt{(${a - c})^2+(${b - d})^2}=\\sqrt{${n}}$.`,
        `In simplest form the distance is $${sqrtTex(n)}$.`,
      ],
      correct: M(sqrtTex(n)),
      wrong: [
        [
          M(String(Math.abs(dx) + Math.abs(dy))),
          "Distance is a straight line. Square the two differences, add, and take the root.",
        ],
        [M(String(n)), "That is the squared distance. Take the square root."],
        [
          M(String(Math.max(Math.abs(dx), Math.abs(dy)))),
          "Both the real and imaginary differences contribute to the distance.",
        ],
        [
          M(sqrtTex(Math.abs(Math.abs(dx) + Math.abs(dy)))),
          "Square each difference before adding, then take the root.",
        ],
        [
          M(sqrtTex(Math.abs(dx * dx - dy * dy))),
          "Add the squares of the differences.",
        ],
      ],
    };
  }
  if (variant === 2) {
    let a: number, b: number, c: number, d: number;
    do {
      a = r(-6, 6);
      b = r(-6, 6);
      c = a + 2 * nonzero(r, 4);
      d = b + 2 * nonzero(r, 4);
    } while (a + c === 0 || b + d === 0);
    const mx = (a + c) / 2;
    const my = (b + d) / 2;
    return {
      variant,
      prompt: `Find the midpoint of the segment joining $z=${lab(a, b)}$ and $w=${lab(c, d)}$ in the complex plane, written as a complex number.`,
      hint: `The midpoint of $z=${lab(a, b)}$ and $w=${lab(c, d)}$ is the average of the two numbers. Average the real parts, then average the imaginary parts.`,
      explanation: [
        `Real part: $\\frac{${a}+(${c})}{2}=${mx}$.`,
        `Imaginary part: $\\frac{${b}+(${d})}{2}=${my}$.`,
        `The midpoint is $\\frac{z+w}{2}=${lab(mx, my)}$.`,
      ],
      correct: M(lab(mx, my)),
      wrong: [
        [
          M(lab(a + c, b + d)),
          "That is $z+w$. Divide by 2 to get the average.",
        ],
        [
          M(lab((c - a) / 2, (d - b) / 2)),
          "That is half the difference, the distance to travel from $z$, not the position of the midpoint.",
        ],
        [M(lab(mx, b + d)), "Halve the imaginary part too."],
        [M(lab(a + c, my)), "Halve the real part too."],
        [
          M(lab(my, mx)),
          "The real part of the midpoint is the average of the real parts.",
        ],
      ],
    };
  }
  if (variant === 3) {
    let a: number, b: number;
    do {
      a = r(-6, 6);
      b = r(-6, 6);
    } while (a === 0 || b === 0);
    const mx = nonzero(r, 5);
    const my = nonzero(r, 5);
    if (mx === a && my === b) return distanceCase(r);
    const c = 2 * mx - a;
    const d = 2 * my - b;
    return {
      variant,
      prompt: `The midpoint of the segment joining $z=${lab(a, b)}$ and $w$ is $m=${lab(mx, my)}$. Find $w$.`,
      hint: `The midpoint is the average, $m=\\frac{z+w}{2}$, and here $m=${lab(mx, my)}$. Multiply both sides by 2 to see what $z+w$ equals.`,
      explanation: [
        `Since $m=\\frac{z+w}{2}$, we have $z+w=2m=${lab(2 * mx, 2 * my)}$.`,
        `$w=2m-z=${lab(2 * mx, 2 * my)}-(${lab(a, b)})$.`,
        `$w=${lab(c, d)}$.`,
      ],
      correct: M(lab(c, d)),
      wrong: [
        [
          M(lab(mx - a, my - b)),
          "That is the step from $z$ to $m$. Take the same step again from $m$ to reach $w$.",
        ],
        [
          M(lab(mx + a, my + b)),
          "Double the midpoint first, then subtract $z$.",
        ],
        [
          M(lab(2 * a - mx, 2 * b - my)),
          "Double the midpoint $m$, not $z$, then subtract $z$.",
        ],
        [M(lab(2 * mx + a, 2 * my + b)), "Subtract $z$; do not add it."],
        [
          M(lab(a - mx, b - my)),
          "Double the midpoint, then subtract $z$ from it, not the other way round.",
        ],
      ],
    };
  }
  // |z - w| = r is a circle.
  const a = nonzero(r, 5);
  const b = nonzero(r, 5);
  const radius = r(2, 7);
  const plus = r(0, 1) === 1;
  const cr = plus ? -a : a;
  const ci = plus ? -b : b;
  const form = plus
    ? `|z+(${lab(a, b)})|=${radius}`
    : `|z-(${lab(a, b)})|=${radius}`;
  const lbl = (re: number, im: number, rad: string) =>
    `Center ${M(lab(re, im))}, radius ${M(rad)}`;
  return {
    variant: 4,
    prompt: `The complex numbers $z$ with $${form}$ form a circle in the complex plane. Which gives its center and radius?`,
    hint: `$|z-w|$ is the distance from $z$ to $w$. Write the left side of $${form}$ as a distance $|z-w|$ for some $w$; that $w$ is the center.`,
    explanation: [
      `$|z-w|=${radius}$ says the distance from $z$ to $w$ is ${radius}.`,
      plus
        ? `Rewrite $z+(${lab(a, b)})$ as $z-(${lab(-a, -b)})$, so $w=${lab(-a, -b)}$.`
        : `The left side already has the form $|z-w|$ with $w=${lab(a, b)}$.`,
      `The circle has center $${lab(cr, ci)}$ and radius $${radius}$.`,
    ],
    correct: lbl(cr, ci, String(radius)),
    wrong: [
      [
        lbl(-cr, -ci, String(radius)),
        "The center is the number being subtracted inside $|z-w|$. Rewrite a plus sign as a subtraction first.",
      ],
      [
        lbl(cr, ci, String(radius * radius)),
        "The right side is the radius itself, not its square.",
      ],
      [
        lbl(cr, -ci, String(radius)),
        "The center is the number $w$ itself, not its conjugate.",
      ],
      [
        lbl(0, 0, String(radius)),
        "A circle centered at 0 would be $|z|=r$. This one is shifted by $w$.",
      ],
    ],
  };
}

// ------------------------------------------------------------ factor & solve
function factorCase(r: Random): Spec {
  const variant = r(0, 4);
  if (variant <= 1) {
    const m =
      variant === 0
        ? pick(r, [4, 9, 16, 25, 36, 49, 64, 81] as const)
        : pick(r, [2, 3, 5, 6, 7, 8, 12, 18, 20, 27, 28, 45] as const);
    const s = sqrtTex(m);
    const f = (sign: string, t: string) => `(x${sign}${t})`;
    const root = `${s === "1" ? "" : s}i`;
    return {
      variant,
      prompt: `Factor $x^2+${m}$ over the complex numbers. Write any radicals in simplest form.`,
      hint: `$x^2+${m}$ has no real roots. Find a number whose square is $-${m}$, using $i^2=-1$, then use the difference of squares.`,
      explanation: [
        `Because $i^2=-1$, $(${root})^2=-${m}$.`,
        `So $x^2+${m}=x^2-(${root})^2$.`,
        `By the difference of squares, $x^2+${m}=(x+${root})(x-${root})$.`,
      ],
      correct: M(f("+", root) + f("-", root)),
      wrong: [
        [
          M(f("+", s) + f("-", s)),
          "That product is $x^2-" +
            m +
            "$. The sum of squares needs the $i$: $(ki)^2=-k^2$.",
        ],
        [
          M(`(x+${root})^2`),
          "The two factors must have opposite signs so the middle terms cancel.",
        ],
        [
          M(f("+", `${m}i`) + f("-", `${m}i`)),
          "The imaginary root squares to $-" +
            m +
            "$, so use the square root of " +
            m +
            ", not " +
            m +
            " itself.",
        ],
        [
          M(f("+", s) + f("-", root)),
          "A mixed pair does not cancel its middle term. Both factors need $i$.",
        ],
      ],
    };
  }
  if (variant === 2) {
    const p = nonzero(r, 5);
    const mm = r(1, 12);
    const c = mm + p * p;
    const b = 2 * p;
    const s = sqrtTerm(mm);
    const ans = (head: number | string, imag: string) =>
      M(`x=${head}\\pm ${imag}`);
    const im = (t: Term) => (t.body === "1" ? "i" : `${t.body}i`);
    return {
      variant,
      prompt: `Solve $${monic(b, c)}=0$ over the complex numbers. Choose the exact solutions.`,
      hint: `Compute the discriminant $b^2-4c$ with $b=${b}$ and $c=${c}$. It is negative, so the square root brings in $i$. Then use $x=\\frac{-b\\pm\\sqrt{b^2-4c}}{2}$.`,
      explanation: [
        `$b^2-4c=${b * b}-${4 * c}=${b * b - 4 * c}$, which is negative.`,
        `$\\sqrt{${b * b - 4 * c}}=\\sqrt{${4 * mm}}\\,i=${sqrtTex(4 * mm)}\\,i$.`,
        `$x=\\frac{${-b}\\pm ${sqrtTex(4 * mm)}i}{2}=${-p}\\pm ${im(s)}$.`,
      ],
      correct: ans(-p, im(s)),
      wrong: [
        [ans(p, im(s)), "The real part is $-b/2$; check its sign."],
        [
          ans(-p, s.body),
          "A negative discriminant gives imaginary roots; keep the $i$.",
        ],
        [ans(-b, im(s)), "Divide $-b$ by 2 as well as the square root."],
        [
          ans(-p, im(sqrtTerm(c))),
          "The root uses the discriminant $b^2-4c$, not $c$ alone.",
        ],
        [
          ans(-p, im(tRad(mm, 1))),
          "Simplify the root; the imaginary part is $\\sqrt{" +
            mm +
            "}$, not " +
            mm +
            ".",
        ],
      ],
    };
  }
  if (variant === 3) {
    const b = pick(r, [1, 3, 5, -1, -3, -5] as const);
    let c: number;
    do c = r(2, 9);
    while (b * b - 4 * c >= 0);
    const D = 4 * c - b * b;
    const s = sqrtTex(D);
    const im = (t: string) => (t === "1" ? "i" : `${t}i`);
    const sol = (head: number, num: string) =>
      M(`x=\\frac{${head}\\pm ${im(num)}}{2}`);
    return {
      variant,
      prompt: `Solve $${monic(b, c)}=0$ over the complex numbers. Choose the exact solutions.`,
      hint: `Use $x=\\frac{-b\\pm\\sqrt{b^2-4c}}{2}$ with $b=${b}$ and $c=${c}$. Find the discriminant first; its sign tells you whether $i$ appears.`,
      explanation: [
        `$b^2-4c=${b * b}-${4 * c}=${-D}$.`,
        `$\\sqrt{${-D}}=${s}\\,i$.`,
        `$x=\\frac{${-b}\\pm ${im(s)}}{2}$. The two solutions are complex conjugates.`,
      ],
      correct: sol(-b, s),
      wrong: [
        [sol(b, s), "The first term is $-b$; check its sign."],
        [
          M(`x=\\frac{${-b}\\pm ${s}}{2}`),
          "A negative discriminant produces $i$ in the roots.",
        ],
        [
          M(`x=${-b}\\pm ${im(s)}`),
          "The whole numerator is divided by 2, not just the first part.",
        ],
        [
          sol(-b, sqrtTex(Math.abs(b * b + 4 * c))),
          "The discriminant is $b^2-4c$. Subtract $4c$.",
        ],
      ],
    };
  }
  const p = nonzero(r, 5);
  const q = r(1, 6);
  const quad = (bb: number, cc: number) => M(`${monic(bb, cc)}=0`);
  return {
    variant: 4,
    prompt: `A quadratic with real coefficients and leading coefficient 1 has the solutions $${cxInt(p, q)}$ and $${cxInt(p, -q)}$. Choose its equation.`,
    hint: `If the roots are $r_1=${cxInt(p, q)}$ and $r_2=${cxInt(p, -q)}$, the quadratic is $(x-r_1)(x-r_2)$. Find the sum $r_1+r_2$ and the product $r_1\\cdot r_2$ of the two roots.`,
    explanation: [
      `Sum of roots: $(${cxInt(p, q)})+(${cxInt(p, -q)})=${2 * p}$.`,
      `Product: $(${cxInt(p, q)})(${cxInt(p, -q)})=${p * p}+${q * q}=${p * p + q * q}$.`,
      `$x^2-(\\text{sum})x+\\text{product}=0$ gives $${monic(-2 * p, p * p + q * q)}=0$.`,
    ],
    correct: quad(-2 * p, p * p + q * q),
    wrong: [
      [
        quad(2 * p, p * p + q * q),
        "The middle coefficient is the negative of the sum of the roots.",
      ],
      [
        quad(-2 * p, p * p - q * q),
        "The product of conjugates is $p^2+q^2$ because $-q^2i^2=+q^2$.",
      ],
      [quad(-2 * p, q * q), "The product includes the real part: $p^2+q^2$."],
      [
        quad(0, p * p + q * q),
        "The roots have real part $" + p + "$, so the middle term is not zero.",
      ],
    ],
  };
}

// ----------------------------------------------------------------- root count
function rootCountCase(r: Random): Spec {
  const variant = r(0, 4);
  const num = (n: number) => M(String(n));
  if (variant === 0) {
    const n = r(3, 8);
    const terms = r(2, 3);
    const exps = new Set([n]);
    while (exps.size < terms + 1) exps.add(r(0, n - 1));
    const sorted = [...exps].sort((x, y) => y - x);
    const poly = sorted
      .map((e, i) => {
        const c = i === 0 ? r(1, 4) : nonzero(r, 6);
        const mag = Math.abs(c) === 1 && e > 0 ? "" : String(Math.abs(c));
        const x = e === 0 ? "" : e === 1 ? "x" : `x^{${e}}`;
        return `${c < 0 ? "-" : i === 0 ? "" : "+"}${mag}${x}`;
      })
      .join("");
    return {
      variant,
      prompt: `How many roots does $p(x)=${poly}$ have in the complex numbers, counting each root as many times as its multiplicity?`,
      hint: `The degree is the largest exponent of $x$ in $p(x)$, which is ${n}. The Fundamental Theorem of Algebra relates the degree to the number of complex roots.`,
      explanation: [
        `The highest exponent in $p(x)$ is ${n}, so $p$ has degree ${n}.`,
        `A polynomial of degree $n\\ge 1$ has exactly $n$ complex roots counting multiplicity.`,
        `$p(x)$ has ${n} roots.`,
      ],
      correct: num(n),
      wrong: [
        [num(n - 1), "The number of roots equals the degree, not one less."],
        [num(n + 1), "The number of roots equals the degree, not one more."],
        [
          num(sorted.length),
          "The number of terms does not matter. The degree does.",
        ],
        [
          num(2 * n),
          "Roots are counted once each, with multiplicity: the total is the degree.",
        ],
      ],
    };
  }
  if (variant === 1) {
    const lin = r(1, 3);
    const roots = new Set<number>();
    while (roots.size < lin) roots.add(nonzero(r, 5));
    const factors = [...roots].map((a) => ({ a, e: r(1, 3) }));
    const quad = r(0, 1) === 1 ? r(1, 9) : 0;
    const fac = factors
      .map(
        ({ a, e }) =>
          `(x${a < 0 ? "+" : "-"}${Math.abs(a)})${e > 1 ? `^${e}` : ""}`,
      )
      .join("");
    const total = factors.reduce((s, f) => s + f.e, 0) + (quad ? 2 : 0);
    const distinct = factors.length + (quad ? 2 : 0);
    return {
      variant,
      prompt: `How many complex roots does $p(x)=${fac}${quad ? `(x^2+${quad})` : ""}$ have, counting each root as many times as its multiplicity?`,
      hint: `In $p(x)=${fac}${quad ? `(x^2+${quad})` : ""}$, a factor $(x-a)^e$ gives the root $a$ with multiplicity $e$. Add up the multiplicities from every factor, and think about how many roots a factor $x^2+${quad || "k"}$ contributes.`,
      explanation: [
        `A factor $(x-a)^e$ contributes the root $a$ with multiplicity $e$.`,
        ...factors.map(
          ({ a, e }) =>
            `$(x${a < 0 ? "+" : "-"}${Math.abs(a)})${e > 1 ? `^${e}` : ""}$ contributes the root ${a} with multiplicity ${e}.`,
        ),
        quad
          ? `$x^2+${quad}$ has the two complex roots $\\pm${sqrtTex(quad)}i$, one each.`
          : "",
        `Total: ${total}, which equals the degree of $p$.`,
      ].filter(Boolean),
      correct: num(total),
      wrong: [
        [
          num(distinct),
          "Count repeated roots by multiplicity: a factor raised to the power $e$ counts $e$ times.",
        ],
        [
          num(factors.length + (quad ? 1 : 0)),
          "Count roots, not factors. An exponent repeats the root, and $x^2+k$ has two roots.",
        ],
        [num(total - 1), "Add every multiplicity; none is dropped."],
        [num(total + 1), "The total is the degree: the sum of all exponents."],
        [num(total + 2), "The total is the degree: the sum of all exponents."],
      ],
    };
  }
  if (variant === 2) {
    const p = nonzero(r, 6);
    const q = nonzero(r, 6);
    const n = r(3, 6);
    const lab = (a: number, b: number) => M(cxInt(a, b));
    return {
      variant,
      prompt: `A polynomial of degree ${n} has real coefficients, and ${lab(p, q)} is one of its roots. Which other number must also be a root?`,
      hint: `Nonreal roots of a polynomial with real coefficients come in conjugate pairs. What is the conjugate of ${lab(p, q)}?`,
      explanation: [
        `The coefficients are real, so nonreal roots occur in conjugate pairs.`,
        `The conjugate of $${cxInt(p, q)}$ reverses the sign of the imaginary part: $${cxInt(p, -q)}$.`,
        `So $${cxInt(p, -q)}$ is also a root.`,
      ],
      correct: lab(p, -q),
      wrong: [
        [
          lab(-p, -q),
          "The negative is not forced to be a root. The conjugate keeps the real part.",
        ],
        [
          lab(-p, q),
          "The conjugate keeps the real part and reverses the imaginary part.",
        ],
        [
          lab(q, p),
          "Swapping the parts does not give a root. Use the conjugate.",
        ],
        [
          lab(p, q + 1),
          "Nothing forces a different imaginary part. The conjugate reverses its sign.",
        ],
      ],
    };
  }
  if (variant === 3) {
    const n = r(3, 7);
    const parity = n % 2;
    const valid = Array.from({ length: n + 1 }, (_, i) => i).filter(
      (i) => i % 2 === parity,
    );
    const ok = pick(r, valid);
    const bad = Array.from({ length: n + 1 }, (_, i) => i).filter(
      (i) => i % 2 !== parity,
    );
    return {
      variant,
      prompt: `A polynomial with real coefficients has degree ${n}. Counting multiplicity, which number of real roots can it have?`,
      hint: `It has ${n} complex roots in total, and the nonreal ones come in conjugate pairs. How many nonreal roots does a given count of real roots leave over, and can that number be made of pairs?`,
      explanation: [
        `There are ${n} roots in total, and the nonreal roots come in conjugate pairs, so their count is even.`,
        `The real roots therefore number ${n} minus an even number, so they have the same parity as ${n}.`,
        `Among the choices only ${ok} qualifies: ${n}-${ok}=${n - ok} nonreal roots form ${(n - ok) / 2} pair${(n - ok) / 2 === 1 ? "" : "s"}.`,
      ],
      correct: num(ok),
      wrong: [
        ...bad
          .slice(0, 3)
          .map(
            (b) =>
              [
                num(b),
                `That leaves ${n - b} nonreal root${n - b === 1 ? "" : "s"}, an odd number, which cannot be made of conjugate pairs.`,
              ] as Wrong,
          ),
        [
          num(n + 2),
          "A polynomial of degree " + n + " has at most " + n + " roots.",
        ],
        [
          num(n + 1),
          "A polynomial of degree " + n + " has at most " + n + " roots.",
        ],
      ],
    };
  }
  const j = r(1, 2);
  const n = r(2 * j + 1, 2 * j + 4);
  const roots =
    j === 1
      ? [cxInt(r(-5, 5), nonzero(r, 5))]
      : [cxInt(r(-3, 3), r(1, 3)), cxInt(r(4, 6), -r(1, 3))];
  const list = roots.map((t) => `$${t}$`).join(" and ");
  return {
    variant: 4,
    prompt: `A polynomial with real coefficients has degree ${n}. Its roots include ${list}${j === 2 ? ", which are not conjugates of each other" : ""}. At most how many of its ${n} roots, counting multiplicity, can be real?`,
    hint: `Each listed nonreal root forces its conjugate to be a root too. Count the nonreal roots that are forced, and subtract that from ${n}.`,
    explanation: [
      `Each listed nonreal root comes with its conjugate, so ${j} listed root${j === 1 ? "" : "s"} force${j === 1 ? "s" : ""} ${2 * j} nonreal roots.`,
      `That leaves at most ${n}-${2 * j} roots that can be real.`,
      `At most ${n - 2 * j} roots can be real.`,
    ],
    correct: num(n - 2 * j),
    wrong: [
      [
        num(n - j),
        "Each nonreal root brings its conjugate, so $2" +
          (j > 1 ? "\\cdot" + j : "") +
          "$ roots are used, not " +
          j +
          ".",
      ],
      [
        num(n),
        "The listed nonreal roots and their conjugates are not real, so they reduce the count.",
      ],
      [
        num(n - 2 * j - 1),
        "Only the forced nonreal roots are removed. The rest may all be real.",
      ],
      [
        num(n - 2 * j + 1),
        "Each listed nonreal root forces its conjugate, which is another nonreal root.",
      ],
    ],
  };
}

// -------------------------------------------------------------------- polar
function polarCase(r: Random): Spec {
  const variant = r(0, 3);
  const pol = (rad: number, deg: number) =>
    `\\left(${rad}, ${piTex(deg)}\\right)`;
  const R = pick(r, [2, 4, 6, 8] as const);
  if (variant === 0) {
    const deg = pick(r, ANGLES);
    const neg = r(0, 2) === 0;
    const s = neg ? -1 : 1;
    const p = rect(R, deg);
    const flip = (t: Term) => T(!t.neg, t.body);
    const X = neg ? flip(p.x) : p.x;
    const Y = neg ? flip(p.y) : p.y;
    const ptT = (x: Term, y: Term) => M(pt(x, y));
    return {
      variant,
      prompt: `Convert the polar point $${pol(s * R, deg)}$ to Cartesian coordinates $(x,y)$. Use exact values.`,
      hint: `Use $x=r\\cos\\theta$ and $y=r\\sin\\theta$ with $r=${s * R}$ and $\\theta=${piTex(deg)}$. ${neg ? "Keep the negative sign of $r$ with both coordinates." : "Find the cosine and sine values first."}`,
      explanation: [
        `$\\cos${piTex(deg)}=${trigTex(trig(deg).c)}$ and $\\sin${piTex(deg)}=${trigTex(trig(deg).s)}$.`,
        `$x=${s * R}\\cdot ${trigTex(trig(deg).c)}=${signed(X)}$ and $y=${s * R}\\cdot ${trigTex(trig(deg).s)}=${signed(Y)}$.`,
        `The point is $${pt(X, Y)}$.`,
      ],
      correct: ptT(X, Y),
      wrong: [
        [
          ptT(Y, X),
          "$x$ uses cosine and $y$ uses sine. They are swapped here.",
        ],
        [ptT(flip(X), Y), "Check the sign of $x=r\\cos\\theta$."],
        [ptT(X, flip(Y)), "Check the sign of $y=r\\sin\\theta$."],
        [
          ptT(tInt(R), tInt(R)),
          "The coordinates depend on the angle: multiply $r$ by cosine and sine.",
        ],
        ...(neg
          ? ([
              [
                ptT(p.x, p.y),
                "A negative $r$ moves the point the opposite way along the angle.",
              ],
            ] as Wrong[])
          : []),
      ],
    };
  }
  if (variant === 1) {
    const deg = pick(r, ANGLES);
    const p = rect(R, deg);
    const alt = (d: number, rad = R) => M(pol(rad, mod360(d)));
    const d = mod360(deg);
    const rho = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
    return {
      variant,
      prompt: `Write the Cartesian point $${pt(p.x, p.y)}$ in polar coordinates $(r,\\theta)$ with $r>0$ and $0\\le\\theta<2\\pi$.`,
      hint: `Find $r=\\sqrt{x^2+y^2}$ for $x=${signed(p.x)}$ and $y=${signed(p.y)}$. Then pick the angle whose cosine is $x/r$ and whose sine is $y/r$; check the quadrant from the signs.`,
      explanation: [
        `$r=\\sqrt{(${signed(p.x)})^2+(${signed(p.y)})^2}=${R}$.`,
        `$\\cos\\theta=\\frac{x}{r}=${trigTex(trig(deg).c)}$ and $\\sin\\theta=\\frac{y}{r}=${trigTex(trig(deg).s)}$.`,
        `The angle in $[0,2\\pi)$ with these values is $${piTex(deg)}$. The polar point is $${pol(R, d)}$.`,
      ],
      correct: M(pol(R, d)),
      wrong: [
        [
          alt(rho),
          "The reference angle ignores the quadrant. Use the signs of $x$ and $y$.",
        ],
        [
          alt(d + 180),
          "That direction is opposite. Both signs would be reversed.",
        ],
        [alt(360 - d), "That angle reverses the sign of $y$."],
        [alt(180 - d), "That angle reverses the sign of $x$."],
        [
          alt(d + 90),
          "Check which of $\\cos\\theta$ and $\\sin\\theta$ equals $x/r$.",
        ],
        [
          alt(d - 90),
          "Check which of $\\cos\\theta$ and $\\sin\\theta$ equals $x/r$.",
        ],
        [alt(90 - d), "$x$ goes with cosine and $y$ with sine."],
      ],
    };
  }
  const deg = pick(r, OBLIQUE);
  if (variant === 2) {
    const turn = r(0, 1) === 0;
    const same = turn ? M(pol(-R, mod360(deg + 180))) : M(pol(R, deg + 360));
    return {
      variant,
      prompt: `The polar point $${pol(R, deg)}$ can be named in more than one way. Which pair names the same point?`,
      hint: `For $${pol(R, deg)}$, adding $2\\pi$ to the angle turns a full circle and returns to the same direction. A negative $r$ means moving the opposite way along the angle, which is the same as turning by $\\pi$.`,
      explanation: [
        `Adding $2\\pi$ to the angle gives $(${R}, ${piTex(deg + 360)})$ and the point is the same.`,
        `Changing the sign of $r$ and adding $\\pi$ to the angle also returns to the same point: $(${-R}, ${piTex(mod360(deg + 180))})$.`,
        `Here the matching name is $${turn ? pol(-R, mod360(deg + 180)) : pol(R, deg + 360)}$.`,
      ],
      correct: same,
      wrong: [
        [
          M(pol(-R, deg)),
          "A negative $r$ alone puts the point on the opposite side; the angle must also turn by $\\pi$.",
        ],
        [
          M(pol(R, mod360(deg + 180))),
          "Turning by $\\pi$ with the same $r$ lands on the opposite side.",
        ],
        [
          M(pol(-R, deg + 360)),
          "A full turn does not change the direction, so the negative $r$ still flips the point.",
        ],
        [
          M(pol(R, mod360(-deg))),
          "The negative of the angle reflects the point across the horizontal axis.",
        ],
      ],
    };
  }
  const q = mod360(deg + 180);
  return {
    variant: 3,
    prompt: `The polar point $${pol(-R, deg)}$ has a negative $r$. Which pair with $r>0$ names the same point?`,
    hint: `A negative $r$ means moving $${R}$ units in the direction opposite to $\\theta$. Which angle points in that opposite direction?`,
    explanation: [
      `With $r=${-R}$ the point is ${R} units from the origin in the direction opposite to $${piTex(deg)}$.`,
      `The opposite direction is $${piTex(deg)}+\\pi=${piTex(q)}$ (mod $2\\pi$).`,
      `The same point is $${pol(R, q)}$.`,
    ],
    correct: M(pol(R, q)),
    wrong: [
      [
        M(pol(R, deg)),
        "Dropping the minus sign moves the point to the other side of the origin.",
      ],
      [
        M(pol(R, mod360(360 - deg))),
        "Reflecting the angle does not account for the negative $r$.",
      ],
      [
        M(pol(R, mod360(deg + 90))),
        "To reverse direction, turn by half a circle, $\\pi$.",
      ],
      [
        M(pol(R, mod360(180 - deg))),
        "Turn the angle by $\\pi$, not $\\pi$ minus the angle.",
      ],
    ],
  };
}

// --------------------------------------------------------------- parametric
function parametricCase(r: Random): Spec {
  const variant = r(0, 4);
  const x0 = nonzero(r, 6);
  const y0 = nonzero(r, 6);
  let a: number, b: number;
  do {
    a = nonzero(r, 5);
    b = nonzero(r, 5);
  } while (Math.abs(a) === Math.abs(b));
  const ptLabel = (x: number, y: number) => M(pt(x, y));
  if (variant === 0) {
    const t0 = r(2, 5);
    const X = x0 + a * t0;
    const Y = y0 + b * t0;
    return {
      variant,
      prompt: `A drone's position, in meters, at time $t$ seconds is $x(t)=${constFirst(x0, a, "t")}$, $y(t)=${constFirst(y0, b, "t")}$. Where is the drone at $t=${t0}$ s?`,
      hint: `Substitute $t=${t0}$ into $x(t)$ and into $y(t)$ separately. Each gives one coordinate.`,
      explanation: [
        `$x(${t0})=${x0}+(${a})(${t0})=${X}$.`,
        `$y(${t0})=${y0}+(${b})(${t0})=${Y}$.`,
        `The drone is at $${pt(X, Y)}$ meters.`,
      ],
      correct: ptLabel(X, Y),
      wrong: [
        [
          ptLabel(a * t0, b * t0),
          "Include the starting position: add $x(0)$ and $y(0)$.",
        ],
        [
          ptLabel(x0 + a, y0 + b),
          "Multiply the rates by $t=" + t0 + "$, not by 1.",
        ],
        [ptLabel(Y, X), "The first coordinate comes from $x(t)$."],
        [
          ptLabel(x0 + a * t0, y0 + b),
          "Use $t=" + t0 + "$ in both coordinates.",
        ],
      ],
    };
  }
  if (variant === 1) {
    const xx = x0;
    const k = y0 * a - b * xx;
    const line = (m: number, d: number, c: number, e: number) => {
      // y = (m/d) x + (c/e)
      const ms = tFrac(m, d);
      const cs = tFrac(c, e);
      const mid = ms.body === "1" ? "x" : `${ms.body}x`;
      const first = `${ms.neg ? "-" : ""}${mid}`;
      if (isZero(cs)) return M(`y=${first}`);
      return M(`y=${first}${cs.neg ? "-" : "+"}${cs.body}`);
    };
    return {
      variant,
      prompt: `A drone's position, in meters, is $x(t)=${constFirst(x0, a, "t")}$, $y(t)=${constFirst(y0, b, "t")}$. Eliminate $t$ to write the path as $y$ in terms of $x$.`,
      hint: `Solve $x(t)=${constFirst(x0, a, "t")}$ for $t$ in terms of $x$, then substitute that expression into $y(t)$.`,
      explanation: [
        `From $x=${constFirst(x0, a, "t")}$: $t=\\frac{x-${x0 < 0 ? `(${x0})` : x0}}{${a}}$.`,
        `Substitute into $y=${constFirst(y0, b, "t")}$: $y=${y0}+${b < 0 ? `(${b})` : b}\\cdot\\frac{x-${x0 < 0 ? `(${x0})` : x0}}{${a}}$.`,
        `Simplify: ${line(b, a, k, a)}, a line with slope $\\frac{${b}}{${a}}$.`,
      ],
      correct: line(b, a, k, a),
      wrong: [
        [
          line(a, b, y0 * b - a * x0, b),
          "The slope is the change in $y$ per change in $x$: $y$'s rate divided by $x$'s rate.",
        ],
        [
          line(b, a, y0 * a, a),
          "Subtract the starting $x$ before substituting: $t=(x-x(0))/a$.",
        ],
        [
          line(b, a, y0 * a + b * x0, a),
          "The $x(0)$ term is subtracted, so the intercept is $y(0)-\\frac{b}{a}x(0)$.",
        ],
        [line(a * b, 1, k, a), "Divide $b$ by $a$; do not multiply them."],
      ],
    };
  }
  if (variant === 2) {
    const trip = r(0, 1) === 0;
    let sa = a;
    let sb = b;
    if (trip) {
      const [p, q] = pick(r, [
        [3, 4],
        [4, 3],
        [5, 12],
        [12, 5],
      ] as const);
      sa = p * (r(0, 1) ? 1 : -1);
      sb = q * (r(0, 1) ? 1 : -1);
    }
    const n = sa * sa + sb * sb;
    const unit = (t: string) => M(`${t}\\text{ m/s}`);
    return {
      variant,
      prompt: `A drone's position, in meters, is $x(t)=${constFirst(x0, sa, "t")}$, $y(t)=${constFirst(y0, sb, "t")}$ with $t$ in seconds. What is its constant speed, in simplest exact form?`,
      hint: `Each second, $x$ changes by ${Math.abs(sa)} meters and $y$ changes by ${Math.abs(sb)} meters. The speed is the length of that one-second step.`,
      explanation: [
        `In each second $x$ changes by ${sa} m and $y$ changes by ${sb} m.`,
        `The distance moved is $\\sqrt{(${sa})^2+(${sb})^2}=\\sqrt{${n}}$ m.`,
        `The speed is $${sqrtTex(n)}$ m/s.`,
      ],
      correct: unit(sqrtTex(n)),
      wrong: [
        [
          unit(String(Math.abs(sa) + Math.abs(sb))),
          "The step is diagonal: combine the two changes with the Pythagorean theorem.",
        ],
        [unit(String(n)), "That is the squared speed. Take the square root."],
        [
          unit(String(Math.max(Math.abs(sa), Math.abs(sb)))),
          "Both coordinates change, so both contribute to the speed.",
        ],
        [
          unit(sqrtTex(Math.abs(sa) + Math.abs(sb))),
          "Square each rate before adding, then take the root.",
        ],
      ],
    };
  }
  if (variant === 3) {
    const t0 = r(2, 6);
    const useX = r(0, 1) === 0;
    const [c0, c1, name] = useX ? [x0, a, "x"] : [y0, b, "y"];
    const target = c0 + c1 * t0;
    return {
      variant,
      prompt: `A drone's position, in meters, is $x(t)=${constFirst(x0, a, "t")}$, $y(t)=${constFirst(y0, b, "t")}$ with $t$ in seconds. At what time is its $${name}$-coordinate ${target}?`,
      hint: `Set $${name}(t)=${target}$ and solve the equation for $t$. Only the $${name}$-equation matters here.`,
      explanation: [
        `Set $${constFirst(c0, c1, "t")}=${target}$.`,
        `Subtract ${c0}: $${c1}t=${target - c0}$.`,
        `Divide by ${c1}: $t=${t0}$ seconds.`,
      ],
      correct: M(`${t0}\\text{ s}`),
      wrong: [
        [
          M(
            `${tFrac(target, c1).neg ? "-" : ""}${tFrac(target, c1).body}\\text{ s}`,
          ),
          "Subtract the starting value before dividing by the rate.",
        ],
        [
          M(
            `${tFrac(target + c0, c1).neg ? "-" : ""}${tFrac(target + c0, c1).body}\\text{ s}`,
          ),
          "Subtract the starting value; do not add it.",
        ],
        [
          M(`${target - c0}\\text{ s}`),
          "Divide by the rate $" + c1 + "$ after subtracting.",
        ],
        [M(`${-t0}\\text{ s}`), "Check the signs when dividing by the rate."],
        [
          M(`${(target - c0) * c1}\\text{ s}`),
          "Divide by the rate; do not multiply.",
        ],
        [
          M(`${t0 + 1}\\text{ s}`),
          "Check your answer by substituting it into the equation.",
        ],
      ],
    };
  }
  const horizontal = a > 0 ? "right" : "left";
  const vertical = b > 0 ? "up" : "down";
  const steep = Math.abs(b) > Math.abs(a);
  const stmt = (h: string, v: string, s: boolean) =>
    `Moves ${h} and ${v}, ${s ? "faster vertically than horizontally" : "faster horizontally than vertically"}`;
  const flip = (w: string) =>
    ({ right: "left", left: "right", up: "down", down: "up" })[w]!;
  return {
    variant: 4,
    prompt: `A drone's position, in meters, is $x(t)=${constFirst(x0, a, "t")}$, $y(t)=${constFirst(y0, b, "t")}$, with $x$ increasing to the right and $y$ increasing upward. Which statement describes its motion?`,
    hint: `In $x(t)=${constFirst(x0, a, "t")}$ and $y(t)=${constFirst(y0, b, "t")}$, the coefficient of $t$ in $x(t)$ is the change in $x$ each second, and the same for $y(t)$. Compare their signs for direction and their sizes for which is faster.`,
    explanation: [
      `$x$ changes by ${a} m each second: ${a > 0 ? "increasing, so it moves right" : "decreasing, so it moves left"}.`,
      `$y$ changes by ${b} m each second: ${b > 0 ? "increasing, so it moves up" : "decreasing, so it moves down"}.`,
      `Since $|${b}|${steep ? ">" : "<"}|${a}|$, it moves faster ${steep ? "vertically" : "horizontally"}. ${stmt(horizontal, vertical, steep)}.`,
    ],
    correct: stmt(horizontal, vertical, steep),
    wrong: [
      [
        stmt(flip(horizontal), vertical, steep),
        "A positive rate for $x$ means moving right; a negative rate means moving left.",
      ],
      [
        stmt(horizontal, flip(vertical), steep),
        "A positive rate for $y$ means moving up; a negative rate means moving down.",
      ],
      [
        stmt(horizontal, vertical, !steep),
        "Compare the sizes of the two rates, ignoring their signs.",
      ],
    ],
  };
}

// ------------------------------------------------------------------- conics
type Conic = "circle" | "ellipse" | "parabola" | "hyperbola";
const NAMES: Record<Conic, string> = {
  circle: "Circle",
  ellipse: "Ellipse",
  parabola: "Parabola",
  hyperbola: "Hyperbola",
};
const WHY: Record<Conic, Record<Conic, string>> = {
  circle: {
    circle: "",
    ellipse:
      "An ellipse has different denominators under $x$ and $y$. Here the two squared terms have the same coefficient.",
    parabola:
      "A parabola has only one squared variable. Both $x$ and $y$ are squared here.",
    hyperbola:
      "A hyperbola has a minus sign between the squared terms. Here they are added.",
  },
  ellipse: {
    ellipse: "",
    circle:
      "A circle needs equal denominators. These differ, so the graph is stretched into an ellipse.",
    parabola:
      "A parabola has only one squared variable. Both are squared here.",
    hyperbola:
      "A hyperbola has a minus sign between the squared terms. Here they are added.",
  },
  parabola: {
    parabola: "",
    circle:
      "A circle has both $x$ and $y$ squared. Only one variable is squared here.",
    ellipse:
      "An ellipse has both $x$ and $y$ squared. Only one variable is squared here.",
    hyperbola:
      "A hyperbola has both $x$ and $y$ squared. Only one variable is squared here.",
  },
  hyperbola: {
    hyperbola: "",
    circle: "A circle adds its squared terms. Here one is subtracted.",
    ellipse: "An ellipse adds its squared terms. Here one is subtracted.",
    parabola:
      "A parabola has only one squared variable. Both are squared here.",
  },
};
const frac2 = (num: string, den: number) => `\\frac{${num}}{${den}}`;
function conicCase(r: Random): Spec {
  const variant = r(0, 4);
  const hk = () => {
    let h: number, k: number;
    do {
      h = r(-5, 5);
      k = r(-5, 5);
    } while (h === 0 || k === 0 || Math.abs(h) === Math.abs(k));
    return [h, k] as const;
  };
  if (variant === 0) {
    const kind = pick(r, [
      "circle",
      "ellipse",
      "parabola",
      "hyperbola",
    ] as const);
    const [h, k] = hk();
    let eq: string;
    let reason: string;
    if (kind === "circle") {
      const rr = pick(r, [4, 9, 16, 25] as const);
      eq =
        r(0, 1) === 0
          ? `${sq("x", h)}+${sq("y", k)}=${rr}`
          : `${frac2(sq("x", h), rr)}+${frac2(sq("y", k), rr)}=1`;
      reason =
        "Both variables are squared, the terms are added, and the coefficients are equal, so the graph is a circle.";
    } else if (kind === "ellipse") {
      const [A, B] = pick(r, [
        [9, 4],
        [16, 9],
        [25, 16],
        [4, 9],
        [9, 25],
        [16, 4],
      ] as const);
      eq = `${frac2(sq("x", h), A)}+${frac2(sq("y", k), B)}=1`;
      reason =
        "Both variables are squared and added, with different denominators, so the graph is an ellipse.";
    } else if (kind === "hyperbola") {
      const [A, B] = pick(r, [
        [9, 4],
        [16, 9],
        [4, 4],
        [9, 16],
      ] as const);
      eq =
        r(0, 1) === 0
          ? `${frac2(sq("x", h), A)}-${frac2(sq("y", k), B)}=1`
          : `${frac2(sq("y", k), B)}-${frac2(sq("x", h), A)}=1`;
      reason =
        "Both variables are squared and one term is subtracted, so the graph is a hyperbola.";
    } else {
      const c = pick(r, [4, 8, -4, -8, 12, -12] as const);
      eq =
        r(0, 1) === 0
          ? `${sq("x", h)}=${c}(${shift("y", k)})`
          : `${sq("y", k)}=${c}(${shift("x", h)})`;
      reason =
        "Only one variable is squared and the other appears to the first power, so the graph is a parabola.";
    }
    return {
      variant,
      prompt: `What kind of conic section is the graph of $${eq}$?`,
      hint: `Check which variables are squared in $${eq}$. If both are, look at the sign between the squared terms and whether their denominators or coefficients are equal.`,
      explanation: [
        `Check which variables are squared and how the squared terms are combined.`,
        reason,
        `The graph is ${kind === "ellipse" ? "an" : "a"} ${NAMES[kind].toLowerCase()}.`,
      ],
      correct: NAMES[kind],
      wrong: (Object.keys(NAMES) as Conic[])
        .filter((c) => c !== kind)
        .map((c) => [NAMES[c], WHY[kind][c]] as Wrong),
    };
  }
  if (variant === 1 || variant === 2) {
    const [h, k] = hk();
    let a: number, b: number;
    do {
      a = r(2, 6);
      b = r(2, 6);
    } while (a === b);
    const eq = `${frac2(sq("x", h), a * a)}+${frac2(sq("y", k), b * b)}=1`;
    if (variant === 1) {
      return {
        variant,
        prompt: `Find the center of the ellipse $${eq}$.`,
        hint: `The center is the point that makes both squared expressions zero. Which $x$ makes $${shift("x", h)}$ equal 0, and which $y$ makes $${shift("y", k)}$ equal 0?`,
        explanation: [
          `$${shift("x", h)}=0$ when $x=${h}$.`,
          `$${shift("y", k)}=0$ when $y=${k}$.`,
          `The center is $${pt(h, k)}$.`,
        ],
        correct: M(pt(h, k)),
        wrong: [
          [
            M(pt(-h, -k)),
            "The sign inside the parentheses is opposite to the coordinate: $x+3$ means $x=-3$.",
          ],
          [M(pt(k, h)), "The center is $(h,k)$ with $x$-coordinate first."],
          [
            M(pt(a * a, b * b)),
            "The denominators set the size of the ellipse, not its center.",
          ],
          [
            M(pt(-k, -h)),
            "Read $x$ from the $x$ term, and use the opposite sign of what appears inside.",
          ],
        ],
      };
    }
    const wide = a > b;
    const L = wide ? a : b;
    const ends = (d: number, horiz: boolean) =>
      horiz
        ? `${M(pt(h - d, k))} and ${M(pt(h + d, k))}`
        : `${M(pt(h, k - d))} and ${M(pt(h, k + d))}`;
    const S = wide ? b : a;
    return {
      variant,
      prompt: `The ellipse $${eq}$ has a longer axis. Which points are the ends of its longer axis?`,
      hint: `In $${eq}$, compare the denominators under $(x...)^2$ and $(y...)^2$. The longer axis lies along the variable with the larger denominator, and its ends are the square root of that denominator away from the center.`,
      explanation: [
        `The denominators are ${a * a} (under $x$) and ${b * b} (under $y$). The larger is ${L * L}, under $${wide ? "x" : "y"}$, so the longer axis is ${wide ? "horizontal" : "vertical"}.`,
        `Its half-length is $\\sqrt{${L * L}}=${L}$, measured from the center $${pt(h, k)}$.`,
        `The ends are ${ends(L, wide)}.`,
      ],
      correct: ends(L, wide),
      wrong: [
        [
          ends(S, wide),
          "That uses the shorter half-length. The longer axis uses the larger denominator's square root.",
        ],
        [
          ends(L * L, wide),
          "Take the square root of the denominator to find the distance from the center.",
        ],
        [
          ends(L, !wide),
          "The longer axis lies along the variable with the larger denominator.",
        ],
        [ends(S, !wide), "Those are the ends of the shorter axis."],
      ],
    };
  }
  if (variant === 3) {
    const [h, k] = hk();
    const r2 = pick(r, [4, 5, 9, 10, 16, 20, 25] as const);
    const D = -2 * h;
    const E = -2 * k;
    const F = h * h + k * k - r2;
    const gen = `x^2+y^2${D === 0 ? "" : `${D < 0 ? "-" : "+"}${Math.abs(D) === 1 ? "" : Math.abs(D)}x`}${E < 0 ? "-" : "+"}${Math.abs(E)}y${F === 0 ? "" : `${F < 0 ? "-" : "+"}${Math.abs(F)}`}=0`;
    const lbl = (x: number, y: number, rad: string) =>
      `Center ${M(pt(x, y))}, radius ${M(rad)}`;
    const wrongR = h * h + k * k + F;
    return {
      variant,
      prompt: `Complete the square to find the center and radius of the circle $${gen}$.`,
      hint: `Group the $x$ terms and the $y$ terms of $${gen}$, move ${F === 0 ? "nothing" : "the constant term"} to the right side, and add the square of half the $x$ coefficient and the square of half the $y$ coefficient to both sides.`,
      explanation: [
        `Group: $(x^2${D < 0 ? "-" : "+"}${Math.abs(D)}x)+(y^2${E < 0 ? "-" : "+"}${Math.abs(E)}y)=${-F}$.`,
        `Add $(${D / 2})^2=${h * h}$ and $(${E / 2})^2=${k * k}$ to both sides: $${sq("x", h)}+${sq("y", k)}=${r2}$.`,
        `The center is $${pt(h, k)}$ and the radius is $\\sqrt{${r2}}=${sqrtTex(r2)}$.`,
      ],
      correct: lbl(h, k, sqrtTex(r2)),
      wrong: [
        [
          lbl(-h, -k, sqrtTex(r2)),
          "The center has the opposite sign of the number inside the parentheses: $x-3$ gives $x=3$.",
        ],
        [
          lbl(h, k, String(r2)),
          "The right side is $r^2$. Take its square root for the radius.",
        ],
        [
          lbl(2 * h, 2 * k, sqrtTex(r2)),
          "Half of the coefficient gives the shift, not the whole coefficient.",
        ],
        ...(wrongR > 0
          ? [
              [
                lbl(h, k, sqrtTex(wrongR)),
                "Move the constant to the right side with its sign changed before taking the square root.",
              ] as Wrong,
            ]
          : []),
      ],
    };
  }
  const [h, k] = hk();
  const [A, B] = pick(r, [
    [4, 9],
    [9, 4],
    [1, 4],
    [4, 1],
    [2, 3],
    [3, 2],
    [1, 9],
    [9, 1],
  ] as const);
  const D = -2 * A * h;
  const E = -2 * B * k;
  const K = pick(r, [4, 8, 12, 16, 36] as const);
  const F = A * h * h + B * k * k - K;
  const coef = (c: number, v: string, first: boolean) =>
    c === 0
      ? ""
      : `${c < 0 ? "-" : first ? "" : "+"}${Math.abs(c) === 1 ? "" : Math.abs(c)}${v}`;
  const gen = `${coef(A, "x^2", true)}${coef(B, "y^2", false)}${coef(D, "x", false)}${coef(E, "y", false)}${F === 0 ? "" : `${F < 0 ? "-" : "+"}${Math.abs(F)}`}=0`;
  return {
    variant: 4,
    prompt: `The graph of $${gen}$ is an ellipse. Complete the square in $x$ and in $y$ to find its center.`,
    hint: `Group the $x$ terms and factor out ${A === 1 ? "the coefficient 1" : `${A}`}, then do the same for the $y$ terms with ${B}. Complete each square inside its own parentheses.`,
    explanation: [
      `Factor each variable's coefficient: $${A}(x^2${D / A < 0 ? "-" : "+"}${Math.abs(D / A)}x)+${B}(y^2${E / B < 0 ? "-" : "+"}${Math.abs(E / B)}y)=${-F}$.`,
      `Complete each square: $${A}${sq("x", h)}+${B}${sq("y", k)}=${-F + A * h * h + B * k * k}$. The added amounts are multiplied by ${A} and ${B} on the right.`,
      `The center is where both squared expressions are zero: $${pt(h, k)}$.`,
    ],
    correct: M(pt(h, k)),
    wrong: [
      [
        M(pt(-h, -k)),
        "The center has the opposite sign of the number inside the parentheses.",
      ],
      [
        M(pt(A * h, B * k)),
        "Factor out the leading coefficients first. Half of the linear coefficient is $\\frac{D}{2A}$, not $\\frac{D}{2}$.",
      ],
      [
        M(pt(2 * h, 2 * k)),
        "The shift is half the coefficient after factoring out the leading coefficient.",
      ],
      [
        M(pt(-A * h, -B * k)),
        "Divide by the leading coefficient before halving.",
      ],
    ],
  };
}

// ----------------------------------------------------------------- parabolas
function parabolaCase(r: Random): Spec {
  const variant = r(0, 4);
  const h = r(-5, 5);
  const k = nonzero(r, 5);
  const p = nonzero(r, 4);
  const eqn = (hh: number, kk: number, c: number, horizontal = false) =>
    horizontal
      ? `${sq("y", kk)}=${c}${kk === undefined ? "" : hh === 0 ? "x" : `(${shift("x", hh)})`}`
      : `${sq("x", hh)}=${c}${kk === 0 ? "y" : `(${shift("y", kk)})`}`;
  const focusY = k + p;
  const directrixY = k - p;
  const line = (n: number) => `y=${n}`;
  if (variant === 0) {
    return {
      variant,
      prompt: `A parabola has focus $${pt(h, focusY)}$ and directrix $${line(directrixY)}$. Choose its equation.`,
      hint: `The vertex is halfway between the focus and the directrix. Find the midpoint of the $y$-values ${focusY} and ${directrixY}, then find $p$, the signed distance from the vertex to the focus.`,
      explanation: [
        `The vertex is the midpoint of the focus and the directrix: $(${h}, \\frac{${focusY}+(${directrixY})}{2})=${pt(h, k)}$.`,
        `$p$ is the distance from the vertex to the focus, positive when the focus is above the vertex: $p=${focusY}-(${k})=${p}$.`,
        `$(x-h)^2=4p(y-k)$ gives $${eqn(h, k, 4 * p)}$.`,
      ],
      correct: M(eqn(h, k, 4 * p)),
      wrong: [
        [
          M(eqn(h, k, -4 * p)),
          "The sign of $p$ is positive when the focus is above the vertex and negative when it is below.",
        ],
        [
          M(eqn(h, focusY, 4 * p)),
          "The vertex is halfway between the focus and the directrix, not at the focus.",
        ],
        [
          M(eqn(h, k, 8 * p)),
          "$p$ is the distance from the vertex to the focus, which is half the distance from focus to directrix.",
        ],
        [
          M(eqn(-h, k, 4 * p)),
          "The $x$-coordinate of the vertex is the focus's $x$-coordinate, entered as $x-h$.",
        ],
        [M(eqn(h, k, 2 * p)), "The coefficient is $4p$, not $2p$."],
      ],
    };
  }
  if (variant === 1) {
    return {
      variant,
      prompt: `A parabola has focus $${pt(h, focusY)}$ and directrix $${line(directrixY)}$. What is its vertex?`,
      hint: `Every point on the parabola is equally far from the focus and the directrix, so the vertex lies halfway between them along the axis of symmetry. Here the focus height is ${focusY} and the directrix height is ${directrixY}.`,
      explanation: [
        `The axis of symmetry is the vertical line through the focus, $x=${h}$.`,
        `The vertex is halfway between $y=${focusY}$ and $y=${directrixY}$: $\\frac{${focusY}+(${directrixY})}{2}=${k}$.`,
        `The vertex is $${pt(h, k)}$.`,
      ],
      correct: M(pt(h, k)),
      wrong: [
        [
          M(pt(h, focusY)),
          "The focus is not on the parabola. The vertex is halfway to the directrix.",
        ],
        [
          M(pt(h, directrixY)),
          "The directrix is outside the parabola. The vertex is halfway between it and the focus.",
        ],
        [
          M(pt(h, focusY + directrixY)),
          "Average the two $y$-values: divide the sum by 2.",
        ],
        [
          M(pt(h, p)),
          "$p$ is a distance, not a coordinate. Take the midpoint of the two $y$-values.",
        ],
        [
          M(pt(h, k + 2 * p)),
          "The vertex lies between the focus and the directrix, so it is not beyond the focus.",
        ],
        [
          M(pt(h, 2 * p)),
          "The distance from focus to directrix is not a coordinate. The vertex is halfway along the axis.",
        ],
        [M(pt(k, h)), "The $x$-coordinate is the focus's $x$-coordinate."],
      ],
    };
  }
  if (variant === 2) {
    const form = r(0, 1) === 0 || h !== 0 || k !== 0;
    const eq = eqn(h, k, 4 * p);
    return {
      variant,
      prompt: `Find the focus of the parabola $${form ? eq : `x^2=${4 * p}y`}$.`,
      hint: `Compare $${form ? eq : `x^2=${4 * p}y`}$ with $(x-h)^2=4p(y-k)$. The vertex is $(h,k)$, the number in front of the $y$ bracket is $4p$, and the focus is $p$ units from the vertex along the axis of symmetry.`,
      explanation: [
        `Match $(x-h)^2=4p(y-k)$: the vertex is $${pt(h, k)}$ and $4p=${4 * p}$, so $p=${p}$.`,
        `The parabola opens ${p > 0 ? "upward" : "downward"}, so the focus is $p$ units ${p > 0 ? "above" : "below"} the vertex.`,
        `The focus is $${pt(h, focusY)}$.`,
      ],
      correct: M(pt(h, focusY)),
      wrong: [
        [
          M(pt(h, k + 4 * p)),
          "The number in front is $4p$. Divide by 4 to find $p$.",
        ],
        [
          M(pt(h, directrixY)),
          "That is on the directrix side. The focus is inside the curve.",
        ],
        [
          M(pt(-h, focusY)),
          "The vertex's $x$-coordinate is the opposite of the number inside $(x\\pm h)$.",
        ],
        [
          M(pt(h + p, k)),
          "The focus is along the axis of symmetry, which is vertical for $(x-h)^2=4p(y-k)$.",
        ],
        [
          M(pt(h, k - 4 * p)),
          "Divide the coefficient by 4 and add to the vertex's $y$-coordinate.",
        ],
      ],
    };
  }
  if (variant === 3) {
    return {
      variant,
      prompt: `Find the equation of the directrix of the parabola $${eqn(h, k, 4 * p)}$.`,
      hint: `In $${eqn(h, k, 4 * p)}$, the vertex is $(h,k)$ and $4p$ is the coefficient of the $y$ bracket. The directrix is a horizontal line $p$ units from the vertex on the side away from the focus.`,
      explanation: [
        `The vertex is $${pt(h, k)}$ and $4p=${4 * p}$, so $p=${p}$.`,
        `The focus is ${p > 0 ? "above" : "below"} the vertex, so the directrix is $|p|=${Math.abs(p)}$ units ${p > 0 ? "below" : "above"} it: $y=${k}-(${p})$.`,
        `The directrix is $${line(directrixY)}$.`,
      ],
      correct: M(line(directrixY)),
      wrong: [
        [
          M(line(focusY)),
          "That is the horizontal line through the focus. The directrix is on the opposite side of the vertex.",
        ],
        [M(line(k - 4 * p)), "Use $p$, not $4p$."],
        [
          M(line(-p)),
          "The directrix is $p$ units from the vertex, so start from $k$.",
        ],
        [
          M(line(-k - p)),
          "Measure from the vertex's $y$-coordinate $k$, not from $-k$.",
        ],
      ],
    };
  }
  const horizontalEq = eqn(h, k, 4 * p, true);
  return {
    variant: 4,
    prompt: `The parabola $${horizontalEq}$ has a horizontal axis of symmetry, so the roles of $x$ and $y$ are exchanged: $(y-k)^2=4p(x-h)$. Find its focus.`,
    hint: `Match the equation to $(y-k)^2=4p(x-h)$ to find the vertex and $4p$. The focus lies $p$ units from the vertex along the horizontal axis of symmetry.`,
    explanation: [
      `The vertex is $${pt(h, k)}$ and $4p=${4 * p}$, so $p=${p}$.`,
      `The axis of symmetry is horizontal, so the focus moves $p$ units ${p > 0 ? "right" : "left"} from the vertex.`,
      `The focus is $${pt(h + p, k)}$.`,
    ],
    correct: M(pt(h + p, k)),
    wrong: [
      [
        M(pt(h, k + p)),
        "This parabola opens sideways, so the focus is displaced horizontally.",
      ],
      [
        M(pt(h - p, k)),
        "A positive $p$ means the focus is to the right of the vertex.",
      ],
      [M(pt(h + 4 * p, k)), "The coefficient is $4p$; divide by 4 first."],
      [M(pt(k + p, h)), "The vertex is $(h,k)$ with $x$ first."],
    ],
  };
}

// ------------------------------------------------------------------ dispatch
const builders: Record<string, (r: Random) => Spec> = {
  "complex-plane-forms": planeCase,
  "complex-conjugate-division": conjugateCase,
  "complex-distance-midpoint": distanceCase,
  "complex-quadratic-factors": factorCase,
  "polynomial-root-count": rootCountCase,
  "polar-cartesian-conversion": polarCase,
  "parametric-linear-motion": parametricCase,
  "conic-standard-form": conicCase,
  "parabola-focus-directrix": parabolaCase,
};
/** Number of deliberate variants per template, for coverage tests. */
export const complexConicsVariantCounts: Record<string, number> = {
  "complex-plane-forms": 5,
  "complex-conjugate-division": 5,
  "complex-distance-midpoint": 5,
  "complex-quadratic-factors": 5,
  "polynomial-root-count": 5,
  "polar-cartesian-conversion": 4,
  "parametric-linear-motion": 5,
  "conic-standard-form": 5,
  "parabola-focus-directrix": 5,
};

export function complexConicsCase(id: string, seed: string) {
  const template = byId.get(id);
  if (!template) throw new Error(`Unknown template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  return finish(template, seed, r, builders[id]!(r));
}
export const generateComplexConicsProblem = (id: string, seed: string) =>
  complexConicsCase(id, seed).problem;
