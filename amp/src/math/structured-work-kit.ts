import { shuffle } from "./distribution-practice";
import { lineTex, parseLine, type ParseOptions } from "./expression";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  structuralProblem,
  type FieldRule,
  type Move,
  type StructuredWorkResponse,
  type WorkBank,
  type WorkField,
  type WorkGrading,
  type WorkRow,
} from "./structured-work";
import { defineAxis, type Random } from "./variation/axes";
import type { Surface } from "./variation/compose";

/**
 * Builders shared by the structured-work families. A family computes one
 * exact model (the givens and a worked path through them) and renders it in
 * one of three modes; these builders turn that path into the public
 * response, the private rule and the answer key, and refuse any key the
 * rule would not credit.
 */

/** Build every field, fill in some, or order given steps. */
export const workModeAxis = defineAxis(
  "mode",
  ["build", "fill", "order"] as const,
  { legacy: "build", weights: [3, 2, 1] },
);
/** Families whose rows are independent values: no ordering. */
export const workModeAxisNoOrder = defineAxis(
  "mode",
  ["build", "fill"] as const,
  { legacy: "build", weights: [3, 2] },
);
export type WorkMode = "build" | "fill" | "order";

/** TeX of a line in input syntax, e.g. "3(x+2)=18" → "3\left(x+2\right)=18". */
export function tex(line: string, options: ParseOptions): string {
  const parsed = parseLine(line, options);
  if (!parsed.ok)
    throw new Error(`Line does not parse: ${line} (${parsed.error})`);
  return lineTex(parsed.line)
    .replace(/\\left\(/g, "(")
    .replace(/\\right\)/g, ")");
}

function finish(
  response: StructuredWorkResponse,
  grading: WorkGrading,
  answer: string,
): {
  response: StructuredWorkResponse;
  workGrading: WorkGrading;
  answer: string;
} {
  const problem = structuralProblem(response);
  if (problem) throw new Error(problem);
  if (!gradingFits(response, grading)) throw new Error("Rule does not fit");
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error(`Answer key is not canonical: ${answer}`);
  if (!gradeStructuredWork(response, grading, answer))
    throw new Error(`Answer key is not credited: ${answer}`);
  return { response, workGrading: grading, answer };
}

/* -------------------------------------------------------- derivations */

export interface DerivationModel {
  /** The equation, inequality or formula to start from, in input syntax. */
  start: string;
  variable: string;
  line: ParseOptions;
  /** The reason bank: every option and the move it names (null: none). */
  reasons: { id: string; label: string; move: Move | null }[];
  /** One valid path: each line and its reason's id. */
  path: [line: string, reason: string][];
  solution: string[];
  positive?: string[];
  /** Longest entry of a line. */
  maxLength?: number;
  /** The lines are inequalities (keypad display only). */
  inequality?: boolean;
}
/** Fill-in patterns: name every reason, or work alternate lines. */
export type DerivationFill = "reasons" | "alternate";

