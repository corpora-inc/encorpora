/**
 * Responses (README §8): the key is the value of the ask, computed by the app; distractors are
 * rules the app evaluates; uniqueness is computed, never asserted; and every form compiles to the
 * grading IR (grade.ts: v1's ResponseSpec plus shade, place and tap_view), so v1's grader grades it.
 */
import { regionIds, type Figure, type ResponseSpec } from '../spec';
import type { GradeSpec } from '../grade';
import { compare } from '../../learning/rational';
import { exactDecimal, formatNumber, formatPlain, sameValue, unitSymbol, type Issue, type QuantityKind, type Rich, type Value } from './quantity';
import type { Model, Target } from './model';
import type { Region } from './registry';
import type { Ask, CheckedCore } from './validate';

export type Verification = 'computed' | 'derived';
export interface CompiledResponse {
  spec: GradeSpec;
  /** The key as an exact literal: "12", "2.5", "1/4"; "region:<id>", "view:<id>", "select:<i,…>", "order:<i,…>". */
  key: string;
  verification: Verification;
}
type Outcome = { ok: true; value: CompiledResponse } | { ok: false; issues: (Issue & { path: string })[] };

const MAX_DECIMAL_PLACES = 3;
const fail = (path: string, code: string, message: string): Outcome => ({ ok: false, issues: [{ path, code, message }] });

/** Plain-text exact literal of a value: a/b for a fraction kind; otherwise whole, terminating decimal, or a/b. */
export function literal(q: Value['q'], kind: QuantityKind = 'number'): string {
  const d = exactDecimal(q);
  if (kind === 'fraction' || q.d === 1n || !d || d.frac.length > MAX_DECIMAL_PLACES) return formatPlain(q);
  return `${d.negative ? '-' : ''}${d.int}.${d.frac}`;
}
const richText = (r: Rich) => r.map(p => p.kind === 'math' ? `$${p.tex}$` : p.text.replace(/\$/g, '\\$')).join('');
/**
 * One option, formatted the same way for every option of a question: the number (a TeX fraction for
 * fraction kinds), then the unit symbol of the key's dimension, if any. A perimeter offered beside an
 * area reads in square units, as the learner would write it.
 */
function optionText(v: Pick<Value, 'q' | 'form'>, kind: QuantityKind, key: Value, locale: string): string {
  const number = richText(formatNumber(v, locale, kind === 'fraction'));
  return key.unit ? `${number} ${unitSymbol(key.unit, key.power)}` : number;
}
/** The kind of what an expression names: its target's, when it is one reference. */
function kindOf(model: Model, e: { expr: { t: string; path?: readonly string[] } }, fallback: QuantityKind): QuantityKind {
  if (e.expr.t !== 'ref') return fallback;
  const t = model.target(e.expr.path!);
  return t.ok ? model.describe(t.value).kind : fallback;
}
/** Distractor rules that survive: not equal to the key, distinct by value. */
function survivors(c: CheckedCore, key: Value) {
  const kept: { value: Value; tag: string }[] = [];
  for (const d of c.distractors) if (!sameValue(d.value, key) && !kept.some(k => sameValue(k.value, d.value))) kept.push({ value: d.value, tag: d.tag });
  return kept;
}
function verification(c: CheckedCore, ask: Ask): Verification {
  const t: Target | null = ask.target;
  if (!t) return 'derived';
  if (t.kind === 'measure') return 'computed';
  return c.model.quantities.get(t.id)!.derived ? 'derived' : 'computed';
}

