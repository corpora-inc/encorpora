import { z } from "zod";
import {
  MAX_EXPRESSION_LENGTH,
  compactLine,
  evaluate,
  flipOp,
  groupedProducts,
  ExpressionError,
  lineTex,
  lineText,
  nodeText,
  parseLine,
  polyConstant,
  productFactors,
  qEq,
  qInv,
  qMul,
  qParse,
  qText,
  rfConstant,
  rfDiv,
  rfEq,
  rfIsZero,
  rfMul,
  rfRatio,
  rfSub,
  rfVariables,
  solvedFor,
  termCount,
  type Line,
  type Node,
  type ParseOptions,
  type Q,
  type RF,
  type Relation,
  type RelationOp,
} from "./expression.js";

/** The structured-work protocol (`structured-work-v1`).
 *
 * Written work ("show your work", "justify", "prove") as an ordered list of
 * steps the server can grade exactly. Each step (row) has one or two fields:
 *
 * - `number`: an exact integer, decimal or fraction;
 * - `expression`: an expression, equation or inequality, typed and graded
 *   by exact symbolic algebra (expression.ts);
 * - `choice`: an option from a bank shared by the rows (a reason such as
 *   "Vertical angles are congruent", or a proof statement).
 *
 * Three modes scaffold the same work: `build` (every field is entered; an
 * `open` list lets the learner add rows), `fill` (some fields are given) and
 * `order` (every row is given, shuffled; the learner orders them).
 *
 * Grading is per row and server-side. The rule is private (`WorkGrading`):
 * fixed expected fields, a derivation whose every step must be a valid move
 * of the chosen kind (any valid path is accepted), or a proof whose every
 * line must be justified by its reason from lines above it. Credit needs
 * every row. Nothing in the public response reveals an expected value. */

export const MAX_WORK_ROWS = 6;
export const MAX_WORK_RESPONSE_LENGTH = 200;
export const NUMBER_FIELD_LENGTH = 16;
const ROW_ID = /^r[1-9]$/;
const BANK_ID = /^[a-z]{1,10}$/;
const OPTION_ID = /^[a-z0-9]{1,2}$/;
const VARIABLE = /^[a-zA-Z]$/;

export type WorkFieldKind = "number" | "expression" | "choice";
export interface WorkField {
  kind: WorkFieldKind;
  /** Names the field for screen readers and as its column or caption. */
  label: string;
  /** Choice only: the bank its options come from. */
  bank?: string;
  /** Shown, not entered: a number, an expression or an option id. */
  given?: string;
  /** Expression only: the letters it may use. */
  variables?: string[];
  /** Expression only: =, <, >, ≤ and ≥ are allowed (and required). */
  relations?: boolean;
  /** Expression only: the relation is an inequality (a keypad shows <, >,
   * ≤ and ≥ rather than =). Display only; grading reads the rule. */
  inequality?: boolean;
  /** Expression only: parts may be joined by "or". */
  compound?: boolean;
  /** Expression only: ^ powers are allowed. */
  powers?: boolean;
  /** Number only: the unit written after the entry, e.g. "dollars". */
  unit?: string;
  /** Number or expression: the longest entry, at most 32 characters. */
  maxLength?: number;
}
export interface WorkRow {
  id: string;
  /** What the row finds or states, e.g. "Cost of 4 boxes". */
  label?: string;
  fields: WorkField[];
}
export interface WorkBankOption {
  id: string;
  label: string;
}
export interface WorkBank {
  id: string;
  label: string;
  options: WorkBankOption[];
}
export interface StructuredWorkResponse {
  kind: "structured-work";
  label: string;
  /** `steps`: a list of steps; `proof`: a two-column statement/reason table. */
  layout: "steps" | "proof";
  mode: "build" | "fill" | "order";
  /** The given first line, in TeX ($…$), e.g. the equation to solve. */
  start?: string;
  /** Proof only: what the last line must state, in TeX. */
  goal?: string;
  banks: WorkBank[];
  rows: WorkRow[];
  /** Build only: rows[0] is the shape of every row; the learner adds rows,
   * from one up to `max`. */
  open?: { max: number };
}

/* ------------------------------------------------------------ schema */

const fieldSchema = z
  .object({
    kind: z.enum(["number", "expression", "choice"]),
    label: z.string().trim().min(1).max(60),
    bank: z.string().regex(BANK_ID).optional(),
    given: z.string().min(1).max(80).optional(),
    variables: z.array(z.string().regex(VARIABLE)).max(4).optional(),
    relations: z.boolean().optional(),
    inequality: z.boolean().optional(),
    compound: z.boolean().optional(),
    powers: z.boolean().optional(),
    unit: z.string().trim().min(1).max(24).optional(),
    maxLength: z.number().int().min(1).max(MAX_EXPRESSION_LENGTH).optional(),
  })
  .strict()
  .refine(
    (f) =>
      f.kind === "choice"
        ? f.bank !== undefined &&
          f.variables === undefined &&
          f.relations === undefined &&
          f.inequality === undefined &&
          f.compound === undefined &&
          f.powers === undefined &&
          f.unit === undefined &&
          f.maxLength === undefined
        : f.bank === undefined &&
          (f.kind === "expression"
            ? f.unit === undefined
            : f.variables === undefined &&
              f.relations === undefined &&
              f.inequality === undefined &&
              f.compound === undefined &&
              f.powers === undefined) &&
          (!f.inequality || !!f.relations),
    "Each field kind carries only its own settings",
  );
const optionSchema = z
  .object({
    id: z.string().regex(OPTION_ID),
    label: z.string().trim().min(1).max(160),
  })
  .strict();
const bankSchema = z
  .object({
    id: z.string().regex(BANK_ID),
    label: z.string().trim().min(1).max(60),
    options: z.array(optionSchema).min(2).max(12),
  })
  .strict()
  .refine(
    (b) =>
      new Set(b.options.map((o) => o.id)).size === b.options.length &&
      new Set(b.options.map((o) => o.label)).size === b.options.length,
    "A bank's options need unique identifiers and labels",
  );
const rowSchema = z
  .object({
    id: z.string().regex(ROW_ID),
    label: z.string().trim().min(1).max(160).optional(),
    fields: z.array(fieldSchema).min(1).max(2),
  })
  .strict();
