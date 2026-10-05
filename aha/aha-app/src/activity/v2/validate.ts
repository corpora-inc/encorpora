/**
 * Activity Spec v2 validation (README §11): L0 shape, L1 model, L2 render feasibility. An invalid
 * activity is dropped, never repaired. Every rejection is a Problem with a stable code.
 *
 * L1 here covers the model, the prose, the views and the reveal rule. Response semantics that need
 * the key (the answer fits the form, distractor rules, computed uniqueness) are added by
 * response.ts.
 */
import { getSkill } from '../../learning/curriculum';
import { extractJsonObject } from '../spec';
import { drawingProblems } from '../draw';
import { evaluate, formatValue, isValueAttr, parseExpr, refsOf, sameValue, type Described, type Expr, type Result, type Rich, type Value, type ValueAttr } from './quantity';
import { parseTempl, proseIssues, renderTempl, type Placeholder, type Templ } from './text';
import { bindModel, problem, type Model, type Problem, type Target } from './model';
import { BANDS, FORM_GRADES, gradeLabel, gradeNum, inRange, isAnswerForm, rangeLabel, type AskTarget, type Band, type Drawing, type Reveal, type ViewDef } from './registry';
import { bandWire, type WireActivity, type WireBlock } from './wire';

export interface ValidateOptions {
  /** The band whose schema the request carried. */
  band: Band;
  /** Skill ids offered in the request's STANDARDS window. */
  skillIds: ReadonlySet<string>;
  locale?: string;
}
export type RenderedBlock = { type: 'text'; text: string } | { type: 'math'; tex: string } | { type: 'view'; of: string };
/** The ask, parsed and valued; `target` is set when it is a single reference. */
export interface Ask { expr: Expr; value: Value; target: Target | null; described: Described }
export interface CheckedActivity {
  wire: WireActivity;
  grade: number;
  band: Band;
  model: Model;
  ask: Ask | null;
  candidates: { expr: Expr; value: Value }[];
  distractors: { expr: Expr; value: Value; tag: string }[];
  rendered: { prompt: RenderedBlock[]; hints: string[]; explanation: string };
  /** One drawing per viewed structure, by structure id (without id and alt). */
  drawings: Map<string, Drawing>;
  /** What each viewed structure reveals (README §7). */
  reveals: Map<string, Readonly<Record<string, Reveal>>>;
}
export type Validation = { ok: true; activity: CheckedActivity } | { ok: false; problems: Problem[] };

// ---------- L0 ----------
const MAX_NODES = 2000, MAX_DEPTH = 10, MAX_JSON_CHARS = 16000;
function shapeBudget(input: unknown): string | null {
  let nodes = 0;
  const walk = (v: unknown, depth: number): string | null => {
    if (++nodes > MAX_NODES) return 'Activity is too large.';
    if (depth > MAX_DEPTH) return 'Activity is nested too deeply.';
    if (typeof v === 'string' && v.length > 1000) return 'Activity contains an oversized string.';
    if (Array.isArray(v)) { if (v.length > 50) return 'Activity contains an oversized list.'; for (const x of v) { const p = walk(x, depth + 1); if (p) return p; } }
    else if (v && typeof v === 'object') { const e = Object.entries(v); if (e.length > 20) return 'Activity object has too many fields.'; for (const [, x] of e) { const p = walk(x, depth + 1); if (p) return p; } }
    return null;
  };
  return walk(input, 0);
}
const pathText = (path: readonly PropertyKey[]) => path.map(p => typeof p === 'number' ? `[${p}]` : `.${String(p)}`).join('').replace(/^\./, '') || '(root)';
function parseShape(raw: unknown, band: Band): { ok: true; wire: WireActivity } | { ok: false; problems: Problem[] } {
  const budget = shapeBudget(raw);
  if (budget) return { ok: false, problems: [{ layer: 'L0', code: 'size', path: '(root)', message: budget }] };
  if ((JSON.stringify(raw)?.length ?? 0) > MAX_JSON_CHARS) return { ok: false, problems: [{ layer: 'L0', code: 'size', path: '(root)', message: 'Activity is too large.' }] };
  const parsed = bandWire(band).activity.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, problems: parsed.error.issues.slice(0, 20).map(i => ({
      layer: 'L0' as const, code: 'schema', path: pathText(i.path),
      message: i.code === 'unrecognized_keys' ? `unknown field(s) ${i.keys.slice(0, 5).map(k => k.slice(0, 32)).join(', ')}` : i.message,
    })) };
  }
  return { ok: true, wire: parsed.data as WireActivity };
}

