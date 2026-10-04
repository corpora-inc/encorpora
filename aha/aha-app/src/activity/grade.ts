/**
 * Deterministic local grading of Activity Spec v1 responses. Pure: same spec + response →
 * same result. The model never grades; it only authors a key the validator has checked.
 */
import type { ActivitySpec, ResponseOf } from './spec';
import { gcd } from './spec';
import { closeEnough, evaluate, ExprError, monomialSignatures, parseExpr, samplePoints } from './expr';

export type LearnerResponse =
  | { type: 'numeric'; value: string }
  | { type: 'fraction'; whole?: string; numerator: string; denominator: string }
  | { type: 'expression'; value: string }
  | { type: 'multiple_choice'; choice: number }
  | { type: 'multi_select'; choices: number[] }
  | { type: 'ordering'; order: number[] }
  | { type: 'plot_point'; x: number; y: number }
  | { type: 'tap_region'; region: string };

export interface GradeOutcome {
  correct: boolean;
  /** Canonical rendering of what the learner submitted (for evidence + model feedback). */
  normalized: string;
  misconceptionTag?: string;
  /** Set when the input could not be read. Not a mathematical error: ask again, record nothing. */
  invalid?: string;
}

const invalid = (message: string, normalized = ''): GradeOutcome => ({ correct: false, normalized, invalid: message });
const MAX_INPUT = 120;

/** Parse a typed number: integers, decimals, thousands commas, a/b, mixed "1 1/2", unicode minus. */
export function parseNumberInput(raw: string, unit?: string): number | null {
  if (typeof raw !== 'string' || raw.length > MAX_INPUT) return null;
  let s = raw.trim().replace(/[−–]/g, '-').replace(/ /g, ' ');
  if (unit) {
    const u = unit.trim().toLowerCase();
    if (u && s.toLowerCase().endsWith(u)) s = s.slice(0, s.length - u.length).trim();
  }
  s = s.replace(/^\$\s*/, '').replace(/\s*%$/, '');
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  let m = /^([-+])?(\d+(?:\.\d*)?|\.\d+)$/.exec(s);
  if (m) return Number(`${m[1] ?? ''}${m[2]}`);
  m = /^([-+])?(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) { const d = Number(m[3]); return d === 0 ? null : (m[1] === '-' ? -1 : 1) * Number(m[2]) / d; }
  m = /^([-+])?(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) { const d = Number(m[4]); return d === 0 ? null : (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3]) / d); }
  return null;
}

const formatNumber = (n: number) => String(+n.toPrecision(12));

function gradeNumeric(r: ResponseOf<'numeric'>, response: LearnerResponse): GradeOutcome {
  if (response.type !== 'numeric') return invalid('Expected a number.');
  const value = parseNumberInput(response.value, r.unit);
  if (value === null) return invalid('Type a number, like 12, 3.5 or 3/4.');
  const tol = (r.tolerance ?? 0) + 1e-9 * Math.max(1, Math.abs(r.answer));
  const normalized = formatNumber(value);
  if (Math.abs(value - r.answer) <= tol) return { correct: true, normalized };
  const miss = (r.misconceptionAnswers ?? []).find(m => Math.abs(value - m.answer) <= tol);
  return { correct: false, normalized, ...(miss ? { misconceptionTag: miss.tag } : {}) };
}

const intField = (s: string | undefined) => {
  if (s === undefined || s.trim() === '') return undefined;
  const t = s.trim().replace(/[−–]/g, '-');
  return /^-?\d{1,7}$/.test(t) ? Number(t) : null;
};

function gradeFraction(r: ResponseOf<'fraction'>, response: LearnerResponse): GradeOutcome {
  if (response.type !== 'fraction') return invalid('Expected a fraction.');
  const whole = intField(response.whole), n = intField(response.numerator), d = intField(response.denominator);
  if (n === null || d === null || whole === null || n === undefined || d === undefined) return invalid('Fill in the top and bottom numbers.');
  if (d <= 0) return invalid('The bottom number must be greater than zero.');
  if (whole !== undefined && n < 0) return invalid('Use a minus sign on the whole number only.');
  const sign = whole !== undefined && (whole < 0 || Object.is(whole, -0)) ? -1 : 1;
  const improperN = whole === undefined ? n : sign * (Math.abs(whole) * d + n);
  const normalized = whole !== undefined && whole !== 0 ? `${whole} ${n}/${d}` : `${improperN}/${d}`;
  const equal = improperN * r.denominator === r.numerator * d;
  let correct = equal;
  if (equal && r.form === 'simplest') {
    const fractionalPart = whole !== undefined ? n : improperN;
    const properWhenMixed = whole === undefined || n < d;
    correct = gcd(fractionalPart, d) === 1 && properWhenMixed;
  }
  if (equal && r.form === 'exact') correct = improperN === r.numerator && d === r.denominator;
  if (correct) return { correct, normalized };
  if (equal) return { correct: false, normalized, misconceptionTag: r.form === 'simplest' ? 'not_simplified' : 'different_form' };
  const miss = (r.misconceptionAnswers ?? []).find(m => improperN * m.denominator === m.numerator * d);
  return { correct: false, normalized, ...(miss ? { misconceptionTag: miss.tag } : {}) };
}

/**
 * Expression equivalence by sampling at seeded random real points inside the domain. Points
 * where the key is undefined are skipped; points where only the learner's is undefined count as
 * a mismatch (so x^2/x ≠ x is NOT flagged — they agree wherever both are defined — but sqrt(x^2)
 * vs x on a domain including negatives is caught).
 */
