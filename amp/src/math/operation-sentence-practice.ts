import type { SemanticFigure, TemplateMetadata } from "./contracts";
import { defineAxis, type Random } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { draw } from "./elementary-gap-kit";
import { numberLine } from "./scene/author";

/**
 * Choose the number sentence for a situation. Each template holds one exact
 * model (the givens and the value every sentence is judged against) and writes
 * four sentences: one that fits and three that each come from a real slip.
 * A wrong sentence is kept only when it is judged false against the model, so
 * no distractor can also be correct.
 */
const base = {
  version: 1,
  requiredResponseCapability: "single-choice-v1",
} as const;

/** g equal jumps of s from 0 on a number line; the landing is left blank. */
function jumpLine(g: number, s: number) {
  const total = g * s;
  const line = numberLine({
    min: 0,
    max: total + 2,
    step: total > 24 ? 5 : total > 12 ? 2 : 1,
    labels: "auto",
  });
  line.mark(0, { label: true });
  line.hop(0, s, { landing: "none" });
  for (let i = 1; i < g; i++) line.then(s, { landing: "none" });
  return line;
}

export const operationSentenceChoiceTemplate: TemplateMetadata = {
  ...base,
  id: "operation-sentence-choice",
  requiredFigureCapability: "scenes-v1",
  title: "Choose the sentence for equal groups",
  skillId: "multiplicative-stories",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Choose the number sentence for equal groups told in a story, drawn as groups or as equal jumps on a number line, the story for a multiplication expression, or the sentence that cannot find the total.",
};
export const relatedDivisionSentenceTemplate: TemplateMetadata = {
  ...base,
  id: "related-division-sentence",
  title: "Choose the sentence a fact helps solve",
  skillId: "division-facts",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Choose the division sentence that a multiplication fact helps solve, or the multiplication sentence that helps solve a division, including division by a multiple of ten.",
};
export const relatedSubtractionSentenceTemplate: TemplateMetadata = {
  ...base,
  id: "related-subtraction-sentence",
  title: "Choose the subtraction a fact helps solve",
  skillId: "addition-facts",
  gradeBand: "K–2",
  difficultyOffset: 0.15,
  description:
    "Choose the subtraction sentence that a stated addition fact within 20 helps solve, among subtraction, addition, multiplication and division sentences.",
};
export const trueEquationChoiceTemplate: TemplateMetadata = {
  ...base,
  id: "true-equation-choice",
  title: "Choose the true equation",
  skillId: "missing-factor",
  gradeBand: "3–5",
  difficultyOffset: 0.3,
  description:
    "Choose the one true equation when a product equals a sum or difference, or when two products of three factors are compared.",
};

const tex = (s: string) => `$${s}$`;
const T = "\\times";
const D = "\\div";
const M = "-";

/** An option with the value its sentence gives the unknown (or truth value). */
interface Candidate {
  label: string;
  /** What the sentence says the unknown is, compared with the model's value. */
  value: number;
  feedback: string;
}
/** Correct sentence plus candidates; wrong ones that agree with the model are
 * dropped, then three distinct wrong ones are drawn. */
function options(
  r: Random,
  truth: number,
  right: Omit<Candidate, "value">,
  wrong: Candidate[],
): ChoiceOption[] {
  const seen = new Set([right.label]);
  const valid = wrong.filter((w) => {
    if (w.value === truth || seen.has(w.label)) return false;
    seen.add(w.label);
    return true;
  });
  if (valid.length < 3) throw new Error("Need three retries");
  return [
    { label: right.label, correct: true as const, feedback: right.feedback },
    ...draw(r, valid, 3).map((w) => ({
      label: w.label,
      feedback: w.feedback,
    })),
  ];
}

