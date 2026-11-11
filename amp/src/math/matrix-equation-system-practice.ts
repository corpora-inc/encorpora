import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { shuffle } from "./distribution-practice";
import { rowsWork, workSurface, type RowSpec } from "./structured-work-rows";
import { defineAxis, type Random } from "./variation/axes";
import type { Surface } from "./variation/compose";

/**
 * HSA.REI.C.8: represent a system of linear equations as one matrix
 * equation AX = B in the column of unknowns X, and read a matrix equation
 * back as its system.
 *
 * `system-to-matrix-equation` (structured-work-v1) has the learner enter A
 * and B row by row for a 2×2 system (aligned or with one rearranged
 * equation), or the sizes of A, X and B. The prompt fixes X and the row
 * order, and states the one convention that makes A unique (keep the
 * coefficient of each equation's first unknown as written), so exact cell
 * grading is the reconstruction grading. A 3×3 entry needs three cells per
 * row; a structured-work row holds two fields, so 3×3 systems appear in the
 * reading and find-the-flaw variants instead.
 *
 * `matrix-equation-reading` (single-choice-v1): which system a matrix
 * equation stands for, which equation one row stands for (or one
 * coefficient), what a student's wrong A and B got wrong, and whether a
 * given vector X solves AX = B.
 */

export const matrixEquationSystemTemplates: readonly TemplateMetadata[] = [
  {
    id: "system-to-matrix-equation",
    version: 1,
    title: "Write a system as one matrix equation",
    skillId: "matrix-systems",
    gradeBand: "9–12",
    difficultyOffset: 0.6,
    description:
      "Enter the coefficient matrix $A$ and the constant column $B$ of a $2\\times2$ linear system, given $X$ and the row order: aligned systems and systems with one equation rearranged (a term or constant on the other side, terms out of order, a missing unknown). Or give the sizes of $A$, $X$ and $B$ for 2 or 3 equations in 2 or 3 unknowns.",
    requiredResponseCapability: "structured-work-v1",
    glossaryNoLink: ["vector", "entry", "entries", "size"],
  },
  {
    id: "matrix-equation-reading",
    version: 1,
    title: "Read a matrix equation as a system",
    skillId: "matrix-systems",
    gradeBand: "9–12",
    difficultyOffset: 0.7,
    description:
      "Choose the system a $2\\times2$ or $3\\times3$ matrix equation $AX=B$ stands for, the equation one row stands for or one coefficient, the mistake in a student's $A$ and $B$ (transposed rows, constants put in $A$, a moved term or constant with the wrong sign, coefficients out of order, a missing 0), or whether a given vector $X$ solves $AX=B$ after multiplying it out.",
    requiredResponseCapability: "single-choice-v1",
    glossaryNoLink: ["vector", "entry", "entries", "size"],
  },
];

const VARS = ["x", "y", "z"] as const;
type Row = number[];

/* ---------------------------------------------------------------- TeX */

type Term = { k: number; v: string | null };
/** One side of an equation from its terms in written order; zero terms are
 * left out and a coefficient of ±1 is not printed before a letter. */
export function sideTex(terms: readonly Term[]): string {
  let out = "";
  for (const { k, v } of terms) {
    if (k === 0) continue;
    const size = Math.abs(k);
    const body = v === null ? `${size}` : size === 1 ? v : `${size}${v}`;
    out +=
      out === ""
        ? k < 0
          ? `-${body}`
          : body
        : k < 0
          ? `-${body}`
          : `+${body}`;
  }
  return out === "" ? "0" : out;
}
const rowTerms = (row: readonly number[]): Term[] =>
  row.map((k, j) => ({ k, v: VARS[j]! }));
/** Σ row[j]·X[j] = b in X's order. */
export const equationTex = (row: readonly number[], b: number) =>
  `${sideTex(rowTerms(row))}=${b}`;
export const bmatrix = (rows: readonly (readonly (number | string)[])[]) =>
  `\\begin{bmatrix}${rows.map((r) => r.join("&")).join("\\\\")}\\end{bmatrix}`;
const column = (values: readonly (number | string)[]) =>
  bmatrix(values.map((v) => [v]));
const xColumn = (n: number) => column(VARS.slice(0, n));
const systemTex = (A: readonly Row[], B: readonly number[]) =>
  `\\begin{cases}${A.map((row, i) => equationTex(row, B[i]!)).join("\\\\")}\\end{cases}`;
const signed = (n: number) => (n < 0 ? `(${n})` : `${n}`);
/** A product written out, negative factors in parentheses: 3\cdot(-2). */
const times = (...factors: (number | string)[]) =>
  factors.map((f) => (typeof f === "number" ? signed(f) : f)).join("\\cdot ");
/** A row of A times X, written out: 3\cdot x+(-2)\cdot y. */
const rowTimes = (row: readonly number[]) =>
  row.map((a, j) => times(a, VARS[j]!)).join("+");

/* ------------------------------------------------------------ helpers */

const nz = (r: Random, max: number) => {
  const v = r(1, max);
  return r(0, 1) ? v : -v;
};
const det2 = (A: readonly Row[]) =>
  A[0]![0]! * A[1]![1]! - A[0]![1]! * A[1]![0]!;
