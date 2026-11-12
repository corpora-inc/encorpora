import { withArticle } from "./agreement";
import type { TemplateMetadata } from "./contracts";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  gcd,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { shuffle } from "./distribution-practice";
import { defineAxis, type Random } from "./variation/axes";
import type { Surface } from "./variation/compose";

/**
 * HSN.RN.A.1: why a fraction exponent is a root. If the power of a power
 * law $(x^p)^q=x^{pq}$ is to keep working for $p=\frac1n$, then
 * $(b^{1/n})^n=b$, so $b^{1/n}$ must be $\sqrt[n]{b}$; and
 * $b^{m/n}=(b^{1/n})^m$ by the same law. Three single-choice types assess
 * the argument: supply a reason, a missing line or the order of the lines;
 * test rival definitions and find the first false line of a flawed
 * argument; choose the correct and complete explanation.
 *
 * Bases are positive. Every option is checked by value for the drawn
 * numbers: a distractor that happens to be true (as $\frac{4}{2}=\sqrt{4}$
 * makes "divide by the index" true for $b=4$, $n=2$) is redrawn.
 */

const choice = { requiredResponseCapability: "single-choice-v1" as const };
const band = "9–12" as const;
const senses = {
  root: "root-radical",
  roots: "root-radical",
  base: "base-exponent",
};
const noLink = [
  "power",
  "law",
  "laws",
  "index",
  "line",
  "lines",
  "square",
  "cube",
];

export const rationalExponentDerivationTemplate: TemplateMetadata = {
  id: "rational-exponent-derivation",
  version: 1,
  title: "Build the argument for what a unit fraction exponent means",
  skillId: "rational-exponents",
  gradeBand: band,
  difficultyOffset: 0.6,
  ...choice,
  description:
    "A four-line argument shows why $b^{1/n}$ must be $\\sqrt[n]{b}$ if the power of a power law keeps working. Supply the reason for a line, supply a missing line, or choose the order that makes the argument valid.",
  glossarySenses: senses,
  glossaryNoLink: noLink,
};
export const rationalExponentDefinitionTestTemplate: TemplateMetadata = {
  id: "rational-exponent-definition-test",
  version: 1,
  title: "Test a definition of a fraction exponent against the law",
  skillId: "rational-exponents",
  gradeBand: band,
  difficultyOffset: 0.65,
  ...choice,
  description:
    "Choose the only proposed meaning of $b^{1/n}$ that makes $(b^{1/n})^n=b$ true, or find the first false line of a student's argument about $b^{1/n}$ or $b^{m/n}$, where some arguments have no false line.",
  glossarySenses: senses,
  glossaryNoLink: noLink,
};
export const radicalExponentNotationReasonTemplate: TemplateMetadata = {
  id: "radical-exponent-notation-reason",
  version: 1,
  title: "Explain why a root can be written as a fraction exponent",
  skillId: "rational-exponents",
  gradeBand: band,
  difficultyOffset: 0.7,
  ...choice,
  description:
    "Choose the correct and complete explanation of why $\\sqrt[n]{b}=b^{1/n}$ or why $b^{m/n}=(\\sqrt[n]{b})^m$, or choose the equation the laws require of $b^{m/n}$ together with the value it gives.",
  glossarySenses: senses,
  glossaryNoLink: noLink,
};

/* -------------------------------------------------------- shared numbers */

type BaseKind = "perfect" | "plain";
/** A positive base: a perfect $n$th power $r^n\le1000$, or a plain base
 * that is no perfect power at all. */
interface Base {
  b: number;
  n: number;
  /** The whole-number $n$th root of a perfect base. */
  r: number | null;
}
const PLAIN = [2, 3, 5, 6, 7, 10] as const;
const INDEXES = [2, 3, 4, 5] as const;

function drawBase(r: Random, kind: BaseKind, n: number): Base {
  // A base equal to the index would make b/n equal 1 and blur which number
  // is which in the argument.
  if (kind === "plain")
    return {
      b: pick(
        r,
        PLAIN.filter((x) => x !== n),
      ),
      n,
      r: null,
    };
  const roots = [2, 3, 4, 5].filter((x) => x ** n <= 1000);
  const root = pick(r, roots);
  return { b: root ** n, n, r: root };
}
/** A numerator $m\in\{2,\dots,5\}$, coprime to $n$, not $n$, with $r^m\le1000$
 * for a perfect base. */
function drawM(r: Random, base: Base): number {
  const ms = [2, 3, 4, 5].filter(
    (m) =>
      m !== base.n &&
      gcd(m, base.n) === 1 &&
      (base.r === null || base.r ** m <= 1000),
  );
  if (!ms.length) throw new Error("Need three retry: no numerator fits");
  return pick(r, ms);
}

const same = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
/** Redraw unless every value is unequal to the true one. */
function allDiffer(truth: number, values: number[], what: string) {
  if (values.some((v) => same(v, truth)))
    throw new Error(
      `Need three retry: ${withArticle(what)} distractor is true here`,
    );
}
function pairwiseDistinct(values: number[], what: string) {
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++)
      if (same(values[i]!, values[j]!))
        throw new Error(`Need three retry: two ${what} options are equal`);
}

/* ------------------------------------------------------------- wording */

const root = (n: number, x: string | number) =>
  n === 2 ? `\\sqrt{${x}}` : `\\sqrt[${n}]{${x}}`;