export function derivationWork(
  m: DerivationModel,
  mode: WorkMode,
  fill: DerivationFill,
  r: Random,
  label: string,
) {
  const bank: WorkBank = {
    id: "reasons",
    label: "Reason",
    options: m.reasons.map(({ id, label }) => ({ id, label })),
  };
  const moves = Object.fromEntries(
    m.reasons.flatMap((x) => (x.move ? [[x.id, x.move] as const] : [])),
  );
  const lineField = (given?: string): WorkField => ({
    kind: "expression",
    label: "Line",
    variables: [...m.line.variables],
    relations: true,
    ...(m.inequality ? { inequality: true } : {}),
    ...(m.line.compound ? { compound: true } : {}),
    ...(m.line.powers ? { powers: true } : {}),
    maxLength: m.maxLength ?? 24,
    ...(given !== undefined ? { given } : {}),
  });
  const reasonField = (given?: string): WorkField => ({
    kind: "choice",
    label: "Reason",
    bank: "reasons",
    ...(given !== undefined ? { given } : {}),
  });
  const grading: WorkGrading = {
    mode: "derivation",
    variable: m.variable,
    start: m.start,
    moves,
    solution: m.solution,
    ...(m.positive ? { positive: m.positive } : {}),
    line: m.line,
  };
  const startTex = `$${tex(m.start, m.line)}$`;
  const n = m.path.length;
  if (mode === "build") {
    const response: StructuredWorkResponse = {
      kind: "structured-work",
      label,
      layout: "steps",
      mode,
      start: startTex,
      banks: [bank],
      rows: [{ id: "r1", fields: [lineField(), reasonField()] }],
      open: { max: Math.min(5, Math.max(2, n + 1)) },
    };
    return finish(response, grading, JSON.stringify(m.path));
  }
  if (mode === "fill") {
    // "alternate": counting back from the last line, every other row is
    // given; the last line is always the learner's.
    const givenRow = (i: number) =>
      fill === "alternate" && (n - 1 - i) % 2 === 1;
    const rows: WorkRow[] = m.path.map(([line, reason], i) => ({
      id: `r${i + 1}`,
      fields:
        fill === "reasons"
          ? [lineField(line), reasonField()]
          : givenRow(i)
            ? [lineField(line), reasonField(reason)]
            : [lineField(), reasonField()],
    }));
    const answer = JSON.stringify(
      m.path.map(([line, reason], i) =>
        fill === "reasons"
          ? ["", reason]
          : givenRow(i)
            ? ["", ""]
            : [line, reason],
      ),
    );
    return finish(
      {
        kind: "structured-work",
        label,
        layout: "steps",
        mode,
        start: startTex,
        banks: [bank],
        rows,
      },
      grading,
      answer,
    );
  }
  // Order: every row given, shown shuffled; the key is the worked order.
  const rows: WorkRow[] = m.path.map(([line, reason], i) => ({
    id: `r${i + 1}`,
    fields: [lineField(line), reasonField(reason)],
  }));
  const orderResponse = (shown: WorkRow[]): StructuredWorkResponse => ({
    kind: "structured-work",
    label,
    layout: "steps",
    mode,
    start: startTex,
    banks: [bank],
    rows: shown,
  });
  const { shown, key } = shuffledRows(r, rows, (shown) =>
    gradeStructuredWork(
      orderResponse(shown),
      grading,
      JSON.stringify(shown.map((x) => x.id)),
    ),
  );
  return finish(
    {
      kind: "structured-work",
      label,
      layout: "steps",
      mode,
      start: startTex,
      banks: [bank],
      rows: shown,
    },
    grading,
    key,
  );
}

/** Rows shown out of order, renumbered r1, r2, … in the order shown so
 * their ids say nothing about the answer; the key is the worked order. */
function shuffledRows(
  r: Random,
  rows: WorkRow[],
  /** True when the rows as shown (display ids in shown order) already
   * earn credit: some given lines may be swapped, so the shown order must
   * be no valid order at all, not only different from the key. */
  creditedAsShown: (shown: WorkRow[]) => boolean,
): { shown: WorkRow[]; key: string } {
  const renumber = (order: WorkRow[]) => {
    const display = new Map(order.map((x, j) => [x.id, `r${j + 1}`]));
    return {
      shown: order.map((x) => ({ ...x, id: display.get(x.id)! })),
      key: JSON.stringify(rows.map((x) => display.get(x.id)!)),
    };
  };
  for (let i = 0; i < 60; i++) {
    const out = renumber(shuffle(r, [...rows]));
    if (!creditedAsShown(out.shown)) return out;
  }
  throw new Error("Need three retry: no unsolved order to show");
}

/* ------------------------------------------------------------- proofs */

export interface ProofModel {
  statements: { id: string; label: string }[];
  reasons: { id: string; label: string }[];
  /** statement → reason → alternative prerequisite sets. */
  claims: Record<string, Record<string, string[][]>>;
  goal: string;
  goalTex: string;
  /** One valid proof: [statement, reason] per line. */
  path: [statement: string, reason: string][];
}