export const structuredWorkResponseSchema = z
  .object({
    kind: z.literal("structured-work"),
    label: z.string().trim().min(1).max(200),
    layout: z.enum(["steps", "proof"]),
    mode: z.enum(["build", "fill", "order"]),
    start: z.string().trim().min(1).max(200).optional(),
    goal: z.string().trim().min(1).max(300).optional(),
    banks: z.array(bankSchema).max(3),
    rows: z.array(rowSchema).min(1).max(MAX_WORK_ROWS),
    open: z
      .object({ max: z.number().int().min(2).max(MAX_WORK_ROWS) })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    const problem = structuralProblem(r as StructuredWorkResponse);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

/** Expression parse options of a field. */
export const fieldParseOptions = (f: WorkField): ParseOptions => ({
  variables: f.variables ?? [],
  relations: !!f.relations,
  requireRelation: !!f.relations,
  compound: !!f.compound,
  powers: !!f.powers,
});
/** The longest raw entry a field accepts. */
export const fieldMaxLength = (f: WorkField) =>
  f.kind === "choice"
    ? 2
    : (f.maxLength ??
      (f.kind === "number" ? NUMBER_FIELD_LENGTH : MAX_EXPRESSION_LENGTH));
/** Row count a response can hold. */
const rowCapacity = (r: StructuredWorkResponse) =>
  r.open ? r.open.max : r.rows.length;
/** The longest transport form: every learner field at its longest. */
export function responseBudget(r: StructuredWorkResponse): number {
  if (r.mode === "order") return 2 + r.rows.length * 5;
  const row = (fields: WorkField[]) =>
    2 +
    fields.reduce(
      (s, f, i) => s + 2 + (f.given ? 0 : fieldMaxLength(f)) + (i ? 1 : 0),
      0,
    );
  const rows = r.open
    ? Array(r.open.max).fill(row(r.rows[0]!.fields))
    : r.rows.map((x) => row(x.fields));
  return 2 + rows.reduce((s, n) => s + n, 0) + Math.max(0, rows.length - 1);
}
/** The first structural rule a response breaks, or null. */
export function structuralProblem(r: StructuredWorkResponse): string | null {
  const ids = r.rows.map((x) => x.id);
  if (new Set(ids).size !== ids.length) return "Row ids repeat";
  const banks = new Map(r.banks.map((b) => [b.id, b]));
  if (banks.size !== r.banks.length) return "Bank ids repeat";
  if ((r.layout === "proof") !== (r.goal !== undefined))
    return "A proof, and only a proof, states its goal";
  let given = 0,
    entered = 0;
  for (const row of r.rows)
    for (const f of row.fields) {
      if (f.kind === "choice") {
        const bank = banks.get(f.bank!);
        if (!bank) return "A choice names an unknown bank";
        if (
          f.given !== undefined &&
          !bank.options.some((o) => o.id === f.given)
        )
          return "A given choice names an unknown option";
      } else if (f.given !== undefined) {
        if (f.kind === "number" && !qParse(f.given))
          return "A given number must be exact";
        if (
          f.kind === "expression" &&
          !parseLine(f.given, fieldParseOptions(f)).ok
        )
          return "A given expression must parse";
      }
      if (f.given !== undefined) given++;
      else entered++;
    }
  if (r.layout === "proof" && !r.rows.every((row) => row.fields.length === 2))
    return "Each proof line has a statement and a reason";
  if (r.mode === "order") {
    if (entered || r.open) return "An ordering gives every row";
    if (r.rows.length < 3) return "An ordering needs three rows or more";
  } else if (r.mode === "fill") {
    if (!given || !entered || r.open)
      return "A fill-in gives some fields and asks for others";
  } else if (given) return "A build gives no fields";
  if (r.open && r.rows.length !== 1) return "An open list has one row shape";
  if (responseBudget(r) > MAX_WORK_RESPONSE_LENGTH)
    return "The longest response would not fit";
  return null;
}

/* ------------------------------------------------------------ drafts */

/** Row values as entered: one string per field ("" when given or empty). */
export type WorkDraft = string[][];
/** Draft rows, or for an ordering the row ids in the learner's order. Any
 * other shape is invalid, never silently repaired. */
export function parseWorkDraft(raw: string): WorkDraft | string[] | null {
  if (typeof raw !== "string" || raw.length > MAX_WORK_RESPONSE_LENGTH)
    return null;
  if (raw === "") return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > MAX_WORK_ROWS) return null;
    if (value.every((v) => typeof v === "string"))
      return value.every((v) => ROW_ID.test(v)) ? (value as string[]) : null;
    if (
      value.every(
        (row) =>
          Array.isArray(row) &&
          row.length >= 1 &&
          row.length <= 2 &&
          row.every((v) => typeof v === "string" && v.length <= 40),
      )
    )
      return value as WorkDraft;
    return null;
  } catch {
    return null;
  }
}
/** The editable rows of a draft, shaped to the response: fixed rows keep
 * their count, an open list keeps at least one row. */
export function draftRows(r: StructuredWorkResponse, raw: string): WorkDraft {
  const parsed = r.mode === "order" ? null : parseWorkDraft(raw);
  const rows =
    parsed && parsed.every((x) => Array.isArray(x))
      ? (parsed as WorkDraft)
      : [];
  const shape = (i: number) => (r.open ? r.rows[0]! : r.rows[i]!);
  const count = r.open
    ? Math.min(r.open.max, Math.max(1, rows.length))
    : r.rows.length;
  return Array.from({ length: count }, (_, i) =>
    shape(i).fields.map((f, j) => (f.given ? "" : (rows[i]?.[j] ?? ""))),
  );
}
export const serializeDraft = (rows: WorkDraft) => JSON.stringify(rows);
/** The learner's order (an ordering), defaulting to the shown order. */
export function draftOrder(r: StructuredWorkResponse, raw: string): string[] {
  const parsed = parseWorkDraft(raw);
  const ids = r.rows.map((x) => x.id);
  if (
    parsed &&
    parsed.length === ids.length &&
    parsed.every((v) => typeof v === "string") &&
    new Set(parsed as string[]).size === ids.length &&
    (parsed as string[]).every((id) => ids.includes(id))
  )
    return parsed as string[];
  return ids;
}
/** The shape of row i (an open list repeats its one row). */
export const rowShape = (r: StructuredWorkResponse, i: number): WorkRow =>
  r.open ? { ...r.rows[0]!, id: `r${i + 1}` } : r.rows[i]!;

/** One field's entry, checked: the canonical transport text, or an error
 * written for the learner. Empty entries are "missing", not errors. */