const transpose = (A: readonly Row[]) =>
  A[0]!.map((_, j) => A.map((row) => row[j]!));
const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
const sameMatrix = (a: readonly Row[], b: readonly Row[]) =>
  a.length === b.length && a.every((row, i) => same(row, b[i]!));
/** Two equations (coefficients then constant) are the same equation when
 * one is a nonzero multiple of the other. */
function proportional(p: readonly number[], q: readonly number[]): boolean {
  if (p.length !== q.length) return false;
  let ratio: [number, number] | null = null;
  for (let i = 0; i < p.length; i++) {
    if ((p[i] === 0) !== (q[i] === 0)) return false;
    if (p[i] === 0) continue;
    if (!ratio) ratio = [p[i]!, q[i]!];
    else if (p[i]! * ratio[1] !== q[i]! * ratio[0]) return false;
  }
  return ratio !== null;
}
/** The same system up to the order of its equations and scaling each one. */
export function sameSystem(
  a: readonly (readonly number[])[],
  b: readonly (readonly number[])[],
): boolean {
  if (a.length !== b.length) return false;
  const left = [...b];
  for (const eq of a) {
    const at = left.findIndex((other) => proportional(eq, other));
    if (at < 0) return false;
    left.splice(at, 1);
  }
  return true;
}
const augmented = (A: readonly Row[], B: readonly number[]) =>
  A.map((row, i) => [...row, B[i]!]);
const product = (A: readonly Row[], X: readonly number[]) =>
  A.map((row) => row.reduce((s, a, j) => s + a * X[j]!, 0));

/* --------------------------------------------------- written equations */

/** How an equation of a 2×2 system is written. Each form names the row
 * [a, b] and constant c of `ax + by = c` it stands for. */
export const forms = [
  "aligned",
  "x-equals",
  "zero",
  "flipped",
  "split",
  "reversed",
  "x-only",
  "y-only",
] as const;
export type Form = (typeof forms)[number];
export interface Written {
  form: Form;
  row: Row;
  c: number;
  tex: string;
}
/** Write `ax + by = c` in a form. Forms that move a constant need c ≠ 0;
 * "x-only" and "y-only" need the other coefficient 0. */
export function write(form: Form, row: Row, c: number): Written {
  const [a, b] = row as [number, number];
  const X = { k: a, v: "x" },
    Y = { k: b, v: "y" };
  const tex = (() => {
    switch (form) {
      case "aligned":
      case "x-only":
      case "y-only":
        return `${sideTex([X, Y])}=${c}`;
      case "x-equals":
        return `${sideTex([X])}=${sideTex([
          { k: c, v: null },
          { k: -b, v: "y" },
        ])}`;
      case "zero":
        return `${sideTex([X, Y, { k: -c, v: null }])}=0`;
      case "flipped":
        return `${c}=${sideTex([X, Y])}`;
      case "split":
        return `${sideTex([X, { k: -c, v: null }])}=${sideTex([{ k: -b, v: "y" }])}`;
      case "reversed":
        return `${sideTex([Y, X])}=${c}`;
    }
  })();
  return { form, row: [a, b], c, tex };
}

/** The convention that makes A unique: keep the coefficient of the first
 * unknown written in each equation. */
const KEEP_FIRST =
  "Move terms across the equals sign as needed, but keep the coefficient of the first unknown in each equation as written.";

/** The rewrite of one written equation into `ax + by = c`, for the
 * explanation: what moved and how its sign changed. */
function rewriteNote(w: Written, i: number): string | null {
  const [a, b] = w.row as [number, number];
  const target = `$${equationTex(w.row, w.c)}$`;
  switch (w.form) {
    case "x-equals":
      return `Equation ${i}, $${w.tex}$: move $${sideTex([{ k: -b, v: "y" }])}$ to the left, where it becomes $${sideTex([{ k: b, v: "y" }])}$, giving ${target}.`;
    case "zero":
      return `Equation ${i}, $${w.tex}$: move the constant $${-w.c}$ to the right, where it becomes $${w.c}$, giving ${target}.`;
    case "flipped":
      return `Equation ${i}, $${w.tex}$: swap the two sides, which changes no sign, giving ${target}.`;
    case "split":
      return `Equation ${i}, $${w.tex}$: move $${sideTex([{ k: -b, v: "y" }])}$ to the left (it becomes $${sideTex([{ k: b, v: "y" }])}$) and the constant $${-w.c}$ to the right (it becomes $${w.c}$), giving ${target}.`;
    case "reversed":
      return `Equation ${i}, $${w.tex}$: list $x$ first to match $X$, giving ${target}.`;
    case "x-only":
      return `Equation ${i}, $${w.tex}$, has no $y$, so its coefficient of $y$ is 0. The equation is $${sideTex([{ k: a, v: "x" }])}=${w.c}$.`;
    case "y-only":
      return `Equation ${i}, $${w.tex}$, has no $x$, so its coefficient of $x$ is 0. The equation is $${sideTex([{ k: b, v: "y" }])}=${w.c}$.`;
    default:
      return null;
  }
}

/* ------------------------------------------- system-to-matrix-equation */

