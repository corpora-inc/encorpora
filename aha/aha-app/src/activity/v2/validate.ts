/**
 * Activity Spec v2 validation (README §11): L0 shape, L1 model, L2 render feasibility. An invalid
 * activity is dropped, never repaired. Every rejection is a Problem with a stable code.
 *
 * L1 covers the model, the prose, the views and the reveal rule, and ends by compiling the response
 * (response.ts): the key fits the form, distractor rules evaluate, uniqueness is computed.
 */
import { getSkill } from '../../learning/curriculum';
import { compare, rational } from '../../learning/rational';
import { extractJsonObject } from '../spec';
import { drawingProblems } from '../draw';
import { evaluate, formatValue, isValueAttr, parseExpr, refsOf, sameValue, type Described, type Expr, type Result, type Rich, type Value, type ValueAttr } from './quantity';
import { parseTempl, proseIssues, renderTempl, type Placeholder, type Templ } from './text';
import { bindModel, problem, type Model, type Problem, type Target } from './model';
import { BANDS, FORM_GRADES, NOTHING_ASKED, gradeLabel, gradeNum, inRange, isAnswerForm, rangeLabel, type Asked, type Band, type Drawing, type Reveal, type ViewDef } from './registry';
import { bandWire, type WireActivity, type WireBlock } from './wire';
import { compileResponse, type CompiledResponse } from './response';
import { representationIssues } from './representations';

export interface ValidateOptions {
  /** The band whose schema the request carried. */
  band: Band;
  /** Skill ids offered in the request's STANDARDS window. */
  skillIds: ReadonlySet<string>;
  locale?: string;
}
export type RenderedBlock = { type: 'text'; text: string } | { type: 'math'; tex: string } | { type: 'view'; of: string };
/** The ask: one reference, valued. */
export interface Ask { expr: Expr; value: Value; target: Target; described: Described }
/** Everything validation establishes before the response is compiled. */
export interface CheckedCore {
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
  /** Per viewed structure, the roles and measure that are the answer (answer forms; empty for act forms, whose target is given). */
  asked: Map<string, Asked>;
}
export interface CheckedActivity extends CheckedCore {
  /** The key, computed; the response compiled to the grading IR (response.ts). */
  response: CompiledResponse;
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
  // The skill's representation set (README §10): the intents, views and form that practise it.
  for (const i of representationIssues(skill.id, a.model.structures.map(st => ({ kind: st.kind, show: st.show as string | null })), a.response.form)) p('aim.skills[0]', i.code, i.message);
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
  /** Distractor rules are arithmetic a learner wrongly does on the numbers they see (an area minus a
   * side), so they evaluate without dimensions; the options still read in the key's unit. */
  const plainNumbers = (path: readonly string[]) => { const v = model.resolve(path); return v.ok ? { ok: true as const, value: { ...v.value, power: 0, unit: null } } : v; };
  const valued = (source: string, path: string, misconception = false): { expr: Expr; value: Value } | null => {
    const e = parseExpr(source);
    if (!e.ok) { p(path, e.error.code, e.error.message); return null; }
    const v = evaluate(e.value, misconception ? plainNumbers : model.resolve);
    if (!v.ok) { p(path, v.error.code, v.error.message); return null; }
    return { expr: e.value, value: v.value };
  };
  let ask: Ask | null = null;
  if ('ask' in r) {
    const v = valued(r.ask, 'response.ask');
    // The ask is one reference, so the answer is always a named, typed thing: a computed answer is a
    // derived quantity with its own kind, noun and unit (left = "s.total - e"), never a bare expression.
    if (v && v.expr.t !== 'ref') p('response.ask', 'ask_not_ref', 'The ask names one quantity, role or measure. Declare anything computed as a derived quantity (e.g. left = "s.total - e") and ask that.');
    else if (v) {
      const target = (model.target((v.expr as Extract<Expr, { t: 'ref' }>).path) as { ok: true; value: Target }).value;
      ask = { ...v, target, described: model.describe(target) };
    }
  }
  // Candidates are references, like every number (README §3): what the options show is declared once.
  const candidates = ('candidates' in r ? r.candidates ?? [] : []).flatMap((c, i) => {
    const v = valued(c, `response.candidates[${i}]`);
    if (v && v.expr.t !== 'ref') { p(`response.candidates[${i}]`, 'candidate_not_ref', 'A candidate names one quantity or measure; declare it and list its name.'); return []; }
    return v ? [v] : [];
  });
  const distractors = ('distractors' in r ? r.distractors : []).flatMap((d, i) => { const v = valued(d.expr, `response.distractors[${i}].expr`, true); return v ? [{ ...v, tag: d.tag }] : []; });
  if ('on' in r && r.on !== null) {
    const s = model.structures.get(r.on);
    const view = viewed.get(r.on);
    if (!s) p('response.on', 'ref_unknown', `"${r.on}" is not a structure.`);
    else if (!view) p('response.on', 'view_unshown', `${r.form} acts on ${r.on}'s view, which the prompt does not show.`);
    else if (!(view.accepts as readonly string[]).includes(r.form)) p('response.on', 'form_view', `The ${s.wire.show} view of ${s.wire.kind} does not host ${r.form}${view.accepts.length ? `; it hosts ${view.accepts.join(', ')}` : ''}.`);
  }
  if (r.form === 'tap' && r.on === null && viewed.size < 2) p('response.on', 'tap_views', 'A tap among views needs at least two views in the prompt; or name the view to tap inside with on.');
  if (problems.length) return { ok: false, problems };

