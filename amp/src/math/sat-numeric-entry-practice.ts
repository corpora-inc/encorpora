import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { assemble, random } from "./distribution-practice";

/**
 * SAT student-produced-response practice. The learner types an exact integer,
 * fraction or terminating decimal; the existing exact-rational numeric grader
 * accepts every equivalent form (0.5, .5, 1/2, 2/4). No choice list is shown.
 */
type R = (lo: number, hi: number) => number;
type Q = [number, number];
type Case = {
  variant: string;
  prompt: string;
  answer: Q;
  hint: string;
  explanation: string[];
  /** Private givens, used by independent checks. */
  data: Record<string, number | string>;
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const q = (n: number, d = 1): Q => {
  if (!d) throw new Error("Zero denominator");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const qs = ([n, d]: Q) => (d === 1 ? `${n}` : `${n}/${d}`);
const tex = ([n, d]: Q) =>
  d === 1 ? `${n}` : `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
const par = (x: Q) => (x[0] < 0 ? `(${tex(x)})` : tex(x));
const terminating = ([, d]: Q) => {
  let x = d;
  while (x % 2 === 0) x /= 2;
  while (x % 5 === 0) x /= 5;
  return x === 1;
};
const nzr = (r: R) => (m: number) => r(1, m) * (r(0, 1) ? 1 : -1);

function lin(terms: [number, string][]): string {
  let out = "";
  for (const [c, s] of terms) {
    if (!c) continue;
    const mag = Math.abs(c);
    const body = s === "" ? `${mag}` : mag === 1 ? s : `${mag}${s}`;
    out +=
      out === ""
        ? c < 0
          ? `-${body}`
          : body
        : ` ${c < 0 ? "-" : "+"} ${body}`;
  }
  return out || "0";
}
const poly = (cs: number[], v = "x") =>
  lin(
    cs.map((c, i): [number, string] => {
      const d = cs.length - 1 - i;
      return [c, d === 0 ? "" : d === 1 ? v : `${v}^${d}`];
    }),
  );
/** A binomial factor (p x - m), written without parentheses when it is just x. */
const fac = (p: number, m: number) =>
  p === 1 && m === 0
    ? "x"
    : `(${lin([
        [p, "x"],
        [-m, ""],
      ])})`;
const eq = (a: number, b: number, c: number) =>
  `${lin([
    [a, "x"],
    [b, "y"],
  ])} = ${c}`;

function meta(
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
): TemplateMetadata {
  return {
    id,
    version: 1,
    title,
    skillId,
    gradeBand: "9–12",
    difficultyOffset,
    description,
  };
}

// ------------------------------------------------------------ 2x2 systems
function systemSolve(r: R): Case {
  const variant = r(0, 3);
  const nz = nzr(r);
  for (let tries = 0; tries < 2000; tries++) {
    const ask = r(0, 1) ? "x" : "y";
    let a1: number, b1: number, a2: number, b2: number, c1: number, c2: number;
    if (variant === 2) {
      [a1, b1, a2, b2] = [nz(5), nz(5), nz(5), nz(5)];
      [c1, c2] = [r(-12, 12), r(-12, 12)];
    } else {
      const coef = variant === 0 ? () => r(1, 4) : () => nz(5);
      [a1, b1, a2, b2] = [coef(), coef(), coef(), coef()];
      let sx: number, sy: number;
      if (variant === 0) [sx, sy] = [r(1, 6), r(1, 6)];
      else if (variant === 1) [sx, sy] = [nz(7), nz(7)];
      else {
        const other = nz(6);
        [sx, sy] = ask === "x" ? [0, other] : [other, 0];
      }
      c1 = a1 * sx + b1 * sy;
      c2 = a2 * sx + b2 * sy;
    }
    const det = a1 * b2 - a2 * b1;
    if (!det) continue;
    const answer =
      ask === "x" ? q(c1 * b2 - c2 * b1, det) : q(a1 * c2 - a2 * c1, det);
    if (
      variant === 2 &&
      (answer[1] === 1 || answer[1] > 25 || Math.abs(answer[0]) > 60)
    )
      continue;
    const e1 = eq(a1, b1, c1);
    const e2 = eq(a2, b2, c2);
    const other = ask === "x" ? "y" : "x";
    const [m1, m2] = ask === "x" ? [b2, b1] : [a2, a1];
    const [k1, k2] = ask === "x" ? [a1 * b2, a2 * b1] : [a1 * a2, a1 * a2];
    const [l1, l2] = ask === "x" ? [b1 * b2, b1 * b2] : [a2 * b1, a1 * b2];
    const scaled1 = `${lin([
      [k1, "x"],
      [l1, "y"],
    ])} = ${m1 * c1}`;
    const scaled2 = `${lin([
      [k2, "x"],
      [l2, "y"],
    ])} = ${m2 * c2}`;
    const num = ask === "x" ? m1 * c1 - m2 * c2 : m2 * c2 - m1 * c1;
    return {
      variant: `${["integer", "signed", "fractional", "zero"][variant]}-${ask}`,
      prompt: `In the system of equations $${e1}$ and $${e2}$, what is the value of $${ask}$?`,
      answer,
      hint: `In $${e1}$ and $${e2}$, the $${other}$ coefficients are ${ask === "x" ? `${b1} and ${b2}` : `${a1} and ${a2}`}. Multiply each equation so the $${other}$ terms match, then subtract to leave one equation in $${ask}$.`,
      explanation: [
        `To eliminate $${other}$, multiply the first equation by ${m1} and the second by ${m2}: $${scaled1}$ and $${scaled2}$.`,
        ask === "x"
          ? `Subtract the second from the first: $${det}${ask}=${num}$.`
          : `Subtract the first from the second: $${det}${ask}=${num}$.`,
        `Divide by ${det}: $${ask}=${tex(answer)}$.`,
      ],
      data: { a1, b1, c1, a2, b2, c2, ask },
    };
  }
  throw new Error("No system case");
}

function systemExpression(r: R): Case {
  const variant = r(0, 3);
  const nz = nzr(r);
  for (let tries = 0; tries < 2000; tries++) {
    const [a, b, d, e] = [nz(5), nz(5), nz(5), nz(5)];
    if (a * e - b * d === 0) continue;
    const [c, f] = [nz(9), nz(9)];
    let lam = 1;
    let mu = 1;
    let den = 1;
    if (variant === 1) mu = -1;
    if (variant === 2) [lam, mu] = [nz(3), nz(3)];
    if (variant === 3) den = 2;
    const p = (lam * a + mu * d) / den;
    const s = (lam * b + mu * e) / den;
    if (!Number.isInteger(p) || !Number.isInteger(s) || (!p && !s)) continue;
    if (variant === 3 && (c + f) % 2 === 0) continue;
    if (variant === 2 && Math.abs(lam) === 1 && Math.abs(mu) === 1) continue;
    const answer = q(lam * c + mu * f, den);
    const e1 = eq(a, b, c);
    const e2 = eq(d, e, f);
    const expr = lin([
      [p, "x"],
      [s, "y"],
    ]);
    const how =
      variant === 0
        ? "Add the two equations."
        : variant === 1
          ? "Subtract the second equation from the first."
          : variant === 2
            ? `Multiply the first equation by ${lam} and the second by ${mu}, then add.`
            : "Add the two equations, then divide both sides by 2.";
    return {
      variant: ["sum", "difference", "multiples", "half-sum"][variant]!,
      prompt: `If $${e1}$ and $${e2}$, what is the value of $${expr}$?`,
      answer,
      hint: `Do not solve for $x$ and $y$ first. Compare the coefficients ${p} of $x$ and ${s} of $y$ in $${expr}$ with the coefficients in $${e1}$ and $${e2}$, and look for a sum, difference or multiple of the equations that produces them.`,
      explanation: [
        `${how} The left side becomes $${lin([
          [lam * a + mu * d, "x"],
          [lam * b + mu * e, "y"],
        ])}$${den === 2 ? ", which is twice the expression" : ""}.`,
        `Do the same to the right sides: $${lam}\\cdot(${c})+(${mu})\\cdot(${f})=${lam * c + mu * f}$.`,
        `So $${expr}=${tex(answer)}$.`,
      ],
      data: { a, b, c, d, e, f, p, s },
    };
  }
  throw new Error("No expression case");
}

// ------------------------------------------------------------- quadratics
function quadraticSolution(r: R): Case {
  const variant = r(0, 3);
  const nz = nzr(r);
  if (variant === 0 || variant === 2) {
    let r1 = nz(9);
    let r2 = nz(9);
    while (r1 === r2) r2 = nz(9);
    const sum = r1 + r2;
    const prod = r1 * r2;
    const greater = Math.max(r1, r2);
    const standard = poly([1, -sum, prod]);
    const answer = q(greater);
    if (variant === 0)
      return {
        variant: "monic-greater",
        prompt: `What is the greater solution of $${standard}=0$?`,
        answer,
        hint: `Find two numbers whose product is ${prod} and whose sum is ${-sum}. They give the constants in the two factors of $${standard}$.`,
        explanation: [
          `Look for two numbers with product ${prod} and sum ${-sum}: ${-r1} and ${-r2}.`,
          `So $${standard}=(x${r1 > 0 ? "-" : "+"}${Math.abs(r1)})(x${r2 > 0 ? "-" : "+"}${Math.abs(r2)})=0$.`,
          `The solutions are $x=${r1}$ and $x=${r2}$. The greater is ${greater}.`,
        ],
        data: { coeffs: `1,${-sum},${prod}`, ask: "greater" },
      };
    return {
      variant: "rearranged-greater",
      prompt: `What is the greater solution of $${poly([1, -sum, 0])}=${-prod}$?`,
      answer,
      hint: `The equation is not yet equal to 0. ${prod > 0 ? `Add ${prod}` : `Subtract ${-prod}`} on both sides, then factor the quadratic.`,
      explanation: [
        `${prod > 0 ? `Add ${prod}` : `Subtract ${-prod}`} on both sides: $${standard}=0$.`,
        `The numbers ${-r1} and ${-r2} multiply to ${prod} and add to ${-sum}, so $(x${r1 > 0 ? "-" : "+"}${Math.abs(r1)})(x${r2 > 0 ? "-" : "+"}${Math.abs(r2)})=0$.`,
        `The solutions are ${r1} and ${r2}; the greater is ${greater}.`,
      ],
      data: { coeffs: `1,${-sum},${prod}`, ask: "greater" },
    };
  }
  if (variant === 1) {
    let n: number, d: number;
    do {
      d = r(2, 4);
      n = r(1, 7);
    } while (gcd(n, d) !== 1);
    const m = r(1, 6);
    const cs = [d, d * m - n, -n * m];
    const answer = q(n, d);
    return {
      variant: "nonmonic-positive",
      prompt: `What is the positive solution of $${poly(cs)}=0$?`,
      answer,
      hint: `The leading coefficient is ${d}, so try factoring into two binomials whose first terms multiply to $${d}x^2$ and whose last terms multiply to ${-n * m}. Set each factor equal to 0.`,
      explanation: [
        `Factor: $${poly(cs)}=(${lin([
          [d, "x"],
          [-n, ""],
        ])})(x+${m})$, because $${d}x\\cdot x=${d}x^2$, $(-${n})(${m})=${-n * m}$, and the middle term is $${d}\\cdot${m}x-${n}x=${d * m - n}x$.`,
        `Set each factor equal to 0: $x=${tex(answer)}$ or $x=-${m}$.`,
        `Only $${tex(answer)}$ is positive.`,
      ],
      data: { coeffs: cs.join(","), ask: "positive" },
    };
  }
  // Perfect square: exactly one solution, possibly negative or fractional.
  const d = r(1, 4);
  const n = nz(7);
  const cs = [d * d, -2 * d * n, n * n];
  const answer = q(n, d);
  return {
    variant: "single-solution",
    prompt: `The equation $${poly(cs)}=0$ has exactly one real solution. What is it?`,
    answer,
    hint: `One solution means the left side is a perfect square. The first term is $(${d}x)^2$ and the last is $${n * n}=${Math.abs(n)}^2$; match the middle term to choose the sign in $(${d}x\\pm${Math.abs(n)})^2$.`,
    explanation: [
      `Since $(${d}x)^2=${d * d}x^2$, $${Math.abs(n)}^2=${n * n}$, and $2(${d}x)(${-n})=${-2 * d * n}x$, the left side is $(${lin(
        [
          [d, "x"],
          [-n, ""],
        ],
      )})^2$.`,
      `A square is 0 only when its base is 0: $${lin([
        [d, "x"],
        [-n, ""],
      ])}=0$.`,
      `Therefore $x=${tex(answer)}$.`,
    ],
    data: { coeffs: cs.join(","), ask: "only" },
  };
}

function rootRelations(r: R): Case {
  const variant = r(0, 3);
  for (let tries = 0; tries < 2000; tries++) {
    const a = variant === 0 ? r(2, 5) : r(1, 5);
    const b = r(-12, 12);
    const c = r(1, 12) * (r(0, 1) ? 1 : -1);
    if (b * b - 4 * a * c <= 0) continue;
    if (variant === 0 && b % a === 0) continue;
    const e = poly([a, b, c]);
    const common = `The equation $${e}=0$ has two distinct real solutions, $p$ and $q$.`;
    const vieta = `Here $a=${a}$, $b=${b}$ and $c=${c}$. Since $ax^2+bx+c=a(x-p)(x-q)=ax^2-a(p+q)x+a(pq)$, matching coefficients gives $p+q=\\frac{-b}{a}=${tex(q(-b, a))}$ and $pq=\\frac{c}{a}=${tex(q(c, a))}$.`;
    if (variant === 0)
      return {
        variant: "sum",
        prompt: `${common} What is the value of $p+q$?`,
        answer: q(-b, a),
        hint: `You do not need $p$ or $q$ themselves. Expand $${a}(x-p)(x-q)$ and compare its $x$ coefficient with ${b}.`,
        explanation: [vieta, `So $p+q=${tex(q(-b, a))}$.`],
        data: { a, b, c, ask: "sum" },
      };
    if (variant === 1)
      return {
        variant: "product",
        prompt: `${common} What is the value of $pq$?`,
        answer: q(c, a),
        hint: `Expand $${a}(x-p)(x-q)$. Its constant term is $${a}pq$; compare it with ${c}.`,
        explanation: [vieta, `So $pq=${tex(q(c, a))}$.`],
        data: { a, b, c, ask: "product" },
      };
    if (variant === 2)
      return {
        variant: "reciprocal-sum",
        prompt: `${common} What is the value of $\\frac{1}{p}+\\frac{1}{q}$?`,
        answer: q(-b, c),
        hint: `Combine $\\frac1p+\\frac1q$ over a common denominator, then rewrite the numerator and denominator using the sum and product of the solutions.`,
        explanation: [
          vieta,
          `$\\frac1p+\\frac1q=\\frac{p+q}{pq}=\\frac{${tex(q(-b, a))}}{${tex(q(c, a))}}=${tex(q(-b, c))}$.`,
        ],
        data: { a, b, c, ask: "reciprocal-sum" },
      };
    const answer = q(b * b - 2 * a * c, a * a);
    return {
      variant: "sum-of-squares",
      prompt: `${common} What is the value of $p^2+q^2$?`,
      answer,
      hint: `Write $p^2+q^2=(p+q)^2-2pq$, then find $p+q$ and $pq$ from the coefficients.`,
      explanation: [
        vieta,
        `$p^2+q^2=(p+q)^2-2pq=\\left(${tex(q(-b, a))}\\right)^2-2\\left(${tex(q(c, a))}\\right)=${tex(answer)}$.`,
      ],
      data: { a, b, c, ask: "sum-of-squares" },
    };
  }
  throw new Error("No root-relations case");
}

// ------------------------------------------- absolute value, radicals, rational
function absoluteEquation(r: R): Case {
  const variant = r(0, 3);
  const nz = nzr(r);
  if (variant === 0) {
    const h = r(-9, 9);
    const k = r(1, 9);
    const answer = q(h + k);
    return {
      variant: "greater-solution",
      prompt: `What is the greater solution of $|${lin([
        [1, "x"],
        [-h, ""],
      ])}|=${k}$?`,
      answer,
      hint: `The distance from $x$ to ${h} is ${k}. Split into $${lin([
        [1, "x"],
        [-h, ""],
      ])}=${k}$ and $${lin([
        [1, "x"],
        [-h, ""],
      ])}=-${k}$.`,
      explanation: [
        `The expression inside the bars is ${k} or $-${k}$.`,
        `$x=${h}+${k}=${h + k}$ or $x=${h}-${k}=${h - k}$.`,
        `The greater solution is ${h + k}.`,
      ],
      data: { kind: "distance", h, k },
    };
  }
  if (variant === 1) {
    const p = r(2, 5);
    const s = nz(9);
    const k = r(1, 12);
    const answer = q(-2 * s, p);
    return {
      variant: "sum-of-solutions",
      prompt: `What is the sum of the solutions of $|${lin([
        [p, "x"],
        [s, ""],
      ])}|=${k}$?`,
      answer,
      hint: `Write the two equations $${lin([
        [p, "x"],
        [s, ""],
      ])}=${k}$ and $${lin([
        [p, "x"],
        [s, ""],
      ])}=-${k}$, solve each, then add the two solutions.`,
      explanation: [
        `$${lin([
          [p, "x"],
          [s, ""],
        ])}=${k}$ gives $x=${tex(q(k - s, p))}$; $${lin([
          [p, "x"],
          [s, ""],
        ])}=-${k}$ gives $x=${tex(q(-k - s, p))}$.`,
        `Their sum is $${par(q(k - s, p))}+${par(q(-k - s, p))}=${tex(answer)}$.`,
      ],
      data: { kind: "sum", p, s, k },
    };
  }
  if (variant === 2) {
    for (let tries = 0; tries < 2000; tries++) {
      const h = nz(8);
      const m = [2, 3, -2, -3][r(0, 3)]!;
      const k = nz(8);
      const x1 = q(h + k, 1 - m);
      const x2 = q(h - k, 1 + m);
      const rhs = (x: Q) => m * (x[0] / x[1]) + k;
      const valid1 = rhs(x1) > 1e-9;
      const valid2 = rhs(x2) > 1e-9;
      if (valid1 === valid2) continue;
      const good = valid1 ? x1 : x2;
      const bad = valid1 ? x2 : x1;
      const right = lin([
        [m, "x"],
        [k, ""],
      ]);
      const left = lin([
        [1, "x"],
        [-h, ""],
      ]);
      return {
        variant: "reject-extraneous",
        prompt: `What is the solution of $|${left}|=${right}$?`,
        answer: good,
        hint: `Split into $${left}=${right}$ and $${lin([
          [-1, "x"],
          [h, ""],
        ])}=${right}$ and solve each. Then substitute both answers: an absolute value is never negative, so the right side must be at least 0.`,
        explanation: [
          `Case 1: $${left}=${right}$ gives $x=${tex(x1)}$. Case 2: $${lin([
            [-1, "x"],
            [h, ""],
          ])}=${right}$ gives $x=${tex(x2)}$.`,
          `Check $x=${tex(bad)}$: the right side is $${tex(q(m * bad[0] + k * bad[1], bad[1]))}$, which is negative, so it cannot equal an absolute value.`,
          `Check $x=${tex(good)}$: both sides equal $${tex(q(m * good[0] + k * good[1], good[1]))}$. The only solution is $${tex(good)}$.`,
        ],
        data: { kind: "extraneous", h, m, k },
      };
    }
    throw new Error("No absolute case");
  }
  let h = nz(9);
  let t = nz(9);
  while (t === h) t = nz(9);
  const answer = q(h + t, 2);
  return {
    variant: "equal-distances",
    prompt: `The equation $|${lin([
      [1, "x"],
      [-h, ""],
    ])}|=|${lin([
      [1, "x"],
      [-t, ""],
    ])}|$ has exactly one solution. What is it?`,
    answer,
    hint: `Equal absolute values mean the two expressions are equal or opposite. One of the two resulting equations has no solution; solve the other.`,
    explanation: [
      `Equal expressions: $${lin([
        [1, "x"],
        [-h, ""],
      ])}=${lin([
        [1, "x"],
        [-t, ""],
      ])}$ has no solution because ${h} and ${t} differ.`,
      `Opposite expressions: $${lin([
        [1, "x"],
        [-h, ""],
      ])}=-(${lin([
        [1, "x"],
        [-t, ""],
      ])})$, so $2x=${h + t}$.`,
      `Thus $x=${tex(answer)}$, the point halfway between ${h} and ${t}.`,
    ],
    data: { kind: "equal-distances", h, t },
  };
}

function radicalEquation(r: R): Case {
  const variant = r(0, 3);
  const nz = nzr(r);
  if (variant === 2) {
    const k = [2, 4, 5][r(0, 2)]!;
    const n = r(1, 9);
    const a = r(-8, 8);
    const x = q(n * n - a * k * k, k * k);
    return {
      variant: "isolate-root",
      prompt: `What is the solution of $${k}\\sqrt{${lin([
        [1, "x"],
        [a, ""],
      ])}}=${n}$?`,
      answer: x,
      hint: `Divide both sides by ${k} to isolate the square root, then square both sides.`,
      explanation: [
        `Divide by ${k}: $\\sqrt{${lin([
          [1, "x"],
          [a, ""],
        ])}}=${tex(q(n, k))}$.`,
        `Square both sides: $${lin([
          [1, "x"],
          [a, ""],
        ])}=${tex(q(n * n, k * k))}$.`,
        `So $x=${tex(x)}$. The right side before squaring is positive, so this value works.`,
      ],
      data: { kind: "isolate", k, n, a },
    };
  }
  for (let tries = 0; tries < 5000; tries++) {
    const c = nz(5);
    const r1 = r(-8, 9);
    const r2 = r(-8, 9);
    if (r1 === r2) continue;
    const a = 2 * c + r1 + r2;
    const b = c * c - r1 * r2;
    if (!a || Math.abs(a) > 25 || Math.abs(b) > 40) continue;
    const ok1 = r1 + c >= 0;
    const ok2 = r2 + c >= 0;
    if (variant === 0 && !(ok1 && !ok2)) continue;
    if (variant === 1 && !(ok1 && ok2)) continue;
    if (variant === 3 && !(r1 + c === 0 && !ok2)) continue;
    const radicand = lin([
      [a, "x"],
      [b, ""],
    ]);
    const right = lin([
      [1, "x"],
      [c, ""],
    ]);
    const squared = poly([1, 2 * c - a, c * c - b]);
    const quad = `${fac(1, r1)}${fac(1, r2)}`;
    const common = [
      `Square both sides: $${radicand}=(${right})^2$, so $${squared}=0$.`,
      `Factor: $${quad}=0$, so the candidates are $x=${r1}$ and $x=${r2}$.`,
    ];
    if (variant === 1)
      return {
        variant: "sum-both-valid",
        prompt: `What is the sum of all real solutions of $\\sqrt{${radicand}}=${right}$?`,
        answer: q(r1 + r2),
        hint: `Square both sides to get a quadratic, then solve it. Check each candidate in the original equation: the right side $${right}$ must not be negative.`,
        explanation: [
          ...common,
          `At $x=${r1}$ the right side is ${r1 + c} and at $x=${r2}$ it is ${r2 + c}. Neither is negative, so both candidates are solutions.`,
          `Their sum is ${r1 + r2}.`,
        ],
        data: { kind: "both", a, b, c, ask: "sum" },
      };
    const good = ok1 ? r1 : r2;
    const bad = ok1 ? r2 : r1;
    return {
      variant: variant === 0 ? "reject-extraneous" : "zero-right-side",
      prompt: `What is the solution of $\\sqrt{${radicand}}=${right}$?`,
      answer: q(good),
      hint: `Square both sides to get a quadratic and solve it. Then test each candidate in the original equation: a square root is never negative, so $${right}$ must be at least 0.`,
      explanation: [
        ...common,
        `At $x=${bad}$ the right side is ${bad + c}, which is negative, so ${bad} is extraneous.`,
        `At $x=${good}$ the right side is ${good + c}, which is not negative, and both sides agree. The solution is ${good}.`,
      ],
      data: { kind: "extraneous", a, b, c, ask: "solution" },
    };
  }
  throw new Error("No radical case");
}

function rationalEquation(r: R): Case {
  const variant = r(0, 2);
  const nz = nzr(r);
  if (variant === 1) {
    for (let tries = 0; tries < 5000; tries++) {
      const [a, b, s, t] = [nz(6), nz(6), nz(6), nz(6)];
      const den = a - t - b + s;
      if (!den || s === t || a === b) continue;
      const x = q(a * t - b * s, den);
      if (x[1] === 1 || x[1] > 12) continue;
      if ((x[0] === s * x[1] && x[1] === 1) || (x[0] === t && x[1] === 1))
        continue;
      return {
        variant: "cross-multiply",
        prompt: `What is the solution of $\\frac{${lin([
          [1, "x"],
          [a, ""],
        ])}}{${lin([
          [1, "x"],
          [-s, ""],
        ])}}=\\frac{${lin([
          [1, "x"],
          [b, ""],
        ])}}{${lin([
          [1, "x"],
          [-t, ""],
        ])}}$?`,
        answer: x,
        hint: `Neither denominator may be 0, so $x\\ne${s}$ and $x\\ne${t}$. Cross-multiply, expand both products, and notice that the $x^2$ terms cancel.`,
        explanation: [
          `Cross-multiply: $(${lin([
            [1, "x"],
            [a, ""],
          ])})(${lin([
            [1, "x"],
            [-t, ""],
          ])})=(${lin([
            [1, "x"],
            [b, ""],
          ])})(${lin([
            [1, "x"],
            [-s, ""],
          ])})$.`,
          `Expand: $${poly([1, a - t, -a * t])}=${poly([1, b - s, -b * s])}$. The $x^2$ terms cancel, leaving $${den}x=${a * t - b * s}$.`,
          `So $x=${tex(x)}$, which is not ${s} or ${t}, so no denominator is 0.`,
        ],
        data: { kind: "cross", a, b, s, t },
      };
    }
    throw new Error("No cross-multiply case");
  }
  for (let tries = 0; tries < 5000; tries++) {
    const r1 = nz(8);
    const r2 = nz(8);
    if (r1 === r2) continue;
    const s = variant === 0 ? r2 : nz(8);
    if (variant === 2 && (s === r1 || s === r2)) continue;
    const num = poly([1, -(r1 + r2), r1 * r2]);
    const den = lin([
      [1, "x"],
      [-s, ""],
    ]);
    const factors = `(x${r1 < 0 ? "+" : "-"}${Math.abs(r1)})(x${r2 < 0 ? "+" : "-"}${Math.abs(r2)})`;
    if (variant === 0)
      return {
        variant: "reject-excluded",
        prompt: `What is the solution of $\\frac{${num}}{${den}}=0$?`,
        answer: q(r1),
        hint: `A fraction is 0 only when its numerator is 0 and its denominator is not 0. Factor the numerator, then compare each root with the value that makes $${den}$ equal 0.`,
        explanation: [
          `Factor the numerator: $${num}=${factors}$, so the numerator is 0 at $x=${r1}$ and $x=${r2}$.`,
          `The denominator $${den}$ is 0 at $x=${s}$, so ${s} is not allowed.`,
          `The only solution is ${r1}.`,
        ],
        data: { kind: "excluded", r1, r2, s },
      };
    return {
      variant: "sum-both-valid",
      prompt: `What is the sum of all real solutions of $\\frac{${num}}{${den}}=0$?`,
      answer: q(r1 + r2),
      hint: `A fraction is 0 only when its numerator is 0 and its denominator is not 0. Factor the numerator and check whether either root makes $${den}$ equal 0.`,
      explanation: [
        `Factor the numerator: $${num}=${factors}$, so the numerator is 0 at $x=${r1}$ and $x=${r2}$.`,
        `The denominator is 0 only at $x=${s}$, which is neither root, so both are solutions.`,
        `Their sum is ${r1 + r2}.`,
      ],
      data: { kind: "two-roots", r1, r2, s },
    };
  }
  throw new Error("No rational case");
}

function polynomialZeros(r: R): Case {
  const variant = r(0, 3);
  const nz = nzr(r);
  const distinct = (n: number, m: number) => {
    const out: number[] = [];
    while (out.length < n) {
      const v = nz(m);
      if (!out.includes(v)) out.push(v);
    }
    return out;
  };
  const lead = () => [1, 2, 3, -1, -2][r(0, 4)]!;
  const fx = (k: number, parts: string) =>
    `${k === 1 ? "" : k === -1 ? "-" : k}${parts}`;
  const rootFac = (z: number) => fac(1, z);
  if (variant === 0) {
    const z = [...distinct(2, 8), r(0, 1) ? 0 : nz(8)];
    if (new Set(z).size < 3) z[2] = 9;
    const k = lead();
    const least = Math.min(...z);
    const f = z.map(rootFac).join("");
    return {
      variant: "least-zero",
      prompt: `What is the least zero of $f(x)=${fx(k, f)}$?`,
      answer: q(least),
      hint: `A product is 0 only when one of its factors is 0. Set each factor of $f(x)$ equal to 0 and compare the three zeros.`,
      explanation: [
        `The factors ${z.map((v) => `$${rootFac(v)}$`).join(", ")} are 0 at ${z.join(", ")}. The constant ${k} never equals 0.`,
        `The least zero is ${least}.`,
      ],
      data: { zeros: z.join(","), ask: "least" },
    };
  }
  if (variant === 1) {
    const [a, b, c] = distinct(3, 8) as [number, number, number];
    const k = lead();
    return {
      variant: "sum-distinct-repeated",
      prompt: `What is the sum of the distinct real zeros of $f(x)=${fx(k, `${rootFac(a)}^2${rootFac(b)}${rootFac(c)}`)}$?`,
      answer: q(a + b + c),
      hint: `Set each factor equal to 0. A repeated factor gives one zero, not two, so list each zero once before adding.`,
      explanation: [
        `The zeros are ${a} (from the squared factor), ${b} and ${c}.`,
        `The distinct zeros are ${a}, ${b} and ${c}; adding gives ${a + b + c}.`,
      ],
      data: { zeros: [a, b, c].join(","), ask: "sum" },
    };
  }
  if (variant === 2) {
    let n: number, d: number;
    do {
      d = r(2, 5);
      n = r(1, 9);
    } while (gcd(n, d) !== 1);
    const m = r(1, 8);
    const k = lead();
    return {
      variant: "fractional-positive",
      prompt: `What is the positive zero of $f(x)=${fx(
        k,
        `x(${lin([
          [d, "x"],
          [-n, ""],
        ])})(x+${m})`,
      )}$?`,
      answer: q(n, d),
      hint: `Set each factor equal to 0. For $${lin([
        [d, "x"],
        [-n, ""],
      ])}=0$, add ${n} and divide by ${d}.`,
      explanation: [
        `The factors are 0 at $x=0$, $x=${tex(q(n, d))}$ and $x=-${m}$.`,
        `Only $${tex(q(n, d))}$ is positive.`,
      ],
      data: { zeros: `0,${n}/${d},${-m}`, ask: "positive" },
    };
  }
  let a = nz(8);
  let b = nz(8);
  while (b === a) b = nz(8);
  const kk = r(1, 9);
  return {
    variant: "no-real-zero-factor",
    prompt: `What is the sum of all real zeros of $f(x)=(x${a < 0 ? "+" : "-"}${Math.abs(a)})(x^2+${kk})(x${b < 0 ? "+" : "-"}${Math.abs(b)})$?`,
    answer: q(a + b),
    hint: `Set each factor equal to 0. For $x^2+${kk}=0$, ask whether any real number squared can equal $-${kk}$.`,
    explanation: [
      `$x${a < 0 ? "+" : "-"}${Math.abs(a)}=0$ gives $x=${a}$ and $x${b < 0 ? "+" : "-"}${Math.abs(b)}=0$ gives $x=${b}$.`,
      `$x^2+${kk}=0$ would need $x^2=-${kk}$, but a real square is never negative, so this factor gives no real zero.`,
      `The sum of the real zeros is ${a + b}.`,
    ],
    data: { zeros: `${a},${b}`, ask: "sum" },
  };
}

// --------------------------------------------------------- contexts and rates
function quadraticContext(r: R): Case {
  const variant = r(0, 3);
  const a = [1, 2, 4, 5, 8][r(0, 4)]!;
  if (variant === 2) {
    const T = r(5, 10);
    const s = r(1, 4);
    const cs = [-a, a * (T - s), a * s * T];
    return {
      variant: "landing-time",
      prompt: `A ball is thrown upward from a platform. Its height, in meters, $t$ seconds after the throw is $h(t)=${poly(cs, "t")}$. It lands on the ground when $h(t)=0$ for $t>0$. How many seconds after the throw does it land?`,
      answer: q(T),
      hint: `Set $h(t)=0$ and factor out $-${a}$ from the three terms. Then find two numbers whose product and sum match the remaining quadratic.`,
      explanation: [
        `Factor out $-${a}$: $h(t)=-${a}\\left(${poly([1, -(T - s), -s * T], "t")}\\right)$.`,
        `Since ${s} and $-${T}$ multiply to $-${s * T}$ and add to $-${T - s}$, this is $-${a}(t+${s})(t-${T})$.`,
        `The zeros are $t=-${s}$ and $t=${T}$. Only a positive time makes sense, so the ball lands after ${T} seconds.`,
      ],
      data: { kind: "landing", a, b: a * (T - s), c: a * s * T },
    };
  }
  const b = variant === 3 ? r(3, 15) : r(2, 20);
  const c = variant === 3 ? 0 : r(1, 30);
  const cs = [-a, b, c];
  const h = poly(cs, "t");
  const setup = `A ball is hit upward. Its height, in meters, $t$ seconds after it is hit is $h(t)=${h}$ for $t\\ge0$ until it lands.`;
  const tMax = q(b, 2 * a);
  const hMax = q(4 * a * c + b * b, 4 * a);
  if (variant === 0)
    return {
      variant: "time-at-maximum",
      prompt: `${setup} At what time, in seconds, is the ball at its greatest height?`,
      answer: tMax,
      hint: `The graph of $h$ is a parabola opening downward, so its highest point is at the axis of symmetry $t=\\frac{-b}{2a}$. Use $a=-${a}$ and $b=${b}$.`,
      explanation: [
        `With $a=-${a}$ and $b=${b}$, the greatest height occurs at $t=\\frac{-${b}}{2(-${a})}$.`,
        `$t=${tex(tMax)}$ seconds.`,
      ],
      data: { a, b, c, ask: "time" },
    };
  if (variant === 1)
    return {
      variant: "maximum-height",
      prompt: `${setup} What is the greatest height, in meters, that the ball reaches?`,
      answer: hMax,
      hint: `The greatest height is the value of $h$ at the axis of symmetry $t=\\frac{-b}{2a}$. Find that time first, then substitute it into $h(t)$.`,
      explanation: [
        `The axis of symmetry is $t=\\frac{-${b}}{2(-${a})}=${tex(tMax)}$.`,
        `Substitute: $h(${tex(tMax)})=${tex(hMax)}$.`,
        `The greatest height is $${tex(hMax)}$ meters.`,
      ],
      data: { a, b, c, ask: "height" },
    };
  return {
    variant: "maximum-from-ground",
    prompt: `${setup} What is the greatest height, in meters, that the ball reaches?`,
    answer: hMax,
    hint: `The ball starts at height 0. Its highest point is halfway between the two times when $h(t)=0$, so find those times first (factor out $t$).`,
    explanation: [
      `Factor: $h(t)=t(${lin([
        [-a, "t"],
        [b, ""],
      ])})$, which is 0 at $t=0$ and $t=${tex(q(b, a))}$.`,
      `The highest point is halfway between: $t=${tex(tMax)}$.`,
      `$h(${tex(tMax)})=${tex(hMax)}$, so the greatest height is $${tex(hMax)}$ meters.`,
    ],
    data: { a, b, c, ask: "height" },
  };
}

function rateNumeric(r: R): Case {
  const variant = r(0, 4);
  if (variant <= 2) {
    for (let tries = 0; tries < 5000; tries++) {
      const a = r(2, 30);
      const b = r(2, 30);
      if (variant === 2 && b <= a) continue;
      const answer = variant === 2 ? q(a * b, b - a) : q(a * b, a + b);
      if (variant === 0 && answer[1] !== 1) continue;
      if (variant !== 0 && (answer[1] === 1 || !terminating(answer))) continue;
      if (variant === 1 && a === b) continue;
      if (variant === 2)
        return {
          variant: "fill-and-drain",
          prompt: `A pool is filled by one pipe in ${a} hours and emptied by a drain in ${b} hours when that pipe is closed. With the pool empty, the pipe and drain both run at their constant rates. How many hours does it take to fill the pool?`,
          answer,
          hint: `Write each rate as a fraction of the pool per hour: the pipe adds $\\frac1{${a}}$, the drain removes $\\frac1{${b}}$. The net rate is their difference.`,
          explanation: [
            `Net rate: $\\frac1{${a}}-\\frac1{${b}}=\\frac{${b - a}}{${a * b}}$ of the pool per hour.`,
            `Time = 1 pool divided by the rate: $\\frac{${a * b}}{${b - a}}$, which is $${tex(answer)}$ hours in lowest terms.`,
          ],
          data: { kind: "fill-drain", a, b },
        };
      return {
        variant: variant === 0 ? "combined-integer" : "combined-decimal",
        prompt: `Working alone, one machine finishes a job in ${a} hours and a second machine finishes the same job in ${b} hours. Working together at these constant rates, how many hours do they need to finish the job?`,
        answer,
        hint: `Write each rate as a fraction of the job per hour: $\\frac1{${a}}$ and $\\frac1{${b}}$. Add the rates, then divide 1 job by the combined rate.`,
        explanation: [
          `Combined rate: $\\frac1{${a}}+\\frac1{${b}}=\\frac{${a + b}}{${a * b}}$ of the job per hour.`,
          `Time = 1 job divided by the rate: $\\frac{${a * b}}{${a + b}}$, which is $${tex(answer)}$ hours in lowest terms.`,
        ],
        data: { kind: "combined", a, b },
      };
    }
    throw new Error("No rate case");
  }
  if (variant === 3) {
    for (let tries = 0; tries < 5000; tries++) {
      const p = r(5, 20);
      const t1 = r(2, 6);
      const rate2 = [2, 4, 5, 8, 10, 16, 20, 25][r(0, 7)]!;
      const total = p * t1 + r(1, 90);
      const rest = q(total - p * t1, rate2);
      const answer = q(t1 * rate2 + total - p * t1, rate2);
      if (!terminating(answer)) continue;
      return {
        variant: "two-phase",
        prompt: `A tank is empty. For the first ${t1} minutes a pump adds ${p} liters per minute. Then a second pump replaces it and adds ${rate2} liters per minute. How many minutes after the start does the tank hold ${total} liters?`,
        answer,
        hint: `Find how much water is in the tank when the second pump takes over, then ask how many more liters are needed and how long that takes at ${rate2} liters per minute.`,
        explanation: [
          `After ${t1} minutes the tank holds ${p} × ${t1} = ${p * t1} liters.`,
          `${total - p * t1} more liters at ${rate2} liters per minute take $${tex(rest)}$ minutes ($\\frac{${total - p * t1}}{${rate2}}$ in lowest terms).`,
          `Total time: $${t1}+${tex(rest)}=${tex(answer)}$ minutes.`,
        ],
        data: { kind: "two-phase", p, t1, rate2, total },
      };
    }
    throw new Error("No two-phase case");
  }
  for (let tries = 0; tries < 5000; tries++) {
    const p1 = r(1, 8) * 5;
    const pt = p1 + r(1, 6) * 5;
    const p2 = pt + r(1, 6) * 5;
    if (p2 > 95) continue;
    const A = r(4, 20);
    const answer = q(A * (pt - p1), p2 - pt);
    if (!terminating(answer)) continue;
    return {
      variant: "mixture",
      prompt: `How many liters of a ${p2}% acid solution must be added to ${A} liters of a ${p1}% acid solution to make a ${pt}% acid solution?`,
      answer,
      hint: `Let $z$ be the liters added. The acid before mixing and after mixing must be equal: ${p1}% of ${A} liters plus ${p2}% of $z$ liters equals ${pt}% of $(${A}+z)$ liters.`,
      explanation: [
        `Acid balance: $${p1 / 100}(${A})+${p2 / 100}z=${pt / 100}(${A}+z)$.`,
        `Collect $z$: $${(p2 - pt) / 100}z=${(pt - p1) / 100}(${A})$.`,
        `So $z=${tex(answer)}$ liters.`,
      ],
      data: { kind: "mixture", p1, pt, p2, A },
    };
  }
  throw new Error("No mixture case");
}

// ----------------------------------------------- radians and integer inequalities
function radianConversion(r: R): Case {
  const variant = r(0, 3);
  if (variant === 1) {
    for (;;) {
      const d = [2, 3, 4, 5, 6, 9, 10, 12][r(0, 7)]!;
      const n = r(1, 2 * d + 1);
      if (gcd(n, d) !== 1) continue;
      const degrees = (180 * n) / d;
      return {
        variant: "radians-to-degrees",
        prompt: `An angle measures $\\frac{${n === 1 ? "" : n}\\pi}{${d}}$ radians. What is its measure in degrees?`,
        answer: q(degrees),
        hint: `A half turn is $\\pi$ radians, which is 180 degrees. Replace $\\pi$ by 180 and simplify.`,
        explanation: [
          `Since $\\pi$ radians $=180^\\circ$, multiply by $\\frac{180}{\\pi}$.`,
          `$\\frac{${n === 1 ? "" : n}\\pi}{${d}}\\cdot\\frac{180}{\\pi}=\\frac{${180 * n}}{${d}}=${degrees}$ degrees.`,
        ],
        data: { kind: "to-degrees", n, d },
      };
    }
  }
  const options =
    variant === 0
      ? Array.from({ length: 23 }, (_, i) => 15 * (i + 1))
      : variant === 2
        ? Array.from({ length: 23 }, (_, i) => -15 * (i + 1))
        : Array.from({ length: 24 }, (_, i) => 375 + 15 * i);
  const deg = options[r(0, options.length - 1)]!;
  const answer = q(deg, 180);
  return {
    variant: ["degrees-to-radians", "", "negative-angle", "beyond-full-turn"][
      variant
    ]!,
    prompt: `An angle measures $${deg}^\\circ$. In radians its measure is $k\\pi$. What is the value of $k$?`,
    answer,
    hint: `A half turn is 180 degrees, which is $\\pi$ radians. Write ${deg} degrees as a fraction of 180 degrees.`,
    explanation: [
      `Since $180^\\circ=\\pi$ radians, multiply by $\\frac{\\pi}{180}$.`,
      `$${deg}\\cdot\\frac{\\pi}{180}=\\frac{${deg}}{180}\\pi=${tex(answer)}\\pi$.`,
      `So $k=${tex(answer)}$.`,
    ],
    data: { kind: "to-radians", deg },
  };
}

function inequalityInteger(r: R): Case {
  const variant = r(0, 3);
  const nz = nzr(r);
  const floorQ = ([n, d]: Q) => Math.floor(n / d);
  if (variant === 0) {
    const a = r(2, 9);
    const b = nz(15);
    let c = r(-20, 40);
    while ((c - b) % a === 0) c = r(-20, 40);
    const bound = q(c - b, a);
    return {
      variant: "greatest-integer",
      prompt: `What is the greatest integer $x$ that satisfies $${lin([
        [a, "x"],
        [b, ""],
      ])}\\le ${c}$?`,
      answer: q(floorQ(bound)),
      hint: `Subtract ${b} from both sides and divide by ${a}. The solutions are all numbers up to a boundary; the answer is the greatest integer that does not pass it.`,
      explanation: [
        `Subtract ${b}: $${a}x\\le ${c - b}$. Divide by ${a}: $x\\le ${tex(bound)}$.`,
        `The greatest integer not exceeding $${tex(bound)}$ is ${floorQ(bound)}.`,
      ],
      data: { kind: "greatest", a, b, c },
    };
  }
  if (variant === 1) {
    const a = r(2, 9);
    const b = nz(15);
    const bound = r(-8, 12);
    const c = a * bound + b;
    return {
      variant: "strict-boundary",
      prompt: `What is the greatest integer $x$ that satisfies $${lin([
        [a, "x"],
        [b, ""],
      ])}< ${c}$?`,
      answer: q(bound - 1),
      hint: `Solve for $x$ first. The inequality is strict, so check whether the boundary value itself is allowed.`,
      explanation: [
        `Subtract ${b}: $${a}x< ${c - b}$. Divide by ${a}: $x< ${bound}$.`,
        `The boundary ${bound} is not allowed because the inequality is strict, so the greatest integer is ${bound - 1}.`,
      ],
      data: { kind: "strict", a, b, c },
    };
  }
  if (variant === 2) {
    const a = r(2, 9);
    const b = nz(20);
    const c = nz(20);
    const bound = q(b - c, a);
    const least = floorQ(bound) + 1;
    return {
      variant: "negative-coefficient-least",
      prompt: `What is the least integer $x$ that satisfies $${lin([
        [-a, "x"],
        [b, ""],
      ])}< ${c}$?`,
      answer: q(least),
      hint: `Subtract ${b} from both sides, then divide by $-${a}$. Dividing by a negative number reverses the direction of the inequality.`,
      explanation: [
        `Subtract ${b}: $-${a}x< ${c - b}$.`,
        `Divide by $-${a}$ and reverse the sign: $x> ${tex(bound)}$.`,
        `The least integer greater than $${tex(bound)}$ is ${least}.`,
      ],
      data: { kind: "least", a, b, c },
    };
  }
  const a = r(2, 8);
  const b = r(1, 15);
  const c = r(b - 3, b + 60);
  const bound = q(c - b, a);
  const count = Math.max(0, floorQ(bound));
  return {
    variant: "count-positive-integers",
    prompt: `How many positive integers $x$ satisfy $${lin([
      [a, "x"],
      [b, ""],
    ])}\\le ${c}$?`,
    answer: q(count),
    hint: `Solve for $x$ first, then list the positive integers up to the boundary. If the boundary is below 1, there are none.`,
    explanation: [
      `Subtract ${b}: $${a}x\\le ${c - b}$. Divide by ${a}: $x\\le ${tex(bound)}$.`,
      count === 0
        ? `No positive integer is at most $${tex(bound)}$, so the count is 0.`
        : count === 1
          ? `The only positive integer up to $${tex(bound)}$ is 1, so the count is 1.`
          : `The positive integers up to $${tex(bound)}$ are 1 through ${count}, so there are ${count}.`,
    ],
    data: { kind: "count", a, b, c },
  };
}

// ----------------------------------------------------------------- registry
const defs: { template: TemplateMetadata; make: (r: R) => Case }[] = [
  {
    template: meta(
      "sat-entry-system-solve",
      "Enter a variable from a 2×2 system",
      "linear-systems",
      0.5,
      "Solve a two-variable linear system and enter the exact value of x or y as an integer, fraction or decimal.",
    ),
    make: systemSolve,
  },
  {
    template: meta(
      "sat-entry-system-expression",
      "Enter the value of an expression from a system",
      "linear-systems",
      0.55,
      "Combine two linear equations to find the numeric value of an expression in x and y without solving for each variable.",
    ),
    make: systemExpression,
  },
  {
    template: meta(
      "sat-entry-quadratic-solution",
      "Enter a quadratic solution",
      "quadratic-equations",
      0.4,
      "Solve a quadratic by factoring or recognizing a perfect square and enter the greater, positive or only solution.",
    ),
    make: quadraticSolution,
  },
  {
    template: meta(
      "sat-entry-root-relations",
      "Enter a sum or product of quadratic solutions",
      "quadratic-equations",
      0.6,
      "Use the coefficients of a quadratic to enter a sum, product, reciprocal sum or sum of squares of its two solutions.",
    ),
    make: rootRelations,
  },
  {
    template: meta(
      "sat-entry-absolute-equation",
      "Enter an absolute-value solution",
      "absolute-value-equations",
      0.45,
      "Solve an absolute-value equation, rejecting extraneous candidates where needed, and enter a solution or a sum of solutions.",
    ),
    make: absoluteEquation,
  },
  {
    template: meta(
      "sat-entry-radical-equation",
      "Enter a radical-equation solution",
      "radical-equations",
      0.5,
      "Square a radical equation, test each candidate in the original equation and enter the valid solution or sum of solutions.",
    ),
    make: radicalEquation,
  },
  {
    template: meta(
      "sat-entry-rational-equation",
      "Enter a rational-equation solution",
      "rational-equations",
      0.5,
      "Solve a rational equation, excluding values that make a denominator 0, and enter the solution or sum of solutions.",
    ),
    make: rationalEquation,
  },
  {
    template: meta(
      "sat-entry-polynomial-zeros",
      "Enter a zero of a factored polynomial",
      "polynomial-zeros",
      0.4,
      "Read real zeros from a factored polynomial and enter the least, positive or distinct-sum value.",
    ),
    make: polynomialZeros,
  },
  {
    template: meta(
      "sat-entry-quadratic-context",
      "Enter a quadratic-model value",
      "nonlinear-equation-modeling",
      0.6,
      "Use a quadratic height model to enter the time of greatest height, the greatest height or the landing time.",
    ),
    make: quadraticContext,
  },
  {
    template: meta(
      "sat-entry-rate-numeric",
      "Enter a combined-rate or mixture value",
      "linear-equation-modeling",
      0.6,
      "Combine work, fill and drain, two-phase and mixture rates exactly and enter the numeric answer.",
    ),
    make: rateNumeric,
  },
  {
    template: meta(
      "sat-entry-radian-conversion",
      "Enter a degree-radian conversion",
      "radians-unit-circle",
      0.45,
      "Convert between degrees and radians and enter the degree measure or the coefficient k in k·π.",
    ),
    make: radianConversion,
  },
  {
    template: meta(
      "sat-entry-inequality-integer",
      "Enter an integer satisfying an inequality",
      "linear-inequalities",
      0.4,
      "Solve a one-variable linear inequality and enter the greatest or least integer solution, or the count of positive integer solutions.",
    ),
    make: inequalityInteger,
  },
];

export const satNumericEntryTemplates: readonly TemplateMetadata[] = defs.map(
  (d) => d.template,
);

/** Private exact model; the public problem carries only prompt, hint and response protocol. */
export function satNumericEntryCase(id: string, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const def = defs.find((d) => d.template.id === id);
  if (!def) throw new Error(`Unknown SAT numeric-entry template ${id}`);
  const r = random(id, seed);
  const made = def.make(r);
  const problem: GeneratedProblem = assemble(def.template, seed, r, {
    prompt: made.prompt,
    answer: qs(made.answer),
    fraction: true,
    hint: made.hint,
    explanation: made.explanation,
  });
  // Grading metadata only: the public problem and its id are unchanged.
  problem.entryPolicy = "sat-spr";
  return { ...made, problem };
}

export function generateSatNumericEntryProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return satNumericEntryCase(id, seed).problem;
}

/** True when a template's problems carry a non-exact entry policy. */
export const hasEntryPolicy = (templateId: string): boolean =>
  defs.some((d) => d.template.id === templateId);