export function checkEntry(
  r: StructuredWorkResponse,
  f: WorkField,
  raw: string,
): { ok: true; value: string } | { ok: false; error: string; missing?: true } {
  if (f.given !== undefined)
    return raw === ""
      ? { ok: true, value: "" }
      : { ok: false, error: "This part is given" };
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { ok: false, error: "Not answered yet", missing: true };
  if (raw.length > fieldMaxLength(f))
    return { ok: false, error: "That entry is too long" };
  if (f.kind === "choice") {
    const bank = r.banks.find((b) => b.id === f.bank);
    return bank?.options.some((o) => o.id === text)
      ? { ok: true, value: text }
      : { ok: false, error: "Choose one of the listed options" };
  }
  if (f.kind === "number") {
    // "22 1/2" is not 221/2: a space inside a number is never removed.
    if (/[\d.]\s+[\d./]/.test(text))
      return {
        ok: false,
        error: "Write one number without spaces; use a fraction such as 45/2",
      };
    const value = text.replace(/[−–]/g, "-").replace(/\s+/g, "");
    return qParse(value)
      ? { ok: true, value }
      : {
          ok: false,
          error: "Enter a number, decimal or fraction such as 3/4",
        };
  }
  const parsed = parseLine(text, fieldParseOptions(f));
  return parsed.ok
    ? { ok: true, value: compactLine(text, !!f.compound) }
    : { ok: false, error: parsed.error };
}
/** How many learner fields hold a complete, valid entry, of how many. */
export function workProgress(
  r: StructuredWorkResponse,
  raw: string,
): { done: number; total: number } {
  if (r.mode === "order") return { done: r.rows.length, total: r.rows.length };
  const rows = draftRows(r, raw);
  let done = 0,
    total = 0;
  rows.forEach((row, i) =>
    rowShape(r, i).fields.forEach((f, j) => {
      if (f.given !== undefined) return;
      total++;
      if (checkEntry(r, f, row[j] ?? "").ok) done++;
    }),
  );
  return { done, total };
}

/** Only a complete response naming valid entries for every learner field
 * (or a full ordering) can be submitted; it is returned in canonical form. */
export function normalizeStructuredWork(
  r: StructuredWorkResponse,
  raw: string,
): string | null {
  const parsed = parseWorkDraft(raw);
  if (!parsed) return null;
  if (r.mode === "order") {
    const ids = r.rows.map((x) => x.id);
    if (
      parsed.length !== ids.length ||
      !parsed.every((v) => typeof v === "string") ||
      new Set(parsed as string[]).size !== ids.length ||
      !(parsed as string[]).every((id) => ids.includes(id))
    )
      return null;
    return JSON.stringify(parsed);
  }
  if (!parsed.every((row) => Array.isArray(row))) return null;
  const rows = parsed as WorkDraft;
  if (
    r.open
      ? rows.length < 1 || rows.length > r.open.max
      : rows.length !== r.rows.length
  )
    return null;
  const out: WorkDraft = [];
  for (let i = 0; i < rows.length; i++) {
    const shape = rowShape(r, i);
    if (rows[i]!.length !== shape.fields.length) return null;
    const values: string[] = [];
    for (let j = 0; j < shape.fields.length; j++) {
      const checked = checkEntry(r, shape.fields[j]!, rows[i]![j]!);
      if (!checked.ok) return null;
      values.push(checked.value);
    }
    out.push(values);
  }
  const text = JSON.stringify(out);
  return text.length <= MAX_WORK_RESPONSE_LENGTH ? text : null;
}
/* ------------------------------------------------------------ grading */

/** A fixed expected field. */
export type FieldRule =
  /** `fraction`: the entry must be written as a fraction a/b. */
  | { kind: "number"; value: string; fraction?: boolean }
  /** `identity`: the same expression. `sides`: the same relation, side by
   * side (either side first, with the sign read from that side). */
  | {
      kind: "expression";
      value: string;
      match: "identity" | "sides";
      /** The entry must be a sum of single terms (no parentheses or
       * products), so an unexpanded product is not credited as a step. */
      expanded?: boolean;
    }
  | { kind: "choice"; accept: string[] };
/** How a reason transforms one line into the next. */
export type Move =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "distribute"
  | "combine"
  | "factor"
  | "zero-product"
  | "symmetric"
  | "commute";
export type WorkGrading =
  /** Every learner field equals its expected value (rows in shown order). */
  | { mode: "fields"; fields: (FieldRule | null)[][] }
  /** Rows are [line, reason]. Every line follows from the one before it
   * (the start first) by its reason's move; the last line is solved for
   * `variable` with exactly the solutions given. */
  | {
      mode: "derivation";
      variable: string;
      /** The start line in input syntax (the public `start` is TeX). */
      start: string;
      /** Reason option id → its move. Other options justify nothing. */
      moves: Record<string, Move>;
      /** Equations: the exact solutions, e.g. ["-2","3"]. Inequalities: one
       * boundary with its sign, e.g. ["x>=4"]. Formulas: the solved
       * expression, e.g. ["2A/b"]. */
      solution: string[];
      /** Formulas: letters that stand for positive measurements, so
       * multiplying or dividing by them is allowed. */
      positive?: string[];
      /** The parse options of every line. */
      line: ParseOptions;
    }
  /** Rows are [statement, reason]. Each line's reason is valid for its
   * statement when one of its prerequisite sets is stated on lines above it;
   * no statement repeats and the last line states `goal`. */
  | {
      mode: "proof";
      goal: string;
      claims: Record<string, Record<string, string[][]>>;
    };

export interface WorkMarks {
  correct: boolean;
  /** One per displayed row (for an ordering, per position). */
  rows: boolean[];
  /** Short notes for wrong rows, in row order; empty when all correct. */
  notes: string[];
}

const linesOf = (draft: WorkDraft, r: StructuredWorkResponse) =>
  draft.map((row, i) => ({
    shape: rowShape(r, i),
    values: rowShape(r, i).fields.map((f, j) => f.given ?? row[j] ?? ""),
  }));

/** Rows of an ordering in the learner's order, as complete value rows. */
function orderedRows(r: StructuredWorkResponse, order: string[]) {
  return order.map((id) => {
    const row = r.rows.find((x) => x.id === id)!;
    return { shape: row, values: row.fields.map((f) => f.given!) };
  });
}

const noun = (r: StructuredWorkResponse) =>
  r.layout === "proof" ? "Line" : "Step";

