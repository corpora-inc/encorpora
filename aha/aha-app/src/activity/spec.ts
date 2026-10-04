/**
 * Activity Spec v1 — the contract between a live LLM author and the ¡AHA! renderer/grader.
 *
 * One zod definition yields (1) the TypeScript types, (2) a strict runtime validator and
 * (3) a JSON Schema for LLM structured output. Every object is strict (unknown keys are
 * rejected), every string/array is length-bounded, every number is finite and bounded.
 * Cross-field rules (figure references, exactly-one-correct, answer-key checks, safe TeX,
 * safe expressions) run in a semantic pass after the structural parse.
 *
 * AI output is untrusted data: nothing here is ever executed, linked, or injected as HTML.
 */
import * as z from 'zod';
import { checkPlainText, checkRichText, checkTex } from './text';
import { closeEnough, evaluate, evaluateConstant, ExprError, parseExpr, samplePoints, variablesUsed } from './expr';

export const ACTIVITY_SPEC_VERSION = 1 as const;

/** Curated, bundled pictograph icons. The model names an icon; it never supplies SVG or URLs. */
export const ICON_NAMES = [
  'apple', 'banana', 'cherry', 'grape', 'carrot', 'cookie', 'cake', 'pizza', 'ice_cream', 'egg', 'candy', 'sandwich',
  'fish', 'bird', 'cat', 'dog', 'rabbit', 'turtle', 'snail', 'bug', 'squirrel', 'paw',
  'star', 'heart', 'flower', 'leaf', 'tree', 'sprout', 'sun', 'moon', 'cloud', 'snowflake', 'shell', 'feather', 'clover',
  'car', 'bus', 'bike', 'boat', 'rocket', 'train', 'plane',
  'pencil', 'book', 'gift', 'crown', 'gem', 'trophy', 'puzzle', 'block', 'music', 'dice',
] as const;
export type IconName = typeof ICON_NAMES[number];
export const COLOR_TOKENS = ['teal', 'coral', 'blue', 'gold', 'plain'] as const;
export type ColorToken = typeof COLOR_TOKENS[number];

// ---------- primitives ----------
const refineWith = (check: (s: string) => string | null) => (value: string, ctx: z.RefinementCtx) => {
  const problem = check(value);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
};
const rich = (max: number) => z.string().min(1).max(max).superRefine(refineWith(checkRichText));
const plain = (max: number) => z.string().min(1).max(max).superRefine(refineWith(checkPlainText));
const tex = () => z.string().min(1).max(300).superRefine(refineWith(checkTex));
const exprText = (max: number) => z.string().min(1).max(max);
const num = (min = -1e6, max = 1e6) => z.number().min(min).max(max);
const int = (min: number, max: number) => z.number().int().min(min).max(max);
const id = () => z.string().regex(/^[a-z0-9][a-z0-9_-]{0,47}$/, 'Use a short lowercase ASCII id (a-z, 0-9, _ or -).');
const tag = () => z.string().regex(/^[a-z][a-z0-9_]{0,47}$/, 'Use a snake_case misconception tag.');
const color = () => z.enum(COLOR_TOKENS);
const icon = () => z.enum(ICON_NAMES);
const COORD = 1000;
const point = () => z.strictObject({ x: num(-COORD, COORD), y: num(-COORD, COORD) });
const axis = () => z.strictObject({ min: num(-COORD, COORD), max: num(-COORD, COORD), step: num(0.001, 1000).optional() });
const figureBase = { id: id(), alt: plain(400), caption: rich(160).optional() };

