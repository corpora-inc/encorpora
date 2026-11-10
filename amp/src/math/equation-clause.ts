import { createHash } from "node:crypto";
import type {
  FigureCapability,
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { shuffle } from "./distribution-practice";
import {
  figureOptionIds,
  type FigureChoiceResponse,
} from "./figure-choice";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
  type PartOption,
} from "./multi-part-choice";
import { graph, numberLine } from "./scene/author";
import type { Scene } from "./scene/spec";
import {
  classifyLinearRight,
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  structuralProblem,
  type StructuredWorkResponse,
  type WorkGrading,
} from "./structured-work";
import {
  lineThrough,
  latticeOnLine,
  serializePlot,
  type LatticePoint,
  type PointPlotResponse,
} from "./point-plot";
import { chooseAxes, defineAxis, type Random } from "./variation/axes";

/**
 * Common Core clause families for equations and inequalities.
 * The clause axis is its own stream. Classic returns the host generator
 * without reading that stream's content and without an extra content draw.
 */

const SINCE = 2;
type ClauseSpec = {
  values: readonly string[];
  weights: readonly number[];
  needs?: Partial<Record<string, FigureCapability>>;
};
const clauseSpecs: Record<string, ClauseSpec> = {
  "unknown-addend-story": {
    values: ["subtraction-unknown"],
    weights: [1, 1],
  },
  "substitution-match-table": {
    values: ["values-from-set"],
    weights: [1, 1],
  },
  "inequality-solution-set": {
    values: ["strict-form"],
    weights: [1, 1],
    needs: { "strict-form": "scenes-v1" },
  },
  "grouped-both-sides-steps": {
    values: ["solution-count-steps"],
    weights: [1, 1],
  },
  "linear-system-solution-count": {
    values: ["lines-through-points"],
    weights: [1, 1],
  },
};

export function clauseTask(id: string, seed: string): string {
  const spec = clauseSpecs[id];
  if (!spec) return "classic";
  const axis = defineAxis("clause", ["classic", ...spec.values], {
    legacy: "classic",
    silentLegacy: true,
    since: SINCE,
    weights: spec.weights,
    needs: spec.needs,
  });
  return chooseAxes(id, seed, { clause: axis }).clause;
}