/* ------------------------------------------------- equal groups (B1) */
const things = [
  { unit: "flowers", holder: "box", holders: "boxes" },
  { unit: "stickers", holder: "page", holders: "pages" },
  { unit: "apples", holder: "basket", holders: "baskets" },
  { unit: "pencils", holder: "cup", holders: "cups" },
  { unit: "marbles", holder: "bag", holders: "bags" },
] as const;
const groupAxes = {
  task: defineAxis("task", [
    "fits-story",
    "fits-drawn-groups",
    "fits-number-line",
    "cannot-find-total",
    "story-for-expression",
  ] as const),
};
interface GroupModel {
  task: (typeof groupAxes.task.values)[number];
  g: number;
  s: number;
  thing: (typeof things)[number];
  other: (typeof things)[number];
}
function groupModel(r: Random, ax: { task: GroupModel["task"] }): GroupModel {
  const { task } = ax;
  const g =
    task === "fits-number-line"
      ? r(3, 4)
      : task === "cannot-find-total"
        ? r(3, 10)
        : task === "fits-drawn-groups"
          ? r(2, 8)
          : r(2, 9);
  const s =
    task === "fits-number-line"
      ? r(2, 7)
      : task === "fits-drawn-groups"
        ? r(2, 8)
        : r(2, 9);
  if (g === s) throw new Error("Need three retries");
  if (task === "fits-drawn-groups" && g * s > 64)
    throw new Error("Need three retries");
  const thing = pick(r, things);
  const other = pick(
    r,
    things.filter((t) => t.unit !== thing.unit),
  );
  return { task, g, s, thing, other };
}
export const operationSentenceChoice = chainFamily({
  template: operationSentenceChoiceTemplate,
  axes: groupAxes,
  model: groupModel,
  variant: (m) => m.task,
  render: (m, _ax, r) => {
    const { g, s, thing: t } = m;
    const total = g * s;
    const times = tex(`${g} ${T} ${s} = n`);
    const sentences = (): ChoiceOption[] =>
      options(
        r,
        total,
        {
          label: times,
          feedback: "",
        },
        [
          {
            label: tex(`${g} + ${s} = n`),
            value: g + s,
            feedback: `Adding ${g} and ${s} counts one ${t.holder} and ${s} more ${t.unit}, not ${g} equal groups of ${s}.`,
          },
          {
            label: tex(`${Math.max(g, s)} ${M} ${Math.min(g, s)} = n`),
            value: Math.abs(g - s),
            feedback: `Nothing is taken away here. Equal groups are joined, so subtracting does not find the total.`,
          },
          {
            label: tex(`${g} ${D} ${s} = n`),
            value: g / s,
            feedback: `Dividing splits a total into equal groups. Here the groups are already made and the total is unknown.`,
          },
        ],
      );
    if (m.task === "fits-story" || m.task === "fits-drawn-groups") {
      const drawn = m.task === "fits-drawn-groups";
      const figure: SemanticFigure | undefined = drawn
        ? {
            kind: "grouped-counters",
            total,
            groupSize: s,
            unit: t.unit,
          }
        : undefined;
      const surface = choiceSurface(r, {
        prompt: drawn
          ? `The picture shows equal groups of ${t.unit}. Which number sentence finds how many ${t.unit} there are in all? Use $n$ for the total.`
          : `There are ${g} ${t.holders}. Each ${t.holder} holds ${s} ${t.unit}. Which number sentence finds how many ${t.unit} there are in all? Use $n$ for the total.`,
        options: sentences(),
        hint: drawn
          ? `Look at one group: it holds ${s} ${t.unit}. Count how many equal groups there are, then choose the operation that joins equal groups.`
          : `${g} ${t.holders} with ${s} ${t.unit} in each are equal groups. Decide which operation joins ${g} groups of ${s}.`,
        explanation: [
          `The ${t.unit} are in ${g} equal groups of ${s}.`,
          `Joining equal groups is multiplication: $${g} ${T} ${s} = ${total}$.`,
          `The sentence ${times} fits; the total is ${total} ${t.unit}.`,
        ],
        label: "Choose the number sentence",
      });
      return surface && figure ? { ...surface, figure } : surface;
    }
    if (m.task === "fits-number-line") {
      const surface = choiceSurface(r, {
        prompt: `The number line shows ${g} equal jumps from 0. Which number sentence finds where the last jump lands? Use $n$ for that number.`,
        options: sentences(),
        hint: `There are ${g} jumps and each jump is ${s} long. The jumps are all the same size, so think about joining ${g} equal groups of ${s}.`,
        explanation: [
          `There are ${g} jumps and each is ${s} long.`,
          `${g} jumps of ${s} is $${g} ${T} ${s} = ${total}$, or $${Array(g).fill(s).join("+")}=${total}$.`,
          `The last jump lands on ${total}.`,
        ],
        label: "Choose the number sentence",
      });
      return (
        surface && {
          ...surface,
          figure: {
            kind: "scene" as const,
            scene: jumpLine(g, s).scene(),
          },
        }
      );
    }
    if (m.task === "cannot-find-total") {
      const valid: Candidate[] = [
        { label: tex(`${g} ${T} ${s} = n`), value: 0, feedback: "" },
        { label: tex(`${s} ${T} ${g} = n`), value: 0, feedback: "" },
        {
          label: tex(`${Array(g).fill(s).join(" + ")} = n`),
          value: 0,
          feedback: "",
        },
        { label: tex(`n ${D} ${s} = ${g}`), value: 0, feedback: "" },
        { label: tex(`n ${D} ${g} = ${s}`), value: 0, feedback: "" },
      ];
      const bad: Candidate[] = [
        {
          label: tex(`${g} + ${s} = n`),
          value: 1,
          feedback: "",
        },
        { label: tex(`${g} ${T} ${g} = n`), value: 1, feedback: "" },
        { label: tex(`${s} ${T} ${s} = n`), value: 1, feedback: "" },
        { label: tex(`${g} ${D} ${s} = n`), value: 1, feedback: "" },
      ];
      const chosen = draw(r, valid, 3);
      const wrong = pick(r, bad);
      const rows: ChoiceOption[] = [
        {
          label: wrong.label,
          correct: true,
          feedback: "",
        },
        ...chosen.map((c) => ({
          label: c.label,
          feedback: `This sentence does find the total of ${g} jumps of ${s}, so it is not the one that cannot.`,
        })),
      ];
      return choiceSurface(r, {
        prompt: `A frog makes ${g} jumps. Each jump is ${s} long. Which sentence can NOT be used to find how far the frog jumps in all? Use $n$ for the distance.`,
        options: rows,
        hint: `The total is ${g} jumps of ${s}. Check each sentence: does it join ${g} equal jumps of ${s}, or relate the total to ${g} and ${s} by division?`,
        explanation: [
          `${g} jumps of ${s} give a total of ${total}.`,
          `Multiplying in either order, repeated addition of ${s}, and dividing the total by ${s} or by ${g} all describe this total.`,
          `The other sentence uses ${g} and ${s} in a way that does not give ${total}, so it cannot find the total.`,
        ],
        label: "Choose the sentence that cannot",
      });
    }
    // story-for-expression
    const wrongStories: Candidate[] = [
      {
        label: `A ${m.other.holder} has ${g} ${m.other.unit}. ${s} more are put in. How many ${m.other.unit} are there now?`,
        value: 1,
        feedback: `${g} and ${s} are joined by adding here, so this story matches $${g} + ${s}$.`,
      },
      {
        label: `A ${m.other.holder} has ${Math.max(g, s) + 2} ${m.other.unit}. ${Math.min(g, s) + 1} are taken out. How many ${m.other.unit} are left?`,
        value: 2,
        feedback: `Taking some away is subtraction. The expression joins equal groups.`,
      },
      {
        label: `${g * s} ${m.other.unit} are shared equally among ${g} ${m.other.holders}. How many ${m.other.unit} does each ${m.other.holder} get?`,
        value: 3,
        feedback: `Sharing a total equally is division, $${g * s} ${D} ${g}$, not $${g} ${T} ${s}$.`,
      },
      {
        label: `${g + s} ${m.other.unit} are in ${s} equal groups. How many ${m.other.unit} are in each group?`,
        value: 4,
        feedback: `Finding the size of each group is division, not multiplication.`,
      },
    ];
    return choiceSurface(r, {
      prompt: `Which story can be solved with $${g} ${T} ${s}$?`,
      options: [
        {
          label: `${g} ${m.thing.holders} each hold ${s} ${m.thing.unit}. How many ${m.thing.unit} are there in all?`,
          correct: true,
        },
        ...draw(r, wrongStories, 3).map((w) => ({
          label: w.label,
          feedback: w.feedback,
        })),
      ],
      hint: `$${g} ${T} ${s}$ means ${g} groups of ${s}. Look for the story with ${g} equal groups that each have ${s}.`,
      explanation: [
        `$${g} ${T} ${s}$ means ${g} equal groups of ${s}.`,
        `The story with ${g} ${m.thing.holders} of ${s} ${m.thing.unit} each asks for the total of equal groups.`,
        `The product is ${total}, so there are ${total} ${m.thing.unit}.`,
      ],
      label: "Choose the story",
    });
  },
});