const unitPow = (b: number, n: number) => `${b}^{1/${n}}`;
const fracPow = (b: number, m: number, n: number) => `${b}^{${m}/${n}}`;
const frac = (p: number | string, q: number | string) => `\\frac{${p}}{${q}}`;
/** A whole number in TeX with grouped thousands. */
const num = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, "{,}");
/** "cube", "square", "fourth power": what raising to the $n$th power is called. */
const powerWord = (n: number) =>
  ({ 2: "square", 3: "cube", 4: "fourth power", 5: "fifth power" })[n]!;
const rootWord = (n: number) =>
  ({ 2: "square root", 3: "cube root", 4: "fourth root", 5: "fifth root" })[n]!;
const partWord = (n: number) =>
  ({ 2: "half", 3: "a third", 4: "a fourth", 5: "a fifth" })[n]!;

/* ================================================= rational-exponent-derivation */

const stepAxis = defineAxis(
  "step",
  [
    "justify-s2",
    "justify-s4",
    "line-s2",
    "line-s3",
    "line-s4",
    "order",
  ] as const,
  { legacy: "justify-s2" },
);
const baseAxis = defineAxis("base", ["perfect", "plain"] as const);
type Step = (typeof stepAxis.values)[number];

/** The four statements, instantiated for $b,n$. */
function statements(b: number, n: number) {
  const u = unitPow(b, n);
  return {
    s1: `We want the laws for integer exponents to keep working for the exponent $${frac(1, n)}$.`,
    s2: `So $(${u})^${n}$ must equal $${b}^{${frac(1, n)}\\cdot${n}}$.`,
    s3: `$${frac(1, n)}\\cdot${n}=1$, so $(${u})^${n}=${b}$.`,
    s4: `The positive number whose ${powerWord(n)} is $${b}$ is $${root(n, b)}$, so $${u}=${root(n, b)}$.`,
  };
}
/** The four-line explanation every variant shares. */
function derivationSteps(b: number, n: number): string[] {
  const u = unitPow(b, n);
  return [
    `We want the laws of exponents to keep working for fraction exponents. The law for a power raised to a power is $(x^p)^q=x^{pq}$: multiply the exponents.`,
    `Apply it with $p=${frac(1, n)}$ and $q=${n}$: $(${u})^${n}=${b}^{${frac(1, n)}\\cdot${n}}$.`,
    `$${frac(1, n)}\\cdot${n}=1$, so $(${u})^${n}=${b}$.`,
    `The positive number whose ${powerWord(n)} is $${b}$ is $${root(n, b)}$, by the definition of the ${rootWord(n)}. So $${u}$ has to mean $${root(n, b)}$: no other meaning keeps the law true.`,
  ];
}

interface DerivationModel extends Base {
  step: Step;
  kind: BaseKind;
}