export function proofWork(
  m: ProofModel,
  mode: WorkMode,
  r: Random,
  label: string,
) {
  const banks: WorkBank[] = [
    { id: "statements", label: "Statement", options: m.statements },
    { id: "reasons", label: "Reason", options: m.reasons },
  ];
  const field = (
    bank: "statements" | "reasons",
    given?: string,
  ): WorkField => ({
    kind: "choice",
    label: bank === "statements" ? "Statement" : "Reason",
    bank,
    ...(given !== undefined ? { given } : {}),
  });
  const grading: WorkGrading = {
    mode: "proof",
    goal: m.goal,
    claims: m.claims,
  };
  const base = {
    kind: "structured-work" as const,
    label,
    layout: "proof" as const,
    goal: m.goalTex,
    banks,
  };
  const rows = (make: (s: string, reason: string, i: number) => WorkField[]) =>
    m.path.map(([s, reason], i) => ({
      id: `r${i + 1}`,
      fields: make(s, reason, i),
    }));
  if (mode === "build")
    return finish(
      {
        ...base,
        mode,
        rows: rows(() => [field("statements"), field("reasons")]),
      },
      grading,
      JSON.stringify(m.path),
    );
  if (mode === "fill") {
    // Statements are given; about half the reasons, never all and never
    // none, are the learner's. Given statements keep every line's support
    // fixed, so one wrong reason never breaks another line.
    const n = m.path.length;
    const blank = new Set<number>();
    const want = Math.max(2, Math.ceil(n / 2));
    const order = shuffle(r, [...Array(n).keys()]);
    for (const i of order) if (blank.size < want) blank.add(i);
    return finish(
      {
        ...base,
        mode,
        rows: rows((s, reason, i) => [
          field("statements", s),
          blank.has(i) ? field("reasons") : field("reasons", reason),
        ]),
      },
      grading,
      JSON.stringify(
        m.path.map(([, reason], i) => ["", blank.has(i) ? reason : ""]),
      ),
    );
  }
  const given = rows((s, reason) => [
    field("statements", s),
    field("reasons", reason),
  ]);
  const { shown, key } = shuffledRows(r, given, (shown) =>
    gradeStructuredWork(
      { ...base, mode, rows: shown },
      grading,
      JSON.stringify(shown.map((x) => x.id)),
    ),
  );
  return finish({ ...base, mode, rows: shown }, grading, key);
}

/* ------------------------------------------------------------- fields */

export interface FieldStep {
  label: string;
  kind: "number" | "expression";
  /** Expected value in input syntax. */
  value: string;
  /** Number: require a fraction a/b. Expression: "identity" or "sides". */
  fraction?: boolean;
  match?: "identity" | "sides";
  unit?: string;
  variables?: string[];
  relations?: boolean;
  inequality?: boolean;
  maxLength?: number;
}

export function fieldsWork(
  steps: FieldStep[],
  mode: "build" | "fill",
  r: Random,
  label: string,
) {
  const n = steps.length;
  // Fill-ins give one or two early steps and keep the last ones blank.
  const given = new Set<number>();
  if (mode === "fill") {
    const count = n >= 5 ? 2 : 1;
    const pool = shuffle(r, [...Array(Math.max(1, n - 2)).keys()]);
    for (const i of pool.slice(0, count)) given.add(i);
  }
  const fieldOf = (s: FieldStep, i: number): WorkField =>
    s.kind === "number"
      ? {
          kind: "number",
          label: "Number",
          ...(s.unit ? { unit: s.unit } : {}),
          ...(s.maxLength ? { maxLength: s.maxLength } : {}),
          ...(given.has(i) ? { given: s.value } : {}),
        }
      : {
          kind: "expression",
          label: s.relations ? "Inequality or equation" : "Expression",
          variables: s.variables ?? [],
          ...(s.relations ? { relations: true } : {}),
          ...(s.inequality ? { inequality: true } : {}),
          maxLength: s.maxLength ?? 24,
          ...(given.has(i) ? { given: s.value } : {}),
        };
  const rule = (s: FieldStep): FieldRule =>
    s.kind === "number"
      ? {
          kind: "number",
          value: s.value,
          ...(s.fraction ? { fraction: true } : {}),
        }
      : { kind: "expression", value: s.value, match: s.match ?? "identity" };
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label,
    layout: "steps",
    mode,
    banks: [],
    rows: steps.map((s, i) => ({
      id: `r${i + 1}`,
      label: s.label,
      fields: [fieldOf(s, i)],
    })),
  };
  const grading: WorkGrading = {
    mode: "fields",
    fields: steps.map((s, i) => [given.has(i) ? null : rule(s)]),
  };
  return finish(
    response,
    grading,
    JSON.stringify(steps.map((s, i) => [given.has(i) ? "" : s.value])),
  );
}

/** Surface parts every structured family shares. */
export function workSurface(
  built: ReturnType<typeof fieldsWork>,
  s: { prompt: string; hint: string; explanation: string[] } & Partial<Surface>,
): Surface {
  return {
    ...s,
    response: built.response,
    answer: built.answer,
    workGrading: built.workGrading,
  };
}