/** Grade a complete response. Invalid responses are never graded. */
export function markStructuredWork(
  r: StructuredWorkResponse,
  grading: WorkGrading,
  raw: string,
): WorkMarks {
  const canonical = normalizeStructuredWork(r, raw);
  if (canonical === null) throw new Error("Grade only a valid response");
  const parsed = JSON.parse(canonical) as WorkDraft | string[];
  const rows =
    r.mode === "order"
      ? orderedRows(r, parsed as string[])
      : linesOf(parsed as WorkDraft, r);
  const learner = rows.map((row) =>
    row.shape.fields.some((f) => f.given === undefined),
  );
  if (grading.mode === "fields") return markFields(r, grading, rows);
  if (grading.mode === "proof") return markProof(r, grading, rows);
  return markDerivation(r, grading, rows, learner);
}
export function gradeStructuredWork(
  r: StructuredWorkResponse,
  grading: WorkGrading,
  raw: string,
): boolean {
  return (
    normalizeStructuredWork(r, raw) !== null &&
    markStructuredWork(r, grading, raw).correct
  );
}

type ValueRow = { shape: WorkRow; values: string[] };

function markFields(
  r: StructuredWorkResponse,
  grading: Extract<WorkGrading, { mode: "fields" }>,
  rows: ValueRow[],
): WorkMarks {
  const marks = rows.map((row, i) =>
    row.shape.fields.every((f, j) => {
      const rule = grading.fields[i]?.[j];
      if (f.given !== undefined) return true;
      if (!rule) return false;
      return fieldMatches(f, rule, row.values[j]!);
    }),
  );
  const notes = marks.flatMap((ok, i) =>
    ok
      ? []
      : [
          `${noun(r)} ${i + 1}: check ${rows[i]!.shape.label ? `“${lowerFirst(rows[i]!.shape.label!)}”` : "this value"}.`,
        ],
  );
  return { correct: marks.every(Boolean), rows: marks, notes };
}
const lowerFirst = (s: string) =>
  /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;

const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** A sum of single terms, each a number, a letter with a power or both, with
 * every power used once: standard form with nothing left to multiply out. */
export function isExpandedSum(value: string): boolean {
  const s = value
    .replace(/\s+/g, "")
    .replace(
      /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,
      (m) => `^${[...m].map((c) => SUPERSCRIPT_DIGITS.indexOf(c)).join("")}`,
    );
  const terms = s.split(/(?=[+\-−])/);
  const powers = new Set<string>();
  for (const t of terms) {
    const m = /^[+\-−]?(\d+(?:\.\d+)?)?(?:([a-z])(?:\^(\d+))?)?$/.exec(t);
    if (!m || (m[1] === undefined && m[2] === undefined)) return false;
    const key = m[2] ? `${m[2]}${m[3] ?? "1"}` : "1";
    if (powers.has(key)) return false;
    powers.add(key);
  }
  return true;
}
/** One field against its rule. */
export function fieldMatches(
  f: WorkField,
  rule: FieldRule,
  value: string,
): boolean {
  if (rule.kind === "choice")
    return f.kind === "choice" && rule.accept.includes(value);
  if (rule.kind === "number") {
    const a = qParse(value),
      b = qParse(rule.value);
    if (rule.fraction && !/^-?\d+\/\d+$/.test(value)) return false;
    return f.kind === "number" && !!a && !!b && qEq(a, b);
  }
  if (f.kind !== "expression") return false;
  if (rule.expanded && !isExpandedSum(value)) return false;
  const options = fieldParseOptions(f);
  const got = parseLine(value, options),
    want = parseLine(rule.value, options);
  if (!got.ok || !want.ok) return false;
  if (got.line.parts.length !== want.line.parts.length) return false;
  return bounded(false, () =>
    got.line.parts.every((p, i) => {
      const w = want.line.parts[i]!;
      if (rule.match === "identity" || !w.op)
        return !p.op && !w.op && rfEq(evaluate(p.left), evaluate(w.left));
      return sameRelation(p, w);
    }),
  );
}
/** The same relation side by side, in either order. */
function sameRelation(a: Relation, b: Relation): boolean {
  if (!a.op || !b.op || !a.right || !b.right) return false;
  const [al, ar, bl, br] = [a.left, a.right, b.left, b.right].map(evaluate) as [
    RF,
    RF,
    RF,
    RF,
  ];
  return (
    (a.op === b.op && rfEq(al, bl) && rfEq(ar, br)) ||
    (a.op === flipOp(b.op) && rfEq(al, br) && rfEq(ar, bl))
  );
}

/* ------------------------------------------------------- derivations */

const sideRF = (rel: Relation) => ({
  L: evaluate(rel.left),
  R: rel.right ? evaluate(rel.right) : null,
});
/** The sign of a nonzero rational function's leading coefficient, for naming
 * "add" versus "subtract": +1, −1, or 0 when it has mixed-sign terms. */
function moveSign(t: RF): 1 | -1 | 0 {
  const d = polyConstant(t.den);
  if (!d) return 0;
  const signs = new Set([...t.num.values()].map((v) => v.n > 0n === d.n > 0n));
  return signs.size === 1 ? (signs.has(true) ? 1 : -1) : 0;
}
/** Multiplication versus division by a constant k = p/q. */
function scaleNames(k: Q): { multiply: boolean; divide: boolean } {
  const p = k.n < 0n ? -k.n : k.n;
  return {
    multiply: k.d === 1n || p !== 1n,
    divide: p === 1n || k.d !== 1n,
  };
}
/** A factor allowed in a "multiply" or "divide" step: a nonzero constant, or
 * (formulas) a constant times a product of positive measurement letters. */