const entryAxis = defineAxis(
  "variant",
  ["aligned", "rearranged", "shape"] as const,
  { weights: [3, 4, 2] },
);

interface EntryModel {
  variant: "aligned" | "rearranged" | "shape";
  /** 2×2 entry: the written equations. */
  written: Written[];
  /** Shape: m equations in n unknowns. */
  A: Row[];
  B: number[];
}

const constant = (r: Random) => nz(r, 20);

function entryModel(r: Random, variant: EntryModel["variant"]): EntryModel {
  if (variant === "shape") {
    const [m, n] = pick(r, [
      [2, 2],
      [3, 3],
      [3, 2],
      [2, 3],
    ] as const);
    const A = Array.from({ length: m }, () =>
      Array.from({ length: n }, () => nz(r, 6)),
    );
    const B = Array.from({ length: m }, () => nz(r, 15));
    if (new Set(A.map((row) => row.join())).size < m)
      throw new Error("Need three retry: repeated row");
    return { variant, written: [], A, B };
  }
  const odd = variant === "rearranged" ? r(0, 1) : -1;
  const formOf: Form[] = [0, 1].map((i) =>
    i === odd
      ? pick(r, [
          "x-equals",
          "zero",
          "flipped",
          "split",
          "reversed",
          "x-only",
          "y-only",
        ] as const)
      : "aligned",
  );
  const rows: Row[] = formOf.map((f) => [
    f === "y-only" ? 0 : nz(r, 9),
    f === "x-only" ? 0 : nz(r, 9),
  ]);
  if (det2(rows) === 0) throw new Error("Need three retry: singular");
  const written = formOf.map((f, i) => write(f, rows[i]!, constant(r)));
  return {
    variant,
    written,
    A: rows,
    B: written.map((w) => w.c),
  };
}

const num = (v: number) => ({
  caption: "",
  kind: "number" as const,
  value: String(v),
  maxLength: 4,
});

function entrySurface(m: EntryModel, r: Random): Surface {
  if (m.variant === "shape") {
    const rows = m.A.length,
      cols = m.A[0]!.length;
    const specs: RowSpec[] = [
      ["$A$", rows, cols],
      ["$X$", cols, 1],
      ["$B$", rows, 1],
    ].map(([name, a, b]) => ({
      label: `Size of ${name}: number of rows, then number of columns`,
      fields: [
        { ...num(a as number), caption: "Rows" },
        { ...num(b as number), caption: "Columns" },
      ],
    }));
    const built = rowsWork(specs, "build", r, "Enter each size");
    const first = equationTex(m.A[0]!, m.B[0]!);
    const unknowns = VARS.slice(0, cols)
      .map((v) => `$${v}$`)
      .join(cols === 3 ? ", " : " and ");
    return workSurface(built, {
      prompt: `This system is written as one matrix equation $AX=B$, where $X$ is the column of its unknowns: $${systemTex(m.A, m.B)}$. How many rows and columns does each of $A$, $X$ and $B$ have?`,
      hint: `Each equation becomes one row of $A$, and each unknown gets one column of $A$. Equation 1 here is $${first}$; count the equations and the unknowns.`,
      explanation: [
        `The system has ${rows} equations in ${cols} unknowns, ${unknowns}.`,
        `$A$ holds only the coefficients: one row per equation and one column per unknown, so it is ${rows} by ${cols} ($${rows}\\times${cols}$). The constants are not a column of $A$.`,
        `$X$ lists the ${cols} unknowns once each in a single column, so it is ${cols} by 1 ($${cols}\\times1$).`,
        `$B$ lists the ${rows} constants in a single column, one per equation, so it is ${rows} by 1 ($${rows}\\times1$).`,
        `Check: a $${rows}\\times${cols}$ matrix times a $${cols}\\times1$ column gives a $${rows}\\times1$ column, the size of $B$.`,
      ],
    });
  }
  const [w1, w2] = m.written as [Written, Written];
  const rearranged = m.variant === "rearranged";
  const specs: RowSpec[] = [0, 1].map((i) => ({
    label: `Row ${i + 1} of $A$: coefficient of $x$, then of $y$`,
    fields: [
      { ...num(m.A[i]![0]!), caption: `Row ${i + 1}, column 1` },
      { ...num(m.A[i]![1]!), caption: `Row ${i + 1}, column 2` },
    ],
  }));
  specs.push({
    label: "$B$: entry 1, then entry 2",
    fields: [
      { ...num(m.B[0]!), caption: "Entry 1" },
      { ...num(m.B[1]!), caption: "Entry 2" },
    ],
  });
  const built = rowsWork(specs, "build", r, "Enter the entries of $A$ and $B$");
  const odd = m.written.find((w) => w.form !== "aligned");
  const oddIndex = odd ? m.written.indexOf(odd) + 1 : 1;
  const notes = m.written.flatMap((w, i) => {
    const note = rewriteNote(w, i + 1);
    return note ? [note] : [];
  });
  const rowProduct = (i: number) =>
    `$${rowTimes(m.A[i]!)}=${sideTex(rowTerms(m.A[i]!))}$`;
  return workSurface(built, {
    prompt: `Write this system as one matrix equation $AX=B$ with $X=${xColumn(2)}$. Equation 1 is $${w1.tex}$ and equation 2 is $${w2.tex}$. Row 1 of $A$ and entry 1 of $B$ come from equation 1; row 2 and entry 2 come from equation 2. ${KEEP_FIRST}`,
    hint: rearranged
      ? odd!.form === "x-only" || odd!.form === "y-only"
        ? `Equation ${oddIndex}, $${odd!.tex}$, has only one unknown. Its row of $A$ still needs two entries: what goes in the column of the unknown that is missing?`
        : `Equation ${oddIndex}, $${odd!.tex}$, is not yet in the form $\\square x+\\square y=\\square$. Rewrite it with $x$ and then $y$ on the left and the number on the right before reading its row.`
      : `In equation 1, $${w1.tex}$, the number multiplying $x$ goes in column 1 of row 1 and the number multiplying $y$ in column 2; the right side becomes entry 1 of $B$. Do the same for equation 2.`,
    explanation: [
      `$X=${xColumn(2)}$ is the column of unknowns: each unknown once, $x$ first. So column 1 of $A$ holds coefficients of $x$ and column 2 holds coefficients of $y$.`,
      ...(notes.length
        ? notes
        : [
            "Both equations already have $x$, then $y$, on the left and the constant on the right.",
          ]),
      `Equation $i$ gives row $i$ of $A$, and an unknown that does not appear has coefficient 0: $A=${bmatrix(m.A)}$.`,
      `$B$ holds the right sides in the same order: $B=${column(m.B)}$.`,
      `Check by multiplying: row 1 times $X$ is ${rowProduct(0)}, the left side of equation 1, and row 2 times $X$ is ${rowProduct(1)}. So $AX=B$ states both equations at once.`,
    ],
  });
}