// ---------- L1 ----------
/** Value-bearing placeholder members: they print the value. */
const VALUE_BEARING: ReadonlySet<ValueAttr> = new Set(['', 'n', 'word']);
const STRENGTH = { unknown: 0, computable: 1, countable: 2, shown: 3 } as const;
type Known = keyof typeof STRENGTH;
const stronger = (a: Known, b: Known): Known => STRENGTH[a] >= STRENGTH[b] ? a : b;
const describedEqual = (a: Described, b: Described) =>
  sameValue(a.value, b.value) && a.value.power === b.value.power && a.value.unit === b.value.unit && a.kind === b.kind && (a.noun?.other ?? null) === (b.noun?.other ?? null);

export function validateActivity(raw: unknown, options: ValidateOptions): Validation {
  const shaped = parseShape(raw, options.band);
  if (!shaped.ok) return shaped;
  const a = shaped.wire;
  const locale = options.locale ?? 'en-US';
  const problems: Problem[] = [];
  const p = (path: string, code: string, message: string) => problems.push({ layer: 'L1', path, code, message });

  // Skills, grade and band.
  a.aim.skills.forEach((s, i) => { if (!options.skillIds.has(s)) p(`aim.skills[${i}]`, 'skill_unknown', `${s} was not offered.`); });
  if (new Set(a.aim.skills).size !== a.aim.skills.length) p('aim.skills', 'skill_duplicate', 'Skills repeat.');
  const skill = getSkill(a.aim.skills[0]!);
  if (!skill) return { ok: false, problems: [...problems, { layer: 'L1', path: 'aim.skills[0]', code: 'skill_unknown', message: 'Unknown skill.' }] };
  const grade = gradeNum(skill.grade);
  if (!inRange(grade, BANDS[options.band])) p('aim.skills[0]', 'off_band', `${skill.id} is grade ${gradeLabel(grade)}, outside this request's grades ${rangeLabel(BANDS[options.band])}.`);
  if (problems.length) return { ok: false, problems };

  const bound = bindModel(a.model, grade);
  if (!bound.ok) return bound;
  const model = bound.model;

  // Views: each structure with a view is shown by exactly one view block; a view block needs a view.
  const viewed = new Map<string, ViewDef<string>>();
  a.prompt.forEach((b, i) => {
    if (b.type !== 'view') return;
    const s = model.structures.get(b.of);
    if (!s) return p(`prompt[${i}].of`, 'ref_unknown', `"${b.of}" is not a structure.`);
    if (s.wire.show === null) return p(`prompt[${i}].of`, 'view_none', `${b.of} has no view (show is null); set show or remove this block.`);
    if (viewed.has(b.of)) return p(`prompt[${i}].of`, 'view_duplicate', `${b.of} is shown twice.`);
    viewed.set(b.of, s.def.views[s.wire.show as string]!);
  });
  for (const [sid, s] of model.structures) if (s.wire.show !== null && !viewed.has(sid)) p(`model.structures[${s.index}].show`, 'view_unshown', `${sid} has a view but no view block shows it; add {"type":"view","of":"${sid}"} or set show to null.`);
  if (!a.prompt.some(b => b.type === 'text')) p('prompt', 'prompt_no_text', 'The prompt needs at least one text block.');

  // The response's expressions.
  const r = a.response;
  if (!inRange(grade, FORM_GRADES[r.form])) p('response.form', 'off_grade', `${r.form} is for grades ${rangeLabel(FORM_GRADES[r.form])}.`);
  const valued = (source: string, path: string): { expr: Expr; value: Value } | null => {
    const e = parseExpr(source);
    if (!e.ok) { p(path, e.error.code, e.error.message); return null; }
    const v = evaluate(e.value, model.resolve);
    if (!v.ok) { p(path, v.error.code, v.error.message); return null; }
    return { expr: e.value, value: v.value };
  };
  let ask: Ask | null = null;
  if ('ask' in r) {
    const v = valued(r.ask, 'response.ask');
    if (v) {
      const single = v.expr.t === 'ref' ? model.target(v.expr.path) : null;
      const target = single?.ok ? single.value : null;
      ask = { ...v, target, described: target ? model.describe(target) : { value: v.value, noun: null, kind: v.value.power === 2 ? 'area' : v.value.power === 1 ? 'length' : v.value.q.d === 1n ? 'number' : 'fraction' } };
    }
  }
  const candidates = ('candidates' in r ? r.candidates ?? [] : []).flatMap((c, i) => { const v = valued(c, `response.candidates[${i}]`); return v ? [v] : []; });
  const distractors = ('distractors' in r ? r.distractors : []).flatMap((d, i) => { const v = valued(d.expr, `response.distractors[${i}].expr`); return v ? [{ ...v, tag: d.tag }] : []; });
  if ('on' in r && r.on !== null) {
    const s = model.structures.get(r.on);
    const view = viewed.get(r.on);
    if (!s) p('response.on', 'ref_unknown', `"${r.on}" is not a structure.`);
    else if (!view) p('response.on', 'view_unshown', `${r.form} acts on ${r.on}'s view, which the prompt does not show.`);
    else if (!(view.accepts as readonly string[]).includes(r.form)) p('response.on', 'form_view', `The ${s.wire.show} view of ${s.wire.kind} does not host ${r.form}${view.accepts.length ? `; it hosts ${view.accepts.join(', ')}` : ''}.`);
  }
  if (r.form === 'tap' && r.on === null && viewed.size < 2) p('response.on', 'tap_views', 'A tap among views needs at least two views in the prompt; or name the view to tap inside with on.');
  if (problems.length) return { ok: false, problems };

  // Which structure role or measure the ask is, per structure.
  const askTargetFor = (sid: string): AskTarget => {
    const t = ask?.target;
    if (!t) return null;
    if (t.kind === 'measure') return t.structure === sid ? { measure: t.measure } : null;
    const b = (model.bindings.get(t.id) ?? []).find(x => x.structure === sid);
    return b ? { role: b.role } : null;
  };
  const reveals = new Map([...viewed].map(([sid, view]) => [sid, view.reveals(model.structures.get(sid)!.roles, askTargetFor(sid))]));
  const answerForm = isAnswerForm(r.form);

  // Templates: parse, closed-list rules, placeholders under the policy, render.
  const promptShown = new Set<string>();
  const used = new Set<string>();
  type Scope = 'prompt' | 'hint' | 'explanation';
  const resolver = (scope: Scope, path: string) => (ph: Placeholder): Result<Rich | 'mask'> => {
    const [head, member, attrRaw] = ph.path;
    used.add(head!);
    const fail = (code: string, message: string) => ({ ok: false as const, error: { code, message } });
    if (model.structures.has(head!) && member === 'view') {
      if (attrRaw !== undefined) return fail('placeholder_member', `{{${head}.view}} takes no member.`);
      const view = viewed.get(head!);
      if (!view) return fail('view_unshown', `{{${head}.view}} names a view the prompt does not show.`);
      return { ok: true, value: [{ kind: 'text', text: view.noun(model.structures.get(head!)!.roles) }] };
    }
    const isQuantity = model.quantities.has(head!);
    const refPath = isQuantity ? [head!] : [head!, member ?? ''];
    const attr = (isQuantity ? member : attrRaw) ?? '';
    if (isQuantity && attrRaw !== undefined) return fail('placeholder_member', `{{${ph.path.join('.')}}} goes too deep.`);
    if (!isValueAttr(attr)) return fail('placeholder_member', `"${attr}" is not a placeholder member (n, noun, one, other, word, unit).`);
    const t = model.target(refPath.filter(Boolean));
    if (!t.ok) return t;
    const bindings = model.bindings.get(t.value.kind === 'quantity' ? t.value.id : '') ?? [];
    if (isQuantity && bindings.length) return fail('role_by_id', `${head} is bound to ${bindings[0]!.structure}.${bindings[0]!.role}; name it through the role: {{${bindings[0]!.structure}.${bindings[0]!.role}${attr ? `.${attr}` : ''}}}.`);
    if (t.value.kind === 'quantity') used.add(t.value.id);
    const described = model.describe(t.value);
    const masked = scope !== 'explanation' && answerForm && ask?.target?.key === t.value.key;
    if (masked) {
      if (VALUE_BEARING.has(attr)) return { ok: true, value: 'mask' };
      if (attr === 'noun' || attr === 'unit') return fail('answer_inflected', `{{${ph.path.join('.')}}} is inflected for the answer's value; use .one or .other.`);
    } else if (scope !== 'explanation' && answerForm && ask && VALUE_BEARING.has(attr) && describedEqual(described, ask.described)) {
      return fail('answer_stated', `{{${ph.path.join('.')}}} states a quantity equal to the answer (same kind, noun and value).`);
    }
    if (scope === 'prompt' && VALUE_BEARING.has(attr)) promptShown.add(t.value.key);
    return formatValue(described, attr, locale);
  };
  const renderOne = (source: string, mode: 'text' | 'math', scope: Scope, path: string): string | null => {
    const t = parseTempl(source, mode);
    if (!t.ok) { p(path, t.error.code, t.error.message); return null; }
    for (const i of proseIssues(t.value, { locale })) p(path, i.code, i.message);
    const out = renderTempl(t.value as Templ, resolver(scope, path));
    if (!out.ok) { p(path, out.error.code, out.error.message); return null; }
    return out.value;
  };
  const prompt: RenderedBlock[] = a.prompt.map((b: WireBlock, i) => {
    if (b.type === 'view') return b;
    if (b.type === 'text') return { type: 'text', text: renderOne(b.text, 'text', 'prompt', `prompt[${i}].text`) ?? '' };
    return { type: 'math', tex: renderOne(b.tex, 'math', 'prompt', `prompt[${i}].tex`) ?? '' };
  });
  const hints = a.support.hints.map((h, i) => renderOne(h, 'text', 'hint', `support.hints[${i}]`) ?? '');
  const explanation = renderOne(a.support.explanation, 'text', 'explanation', 'support.explanation') ?? '';
  if (problems.length) return { ok: false, problems };

  // The reveal rule (README §7).
  const memo = new Map<string, Known>();
  const status = (t: Target): Known => {
    const cached = memo.get(t.key);
    if (cached !== undefined) return cached;
    memo.set(t.key, 'unknown');
    let k: Known = 'unknown';
    if (promptShown.has(t.key)) k = 'shown';
    if (t.kind === 'quantity') {
      for (const b of model.bindings.get(t.id) ?? []) { const rv = reveals.get(b.structure)?.[b.role]; if (rv && rv !== 'hidden') k = stronger(k, rv); }
      const q = model.quantities.get(t.id)!;
      if (k === 'unknown' && q.derived && refsOf(q.expr).every(path => { const r2 = model.target(path); return r2.ok && status(r2.value) !== 'unknown'; })) k = 'computable';
    } else {
      const rv = reveals.get(t.structure)?.[t.measure];
      if (rv && rv !== 'hidden') k = stronger(k, rv);
      if (k === 'unknown') {
        const s = model.structures.get(t.structure)!;
        const inputs = s.def.measures[t.measure]!.inputs.map(role => s.roles[role]);
        if (inputs.every(b => b && status({ kind: 'quantity', key: b.id, id: b.id }) !== 'unknown')) k = 'computable';
      }
    }
    memo.set(t.key, k);
    return k;
  };
  const refTargets = (e: Expr) => refsOf(e).map(path => model.target(path)).flatMap(t => t.ok ? [t.value] : []);
  if (ask) {
    const unknown = refTargets(ask.expr).filter(t => status(t) === 'unknown');
    if (answerForm) {
      if (unknown.length) p('response.ask', 'ask_unanswerable', `The learner cannot find ${unknown.map(t => t.key).join(', ')}: nothing in the prose or the views shows it, makes it countable or lets it be computed.`);
      const t = ask.target;
      if (t) {
        const viewReveal = [...reveals].map(([sid, rv]) => {
          const at = askTargetFor(sid);
          return at ? rv['role' in at ? at.role : at.measure] : undefined;
        });
        if (viewReveal.includes('shown')) p('response.ask', 'answer_shown', `A view prints ${t.key}, which is the answer.`);
        if (t.kind === 'quantity' && !model.quantities.get(t.id)!.derived && !viewReveal.includes('countable'))
          p('response.ask', 'ask_asserted', `${t.key} is a given literal that no view makes countable, so the key would be asserted, not computed; ask a measure or a derived quantity.`);
      }
    } else {
      if (ask.target && !promptShown.has(ask.target.key)) p('response.ask', 'target_not_given', `${r.form} acts toward ${ask.target.key}, but the prompt never states it; name it with a placeholder.`);
      if (unknown.length && !ask.target) p('response.ask', 'ask_unanswerable', `The learner cannot find ${unknown.map(t => t.key).join(', ')}.`);
    }
  }

  // Everything declared is used somewhere.
  for (const [, q] of model.quantities) for (const path of refsOf(q.expr)) used.add(path[0]!);
  for (const e of [ask?.expr, ...candidates.map(c => c.expr), ...distractors.map(d => d.expr)]) if (e) for (const path of refsOf(e)) { used.add(path[0]!); const t = model.target(path); if (t.ok && t.value.kind === 'quantity') used.add(t.value.id); }
  for (const [qid] of model.bindings) used.add(qid);
  for (const sid of viewed.keys()) used.add(sid);
  if ('on' in r && r.on) used.add(r.on);
  for (const [id, q] of model.quantities) if (!used.has(id)) p(`model.quantities[${a.model.quantities.findIndex(x => x.id === id)}]`, 'unused', `${id} (${q.decl.kind}) is never used.`);
  for (const [sid, s] of model.structures) if (!used.has(sid)) p(`model.structures[${s.index}]`, 'unused', `${sid} is never shown or referenced.`);
  if (problems.length) return { ok: false, problems };

  // L2: every view lowers to a drawing that satisfies the drawing invariants.
  const drawings = new Map<string, Drawing>();
  for (const [sid, view] of viewed) {
    const s = model.structures.get(sid)!;
    const drawing = view.lower(s.roles, { grade, ask: askTargetFor(sid) });
    for (const msg of drawingProblems({ ...drawing, id: sid, alt: 'drawing' } as Parameters<typeof drawingProblems>[0])) problems.push(problem('L2', `model.structures[${s.index}].show`, { code: 'draw', message: msg }));
    drawings.set(sid, drawing);
  }
  if (problems.length) return { ok: false, problems };

  return { ok: true, activity: { wire: a, grade, band: options.band, model, ask, candidates, distractors, rendered: { prompt, hints, explanation }, drawings, reveals } };
}