function scaleFactor(
  k: RF,
  positive: readonly string[],
): { k: RF; sign: 1 | -1; multiply: boolean; divide: boolean } | null {
  const c = rfConstant(k);
  if (c) {
    if (c.n === 0n || (c.n === 1n && c.d === 1n)) return null;
    return { k, sign: c.n > 0n ? 1 : -1, ...scaleNames(c) };
  }
  // A single monomial over a single monomial, in positive letters only.
  if (k.num.size !== 1 || k.den.size !== 1) return null;
  const [[nk, nc]] = [...k.num];
  const [[dk, dc]] = [...k.den];
  const net = new Map<string, number>();
  const tally = (key: string, sign: 1 | -1) => {
    for (const part of key ? key.split("*") : []) {
      const [v, e] = part.split("^");
      net.set(v!, (net.get(v!) ?? 0) + sign * Number(e));
    }
  };
  tally(nk!, 1);
  tally(dk!, -1);
  const up = [...net].filter(([, e]) => e > 0).map(([v]) => v),
    down = [...net].filter(([, e]) => e < 0).map(([v]) => v);
  if (![...up, ...down].every((v) => positive.includes(v))) return null;
  const coef = qMul(nc!, qInv(dc!));
  const names = scaleNames(coef);
  const constantIsOne = coef.n === coef.d;
  if (!up.length && !down.length && constantIsOne) return null;
  return {
    k,
    sign: coef.n > 0n ? 1 : -1,
    multiply: up.length > 0 || (!constantIsOne && names.multiply),
    divide: down.length > 0 || (!constantIsOne && names.divide),
  };
}

/** Whether `next` follows from `prev` by `move`; the reason it does not. */
export function checkMove(
  prev: Line,
  next: Line,
  move: Move,
  positive: readonly string[] = [],
): { ok: true } | { ok: false; why: "move" | "reason" } {
  const fail = (why: "move" | "reason") => ({ ok: false as const, why });
  if (move === "zero-product") {
    if (prev.parts.length !== 1 || next.parts.length < 2) return fail("reason");
    const p = prev.parts[0]!;
    if (p.op !== "=" || !p.right) return fail("reason");
    const zeroRight = rfIsZero(evaluate(p.right)),
      zeroLeft = rfIsZero(evaluate(p.left));
    const product = zeroRight ? p.left : zeroLeft ? p.right : null;
    const factors = product ? productFactors(product) : null;
    if (!factors) return fail("reason");
    if (factors.length !== next.parts.length) return fail("move");
    const remaining = factors.map(evaluate);
    for (const part of next.parts) {
      if (part.op !== "=" || !part.right) return fail("move");
      const side = rfIsZero(evaluate(part.right))
        ? evaluate(part.left)
        : rfIsZero(evaluate(part.left))
          ? evaluate(part.right)
          : null;
      if (!side) return fail("move");
      const at = remaining.findIndex((f) => {
        const k = rfRatio(side, f);
        return k !== null && k.n !== 0n;
      });
      if (at < 0) return fail("move");
      remaining.splice(at, 1);
    }
    return { ok: true };
  }
  if (prev.parts.length !== next.parts.length) return fail("move");
  // Each part changes by the same kind of move; unchanged parts may stay.
  let changed = 0;
  let reasonOnly = false;
  for (let i = 0; i < prev.parts.length; i++) {
    const a = prev.parts[i]!,
      b = next.parts[i]!;
    if (!a.op || !b.op || !a.right || !b.right) return fail("move");
    const A = sideRF(a),
      B = sideRF(b);
    const same =
      a.op === b.op &&
      rfEq(A.L, B.L) &&
      rfEq(A.R!, B.R!) &&
      lineText({ parts: [a] }) === lineText({ parts: [b] });
    if (same) continue;
    changed++;
    // Each part of "x − 2 = 0 or x + 3 = 0" may need its own sign: one
    // reason names adding or subtracting (or multiplying or dividing) for all.
    const family: Move[] =
      prev.parts.length > 1 && (move === "add" || move === "subtract")
        ? ["add", "subtract"]
        : prev.parts.length > 1 && (move === "multiply" || move === "divide")
          ? ["multiply", "divide"]
          : [move];
    const verdicts = family.map((m) => partMove(a, b, A, B, m, positive));
    const verdict = verdicts.includes("ok")
      ? "ok"
      : verdicts.includes("reason")
        ? "reason"
        : "move";
    if (verdict === "ok") continue;
    if (verdict === "reason") {
      reasonOnly = true;
      continue;
    }
    return fail("move");
  }
  if (!changed) return fail("move");
  return reasonOnly ? fail("reason") : { ok: true };
}
/** One part of a line: "ok" for a valid move of this kind, "reason" for a
 * valid move of another kind, "move" for a change no move explains. */
function partMove(
  a: Relation,
  b: Relation,
  A: { L: RF; R: RF | null },
  B: { L: RF; R: RF | null },
  move: Move,
  positive: readonly string[],
): "ok" | "reason" | "move" {
  const kinds = validMoves(a, b, A, B, positive);
  if (!kinds.size) return "move";
  return kinds.has(move) ? "ok" : "reason";
}
/** Every move that turns relation a into relation b. */
export function validMoves(
  a: Relation,
  b: Relation,
  A: { L: RF; R: RF | null },
  B: { L: RF; R: RF | null },
  positive: readonly string[] = [],
): Set<Move> {
  const out = new Set<Move>();
  if (!a.op || !b.op || !A.R || !B.R) return out;
  // Identity moves: both sides keep their values.
  if (a.op === b.op && rfEq(A.L, B.L) && rfEq(A.R, B.R)) {
    const gp = (r: Relation) =>
      groupedProducts(r.left) + groupedProducts(r.right!);
    const fewerGroups = gp(b) < gp(a);
    const sideFewerGroups =
      groupedProducts(b.left) < groupedProducts(a.left) ||
      groupedProducts(b.right!) < groupedProducts(a.right!);
    if (fewerGroups || sideFewerGroups) out.add("distribute");
    const becameProduct =
      (!!productFactors(b.left) && !productFactors(a.left)) ||
      (!!productFactors(b.right!) && !productFactors(a.right!));
    if (becameProduct || gp(b) > gp(a)) out.add("factor");
    const sameGroups =
      groupedProducts(b.left) === groupedProducts(a.left) &&
      groupedProducts(b.right!) === groupedProducts(a.right!);
    const changed = lineText({ parts: [a] }) !== lineText({ parts: [b] });
    // Combining like terms, or carrying out arithmetic (3x/3 to x, 15/3 to
    // 5): fewer terms, or a shorter line, with the groupings kept.
    if (
      sameGroups &&
      changed &&
      (termCount(b.left) < termCount(a.left) ||
        termCount(b.right!) < termCount(a.right!) ||
        compact(b) < compact(a))
    )
      out.add("combine");
    // Reordering: each side has the same terms (or factors), in another order.
    if (changed && samePieces(a.left, b.left) && samePieces(a.right!, b.right!))
      out.add("commute");
    return out;
  }
  // Symmetric: the sides trade places and the sign is read the other way.
  if (b.op === flipOp(a.op) && rfEq(A.L, B.R) && rfEq(A.R, B.L))
    out.add("symmetric");
  // Adding the same nonzero amount to both sides keeps the sign.
  if (a.op === b.op) {
    const t = rfSub(B.L, A.L);
    if (!rfIsZero(t) && rfEq(rfSub(B.R, A.R), t)) {
      const s = moveSign(t);
      if (s >= 0) out.add("add");
      if (s <= 0) out.add("subtract");
    }
  }
  // Multiplying both sides by the same factor; a negative factor reverses
  // an inequality.
  const k = rfIsZero(A.L)
    ? rfIsZero(A.R)
      ? null
      : rfDiv(B.R, A.R)
    : rfDiv(B.L, A.L);
  if (k) {
    const f = scaleFactor(k, positive);
    if (
      f &&
      rfEq(B.L, rfMul(A.L, k)) &&
      rfEq(B.R, rfMul(A.R, k)) &&
      b.op === (f.sign < 0 ? flipOp(a.op) : a.op)
    ) {
      if (f.multiply) out.add("multiply");
      if (f.divide) out.add("divide");
    }
  }
  return out;
}