const entryFamily = chainFamily({
  template: matrixEquationSystemTemplates[0]!,
  axes: { variant: entryAxis },
  model: (r, a) => entryModel(r, a.variant),
  render: (m, _a, r) => entrySurface(m, r),
  variant: (m) =>
    m.variant === "rearranged"
      ? `rearranged-${m.written.find((w) => w.form !== "aligned")!.form}`
      : m.variant === "shape"
        ? `shape-${m.A.length}x${m.A[0]!.length}`
        : "aligned",
});

/* --------------------------------------------- matrix-equation-reading */

const readingAxis = defineAxis(
  "variant",
  ["which-system", "one-row", "find-flaw", "substitute"] as const,
  { weights: [3, 3, 4, 3] },
);

interface ReadingCase {
  id: string;
  prompt: string;
  hint: string;
  explanation: string[];
  options: ChoiceOption[];
}

/** A 2×2 (entries 1–9 in size) or a 3×3 with exactly one zero, in column 1
 * or 2 (entries 1–6 in size), neither symmetric nor with equal columns. */
function readingMatrix(
  r: Random,
  size: 2 | 3,
): { A: Row[]; B: number[]; zero: [number, number] | null } {
  const max = size === 2 ? 9 : 6;
  const A = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => nz(r, max)),
  );
  let zero: [number, number] | null = null;
  if (size === 3) {
    zero = [r(0, 2), r(0, 1)];
    A[zero[0]]![zero[1]] = 0;
  }
  const B = Array.from({ length: size }, () => nz(r, size === 2 ? 20 : 15));
  if (sameMatrix(A, transpose(A)))
    throw new Error("Need three retry: symmetric");
  const cols = transpose(A);
  if (cols.some((c, j) => cols.some((d, k) => k > j && same(c, d))))
    throw new Error("Need three retry: equal columns");
  if (size === 2 && det2(A) === 0)
    throw new Error("Need three retry: singular");
  return { A, B, zero };
}
const equationsOf = (A: readonly Row[], B: readonly number[]) =>
  A.map((row, i) => [...row, B[i]!]);
const matrixEquation = (A: readonly Row[], B: readonly number[]) =>
  `$${bmatrix(A)}${xColumn(A[0]!.length)}=${column(B)}$`;