// ---------- figures ----------
const BarChart = z.strictObject({
  type: z.literal('bar_chart'), ...figureBase,
  title: plain(80).optional(), xLabel: plain(40).optional(), yLabel: plain(40).optional(),
  orientation: z.enum(['vertical', 'horizontal']).optional(),
  bars: z.array(z.strictObject({ label: plain(24), value: num(0, 1e6), id: id().optional() })).min(1).max(12),
  yMax: num(0.001, 1e6).optional(), yStep: num(0.001, 1e6).optional(), showValues: z.boolean().optional(),
});
const LineChart = z.strictObject({
  type: z.literal('line_chart'), ...figureBase,
  title: plain(80).optional(), xLabel: plain(40).optional(), yLabel: plain(40).optional(),
  x: axis().optional(), y: axis().optional(),
  series: z.array(z.strictObject({ name: plain(24), points: z.array(point()).min(2).max(24) })).min(1).max(3),
  xTickLabels: z.array(z.strictObject({ x: num(-COORD, COORD), label: plain(12) })).max(24).optional(),
});
const ScatterPlot = z.strictObject({
  type: z.literal('scatter_plot'), ...figureBase,
  title: plain(80).optional(), xLabel: plain(40).optional(), yLabel: plain(40).optional(),
  x: axis().optional(), y: axis().optional(),
  points: z.array(point()).min(1).max(60),
  trendLine: z.strictObject({ slope: num(-1000, 1000), intercept: num(-COORD, COORD) }).optional(),
});
const PieChart = z.strictObject({
  type: z.literal('pie_chart'), ...figureBase, title: plain(80).optional(),
  slices: z.array(z.strictObject({ label: plain(24), value: num(0.001, 1e6), id: id().optional() })).min(2).max(8),
  show: z.enum(['labels', 'values', 'percents']).optional(),
});
const DataTable = z.strictObject({
  type: z.literal('data_table'), ...figureBase, title: plain(80).optional(),
  columns: z.array(rich(48)).min(1).max(6),
  rows: z.array(z.array(rich(48)).min(1).max(6)).min(1).max(12),
});
const CoordinatePlane = z.strictObject({
  type: z.literal('coordinate_plane'), ...figureBase,
  x: axis(), y: axis(), xLabel: plain(16).optional(), yLabel: plain(16).optional(),
  points: z.array(z.strictObject({ x: num(-COORD, COORD), y: num(-COORD, COORD), label: plain(16).optional(), id: id().optional(), open: z.boolean().optional() })).max(20).optional(),
  segments: z.array(z.strictObject({ from: point(), to: point(), dashed: z.boolean().optional() })).max(20).optional(),
  functions: z.array(z.strictObject({
    expr: exprText(80).describe('Function of x using + - * / ^ ( ) and sqrt abs; e.g. "2x+1" or "x^2/4-3".'),
    label: plain(24).optional(), from: num(-COORD, COORD).optional(), to: num(-COORD, COORD).optional(),
    shade: z.enum(['above', 'below']).optional(), dashed: z.boolean().optional(),
  })).max(3).optional(),
  polygons: z.array(z.strictObject({ points: z.array(point()).min(3).max(12), label: plain(16).optional(), color: color().optional() })).max(4).optional(),
});
const GeometryShape = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('polygon'), points: z.array(point()).min(3).max(12), id: id().optional(), label: plain(24).optional(), color: color().optional(), dashed: z.boolean().optional() }),
  z.strictObject({ kind: z.literal('circle'), center: point(), r: num(0.1, 100), id: id().optional(), label: plain(24).optional(), color: color().optional() }),
  z.strictObject({ kind: z.literal('segment'), from: point(), to: point(), dashed: z.boolean().optional(), arrows: z.enum(['none', 'end', 'both']).optional() }),
  z.strictObject({ kind: z.literal('angle'), vertex: point(), from: point(), to: point(), label: plain(12).optional(), right: z.boolean().optional() }),
  z.strictObject({ kind: z.literal('ticks'), from: point(), to: point(), count: int(1, 3) }),
  z.strictObject({ kind: z.literal('dimension'), from: point(), to: point(), label: plain(16) }),
  z.strictObject({ kind: z.literal('label'), at: point(), text: plain(24) }),
  z.strictObject({ kind: z.literal('point'), at: point(), label: plain(8).optional() }),
]);
const Geometry = z.strictObject({
  type: z.literal('geometry'), ...figureBase,
  width: num(1, 100).describe('Drawing width in abstract units; y points up from 0 to height.'), height: num(1, 100),
  shapes: z.array(GeometryShape).min(1).max(24),
  notToScale: z.boolean().optional(),
});
const NumberLine = z.strictObject({
  type: z.literal('number_line'), ...figureBase,
  min: num(-COORD, COORD), max: num(-COORD, COORD), step: num(0.001, 1000),
  labelEvery: int(1, 20).optional(), denominator: int(2, 16).optional().describe('Label ticks as fractions with this denominator.'),
  marks: z.array(z.strictObject({ value: num(-COORD, COORD), label: plain(12).optional(), open: z.boolean().optional() })).max(10).optional(),
  jumps: z.array(z.strictObject({ from: num(-COORD, COORD), to: num(-COORD, COORD), label: plain(12).optional() })).max(10).optional(),
  ranges: z.array(z.strictObject({ from: num(-COORD, COORD), to: num(-COORD, COORD), includeFrom: z.boolean().optional(), includeTo: z.boolean().optional(), extends: z.enum(['none', 'left', 'right']).optional() })).max(2).optional(),
  hideLabels: z.boolean().optional(),
});
const FractionModel = z.strictObject({
  type: z.literal('fraction_model'), ...figureBase,
  model: z.enum(['bar', 'circle', 'area']), parts: int(1, 24), shaded: int(0, 96), wholes: int(1, 4).optional(),
  rows: int(1, 12).optional().describe('Area model only: rows of the grid; parts must be divisible by rows.'),
  color: color().optional(),
});
const ArrayGrid = z.strictObject({
  type: z.literal('array_grid'), ...figureBase,
  rows: int(1, 12), cols: int(1, 12), style: z.enum(['dots', 'squares', 'icons']), icon: icon().optional(),
  shaded: int(0, 144).optional(), showDimensions: z.boolean().optional(), color: color().optional(),
});
const PlaceValueBlocks = z.strictObject({
  type: z.literal('place_value_blocks'), ...figureBase,
  thousands: int(0, 9).optional(), hundreds: int(0, 15), tens: int(0, 20), ones: int(0, 20), showLabels: z.boolean().optional(),
});
const Clock = z.strictObject({
  type: z.literal('clock'), ...figureBase, hour: int(1, 12), minute: int(0, 59), showDigital: z.boolean().optional(), showMinuteNumbers: z.boolean().optional(),
});
export const MONEY_KINDS = { penny: 1, nickel: 5, dime: 10, quarter: 25, half_dollar: 50, dollar_coin: 100, bill_1: 100, bill_5: 500, bill_10: 1000, bill_20: 2000 } as const;
const Money = z.strictObject({
  type: z.literal('money'), ...figureBase,
  items: z.array(z.strictObject({ kind: z.enum(Object.keys(MONEY_KINDS) as [keyof typeof MONEY_KINDS, ...(keyof typeof MONEY_KINDS)[]]), count: int(1, 10) })).min(1).max(8),
});
const Ruler = z.strictObject({
  type: z.literal('ruler'), ...figureBase,
  unit: z.enum(['cm', 'in']), length: int(1, 15), subdivisions: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(10)]),
  object: z.strictObject({ from: num(0, 15), to: num(0, 15), label: plain(24).optional(), color: color().optional() }).optional(),
});
const Picture = z.strictObject({
  type: z.literal('picture'), ...figureBase,
  groups: z.array(z.strictObject({
    icon: icon(), count: int(1, 30), label: plain(24).optional(), id: id().optional(), color: color().optional(),
    arrangement: z.enum(['row', 'grid', 'ten_frame', 'scattered']).optional(), crossedOut: int(0, 30).optional(),
  })).min(1).max(6),
  layout: z.enum(['row', 'column']).optional(),
  key: plain(48).optional().describe('Pictograph key, e.g. "Each star = 2 books".'),
});