export const rationalExponentDerivation = chainFamily({
  template: rationalExponentDerivationTemplate,
  axes: { step: stepAxis, base: baseAxis },
  variant: (m: DerivationModel) => `${m.step}-${m.kind}`,
  model: (r, axes): DerivationModel => {
    const n = pick(r, INDEXES);
    const base = drawBase(r, axes.base, n);
    const { b } = base;
    const truth = b ** (1 / n);
    // Every candidate meaning or line the variants offer is false here.
    if (axes.step === "line-s4" || axes.step === "justify-s4")
      allDiffer(truth, [b / n, 1 / b ** n, b ** n], "meaning");
    if (axes.step === "line-s2")
      allDiffer(b, [b ** (1 / n + n), b ** n / n, 1 / b ** (n * n)], "line");
    if (axes.step === "line-s3")
      allDiffer(b, [b ** (1 / (n * n)), b ** n, n * b], "line");
    if (axes.step === "line-s4")
      allDiffer(b, [(b / n) ** n, (1 / b ** n) ** n, (b ** n) ** n], "check");
    return { ...base, step: axes.step, kind: axes.base };
  },
  render: (m, _axes, r): Surface | null => {
    const { b, n } = m;
    const u = unitPow(b, n);
    const S = statements(b, n);
    const intro = `Here is an argument for what $${u}$ must mean.`;
    const lines = (l: [string, string, string, string]) =>
      l.map((text, i) => `Line ${i + 1}: ${text}`).join(" ");
    const steps = derivationSteps(b, n);
    if (m.step === "justify-s2" || m.step === "justify-s4") {
      const at2 = m.step === "justify-s2";
      const shown: [string, string, string, string] = at2
        ? [
            S.s1,
            `So $(${u})^${n}$ must equal $${b}^{${frac(1, n)}\\cdot${n}}$, by $\\square$.`,
            S.s3,
            S.s4,
          ]
        : [S.s1, S.s2, S.s3, `So $${u}=${root(n, b)}$, by $\\square$.`];
      const options: ChoiceOption[] = at2
        ? [
            {
              label: "the power of a power law, $(x^p)^q=x^{pq}$",
              correct: true,
            },
            {
              label: "the product of powers law, $x^p\\cdot x^q=x^{p+q}$",
              feedback: `The product of powers law adds the exponents of a product such as $${u}\\cdot${b}^${n}$. Line 2 raises a power to a power, which multiplies the exponents.`,
            },
            {
              label: "the power of a product law, $(xy)^q=x^qy^q$",
              feedback: `That law splits a power of a product. Inside $(${u})^${n}$ there is one power, not a product.`,
            },
            {
              label: `the definition of the ${rootWord(n)}, $${root(n, b)}$`,
              feedback: `Line 2 does not mention $${root(n, b)}$. Using the root here would assume that $${u}$ is the root, which is what the argument sets out to prove.`,
            },
          ]
        : [
            {
              label: `the definition: $${root(n, b)}$ is the positive number whose ${powerWord(n)} is $${b}$`,
              correct: true,
            },
            {
              label:
                "the power of a power law $(x^p)^q=x^{pq}$, used a second time",
              feedback: `That law was used in line 2 to get $(${u})^${n}=${b}^{${frac(1, n)}\\cdot${n}}$. It says nothing about which number has ${powerWord(n)} $${b}$.`,
            },
            {
              label: `the rule that an exponent of $${frac(1, n)}$ means divide by $${n}$`,
              feedback: `There is no such rule: $${frac(b, n)}$ is not $${root(n, b)}$, because $\\left(${frac(b, n)}\\right)^${n}=${frac(`${b}^${n}`, `${n}^${n}`)}$, not $${b}$.`,
            },
            {
              label: `the rule that $${u}$ equals $${frac(1, `${b}^${n}`)}$, a reciprocal`,
              feedback: `$${frac(1, `${b}^${n}`)}$ is $${b}^{-${n}}$, a negative exponent. Its ${powerWord(n)} is $${frac(1, `${b}^{${n * n}}`)}$, not $${b}$.`,
            },
          ];
      const close = at2
        ? `Line 2 uses the power of a power law. The product of powers law needs a product of powers, the power of a product law needs a product inside the parentheses, and the definition of $${root(n, b)}$ would assume the conclusion.`
        : `Line 4 uses the definition of the ${rootWord(n)}. The power of a power law was already used in line 2, dividing by $${n}$ gives $${frac(b, n)}$, whose ${powerWord(n)} is not $${b}$, and $${frac(1, `${b}^${n}`)}$ is a negative power of $${b}$.`;
      return choiceSurface(r, {
        prompt: `${intro} ${lines(shown)} Which reason fills the $\\square$ in line ${at2 ? 2 : 4}?`,
        options,
        hint: at2
          ? `In line 2, look at how the exponent of $${b}$ is built from $${frac(1, n)}$ and $${n}$. Which law of exponents builds an exponent that way from $(${u})^${n}$?`
          : `Line 3 says $(${u})^${n}=${b}$. Which reason turns that fact into the meaning of $${u}$ without assuming the conclusion?`,
        explanation: [...steps, close],
        label: "Choose the reason",
      });
    }
    if (m.step === "order") {
      const keys = ["s1", "s2", "s3", "s4"] as const;
      const shownOrder = shuffle(r, [0, 1, 2, 3]);
      if (shownOrder.every((x, i) => x === i)) return null;
      // Statements are numbered as shown; an option lists them in order.
      const shownAs = (i: number) => shownOrder.indexOf(i) + 1;
      const seq = (order: number[]) =>
        order.map((i) => `Statement ${shownAs(i)}`).join(", ");
      const listed = shownOrder
        .map((i, at) => `Statement ${at + 1}: ${S[keys[i]!]}`)
        .join(" ");
      return choiceSurface(r, {
        prompt: `The four statements of an argument for what $${u}$ must mean are shown out of order. ${listed} In which order do the statements make a valid argument?`,
        options: [
          { label: seq([0, 1, 2, 3]), correct: true },
          {
            label: seq([0, 2, 1, 3]),
            feedback: `This states $(${u})^${n}=${b}$ before the law gives $(${u})^${n}=${b}^{${frac(1, n)}\\cdot${n}}$, the equation it simplifies.`,
          },
          {
            label: seq([3, 0, 1, 2]),
            feedback: `This states the conclusion $${u}=${root(n, b)}$ first, before anything supports it. What the argument proves comes last.`,
          },
          {
            label: seq([0, 1, 3, 2]),
            feedback: `This reads off $${u}=${root(n, b)}$ before showing $(${u})^${n}=${b}$, the fact that conclusion rests on.`,
          },
        ],
        hint: `Find the statement that uses nothing before it. Then find the statement that applies a law to $(${u})^${n}$, and keep going: each statement uses the one before it.`,
        explanation: [
          ...steps,
          `The order is forced, and these four steps are that order: the wish to keep the laws, the law applied to $(${u})^${n}$, the exponent simplified, and the meaning read off. A statement cannot come before the fact it uses.`,
        ],
        label: "Choose the order",
      });
    }
    // A missing line.
    const at = m.step === "line-s2" ? 2 : m.step === "line-s3" ? 3 : 4;
    const shown: [string, string, string, string] = [
      S.s1,
      at === 2 ? "$\\square$" : S.s2,
      at === 3 ? "$\\square$" : S.s3,
      at === 4 ? "$\\square$" : S.s4,
    ];
    const lhs = `(${u})^${n}`;
    const options: ChoiceOption[] =
      at === 2
        ? [
            { label: `$${lhs}=${b}^{${frac(1, n)}\\cdot${n}}$`, correct: true },
            {
              label: `$${lhs}=${b}^{${frac(1, n)}+${n}}$`,
              feedback: `Adding the exponents is the product of powers law, for a product such as $${u}\\cdot${b}^${n}$. A power of a power multiplies them.`,
            },
            {
              label: `$${lhs}=${frac(`${b}^${n}`, n)}$`,
              feedback: `This treats the exponent $${frac(1, n)}$ as dividing by $${n}$. An exponent is not a divisor; the law multiplies exponents.`,
            },
            {
              label: `$${lhs}=${frac(1, `${b}^{${n}\\cdot${n}}`)}$`,
              feedback: `This treats $${u}$ as the reciprocal $${frac(1, `${b}^${n}`)}$. A reciprocal comes from a negative exponent, not a fraction exponent.`,
            },
          ]
        : at === 3
          ? [
              {
                label: `$${frac(1, n)}\\cdot${n}=1$, so $${lhs}=${b}$`,
                correct: true,
              },
              {
                label: `$${frac(1, n)}\\cdot${n}=${frac(1, n * n)}$, so $${lhs}=${b}^{1/${n * n}}$`,
                feedback: `$${frac(1, n)}\\cdot${n}$ is $1$: multiplying by $${n}$ undoes dividing by $${n}$. It is not $${frac(1, n * n)}$.`,
              },
              {
                label: `$${frac(1, n)}\\cdot${n}=${n}$, so $${lhs}=${b}^${n}$`,
                feedback: `This drops the fraction. $${frac(1, n)}\\cdot${n}=1$, so the exponent is $1$, not $${n}$.`,
              },
              {
                label: `$${frac(1, n)}\\cdot${n}=1$, so $${lhs}=${n}\\cdot${b}$`,
                feedback: `An exponent is not a factor: raising to the power $${n}$ is not multiplying by $${n}$. An exponent of $1$ leaves $${b}$.`,
              },
            ]
          : [
              { label: `$${u}=${root(n, b)}$`, correct: true },
              {
                label: `$${u}=${frac(b, n)}$`,
                feedback: `Dividing by the index does not undo ${withArticle(powerWord(n))}: $\\left(${frac(b, n)}\\right)^${n}=${frac(`${b}^${n}`, `${n}^${n}`)}$, not $${b}$.`,
              },
              {
                label: `$${u}=${frac(1, `${b}^${n}`)}$`,
                feedback: `$${frac(1, `${b}^${n}`)}$ is $${b}^{-${n}}$, a negative exponent. Its ${powerWord(n)} is $${frac(1, `${b}^{${n * n}}`)}$, not $${b}$.`,
              },
              {
                label: `$${u}=${b}^${n}$`,
                feedback: `This raises $${b}$ to the power $${n}$ instead of taking the ${rootWord(n)}: $(${b}^${n})^${n}=${b}^{${n * n}}$, not $${b}$.`,
              },
            ];
    const close =
      at === 2
        ? `The missing line applies the power of a power law to $${lhs}$. Adding the exponents, dividing by $${n}$ or taking a reciprocal does not follow from that law.`
        : at === 3
          ? `The missing line simplifies the exponent: $${frac(1, n)}\\cdot${n}=1$. It is not $${frac(1, n * n)}$ or $${n}$, and an exponent is not a factor.`
          : `The missing line names the number line 3 describes. $${frac(b, n)}$, $${frac(1, `${b}^${n}`)}$ and $${b}^${n}$ each give something other than $${b}$ when raised to the power $${n}$.`;
    return choiceSurface(r, {
      prompt: `${intro} ${lines(shown)} Which statement fills the $\\square$ in line ${at}?`,
      options,
      hint:
        at === 2
          ? `Line 2 must follow from line 1 and lead to line 3. Apply a law of exponents to $${lhs}$ and see which line results.`
          : at === 3
            ? `Line 3 must simplify the exponent that line 2 gives $${lhs}$. Work out $${frac(1, n)}\\cdot${n}$ yourself first.`
            : `Line 4 must say what $${u}$ is: line 3 makes it a positive number whose ${powerWord(n)} is $${b}$. Raise each candidate to the power $${n}$.`,
      explanation: [...steps, close],
      label: "Choose the missing line",
    });
  },
});