function whichSystem(r: Random): ReadingCase {
  const size = r(0, 1) ? 3 : 2;
  const { A, B, zero } = readingMatrix(r, size);
  const correct = equationsOf(A, B);
  const T = transpose(A);
  const flipped = B.map((b) => -b);
  let third: { A: Row[]; feedback: string; why: string };
  if (zero) {
    const [i, j] = zero;
    const shifted = A.map((row) => [...row]);
    const rest = A[i]!.filter((_, k) => k !== j);
    shifted[i] = [...rest, 0];
    third = {
      A: shifted,
      feedback: `This drops the 0 in row ${i + 1} and slides the next coefficient onto the wrong unknown. A 0 in column ${j + 1} means $${VARS[j]}$ is missing from that equation.`,
      why: `drops the 0 in row ${i + 1}, which moves a coefficient onto the wrong unknown`,
    };
  } else {
    third = {
      A: A.map((row) => [row[1]!, row[0]!]),
      feedback:
        "The coefficients of $x$ and $y$ are exchanged. Column 1 of $A$ multiplies $x$ and column 2 multiplies $y$.",
      why: "exchanges the coefficients of $x$ and $y$",
    };
  }
  const candidates = [
    equationsOf(T, B),
    equationsOf(A, flipped),
    equationsOf(third.A, B),
  ];
  if (
    candidates.some(
      (c, k) =>
        sameSystem(c, correct) ||
        candidates.some((d, l) => l > k && sameSystem(c, d)),
    )
  )
    throw new Error("Need three retry: equivalent systems");
  const label = (rows: Row[], b: number[]) => `$${systemTex(rows, b)}$`;
  return {
    id: `which-system-${size}`,
    prompt: `Which system of equations does this matrix equation represent? ${matrixEquation(A, B)}`,
    hint: `Each row of $A$ is one equation. Multiply row 1, $${bmatrix([A[0]!])}$, by the column $X$ in your head, then set it equal to entry 1 of $B$, $${B[0]}$.`,
    explanation: [
      `Row $i$ of $A$ pairs with $X$: its entries multiply ${size === 3 ? "$x$, $y$ and $z$" : "$x$ and $y$"} in order, and the sum equals entry $i$ of $B$. A 0 means that unknown is not in the equation.`,
      ...A.map(
        (row, i) =>
          `Row ${i + 1}: $${rowTimes(row)}=${B[i]}$ gives $${equationTex(row, B[i]!)}$.`,
      ),
      `So the system is ${label(A, B)}. The other choices read the columns of $A$ as equations, flip the signs of the constants, or ${third.why}.`,
    ],
    options: [
      { label: label(A, B), correct: true },
      {
        label: label(T, B),
        feedback:
          "This reads each column of $A$ as an equation. Each row of $A$ is one equation.",
      },
      {
        label: label(A, flipped),
        feedback: `The constants have the wrong signs. Row $i$ of $A$ times $X$ equals entry $i$ of $B$ as it is written, so the first equation ends $=${B[0]}$.`,
      },
      { label: label(third.A, B), feedback: third.feedback },
    ],
  };
}

function oneRow(r: Random): ReadingCase {
  const size = r(0, 1) ? 3 : 2;
  const { A, B, zero } = readingMatrix(r, size);
  const n = size;
  const sys = matrixEquation(A, B);
  if (r(0, 9) < 3) {
    // The coefficient of one unknown in one equation.
    const [i, j] =
      zero && r(0, 9) < 4
        ? zero
        : ([r(0, n - 1), r(0, n - 1)] as [number, number]);
    const want = A[i]![j]!;
    const pool: ChoiceOption[] = [];
    const add = (v: number, feedback: string) => {
      if (v !== want && !pool.some((o) => o.label === `$${v}$`))
        pool.push({ label: `$${v}$`, feedback });
    };
    if (i !== j)
      add(
        A[j]![i]!,
        `That is the entry in row ${j + 1}, column ${i + 1}: rows and columns are swapped. Equation ${i + 1} is row ${i + 1}, and $${VARS[j]}$ is column ${j + 1}.`,
      );
    for (let k = 0; k < n; k++)
      if (k !== j)
        add(
          A[i]![k]!,
          `That is the coefficient of $${VARS[k]}$ in equation ${i + 1}. The coefficient of $${VARS[j]}$ is in column ${j + 1}.`,
        );
    for (let k = 0; k < n; k++)
      if (k !== i)
        add(
          A[k]![j]!,
          `That is the coefficient of $${VARS[j]}$ in equation ${k + 1}. Equation ${i + 1} is row ${i + 1} of $A$.`,
        );
    add(
      B[i]!,
      `That is entry ${i + 1} of $B$, the constant on the right side of equation ${i + 1}, not a coefficient.`,
    );
    const wrong = shuffle(r, pool).slice(0, 3);
    return {
      id:
        zero && i === zero[0] && j === zero[1]
          ? "coefficient-zero"
          : "coefficient",
      prompt: `This matrix equation stands for a system of ${n} equations: ${sys}. In that system, what is the coefficient of $${VARS[j]}$ in equation ${i + 1}?`,
      hint: `Equation ${i + 1} comes from row ${i + 1} of $A$, and its entries multiply ${n === 3 ? "$x$, $y$, $z$" : "$x$, $y$"} in that order.`,
      explanation: [
        `Equation $i$ of the system is row $i$ of $A$ times $X$, and column $j$ of $A$ multiplies the $j$th unknown of $X$.`,
        `So the coefficient of $${VARS[j]}$ in equation ${i + 1} is the entry in row ${i + 1}, column ${j + 1}: $${want}$.${want === 0 ? ` A 0 means $${VARS[j]}$ does not appear in that equation: $${equationTex(A[i]!, B[i]!)}$.` : ` Equation ${i + 1} is $${equationTex(A[i]!, B[i]!)}$.`}`,
      ],
      options: [{ label: `$${want}$`, correct: true }, ...wrong],
    };
  }
  const k = r(0, n - 1);
  const other = pick(
    r,
    [...Array(n).keys()].filter((i) => i !== k),
  );
  const col = A.map((row) => row[k]!);
  const eq = (row: Row, b: number) => [...row, b];
  const correct = eq(A[k]!, B[k]!);
  const cands: [number[], string][] = [
    [
      eq(A[other]!, B[other]!),
      `That is row ${other + 1}'s equation. Row ${k + 1} is the ${k === 0 ? "first" : k === 1 ? "second" : "third"} row of $A$.`,
    ],
    [
      eq(col, B[k]!),
      `This reads column ${k + 1} of $A$ as the equation. Row ${k + 1} runs across $A$, not down.`,
    ],
    [
      eq(A[k]!, -B[k]!),
      `The constant has the wrong sign. Row ${k + 1} times $X$ equals entry ${k + 1} of $B$, $${B[k]}$, as written.`,
    ],
  ];
  if (
    cands.some(
      ([c], i) =>
        proportional(c, correct) ||
        cands.some(([d], j) => j > i && proportional(c, d)),
    )
  )
    throw new Error("Need three retry: equal equations");
  const label = (e: number[]) => `$${equationTex(e.slice(0, n), e[n]!)}$`;
  return {
    id: `one-row-${size}`,
    prompt: `In this matrix equation, which equation does row ${k + 1} of $A$ stand for? ${sys}`,
    hint: `Row ${k + 1} of $A$ holds the numbers $${A[k]!.join(",\\ ")}$. Pair them, in order, with the unknowns of $X$, and take the right side from entry ${k + 1} of $B$.`,
    explanation: [
      `Row $i$ of $A$ times the column $X$ gives the left side of equation $i$; entry $i$ of $B$ is its right side.`,
      `Row ${k + 1} times $X$: $${rowTimes(A[k]!)}=${sideTex(rowTerms(A[k]!))}$, and entry ${k + 1} of $B$ is $${B[k]}$.`,
      `So row ${k + 1} stands for $${equationTex(A[k]!, B[k]!)}$. The other choices use another row, read a column as a row, or flip the constant's sign.`,
    ],
    options: [
      { label: label(correct), correct: true },
      ...cands.map(([c, feedback]) => ({ label: label(c), feedback })),
    ],
  };
}