export const FigureSchema = z.discriminatedUnion('type', [
  BarChart, LineChart, ScatterPlot, PieChart, DataTable, CoordinatePlane, Geometry, NumberLine,
  FractionModel, ArrayGrid, PlaceValueBlocks, Clock, Money, Ruler, Picture,
]);
export type Figure = z.infer<typeof FigureSchema>;
export type FigureType = Figure['type'];
export type FigureOf<T extends FigureType> = Extract<Figure, { type: T }>;
export type GeometryShapeSpec = z.infer<typeof GeometryShape>;

// ---------- prompt blocks ----------
const BlockSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('text'), text: rich(600) }),
  z.strictObject({ type: z.literal('math'), tex: tex() }),
  z.strictObject({ type: z.literal('figure'), figureId: id() }),
]);
export type Block = z.infer<typeof BlockSchema>;

// ---------- responses ----------
const label = () => rich(120).optional();
const choice = () => z.strictObject({ text: rich(160), correct: z.boolean(), misconception: tag().optional() });
export const ResponseSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('numeric'), answer: num(-1e9, 1e9), tolerance: num(0, 1e6).optional(), unit: plain(16).optional(), label: label(),
    misconceptionAnswers: z.array(z.strictObject({ answer: num(-1e9, 1e9), tag: tag() })).max(4).optional(),
  }),
  z.strictObject({
    type: z.literal('fraction'), numerator: int(-1e6, 1e6), denominator: int(1, 1e6),
    form: z.enum(['any', 'simplest', 'exact']).optional(), mixed: z.boolean().optional(), label: label(),
    misconceptionAnswers: z.array(z.strictObject({ numerator: int(-1e6, 1e6), denominator: int(1, 1e6), tag: tag() })).max(4).optional(),
  }),
  z.strictObject({
    type: z.literal('expression'), answer: exprText(120), variables: z.array(z.string().regex(/^[a-df-z]$/)).min(1).max(3),
    domain: z.strictObject({ min: num(-1000, 1000), max: num(-1000, 1000) }).optional(),
    form: z.enum(['any', 'expanded', 'simplified']).optional(), label: label(),
  }),
  z.strictObject({ type: z.literal('multiple_choice'), options: z.array(choice()).min(2).max(6), shuffle: z.boolean().optional() }),
  z.strictObject({ type: z.literal('multi_select'), options: z.array(choice()).min(2).max(8), shuffle: z.boolean().optional() }),
  z.strictObject({ type: z.literal('ordering'), items: z.array(rich(80)).min(2).max(8).describe('Items in the CORRECT order; the app shuffles them.'), firstLabel: plain(24).optional(), lastLabel: plain(24).optional() }),
  z.strictObject({ type: z.literal('plot_point'), figureId: id(), x: num(-COORD, COORD), y: num(-COORD, COORD), tolerance: num(0, 5).optional(), snap: num(0.05, 100).optional() }),
  z.strictObject({ type: z.literal('tap_region'), figureId: id(), region: id(), regionMisconceptions: z.array(z.strictObject({ region: id(), tag: tag() })).max(6).optional() }),
]);
export type ResponseSpec = z.infer<typeof ResponseSchema>;
export type ResponseType = ResponseSpec['type'];
export type ResponseOf<T extends ResponseType> = Extract<ResponseSpec, { type: T }>;

const KeyCheckSchema = z.union([
  z.strictObject({ value: exprText(160).describe('Arithmetic that evaluates to the numeric/fraction answer, e.g. "3*4+2" or "3/4+1/8".') }),
  z.strictObject({ x: exprText(80), y: exprText(80) }),
]);

export const ActivitySpecSchema = z.strictObject({
  version: z.literal(1),
  id: id(),
  title: plain(60).optional(),
  skillIds: z.array(z.string().regex(/^[K1-8]\.[A-Z]{1,3}\.[A-D]\.\d{1,2}$/)).min(1).max(3),
  difficulty: int(1, 10),
  prompt: z.array(BlockSchema).min(1).max(8),
  figures: z.array(FigureSchema).max(4).optional(),
  response: ResponseSchema,
  hints: z.array(rich(300)).max(4).optional(),
  explanation: rich(1200),
  misconceptions: z.array(z.strictObject({ tag: tag(), description: plain(160) })).max(6).optional(),
  keyCheck: KeyCheckSchema.optional(),
});
export type ActivitySpec = z.infer<typeof ActivitySpecSchema>;

export const ActivityBatchSchema = z.strictObject({
  rationale: plain(600),
  activities: z.array(ActivitySpecSchema).min(1).max(5),
});

