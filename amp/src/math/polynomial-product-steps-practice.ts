import type { TemplateMetadata } from "./contracts";
import { chainFamily, dispatch } from "./chain-kit";
import { workModeAxisNoOrder } from "./structured-work-kit";
import { rowsWork, workSurface, type RowSpec } from "./structured-work-rows";
import { defineAxis } from "./variation/axes";

/**
 * Multiply polynomials with the written work a rating guide credits: each
 * partial product is its own typed step, then the like terms are combined
 * and the product is entered as its coefficients from the highest power down,
 * which is standard form and cannot be an unexpanded product. Every step is
 * graded exactly on the server.
 */

const capability = "structured-work-v1" as const;
export const polynomialProductTemplates: readonly TemplateMetadata[] = [
  {
    id: "polynomial-product-steps",
    version: 1,
    title: "Show the work: multiply polynomials",
    skillId: "polynomial-arithmetic",
    gradeBand: "9–12",
    difficultyOffset: 0.3,
    requiredResponseCapability: capability,
    description:
      "Multiply two binomials, square a binomial or multiply a binomial and a trinomial, typing each partial product and entering the coefficients of the product from the highest power down.",
  },
];

/** Coefficients from the highest power down, e.g. [2, -3, 4] is 2x²−3x+4. */
type Poly = number[];
/** Input syntax: "2x^2-3x+4". */
function text(p: Poly): string {
  const top = p.length - 1;
  let out = "";
  p.forEach((c, i) => {
    if (c === 0) return;
    const d = top - i;
    const mag = Math.abs(c);
    const body =
      d === 0 ? `${mag}` : `${mag === 1 ? "" : mag}x${d === 1 ? "" : `^${d}`}`;
    out += c < 0 ? `-${body}` : out ? `+${body}` : body;
  });
  return out || "0";
}
/** TeX of the same polynomial. */
const tex = (p: Poly) => text(p).replace(/\^(\d)/g, "^{$1}");
const mul = (a: Poly, b: Poly): Poly => {
  const out = Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j]! += x * y)));
  return out;
};
/** "3+(-5)" written as "3-5". */
const sum = (u: number, v: number) => `${u}${v < 0 ? "" : "+"}${v}`;
const scale = (p: Poly, k: number): Poly => p.map((c) => c * k);

type Shape = "binomials" | "squared-binomial" | "binomial-trinomial";
interface Model {
  shape: Shape;
  f: Poly; // first factor (binomial)
  g: Poly; // second factor
}
const nonzero = (
  r: (lo: number, hi: number) => number,
  lo: number,
  hi: number,
) => {
  const v = r(lo, hi);
  return v === 0 ? hi : v;
};

const coef = (value: string, unit?: string) =>
  ({
    caption: "Coefficient",
    kind: "number" as const,
    value,
    ...(unit ? { unit } : {}),
  }) as const;