const compact = (r: Relation) =>
  lineText({ parts: [r] }).replace(/\s+/g, "").length;
const bare = (n: Node): Node => (n.t === "group" ? bare(n.node) : n);
/** The terms of a sum (or factors of a product) as sorted texts. */
function pieces(n: Node): string[] {
  const u = bare(n);
  if (u.t === "add")
    return u.terms.map((t) => `${t.sign}${nodeText(bare(t.node))}`).sort();
  if (u.t === "mul") return u.factors.map((f) => nodeText(bare(f))).sort();
  return [nodeText(u)];
}
const samePieces = (a: Node, b: Node) =>
  JSON.stringify(pieces(a)) === JSON.stringify(pieces(b));
/** A single number written out: 5, −4, 3/4, −3/4, 2.5 (fractions in
 * lowest terms). */
function literal(n: Node): boolean {
  const u = bare(n);
  if (u.t === "num") return true;
  if (u.t === "add")
    return (
      u.terms.length === 1 &&
      u.terms[0]!.sign < 0 &&
      bare(u.terms[0]!.node).t !== "add" &&
      literal(u.terms[0]!.node)
    );
  // A fraction of whole numbers in lowest terms: 3/4, not 35/5 or 6/8.
  if (u.t === "div") {
    const n = bare(u.num),
      d = bare(u.den);
    if (n.t !== "num" || d.t !== "num") return false;
    const [a, b] = [n.value, d.value];
    if (a.d !== 1n || b.d !== 1n || b.n <= 1n) return false;
    let [x, y] = [a.n < 0n ? -a.n : a.n, b.n];
    while (y) [x, y] = [y, x % y];
    return x === 1n;
  }
  return false;
}

/** The line is solved for v: v alone on one side of every part, with a
 * value free of v. Returns each part's relation read as "v op value", and
 * whether every value is written as a single number. */
function solvedParts(
  line: Line,
  v: string,
): { op: RelationOp; value: RF; literal: boolean }[] | null {
  const out: { op: RelationOp; value: RF; literal: boolean }[] = [];
  for (const part of line.parts) {
    const s = solvedFor(part, v);
    if (!s || !part.op) return null;
    out.push({
      op: s.flipped ? flipOp(part.op) : part.op,
      value: evaluate(s.value),
      literal: literal(s.value),
    });
  }
  return out;
}
/** Run an exact comparison that may exceed the size guards; too large is
 * simply not a match (never a server error). */
function bounded<T>(fallback: T, run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof ExpressionError) return fallback;
    throw error;
  }
}
function matchesSolution(
  solved: { op: RelationOp; value: RF }[],
  grading: Extract<WorkGrading, { mode: "derivation" }>,
): boolean {
  const want = grading.solution.map((s) => {
    const m = /^([a-zA-Z])(<=|>=|<|>|=)(.+)$/.exec(s);
    const op = (m?.[2] ?? "=") as RelationOp;
    const text = m ? m[3]! : s;
    const parsed = parseLine(text, {
      ...grading.line,
      relations: false,
      requireRelation: false,
      compound: false,
    });
    if (!parsed.ok) throw new Error(`Bad solution ${s}`);
    return { op, value: evaluate(parsed.line.parts[0]!.left) };
  });
  if (want.length !== solved.length) return false;
  const left = [...want];
  for (const s of solved) {
    const at = left.findIndex((w) => w.op === s.op && rfEq(w.value, s.value));
    if (at < 0) return false;
    left.splice(at, 1);
  }
  return true;
}

function markDerivation(
  r: StructuredWorkResponse,
  grading: Extract<WorkGrading, { mode: "derivation" }>,
  rows: ValueRow[],
  learner: boolean[],
): WorkMarks {
  const start = parseLine(grading.start, grading.line);
  if (!start.ok) throw new Error("Derivation start does not parse");
  const lines = rows.map((row) => {
    const parsed = parseLine(row.values[0]!, grading.line);
    if (!parsed.ok) throw new Error("A checked line does not parse");
    return parsed.line;
  });
  const valid: boolean[] = [];
  const notes: string[] = [];
  const why: string[] = [];
  lines.forEach((line, i) => {
    const prev = i ? lines[i - 1]! : start.line;
    const move = grading.moves[rows[i]!.values[1]!];
    const step = move
      ? bounded({ ok: false, why: "move" } as const, () =>
          checkMove(prev, line, move, grading.positive),
        )
      : ({ ok: false, why: "reason" } as const);
    if (!step.ok) {
      valid.push(false);
      why.push(
        step.why === "reason" && move !== undefined
          ? "follows from the line before it, but not by the reason chosen"
          : step.why === "reason"
            ? "needs a reason that names the move it makes"
            : "does not follow from the line before it by one move",
      );
      return;
    }
    valid.push(true);
    why.push("");
  });
  // The last line must be solved, with exactly the solutions.
  const lastIndex = lines.length - 1;
  const solved = bounded(null, () =>
    solvedParts(lines[lastIndex]!, grading.variable),
  );
  // A numeric solution is written as one number, not 15/3 or 2 + 3.
  const numeric =
    !grading.positive &&
    !grading.line.variables.some((v) => v !== grading.variable);
  const simplified = !!solved && (!numeric || solved.every((p) => p.literal));
  const right =
    !!solved && bounded(false, () => matchesSolution(solved, grading));
  const finished = right && simplified;
  if (!finished && valid[lastIndex]) {
    valid[lastIndex] = false;
    why[lastIndex] = !solved
      ? `is not solved yet: end with ${grading.variable} alone on one side`
      : !right
        ? "is solved, but its solutions are not the equation’s"
        : "is solved; write each value as a single number";
  }
  // A given row that does not follow from the learner's row above it is the
  // learner row's error (fill-ins); given rows themselves are never marked.
  const marks = valid.map((ok, i) => ok);
  if (r.mode === "fill")
    for (let i = 0; i < marks.length; i++)
      if (!learner[i] && !marks[i]) {
        marks[i] = true;
        if (i > 0 && learner[i - 1]) {
          marks[i - 1] = false;
          if (!why[i - 1])
            why[i - 1] =
              `does not lead to the given ${noun(r).toLowerCase()} ${i + 1}`;
        }
      }
  marks.forEach((ok, i) => {
    if (!ok) notes.push(`${noun(r)} ${i + 1} ${why[i]}.`);
  });
  return {
    correct: valid.every(Boolean) && finished,
    rows: marks,
    notes,
  };
}