// ---------- validation ----------
export interface ValidateOptions {
  /** Skill ids that exist in the bundled standards graph (or the subset offered to the model). */
  skillIds: ReadonlySet<string>;
  /** Numeric, fraction and plot_point keys must carry a matching keyCheck (default true). */
  requireKeyCheck?: boolean;
}
export type SpecValidation = { ok: true; spec: ActivitySpec } | { ok: false; errors: string[] };

const MAX_NODES = 4000, MAX_DEPTH = 12, MAX_JSON_CHARS = 24000;
/** Cheap pre-parse guard: bail out of huge or deep inputs before schema work. */
function withinShapeBudget(input: unknown): string | null {
  let nodes = 0;
  const walk = (v: unknown, depth: number): string | null => {
    if (++nodes > MAX_NODES) return 'Activity is too large.';
    if (depth > MAX_DEPTH) return 'Activity is nested too deeply.';
    if (typeof v === 'string' && v.length > 4000) return 'Activity contains an oversized string.';
    if (Array.isArray(v)) { if (v.length > 200) return 'Activity contains an oversized list.'; for (const x of v) { const p = walk(x, depth + 1); if (p) return p; } }
    else if (v && typeof v === 'object') { const entries = Object.entries(v); if (entries.length > 40) return 'Activity object has too many fields.'; for (const [, x] of entries) { const p = walk(x, depth + 1); if (p) return p; } }
    return null;
  };
  return walk(input, 0);
}

const formatPath = (path: readonly PropertyKey[]) => path.map(p => typeof p === 'number' ? `[${p}]` : `.${String(p)}`).join('').replace(/^\./, '') || '(root)';

/** Strict-mode models emit null for absent optional fields; treat an object's null members as absent. */
export function dropNullMembers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropNullMembers);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, dropNullMembers(v)]));
  return value;
}

export function validateActivitySpec(raw: unknown, options: ValidateOptions): SpecValidation {
  const budget = withinShapeBudget(raw);
  if (budget) return { ok: false, errors: [budget] };
  const input = dropNullMembers(raw);
  if (JSON.stringify(input)?.length > MAX_JSON_CHARS) return { ok: false, errors: ['Activity is too large.'] };
  const parsed = ActivitySpecSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.slice(0, 20).map(i => `${formatPath(i.path)}: ${i.message}`) };
  const errors = semanticErrors(parsed.data, options);
  return errors.length ? { ok: false, errors } : { ok: true, spec: parsed.data };
}

/**
 * Prompt-only JSON (no response_format yet): tolerate code fences and chatter around the
 * payload by taking the outermost balanced {...} object (string- and escape-aware).
 */
export function extractJsonObject(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (typeof text !== 'string') return { ok: false, error: 'Response is not text.' };
  if (text.length > 150000) return { ok: false, error: 'Response is too large.' };
  if (text.indexOf('{') < 0) return { ok: false, error: 'Response contains no JSON object.' };
  // Try each opening brace in turn so chatter like "Sure {here}" before the payload is skipped.
  let sawIncomplete = false;
  for (let start = text.indexOf('{'), tries = 0; start >= 0 && tries < 50; start = text.indexOf('{', start + 1), tries++) {
    const r = balancedObjectAt(text, start);
    if (r === 'incomplete') { sawIncomplete = true; break; }
    try { const value = JSON.parse(r); if (value && typeof value === 'object' && !Array.isArray(value)) return { ok: true, value }; } catch { /* try the next brace */ }
  }
  return { ok: false, error: sawIncomplete ? 'Response JSON is incomplete (truncated?).' : 'Response is not valid JSON.' };
}
function balancedObjectAt(text: string, start: number): string | 'incomplete' {
  let depth = 0, inString = false, escaped = false, end = -1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { end = i; break; }
  }
  return end < 0 ? 'incomplete' : text.slice(start, end + 1);
}

/**
 * A response cut off by the output-token limit still contains whole activities. Recover every
 * complete element of the "activities" array; the incomplete tail is discarded.
 */
export function salvageTruncatedBatch(text: string): { rationale?: string; activities: unknown[] } | null {
  const key = text.search(/"activities"\s*:\s*\[/);
  if (key < 0) return null;
  const activities: unknown[] = [];
  let i = text.indexOf('[', key) + 1, depth = 0, inString = false, escaped = false, start = -1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inString) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === '{') { if (depth++ === 0) start = i; }
    else if (c === '}' && --depth === 0) { try { activities.push(JSON.parse(text.slice(start, i + 1))); } catch { /* skip malformed element */ } }
    else if (c === ']' && depth === 0) break;
  }
  const rationale = /"rationale"\s*:\s*"((?:[^"\\]|\\.){0,600})"/.exec(text)?.[1];
  let decoded: string | undefined;
  try { decoded = rationale === undefined ? undefined : JSON.parse(`"${rationale}"`); } catch { decoded = undefined; }
  return { ...(decoded ? { rationale: decoded } : {}), activities };
}

/**
 * Per-item recovery for a reply that is not one valid JSON object: truncated by the token cap, or
 * with a JSON slip (a missing brace or quote) inside one activity. Every activity object starts
 * with a "version" key, which no nested object uses, so each activity start is found by pattern
 * and parsed on its own, never reading past the next start. A malformed activity is reported as such and its
 * neighbours are kept. Nothing is repaired: a candidate either parses as written or is dropped.
 */