const family = chainFamily({
  template: polynomialProductTemplates[0]!,
  axes: {
    mode: workModeAxisNoOrder,
    factors: defineAxis("factors", [
      "binomials",
      "squared-binomial",
      "binomial-trinomial",
    ] as const),
  },
  model: (r, axes): Model => {
    const a = r(1, 3);
    const b = nonzero(r, -7, 7);
    if (axes.factors === "squared-binomial") {
      if (a === 1 && Math.abs(b) === 1) throw new Error("Need three retry");
      return { shape: axes.factors, f: [a, b], g: [a, b] };
    }
    if (axes.factors === "binomials") {
      const c = r(1, 3);
      const d = nonzero(r, -7, 7);
      if (a * d + b * c === 0) throw new Error("Need three retry");
      return { shape: axes.factors, f: [a, b], g: [c, d] };
    }
    const c = r(1, 2);
    const d = nonzero(r, -6, 6);
    const e = nonzero(r, -6, 6);
    const p = mul([a, b], [c, d, e]);
    if (p.some((x) => x === 0)) throw new Error("Need three retry");
    return { shape: axes.factors, f: [a, b], g: [c, d, e] };
  },
  render: (m, axes, r) => {
    const product = mul(m.f, m.g);
    const [a, b] = m.f as [number, number];
    let rows: RowSpec[];
    let route: string[];
    if (m.shape === "binomial-trinomial") {
      const top = text(scale(m.g, a).concat(0));
      const bottom = text(scale(m.g, b));
      rows = [
        {
          label: `$${m.f[0] === 1 ? "" : m.f[0]}x$ times each term of the second factor`,
          fields: [
            {
              caption: "Expression",
              kind: "expression",
              value: top,
              variables: ["x"],
              powers: true,
              maxLength: 24,
            },
          ],
        },
        {
          label: `$${b}$ times each term of the second factor`,
          fields: [
            {
              caption: "Expression",
              kind: "expression",
              value: bottom,
              variables: ["x"],
              powers: true,
              maxLength: 24,
            },
          ],
        },
        {
          label: "Coefficients of $x^3$ and $x^2$ in the product",
          fields: [coef(`${product[0]}`, "x³"), coef(`${product[1]}`, "x²")],
        },
        {
          label: "Coefficient of $x$ and the constant term of the product",
          fields: [coef(`${product[2]}`, "x"), coef(`${product[3]}`)],
        },
      ];
      route = [
        `$${m.f[0] === 1 ? "" : m.f[0]}x\\cdot(${tex(m.g)})=${tex(scale(m.g, a).concat(0))}$.`,
        `$${b}\\cdot(${tex(m.g)})=${tex(scale(m.g, b))}$.`,
        `Add the $x^2$ terms: $${sum(m.g[1]! * a, m.g[0]! * b)}=${product[1]}$. Add the $x$ terms: $${sum(m.g[2]! * a, m.g[1]! * b)}=${product[2]}$.`,
        `In standard form the product is $${tex(product)}$, so the coefficients from the highest power down are $${product.join(", ")}$.`,
      ];
    } else {
      const [c, d] = m.g as [number, number];
      const first = a * c;
      const outer = a * d;
      const inner = b * c;
      const last = b * d;
      rows = [
        {
          label: "Product of the first terms",
          fields: [
            {
              caption: "Expression",
              kind: "expression",
              value: text([first, 0, 0]),
              variables: ["x"],
              powers: true,
              maxLength: 12,
            },
          ],
        },
        {
          label: "Product of the outer terms",
          fields: [
            {
              caption: "Expression",
              kind: "expression",
              value: text([outer, 0]),
              variables: ["x"],
              powers: true,
              maxLength: 12,
            },
          ],
        },
        {
          label: "Product of the inner terms",
          fields: [
            {
              caption: "Expression",
              kind: "expression",
              value: text([inner, 0]),
              variables: ["x"],
              powers: true,
              maxLength: 12,
            },
          ],
        },
        {
          label: "Coefficients of $x^2$ and $x$ in the product",
          fields: [coef(`${product[0]}`, "x²"), coef(`${product[1]}`, "x")],
        },
        {
          label: "Constant term of the product",
          fields: [coef(`${product[2]}`)],
        },
      ];
      route = [
        `First $\\times$ first: $${tex([first, 0, 0])}$. Outer: $${tex([outer, 0])}$. Inner: $${tex([inner, 0])}$. Last $\\times$ last: $${last}$, the constant term.`,
        `Add the $x$ terms: $${outer}x${inner < 0 ? "" : "+"}${inner}x=${outer + inner}x$.`,
        `In standard form the product is $${tex(product)}$, so the coefficients from the highest power down are $${product.join(", ")}$.`,
      ];
    }
    const built = rowsWork(rows, axes.mode, r, "Your work");
    const factors =
      m.shape === "squared-binomial"
        ? `$(${tex(m.f)})^2$`
        : `$(${tex(m.f)})(${tex(m.g)})$`;
    const task =
      axes.mode === "build"
        ? "Enter each step."
        : "Some steps are filled in. Enter the others.";
    const terms = m.g.length;
    const sign = b < 0 ? ` Keep the negative sign with $${b}$.` : "";
    return workSurface(built, {
      prompt: `Multiply ${factors} and write the product in standard form. After the partial products, enter the coefficients of the product from the highest power down. ${task}`,
      hint:
        m.shape === "binomial-trinomial"
          ? `Each of the 2 terms of $${tex(m.f)}$ multiplies each of the 3 terms of $${tex(m.g)}$, giving 6 products. Multiply one term of the first factor by the whole second factor, then the other.${sign}`
          : m.shape === "squared-binomial"
            ? `Squaring means multiplying $${tex(m.f)}$ by itself, so every term meets every term: first, outer, inner and last. Squaring does not square each term alone: the outer and inner products appear too.${sign}`
            : `Each of the 2 terms of $${tex(m.f)}$ multiplies each of the ${terms} terms of $${tex(m.g)}$: first, outer, inner, last, then combine like terms.${sign}`,
      explanation: [...route],
    });
  },
  variant: (m) => m.shape,
});

export const polynomialProductGenerate = dispatch(polynomialProductTemplates, {
  "polynomial-product-steps": (seed) => family.generate(seed).problem,
});
export const polynomialProductCases = {
  "polynomial-product-steps": family.generate,
};