/* ------------------------------------------------------------ proofs */

function markProof(
  r: StructuredWorkResponse,
  grading: Extract<WorkGrading, { mode: "proof" }>,
  rows: ValueRow[],
): WorkMarks {
  const stated = new Set<string>();
  const marks: boolean[] = [];
  const notes: string[] = [];
  rows.forEach((row, i) => {
    const [statement, reason] = row.values as [string, string];
    const n = `${noun(r)} ${i + 1}`;
    if (stated.has(statement)) {
      marks.push(false);
      notes.push(`${n} repeats a statement made above it.`);
      return;
    }
    const reasons = grading.claims[statement];
    if (!reasons) {
      marks.push(false);
      notes.push(`${n} states something the givens do not establish.`);
    } else {
      const needs = reasons[reason];
      if (!needs) {
        marks.push(false);
        notes.push(`${n}: that reason does not justify this statement.`);
      } else if (!needs.some((set) => set.every((s) => stated.has(s)))) {
        marks.push(false);
        notes.push(`${n} uses a fact that is not stated on a line above it.`);
      } else marks.push(true);
    }
    stated.add(statement);
  });
  const last = rows.length - 1;
  if (rows[last]!.values[0] !== grading.goal && marks[last]) {
    marks[last] = false;
    notes.push(`${noun(r)} ${last + 1} must state what you are proving.`);
  }
  return { correct: marks.every(Boolean), rows: marks, notes };
}

/* ------------------------------------------------------------ output */

/** The first feedback lines: how many rows are right and what to recheck. */
export function structuredWorkFeedback(
  r: StructuredWorkResponse,
  grading: WorkGrading,
  raw: string,
): string[] {
  const m = markStructuredWork(r, grading, raw);
  if (m.correct) return [];
  const wrong = m.rows.flatMap((ok, i) => (ok ? [] : [i + 1]));
  const what = r.layout === "proof" ? "lines" : "steps";
  const list =
    wrong.length < 3
      ? wrong.join(" and ")
      : `${wrong.slice(0, -1).join(", ")} and ${wrong.at(-1)}`;
  const summary = wrong.length
    ? `${m.rows.length - wrong.length} of ${m.rows.length} ${what} are correct. Recheck ${what.slice(0, -1)}${wrong.length > 1 ? "s" : ""} ${list}.`
    : `Every ${what.slice(0, -1)} is valid, but the work is not finished.`;
  return [summary, ...m.notes.slice(0, 2)];
}

const optionLabel = (r: StructuredWorkResponse, f: WorkField, id: string) =>
  r.banks.find((b) => b.id === f.bank)?.options.find((o) => o.id === id)
    ?.label ?? id;
/** One field's value as readable, TeX-ready text ($…$ around math); a
 * dash when it is empty. */
export function fieldText(
  r: StructuredWorkResponse,
  f: WorkField,
  value: string,
): string {
  const v = f.given ?? value ?? "";
  if (!v) return "—";
  if (f.kind === "choice") return optionLabel(r, f, v);
  if (f.kind === "number")
    return `$${numberTex(v)}$${f.unit ? ` ${f.unit}` : ""}`;
  const parsed = parseLine(v, fieldParseOptions(f));
  return parsed.ok ? `$${lineTex(parsed.line)}$` : v;
}
/** One row as readable text, in TeX-ready form ($…$ around math). */
export function rowText(
  r: StructuredWorkResponse,
  shape: WorkRow,
  values: string[],
): string {
  const parts = shape.fields.map((f, j) => fieldText(r, f, values[j] ?? ""));
  if (r.layout === "proof") return `${parts[0]} (${parts[1]})`;
  const body = parts.join(" — ");
  return shape.label ? `${shape.label}: ${body}` : body;
}
/** The rows of a response (or the answer key) in order, as readable text. */
export function structuredWorkRows(
  r: StructuredWorkResponse,
  raw: string,
): string[] {
  const parsed = parseWorkDraft(raw);
  if (!parsed) return [];
  if (r.mode === "order")
    return orderedRows(r, draftOrder(r, raw)).map((row) =>
      rowText(r, row.shape, row.values),
    );
  return draftRows(r, raw).map((row, i) => rowText(r, rowShape(r, i), row));
}
/** A readable answer: the final line of a derivation or proof, or every
 * found value of a list of steps. Never the transport format. */
export function structuredWorkAnswerText(
  r: StructuredWorkResponse,
  raw: string,
): string {
  const rows = structuredWorkRows(r, raw);
  if (!rows.length) return "No work entered";
  if (r.layout === "proof" || r.start) return rows.at(-1)!;
  return rows.join("; ");
}

/* --------------------------------------------------------- guessing */

const permutations = <T>(items: T[]): T[][] =>
  items.length <= 1
    ? [items]
    : items.flatMap((x, i) =>
        permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(
          (rest) => [x, ...rest],
        ),
      );
/** Chance that blind choices earn credit, never understated. Typed entries
 * cannot be guessed, so any entered number or expression makes it 0. An
 * ordering counts its valid orders exactly. A proof built from banks is
 * bounded above: distinct justified statements, each with any of its
 * justifying reasons, over every way to fill the blanks. */