/* ------------------------------------------- related facts (B2) */
const factAxes = {
  fact: defineAxis("fact", [
    "multiplication-to-division",
    "division-to-missing-factor",
    "division-by-ten-multiple",
  ] as const),
};
interface FactModel {
  fact: (typeof factAxes.fact.values)[number];
  a: number;
  b: number;
}
function factModel(r: Random, ax: { fact: FactModel["fact"] }): FactModel {
  if (ax.fact === "division-by-ten-multiple") {
    return { fact: ax.fact, a: 10 * r(2, 9), b: r(2, 9) };
  }
  const a = r(2, 9);
  const b = r(2, 9);
  if (a === b) throw new Error("Need three retries");
  return { fact: ax.fact, a, b };
}
export const relatedDivisionSentence = chainFamily({
  template: relatedDivisionSentenceTemplate,
  axes: factAxes,
  model: factModel,
  variant: (m) => m.fact,
  render: (m, _ax, r) => {
    const { a, b } = m;
    const c = a * b;
    if (m.fact === "multiplication-to-division") {
      const flip = r(0, 1) === 1;
      const x = flip ? b : a;
      const y = flip ? a : b;
      const label = (l: string) => tex(l);
      return choiceSurface(r, {
        prompt: `Here is a multiplication fact: $${x} ${T} ${y} = ${c}$. Which division sentence can this fact help you solve? Use $n$ for the unknown.`,
        options: [
          { label: label(`${c} ${D} ${x} = n`), correct: true },
          ...draw(
            r,
            [
              {
                label: label(`${x} ${D} ${y} = n`),
                feedback: `A division that uses this fact starts from the product ${c}, not from one of the factors.`,
              },
              {
                label: label(`${y} ${D} ${c} = n`),
                feedback: `The total ${c} is the number being divided, so it comes first.`,
              },
              {
                label: label(`${x} ${D} ${c} = n`),
                feedback: `${c} is the product, so it is divided by a factor, not the other way around.`,
              },
              {
                label: label(`${x} + ${c} = n`),
                feedback: `This is addition. The fact joins equal groups and division undoes it.`,
              },
            ],
            3,
          ),
        ],
        hint: `The fact says ${x} groups of ${y} make ${c}. Division undoes it: start with the total ${c} and split it by one of the factors.`,
        explanation: [
          `The fact $${x} ${T} ${y} = ${c}$ has product ${c} and factors ${x} and ${y}.`,
          `Dividing the product by a factor gives the other factor: $${c} ${D} ${x} = ${y}$.`,
          `So $${c} ${D} ${x} = n$ is the division sentence the fact helps solve.`,
        ],
        label: "Choose the division sentence",
      });
    }
    if (m.fact === "division-to-missing-factor") {
      const q = b;
      const ops: Candidate[] = [
        {
          label: tex(`${c} ${T} ${a} = n`),
          value: c * a === q ? 1 : 0,
          feedback: `${c} is the total. It cannot be one of the factors that makes a product of ${a}.`,
        },
        {
          label: tex(`${a} ${T} ${c} = n`),
          value: -1,
          feedback: `This multiplies the two numbers in the division. The total ${c} should be the product.`,
        },
        {
          label: tex(`n ${T} ${c} = ${a}`),
          value: -2,
          feedback: `The total ${c} must be the product, not a factor.`,
        },
        {
          label: tex(`${a} + n = ${c}`),
          value: a + q === c ? q : -3,
          feedback: `This is addition. Division is undone by multiplication.`,
        },
      ];
      const all = options(
        r,
        q,
        {
          label: tex(`${a} ${T} n = ${c}`),
          feedback: "",
        },
        ops.map((o) => ({ ...o, value: o.value })),
      );
      return choiceSurface(r, {
        prompt: `Here is a division sentence: $${c} ${D} ${a} = n$. Which multiplication sentence helps you find $n$?`,
        options: all,
        hint: `Dividing ${c} by ${a} asks what number of groups of ${a} make ${c}. Write that as a multiplication with the total ${c} as the product.`,
        explanation: [
          `$${c} ${D} ${a} = n$ asks: ${a} times what number is ${c}?`,
          `That is $${a} ${T} n = ${c}$.`,
          `Since $${a} ${T} ${b} = ${c}$, $n = ${b}$.`,
        ],
        label: "Choose the multiplication sentence",
      });
    }
    // division by a multiple of ten
    const q = b;
    const d = a;
    const total = d * q;
    const stripped = d / 10;
    const alts: Candidate[] = [
      {
        label: tex(`${total} ${T} n = ${d}`),
        value: total * q === d ? q : -1,
        feedback: `${total} is the total, so it is the product. It cannot be a factor.`,
      },
      {
        label: tex(`${d} ${T} ${total} = n`),
        value: -2,
        feedback: `This multiplies the two numbers given. The total ${total} should be the product.`,
      },
      {
        label: tex(`${stripped} ${T} n = ${total}`),
        value: stripped * q === total ? q : -3,
        feedback: `The divisor is ${d}, not ${stripped}. Keep the zero.`,
      },
      {
        label: tex(`${d} ${T} ${total / 10} = n`),
        value: -4,
        feedback: `This multiplies instead of finding the missing factor.`,
      },
    ];
    return choiceSurface(r, {
      prompt: `Here is a division sentence: $${total} ${D} ${d} = n$. Which multiplication sentence helps you find $n$?`,
      options: options(
        r,
        q,
        { label: tex(`${d} ${T} n = ${total}`), feedback: "" },
        alts,
      ),
      hint: `${d} is ${stripped} tens. Dividing ${total} by ${d} asks which number of groups of ${d} make ${total}; write that with ${total} as the product.`,
      explanation: [
        `$${total} ${D} ${d} = n$ asks: ${d} times what number is ${total}?`,
        `That is $${d} ${T} n = ${total}$.`,
        `Using ${stripped} ${T} ${q} = ${stripped * q} and one more zero, $n = ${q}$.`,
      ],
      label: "Choose the multiplication sentence",
    });
  },
});