export function clauseStream(templateId: string, seed: string): Random {
  let counter = 0;
  return (lo, hi) => {
    const span = hi - lo + 1;
    const limit = Math.floor(0x100000000 / span) * span;
    let n: number;
    do {
      n = createHash("sha256")
        .update(JSON.stringify([templateId, "clause-family", seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (n >= limit);
    return lo + (n % span);
  };
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const nz = (r: Random, lo: number, hi: number) => {
  const n = r(lo, hi);
  return r(0, 1) ? n : -n;
};

type Fr = { n: number; d: number };
const fr = (n: number, d = 1): Fr => {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
const fadd = (a: Fr, b: Fr) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const fsub = (a: Fr, b: Fr) => fadd(a, fr(-b.n, b.d));
const fmul = (a: Fr, b: Fr) => fr(a.n * b.n, a.d * b.d);
const fdiv = (a: Fr, b: Fr) => fr(a.n * b.d, a.d * b.n);
const feq = (a: Fr, b: Fr) => a.n === b.n && a.d === b.d;
const fnum = (a: Fr) => a.n / a.d;
const ftxt = (a: Fr) => (a.d === 1 ? `${a.n}` : `${a.n}/${a.d}`);
const signed = (n: number) => (n < 0 ? `−${-n}` : `${n}`);

function stamp(
  meta: TemplateMetadata,
  seed: string,
  family: string,
  built: {
    prompt: string;
    response: GeneratedProblem["public"]["response"];
    answer: string;
    hint: string;
    explanation: string[];
    figure?: SemanticFigure;
    choiceFeedback?: Record<string, string>;
    workGrading?: WorkGrading;
    pointGrading?: GeneratedProblem["pointGrading"];
  },
): GeneratedProblem {
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, SINCE, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: SINCE,
      seed,
      skillId: meta.skillId,
      prompt: built.prompt,
      response: built.response,
      ...(built.figure ? { figure: built.figure } : {}),
    },
    answer: built.answer,
    hint: built.hint,
    explanation: built.explanation,
    ...(built.choiceFeedback ? { choiceFeedback: built.choiceFeedback } : {}),
    ...(built.workGrading ? { workGrading: built.workGrading } : {}),
    ...(built.pointGrading ? { pointGrading: built.pointGrading } : {}),
    variant: { id: family, axes: { clause: family } },
  };
}

const letters = ["a", "b", "c", "d", "e", "f"] as const;
function choiceOf(
  r: Random,
  rows: { label: string; correct?: boolean; feedback: string }[],
): {
  options: { id: string; label: string }[];
  answer: string;
  feedback: Record<string, string>;
} {
  const ordered = shuffle(r, [...rows]);
  const feedback: Record<string, string> = {};
  let answer = "";
  const options = ordered.map((row, i) => {
    const id = `option-${"abcd"[i]}`;
    if (row.correct) answer = id;
    else feedback[id] = row.feedback;
    return { id, label: row.label };
  });
  if (!answer) throw new Error("Need a correct choice");
  return { options, answer, feedback };
}

function partOptions(labels: readonly string[]): PartOption[] {
  if (new Set(labels).size !== labels.length)
    throw new Error("Repeated option");
  for (const label of labels)
    if (label.length < 1 || label.length > 80)
      throw new Error(`Option length ${label.length}: ${label}`);
  return labels.map((label, i) => ({ id: letters[i]!, label }));
}

function multi(
  r: Random,
  blanks: { id: string; label: string; choices: string[]; correct: string }[],
): { response: MultiPartChoiceResponse; answer: string } {
  const built = blanks.map((b) => {
    const labels = shuffle(r, [...b.choices]);
    const options = partOptions(labels);
    const hit = options.find((o) => o.label === b.correct);
    if (!hit) throw new Error(`Missing key ${b.correct}`);
    return { id: b.id, label: b.label, options, key: hit.id };
  });
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose one answer for each part",
    layout: "slots",
    blanks: built.map(({ id, label, options }) => ({ id, label, options })),
  };
  return {
    response,
    answer: serializeMultiPart(
      response,
      Object.fromEntries(built.map((b) => [b.id, b.key])),
    ),
  };
}

/* ------------------------------------------------ subtraction unknown */

export function subtractionUnknown(
  meta: TemplateMetadata,
  seed: string,
): GeneratedProblem {
  const r = clauseStream(meta.id, seed);
  const form = r(0, 99);
  const which = form < 26 ? 0 : form < 54 ? 1 : form < 84 ? 2 : 3;
  const W = r(4, 20);
  const P = r(1, W - 1);
  const R = W - P;
  const answer = [P, W, W, R][which]!;
  const equation = [
    `${W} − □ = ${R}`,
    `□ − ${P} = ${R}`,
    `${R} = □ − ${P}`,
    `${W} − ${P} = □`,
  ][which]!;
  const figure: SemanticFigure =
    which === 0
      ? { kind: "bar-model", whole: W, parts: [R, null] }
      : which === 3
        ? { kind: "bar-model", whole: W, parts: [P, null] }
        : { kind: "bar-model", whole: null, parts: [P, R] };
  const startUnknown = which === 1 || which === 2;
  return stamp(meta, seed, "subtraction-unknown", {
    prompt: `Find the number that makes the equation true. ${equation}.`,
    response: { kind: "number", label: "Answer" },
    answer: String(answer),
    figure,
    hint: startUnknown
      ? `The minus sign does not mean to take the two numbers you can see apart. The number before the minus sign is the start of the whole bar.`
      : `The number before the minus sign is the whole bar. One part left, and the other part is what remains. Do not add the two numbers you can see, and do not copy the result into the box.`,
    explanation: startUnknown
      ? [
          `The number before the minus sign is the whole bar, the start. In ${equation} the start is the box: ${P} left it and ${R} remain.`,
          `The start is ${R} + ${P} = ${answer}.`,
          `Check: ${answer} − ${P} = ${R}. Both sides are the same.`,
          `Fact-family partner: ${R} + ${P} = ${answer}.`,
        ]
      : which === 0
        ? [
            `${W} is the whole bar. The box is the part that left, and ${R} stayed.`,
            `The part that left is ${W} − ${R} = ${answer}.`,
            `Check: ${W} − ${answer} = ${R}.`,
          ]
        : [
            `${W} is the whole bar and ${P} is the part that left.`,
            `What remains is ${W} − ${P} = ${answer}.`,
            `Check: ${W} − ${P} = ${answer}.`,
          ],
  });
}

/* ------------------------------------------------ values from a set */

const tenthText = (k: number) =>
  k % 10 === 0 ? `${k / 10}` : `${Math.floor(k / 10)}.${k % 10}`;

function holdsTenths(
  p: number,
  q: number,
  right: number,
  op: "=" | "<" | ">" | "<=" | ">=",
  k: number,
): boolean {
  const left = p * k + q * 10;
  const bound = right * 10;
  if (op === "=") return left === bound;
  if (op === "<") return left < bound;
  if (op === ">") return left > bound;
  if (op === "<=") return left <= bound;
  return left >= bound;
}

export function valuesFromSet(
  meta: TemplateMetadata,
  seed: string,
): GeneratedProblem {
  const r = clauseStream(meta.id, seed);
  const inequality = r(0, 9) < 4;
  const shape = inequality ? r(0, 2) : r(0, 4);
  const two = !inequality && shape >= 2;
  const useP = !inequality && shape === 0 ? 1 : r(2, 9);
  const useQ = !inequality && shape === 1 ? 0 : r(0, 12);
  const ops = ["<", ">", "<=", ">="] as const;
  const op = inequality ? pick(r, ops) : "=";
  const wantNone = inequality ? r(0, 4) === 0 : r(0, 9) < 4;
  const solutionUnits = r(0, Math.max(0, Math.floor(20 / useP)));
  const solutionK = solutionUnits * 10;
  const right = (useP * solutionK + useQ * 10) / 10;
  const count = r(0, 1) ? 4 : 5;
  const pool = new Set<number>();
  const add = (k: number) => {
    if (Number.isInteger(k) && k >= 0 && k <= 200) pool.add(k);
  };
  const misconception = (right - useQ) * 10;
  if (two) add(misconception);
  if (!wantNone && !inequality) add(solutionK);
  if (inequality && !wantNone) add(solutionK);
  let guard = 0;
  while (pool.size < count && guard < 80) {
    guard++;
    const roll = r(0, 2);
    const k = roll === 0 ? r(0, 20) * 10 : roll === 1 ? r(0, 40) * 5 : r(0, 200);
    if (wantNone && holdsTenths(useP, useQ, right, op, k)) continue;
    if (!inequality && wantNone && k === solutionK) continue;
    add(k);
  }
  if (pool.size < count) throw new Error("Need a value set");
  const values = [...pool].slice(0, count).sort((a, b) => a - b);
  const truths = values.map((k) =>
    holdsTenths(useP, useQ, right, op, k),
  );
  const trueCount = truths.filter(Boolean).length;
  const countLabel =
    trueCount === 0 ? "none" : trueCount === 1 ? "exactly one" : "more than one";
  const sym = op === "=" ? "=" : op === "<=" ? "≤" : op === ">=" ? "≥" : op;
  const coef = useP === 1 ? "x" : `${useP}x`;
  const expr =
    useQ === 0 ? coef : useQ > 0 ? `${coef} + ${useQ}` : `${coef} − ${-useQ}`;
  const sentence = `${expr} ${sym} ${right}`;
  const valueOptions = ["true", "not true"];
  const built = multi(r, [
    ...values.map((k, i) => ({
      id: `v${i + 1}`,
      label: tenthText(k),
      choices: valueOptions,
      correct: truths[i] ? "true" : "not true",
    })),
    {
      id: "count",
      label: "Solutions in the set",
      choices: ["none", "exactly one", "more than one"],
      correct: countLabel,
    },
  ]);
  const shown = values.map(tenthText).join(", ");
  return stamp(meta, seed, "values-from-set", {
    prompt: `Which numbers from the set {${shown}} make $${sentence}$ true? Mark each.`,
    response: built.response,
    answer: built.answer,
    hint: `Put each number in for x and work out both sides. A strict sign is false when the two sides match. Then count how many numbers from the set worked.`,
    explanation: [
      `Try each number in $${sentence}$.`,
      ...values.map((k, i) => {
        const left = (useP * k + useQ * 10) / 10;
        return `${tenthText(k)} gives ${left} on the left and ${right} on the right, so it is ${truths[i] ? "true" : "not true"}.`;
      }),
      trueCount === 0
        ? "None of the numbers in the set make the sentence true."
        : trueCount === 1
          ? "Exactly one number in the set works."
          : "More than one number in the set works.",
      op === "<" || op === ">"
        ? `${right} makes both sides equal, and a strict sign is false there.`
        : `The boundary ${right} follows the sign ${sym}.`,
    ],
  });
}

/* ------------------------------------------------ strict inequalities */

function wholeCount(sign: "<" | ">", c: number): number | "infinite" {
  if (sign === ">") return "infinite";
  if (c <= 0) return 0;
  const greatest = Number.isInteger(c) ? c - 1 : Math.floor(c);
  return greatest >= 0 ? greatest + 1 : 0;
}

export function strictInequality(
  meta: TemplateMetadata,
  seed: string,
): GeneratedProblem {
  const r = clauseStream(meta.id, seed);
  const sign: "<" | ">" = r(0, 1) ? "<" : ">";
  const c =
    r(0, 9) < 6
      ? r(-12, 12)
      : r(0, 1)
        ? r(-24, 24) / 2
        : r(-120, 120) / 10;
  const word = sign === "<" ? "less than" : "greater than";
  const back = sign === "<" ? "greater than" : "less than";
  const cText = signed(c);
  const key = `Every number ${word} ${cText} is a solution, and ${cText} is not. There are infinitely many solutions.`;
  const finite = wholeCount(sign, c);
  const finiteLabel =
    typeof finite === "number" && finite > 0
      ? `Only the ${finite} whole numbers ${word} ${cText} are solutions; there are ${finite} solutions.`
      : "There are no solutions because no whole number works.";
  const boundary = `${cText} and every number ${word} ${cText} are solutions.`;
  const reversed = `Every number ${back} ${cText} is a solution.`;
  const rows = [
    { label: key, correct: true, feedback: "" },
    {
      label: finiteLabel,
      feedback:
        "Solutions are not only whole numbers, and the ray does not stop after a short list.",
    },
    {
      label: boundary,
      feedback: `${cText} ${sign} ${cText} is false, so the boundary is not a solution.`,
    },
    {
      label: reversed,
      feedback: "That ray points the other way. Test a number you know.",
    },
  ];
  if (new Set(rows.map((row) => row.label)).size !== 4)
    throw new Error("Need distinct statements");
  const chosen = choiceOf(r, rows);
  const probe = sign === "<" ? (c > 0 ? 0 : c - 1) : c + 1;
  return stamp(meta, seed, "strict-form", {
    prompt: `Which statement about the solutions of x ${sign} ${cText} is true?`,
    response: {
      kind: "choice",
      label: "Choose one statement",
      options: chosen.options,
    },
    answer: chosen.answer,
    choiceFeedback: chosen.feedback,
    figure: {
      kind: "scene",
      scene: numberLine({
        min: Math.floor(c) - 4,
        max: Math.ceil(c) + 4,
        step: 1,
        labels: "ends",
      })
        .mark(c, { open: true, label: true })
        .interval(sign === ">" ? c : null, sign === ">" ? null : c, [
          sign === ">" ,
          sign === "<",
        ])
        .scene({ width: 280, title: `x ${sign} ${cText}` }),
    },
    hint: `The sign is strict, so the boundary itself fails. The solutions run forever along the ray, not just through the whole numbers.`,
    explanation: [
      `An open circle at ${cText} and a ray to the ${sign === "<" ? "left" : "right"}: every number ${word} ${cText} works, and ${cText} does not.`,
      `Test ${signed(probe)}: ${signed(probe)} ${sign} ${cText} is ${probe < c === (sign === "<") || probe > c === (sign === ">") ? "true" : "false"}.`,
      `${cText} ${sign} ${cText} is false, so the boundary is not a solution.`,
      "Between any two solutions sit more numbers, so the list never ends.",
    ],
  });
}

/* ------------------------------------------------ solution-count steps */

const lin = (a: number, b: number) => {
  if (a === 0) return `${b}`;
  const x = a === 1 ? "x" : a === -1 ? "-x" : `${a}x`;
  if (b === 0) return x;
  return b > 0 ? `${x}+${b}` : `${x}${b}`;
};
const eqn = (a: number, b: number, c: number, d: number) =>
  `${lin(a, b)}=${lin(c, d)}`;

export function solutionCountSteps(
  meta: TemplateMetadata,
  seed: string,
): GeneratedProblem {
  const r = clauseStream(meta.id, seed);
  const kind = r(0, 2);
  let a = nz(r, 1, 6);
  let b = r(-8, 8);
  let c = nz(r, 1, 4);
  if (a + c === 0 || Math.abs(a + c) > 6) c = a > 0 ? -1 : 1;
  let d = a + c;
  let e = a * b;
  let x0 = 0;
  if (kind === 0) {
    x0 = r(0, 1) ? r(-8, 8) : r(-6, 6) + 0.5;
    const net = r(0, 1) ? nz(r, 1, 4) : nz(r, 1, 3) * 2;
    d = a + c - net;
    if (d === 0 || Math.abs(d) > 6) d = net > 0 ? a + c - 2 : a + c + 2;
    const actual = a + c - d;
    e = actual * x0 + a * b;
    if (!Number.isInteger(e) || Math.abs(e) > 12) {
      x0 = r(-6, 6);
      e = actual * x0 + a * b;
    }
  } else if (kind === 2) {
    d = a + c;
    e = a * b + nz(r, 1, 4);
    if (Math.abs(e) > 12) e = a * b + (a * b > 0 ? -1 : 1);
    if (e === a * b) e = a * b + 1;
  } else {
    d = a + c;
    e = a * b;
  }
  if (Math.abs(d) > 6 || d === 0) d = a + c === 0 ? 1 : a + c;
  const leftConst = a * b;
  const expand = `${a === 1 ? "" : a === -1 ? "-" : a}x${leftConst >= 0 ? "+" : ""}${leftConst}${c >= 0 ? "+" : ""}${c === 1 || c === -1 ? (c < 0 ? "-x" : "+x") : `${c}x`}=${lin(d, e)}`
    .replace(/\+\-/, "-")
    .replace(/\+\+/, "+");
  const combined = eqn(a + c, leftConst, d, e);
  const closed =
    kind === 0 ? `x=${Number.isInteger(x0) ? x0 : `${x0 * 2}/2`}` : eqn(0, leftConst, 0, e);
  const lines = [expand, combined, closed];
  const infinite = `Infinitely many: ${leftConst} = ${leftConst} is true for every x`;
  const noneText = "No solution";
  const oneText = "Exactly one solution";
  const zeroText = "One solution, x = 0";
  const diff = e - leftConst;
  const fake = `One solution, x = ${diff}`;
  const correct =
    kind === 1 ? infinite : kind === 2 ? noneText : oneText;
  const bank = [infinite, noneText, oneText, kind === 2 ? fake : zeroText];
  if (new Set(bank).size !== 4) throw new Error("Need four conclusions");
  const order = shuffle(r, bank);
  const ids = ["a", "b", "c", "d"];
  const correctId = ids[order.indexOf(correct)]!;
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label: "Show each stage, then how many solutions",
    layout: "steps",
    mode: "build",
    start: `$${a}(x${b >= 0 ? "+" : ""}${b})${c >= 0 ? "+" : ""}${c}x=${lin(d, e)}$`,
    banks: [
      {
        id: "count",
        label: "How many solutions",
        options: order.map((label, i) => ({ id: ids[i]!, label })),
      },
    ],
    rows: [
      ...["After expanding", "After combining like terms", "After the x terms cancel or the equation is solved"].map(
        (label, i) => ({
          id: `r${i + 1}`,
          label,
          fields: [
            {
              kind: "expression" as const,
              label: "Equation",
              variables: ["x"],
              relations: true,
              maxLength: 32,
            },
          ],
        }),
      ),
      {
        id: "r4",
        label: "How many solutions the last line shows",
        fields: [{ kind: "choice", label: "Conclusion", bank: "count" }],
      },
    ],
  };
  const workGrading: WorkGrading = {
    mode: "fields",
    fields: [
      ...lines.map((value) => [
        {
          kind: "expression" as const,
          value,
          match: "sides" as const,
        },
      ]),
      [{ kind: "choice" as const, accept: [correctId] }],
    ],
  };
  const answer = JSON.stringify([
    ...lines.map((value) => [value]),
    [correctId],
  ]);
  if (structuralProblem(response) || !gradingFits(response, workGrading))
    throw new Error("Work does not fit");
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error(`Uncanonical ${answer}`);
  if (!gradeStructuredWork(response, workGrading, answer))
    throw new Error("Key is not credited");
  if (kind === 2 && leftConst === e) throw new Error("a = b collapsed");
  return stamp(meta, seed, "solution-count-steps", {
    prompt: `Transform $${a}(x${b >= 0 ? "+" : ""}${b})${c >= 0 ? "+" : ""}${c}x = ${lin(d, e)}$ one stage at a time until you reach x = a, a = a, or a = b. Then say how many solutions it has.`,
    response,
    answer,
    workGrading,
    hint: "Expand the parentheses first. Combine like terms on the left. Then clear the x terms and read whether what is left names one x, a true number sentence, or a false one.",
    explanation: [
      `Distribute ${a}: the left side becomes ${expand.split("=")[0]}.`,
      `Combining like terms gives ${combined}.`,
      kind === 1
        ? `The x terms cancel and ${leftConst} = ${e}, which is true for every x, so there are infinitely many solutions.`
        : kind === 2
          ? `The x terms cancel and ${leftConst} = ${e}, which is false, so there is no solution.`
          : `One x remains. The solution is ${closed}.`,
      "Same x-count and same constant means every number. Same x-count and different constants means no number. Different x-counts means exactly one number.",
    ],
  });
}

/* ------------------------------------------------ lines through points */

const slopeText = (m: Fr) => ftxt(m);

export function linesThroughPoints(
  meta: TemplateMetadata,
  seed: string,
): GeneratedProblem {
  const r = clauseStream(meta.id, seed);
  const roll = r(0, 4);
  const kind = roll < 2 ? "parallel" : roll < 4 ? "intersect" : "same";
  const den = r(1, 4);
  const num = nz(r, 1, 6);
  const m1 = fr(num, den);
  const m2 =
    kind === "intersect"
      ? fr(num + nz(r, 1, 3), den)
      : m1;
  const b1 = r(-4, 4);
  const b2 = kind === "same" ? b1 : b1 + nz(r, 1, 4);
  const on = (m: Fr, b: number, t: number) => fadd(fmul(m, fr(t)), fr(b));
  const point = (m: Fr, b: number, t: number): [number, number] | null => {
    const y = on(m, b, t * m.d);
    if (y.d !== 1) return null;
    const x = t * m.d;
    if (Math.abs(x) > 10 || Math.abs(y.n) > 10) return null;
    return [x, y.n];
  };
  const ts = [-3, -2, -1, 1, 2, 3].filter((t) => point(m1, b1, t) && point(m2, b2, t));
  if (ts.length < 4) throw new Error("Need four parameters");
  const p1 = point(m1, b1, ts[0]!);
  const p2 = point(m1, b1, ts[1]!);
  const q1 = point(m2, b2, ts[2]!);
  const q2 = point(m2, b2, ts[3]!);
  if (!p1 || !p2 || !q1 || !q2) throw new Error("Need lattice points");
  if (p1[0] === p2[0] || q1[0] === q2[0]) throw new Error("Vertical");
  const s1 = fdiv(fr(p2[1] - p1[1]), fr(p2[0] - p1[0]));
  const s2 = fdiv(fr(q2[1] - q1[1]), fr(q2[0] - q1[0]));
  const i1 = fsub(fr(p1[1]), fmul(s1, fr(p1[0])));
  const i2 = fsub(fr(q1[1]), fmul(s2, fr(q1[0])));
  const parallel = feq(s1, s2) && !feq(i1, i2);
  const same = feq(s1, s2) && feq(i1, i2);
  const intersect = !feq(s1, s2);
  if (kind === "parallel" && !parallel) throw new Error("Not parallel");
  if (kind === "same" && !same) throw new Error("Not the same line");
  if (kind === "intersect" && !intersect) throw new Error("Not intersecting");
  let hit = "";
  if (intersect) {
    const x = fdiv(fsub(i2, i1), fsub(s1, s2));
    const y = fadd(fmul(s1, x), i1);
    const y2 = fadd(fmul(s2, x), i2);
    if (!feq(y, y2)) throw new Error("Intersection missed a line");
    hit = `(${ftxt(x)}, ${ftxt(y)})`;
  }
  const yes = intersect ? `Yes, at ${hit}` : "Yes, at exactly one point";
  const par = `No; both have slope ${slopeText(s1)} with different y-intercepts, so they are parallel`;
  const ident = "They are the same line, so every point is shared";
  const correct = intersect ? yes : parallel ? par : ident;
  const rows = [
    {
      label: yes,
      correct: intersect,
      feedback: intersect
        ? ""
        : "Same slope does not give one crossing. Compare the y-intercepts.",
    },
    {
      label: par,
      correct: parallel,
      feedback: parallel
        ? ""
        : "Equal slopes are parallel only when the intercepts differ. Different slopes meet once.",
    },
    {
      label: ident,
      correct: same,
      feedback: same
        ? ""
        : "Equal slope is not enough for the same line. Test a point from one line in the other.",
    },
  ];
  if (rows.filter((row) => row.correct).length !== 1)
    throw new Error("Need one classification");
  const chosen = choiceOf(
    r,
    rows.map((row) => ({
      ...row,
      feedback: row.correct ? "" : row.feedback,
    })),
  );
  const pair = (p: [number, number]) => `(${p[0]}, ${p[1]})`;
  return stamp(meta, seed, "lines-through-points", {
    prompt: `Line 1 passes through ${pair(p1)} and ${pair(p2)}. Line 2 passes through ${pair(q1)} and ${pair(q2)}. Do the lines intersect?`,
    response: {
      kind: "choice",
      label: "Choose one answer",
      options: chosen.options,
    },
    answer: chosen.answer,
    choiceFeedback: chosen.feedback,
    hint: "Subtract the y-coordinates and the x-coordinates of each pair to get the two slopes. Same slope means parallel or the same line; then test one point in the other line.",
    explanation: [
      `Slope of line 1: (${p2[1]} − ${p1[1]}) / (${p2[0]} − ${p1[0]}) = ${slopeText(s1)}.`,
      `Slope of line 2: (${q2[1]} − ${q1[1]}) / (${q2[0]} − ${q1[0]}) = ${slopeText(s2)}.`,
      same
        ? `The slopes match and the y-intercepts both equal ${ftxt(i1)}, so the lines are the same.`
        : parallel
          ? `The slopes match, but the y-intercepts are ${ftxt(i1)} and ${ftxt(i2)}. The lines are parallel and do not meet.`
          : `The slopes differ, so the lines meet once, at ${hit}. That point is on both lines.`,
    ],
  });
}

/* ------------------------------------------------ new templates */

const cap = { requiredResponseCapability: "single-choice-v1" as const };
const multiCap = {
  requiredResponseCapability: "multi-part-choice-v1" as const,
};
const sceneCap = { requiredFigureCapability: "scenes-v1" as const };

export const equationClauseTemplates: readonly TemplateMetadata[] = [
  {
    id: "variable-role-pair",
    version: 1,
    title: "One number or a whole set",
    skillId: "simple-inequalities",
    gradeBand: "6–8",
    ...multiCap,
    description:
      "Decide whether a letter in a sentence stands for one unknown number or for every number in a set.",
  },
  {
    id: "arithmetic-algebra-compare",
    version: 1,
    title: "Compare arithmetic and algebra steps",
    skillId: "two-step-equations",
    gradeBand: "6–8",
    ...multiCap,
    description:
      "Match the arithmetic steps of a two-step story with the same operations done to both sides of its equation.",
  },
  {
    id: "fee-budget-number-line",
    version: 1,
    title: "Graph a fee within a budget",
    skillId: "linear-inequalities",
    gradeBand: "6–8",
    requiredResponseCapability: "figure-choice-v1",
    ...sceneCap,
    description:
      "Choose the number line of a fee-plus-rate inequality, including the boundary, the circle, and the ray.",
  },
  {
    id: "fee-budget-meaning",
    version: 1,
    title: "Read a budget inequality",
    skillId: "linear-inequalities",
    gradeBand: "6–8",
    ...cap,
    description:
      "Say what a fee-plus-rate inequality means for whole-number counts, including a boundary that is not a whole number.",
  },
  {
    id: "equation-make-example",
    version: 1,
    title: "Build one, none, or every solution",
    skillId: "linear-equations",
    gradeBand: "6–8",
    requiredResponseCapability: "structured-work-v1",
    description:
      "Complete the right side of a linear equation so it has no solution, infinitely many solutions, or exactly one solution.",
  },
  {
    id: "system-intersection-reason",
    version: 1,
    title: "Why the crossing solves the system",
    skillId: "linear-systems",
    gradeBand: "6–8",
    ...multiCap,
    ...sceneCap,
    description:
      "On a graph of two lines, choose the intersection as the solution of the system and say why a point on only one line is not.",
  },
  {
    id: "system-line-points",
    version: 1,
    title: "Plot points on a system line",
    skillId: "linear-systems",
    gradeBand: "6–8",
    requiredResponseCapability: "point-plot-v1",
    ...sceneCap,
    description:
      "Plot two lattice points on the first line of a linear system. The second line is drawn; the crossing is estimated in a separate item.",
  },
  {
    id: "system-crossing-estimate",
    version: 1,
    title: "Estimate where two lines cross",
    skillId: "linear-systems",
    gradeBand: "6–8",
    ...cap,
    ...sceneCap,
    description:
      "Estimate the intersection of two graphed lines to the nearest half unit.",
  },
  {
    id: "assume-solution-check",
    version: 1,
    title: "Assume a solution, then check",
    skillId: "equation-reasoning",
    gradeBand: "9–12",
    ...multiCap,
    description:
      "Say what an equation's opening assumption justifies, what the chain shows, and how a substitution check finishes the argument.",
  },
  {
    id: "scaled-elimination",
    version: 1,
    title: "Add a multiple of an equation",
    skillId: "elimination-proof",
    gradeBand: "9–12",
    ...multiCap,
    description:
      "Add a multiple of one equation to the other, name the equivalent system, and evaluate the combined equation at a solution.",
  },
];

function metaOf(id: string): TemplateMetadata {
  const meta = equationClauseTemplates.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown clause template ${id}`);
  return meta;
}

export function variableRole(seed: string): GeneratedProblem {
  const meta = metaOf("variable-role-pair");
  const r = clauseStream(meta.id, seed);
  const name = pick(r, ["Tara", "Luis", "Mina", "Owen"]);
  const thing = pick(r, ["stickers", "cards", "marbles"]);
  const gave = r(2, 30);
  const left = r(2, 40);
  const start = gave + left;
  const letter = "s";
  const fixed = `${name} has ${letter} ${thing}. ${name} gives away ${gave} and has ${left} left.`;
  const fixedKey = `one unknown number: ${letter} = ${start}`;
  const fixedWrongValue = left;
  const formula = r(0, 4) === 0;
  const bound = r(5, 200);
  const setLetter = "h";
  const conditions = [
    {
      text: `Riders must be at least ${bound} inches tall. Let ${setLetter} be the height in inches of any rider allowed on.`,
      key: `any number in a set: ${setLetter} ≥ ${bound}`,
      strict: `any number in a set: ${setLetter} > ${bound}`,
      other: `one unknown number: ${setLetter} = ${bound + 1}`,
    },
    {
      text: `A bag holds at most ${bound} books. Let ${setLetter} be how many books are in an allowed bag.`,
      key: `any number in a set: ${setLetter} ≤ ${bound}`,
      strict: `any number in a set: ${setLetter} < ${bound}`,
      other: `one unknown number: ${setLetter} = ${bound - 1}`,
    },
    {
      text: `The temperature must be more than ${bound} degrees. Let ${setLetter} be an allowed temperature.`,
      key: `any number in a set: ${setLetter} > ${bound}`,
      strict: `any number in a set: ${setLetter} ≥ ${bound}`,
      other: `one unknown number: ${setLetter} = ${bound + 1}`,
    },
    {
      text: `Fewer than ${bound} people may enter. Let ${setLetter} be an allowed number of people.`,
      key: `any number in a set: ${setLetter} < ${bound}`,
      strict: `any number in a set: ${setLetter} ≤ ${bound}`,
      other: `one unknown number: ${setLetter} = ${Math.max(0, bound - 1)}`,
    },
  ] as const;
  const cond = formula
    ? {
        text: `A square with side ${setLetter} has perimeter 4${setLetter}.`,
        key: `any positive number: ${setLetter} > 0`,
        boundary: `one unknown number: ${setLetter} = 4`,
        strict: `any number in a set: ${setLetter} ≥ 4`,
        other: `one unknown number: ${setLetter} = 16`,
      }
    : {
        ...pick(r, conditions),
        boundary: `one unknown number: ${setLetter} = ${bound}`,
      };
  const fixedChoices = [
    fixedKey,
    `one unknown number: ${letter} = ${fixedWrongValue}`,
    `any number in a set: ${letter} ≥ ${left}`,
    `any number in a set: ${letter} > ${gave}`,
  ];
  const setChoices = [cond.key, cond.boundary, cond.strict, cond.other];
  const parts = shuffle(r, [
    {
      id: "fix",
      label: fixed,
      choices: fixedChoices,
      correct: fixedKey,
    },
    {
      id: "set",
      label: cond.text,
      choices: setChoices,
      correct: cond.key,
    },
  ]);
  const built = multi(r, parts);
  return stamp(meta, seed, "variable-role", {
    prompt:
      "Each sentence uses a letter. For each sentence, choose the role of the letter.",
    response: built.response,
    answer: built.answer,
    hint: "If a fact pins the letter to one number, it is one unknown. If every number that meets a condition is allowed, the letter stands for that whole set.",
    explanation: [
      `${fixed} Giving away ${gave} and having ${left} left pins ${letter} at ${start}, one number.`,
      formula
        ? `A side length can be any positive number. The 4 in the perimeter formula is not the side.`
        : `${cond.text} The boundary is included or excluded by the words, and it is not the only allowed number.`,
      "An equation names one number. An inequality names a set.",
    ],
  });
}

export function arithmeticAlgebra(seed: string): GeneratedProblem {
  const meta = metaOf("arithmetic-algebra-compare");
  const r = clauseStream(meta.id, seed);
  const grouped = r(0, 1) === 0;
  let p: number;
  let q: number;
  let total: number;
  let x: number;
  if (!grouped) {
    p = r(2, 12);
    q = r(5, 40);
    x = r(2, 12);
    total = p * x + q;
  } else {
    p = pick(r, [2, 3, 4, 5]);
    q = r(2, 12);
    x = r(2, 12);
    total = p * (x + q);
  }
  const noun = grouped ? "width" : "months";
  const story = grouped
    ? `A rectangle has perimeter ${total} cm and length ${q} cm. The width is w cm, and ${p}(w + ${q}) = ${total}.`
    : `A gym charges ${q} dollars to join and ${p} dollars each month. After ${noun} m, the total paid is ${total} dollars: ${p}m + ${q} = ${total}.`;
  const keySteps = grouped
    ? `Divide ${total} by ${p}, then subtract ${q}`
    : `Subtract ${q} from ${total}, then divide by ${p}`;
  const d1 = grouped
    ? `Subtract ${q} from ${total}, then divide by ${p}`
    : `Divide ${total} by ${p}, then subtract ${q}`;
  const d2 = grouped
    ? `Divide ${total} by ${p}, then subtract ${2 * q}`
    : `Subtract ${p} from ${total}, then divide by ${q}`;
  const d3 = grouped
    ? `Subtract ${q} from ${total}, then divide by ${2 * p}`
    : `Add ${q} to ${total}, then divide by ${p}`;
  const valid = grouped
    ? `Subtract ${p * q} from ${total}, then divide by ${p}`
    : keySteps;
  const sequences = [keySteps, d1, d2, d3];
  if (sequences.includes(valid) && valid !== keySteps)
    throw new Error("Valid route offered");
  const value = (text: string) => {
    if (text === keySteps) return x;
    if (!grouped && text === d1) return total / p - q;
    if (!grouped && text === d2) return (total - p) / q;
    if (!grouped && text === d3) return (total + q) / p;
    if (grouped && text === d1) return (total - q) / p;
    if (grouped && text === d2) return total / p - 2 * q;
    return (total - q) / (2 * p);
  };
  if (sequences.filter((text) => value(text) === x).length !== 1)
    throw new Error("Distractor matches the key");
  const algKey = grouped
    ? `${p}(w + ${q}) = ${total}; divide both sides by ${p}`
    : `${p}m + ${q} = ${total}; subtract ${q} from both sides`;
  const algWrong = grouped
    ? [
        `${p}(w + ${q}) = ${total}; subtract ${q} first`,
        `${p}w + ${q} = ${total}; subtract ${q}`,
        `w + ${q} = ${total}; divide by ${p}`,
      ]
    : [
        `${p}(m + ${q}) = ${total}; divide both sides by ${p}`,
        `${p}m − ${q} = ${total}; add ${q}`,
        `${q}m + ${p} = ${total}; subtract ${p}`,
      ];
  const compare = grouped
    ? `Both divide by ${p} then subtract ${q}, in that order; the algebra steps match`
    : `Both subtract ${q} then divide by ${p}, in that order; the algebra steps match`;
  const built = multi(r, [
    {
      id: "arith",
      label: "Arithmetic: which steps find the unknown?",
      choices: sequences,
      correct: keySteps,
    },
    {
      id: "alg",
      label: "Algebra: which equation and first step?",
      choices: [algKey, ...algWrong],
      correct: algKey,
    },
    {
      id: "same",
      label: "Compare the two approaches",
      choices: [
        compare,
        "Arithmetic divides first and algebra subtracts first",
        "Algebra uses the operations in the equation; arithmetic uses their opposites",
        "The order of the two operations does not matter",
      ],
      correct: compare,
    },
  ]);
  return stamp(meta, seed, "arithmetic-vs-algebraic", {
    prompt: story,
    response: built.response,
    answer: built.answer,
    hint: "Undo the last operation first. The arithmetic steps and the algebra steps use those same two operations in that same order.",
    explanation: grouped
      ? [
          `Divide first: ${total} ÷ ${p} = ${total / p}. Then subtract ${q}: ${total / p} − ${q} = ${x}.`,
          `On the equation, divide both sides by ${p}, then subtract ${q}.`,
          `Subtracting ${p * q} and then dividing by ${p} is also valid, and it is not one of the wrong choices.`,
        ]
      : [
          `${total} − ${q} = ${total - q}. Then ${total - q} ÷ ${p} = ${x}.`,
          `On ${p}m + ${q} = ${total}, subtract ${q} from both sides, then divide by ${p}.`,
          "The algebra steps are the arithmetic steps done to both sides.",
        ],
  });
}

type Fee = {
  fee: number;
  rate: number;
  budget: number;
  op: "<=" | ">=" | "<" | ">";
  b: number;
  toward0: boolean;
  whole: boolean;
};

function feeModel(r: Random): Fee {
  const goal = r(0, 1) === 0;
  const strict = r(0, 4) === 0;
  const whole = r(0, 1) === 0;
  const rate = r(2, 12);
  const b = whole ? r(4, 18) : r(4, 18) + 0.5;
  const fee = r(2, 40);
  const budget = fee + rate * b;
  if (!Number.isInteger(budget * 2)) throw new Error("Need a tenth boundary");
  const op = goal ? (strict ? ">" : ">=") : strict ? "<" : "<=";
  const at0 =
    op === "<="
      ? fee <= budget
      : op === "<"
        ? fee < budget
        : op === ">="
          ? fee >= budget
          : fee > budget;
  return { fee, rate, budget, op, b, toward0: at0, whole };
}

function rayScene(b: number, left: boolean, open: boolean): Scene {
  const lo = Math.floor(b) - 3;
  const hi = Math.ceil(b) + 3;
  return numberLine({ min: lo, max: hi, step: 1, labels: "ends" })
    .mark(b, { open, label: true })
    .interval(left ? null : b, left ? b : null, [!left && open, left && open])
    .scene({ width: 260, maxHeight: 110 });
}

export function feeGraph(seed: string): GeneratedProblem {
  const meta = metaOf("fee-budget-number-line");
  const r = clauseStream(meta.id, seed);
  const m = feeModel(r);
  const open = m.op === "<" || m.op === ">";
  const left = m.toward0;
  const sym = { "<=": "≤", ">=": "≥", "<": "<", ">": ">" }[m.op];
  const forgottenFee = m.budget / m.rate;
  const forgottenRate = m.budget - m.fee;
  const scenes = [
    {
      b: m.b,
      left,
      open,
      label: `${open ? "An open" : "A filled"} circle at ${m.b} with the ray shaded ${left ? "left" : "right"}.`,
      correct: true,
    },
    {
      b: m.b,
      left: !left,
      open,
      label: `${open ? "An open" : "A filled"} circle at ${m.b} with the ray shaded ${left ? "right" : "left"}.`,
    },
    {
      b: m.b,
      left,
      open: !open,
      label: `${open ? "A filled" : "An open"} circle at ${m.b} with the ray shaded ${left ? "left" : "right"}.`,
    },
    {
      b: Math.abs(forgottenFee - m.b) > 0.2 ? forgottenFee : forgottenRate,
      left,
      open,
      label: `${open ? "An open" : "A filled"} circle at ${Math.abs(forgottenFee - m.b) > 0.2 ? forgottenFee : forgottenRate} with the ray shaded ${left ? "left" : "right"}.`,
    },
  ];
  if (new Set(scenes.map((s) => JSON.stringify([s.b, s.left, s.open]))).size < 4)
    throw new Error("Need distinct graphs");
  const order = shuffle(r, scenes);
  const options = order.map((s, i) => ({
    id: figureOptionIds[i]!,
    label: s.label,
    scene: rayScene(s.b, s.left, s.open),
  }));
  const answer = options[order.findIndex((s) => s.correct)]!.id;
  const feedback: Record<string, string> = {};
  order.forEach((s, i) => {
    if (!s.correct)
      feedback[figureOptionIds[i]!] = s.open !== open
        ? "The circle does not match the sign. A strict sign is open."
        : s.left !== left
          ? "Test 0 in the original inequality before shading."
          : "That boundary drops the fee or the rate.";
  });
  const response: FigureChoiceResponse = {
    kind: "figure-choice",
    label: "Choose the number line",
    noun: "Number line",
    options,
  };
  return stamp(meta, seed, "graph-and-interpret", {
    prompt: `The inequality $${m.fee} + ${m.rate}x ${sym} ${m.budget}$ is given. Which number line shows its solutions?`,
    response,
    answer,
    choiceFeedback: feedback,
    hint: "Solve for the boundary, then test x = 0 in the original inequality. Shade toward 0 only when 0 makes the inequality true. A strict sign uses an open circle.",
    explanation: [
      `The boundary is (${m.budget} − ${m.fee}) / ${m.rate} = ${m.b}.`,
      `${m.fee} ${sym} ${m.budget} is ${m.toward0 ? "true" : "false"} at x = 0, so the ray goes ${left ? "left, toward 0" : "right, away from 0"}.`,
      open
        ? "The sign is strict, so the circle is open."
        : "The sign includes equals, so the circle is filled.",
    ],
  });
}

export function feeMeaning(seed: string): GeneratedProblem {
  const meta = metaOf("fee-budget-meaning");
  const r = clauseStream(meta.id, seed);
  const m = feeModel(r);
  const up = m.op === ">=" || m.op === ">";
  const strict = m.op === "<" || m.op === ">";
  const named = up ? Math.ceil(m.b) : Math.floor(m.b);
  const unit = "guests";
  const key = strict
    ? up
      ? `Every count above ${m.b} works, so at least ${named} ${unit}`
      : `Every count below ${m.b} works, so at most ${named} ${unit}`
    : up
      ? m.whole
        ? `Any whole number of ${unit} from ${named} up fits; ${named} is the least`
        : `Every number of ${unit} ${m.b} or more works, so at least ${named} ${unit}`
      : m.whole
        ? `Any whole number of ${unit} from 0 to ${named} fits; ${named} is the most`
        : `Every number of ${unit} ${m.b} or less works, so at most ${named} ${unit}`;
  const rows = [
    key,
    up
      ? `At most ${named} ${unit} fit`
      : `At least ${named} ${unit} are needed`,
    strict
      ? `Exactly ${named} ${unit}`
      : up
        ? `Fewer than ${named} ${unit} fit; ${named} does not`
        : `Fewer than ${named} ${unit} fit; ${named} does not`,
    `Exactly ${m.whole ? named : named + (up ? 0 : 0)} ${unit}`,
  ];
  const unique = [...new Set(rows)];
  while (unique.length < 4) unique.push(`No ${unit} fit the inequality`);
  const choices = unique.slice(0, 4);
  if (!choices.includes(key)) throw new Error("Key dropped");
  const chosen = choiceOf(
    r,
    choices.map((label) => ({
      label,
      correct: label === key,
      feedback:
        label === key
          ? ""
          : "Read the ray in the story. A count is a whole number, so name the whole-number bound that still makes the inequality true.",
    })),
  );
  const sym = { "<=": "≤", ">=": "≥", "<": "<", ">": ">" }[m.op];
  return stamp(meta, seed, "graph-and-interpret", {
    prompt: `A cost is $${m.fee} + ${m.rate}x$ dollars, and it must satisfy $${m.fee} + ${m.rate}x ${sym} ${m.budget}$. What does that mean for the number of ${unit}?`,
    response: {
      kind: "choice",
      label: "Choose one meaning",
      options: chosen.options,
    },
    answer: chosen.answer,
    choiceFeedback: chosen.feedback,
    hint: "Find the boundary, then see whether 0 is allowed. A whole-number count uses the next whole number inside the ray when the boundary is not a whole number.",
    explanation: [
      `The boundary is ${m.b}. The sign ${sym} is ${strict ? "strict" : "inclusive"}.`,
      m.toward0
        ? `At x = 0 the cost ${m.fee} makes the inequality true, so small counts are allowed.`
        : `At x = 0 the cost ${m.fee} makes the inequality false, so only counts past the boundary work.`,
      up
        ? `The least whole number that works is ${named}.`
        : `The greatest whole number that works is ${named}.`,
    ],
  });
}

const axb = (a: number, b: number) => {
  if (a === 0) return `${b}`;
  const x = a === 1 ? "x" : a === -1 ? "-x" : `${a}x`;
  if (b === 0) return x;
  return b > 0 ? `${x}+${b}` : `${x}${b}`;
};

export function makeExample(seed: string): GeneratedProblem {
  const meta = metaOf("equation-make-example");
  const r = clauseStream(meta.id, seed);
  const numeric = r(0, 9) < 3;
  if (numeric) {
    const k = r(2, 9);
    const h = r(1, 8);
    const box = k * h;
    const response: StructuredWorkResponse = {
      kind: "structured-work",
      label: "Fill the box",
      layout: "steps",
      mode: "build",
      banks: [],
      rows: [
        {
          id: "r1",
          label: `The number that gives ${k}(x − ${h}) = ${k}x − □ infinitely many solutions`,
          fields: [{ kind: "number", label: "Number", maxLength: 8 }],
        },
      ],
    };
    const workGrading: WorkGrading = {
      mode: "fields",
      fields: [[{ kind: "number", value: String(box) }]],
    };
    const answer = JSON.stringify([[String(box)]]);
    if (!gradeStructuredWork(response, workGrading, answer))
      throw new Error("Numeric key");
    return stamp(meta, seed, "make-an-example", {
      prompt: `Fill the box so $${k}(x − ${h}) = ${k}x − □$ has infinitely many solutions.`,
      response,
      answer,
      workGrading,
      hint: "Expand the left side. Infinitely many solutions means the two sides are the same expression, including the plain number.",
      explanation: [
        `${k}(x − ${h}) = ${k}x − ${box}.`,
        `The right side ${k}x − □ matches when the box is ${box}.`,
        "Same x-count and the same constant: every number is a solution.",
      ],
    });
  }
  const p = nz(r, 1, 9);
  const q = r(-12, 12);
  const none = axb(p, q === 12 ? q - 1 : q + 1);
  const infinite = axb(p, q);
  const one = axb(p === 9 ? p - 1 : p + 1, q);
  if (
    classifyLinearRight(p, q, none) !== "none" ||
    classifyLinearRight(p, q, infinite) !== "infinite" ||
    classifyLinearRight(p, q, one) !== "one"
  )
    throw new Error("Class key failed");
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label: "Complete each right side",
    layout: "steps",
    mode: "build",
    banks: [],
    rows: [
      {
        id: "r1",
        label: "A right side with no solution",
        fields: [
          {
            kind: "expression",
            label: "Expression",
            variables: ["x"],
            maxLength: 24,
          },
        ],
      },
      {
        id: "r2",
        label: "A right side with infinitely many solutions",
        fields: [
          {
            kind: "expression",
            label: "Expression",
            variables: ["x"],
            maxLength: 24,
          },
        ],
      },
      {
        id: "r3",
        label: "A right side with exactly one solution",
        fields: [
          {
            kind: "expression",
            label: "Expression",
            variables: ["x"],
            maxLength: 24,
          },
        ],
      },
    ],
  };
  const workGrading: WorkGrading = {
    mode: "linear-classes",
    p,
    q,
    classes: ["none", "infinite", "one"],
  };
  const answer = JSON.stringify([[none], [infinite], [one]]);
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error("Uncanonical example");
  if (!gradeStructuredWork(response, workGrading, answer))
    throw new Error("Example key");
  return stamp(meta, seed, "make-an-example", {
    prompt: `Complete the right side of $${axb(p, q)} = ____$ so the equation has (1) no solution, (2) infinitely many solutions, (3) exactly one solution.`,
    response,
    answer,
    workGrading,
    hint: "Compare x counts first. The same count with a different plain number has no solution. The same expression has every number. A different x count has one number.",
    explanation: [
      `The left side is $${axb(p, q)}$. Its x-count is ${p} and its plain number is ${q}.`,
      "Same x-count and a different plain number: no number works.",
      "The same expression, in any equivalent form: every number works.",
      "A different x-count: the x terms do not cancel, so exactly one number works.",
    ],
  });
}

const SLOPES: Fr[] = [
  fr(1),
  fr(-1),
  fr(2),
  fr(-2),
  fr(1, 2),
  fr(-1, 2),
  fr(1, 3),
  fr(-1, 3),
  fr(3, 2),
  fr(-3, 2),
];

function latticeLine(m: Fr, b: number, x: number): [number, number] | null {
  if (x % m.d !== 0) return null;
  const y = b + (m.n * x) / m.d;
  if (!Number.isInteger(y) || Math.abs(x) > 8 || Math.abs(y) > 8) return null;
  return [x, y];
}

export function intersectionReason(seed: string): GeneratedProblem {
  const meta = metaOf("system-intersection-reason");
  const r = clauseStream(meta.id, seed);
  const m1 = pick(r, SLOPES);
  let m2 = pick(r, SLOPES);
  if (feq(m1, m2)) m2 = pick(r, SLOPES.filter((m) => !feq(m, m1)));
  const qx = r(-1, 1) * m1.d * m2.d;
  if (Math.abs(qx) > 8) throw new Error("Crossing off the grid");
  const qy = r(-4, 4);
  const b1 = qy - (m1.n * qx) / m1.d;
  const b2 = qy - (m2.n * qx) / m2.d;
  if (!Number.isInteger(b1) || !Number.isInteger(b2))
    throw new Error("Intercept");
  const candidates = [-6, -4, -2, 2, 4, 6]
    .map((step) => latticeLine(m1, b1, qx + step * m1.d))
    .filter((p): p is [number, number] => !!p);
  const P = candidates.find(
    (p) => p[1] !== b2 + (m2.n * p[0]) / m2.d,
  );
  const others = [-6, -4, -2, 2, 4, 6]
    .map((step) => latticeLine(m2, b2, qx + step * m2.d))
    .filter((p): p is [number, number] => !!p);
  const R = others.find(
    (p) =>
      p[1] !== b1 + (m1.n * p[0]) / m1.d &&
      !(P && p[0] === P[0] && p[1] === P[1]) &&
      !(p[0] === qx && p[1] === qy),
  );
  if (!P || !R) throw new Error("Need P and R");
  const on1 = (x: number, y: number) => y === b1 + (m1.n * x) / m1.d;
  const on2 = (x: number, y: number) => y === b2 + (m2.n * x) / m2.d;
  if (!(on1(qx, qy) && on2(qx, qy))) throw new Error("Q missed");
  if (!(on1(P[0], P[1]) && !on2(P[0], P[1]))) throw new Error("P");
  if (!(!on1(R[0], R[1]) && on2(R[0], R[1]))) throw new Error("R");
  const scene = graph({
    x: [-8, 8],
    y: [-8, 8],
    grid: 1,
    tick: 2,
  })
    .line({ m: fnum(m1), b: b1 }, { label: "Line 1" })
    .line({ m: fnum(m2), b: b2 }, { color: "warm", label: "Line 2" })
    .point(P[0], P[1], "P")
    .point(qx, qy, "Q")
    .point(R[0], R[1], "R")
    .scene({ title: "Two lines" });
  const yOf = (m: Fr, b: number, x: number) => b + (m.n * x) / m.d;
  const check = `At Q, line 1 gives ${yOf(m1, b1, qx)} and line 2 gives ${yOf(m2, b2, qx)}`;
  const built = multi(r, [
    {
      id: "who",
      label: "Which point is a solution of the system?",
      choices: ["P", "Q", "R"],
      correct: "Q",
    },
    {
      id: "why",
      label: "Why?",
      choices: [
        "Q is on both lines, so it makes both equations true",
        "Q is on the first line, so the first equation is enough",
        "A crossing has equal x and y",
        "P and R are solutions because each is on one line",
      ],
      correct: "Q is on both lines, so it makes both equations true",
    },
    {
      id: "chk",
      label: "Which check is correct for Q?",
      choices: [
        check,
        `At Q, both lines give ${yOf(m1, b1, qx) + 1}`,
        `At P, both lines give ${P[1]}`,
        `At R, line 1 gives ${R[1]}`,
      ],
      correct: check,
    },
  ]);
  return stamp(meta, seed, "intersection-reason", {
    prompt: `Line 1 is y = ${ftxt(m1)}x + ${b1}. Line 2 is y = ${ftxt(m2)}x + ${b2}. P is (${P[0]}, ${P[1]}), Q is (${qx}, ${qy}), and R is (${R[0]}, ${R[1]}).`,
    response: built.response,
    answer: built.answer,
    figure: { kind: "scene", scene },
    hint: "A solution of the system is on both lines. A point on only one line makes only that equation true.",
    explanation: [
      `Q (${qx}, ${qy}) is on both lines, so both equations are true there.`,
      `P is on line 1 only: ${P[1]} equals the first line and not the second.`,
      `R is on line 2 only.`,
      check + ".",
    ],
  });
}

export function plotLine(seed: string): GeneratedProblem {
  const meta = metaOf("system-line-points");
  const r = clauseStream(meta.id, seed);
  const m = pick(r, SLOPES.filter((s) => s.d <= 2));
  const b = r(-3, 3);
  const grid = {
    xMin: -8,
    xMax: 8,
    yMin: -8,
    yMax: 8,
    step: 1,
    xLabel: "x",
    yLabel: "y",
  };
  const line = lineThrough(
    latticeLine(m, b, 0) ?? [0, b],
    latticeLine(m, b, m.d) ?? [m.d, b + m.n],
  );
  const points = latticeOnLine(grid, line);
  if (points.length < 2) throw new Error("Need two lattice points");
  const answerPoints = [points[0]!, points[points.length - 1]!];
  const response: PointPlotResponse = {
    kind: "point-plot",
    label: "Plot two points on the first line",
    grid,
    pointCount: 2,
    ordered: false,
    connect: "line",
  };
  const m2 = pick(r, SLOPES.filter((s) => !feq(s, m)));
  const b2 = b + nz(r, 1, 3);
  return stamp(meta, seed, "plot-and-estimate", {
    prompt: `The system is y = ${ftxt(m)}x + ${b} and y = ${ftxt(m2)}x + ${b2}. Plot two lattice points on the first line. The line through your points is the first equation; the crossing is a separate question.`,
    response,
    answer: serializePlot(answerPoints, false),
    pointGrading: { mode: "on-line", ...line },
    figure: {
      kind: "scene",
      scene: graph({ x: [-8, 8], y: [-8, 8], grid: 1, tick: 2 })
        .line({ m: fnum(m2), b: b2 }, { color: "warm", label: "Line 2" })
        .scene({ title: "Line 2 is drawn" }),
    },
    hint: "Pick two x-values that the slope's denominator divides. Multiply by the slope and add the intercept. Those points are on the first line.",
    explanation: [
      `On y = ${ftxt(m)}x + ${b}, an x that ${m.d === 1 ? "is an integer" : `is a multiple of ${m.d}`} gives an integer y.`,
      `One such point is (${answerPoints[0]![0]}, ${answerPoints[0]![1]}). Another is (${answerPoints[1]![0]}, ${answerPoints[1]![1]}).`,
      "Any two distinct lattice points on that line are accepted. Line 2 is already drawn and is not part of this plot.",
    ],
  });
}

const dist = (x: number, y: number, a: Fr, b: Fr) =>
  Math.hypot(x - fnum(a), y - fnum(b));

export function crossingEstimate(seed: string): GeneratedProblem {
  const meta = metaOf("system-crossing-estimate");
  const r = clauseStream(meta.id, seed);
  const m1 = pick(r, SLOPES);
  let m2 = pick(r, SLOPES.filter((m) => !feq(m, m1)));
  const b1 = r(-3, 3);
  const b2 = r(-3, 3);
  const x = fdiv(fsub(fr(b2), fr(b1)), fsub(m1, m2));
  const y = fadd(fmul(m1, x), fr(b1));
  if (Math.abs(fnum(x)) > 7 || Math.abs(fnum(y)) > 7)
    throw new Error("Crossing outside");
  const near = (v: number) => Math.round(v * 2) / 2;
  const key = `(${near(fnum(x))}, ${near(fnum(y))})`;
  if (dist(near(fnum(x)), near(fnum(y)), x, y) > 0.25)
    throw new Error("Estimate too far");
  const mirror = `(${near(fnum(x))}, ${near(-fnum(y))})`;
  const swapped = `(${near(fnum(y))}, ${near(fnum(x))})`;
  const intercept = `(0, ${b1})`;
  const along = `(${near(fnum(x)) + 1}, ${near(fnum(y))})`;
  const labels = [key, mirror, swapped, intercept, along];
  const far = labels.filter(
    (label, i) =>
      i === 0 ||
      (label !== key &&
        dist(
          Number(label.slice(1, label.indexOf(","))),
          Number(label.slice(label.indexOf(",") + 1, -1)),
          x,
          y,
        ) > 0.5),
  );
  const unique = [...new Set(far)];
  if (!unique.includes(key) || unique.length < 4) throw new Error("Distractors");
  const rows = unique.slice(0, 4).map((label) => ({
    label,
    correct: label === key,
    feedback:
      label === key
        ? ""
        : "That point is not within half a unit of the crossing.",
  }));
  const chosen = choiceOf(r, rows);
  const scene = graph({ x: [-8, 8], y: [-8, 8], grid: 1, tick: 2 })
    .line({ m: fnum(m1), b: b1 }, { label: "Line 1" })
    .line({ m: fnum(m2), b: b2 }, { color: "warm", label: "Line 2" })
    .scene({ title: "Estimate the crossing" });
  return stamp(meta, seed, "plot-and-estimate", {
    prompt: `The lines are y = ${ftxt(m1)}x + ${b1} and y = ${ftxt(m2)}x + ${b2}. Which ordered pair best estimates where they cross?`,
    response: {
      kind: "choice",
      label: "Choose the estimate",
      options: chosen.options,
    },
    answer: chosen.answer,
    choiceFeedback: chosen.feedback,
    figure: { kind: "scene", scene },
    hint: "Follow the two lines to where they meet. Read x and y to the nearest half unit. A y-intercept and a swapped pair are not the crossing.",
    explanation: [
      `Exactly, x = ${ftxt(x)} and y = ${ftxt(y)}.`,
      `The nearest half-unit pair is ${key}, within a quarter unit of the exact crossing.`,
      "The other choices are a swapped pair, a mirror, an intercept, or a point on only one line.",
    ],
  });
}

export function assumeCheck(seed: string): GeneratedProblem {
  const meta = metaOf("assume-solution-check");
  const r = clauseStream(meta.id, seed);
  const none = r(0, 9) < 3;
  const a = r(2, 5);
  const b = nz(r, 1, 6);
  let c = r(1, 4);
  if (none) c = a;
  else if (c === a) c = a === 4 ? 1 : a + 1;
  const x = r(-6, 8);
  const leftConst = a * b;
  const d = none ? leftConst + nz(r, 1, 5) : (a - c) * x + leftConst;
  const eq = `${a}(x${b >= 0 ? "+" : ""}${b}) = ${c}x${d >= 0 ? "+" : ""}${d}`;
  const expandedLeft = a * x + leftConst;
  const checkX = none ? 0 : x;
  const sideL = a * (checkX + b);
  const sideR = c * checkX + d;
  const built = multi(r, [
    {
      id: "why",
      label: "What justifies the opening supposition?",
      choices: [
        "We assume a solution exists; later lines are true for that x",
        "Addition property of equality",
        "Definition of a variable",
        "It is given, so it is true for every x",
      ],
      correct: "We assume a solution exists; later lines are true for that x",
    },
    {
      id: "shown",
      label: "What has the chain shown?",
      choices: none
        ? [
            "The assumption led to a false statement, so no number is a solution",
            "x = 0",
            `x = ${Math.abs(d - leftConst)}`,
            "The distributive step was wrong",
          ]
        : [
            `If there is a solution, it must be ${x}`,
            `${x} is a solution`,
            "Every number is a solution",
            `The equation has two solutions, x and ${x}`,
          ],
      correct: none
        ? "The assumption led to a false statement, so no number is a solution"
        : `If there is a solution, it must be ${x}`,
    },
    {
      id: "chk",
      label: "What completes the argument?",
      choices: none
        ? [
            `${leftConst} = ${d} is false, so the supposition is impossible`,
            "Nothing more; the steps already prove a solution",
            "Check the last line only",
            "Solve again by a different method",
          ]
        : [
            `Substitute ${x}: both sides equal ${sideL}`,
            "Nothing more; the steps already prove it",
            `Check ${x} in the last line only`,
            "Solve again by a different method",
          ],
      correct: none
        ? `${leftConst} = ${d} is false, so the supposition is impossible`
        : `Substitute ${x}: both sides equal ${sideL}`,
    },
  ]);
  if (!none && sideL !== sideR) throw new Error("Check failed");
  if (!none && expandedLeft !== sideL) throw new Error("Expansion");
  return stamp(meta, seed, "assume-then-check", {
    prompt: none
      ? `Suppose x is a number with ${eq}. Expanding and subtracting ${c}x from both sides leaves ${leftConst} = ${d}.`
      : `Suppose x is a number with ${eq}. The chain reaches x = ${x}.`,
    response: built.response,
    answer: built.answer,
    hint: "The first line is an assumption, not a property and not an identity. Follow what must be true, then test the result in the original equation.",
    explanation: none
      ? [
          "We supposed a solution exists. Each step keeps the truth of the line before it.",
          `The chain ends at ${leftConst} = ${d}, which is false.`,
          "The supposition is impossible, so no number is a solution.",
        ]
      : [
          "We supposed a solution exists, so if there is one it must be the number the chain reached.",
          `Substitute ${x} in the original: ${a}(${checkX} + ${b}) = ${sideL} and ${c}(${checkX}) + ${d} = ${sideR}.`,
          "The two sides match, so the number really is a solution.",
        ],
  });
}

const coef = (n: number, v: string) =>
  n === 1 ? v : n === -1 ? `-${v}` : `${n}${v}`;
const plus = (n: number) => (n < 0 ? ` - ${-n}` : ` + ${n}`);

export function scaledElimination(seed: string): GeneratedProblem {
  const meta = metaOf("scaled-elimination");
  const r = clauseStream(meta.id, seed);
  const x = r(-4, 4);
  const y = r(-4, 4);
  const a = nz(r, 1, 4);
  const b = nz(r, 1, 4);
  const c = a * x + b * y;
  const k = pick(r, [-4, -3, -2, 2, 3, 4]);
  const e = -k * b;
  const d = nz(r, 1, 4);
  const f = d * x + e * y;
  const nx = d + k * a;
  const nr = f + k * c;
  if (
    c === 0 ||
    f === 0 ||
    e === 0 ||
    nx === 0 ||
    nr === f + c ||
    Math.abs(e) > 8 ||
    Math.abs(nx) > 16 ||
    Math.abs(c) > 40 ||
    Math.abs(f) > 40
  )
    throw new Error("Need a clean elimination");
  const side = (x: number, y: number) =>
    `${x}x${y < 0 ? "" : "+"}${y}y`;
  const left1 = side(a, b);
  const left2 = side(d, e);
  const key = `${coef(nx, "x")} = ${nr}`;
  const unscaled = `${coef(nx, "x")} = ${f + c}`;
  const subtracted = `${coef(d - k * a, "x")}${e - k * b >= 0 ? "+" : ""}${e - k * b}y = ${f - k * c}`;
  const scaledE2 = `${coef(k * d, "x")}${k * e >= 0 ? "+" : ""}${k * e}y = ${k * f}`;
  const labels = [key, unscaled, subtracted, scaledE2];
  if (new Set(labels).size !== 4) throw new Error("Elimination labels");
  const general = r(0, 1) === 0;
  const parts = [
    {
      id: "sum",
      label: "Which equation is E2 + k·E1?",
      choices: labels,
      correct: key,
    },
    {
      id: "why",
      label: "Why does the new system have the same solutions?",
      choices: [
        "Adding k·E1 keeps solutions, and subtracting k·E1 brings E2 back",
        "Scaling E1 does not change the system",
        "An equation in only x has the same solutions as E2",
        "Two systems that share one equation share every solution",
      ],
      correct:
        "Adding k·E1 keeps solutions, and subtracting k·E1 brings E2 back",
    },
  ];
  if (general)
    parts.push({
      id: "gen",
      label: "What is (d + ka)x + (e + kb)y at a solution?",
      choices: [`${nr}, because it equals f + kc`, `${f + c}`, `${k * f + k * c}`, "It cannot be known without numbers"],
      correct: `${nr}, because it equals f + kc`,
    });
  const built = multi(r, parts);
  return stamp(meta, seed, "scaled-multiple", {
    prompt: `E1: ${left1} = ${c}. E2: ${left2} = ${f}. The system is replaced by E1 and E2 + ${k}·E1.`,
    response: built.response,
    answer: built.answer,
    hint: "Multiply every term of E1 by k, then add matching terms to E2. The new equation is reversible: subtract k·E1 to get E2 back.",
    explanation: [
      `${k}·E1 is ${coef(k * a, "x")} and ${coef(k * b, "y")} equal to ${k * c}.`,
      `Add E2: ${coef(nx, "x")} = ${nr}. The y terms are ${e} + (${k})(${b}) = 0.`,
      `The unscaled right side would be ${f + c}, which is not ${nr}.`,
      general
        ? `At a solution, E2 contributes ${f} and k·E1 contributes ${k * c}, so the sum is ${nr}.`
        : "Subtracting k·E1 from the new equation returns E2, so nothing was gained or lost.",
    ],
  });
}

const builders: Record<string, (seed: string) => GeneratedProblem> = {
  "variable-role-pair": variableRole,
  "arithmetic-algebra-compare": arithmeticAlgebra,
  "fee-budget-number-line": feeGraph,
  "fee-budget-meaning": feeMeaning,
  "equation-make-example": makeExample,
  "system-intersection-reason": intersectionReason,
  "system-line-points": plotLine,
  "system-crossing-estimate": crossingEstimate,
  "assume-solution-check": assumeCheck,
  "scaled-elimination": scaledElimination,
};

export function generateEquationClauseProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const build = builders[templateId];
  if (!build) throw new Error(`Unknown equation-clause template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  let last = "";
  for (let attempt = 0; attempt < 40; attempt++)
    try {
      return build(attempt ? `${seed}#${attempt}` : seed);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      last = error.message;
    }
  throw new Error(`${templateId}: ${last}`);
}