  /**
   * Whether a printed value states the answer (answer forms, README §8.1), decided without nouns or
   * prose. A value computed from the model (a measure or a derived quantity) that equals the answer
   * recomputes it. A given that equals the answer states it only when the answer IS that given: the
   * ask, recomputed exactly with the given doubled and tripled, still equals it ("12 apples in 3
   * baskets: how many in all?"). Otherwise the equality is a coincidence of inputs ("eat 8, 4 are
   * left" beside baskets of 4; "4 × □ = 16"), which is legitimate.
   */
  const statesAnswer = (t: Target, d: Described): boolean => {
    if (!ask || !sameValue(d.value, ask.value) || d.value.power !== ask.value.power || d.value.unit !== ask.value.unit) return false;
    if (t.kind === 'measure' || !model.isGiven(t.id)) return true;
    const base = d.value.q;
    return [2n, 3n].every(k => {
      const moved = base.n === 0n ? rational(k) : rational(base.n * k, base.d);
      const v = model.valueWith(ask.target, new Map([[t.id, moved]]));
      return !!v && compare(v.q, moved) === 0;
    });
  };
  const answerForm = isAnswerForm(r.form);
  /**
   * The names, per structure, of the roles and measures that are the answer: every role bound to the
   * asked quantity, the asked measure, and (answer forms) any other role or measure that states the
   * answer by the same test the prose obeys. Views hide or count them; descriptions never state them.
   */
  const askedIn = (sid: string): Asked => {
    const t = ask?.target;
    if (!t) return NOTHING_ASKED;
    const s = model.structures.get(sid)!;
    const names = new Set(t.kind === 'measure' ? (t.structure === sid ? [t.measure] : []) : (model.bindings.get(t.id) ?? []).filter(b => b.structure === sid).map(b => b.role));
    if (answerForm) {
      for (const role of Object.keys(s.def.roles)) { const b = s.roles[role]; if (b && statesAnswer({ kind: 'quantity', key: b.id, id: b.id }, model.describe({ kind: 'quantity', key: b.id, id: b.id }))) names.add(role); }
      for (const m of Object.keys(s.def.measures)) { const mt: Target = { kind: 'measure', key: `${sid}.${m}`, structure: sid, measure: m }; const v = model.resolve([sid, m]); if (v.ok && statesAnswer(mt, model.describe(mt))) names.add(m); }
    }
    return names;
  };
  const reveals = new Map([...viewed].map(([sid, view]) => [sid, view.reveals(model.structures.get(sid)!.roles, askedIn(sid))]));
  // The ask's support: everything its value is computed from (candidates belong to the question too).
  // A structure is part of the math asked when one of its measures is in the support, or it binds the
  // asked or a candidate quantity itself; sharing an input is not enough (a decoy figure). A figure or
  // a number outside that is not part of the math asked.
  const supportKeys = new Set<string>(), relevant = new Set<string>();
  const support = (t: Target) => {
    if (supportKeys.has(t.key)) return;
    supportKeys.add(t.key);
    if (t.kind === 'measure') relevant.add(t.structure);
    for (const src of model.sources(t)) support(src);
  };
  const anchor = (t: Target) => { if (t.kind === 'quantity') for (const b of model.bindings.get(t.id) ?? []) relevant.add(b.structure); };
  const candidateTargets = candidates.map(c => (model.target((c.expr as Extract<Expr, { t: 'ref' }>).path) as { ok: true; value: Target }).value);
  for (const t of [...(ask ? [ask.target] : []), ...candidateTargets]) { support(t); anchor(t); }
  if ('on' in r && r.on) relevant.add(r.on);
  if (r.form === 'tap' && r.on === null) for (const sid of viewed.keys()) relevant.add(sid);
  for (const sid of viewed.keys()) if (!relevant.has(sid)) p(`prompt`, 'view_unrelated', `The view of ${sid} is not part of the math asked: the ask is not computed from it.`);
  /** Is this value part of the math asked: in the ask's support, or a role or measure of a figure that is part of it? */
  const mayReveal = (t: Target) => supportKeys.has(t.key)
    || (t.kind === 'measure' ? relevant.has(t.structure) : (model.bindings.get(t.id) ?? []).some(b => relevant.has(b.structure)));
  // Candidate forms: the prompt prints every candidate or none, and a hint prints none, so prose can
  // never single out the correct option (the options show them all anyway).
  const candidateKeys = new Set(candidateTargets.map(t => t.key));
  const revealedCandidates = new Set<string>();