export function recoverBatchItems(text: string): { rationale?: string; items: ({ ok: true; value: unknown } | { ok: false; error: string })[] } | null {
  const key = text.search(/"activities"\s*:\s*\[/);
  if (key < 0) return null;
  // Not string-aware on purpose: a missing quote must not hide later activities. A false start
  // inside a string can only make candidates fail validation, never pass.
  const starts = [...text.slice(key).matchAll(/\{\s*"version"\s*:/g)].map(m => key + m.index);
  const items = starts.slice(0, 10).map((start, k) => {
    // A malformed activity can swallow its neighbours; never read past the next activity start.
    const window = text.slice(start, starts[k + 1] ?? text.length);
    const r = balancedObjectAt(window, 0);
    if (r === 'incomplete') return { ok: false as const, error: k === starts.length - 1 ? 'Activity JSON is incomplete (truncated).' : 'Activity JSON is malformed.' };
    try { return { ok: true as const, value: JSON.parse(r) as unknown }; } catch { return { ok: false as const, error: 'Activity JSON is malformed.' }; }
  });
  const rationale = /"rationale"\s*:\s*"((?:[^"\\]|\\.){0,600})"/.exec(text)?.[1];
  let decoded: string | undefined;
  try { decoded = rationale === undefined ? undefined : JSON.parse(`"${rationale}"`); } catch { decoded = undefined; }
  return { ...(decoded ? { rationale: decoded } : {}), items };
}