export function expressionsEquivalent(key: string, learner: string, variables: readonly string[], domain: readonly [number, number], seed: string): boolean {
  const a = parseExpr(key, variables), b = parseExpr(learner, variables);
  let compared = 0;
  for (const point of samplePoints(variables, domain, 40, seed)) {
    const va = evaluate(a, point);
    if (!Number.isFinite(va)) continue;
    const vb = evaluate(b, point);
    if (!Number.isFinite(vb) || !closeEnough(va, vb, 1e-7)) return false;
    compared++;
  }
  return compared >= 8;
}

function gradeExpression(spec: ActivitySpec, r: ResponseOf<'expression'>, response: LearnerResponse): GradeOutcome {
  if (response.type !== 'expression') return invalid('Expected an expression.');
  const text = response.value.trim();
  if (!text) return invalid('Type an expression.');
  if (text.length > MAX_INPUT) return invalid('That expression is too long.');
  let tree;
  try { tree = parseExpr(text, r.variables); } catch (e) { return invalid(e instanceof ExprError ? e.message : 'Check the expression.', text); }
  const normalized = text.replace(/\s+/g, '');
  const domain: [number, number] = [r.domain?.min ?? -10, r.domain?.max ?? 10];
  if (!expressionsEquivalent(r.answer, text, r.variables, domain, spec.id)) return { correct: false, normalized };
  if (r.form === 'expanded' || r.form === 'simplified') {
    const signatures = monomialSignatures(tree);
    if (!signatures) return { correct: false, normalized, misconceptionTag: 'not_expanded' };
    if (r.form === 'simplified' && new Set(signatures).size !== signatures.length) return { correct: false, normalized, misconceptionTag: 'not_simplified' };
  }
  return { correct: true, normalized };
}

function validIndices(values: unknown, length: number): values is number[] {
  return Array.isArray(values) && values.every(v => Number.isInteger(v) && v >= 0 && v < length);
}

export function gradeActivity(spec: ActivitySpec, response: LearnerResponse): GradeOutcome {
  const r = spec.response;
  if (!response || response.type !== r.type) return invalid('This answer does not match the question.');
  switch (r.type) {
    case 'numeric': return gradeNumeric(r, response);
    case 'fraction': return gradeFraction(r, response);
    case 'expression': return gradeExpression(spec, r, response);
    case 'multiple_choice': {
      if (response.type !== 'multiple_choice' || !validIndices([response.choice], r.options.length)) return invalid('Choose one option.');
      const option = r.options[response.choice]!;
      return { correct: option.correct, normalized: `option:${response.choice}`, ...(option.misconception ? { misconceptionTag: option.misconception } : {}) };
    }
    case 'multi_select': {
      if (response.type !== 'multi_select' || !validIndices(response.choices, r.options.length)) return invalid('Choose your options.');
      const chosen = [...new Set(response.choices)].sort((a, b) => a - b);
      if (!chosen.length) return invalid('Choose at least one option.');
      const correct = r.options.every((o, i) => o.correct === chosen.includes(i));
      const tag = correct ? undefined : chosen.map(i => r.options[i]!).find(o => !o.correct && o.misconception)?.misconception;
      return { correct, normalized: `options:${chosen.join(',')}`, ...(tag ? { misconceptionTag: tag } : {}) };
    }
    case 'ordering': {
      if (response.type !== 'ordering' || !validIndices(response.order, r.items.length) || new Set(response.order).size !== r.items.length) return invalid('Place every item once.');
      return { correct: response.order.every((v, i) => v === i), normalized: `order:${response.order.join(',')}` };
    }
    case 'plot_point': {
      if (response.type !== 'plot_point' || !Number.isFinite(response.x) || !Number.isFinite(response.y)) return invalid('Tap the plane to place a point.');
      const tol = (r.tolerance ?? 0) + 1e-9;
      return { correct: Math.abs(response.x - r.x) <= tol && Math.abs(response.y - r.y) <= tol, normalized: `(${formatNumber(response.x)}, ${formatNumber(response.y)})` };
    }
    case 'tap_region': {
      if (response.type !== 'tap_region' || typeof response.region !== 'string' || response.region.length > 48) return invalid('Tap one part of the picture.');
      const tag = (r.regionMisconceptions ?? []).find(m => m.region === response.region)?.tag;
      return { correct: response.region === r.region, normalized: `region:${response.region}`, ...(response.region !== r.region && tag ? { misconceptionTag: tag } : {}) };
    }
  }
}

/** The correct response, for "show me" flows, tests and the gallery. */
export function correctResponse(spec: ActivitySpec): LearnerResponse {
  const r = spec.response;
  switch (r.type) {
    case 'numeric': return { type: 'numeric', value: formatNumber(r.answer) };
    case 'fraction': return { type: 'fraction', numerator: String(r.numerator), denominator: String(r.denominator) };
    case 'expression': return { type: 'expression', value: r.answer };
    case 'multiple_choice': return { type: 'multiple_choice', choice: r.options.findIndex(o => o.correct) };
    case 'multi_select': return { type: 'multi_select', choices: r.options.flatMap((o, i) => o.correct ? [i] : []) };
    case 'ordering': return { type: 'ordering', order: r.items.map((_, i) => i) };
    case 'plot_point': return { type: 'plot_point', x: r.x, y: r.y };
    case 'tap_region': return { type: 'tap_region', region: r.region };
  }
}