const addAxes = {
  facts: defineAxis("facts", ["sum-to-twenty", "sum-to-ten"] as const),
};
interface AddModel {
  a: number;
  b: number;
  facts: "sum-to-twenty" | "sum-to-ten";
}
export const relatedSubtractionSentence = chainFamily({
  template: relatedSubtractionSentenceTemplate,
  axes: addAxes,
  model: (r, ax): AddModel => {
    const hi = ax.facts === "sum-to-ten" ? 10 : 20;
    const a = r(2, hi - 2);
    const b = r(2, hi - a);
    if (a === b || a + b < 5) throw new Error("Need three retries");
    if (ax.facts === "sum-to-twenty" && a + b <= 10)
      throw new Error("Need three retries");
    return { a, b, facts: ax.facts };
  },
  variant: (m) => m.facts,
  render: (m, _ax, r) => {
    const { a, b } = m;
    const c = a + b;
    return choiceSurface(r, {
      prompt: `Here is an addition fact: $${a} + ${b} = ${c}$. Which subtraction sentence can this fact help you solve? Use $n$ for the unknown.`,
      options: [
        { label: tex(`${c} ${M} ${a} = n`), correct: true },
        ...draw(
          r,
          [
            {
              label: tex(`${a} ${M} ${c} = n`),
              feedback: `You cannot take ${c} away from ${a}. The whole, ${c}, comes first.`,
            },
            {
              label: tex(`${b} ${M} ${a} = n`),
              feedback: `This takes one part from the other. Subtract a part from the whole ${c}.`,
            },
            {
              label: tex(`${c} ${T} ${a} = n`),
              feedback: `This is multiplication. A subtraction sentence takes away.`,
            },
            {
              label: tex(`${c} ${D} ${a} = n`),
              feedback: `This is division. A subtraction sentence takes away.`,
            },
            {
              label: tex(`${c} + ${a} = n`),
              feedback: `This adds again. Subtraction undoes the addition.`,
            },
          ],
          3,
        ),
      ],
      hint: `In $${a} + ${b} = ${c}$, the whole is ${c} and the parts are ${a} and ${b}. Subtraction starts from the whole and takes away a part.`,
      explanation: [
        `The fact $${a} + ${b} = ${c}$ has parts ${a} and ${b} and whole ${c}.`,
        `Taking a part from the whole gives the other part: $${c} ${M} ${a} = ${b}$.`,
        `So $${c} ${M} ${a} = n$ is the subtraction the fact helps solve.`,
      ],
      label: "Choose the subtraction sentence",
    });
  },
});