  // Templates: parse, closed-list rules, placeholders under the policy, render.
  const promptShown = new Set<string>();
  const used = new Set<string>();
  type Scope = 'prompt' | 'hint' | 'explanation';
  const resolver = (scope: Scope) => (ph: Placeholder): Result<Rich | 'mask'> => {
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
    const key = t.value.key;
    const printed = scope !== 'explanation' && VALUE_BEARING.has(attr);
    if (scope !== 'explanation' && answerForm && ask && key === ask.target.key) {
      if (VALUE_BEARING.has(attr)) return { ok: true, value: 'mask' };
      if (attr === 'noun' || attr === 'unit') return fail('answer_inflected', `{{${ph.path.join('.')}}} is inflected for the answer's value; use .one or .other.`);
    } else if (printed) {
      // A number outside the math asked is story context, unless it equals the answer: then it can only
      // be a restatement of it ("12 in all"), whatever its noun.
      if (!mayReveal(t.value)) {
        if (answerForm && ask && sameValue(described.value, ask.value) && described.value.power === ask.value.power && described.value.unit === ask.value.unit)
          return fail('answer_stated', `{{${ph.path.join('.')}}} prints a number the question does not use, and it equals the answer.`);
      }
      const candidate = candidateKeys.has(key);
      if (candidate && scope === 'hint') return fail('candidate_in_hint', `{{${ph.path.join('.')}}} is one of the options; a hint never names an option.`);
      if (candidate) revealedCandidates.add(key);
      else if (answerForm && statesAnswer(t.value, described)) return fail('answer_stated', `{{${ph.path.join('.')}}} states the answer: it is computed from the model and equals it, or the answer is exactly this given.`);
    }
    if (scope === 'prompt' && VALUE_BEARING.has(attr)) promptShown.add(key);
    // Grades K–2 name shares in words ("one half", "a third of"); fraction notation starts in grade 3 (CCSS).
    if (grade <= 2 && described.kind === 'fraction' && (attr === '' || attr === 'n')) return fail('fraction_words', `In grades K–2 write fractions in words: {{${refPath.filter(Boolean).join('.')}.word}}.`);
    return formatValue(described, attr, locale);
  };
  // Figure words the prose may use: those of the views the prompt shows (a "rectangle" beside a circle is not one).
  const allowedViewWords = new Set([...viewed.values()].flatMap(v => v.words));
  const renderOne = (source: string, mode: 'text' | 'math', scope: Scope, path: string): string | null => {
    const t = parseTempl(source, mode);
    if (!t.ok) { p(path, t.error.code, t.error.message); return null; }
    for (const i of proseIssues(t.value, { locale, allowedViewWords })) p(path, i.code, i.message);
    const out = renderTempl(t.value as Templ, resolver(scope));
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
    let k: Known = promptShown.has(t.key) ? 'shown' : 'unknown';
    if (t.kind === 'quantity') {
      for (const b of model.bindings.get(t.id) ?? []) { const rv = reveals.get(b.structure)?.[b.role]; if (rv && rv !== 'hidden') k = stronger(k, rv); }
      // A derived value is computable from knowable sources; a given (no references) is known only if shown or countable.
      if (k === 'unknown' && !model.isGiven(t.id) && refsOf(model.quantities.get(t.id)!.expr).every(path => { const r2 = model.target(path); return r2.ok && status(r2.value) !== 'unknown'; })) k = 'computable';
    } else {
      const rv = reveals.get(t.structure)?.[t.measure];
      if (rv && rv !== 'hidden') k = stronger(k, rv);
      if (k === 'unknown') {
        const s = model.structures.get(t.structure)!, def = s.def.measures[t.measure]!;
        const reads = [...def.inputs, ...(def.reads ?? [])].flatMap(role => { const b = s.roles[role]; return b ? [b] : []; });
        if (reads.every(b => status({ kind: 'quantity', key: b.id, id: b.id }) !== 'unknown')) k = 'computable';
      }
    }
    memo.set(t.key, k);
    return k;
  };
  if (ask) {
    const t = ask.target;
    if (answerForm) {
      if (status(t) === 'unknown') p('response.ask', 'ask_unanswerable', `The learner cannot find ${t.key}: nothing in the prose or the views shows it, makes it countable, or gives what it is computed from.`);
      // Every view, not only the ask's own structure: another view may print the same quantity.
      for (const [sid, rv] of reveals) {
        const s = model.structures.get(sid)!;
        for (const [name, reveal] of Object.entries(rv)) {
          if (reveal !== 'shown') continue;
          const shown = Object.hasOwn(s.def.roles, name) ? (s.roles[name] ? { kind: 'quantity' as const, key: s.roles[name]!.id, id: s.roles[name]!.id } : null) : { kind: 'measure' as const, key: `${sid}.${name}`, structure: sid, measure: name };
          if (shown && (shown.key === t.key || statesAnswer(shown, model.describe(shown)))) p('response.ask', 'answer_shown', `The ${s.wire.show} view of ${sid} prints ${sid}.${name}, which states the answer.`);
        }
      }
      const countable = t.kind === 'quantity' && (model.bindings.get(t.id) ?? []).some(b => reveals.get(b.structure)?.[b.role] === 'countable');
      if (t.kind === 'quantity' && model.isGiven(t.id) && !countable)
        p('response.ask', 'ask_asserted', `${t.key} is a value the model states outright and no view makes countable, so the key would be asserted, not computed; ask a measure or a derived quantity.`);
    } else if (!promptShown.has(t.key)) {
      // Act forms: the target is the instruction. Whether the hosting view already marks it is checked when the response compiles.
      p('response.ask', 'target_not_given', `${r.form} acts toward ${t.key}, but the prompt never states it; name it with a placeholder.`);
    }
  }