export interface BatchValidation {
  rationale: string;
  accepted: ActivitySpec[];
  rejected: { index: number; id?: string; errors: string[] }[];
  errors: string[];
}
/** Validate a model's batch; individually invalid activities are dropped, never repaired. */
export function validateActivityBatch(input: unknown, options: ValidateOptions): BatchValidation {
  const empty = (errors: string[]): BatchValidation => ({ rationale: '', accepted: [], rejected: [], errors });
  let value = input;
  if (typeof value === 'string') {
    const text = value;
    const extracted = extractJsonObject(text);
    // A batch envelope that failed to parse can still yield an inner object (one activity); only
    // accept an extracted object that is the envelope itself.
    const envelope = extracted.ok && extracted.value && typeof extracted.value === 'object' && 'activities' in extracted.value;
    if (extracted.ok && (envelope || !/"activities"\s*:\s*\[/.test(text))) value = extracted.value;
    else {
      const recovered = text.length <= 150000 ? recoverBatchItems(text) : null;
      if (!recovered?.items.some(i => i.ok)) return empty([extracted.ok ? 'Response is not valid JSON.' : extracted.error]);
      const items = recovered.items.slice(0, 5);
      const kept = validateActivityBatch({ rationale: recovered.rationale ?? 'Response JSON was damaged.', activities: items.map(i => i.ok ? i.value : null) }, options);
      // Malformed items stay in the rejected list at their own index, with the JSON reason.
      items.forEach((item, index) => { if (!item.ok) { const r = kept.rejected.find(x => x.index === index); if (r) r.errors = [item.error]; } });
      // Truncation leaves the LAST activity unfinished; a slip mid-batch is a malformed reply.
      const truncated = recovered.items.at(-1)?.ok === false && !extracted.ok && extracted.error.includes('incomplete');
      return { ...kept, errors: [...kept.errors, `Response JSON was ${truncated ? 'truncated' : 'malformed'}; kept ${kept.accepted.length} complete activit${kept.accepted.length === 1 ? 'y' : 'ies'}.`] };
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return empty(['Response must be a JSON object.']);
  const record = value as Record<string, unknown>;
  const extra = Object.keys(record).filter(k => k !== 'rationale' && k !== 'activities');
  if (extra.length) return empty([`Unknown field(s): ${extra.slice(0, 5).join(', ')}`]);
  const rationale = plain(600).safeParse(record.rationale);
  if (!rationale.success) return empty([`rationale: ${rationale.error.issues[0]?.message ?? 'invalid'}`]);
  if (!Array.isArray(record.activities) || record.activities.length < 1 || record.activities.length > 5) return empty(['activities must be a list of 1–5 activities.']);
  const result: BatchValidation = { rationale: rationale.data, accepted: [], rejected: [], errors: [] };
  const seen = new Set<string>();
  record.activities.forEach((candidate, index) => {
    const checked = validateActivitySpec(candidate, options);
    if (!checked.ok) result.rejected.push({ index, id: typeof (candidate as { id?: unknown })?.id === 'string' ? String((candidate as { id: string }).id).slice(0, 48) : undefined, errors: checked.errors });
    else if (seen.has(checked.spec.id)) result.rejected.push({ index, id: checked.spec.id, errors: ['Duplicate activity id in batch.'] });
    else { seen.add(checked.spec.id); result.accepted.push(checked.spec); }
  });
  return result;
}

// ---------- semantic rules ----------
type P = { x: number; y: number };
const inAxis = (v: number, a: { min: number; max: number }) => v >= a.min && v <= a.max;
function checkAxis(a: { min: number; max: number; step?: number }, where: string, errors: string[]) {
  if (a.max <= a.min) errors.push(`${where}: max must be greater than min.`);
  else if (a.step !== undefined && (a.max - a.min) / a.step > 40) errors.push(`${where}: at most 40 steps.`);
}
const unique = (values: string[]) => new Set(values).size === values.length;

export function regionIds(figure: Figure): string[] {
  switch (figure.type) {
    case 'bar_chart': return figure.bars.flatMap(b => b.id ? [b.id] : []);
    case 'pie_chart': return figure.slices.flatMap(s => s.id ? [s.id] : []);
    case 'picture': return figure.groups.flatMap(g => g.id ? [g.id] : []);
    case 'coordinate_plane': return (figure.points ?? []).flatMap(p => p.id ? [p.id] : []);
    case 'geometry': return figure.shapes.flatMap(s => (s.kind === 'polygon' || s.kind === 'circle') && s.id ? [s.id] : []);
    default: return [];
  }
}

function figureErrors(f: Figure, where: string, errors: string[]) {
  const ids = regionIds(f);
  if (!unique(ids)) errors.push(`${where}: region ids must be unique.`);
  switch (f.type) {
    case 'bar_chart': {
      const top = Math.max(...f.bars.map(b => b.value));
      if (f.yMax !== undefined && f.yMax < top) errors.push(`${where}: yMax is below the tallest bar.`);
      if (f.yStep !== undefined && (f.yMax ?? top) / f.yStep > 20) errors.push(`${where}: at most 20 axis steps.`);
      if (!unique(f.bars.map(b => b.label))) errors.push(`${where}: bar labels must be unique.`);
      break;
    }
    case 'line_chart': case 'scatter_plot': {
      if (f.x) checkAxis(f.x, `${where}.x`, errors);
      if (f.y) checkAxis(f.y, `${where}.y`, errors);
      const pts = f.type === 'line_chart' ? f.series.flatMap(s => s.points) : f.points;
      if (f.x && pts.some(p => !inAxis(p.x, f.x!))) errors.push(`${where}: points lie outside the x axis.`);
      if (f.y && pts.some(p => !inAxis(p.y, f.y!))) errors.push(`${where}: points lie outside the y axis.`);
      if (f.type === 'line_chart' && f.series.some(s => s.points.some((p, i) => i > 0 && p.x <= s.points[i - 1]!.x))) errors.push(`${where}: line points must have increasing x.`);
      if (f.type === 'line_chart' && !unique(f.series.map(s => s.name))) errors.push(`${where}: series names must be unique.`);
      break;
    }
    case 'pie_chart':
      if (!unique(f.slices.map(s => s.label))) errors.push(`${where}: slice labels must be unique.`);
      break;
    case 'data_table':
      if (f.rows.some(r => r.length !== f.columns.length)) errors.push(`${where}: every row needs one cell per column.`);
      break;
    case 'coordinate_plane': {
      checkAxis(f.x, `${where}.x`, errors); checkAxis(f.y, `${where}.y`, errors);
      if ((f.x.max - f.x.min) / (f.x.step ?? 1) > 40 || (f.y.max - f.y.min) / (f.y.step ?? 1) > 40) errors.push(`${where}: grid is too dense; set a larger step.`);
      const inside = (p: P) => inAxis(p.x, f.x) && inAxis(p.y, f.y);
      if ((f.points ?? []).some(p => !inside(p))) errors.push(`${where}: points lie outside the plane.`);
      if ((f.segments ?? []).some(s => !inside(s.from) || !inside(s.to))) errors.push(`${where}: segments lie outside the plane.`);
      if ((f.polygons ?? []).some(poly => poly.points.some(p => !inside(p)))) errors.push(`${where}: polygons lie outside the plane.`);
      (f.functions ?? []).forEach((fn, i) => {
        try {
          const tree = parseExpr(fn.expr, ['x']);
          const from = fn.from ?? f.x.min, to = fn.to ?? f.x.max;
          if (to <= from) { errors.push(`${where}.functions[${i}]: to must be greater than from.`); return; }
          const finite = samplePoints(['x'], [from, to], 48, fn.expr).filter(s => Number.isFinite(evaluate(tree, s))).length;
          if (finite < 12) errors.push(`${where}.functions[${i}]: function is undefined on most of its domain.`);
        } catch (e) { errors.push(`${where}.functions[${i}]: ${e instanceof ExprError ? e.message : 'invalid expression'}`); }
      });
      break;
    }
    case 'geometry': {
      const inside = (p: P) => p.x >= 0 && p.x <= f.width && p.y >= 0 && p.y <= f.height;
      const pts: P[] = f.shapes.flatMap(s => {
        switch (s.kind) {
          case 'polygon': return s.points;
          case 'circle': return [{ x: s.center.x - s.r, y: s.center.y - s.r }, { x: s.center.x + s.r, y: s.center.y + s.r }];
          case 'angle': return [s.vertex, s.from, s.to];
          case 'label': case 'point': return [s.at];
          default: return [s.from, s.to];
        }
      });
      if (pts.some(p => !inside(p))) errors.push(`${where}: shapes must fit inside width × height.`);
      f.shapes.forEach((s, i) => {
        if (s.kind === 'angle' && (dist(s.vertex, s.from) === 0 || dist(s.vertex, s.to) === 0)) errors.push(`${where}.shapes[${i}]: angle rays need length.`);
        if ((s.kind === 'segment' || s.kind === 'ticks' || s.kind === 'dimension') && dist(s.from, s.to) === 0) errors.push(`${where}.shapes[${i}]: zero-length segment.`);
      });
      break;
    }
    case 'number_line': {
      if (f.max <= f.min) errors.push(`${where}: max must be greater than min.`);
      else if ((f.max - f.min) / f.step > 40) errors.push(`${where}: at most 40 ticks; increase step.`);
      const within = (v: number) => v >= f.min - 1e-9 && v <= f.max + 1e-9;
      if ((f.marks ?? []).some(m => !within(m.value))) errors.push(`${where}: marks lie outside the line.`);
      if ((f.jumps ?? []).some(j => !within(j.from) || !within(j.to) || j.from === j.to)) errors.push(`${where}: jumps must stay on the line and move.`);
      if ((f.ranges ?? []).some(r => !within(r.from) || !within(r.to) || r.to < r.from)) errors.push(`${where}: ranges must lie on the line with from ≤ to.`);
      break;
    }
    case 'fraction_model':
      if (f.shaded > f.parts * (f.wholes ?? 1)) errors.push(`${where}: shaded exceeds the available parts.`);
      if (f.model === 'area' && f.rows !== undefined && f.parts % f.rows !== 0) errors.push(`${where}: parts must be divisible by rows.`);
      if (f.model !== 'area' && f.rows !== undefined) errors.push(`${where}: rows applies to area models only.`);
      break;
    case 'array_grid':
      if ((f.shaded ?? 0) > f.rows * f.cols) errors.push(`${where}: shaded exceeds the grid.`);
      if (f.style === 'icons' && !f.icon) errors.push(`${where}: icons style needs an icon.`);
      break;
    case 'place_value_blocks':
      if ((f.thousands ?? 0) + f.hundreds + f.tens + f.ones === 0) errors.push(`${where}: show at least one block.`);
      break;
    case 'money':
      if (f.items.reduce((n, i) => n + i.count, 0) > 30) errors.push(`${where}: at most 30 coins and bills.`);
      if (!unique(f.items.map(i => i.kind))) errors.push(`${where}: list each coin or bill kind once.`);
      break;
    case 'ruler':
      if (f.object && (f.object.to <= f.object.from || f.object.to > f.length)) errors.push(`${where}: object must lie on the ruler.`);
      break;
    case 'picture':
      if (f.groups.reduce((n, g) => n + g.count, 0) > 100) errors.push(`${where}: at most 100 icons in total.`);
      if (f.groups.some(g => (g.crossedOut ?? 0) > g.count)) errors.push(`${where}: crossedOut exceeds count.`);
      if (f.groups.some(g => g.arrangement === 'ten_frame' && g.count > 20)) errors.push(`${where}: ten frames hold at most 20.`);
      break;
    case 'clock':
      break;
  }
}
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const normalizeText = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

function evalCheck(source: string, where: string, errors: string[]): number | null {
  try {
    const v = evaluateConstant(source);
    if (!Number.isFinite(v)) { errors.push(`${where}: keyCheck is undefined.`); return null; }
    return v;
  } catch (e) { errors.push(`${where}: ${e instanceof ExprError ? e.message : 'invalid keyCheck'}`); return null; }
}

export function semanticErrors(spec: ActivitySpec, { skillIds, requireKeyCheck = true }: ValidateOptions): string[] {
  const errors: string[] = [];
  spec.skillIds.forEach((s, i) => { if (!skillIds.has(s)) errors.push(`skillIds[${i}]: unknown skill ${s}.`); });
  if (!unique(spec.skillIds)) errors.push('skillIds: duplicates.');
  const figures = spec.figures ?? [];
  const byId = new Map(figures.map(f => [f.id, f]));
  if (byId.size !== figures.length) errors.push('figures: ids must be unique.');
  figures.forEach((f, i) => figureErrors(f, `figures[${i}]`, errors));
  if (!spec.prompt.some(b => b.type === 'text')) errors.push('prompt: include at least one text block.');
  const referenced = spec.prompt.flatMap(b => b.type === 'figure' ? [b.figureId] : []);
  referenced.forEach(r => { if (!byId.has(r)) errors.push(`prompt: figure ${r} does not exist.`); });
  if (!unique(referenced)) errors.push('prompt: show each figure once.');
  figures.forEach(f => { if (!referenced.includes(f.id)) errors.push(`figures: ${f.id} is never shown in the prompt.`); });
  if (spec.misconceptions && !unique(spec.misconceptions.map(m => m.tag))) errors.push('misconceptions: tags must be unique.');

  const r = spec.response;
  const keyed = r.type === 'numeric' || r.type === 'fraction' || r.type === 'plot_point';
  if (spec.keyCheck && !keyed) errors.push('keyCheck: only numeric, fraction and plot_point answers take a keyCheck.');
  if (keyed && requireKeyCheck && !spec.keyCheck) errors.push('keyCheck: required for this answer type.');
  switch (r.type) {
    case 'numeric': {
      const tol = (r.tolerance ?? 0) + 1e-9 * Math.max(1, Math.abs(r.answer));
      if ((r.misconceptionAnswers ?? []).some(m => Math.abs(m.answer - r.answer) <= tol)) errors.push('response: a misconception answer equals the correct answer.');
      if (spec.keyCheck) {
        if (!('value' in spec.keyCheck)) errors.push('keyCheck: numeric answers use { value }.');
        else { const v = evalCheck(spec.keyCheck.value, 'keyCheck.value', errors); if (v !== null && Math.abs(v - r.answer) > tol) errors.push(`keyCheck: ${spec.keyCheck.value} = ${+v.toPrecision(12)}, but the answer key is ${r.answer}.`); }
      }
      break;
    }
    case 'fraction': {
      const value = r.numerator / r.denominator;
      if ((r.misconceptionAnswers ?? []).some(m => m.numerator * r.denominator === r.numerator * m.denominator && (r.form !== 'exact' || (m.numerator === r.numerator && m.denominator === r.denominator)))) errors.push('response: a misconception answer equals the correct answer.');
      if (r.form === 'simplest' && gcd(Math.abs(r.numerator), r.denominator) !== 1) errors.push('response: a simplest-form key must be in lowest terms.');
      if (spec.keyCheck) {
        if (!('value' in spec.keyCheck)) errors.push('keyCheck: fraction answers use { value }.');
        else { const v = evalCheck(spec.keyCheck.value, 'keyCheck.value', errors); if (v !== null && !closeEnough(v, value)) errors.push(`keyCheck: ${spec.keyCheck.value} ≠ ${r.numerator}/${r.denominator}.`); }
      }
      break;
    }
    case 'expression': {
      const domain = r.domain ?? { min: -10, max: 10 };
      if (domain.max <= domain.min) { errors.push('response.domain: max must exceed min.'); break; }
      try {
        const tree = parseExpr(r.answer, r.variables);
        const used = variablesUsed(tree);
        if (!r.variables.some(v => used.has(v))) errors.push('response: the answer expression uses none of its variables.');
        const finite = samplePoints(r.variables, [domain.min, domain.max], 24, spec.id).filter(s => Number.isFinite(evaluate(tree, s))).length;
        if (finite < 12) errors.push('response: the answer expression is undefined on most of its domain.');
      } catch (e) { errors.push(`response.answer: ${e instanceof ExprError ? e.message : 'invalid expression'}`); }
      break;
    }
    case 'multiple_choice': case 'multi_select': {
      const correct = r.options.filter(o => o.correct).length;
      if (r.type === 'multiple_choice' && correct !== 1) errors.push('response: exactly one option must be correct.');
      if (r.type === 'multi_select' && (correct < 1 || correct === r.options.length)) errors.push('response: mark at least one correct and one incorrect option.');
      if (!unique(r.options.map(o => normalizeText(o.text)))) errors.push('response: options must be distinct.');
      if (r.options.some(o => o.correct && o.misconception)) errors.push('response: a correct option cannot carry a misconception.');
      break;
    }
    case 'ordering':
      if (!unique(r.items.map(normalizeText))) errors.push('response: ordering items must be distinct.');
      break;
    case 'plot_point': {
      const f = byId.get(r.figureId);
      if (!f || f.type !== 'coordinate_plane') { errors.push('response: plot_point must reference a coordinate_plane figure.'); break; }
      if (!inAxis(r.x, f.x) || !inAxis(r.y, f.y)) errors.push('response: the answer point lies outside the plane.');
      const tol = Math.max(r.tolerance ?? 0, 1e-9);
      if ((f.points ?? []).some(p => Math.abs(p.x - r.x) <= tol && Math.abs(p.y - r.y) <= tol)) errors.push('response: the figure already shows the answer point.');
      const snap = plotSnap(r, f);
      const gx = snapToGrid(r.x, snap.x, f.x.min, f.x.max), gy = snapToGrid(r.y, snap.y, f.y.min, f.y.max);
      if (gx === null || gy === null || Math.abs(gx - r.x) > tol || Math.abs(gy - r.y) > tol) errors.push(`response: the answer point is not reachable on the plotting grid (snap x ${snap.x}, y ${snap.y}); set snap or the axis step.`);
      if (spec.keyCheck) {
        if (!('x' in spec.keyCheck)) errors.push('keyCheck: plot_point answers use { x, y }.');
        else {
          const x = evalCheck(spec.keyCheck.x, 'keyCheck.x', errors), y = evalCheck(spec.keyCheck.y, 'keyCheck.y', errors);
          if (x !== null && y !== null && (Math.abs(x - r.x) > tol || Math.abs(y - r.y) > tol)) errors.push(`keyCheck: (${spec.keyCheck.x}, ${spec.keyCheck.y}) ≠ (${r.x}, ${r.y}).`);
        }
      }
      break;
    }
    case 'tap_region': {
      const f = byId.get(r.figureId);
      if (!f) { errors.push('response: tap_region references a missing figure.'); break; }
      const regions = regionIds(f);
      if (regions.length < 2) errors.push('response: the figure needs at least two tappable regions (give elements ids).');
      if (!regions.includes(r.region)) errors.push(`response: region ${r.region} is not in the figure.`);
      (r.regionMisconceptions ?? []).forEach(m => { if (!regions.includes(m.region) || m.region === r.region) errors.push(`response: misconception region ${m.region} is invalid.`); });
      break;
    }
  }
  return errors;
}
/**
 * The plotting grid: multiples of `snap` (counted from 0) inside [lo, hi]. Taps, arrow keys and
 * steppers all land on this grid, so the validator requires plot answers to be reachable on it.
 */
export function snapToGrid(v: number, snap: number, lo: number, hi: number): number | null {
  const kMin = Math.ceil(lo / snap - 1e-9), kMax = Math.floor(hi / snap + 1e-9);
  if (kMin > kMax) return null;
  return +(Math.min(kMax, Math.max(kMin, Math.round(v / snap))) * snap).toPrecision(12);
}
/** Per-axis snap for a plot_point response: an explicit snap, else each axis's own grid step. */
export function plotSnap(r: { snap?: number }, plane: { x: { step?: number }; y: { step?: number } }) {
  return { x: r.snap ?? plane.x.step ?? 1, y: r.snap ?? plane.y.step ?? 1 };
}
export const gcd = (a: number, b: number): number => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