/* ------------------------------------------ true equations (B4) */
const trueAxes = {
  form: defineAxis("form", [
    "product-equals-sum-or-difference",
    "products-of-three-factors",
  ] as const),
};
interface Eq {
  left: string;
  right: string;
  l: number;
  r: number;
}
interface TrueModel {
  form: (typeof trueAxes.form.values)[number];
  eqs: Eq[]; // [true, ...false]
}
const eq = (left: string, l: number, right: string, rv: number): Eq => ({
  left,
  right,
  l,
  r: rv,
});
function sumDiff(r: Random): TrueModel {
  const a = r(3, 9);
  const b = r(3, 9);
  const p = a * b;
  const minus = r(0, 1) === 1;
  const d = r(2, Math.min(12, p - 2));
  const c = minus ? p + d : p - d;
  const side = (x: number, y: number, op: "+" | "-") =>
    op === "+" ? x + y : x - y;
  const op = minus ? "-" : "+";
  const text = (aa: number, bb: number, cc: number, dd: number, o: "+" | "-") =>
    eq(
      `${aa} ${T} ${bb}`,
      aa * bb,
      `${cc} ${o === "+" ? "+" : M} ${dd}`,
      side(cc, dd, o),
    );
  const truth = text(a, b, c, d, op);
  const flipped = op === "+" ? "-" : "+";
  const cands = [
    text(a, b, c, d, flipped),
    text(a, b, c + 1, d, op),
    text(a, b, c, d + 2, op),
    text(a + 1, b, c, d, op),
    text(a, b - 1, c, d, op),
    text(a, b, c - 2, d, op),
    text(b, a + 2, c, d, op),
  ];
  const seen = new Set([`${truth.left}=${truth.right}`]);
  const wrongs = cands.filter((e) => {
    const key = `${e.left}=${e.right}`;
    if (e.l === e.r || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (wrongs.length < 3) throw new Error("Need three retries");
  return {
    form: "product-equals-sum-or-difference",
    eqs: [truth, ...draw(r, wrongs, 3)],
  };
}
function threeFactors(r: Random): TrueModel {
  const factors = [2, 3, 4, 5, 6, 8, 9];
  for (let t = 0; t < 60; t++) {
    const x = [pick(r, factors), pick(r, factors), pick(r, factors)];
    const y = [pick(r, factors), pick(r, factors), pick(r, factors)];
    const prod = (v: number[]) => v[0]! * v[1]! * v[2]!;
    if (prod(x) !== prod(y)) continue;
    if (JSON.stringify([...x].sort()) === JSON.stringify([...y].sort()))
      continue;
    const mk = (u: number[], v: number[]) =>
      eq(u.join(` ${T} `), prod(u), v.join(` ${T} `), prod(v));
    const truth = mk(x, y);
    const wrongs: Eq[] = [];
    const seen = new Set([`${truth.left}=${truth.right}`]);
    for (const dx of [1, -1, 2]) {
      for (const slot of [0, 1, 2]) {
        const v = [...y];
        v[slot] = v[slot]! + dx;
        if (v[slot]! < 2) continue;
        const e = mk(x, v);
        const key = `${e.left}=${e.right}`;
        if (e.l !== e.r && !seen.has(key)) {
          seen.add(key);
          wrongs.push(e);
        }
      }
    }
    if (wrongs.length < 3) continue;
    return {
      form: "products-of-three-factors",
      eqs: [truth, ...draw(r, wrongs, 3)],
    };
  }
  throw new Error("Need three retries");
}
export const trueEquationChoice = chainFamily({
  template: trueEquationChoiceTemplate,
  axes: trueAxes,
  model: (r, ax): TrueModel =>
    ax.form === "products-of-three-factors" ? threeFactors(r) : sumDiff(r),
  variant: (m) => m.form,
  render: (m, _ax, r) => {
    const [truth, ...wrong] = m.eqs;
    const show = (e: Eq) => tex(`${e.left} = ${e.right}`);
    return choiceSurface(r, {
      prompt:
        m.form === "products-of-three-factors"
          ? "Which equation is true? Each side is a product of three factors."
          : "Which equation is true? One side is a product and the other side is a sum or a difference.",
      options: [
        { label: show(truth!), correct: true },
        ...wrong.map((e) => ({
          label: show(e),
          feedback: `The left side is ${e.l} and the right side is ${e.r}, so the two sides are not equal.`,
        })),
      ],
      hint: `Work out the value of both sides of one equation at a time. For example, find ${wrong[0]!.left.replaceAll(T, "times")} and then the other side; the sides of a true equation have the same value.`,
      explanation: [
        `Find the value of each side of every equation.`,
        `${wrong.map((e) => `$${e.left}=${e.l}$ but the other side is ${e.r}`).join("; ")}.`,
        `Only $${truth!.left} = ${truth!.right}$ has the same value, ${truth!.l}, on both sides.`,
      ],
      label: "Choose the true equation",
    });
  },
});

export const operationSentenceTemplates = [
  operationSentenceChoiceTemplate,
  relatedDivisionSentenceTemplate,
  relatedSubtractionSentenceTemplate,
  trueEquationChoiceTemplate,
] as const;
export const operationSentenceGenerate = dispatch(operationSentenceTemplates, {
  "operation-sentence-choice": (seed) =>
    operationSentenceChoice.generate(seed).problem,
  "related-division-sentence": (seed) =>
    relatedDivisionSentence.generate(seed).problem,
  "related-subtraction-sentence": (seed) =>
    relatedSubtractionSentence.generate(seed).problem,
  "true-equation-choice": (seed) => trueEquationChoice.generate(seed).problem,
});