export function compileResponse(c: CheckedCore, locale = 'en-US'): Outcome {
  const r = c.wire.response;
  const ask = c.ask;
  switch (r.form) {
    case 'number': {
      const key = ask!.value;
      const dec = exactDecimal(key.q);
      if (!dec || dec.frac.length > MAX_DECIMAL_PLACES) return fail('response.form', 'form_value', `The key is ${formatPlain(key.q)}, which is not a whole number or a short decimal; use fraction or choose.`);
      const misses = survivors(c, key).map(d => ({ answer: Number(d.value.q.n) / Number(d.value.q.d), tag: d.tag }));
      const noun = ask!.described.noun;
      const spec: ResponseSpec = {
        type: 'numeric', answer: Number(key.q.n) / Number(key.q.d),
        ...(key.unit ? { unit: unitSymbol(key.unit, key.power) } : noun ? { label: noun.other } : {}),
        ...(misses.length ? { misconceptionAnswers: misses } : {}),
      };
      return { ok: true, value: { spec, key: literal(key.q, ask!.described.kind), verification: verification(c, ask!) } };
    }
    case 'fraction': {
      const key = ask!.value;
      if (key.unit) return fail('response.form', 'form_value', 'A fraction answer is a plain number; this key has a unit.');
      const terms = r.exactness !== 'simplest' && key.form?.kind === 'fraction' ? { numerator: Number(key.form.n), denominator: Number(key.form.d) } : { numerator: Number(key.q.n), denominator: Number(key.q.d) };
      const misses = survivors(c, key).map(d => ({ numerator: Number(d.value.q.n), denominator: Number(d.value.q.d), tag: d.tag }));
      const spec: ResponseSpec = { type: 'fraction', ...terms, form: r.exactness, ...(misses.length ? { misconceptionAnswers: misses } : {}) };
      return { ok: true, value: { spec, key: literal(key.q, ask!.described.kind), verification: verification(c, ask!) } };
    }
    case 'choose': {
      const key = ask!.value, kind = ask!.described.kind;
      const tags = survivors(c, key);
      const options = c.candidates.length
        ? c.candidates.map(cand => ({ value: cand.value, kind: kindOf(c.model, cand, kind) }))
        : [{ value: key, kind }, ...tags.map(t => ({ value: t.value, kind }))];
      if (options.length < 2) return fail('response.distractors', 'choose_options', 'choose needs at least two options: give distractor rules whose values differ from the key and from each other.');
      const correct = options.filter(o => sameValue(o.value, key)).length;
      if (correct !== 1) return fail('response.candidates', correct ? 'choose_ambiguous' : 'choose_no_key', correct ? `${correct} options equal the key ${formatPlain(key.q)}.` : `No option equals the key ${formatPlain(key.q)}.`);
      const texts = options.map(o => optionText(o.value, o.kind, key, locale));
      if (new Set(texts).size !== texts.length) return fail('response.candidates', 'choose_duplicate', 'Two options read the same.');
      const spec: ResponseSpec = {
        type: 'multiple_choice', shuffle: true,
        options: options.map((o, i) => {
          const tag = sameValue(o.value, key) ? undefined : tags.find(t => sameValue(t.value, o.value))?.tag;
          return { text: texts[i]!, correct: sameValue(o.value, key), ...(tag ? { misconception: tag } : {}) };
        }),
      };
      return { ok: true, value: { spec, key: literal(key.q, ask!.described.kind), verification: verification(c, ask!) } };
    }
    case 'select': {
      const target = ask!.value, kind = ask!.described.kind;
      const correct = c.candidates.map(cand => sameValue(cand.value, target));
      if (!correct.some(Boolean) || correct.every(Boolean)) return fail('response.candidates', 'select_split', 'select needs at least one candidate equal to the target and one that is not.');
      const texts = c.candidates.map(cand => optionText(cand.value, kindOf(c.model, cand, kind), target, locale));
      if (new Set(texts).size !== texts.length) return fail('response.candidates', 'select_duplicate', 'Two candidates read the same.');
      const spec: ResponseSpec = { type: 'multi_select', shuffle: true, options: texts.map((text, i) => ({ text, correct: correct[i]! })) };
      return { ok: true, value: { spec, key: `select:${correct.flatMap((v, i) => v ? [i] : []).join(',')}`, verification: 'computed' } };
    }
    case 'order': {
      const order = c.candidates.map((cand, i) => ({ cand, i })).sort((a, b) => compare(a.cand.value.q, b.cand.value.q) * (r.direction === 'ascending' ? 1 : -1));
      if (order.some((o, k) => k > 0 && sameValue(o.cand.value, order[k - 1]!.cand.value))) return fail('response.candidates', 'order_tie', 'Two candidates have the same value, so no order is the right one.');
      if (new Set(c.candidates.map(x => x.value.power + (x.value.unit ?? ''))).size > 1) return fail('response.candidates', 'dimension_mismatch', 'Candidates to order must all measure the same thing.');
      const first = c.candidates[0]!.value;
      const spec: ResponseSpec = { type: 'ordering', items: order.map(o => optionText(o.cand.value, kindOf(c.model, o.cand, 'number'), first, locale)) };
      return { ok: true, value: { spec, key: `order:${order.map(o => o.i).join(',')}`, verification: 'computed' } };
    }
    case 'tap': {
      const target = ask!.value;
      let regions: Region[];
      if (r.on === null) {
        regions = [];
        for (const sid of c.drawings.keys()) {
          const s = c.model.structures.get(sid)!;
          const v = c.model.resolve([sid, s.def.primary]);
          if (!v.ok) return fail('response.on', 'tap_value', `${sid} has no ${s.def.primary} to tap by (${v.error.message})`);
          regions.push({ id: sid, value: v.value, label: sid });
        }
      } else {
        const s = c.model.structures.get(r.on)!;
        regions = s.def.views[s.wire.show as string]!.regions?.(s.roles) ?? [];
      }
      if (regions.length < 2) return fail('response.on', 'tap_regions', 'A tap needs at least two regions to choose from.');
      const hits = regions.filter(x => sameValue(x.value, target));
      if (hits.length !== 1) return fail('response.form', hits.length ? 'tap_ambiguous' : 'tap_none', hits.length ? `Ill-posed: ${hits.length} regions satisfy the ask (each is ${formatPlain(target.q)}); use shade or select.` : `No region is ${formatPlain(target.q)}.`);
      const hit = hits[0]!;
      if (r.on === null) return { ok: true, value: { spec: { type: 'tap_view', figureIds: regions.map(x => x.id), figureId: hit.id }, key: `view:${hit.id}`, verification: 'computed' } };
      const drawn = regionIds({ ...c.drawings.get(r.on)!, id: r.on, alt: '' } as Figure);
      if (!drawn.includes(hit.id)) return fail('response.on', 'tap_unrenderable', `The drawing of ${r.on} has no tappable region ${hit.id}.`);
      return { ok: true, value: { spec: { type: 'tap_region', figureId: r.on, region: hit.id }, key: `region:${hit.id}`, verification: 'computed' } };
    }
    case 'shade': case 'place': {
      const s = c.model.structures.get(r.on)!;
      const view = s.def.views[s.wire.show as string]!;
      const act = r.form === 'shade' ? view.shade?.(s.roles, ask!.value) : view.place?.(s.roles, ask!.value);
      if (!act) return fail('response.on', 'form_view', `The ${s.wire.show} view does not host ${r.form}.`);
      if (isIssueLike(act)) return fail('response.ask', act.code, act.message);
      const spec: GradeSpec = r.form === 'shade'
        ? { type: 'shade', figureId: r.on, parts: (act as { parts: number }).parts, target: act.target }
        : { type: 'place', figureId: r.on, ticks: (act as { ticks: number }).ticks, target: act.target };
      return { ok: true, value: { spec, key: literal(ask!.value.q, ask!.described.kind), verification: 'computed' } };
    }
  }
}
const isIssueLike = (v: object): v is Issue => 'code' in v;