export interface BatchValidation { accepted: CheckedActivity[]; rejected: { index: number; problems: Problem[] }[]; errors: string[] }
/** Validate a batch (an object, or reply text with chatter tolerated); each invalid activity is dropped on its own. */
export function validateBatch(input: unknown, options: ValidateOptions): BatchValidation {
  let value = input;
  if (typeof value === 'string') {
    const extracted = extractJsonObject(value);
    if (!extracted.ok) return { accepted: [], rejected: [], errors: [extracted.error] };
    value = extracted.value;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { accepted: [], rejected: [], errors: ['Response must be a JSON object.'] };
  const record = value as Record<string, unknown>;
  const extra = Object.keys(record).filter(k => k !== 'activities');
  if (extra.length) return { accepted: [], rejected: [], errors: [`Unknown field(s): ${extra.slice(0, 5).join(', ')}`] };
  const list = record.activities;
  if (!Array.isArray(list) || list.length < 1 || list.length > 5) return { accepted: [], rejected: [], errors: ['activities must be a list of 1–5 activities.'] };
  const out: BatchValidation = { accepted: [], rejected: [], errors: [] };
  list.forEach((item, index) => { const v = validateActivity(item, options); if (v.ok) out.accepted.push(v.activity); else out.rejected.push({ index, problems: v.problems }); });
  return out;
}
