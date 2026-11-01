import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { assemble, random, type Random } from "./distribution-practice";

/**
 * Requirement-gap templates for algebra skills whose standards facets had no
 * assessing template inside their own skill. Every case is a private exact
 * integer model; only the prompt and shuffled choices reach the learner.
 */

const make = (
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

export const arithmeticSequenceAsFunctionTemplate = make(
  "arithmetic-sequence-as-function",
  "Arithmetic sequence as a function",
  "arithmetic-sequences",
  0.4,
  "Use $a(n)$ notation for an arithmetic sequence: domain of positive integers, evaluation, undefined inputs, discrete graph and membership of a value.",
);
export const geometricSequenceAsFunctionTemplate = make(
  "geometric-sequence-as-function",
  "Geometric sequence as a function",
  "geometric-sequences",
  0.4,
  "Use $a(n)$ notation for a geometric sequence: domain of positive integers, evaluation, undefined inputs, discrete graph and membership of a value.",
);
export const geometricRuleFormsTemplate = make(
  "geometric-rule-forms",
  "Recursive and explicit geometric rules",
  "geometric-sequences",
  0.5,
  "Translate a geometric sequence between recursive and explicit rules, from a rule, a context or two consecutive terms.",
);
export const solveByCompletingSquareTemplate = make(
  "solve-by-completing-square",
  "Solve by completing the square",
  "complete-square",
  0.5,
  "Solve a quadratic equation by completing the square, including irrational roots, a leading coefficient and the intermediate square step.",
);
export const complexQuadraticSolveTemplate = make(
  "complex-quadratic-solve",
  "Quadratics with nonreal solutions",
  "complex-numbers",
  0.6,
  "Solve real-coefficient quadratic equations whose solutions are nonreal complex numbers, or write an equation from such solutions.",
);
export const complexPartsTemplate = make(
  "complex-parts",
  "Parts of a complex number and its powers",
  "complex-numbers",
  0.1,
  "Name the real and imaginary parts of $a+bi$, simplify powers of $i$ and write a root of a negative number in $a+bi$ form.",
);
export const interpretLinearParametersTemplate = make(
  "interpret-linear-parameters",
  "Meaning of slope and initial value",
  "linear-equation-modeling",
  0.2,
  "Interpret the rate of change and the initial value of a linear model in context, with units, including a model measured from a nonzero starting point.",
);
export const quadraticFormConversionTemplate = make(
  "quadratic-form-conversion",
  "Choose the form that shows a feature",
  "quadratic-graphs",
  0.5,
  "Rewrite a quadratic by completing the square or factoring to reveal its vertex, extreme value, zeros or axis of symmetry.",
);
export const rationalExtraneousSingleTemplate = make(
  "rational-extraneous-single",
  "Extraneous candidate, one denominator",
  "rational-equation-one-denominator",
  0.3,
  "Solve a rational equation with one variable denominator, decide whether the candidate is excluded, and explain why it arises.",
);
export const squareRootExtraneousTemplate = make(
  "square-root-extraneous",
  "Extraneous candidate, square root",
  "square-root-equations",
  0.3,
  "Solve a square-root equation by squaring, identify the extraneous candidate and explain why squaring creates it.",
);

export const algebraRequirementGapTemplates: readonly TemplateMetadata[] = [
  arithmeticSequenceAsFunctionTemplate,
  geometricSequenceAsFunctionTemplate,
  geometricRuleFormsTemplate,
  solveByCompletingSquareTemplate,
  complexQuadraticSolveTemplate,
  complexPartsTemplate,
  interpretLinearParametersTemplate,
  quadraticFormConversionTemplate,
  rationalExtraneousSingleTemplate,
  squareRootExtraneousTemplate,
];

type Wrong = { label: string; feedback: string };
type Spec = {
  prompt: string;
  hint: string;
  explanation: string[];
  correct: string;
  wrong: Wrong[];
};

/** One plain opener per template: the key idea, every term defined. */
const OPENERS: Record<string, string> = {
  "arithmetic-sequence-as-function":
    'A sequence is an ordered list of numbers. An arithmetic sequence adds the same number, the common difference, at each step. As a function, $a(n)$, read "$a$ of $n$", is the term in position $n$.',
  "geometric-sequence-as-function":
    'A sequence is an ordered list of numbers. A geometric sequence multiplies by the same number, the common ratio, at each step. As a function, $a(n)$, read "$a$ of $n$", is the term in position $n$.',
  "geometric-rule-forms":
    "A geometric sequence multiplies each term by the same number, the common ratio, to get the next term. An explicit rule finds any term from its position $n$. A recursive rule gives the first term and how to get each term from the one before.",
  "solve-by-completing-square":
    "Completing the square means adding the same number to both sides so that the left side becomes a perfect square, a bracket multiplied by itself. Then a square root undoes the square.",
  "complex-quadratic-solve":
    "No real number squares to a negative number. The imaginary unit $i$ is the number whose square is −1, so the square root of a negative number is a real number times $i$.",
  "complex-parts":
    "The imaginary unit $i$ is the number whose square is −1. A complex number has a real part and an imaginary part, the real number multiplying $i$.",
  "interpret-linear-parameters":
    "In a linear model, the number multiplying the variable is the rate of change, the change for each one-unit step in the input. The constant term is the initial value, the output when the input is 0.",
  "quadratic-form-conversion":
    "A quadratic function can be written in several equivalent forms. Factored form shows the zeros, where the graph meets the $x$-axis. Vertex form shows the vertex, the turning point of the parabola.",
  "rational-extraneous-single":
    "A value that makes a denominator, the bottom of a fraction, equal 0 is never allowed. An extraneous candidate is a value that the algebra produces but that does not solve the original equation.",
  "square-root-extraneous":
    "The square root sign means the principal square root, which is never negative. Squaring both sides can add extraneous candidates, values that solve the squared equation but not the original, so check each one.",
};

function build(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  spec: Spec,
): GeneratedProblem {
  // Parentheses around a negative number do not change its value, so choices
  // that differ only by them are the same answer.
  const same = (label: string) => label.replace(/\((-\d+)\)(?!\^)/g, "$1");
  const seen = new Set([same(spec.correct)]);
  const wrong = spec.wrong.filter(({ label }) => {
    const key = same(label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (wrong.length < 3)
    throw new Error(
      `Insufficient distinct choices for ${meta.id}: ${spec.prompt} || ${wrong.map((w) => w.label).join(" | ")}`,
    );
  return assemble(meta, seed, r, {
    prompt: spec.prompt,
    answer: "",
    hint: spec.hint,
    explanation: [
      ...(OPENERS[meta.id] ? [OPENERS[meta.id]!] : []),
      ...spec.explanation,
    ],
    choices: [
      { label: spec.correct, correct: true },
      ...wrong.slice(0, 3).map(({ label, feedback }) => ({ label, feedback })),
    ],
  });
}

function begin(meta: TemplateMetadata, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  return random(meta.id, seed);
}

const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const signed = (n: number) => (n < 0 ? `-${-n}` : `${n}`);
const tex = (s: string) => `$${s}$`;
/** A square in TeX: parentheses only around a negative base. */
const sqr = (v: number) => (v < 0 ? `(${v})^2` : `${v}^2`);
const isSquare = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));
const nonzeroIn = (r: Random, lo: number, hi: number) => {
  let v = 0;
  while (v === 0) v = r(lo, hi);
  return v;
};
/** Polynomial text from [coefficient, variable-part] pairs, omitting zero terms. */
function poly(terms: [number, string][]): string {
  let out = "";
  for (const [k, body] of terms) {
    if (!k) continue;
    const mag = Math.abs(k);
    const text = `${body && mag === 1 ? "" : mag}${body}`;
    out += out ? ` ${k < 0 ? "-" : "+"} ${text}` : `${k < 0 ? "-" : ""}${text}`;
  }
  return out || "0";
}
const quad = (a: number, b: number, c: number) =>
  poly([
    [a, "x^2"],
    [b, "x"],
    [c, ""],
  ]);
const shift = (h: number) =>
  h === 0 ? "x" : `(x ${h > 0 ? "-" : "+"} ${Math.abs(h)})`;
/** a(x - h)^2 + k */
function vertexForm(a: number, h: number, k: number): string {
  const square = h === 0 ? "x^2" : `${shift(h)}^2`;
  const lead = a === 1 ? "" : a === -1 ? "-" : `${a}`;
  const constant = k === 0 ? "" : ` ${k < 0 ? "-" : "+"} ${Math.abs(k)}`;
  return `${lead}${square}${constant}`;
}
/** Solution labels, ascending, as "x = p or x = q". */
const rootPair = (p: number, q: number) => {
  const [lo, hi] = p <= q ? [p, q] : [q, p];
  return lo === hi ? tex(`x=${lo}`) : tex(`x=${lo}`) + " or " + tex(`x=${hi}`);
};

// ---------------------------------------------------------------------------
// Sequences as functions
// ---------------------------------------------------------------------------

type Sequence = {
  kind: "arithmetic" | "geometric";
  first: number;
  step: number;
};
const sequenceTerm = ({ kind, first, step }: Sequence, n: number) =>
  kind === "arithmetic" ? first + step * (n - 1) : first * step ** (n - 1);
const sequenceRule = ({ kind, first, step }: Sequence) =>
  kind === "arithmetic"
    ? `${first} ${step < 0 ? "-" : "+"} ${Math.abs(step)}(n - 1)`
    : `${first}\\cdot ${step < 0 ? `(${step})` : step}^{n-1}`;

function sequenceFunctionCase(meta: TemplateMetadata, seed: string) {
  const r = begin(meta, seed);
  const kind =
    meta.skillId === "arithmetic-sequences" ? "arithmetic" : "geometric";
  const seq: Sequence =
    kind === "arithmetic"
      ? { kind, first: r(-6, 12), step: pick(r, [-6, -4, -2, 2, 4, 6, 8]) }
      : { kind, first: nonzeroIn(r, -4, 5), step: pick(r, [2, 3, 4, -2, -3]) };
  const variant = r(0, 4);
  const word = kind === "arithmetic" ? "arithmetic" : "geometric";
  const rule = sequenceRule(seq);
  const t = (n: number) => sequenceTerm(seq, n);
  const setup = `${kind === "arithmetic" ? "An" : "A"} ${word} sequence is defined by $a(n)=${rule}$ for $n=1,2,3,\\ldots$.`;
  const listing = [1, 2, 3].map((n) => t(n)).join(", ");
  let spec: Spec;
  if (variant === 0) {
    spec = {
      prompt: `${setup} Which set is the domain of the function $a$?`,
      hint: `In $a(n)=${rule}$, the input $n$ names the position of a term in the list. Decide which inputs name a position.`,
      explanation: [
        `The input of $a$ is the position $n$ of a term, and the setup lists positions $1,2,3,\\ldots$.`,
        `A list has a first, second, third term and so on, but no term at a fraction, zero or a negative position.`,
        `The values $${listing},\\ldots$ are outputs, the terms, not inputs.`,
        `So the domain of $a$, the set of allowed inputs, is the positive integers $1, 2, 3, \\ldots$.`,
      ],
      correct: "The positive integers $1, 2, 3, \\ldots$",
      wrong: [
        {
          label: "All real numbers",
          feedback:
            "A sequence has terms only at whole-number positions. There is no 2.5th term, so not every real number is an input.",
        },
        {
          label: "All real numbers $n\\ge 1$",
          feedback:
            "Starting at 1 is right, but a term exists only at whole-number positions. The inputs between 1 and 2 do not name terms.",
        },
        {
          label: tex(`${listing},\\ldots`),
          feedback:
            "These are the outputs $a(1), a(2), a(3),\\ldots$ (the terms). The domain is the set of inputs, the positions.",
        },
        {
          label: "All integers",
          feedback:
            "Positions start at 1: there is no 0th or negative-position term in this sequence.",
        },
      ],
    };
  } else if (variant === 1) {
    const k = r(3, 6);
    const value = t(k);
    const offByOne =
      kind === "arithmetic"
        ? seq.first + seq.step * k
        : seq.first * seq.step ** k;
    const previous = t(k - 1);
    const next = t(k + 1);
    const dropped =
      kind === "arithmetic" ? seq.step * (k - 1) : seq.step ** (k - 1);
    spec = {
      prompt: `${setup} Using function notation, what is $a(${k})$?`,
      hint: `Replace $n$ by ${k} in $a(n)=${rule}$. The rule uses $n-1$, so evaluate $${k}-1$ first.`,
      explanation: [
        `$a(${k})$ means the term in position ${k}: substitute $n=${k}$.`,
        `$a(${k})=${kind === "arithmetic" ? `${seq.first} ${seq.step < 0 ? "-" : "+"} ${Math.abs(seq.step)}(${k - 1})` : `${seq.first}\\cdot ${seq.step < 0 ? `(${seq.step})` : seq.step}^{${k - 1}}`}=${value}$.`,
        `Check by the pattern: the terms begin $${listing},\\ldots$, and position ${k} is ${value}.`,
        `So $a(${k})$ is ${value}.`,
      ],
      correct: tex(`${value}`),
      wrong: [
        {
          label: tex(`${offByOne}`),
          feedback: `This uses $n$ where the rule has $n-1$. Position ${k} takes ${k - 1} steps from the first term, not ${k}.`,
        },
        {
          label: tex(`${previous}`),
          feedback: `This is $a(${k - 1})$, the previous term. $a(${k})$ is the term in position ${k}.`,
        },
        {
          label: tex(`${next}`),
          feedback: `This is $a(${k + 1})$, the next term. Substitute exactly $n=${k}$.`,
        },
        {
          label: tex(`${t(k + 2)}`),
          feedback: `This is $a(${k + 2})$. Substitute exactly $n=${k}$.`,
        },
        {
          label: tex(`${t(k - 2)}`),
          feedback: `This is $a(${k - 2})$. Substitute exactly $n=${k}$.`,
        },
        {
          label: tex(`${dropped}`),
          feedback: `This leaves out the first term ${seq.first}. The rule starts from ${seq.first} and then applies the ${kind === "arithmetic" ? "common difference" : "common ratio"}.`,
        },
      ],
    };
  } else if (variant === 2) {
    const bad = pick(r, ["0", "-1", "1.5", "2.5", "3.5", "4.5"]);
    const ints: number[] = [];
    while (ints.length < 3) {
      const n = r(1, 8);
      if (!ints.includes(n)) ints.push(n);
    }
    spec = {
      prompt: `${setup} Which expression is undefined?`,
      hint: `$a(n)=${rule}$ is defined only for inputs that name a position in the list. Check each input: is it a position with a term?`,
      explanation: [
        `The domain of $a$ is the positive integers, because the terms sit in positions $1,2,3,\\ldots$.`,
        ...ints.map(
          (n) =>
            `$a(${n})$ is defined: the sequence has a term in position $${n}$, and $a(${n})=${t(n)}$.`,
        ),
        `$a(${bad})$ is undefined, meaning it has no value: ${bad} is not a positive integer, so there is no term in position ${bad}.`,
        `So $a(${bad})$ is the expression with no value.`,
      ],
      correct: tex(`a(${bad})`),
      wrong: ints.map((n) => ({
        label: tex(`a(${n})`),
        feedback: `Position ${n} is a positive integer, so this term exists: $a(${n})=${t(n)}$. Look for the input that is not a position.`,
      })),
    };
  } else if (variant === 3) {
    const points = [1, 2, 3].map((n) => `(${n},${t(n)})`).join(", ");
    const correct =
      kind === "arithmetic"
        ? `Separate points ${tex(`${points},\\ldots`)} that lie on one line, with no points between them`
        : `Separate points ${tex(`${points},\\ldots`)} that do not lie on one line, with no points between them`;
    spec = {
      prompt: `${setup} The sequence is graphed with $n$ on the horizontal axis and $a(n)$ on the vertical axis. Which description of the graph is correct?`,
      hint: `Use $a(n)=${rule}$ to find the first three points $(1,a(1))$, $(2,a(2))$, $(3,a(3))$. Then ask whether the function has any input between 1 and 2.`,
      explanation: [
        `Evaluate the first terms: $a(1)=${t(1)}$, $a(2)=${t(2)}$, $a(3)=${t(3)}$. These give points ${tex(points)}.`,
        `The domain is only the positive integers, so the graph has points only at $n=1,2,3,\\ldots$ and nothing between them.`,
        kind === "arithmetic"
          ? `Each step changes the output by the same amount, ${seq.step}, so the separate points lie on one line. The line itself is not part of the graph.`
          : `Each step multiplies the output by ${seq.step}, so the heights do not change by a constant amount: the separate points do not lie on one line.`,
        "So the graph is a set of separate points, one for each position, with nothing between them.",
      ],
      correct,
      wrong: [
        {
          label:
            kind === "arithmetic"
              ? "A continuous line through all of these points"
              : "A continuous curve through all of these points",
          feedback:
            "Joining the points would add inputs such as $n=1.5$, where the sequence has no term. Only the whole-number inputs belong to the graph.",
        },
        {
          label: `Points at $n=1,2,3,\\ldots$ and also at every half step $n=1.5, 2.5,\\ldots$`,
          feedback:
            "Half-step inputs are not positions in the sequence. The domain contains whole numbers only.",
        },
        {
          label: `A ray that starts at ${tex(`(1,${t(1)})`)} and continues to the right`,
          feedback:
            "A ray is continuous, so it would include non-integer inputs. The graph consists of separate points.",
        },
        {
          label:
            kind === "arithmetic"
              ? `Separate points that do not lie on one line`
              : `Separate points that lie on one line`,
          feedback:
            kind === "arithmetic"
              ? "Equal steps in the output at equal steps in the input put the points on a line."
              : "A constant ratio is not a constant change, so the points do not lie on one line.",
        },
      ],
    };
  } else {
    const k = r(2, 5);
    // Geometric membership uses a positive ratio so the terms are monotone.
    const eff: Sequence =
      kind === "arithmetic" ? seq : { ...seq, step: Math.abs(seq.step) };
    const effRule = sequenceRule(eff);
    const lo = sequenceTerm(eff, k);
    const hi = sequenceTerm(eff, k + 1);
    const before = sequenceTerm(eff, k - 1);
    // Half the time the value is a term, so "yes" is a live answer.
    const isTerm = r(0, 1) === 1;
    const target = isTerm
      ? lo
      : kind === "arithmetic"
        ? lo + seq.step / 2
        : lo + (eff.first > 0 ? 1 : -1);
    const prompt = `${kind === "arithmetic" ? "An" : "A"} ${word} sequence is defined by $a(n)=${effRule}$ for $n=1,2,3,\\ldots$. Is $${target}$ a term of this sequence?`;
    spec = isTerm
      ? {
          prompt,
          hint: `Compute terms of $a(n)=${rule}$ and compare each with $${target}$. A value is a term only if some whole-number position gives exactly that value.`,
          explanation: [
            `Compute neighboring terms: $a(${k - 1})=${before}$, $a(${k})=${lo}$ and $a(${k + 1})=${hi}$.`,
            `$a(${k})=${target}$, so position ${k} produces $${target}$.`,
            `A value is a term when some position $n=1,2,3,\\ldots$ gives it. Here $n=${k}$, so the answer is yes.`,
            `So $${target}$ is a term of this sequence, in position ${k}.`,
          ],
          correct: `Yes. ${tex(`a(${k})=${target}`)}.`,
          wrong: [
            {
              label: `Yes. ${tex(`a(${k + 1})=${target}`)}.`,
              feedback: `$a(${k + 1})=${hi}$, not $${target}$. Compute the term before comparing.`,
            },
            {
              label: `Yes. ${tex(`a(${k - 1})=${target}`)}.`,
              feedback: `$a(${k - 1})=${before}$, not $${target}$. Compute the term before comparing.`,
            },
            {
              label: `No. No position produces ${tex(`${target}`)}.`,
              feedback: `Position ${k} does produce it: $a(${k})=${target}$. A value is a term when some whole-number position gives it.`,
            },
          ],
        }
      : {
          prompt,
          hint: `Compute the terms around $${target}$: find $a(${k})$ and $a(${k + 1})$ and see where $${target}$ falls. Then ask whether a whole-number position could produce it.`,
          explanation: [
            `Compute neighboring terms: $a(${k})=${lo}$ and $a(${k + 1})=${hi}$.`,
            `The target $${target}$ lies strictly between ${lo} and ${hi}, and the sequence moves in one direction, so no other term equals it.`,
            `There is no whole-number position between ${k} and ${k + 1}, so no term equals $${target}$. The answer is no.`,
            `So $${target}$ is not a term of this sequence.`,
          ],
          correct: `No. ${tex(`${target}`)} lies between ${tex(`a(${k})=${lo}`)} and ${tex(`a(${k + 1})=${hi}`)}, and no position lies between ${k} and ${k + 1}.`,
          wrong: [
            {
              label: `Yes. ${tex(`a(${k})=${target}`)}.`,
              feedback: `$a(${k})=${lo}$, not $${target}$. Compute the term before comparing.`,
            },
            {
              label: `Yes. ${tex(`a(${k + 1})=${target}`)}.`,
              feedback: `$a(${k + 1})=${hi}$, not $${target}$. Compute the term before comparing.`,
            },
            {
              label: `Yes. Some input between ${k} and ${k + 1} produces ${tex(`${target}`)}.`,
              feedback: `Inputs between ${k} and ${k + 1} are not positions. The function $a$ is defined only at whole numbers, so such an input does not exist.`,
            },
          ],
        };
  }
  return { kind, seq, variant, problem: build(meta, seed, r, spec) };
}

export const arithmeticSequenceAsFunctionCase = (seed: string) =>
  sequenceFunctionCase(arithmeticSequenceAsFunctionTemplate, seed);
export const geometricSequenceAsFunctionCase = (seed: string) =>
  sequenceFunctionCase(geometricSequenceAsFunctionTemplate, seed);

// ---------------------------------------------------------------------------
// Geometric rule forms
// ---------------------------------------------------------------------------

type Ratio = { p: number; q: number };
const ratioTex = ({ p, q }: Ratio) =>
  q === 1 ? (p < 0 ? `(${p})` : `${p}`) : `\\frac{${p}}{${q}}`;
const ratioBase = ({ p, q }: Ratio) =>
  q === 1 ? ratioTex({ p, q }) : `\\left(\\frac{${p}}{${q}}\\right)`;
const explicitRule = (first: number, base: string, exponent: string) =>
  `a_n=${first}\\cdot ${base}^{${exponent}}`;
const recursiveRule = (first: number, R: Ratio) =>
  `a_1=${first},\\ a_{n+1}=${ratioTex(R)}\\,a_n`;

const forms = (first: number, R: Ratio) => {
  const base = ratioBase(R);
  return {
    explicit: tex(explicitRule(first, base, "n-1")),
    recursive: tex(recursiveRule(first, R)),
  };
};

const explicitWrong = (first: number, R: Ratio): Wrong[] => {
  const base = ratioBase(R);
  return [
    {
      label: tex(explicitRule(first, base, "n")),
      feedback:
        "This multiplies by the ratio $n$ times, so it gives the next term. The first term is $a_1$ with no multiplication, so the exponent is $n-1$.",
    },
    {
      label: tex(`a_n=${first}+${ratioTex(R)}(n-1)`),
      feedback:
        "This adds the same amount each step, which describes an arithmetic sequence. A geometric sequence multiplies by the ratio each step, so the ratio is a base raised to a power.",
    },
    {
      label: tex(
        `a_n=${ratioTex(R)}\\cdot ${first < 0 ? `(${first})` : first}^{n-1}`,
      ),
      feedback:
        "The first term and the ratio have swapped roles. The first term is the starting multiplier; the ratio is raised to the power.",
    },
    {
      label: tex(`a_n=${first}\\cdot ${ratioTex(R)}(n-1)`),
      feedback:
        "The ratio is applied repeatedly, which is a power, not multiplication by $n-1$.",
    },
  ];
};

function geometricRuleFormsCase(seed: string) {
  const meta = geometricRuleFormsTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  const ratios: Ratio[] = [
    { p: 2, q: 1 },
    { p: 3, q: 1 },
    { p: 4, q: 1 },
    { p: 5, q: 1 },
    { p: -2, q: 1 },
    { p: -3, q: 1 },
    { p: 1, q: 2 },
    { p: 1, q: 3 },
    { p: 2, q: 3 },
    { p: 3, q: 2 },
  ];
  const hard: Ratio[] = ratios.filter((x) => x.p < 0 || x.q > 1);
  let R = variant === 4 ? pick(r, hard) : pick(r, ratios);
  const base = ratioBase(R);
  let first = nonzeroIn(r, -6, 9);
  let spec: Spec;
  if (variant === 0) {
    const f = forms(first, R);
    spec = {
      prompt: `A sequence has ${tex(recursiveRule(first, R))}. Which explicit rule gives $a_n$ directly?`,
      hint: `The recursive rule multiplies by ${tex(ratioTex(R))} once to get from each term to the next. Count how many multiplications separate $a_1$ from $a_n$.`,
      explanation: [
        `The first term is $a_1=${first}$, and each next term is ${tex(ratioTex(R))} times the previous one.`,
        `$a_2=a_1\\cdot ${base}$, $a_3=a_1\\cdot ${base}^2$, so $a_n$ has ${tex(base)} multiplied $n-1$ times.`,
        `The explicit rule is ${f.explicit}. Check: $n=1$ gives $a_1=${first}$.`,
      ],
      correct: f.explicit,
      wrong: explicitWrong(first, R),
    };
  } else if (variant === 1 || variant === 4) {
    const f = forms(first, R);
    spec = {
      prompt: `A sequence has the explicit rule ${f.explicit}. Which recursive rule describes the same sequence?`,
      hint: `Evaluate the explicit rule at $n=1$ to get the first term, then compare $a_2$ with $a_1$ to see the multiplier between consecutive terms.`,
      explanation: [
        `At $n=1$: $a_1=${first}\\cdot ${base}^0=${first}$.`,
        `Going from $a_n$ to $a_{n+1}$ multiplies by ${tex(base)}: $a_{n+1}=a_n\\cdot ${base}$.`,
        `The recursive rule is ${f.recursive}.`,
      ],
      correct: f.recursive,
      wrong: [
        {
          label: tex(`a_1=${first},\\ a_{n+1}=a_n+${ratioTex(R)}`),
          feedback:
            "This adds the ratio each step (an arithmetic rule). A geometric sequence multiplies by the ratio.",
        },
        {
          label: tex(`a_1=${ratioTex(R)},\\ a_{n+1}=${first}\\,a_n`),
          feedback:
            "The first term and the ratio have swapped roles. The first term is the value at $n=1$; the ratio is what each term is multiplied by.",
        },
        {
          label: tex(`a_1=${first},\\ a_n=${ratioTex(R)}\\,a_{n+1}`),
          feedback:
            "This multiplies the later term to get the earlier one. The explicit rule multiplies by the ratio going forward.",
        },
        {
          label: tex(`a_1=${first},\\ a_{n+1}=${ratioTex(R)}\\,n\\,a_n`),
          feedback:
            "The multiplier between terms is the constant ratio, not a ratio that changes with $n$.",
        },
      ],
    };
  } else if (variant === 2) {
    const contexts: {
      text: (A: number, rp: string) => string;
      ratios: Ratio[];
      noun: string;
    }[] = [
      {
        text: (A, rp) =>
          `A culture has ${A} ${A === 1 ? "cell" : "cells"} at hour 1. Each hour the count is ${rp} the count an hour earlier.`,
        ratios: ratios.filter((x) => x.q === 1 && x.p > 0),
        noun: "the cell count at hour $n$",
      },
      {
        text: (A, rp) =>
          `A ball's first bounce is ${A} ${A === 1 ? "centimeter" : "centimeters"} high. Each bounce is ${rp} as high as the previous bounce.`,
        ratios: ratios.filter((x) => x.q > 1 && x.p < x.q),
        noun: "the height of bounce $n$",
      },
      {
        text: (A, rp) =>
          `A fund holds ${A} ${A === 1 ? "dollar" : "dollars"} at the end of year 1. Each year its balance is ${rp} of the previous year's balance.`,
        ratios: [{ p: 3, q: 2 }],
        noun: "the balance at the end of year $n$",
      },
    ];
    const ctx = pick(r, contexts);
    const CR = pick(r, ctx.ratios);
    R = CR;
    first = r(1, 9);
    const f = forms(first, CR);
    const explicitAsked = r(0, 1) === 0;
    const rp = tex(ratioTex(CR));
    spec = explicitAsked
      ? {
          prompt: `${ctx.text(first, CR.q === 1 ? `${CR.p} times` : rp)} Let $a_n$ be ${ctx.noun}. Which rule gives $a_n$ directly from $n$?`,
          hint: `Position 1 is the starting value ${first}. Each later position multiplies by ${rp} once more. How many times has the multiplier been applied by position $n$?`,
          explanation: [
            `The first value is $a_1=${first}$, and each next value is ${rp} times the previous one.`,
            `Position $n$ is $n-1$ multiplications after position 1.`,
            `So $a_n=${first}\\cdot ${ratioBase(CR)}^{n-1}$: ${f.explicit}.`,
          ],
          correct: f.explicit,
          wrong: explicitWrong(first, CR),
        }
      : {
          prompt: `${ctx.text(first, CR.q === 1 ? `${CR.p} times` : rp)} Let $a_n$ be ${ctx.noun}. Which recursive rule describes the sequence?`,
          hint: `A recursive rule gives the starting value and says how to get each term from the one before. Identify both in the description: the count starts at ${first} and the multiplier is ${rp}.`,
          explanation: [
            `The starting value is $a_1=${first}$.`,
            `Each value is ${rp} times the value before it: $a_{n+1}=${ratioTex(CR)}\\,a_n$.`,
            `The recursive rule is ${f.recursive}.`,
          ],
          correct: f.recursive,
          wrong: [
            {
              label: tex(`a_1=${first},\\ a_{n+1}=a_n+${ratioTex(CR)}`),
              feedback:
                "Adding the ratio describes constant change. Each value here is a multiple of the previous one.",
            },
            {
              label: tex(`a_1=${ratioTex(CR)},\\ a_{n+1}=${first}\\,a_n`),
              feedback: "The starting value and the multiplier are swapped.",
            },
            {
              label: tex(`a_1=${first},\\ a_n=${ratioTex(CR)}\\,a_{n+1}`),
              feedback:
                "This multiplies the later value to get the earlier one; the description multiplies the earlier value.",
            },
            {
              label: tex(`a_0=${first},\\ a_{n+1}=${ratioTex(CR)}\\,a_n`),
              feedback:
                "The description starts at position 1, so the starting value is $a_1$, not $a_0$.",
            },
          ],
        };
  } else {
    // variant 3: two consecutive terms determine the rule.
    const q2 = R.q * R.q;
    first = q2 * r(1, 3) * (r(0, 1) ? 1 : -1);
    const second = (first * R.p) / R.q;
    const third = (first * R.p * R.p) / q2;
    const f = forms(first, R);
    spec = {
      prompt: `A geometric sequence has $a_2=${second}$ and $a_3=${third}$. Which explicit rule gives $a_n$?`,
      hint: `Divide $a_3=${third}$ by $a_2=${second}$ to find the common ratio. Then undo one multiplication to get $a_1$ from $a_2$.`,
      explanation: [
        `The common ratio is $a_3\\div a_2=${third}\\div ${signed(second)}=${ratioTex(R)}$.`,
        `Since $a_2=a_1\\cdot ${base}$, the first term is $a_1=${second}\\div ${base}=${first}$.`,
        `The explicit rule is ${f.explicit}. Check: $a_2=${first}\\cdot ${base}=${second}$.`,
      ],
      correct: f.explicit,
      wrong: [
        {
          label: tex(explicitRule(second, base, "n-1")),
          feedback: `This treats the given $a_2=${second}$ as the first term. ${second} is the second term, so the first term is ${first}.`,
        },
        {
          label: tex(explicitRule(first, base, "n")),
          feedback:
            "At $n=1$ this gives the second term. The exponent counts multiplications after $a_1$, which is $n-1$.",
        },
        {
          label: tex(explicitRule(first, base, "n-2")),
          feedback:
            "At $n=2$ this gives $a_1$ instead of $a_2$. The exponent should be 0 at $n=1$.",
        },
        {
          label: tex(explicitRule(second, base, "n")),
          feedback:
            "This starts from $a_2$ and also uses exponent $n$, which doubles the shift.",
        },
      ],
    };
  }
  return { variant, ratio: R, first, problem: build(meta, seed, r, spec) };
}
export { geometricRuleFormsCase };

// ---------------------------------------------------------------------------
// Solve by completing the square
// ---------------------------------------------------------------------------

const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19, 21, 22, 23];

function solveByCompletingSquareCase(seed: string) {
  const meta = solveByCompletingSquareTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  let spec: Spec;
  let roots: [string, string] | undefined;
  let model: Record<string, number> = {};
  if (variant === 0 || variant === 2) {
    const h = nonzeroIn(r, -6, 6);
    const k = r(1, 6);
    const a = variant === 2 ? pick(r, [2, 3, 4]) : 1;
    const c = h * h - k * k;
    const rhs = k * k;
    const equation = tex(`${quad(a, 2 * a * h, a * c)}=0`);
    const monic = quad(1, 2 * h, c);
    model = { a, h, k, c };
    spec = {
      prompt: `Solve ${equation} by completing the square. Which choice lists all solutions?`,
      hint:
        a === 1
          ? `Move the constant to the right. Half of the coefficient of $x$ in ${equation} is ${h}; add its square to both sides so the left side factors as a square.`
          : `The leading coefficient is ${a}, so divide every term of ${equation} by ${a} first. Then half of the new coefficient of $x$ is ${h}; add its square to both sides.`,
      explanation: [
        ...(a === 1
          ? []
          : [`Divide both sides by ${a}: ${tex(`${monic}=0`)}.`]),
        `Move the constant: $x^2${h === 0 ? "" : ` ${2 * h < 0 ? "-" : "+"} ${Math.abs(2 * h)}x`}=${-c}$.`,
        `Half of ${2 * h} is ${h}, and $${sqr(h)}=${h * h}$. Add ${h * h} to both sides: $(x ${h < 0 ? "-" : "+"} ${Math.abs(h)})^2=${rhs}$.`,
        `Adding the square of half the $x$-coefficient, the number multiplying $x$, makes the left side a perfect square.`,
        `Take both square roots, since a positive number has a positive and a negative square root: $x ${h < 0 ? "-" : "+"} ${Math.abs(h)}=\\pm ${k}$, so $x=${-h}\\pm ${k}$.`,
        `The solutions are $x=${-h + k}$ and $x=${-h - k}$.`,
      ],
      correct: rootPair(-h + k, -h - k),
      wrong: [
        {
          label: rootPair(h + k, h - k),
          feedback:
            "The sign of the shift is reversed: $(x+h)^2$ is zero at $x=-h$, so the solutions are centered at $-h$.",
        },
        {
          label: tex(`x=${-h + k}`),
          feedback:
            "Taking a square root gives both $+$ and $-$. Report both solutions.",
        },
        {
          label: rootPair(-h + rhs, -h - rhs),
          feedback: `Take the square root of ${rhs}; it is ${k}, not ${rhs}.`,
        },
        {
          label: rootPair(-2 * h + k, -2 * h - k),
          feedback:
            "Half of the coefficient of $x$ is the shift; using the whole coefficient doubles it.",
        },
      ],
    };
    roots = [String(-h + k), String(-h - k)];
  } else if (variant === 1) {
    const h = nonzeroIn(r, -5, 5);
    const m = pick(r, SQUAREFREE);
    const c = h * h - m;
    const equation = tex(`${quad(1, 2 * h, c)}=0`);
    const pm = (center: number, radical: string) =>
      tex(`x=${center === 0 ? "" : center}\\pm ${radical}`);
    const sqrtM = `\\sqrt{${m}}`;
    spec = {
      prompt: `Solve ${equation} by completing the square. Give the exact solutions.`,
      hint: `Move the constant ${c} to the right side. Half of the coefficient ${2 * h} is ${h}; add ${h * h} to both sides to make the left side a perfect square.`,
      explanation: [
        `Move the constant: $x^2${2 * h < 0 ? "-" : "+"}${Math.abs(2 * h)}x=${-c}$.`,
        `Add $${sqr(h)}=${h * h}$ to both sides: $(x ${h < 0 ? "-" : "+"} ${Math.abs(h)})^2=${m}$.`,
        `Adding the square of half the $x$-coefficient, the number multiplying $x$, makes the left side a perfect square.`,
        `Take square roots, both positive and negative: $x ${h < 0 ? "-" : "+"} ${Math.abs(h)}=\\pm ${sqrtM}$. ${m} is not a perfect square, so keep the radical, the square root sign.`,
        `Subtract the shift: $x=${-h}\\pm ${sqrtM}$.`,
        `So the exact solutions are $x=${-h}\\pm ${sqrtM}$.`,
      ],
      correct: pm(-h, sqrtM),
      wrong: [
        {
          label: pm(h, sqrtM),
          feedback:
            "The sign of the shift is reversed: $(x+h)^2$ is zero at $x=-h$.",
        },
        {
          label: pm(-h, `${m}`),
          feedback: `The square root of ${m} is $\\sqrt{${m}}$; do not drop the radical sign.`,
        },
        {
          label: pm(-2 * h, sqrtM),
          feedback:
            "Half of the coefficient of $x$ is the shift; using the whole coefficient doubles it.",
        },
        ...(h * h + c > 0
          ? [
              {
                label: pm(-h, `\\sqrt{${h * h + c}}`),
                feedback: `The constant moves to the other side with its sign changed, so the right side is $${h * h}-(${c})$, not $${h * h}+(${c})$.`,
              },
            ]
          : []),
        {
          label: pm(-h, `\\sqrt{${m + h * h}}`),
          feedback: `Add ${h * h} to both sides once; the right side is ${m}, so the radicand is ${m}.`,
        },
      ],
    };
    roots = [`${-h}+sqrt${m}`, `${-h}-sqrt${m}`];
    model = { h, m, c };
  } else if (variant === 3) {
    const h = nonzeroIn(r, -6, 6);
    const c = nonzeroIn(r, -12, 12);
    const rhs = h * h - c;
    const equation = tex(`${quad(1, 2 * h, c)}=0`);
    const lhs = (s: number, n: number) =>
      `(x ${n < 0 ? "-" : "+"} ${Math.abs(n)})^2=${s}`;
    model = { h, c, rhs };
    spec = {
      prompt: `To solve ${equation} by completing the square, you add the same number to both sides and factor the left side. Which equation results?`,
      hint: `Half of the coefficient of $x$ is ${h}, so the number to add to both sides is $${sqr(h)}$. Add it to the right side too, after moving the constant ${c} to the other side.`,
      explanation: [
        `Move the constant: $x^2${2 * h < 0 ? "-" : "+"}${Math.abs(2 * h)}x=${-c}$.`,
        `Half of ${2 * h} is ${h}; $${sqr(h)}=${h * h}$. Adding ${h * h} to both sides gives $x^2${2 * h < 0 ? "-" : "+"}${Math.abs(2 * h)}x+${h * h}=${-c}+${h * h}$.`,
        `The left side factors as $(x ${h < 0 ? "-" : "+"} ${Math.abs(h)})^2$ and the right side is ${rhs}: ${tex(lhs(rhs, h))}.`,
        `So the equation that results is ${tex(lhs(rhs, h))}.`,
      ],
      correct: tex(lhs(rhs, h)),
      wrong: [
        {
          label: tex(lhs(-c, h)),
          feedback: `The ${h * h} added to the left side must be added to the right side too.`,
        },
        {
          label: tex(lhs(h * h + c, h)),
          feedback: `Moving ${c} to the right side changes its sign: the right side is $${-c}+${h * h}$.`,
        },
        {
          label: tex(
            `(x ${2 * h < 0 ? "-" : "+"} ${Math.abs(2 * h)})^2=${4 * h * h - c}`,
          ),
          feedback:
            "The shift inside the square is half the coefficient of $x$, not the whole coefficient.",
        },
        {
          label: tex(lhs(rhs, -h)),
          feedback:
            "The sign inside the square matches the sign of the middle term: $x^2+2hx+h^2=(x+h)^2$.",
        },
      ],
    };
  } else {
    let b: number, c: number, d: number;
    do {
      b = pick(r, [-7, -5, -3, -1, 1, 3, 5, 7]);
      c = nonzeroIn(r, -6, 6);
      d = b * b - 4 * c;
    } while (d <= 0 || isSquare(d));
    const equation = tex(`${quad(1, b, c)}=0`);
    const frac = (top: string, bottom: number) => `\\frac{${top}}{${bottom}}`;
    const sol = (lead: string, root: string, bottom: number) =>
      tex(`x=${frac(`${lead}\\pm ${root}`, bottom)}`);
    const sqrtD = `\\sqrt{${d}}`;
    model = { b, c, d };
    spec = {
      prompt: `Solve ${equation} by completing the square. Give the exact solutions.`,
      hint: `Move the constant ${c} to the right. Half of ${b} is $\\frac{${b}}{2}$; add its square, $\\frac{${b * b}}{4}$, to both sides.`,
      explanation: [
        `Move the constant: $x^2${b < 0 ? "-" : "+"}${Math.abs(b) === 1 ? "" : Math.abs(b)}x=${-c}$.`,
        `Add $\\left(\\frac{${b}}{2}\\right)^2=\\frac{${b * b}}{4}$ to both sides: $\\left(x${b < 0 ? "-" : "+"}\\frac{${Math.abs(b)}}{2}\\right)^2=${-c}+\\frac{${b * b}}{4}=\\frac{${d}}{4}$.`,
        `Take square roots: $x${b < 0 ? "-" : "+"}\\frac{${Math.abs(b)}}{2}=\\pm\\frac{${sqrtD}}{2}$, since ${d} is not a perfect square.`,
        `Subtract the shift: ${sol(`${-b}`, sqrtD, 2)}.`,
        `So the exact solutions are ${sol(`${-b}`, sqrtD, 2)}.`,
      ],
      correct: sol(`${-b}`, sqrtD, 2),
      wrong: [
        {
          label: sol(`${b}`, sqrtD, 2),
          feedback:
            "The sign is reversed: $x^2+bx$ completes to $(x+b/2)^2$, so $x=-b/2\\pm\\ldots$.",
        },
        {
          label: tex(`x=${frac(`${-b}`, 2)}\\pm ${sqrtD}`),
          feedback:
            "The square root of $\\frac{" +
            d +
            "}{4}$ is $\\frac{\\sqrt{" +
            d +
            "}}{2}$; the denominator 2 belongs to the whole root.",
        },
        {
          label: sol(`${-b}`, sqrtD, 4),
          feedback:
            "Half of the coefficient is $\\frac{b}{2}$, so the common denominator is 2, not 4.",
        },
        ...(b * b + 4 * c > 0
          ? [
              {
                label: sol(`${-b}`, `\\sqrt{${b * b + 4 * c}}`, 2),
                feedback: `Moving ${c} to the right changes its sign, so the radicand is $${b * b}-4(${c})$.`,
              },
            ]
          : []),
        {
          label: sol(`${-b}`, `\\sqrt{${d + 4}}`, 2),
          feedback: `The radicand is $${b * b}-4(${c})=${d}$ exactly; check the arithmetic.`,
        },
      ],
    };
  }
  return { variant, model, roots, problem: build(meta, seed, r, spec) };
}
export { solveByCompletingSquareCase };

// ---------------------------------------------------------------------------
// Complex numbers
// ---------------------------------------------------------------------------

function complexQuadraticSolveCase(seed: string) {
  const meta = complexQuadraticSolveTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  const imag = (m: number, perfect: boolean) => {
    if (perfect) {
      const k = Math.sqrt(m);
      return `${k === 1 ? "" : k}i`;
    }
    return `\\sqrt{${m}}\\,i`;
  };
  let h = 0;
  let m = 0;
  let a = 1;
  let perfect = true;
  if (variant === 0) {
    m = pick(r, [4, 9, 16, 25, 2, 3, 5, 7]);
    perfect = isSquare(m);
  } else if (variant === 1 || variant === 4) {
    h = nonzeroIn(r, -5, 5);
    m = pick(r, [1, 4, 9, 16, 25]);
  } else if (variant === 2) {
    h = nonzeroIn(r, -5, 5);
    m = pick(r, SQUAREFREE);
    perfect = false;
  } else {
    h = nonzeroIn(r, -5, 5);
    a = pick(r, [2, 3]);
    m = pick(r, [1, 4, 9, 2, 3, 5, 6, 7]);
    perfect = isSquare(m);
  }
  const q = h * h + m;
  const radicalTex = perfect ? `${Math.sqrt(m)}` : `\\sqrt{${m}}`;
  const pm = (center: number, part: string) =>
    tex(`x=${center === 0 ? "" : center}\\pm ${part}`);
  const equation = tex(`${quad(a, 2 * a * h, a * q)}=0`);
  let spec: Spec;
  if (variant === 4) {
    const k = Math.sqrt(m);
    spec = {
      prompt: `Which quadratic equation with real coefficients has the solutions ${pm(-h, `${k === 1 ? "" : k}i`)}?`,
      hint: `Solutions ${pm(-h, `${k === 1 ? "" : k}i`)} have the form $p\\pm qi$, which comes from $(x-p)^2=-q^2$. Move everything to one side and expand.`,
      explanation: [
        `The solutions are $x=${-h}\\pm ${k === 1 ? "" : k}i$, so $${h === 0 ? "x" : `x${h < 0 ? "-" : "+"}${Math.abs(h)}`}=\\pm ${k === 1 ? "" : k}i$, that is $(x${h < 0 ? "-" : "+"}${Math.abs(h)})^2=(${k === 1 ? "" : k}i)^2=${-m}$.`,
        `Expand and move ${-m} to the left: $x^2${2 * h < 0 ? "-" : "+"}${Math.abs(2 * h)}x+${h * h}+${m}=0$.`,
        `The equation is ${tex(`${quad(1, 2 * h, q)}=0`)}.`,
      ],
      correct: tex(`${quad(1, 2 * h, q)}=0`),
      wrong: [
        {
          label: tex(`${quad(1, -2 * h, q)}=0`),
          feedback:
            "The sign of the middle term is reversed: the real part $-h$ of the solutions gives middle coefficient $2h$.",
        },
        {
          label: tex(`${quad(1, 2 * h, h * h - m)}=0`),
          feedback:
            "Squaring $qi$ gives $-q^2$, which moves to the other side as $+q^2$. The constant is $h^2+q^2$.",
        },
        {
          label: tex(`${quad(1, 2 * h, m)}=0`),
          feedback:
            "The constant includes the square of the real part too: it is $h^2+q^2$.",
        },
        {
          label: tex(`${quad(1, 2 * h, -m)}=0`),
          feedback:
            "These coefficients give real solutions. A constant larger than $h^2$ is needed for a negative discriminant.",
        },
      ],
    };
  } else {
    const dividing =
      a === 1
        ? []
        : [`Divide both sides by ${a}: ${tex(`${quad(1, 2 * h, q)}=0`)}.`];
    spec = {
      prompt: `Solve ${equation} over the complex numbers. Which choice lists all solutions?`,
      hint:
        variant === 0
          ? `Isolate $x^2$ in ${equation}. A real number squared is never negative, so use $i^2=-1$ to take the square root of a negative number.`
          : `Complete the square in ${equation}${a === 1 ? "" : `, after dividing by ${a}`}: half of the coefficient of $x$ is ${h}. The right side will be negative, so use $i^2=-1$ for its square root.`,
      explanation: [
        ...dividing,
        variant === 0
          ? `Isolate $x^2$: $x^2=${-m}$.`
          : `Complete the square: $(x${h < 0 ? "-" : "+"}${Math.abs(h)})^2=${h * h}-${q}=${-m}$.`,
        `No real number squares to ${-m}, so there are no real solutions; use $i^2=-1$: $${variant === 0 ? "x" : `x${h < 0 ? "-" : "+"}${Math.abs(h)}`}=\\pm ${radicalTex}\\,i$.`,
        `The solutions are ${pm(-h, imag(m, perfect))}.`,
      ],
      correct: pm(-h, imag(m, perfect)),
      wrong: [
        {
          label: pm(-h, radicalTex),
          feedback:
            "These are real numbers, and squaring them gives a positive number. The square root of a negative number needs $i$.",
        },
        ...(h === 0
          ? []
          : [
              {
                label: pm(h, imag(m, perfect)),
                feedback:
                  "The sign of the real part is reversed: $(x+h)^2$ is centered at $-h$.",
              },
              {
                label: pm(-2 * h, imag(m, perfect)),
                feedback:
                  "Half of the coefficient of $x$ is the shift; using the whole coefficient doubles it.",
              },
              {
                label: pm(-h, `\\sqrt{${q}}\\,i`),
                feedback: `Completing the square adds ${h * h} to both sides, so the right side is $${h * h}-${q}=${-m}$.`,
              },
            ]),
        ...(m === 1
          ? []
          : [
              {
                label: pm(-h, `${m}i`),
                feedback: `Take the square root of ${m}; the imaginary coefficient is $\\sqrt{${m}}$, not ${m}.`,
              },
            ]),
        {
          label: tex(
            `x=${-h === 0 ? "" : -h}${h === 0 ? "" : "+"}${radicalTex}\\,i`,
          ),
          feedback:
            "Taking a square root gives both $+$ and $-$. The two solutions are conjugates.",
        },
      ],
    };
  }
  return { variant, h, m, a, perfect, problem: build(meta, seed, r, spec) };
}
export { complexQuadraticSolveCase };

const POWER_I = ["1", "i", "-1", "-i"];
function scaledPower(c: number, e: number): { re: number; im: number } {
  const rem = e % 4;
  return rem === 0
    ? { re: c, im: 0 }
    : rem === 1
      ? { re: 0, im: c }
      : rem === 2
        ? { re: -c, im: 0 }
        : { re: 0, im: -c };
}
const cx = ({ re, im }: { re: number; im: number }) =>
  tex(im === 0 ? `${re}` : `${im === 1 ? "" : im === -1 ? "-" : im}i`);

function complexPartsCase(seed: string) {
  const meta = complexPartsTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  let spec: Spec;
  if (variant === 0) {
    const shape = r(0, 5);
    const a = shape === 1 ? 0 : nonzeroIn(r, -9, 9);
    const b = shape === 2 ? 0 : nonzeroIn(r, -9, 9);
    const z = poly([
      [a, ""],
      [b, "i"],
    ]);
    const pair = (re: string, im: string) =>
      `real part ${tex(re)}, imaginary part ${tex(im)}`;
    spec = {
      prompt: `Write the number $z=${z === "0" ? "0" : z}$ as $a+bi$ with real numbers $a$ and $b$. Which choice gives its real part and its imaginary part?`,
      hint: `Compare $z=${z}$ with $a+bi$. The real part is the term without $i$ (0 if there is none); the imaginary part is the real coefficient of $i$ (0 if there is no $i$ term).`,
      explanation: [
        `A complex number $a+bi$ has real part $a$ and imaginary part $b$, the real number multiplying $i$.`,
        `Write $z=${z}$ as $${a}${b < 0 ? `+(${b})` : `+${b}`}i$.`,
        `The real part is ${a}; the imaginary part is ${b}.`,
      ],
      correct: pair(`${a}`, `${b}`),
      wrong: [
        {
          label: pair(`${b}`, `${a}`),
          feedback:
            "The parts are swapped. The real part is the term without $i$; the imaginary part is the coefficient of $i$.",
        },
        {
          label: pair(`${a}`, `${-b}`),
          feedback:
            "Keep the sign of the coefficient of $i$ as written in $a+bi$.",
        },
        b === 0
          ? {
              label: pair(`${a}`, `${a}`),
              feedback:
                "There is no $i$ term, so the imaginary part is 0. The real number $a$ is the real part only.",
            }
          : {
              label: `real part ${tex(`${a}`)}, imaginary part ${tex(`${b}i`)}`,
              feedback:
                "The imaginary part is the real number $b$. The term $bi$ is called the imaginary term.",
            },
        {
          label: pair(`${-a}`, `${b}`),
          feedback: "Keep the sign of the real term as written.",
        },
      ],
    };
  } else if (variant === 1) {
    const e = r(2, 43);
    const rem = e % 4;
    const labelFor = (i: number) => tex(POWER_I[i]!);
    const wrongs: Wrong[] = [0, 1, 2, 3]
      .filter((i) => i !== rem)
      .map((i) => ({
        label: labelFor(i),
        feedback: `This is $i^{${i === 0 ? 4 : i}}$. Powers of $i$ repeat every 4 steps ($i,\\ -1,\\ -i,\\ 1$), so use the remainder of ${e} divided by 4, which is ${rem}.`,
      }));
    spec = {
      prompt: `Simplify $i^{${e}}$, using $i^2=-1$.`,
      hint: `Powers of $i$ repeat in a cycle of 4: $i^1=i$, $i^2=-1$, $i^3=-i$, $i^4=1$. Divide the exponent ${e} by 4 and look at the remainder.`,
      explanation: [
        `$i^1=i$, $i^2=-1$, $i^3=i^2\\cdot i=-i$ and $i^4=(i^2)^2=1$, then the pattern repeats.`,
        `${e} divided by 4 leaves remainder ${rem}, because $${e}=4\\cdot ${(e - rem) / 4}+${rem}$.`,
        `So $i^{${e}}=(i^4)^{${(e - rem) / 4}}\\cdot i^{${rem}}=${POWER_I[rem]}$.`,
      ],
      correct: labelFor(rem),
      wrong: wrongs,
    };
  } else if (variant === 2) {
    const c = nonzeroIn(r, -9, 9);
    const big = Math.abs(c) === 1 ? 3 * c : c;
    const e = r(5, 30);
    const rem = e % 4;
    const values = [0, 1, 2, 3].map((i) => scaledPower(big, i));
    const own = scaledPower(big, e);
    spec = {
      prompt: `Simplify $${big}\\,i^{${e}}$ to the form $a+bi$.`,
      hint: `Find $i^{${e}}$ first: powers of $i$ repeat every 4 steps, so use the remainder of ${e} divided by 4. Then multiply by ${big}.`,
      explanation: [
        `${e} divided by 4 leaves remainder ${rem}, so $i^{${e}}=${POWER_I[rem]}$.`,
        `Multiply: $${big}\\cdot ${POWER_I[rem]!.startsWith("-") ? `(${POWER_I[rem]})` : POWER_I[rem]}=${own.im === 0 ? own.re : `${own.im}i`}$.`,
        `So in $a+bi$ form the value is ${cx(own)}.`,
      ],
      correct: cx(own),
      wrong: values
        .filter((_, i) => i !== rem)
        .map((value, idx) => ({
          label: cx(value),
          feedback: `This is $${big}\\,i^{${[0, 1, 2, 3].filter((i) => i !== rem)[idx]}}$. Reduce the exponent ${e} modulo 4 to get remainder ${rem}.`,
        })),
    };
  } else if (variant === 3) {
    const k = r(2, 9);
    const a = nonzeroIn(r, -9, 9);
    const s = r(0, 1) ? 1 : -1;
    const expression = `${a}${s === 1 ? "+" : "-"}\\sqrt{-${k * k}}`;
    const lab = (re: number, im: number) =>
      tex(
        poly([
          [re, ""],
          [im, "i"],
        ]),
      );
    const wrongReal = a + s * k;
    spec = {
      prompt: `Write $${expression}$ in the form $a+bi$.`,
      hint: `Use $\\sqrt{-n}=\\sqrt{n}\\,i$ for positive $n$: write $\\sqrt{-${k * k}}$ as a multiple of $i$ first, then keep the sign in front of it.`,
      explanation: [
        `$\\sqrt{-${k * k}}=\\sqrt{${k * k}}\\cdot\\sqrt{-1}=${k}i$.`,
        `Keep the sign in front: $${expression}=${a}${s === 1 ? "+" : "-"}${k}i$.`,
        `In $a+bi$ form this is ${lab(a, s * k)}.`,
      ],
      correct: lab(a, s * k),
      wrong: [
        {
          label: lab(a, s * k * k),
          feedback: `The square root of ${k * k} is ${k}; do not keep ${k * k} as the coefficient.`,
        },
        {
          label: lab(a, -s * k),
          feedback:
            "The sign in front of the root is part of the expression; keep it.",
        },
        {
          label: tex(`${wrongReal}`),
          feedback:
            "A root of a negative number is not a real number; it is a multiple of $i$ and cannot be added to the real part.",
        },
        {
          label: lab(a + s * k * k, 0),
          feedback:
            "The root of a negative number has an $i$ and cannot combine with the real term.",
        },
      ],
    };
  } else {
    const evens: number[] = [];
    while (evens.length < 1) evens.push(2 * r(1, 15));
    const odds: number[] = [];
    while (odds.length < 2) {
      const o = 2 * r(1, 15) + 1;
      if (!odds.includes(o)) odds.push(o);
    }
    const re = nonzeroIn(r, -6, 6);
    const im = nonzeroIn(r, -6, 6);
    spec = {
      prompt: "Which of these is a real number (its imaginary part is 0)?",
      hint: "Reduce each power of $i$ using the cycle of 4: $i,\\ -1,\\ -i,\\ 1$. Then ask whether any $i$ remains: the imaginary part is 0 only if none does.",
      explanation: [
        `$i^{${evens[0]}}$: ${evens[0]} leaves remainder ${evens[0]! % 4} when divided by 4, so it equals ${POWER_I[evens[0]! % 4]}, which has no $i$.`,
        ...odds.map(
          (o) =>
            `$i^{${o}}$: remainder ${o % 4}, so it equals $${POWER_I[o % 4]}$, a nonzero multiple of $i$.`,
        ),
        `$${poly([
          [re, ""],
          [im, "i"],
        ])}$ has imaginary part ${im}, not 0.`,
        `Only $i^{${evens[0]}}$ is real.`,
      ],
      correct: tex(`i^{${evens[0]}}`),
      wrong: [
        ...odds.map((o) => ({
          label: tex(`i^{${o}}`),
          feedback: `${o} leaves remainder ${o % 4} when divided by 4, so $i^{${o}}=${POWER_I[o % 4]}$, which still has $i$.`,
        })),
        {
          label: tex(
            poly([
              [re, ""],
              [im, "i"],
            ]),
          ),
          feedback: `The imaginary part is ${im}, which is not 0.`,
        },
      ],
    };
  }
  return { variant, problem: build(meta, seed, r, spec) };
}
export { complexPartsCase };

// ---------------------------------------------------------------------------
// Interpret slope and initial value
// ---------------------------------------------------------------------------

type Context = {
  intro: (model: string) => string;
  model: (m: number, b: number) => string;
  yWhat: string; // "the total charge"
  yMany: string; // "dollars"
  yOne: string; // "dollar"
  xMany: string; // "hours"
  xOne: string; // "hour"
  atZero: string; // "for a job of 0 hours"
  direction: 1 | -1;
  mRange: [number, number];
  bRange: [number, number];
  nonzeroStart?: boolean;
};

const CONTEXTS: Context[] = [
  {
    intro: (m) =>
      `A plumber's total charge, $C$ dollars, for a job lasting $h$ hours is modeled by ${m}.`,
    model: (m, b) => `C=${m}h+${b}`,
    yWhat: "the total charge",
    yMany: "dollars",
    yOne: "dollar",
    xMany: "hours",
    xOne: "hour",
    atZero: "for a job of 0 hours",
    direction: 1,
    mRange: [25, 75],
    bRange: [20, 90],
  },
  {
    intro: (m) =>
      `A seedling's height, $H$ centimeters, $w$ weeks after planting is modeled by ${m}.`,
    model: (m, b) => `H=${m}w+${b}`,
    yWhat: "the height",
    yMany: "centimeters",
    yOne: "centimeter",
    xMany: "weeks",
    xOne: "week",
    atZero: "at planting (0 weeks)",
    direction: 1,
    mRange: [2, 9],
    bRange: [3, 15],
  },
  {
    intro: (m) =>
      `A taxi's fare, $F$ dollars, for a trip of $d$ miles is modeled by ${m}.`,
    model: (m, b) => `F=${m}d+${b}`,
    yWhat: "the fare",
    yMany: "dollars",
    yOne: "dollar",
    xMany: "miles",
    xOne: "mile",
    atZero: "for a trip of 0 miles",
    direction: 1,
    mRange: [2, 6],
    bRange: [3, 9],
  },
  {
    intro: (m) =>
      `The balance, $B$ dollars, on a gift card $w$ weeks after purchase is modeled by ${m}.`,
    model: (m, b) => `B=${b}-${m}w`,
    yWhat: "the balance",
    yMany: "dollars",
    yOne: "dollar",
    xMany: "weeks",
    xOne: "week",
    atZero: "at purchase (0 weeks)",
    direction: -1,
    mRange: [5, 25],
    bRange: [100, 250],
  },
  {
    intro: (m) =>
      `The water in a draining tank, $V$ liters, $t$ minutes after the drain opens is modeled by ${m}.`,
    model: (m, b) => `V=${b}-${m}t`,
    yWhat: "the amount of water",
    yMany: "liters",
    yOne: "liter",
    xMany: "minutes",
    xOne: "minute",
    atZero: "when the drain opens (0 minutes)",
    direction: -1,
    mRange: [3, 12],
    bRange: [80, 200],
  },
  {
    intro: (m) =>
      `A magazine's number of subscribers, $N$, $t$ years after 2018 is modeled by ${m}.`,
    model: (m, b) => `N=${b}+${m}t`,
    yWhat: "the number of subscribers",
    yMany: "subscribers",
    yOne: "subscriber",
    xMany: "years",
    xOne: "year",
    atZero: "in 2018 (0 years after 2018)",
    direction: 1,
    mRange: [40, 120],
    bRange: [800, 1500],
    nonzeroStart: true,
  },
  {
    intro: (m) =>
      `A town's population, $P$ people, $t$ years after 2015 is modeled by ${m}.`,
    model: (m, b) => `P=${b}-${m}t`,
    yWhat: "the population",
    yMany: "people",
    yOne: "person",
    xMany: "years",
    xOne: "year",
    atZero: "in 2015 (0 years after 2015)",
    direction: -1,
    mRange: [60, 180],
    bRange: [6000, 9000],
    nonzeroStart: true,
  },
];

function interpretLinearParametersCase(seed: string) {
  const meta = interpretLinearParametersTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  const pool =
    variant === 2
      ? CONTEXTS.filter((c) => c.direction === -1)
      : variant === 3
        ? CONTEXTS.filter((c) => c.nonzeroStart)
        : CONTEXTS;
  const ctx = pick(r, pool);
  let m = r(ctx.mRange[0], ctx.mRange[1]);
  const b = r(ctx.bRange[0], ctx.bRange[1]);
  if (m === b) m++;
  const Y = ctx.yWhat.charAt(0).toUpperCase() + ctx.yWhat.slice(1);
  const verb = ctx.direction > 0 ? "increases" : "decreases";
  const opposite = ctx.direction > 0 ? "decreases" : "increases";
  const equation = tex(ctx.model(m, b));
  const slope = `${Y} ${verb} by ${m} ${ctx.yMany} for each additional ${ctx.xOne}.`;
  const slopeShort = `${Y} ${verb} by ${m} ${ctx.yMany} per ${ctx.xOne}.`;
  const initialShort = `It is ${b} ${ctx.yMany} ${ctx.atZero}.`;
  const initial = `${Y} ${ctx.atZero} is ${b} ${ctx.yMany}.`;
  const prompt = `${ctx.intro(equation)}`;
  const slopeWrong: Wrong[] = [
    {
      label: `${Y} ${ctx.atZero} is ${m} ${ctx.yMany}.`,
      feedback: `${m} is the rate of change, multiplied by the number of ${ctx.xMany}. The value ${ctx.atZero} is the constant term, ${b}.`,
    },
    {
      label: `${Y} after one ${ctx.xOne} is ${m} ${ctx.yMany}.`,
      feedback: `After one ${ctx.xOne} the model gives ${ctx.direction > 0 ? m + b : b - m}, because the constant ${b} is included. ${m} is the change per ${ctx.xOne}, not the value after one.`,
    },
    {
      label: `${Y} ${opposite} by ${m} ${ctx.yMany} for each additional ${ctx.xOne}.`,
      feedback: `Check the sign of the term with ${m}: in this model ${ctx.yWhat} ${verb} as the ${ctx.xOne}s increase.`,
    },
    {
      label: `The number of ${ctx.xMany} increases by ${m} for each additional ${ctx.yOne}.`,
      feedback: `The units are reversed: the rate is ${ctx.yMany} per ${ctx.xOne}, not ${ctx.xMany} per ${ctx.yOne}.`,
    },
  ];
  const initialWrong: Wrong[] = [
    {
      label: `${Y} ${verb} by ${b} ${ctx.yMany} for each additional ${ctx.xOne}.`,
      feedback: `${b} is the constant term. The rate of change is the number multiplying the variable, ${m}.`,
    },
    {
      label: `${Y} ${ctx.atZero} is ${m} ${ctx.yMany}.`,
      feedback: `${m} multiplies the variable, so it is the change per ${ctx.xOne}. The value ${ctx.atZero} is ${b}.`,
    },
    {
      label: `${Y} after one ${ctx.xOne} is ${b} ${ctx.yMany}.`,
      feedback: `After one ${ctx.xOne} the model gives ${ctx.direction > 0 ? m + b : b - m}. The constant ${b} is the value when the variable is 0.`,
    },
    {
      label: `The number of ${ctx.xMany} when ${ctx.yWhat} is 0 is ${b}.`,
      feedback: `${b} is a value of ${ctx.yWhat}, found by putting 0 in for the variable. It is not a number of ${ctx.xMany}.`,
    },
  ];
  let spec: Spec;
  if (variant === 0 || variant === 2) {
    spec = {
      prompt: `${prompt} What does the number ${m} represent in this model?`,
      hint: `In ${equation}, ${m} multiplies the variable. Compare the value of the model at two inputs one ${ctx.xOne} apart and see how much ${ctx.yWhat} changes.`,
      explanation: [
        `Compare inputs one ${ctx.xOne} apart: ${ctx.yWhat} differs by ${m} ${ctx.yMany}.`,
        ctx.direction > 0
          ? `The term with ${m} is added, so ${ctx.yWhat} increases as the ${ctx.xOne}s increase.`
          : `The term with ${m} is subtracted, so ${ctx.yWhat} decreases as the ${ctx.xOne}s increase.`,
        `So ${m} is the rate of change: ${slope.charAt(0).toLowerCase()}${slope.slice(1)}`,
      ],
      correct: slope,
      wrong: slopeWrong,
    };
  } else if (variant === 1 || variant === 3) {
    spec = {
      prompt: `${prompt} What does the number ${b} represent in this model?`,
      hint: `The input is 0 when no ${ctx.xMany} have passed. Put 0 in for the variable in ${equation} and see which term remains.`,
      explanation: [
        `Put 0 in for the variable: the term with ${m} becomes 0, leaving ${b}.`,
        `The input 0 means ${ctx.atZero.replace(/^(for|at|in|when) /, "")}.`,
        `So ${b} is the initial value: ${initial.charAt(0).toLowerCase()}${initial.slice(1)}`,
      ],
      correct: initial,
      wrong: initialWrong,
    };
  } else {
    spec = {
      prompt: `${prompt} Which statement interprets both numbers in the model?`,
      hint: `Interpret ${m}, the number multiplying the variable, as a change per ${ctx.xOne}. Interpret ${b}, the constant, as the value when the variable is 0.`,
      explanation: [
        `The number ${m} multiplies the variable: ${slope.charAt(0).toLowerCase()}${slope.slice(1)}`,
        `The constant ${b} is the value when the variable is 0: ${initial.charAt(0).toLowerCase()}${initial.slice(1)}`,
        "Each number is stated with its units, so each sentence says what it measures.",
      ],
      correct: `${slopeShort} ${initialShort}`,
      wrong: [
        {
          label: `${Y} ${verb} by ${b} ${ctx.yMany} per ${ctx.xOne}. It is ${m} ${ctx.yMany} ${ctx.atZero}.`,
          feedback: `The roles are swapped: ${m} is the change per ${ctx.xOne} and ${b} is the value ${ctx.atZero}.`,
        },
        {
          label: `${Y} ${opposite} by ${m} ${ctx.yMany} per ${ctx.xOne}. ${initialShort}`,
          feedback: `The initial value is right, but the direction of change is reversed.`,
        },
        {
          label: `${slopeShort} It is ${b} ${ctx.yMany} after one ${ctx.xOne}.`,
          feedback: `The rate is right, but ${b} is the value when the variable is 0, not after one ${ctx.xOne}.`,
        },
        {
          label: `${Y} ${verb} by ${m} ${ctx.yMany} in total. ${initialShort}`,
          feedback: `${m} ${ctx.yMany} is the change for each ${ctx.xOne}, not the total change.`,
        },
      ],
    };
  }
  return { variant, m, b, problem: build(meta, seed, r, spec) };
}
export { interpretLinearParametersCase };

// ---------------------------------------------------------------------------
// Quadratic forms
// ---------------------------------------------------------------------------

function quadraticFormConversionCase(seed: string) {
  const meta = quadraticFormConversionTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  let spec: Spec;
  let model: Record<string, number> = {};
  if (variant === 0) {
    const h = nonzeroIn(r, -5, 5);
    const k = nonzeroIn(r, -9, 9);
    const c = h * h + k;
    const std = tex(`y=${quad(1, -2 * h, c)}`);
    model = { h, k, c };
    spec = {
      prompt: `Rewrite ${std} in vertex form $y=(x-h)^2+k$ by completing the square. Which equation is correct?`,
      hint: `Half of the coefficient of $x$ is ${-h}. Write $x^2${-2 * h < 0 ? "-" : "+"}${Math.abs(2 * h)}x$ as a perfect square minus ${h * h}, then combine with the constant ${c}.`,
      explanation: [
        `Half of ${-2 * h} is ${-h}, and $${sqr(-h)}=${h * h}$.`,
        `Group the first two terms and add and subtract ${h * h}: $y=(x^2${-2 * h < 0 ? "-" : "+"}${Math.abs(2 * h)}x+${h * h})+${c}-${h * h}$.`,
        `Factor and combine: ${tex(`y=${vertexForm(1, h, k)}`)}.`,
        `The vertex is $(${h},${k})$.`,
      ],
      correct: tex(`y=${vertexForm(1, h, k)}`),
      wrong: [
        {
          label: tex(`y=${vertexForm(1, -h, k)}`),
          feedback:
            "The sign inside the parentheses is reversed: $(x-h)^2$ has its vertex at $x=h$.",
        },
        {
          label: tex(`y=${vertexForm(1, h, c)}`),
          feedback: `Adding ${h * h} inside the square changes the expression, so ${h * h} must be subtracted outside: the constant is $${c}-${h * h}$.`,
        },
        {
          label: tex(`y=${vertexForm(1, h, c + h * h)}`),
          feedback: `The square contributes ${h * h}, which must be subtracted, not added, to keep the expression equal.`,
        },
        {
          label: tex(`y=${vertexForm(1, h, -k)}`),
          feedback: `Check the constant: $${c}-${h * h}=${k}$.`,
        },
      ],
    };
  } else if (variant === 1) {
    const a = pick(r, [2, 3, -1, -2, -3]);
    const h = nonzeroIn(r, -4, 4);
    const k = nonzeroIn(r, -9, 9);
    const c = a * h * h + k;
    const std = tex(`y=${quad(a, -2 * a * h, c)}`);
    const word = a > 0 ? "minimum" : "maximum";
    const lead = a === -1 ? "-" : `${a}`;
    const plus = (n: number) => (n < 0 ? `-${-n}` : `+${n}`);
    const minus = (n: number) => (n < 0 ? `+${-n}` : `-${n}`);
    model = { a, h, k, c };
    spec = {
      prompt: `By completing the square, find the ${word} value of ${std}.`,
      hint: `Factor ${a} out of the two $x$ terms of ${std}, complete the square inside the parentheses, then multiply the added number by ${a} before adjusting the constant.`,
      explanation: [
        `Factor ${a} from the $x$ terms: $y=${lead}(x^2${-2 * h < 0 ? "-" : "+"}${Math.abs(2 * h)}x)${plus(c)}$.`,
        `Add and subtract inside: $${lead}(x^2${-2 * h < 0 ? "-" : "+"}${Math.abs(2 * h)}x+${h * h})$ adds $${a}\\cdot ${h * h}=${a * h * h}$, so ${a > 0 ? "subtract" : "add"} ${Math.abs(a * h * h)} outside to keep the value the same: $y=${lead}(x${h > 0 ? "-" : "+"}${Math.abs(h)})^2${plus(c)}${minus(a * h * h)}$.`,
        `Vertex form: ${tex(`y=${vertexForm(a, h, k)}`)}.`,
        a > 0
          ? `The squared term is never negative, so the minimum is the constant ${k}, reached at $x=${h}$.`
          : `Since ${a} is negative, the squared term is never positive, so the maximum is the constant ${k}, reached at $x=${h}$.`,
      ],
      correct: tex(`${k}`),
      wrong: [
        {
          label: tex(`${c}`),
          feedback: `${c} is the value at $x=0$ (the $y$-intercept), not the ${word}.`,
        },
        {
          label: tex(`${h}`),
          feedback: `${h} is the $x$-value where the ${word} occurs. The question asks for the value of $y$.`,
        },
        {
          label: tex(`${c - h * h}`),
          feedback: `The number added inside the parentheses is multiplied by ${a}: subtract $${a}\\cdot ${h * h}=${a * h * h}$, not ${h * h}.`,
        },
        {
          label: tex(`${-k}`),
          feedback: `Check the sign of the constant after combining: $${c}${minus(a * h * h)}=${k}$.`,
        },
        {
          label: tex(`${c + a * h * h}`),
          feedback: `The number added inside the square must be subtracted outside, not added again.`,
        },
        // Fallbacks, used only when the mistakes above coincide (they come last).
        {
          label: tex(`${3 * a * h * h + c}`),
          feedback: `That is the value at $x=${-h}$. The vertex of ${tex(`y=${vertexForm(a, h, k)}`)} is at $x=${h}$.`,
        },
        {
          label: tex(`${k + a}`),
          feedback: `That is the value one unit from the vertex. The ${word} is the value at the vertex itself, $x=${h}$.`,
        },
      ],
    };
  } else if (variant === 2) {
    let p = 0;
    let q = 0;
    while (p === 0 || q === 0 || p === q || Math.abs(p) === Math.abs(q)) {
      p = r(-8, 8);
      q = r(-8, 8);
    }
    const std = tex(`y=${quad(1, -(p + q), p * q)}`);
    const zeros = (u: number, v: number) => rootPair(u, v);
    model = { p, q };
    spec = {
      prompt: `Rewrite ${std} by factoring. Which choice lists the zeros of the function?`,
      hint: `Find two numbers with product ${p * q} and sum ${-(p + q)}. Write the trinomial as a product of two factors, then ask when each factor is zero.`,
      explanation: [
        `Look for two numbers with product ${p * q} and sum ${-(p + q)}: they are ${-p} and ${-q}.`,
        `Factor: ${tex(`y=(x${-p < 0 ? "-" : "+"}${Math.abs(p)})(x${-q < 0 ? "-" : "+"}${Math.abs(q)})`)}.`,
        `A product is zero only when a factor is zero: $x=${p}$ or $x=${q}$.`,
        `So the zeros of the function are $x=${p}$ and $x=${q}$.`,
      ],
      correct: zeros(p, q),
      wrong: [
        {
          label: zeros(-p, -q),
          feedback: `The numbers in the factors are ${-p} and ${-q}, but each factor is zero at the opposite number.`,
        },
        {
          label: zeros(p, -q),
          feedback: `Check both signs: the factor $(x${-q < 0 ? "-" : "+"}${Math.abs(q)})$ is zero at $x=${q}$.`,
        },
        {
          label: zeros(-p, q),
          feedback: `Check both signs: the factor $(x${-p < 0 ? "-" : "+"}${Math.abs(p)})$ is zero at $x=${p}$.`,
        },
      ],
    };
  } else if (variant === 3) {
    let p = 0;
    let q = 0;
    while (p === q || (p + q) % 2 !== 0 || p + q === 0) {
      p = r(-8, 8);
      q = r(-8, 8);
    }
    const axis = (p + q) / 2;
    const f = tex(
      `y=(x${p === 0 ? "" : p < 0 ? "+" : "-"}${p === 0 ? "" : Math.abs(p)})(x${q === 0 ? "" : q < 0 ? "+" : "-"}${q === 0 ? "" : Math.abs(q)})`,
    );
    model = { p, q, axis };
    spec = {
      prompt: `The parabola is ${f}. Which equation is its axis of symmetry?`,
      hint: `The zeros of the function are where each factor of ${f} is 0. A parabola is symmetric about the vertical line through the point halfway between its two zeros.`,
      explanation: [
        `The zeros are $x=${p}$ and $x=${q}$.`,
        `The axis of symmetry passes halfway between them: $\\frac{${p}${q < 0 ? `+(${q})` : `+${q}`}}{2}=${axis}$.`,
        `The axis of symmetry is $x=${axis}$.`,
      ],
      correct: tex(`x=${axis}`),
      wrong: [
        {
          label: tex(`x=${p + q}`),
          feedback:
            "That is the sum of the zeros. The axis is halfway between them, so divide the sum by 2.",
        },
        {
          label: tex(`x=${-axis}`),
          feedback:
            "The sign is reversed: use the zeros, not the numbers inside the factors, and average them.",
        },
        {
          label: tex(`x=${p}`),
          feedback: `${p} is one zero. The axis lies midway between the two zeros.`,
        },
        {
          label: tex(`x=${(p - q) / 2}`),
          feedback:
            "Add the zeros before dividing by 2; subtracting gives half their distance apart.",
        },
        {
          label: tex(`x=${q}`),
          feedback: `${q} is one zero. The axis lies midway between the two zeros.`,
        },
        {
          label: tex(`x=${-(p + q)}`),
          feedback:
            "Average the zeros: add them and divide by 2, keeping their signs.",
        },
      ],
    };
  } else {
    let p = 0;
    let q = 0;
    // p + q = 0 puts the vertex on the y-axis, where forms (A) and (C) coincide.
    while (p === q || (p + q) % 2 !== 0 || p + q === 0) {
      p = r(-7, 7);
      q = r(-7, 7);
    }
    const a = pick(r, [1, 1, -1, 2]);
    const h = (p + q) / 2;
    const k = -a * ((q - p) / 2) ** 2;
    const c = a * p * q;
    const word = a > 0 ? "minimum" : "maximum";
    const lin = (n: number) =>
      n === 0 ? "x" : `(x ${n < 0 ? "+" : "-"} ${Math.abs(n)})`;
    const factored = `${a === 1 ? "" : a === -1 ? "-" : a}${lin(p)}${lin(q)}`;
    model = { a, p, q, h, k, c };
    spec = {
      prompt: `The function $f$ is written three equivalent ways: option A: ${tex(`f(x)=${quad(a, -a * (p + q), c)}`)}, option B: ${tex(`f(x)=${factored}`)}, option C: ${tex(`f(x)=${vertexForm(a, h, k)}`)}. Which option shows the ${word} value of $f$ directly, and what is that value?`,
      hint: `The ${word} of a parabola occurs at its vertex, halfway between the zeros ${p} and ${q}. Decide which option is written in terms of a squared factor, then read the number added to it.`,
      explanation: [
        `In option C, $${shift(h)}^2$ is never negative, so ${a} times it is ${a > 0 ? "at least 0" : "at most 0"}, and equals 0 at $x=${h}$.`,
        `So the ${word} is the added constant ${k}, which option C shows directly.`,
        `Option B shows the zeros ${p} and ${q}, and option A shows $f(0)=${c}$; neither displays the ${word}.`,
      ],
      correct: `Option C; the ${word} value is ${tex(`${k}`)}.`,
      wrong: [
        {
          label: `Option C; the ${word} value is ${tex(`${h}`)}.`,
          feedback: `${h} is the $x$-value of the vertex. The ${word} value of $f$ is the $y$-value, the added constant.`,
        },
        {
          label: `Option B; the ${word} value is ${tex("0")}.`,
          feedback: `Option B shows where $f$ is 0, but $f$ goes ${a > 0 ? "below" : "above"} 0 between the zeros; 0 is not the ${word}.`,
        },
        {
          label: `Option A; the ${word} value is ${tex(`${c}`)}.`,
          feedback: `${c} is $f(0)$, the $y$-intercept. It is not the ${word} unless the vertex is on the $y$-axis.`,
        },
        {
          label: `Option B; the ${word} value is ${tex(`${p}`)} or ${tex(`${q}`)}.`,
          feedback:
            "The numbers in the factored form are zeros of $f$, which are inputs, not the extreme output value.",
        },
      ],
    };
  }
  return { variant, model, problem: build(meta, seed, r, spec) };
}
export { quadraticFormConversionCase };

// ---------------------------------------------------------------------------
// Extraneous candidates
// ---------------------------------------------------------------------------

function rationalExtraneousSingleCase(seed: string) {
  const meta = rationalExtraneousSingleTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  const h = nonzeroIn(r, -6, 6);
  const den = `x ${h < 0 ? "+" : "-"} ${Math.abs(h)}`;
  const noSolution = (reason: string) => `No solution. ${reason}`;
  let spec: Spec;
  if (variant <= 2) {
    // (x + p)/(x - h) = q + k/(x - h); clearing gives (1 - q)x = q(-h) + k - p.
    let p = 0;
    let q = 0;
    let x0 = 0;
    let k = 0;
    do {
      p = r(-6, 6);
      q = nonzeroIn(r, -4, 4);
      x0 = r(-8, 8);
      k = variant === 0 ? x0 + p - q * (x0 - h) : p + h;
    } while (q === 1 || x0 === h || k === 0);
    const numerator = poly([
      [1, "x"],
      [p, ""],
    ]);
    const equation = `\\frac{${numerator}}{${den}}=${q}${k < 0 ? "-" : "+"}\\frac{${Math.abs(k)}}{${den}}`;
    const cleared = `${numerator}=${q}(${den})${k < 0 ? "-" : "+"}${Math.abs(k)}`;
    if (variant === 2) {
      spec = {
        prompt: `A student solves $${equation}$ by multiplying both sides by $${den}$ and gets $x=${h}$. Which statement about $x=${h}$ is correct?`,
        hint: `Before trusting a solution from the cleared equation, substitute ${h} into the denominator $${den}$ of the original equation.`,
        explanation: [
          `The original denominator $${den}$ is 0 at $x=${h}$, so $x=${h}$ is not allowed in the original equation.`,
          `Multiplying both sides by $${den}$ is a valid step only when $${den}\\ne 0$. Multiplying by an expression that is 0 at $x=${h}$ can make the cleared equation true there even though the original has no value there.`,
          `So $x=${h}$ is extraneous. It was the only candidate, so the original equation has no solution.`,
        ],
        correct: `It is extraneous: it makes the denominator $${den}$ equal to 0, so the equation has no solution.`,
        wrong: [
          {
            label: `It is a solution, because it satisfies the equation after the denominators are cleared.`,
            feedback: `A value must satisfy the original equation. At $x=${h}$ the original has a zero denominator, so it has no value there.`,
          },
          {
            label: `It is a solution, and there is also a second solution that the student missed.`,
            feedback: `Clearing the denominator leaves a linear equation with one candidate, and that candidate is not allowed.`,
          },
          {
            label: `It is extraneous because ${h} is ${h < 0 ? "negative" : "positive"}.`,
            feedback: `The sign of a candidate does not decide validity. The reason is that it makes a denominator zero.`,
          },
        ],
      };
    } else if (variant === 1) {
      spec = {
        prompt: `Solve $${equation}$ over the real numbers. Which statement is correct?`,
        hint: `Exclude the value that makes $${den}$ zero. Multiply both sides by $${den}$ and solve the linear equation. Then compare the candidate with the excluded value.`,
        explanation: [
          `The denominator $${den}$ is zero at $x=${h}$, so $x\\ne ${h}$.`,
          `Multiply both sides by $${den}$: $${cleared}$.`,
          `Solving gives $x=${h}$ as the only candidate.`,
          `That value is excluded: it makes the denominator zero. It arises because multiplying by $${den}$ discards the condition $${den}\\ne 0$.`,
          "So the equation has no solution: its only candidate is extraneous.",
        ],
        correct: noSolution(
          `The only candidate, $x=${h}$, makes the denominator zero.`,
        ),
        wrong: [
          {
            label: tex(`x=${h}`),
            feedback: `$x=${h}$ makes $${den}$ equal 0, so the original equation has no value there. Reject it.`,
          },
          {
            label: tex(`x=${-h}`),
            feedback: `Check your algebra: the candidate from clearing the denominator is ${h}, not ${-h}.`,
          },
          {
            label: `Every real number except ${tex(`${h}`)} is a solution.`,
            feedback: `The cleared equation is not true for every input; it has the single candidate $x=${h}$.`,
          },
          {
            label: tex(`x=${h + 1}`),
            feedback: `Check your algebra: solving the cleared equation gives ${h}, which is then excluded.`,
          },
        ],
      };
    } else {
      spec = {
        prompt: `Solve $${equation}$ over the real numbers. Which statement is correct?`,
        hint: `Exclude the value that makes $${den}$ zero. Multiply both sides by $${den}$, solve, and then compare the candidate with the excluded value.`,
        explanation: [
          `The denominator $${den}$ is zero at $x=${h}$, so $x\\ne ${h}$.`,
          `Multiply both sides by $${den}$: $${cleared}$.`,
          `Solving gives $x=${x0}$, which differs from the excluded value ${h}.`,
          `Check: the left side is $\\frac{${x0 + p}}{${x0 - h}}$ and the right side is $${q}${k < 0 ? "-" : "+"}\\frac{${Math.abs(k)}}{${x0 - h}}$; they are equal. The solution is $x=${x0}$.`,
        ],
        correct: tex(`x=${x0}`),
        wrong: [
          {
            label: tex(`x=${h}`),
            feedback: `$x=${h}$ makes $${den}$ equal 0, so it can never be a solution.`,
          },
          {
            label: noSolution(`The candidate makes the denominator zero.`),
            feedback: `The candidate ${x0} does not make the denominator zero ($${x0 - h}\\ne 0$), so it is a valid solution.`,
          },
          {
            label: `${tex(`x=${x0}`)} and ${tex(`x=${h}`)}`,
            feedback: `$x=${h}$ is excluded because it makes the denominator zero; only $x=${x0}$ remains.`,
          },
          {
            label: tex(`x=${-x0}`),
            feedback: `Check your algebra: the solution of the cleared equation is ${x0}.`,
          },
        ],
      };
    }
    return { variant, h, problem: build(meta, seed, r, spec) };
  }
  // variants 3 and 4: difference of squares over the matching linear factor.
  const hh = nonzeroIn(r, -7, 7);
  const dd = `x ${hh < 0 ? "+" : "-"} ${Math.abs(hh)}`;
  const target =
    variant === 3
      ? 2 * hh
      : pick(
          r,
          [0, 1, 3, 4, 5, -1, -3].filter((v) => v !== 2 * hh),
        );
  const numerator = `x^2-${hh * hh}`;
  const equation = `\\frac{${numerator}}{${dd}}=${target}`;
  const root = target - hh;
  const excluded = root === hh;
  spec = {
    prompt: `Solve $${equation}$ over the real numbers. Which statement is correct?`,
    hint: `Factor the numerator $${numerator}$ as a difference of squares and compare it with the denominator $${dd}$. Note which input is not allowed.`,
    explanation: [
      `The denominator is zero at $x=${hh}$, so $x\\ne ${hh}$.`,
      `Factor: $${numerator}=(${dd})(x ${hh < 0 ? "-" : "+"} ${Math.abs(hh)})$, so for $x\\ne ${hh}$ the fraction equals $x ${hh < 0 ? "-" : "+"} ${Math.abs(hh)}$.`,
      `Solve $x${hh < 0 ? "-" : "+"}${Math.abs(hh)}=${target}$: the candidate is $x=${root}$.`,
      excluded
        ? `The candidate $x=${hh}$ is the excluded value. It came from simplifying a factor that is zero there, so it is extraneous and the equation has no solution.`
        : `The candidate ${root} is not the excluded value ${hh}, so it is a solution.`,
    ],
    correct: excluded
      ? noSolution(`The only candidate, $x=${hh}$, makes the denominator zero.`)
      : tex(`x=${root}`),
    wrong: excluded
      ? [
          {
            label: tex(`x=${hh}`),
            feedback: `$x=${hh}$ makes the denominator zero, so the original equation has no value there.`,
          },
          {
            label: tex(`x=${-hh}`),
            feedback: `Check the arithmetic: the candidate is ${root}, which is then excluded.`,
          },
          {
            label: `Every real number except ${tex(`${hh}`)} is a solution.`,
            feedback: `The fraction simplifies to $x${hh < 0 ? "-" : "+"}${Math.abs(hh)}$, which equals ${target} only at the single candidate.`,
          },
        ]
      : [
          {
            label: tex(`x=${hh}`),
            feedback: `$x=${hh}$ makes the denominator zero, so it cannot be a solution.`,
          },
          {
            label: noSolution(`The candidate makes the denominator zero.`),
            feedback: `The candidate ${root} differs from the excluded value ${hh}, so it is valid.`,
          },
          {
            label: tex(`x=${target + hh}`),
            feedback: `After simplifying, the equation is $x${hh < 0 ? "-" : "+"}${Math.abs(hh)}=${target}$; subtract the constant ${hh} from the other side.`,
          },
          {
            label: `${tex(`x=${root}`)} and ${tex(`x=${hh}`)}`,
            feedback: `$x=${hh}$ is excluded; only $x=${root}$ remains.`,
          },
        ],
  };
  return { variant, h: hh, problem: build(meta, seed, r, spec) };
}
export { rationalExtraneousSingleCase };

function squareRootExtraneousCase(seed: string) {
  const meta = squareRootExtraneousTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  // Equation sqrt(a x + b) + d = s x + e  with candidate roots lo < hi.
  let lo = 0;
  let hi = 0;
  let a = 0;
  let b = 0;
  let c = 0;
  let s = 1;
  const rhsAt = (x: number) => s * x + c;
  for (let tries = 0; tries < 2000; tries++) {
    s = r(0, 1) ? 1 : -1;
    c = r(-8, 8);
    lo = r(-9, 6);
    hi = lo + r(1, 8);
    a = lo + hi + 2 * s * c;
    b = c * c - lo * hi;
    const okLo = rhsAt(lo) >= 0;
    const okHi = rhsAt(hi) >= 0;
    if (a === 0 || okLo === okHi) continue;
    if (variant === 4 && rhsAt(okLo ? lo : hi) !== 0) continue;
    if (variant !== 4 && (rhsAt(lo) === 0 || rhsAt(hi) === 0)) continue;
    break;
  }
  const extraneous = rhsAt(lo) < 0 ? lo : hi;
  const valid = extraneous === lo ? hi : lo;
  const d = variant === 3 ? nonzeroIn(r, -5, 5) : 0;
  const radicand = poly([
    [a, "x"],
    [b, ""],
  ]);
  const rhsText = poly([
    [s, "x"],
    [c + d, ""],
  ]);
  const left = `\\sqrt{${radicand}}${d === 0 ? "" : d < 0 ? ` - ${-d}` : ` + ${d}`}`;
  const equation = `${left}=${rhsText}`;
  const isolated = poly([
    [s, "x"],
    [c, ""],
  ]);
  const squaredRight = `(${isolated})^2`;
  const standard = poly([
    [1, "x^2"],
    [2 * s * c - a, "x"],
    [c * c - b, ""],
  ]);
  const checkText = (x: number) => {
    const rad = a * x + b;
    const right = rhsAt(x);
    return right >= 0
      ? `At $x=${x}$: $\\sqrt{${rad}}=${right}$ and the right side is ${right}. They agree.`
      : `At $x=${x}$: $\\sqrt{${rad}}=${Math.abs(right)}$ but the right side is ${right}. They disagree.`;
  };
  const steps: string[] = [
    ...(d === 0
      ? []
      : [`Isolate the square root: $\\sqrt{${radicand}}=${isolated}$.`]),
    `Square both sides: $${radicand}=${squaredRight}$. Rearranged, $0=${standard}$.`,
    `Factor: $0=${[lo, hi]
      .sort((u, v) => Number(v === 0) - Number(u === 0))
      .map((z) => (z === 0 ? "x" : `(x${z < 0 ? "+" : "-"}${Math.abs(z)})`))
      .join("")}$, so the candidates are $x=${lo}$ and $x=${hi}$.`,
    "Check each candidate in the original equation, because squaring may have added one.",
    checkText(lo),
    checkText(hi),
  ];
  let spec: Spec;
  const solutionSet = tex(`x=${valid}`);
  if (variant === 0 || variant === 3 || variant === 4) {
    spec = {
      prompt: `Solve $${equation}$ over the real numbers. Which statement describes all solutions?`,
      hint:
        d === 0
          ? `Square both sides of $${equation}$ to get a quadratic, then substitute each candidate into the original equation. A principal square root is never negative.`
          : `Isolate the square root first: move ${d} to the other side. Then square, solve, and check every candidate in the original equation.`,
      explanation: [
        ...steps,
        `Reject $x=${extraneous}$ and keep $x=${valid}$.`,
        `Only ${solutionSet} is a solution.`,
      ],
      correct: `Only ${solutionSet}.`,
      wrong: [
        {
          label: `${tex(`x=${lo}`)} and ${tex(`x=${hi}`)}`,
          feedback: `Squaring can create extra candidates. At $x=${extraneous}$ the right side of the isolated equation is ${rhsAt(extraneous)}, which a square root cannot equal.`,
        },
        {
          label: `Only ${tex(`x=${extraneous}`)}.`,
          feedback: `At $x=${extraneous}$ the isolated right side is ${rhsAt(extraneous)}, but a principal square root is never negative.`,
        },
        {
          label: "There are no real solutions.",
          feedback: `$x=${valid}$ satisfies the original equation. ${valid === lo ? checkText(lo) : checkText(hi)}`,
        },
      ],
    };
  } else if (variant === 1) {
    spec = {
      prompt: `Solving $\\sqrt{${radicand}}=${isolated}$ by squaring gives the candidates $x=${lo}$ and $x=${hi}$. Which candidate is extraneous, and why?`,
      hint: `Substitute each candidate into the original equation $\\sqrt{${radicand}}=${isolated}$. A principal square root is never negative, so look for a candidate that makes the right side negative.`,
      explanation: [
        checkText(lo),
        checkText(hi),
        `The extraneous candidate is $x=${extraneous}$.`,
      ],
      correct: `${tex(`x=${extraneous}`)}: the right side ${tex(`${isolated}`)} equals ${rhsAt(extraneous)}, which is negative, but a square root is never negative.`,
      wrong: [
        {
          label: `${tex(`x=${valid}`)}: the square root there does not equal the right side.`,
          feedback: `At $x=${valid}$ both sides equal ${rhsAt(valid)}, so it is a true solution.`,
        },
        {
          label: "Neither: both candidates satisfy the original equation.",
          feedback: `At $x=${extraneous}$ the right side is ${rhsAt(extraneous)}, which no square root equals.`,
        },
        {
          label: "Both: every candidate found by squaring is extraneous.",
          feedback: `At $x=${valid}$ the two sides agree, so it is a true solution.`,
        },
      ],
    };
  } else {
    spec = {
      prompt: `To solve $\\sqrt{${radicand}}=${isolated}$, a student squares both sides and finds $x=${lo}$ and $x=${hi}$. Why must each candidate be checked in the original equation?`,
      hint: `Squaring turns $A=B$ into $A^2=B^2$. Ask what other equation than $\\sqrt{${radicand}}=${isolated}$ also has the same square.`,
      explanation: [
        `Squaring gives $(\\sqrt{${radicand}})^2=(${isolated})^2$. But a number and its opposite have the same square.`,
        `So the squared equation is also true when $\\sqrt{${radicand}}=-(${isolated})$, an equation the original does not state.`,
        checkText(lo),
        checkText(hi),
        `The candidate $x=${extraneous}$ solves the squared equation because its right side is negative, so $\\sqrt{${radicand}}=-(${isolated})$ holds instead of the original equation.`,
      ],
      correct: `Squaring also admits solutions of $\\sqrt{${radicand}}=-(${isolated})$, so a candidate can fail the original.`,
      wrong: [
        {
          label:
            "Squaring can make solutions disappear, so the check finds the missing ones.",
          feedback:
            "Squaring never loses a solution of the original equation; it can only add candidates.",
        },
        {
          label:
            "Squaring changes the numbers, so the check is only to catch arithmetic mistakes.",
          feedback: `The check is not just about arithmetic: $x=${extraneous}$ is a correctly found candidate that still fails.`,
        },
        {
          label:
            "A square root equation always has exactly one solution, and the check picks which.",
          feedback:
            "Some square-root equations have two solutions, one, or none; the check decides which candidates hold.",
        },
      ],
    };
  }
  return {
    variant,
    lo,
    hi,
    a,
    b,
    c,
    s,
    d,
    extraneous,
    valid,
    problem: build(meta, seed, r, spec),
  };
}
export { squareRootExtraneousCase };

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function generateAlgebraRequirementGapProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  switch (id) {
    case arithmeticSequenceAsFunctionTemplate.id:
      return arithmeticSequenceAsFunctionCase(seed).problem;
    case geometricSequenceAsFunctionTemplate.id:
      return geometricSequenceAsFunctionCase(seed).problem;
    case geometricRuleFormsTemplate.id:
      return geometricRuleFormsCase(seed).problem;
    case solveByCompletingSquareTemplate.id:
      return solveByCompletingSquareCase(seed).problem;
    case complexQuadraticSolveTemplate.id:
      return complexQuadraticSolveCase(seed).problem;
    case complexPartsTemplate.id:
      return complexPartsCase(seed).problem;
    case interpretLinearParametersTemplate.id:
      return interpretLinearParametersCase(seed).problem;
    case quadraticFormConversionTemplate.id:
      return quadraticFormConversionCase(seed).problem;
    case rationalExtraneousSingleTemplate.id:
      return rationalExtraneousSingleCase(seed).problem;
    case squareRootExtraneousTemplate.id:
      return squareRootExtraneousCase(seed).problem;
    default:
      throw new Error("Unknown algebra requirement-gap template");
  }
}