/* ------------------------------------------------------- find the flaw */

const flawKinds = [
  "transposed",
  "augmented",
  "moved-sign",
  "constant-sign",
  "order",
  "zero",
] as const;
type FlawKind = (typeof flawKinds)[number];
const flawStatement: Record<FlawKind, string> = {
  transposed:
    "They wrote each equation's coefficients down a column of $A$ instead of across a row.",
  augmented: "They put the constants into $A$ as an extra column.",
  "moved-sign":
    "They moved an unknown's term across the equals sign without changing its sign.",
  "constant-sign":
    "They gave a constant the wrong sign: it changes sign only when it crosses the equals sign.",
  order:
    "They copied a row's coefficients in the order the equation lists them, not the order of $X$.",
  zero: "They left out the 0 for a missing unknown, so a coefficient landed in the wrong column.",
};
const flawShort: Record<FlawKind, string> = {
  transposed:
    "each equation's coefficients run down a column instead of across a row",
  augmented: "the constants were put into $A$ as an extra column",
  "moved-sign": "a moved term kept its sign",
  "constant-sign": "a constant has the wrong sign",
  order:
    "one row lists its coefficients in the equation's order, not the order of $X$",
  zero: "a missing unknown got no 0, so a coefficient shifted columns",
};

/** One equation of a find-the-flaw system: its written TeX, its row in
 * X's order, its constant, and the coefficients in the order written. */
interface FlawEquation {
  tex: string;
  row: Row;
  c: number;
  /** Flaw kinds this equation makes possible. */
  kinds: FlawKind[];
  /** The row as the order-of-terms slip writes it. */
  listed?: Row;
  /** The row as the missing-zero slip writes it. */
  shifted?: Row;
}

function flaw2(r: Random): FlawEquation[] {
  const kindsOf: Partial<Record<Form, FlawKind[]>> = {
    "x-equals": ["moved-sign"],
    zero: ["constant-sign"],
    flipped: ["constant-sign"],
    split: ["moved-sign", "constant-sign"],
    reversed: ["order"],
    "y-only": ["zero"],
  };
  const pool = Object.keys(kindsOf) as Form[];
  const f1 = pick(r, pool);
  const f2 = pick(
    r,
    pool.filter((f) => f !== f1),
  );
  const rows: Row[] = [f1, f2].map((f) => [
    f === "y-only" ? 0 : nz(r, 9),
    nz(r, 9),
  ]);
  if (det2(rows) === 0) throw new Error("Need three retry: singular");
  return [f1, f2].map((f, i) => {
    const w = write(f, rows[i]!, constant(r));
    const [a, b] = rows[i] as [number, number];
    return {
      tex: w.tex,
      row: rows[i]!,
      c: w.c,
      kinds: kindsOf[f]!,
      ...(f === "reversed" ? { listed: [b, a] } : {}),
      ...(f === "y-only" ? { shifted: [b, 0] } : {}),
    };
  });
}