  if (revealedCandidates.size && revealedCandidates.size !== candidateKeys.size)
    p('response.candidates', 'candidates_partial', 'The prompt names some options but not all; name every option or none, so the prose cannot single one out.');

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
    const drawing = view.lower(s.roles, { grade, asked: askedIn(sid) });
    for (const msg of drawingProblems({ ...drawing, id: sid, alt: 'drawing' } as Parameters<typeof drawingProblems>[0])) problems.push(problem('L2', `model.structures[${s.index}].show`, { code: 'draw', message: msg }));
    drawings.set(sid, drawing);
  }
  if (problems.length) return { ok: false, problems };

  const asked = new Map([...viewed.keys()].map(sid => [sid, answerForm ? askedIn(sid) : NOTHING_ASKED]));
  const core: CheckedCore = { wire: a, grade, band: options.band, model, ask, candidates, distractors, rendered: { prompt, hints, explanation }, drawings, reveals, asked };
  // The key fits the form, distractor rules evaluate, uniqueness is computed (README §8).
  const compiled = compileResponse(core, locale);
  if (!compiled.ok) return { ok: false, problems: compiled.issues.map(i => ({ layer: 'L1' as const, path: i.path, code: i.code, message: i.message })) };
  return { ok: true, activity: { ...core, response: compiled.value } };
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