/* ============================================ rational-exponent-definition-test */

/** Half the items test proposed meanings; the other half are student
 * arguments, one script each: F0 has no false line. A script is an axis
 * value so a redraw of its numbers never changes the mix of scripts. */
const testAxis = defineAxis(
  "task",
  ["proposals", "f0", "f1", "f2", "f3", "f4", "f5"] as const,
  { legacy: "proposals", weights: [6, 1, 1, 1, 1, 1, 1] },
);
type Script = "f0" | "f1" | "f2" | "f3" | "f4" | "f5";
interface DefinitionModel extends Base {
  task: "proposals" | "false-line";
  kind: BaseKind;
  script: Script | null;
  m: number | null;
}

/** A line of a student's argument: its text and whether it is true. */
interface ArgLine {
  text: string;
  holds: boolean;
  /** Why it is true or false, naming its numbers. */
  why: string;
}

function scriptLines(m: DefinitionModel): ArgLine[] {
  const { b, n } = m;
  const u = unitPow(b, n);
  const rt = root(n, b);
  switch (m.script!) {
    case "f0":
      return [
        {
          text: `$(${u})^${n}=${b}^{${frac(1, n)}\\cdot${n}}$`,
          holds: true,
          why: `Line 1 is true: a power of a power multiplies the exponents.`,
        },
        {
          text: `$${frac(1, n)}\\cdot${n}=1$, so $(${u})^${n}=${b}$`,
          holds: true,
          why: `Line 2 is true: $${frac(1, n)}\\cdot${n}=1$.`,
        },
        {
          text: `so $${u}=${rt}$`,
          holds: true,
          why: `Line 3 is true: the positive number whose ${powerWord(n)} is $${b}$ is $${rt}$.`,
        },
      ];
    case "f1":
      return [
        {
          text: `$(${u})^${n}=${b}^{${frac(1, n)}+${n}}$`,
          holds: false,
          why: `Line 1 is false: a power of a power multiplies the exponents. Adding them is the product of powers law, for a product such as $${u}\\cdot${b}^${n}$. Line 1 should read $(${u})^${n}=${b}^{${frac(1, n)}\\cdot${n}}=${b}$.`,
        },
        {
          text: `$${b}^{${frac(1, n)}+${n}}=${b}^{${1 + n * n}/${n}}$`,
          holds: true,
          why: `Line 2 adds the fractions correctly, but it builds on the false line 1.`,
        },
        {
          text: `so $${u}$ is not $${rt}$`,
          holds: false,
          why: `Line 3 is also false: $${u}$ is $${rt}$.`,
        },
      ];
    case "f2":
      return [
        {
          text: `$(${u})^${n}=${b}^{${frac(1, n)}\\cdot${n}}$`,
          holds: true,
          why: `Line 1 is true: a power of a power multiplies the exponents.`,
        },
        {
          text: `$${frac(1, n)}\\cdot${n}=1$, so $(${u})^${n}=${b}$`,
          holds: true,
          why: `Line 2 is true: $${frac(1, n)}\\cdot${n}=1$.`,
        },
        {
          text: `so $${u}=${b}^${n}$`,
          holds: false,
          why: `Line 3 is false: line 2 says $${u}$ is a number whose ${powerWord(n)} is $${b}$, which is $${rt}$. Raising $${b}$ to the power $${n}$ goes the wrong way: $(${b}^${n})^${n}=${b}^{${n * n}}$.`,
        },
      ];
    case "f3":
      return [
        {
          text: `$${u}=${frac(1, `${b}^${n}`)}$`,
          holds: false,
          why: `Line 1 is false: $${frac(1, `${b}^${n}`)}$ is $${b}^{-${n}}$, a negative exponent. Its ${powerWord(n)} is $${frac(1, `${b}^{${n * n}}`)}$, not $${b}$.`,
        },
        {
          text: `$\\left(${frac(1, `${b}^${n}`)}\\right)^${n}=${frac(1, `${b}^{${n * n}}`)}$`,
          holds: true,
          why: `Line 2 multiplies the exponents correctly, but it starts from the false line 1.`,
        },
        {
          text: `so $(${u})^${n}=${frac(1, `${b}^{${n * n}}`)}$, which is not $${b}$`,
          holds: false,
          why: `Line 3 is also false: $(${u})^${n}=${b}$.`,
        },
      ];
    case "f4": {
      const k = m.m!;
      const v = fracPow(b, k, n);
      const bm = b ** k;
      return [
        {
          text: `$(${v})^${n}=${b}^{${frac(k, n)}\\cdot${n}}=${b}^${k}$`,
          holds: true,
          why: `Line 1 is true: a power of a power multiplies the exponents, and $${frac(k, n)}\\cdot${n}=${k}$.`,
        },
        {
          text: `$${b}^${k}=${num(bm)}$`,
          holds: true,
          why: `Line 2 is true: $${b}^${k}=${num(bm)}$ is correct arithmetic.`,
        },
        {
          text: `so $${v}=\\sqrt{${num(bm)}}$`,
          holds: false,
          why: `Line 3 is false: lines 1 and 2 say the ${powerWord(n)} of $${v}$ is $${num(bm)}$, so $${v}$ is the ${rootWord(n)} of $${num(bm)}$, which is $${m.r! ** k}$. The square root $\\sqrt{${num(bm)}}${Number.isInteger(Math.sqrt(bm)) ? `=${num(Math.sqrt(bm))}` : ""}$ is not $${m.r! ** k}$: the denominator $${n}$ calls for ${withArticle(rootWord(n))}.`,
        },
      ];
    }
    case "f5": {
      const k = m.m!;
      const v = fracPow(b, k, n);
      return [
        {
          text: `$${v}=(${u})^${k}$`,
          holds: true,
          why: `Line 1 is true: $${frac(k, n)}=${frac(1, n)}\\cdot${k}$, and a power of a power multiplies the exponents.`,
        },
        {
          text: `$${u}=${frac(b, n)}$`,
          holds: false,
          why: `Line 2 is false: $${u}$ is the number whose ${powerWord(n)} is $${b}$, which is $${m.r}$. Dividing by $${n}$ gives $${frac(b, n)}$, and $\\left(${frac(b, n)}\\right)^${n}$ is not $${b}$.`,
        },
        {
          text: `so $${v}=\\left(${frac(b, n)}\\right)^${k}$`,
          holds: false,
          why: `Line 3 builds on the false line 2. In fact $${v}=${m.r}^${k}=${m.r! ** k}$.`,
        },
      ];
    }
  }
}
/** The numeric truth of each script line, computed from the numbers alone. */
function scriptTruth(m: DefinitionModel): boolean[] {
  const { b, n } = m;
  const u = b ** (1 / n);
  switch (m.script!) {
    case "f0":
      return [same(u ** n, b), true, same(u, u)];
    case "f1":
      return [same(u ** n, b ** (1 / n + n)), true, false];
    case "f2":
      return [true, true, same(u, b ** n)];
    case "f3":
      return [same(u, 1 / b ** n), true, same(u ** n, 1 / b ** (n * n))];
    case "f4": {
      const k = m.m!;
      const v = b ** (k / n);
      return [same(v ** n, b ** k), true, same(v, Math.sqrt(b ** k))];
    }
    case "f5": {
      const k = m.m!;
      const v = b ** (k / n);
      return [same(v, u ** k), same(u, b / n), same(v, (b / n) ** k)];
    }
  }
}