export function structuredWorkGuessChance(
  r: StructuredWorkResponse,
  grading: WorkGrading,
): number {
  if (r.mode === "order") {
    const all = permutations(r.rows.map((x) => x.id));
    const good = all.filter(
      (order) => markStructuredWork(r, grading, JSON.stringify(order)).correct,
    ).length;
    return good / all.length;
  }
  const shapes = r.open ? [r.rows[0]!] : r.rows;
  if (
    r.open ||
    shapes.some((row) =>
      row.fields.some((f) => f.given === undefined && f.kind !== "choice"),
    )
  )
    return 0;
  const size = (f: WorkField) =>
    r.banks.find((b) => b.id === f.bank)!.options.length;
  if (grading.mode === "fields")
    // Independent fields: each blank's accepted options over its bank.
    return shapes.reduce(
      (p, row, i) =>
        row.fields.reduce((q, f, j) => {
          const rule = grading.fields[i]?.[j];
          return f.given !== undefined || rule?.kind !== "choice"
            ? q
            : (q * rule.accept.length) / size(f);
        }, p),
      1,
    );
  if (grading.mode !== "proof") return 0;
  const reasonsFor = (statement: string) =>
    Object.keys(grading.claims[statement] ?? {}).length;
  const claimable = Object.keys(grading.claims);
  const mostReasons = Math.max(1, ...claimable.map(reasonsFor));
  let unused = claimable.length;
  let chance = 1;
  for (const row of shapes) {
    const [statement, reason] = row.fields as [WorkField, WorkField];
    if (statement.given === undefined) {
      // A blank statement must be a justified one not used above.
      chance *= Math.max(0, unused) / size(statement);
      if (reason.given === undefined) chance *= mostReasons / size(reason);
    } else if (reason.given === undefined)
      chance *= reasonsFor(statement.given) / size(reason);
    unused--;
  }
  return Math.min(1, chance);
}

/** Display text of a number entry for TeX: a fraction typesets as one. */
export function numberTex(value: string): string {
  const q = qParse(value);
  if (!q) return value;
  if (q.d === 1n || !value.includes("/")) return value;
  const neg = q.n < 0n;
  return `${neg ? "-" : ""}\\frac{${neg ? -q.n : q.n}}{${q.d}}`;
}
export const qValueText = (value: string) => {
  const q = qParse(value);
  return q ? qText(q) : value;
};

const ruleSchema = z.union([
  z
    .object({
      kind: z.literal("number"),
      value: z.string().min(1).max(40),
      fraction: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("expression"),
      value: z
        .string()
        .min(1)
        .max(MAX_EXPRESSION_LENGTH * 2),
      match: z.enum(["identity", "sides"]),
      expanded: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("choice"),
      accept: z.array(z.string().regex(OPTION_ID)).min(1).max(12),
    })
    .strict(),
]);
const moveSchema = z.enum([
  "add",
  "subtract",
  "multiply",
  "divide",
  "distribute",
  "combine",
  "factor",
  "zero-product",
  "symmetric",
  "commute",
]);
const parseOptionsSchema = z
  .object({
    variables: z.array(z.string().regex(VARIABLE)).max(4),
    relations: z.boolean().optional(),
    requireRelation: z.boolean().optional(),
    compound: z.boolean().optional(),
    powers: z.boolean().optional(),
  })
  .strict();
/** The private grading rule of a structured-work response. */
export const workGradingSchema: z.ZodType<WorkGrading> = z.union([
  z
    .object({
      mode: z.literal("fields"),
      fields: z
        .array(z.array(ruleSchema.nullable()).min(1).max(2))
        .min(1)
        .max(MAX_WORK_ROWS),
    })
    .strict(),
  z
    .object({
      mode: z.literal("derivation"),
      variable: z.string().regex(VARIABLE),
      start: z
        .string()
        .min(1)
        .max(MAX_EXPRESSION_LENGTH * 2),
      moves: z.record(z.string().regex(OPTION_ID), moveSchema),
      solution: z.array(z.string().min(1).max(40)).min(1).max(4),
      positive: z.array(z.string().regex(VARIABLE)).max(4).optional(),
      line: parseOptionsSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal("proof"),
      goal: z.string().regex(OPTION_ID),
      claims: z.record(
        z.string().regex(OPTION_ID),
        z.record(
          z.string().regex(OPTION_ID),
          z
            .array(z.array(z.string().regex(OPTION_ID)).max(6))
            .min(1)
            .max(6),
        ),
      ),
    })
    .strict(),
]);
/** The grading rule fits the response: fixed fields cover every learner
 * field, a derivation's rows are [line, reason], a proof's goal and claims
 * name statement and reason options of the response's banks. */
export function gradingFits(
  r: StructuredWorkResponse,
  g: WorkGrading,
): boolean {
  const shapes = r.open ? [r.rows[0]!] : r.rows;
  if (g.mode === "fields")
    return (
      !r.open &&
      r.layout === "steps" &&
      g.fields.length === r.rows.length &&
      r.rows.every((row, i) =>
        row.fields.every((f, j) => {
          const rule = g.fields[i]?.[j];
          if (f.given !== undefined) return rule === null || rule === undefined;
          return !!rule && rule.kind === f.kind;
        }),
      )
    );
  if (g.mode === "derivation")
    return (
      r.layout === "steps" &&
      !!r.start &&
      parseLine(g.start, g.line).ok &&
      shapes.every(
        (row) =>
          row.fields.length === 2 &&
          row.fields[0]!.kind === "expression" &&
          row.fields[1]!.kind === "choice",
      )
    );
  const statements = r.banks.find((b) => b.id === r.rows[0]!.fields[0]!.bank);
  const reasons = r.banks.find((b) => b.id === r.rows[0]!.fields[1]!.bank);
  const has = (bank: WorkBank | undefined, id: string) =>
    !!bank?.options.some((o) => o.id === id);
  return (
    r.layout === "proof" &&
    r.rows.every(
      (row) =>
        row.fields[0]!.kind === "choice" &&
        row.fields[0]!.bank === statements?.id &&
        row.fields[1]!.kind === "choice" &&
        row.fields[1]!.bank === reasons?.id,
    ) &&
    has(statements, g.goal) &&
    Object.entries(g.claims).every(
      ([s, rs]) =>
        has(statements, s) &&
        Object.entries(rs).every(
          ([reason, sets]) =>
            has(reasons, reason) &&
            sets.every((set) => set.every((x) => has(statements, x))),
        ),
    )
  );
}