function flaw3(r: Random): FlawEquation[] {
  // One equation missing x or y, one with its terms out of order, one aligned.
  const order = shuffle(r, [0, 1, 2]);
  const eqs: FlawEquation[] = [];
  for (const role of ["missing", "permuted", "aligned"] as const) {
    const row = [nz(r, 6), nz(r, 6), nz(r, 6)];
    const c = nz(r, 15);
    if (role === "missing") {
      const gone = r(0, 1);
      row[gone] = 0;
      const rest = row.filter((_, j) => j !== gone);
      eqs.push({
        tex: equationTex(row, c),
        row,
        c,
        kinds: ["zero"],
        shifted: [...rest, 0],
      });
    } else if (role === "permuted") {
      const perm = pick(r, [
        [2, 0, 1],
        [1, 2, 0],
        [2, 1, 0],
        [1, 0, 2],
      ] as const);
      const listed = perm.map((j) => row[j]!);
      eqs.push({
        tex: `${sideTex(perm.map((j) => ({ k: row[j]!, v: VARS[j]! })))}=${c}`,
        row,
        c,
        kinds: ["order"],
        listed,
      });
    } else eqs.push({ tex: equationTex(row, c), row, c, kinds: [] });
  }
  return order.map((i) => eqs[i]!);
}

/** Every pair (A, B) that the flaw kind can produce from this system. */
function flawResults(
  kind: FlawKind,
  eqs: FlawEquation[],
  A: Row[],
  B: number[],
): { A: Row[]; B: number[]; at: number }[] {
  const out: { A: Row[]; B: number[]; at: number }[] = [];
  const withRow = (i: number, row: Row) => A.map((x, k) => (k === i ? row : x));
  if (kind === "transposed") out.push({ A: transpose(A), B, at: -1 });
  if (kind === "augmented") out.push({ A: augmented(A, B), B, at: -1 });
  eqs.forEach((e, i) => {
    if (!e.kinds.includes(kind)) return;
    if (kind === "moved-sign")
      out.push({ A: withRow(i, [e.row[0]!, -e.row[1]!]), B, at: i });
    if (kind === "constant-sign")
      out.push({ A, B: B.map((b, k) => (k === i ? -b : b)), at: i });
    if (kind === "order") out.push({ A: withRow(i, e.listed!), B, at: i });
    if (kind === "zero") out.push({ A: withRow(i, e.shifted!), B, at: i });
  });
  return out;
}

function findFlaw(r: Random): ReadingCase {
  const size = r(0, 1) ? 3 : 2;
  const eqs = size === 2 ? flaw2(r) : flaw3(r);
  const A = eqs.map((e) => e.row);
  const B = eqs.map((e) => e.c);
  const applicable = flawKinds.filter(
    (k) => flawResults(k, eqs, A, B).length > 0,
  );
  if (applicable.length < 4) throw new Error("Need three retry: too few flaws");
  const kind = pick(r, applicable);
  const results = flawResults(kind, eqs, A, B);
  const student = pick(r, results);
  const others = shuffle(
    r,
    applicable.filter((k) => k !== kind),
  ).slice(0, 3);
  const equal = (x: { A: Row[]; B: number[] }) =>
    x.A.length === student.A.length &&
    sameMatrix(x.A, student.A) &&
    same(x.B, student.B);
  if (equal({ A, B })) throw new Error("Need three retry: no change");
  for (const k of [kind, ...others])
    if (k !== kind && flawResults(k, eqs, A, B).some(equal))
      throw new Error("Need three retry: two flaws fit");
  const n = size;
  const where =
    student.at >= 0
      ? ` in equation ${student.at + 1}, $${eqs[student.at]!.tex}$`
      : "";
  const correctMatrices = `$A=${bmatrix(A)}$ and $B=${column(B)}$`;
  const rewrites = eqs.map((e, i) => {
    const missing = e.row.flatMap((k, j) => (k === 0 ? [VARS[j]!] : []));
    const zero = missing.length
      ? ` It has no $${missing[0]}$, so the coefficient of $${missing[0]}$ is 0.`
      : "";
    return e.tex === equationTex(e.row, e.c)
      ? `Equation ${i + 1}, $${e.tex}$, already has the unknowns in order on the left.${zero}`
      : `Equation ${i + 1}, $${e.tex}$, becomes $${equationTex(e.row, e.c)}$.${zero}`;
  });
  const hintEq = eqs.find((e) => e.tex !== equationTex(e.row, e.c)) ?? eqs[0]!;
  return {
    id: `find-flaw-${kind}`,
    prompt: `A student wrote the system $${`\\begin{cases}${eqs.map((e) => e.tex).join("\\\\")}\\end{cases}`}$ as $AX=B$ with $X=${xColumn(n)}$, using $A=${bmatrix(student.A)}$ and $B=${column(student.B)}$. The student's matrix equation is wrong. What did the student do?`,
    hint: `Rewrite each equation with ${n === 3 ? "$x$, $y$, $z$" : "$x$, $y$"} in order on the left and the number on the right; for example, rewrite $${hintEq.tex}$. Then compare the student's $A$ and $B$ with yours entry by entry.`,
    explanation: [
      `Write each equation with the unknowns in the order of $X$ on the left and the constant on the right. A term changes sign when it crosses the equals sign, and a missing unknown has coefficient 0.`,
      ...rewrites,
      `So the correct matrices are ${correctMatrices}.`,
      `The student's work differs${where}: ${flawShort[kind]}. ${flawStatement[kind]}`,
    ],
    options: [
      { label: flawStatement[kind], correct: true },
      ...others.map((k) => ({
        label: flawStatement[k],
        feedback: `That does not match the student's work. The correct matrices are ${correctMatrices}; the student's differ because ${flawShort[kind]}${where}.`,
      })),
    ],
  };
}