export const rationalExponentDefinitionTest = chainFamily({
  template: rationalExponentDefinitionTestTemplate,
  axes: { task: testAxis },
  variant: (m: DefinitionModel) =>
    m.task === "proposals" ? `proposals-${m.kind}` : `false-line-${m.script}`,
  model: (r, axes): DefinitionModel => {
    if (axes.task === "proposals") {
      const kind = pick(r, ["perfect", "plain"] as const);
      const base = drawBase(r, kind, pick(r, INDEXES));
      const { b, n } = base;
      const fourth = n === 2 ? b ** n : n * Math.sqrt(b);
      allDiffer(b ** (1 / n), [b / n, 1 / b ** n, fourth], "meaning");
      allDiffer(b, [(b / n) ** n, 1 / b ** (n * n), fourth ** n], "check");
      pairwiseDistinct([b ** (1 / n), b / n, 1 / b ** n, fourth], "meaning");
      return { ...base, task: "proposals", kind, script: null, m: null };
    }
    const script = axes.task;
    const ratio = script === "f4" || script === "f5";
    const kind: BaseKind = ratio ? "perfect" : pick(r, ["perfect", "plain"]);
    const n = pick(r, script === "f4" ? ([3, 4, 5] as const) : INDEXES);
    const base = drawBase(r, kind, n);
    const m = ratio ? drawM(r, base) : null;
    if (script === "f4" && base.b ** m! > 99999)
      throw new Error("Need three retry: the power is too large to show");
    const model: DefinitionModel = {
      ...base,
      task: "false-line",
      kind,
      script,
      m,
    };
    // The designated line is the first numerically false one.
    const truth = scriptTruth(model);
    const want = { f0: 3, f1: 0, f2: 2, f3: 0, f4: 2, f5: 1 }[script];
    const first = truth.indexOf(false);
    if ((first === -1 ? 3 : first) !== want)
      throw new Error(
        "Need three retry: the false line is not the designed one",
      );
    return model;
  },
  render: (m, _axes, r): Surface | null => {
    const { b, n } = m;
    const u = unitPow(b, n);
    if (m.task === "proposals") {
      const fourth =
        n === 2
          ? {
              label: `$${u}=${b}^${n}$`,
              feedback: `Squaring $${b}$ goes the wrong way: $(${b}^2)^2=${b}^4$, not $${b}$.`,
              check: `$(${b}^2)^2=${b}^4$, not $${b}$: squaring goes the wrong way.`,
            }
          : {
              label: `$${u}=${n}\\sqrt{${b}}$`,
              feedback: `This reads the index of $${root(n, b)}$ as a factor. $(${n}\\sqrt{${b}})^${n}=${n}^${n}\\cdot(\\sqrt{${b}})^${n}$, far more than $${b}$.`,
              check: `$(${n}\\sqrt{${b}})^${n}=${n}^${n}\\cdot(\\sqrt{${b}})^${n}$, far more than $${b}$: the index of a root is not a factor.`,
            };
      return choiceSurface(r, {
        prompt: `Four students propose what $${u}$ should mean. Only one proposal makes $(${u})^${n}=${b}$ true, as the power of a power law requires. Which proposal is it?`,
        options: [
          { label: `$${u}=${root(n, b)}$`, correct: true },
          {
            label: `$${u}=${frac(b, n)}$`,
            feedback: `$\\left(${frac(b, n)}\\right)^${n}=${frac(`${b}^${n}`, `${n}^${n}`)}$, not $${b}$. An exponent of $${frac(1, n)}$ does not mean divide by $${n}$.`,
          },
          {
            label: `$${u}=${frac(1, `${b}^${n}`)}$`,
            feedback: `$\\left(${frac(1, `${b}^${n}`)}\\right)^${n}=${frac(1, `${b}^{${n * n}}`)}$, not $${b}$. A reciprocal comes from a negative exponent.`,
          },
          { label: fourth.label, feedback: fourth.feedback },
        ],
        hint: `Raise each proposal to the power $${n}$. Which one gives back $${b}$?`,
        explanation: [
          `The power of a power law $(x^p)^q=x^{pq}$ requires $(${u})^${n}=${b}^{${frac(1, n)}\\cdot${n}}=${b}$. Test each proposal by raising it to the power $${n}$.`,
          `$(${root(n, b)})^${n}=${b}$${m.r !== null ? `, since $${root(n, b)}=${m.r}$ and $${m.r}^${n}=${b}$` : ""}. This proposal works.`,
          `$\\left(${frac(b, n)}\\right)^${n}=${frac(`${b}^${n}`, `${n}^${n}`)}$, not $${b}$: an exponent of $${frac(1, n)}$ does not mean divide by $${n}$.`,
          `$\\left(${frac(1, `${b}^${n}`)}\\right)^${n}=${frac(1, `${b}^{${n * n}}`)}$, not $${b}$: $${frac(1, `${b}^${n}`)}$ is the negative power $${b}^{-${n}}$.`,
          fourth.check,
          `So $${u}$ must mean $${root(n, b)}$. The law forces the definition; it is not a free choice.`,
        ],
        label: "Choose the proposal",
      });
    }
    const lines = scriptLines(m);
    const truth = scriptTruth(m);
    lines.forEach((l, i) => {
      if (l.holds !== truth[i])
        throw new Error(`Script ${m.script} line ${i + 1} truth drifted`);
    });
    const first = lines.findIndex((l) => !l.holds);
    const subject = m.m === null ? `$${u}$` : `$${fracPow(b, m.m, n)}$`;
    const labels = ["Line 1", "Line 2", "Line 3", "No line is false"];
    const answerAt = first === -1 ? 3 : first;
    const choiceFeedback: Record<string, string> = {};
    const options = labels.map((label, i) => {
      const id = `option-${"abcd"[i]}`;
      if (i !== answerAt)
        choiceFeedback[id] =
          i === 3
            ? lines[first]!.why
            : i < answerAt
              ? lines[i]!.why
              : `Line ${i + 1} comes after an earlier false line. ${lines[answerAt]!.why}`;
      return { id, label };
    });
    void r;
    const shownLines = first === -1 ? lines : lines.slice(0, first + 1);
    return {
      prompt: `A student writes this argument about ${subject}. ${lines
        .map((l, i) => `Line ${i + 1}: ${l.text}.`)
        .join(" ")} Which is the first line that is false?`,
      response: {
        kind: "choice",
        label: "Choose the first false line",
        options,
      },
      answer: `option-${"abcd"[answerAt]}`,
      hint: `Check each line of the argument about ${subject} with a law of exponents or by computing. The first line you cannot justify is the false one.`,
      explanation: [
        `The power of a power law says $(x^p)^q=x^{pq}$, and ${subject} is a positive number. Check the lines in order.`,
        ...shownLines.map((l) => l.why),
        first === -1
          ? "Every line is true, so no line is false."
          : `The first false line is line ${first + 1}.`,
      ],
      choiceFeedback,
    };
  },
});

/* ============================================ radical-exponent-notation-reason */

const reasonAxis = defineAxis(
  "task",
  ["root-reason", "fraction-reason", "define-value"] as const,
  { legacy: "root-reason" },
);
interface ReasonModel extends Base {
  task: (typeof reasonAxis.values)[number];
  kind: BaseKind;
  m: number | null;
}

export const radicalExponentNotationReason = chainFamily({
  template: radicalExponentNotationReasonTemplate,
  axes: { task: reasonAxis },
  variant: (m: ReasonModel) =>
    m.task === "define-value" ? m.task : `${m.task}-${m.kind}`,
  model: (r, axes): ReasonModel => {
    const kind: BaseKind =
      axes.task === "define-value" ? "perfect" : pick(r, ["perfect", "plain"]);
    const base = drawBase(r, kind, pick(r, INDEXES));
    const { b, n } = base;
    if (axes.task === "root-reason") {
      // The product-law equation and the divide-by-index value are false.
      allDiffer(b, [b ** (1 / n + n)], "product");
      allDiffer(b ** (1 / n), [b / n], "divide");
      return { ...base, task: axes.task, kind, m: null };
    }
    const m = drawM(r, base);
    const v = b ** (m / n);
    if (axes.task === "fraction-reason") {
      allDiffer(v, [b ** (m - n), b ** (n / m), m * b ** (1 / n)], "reason");
      return { ...base, task: axes.task, kind, m };
    }
    // define-value: r^m against r, b·m/n and b^m.
    const values = [base.r!, (b * m) / n, b ** m];
    allDiffer(v, values, "value");
    pairwiseDistinct([v, ...values], "value");
    allDiffer(b ** m, [b, b ** (m * n)], "equation");
    return { ...base, task: axes.task, kind, m };
  },
  render: (m, _axes, r): Surface | null => {
    const { b, n } = m;
    const u = unitPow(b, n);
    const rt = root(n, b);
    if (m.task === "root-reason") {
      const pw = powerWord(n);
      return choiceSurface(r, {
        prompt: `Why can $${rt}$ be written as $${u}$? Choose the explanation that is correct and complete.`,
        options: [
          {
            label: `If $(x^p)^q=x^{pq}$ holds, $(${u})^${n}=${b}$, so $${u}$ is the positive ${rootWord(n)} of $${b}$: $${rt}$.`,
            correct: true,
          },
          {
            label: `The index of the root goes in the exponent's denominator, so $${rt}=${u}$. Roots always work this way.`,
            feedback: `The rule is true, but this only restates it. It gives no reason why the exponent $${frac(1, n)}$ should mean ${withArticle(rootWord(n))}.`,
          },
          {
            label: `By the product law, $${u}\\cdot${b}^${n}=${b}^{${frac(1, n)}+${n}}=${b}$, so $${u}$ undoes $${b}^${n}$ and is the ${rootWord(n)}.`,
            feedback: `The product law gives $${b}^{${frac(1, n)}+${n}}$, which is not $${b}$. The law that applies is the power of a power law.`,
          },
          {
            label: `An exponent of $${frac(1, n)}$ means ${partWord(n)} of $${b}$, so $${u}=${frac(b, n)}$, which is the ${rootWord(n)} of $${b}$.`,
            feedback: `$${frac(b, n)}$ is not the ${rootWord(n)} of $${b}$: $\\left(${frac(b, n)}\\right)^${n}$ is not $${b}$. An exponent of $${frac(1, n)}$ does not mean divide by $${n}$.`,
          },
        ],
        hint: `Ask what $(${u})^${n}$ must equal if the law $(x^p)^q=x^{pq}$ still holds, then check which choice reasons from that law.`,
        explanation: [
          `If the power of a power law $(x^p)^q=x^{pq}$ is to hold for fraction exponents, then $(${u})^${n}=${b}^{${frac(1, n)}\\cdot${n}}=${b}$.`,
          `So $${u}$ is the positive number whose ${pw} is $${b}$. That number is $${rt}$, so $${rt}$ can be written $${u}$.`,
          `Restating "the index goes in the denominator" is the rule itself, not a reason for it.`,
          `The product law adds exponents, and $${b}^{${frac(1, n)}+${n}}$ is not $${b}$. Dividing by $${n}$ gives $${frac(b, n)}$, which is not the ${rootWord(n)} of $${b}$.`,
        ],
        label: "Choose the explanation",
      });
    }
    const k = m.m!;
    const v = fracPow(b, k, n);
    if (m.task === "fraction-reason") {
      const swapped = root(k, `${b}^${n}`);
      return choiceSurface(r, {
        prompt: `Why is $${v}$ equal to $(${rt})^${k}$? Choose the explanation that is correct and complete.`,
        options: [
          {
            label: `$${v}=${b}^{${frac(1, n)}\\cdot${k}}=(${u})^${k}$ by the power of a power law, and $${u}$ means $${rt}$.`,
            correct: true,
          },
          {
            label: `$${v}=${frac(`${b}^${k}`, `${b}^${n}`)}=${b}^{${k}-${n}}$, which is $(${rt})^${k}$ because the $${n}$ cancels.`,
            feedback: `A fraction exponent is not a quotient of powers: $${frac(`${b}^${k}`, `${b}^${n}`)}=${b}^{${k}-${n}}$, which is not $${v}$.`,
          },
          {
            label: `$${v}=${swapped}$: the top number names the root, the bottom number the power.`,
            feedback: `This swaps the roles. The bottom number of the exponent names the root and the top names the power: $${v}=(${rt})^${k}$.`,
          },
          {
            label: `$${v}=${k}\\cdot${rt}$: the top number counts how many roots to add.`,
            feedback: `The top number is a power, not a count of terms to add: $(${rt})^${k}$ multiplies ${k} copies of $${rt}$.`,
          },
        ],
        hint: `Split the exponent of $${v}$: $${frac(k, n)}=${frac(1, n)}\\cdot${k}$. Which law turns an exponent that is a product into a power of a power?`,
        explanation: [
          `Write $${frac(k, n)}$ as $${frac(1, n)}\\cdot${k}$.`,
          `The power of a power law $(x^p)^q=x^{pq}$ turns $${b}^{${frac(1, n)}\\cdot${k}}$ into $(${u})^${k}$.`,
          `We already know $${u}$ must be $${rt}$, so $${v}=(${rt})^${k}$.`,
          `Reading the exponent as a quotient gives $${b}^{${k}-${n}}$, a different number. Swapping the roles gives $${swapped}$, and the top number is a power, not a count of roots to add.`,
        ],
        label: "Choose the explanation",
      });
    }
    // define-value: perfect base b = r^n.
    const rr = m.r!;
    const bmn = frac(b * k, n);
    const product = Number.isInteger((b * k) / n)
      ? String((b * k) / n)
      : frac((b * k) / gcd(b * k, n), n / gcd(b * k, n));
    return choiceSurface(r, {
      prompt: `To define $${v}$ so that the laws of exponents keep working, which equation must hold, and what value does it give?`,
      options: [
        {
          label: `$(${v})^${n}=${b}^${k}$, so $${v}=${num(rr ** k)}$`,
          correct: true,
        },
        {
          label: `$(${v})^${n}=${b}$, so $${v}=${rr}$`,
          feedback: `This ignores the numerator $${k}$. The law gives $(${v})^${n}=${b}^{${frac(k, n)}\\cdot${n}}=${b}^${k}$, not $${b}$.`,
        },
        {
          label: `$${v}=${b}\\cdot${frac(k, n)}$, so $${v}=${product}$`,
          feedback: `An exponent does not multiply the base: $${b}\\cdot${frac(k, n)}=${bmn}$ is a product, not a power.`,
        },
        {
          label: `$(${v})^${n}=${b}^{${k}\\cdot${n}}$, so $${v}=${b}^${k}$`,
          feedback: `$${frac(k, n)}\\cdot${n}=${k}$, not $${k}\\cdot${n}$. Raising to the power $${n}$ must cancel the denominator.`,
        },
      ],
      hint: `Raise $${v}$ to the power $${n}$. What must $(${v})^${n}$ equal by the power of a power law, and which number has that ${powerWord(n)}?`,
      explanation: [
        `The power of a power law requires $(${v})^${n}=${b}^{${frac(k, n)}\\cdot${n}}=${b}^${k}$. So $${v}$ is the ${rootWord(n)} of $${b}^${k}$.`,
        `Since $${b}=${rr}^${n}$, $${b}^${k}=(${rr}^${k})^${n}$, so $${v}=${rr}^${k}=${num(rr ** k)}$. Check: $(${rt})^${k}=${rr}^${k}=${num(rr ** k)}$.`,
        `Ignoring the numerator gives $${rr}$, whose ${powerWord(n)} is $${b}$, not $${b}^${k}$. Multiplying gives $${b}\\cdot${frac(k, n)}$, which treats the exponent as a factor. Using $${k}\\cdot${n}$ as the exponent gives $${b}^${k}$, whose ${powerWord(n)} is $${b}^{${k * n}}$.`,
      ],
      label: "Choose the equation and value",
    });
  },
});

export const rationalExponentMeaningTemplates = [
  rationalExponentDerivationTemplate,
  rationalExponentDefinitionTestTemplate,
  radicalExponentNotationReasonTemplate,
] as const;
export const rationalExponentMeaningGenerate = dispatch(
  rationalExponentMeaningTemplates,
  {
    "rational-exponent-derivation": (seed) =>
      rationalExponentDerivation.generate(seed).problem,
    "rational-exponent-definition-test": (seed) =>
      rationalExponentDefinitionTest.generate(seed).problem,
    "radical-exponent-notation-reason": (seed) =>
      radicalExponentNotationReason.generate(seed).problem,
  },
);