/* ---------------------------------------------- substitute a vector */

function substitute(r: Random): ReadingCase {
  const A = [
    [nz(r, 9), nz(r, 9)],
    [nz(r, 9), nz(r, 9)],
  ];
  if (det2(A) === 0) throw new Error("Need three retry: singular");
  const sol = [r(-5, 5), r(-5, 5)];
  const B = product(A, sol);
  const solves = r(0, 1) === 1;
  let X = sol;
  if (!solves) {
    const move = r(0, 2);
    if (move === 2) {
      if (sol[0] === sol[1])
        throw new Error("Need three retry: swap is the same");
      X = [sol[1]!, sol[0]!];
    } else {
      X = [...sol];
      X[move] = X[move]! + pick(r, [-2, -1, 1, 2]);
    }
  }
  const P = product(A, X);
  const yes = same(P, B);
  if (yes !== solves) throw new Error("Unique solution drifted");
  const [[a, b], [c, d]] = A as [[number, number], [number, number]];
  const [p, q] = X as [number, number];
  const say = (v: number[], verdict: boolean) =>
    `$AX=${column(v)}$, so this $X$ ${verdict ? "is" : "is not"} a solution.`;
  const verdictOf = (v: number[]) => same(v, B);
  const entrywise = [a * p, d * q];
  const oneEach = [(a + b) * p, (c + d) * q];
  const byColumns = [a * p + c * q, b * p + d * q];
  const wrongVerdict = yes
    ? "Every entry of $AX$ matches $B$, so this $X$ is a solution."
    : "$AX$ and $B$ differ in at least one entry, so this $X$ is not a solution.";
  return {
    id: yes ? "substitute-solution" : "substitute-near-miss",
    prompt: `The system with $A=${bmatrix(A)}$ and $B=${column(B)}$ is $AX=B$ with $X=${xColumn(2)}$. Substitute $X=${column(X)}$: multiply out $AX$ and decide whether this $X$ is a solution.`,
    hint: `Row 1 of $A$ times the column $X$ is $${times(a, p)}+${times(b, q)}$. Work out row 2 the same way, then compare each entry with $B$.`,
    explanation: [
      "Each entry of $AX$ is a row of $A$ times the column $X$: multiply entry by entry and add.",
      `Row 1: $${times(a, p)}+${times(b, q)}=${P[0]}$. Row 2: $${times(c, p)}+${times(d, q)}=${P[1]}$. So $AX=${column(P)}$.`,
      yes
        ? `$B=${column(B)}$, and both entries match, so $X=${column(X)}$ is a solution: substituting it for the vector variable $X$ makes $AX=B$ true.`
        : `$B=${column(B)}$, and ${P[0] !== B[0] && P[1] !== B[1] ? "neither entry matches" : `the ${P[0] !== B[0] ? "first" : "second"} entries differ`}, so $X=${column(X)}$ is not a solution. A solution must make every entry match.`,
    ],
    options: [
      { label: say(P, yes), correct: true },
      {
        label: say(entrywise, verdictOf(entrywise)),
        feedback: `This multiplies only the diagonal entries: $${times(a, p)}$ and $${times(d, q)}$. Each entry of $AX$ uses a whole row: $${times(a, p)}+${times(b, q)}$ for the first.`,
      },
      {
        label: say(oneEach, verdictOf(oneEach)),
        feedback:
          "This multiplies each row by only one entry of $X$. Each row of $A$ meets the whole column $X$: the first entry times $x$'s value plus the second times $y$'s value.",
      },
      {
        label: say(P, !yes),
        feedback: `$AX$ is right, but the conclusion is not. ${wrongVerdict}`,
      },
      {
        label: say(byColumns, verdictOf(byColumns)),
        feedback:
          "This multiplies the columns of $A$ by $X$ instead of the rows. Each entry of $AX$ is a row of $A$ times $X$.",
      },
    ],
  };
}

const readingFamily = chainFamily({
  template: matrixEquationSystemTemplates[1]!,
  axes: { variant: readingAxis },
  model: (r, a): ReadingCase =>
    a.variant === "which-system"
      ? whichSystem(r)
      : a.variant === "one-row"
        ? oneRow(r)
        : a.variant === "find-flaw"
          ? findFlaw(r)
          : substitute(r),
  render: (m, _a, r) =>
    choiceSurface(r, {
      prompt: m.prompt,
      hint: m.hint,
      explanation: m.explanation,
      options: m.options,
    }),
  variant: (m) => m.id,
});

export const matrixEquationSystemCase = {
  entry: entryFamily.generate,
  reading: readingFamily.generate,
};

export const matrixEquationSystemGenerate = dispatch(
  matrixEquationSystemTemplates,
  {
    "system-to-matrix-equation": (seed: string): GeneratedProblem =>
      entryFamily.generate(seed).problem,
    "matrix-equation-reading": (seed: string): GeneratedProblem =>
      readingFamily.generate(seed).problem,
  },
);
